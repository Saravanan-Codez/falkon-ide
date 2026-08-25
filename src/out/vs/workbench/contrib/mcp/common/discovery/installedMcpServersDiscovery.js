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
import { equals } from "../../../../../base/common/arrays.js";
import { Throttler } from "../../../../../base/common/async.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ConfigurationTarget } from "../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { StorageScope } from "../../../../../platform/storage/common/storage.js";
import { getMcpServerMapping } from "../mcpConfigFileUtils.js";
import { mcpConfigurationSection } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { IMcpWorkbenchService, MCP_CONFIGURATION_COLLECTION_ID_PREFIX, McpCollectionDefinition, McpCollectionSortOrder, McpServerDefinition, McpServerLaunch, McpServerTransportType, McpServerTrust } from "../mcpTypes.js";
let InstalledMcpServersDiscovery = class extends Disposable {
  constructor(mcpWorkbenchService, mcpRegistry, textModelService, logService) {
    super();
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.mcpRegistry = mcpRegistry;
    this.textModelService = textModelService;
    this.logService = logService;
    this.fromGallery = true;
    this.collections = this._register(new DisposableMap());
  }
  start() {
    const throttler = this._register(new Throttler());
    this._register(this.mcpWorkbenchService.onChange(() => throttler.queue(() => this.sync())));
    this.sync();
  }
  async getServerIdMapping(resource, pathToServers) {
    const store = new DisposableStore();
    try {
      const ref = await this.textModelService.createModelReference(resource);
      store.add(ref);
      const serverIdMapping = getMcpServerMapping({ model: ref.object.textEditorModel, pathToServers });
      return serverIdMapping;
    } catch {
      return /* @__PURE__ */ new Map();
    } finally {
      store.dispose();
    }
  }
  async sync() {
    try {
      const collections = /* @__PURE__ */ new Map();
      const mcpConfigPathInfos = new ResourceMap();
      for (const server of this.mcpWorkbenchService.getEnabledLocalMcpServers()) {
        let mcpConfigPathPromise = mcpConfigPathInfos.get(server.mcpResource);
        if (!mcpConfigPathPromise) {
          mcpConfigPathPromise = (async (local) => {
            const mcpConfigPath2 = this.mcpWorkbenchService.getMcpConfigPath(local);
            const locations = mcpConfigPath2?.uri ? await this.getServerIdMapping(mcpConfigPath2?.uri, mcpConfigPath2.section ? [...mcpConfigPath2.section, "servers"] : ["servers"]) : /* @__PURE__ */ new Map();
            return mcpConfigPath2 ? { ...mcpConfigPath2, locations } : void 0;
          })(server);
          mcpConfigPathInfos.set(server.mcpResource, mcpConfigPathPromise);
        }
        const config = server.config;
        const mcpConfigPath = await mcpConfigPathPromise;
        const collectionId = `${MCP_CONFIGURATION_COLLECTION_ID_PREFIX}${mcpConfigPath ? mcpConfigPath.id : "unknown"}`;
        let definitions = collections.get(collectionId);
        if (!definitions) {
          definitions = [mcpConfigPath, []];
          collections.set(collectionId, definitions);
        }
        const launch = config.type === "http" ? {
          type: McpServerTransportType.HTTP,
          uri: URI.parse(config.url),
          headers: Object.entries(config.headers || {}),
          oauth: config.oauth
        } : {
          type: McpServerTransportType.Stdio,
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          envFile: config.envFile,
          cwd: config.cwd,
          sandbox: server.rootSandbox
        };
        definitions[1].push({
          id: `${collectionId}.${server.name}`,
          label: server.name,
          launch,
          sandboxEnabled: config.type === "http" ? void 0 : config.sandboxEnabled,
          cacheNonce: await McpServerLaunch.hash(launch),
          roots: mcpConfigPath?.workspaceFolder ? [mcpConfigPath.workspaceFolder.uri] : void 0,
          variableReplacement: {
            folder: mcpConfigPath?.workspaceFolder,
            section: mcpConfigurationSection,
            target: mcpConfigPath?.target ?? ConfigurationTarget.USER
          },
          devMode: config.dev,
          presentation: {
            order: mcpConfigPath?.order,
            origin: mcpConfigPath?.locations.get(server.name)
          }
        });
      }
      for (const [id] of this.collections) {
        if (!collections.has(id)) {
          this.collections.deleteAndDispose(id);
        }
      }
      for (const [id, [mcpConfigPath, serverDefinitions]] of collections) {
        const newServerDefinitions = observableValue(this, serverDefinitions);
        const newCollection = {
          id,
          label: mcpConfigPath?.label ?? "",
          order: mcpConfigPath?.order ?? McpCollectionSortOrder.User,
          presentation: {
            origin: mcpConfigPath?.uri
          },
          remoteAuthority: mcpConfigPath?.remoteAuthority ?? null,
          serverDefinitions: newServerDefinitions,
          trustBehavior: McpServerTrust.Kind.Trusted,
          configTarget: mcpConfigPath?.target ?? ConfigurationTarget.USER,
          scope: mcpConfigPath?.scope ?? StorageScope.PROFILE
        };
        const existingCollection = this.collections.get(id);
        const collectionDefinitionsChanged = existingCollection ? !McpCollectionDefinition.equals(existingCollection.definition, newCollection) : true;
        if (!collectionDefinitionsChanged) {
          const serverDefinitionsChanged = existingCollection ? !equals(existingCollection.definition.serverDefinitions.get(), newCollection.serverDefinitions.get(), McpServerDefinition.equals) : true;
          if (serverDefinitionsChanged) {
            existingCollection?.serverDefinitions.set(serverDefinitions, void 0);
          }
          continue;
        }
        this.collections.deleteAndDispose(id);
        const disposable = this.mcpRegistry.registerCollection(newCollection);
        this.collections.set(id, {
          definition: newCollection,
          serverDefinitions: newServerDefinitions,
          dispose: () => disposable.dispose()
        });
      }
    } catch (error) {
      this.logService.error(error);
    }
  }
};
InstalledMcpServersDiscovery = __decorateClass([
  __decorateParam(0, IMcpWorkbenchService),
  __decorateParam(1, IMcpRegistry),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ILogService)
], InstalledMcpServersDiscovery);
export {
  InstalledMcpServersDiscovery
};
