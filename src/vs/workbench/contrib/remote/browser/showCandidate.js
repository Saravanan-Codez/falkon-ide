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
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IRemoteExplorerService } from "../../../services/remote/common/remoteExplorerService.js";
let ShowCandidateContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.showPortCandidate";
  }
  constructor(remoteExplorerService, environmentService) {
    super();
    const showPortCandidate = environmentService.options?.tunnelProvider?.showPortCandidate;
    if (showPortCandidate) {
      this._register(remoteExplorerService.setCandidateFilter(async (candidates) => {
        const filters = await Promise.all(candidates.map((candidate) => showPortCandidate(candidate.host, candidate.port, candidate.detail ?? "")));
        const filteredCandidates = [];
        if (filters.length !== candidates.length) {
          return candidates;
        }
        for (let i = 0; i < candidates.length; i++) {
          if (filters[i]) {
            filteredCandidates.push(candidates[i]);
          }
        }
        return filteredCandidates;
      }));
    }
  }
};
ShowCandidateContribution = __decorateClass([
  __decorateParam(0, IRemoteExplorerService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService)
], ShowCandidateContribution);
export {
  ShowCandidateContribution
};
