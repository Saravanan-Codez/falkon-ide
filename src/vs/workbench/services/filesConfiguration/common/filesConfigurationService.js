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
import { localize } from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { RawContextKey, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AutoSaveConfiguration, HotExitConfiguration, FILES_READONLY_INCLUDE_CONFIG, FILES_READONLY_EXCLUDE_CONFIG, IFileService, hasReadonlyCapability } from "../../../../platform/files/common/files.js";
import { equals } from "../../../../base/common/objects.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ResourceGlobMatcher } from "../../../common/resources.js";
import { GlobalIdleValue } from "../../../../base/common/async.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { LRUCache, ResourceMap } from "../../../../base/common/map.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { EditorResourceAccessor, SaveReason, SideBySideEditor } from "../../../common/editor.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
const AutoSaveAfterShortDelayContext = new RawContextKey("autoSaveAfterShortDelayContext", false, true);
var AutoSaveMode = /* @__PURE__ */ ((AutoSaveMode2) => {
  AutoSaveMode2[AutoSaveMode2["OFF"] = 0] = "OFF";
  AutoSaveMode2[AutoSaveMode2["AFTER_SHORT_DELAY"] = 1] = "AFTER_SHORT_DELAY";
  AutoSaveMode2[AutoSaveMode2["AFTER_LONG_DELAY"] = 2] = "AFTER_LONG_DELAY";
  AutoSaveMode2[AutoSaveMode2["ON_FOCUS_CHANGE"] = 3] = "ON_FOCUS_CHANGE";
  AutoSaveMode2[AutoSaveMode2["ON_WINDOW_CHANGE"] = 4] = "ON_WINDOW_CHANGE";
  return AutoSaveMode2;
})(AutoSaveMode || {});
var AutoSaveDisabledReason = /* @__PURE__ */ ((AutoSaveDisabledReason2) => {
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["SETTINGS"] = 1] = "SETTINGS";
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["OUT_OF_WORKSPACE"] = 2] = "OUT_OF_WORKSPACE";
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["ERRORS"] = 3] = "ERRORS";
  AutoSaveDisabledReason2[AutoSaveDisabledReason2["DISABLED"] = 4] = "DISABLED";
  return AutoSaveDisabledReason2;
})(AutoSaveDisabledReason || {});
const IFilesConfigurationService = createDecorator("filesConfigurationService");
let FilesConfigurationService = class extends Disposable {
  constructor(contextKeyService, configurationService, contextService, environmentService, uriIdentityService, fileService, markerService, textResourceConfigurationService) {
    super();
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.environmentService = environmentService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.markerService = markerService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this._onDidChangeAutoSaveConfiguration = this._register(new Emitter());
    this.onDidChangeAutoSaveConfiguration = this._onDidChangeAutoSaveConfiguration.event;
    this._onDidChangeAutoSaveDisabled = this._register(new Emitter());
    this.onDidChangeAutoSaveDisabled = this._onDidChangeAutoSaveDisabled.event;
    this._onDidChangeFilesAssociation = this._register(new Emitter());
    this.onDidChangeFilesAssociation = this._onDidChangeFilesAssociation.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    this.autoSaveConfigurationCache = new LRUCache(1e3);
    this.autoSaveAfterShortDelayOverrides = new ResourceMap();
    this.autoSaveDisabledOverrides = new ResourceMap();
    this.readonlyIncludeMatcher = this._register(new GlobalIdleValue(() => this.createReadonlyMatcher(FILES_READONLY_INCLUDE_CONFIG)));
    this.readonlyExcludeMatcher = this._register(new GlobalIdleValue(() => this.createReadonlyMatcher(FILES_READONLY_EXCLUDE_CONFIG)));
    this.sessionReadonlyOverrides = new ResourceMap((resource) => this.uriIdentityService.extUri.getComparisonKey(resource));
    this.autoSaveAfterShortDelayContext = AutoSaveAfterShortDelayContext.bindTo(contextKeyService);
    const configuration = configurationService.getValue();
    this.currentGlobalAutoSaveConfiguration = this.computeAutoSaveConfiguration(void 0, configuration.files);
    this.currentFilesAssociationConfiguration = configuration?.files?.associations;
    this.currentHotExitConfiguration = configuration?.files?.hotExit || HotExitConfiguration.ON_EXIT;
    this.onFilesConfigurationChange(configuration, false);
    this.registerListeners();
  }
  static {
    this.DEFAULT_AUTO_SAVE_MODE = isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF;
  }
  static {
    this.DEFAULT_AUTO_SAVE_DELAY = 1e3;
  }
  static {
    this.READONLY_MESSAGES = {
      providerReadonly: { value: localize("providerReadonly", "Editor is read-only because the file system of the file is read-only."), isTrusted: true },
      sessionReadonly: { value: localize({ key: "sessionReadonly", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because the file was set read-only in this session. [Click here](command:{0}) to set writeable.", "workbench.action.files.setActiveEditorWriteableInSession"), isTrusted: true },
      configuredReadonly: { value: localize({ key: "configuredReadonly", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because the file was set read-only via settings. [Click here](command:{0}) to configure or [toggle for this session](command:{1}).", `workbench.action.openSettings?${encodeURIComponent('["files.readonly"]')}`, "workbench.action.files.toggleActiveEditorReadonlyInSession"), isTrusted: true },
      fileLocked: { value: localize({ key: "fileLocked", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because of file permissions. [Click here](command:{0}) to set writeable anyway.", "workbench.action.files.setActiveEditorWriteableInSession"), isTrusted: true },
      fileReadonly: { value: localize("fileReadonly", "Editor is read-only because the file is read-only."), isTrusted: true }
    };
  }
  createReadonlyMatcher(config) {
    const matcher = this._register(new ResourceGlobMatcher(
      (resource) => this.configurationService.getValue(config, { resource }),
      (event) => event.affectsConfiguration(config),
      this.contextService,
      this.configurationService
    ));
    this._register(matcher.onExpressionChange(() => this._onDidChangeReadonly.fire()));
    return matcher;
  }
  isReadonly(resource, stat) {
    const provider = this.fileService.getProvider(resource.scheme);
    if (provider && hasReadonlyCapability(provider)) {
      return provider.readOnlyMessage ?? FilesConfigurationService.READONLY_MESSAGES.providerReadonly;
    }
    const sessionReadonlyOverride = this.sessionReadonlyOverrides.get(resource);
    if (typeof sessionReadonlyOverride === "boolean") {
      return sessionReadonlyOverride === true ? FilesConfigurationService.READONLY_MESSAGES.sessionReadonly : false;
    }
    if (this.uriIdentityService.extUri.isEqualOrParent(resource, this.environmentService.userRoamingDataHome) || this.uriIdentityService.extUri.isEqual(resource, this.contextService.getWorkspace().configuration ?? void 0)) {
      return false;
    }
    if (this.readonlyIncludeMatcher.value.matches(resource)) {
      return !this.readonlyExcludeMatcher.value.matches(resource) ? FilesConfigurationService.READONLY_MESSAGES.configuredReadonly : false;
    }
    if (this.configuredReadonlyFromPermissions && stat?.locked) {
      return FilesConfigurationService.READONLY_MESSAGES.fileLocked;
    }
    if (stat?.readonly) {
      return FilesConfigurationService.READONLY_MESSAGES.fileReadonly;
    }
    return false;
  }
  async updateReadonly(resource, readonly) {
    if (Array.isArray(resource)) {
      for (const r of resource) {
        this.applyReadonly(r, readonly);
      }
      if (resource.length > 0) {
        this._onDidChangeReadonly.fire();
      }
      return;
    }
    if (readonly === "toggle") {
      let stat = void 0;
      try {
        stat = await this.fileService.resolve(resource, { resolveMetadata: true });
      } catch (error) {
      }
      readonly = !this.isReadonly(resource, stat);
    }
    this.applyReadonly(resource, readonly);
    this._onDidChangeReadonly.fire();
  }
  applyReadonly(resource, readonly) {
    if (readonly === "reset") {
      this.sessionReadonlyOverrides.delete(resource);
    } else {
      this.sessionReadonlyOverrides.set(resource, readonly);
    }
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("files")) {
        this.onFilesConfigurationChange(this.configurationService.getValue(), true);
      }
    }));
  }
  onFilesConfigurationChange(configuration, fromEvent) {
    this.currentGlobalAutoSaveConfiguration = this.computeAutoSaveConfiguration(void 0, configuration.files);
    this.autoSaveConfigurationCache.clear();
    this.autoSaveAfterShortDelayContext.set(this.getAutoSaveMode(void 0).mode === 1 /* AFTER_SHORT_DELAY */);
    if (fromEvent) {
      this._onDidChangeAutoSaveConfiguration.fire();
    }
    const filesAssociation = configuration?.files?.associations;
    if (!equals(this.currentFilesAssociationConfiguration, filesAssociation)) {
      this.currentFilesAssociationConfiguration = filesAssociation;
      if (fromEvent) {
        this._onDidChangeFilesAssociation.fire();
      }
    }
    const hotExitMode = configuration?.files?.hotExit;
    if (hotExitMode === HotExitConfiguration.OFF || hotExitMode === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
      this.currentHotExitConfiguration = hotExitMode;
    } else {
      this.currentHotExitConfiguration = HotExitConfiguration.ON_EXIT;
    }
    const readonlyFromPermissions = Boolean(configuration?.files?.readonlyFromPermissions);
    if (readonlyFromPermissions !== Boolean(this.configuredReadonlyFromPermissions)) {
      this.configuredReadonlyFromPermissions = readonlyFromPermissions;
      if (fromEvent) {
        this._onDidChangeReadonly.fire();
      }
    }
  }
  getAutoSaveConfiguration(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (resource) {
      let resourceAutoSaveConfiguration = this.autoSaveConfigurationCache.get(resource);
      if (!resourceAutoSaveConfiguration) {
        resourceAutoSaveConfiguration = this.computeAutoSaveConfiguration(resource, this.textResourceConfigurationService.getValue(resource, "files"));
        this.autoSaveConfigurationCache.set(resource, resourceAutoSaveConfiguration);
      }
      return resourceAutoSaveConfiguration;
    }
    return this.currentGlobalAutoSaveConfiguration;
  }
  computeAutoSaveConfiguration(resource, filesConfiguration) {
    let autoSave;
    let autoSaveDelay;
    let autoSaveWorkspaceFilesOnly;
    let autoSaveWhenNoErrors;
    let isOutOfWorkspace;
    let isShortAutoSaveDelay;
    switch (filesConfiguration?.autoSave ?? FilesConfigurationService.DEFAULT_AUTO_SAVE_MODE) {
      case AutoSaveConfiguration.AFTER_DELAY: {
        autoSave = "afterDelay";
        autoSaveDelay = typeof filesConfiguration?.autoSaveDelay === "number" && filesConfiguration.autoSaveDelay >= 0 ? filesConfiguration.autoSaveDelay : FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY;
        isShortAutoSaveDelay = autoSaveDelay <= FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY;
        break;
      }
      case AutoSaveConfiguration.ON_FOCUS_CHANGE:
        autoSave = "onFocusChange";
        break;
      case AutoSaveConfiguration.ON_WINDOW_CHANGE:
        autoSave = "onWindowChange";
        break;
    }
    if (filesConfiguration?.autoSaveWorkspaceFilesOnly === true) {
      autoSaveWorkspaceFilesOnly = true;
      if (resource && !this.contextService.isInsideWorkspace(resource)) {
        isOutOfWorkspace = true;
        isShortAutoSaveDelay = void 0;
      }
    }
    if (filesConfiguration?.autoSaveWhenNoErrors === true) {
      autoSaveWhenNoErrors = true;
      isShortAutoSaveDelay = void 0;
    }
    return {
      autoSave,
      autoSaveDelay,
      autoSaveWorkspaceFilesOnly,
      autoSaveWhenNoErrors,
      isOutOfWorkspace,
      isShortAutoSaveDelay
    };
  }
  toResource(resourceOrEditor) {
    if (resourceOrEditor instanceof EditorInput) {
      return EditorResourceAccessor.getOriginalUri(resourceOrEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    }
    return resourceOrEditor;
  }
  hasShortAutoSaveDelay(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (resource && this.autoSaveAfterShortDelayOverrides.has(resource)) {
      return true;
    }
    if (this.getAutoSaveConfiguration(resource).isShortAutoSaveDelay) {
      return !resource || !this.autoSaveDisabledOverrides.has(resource);
    }
    return false;
  }
  getAutoSaveMode(resourceOrEditor, saveReason) {
    const resource = this.toResource(resourceOrEditor);
    if (resource && this.autoSaveAfterShortDelayOverrides.has(resource)) {
      return { mode: 1 /* AFTER_SHORT_DELAY */ };
    }
    if (resource && this.autoSaveDisabledOverrides.has(resource)) {
      return { mode: 0 /* OFF */, reason: 4 /* DISABLED */ };
    }
    const autoSaveConfiguration = this.getAutoSaveConfiguration(resource);
    if (typeof autoSaveConfiguration.autoSave === "undefined") {
      return { mode: 0 /* OFF */, reason: 1 /* SETTINGS */ };
    }
    if (typeof saveReason === "number") {
      if (autoSaveConfiguration.autoSave === "afterDelay" && saveReason !== SaveReason.AUTO || autoSaveConfiguration.autoSave === "onFocusChange" && saveReason !== SaveReason.FOCUS_CHANGE && saveReason !== SaveReason.WINDOW_CHANGE || autoSaveConfiguration.autoSave === "onWindowChange" && saveReason !== SaveReason.WINDOW_CHANGE) {
        return { mode: 0 /* OFF */, reason: 1 /* SETTINGS */ };
      }
    }
    if (resource) {
      if (autoSaveConfiguration.autoSaveWorkspaceFilesOnly && autoSaveConfiguration.isOutOfWorkspace) {
        return { mode: 0 /* OFF */, reason: 2 /* OUT_OF_WORKSPACE */ };
      }
      if (autoSaveConfiguration.autoSaveWhenNoErrors && this.markerService.read({ resource, take: 1, severities: MarkerSeverity.Error }).length > 0) {
        return { mode: 0 /* OFF */, reason: 3 /* ERRORS */ };
      }
    }
    switch (autoSaveConfiguration.autoSave) {
      case "afterDelay":
        if (typeof autoSaveConfiguration.autoSaveDelay === "number" && autoSaveConfiguration.autoSaveDelay <= FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY) {
          return { mode: autoSaveConfiguration.autoSaveWhenNoErrors ? 2 /* AFTER_LONG_DELAY */ : 1 /* AFTER_SHORT_DELAY */ };
        }
        return { mode: 2 /* AFTER_LONG_DELAY */ };
      case "onFocusChange":
        return { mode: 3 /* ON_FOCUS_CHANGE */ };
      case "onWindowChange":
        return { mode: 4 /* ON_WINDOW_CHANGE */ };
    }
  }
  async toggleAutoSave() {
    const currentSetting = this.configurationService.getValue("files.autoSave");
    let newAutoSaveValue;
    if ([AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE].some((setting) => setting === currentSetting)) {
      newAutoSaveValue = AutoSaveConfiguration.OFF;
    } else {
      newAutoSaveValue = AutoSaveConfiguration.AFTER_DELAY;
    }
    return this.configurationService.updateValue("files.autoSave", newAutoSaveValue);
  }
  enableAutoSaveAfterShortDelay(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (!resource) {
      return Disposable.None;
    }
    const counter = this.autoSaveAfterShortDelayOverrides.get(resource) ?? 0;
    this.autoSaveAfterShortDelayOverrides.set(resource, counter + 1);
    return toDisposable(() => {
      const counter2 = this.autoSaveAfterShortDelayOverrides.get(resource) ?? 0;
      if (counter2 <= 1) {
        this.autoSaveAfterShortDelayOverrides.delete(resource);
      } else {
        this.autoSaveAfterShortDelayOverrides.set(resource, counter2 - 1);
      }
    });
  }
  disableAutoSave(resourceOrEditor) {
    const resource = this.toResource(resourceOrEditor);
    if (!resource) {
      return Disposable.None;
    }
    const counter = this.autoSaveDisabledOverrides.get(resource) ?? 0;
    this.autoSaveDisabledOverrides.set(resource, counter + 1);
    if (counter === 0) {
      this._onDidChangeAutoSaveDisabled.fire(resource);
    }
    return toDisposable(() => {
      const counter2 = this.autoSaveDisabledOverrides.get(resource) ?? 0;
      if (counter2 <= 1) {
        this.autoSaveDisabledOverrides.delete(resource);
        this._onDidChangeAutoSaveDisabled.fire(resource);
      } else {
        this.autoSaveDisabledOverrides.set(resource, counter2 - 1);
      }
    });
  }
  get isHotExitEnabled() {
    if (this.contextService.getWorkspace().transient) {
      return false;
    }
    return this.currentHotExitConfiguration !== HotExitConfiguration.OFF;
  }
  get hotExitConfiguration() {
    return this.currentHotExitConfiguration;
  }
  preventSaveConflicts(resource, language) {
    return this.configurationService.getValue("files.saveConflictResolution", { resource, overrideIdentifier: language }) !== "overwriteFileOnDisk";
  }
};
FilesConfigurationService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IMarkerService),
  __decorateParam(7, ITextResourceConfigurationService)
], FilesConfigurationService);
registerSingleton(IFilesConfigurationService, FilesConfigurationService, InstantiationType.Eager);
export {
  AutoSaveAfterShortDelayContext,
  AutoSaveDisabledReason,
  AutoSaveMode,
  FilesConfigurationService,
  IFilesConfigurationService
};
