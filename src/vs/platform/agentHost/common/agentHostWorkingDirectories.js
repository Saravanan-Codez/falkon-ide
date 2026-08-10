import { extUriBiasedIgnorePathCase } from "../../../base/common/resources.js";
function findDeepestContainingWorkingDirectory(resource, workingDirectories) {
  let deepestMatch;
  for (const workingDirectory of workingDirectories) {
    if (extUriBiasedIgnorePathCase.isEqualOrParent(resource, workingDirectory) && (!deepestMatch || workingDirectory.path.length > deepestMatch.path.length)) {
      deepestMatch = workingDirectory;
    }
  }
  return deepestMatch;
}
export {
  findDeepestContainingWorkingDirectory
};
