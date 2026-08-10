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
import * as fs from "fs/promises";
import { RunOnceScheduler, SequencerByKey } from "../../../../base/common/async.js";
import { appendEscapedMarkdownInlineCode } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename } from "../../../../base/common/path.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../log/common/log.js";
import { AgentSession } from "../../common/agentService.js";
import { getBranchCompletions, IAgentHostGitService, META_DIFF_BASE_BRANCH, tryResolvePrimaryWorktreeRoot } from "../../common/agentHostGitService.js";
import { AgentSystemNotificationKind, AgentSystemNotificationSeverity, toAgentSystemNotificationMeta } from "../../common/meta/agentSystemNotificationMeta.js";
import { schemaProperty } from "../../common/agentHostSchema.js";
import { ISessionDataService } from "../../common/sessionDataService.js";
import { SessionConfigKey } from "../../common/sessionConfigKeys.js";
import { AH_META_IS_ARCHIVED_DB_KEY, AH_META_IS_DONE_DB_KEY, ResponsePartKind } from "../../common/state/sessionState.js";
import { AGENT_BRANCH_PREFIX, AgentBranchNameGenerator } from "./agentBranchNameGenerator.js";
import { ICopilotApiService } from "./copilotApiService.js";
const WORKTREE_META_BRANCH = "copilot.worktree.branchName";
const WORKTREE_META_PATH = "copilot.worktree.path";
const WORKTREE_META_REPOSITORY_ROOT = "copilot.worktree.repositoryRoot";
const WORKTREE_META_CREATION_FAILURE = "copilot.worktree.creationFailure";
const MAX_WORKTREE_FAILURE_DIAGNOSTIC_LENGTH = 200;
class SessionWorkingDirectoryMissingError extends Error {
  constructor(workingDirectory, reason) {
    super(reason ? localize("sessionWorkingDirectoryMissingWithReason", "This session couldn't be loaded because its worktree is missing and could not be recreated: {0}", reason) : localize("sessionWorkingDirectoryMissing", "This session couldn't be loaded because its working directory no longer exists: {0}", workingDirectory.fsPath));
    this.workingDirectory = workingDirectory;
    this.reason = reason;
    this.name = "SessionWorkingDirectoryMissingError";
  }
}
const BRANCH_COMPLETION_LIMIT = 25;
const WORKTREE_PROGRESS_DEBOUNCE_MS = 40;
function getWorktreesRoot(repositoryRoot) {
  return URI.joinPath(repositoryRoot, "..", `${basename(repositoryRoot.fsPath)}.worktrees`);
}
function getWorktreeName(branchName, branchPrefix = "") {
  let name = branchName;
  if (branchPrefix && name.startsWith(branchPrefix)) {
    name = name.substring(branchPrefix.length);
  }
  if (name.startsWith(AGENT_BRANCH_PREFIX)) {
    name = name.substring(AGENT_BRANCH_PREFIX.length);
  }
  return name.replace(/\//g, "-");
}
function buildWorktreeAnnouncementText(branchName) {
  return localize(
    "agentHost.worktreeCreated",
    "Created isolated worktree for branch {0}",
    appendEscapedMarkdownInlineCode(branchName)
  ) + "\n\n";
}
function buildWorktreeFailureNotification(diagnostic) {
  const normalizedDiagnostic = normalizeWorktreeFailureDiagnostic(diagnostic);
  const content = normalizedDiagnostic ? localize(
    "agentHost.worktreeCreationFailedWithDiagnostic",
    "Couldn't create the isolated worktree. This session is continuing in the original folder.\n\n{0}",
    appendEscapedMarkdownInlineCode(normalizedDiagnostic)
  ) : localize(
    "agentHost.worktreeCreationFailed",
    "Couldn't create the isolated worktree. This session is continuing in the original folder."
  );
  return {
    kind: ResponsePartKind.SystemNotification,
    content,
    _meta: toAgentSystemNotificationMeta({
      kind: AgentSystemNotificationKind.WorktreeCreationFailure,
      severity: AgentSystemNotificationSeverity.Warning
    })
  };
}
function normalizeWorktreeFailureDiagnostic(diagnostic) {
  const normalized = diagnostic?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return void 0;
  }
  return normalized.length > MAX_WORKTREE_FAILURE_DIAGNOSTIC_LENGTH ? `${normalized.slice(0, MAX_WORKTREE_FAILURE_DIAGNOSTIC_LENGTH - 3)}...` : normalized;
}
var WorktreeCreationPhase = /* @__PURE__ */ ((WorktreeCreationPhase2) => {
  WorktreeCreationPhase2[WorktreeCreationPhase2["Starting"] = 0] = "Starting";
  WorktreeCreationPhase2[WorktreeCreationPhase2["NamingBranch"] = 1] = "NamingBranch";
  WorktreeCreationPhase2[WorktreeCreationPhase2["CheckingOut"] = 2] = "CheckingOut";
  WorktreeCreationPhase2[WorktreeCreationPhase2["CopyingIncludeFiles"] = 3] = "CopyingIncludeFiles";
  return WorktreeCreationPhase2;
})(WorktreeCreationPhase || {});
function buildWorktreeProgressText(phase, percent) {
  switch (phase) {
    case 1 /* NamingBranch */:
      return localize("agentHost.worktreeNamingBranch", "Creating isolated worktree (naming branch)");
    case 2 /* CheckingOut */:
      return percent === void 0 ? localize("agentHost.worktreeCheckingOut", "Creating isolated worktree (checking out files)") : localize("agentHost.worktreeCheckingOutPercent", "Creating isolated worktree (checking out files, {0}%)", percent);
    case 3 /* CopyingIncludeFiles */:
      return percent === void 0 ? localize("agentHost.worktreeCopyingIncludeFiles", "Creating isolated worktree (copying additional files)") : localize("agentHost.worktreeCopyingIncludeFilesPercent", "Creating isolated worktree (copying additional files, {0}%)", percent);
    default:
      return localize("agentHost.worktreeCreating", "Creating isolated worktree");
  }
}
async function withPercentProgress(phase, onProgress, operation) {
  if (!onProgress) {
    return operation(void 0);
  }
  let lastPercent = -1;
  const scheduler = new RunOnceScheduler(() => onProgress(buildWorktreeProgressText(phase, lastPercent)), WORKTREE_PROGRESS_DEBOUNCE_MS);
  try {
    return await operation(({ filesDone, filesTotal }) => {
      const percent = Math.min(100, Math.floor(filesDone * 100 / filesTotal));
      if (percent <= lastPercent) {
        return;
      }
      lastPercent = percent;
      scheduler.schedule();
    });
  } finally {
    const shouldFlush = scheduler.isScheduled();
    scheduler.dispose();
    if (shouldFlush) {
      onProgress(buildWorktreeProgressText(phase, lastPercent));
    }
  }
}
function prependAnnouncementToFirstTurn(turns, announcement) {
  if (turns.length === 0) {
    return turns;
  }
  const result = turns.slice();
  const first = result[0];
  const part = first.responseParts[0];
  if (part?.kind === ResponsePartKind.Markdown) {
    const responseParts = first.responseParts.slice();
    responseParts[0] = { ...part, content: announcement + part.content };
    result[0] = { ...first, responseParts };
  } else {
    const responseParts = [
      { kind: ResponsePartKind.Markdown, id: generateUuid(), content: announcement },
      ...first.responseParts
    ];
    result[0] = { ...first, responseParts };
  }
  return result;
}
function prependWorktreeFailureToFirstTurn(turns, diagnostic) {
  if (turns.length === 0) {
    return turns;
  }
  const result = turns.slice();
  const first = result[0];
  result[0] = {
    ...first,
    responseParts: [buildWorktreeFailureNotification(diagnostic), ...first.responseParts]
  };
  return result;
}
let WorktreeIsolation = class extends Disposable {
  constructor(branchNameGenerator, _gitService, copilotApiService, _sessionDataService, _logService) {
    super();
    this._gitService = _gitService;
    this._sessionDataService = _sessionDataService;
    this._logService = _logService;
    /** Worktrees materialized during this host process, keyed by sessionId. */
    this._materializedWorktrees = /* @__PURE__ */ new Map();
    this._worktreeDeletionRetries = /* @__PURE__ */ new Map();
    /**
     * Per-session announcement (markdown) emitted as a synthetic streaming
     * markdown part the first time the session sends a message. Surfaces the
     * "Created isolated worktree for branch X" message live during the first
     * turn; the same announcement is re-injected on restore via
     * {@link applyRestoreAnnouncement}.
     */
    this._pendingFirstTurnAnnouncements = /* @__PURE__ */ new Map();
    /**
     * SessionIds of freshly-created worktree-isolation sessions whose worktree
     * has not yet been created (creation is deferred to the first send so the
     * user's prompt can drive branch naming). While a session is in this set the
     * host reports its working directory as "pending" ({@link isWorkingDirectoryPending})
     * so agents defer prewarming / materializing until {@link resolveOnFirstSend}
     * runs. Never populated for restored sessions — their worktree already exists
     * on disk and their persisted working directory already points at it.
     */
    this._pending = /* @__PURE__ */ new Set();
    /** Fixed log label; one host-owned instance serves every agent. */
    this._logLabel = "AgentHost";
    /**
     * Serializes the worktree lifecycle per session so a first-send creation
     * ({@link resolveOnFirstSend}) never interleaves with archive/unarchive
     * cleanup ({@link cleanupWorktreeOnArchive} / {@link recreateWorktreeOnUnarchive})
     * or deletion ({@link removeSessionWorktree}) for the same session — the
     * guarantee each agent previously enforced with its own sequencer.
     */
    this._sequencer = new SequencerByKey();
    this._worktreeCreationSequencer = new SequencerByKey();
    this._branchNameGenerator = branchNameGenerator ?? new AgentBranchNameGenerator(copilotApiService, this._logService);
  }
  /**
   * Marks a fresh worktree-isolation session as pending — its worktree is
   * deferred to the first send. Called by the host while a creating session's
   * resolved config selects `worktree` isolation.
   */
  notePending(sessionId) {
    this._pending.add(sessionId);
  }
  /** Clears a pending marker when a session will not materialize a worktree. */
  clearPending(sessionId) {
    this._pending.delete(sessionId);
  }
  /**
   * Whether a session's worktree is still pending creation. The host exposes
   * this through {@link IAgentConfigurationService.isWorkingDirectoryPending} so
   * agents defer materialization until the host has resolved the worktree.
   */
  isWorkingDirectoryPending(sessionId) {
    return this._pending.has(sessionId);
  }
  /** The worktree created for a session in this process, if any. */
  getResolvedWorktree(sessionId) {
    return this._materializedWorktrees.get(sessionId)?.worktree;
  }
  /**
   * First-send worktree resolution: creates the worktree (when the session
   * selected `worktree` isolation on a git repo) and clears the pending marker
   * regardless of outcome, so a failed creation falls back to folder isolation
   * instead of leaving the session permanently "pending". Delegates to
   * {@link resolveWorkingDirectory}, which is idempotent per session.
   */
  async resolveOnFirstSend(request) {
    return this._sequencer.queue(request.sessionId, async () => {
      try {
        return await this.resolveWorkingDirectory(request);
      } finally {
        this.clearPending(request.sessionId);
      }
    });
  }
  /**
   * Builds the `isolation` / `branch` schema contribution for
   * `resolveSessionConfig`. When {@link IResolveIsolationConfigRequest.workingDirectory}
   * is not a git repository (or has no commits yet) isolation is forced to
   * `folder` and no branch property is offered.
   */
  async resolveIsolationConfig(request) {
    const gitInfo = request.workingDirectory ? await this._getGitInfo(request.workingDirectory) : void 0;
    const isolationProperty = schemaProperty({
      type: "string",
      title: localize("agentHost.sessionConfig.isolation", "Isolation"),
      description: localize("agentHost.sessionConfig.isolationDescription", "Where the agent should make changes"),
      enum: gitInfo ? ["folder", "worktree"] : ["folder"],
      enumLabels: gitInfo ? [localize("agentHost.sessionConfig.isolation.folder", "Folder"), localize("agentHost.sessionConfig.isolation.worktree", "Worktree")] : [localize("agentHost.sessionConfig.isolation.folder", "Folder")],
      enumDescriptions: gitInfo ? [localize("agentHost.sessionConfig.isolation.folderDescription", "Work directly in the folder"), localize("agentHost.sessionConfig.isolation.worktreeDescription", "Create a Git worktree for isolation")] : [localize("agentHost.sessionConfig.isolation.folderDescription", "Work directly in the folder")],
      default: gitInfo ? "worktree" : "folder",
      readOnly: !gitInfo,
      sessionMutable: false
    });
    const isolationDefault = gitInfo ? "worktree" : "folder";
    const isolationValue = isolationProperty.validate(request.config?.[SessionConfigKey.Isolation]) ? request.config[SessionConfigKey.Isolation] : isolationDefault;
    let branchProperty;
    let branchDefault;
    let branchValue;
    let worktreeBranchPrefixProperty;
    let worktreeIncludeFilesProperty;
    let worktreeBranchTrackProperty;
    if (gitInfo) {
      const branchReadOnly = isolationValue === "folder";
      branchDefault = isolationValue === "worktree" ? gitInfo.defaultBranch.name : gitInfo.currentBranch;
      branchValue = isolationValue === "worktree" && typeof request.config?.[SessionConfigKey.Branch] === "string" ? request.config[SessionConfigKey.Branch] : branchDefault;
      branchProperty = schemaProperty({
        type: "string",
        title: localize("agentHost.sessionConfig.branch", "Branch"),
        description: localize("agentHost.sessionConfig.branchDescription", "Base branch to work from"),
        enum: [branchDefault],
        enumLabels: [branchDefault],
        default: branchDefault,
        enumDynamic: !branchReadOnly,
        readOnly: branchReadOnly,
        sessionMutable: false
      });
      worktreeBranchPrefixProperty = schemaProperty({
        type: "string",
        title: localize("agentHost.sessionConfig.worktreeBranchPrefix", "Worktree Branch Prefix"),
        description: localize("agentHost.sessionConfig.worktreeBranchPrefixDescription", "Prefix applied to the branch created for an isolated worktree."),
        readOnly: true,
        sessionMutable: false
      });
      worktreeBranchTrackProperty = schemaProperty({
        type: "boolean",
        title: localize("agentHost.sessionConfig.worktreeBranchTrack", "Worktree Branch Tracking"),
        description: localize("agentHost.sessionConfig.worktreeBranchTrackDescription", "Whether the branch created for an isolated worktree tracks its upstream."),
        default: false,
        readOnly: true,
        sessionMutable: false
      });
      worktreeIncludeFilesProperty = schemaProperty({
        type: "array",
        title: localize("agentHost.sessionConfig.worktreeIncludeFiles", "Worktree Include Files"),
        description: localize("agentHost.sessionConfig.worktreeIncludeFilesDescription", "Glob patterns for git-ignored files to copy into the isolated worktree."),
        items: {
          type: "string",
          title: localize("agentHost.sessionConfig.worktreeIncludeFilesItem", "Pattern")
        },
        readOnly: true,
        sessionMutable: false
      });
    }
    return { isolationProperty, branchProperty, worktreeBranchPrefixProperty, worktreeBranchTrackProperty, worktreeIncludeFilesProperty, isolationValue, branchDefault, branchValue };
  }
  /**
   * Branch-name completions for the branch picker. Callers forward this from
   * their `sessionConfigCompletions` when the requested property is
   * {@link SessionConfigKey.Branch}.
   */
  async branchCompletions(workingDirectory, query) {
    if (!workingDirectory) {
      return { items: [] };
    }
    const [branches, currentBranch, defaultBranch] = await Promise.all([
      this._gitService.getBranches(workingDirectory, { pattern: ["refs/heads"], sort: "committerdate" }),
      this._gitService.getCurrentBranch(workingDirectory),
      this._gitService.getDefaultBranch(workingDirectory)
    ]);
    const branchCompletions = getBranchCompletions(branches.map((branch) => branch.name), {
      currentBranch,
      defaultBranch: defaultBranch?.name,
      query,
      limit: BRANCH_COMPLETION_LIMIT
    });
    return { items: branchCompletions.map((branch) => ({ value: branch, label: branch })) };
  }
  /**
   * Resolves the effective working directory for a session that is about to
   * be materialized. When the session config selects `worktree` isolation on
   * a git repository, creates a fresh branch + worktree, records it for
   * cleanup, queues the first-turn announcement, persists the worktree
   * metadata, and returns the worktree URI. Otherwise returns the requested
   * working directory unchanged.
   */
  async resolveWorkingDirectory(request) {
    const { config, workingDirectory, sessionId, sessionUri, prompt, githubToken, onProgress } = request;
    if (config?.[SessionConfigKey.Isolation] !== "worktree" || !workingDirectory || typeof config[SessionConfigKey.Branch] !== "string") {
      return workingDirectory;
    }
    const already = this._materializedWorktrees.get(sessionId);
    if (already) {
      return already.worktree;
    }
    onProgress?.(buildWorktreeProgressText(0 /* Starting */));
    const checkoutRoot = await this._gitService.getRepositoryRoot(workingDirectory);
    if (!checkoutRoot) {
      return workingDirectory;
    }
    const repositoryRoot = await this._resolvePrimaryWorktreeRoot(checkoutRoot, checkoutRoot);
    const worktreesRoot = getWorktreesRoot(repositoryRoot);
    const worktreeBranchPrefix = typeof config[SessionConfigKey.WorktreeBranchPrefix] === "string" ? config[SessionConfigKey.WorktreeBranchPrefix] : void 0;
    const selectedBranch = config[SessionConfigKey.Branch];
    const { branchName, worktree, baseBranch } = await this._worktreeCreationSequencer.queue(repositoryRoot.toString(), async () => {
      onProgress?.(buildWorktreeProgressText(1 /* NamingBranch */));
      const branchName2 = await this._branchNameGenerator.generateBranchName({
        sessionId,
        message: prompt,
        githubToken,
        branchPrefix: worktreeBranchPrefix,
        branchNameCollides: async (candidate) => {
          if (await this._gitService.branchExists(repositoryRoot, candidate).catch(() => true)) {
            return true;
          }
          const candidateWorktree = URI.joinPath(worktreesRoot, getWorktreeName(candidate, worktreeBranchPrefix));
          return fileExists(candidateWorktree.fsPath);
        }
      });
      const worktree2 = URI.joinPath(worktreesRoot, getWorktreeName(branchName2, worktreeBranchPrefix));
      const baseBranch2 = await this._resolveBranchStartPoint(repositoryRoot, selectedBranch);
      await fs.mkdir(worktreesRoot.fsPath, { recursive: true });
      onProgress?.(buildWorktreeProgressText(2 /* CheckingOut */));
      const worktreeBranchTrack = config[SessionConfigKey.WorktreeBranchTrack] === true;
      await withPercentProgress(2 /* CheckingOut */, onProgress, (progress) => this._gitService.addWorktree(repositoryRoot, worktree2, branchName2, baseBranch2, worktreeBranchTrack, progress));
      return { branchName: branchName2, worktree: worktree2, baseBranch: baseBranch2 };
    });
    const worktreeIncludeFiles = Array.isArray(config[SessionConfigKey.WorktreeIncludeFiles]) && config[SessionConfigKey.WorktreeIncludeFiles].every((pattern) => typeof pattern === "string") ? config[SessionConfigKey.WorktreeIncludeFiles] : void 0;
    if (worktreeIncludeFiles?.length) {
      try {
        onProgress?.(buildWorktreeProgressText(3 /* CopyingIncludeFiles */));
        await withPercentProgress(3 /* CopyingIncludeFiles */, onProgress, (progress) => this._gitService.copyWorktreeIncludeFiles(checkoutRoot, worktree, worktreeIncludeFiles, progress));
      } catch (error) {
        this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to copy worktree include files: ${errorMessage(error)}`);
      }
    }
    this._materializedWorktrees.set(sessionId, { repositoryRoot, worktree });
    this._pendingFirstTurnAnnouncements.set(sessionId, buildWorktreeAnnouncementText(branchName));
    try {
      await this._writeWorktreeMetadata(sessionUri, { branchName, baseBranch, worktreePath: worktree, repositoryRoot });
    } catch (error) {
      this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to persist worktree branch metadata: ${errorMessage(error)}`);
    }
    return worktree;
  }
  /** Resolves a persisted working directory, repairing a removed worktree when possible. */
  async resolveWorkingDirectoryForResume(sessionUri, sessionId, workingDirectory) {
    return this._sequencer.queue(sessionId, () => this._resolveWorkingDirectoryForResume(sessionUri, sessionId, workingDirectory));
  }
  async _resolveWorkingDirectoryForResume(sessionUri, sessionId, workingDirectory) {
    if (workingDirectory.scheme !== Schemas.file) {
      return workingDirectory;
    }
    try {
      await fs.access(workingDirectory.fsPath);
      return workingDirectory;
    } catch {
    }
    const meta = await this._readWorktreeMetadata(sessionUri).catch(() => void 0);
    const archived = await this._isSessionArchived(sessionUri);
    if (archived) {
      if (meta?.repositoryRoot) {
        try {
          await fs.access(meta.repositoryRoot.fsPath);
          this._logService.info(`[${this._logLabel}:${sessionId}] Archived session working directory '${workingDirectory.fsPath}' is missing; resuming against repository root '${meta.repositoryRoot.fsPath}' for history`);
          return meta.repositoryRoot;
        } catch {
        }
      }
      this._logService.warn(`[${this._logLabel}:${sessionId}] Cannot resume archived session: working directory '${workingDirectory.fsPath}' is missing and no usable repository-root fallback was found`);
      throw new SessionWorkingDirectoryMissingError(workingDirectory);
    }
    let recreateFailureReason;
    if (meta?.worktreePath && meta.repositoryRoot) {
      const { branchName, worktreePath, repositoryRoot } = meta;
      const recreated = await this._recreateWorktree(sessionId, { branchName, worktreePath, repositoryRoot });
      if (recreated.ok) {
        this._logService.info(`[${this._logLabel}:${sessionId}] Recreated missing worktree '${worktreePath.fsPath}' for a live session on resume`);
        return worktreePath;
      }
      recreateFailureReason = recreated.reason;
    }
    this._logService.warn(`[${this._logLabel}:${sessionId}] Cannot resume: working directory '${workingDirectory.fsPath}' is missing and its worktree could not be recreated${recreateFailureReason ? `: ${recreateFailureReason}` : ""}`);
    throw new SessionWorkingDirectoryMissingError(workingDirectory, recreateFailureReason);
  }
  /**
   * Takes (and clears) the pending "worktree created" announcement for a
   * session so callers can emit it live as the first response part on the
   * first turn. Returns `undefined` when the session has no pending
   * announcement.
   */
  takePendingAnnouncement(sessionId) {
    const announcement = this._pendingFirstTurnAnnouncements.get(sessionId);
    if (announcement !== void 0) {
      this._pendingFirstTurnAnnouncements.delete(sessionId);
    }
    return announcement;
  }
  async persistCreationFailure(sessionUri, sessionId, diagnostic) {
    const dbRef = this._sessionDataService.openDatabase(sessionUri);
    try {
      await dbRef.object.setMetadata(WORKTREE_META_CREATION_FAILURE, JSON.stringify({
        sessionId,
        diagnostic: normalizeWorktreeFailureDiagnostic(diagnostic)
      }));
    } finally {
      dbRef.dispose();
    }
  }
  /**
   * Re-injects the applicable worktree notice into the first restored turn.
   *
   * The live path ({@link takePendingAnnouncement}) handles the very first
   * turn while the session is fresh; this path takes over on subsequent loads
   * (where the synthetic announcement is not part of the agent transcript).
   */
  async applyRestoreAnnouncement(sessionUri, turns) {
    const notice = await this._readWorktreeNotice(sessionUri).catch(() => void 0);
    if (notice?.kind === "failure") {
      return prependWorktreeFailureToFirstTurn(turns, notice.diagnostic);
    }
    if (notice?.kind !== "success") {
      return turns;
    }
    return prependAnnouncementToFirstTurn(turns, buildWorktreeAnnouncementText(notice.branchName));
  }
  /** Resolves the worktree to remove before the session database is deleted. */
  async prepareSessionDeletion(sessionUri, sessionId) {
    return this._sequencer.queue(sessionId, async () => {
      const deletionRetry = this._worktreeDeletionRetries.get(sessionId);
      if (deletionRetry) {
        return deletionRetry;
      }
      const materializedWorktree = this._materializedWorktrees.get(sessionId);
      if (materializedWorktree) {
        return materializedWorktree;
      }
      try {
        const meta = await this._readWorktreeMetadata(sessionUri);
        return meta?.worktreePath && meta.repositoryRoot ? { repositoryRoot: meta.repositoryRoot, worktree: meta.worktreePath } : void 0;
      } catch (error) {
        this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to read worktree metadata before session deletion: ${errorMessage(error)}`);
        throw error;
      }
    });
  }
  /** Force-removes the resolved worktree after the user confirms session deletion. */
  async removeSessionWorktree(sessionId, worktree) {
    return this._sequencer.queue(sessionId, () => this._removeSessionWorktree(sessionId, worktree));
  }
  async _removeSessionWorktree(sessionId, worktree) {
    this.clearPending(sessionId);
    if (!worktree) {
      return;
    }
    try {
      await this._gitService.removeWorktree(worktree.repositoryRoot, worktree.worktree, { force: true });
      this._materializedWorktrees.delete(sessionId);
      this._worktreeDeletionRetries.delete(sessionId);
    } catch (error) {
      this._worktreeDeletionRetries.set(sessionId, worktree);
      this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to remove worktree '${worktree.worktree.fsPath}': ${errorMessage(error)}`);
      throw error;
    }
  }
  /**
   * On archive, removes the worktree directory when its branch is preserved
   * and the working tree is clean, so the worktree can be recreated on
   * unarchive without losing work. Skips the removal when the branch is
   * missing or the tree is dirty.
   */
  async cleanupWorktreeOnArchive(sessionUri, sessionId) {
    return this._sequencer.queue(sessionId, () => this._cleanupWorktreeOnArchive(sessionUri, sessionId));
  }
  async _cleanupWorktreeOnArchive(sessionUri, sessionId) {
    const meta = await this._readWorktreeMetadata(sessionUri).catch(() => void 0);
    if (!meta?.worktreePath || !meta.repositoryRoot) {
      return;
    }
    const { branchName, worktreePath, repositoryRoot } = meta;
    try {
      await fs.access(worktreePath.fsPath);
    } catch {
      this._materializedWorktrees.delete(sessionId);
      return;
    }
    const branchPresent = await this._gitService.branchExists(repositoryRoot, branchName).catch(() => false);
    if (!branchPresent) {
      this._logService.info(`[${this._logLabel}:${sessionId}] Skipping worktree cleanup: branch '${branchName}' is missing`);
      return;
    }
    const hasUncommittedChanges = await this._gitService.hasUncommittedChanges(worktreePath).catch(() => true);
    if (hasUncommittedChanges) {
      try {
        await this._gitService.commitAll(worktreePath, localize("worktreeIsolation.commitMessage", "Saving uncommitted changes before archiving session"));
      } catch (error) {
        this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to commit uncommitted changes in '${worktreePath.fsPath}': ${errorMessage(error)}`);
        return;
      }
    }
    try {
      await this._gitService.removeWorktree(repositoryRoot, worktreePath);
      this._logService.info(`[${this._logLabel}:${sessionId}] Removed worktree '${worktreePath.fsPath}' on archive`);
      this._materializedWorktrees.delete(sessionId);
    } catch (error) {
      this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to remove worktree '${worktreePath.fsPath}' on archive: ${errorMessage(error)}`);
    }
  }
  /**
   * On unarchive, recreates a previously cleaned-up worktree against its
   * preserved branch. No-op when the directory still exists or the branch is
   * missing.
   */
  async recreateWorktreeOnUnarchive(sessionUri, sessionId) {
    return this._sequencer.queue(sessionId, () => this._recreateWorktreeOnUnarchive(sessionUri, sessionId));
  }
  async _recreateWorktreeOnUnarchive(sessionUri, sessionId) {
    const meta = await this._readWorktreeMetadata(sessionUri).catch(() => void 0);
    if (!meta?.worktreePath || !meta.repositoryRoot) {
      return;
    }
    try {
      await fs.access(meta.worktreePath.fsPath);
      return;
    } catch {
    }
    const { branchName, worktreePath, repositoryRoot } = meta;
    await this._recreateWorktree(sessionId, { branchName, worktreePath, repositoryRoot });
  }
  async _recreateWorktree(sessionId, meta) {
    const { branchName, worktreePath, repositoryRoot } = meta;
    const branchPresent = await this._gitService.branchExists(repositoryRoot, branchName).catch(() => false);
    if (!branchPresent) {
      const reason = localize("worktreeRecreateBranchMissing", "the branch '{0}' no longer exists", branchName);
      this._logService.info(`[${this._logLabel}:${sessionId}] Cannot recreate worktree: branch '${branchName}' is missing`);
      return { ok: false, reason };
    }
    try {
      await fs.mkdir(URI.joinPath(worktreePath, "..").fsPath, { recursive: true });
      await this._gitService.addExistingWorktree(repositoryRoot, worktreePath, branchName);
      this._materializedWorktrees.set(sessionId, { repositoryRoot, worktree: worktreePath });
      this._logService.info(`[${this._logLabel}:${sessionId}] Recreated worktree '${worktreePath.fsPath}'`);
      return { ok: true };
    } catch (error) {
      const reason = errorMessage(error);
      this._logService.warn(`[${this._logLabel}:${sessionId}] Failed to recreate worktree '${worktreePath.fsPath}': ${reason}`);
      return { ok: false, reason };
    }
  }
  /** Reads the persisted worktree metadata for a session, if any. */
  async readWorktreeMetadata(sessionUri) {
    return this._readWorktreeMetadata(sessionUri);
  }
  /**
   * Bridges worktree metadata for a legacy session adopted in place, whose
   * working directory is a pre-existing git worktree the agent host did not
   * create. When `workingDirectory` is a linked worktree (its checkout root
   * differs from the repository's primary worktree root), persists the worktree
   * branch / path / repository-root (and diff base branch) so the adopted
   * session groups under its repository and computes diffs against the right
   * base — parity with natively worktree-isolated sessions. Deliberately does
   * NOT register the worktree as host-created, so disposing the session never
   * deletes the user-owned worktree. Returns `true` when metadata was recorded.
   */
  async adoptExistingWorktreeMetadata(sessionUri, workingDirectory) {
    const worktreeRoot = await this._gitService.getRepositoryRoot(workingDirectory).catch(() => void 0);
    if (!worktreeRoot) {
      return false;
    }
    const primaryRoot = await tryResolvePrimaryWorktreeRoot(this._gitService, worktreeRoot).catch(() => void 0);
    if (!primaryRoot || isEqual(primaryRoot, worktreeRoot)) {
      return false;
    }
    const branchName = await this._gitService.getCurrentBranch(worktreeRoot).catch(() => void 0) ?? "HEAD";
    const baseBranch = (await this._gitService.getDefaultBranch(primaryRoot).catch(() => void 0))?.name;
    await this._writeWorktreeMetadata(sessionUri, { branchName, baseBranch, worktreePath: worktreeRoot, repositoryRoot: primaryRoot });
    return true;
  }
  /**
   * Resolves the repository "project" for a worktree-isolated session from its
   * persisted worktree metadata. Worktree sessions run out of a
   * `<repo>.worktrees/<name>` directory, but in the sessions UI they must group
   * under the *repository* (e.g. `vscode`) — not the worktree folder — exactly
   * like Copilot. Returns the repository root as the project so agents can merge
   * it into the `project` field of the `IAgentSessionMetadata` reported from
   * `listSessions` / `getSessionMetadata`; without it a list refresh clears the
   * transient project set by the materialize event and the workspace reverts to
   * the worktree directory name. Returns `undefined` for sessions that were never
   * worktree-isolated, leaving the caller's own folder-based project untouched.
   */
  async resolveWorktreeProject(sessionUri) {
    const meta = await this._readWorktreeMetadata(sessionUri).catch(() => void 0);
    return meta?.repositoryRoot ? projectFromRepositoryRoot(meta.repositoryRoot) : void 0;
  }
  async _resolvePrimaryWorktreeRoot(checkoutRoot, fallbackRoot) {
    try {
      return await tryResolvePrimaryWorktreeRoot(this._gitService, checkoutRoot) ?? fallbackRoot;
    } catch (error) {
      this._logService.warn(`[${this._logLabel}] Failed to resolve primary worktree for '${checkoutRoot.fsPath}': ${errorMessage(error)}`);
      return fallbackRoot;
    }
  }
  /**
   * Synchronous companion to {@link resolveWorktreeProject} for the
   * materialize-event path: the repository project for a worktree this agent
   * created in the current process, or `undefined` when the session has none.
   * Lets an agent supply the materialize event's `project` without an async
   * metadata read so a fresh worktree groups under the repository the moment it
   * materializes.
   */
  sessionWorktreeProject(sessionId) {
    const worktree = this._materializedWorktrees.get(sessionId);
    return worktree ? projectFromRepositoryRoot(worktree.repositoryRoot) : void 0;
  }
  async _getGitInfo(workingDirectory) {
    const repositoryRoot = await this._gitService.getRepositoryRoot(workingDirectory);
    if (!repositoryRoot) {
      return void 0;
    }
    const headCommit = await this._gitService.revParse(repositoryRoot, "HEAD").catch(() => void 0);
    if (!headCommit) {
      return void 0;
    }
    const currentBranch = await this._gitService.getCurrentBranch(repositoryRoot) ?? "HEAD";
    const defaultBranch = await this._gitService.getDefaultBranch(repositoryRoot) ?? { name: currentBranch, startPoint: currentBranch };
    return { currentBranch, defaultBranch };
  }
  async _resolveBranchStartPoint(repositoryRoot, selectedBranch) {
    const defaultBranch = await this._gitService.getDefaultBranch(repositoryRoot);
    return defaultBranch?.name === selectedBranch ? defaultBranch.startPoint : selectedBranch;
  }
  async _writeWorktreeMetadata(sessionUri, metadata) {
    const dbRef = this._sessionDataService.openDatabase(sessionUri);
    try {
      const work = [
        dbRef.object.setMetadata(WORKTREE_META_BRANCH, metadata.branchName),
        dbRef.object.setMetadata(WORKTREE_META_PATH, metadata.worktreePath.toString()),
        dbRef.object.setMetadata(WORKTREE_META_REPOSITORY_ROOT, metadata.repositoryRoot.toString())
      ];
      if (metadata.baseBranch) {
        work.push(dbRef.object.setMetadata(META_DIFF_BASE_BRANCH, metadata.baseBranch));
      }
      await Promise.all(work);
    } finally {
      dbRef.dispose();
    }
  }
  /**
   * Reads worktree metadata and migrates repository roots written before linked checkouts were canonicalized.
   * It probes an existing worktree when available and otherwise falls back to the persisted root for archived sessions.
   */
  async _readWorktreeMetadata(sessionUri) {
    const ref = await this._sessionDataService.tryOpenDatabase(sessionUri);
    if (!ref) {
      return void 0;
    }
    try {
      const [branchName, worktreePathRaw, repositoryRootRaw] = await Promise.all([
        ref.object.getMetadata(WORKTREE_META_BRANCH),
        ref.object.getMetadata(WORKTREE_META_PATH),
        ref.object.getMetadata(WORKTREE_META_REPOSITORY_ROOT)
      ]);
      if (!branchName) {
        return void 0;
      }
      const worktreePath = worktreePathRaw ? URI.parse(worktreePathRaw) : void 0;
      let repositoryRoot = repositoryRootRaw ? URI.parse(repositoryRootRaw) : void 0;
      if (repositoryRoot) {
        const checkoutRoot = worktreePath && await fileExists(worktreePath.fsPath) ? worktreePath : repositoryRoot;
        const primaryRoot = await this._resolvePrimaryWorktreeRoot(checkoutRoot, repositoryRoot);
        if (primaryRoot.toString() !== repositoryRoot.toString()) {
          repositoryRoot = primaryRoot;
          try {
            await ref.object.setMetadata(WORKTREE_META_REPOSITORY_ROOT, primaryRoot.toString());
          } catch (error) {
            this._logService.warn(`[${this._logLabel}] Failed to normalize worktree repository metadata for '${sessionUri.toString()}': ${errorMessage(error)}`);
          }
        }
      }
      return { branchName, worktreePath, repositoryRoot };
    } finally {
      ref.dispose();
    }
  }
  async _readWorktreeNotice(sessionUri) {
    const ref = await this._sessionDataService.tryOpenDatabase(sessionUri);
    if (!ref) {
      return void 0;
    }
    try {
      const [branchName, failureRaw] = await Promise.all([
        ref.object.getMetadata(WORKTREE_META_BRANCH),
        ref.object.getMetadata(WORKTREE_META_CREATION_FAILURE)
      ]);
      if (branchName) {
        return { kind: "success", branchName };
      }
      if (!failureRaw) {
        return void 0;
      }
      const failure = JSON.parse(failureRaw);
      if (!failure || typeof failure !== "object" || Array.isArray(failure)) {
        return void 0;
      }
      const raw = failure;
      if (raw["sessionId"] !== AgentSession.id(sessionUri)) {
        return void 0;
      }
      return {
        kind: "failure",
        diagnostic: typeof raw["diagnostic"] === "string" ? normalizeWorktreeFailureDiagnostic(raw["diagnostic"]) : void 0
      };
    } finally {
      ref.dispose();
    }
  }
  async _isSessionArchived(sessionUri) {
    const ref = await this._sessionDataService.tryOpenDatabase(sessionUri);
    if (!ref) {
      return false;
    }
    try {
      const [isArchived, isDone] = await Promise.all([
        ref.object.getMetadata(AH_META_IS_ARCHIVED_DB_KEY),
        ref.object.getMetadata(AH_META_IS_DONE_DB_KEY)
      ]);
      return isArchived !== void 0 ? isArchived === "true" : isDone === "true";
    } finally {
      ref.dispose();
    }
  }
};
WorktreeIsolation = __decorateClass([
  __decorateParam(1, IAgentHostGitService),
  __decorateParam(2, ICopilotApiService),
  __decorateParam(3, ISessionDataService),
  __decorateParam(4, ILogService)
], WorktreeIsolation);
function projectFromRepositoryRoot(repositoryRoot) {
  return { uri: repositoryRoot, displayName: basename(repositoryRoot.fsPath) || repositoryRoot.toString() };
}
function worktreeProjectFromRepositoryRoot(repositoryRootRaw) {
  return repositoryRootRaw ? projectFromRepositoryRoot(URI.parse(repositoryRootRaw)) : void 0;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
export {
  SessionWorkingDirectoryMissingError,
  WORKTREE_META_REPOSITORY_ROOT,
  WorktreeCreationPhase,
  WorktreeIsolation,
  buildWorktreeAnnouncementText,
  buildWorktreeFailureNotification,
  buildWorktreeProgressText,
  getWorktreeName,
  getWorktreesRoot,
  normalizeWorktreeFailureDiagnostic,
  prependAnnouncementToFirstTurn,
  worktreeProjectFromRepositoryRoot
};
