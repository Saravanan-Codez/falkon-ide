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
import { distinct } from "../../../../base/common/arrays.js";
import { sequence } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import * as json from "../../../../base/common/json.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import * as resources from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI as uri } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { OS } from "../../../../base/common/platform.js";
import { launchSchemaId } from "../../../services/configuration/common/configuration.js";
import { ACTIVE_GROUP, IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { CONTEXT_DEBUG_CONFIGURATION_TYPE, DebugConfigurationProviderTriggerKind, isDebugConfig } from "../common/debug.js";
import { launchSchema } from "../common/debugSchemas.js";
import { getEffectiveConfigForPlatform, getVisibleAndSorted } from "../common/debugUtils.js";
import { debugConfigure } from "./debugIcons.js";
const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
jsonRegistry.registerSchema(launchSchemaId, launchSchema);
const DEBUG_SELECTED_CONFIG_NAME_KEY = "debug.selectedconfigname";
const DEBUG_SELECTED_ROOT = "debug.selectedroot";
const DEBUG_SELECTED_TYPE = "debug.selectedtype";
const DEBUG_RECENT_DYNAMIC_CONFIGURATIONS = "debug.recentdynamicconfigurations";
const ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME = "onDebugDynamicConfigurations";
let ConfigurationManager = class {
  constructor(adapterManager, contextService, configurationService, quickInputService, instantiationService, storageService, extensionService, historyService, uriIdentityService, remoteAgentService, contextKeyService, logService) {
    this.adapterManager = adapterManager;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.historyService = historyService;
    this.uriIdentityService = uriIdentityService;
    this.remoteAgentService = remoteAgentService;
    this.logService = logService;
    this.getSelectedConfig = () => Promise.resolve(void 0);
    this.selectedDynamic = false;
    this._onDidSelectConfigurationName = new Emitter();
    this._onDidChangeConfigurationProviders = new Emitter();
    this.onDidChangeConfigurationProviders = this._onDidChangeConfigurationProviders.event;
    this.targetOperatingSystem = OS;
    this.configProviders = [];
    this.toDispose = [this._onDidChangeConfigurationProviders, this._onDidSelectConfigurationName];
    this.initLaunches();
    this.setCompoundSchemaValues();
    this.registerListeners();
    const previousSelectedRoot = this.storageService.get(DEBUG_SELECTED_ROOT, StorageScope.WORKSPACE);
    const previousSelectedType = this.storageService.get(DEBUG_SELECTED_TYPE, StorageScope.WORKSPACE);
    const previousSelectedLaunch = this.launches.find((l) => l.uri.toString() === previousSelectedRoot);
    const previousSelectedName = this.storageService.get(DEBUG_SELECTED_CONFIG_NAME_KEY, StorageScope.WORKSPACE);
    this.debugConfigurationTypeContext = CONTEXT_DEBUG_CONFIGURATION_TYPE.bindTo(contextKeyService);
    const dynamicConfig = previousSelectedType ? { type: previousSelectedType } : void 0;
    if (previousSelectedLaunch && previousSelectedLaunch.getConfigurationNames().length) {
      this.selectConfiguration(previousSelectedLaunch, previousSelectedName, void 0, dynamicConfig);
    } else if (this.launches.length > 0) {
      this.selectConfiguration(void 0, previousSelectedName, void 0, dynamicConfig);
    }
    this.resolveTargetOperatingSystem();
  }
  resolveTargetOperatingSystem() {
    this.remoteAgentService.getEnvironment().then((environment) => {
      const targetOperatingSystem = environment?.os ?? OS;
      if (this.targetOperatingSystem !== targetOperatingSystem) {
        this.targetOperatingSystem = targetOperatingSystem;
        this._onDidSelectConfigurationName.fire();
      }
    }, () => {
    });
  }
  getTargetOperatingSystem() {
    return this.targetOperatingSystem;
  }
  registerDebugConfigurationProvider(debugConfigurationProvider) {
    this.configProviders.push(debugConfigurationProvider);
    this._onDidChangeConfigurationProviders.fire();
    return {
      dispose: () => {
        this.unregisterDebugConfigurationProvider(debugConfigurationProvider);
        this._onDidChangeConfigurationProviders.fire();
      }
    };
  }
  unregisterDebugConfigurationProvider(debugConfigurationProvider) {
    const ix = this.configProviders.indexOf(debugConfigurationProvider);
    if (ix >= 0) {
      this.configProviders.splice(ix, 1);
    }
  }
  /**
   * if scope is not specified,a value of DebugConfigurationProvideTrigger.Initial is assumed.
   */
  hasDebugConfigurationProvider(debugType, triggerKind) {
    if (triggerKind === void 0) {
      triggerKind = DebugConfigurationProviderTriggerKind.Initial;
    }
    const provider = this.configProviders.find((p) => p.provideDebugConfigurations && p.type === debugType && p.triggerKind === triggerKind);
    return !!provider;
  }
  async resolveConfigurationByProviders(folderUri, type, config, token) {
    const resolveDebugConfigurationForType = async (type2, config2) => {
      if (type2 !== "*") {
        await this.adapterManager.activateDebuggers("onDebugResolve", type2);
      }
      for (const p of this.configProviders) {
        if (p.type === type2 && p.resolveDebugConfiguration && config2) {
          config2 = await p.resolveDebugConfiguration(folderUri, config2, token);
        }
      }
      return config2;
    };
    let resolvedType = config.type ?? type;
    let result = config;
    for (let seen = /* @__PURE__ */ new Set(); result && !seen.has(resolvedType); ) {
      seen.add(resolvedType);
      result = await resolveDebugConfigurationForType(resolvedType, result);
      result = await resolveDebugConfigurationForType("*", result);
      resolvedType = result?.type ?? type;
    }
    return result;
  }
  async resolveDebugConfigurationWithSubstitutedVariables(folderUri, type, config, token) {
    const providers = this.configProviders.filter((p) => p.type === type && p.resolveDebugConfigurationWithSubstitutedVariables).concat(this.configProviders.filter((p) => p.type === "*" && p.resolveDebugConfigurationWithSubstitutedVariables));
    let result = config;
    await sequence(providers.map((provider) => async () => {
      if (result) {
        result = await provider.resolveDebugConfigurationWithSubstitutedVariables(folderUri, result, token);
      }
    }));
    return result;
  }
  async provideDebugConfigurations(folderUri, type, token) {
    await this.adapterManager.activateDebuggers("onDebugInitialConfigurations");
    const results = await Promise.all(this.configProviders.filter((p) => p.type === type && p.triggerKind === DebugConfigurationProviderTriggerKind.Initial && p.provideDebugConfigurations).map((p) => p.provideDebugConfigurations(folderUri, token)));
    return results.reduce((first, second) => first.concat(second), []);
  }
  async getDynamicProviders() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const debugDynamicExtensionsTypes = this.extensionService.extensions.reduce((acc, e) => {
      if (!e.activationEvents) {
        return acc;
      }
      const explicitTypes = [];
      let hasGenericEvent = false;
      for (const event of e.activationEvents) {
        if (event === ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME) {
          hasGenericEvent = true;
        } else if (event.startsWith(`${ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME}:`)) {
          explicitTypes.push(event.slice(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME.length + 1));
        }
      }
      if (explicitTypes.length) {
        explicitTypes.forEach((t) => acc.add(t));
      } else if (hasGenericEvent) {
        const debuggerType = e.contributes?.debuggers?.[0].type;
        if (debuggerType) {
          acc.add(debuggerType);
        }
      }
      return acc;
    }, /* @__PURE__ */ new Set());
    for (const configProvider of this.configProviders) {
      if (configProvider.triggerKind === DebugConfigurationProviderTriggerKind.Dynamic) {
        debugDynamicExtensionsTypes.add(configProvider.type);
      }
    }
    return [...debugDynamicExtensionsTypes].map((type) => {
      return {
        label: this.adapterManager.getDebuggerLabel(type),
        getProvider: async () => {
          await this.adapterManager.activateDebuggers(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME, type);
          return this.configProviders.find((p) => p.type === type && p.triggerKind === DebugConfigurationProviderTriggerKind.Dynamic && p.provideDebugConfigurations);
        },
        type,
        pick: async () => {
          await this.adapterManager.activateDebuggers(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME, type);
          const disposables = new DisposableStore();
          const token = new CancellationTokenSource();
          disposables.add(token);
          const input = disposables.add(this.quickInputService.createQuickPick());
          input.busy = true;
          input.placeholder = nls.localize("selectConfiguration", "Select Launch Configuration");
          const chosenPromise = new Promise((resolve) => {
            disposables.add(input.onDidAccept(() => resolve(input.activeItems[0])));
            disposables.add(input.onDidTriggerItemButton(async (context) => {
              resolve(void 0);
              const { launch, config } = context.item;
              await launch.openConfigFile({ preserveFocus: false, type: config.type, suppressInitialConfigs: true });
              await launch.writeConfiguration(config);
              await this.selectConfiguration(launch, config.name);
              this.removeRecentDynamicConfigurations(config.name, config.type);
            }));
            disposables.add(input.onDidHide(() => resolve(void 0)));
          }).finally(() => token.cancel());
          let items;
          try {
            items = await this.getDynamicConfigurationsByType(type, token.token);
          } catch (err) {
            this.logService.error(err);
            disposables.dispose();
            return;
          }
          input.items = items;
          input.busy = false;
          input.show();
          const chosen = await chosenPromise;
          disposables.dispose();
          return chosen;
        }
      };
    });
  }
  async getDynamicConfigurationsByType(type, token = CancellationToken.None) {
    await this.adapterManager.activateDebuggers(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME, type);
    const picks = [];
    const provider = this.configProviders.find((p) => p.type === type && p.triggerKind === DebugConfigurationProviderTriggerKind.Dynamic && p.provideDebugConfigurations);
    this.getLaunches().forEach((launch) => {
      if (provider) {
        picks.push(provider.provideDebugConfigurations(launch.workspace?.uri, token).then((configurations) => configurations.map((config) => ({
          label: config.name,
          description: launch.name,
          config,
          buttons: [{
            iconClass: ThemeIcon.asClassName(debugConfigure),
            tooltip: nls.localize("editLaunchConfig", "Edit Debug Configuration in launch.json")
          }],
          launch
        }))));
      }
    });
    return (await Promise.all(picks)).flat();
  }
  getAllConfigurations() {
    const all = [];
    for (const l of this.launches) {
      for (const name of l.getConfigurationNames()) {
        const config = l.getConfiguration(name) || l.getCompound(name);
        if (config) {
          all.push({ launch: l, name, presentation: config.presentation });
        }
      }
    }
    return getVisibleAndSorted(all);
  }
  removeRecentDynamicConfigurations(name, type) {
    const remaining = this.getRecentDynamicConfigurations().filter((c) => c.name !== name || c.type !== type);
    this.storageService.store(DEBUG_RECENT_DYNAMIC_CONFIGURATIONS, JSON.stringify(remaining), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    if (this.selectedConfiguration.name === name && this.selectedType === type && this.selectedDynamic) {
      this.selectConfiguration(void 0, void 0);
    } else {
      this._onDidSelectConfigurationName.fire();
    }
  }
  getRecentDynamicConfigurations() {
    return JSON.parse(this.storageService.get(DEBUG_RECENT_DYNAMIC_CONFIGURATIONS, StorageScope.WORKSPACE, "[]"));
  }
  registerListeners() {
    this.toDispose.push(Event.any(this.contextService.onDidChangeWorkspaceFolders, this.contextService.onDidChangeWorkbenchState)(() => {
      this.initLaunches();
      this.selectConfiguration(void 0);
      this.setCompoundSchemaValues();
    }));
    this.toDispose.push(this.configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("launch")) {
        await this.selectConfiguration(void 0);
        this.setCompoundSchemaValues();
      }
    }));
    this.toDispose.push(this.adapterManager.onDidDebuggersExtPointRead(() => {
      this.setCompoundSchemaValues();
    }));
  }
  initLaunches() {
    this.launches = this.contextService.getWorkspace().folders.map((folder) => this.instantiationService.createInstance(Launch, this, this.adapterManager, folder));
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      this.launches.push(this.instantiationService.createInstance(WorkspaceLaunch, this, this.adapterManager));
    }
    this.launches.push(this.instantiationService.createInstance(UserLaunch, this, this.adapterManager));
    if (this.selectedLaunch && this.launches.indexOf(this.selectedLaunch) === -1) {
      this.selectConfiguration(void 0);
    }
  }
  setCompoundSchemaValues() {
    const compoundConfigurationsSchema = launchSchema.properties["compounds"].items.properties["configurations"];
    const launchNames = this.launches.map((l) => l.getConfigurationNames(true)).reduce((first, second) => first.concat(second), []);
    compoundConfigurationsSchema.items.oneOf[0].enum = launchNames;
    compoundConfigurationsSchema.items.oneOf[1].properties.name.enum = launchNames;
    const folderNames = this.contextService.getWorkspace().folders.map((f) => f.name);
    compoundConfigurationsSchema.items.oneOf[1].properties.folder.enum = folderNames;
    jsonRegistry.registerSchema(launchSchemaId, launchSchema);
  }
  getLaunches() {
    return this.launches;
  }
  getLaunch(workspaceUri) {
    if (!uri.isUri(workspaceUri)) {
      return void 0;
    }
    return this.launches.find((l) => l.workspace && this.uriIdentityService.extUri.isEqual(l.workspace.uri, workspaceUri));
  }
  get selectedConfiguration() {
    return {
      launch: this.selectedLaunch,
      name: this.selectedName,
      getConfig: this.getSelectedConfig,
      type: this.selectedType
    };
  }
  get onDidSelectConfiguration() {
    return this._onDidSelectConfigurationName.event;
  }
  getWorkspaceLaunch() {
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      return this.launches[this.launches.length - 1];
    }
    return void 0;
  }
  async selectConfiguration(launch, name, config, dynamicConfig) {
    if (typeof launch === "undefined") {
      const rootUri = this.historyService.getLastActiveWorkspaceRoot();
      launch = this.getLaunch(rootUri);
      if (!launch || launch.getConfigurationNames().length === 0) {
        launch = this.launches.find((l) => !!(l && l.getConfigurationNames().length)) || launch || this.launches[0];
      }
    }
    const previousLaunch = this.selectedLaunch;
    const previousName = this.selectedName;
    const previousSelectedDynamic = this.selectedDynamic;
    this.selectedLaunch = launch;
    if (this.selectedLaunch) {
      this.storageService.store(DEBUG_SELECTED_ROOT, this.selectedLaunch.uri.toString(), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_SELECTED_ROOT, StorageScope.WORKSPACE);
    }
    const names = launch ? launch.getConfigurationNames() : [];
    this.getSelectedConfig = () => {
      const selected = this.selectedName ? launch?.getConfiguration(this.selectedName) : void 0;
      return Promise.resolve(selected || config);
    };
    let type = config?.type;
    if (name && names.indexOf(name) >= 0) {
      this.setSelectedLaunchName(name);
    } else if (dynamicConfig && dynamicConfig.type) {
      type = dynamicConfig.type;
      if (!config) {
        const providers = (await this.getDynamicProviders()).filter((p) => p.type === type);
        this.getSelectedConfig = async () => {
          const activatedProviders = await Promise.all(providers.map((p) => p.getProvider()));
          const provider = activatedProviders.length > 0 ? activatedProviders[0] : void 0;
          if (provider && launch && launch.workspace) {
            const token = new CancellationTokenSource();
            const dynamicConfigs = await provider.provideDebugConfigurations(launch.workspace.uri, token.token);
            const dynamicConfig2 = dynamicConfigs.find((c) => c.name === name);
            if (dynamicConfig2) {
              return dynamicConfig2;
            }
          }
          return void 0;
        };
      }
      this.setSelectedLaunchName(name);
      let recentDynamicProviders = this.getRecentDynamicConfigurations();
      if (name && dynamicConfig.type) {
        recentDynamicProviders.unshift({ name, type: dynamicConfig.type });
        recentDynamicProviders = distinct(recentDynamicProviders, (t) => `${t.name} : ${t.type}`);
        this.storageService.store(DEBUG_RECENT_DYNAMIC_CONFIGURATIONS, JSON.stringify(recentDynamicProviders), StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    } else if (!this.selectedName || names.indexOf(this.selectedName) === -1) {
      const nameToSet = names.length ? names[0] : void 0;
      this.setSelectedLaunchName(nameToSet);
    }
    if (!config && launch && this.selectedName) {
      config = launch.getConfiguration(this.selectedName);
      type = config?.type;
    }
    this.selectedType = dynamicConfig?.type || config?.type;
    this.selectedDynamic = !!dynamicConfig;
    this.storageService.store(DEBUG_SELECTED_TYPE, dynamicConfig ? this.selectedType : void 0, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    if (type) {
      this.debugConfigurationTypeContext.set(type);
    } else {
      this.debugConfigurationTypeContext.reset();
    }
    if (this.selectedLaunch !== previousLaunch || this.selectedName !== previousName || previousSelectedDynamic !== this.selectedDynamic) {
      this._onDidSelectConfigurationName.fire();
    }
  }
  setSelectedLaunchName(selectedName) {
    this.selectedName = selectedName;
    if (this.selectedName) {
      this.storageService.store(DEBUG_SELECTED_CONFIG_NAME_KEY, this.selectedName, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_SELECTED_CONFIG_NAME_KEY, StorageScope.WORKSPACE);
    }
  }
  dispose() {
    this.toDispose = dispose(this.toDispose);
  }
};
ConfigurationManager = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IHistoryService),
  __decorateParam(8, IUriIdentityService),
  __decorateParam(9, IRemoteAgentService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, ILogService)
], ConfigurationManager);
class AbstractLaunch {
  constructor(configurationManager, adapterManager) {
    this.configurationManager = configurationManager;
    this.adapterManager = adapterManager;
  }
  getCompound(name) {
    const config = this.getDeduplicatedConfig();
    if (!config || !config.compounds) {
      return void 0;
    }
    return config.compounds.find((compound) => compound.name === name);
  }
  getConfigurationNames(ignoreCompoundsAndPresentation = false) {
    const config = this.getDeduplicatedConfig();
    if (!config || !Array.isArray(config.configurations) && !Array.isArray(config.compounds)) {
      return [];
    } else {
      const configurations = [];
      if (config.configurations) {
        configurations.push(...config.configurations.filter((cfg) => cfg && typeof cfg.name === "string"));
      }
      if (ignoreCompoundsAndPresentation) {
        return configurations.map((c) => c.name);
      }
      if (config.compounds) {
        configurations.push(...config.compounds.filter((compound) => typeof compound.name === "string" && compound.configurations && compound.configurations.length));
      }
      const resolved = configurations.map((c) => isDebugConfig(c) ? getEffectiveConfigForPlatform(c, this.configurationManager.getTargetOperatingSystem()) : c);
      return getVisibleAndSorted(resolved).map((c) => c.name);
    }
  }
  getConfiguration(name) {
    const config = this.getDeduplicatedConfig();
    if (!config || !config.configurations) {
      return void 0;
    }
    const configuration = config.configurations.find((config2) => config2 && config2.name === name);
    if (!configuration) {
      return;
    }
    const effectiveConfiguration = getEffectiveConfigForPlatform(configuration, this.configurationManager.getTargetOperatingSystem());
    if (this instanceof UserLaunch) {
      return { ...effectiveConfiguration, __configurationTarget: ConfigurationTarget.USER };
    } else if (this instanceof WorkspaceLaunch) {
      return { ...effectiveConfiguration, __configurationTarget: ConfigurationTarget.WORKSPACE };
    } else {
      return { ...effectiveConfiguration, __configurationTarget: ConfigurationTarget.WORKSPACE_FOLDER };
    }
  }
  async getInitialConfigurationContent(folderUri, type, useInitialConfigs, token) {
    let content = "";
    const adapter = type ? { debugger: this.adapterManager.getEnabledDebugger(type) } : await this.adapterManager.guessDebugger(true);
    if (adapter?.withConfig && adapter.debugger) {
      content = await adapter.debugger.getInitialConfigurationContent([adapter.withConfig.config]);
    } else if (adapter?.debugger) {
      const initialConfigs = useInitialConfigs ? await this.configurationManager.provideDebugConfigurations(folderUri, adapter.debugger.type, token || CancellationToken.None) : [];
      content = await adapter.debugger.getInitialConfigurationContent(initialConfigs);
    }
    return content;
  }
  get hidden() {
    return false;
  }
  getDeduplicatedConfig() {
    const original = this.getConfig();
    if (!original) {
      return void 0;
    }
    const compounds = original.compounds?.filter((compound) => !!compound && typeof compound.name === "string") ?? [];
    const configurations = original.configurations?.filter((configuration) => !!configuration && typeof configuration.name === "string") ?? [];
    return {
      version: original.version,
      compounds: distinguishConfigsByName(compounds),
      configurations: distinguishConfigsByName(configurations)
    };
  }
}
function distinguishConfigsByName(things) {
  const seen = /* @__PURE__ */ new Map();
  return things.map((thing) => {
    const no = seen.get(thing.name) || 0;
    seen.set(thing.name, no + 1);
    return no === 0 ? thing : { ...thing, name: `${thing.name} (${no})` };
  });
}
let Launch = class extends AbstractLaunch {
  constructor(configurationManager, adapterManager, workspace, fileService, textFileService, editorService, configurationService) {
    super(configurationManager, adapterManager);
    this.workspace = workspace;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.configurationService = configurationService;
  }
  get uri() {
    return resources.joinPath(this.workspace.uri, "/.vscode/launch.json");
  }
  get name() {
    return this.workspace.name;
  }
  getConfig() {
    return this.configurationService.inspect("launch", { resource: this.workspace.uri }).workspaceFolderValue;
  }
  async openConfigFile({ preserveFocus, type, suppressInitialConfigs }, token) {
    const resource = this.uri;
    let created = false;
    let content = "";
    try {
      const fileContent = await this.fileService.readFile(resource);
      content = fileContent.value.toString();
    } catch {
      content = await this.getInitialConfigurationContent(this.workspace.uri, type, !suppressInitialConfigs, token);
      if (!content) {
        return { editor: null, created: false };
      }
      created = true;
      try {
        await this.textFileService.write(resource, content);
      } catch (error) {
        throw new Error(nls.localize("DebugConfig.failed", "Unable to create 'launch.json' file inside the '.vscode' folder ({0}).", error.message));
      }
    }
    const index = content.indexOf(`"${this.configurationManager.selectedConfiguration.name}"`);
    let startLineNumber = 1;
    for (let i = 0; i < index; i++) {
      if (content.charAt(i) === "\n") {
        startLineNumber++;
      }
    }
    const selection = startLineNumber > 1 ? { startLineNumber, startColumn: 4 } : void 0;
    const editor = await this.editorService.openEditor({
      resource,
      options: {
        selection,
        preserveFocus,
        pinned: created,
        revealIfVisible: true
      }
    }, ACTIVE_GROUP);
    return {
      editor: editor ?? null,
      created
    };
  }
  async writeConfiguration(configuration) {
    const fullConfig = { ...this.getConfig() ?? {} };
    fullConfig.configurations = [...fullConfig.configurations || [], configuration];
    await this.configurationService.updateValue("launch", fullConfig, { resource: this.workspace.uri }, ConfigurationTarget.WORKSPACE_FOLDER);
  }
};
Launch = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IConfigurationService)
], Launch);
let WorkspaceLaunch = class extends AbstractLaunch {
  constructor(configurationManager, adapterManager, editorService, configurationService, contextService) {
    super(configurationManager, adapterManager);
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.contextService = contextService;
  }
  get workspace() {
    return void 0;
  }
  get uri() {
    return this.contextService.getWorkspace().configuration;
  }
  get name() {
    return nls.localize("workspace", "workspace");
  }
  getConfig() {
    return this.configurationService.inspect("launch").workspaceValue;
  }
  async openConfigFile({ preserveFocus, type, useInitialConfigs }, token) {
    const launchExistInFile = !!this.getConfig();
    if (!launchExistInFile) {
      const content = await this.getInitialConfigurationContent(void 0, type, useInitialConfigs, token);
      if (content) {
        await this.configurationService.updateValue("launch", json.parse(content), ConfigurationTarget.WORKSPACE);
      } else {
        return { editor: null, created: false };
      }
    }
    const editor = await this.editorService.openEditor({
      resource: this.contextService.getWorkspace().configuration,
      options: { preserveFocus }
    }, ACTIVE_GROUP);
    return {
      editor: editor ?? null,
      created: false
    };
  }
};
WorkspaceLaunch = __decorateClass([
  __decorateParam(2, IEditorService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IWorkspaceContextService)
], WorkspaceLaunch);
let UserLaunch = class extends AbstractLaunch {
  constructor(configurationManager, adapterManager, configurationService, preferencesService) {
    super(configurationManager, adapterManager);
    this.configurationService = configurationService;
    this.preferencesService = preferencesService;
  }
  get workspace() {
    return void 0;
  }
  get uri() {
    return this.preferencesService.userSettingsResource;
  }
  get name() {
    return nls.localize("user settings", "user settings");
  }
  get hidden() {
    return true;
  }
  getConfig() {
    return this.configurationService.inspect("launch").userValue;
  }
  async openConfigFile({ preserveFocus, type, useInitialContent }) {
    const editor = await this.preferencesService.openUserSettings({ jsonEditor: true, preserveFocus, revealSetting: { key: "launch" } });
    return {
      editor: editor ?? null,
      created: false
    };
  }
};
UserLaunch = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IPreferencesService)
], UserLaunch);
export {
  ConfigurationManager
};
