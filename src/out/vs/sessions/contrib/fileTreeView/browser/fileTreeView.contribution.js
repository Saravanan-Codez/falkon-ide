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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { GITHUB_REMOTE_FILE_SCHEME } from "../../../services/sessions/common/session.js";
import { GitHubFileSystemProvider } from "./githubFileSystemProvider.js";
let GitHubFileSystemProviderContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.githubFileSystemProvider";
  }
  constructor(fileService, instantiationService) {
    super();
    const provider = this._register(instantiationService.createInstance(GitHubFileSystemProvider));
    this._register(fileService.registerProvider(GITHUB_REMOTE_FILE_SCHEME, provider));
  }
};
GitHubFileSystemProviderContribution = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IInstantiationService)
], GitHubFileSystemProviderContribution);
registerWorkbenchContribution2(
  GitHubFileSystemProviderContribution.ID,
  GitHubFileSystemProviderContribution,
  WorkbenchPhase.AfterRestored
);
