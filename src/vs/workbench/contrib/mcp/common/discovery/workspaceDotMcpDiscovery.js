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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { ConfigurationTarget } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { StorageScope } from "../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { McpCollectionSortOrder, McpServerTrust, WORKSPACE_DOT_MCP_COLLECTION_ID_PREFIX } from "../mcpTypes.js";
import { claudeConfigToServerDefinition } from "./nativeMcpDiscoveryAdapters.js";
let WorkspaceDotMcpDiscovery = class extends Disposable {
  constructor(_fileService, _workspaceContextService, _mcpRegistry, _remoteAgentService) {
    super();
    this._fileService = _fileService;
    this._workspaceContextService = _workspaceContextService;
    this._mcpRegistry = _mcpRegistry;
    this._remoteAgentService = _remoteAgentService;
    this.fromGallery = false;
    this._collections = this._register(new DisposableMap());
  }
  start() {
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders((e) => {
      for (const removed of e.removed) {
        this._collections.deleteAndDispose(removed.uri.toString());
      }
      for (const added of e.added) {
        this._watchFolder(added);
      }
    }));
    for (const folder of this._workspaceContextService.getWorkspace().folders) {
      this._watchFolder(folder);
    }
  }
  _watchFolder(folder) {
    const configFile = joinPath(folder.uri, ".mcp.json");
    const collectionId = `${WORKSPACE_DOT_MCP_COLLECTION_ID_PREFIX}${folder.index}`;
    const serverDefinitions = observableValue(this, []);
    const collection = {
      id: collectionId,
      label: `${folder.name}/.mcp.json`,
      remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority || null,
      scope: StorageScope.WORKSPACE,
      trustBehavior: McpServerTrust.Kind.TrustedOnNonce,
      serverDefinitions,
      configTarget: ConfigurationTarget.WORKSPACE_FOLDER,
      order: McpCollectionSortOrder.WorkspaceFolder + 1,
      presentation: {
        origin: configFile
      }
    };
    const store = new DisposableStore();
    const collectionRegistration = store.add(new MutableDisposable());
    const updateFile = async () => {
      let definitions = [];
      try {
        const contents = await this._fileService.readFile(configFile);
        const defs = await claudeConfigToServerDefinition(collectionId, contents.value, folder.uri);
        if (defs) {
          for (const d of defs) {
            d.roots = [folder.uri];
          }
          definitions = defs;
        }
      } catch {
      }
      if (!definitions.length) {
        collectionRegistration.clear();
      } else {
        serverDefinitions.set(definitions, void 0);
        if (!collectionRegistration.value) {
          collectionRegistration.value = this._mcpRegistry.registerCollection(collection);
        }
      }
    };
    const throttler = store.add(new RunOnceScheduler(updateFile, 500));
    const watcher = store.add(this._fileService.createWatcher(configFile, { recursive: false, excludes: [] }));
    store.add(watcher.onDidChange(() => throttler.schedule()));
    updateFile();
    this._collections.set(folder.uri.toString(), store);
  }
};
WorkspaceDotMcpDiscovery = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IMcpRegistry),
  __decorateParam(3, IRemoteAgentService)
], WorkspaceDotMcpDiscovery);
export {
  WorkspaceDotMcpDiscovery
};
