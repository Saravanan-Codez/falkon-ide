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
import { Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { AgentSession } from "../../../../../../platform/agentHost/common/agentService.js";
import { SessionStatus, readSessionEhcliAdoptable, SESSION_META_EHCLI_ADOPTABLE_KEY } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { ChatSessionStatus } from "../../../common/chatSessionsService.js";
import { getAgentSessionProviderIcon } from "../agentSessions.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
import { IAgentHostImportConversationStore } from "./agentHostImportConversationStore.js";
import { IAgentHostNewSessionFolderService } from "./agentHostNewSessionFolderService.js";
function mapSessionStatus(status) {
  if (status !== void 0 && (status & SessionStatus.InputNeeded) === SessionStatus.InputNeeded) {
    return ChatSessionStatus.NeedsInput;
  }
  if (status !== void 0 && status & SessionStatus.InProgress) {
    return ChatSessionStatus.InProgress;
  }
  if (status !== void 0 && status & SessionStatus.Error) {
    return ChatSessionStatus.Failed;
  }
  return ChatSessionStatus.Completed;
}
let AgentHostSessionListController = class extends Disposable {
  constructor(_sessionType, _provider, _sessionListStore, _description, _connectionAuthority, _provisional, _workspaceContextService, _newSessionFolderService, _importConversationStore) {
    super();
    this._sessionType = _sessionType;
    this._provider = _provider;
    this._sessionListStore = _sessionListStore;
    this._description = _description;
    this._provisional = _provisional;
    this._workspaceContextService = _workspaceContextService;
    this._newSessionFolderService = _newSessionFolderService;
    this._importConversationStore = _importConversationStore;
    void _connectionAuthority;
    this.onDidChangeChatSessionItems = Event.filter(
      Event.map(this._sessionListStore.onDidChangeSessions, (delta) => this._projectDelta(delta), this._store),
      (delta) => delta !== void 0,
      this._store
    );
  }
  get items() {
    return this._sessionListStore.getSessions(this._provider).map((entry) => this._makeItemFromSummary(entry.rawId, entry.summary, entry.statusKnown));
  }
  isNewSession(resource) {
    return resource.scheme === this._sessionType && this._sessionListStore.isPendingNewSession(this._provider, resource.path.substring(1));
  }
  async newChatSessionItem(request, token) {
    if (token.isCancellationRequested) {
      return void 0;
    }
    const rawId = generateUuid();
    this._sessionListStore.addPendingNewSession(this._provider, rawId);
    const now = Date.now();
    const item = this._makeItem(rawId, {
      title: request.prompt.trim(),
      status: SessionStatus.InProgress,
      createdAt: now,
      modifiedAt: now
    });
    if (request.untitledResource) {
      const workingDirectory = this._newSessionFolderService.getFolder(request.untitledResource) ?? this._newSessionFolderService.getDefaultFolder() ?? this._workspaceContextService.getWorkspace().folders[0]?.uri;
      if (workingDirectory) {
        this._newSessionFolderService.setFolder(item.resource, workingDirectory);
      }
      this._importConversationStore.rename(request.untitledResource, item.resource);
      await this._provisional.tryRebind(request.untitledResource, item.resource, this._provider, workingDirectory);
    }
    return item;
  }
  async deleteChatSessionItem(resource, _token) {
    if (resource.scheme !== this._sessionType) {
      return;
    }
    const rawId = AgentSession.id(resource);
    await this._sessionListStore.disposeSession(this._provider, rawId);
    this._sessionListStore.removeSession(this._provider, rawId);
  }
  setChatSessionItemArchived(resource, archived) {
    if (resource.scheme !== this._sessionType) {
      return;
    }
    this._sessionListStore.setSessionArchived(this._provider, AgentSession.id(resource), archived);
  }
  setChatSessionItemRead(resource, isRead) {
    if (resource.scheme !== this._sessionType) {
      return;
    }
    this._sessionListStore.setSessionRead(this._provider, AgentSession.id(resource), isRead);
  }
  async refresh(token) {
    await this._sessionListStore.refresh(token);
  }
  _projectDelta(delta) {
    let addedOrUpdated;
    for (const entry of delta.addedOrUpdated ?? []) {
      if (entry.provider !== this._provider) {
        continue;
      }
      (addedOrUpdated ??= []).push(this._makeItemFromSummary(entry.rawId, entry.summary, entry.statusKnown));
    }
    let removed;
    for (const removal of delta.removed ?? []) {
      if (removal.provider !== this._provider) {
        continue;
      }
      (removed ??= []).push(this._resource(removal.rawId));
    }
    if (!addedOrUpdated && !removed) {
      return void 0;
    }
    return { ...addedOrUpdated ? { addedOrUpdated } : void 0, ...removed ? { removed } : void 0 };
  }
  _makeItemFromSummary(rawId, summary, statusKnown) {
    const workingDir = typeof summary.workingDirectories?.[0] === "string" ? URI.parse(summary.workingDirectories?.[0]) : summary.workingDirectories?.[0];
    return this._makeItem(rawId, {
      title: summary.title,
      status: summary.status,
      statusKnown,
      activity: summary.activity,
      workingDirectory: workingDir,
      createdAt: Date.parse(summary.createdAt),
      modifiedAt: Date.parse(summary.modifiedAt),
      changesSummary: summary.changes,
      adoptable: readSessionEhcliAdoptable(summary._meta)
    });
  }
  _makeItem(rawId, opts) {
    const inProgress = opts.status !== void 0 && (opts.status & SessionStatus.InProgress) !== 0;
    const description = inProgress && opts.activity ? opts.activity : this._description;
    const metadata = opts.adoptable ? { ...this._buildMetadata(opts.workingDirectory) ?? {}, [SESSION_META_EHCLI_ADOPTABLE_KEY]: true } : this._buildMetadata(opts.workingDirectory);
    return {
      resource: this._resource(rawId),
      label: opts.title || `Session ${rawId.substring(0, 8)}`,
      description,
      iconPath: getAgentSessionProviderIcon(this._sessionType),
      status: mapSessionStatus(opts.status),
      archived: opts.status !== void 0 && (opts.status & SessionStatus.IsArchived) === SessionStatus.IsArchived,
      // Without a host-provided status there is no opinion on read state —
      // a pending new session, or a cold one the host has no record for.
      // Leave it unset rather than reporting the synthesized bit as unread.
      isRead: opts.status !== void 0 && opts.statusKnown !== false ? (opts.status & SessionStatus.IsRead) === SessionStatus.IsRead : void 0,
      metadata,
      timing: {
        created: opts.createdAt,
        lastRequestStarted: opts.modifiedAt,
        lastRequestEnded: opts.modifiedAt
      },
      changes: opts.changesSummary ? {
        files: opts.changesSummary.files ?? 0,
        insertions: opts.changesSummary.additions ?? 0,
        deletions: opts.changesSummary.deletions ?? 0
      } : void 0
    };
  }
  _resource(rawId) {
    return URI.from({ scheme: this._sessionType, path: `/${rawId}` });
  }
  _buildMetadata(workingDirectory) {
    if (!this._description && !workingDirectory) {
      return void 0;
    }
    const result = {};
    if (this._description) {
      result.remoteAgentHost = this._description;
    }
    if (workingDirectory) {
      result.workingDirectoryPath = workingDirectory.fsPath;
    }
    return Object.keys(result).length > 0 ? result : void 0;
  }
};
AgentHostSessionListController = __decorateClass([
  __decorateParam(5, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IAgentHostNewSessionFolderService),
  __decorateParam(8, IAgentHostImportConversationStore)
], AgentHostSessionListController);
export {
  AgentHostSessionListController
};
