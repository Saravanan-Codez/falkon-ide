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
import { WeakCachedFunction } from "../../../../../base/common/cache.js";
import { Event } from "../../../../../base/common/event.js";
import { observableSignalFromEvent, derived } from "../../../../../base/common/observable.js";
import { ISCMService } from "../../../scm/common/scm.js";
let ScmAdapter = class {
  constructor(_scmService) {
    this._scmService = _scmService;
    this._repos = new WeakCachedFunction((repo) => new ScmRepoAdapter(repo));
    this._reposChangedSignal = observableSignalFromEvent(this, Event.any(this._scmService.onDidAddRepository, this._scmService.onDidRemoveRepository));
  }
  getRepo(uri, reader) {
    this._reposChangedSignal.read(reader);
    const repo = this._scmService.getRepository(uri);
    if (!repo) {
      return void 0;
    }
    return this._repos.get(repo);
  }
};
ScmAdapter = __decorateClass([
  __decorateParam(0, ISCMService)
], ScmAdapter);
class ScmRepoAdapter {
  constructor(_repo) {
    this._repo = _repo;
    this.headBranchNameObs = derived((reader) => this._repo.provider.historyProvider.read(reader)?.historyItemRef.read(reader)?.name);
    this.headCommitHashObs = derived((reader) => this._repo.provider.historyProvider.read(reader)?.historyItemRef.read(reader)?.revision);
  }
  async isIgnored(uri) {
    return false;
  }
}
export {
  ScmAdapter,
  ScmRepoAdapter
};
