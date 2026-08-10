import { URI } from "../../../base/common/uri.js";
import { FileEditKind } from "../common/state/sessionState.js";
import { buildSessionDbUri } from "../common/sessionDbUri.js";
function getFileEditUri(diff) {
  return diff.after?.uri ?? diff.before?.uri;
}
function createSessionFileDiff(beforeSessionUri, afterSessionUri, identity, added, removed) {
  const hasBefore = identity.firstKind !== FileEditKind.Create;
  const hasAfter = identity.lastKind !== FileEditKind.Delete;
  return {
    ...hasBefore ? {
      before: {
        uri: URI.file(identity.firstFilePath).toString(),
        content: { uri: buildSessionDbUri(beforeSessionUri, identity.firstToolCallId, identity.firstFilePath, "before") }
      }
    } : {},
    ...hasAfter ? {
      after: {
        uri: URI.file(identity.terminalPath).toString(),
        content: { uri: buildSessionDbUri(afterSessionUri, identity.lastToolCallId, identity.lastFilePath, "after") }
      }
    } : {},
    diff: { added, removed }
  };
}
async function computeSessionDiffs(sessionUri, db, diffService, incremental) {
  if (!incremental) {
    return computeUnionedDiffs([{ sessionUri, db }], diffService);
  }
  let edits;
  let fastPath = false;
  const turnEdits = await db.getFileEditsByTurn(incremental.changedTurnId);
  if (turnEdits.length === 0) {
    return [...incremental.previousDiffs];
  }
  const previousDiffsUris = new Set(incremental.previousDiffs.map(getFileEditUri));
  const needsFullHistory = turnEdits.some(
    (e) => e.kind === FileEditKind.Rename || previousDiffsUris.has(URI.file(e.filePath).toString())
  );
  if (needsFullHistory) {
    edits = await db.getAllFileEdits();
  } else {
    edits = turnEdits;
    fastPath = true;
  }
  if (edits.length === 0) {
    return [];
  }
  const pathToIdentityKey = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Map();
  const touchedIdentityKeys = !fastPath ? /* @__PURE__ */ new Set() : void 0;
  for (const edit of edits) {
    let identityKey;
    if (edit.kind === FileEditKind.Rename && edit.originalPath) {
      identityKey = pathToIdentityKey.get(edit.originalPath) ?? edit.originalPath;
      pathToIdentityKey.set(edit.filePath, identityKey);
      pathToIdentityKey.delete(edit.originalPath);
    } else {
      identityKey = pathToIdentityKey.get(edit.filePath) ?? edit.filePath;
      pathToIdentityKey.set(edit.filePath, identityKey);
    }
    if (touchedIdentityKeys && edit.turnId === incremental.changedTurnId) {
      touchedIdentityKeys.add(identityKey);
    }
    const existing = identities.get(identityKey);
    if (!existing) {
      identities.set(identityKey, {
        terminalPath: edit.filePath,
        firstToolCallId: edit.toolCallId,
        firstFilePath: edit.kind === FileEditKind.Rename && edit.originalPath ? edit.originalPath : edit.filePath,
        firstKind: edit.kind,
        firstSourceIdx: 0,
        lastToolCallId: edit.toolCallId,
        lastFilePath: edit.filePath,
        lastKind: edit.kind,
        lastSourceIdx: 0
      });
    } else {
      existing.terminalPath = edit.filePath;
      existing.lastToolCallId = edit.toolCallId;
      existing.lastFilePath = edit.filePath;
      existing.lastKind = edit.kind;
    }
  }
  const previousDiffsMap = !fastPath ? new Map(incremental.previousDiffs.map((d) => [getFileEditUri(d), d])) : void 0;
  const results = [];
  const diffPromises = [];
  for (const [identityKey, identity] of identities) {
    if (touchedIdentityKeys && !touchedIdentityKeys.has(identityKey)) {
      const uri = URI.file(identity.terminalPath).toString();
      const prev = previousDiffsMap.get(uri);
      if (prev) {
        results.push(prev);
      }
      continue;
    }
    diffPromises.push((async () => {
      let beforeText;
      if (identity.firstKind === FileEditKind.Create) {
        beforeText = "";
      } else {
        const content = await db.readFileEditContent(identity.firstToolCallId, identity.firstFilePath);
        beforeText = content?.beforeContent ? new TextDecoder().decode(content.beforeContent) : "";
      }
      let afterText;
      if (identity.lastKind === FileEditKind.Delete) {
        afterText = "";
      } else {
        const content = await db.readFileEditContent(identity.lastToolCallId, identity.lastFilePath);
        afterText = content?.afterContent ? new TextDecoder().decode(content.afterContent) : "";
      }
      if (beforeText === afterText) {
        return;
      }
      const counts = await diffService.computeDiffCounts(beforeText, afterText);
      results.push(createSessionFileDiff(sessionUri, sessionUri, identity, counts.added, counts.removed));
    })());
  }
  await Promise.allSettled(diffPromises);
  if (fastPath) {
    results.push(...incremental.previousDiffs);
  }
  return results;
}
async function computeUnionedDiffs(sources, diffService) {
  const perSourceEdits = await Promise.all(sources.map((source) => source.db.getAllFileEdits()));
  const pathToIdentityKey = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Map();
  let totalEdits = 0;
  for (let sourceIdx = 0; sourceIdx < perSourceEdits.length; sourceIdx++) {
    for (const edit of perSourceEdits[sourceIdx]) {
      totalEdits++;
      let identityKey;
      if (edit.kind === FileEditKind.Rename && edit.originalPath) {
        identityKey = pathToIdentityKey.get(edit.originalPath) ?? edit.originalPath;
        pathToIdentityKey.set(edit.filePath, identityKey);
        pathToIdentityKey.delete(edit.originalPath);
      } else {
        identityKey = pathToIdentityKey.get(edit.filePath) ?? edit.filePath;
        pathToIdentityKey.set(edit.filePath, identityKey);
      }
      const existing = identities.get(identityKey);
      if (!existing) {
        identities.set(identityKey, {
          terminalPath: edit.filePath,
          firstToolCallId: edit.toolCallId,
          firstFilePath: edit.kind === FileEditKind.Rename && edit.originalPath ? edit.originalPath : edit.filePath,
          firstKind: edit.kind,
          firstSourceIdx: sourceIdx,
          lastToolCallId: edit.toolCallId,
          lastFilePath: edit.filePath,
          lastKind: edit.kind,
          lastSourceIdx: sourceIdx
        });
      } else {
        existing.terminalPath = edit.filePath;
        existing.lastToolCallId = edit.toolCallId;
        existing.lastFilePath = edit.filePath;
        existing.lastKind = edit.kind;
        existing.lastSourceIdx = sourceIdx;
      }
    }
  }
  if (totalEdits === 0) {
    return [];
  }
  const results = [];
  const diffPromises = [];
  for (const identity of identities.values()) {
    diffPromises.push((async () => {
      const firstSource = sources[identity.firstSourceIdx];
      const lastSource = sources[identity.lastSourceIdx];
      let beforeText;
      if (identity.firstKind === FileEditKind.Create) {
        beforeText = "";
      } else {
        const content = await firstSource.db.readFileEditContent(identity.firstToolCallId, identity.firstFilePath);
        beforeText = content?.beforeContent ? new TextDecoder().decode(content.beforeContent) : "";
      }
      let afterText;
      if (identity.lastKind === FileEditKind.Delete) {
        afterText = "";
      } else {
        const content = await lastSource.db.readFileEditContent(identity.lastToolCallId, identity.lastFilePath);
        afterText = content?.afterContent ? new TextDecoder().decode(content.afterContent) : "";
      }
      if (beforeText === afterText) {
        return;
      }
      const counts = await diffService.computeDiffCounts(beforeText, afterText);
      results.push(createSessionFileDiff(firstSource.sessionUri, lastSource.sessionUri, identity, counts.added, counts.removed));
    })());
  }
  await Promise.allSettled(diffPromises);
  return results;
}
async function computeTurnDiffs(sessionUri, db, diffService, turnId) {
  const edits = await db.getFileEditsByTurn(turnId);
  if (edits.length === 0) {
    return [];
  }
  const pathToIdentityKey = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Map();
  for (const edit of edits) {
    let identityKey;
    if (edit.kind === FileEditKind.Rename && edit.originalPath) {
      identityKey = pathToIdentityKey.get(edit.originalPath) ?? edit.originalPath;
      pathToIdentityKey.set(edit.filePath, identityKey);
      pathToIdentityKey.delete(edit.originalPath);
    } else {
      identityKey = pathToIdentityKey.get(edit.filePath) ?? edit.filePath;
      pathToIdentityKey.set(edit.filePath, identityKey);
    }
    const existing = identities.get(identityKey);
    if (!existing) {
      identities.set(identityKey, {
        terminalPath: edit.filePath,
        firstToolCallId: edit.toolCallId,
        firstFilePath: edit.kind === FileEditKind.Rename && edit.originalPath ? edit.originalPath : edit.filePath,
        firstKind: edit.kind,
        firstSourceIdx: 0,
        lastToolCallId: edit.toolCallId,
        lastFilePath: edit.filePath,
        lastKind: edit.kind,
        lastSourceIdx: 0
      });
    } else {
      existing.terminalPath = edit.filePath;
      existing.lastToolCallId = edit.toolCallId;
      existing.lastFilePath = edit.filePath;
      existing.lastKind = edit.kind;
    }
  }
  const results = [];
  const diffPromises = [];
  for (const identity of identities.values()) {
    diffPromises.push((async () => {
      let beforeText;
      if (identity.firstKind === FileEditKind.Create) {
        beforeText = "";
      } else {
        const content = await db.readFileEditContent(identity.firstToolCallId, identity.firstFilePath);
        beforeText = content?.beforeContent ? new TextDecoder().decode(content.beforeContent) : "";
      }
      let afterText;
      if (identity.lastKind === FileEditKind.Delete) {
        afterText = "";
      } else {
        const content = await db.readFileEditContent(identity.lastToolCallId, identity.lastFilePath);
        afterText = content?.afterContent ? new TextDecoder().decode(content.afterContent) : "";
      }
      if (beforeText === afterText) {
        return;
      }
      const counts = await diffService.computeDiffCounts(beforeText, afterText);
      results.push(createSessionFileDiff(sessionUri, sessionUri, identity, counts.added, counts.removed));
    })());
  }
  await Promise.allSettled(diffPromises);
  return results;
}
export {
  computeSessionDiffs,
  computeTurnDiffs,
  computeUnionedDiffs
};
