import { constObservable, derivedOpts, mapObservableArrayCached } from "../../../../../base/common/observable.js";
import { compare as strCompare } from "../../../../../base/common/strings.js";
import { getComparisonKey, isEqual, isEqualOrParent } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { normalizeFileEdit } from "../../../../../platform/agentHost/common/fileEditDiff.js";
import {
  buildDefaultChatUri,
  FileEditKind,
  ResponsePartKind,
  StateComponents,
  ToolCallStatus,
  ToolResultContentType
} from "../../../../../platform/agentHost/common/state/sessionState.js";
import { SessionFileOperation, sessionTurnFileChangesEqual } from "../../../../services/sessions/common/session.js";
import { createActiveSessionSubscriptionObs } from "./agentHostSessionChangesets.js";
function createSessionOutputObs(sessionUri, options, isActiveSessionObs, isArchivedObs, workspaceObs, cache) {
  const mapDiffUri = options.mapDiffUri;
  const enabledObs = derivedOpts({ equalsFn: (a, b) => a === b }, (reader) => isActiveSessionObs.read(reader) && !isArchivedObs.read(reader));
  const sessionStateObs = createActiveSessionSubscriptionObs(
    options,
    enabledObs,
    StateComponents.Session,
    constObservable(sessionUri)
  );
  const chatUrisObs = derivedOpts({ equalsFn: (a, b) => a.length === b.length && a.every((u, i) => isEqual(u, b[i])) }, (reader) => {
    if (!enabledObs.read(reader)) {
      return [];
    }
    const sessionState = sessionStateObs.read(reader).read(reader);
    const defaultChatUri = URI.parse(buildDefaultChatUri(sessionUri));
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
  const editsPerChatObs = mapObservableArrayCached(void 0, chatUrisObs, (chatUri) => {
    const chatStateObs = createActiveSessionSubscriptionObs(
      options,
      enabledObs,
      StateComponents.Chat,
      constObservable(chatUri)
    );
    const parse = createIncrementalChatFileEditsParser(mapDiffUri);
    return {
      chatUri,
      edits: derivedOpts({ equalsFn: chatFileEditsEqual }, (reader) => {
        const chatState = chatStateObs.read(reader).read(reader);
        if (!chatState || chatState instanceof Error) {
          return { allEdits: [], lastTurnEdits: [] };
        }
        return parse(chatState);
      })
    };
  }, (chatUri) => chatUri.toString());
  const externalFiles = derivedOpts({ equalsFn: sessionFilesEqual }, (reader) => {
    const workspace = workspaceObs.read(reader);
    const folderRoots = (workspace?.folders ?? []).map((f) => f.workingDirectory);
    const allEdits = [];
    for (const chatEdits of editsPerChatObs.read(reader)) {
      allEdits.push(...chatEdits.edits.read(reader).allEdits);
    }
    return reduceSessionFiles(allEdits, folderRoots);
  });
  const getLastTurnChanges = (chatUri) => derivedOpts({ equalsFn: sessionTurnFileChangesEqual }, (reader) => {
    const folderRoots = getWorkspaceAndWorktreeRoots(workspaceObs.read(reader));
    const chatEdits = editsPerChatObs.read(reader).find((entry) => isEqual(entry.chatUri, chatUri));
    if (chatEdits) {
      return reduceTurnChanges(chatEdits.edits.read(reader).lastTurnEdits, folderRoots, cache);
    }
    return [];
  });
  return { externalFiles, getLastTurnChanges };
}
function pushUniqueRoot(roots, root) {
  if (root && !roots.some((existing) => isEqual(existing, root))) {
    roots.push(root);
  }
}
function getWorkspaceAndWorktreeRoots(workspace) {
  const roots = [];
  for (const folder of workspace?.folders ?? []) {
    pushUniqueRoot(roots, folder.root);
    pushUniqueRoot(roots, folder.workingDirectory);
    pushUniqueRoot(roots, folder.gitRepository?.workTreeUri);
  }
  return roots;
}
function createIncrementalChatFileEditsParser(mapDiffUri, parseTurn = (responseParts) => parseResponseParts(responseParts, mapDiffUri)) {
  const completedTurnCache = /* @__PURE__ */ new Map();
  return (chatState) => {
    const allEdits = [];
    const turns = chatState.turns ?? [];
    const completedIds = new Set(turns.map((t) => t.id));
    for (const id of completedTurnCache.keys()) {
      if (!completedIds.has(id)) {
        completedTurnCache.delete(id);
      }
    }
    for (const turn of turns) {
      let parsed = completedTurnCache.get(turn.id);
      if (!parsed) {
        parsed = parseTurn(turn.responseParts);
        completedTurnCache.set(turn.id, parsed);
      }
      if (parsed.length > 0) {
        allEdits.push(...parsed);
      }
    }
    let lastTurnEdits;
    if (chatState.activeTurn) {
      lastTurnEdits = parseTurn(chatState.activeTurn.responseParts);
      allEdits.push(...lastTurnEdits);
    } else if (turns.length > 0) {
      lastTurnEdits = completedTurnCache.get(turns[turns.length - 1].id) ?? [];
    } else {
      lastTurnEdits = [];
    }
    return { allEdits, lastTurnEdits };
  };
}
function parseResponseParts(responseParts, mapDiffUri) {
  const out = [];
  for (const part of responseParts) {
    if (part.kind !== ResponsePartKind.ToolCall) {
      continue;
    }
    for (const fileEdit of getToolCallFileEdits(part.toolCall)) {
      const parsed = parseFileEdit(fileEdit, mapDiffUri);
      if (parsed) {
        out.push(parsed);
      }
    }
  }
  return out;
}
function getToolCallFileEdits(toolCall) {
  const edits = [];
  if (toolCall.status === ToolCallStatus.Running || toolCall.status === ToolCallStatus.Completed || toolCall.status === ToolCallStatus.PendingResultConfirmation) {
    for (const c of toolCall.content ?? []) {
      if (c.type === ToolResultContentType.FileEdit) {
        edits.push(c);
      }
    }
  } else if (toolCall.status === ToolCallStatus.PendingConfirmation) {
    edits.push(...toolCall.edits?.items ?? []);
  }
  return edits;
}
function parseFileEdit(fileEdit, mapDiffUri) {
  const normalized = normalizeFileEdit(fileEdit);
  if (!normalized) {
    return void 0;
  }
  const map = (uri) => uri ? mapDiffUri ? mapDiffUri(uri) : uri : void 0;
  return {
    kind: normalized.kind,
    afterUri: map(normalized.afterUri),
    beforeUri: map(normalized.beforeUri),
    beforeContentUri: map(normalized.beforeContentUri),
    insertions: fileEdit.diff?.added ?? 0,
    deletions: fileEdit.diff?.removed ?? 0
  };
}
function reduceSessionFiles(edits, folderRoots) {
  const byUri = /* @__PURE__ */ new Map();
  const isOutsideWorkspace = (uri) => !folderRoots.some((root) => isEqualOrParent(uri, root));
  const setCreated = (uri) => {
    if (!isOutsideWorkspace(uri)) {
      return;
    }
    byUri.set(getComparisonKey(uri), { uri, file: { operation: SessionFileOperation.Created } });
  };
  const setModified = (uri, originalUri) => {
    if (!isOutsideWorkspace(uri)) {
      return;
    }
    const existing = byUri.get(getComparisonKey(uri));
    if (existing?.file.operation === SessionFileOperation.Created) {
      return;
    }
    if (existing?.file.operation === SessionFileOperation.Modified) {
      existing.file.originalUri = existing.file.originalUri ?? originalUri;
      return;
    }
    byUri.set(getComparisonKey(uri), { uri, file: { operation: SessionFileOperation.Modified, originalUri } });
  };
  const removeFile = (uri) => {
    byUri.delete(getComparisonKey(uri));
  };
  for (const edit of edits) {
    switch (edit.kind) {
      case FileEditKind.Create:
        if (edit.afterUri) {
          setCreated(edit.afterUri);
        }
        break;
      case FileEditKind.Edit:
        if (edit.afterUri) {
          setModified(edit.afterUri, edit.beforeContentUri);
        }
        break;
      case FileEditKind.Delete:
        if (edit.beforeUri) {
          removeFile(edit.beforeUri);
        }
        break;
      case FileEditKind.Rename:
        if (edit.beforeUri) {
          removeFile(edit.beforeUri);
        }
        if (edit.afterUri) {
          setCreated(edit.afterUri);
        }
        break;
    }
  }
  const files = [...byUri.values()].map(({ uri, file }) => ({
    uri,
    operation: file.operation,
    originalUri: file.originalUri
  }));
  files.sort((a, b) => strCompare(getComparisonKey(a.uri), getComparisonKey(b.uri)));
  return files;
}
function reduceTurnChanges(edits, folderRoots = [], cache) {
  const byUri = /* @__PURE__ */ new Map();
  const isOutsideWorkspace = (resource) => {
    const cacheKey = `isOutsideWorkspace:${resource.toString()}`;
    const cached = cache?.get(cacheKey);
    if (typeof cached === "boolean") {
      return cached;
    }
    const result = !folderRoots.some((root) => isEqualOrParent(resource, root));
    cache?.set(cacheKey, result);
    return result;
  };
  const setCreated = (uri, insertions, deletions) => {
    const key = getComparisonKey(uri);
    const existing = byUri.get(key);
    if (existing) {
      existing.created = true;
      existing.modifiedUri = uri;
      existing.originalUri = void 0;
      existing.insertions += insertions;
      existing.deletions += deletions;
      return;
    }
    byUri.set(key, { uri, modifiedUri: uri, originalUri: void 0, isOutsideWorkspace: isOutsideWorkspace(uri), created: true, insertions, deletions });
  };
  const setModified = (uri, originalUri, insertions, deletions) => {
    const key = getComparisonKey(uri);
    const existing = byUri.get(key);
    if (existing) {
      existing.insertions += insertions;
      existing.deletions += deletions;
      if (!existing.created) {
        existing.originalUri = existing.originalUri ?? originalUri;
      }
      return;
    }
    byUri.set(key, { uri, modifiedUri: uri, originalUri, isOutsideWorkspace: isOutsideWorkspace(uri), created: false, insertions, deletions });
  };
  const setDeleted = (uri, originalUri, insertions, deletions) => {
    const key = getComparisonKey(uri);
    if (byUri.has(key)) {
      byUri.delete(key);
      return;
    }
    byUri.set(key, { uri, modifiedUri: void 0, originalUri, isOutsideWorkspace: isOutsideWorkspace(uri), created: false, insertions, deletions });
  };
  for (const edit of edits) {
    switch (edit.kind) {
      case FileEditKind.Create:
        if (edit.afterUri) {
          setCreated(edit.afterUri, edit.insertions, edit.deletions);
        }
        break;
      case FileEditKind.Edit:
        if (edit.afterUri) {
          setModified(edit.afterUri, edit.beforeContentUri, edit.insertions, edit.deletions);
        }
        break;
      case FileEditKind.Delete:
        if (edit.beforeUri) {
          setDeleted(edit.beforeUri, edit.beforeContentUri, edit.insertions, edit.deletions);
        }
        break;
      case FileEditKind.Rename:
        if (edit.beforeUri) {
          byUri.delete(getComparisonKey(edit.beforeUri));
        }
        if (edit.afterUri) {
          setModified(edit.afterUri, edit.beforeContentUri, edit.insertions, edit.deletions);
        }
        break;
    }
  }
  return [...byUri.values()].map((c) => ({
    uri: c.uri,
    modifiedUri: c.modifiedUri,
    originalUri: c.originalUri,
    isOutsideWorkspace: c.isOutsideWorkspace,
    insertions: c.insertions,
    deletions: c.deletions
  }));
}
function sessionFilesEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].operation !== b[i].operation || !isEqual(a[i].uri, b[i].uri) || !isEqual(a[i].originalUri, b[i].originalUri)) {
      return false;
    }
  }
  return true;
}
function parsedFileEditsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind || a[i].insertions !== b[i].insertions || a[i].deletions !== b[i].deletions || !isEqual(a[i].afterUri, b[i].afterUri) || !isEqual(a[i].beforeUri, b[i].beforeUri) || !isEqual(a[i].beforeContentUri, b[i].beforeContentUri)) {
      return false;
    }
  }
  return true;
}
function chatFileEditsEqual(a, b) {
  return parsedFileEditsEqual(a.allEdits, b.allEdits) && parsedFileEditsEqual(a.lastTurnEdits, b.lastTurnEdits);
}
export {
  createIncrementalChatFileEditsParser,
  createSessionOutputObs,
  parseResponseParts,
  reduceSessionFiles,
  reduceTurnChanges
};
