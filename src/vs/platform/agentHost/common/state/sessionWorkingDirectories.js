import { Schemas } from "../../../../base/common/network.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { extUri, extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { ActionType } from "./sessionActions.js";
function areDirectorySetsEqual(first, second) {
  const toKey = (directory) => extUri.getComparisonKey(directory);
  const firstSet = new ResourceSet(first, toKey);
  const secondSet = new ResourceSet(second, toKey);
  return firstSet.size === secondSet.size && [...firstSet].every((directory) => secondSet.has(directory));
}
function areAdditionalWorkingDirectoriesEqual(first, second) {
  if (!first || !second) {
    return first === second;
  }
  return areDirectorySetsEqual(first, second);
}
function areSessionWorkingDirectoriesEqual(first, second, hasImmutablePrimary) {
  if (!first || !second) {
    return first === second;
  }
  if (!hasImmutablePrimary) {
    return areDirectorySetsEqual(first, second);
  }
  return extUri.isEqual(first[0], second[0]) && areDirectorySetsEqual(first.slice(1), second.slice(1));
}
function resolveSessionWorkingDirectoryAction(action, workingDirectories, hasImmutablePrimary) {
  const directory = URI.parse(action.directory, true);
  if (directory.scheme !== Schemas.file) {
    throw new Error(`Working directory must be a file URI: ${action.directory}`);
  }
  const current = workingDirectories.map((value) => URI.parse(value, true));
  const index = current.findIndex((value) => extUriBiasedIgnorePathCase.isEqual(value, directory));
  if (hasImmutablePrimary && action.type === ActionType.SessionWorkingDirectoryRemoved && index === 0) {
    throw new Error("The primary working directory cannot be removed.");
  }
  const canonicalDirectory = index >= 0 ? current[index] : directory;
  return { ...action, directory: canonicalDirectory.toString() };
}
export {
  areAdditionalWorkingDirectoriesEqual,
  areSessionWorkingDirectoriesEqual,
  resolveSessionWorkingDirectoryAction
};
