import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../../../base/common/map.js";
import { constObservable, derived, derivedOpts, mapObservableArrayCached, observableFromEvent } from "../../../../../../base/common/observable.js";
import { getComparisonKey, isEqual, isEqualOrParent } from "../../../../../../base/common/resources.js";
import { isDefined } from "../../../../../../base/common/types.js";
import { URI } from "../../../../../../base/common/uri.js";
import { buildTurnChangesetUri, ChangesetKind } from "../../../../../../platform/agentHost/common/changesetUri.js";
import { normalizeFileEdit } from "../../../../../../platform/agentHost/common/fileEditDiff.js";
import { toAgentHostUri } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import {
  buildDefaultChatUri,
  FileEditKind,
  ResponsePartKind,
  StateComponents,
  ToolCallStatus,
  ToolResultContentType
} from "../../../../../../platform/agentHost/common/state/sessionState.js";
const SUBSCRIPTION_OWNER = "AgentHostResponseFileChangesProvider";
const REQUEST_CACHE_CAPACITY = 1e3;
function uriArrayEquals(a, b) {
  return a.length === b.length && a.every((uri, index) => isEqual(uri, b[index]));
}
function getToolCallFileEdits(toolCall) {
  const edits = [];
  if (toolCall.status === ToolCallStatus.Running || toolCall.status === ToolCallStatus.Completed || toolCall.status === ToolCallStatus.PendingResultConfirmation) {
    for (const content of toolCall.content ?? []) {
      if (content.type === ToolResultContentType.FileEdit) {
        edits.push(content);
      }
    }
  } else if (toolCall.status === ToolCallStatus.PendingConfirmation) {
    edits.push(...toolCall.edits?.items ?? []);
  }
  return edits;
}
class AgentHostResponseFileChangesProvider extends Disposable {
  constructor(_connection, _connectionAuthority, _resolveBackendSession) {
    super();
    this._connection = _connection;
    this._connectionAuthority = _connectionAuthority;
    this._resolveBackendSession = _resolveBackendSession;
    this._perRequest = new LRUCache(REQUEST_CACHE_CAPACITY);
    this._perRequestFileEdits = new LRUCache(REQUEST_CACHE_CAPACITY);
  }
  getChangesForRequest(sessionResource, requestId) {
    const backendSession = this._resolveBackendSession(sessionResource);
    if (!backendSession || !requestId) {
      return void 0;
    }
    const key = `${backendSession.toString()}\0${requestId}`;
    let obs = this._perRequest.get(key);
    if (!obs) {
      obs = this._createDiffsObservable(backendSession, requestId);
      this._perRequest.set(key, obs);
    }
    return obs;
  }
  getFileEditsForRequest(sessionResource, requestId) {
    const backendSession = this._resolveBackendSession(sessionResource);
    if (!backendSession || !requestId) {
      return void 0;
    }
    const key = `${backendSession.toString()}\0${requestId}`;
    let obs = this._perRequestFileEdits.get(key);
    if (!obs) {
      obs = this._createFileEditDiffsObservable(backendSession, requestId);
      this._perRequestFileEdits.set(key, obs);
    }
    return obs;
  }
  _createDiffsObservable(backendSession, requestId) {
    const sessionStateObs = this._subscribe(StateComponents.Session, constObservable(backendSession));
    const turnChangesetUriObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      const sessionState = sessionStateObs.read(reader).read(reader);
      if (!sessionState || sessionState instanceof Error) {
        return void 0;
      }
      const supportsTurnChangeset = sessionState.changesets?.some((c) => c.changeKind === ChangesetKind.Turn);
      if (!supportsTurnChangeset) {
        return void 0;
      }
      return URI.parse(buildTurnChangesetUri(backendSession.toString(), requestId));
    });
    const changesetStateObs = this._subscribe(StateComponents.Changeset, turnChangesetUriObs);
    return derived((reader) => {
      const changesetState = changesetStateObs.read(reader).read(reader);
      if (!changesetState || changesetState instanceof Error) {
        return [];
      }
      return changesetState.files.map((file) => this._changesetFileToEntryDiff(file)).filter(isDefined);
    });
  }
  _createFileEditDiffsObservable(backendSession, requestId) {
    const sessionStateObs = this._subscribe(StateComponents.Session, constObservable(backendSession));
    const defaultChatUri = URI.parse(buildDefaultChatUri(backendSession.toString()));
    const chatUrisObs = derivedOpts({ equalsFn: uriArrayEquals }, (reader) => {
      const sessionState = sessionStateObs.read(reader).read(reader);
      if (!sessionState || sessionState instanceof Error) {
        return [defaultChatUri];
      }
      const uris = /* @__PURE__ */ new Map();
      uris.set(defaultChatUri.toString(), defaultChatUri);
      for (const chat of sessionState.chats) {
        const uri = URI.parse(chat.resource);
        uris.set(uri.toString(), uri);
      }
      return [...uris.values()];
    });
    const chatStateObs = mapObservableArrayCached(this, chatUrisObs, (chatUri) => {
      const obs = this._subscribe(StateComponents.Chat, constObservable(chatUri));
      return derived((reader) => obs.read(reader).read(reader));
    }, (chatUri) => chatUri.toString());
    return derived((reader) => {
      const sessionState = sessionStateObs.read(reader).read(reader);
      const workspaceRoots = [];
      if (sessionState && !(sessionState instanceof Error)) {
        const roots = /* @__PURE__ */ new Map();
        for (const root of [sessionState.project?.uri, ...sessionState.workingDirectories ?? []]) {
          if (root) {
            const uri = URI.parse(root);
            roots.set(uri.toString(), uri);
          }
        }
        workspaceRoots.push(...roots.values());
      }
      for (const obs of chatStateObs.read(reader)) {
        const chatState = obs.read(reader);
        if (!chatState || chatState instanceof Error) {
          continue;
        }
        const turn = chatState.activeTurn?.id === requestId ? chatState.activeTurn : chatState.turns.find((turn2) => turn2.id === requestId);
        if (turn) {
          return this._responsePartsToEntryDiffs(turn.responseParts, workspaceRoots);
        }
      }
      return [];
    });
  }
  /**
   * Builds a two-level observable that owns a refcounted subscription to
   * `component` at the (observable) resource. The outer observable acquires
   * the subscription against the current resource and releases it when the
   * resource changes or no one observes; the inner observable tracks the
   * subscription's value.
   */
  _subscribe(component, resourceObs) {
    return derived((reader) => {
      const resource = resourceObs.read(reader);
      if (!resource) {
        return constObservable(void 0);
      }
      const subscriptionRef = reader.store.add(this._connection.getSubscription(component, resource, SUBSCRIPTION_OWNER));
      return observableFromEvent(this, subscriptionRef.object.onDidChange, () => subscriptionRef.object.value);
    });
  }
  _responsePartsToEntryDiffs(responseParts, workspaceRoots) {
    const byUri = /* @__PURE__ */ new Map();
    for (const responsePart of responseParts) {
      if (responsePart.kind !== ResponsePartKind.ToolCall) {
        continue;
      }
      for (const fileEdit of getToolCallFileEdits(responsePart.toolCall)) {
        const diff = this._fileEditToEntryDiff(fileEdit, workspaceRoots);
        if (!diff) {
          continue;
        }
        const key = getComparisonKey(diff.modifiedURI);
        const existing = byUri.get(key);
        if (existing) {
          existing.added += diff.added;
          existing.removed += diff.removed;
        } else {
          byUri.set(key, diff);
        }
      }
    }
    return [...byUri.values()];
  }
  _fileEditToEntryDiff(fileEdit, workspaceRoots) {
    const normalized = normalizeFileEdit(fileEdit);
    if (!normalized || !normalized.afterUri) {
      return void 0;
    }
    const afterUri = normalized.afterUri;
    const modifiedURI = toAgentHostUri(afterUri, this._connectionAuthority);
    const originalURI = normalized.kind === FileEditKind.Create || !normalized.beforeContentUri ? modifiedURI : toAgentHostUri(normalized.beforeContentUri, this._connectionAuthority);
    const modifiedSnapshotURI = normalized.afterContentUri ? toAgentHostUri(normalized.afterContentUri, this._connectionAuthority) : void 0;
    return {
      originalURI,
      modifiedURI,
      modifiedSnapshotURI,
      added: fileEdit.diff?.added ?? 0,
      removed: fileEdit.diff?.removed ?? 0,
      quitEarly: false,
      identical: false,
      isFinal: true,
      isBusy: false,
      isOutsideWorkspace: !workspaceRoots.some((root) => isEqualOrParent(afterUri, root))
    };
  }
  _changesetFileToEntryDiff(file) {
    const normalized = normalizeFileEdit(file.edit);
    if (!normalized) {
      return void 0;
    }
    const modifiedURI = toAgentHostUri(normalized.resource, this._connectionAuthority);
    const originalURI = normalized.beforeContentUri ? toAgentHostUri(normalized.beforeContentUri, this._connectionAuthority) : modifiedURI;
    const modifiedSnapshotURI = normalized.afterContentUri ? toAgentHostUri(normalized.afterContentUri, this._connectionAuthority) : void 0;
    return {
      originalURI,
      modifiedURI,
      modifiedSnapshotURI,
      added: file.edit.diff?.added ?? 0,
      removed: file.edit.diff?.removed ?? 0,
      quitEarly: false,
      identical: false,
      isFinal: true,
      isBusy: false
    };
  }
}
export {
  AgentHostResponseFileChangesProvider
};
