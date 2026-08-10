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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostExtensionService } from "./extHostExtensionService.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { GitRefTypeDto, MainContext } from "./extHost.protocol.js";
import { ResourceMap } from "../../../base/common/map.js";
const GIT_EXTENSION_ID = "vscode.git";
function toGitRefTypeDto(type) {
  switch (type) {
    case 0 /* Head */:
      return GitRefTypeDto.Head;
    case 1 /* RemoteHead */:
      return GitRefTypeDto.RemoteHead;
    case 2 /* Tag */:
      return GitRefTypeDto.Tag;
    default:
      throw new Error(`Unknown GitRefType: ${type}`);
  }
}
function toGitBranchDto(branch) {
  return {
    name: branch.name,
    commit: branch.commit,
    type: toGitRefTypeDto(branch.type),
    remote: branch.remote,
    upstream: branch.upstream ? toGitUpstreamRefDto(branch.upstream) : void 0,
    ahead: branch.ahead,
    behind: branch.behind
  };
}
function toGitUpstreamRefDto(upstream) {
  return {
    remote: upstream.remote,
    name: upstream.name,
    commit: upstream.commit
  };
}
var GitStatus = /* @__PURE__ */ ((GitStatus2) => {
  GitStatus2[GitStatus2["INDEX_ADDED"] = 1] = "INDEX_ADDED";
  GitStatus2[GitStatus2["INDEX_DELETED"] = 2] = "INDEX_DELETED";
  GitStatus2[GitStatus2["INDEX_RENAMED"] = 3] = "INDEX_RENAMED";
  GitStatus2[GitStatus2["MODIFIED"] = 5] = "MODIFIED";
  GitStatus2[GitStatus2["DELETED"] = 6] = "DELETED";
  GitStatus2[GitStatus2["UNTRACKED"] = 7] = "UNTRACKED";
  GitStatus2[GitStatus2["INTENT_TO_ADD"] = 9] = "INTENT_TO_ADD";
  GitStatus2[GitStatus2["INTENT_TO_RENAME"] = 10] = "INTENT_TO_RENAME";
  return GitStatus2;
})(GitStatus || {});
function toGitChangeDto(change) {
  switch (change.status) {
    // Added: no original
    case 1 /* INDEX_ADDED */:
    case 7 /* UNTRACKED */:
    case 9 /* INTENT_TO_ADD */:
      return { uri: change.uri, originalUri: void 0, modifiedUri: change.uri };
    // Deleted: no modified
    case 2 /* INDEX_DELETED */:
    case 6 /* DELETED */:
      return { uri: change.uri, originalUri: change.uri, modifiedUri: void 0 };
    // Renamed: original is old name, modified is new name
    case 3 /* INDEX_RENAMED */:
    case 10 /* INTENT_TO_RENAME */:
      return { uri: change.uri, originalUri: change.originalUri, modifiedUri: change.renameUri };
    // Modified and everything else: both original and modified
    default:
      return { uri: change.uri, originalUri: change.originalUri, modifiedUri: change.uri };
  }
}
var GitRefType = /* @__PURE__ */ ((GitRefType2) => {
  GitRefType2[GitRefType2["Head"] = 0] = "Head";
  GitRefType2[GitRefType2["RemoteHead"] = 1] = "RemoteHead";
  GitRefType2[GitRefType2["Tag"] = 2] = "Tag";
  return GitRefType2;
})(GitRefType || {});
const IExtHostGitExtensionService = createDecorator("IExtHostGitExtensionService");
let ExtHostGitExtensionService = class extends Disposable {
  constructor(extHostRpc, _extHostExtensionService) {
    super();
    this._extHostExtensionService = _extHostExtensionService;
    this._repositories = /* @__PURE__ */ new Map();
    this._repositoryByUri = new ResourceMap();
    this._repositoryStateChangeListeners = new DisposableMap();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadGitExtension);
  }
  static {
    this._handlePool = 0;
  }
  async $isGitExtensionAvailable() {
    const registry = await this._extHostExtensionService.getExtensionRegistry();
    return !!registry.getExtensionDescription(GIT_EXTENSION_ID);
  }
  async $openRepository(uri) {
    const api = await this._ensureGitApi();
    if (!api) {
      return void 0;
    }
    const repository = await api.openRepository(URI.revive(uri));
    if (!repository) {
      return void 0;
    }
    const existingHandle = this._repositoryByUri.get(repository.rootUri);
    if (existingHandle !== void 0) {
      if (this._repositories.get(existingHandle) !== repository) {
        this._repositories.set(existingHandle, repository);
        this._repositoryByUri.set(repository.rootUri, existingHandle);
        this._setRepositoryStateChangeListener(existingHandle, repository);
      }
      const state2 = this._getRepositoryState(repository);
      return { handle: existingHandle, rootUri: repository.rootUri, state: state2 };
    }
    const handle = ExtHostGitExtensionService._handlePool++;
    this._repositories.set(handle, repository);
    this._repositoryByUri.set(repository.rootUri, handle);
    this._setRepositoryStateChangeListener(handle, repository);
    const state = this._getRepositoryState(repository);
    return { handle, rootUri: repository.rootUri, state };
  }
  async $getRefs(handle, query, token) {
    const repository = this._repositories.get(handle);
    if (!repository) {
      return [];
    }
    try {
      const refs = await repository.getRefs(query, token);
      const result = refs.map((ref) => {
        if (!ref.name || !ref.commit) {
          return void 0;
        }
        const id = ref.type === 0 /* Head */ ? `refs/heads/${ref.name}` : ref.type === 1 /* RemoteHead */ ? `refs/remotes/${ref.remote}/${ref.name}` : `refs/tags/${ref.name}`;
        return {
          id,
          name: ref.name,
          type: toGitRefTypeDto(ref.type),
          revision: ref.commit
        };
      });
      return result.filter((ref) => !!ref);
    } catch {
      return [];
    }
  }
  async $getRepositoryState(handle) {
    const repository = this._repositories.get(handle);
    if (!repository) {
      return void 0;
    }
    return this._getRepositoryState(repository);
  }
  _getRepositoryState(repository) {
    const state = repository.state;
    return {
      HEAD: state.HEAD ? toGitBranchDto(state.HEAD) : void 0,
      remotes: state.remotes,
      mergeChanges: state.mergeChanges.map(toGitChangeDto),
      indexChanges: state.indexChanges.map(toGitChangeDto),
      workingTreeChanges: state.workingTreeChanges.map(toGitChangeDto),
      untrackedChanges: state.untrackedChanges.map(toGitChangeDto)
    };
  }
  _setRepositoryStateChangeListener(handle, repository) {
    this._repositoryStateChangeListeners.set(handle, repository.state.onDidChange(() => {
      this._proxy.$onDidChangeRepository(handle);
    }));
  }
  async $diffBetweenWithStats(handle, ref1, ref2, path) {
    const repository = this._repositories.get(handle);
    if (!repository) {
      return [];
    }
    try {
      const changes = await repository.diffBetweenWithStats(ref1, ref2, path);
      return changes.map((c) => ({
        ...toGitChangeDto(c),
        insertions: c.insertions,
        deletions: c.deletions
      }));
    } catch {
      return [];
    }
  }
  async $diffBetweenWithStats2(handle, ref, path) {
    const repository = this._repositories.get(handle);
    if (!repository) {
      return [];
    }
    try {
      const changes = await repository.diffBetweenWithStats2(ref, path);
      return changes.map((c) => ({
        ...toGitChangeDto(c),
        insertions: c.insertions,
        deletions: c.deletions
      }));
    } catch {
      return [];
    }
  }
  async _ensureGitApi() {
    if (this._gitApi) {
      return this._gitApi;
    }
    try {
      await this._extHostExtensionService.activateByIdWithErrors(
        new ExtensionIdentifier(GIT_EXTENSION_ID),
        { startup: false, extensionId: new ExtensionIdentifier(GIT_EXTENSION_ID), activationEvent: "api" }
      );
      const exports = this._extHostExtensionService.getExtensionExports(new ExtensionIdentifier(GIT_EXTENSION_ID));
      if (!!exports && typeof exports.getAPI === "function") {
        this._gitApi = exports.getAPI(1);
      }
    } catch {
    }
    return this._gitApi;
  }
  dispose() {
    this._repositoryStateChangeListeners.dispose();
    super.dispose();
  }
};
ExtHostGitExtensionService = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostExtensionService)
], ExtHostGitExtensionService);
export {
  ExtHostGitExtensionService,
  IExtHostGitExtensionService
};
