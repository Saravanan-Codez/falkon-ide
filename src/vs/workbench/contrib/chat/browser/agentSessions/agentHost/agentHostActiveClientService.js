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
import { Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { Delayer } from "../../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../../base/common/errors.js";
import { Event } from "../../../../../../base/common/event.js";
import { equals } from "../../../../../../base/common/objects.js";
import { autorun, derived, observableValue } from "../../../../../../base/common/observable.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { AgentHostCopilotMultiRootEnabledSettingId } from "../../../../../../platform/agentHost/common/agentService.js";
import { IAgentPluginService } from "../../../common/plugins/agentPluginService.js";
import { IPromptsService } from "../../../common/promptSyntax/service/promptsService.js";
import { ILanguageModelToolsService } from "../../../common/tools/languageModelToolsService.js";
import { IMcpService } from "../../../../mcp/common/mcpTypes.js";
import { IConfigurationResolverService } from "../../../../../services/configurationResolver/common/configurationResolver.js";
import { AgentCustomizationSyncProvider } from "./agentCustomizationSyncProvider.js";
import { resolveCustomizationRefs, resolveLocalCustomAgents, shouldSyncWorkspaceDotMcp } from "./agentHostLocalCustomizations.js";
import { toolDataToDefinition } from "./agentHostToolUtils.js";
import { IAgentHostToolSetEnablementService, isToolEnabledInSet } from "./agentHostToolSetEnablementService.js";
import { SyncedCustomizationBundler } from "./syncedCustomizationBundler.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
const IAgentHostActiveClientService = createDecorator("agentHostActiveClientService");
let AgentHostActiveClientService = class extends Disposable {
  constructor(_toolsService, _promptsService, _agentPluginService, _storageService, _instantiationService, _fileService, _mcpService, _configurationResolverService, _toolSetEnablementService, _workspaceContextService, _configurationService) {
    super();
    this._toolsService = _toolsService;
    this._promptsService = _promptsService;
    this._agentPluginService = _agentPluginService;
    this._storageService = _storageService;
    this._instantiationService = _instantiationService;
    this._fileService = _fileService;
    this._mcpService = _mcpService;
    this._configurationResolverService = _configurationResolverService;
    this._toolSetEnablementService = _toolSetEnablementService;
    this._workspaceContextService = _workspaceContextService;
    this._configurationService = _configurationService;
    /** Cached per-`sessionType` advertised-tools observable, so callers (e.g. autoruns) reuse one stable derived. */
    this._clientToolsByType = /* @__PURE__ */ new Map();
    this._customizationsByType = observableValue("agentHostCustomizationsByType", /* @__PURE__ */ new Map());
    this._customAgentsByType = observableValue("agentHostCustomAgentsByType", /* @__PURE__ */ new Map());
    this._allToolsObs = this._toolsService.observeTools(void 0);
    this._allToolSetsObs = this._toolsService.toolSets;
  }
  registerForAgent(sessionType, options) {
    const store = new DisposableStore();
    const syncProvider = store.add(new AgentCustomizationSyncProvider(sessionType, this._storageService));
    const bundler = store.add(this._instantiationService.createInstance(SyncedCustomizationBundler, sessionType));
    const customizations = observableValue("agentCustomizations", []);
    const customAgents = observableValue("agentCustomAgents", []);
    const shouldIncludeWorkspaceDotMcp = () => shouldSyncWorkspaceDotMcp(
      sessionType,
      this._workspaceContextService.getWorkspace().folders.length,
      this._configurationService.getValue(AgentHostCopilotMultiRootEnabledSettingId) === true
    );
    let updateSeq = 0;
    const updateCustomizations = async () => {
      const seq = ++updateSeq;
      try {
        const [refs, agents] = await Promise.all([
          resolveCustomizationRefs(this._fileService, this._promptsService, syncProvider, this._agentPluginService, this._mcpService, this._configurationResolverService, bundler, sessionType, shouldIncludeWorkspaceDotMcp(), options),
          resolveLocalCustomAgents(this._fileService, this._promptsService, syncProvider, this._agentPluginService, sessionType, options)
        ]);
        if (seq !== updateSeq) {
          return;
        }
        if (!equals(customizations.get(), refs)) {
          customizations.set(refs, void 0);
        }
        if (!equals(customAgents.get(), agents)) {
          customAgents.set(agents, void 0);
        }
      } catch (err) {
        onUnexpectedError(err);
      }
    };
    const updateDelayer = store.add(new Delayer(CUSTOMIZATION_UPDATE_DEBOUNCE_DELAY));
    const scheduleUpdate = () => {
      updateDelayer.trigger(() => updateCustomizations()).catch(() => {
      });
    };
    store.add(syncProvider.onDidChange(() => scheduleUpdate()));
    store.add(Event.any(
      this._promptsService.onDidChangeCustomAgents,
      this._promptsService.onDidChangeSlashCommands,
      this._promptsService.onDidChangeSkills,
      this._promptsService.onDidChangeInstructions
    )(() => scheduleUpdate()));
    store.add(autorun((reader) => {
      for (const plugin of this._agentPluginService.plugins.read(reader)) {
        plugin.enablement.read(reader);
        plugin.hooks.read(reader);
        plugin.commands.read(reader);
        plugin.skills.read(reader);
        plugin.agents.read(reader);
        plugin.instructions.read(reader);
        plugin.mcpServerDefinitions.read(reader);
      }
      scheduleUpdate();
    }));
    store.add(autorun((reader) => {
      for (const server of this._mcpService.servers.read(reader)) {
        server.enablement.read(reader);
        server.readDefinitions().read(reader);
      }
      scheduleUpdate();
    }));
    store.add(this._workspaceContextService.onDidChangeWorkspaceFolders(() => scheduleUpdate()));
    store.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AgentHostCopilotMultiRootEnabledSettingId)) {
        scheduleUpdate();
      }
    }));
    store.add(this._setCustomizations(sessionType, customizations));
    store.add(this._setCustomAgents(sessionType, customAgents));
    return {
      syncProvider,
      bundler,
      dispose: () => store.dispose()
    };
  }
  _setCustomAgents(sessionType, customAgents) {
    const next = new Map(this._customAgentsByType.get());
    next.set(sessionType, customAgents);
    this._customAgentsByType.set(next, void 0);
    return toDisposable(() => {
      const current = this._customAgentsByType.get();
      if (current.get(sessionType) !== customAgents) {
        return;
      }
      const removed = new Map(current);
      removed.delete(sessionType);
      this._customAgentsByType.set(removed, void 0);
    });
  }
  _setCustomizations(sessionType, customizations) {
    const next = new Map(this._customizationsByType.get());
    next.set(sessionType, customizations);
    this._customizationsByType.set(next, void 0);
    return toDisposable(() => {
      const current = this._customizationsByType.get();
      if (current.get(sessionType) !== customizations) {
        return;
      }
      const removed = new Map(current);
      removed.delete(sessionType);
      this._customizationsByType.set(removed, void 0);
    });
  }
  getActiveClient(sessionType, clientId) {
    return {
      clientId,
      tools: [...this.getClientTools(sessionType).get()],
      customizations: [...this._customizationsByType.get().get(sessionType)?.get() ?? []]
    };
  }
  getCustomizations(sessionType) {
    return derived((reader) => this._customizationsByType.read(reader).get(sessionType)?.read(reader) ?? EMPTY_CUSTOMIZATIONS);
  }
  getCustomAgents(sessionType) {
    return derived((reader) => this._customAgentsByType.read(reader).get(sessionType)?.read(reader) ?? EMPTY_CUSTOM_AGENTS);
  }
  getClientTools(sessionType) {
    let obs = this._clientToolsByType.get(sessionType);
    if (!obs) {
      obs = derived((reader) => {
        const tools = this._allToolsObs.read(reader);
        const toolSets = this._allToolSetsObs.read(reader);
        const enablement = this._toolSetEnablementService.observe(sessionType).read(reader);
        const enabledToolIds = /* @__PURE__ */ new Set();
        for (const ts of toolSets) {
          if (ts.deprecated) {
            continue;
          }
          for (const tool of ts.getTools(reader)) {
            if (isToolEnabledInSet(enablement, ts.id, tool.id)) {
              enabledToolIds.add(tool.id);
            }
          }
        }
        return tools.filter((t) => enabledToolIds.has(t.id)).map(toolDataToDefinition);
      });
      this._clientToolsByType.set(sessionType, obs);
    }
    return obs;
  }
};
AgentHostActiveClientService = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, IPromptsService),
  __decorateParam(2, IAgentPluginService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IMcpService),
  __decorateParam(7, IConfigurationResolverService),
  __decorateParam(8, IAgentHostToolSetEnablementService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IConfigurationService)
], AgentHostActiveClientService);
const EMPTY_CUSTOMIZATIONS = Object.freeze([]);
const EMPTY_CUSTOM_AGENTS = Object.freeze([]);
const CUSTOMIZATION_UPDATE_DEBOUNCE_DELAY = 50;
registerSingleton(IAgentHostActiveClientService, AgentHostActiveClientService, InstantiationType.Delayed);
export {
  AgentHostActiveClientService,
  IAgentHostActiveClientService
};
