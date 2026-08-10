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
import { Disposable, ReferenceCollection } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { GitHubRepositoryFetcher } from "../fetchers/githubRepositoryFetcher.js";
const LOG_PREFIX = "[GitHubRepositoryModel]";
let GitHubRepositoryModelReferenceCollection = class extends ReferenceCollection {
  constructor(apiClient, _logService) {
    super();
    this._logService = _logService;
    this._fetcher = new GitHubRepositoryFetcher(apiClient);
  }
  createReferencedObject(key, owner, repo) {
    this._logService.trace(`[GitHubRepositoryModelReferenceCollection][createReferencedObject] Creating repository model for ${key}`);
    return new GitHubRepositoryModel(owner, repo, this._fetcher, this._logService);
  }
  destroyReferencedObject(key, object) {
    this._logService.trace(`[GitHubRepositoryModelReferenceCollection][destroyReferencedObject] Disposing repository model for ${key}`);
    object.dispose();
  }
};
GitHubRepositoryModelReferenceCollection = __decorateClass([
  __decorateParam(1, ILogService)
], GitHubRepositoryModelReferenceCollection);
class GitHubRepositoryModel extends Disposable {
  constructor(owner, repo, _fetcher, _logService) {
    super();
    this.owner = owner;
    this.repo = repo;
    this._fetcher = _fetcher;
    this._logService = _logService;
    this._repositoryEtag = void 0;
    this._repository = observableValue(this, void 0);
    this.repository = this._repository;
    this._refreshPromise = void 0;
  }
  refresh() {
    if (!this._refreshPromise) {
      this._refreshPromise = this._refresh().finally(() => {
        this._refreshPromise = void 0;
      });
    }
    return this._refreshPromise;
  }
  async _refresh() {
    try {
      const response = await this._fetcher.getRepository(this.owner, this.repo, this._repositoryEtag);
      if (response.statusCode === 200 && response.data) {
        this._repositoryEtag = response.etag;
        this._repository.set(response.data, void 0);
      }
    } catch (err) {
      this._logService.error(`${LOG_PREFIX} Failed to refresh repository ${this.owner}/${this.repo}:`, err);
    }
  }
}
export {
  GitHubRepositoryModel,
  GitHubRepositoryModelReferenceCollection
};
