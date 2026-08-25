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
import { getErrorMessage } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { parse } from "../../../../base/common/json.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import * as network from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { CoreEditingCommands } from "../../../../editor/browser/coreCommands.js";
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions, getDefaultValue, OVERRIDE_PROPERTY_REGEX } from "../../../../platform/configuration/common/configurationRegistry.js";
import { FileOperationResult } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { IJSONEditingService } from "../../configuration/common/jsonEditing.js";
import { GroupDirection, IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, IEditorService, MODAL_GROUP, SIDE_GROUP } from "../../editor/common/editorService.js";
import { KeybindingsEditorInput } from "./keybindingsEditorInput.js";
import { DEFAULT_SETTINGS_EDITOR_SETTING, FOLDER_SETTINGS_PATH, IPreferencesService, SETTINGS_AUTHORITY, USE_SPLIT_JSON_SETTING, validateSettingsEditorOptions } from "../common/preferences.js";
import { PreferencesEditorInput, SettingsEditor2Input } from "../common/preferencesEditorInput.js";
import { defaultKeybindingsContents, DefaultKeybindingsEditorModel, DefaultRawSettingsEditorModel, DefaultSettings, DefaultSettingsEditorModel, Settings2EditorModel, SettingsEditorModel, WorkspaceConfigurationEditorModel } from "../common/preferencesModels.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { ITextEditorService } from "../../textfile/common/textEditorService.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { isObject } from "../../../../base/common/types.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { compareIgnoreCase } from "../../../../base/common/strings.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
const emptyEditableSettingsContent = "{\n}";
let PreferencesService = class extends Disposable {
  constructor(editorService, editorGroupService, textFileService, configurationService, notificationService, contextService, instantiationService, userDataProfileService, userDataProfilesService, textModelResolverService, keybindingService, modelService, jsonEditingService, labelService, remoteAgentService, textEditorService, urlService, extensionService, progressService, environmentService) {
    super();
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.textFileService = textFileService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.contextService = contextService;
    this.instantiationService = instantiationService;
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.textModelResolverService = textModelResolverService;
    this.jsonEditingService = jsonEditingService;
    this.labelService = labelService;
    this.remoteAgentService = remoteAgentService;
    this.textEditorService = textEditorService;
    this.extensionService = extensionService;
    this.progressService = progressService;
    this.environmentService = environmentService;
    this._onDispose = this._register(new Emitter());
    this._onDidDefaultSettingsContentChanged = this._register(new Emitter());
    this.onDidDefaultSettingsContentChanged = this._onDidDefaultSettingsContentChanged.event;
    this._requestedDefaultSettings = new ResourceSet();
    this._settingsGroups = void 0;
    this._cachedSettingsEditor2Input = void 0;
    this.defaultKeybindingsResource = URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: "/keybindings.json" });
    this.defaultSettingsRawResource = URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: "/defaultSettings.jsonc" });
    this._register(keybindingService.onDidUpdateKeybindings(() => {
      const model = modelService.getModel(this.defaultKeybindingsResource);
      if (!model) {
        return;
      }
      modelService.updateModel(model, defaultKeybindingsContents(keybindingService));
    }));
    this._register(urlService.registerHandler(this));
  }
  get userSettingsResource() {
    return this.userDataProfileService.currentProfile.settingsResource;
  }
  get workspaceSettingsResource() {
    if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return null;
    }
    const workspace = this.contextService.getWorkspace();
    return workspace.configuration || workspace.folders[0].toResource(FOLDER_SETTINGS_PATH);
  }
  createOrGetCachedSettingsEditor2Input() {
    if (!this._cachedSettingsEditor2Input || this._cachedSettingsEditor2Input.isDisposed()) {
      this._cachedSettingsEditor2Input = new SettingsEditor2Input(this);
    }
    return this._cachedSettingsEditor2Input;
  }
  getFolderSettingsResource(resource) {
    const folder = this.contextService.getWorkspaceFolder(resource);
    return folder ? folder.toResource(FOLDER_SETTINGS_PATH) : null;
  }
  hasDefaultSettingsContent(uri) {
    return this.isDefaultSettingsResource(uri) || isEqual(uri, this.defaultSettingsRawResource) || isEqual(uri, this.defaultKeybindingsResource);
  }
  getDefaultSettingsContent(uri) {
    if (this.isDefaultSettingsResource(uri)) {
      const target = this.getConfigurationTargetFromDefaultSettingsResource(uri);
      const defaultSettings = this.getDefaultSettings(target);
      if (!this._requestedDefaultSettings.has(uri)) {
        this._register(defaultSettings.onDidChange(() => this._onDidDefaultSettingsContentChanged.fire(uri)));
        this._requestedDefaultSettings.add(uri);
      }
      return defaultSettings.getContentWithoutMostCommonlyUsed(true);
    }
    if (isEqual(uri, this.defaultSettingsRawResource)) {
      if (!this._defaultRawSettingsEditorModel) {
        this._defaultRawSettingsEditorModel = this._register(this.instantiationService.createInstance(DefaultRawSettingsEditorModel, this.getDefaultSettings(ConfigurationTarget.USER_LOCAL)));
        this._register(this._defaultRawSettingsEditorModel.onDidContentChanged(() => this._onDidDefaultSettingsContentChanged.fire(uri)));
      }
      return this._defaultRawSettingsEditorModel.content;
    }
    if (isEqual(uri, this.defaultKeybindingsResource)) {
      const defaultKeybindingsEditorModel = this.instantiationService.createInstance(DefaultKeybindingsEditorModel, uri);
      return defaultKeybindingsEditorModel.content;
    }
    return void 0;
  }
  async createPreferencesEditorModel(uri) {
    if (this.isDefaultSettingsResource(uri)) {
      return this.createDefaultSettingsEditorModel(uri);
    }
    if (this.userSettingsResource.toString() === uri.toString() || this.userDataProfilesService.defaultProfile.settingsResource.toString() === uri.toString()) {
      return this.createEditableSettingsEditorModel(ConfigurationTarget.USER_LOCAL, uri);
    }
    const workspaceSettingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE);
    if (workspaceSettingsUri && workspaceSettingsUri.toString() === uri.toString()) {
      return this.createEditableSettingsEditorModel(ConfigurationTarget.WORKSPACE, workspaceSettingsUri);
    }
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const settingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE_FOLDER, uri);
      if (settingsUri && settingsUri.toString() === uri.toString()) {
        return this.createEditableSettingsEditorModel(ConfigurationTarget.WORKSPACE_FOLDER, uri);
      }
    }
    const remoteEnvironment = await this.remoteAgentService.getEnvironment();
    const remoteSettingsUri = remoteEnvironment ? remoteEnvironment.settingsPath : null;
    if (remoteSettingsUri && remoteSettingsUri.toString() === uri.toString()) {
      return this.createEditableSettingsEditorModel(ConfigurationTarget.USER_REMOTE, uri);
    }
    return null;
  }
  openRawDefaultSettings() {
    return this.editorService.openEditor({ resource: this.defaultSettingsRawResource });
  }
  openRawUserSettings() {
    return this.editorService.openEditor({ resource: this.userSettingsResource });
  }
  shouldOpenJsonByDefault() {
    return this.configurationService.getValue("workbench.settings.editor") === "json";
  }
  async openPreferences() {
    await this.editorService.openEditor(this.instantiationService.createInstance(PreferencesEditorInput), void 0, MODAL_GROUP);
  }
  openSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.USER_LOCAL
    };
    if (options.query) {
      options.jsonEditor = false;
    }
    return this.open(this.userSettingsResource, options);
  }
  openLanguageSpecificSettings(languageId, options = {}) {
    if (this.shouldOpenJsonByDefault()) {
      options.query = void 0;
      options.revealSetting = { key: `[${languageId}]`, edit: true };
    } else {
      options.query = `@lang:${languageId}${options.query ? ` ${options.query}` : ""}`;
    }
    options.target = options.target ?? ConfigurationTarget.USER_LOCAL;
    return this.open(this.userSettingsResource, options);
  }
  open(settingsResource, options) {
    options = {
      ...options,
      jsonEditor: options.jsonEditor ?? this.shouldOpenJsonByDefault()
    };
    if (options.jsonEditor && options.query && !options.revealSetting) {
      const query = options.query.trim();
      const idMatch = query.match(/^@id:(.+)$/);
      let key;
      if (idMatch) {
        key = idMatch[1].trim();
      } else if (Registry.as(Extensions.Configuration).getConfigurationProperties()[query.trim()]) {
        key = query.trim();
      }
      options.query = void 0;
      if (key) {
        options.revealSetting = { key };
      }
    }
    return options.jsonEditor ? this.openSettingsJson(settingsResource, options) : this.openSettings2(options);
  }
  async openSettings2(options) {
    const input = this.createOrGetCachedSettingsEditor2Input();
    options = {
      ...options,
      focusSearch: true
    };
    const group = this.getEditorGroupFromOptions(options);
    return this.editorService.openEditor(input, validateSettingsEditorOptions(options), group);
  }
  openApplicationSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.USER_LOCAL
    };
    return this.open(this.userDataProfilesService.defaultProfile.settingsResource, options);
  }
  openUserSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.USER_LOCAL
    };
    return this.open(this.userSettingsResource, options);
  }
  async openRemoteSettings(options = {}) {
    const environment = await this.remoteAgentService.getEnvironment();
    if (environment) {
      options = {
        ...options,
        target: ConfigurationTarget.USER_REMOTE
      };
      this.open(environment.settingsPath, options);
    }
    return void 0;
  }
  openWorkspaceSettings(options = {}) {
    if (!this.workspaceSettingsResource) {
      this.notificationService.info(nls.localize("openFolderFirst", "Open a folder or workspace first to create workspace or folder settings."));
      return Promise.reject(null);
    }
    options = {
      ...options,
      target: ConfigurationTarget.WORKSPACE
    };
    return this.open(this.workspaceSettingsResource, options);
  }
  async openFolderSettings(options = {}) {
    options = {
      ...options,
      target: ConfigurationTarget.WORKSPACE_FOLDER
    };
    if (!options.folderUri) {
      throw new Error(`Missing folder URI`);
    }
    const folderSettingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE_FOLDER, options.folderUri);
    if (!folderSettingsUri) {
      throw new Error(`Invalid folder URI - ${options.folderUri.toString()}`);
    }
    return this.open(folderSettingsUri, options);
  }
  async openGlobalKeybindingSettings(textual, options) {
    options = { pinned: true, revealIfOpened: true, ...options };
    if (textual) {
      const emptyContents = "// " + nls.localize("emptyKeybindingsHeader", "Place your key bindings in this file to override the defaults") + "\n[\n]";
      const editableKeybindings = this.userDataProfileService.currentProfile.keybindingsResource;
      const openDefaultKeybindings = !!this.configurationService.getValue("workbench.settings.openDefaultKeybindings");
      await this.createIfNotExists(editableKeybindings, emptyContents);
      if (openDefaultKeybindings) {
        const sourceGroupId = options.groupId ?? this.editorGroupService.activeGroup.id;
        const sideEditorGroup = this.editorGroupService.addGroup(sourceGroupId, GroupDirection.RIGHT);
        await Promise.all([
          this.editorService.openEditor({ resource: this.defaultKeybindingsResource, options: { pinned: true, preserveFocus: true, revealIfOpened: true, override: DEFAULT_EDITOR_ASSOCIATION.id }, label: nls.localize("defaultKeybindings", "Default Keybindings"), description: "" }, sourceGroupId),
          this.editorService.openEditor({ resource: editableKeybindings, options }, sideEditorGroup.id)
        ]);
      } else {
        await this.editorService.openEditor({ resource: editableKeybindings, options }, this.getEditorGroupFromOptions(options));
      }
    } else {
      const group = this.getEditorGroupFromOptions(options);
      const editor = await this.editorService.openEditor(this.instantiationService.createInstance(KeybindingsEditorInput), { ...options }, group);
      if (options.query) {
        editor.search(options.query);
      }
    }
  }
  openDefaultKeybindingsFile() {
    return this.editorService.openEditor({ resource: this.defaultKeybindingsResource, label: nls.localize("defaultKeybindings", "Default Keybindings") });
  }
  getEditorGroupFromOptions(options) {
    if (options?.groupId !== void 0 && !options.openToSide) {
      const group = this.editorGroupService.getGroup(options.groupId);
      if (group) {
        const modalEditorPart = this.editorGroupService.activeModalEditorPart;
        if (modalEditorPart?.groups.some((modalGroup) => modalGroup.id === group.id)) {
          return MODAL_GROUP;
        }
        return group;
      }
    }
    if (this.configurationService.getValue("workbench.editor.useModal") !== "off" && // modal editors enabled in settings
    !this.environmentService.enableSmokeTestDriver && !this.environmentService.extensionTestsLocationURI) {
      return MODAL_GROUP;
    }
    if (options.openToSide) {
      return SIDE_GROUP;
    }
    if (options?.groupId !== void 0) {
      return this.editorGroupService.getGroup(options.groupId) ?? this.editorGroupService.activeGroup;
    }
    return ACTIVE_GROUP;
  }
  async openSettingsJson(resource, options) {
    const group = this.getEditorGroupFromOptions(options);
    const editor = await this.doOpenSettingsJson(resource, options, group);
    if (editor && options?.revealSetting) {
      await this.revealSetting(options.revealSetting.key, !!options.revealSetting.edit, editor, resource);
    }
    return editor;
  }
  async doOpenSettingsJson(resource, options, group) {
    const openSplitJSON = !!this.configurationService.getValue(USE_SPLIT_JSON_SETTING);
    const openDefaultSettings = !!this.configurationService.getValue(DEFAULT_SETTINGS_EDITOR_SETTING);
    if (openSplitJSON || openDefaultSettings) {
      return this.doOpenSplitJSON(resource, options, group);
    }
    const configurationTarget = options?.target ?? ConfigurationTarget.USER;
    const editableSettingsEditorInput = await this.getOrCreateEditableSettingsEditorInput(configurationTarget, resource);
    options = { ...options, pinned: true };
    return await this.editorService.openEditor(editableSettingsEditorInput, { ...validateSettingsEditorOptions(options) }, group);
  }
  async doOpenSplitJSON(resource, options = {}, group) {
    const configurationTarget = options.target ?? ConfigurationTarget.USER;
    await this.createSettingsIfNotExists(configurationTarget, resource);
    const preferencesEditorInput = this.createSplitJsonEditorInput(configurationTarget, resource);
    options = { ...options, pinned: true };
    return this.editorService.openEditor(preferencesEditorInput, validateSettingsEditorOptions(options), group);
  }
  createSplitJsonEditorInput(configurationTarget, resource) {
    const editableSettingsEditorInput = this.textEditorService.createTextEditor({ resource });
    const defaultPreferencesEditorInput = this.textEditorService.createTextEditor({ resource: this.getDefaultSettingsResource(configurationTarget) });
    return this.instantiationService.createInstance(SideBySideEditorInput, editableSettingsEditorInput.getName(), void 0, defaultPreferencesEditorInput, editableSettingsEditorInput);
  }
  createSettings2EditorModel() {
    return this.instantiationService.createInstance(Settings2EditorModel, this.getDefaultSettings(ConfigurationTarget.USER_LOCAL));
  }
  getConfigurationTargetFromDefaultSettingsResource(uri) {
    return this.isDefaultWorkspaceSettingsResource(uri) ? ConfigurationTarget.WORKSPACE : this.isDefaultFolderSettingsResource(uri) ? ConfigurationTarget.WORKSPACE_FOLDER : ConfigurationTarget.USER_LOCAL;
  }
  isDefaultSettingsResource(uri) {
    return this.isDefaultUserSettingsResource(uri) || this.isDefaultWorkspaceSettingsResource(uri) || this.isDefaultFolderSettingsResource(uri);
  }
  isDefaultUserSettingsResource(uri) {
    return uri.authority === "defaultsettings" && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?settings\.json$/);
  }
  isDefaultWorkspaceSettingsResource(uri) {
    return uri.authority === "defaultsettings" && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?workspaceSettings\.json$/);
  }
  isDefaultFolderSettingsResource(uri) {
    return uri.authority === "defaultsettings" && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?resourceSettings\.json$/);
  }
  getDefaultSettingsResource(configurationTarget) {
    switch (configurationTarget) {
      case ConfigurationTarget.WORKSPACE:
        return URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: `/workspaceSettings.json` });
      case ConfigurationTarget.WORKSPACE_FOLDER:
        return URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: `/resourceSettings.json` });
    }
    return URI.from({ scheme: network.Schemas.vscode, authority: "defaultsettings", path: `/settings.json` });
  }
  async getOrCreateEditableSettingsEditorInput(target, resource) {
    await this.createSettingsIfNotExists(target, resource);
    return this.textEditorService.createTextEditor({ resource });
  }
  async createEditableSettingsEditorModel(configurationTarget, settingsUri) {
    const workspace = this.contextService.getWorkspace();
    if (workspace.configuration && workspace.configuration.toString() === settingsUri.toString()) {
      const reference2 = await this.textModelResolverService.createModelReference(settingsUri);
      return this.instantiationService.createInstance(WorkspaceConfigurationEditorModel, reference2, configurationTarget);
    }
    const reference = await this.textModelResolverService.createModelReference(settingsUri);
    return this.instantiationService.createInstance(SettingsEditorModel, reference, configurationTarget);
  }
  async createDefaultSettingsEditorModel(defaultSettingsUri) {
    const reference = await this.textModelResolverService.createModelReference(defaultSettingsUri);
    const target = this.getConfigurationTargetFromDefaultSettingsResource(defaultSettingsUri);
    return this.instantiationService.createInstance(DefaultSettingsEditorModel, defaultSettingsUri, reference, this.getDefaultSettings(target));
  }
  getDefaultSettings(target) {
    if (target === ConfigurationTarget.WORKSPACE) {
      this._defaultWorkspaceSettingsContentModel ??= this._register(new DefaultSettings(this.getMostCommonlyUsedSettings(), target, this.configurationService));
      return this._defaultWorkspaceSettingsContentModel;
    }
    if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
      this._defaultFolderSettingsContentModel ??= this._register(new DefaultSettings(this.getMostCommonlyUsedSettings(), target, this.configurationService));
      return this._defaultFolderSettingsContentModel;
    }
    this._defaultUserSettingsContentModel ??= this._register(new DefaultSettings(this.getMostCommonlyUsedSettings(), target, this.configurationService));
    return this._defaultUserSettingsContentModel;
  }
  async getEditableSettingsURI(configurationTarget, resource) {
    switch (configurationTarget) {
      case ConfigurationTarget.APPLICATION:
        return this.userDataProfilesService.defaultProfile.settingsResource;
      case ConfigurationTarget.USER:
      case ConfigurationTarget.USER_LOCAL:
        return this.userSettingsResource;
      case ConfigurationTarget.USER_REMOTE: {
        const remoteEnvironment = await this.remoteAgentService.getEnvironment();
        return remoteEnvironment ? remoteEnvironment.settingsPath : null;
      }
      case ConfigurationTarget.WORKSPACE:
        return this.workspaceSettingsResource;
      case ConfigurationTarget.WORKSPACE_FOLDER:
        if (resource) {
          return this.getFolderSettingsResource(resource);
        }
    }
    return null;
  }
  async createSettingsIfNotExists(target, resource) {
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && target === ConfigurationTarget.WORKSPACE) {
      const workspaceConfig = this.contextService.getWorkspace().configuration;
      if (!workspaceConfig) {
        return;
      }
      const content = await this.textFileService.read(workspaceConfig);
      if (Object.keys(parse(content.value)).indexOf("settings") === -1) {
        await this.jsonEditingService.write(resource, [{ path: ["settings"], value: {} }], true);
      }
      return void 0;
    }
    await this.createIfNotExists(resource, emptyEditableSettingsContent);
  }
  async createIfNotExists(resource, contents) {
    try {
      await this.textFileService.read(resource, { acceptTextOnly: true });
    } catch (error) {
      if (error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
        try {
          await this.textFileService.write(resource, contents);
          return;
        } catch (error2) {
          throw new Error(nls.localize("fail.createSettings", "Unable to create '{0}' ({1}).", this.labelService.getUriLabel(resource, { relative: true }), getErrorMessage(error2)));
        }
      } else {
        throw error;
      }
    }
  }
  getMostCommonlyUsedSettings() {
    return [
      "editor.fontSize",
      "editor.formatOnSave",
      "files.autoSave",
      "editor.defaultFormatter",
      "editor.fontFamily",
      "editor.wordWrap",
      "chat.agent.maxRequests",
      "files.exclude",
      "workbench.colorTheme",
      "editor.tabSize",
      "editor.mouseWheelZoom",
      "editor.formatOnPaste"
    ];
  }
  async revealSetting(settingKey, edit, editor, settingsResource) {
    const codeEditor = editor ? getCodeEditor(editor.getControl()) : null;
    if (!codeEditor) {
      return;
    }
    const settingsModel = await this.createPreferencesEditorModel(settingsResource);
    if (!settingsModel) {
      return;
    }
    const position = await this.getPositionToReveal(settingKey, edit, settingsModel, codeEditor);
    if (position) {
      codeEditor.setPosition(position);
      codeEditor.revealPositionNearTop(position);
      codeEditor.focus();
      if (edit) {
        SuggestController.get(codeEditor)?.triggerSuggest();
      }
    }
  }
  async getPositionToReveal(settingKey, edit, settingsModel, codeEditor) {
    const model = codeEditor.getModel();
    if (!model) {
      return null;
    }
    const schema = Registry.as(Extensions.Configuration).getConfigurationProperties()[settingKey];
    const isOverrideProperty = OVERRIDE_PROPERTY_REGEX.test(settingKey);
    if (!schema && !isOverrideProperty) {
      return null;
    }
    let position = null;
    const type = schema?.type ?? "object";
    let setting = settingsModel.getPreference(settingKey);
    if (!setting && edit) {
      let defaultValue = type === "object" || type === "array" ? this.configurationService.inspect(settingKey).defaultValue : getDefaultValue(type);
      defaultValue = defaultValue === void 0 && isOverrideProperty ? {} : defaultValue;
      if (defaultValue !== void 0) {
        const key = settingsModel instanceof WorkspaceConfigurationEditorModel ? ["settings", settingKey] : [settingKey];
        await this.jsonEditingService.write(settingsModel.uri, [{ path: key, value: defaultValue }], false);
        setting = settingsModel.getPreference(settingKey);
      }
    }
    if (setting) {
      if (edit) {
        if (isObject(setting.value) || Array.isArray(setting.value)) {
          position = { lineNumber: setting.valueRange.startLineNumber, column: setting.valueRange.startColumn + 1 };
          codeEditor.setPosition(position);
          await this.instantiationService.invokeFunction((accessor) => {
            return CoreEditingCommands.LineBreakInsert.runEditorCommand(accessor, codeEditor, null);
          });
          position = { lineNumber: position.lineNumber + 1, column: model.getLineMaxColumn(position.lineNumber + 1) };
          const firstNonWhiteSpaceColumn = model.getLineFirstNonWhitespaceColumn(position.lineNumber);
          if (firstNonWhiteSpaceColumn) {
            codeEditor.setPosition({ lineNumber: position.lineNumber, column: firstNonWhiteSpaceColumn });
            await this.instantiationService.invokeFunction((accessor) => {
              return CoreEditingCommands.LineBreakInsert.runEditorCommand(accessor, codeEditor, null);
            });
            position = { lineNumber: position.lineNumber, column: model.getLineMaxColumn(position.lineNumber) };
          }
        } else {
          position = { lineNumber: setting.valueRange.startLineNumber, column: setting.valueRange.endColumn };
        }
      } else {
        position = { lineNumber: setting.keyRange.startLineNumber, column: setting.keyRange.startColumn };
      }
    }
    return position;
  }
  getSetting(settingId) {
    if (!this._settingsGroups) {
      const defaultSettings = this.getDefaultSettings(ConfigurationTarget.USER);
      const defaultsChangedDisposable = this._register(new MutableDisposable());
      defaultsChangedDisposable.value = defaultSettings.onDidChange(() => {
        this._settingsGroups = void 0;
        defaultsChangedDisposable.clear();
      });
      this._settingsGroups = defaultSettings.getSettingsGroups();
    }
    for (const group of this._settingsGroups) {
      for (const section of group.sections) {
        for (const setting of section.settings) {
          if (compareIgnoreCase(setting.key, settingId) === 0) {
            return setting;
          }
        }
      }
    }
    return void 0;
  }
  /**
   * Should be of the format:
   * 	code://settings/settingName
   * Examples:
   * 	code://settings/files.autoSave
   *
   */
  async handleURL(uri) {
    if (compareIgnoreCase(uri.authority, SETTINGS_AUTHORITY) !== 0) {
      return false;
    }
    const settingInfo = uri.path.split("/").filter((part) => !!part);
    const settingId = settingInfo.length > 0 ? settingInfo[0] : void 0;
    if (!settingId) {
      this.openSettings();
      return true;
    }
    let setting = this.getSetting(settingId);
    if (!setting && this.extensionService.extensions.length === 0) {
      await this.progressService.withProgress({ location: ProgressLocation.Window }, () => Event.toPromise(this.extensionService.onDidRegisterExtensions));
      setting = this.getSetting(settingId);
    }
    const openSettingsOptions = {};
    if (setting) {
      openSettingsOptions.query = settingId;
    }
    this.openSettings(openSettingsOptions);
    return true;
  }
  dispose() {
    if (this._cachedSettingsEditor2Input && !this._cachedSettingsEditor2Input.isDisposed()) {
      this._cachedSettingsEditor2Input.dispose();
    }
    this._onDispose.fire();
    super.dispose();
  }
};
PreferencesService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, ITextFileService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IUserDataProfileService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, ITextModelService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IModelService),
  __decorateParam(12, IJSONEditingService),
  __decorateParam(13, ILabelService),
  __decorateParam(14, IRemoteAgentService),
  __decorateParam(15, ITextEditorService),
  __decorateParam(16, IURLService),
  __decorateParam(17, IExtensionService),
  __decorateParam(18, IProgressService),
  __decorateParam(19, IWorkbenchEnvironmentService)
], PreferencesService);
registerSingleton(IPreferencesService, PreferencesService, InstantiationType.Delayed);
export {
  PreferencesService
};
