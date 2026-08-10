import { Schemas } from "../../../base/common/network.js";
import { extUriBiasedIgnorePathCase } from "../../../base/common/resources.js";
function resolveAgentHostFileCompletionRoots(workingDirectories) {
  const logicalRoots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const workingDirectory of workingDirectories) {
    if (workingDirectory.scheme !== Schemas.file) {
      continue;
    }
    const normalized = extUriBiasedIgnorePathCase.removeTrailingPathSeparator(extUriBiasedIgnorePathCase.normalizePath(workingDirectory));
    const key = extUriBiasedIgnorePathCase.getComparisonKey(normalized);
    if (!seen.has(key)) {
      seen.add(key);
      logicalRoots.push(normalized);
    }
  }
  const enumerationRoots = logicalRoots.filter(
    (candidate, candidateIndex) => !logicalRoots.some(
      (other, otherIndex) => candidateIndex !== otherIndex && extUriBiasedIgnorePathCase.isEqualOrParent(candidate, other)
    )
  );
  return { logicalRoots, enumerationRoots };
}
export {
  resolveAgentHostFileCompletionRoots
};
