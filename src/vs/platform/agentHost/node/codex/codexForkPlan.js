function resolveForkBoundary(sourceTurnIds, codexTurnId, fallbackTurnIndex) {
  const total = sourceTurnIds.length;
  let keepThroughIndex = sourceTurnIds.findIndex((id) => id === codexTurnId);
  if (keepThroughIndex === -1) {
    keepThroughIndex = fallbackTurnIndex;
  }
  if (total > 0 && (keepThroughIndex < 0 || keepThroughIndex >= total)) {
    return { resolved: false };
  }
  const numTurnsToDrop = total > 0 ? Math.max(0, total - (keepThroughIndex + 1)) : 0;
  return { resolved: true, keepThroughIndex, numTurnsToDrop };
}
function planForkedTurnIdMap(sourceTurnIds, forkedTurnIds, keepThroughIndex, hostTurnIdBySourceCodexId, turnIdMapping) {
  if (!turnIdMapping || turnIdMapping.size === 0) {
    return [];
  }
  const keptCount = Math.min(keepThroughIndex + 1, sourceTurnIds.length, forkedTurnIds.length);
  const entries = [];
  for (let i = 0; i < keptCount; i++) {
    const sourceCodexId = sourceTurnIds[i];
    const oldHostId = hostTurnIdBySourceCodexId?.get(sourceCodexId) ?? sourceCodexId;
    const newHostId = turnIdMapping.get(oldHostId) ?? oldHostId;
    entries.push([newHostId, forkedTurnIds[i]]);
  }
  return entries;
}
export {
  planForkedTurnIdMap,
  resolveForkBoundary
};
