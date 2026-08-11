var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { SequencerByKey } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { relativePath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { ILogService } from "../../log/common/log.js";
import { AgentSession } from "../common/agentService.js";
import { ChangesetKind, parseChangesetUri } from "../common/changesetUri.js";
import { EMPTY_TREE_OBJECT, IAgentHostGitService, META_DIFF_BASE_BRANCH, resolveDiffBaseBranchName } from "../common/agentHostGitService.js";
import { buildReviewedRefName } from "../common/agentHostReviewService.js";
import { ISessionDataService } from "../common/sessionDataService.js";
import { readSessionGitState } from "../common/state/sessionState.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
let AgentHostReviewService = class extends Disposable {
  constructor(_stateManager, _gitService, _sessionDataService, _logService) {
    super();
    this._stateManager = _stateManager;
    this._gitService = _gitService;
    this._sessionDataService = _sessionDataService;
    this._logService = _logService;
    /**
     * Serializes mark/unmark/read per session so back-to-back mutations don't
     * race on the reviewed ref rebuild and reads observe a consistent ref.
     */
    this._sequencer = new SequencerByKey();
    this._register(this._sessionDataService.onWillDeleteSessionData((e) => {
      e.waitUntil(this.disposeSessionData(e.session.toString(), e.workingDirectories));
    }));
  }
  async setReviewState(channel, resources, reviewed) {
    const parsed = parseChangesetUri(channel);
    if (!parsed || parsed.kind !== ChangesetKind.Branch) {
      throw new Error(`Not a branch changeset URI: ${channel}`);
    }
    const sessionState = this._stateManager.getSessionState(parsed.sessionUri);
    if (!sessionState) {
      throw new Error(`Session not found: ${parsed.sessionUri}`);
    }
    if (!sessionState.workingDirectories?.[0]) {
      throw new Error(`Session has no working directory: ${parsed.sessionUri}`);
    }
    const databaseRef = this._sessionDataService.openDatabase(URI.parse(parsed.sessionUri));
    let persistedBaseBranch;
    try {
      persistedBaseBranch = await databaseRef.object.getMetadata(META_DIFF_BASE_BRANCH);
    } finally {
      databaseRef.dispose();
    }
    const workingDirectory = URI.parse(sessionState.workingDirectories?.[0]);
    const baseBranch = resolveDiffBaseBranchName(persistedBaseBranch, readSessionGitState(sessionState._meta)?.baseBranchName);
    await this._sequencer.queue(parsed.sessionUri, async () => {
      for (const resource of resources) {
        await this._setReviewed(parsed.sessionUri, workingDirectory, baseBranch, URI.parse(resource), reviewed);
      }
    });
  }
  markFileReviewed(session, workingDirectory, baseBranch, resource) {
    return this._sequencer.queue(session, () => this._setReviewed(session, workingDirectory, baseBranch, resource, true));
  }
  markFileUnreviewed(session, workingDirectory, baseBranch, resource) {
    return this._sequencer.queue(session, () => this._setReviewed(session, workingDirectory, baseBranch, resource, false));
  }
  getReviewedPaths(session, workingDirectory, baseBranch) {
    return this._sequencer.queue(session, () => this._getReviewedPaths(session, workingDirectory, baseBranch));
  }
  copyReviewedRef(sourceSession, targetSession, workingDirectory) {
    return this._sequencer.queue(targetSession, () => this._copyReviewedRef(sourceSession, targetSession, workingDirectory));
  }
  async _copyReviewedRef(sourceSession, targetSession, workingDirectory) {
    const repoRoot = await this._gitService.getRepositoryRoot(workingDirectory);
    if (!repoRoot) {
      return;
    }
    const sourceRef = buildReviewedRefName(this._sanitizedSessionId(sourceSession));
    const sourceCommit = await this._gitService.revParse(repoRoot, sourceRef);
    if (!sourceCommit) {
      return;
    }
    const targetRef = buildReviewedRefName(this._sanitizedSessionId(targetSession));
    await this._gitService.updateRef(repoRoot, targetRef, sourceCommit);
    this._logService.trace(`[AgentHostReview][_copyReviewedRef] Copied reviewed ref ${sourceRef} -> ${targetRef} for fork`);
  }
  async _setReviewed(session, workingDirectory, baseBranch, resource, reviewed) {
    const context = await this._resolveContext(session, workingDirectory, baseBranch);
    if (!context) {
      return;
    }
    const path = relativePath(context.repoRoot, resource);
    if (!path) {
      this._logService.warn(`[AgentHostReview][_setReviewed] '${resource.toString()}' is not under the repository root '${context.repoRoot.toString()}'; skipping`);
      return;
    }
    let source;
    if (reviewed) {
      source = await this._gitService.captureWorkingTreeAsTree(workingDirectory);
    } else {
      source = context.baselineTree;
    }
    if (!source) {
      return;
    }
    const newTree = await this._gitService.overlayPathIntoTree(context.repoRoot, context.reviewedTree, path, source);
    if (!newTree) {
      return;
    }
    if (newTree === context.reviewedTree) {
      return;
    }
    const message = `review: ${reviewed ? "mark" : "unmark"} ${path}`;
    const commit = await this._gitService.commitTree(context.repoRoot, newTree, context.reviewedCommit, message);
    if (!commit) {
      return;
    }
    await this._gitService.updateRef(context.repoRoot, context.reviewedRef, commit);
    this._logService.trace(`[AgentHostReview][_setReviewed] ${message} for ${session.toString()} -> ${context.reviewedRef}@${commit}`);
  }
  async _getReviewedPaths(session, workingDirectory, baseBranch) {
    const context = await this._resolveContext(session, workingDirectory, baseBranch);
    if (!context?.reviewedCommit) {
      return /* @__PURE__ */ new Set();
    }
    const workingTree = await this._gitService.captureWorkingTreeAsTree(workingDirectory);
    if (!workingTree) {
      return /* @__PURE__ */ new Set();
    }
    const [changed, unreviewed] = await Promise.all([
      this._gitService.diffTreePaths(context.repoRoot, context.baselineTree, workingTree),
      this._gitService.diffTreePaths(context.repoRoot, context.reviewedTree, workingTree)
    ]);
    if (!changed) {
      return /* @__PURE__ */ new Set();
    }
    const unreviewedSet = new Set(unreviewed ?? []);
    return new Set(changed.filter((path) => !unreviewedSet.has(path)));
  }
  async _resolveContext(session, workingDirectory, baseBranch) {
    const repoRoot = await this._gitService.getRepositoryRoot(workingDirectory);
    if (!repoRoot) {
      return void 0;
    }
    const baselineCommit = await this._gitService.resolveBranchBaselineCommit(workingDirectory, baseBranch);
    if (!baselineCommit) {
      return void 0;
    }
    const baselineTree = baselineCommit !== EMPTY_TREE_OBJECT ? await this._gitService.revParse(repoRoot, `${baselineCommit}^{tree}`) : EMPTY_TREE_OBJECT;
    if (!baselineTree) {
      return void 0;
    }
    const reviewedRef = buildReviewedRefName(this._sanitizedSessionId(session));
    const reviewedCommit = await this._gitService.revParse(repoRoot, reviewedRef);
    const reviewedTree = reviewedCommit ? await this._gitService.revParse(repoRoot, `${reviewedCommit}^{tree}`) ?? baselineTree : baselineTree;
    return { repoRoot, baselineTree, reviewedRef, reviewedCommit, reviewedTree };
  }
  async disposeSessionData(session, workingDirectories) {
    await this._sequencer.queue(session, () => this._disposeSessionData(session, workingDirectories));
  }
  async _disposeSessionData(session, workingDirectories) {
    if (!workingDirectories || workingDirectories.length === 0) {
      return;
    }
    const sanitizedSessionId = this._sanitizedSessionId(session);
    const reviewedRef = buildReviewedRefName(sanitizedSessionId);
    for (const workingDirectory of workingDirectories) {
      try {
        const workingDirectoryUri = URI.parse(workingDirectory);
        const repositoryRootUri = await this._gitService.getRepositoryRoot(workingDirectoryUri);
        if (!repositoryRootUri) {
          continue;
        }
        await this._gitService.deleteRefs(repositoryRootUri, [reviewedRef]);
        this._logService.trace(`[AgentHostReview][_disposeSessionData] Deleted reviewed ref for ${session} in working directory ${workingDirectory}`);
      } catch (err) {
        this._logService.warn(`[AgentHostReview][_disposeSessionData] Failed to dispose reviewed ref for ${session} in working directory ${workingDirectory}`, err);
      }
    }
  }
  _sanitizedSessionId(session) {
    return AgentSession.id(session).replace(/[^a-zA-Z0-9_.-]/g, "-");
  }
};
AgentHostReviewService = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, IAgentHostGitService),
  __decorateParam(2, ISessionDataService),
  __decorateParam(3, ILogService)
], AgentHostReviewService);
export {
  AgentHostReviewService
};
