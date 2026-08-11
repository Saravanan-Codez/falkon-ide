import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Promises, Queue } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { parse } from "../../../../base/common/json.js";
import { applyEdits, setProperty } from "../../../../base/common/jsonEdit.js";
import { deepClone, equals } from "../../../../base/common/objects.js";
import { distinct, equals as arrayEquals } from "../../../../base/common/arrays.js";
import { OS, OperatingSystem } from "../../../../base/common/platform.js";
import { ConfigurationTarget, isConfigurationOverrides, isConfigurationUpdateOverrides } from "../../../../platform/configuration/common/configuration.js";
import { ChatAIDisabledSettingId } from "../../../../platform/chat/common/chatSettings.js";
import { ConfigurationChangeEvent, ConfigurationModel } from "../../../../platform/configuration/common/configurationModels.js";
import { NullPolicyConfiguration, PolicyConfiguration } from "../../../../platform/configuration/common/configurations.js";
import { Extensions, keyFromOverrideIdentifiers } from "../../../../platform/configuration/common/configurationRegistry.js";
import { FileOperationResult } from "../../../../platform/files/common/files.js";
import { NullPolicyService } from "../../../../platform/policy/common/policy.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { DefaultConfiguration, FolderConfiguration, UserConfiguration, WorkspaceConfiguration } from "../../../../workbench/services/configuration/browser/configuration.js";
import { APPLICATION_SCOPES, APPLY_ALL_PROFILES_SETTING, FOLDER_CONFIG_FOLDER_NAME, FOLDER_SETTINGS_PATH } from "../../../../workbench/services/configuration/common/configuration.js";
import { Configuration } from "../../../../workbench/services/configuration/common/configurationModels.js";
import "../../../../workbench/services/configuration/browser/configurationService.js";
class SessionsDefaultConfiguration extends DefaultConfiguration {
  getDefaultValue(_key, propertySchema) {
    if (propertySchema.agentsWindow && propertySchema.defaultValueSource !== "experiments") {
      return deepClone(propertySchema.agentsWindow.default);
    }
    return super.getDefaultValue(_key, propertySchema);
  }
}
class ConfigurationService extends Disposable {
  constructor(userDataProfileService, workspaceService, uriIdentityService, fileService, policyService, logService, configurationCache, environmentService) {
    super();
    this.workspaceService = workspaceService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.logService = logService;
    this.cachedFolderConfigs = this._register(new DisposableMap(new ResourceMap()));
    this.agentsWindowReadOnlyKeys = /* @__PURE__ */ new Set();
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this.onDidChangeRestrictedSettings = Event.None;
    this.restrictedSettings = { default: [] };
    this.configurationRegistry = Registry.as(Extensions.Configuration);
    this.settingsResource = userDataProfileService.currentProfile.settingsResource;
    this.defaultConfiguration = this._register(new SessionsDefaultConfiguration(userDataProfileService.currentProfile.id, configurationCache, environmentService, logService));
    this.policyConfiguration = policyService instanceof NullPolicyService ? new NullPolicyConfiguration() : this._register(new PolicyConfiguration(this.defaultConfiguration, policyService, logService));
    this.initAgentsWindowReadOnlyKeys();
    this.userConfiguration = this._register(new UserConfiguration(userDataProfileService.currentProfile.settingsResource, userDataProfileService.currentProfile.tasksResource, userDataProfileService.currentProfile.mcpResource, { exclude: [...this.agentsWindowReadOnlyKeys] }, fileService, uriIdentityService, logService));
    this.workspaceConfiguration = this._register(new WorkspaceConfiguration({ needsCaching: () => false, read: async () => "", write: async () => {
    }, remove: async () => {
    } }, fileService, uriIdentityService, logService));
    this.configurationEditing = new ConfigurationEditing(fileService, this);
    this._configuration = new Configuration(
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      new ResourceMap(),
      ConfigurationModel.createEmptyModel(logService),
      new ResourceMap(),
      this.workspaceService.getWorkspace(),
      this.logService
    );
    this._register(this.defaultConfiguration.onDidChangeConfiguration(({ defaults, properties }) => this.onDefaultConfigurationChanged(defaults, properties)));
    this._register(this.policyConfiguration.onDidChangeConfiguration((configurationModel) => this.onPolicyConfigurationChanged(configurationModel)));
    this._register(this.userConfiguration.onDidChangeConfiguration((userConfiguration) => this.onUserConfigurationChanged(userConfiguration)));
    this._register(this.workspaceConfiguration.onDidUpdateConfiguration(() => this.onWorkspaceConfigurationChanged()));
    this._register(this.workspaceService.onWillChangeWorkspaceFolders((e) => e.join(this.loadFolderConfigurations(e.changes.added))));
    this._register(this.workspaceService.onDidChangeWorkspaceFolders((e) => this.onWorkspaceFoldersChanged(e)));
  }
  async initialize() {
    const workspace = this.workspaceService.getWorkspace();
    const workspaceIdentifier = { id: workspace.id, configPath: workspace.configuration };
    const [defaultModel, policyModel, userModel] = await Promise.all([
      this.defaultConfiguration.initialize(),
      this.policyConfiguration.initialize(),
      this.userConfiguration.initialize(),
      this.workspaceConfiguration.initialize(workspaceIdentifier, true)
    ]);
    this.workspaceConfiguration.reparseWorkspaceSettings({ exclude: [...this.agentsWindowReadOnlyKeys] });
    this._configuration = new Configuration(
      defaultModel,
      policyModel,
      ConfigurationModel.createEmptyModel(this.logService),
      userModel,
      ConfigurationModel.createEmptyModel(this.logService),
      this.workspaceConfiguration.getConfiguration(),
      new ResourceMap(),
      ConfigurationModel.createEmptyModel(this.logService),
      new ResourceMap(),
      workspace,
      this.logService
    );
    await this.loadFolderConfigurations(workspace.folders);
  }
  // #region IWorkbenchConfigurationService
  getConfigurationData() {
    return this._configuration.toData();
  }
  getValue(arg1, arg2) {
    const section = typeof arg1 === "string" ? arg1 : void 0;
    const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : void 0;
    return this._configuration.getValue(section, overrides);
  }
  async updateValue(key, value, arg3, arg4, _options) {
    const overrides = isConfigurationUpdateOverrides(arg3) ? arg3 : isConfigurationOverrides(arg3) ? { resource: arg3.resource, overrideIdentifiers: arg3.overrideIdentifier ? [arg3.overrideIdentifier] : void 0 } : void 0;
    let target = overrides ? arg4 : arg3;
    if (key === ChatAIDisabledSettingId) {
      target = ConfigurationTarget.WORKSPACE;
    }
    const targets = target ? [target] : [];
    if (overrides?.overrideIdentifiers) {
      overrides.overrideIdentifiers = distinct(overrides.overrideIdentifiers);
      overrides.overrideIdentifiers = overrides.overrideIdentifiers.length ? overrides.overrideIdentifiers : void 0;
    }
    const inspect = this.inspect(key, { resource: overrides?.resource, overrideIdentifier: overrides?.overrideIdentifiers ? overrides.overrideIdentifiers[0] : void 0 });
    if (inspect.policyValue !== void 0) {
      throw new Error(`Unable to write ${key} because it is configured in system policy.`);
    }
    if (this.agentsWindowReadOnlyKeys.has(key)) {
      throw new Error(`Unable to write ${key} because it is read-only in the Agents window.`);
    }
    if (!targets.length) {
      targets.push(...this.deriveConfigurationTargets(key, value, inspect));
      if (equals(value, inspect.defaultValue) && targets.length === 1 && targets[0] === ConfigurationTarget.USER) {
        value = void 0;
      }
    }
    if (overrides?.overrideIdentifiers?.length && overrides.overrideIdentifiers.length > 1) {
      const overrideIdentifiers = overrides.overrideIdentifiers.sort();
      const existingOverrides = this._configuration.localUserConfiguration.overrides.find((override) => arrayEquals([...override.identifiers].sort(), overrideIdentifiers));
      if (existingOverrides) {
        overrides.overrideIdentifiers = existingOverrides.identifiers;
      }
    }
    await Promises.settled(targets.map((t) => this.writeConfigurationValue(key, value, t, overrides)));
  }
  async writeConfigurationValue(key, value, target, overrides) {
    let path = overrides?.overrideIdentifiers?.length ? [keyFromOverrideIdentifiers(overrides.overrideIdentifiers), key] : [key];
    const settingsResource = this.getSettingsResource(target, overrides?.resource ?? void 0);
    if (this.isWorkspaceConfigurationResource(settingsResource)) {
      path = ["settings", ...path];
    }
    await this.configurationEditing.write(settingsResource, path, value);
    await this.reloadConfiguration();
  }
  deriveConfigurationTargets(_key, value, inspect) {
    if (equals(value, inspect.value)) {
      return [];
    }
    const definedTargets = [];
    if (inspect.workspaceFolderValue !== void 0) {
      definedTargets.push(ConfigurationTarget.WORKSPACE_FOLDER);
    }
    if (inspect.workspaceValue !== void 0) {
      definedTargets.push(ConfigurationTarget.WORKSPACE);
    }
    if (inspect.userValue !== void 0) {
      definedTargets.push(ConfigurationTarget.USER);
    }
    if (value === void 0) {
      return definedTargets;
    }
    return [definedTargets[0] || ConfigurationTarget.USER];
  }
  isWorkspaceConfigurationResource(resource) {
    const workspace = this.workspaceService.getWorkspace();
    return !!(workspace.configuration && this.uriIdentityService.extUri.isEqual(workspace.configuration, resource));
  }
  getSettingsResource(target, resource) {
    if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
      if (resource) {
        const folder = this.workspaceService.getWorkspaceFolder(resource);
        if (folder) {
          return this.uriIdentityService.extUri.joinPath(folder.uri, FOLDER_SETTINGS_PATH);
        }
      }
    }
    if (target === ConfigurationTarget.WORKSPACE) {
      const workspace = this.workspaceService.getWorkspace();
      if (workspace.configuration) {
        return workspace.configuration;
      }
    }
    return this.settingsResource;
  }
  inspect(key, overrides) {
    return this._configuration.inspect(key, overrides);
  }
  keys() {
    return this._configuration.keys();
  }
  async reloadConfiguration(_target) {
    this.reloadDefaultConfiguration();
    if (_target === ConfigurationTarget.DEFAULT) {
      return;
    }
    const userModel = await this.userConfiguration.initialize();
    const previousData = this._configuration.toData();
    const change = this._configuration.compareAndUpdateLocalUserConfiguration(userModel);
    const workspaceChange = await this.loadWorkspaceConfiguration();
    change.keys.push(...workspaceChange.keys);
    change.overrides.push(...workspaceChange.overrides);
    for (const folder of this.workspaceService.getWorkspace().folders) {
      const folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
      if (folderConfiguration) {
        const folderModel = await folderConfiguration.loadConfiguration();
        const folderChange = this._configuration.compareAndUpdateFolderConfiguration(folder.uri, folderModel);
        change.keys.push(...folderChange.keys);
        change.overrides.push(...folderChange.overrides);
      }
    }
    this.triggerConfigurationChange(change, previousData, ConfigurationTarget.USER);
  }
  reloadDefaultConfiguration() {
    this.onDefaultConfigurationChanged(this.defaultConfiguration.reload());
  }
  hasCachedConfigurationDefaultsOverrides() {
    return this.defaultConfiguration.hasCachedConfigurationDefaultsOverrides();
  }
  async whenRemoteConfigurationLoaded() {
  }
  isSettingAppliedForAllProfiles(key) {
    const scope = this.configurationRegistry.getConfigurationProperties()[key]?.scope;
    if (scope && APPLICATION_SCOPES.includes(scope)) {
      return true;
    }
    const allProfilesSettings = this.getValue(APPLY_ALL_PROFILES_SETTING) ?? [];
    return Array.isArray(allProfilesSettings) && allProfilesSettings.includes(key);
  }
  // #endregion
  initAgentsWindowReadOnlyKeys() {
    const properties = this.configurationRegistry.getConfigurationProperties();
    for (const key in properties) {
      if (properties[key].agentsWindow?.readOnly) {
        this.agentsWindowReadOnlyKeys.add(key);
      }
    }
  }
  updateAgentsWindowReadOnlyKeys(changedProperties) {
    const properties = this.configurationRegistry.getConfigurationProperties();
    for (const key of changedProperties) {
      if (properties[key]?.agentsWindow?.readOnly) {
        this.agentsWindowReadOnlyKeys.add(key);
      } else {
        this.agentsWindowReadOnlyKeys.delete(key);
      }
    }
  }
  // #region Configuration change handlers
  onDefaultConfigurationChanged(defaults, properties) {
    if (properties) {
      this.updateAgentsWindowReadOnlyKeys(properties);
    }
    const previousData = this._configuration.toData();
    const change = this._configuration.compareAndUpdateDefaultConfiguration(defaults, properties);
    this._configuration.updateLocalUserConfiguration(this.userConfiguration.reparse({ exclude: [...this.agentsWindowReadOnlyKeys] }));
    this._configuration.updateWorkspaceConfiguration(this.workspaceConfiguration.reparseWorkspaceSettings({ exclude: [...this.agentsWindowReadOnlyKeys] }));
    for (const folder of this.workspaceService.getWorkspace().folders) {
      const folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
      if (folderConfiguration) {
        this._configuration.updateFolderConfiguration(folder.uri, folderConfiguration.reparse());
      }
    }
    this.triggerConfigurationChange(change, previousData, ConfigurationTarget.DEFAULT);
  }
  onPolicyConfigurationChanged(policyConfiguration) {
    const previousData = this._configuration.toData();
    const change = this._configuration.compareAndUpdatePolicyConfiguration(policyConfiguration);
    this.triggerConfigurationChange(change, previousData, ConfigurationTarget.DEFAULT);
  }
  onUserConfigurationChanged(userConfiguration) {
    const previousData = this._configuration.toData();
    const change = this._configuration.compareAndUpdateLocalUserConfiguration(userConfiguration);
    this.triggerConfigurationChange(change, previousData, ConfigurationTarget.USER);
  }
  async onWorkspaceConfigurationChanged() {
    const previousData = this._configuration.toData();
    const change = await this.loadWorkspaceConfiguration();
    this.triggerConfigurationChange(change, previousData, ConfigurationTarget.WORKSPACE);
  }
  async loadWorkspaceConfiguration() {
    await this.workspaceConfiguration.reload();
    this.workspaceConfiguration.reparseWorkspaceSettings({ exclude: [...this.agentsWindowReadOnlyKeys] });
    return this._configuration.compareAndUpdateWorkspaceConfiguration(this.workspaceConfiguration.getConfiguration());
  }
  onWorkspaceFoldersChanged(e) {
    const previousData = this._configuration.toData();
    const keys = [];
    const overrides = [];
    for (const folder of e.removed) {
      const change = this._configuration.compareAndDeleteFolderConfiguration(folder.uri);
      keys.push(...change.keys);
      overrides.push(...change.overrides);
      this.cachedFolderConfigs.deleteAndDispose(folder.uri);
    }
    if (keys.length || overrides.length) {
      this.triggerConfigurationChange({ keys, overrides }, previousData, ConfigurationTarget.WORKSPACE_FOLDER);
    }
  }
  onWorkspaceFolderConfigurationChanged(folder) {
    const folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
    if (folderConfiguration) {
      folderConfiguration.loadConfiguration().then((configurationModel) => {
        const previousData = this._configuration.toData();
        const change = this._configuration.compareAndUpdateFolderConfiguration(folder.uri, configurationModel);
        this.triggerConfigurationChange(change, previousData, ConfigurationTarget.WORKSPACE_FOLDER);
      }, onUnexpectedError);
    }
  }
  async loadFolderConfigurations(folders) {
    for (const folder of folders) {
      let folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
      if (!folderConfiguration) {
        folderConfiguration = new FolderConfiguration(false, folder, FOLDER_CONFIG_FOLDER_NAME, WorkbenchState.WORKSPACE, true, this.fileService, this.uriIdentityService, this.logService, { needsCaching: () => false, read: async () => "", write: async () => {
        }, remove: async () => {
        } });
        folderConfiguration.addRelated(folderConfiguration.onDidChange(() => this.onWorkspaceFolderConfigurationChanged(folder)));
        this.cachedFolderConfigs.set(folder.uri, folderConfiguration);
      }
      const configurationModel = await folderConfiguration.loadConfiguration();
      this._configuration.updateFolderConfiguration(folder.uri, configurationModel);
    }
  }
  triggerConfigurationChange(change, previousData, target) {
    if (change.keys.length) {
      const workspace = this.workspaceService.getWorkspace();
      const event = new ConfigurationChangeEvent(change, { data: previousData, workspace }, this._configuration, workspace, this.logService);
      event.source = target;
      this._onDidChangeConfiguration.fire(event);
    }
  }
  // #endregion
}
class ConfigurationEditing {
  constructor(fileService, configurationService) {
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.queue = new Queue();
  }
  write(settingsResource, path, value) {
    return this.queue.queue(() => this.doWriteConfiguration(settingsResource, path, value));
  }
  async doWriteConfiguration(settingsResource, path, value) {
    let content;
    try {
      const fileContent = await this.fileService.readFile(settingsResource);
      content = fileContent.value.toString();
    } catch (error) {
      if (error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
        content = "{}";
      } else {
        throw error;
      }
    }
    const parseErrors = [];
    parse(content, parseErrors, { allowTrailingComma: true, allowEmptyContent: true });
    if (parseErrors.length > 0) {
      throw new Error("Unable to write into the settings file. Please open the file to correct errors/warnings in the file and try again.");
    }
    const edits = this.getEdits(content, path, value);
    content = applyEdits(content, edits);
    await this.fileService.writeFile(settingsResource, VSBuffer.fromString(content));
  }
  getEdits(content, path, value) {
    const { tabSize, insertSpaces, eol } = this.formattingOptions;
    if (!path.length) {
      const newContent = JSON.stringify(value, null, insertSpaces ? " ".repeat(tabSize) : "	");
      return [{
        content: newContent,
        length: content.length,
        offset: 0
      }];
    }
    return setProperty(content, path, value, { tabSize, insertSpaces, eol });
  }
  get formattingOptions() {
    if (!this._formattingOptions) {
      let eol = OS === OperatingSystem.Linux || OS === OperatingSystem.Macintosh ? "\n" : "\r\n";
      const configuredEol = this.configurationService.getValue("files.eol", { overrideIdentifier: "jsonc" });
      if (configuredEol && typeof configuredEol === "string" && configuredEol !== "auto") {
        eol = configuredEol;
      }
      this._formattingOptions = {
        eol,
        insertSpaces: !!this.configurationService.getValue("editor.insertSpaces", { overrideIdentifier: "jsonc" }),
        tabSize: this.configurationService.getValue("editor.tabSize", { overrideIdentifier: "jsonc" })
      };
    }
    return this._formattingOptions;
  }
}
export {
  ConfigurationService
};
