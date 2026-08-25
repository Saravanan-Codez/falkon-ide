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
import { Sequencer } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { waitForState } from "../../../base/common/observable.js";
import { URI } from "../../../base/common/uri.js";
import { GitRepository } from "../../contrib/git/browser/gitService.js";
import { IGitService, GitRefType } from "../../contrib/git/common/gitService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, GitRefTypeDto, MainContext } from "../common/extHost.protocol.js";
function toGitRefType(type) {
  switch (type) {
    case GitRefTypeDto.Head:
      return GitRefType.Head;
    case GitRefTypeDto.RemoteHead:
      return GitRefType.RemoteHead;
    case GitRefTypeDto.Tag:
      return GitRefType.Tag;
    default:
      throw new Error(`Unknown GitRefType: ${type}`);
  }
}
function toGitDiffChange(dto) {
  return {
    uri: URI.revive(dto.uri),
    originalUri: dto.originalUri ? URI.revive(dto.originalUri) : void 0,
    modifiedUri: dto.modifiedUri ? URI.revive(dto.modifiedUri) : void 0,
    insertions: dto.insertions,
    deletions: dto.deletions
  };
}
function toGitRepositoryState(dto) {
  return {
    HEAD: dto?.HEAD ? {
      type: toGitRefType(dto.HEAD.type),
      name: dto.HEAD.name,
      commit: dto.HEAD.commit,
      remote: dto.HEAD.remote,
      upstream: dto.HEAD.upstream,
      ahead: dto.HEAD.ahead,
      behind: dto.HEAD.behind
    } : void 0,
    remotes: dto?.remotes ?? [],
    mergeChanges: dto?.mergeChanges?.map((c) => ({
      uri: URI.revive(c.uri),
      originalUri: c.originalUri ? URI.revive(c.originalUri) : void 0,
      modifiedUri: c.modifiedUri ? URI.revive(c.modifiedUri) : void 0
    })) ?? [],
    indexChanges: dto?.indexChanges?.map((c) => ({
      uri: URI.revive(c.uri),
      originalUri: c.originalUri ? URI.revive(c.originalUri) : void 0,
      modifiedUri: c.modifiedUri ? URI.revive(c.modifiedUri) : void 0
    })) ?? [],
    workingTreeChanges: dto?.workingTreeChanges?.map((c) => ({
      uri: URI.revive(c.uri),
      originalUri: c.originalUri ? URI.revive(c.originalUri) : void 0,
      modifiedUri: c.modifiedUri ? URI.revive(c.modifiedUri) : void 0
    })) ?? [],
    untrackedChanges: dto?.untrackedChanges?.map((c) => ({
      uri: URI.revive(c.uri),
      originalUri: c.originalUri ? URI.revive(c.originalUri) : void 0,
      modifiedUri: c.modifiedUri ? URI.revive(c.modifiedUri) : void 0
    })) ?? []
  };
}
let MainThreadGitExtensionService = class extends Disposable {
  constructor(extHostContext, gitService) {
    super();
    this.gitService = gitService;
    this._openRepositorySequencer = new Sequencer();
    this._repositoryHandles = new ResourceMap();
    this._repositories = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostGitExtension);
    this._initializeDelegate();
  }
  get repositories() {
    return this._repositories.values();
  }
  async _initializeDelegate() {
    const isExtensionAvailable = await this._proxy.$isGitExtensionAvailable();
    if (isExtensionAvailable && !this._store.isDisposed) {
      this._register(this.gitService.setDelegate(this));
    }
  }
  async openRepository(uri) {
    return this._openRepositorySequencer.queue(async () => {
      const result = await this._proxy.$openRepository(uri);
      if (!result) {
        return void 0;
      }
      const repositoryRootUri = URI.revive(result.rootUri);
      const state = toGitRepositoryState(result.state);
      const repository = new GitRepository(repositoryRootUri, state, this);
      this._repositories.set(result.handle, repository);
      this._repositoryHandles.set(repositoryRootUri, result.handle);
      await waitForState(repository.state, (state2) => state2.HEAD !== void 0);
      return repository;
    });
  }
  async getRefs(root, query, token) {
    const handle = this._repositoryHandles.get(root);
    if (handle === void 0) {
      return [];
    }
    const result = await this._proxy.$getRefs(handle, query, token);
    if (token?.isCancellationRequested) {
      return [];
    }
    return result.map((ref) => ({
      ...ref,
      type: toGitRefType(ref.type)
    }));
  }
  async diffBetweenWithStats(root, ref1, ref2, path) {
    const handle = this._repositoryHandles.get(root);
    if (handle === void 0) {
      return [];
    }
    const result = await this._proxy.$diffBetweenWithStats(handle, ref1, ref2, path);
    return result.map(toGitDiffChange);
  }
  async diffBetweenWithStats2(root, ref, path) {
    const handle = this._repositoryHandles.get(root);
    if (handle === void 0) {
      return [];
    }
    const result = await this._proxy.$diffBetweenWithStats2(handle, ref, path);
    return result.map(toGitDiffChange);
  }
  async $onDidChangeRepository(handle) {
    const repository = this._repositories.get(handle);
    if (!repository) {
      return;
    }
    const state = await this._proxy.$getRepositoryState(handle);
    if (!state) {
      return;
    }
    repository.updateState(toGitRepositoryState(state));
  }
};
MainThreadGitExtensionService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadGitExtension),
  __decorateParam(1, IGitService)
], MainThreadGitExtensionService);
export {
  MainThreadGitExtensionService
};
