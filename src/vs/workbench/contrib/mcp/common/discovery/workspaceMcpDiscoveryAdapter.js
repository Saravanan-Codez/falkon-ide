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
import { DisposableMap } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { StorageScope } from "../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { DiscoverySource } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { McpCollectionSortOrder, McpServerTrust } from "../mcpTypes.js";
import { FilesystemMcpDiscovery } from "./nativeMcpDiscoveryAbstract.js";
import { claudeConfigToServerDefinition } from "./nativeMcpDiscoveryAdapters.js";
let CursorWorkspaceMcpDiscoveryAdapter = class extends FilesystemMcpDiscovery {
  constructor(fileService, _workspaceContextService, mcpRegistry, configurationService, _remoteAgentService) {
    super(configurationService, fileService, mcpRegistry);
    this._workspaceContextService = _workspaceContextService;
    this._remoteAgentService = _remoteAgentService;
    this._collections = this._register(new DisposableMap());
  }
  start() {
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders((e) => {
      for (const removed of e.removed) {
        this._collections.deleteAndDispose(removed.uri.toString());
      }
      for (const added of e.added) {
        this.watchFolder(added);
      }
    }));
    for (const folder of this._workspaceContextService.getWorkspace().folders) {
      this.watchFolder(folder);
    }
  }
  watchFolder(folder) {
    const configFile = joinPath(folder.uri, ".cursor", "mcp.json");
    const collection = {
      id: `cursor-workspace.${folder.index}`,
      label: `${folder.name}/.cursor/mcp.json`,
      remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority || null,
      scope: StorageScope.WORKSPACE,
      trustBehavior: McpServerTrust.Kind.TrustedOnNonce,
      serverDefinitions: observableValue(this, []),
      configTarget: ConfigurationTarget.WORKSPACE_FOLDER,
      order: McpCollectionSortOrder.WorkspaceFolder + 1,
      presentation: {
        origin: configFile
      }
    };
    this._collections.set(folder.uri.toString(), this.watchFile(
      URI.joinPath(folder.uri, ".cursor", "mcp.json"),
      collection,
      DiscoverySource.CursorWorkspace,
      async (contents) => {
        const defs = await claudeConfigToServerDefinition(collection.id, contents, folder.uri);
        defs?.forEach((d) => d.roots = [folder.uri]);
        return defs;
      }
    ));
  }
};
CursorWorkspaceMcpDiscoveryAdapter = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IMcpRegistry),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IRemoteAgentService)
], CursorWorkspaceMcpDiscoveryAdapter);
export {
  CursorWorkspaceMcpDiscoveryAdapter
};
