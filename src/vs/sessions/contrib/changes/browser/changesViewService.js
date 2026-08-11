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
import { Codicon } from "../../../../base/common/codicons.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { autorun, derived, derivedObservableWithCache, derivedOpts, observableSignal, observableSignalFromEvent, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionChangesetOperationScope } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { AgentFeedbackState, IAgentFeedbackService } from "../../agentFeedback/browser/agentFeedbackService.js";
import { ICodeReviewService, PRReviewStateKind } from "../../codeReview/browser/codeReviewService.js";
import { ChangesViewMode, IsolationMode } from "../common/changes.js";
const ChangesetReviewSupportContext = new RawContextKey("sessions.changesetReviewSupport", false);
const ChangesetReviewedFilesContext = new RawContextKey("sessions.changesetReviewedFiles", []);
const ChangesetHasOperationsContext = new RawContextKey("sessions.changesetHasOperations", false);
const DEFAULT_SECTION_COLLAPSE_STATE = Object.freeze({
  otherFiles: false,
  checks: false
});
let ChangesViewService = class extends Disposable {
  constructor(agentFeedbackService, codeReviewService, contextKeyService, sessionsService, storageService, sessionsManagementService) {
    super();
    this.agentFeedbackService = agentFeedbackService;
    this.codeReviewService = codeReviewService;
    this.contextKeyService = contextKeyService;
    this.sessionsService = sessionsService;
    this.storageService = storageService;
    this._sectionCollapseStateBySession = new ResourceMap();
    this._sectionCollapseStateChanged = observableSignal("changesView.sectionCollapseStateChanged");
    this._selectedChangesetId = observableValue(this, void 0);
    this.activeSessionResourceObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession?.resource;
    });
    this.activeSessionSectionCollapseStateObs = derivedOpts({ equalsFn: structuralEquals }, (reader) => {
      const sessionResource = this.activeSessionResourceObs.read(reader);
      this._sectionCollapseStateChanged.read(reader);
      return sessionResource ? this._sectionCollapseStateBySession.get(sessionResource) ?? DEFAULT_SECTION_COLLAPSE_STATE : DEFAULT_SECTION_COLLAPSE_STATE;
    });
    this.activeSessionTypeObs = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession?.sessionType;
    });
    this.activeSessionIsVirtualWorkspaceObs = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession?.workspace.read(reader)?.isVirtualWorkspace ?? false;
    });
    this.activeSessionHasGitRepositoryObs = derived((reader) => {
      const isVirtualWorkspace = this.activeSessionIsVirtualWorkspaceObs.read(reader);
      if (isVirtualWorkspace) {
        return true;
      }
      const activeSession = this.sessionsService.activeSession.read(reader);
      const workspace = activeSession?.workspace.read(reader);
      return workspace?.folders[0].gitRepository !== void 0;
    });
    this.activeSessionReviewCommentCountByFileObs = this._getActiveSessionReviewComments();
    this.activeSessionAgentFeedbackCountByFileObs = this._getActiveSessionAgentFeedback();
    this.activeSessionChangesetsObs = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession?.changesets.read(reader);
    });
    this.activeSessionChangesetsLoadingObs = derived((reader) => {
      return this.activeSessionChangesetsObs.read(reader) === void 0;
    });
    this.activeSessionChangesetObs = derived((reader) => {
      const selectedChangesetId = this._selectedChangesetId.read(reader);
      const activeSessionChangesets = this.activeSessionChangesetsObs.read(reader);
      if (!activeSessionChangesets) {
        return void 0;
      }
      const selectedChangeset = selectedChangesetId ? activeSessionChangesets.find((c) => c.id === selectedChangesetId && c.isEnabled.read(reader)) : void 0;
      if (selectedChangeset) {
        return selectedChangeset;
      }
      const defaultChangeset = activeSessionChangesets.find((c) => c.isDefault.read(reader));
      const firstEnabledChangeset = activeSessionChangesets.find((c) => c.isEnabled.read(reader));
      return defaultChangeset ?? firstEnabledChangeset;
    });
    this.activeSessionChangesetLoadingObs = derived((reader) => {
      const changeset = this.activeSessionChangesetObs.read(reader);
      return changeset?.isLoadingChanges.read(reader) ?? false;
    });
    this.activeSessionChangesetOperationsObs = derived((reader) => {
      const changeset = this.activeSessionChangesetObs.read(reader);
      return changeset?.operations.read(reader) ?? [];
    });
    this.activeSessionChangesObs = derived((reader) => {
      const changeset = this.activeSessionChangesetObs.read(reader);
      return changeset?.changes.read(reader) ?? [];
    });
    this.activeSessionLoadingObs = derived((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      const activeSessionLoading = activeSession?.loading.read(reader) ?? true;
      const activeSessionChangesetsLoading = this.activeSessionChangesetsLoadingObs.read(reader);
      const activeSessionChangesetLoading = this.activeSessionChangesetLoadingObs.read(reader);
      return activeSessionLoading || activeSessionChangesetsLoading || activeSessionChangesetLoading;
    });
    this.activeSessionStateObs = this._getActiveSessionState();
    const storedMode = this.storageService.get("changesView.viewMode", StorageScope.WORKSPACE);
    const initialMode = storedMode === ChangesViewMode.Tree ? ChangesViewMode.Tree : ChangesViewMode.List;
    this._viewModeObs = observableValue(this, initialMode);
    this._register(autorun((reader) => {
      this.activeSessionResourceObs.read(reader);
      this.setChangesetId(void 0);
    }));
    this._register(sessionsManagementService.onDidReplaceSession(({ from, to }) => {
      const state = this._sectionCollapseStateBySession.get(from.resource);
      if (!state) {
        return;
      }
      this._sectionCollapseStateBySession.delete(from.resource);
      this._sectionCollapseStateBySession.set(to.resource, state);
      this._sectionCollapseStateChanged.trigger(void 0);
    }));
    this._register(sessionsManagementService.onDidDeleteSession((session) => {
      this._deleteSectionCollapseState(session.resource);
    }));
    this._register(sessionsManagementService.onDidDiscardNewSession((session) => this._deleteSectionCollapseState(session.resource)));
    this._register(sessionsManagementService.onDidReplaceNewDraftSession(({ from }) => this._deleteSectionCollapseState(from.resource)));
    this._bindContextKeys();
  }
  setChangesetId(changesetId) {
    this._selectedChangesetId.set(changesetId, void 0);
  }
  get viewModeObs() {
    return this._viewModeObs;
  }
  setViewMode(mode) {
    if (this._viewModeObs.get() === mode) {
      return;
    }
    this._viewModeObs.set(mode, void 0);
    this.storageService.store("changesView.viewMode", mode, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  setSectionCollapsed(sessionResource, section, collapsed) {
    const current = this._sectionCollapseStateBySession.get(sessionResource) ?? DEFAULT_SECTION_COLLAPSE_STATE;
    if (current[section] === collapsed) {
      return;
    }
    const next = { ...current, [section]: collapsed };
    if (!next.otherFiles && !next.checks) {
      this._sectionCollapseStateBySession.delete(sessionResource);
    } else {
      this._sectionCollapseStateBySession.set(sessionResource, next);
    }
    this._sectionCollapseStateChanged.trigger(void 0);
  }
  _deleteSectionCollapseState(sessionResource) {
    if (this._sectionCollapseStateBySession.delete(sessionResource)) {
      this._sectionCollapseStateChanged.trigger(void 0);
    }
  }
  setChangesetFilesReviewState(resources, reviewed) {
    if (resources.length === 0) {
      return;
    }
    const changeset = this.activeSessionChangesetObs.get();
    if (!changeset || !changeset.setReviewState) {
      return;
    }
    changeset.setReviewState(resources, reviewed);
  }
  _getActiveSessionState() {
    const activeSessionStateObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const loading = this.activeSessionLoadingObs.read(reader);
      if (loading) {
        return lastValue;
      }
      const activeSession = this.sessionsService.activeSession.read(reader);
      const activeSessionChanges = activeSession?.changes.read(reader) ?? [];
      const workspace = activeSession?.workspace.read(reader);
      const workspaceFolder = workspace?.folders[0];
      const gitRepository = workspaceFolder?.gitRepository;
      const hasGitRepository = this.activeSessionHasGitRepositoryObs.read(reader);
      const branchName = gitRepository?.branchName;
      const baseBranchName = gitRepository?.baseBranchName;
      const isMergeBaseBranchProtected = gitRepository?.baseBranchProtected;
      const isolationMode = gitRepository?.workTreeUri === void 0 ? IsolationMode.Workspace : IsolationMode.Worktree;
      const gitHubInfo = gitRepository?.gitHubInfo.read(reader);
      const hasPullRequest = gitHubInfo?.pullRequest?.uri !== void 0;
      const hasOpenPullRequest = hasPullRequest && (gitHubInfo.pullRequest.icon?.id === Codicon.gitPullRequestDraft.id || gitHubInfo.pullRequest.icon?.id === Codicon.gitPullRequest.id || gitHubInfo.pullRequest.icon?.id === Codicon.gitPullRequestError.id || gitHubInfo.pullRequest.icon?.id === Codicon.gitPullRequestComment.id);
      const hasGitHubRemote = gitRepository?.hasGitHubRemote ?? false;
      const upstreamBranchName = gitRepository?.upstreamBranchName;
      const incomingChanges = gitRepository?.incomingChanges ?? 0;
      const outgoingChanges = gitRepository?.outgoingChanges ?? 0;
      const uncommittedChanges = gitRepository?.uncommittedChanges ?? 0;
      const hasBranchChanges = activeSessionChanges.length > 0;
      const hasGitOperationInProgress = gitRepository?.hasGitOperationInProgress ?? false;
      return {
        isolationMode,
        hasGitRepository,
        branchName,
        baseBranchName,
        isMergeBaseBranchProtected,
        upstreamBranchName,
        incomingChanges,
        outgoingChanges,
        uncommittedChanges,
        hasBranchChanges,
        hasGitHubRemote,
        hasPullRequest,
        hasOpenPullRequest,
        hasGitOperationInProgress
      };
    });
    return derivedOpts(
      { equalsFn: structuralEquals },
      (reader) => activeSessionStateObs.read(reader)
    );
  }
  _getActiveSessionReviewComments() {
    return derived((reader) => {
      const sessionResource = this.activeSessionResourceObs.read(reader);
      if (!sessionResource) {
        return /* @__PURE__ */ new Map();
      }
      const result = /* @__PURE__ */ new Map();
      const prReviewState = this.codeReviewService.getPRReviewState(sessionResource).read(reader);
      if (prReviewState.kind === PRReviewStateKind.Loaded) {
        for (const comment of prReviewState.comments) {
          const uriKey = comment.uri.fsPath;
          result.set(uriKey, (result.get(uriKey) ?? 0) + 1);
        }
      }
      return result;
    });
  }
  _getActiveSessionAgentFeedback() {
    const didChangeFeedbackSignal = observableSignalFromEvent(this, this.agentFeedbackService.onDidChangeFeedback);
    return derived((reader) => {
      const sessionResource = this.agentFeedbackService.activeFeedbackSessionResource.read(reader);
      didChangeFeedbackSignal.read(reader);
      const feedbackItems = this.agentFeedbackService.getFeedback(sessionResource);
      const result = /* @__PURE__ */ new Map();
      for (const item of feedbackItems) {
        if (!item.sourcePRReviewCommentId && item.state !== AgentFeedbackState.Resolved) {
          const uriKey = item.resourceUri.fsPath;
          result.set(uriKey, (result.get(uriKey) ?? 0) + 1);
        }
      }
      return result;
    });
  }
  _bindContextKeys() {
    this._register(bindContextKey(ChangesetReviewSupportContext, this.contextKeyService, (reader) => {
      const changeset = this.activeSessionChangesetObs.read(reader);
      return changeset?.capabilities?.review === true;
    }));
    this._register(bindContextKey(ChangesetReviewedFilesContext, this.contextKeyService, (reader) => {
      const changes = this.activeSessionChangesObs.read(reader);
      return changes.filter((change) => change.reviewed).map((change) => change.modifiedUri?.toString() ?? change.originalUri?.toString()).filter((uri) => uri !== void 0);
    }));
    const changesetOperationCountObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const changeset = this.activeSessionChangesetObs.read(reader);
      if (!changeset) {
        return lastValue ?? 0;
      }
      const operations = changeset.operations.read(reader);
      return operations.filter((op) => op.scopes.includes(SessionChangesetOperationScope.Changeset)).length;
    });
    this._register(bindContextKey(ChangesetHasOperationsContext, this.contextKeyService, (reader) => {
      return changesetOperationCountObs.read(reader) > 0;
    }));
  }
};
ChangesViewService = __decorateClass([
  __decorateParam(0, IAgentFeedbackService),
  __decorateParam(1, ICodeReviewService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ISessionsService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ISessionsManagementService)
], ChangesViewService);
export {
  ChangesViewService,
  ChangesetHasOperationsContext,
  ChangesetReviewSupportContext,
  ChangesetReviewedFilesContext
};
