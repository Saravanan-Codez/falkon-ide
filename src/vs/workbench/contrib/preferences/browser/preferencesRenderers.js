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
import { EventHelper, getDomNodePagePosition } from "../../../../base/browser/dom.js";
import { SubmenuAction } from "../../../../base/common/actions.js";
import { Delayer } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import * as editorCommon from "../../../../editor/common/editorCommon.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { CodeActionKind } from "../../../../editor/contrib/codeAction/common/types.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope, OVERRIDE_PROPERTY_REGEX, overrideIdentifiersFromKey } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService, MarkerSeverity, MarkerTag } from "../../../../platform/markers/common/markers.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { RangeHighlightDecorations } from "../../../browser/codeeditor.js";
import { settingsEditIcon } from "./preferencesIcons.js";
import { EditPreferenceWidget } from "./preferencesWidgets.js";
import { APPLICATION_SCOPES, APPLY_ALL_PROFILES_SETTING, IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { DefaultSettingsEditorModel, WorkspaceConfigurationEditorModel } from "../../../services/preferences/common/preferencesModels.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { EXPERIMENTAL_INDICATOR_DESCRIPTION, PREVIEW_INDICATOR_DESCRIPTION } from "../common/preferences.js";
import { mcpConfigurationSection } from "../../mcp/common/mcpConfiguration.js";
import { McpCommandIds } from "../../mcp/common/mcpCommandIds.js";
let UserSettingsRenderer = class extends Disposable {
  constructor(editor, preferencesModel, preferencesService, configurationService, instantiationService) {
    super();
    this.editor = editor;
    this.preferencesModel = preferencesModel;
    this.preferencesService = preferencesService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.modelChangeDelayer = this._register(new Delayer(200));
    this.settingHighlighter = this._register(instantiationService.createInstance(SettingHighlighter, editor));
    this.editSettingActionRenderer = this._register(this.instantiationService.createInstance(EditSettingRenderer, this.editor, this.preferencesModel, this.settingHighlighter));
    this._register(this.editSettingActionRenderer.onUpdateSetting(({ key, value, source }) => this.updatePreference(key, value, source)));
    this._register(this.editor.getModel().onDidChangeContent(() => this.modelChangeDelayer.trigger(() => this.onModelChanged())));
    this.unsupportedSettingsRenderer = this._register(instantiationService.createInstance(UnsupportedSettingsRenderer, editor, preferencesModel));
    this.mcpSettingsRenderer = this._register(instantiationService.createInstance(McpSettingsRenderer, editor, preferencesModel));
  }
  render() {
    this.editSettingActionRenderer.render(this.preferencesModel.settingsGroups, this.associatedPreferencesModel);
    this.unsupportedSettingsRenderer.render();
    this.mcpSettingsRenderer.render();
  }
  updatePreference(key, value, source) {
    const overrideIdentifiers = source.overrideOf ? overrideIdentifiersFromKey(source.overrideOf.key) : null;
    const resource = this.preferencesModel.uri;
    this.configurationService.updateValue(key, value, { overrideIdentifiers, resource }, this.preferencesModel.configurationTarget).then(() => this.onSettingUpdated(source));
  }
  onModelChanged() {
    if (!this.editor.hasModel()) {
      return;
    }
    this.render();
  }
  onSettingUpdated(setting) {
    this.editor.focus();
    setting = this.getSetting(setting);
    if (setting) {
      this.editor.setSelection(setting.valueRange);
      this.settingHighlighter.highlight(setting, true);
    }
  }
  getSetting(setting) {
    const { key, overrideOf } = setting;
    if (overrideOf) {
      const setting2 = this.getSetting(overrideOf);
      for (const override of setting2.overrides) {
        if (override.key === key) {
          return override;
        }
      }
      return void 0;
    }
    return this.preferencesModel.getPreference(key);
  }
  focusPreference(setting) {
    const s = this.getSetting(setting);
    if (s) {
      this.settingHighlighter.highlight(s, true);
      this.editor.setPosition({ lineNumber: s.keyRange.startLineNumber, column: s.keyRange.startColumn });
    } else {
      this.settingHighlighter.clear(true);
    }
  }
  clearFocus(setting) {
    this.settingHighlighter.clear(true);
  }
  editPreference(setting) {
    const editableSetting = this.getSetting(setting);
    return !!(editableSetting && this.editSettingActionRenderer.activateOnSetting(editableSetting));
  }
};
UserSettingsRenderer = __decorateClass([
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService)
], UserSettingsRenderer);
let WorkspaceSettingsRenderer = class extends UserSettingsRenderer {
  constructor(editor, preferencesModel, preferencesService, configurationService, instantiationService) {
    super(editor, preferencesModel, preferencesService, configurationService, instantiationService);
    this.workspaceConfigurationRenderer = this._register(instantiationService.createInstance(WorkspaceConfigurationRenderer, editor, preferencesModel));
  }
  render() {
    super.render();
    this.workspaceConfigurationRenderer.render();
  }
};
WorkspaceSettingsRenderer = __decorateClass([
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService)
], WorkspaceSettingsRenderer);
let EditSettingRenderer = class extends Disposable {
  constructor(editor, primarySettingsModel, settingHighlighter, configurationService, instantiationService, contextMenuService) {
    super();
    this.editor = editor;
    this.primarySettingsModel = primarySettingsModel;
    this.settingHighlighter = settingHighlighter;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.settingsGroups = [];
    this._onUpdateSetting = this._register(new Emitter());
    this.onUpdateSetting = this._onUpdateSetting.event;
    this.editPreferenceWidgetForCursorPosition = this._register(this.instantiationService.createInstance(EditPreferenceWidget, editor));
    this.editPreferenceWidgetForMouseMove = this._register(this.instantiationService.createInstance(EditPreferenceWidget, editor));
    this.toggleEditPreferencesForMouseMoveDelayer = this._register(new Delayer(75));
    this._register(this.editPreferenceWidgetForCursorPosition.onClick((e) => this.onEditSettingClicked(this.editPreferenceWidgetForCursorPosition, e)));
    this._register(this.editPreferenceWidgetForMouseMove.onClick((e) => this.onEditSettingClicked(this.editPreferenceWidgetForMouseMove, e)));
    this._register(this.editor.onDidChangeCursorPosition((positionChangeEvent) => this.onPositionChanged(positionChangeEvent)));
    this._register(this.editor.onMouseMove((mouseMoveEvent) => this.onMouseMoved(mouseMoveEvent)));
    this._register(this.editor.onDidChangeConfiguration(() => this.onConfigurationChanged()));
  }
  render(settingsGroups, associatedPreferencesModel) {
    this.editPreferenceWidgetForCursorPosition.hide();
    this.editPreferenceWidgetForMouseMove.hide();
    this.settingsGroups = settingsGroups;
    this.associatedPreferencesModel = associatedPreferencesModel;
    const settings = this.getSettings(this.editor.getPosition().lineNumber);
    if (settings.length) {
      this.showEditPreferencesWidget(this.editPreferenceWidgetForCursorPosition, settings);
    }
  }
  isDefaultSettings() {
    return this.primarySettingsModel instanceof DefaultSettingsEditorModel;
  }
  onConfigurationChanged() {
    if (!this.editor.getOption(EditorOption.glyphMargin)) {
      this.editPreferenceWidgetForCursorPosition.hide();
      this.editPreferenceWidgetForMouseMove.hide();
    }
  }
  onPositionChanged(positionChangeEvent) {
    this.editPreferenceWidgetForMouseMove.hide();
    const settings = this.getSettings(positionChangeEvent.position.lineNumber);
    if (settings.length) {
      this.showEditPreferencesWidget(this.editPreferenceWidgetForCursorPosition, settings);
    } else {
      this.editPreferenceWidgetForCursorPosition.hide();
    }
  }
  onMouseMoved(mouseMoveEvent) {
    const editPreferenceWidget = this.getEditPreferenceWidgetUnderMouse(mouseMoveEvent);
    if (editPreferenceWidget) {
      this.onMouseOver(editPreferenceWidget);
      return;
    }
    this.settingHighlighter.clear();
    this.toggleEditPreferencesForMouseMoveDelayer.trigger(() => this.toggleEditPreferenceWidgetForMouseMove(mouseMoveEvent));
  }
  getEditPreferenceWidgetUnderMouse(mouseMoveEvent) {
    if (mouseMoveEvent.target.type === MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const line = mouseMoveEvent.target.position.lineNumber;
      if (this.editPreferenceWidgetForMouseMove.getLine() === line && this.editPreferenceWidgetForMouseMove.isVisible()) {
        return this.editPreferenceWidgetForMouseMove;
      }
      if (this.editPreferenceWidgetForCursorPosition.getLine() === line && this.editPreferenceWidgetForCursorPosition.isVisible()) {
        return this.editPreferenceWidgetForCursorPosition;
      }
    }
    return void 0;
  }
  toggleEditPreferenceWidgetForMouseMove(mouseMoveEvent) {
    const settings = mouseMoveEvent.target.position ? this.getSettings(mouseMoveEvent.target.position.lineNumber) : null;
    if (settings && settings.length) {
      this.showEditPreferencesWidget(this.editPreferenceWidgetForMouseMove, settings);
    } else {
      this.editPreferenceWidgetForMouseMove.hide();
    }
  }
  showEditPreferencesWidget(editPreferencesWidget, settings) {
    const line = settings[0].valueRange.startLineNumber;
    if (this.editor.getOption(EditorOption.glyphMargin) && this.marginFreeFromOtherDecorations(line)) {
      editPreferencesWidget.show(line, nls.localize("editTtile", "Edit"), settings);
      const editPreferenceWidgetToHide = editPreferencesWidget === this.editPreferenceWidgetForCursorPosition ? this.editPreferenceWidgetForMouseMove : this.editPreferenceWidgetForCursorPosition;
      editPreferenceWidgetToHide.hide();
    }
  }
  marginFreeFromOtherDecorations(line) {
    const decorations = this.editor.getLineDecorations(line);
    if (decorations) {
      for (const { options } of decorations) {
        if (options.glyphMarginClassName && options.glyphMarginClassName.indexOf(ThemeIcon.asClassName(settingsEditIcon)) === -1) {
          return false;
        }
      }
    }
    return true;
  }
  getSettings(lineNumber) {
    const configurationMap = this.getConfigurationsMap();
    return this.getSettingsAtLineNumber(lineNumber).filter((setting) => {
      const configurationNode = configurationMap[setting.key];
      if (configurationNode) {
        if (configurationNode.policy && this.configurationService.inspect(setting.key).policyValue !== void 0) {
          return false;
        }
        if (this.isDefaultSettings()) {
          if (setting.key === "launch") {
            return false;
          }
          return true;
        }
        if (configurationNode.type === "boolean" || configurationNode.enum) {
          if (this.primarySettingsModel.configurationTarget !== ConfigurationTarget.WORKSPACE_FOLDER) {
            return true;
          }
          if (configurationNode.scope === ConfigurationScope.RESOURCE || configurationNode.scope === ConfigurationScope.LANGUAGE_OVERRIDABLE) {
            return true;
          }
        }
      }
      return false;
    });
  }
  getSettingsAtLineNumber(lineNumber) {
    let index = 0;
    const settings = [];
    for (const group of this.settingsGroups) {
      if (group.range.startLineNumber > lineNumber) {
        break;
      }
      if (lineNumber >= group.range.startLineNumber && lineNumber <= group.range.endLineNumber) {
        for (const section of group.sections) {
          for (const setting of section.settings) {
            if (setting.range.startLineNumber > lineNumber) {
              break;
            }
            if (lineNumber >= setting.range.startLineNumber && lineNumber <= setting.range.endLineNumber) {
              if (!this.isDefaultSettings() && setting.overrides.length) {
                for (const overrideSetting of setting.overrides) {
                  if (lineNumber >= overrideSetting.range.startLineNumber && lineNumber <= overrideSetting.range.endLineNumber) {
                    settings.push({ ...overrideSetting, index, groupId: group.id });
                  }
                }
              } else {
                settings.push({ ...setting, index, groupId: group.id });
              }
            }
            index++;
          }
        }
      }
    }
    return settings;
  }
  onMouseOver(editPreferenceWidget) {
    this.settingHighlighter.highlight(editPreferenceWidget.preferences[0]);
  }
  onEditSettingClicked(editPreferenceWidget, e) {
    EventHelper.stop(e.event, true);
    const actions = this.getSettings(editPreferenceWidget.getLine()).length === 1 ? this.getActions(editPreferenceWidget.preferences[0], this.getConfigurationsMap()[editPreferenceWidget.preferences[0].key]) : editPreferenceWidget.preferences.map((setting) => new SubmenuAction(`preferences.submenu.${setting.key}`, setting.key, this.getActions(setting, this.getConfigurationsMap()[setting.key])));
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.event,
      getActions: () => actions
    });
  }
  activateOnSetting(setting) {
    const startLine = setting.keyRange.startLineNumber;
    const settings = this.getSettings(startLine);
    if (!settings.length) {
      return false;
    }
    this.editPreferenceWidgetForMouseMove.show(startLine, "", settings);
    const actions = this.getActions(this.editPreferenceWidgetForMouseMove.preferences[0], this.getConfigurationsMap()[this.editPreferenceWidgetForMouseMove.preferences[0].key]);
    this.contextMenuService.showContextMenu({
      getAnchor: () => this.toAbsoluteCoords(new Position(startLine, 1)),
      getActions: () => actions
    });
    return true;
  }
  toAbsoluteCoords(position) {
    const positionCoords = this.editor.getScrolledVisiblePosition(position);
    const editorCoords = getDomNodePagePosition(this.editor.getDomNode());
    const x = editorCoords.left + positionCoords.left;
    const y = editorCoords.top + positionCoords.top + positionCoords.height;
    return { x, y: y + 10 };
  }
  getConfigurationsMap() {
    return Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
  }
  getActions(setting, jsonSchema) {
    if (jsonSchema.type === "boolean") {
      return [{
        id: "truthyValue",
        label: "true",
        tooltip: "true",
        enabled: true,
        run: () => this.updateSetting(setting.key, true, setting),
        class: void 0
      }, {
        id: "falsyValue",
        label: "false",
        tooltip: "false",
        enabled: true,
        run: () => this.updateSetting(setting.key, false, setting),
        class: void 0
      }];
    }
    if (jsonSchema.enum) {
      return jsonSchema.enum.map((value) => {
        return {
          id: value,
          label: JSON.stringify(value),
          tooltip: JSON.stringify(value),
          enabled: true,
          run: () => this.updateSetting(setting.key, value, setting),
          class: void 0
        };
      });
    }
    return this.getDefaultActions(setting);
  }
  getDefaultActions(setting) {
    if (this.isDefaultSettings()) {
      const settingInOtherModel = this.associatedPreferencesModel.getPreference(setting.key);
      return [{
        id: "setDefaultValue",
        label: settingInOtherModel ? nls.localize("replaceDefaultValue", "Replace in Settings") : nls.localize("copyDefaultValue", "Copy to Settings"),
        tooltip: settingInOtherModel ? nls.localize("replaceDefaultValue", "Replace in Settings") : nls.localize("copyDefaultValue", "Copy to Settings"),
        enabled: true,
        run: () => this.updateSetting(setting.key, setting.value, setting),
        class: void 0
      }];
    }
    return [];
  }
  updateSetting(key, value, source) {
    this._onUpdateSetting.fire({ key, value, source });
  }
};
EditSettingRenderer = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextMenuService)
], EditSettingRenderer);
let SettingHighlighter = class extends Disposable {
  constructor(editor, instantiationService) {
    super();
    this.editor = editor;
    this.fixedHighlighter = this._register(instantiationService.createInstance(RangeHighlightDecorations));
    this.volatileHighlighter = this._register(instantiationService.createInstance(RangeHighlightDecorations));
  }
  highlight(setting, fix = false) {
    this.volatileHighlighter.removeHighlightRange();
    this.fixedHighlighter.removeHighlightRange();
    const highlighter = fix ? this.fixedHighlighter : this.volatileHighlighter;
    highlighter.highlightRange({
      range: setting.valueRange,
      resource: this.editor.getModel().uri
    }, this.editor);
    this.editor.revealLineInCenterIfOutsideViewport(setting.valueRange.startLineNumber, editorCommon.ScrollType.Smooth);
  }
  clear(fix = false) {
    this.volatileHighlighter.removeHighlightRange();
    if (fix) {
      this.fixedHighlighter.removeHighlightRange();
    }
  }
};
SettingHighlighter = __decorateClass([
  __decorateParam(1, IInstantiationService)
], SettingHighlighter);
let UnsupportedSettingsRenderer = class extends Disposable {
  constructor(editor, settingsEditorModel, markerService, environmentService, configurationService, workspaceTrustManagementService, uriIdentityService, languageFeaturesService, userDataProfileService, userDataProfilesService) {
    super();
    this.editor = editor;
    this.settingsEditorModel = settingsEditorModel;
    this.markerService = markerService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.uriIdentityService = uriIdentityService;
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.renderingDelayer = this._register(new Delayer(200));
    this.codeActions = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
    this._register(this.editor.getModel().onDidChangeContent(() => this.delayedRender()));
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.source === ConfigurationTarget.DEFAULT)(() => this.delayedRender()));
    this._register(languageFeaturesService.codeActionProvider.register({ pattern: settingsEditorModel.uri.path }, this));
    this._register(userDataProfileService.onDidChangeCurrentProfile(() => this.delayedRender()));
  }
  delayedRender() {
    this.renderingDelayer.trigger(() => this.render());
  }
  render() {
    this.codeActions.clear();
    const markerData = this.generateMarkerData();
    if (markerData.length) {
      this.markerService.changeOne("UnsupportedSettingsRenderer", this.settingsEditorModel.uri, markerData);
    } else {
      this.markerService.remove("UnsupportedSettingsRenderer", [this.settingsEditorModel.uri]);
    }
  }
  async provideCodeActions(model, range, context, token) {
    const actions = [];
    const codeActionsByRange = this.codeActions.get(model.uri);
    if (codeActionsByRange) {
      for (const [codeActionsRange, codeActions] of codeActionsByRange) {
        if (codeActionsRange.containsRange(range)) {
          actions.push(...codeActions);
        }
      }
    }
    return {
      actions,
      dispose: () => {
      }
    };
  }
  generateMarkerData() {
    const markerData = [];
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
    for (const settingsGroup of this.settingsEditorModel.settingsGroups) {
      for (const section of settingsGroup.sections) {
        for (const setting of section.settings) {
          if (OVERRIDE_PROPERTY_REGEX.test(setting.key)) {
            if (setting.overrides) {
              this.handleOverrides(setting.overrides, configurationRegistry, markerData);
            }
            continue;
          }
          const configuration = configurationRegistry[setting.key];
          if (configuration) {
            this.handleUnstableSettingConfiguration(setting, configuration, markerData);
            if (this.handlePolicyConfiguration(setting, configuration, markerData)) {
              continue;
            }
            switch (this.settingsEditorModel.configurationTarget) {
              case ConfigurationTarget.USER_LOCAL:
                this.handleLocalUserConfiguration(setting, configuration, markerData);
                break;
              case ConfigurationTarget.USER_REMOTE:
                this.handleRemoteUserConfiguration(setting, configuration, markerData);
                break;
              case ConfigurationTarget.WORKSPACE:
                this.handleWorkspaceConfiguration(setting, configuration, markerData);
                break;
              case ConfigurationTarget.WORKSPACE_FOLDER:
                this.handleWorkspaceFolderConfiguration(setting, configuration, markerData);
                break;
            }
          } else {
            markerData.push(this.generateUnknownConfigurationMarker(setting));
          }
        }
      }
    }
    return markerData;
  }
  handlePolicyConfiguration(setting, configuration, markerData) {
    if (!configuration.policy) {
      return false;
    }
    if (this.configurationService.inspect(setting.key).policyValue === void 0) {
      return false;
    }
    if (this.settingsEditorModel.configurationTarget === ConfigurationTarget.DEFAULT) {
      return false;
    }
    markerData.push({
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unsupportedPolicySetting", "This setting cannot be applied because it is configured in the system policy.")
    });
    return true;
  }
  handleOverrides(overrides, configurationRegistry, markerData) {
    for (const setting of overrides || []) {
      const configuration = configurationRegistry[setting.key];
      if (configuration) {
        if (configuration.scope !== ConfigurationScope.LANGUAGE_OVERRIDABLE) {
          markerData.push({
            severity: MarkerSeverity.Hint,
            tags: [MarkerTag.Unnecessary],
            ...setting.range,
            message: nls.localize("unsupportLanguageOverrideSetting", "This setting cannot be applied because it is not registered as language override setting.")
          });
        }
      } else {
        markerData.push(this.generateUnknownConfigurationMarker(setting));
      }
    }
  }
  handleLocalUserConfiguration(setting, configuration, markerData) {
    if (!this.userDataProfileService.currentProfile.isDefault && !this.userDataProfileService.currentProfile.useDefaultFlags?.settings) {
      if (isEqual(this.userDataProfilesService.defaultProfile.settingsResource, this.settingsEditorModel.uri) && !this.configurationService.isSettingAppliedForAllProfiles(setting.key)) {
        markerData.push({
          severity: MarkerSeverity.Hint,
          tags: [MarkerTag.Unnecessary],
          ...setting.range,
          message: nls.localize("defaultProfileSettingWhileNonDefaultActive", "This setting cannot be applied while a non-default profile is active. It will be applied when the default profile is active.")
        });
      } else if (isEqual(this.userDataProfileService.currentProfile.settingsResource, this.settingsEditorModel.uri)) {
        if (configuration.scope && APPLICATION_SCOPES.includes(configuration.scope)) {
          markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
        } else if (this.configurationService.isSettingAppliedForAllProfiles(setting.key)) {
          markerData.push({
            severity: MarkerSeverity.Hint,
            tags: [MarkerTag.Unnecessary],
            ...setting.range,
            message: nls.localize("allProfileSettingWhileInNonDefaultProfileSetting", "This setting cannot be applied because it is configured to be applied in all profiles using setting {0}. Value from the default profile will be used instead.", APPLY_ALL_PROFILES_SETTING)
          });
        }
      }
    }
    if (this.environmentService.remoteAuthority && (configuration.scope === ConfigurationScope.MACHINE || configuration.scope === ConfigurationScope.APPLICATION_MACHINE || configuration.scope === ConfigurationScope.MACHINE_OVERRIDABLE)) {
      markerData.push({
        severity: MarkerSeverity.Hint,
        tags: [MarkerTag.Unnecessary],
        ...setting.range,
        message: nls.localize("unsupportedRemoteMachineSetting", "This setting cannot be applied in this window. It will be applied when you open a local window.")
      });
    }
  }
  handleRemoteUserConfiguration(setting, configuration, markerData) {
    if (configuration.scope === ConfigurationScope.APPLICATION) {
      markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
    }
  }
  handleWorkspaceConfiguration(setting, configuration, markerData) {
    if (configuration.scope && APPLICATION_SCOPES.includes(configuration.scope)) {
      markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
    }
    if (configuration.scope === ConfigurationScope.MACHINE) {
      markerData.push(this.generateUnsupportedMachineSettingMarker(setting));
    }
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && configuration.restricted) {
      const marker = this.generateUntrustedSettingMarker(setting);
      markerData.push(marker);
      const codeActions = this.generateUntrustedSettingCodeActions([marker]);
      this.addCodeActions(marker, codeActions);
    }
  }
  handleWorkspaceFolderConfiguration(setting, configuration, markerData) {
    if (configuration.scope && APPLICATION_SCOPES.includes(configuration.scope)) {
      markerData.push(this.generateUnsupportedApplicationSettingMarker(setting));
    }
    if (configuration.scope === ConfigurationScope.MACHINE) {
      markerData.push(this.generateUnsupportedMachineSettingMarker(setting));
    }
    if (configuration.scope === ConfigurationScope.WINDOW) {
      markerData.push({
        severity: MarkerSeverity.Hint,
        tags: [MarkerTag.Unnecessary],
        ...setting.range,
        message: nls.localize("unsupportedWindowSetting", "This setting cannot be applied in this workspace. It will be applied when you open the containing workspace folder directly.")
      });
    }
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && configuration.restricted) {
      const marker = this.generateUntrustedSettingMarker(setting);
      markerData.push(marker);
      const codeActions = this.generateUntrustedSettingCodeActions([marker]);
      this.addCodeActions(marker, codeActions);
    }
  }
  handleUnstableSettingConfiguration(setting, configuration, markerData) {
    if (configuration.tags?.includes("preview")) {
      markerData.push(this.generatePreviewSettingMarker(setting));
    } else if (configuration.tags?.includes("experimental")) {
      markerData.push(this.generateExperimentalSettingMarker(setting));
    }
  }
  generateUnsupportedApplicationSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unsupportedApplicationSetting", "This setting has an application scope and can only be set in the settings file from the Default profile.")
    };
  }
  generateUnsupportedMachineSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unsupportedMachineSetting", "This setting can only be applied in user settings in local window or in remote settings in remote window.")
    };
  }
  generateUntrustedSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Warning,
      ...setting.range,
      message: nls.localize("untrustedSetting", "This setting can only be applied in a trusted workspace.")
    };
  }
  generateUnknownConfigurationMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      tags: [MarkerTag.Unnecessary],
      ...setting.range,
      message: nls.localize("unknown configuration setting", "Unknown Configuration Setting")
    };
  }
  generateUntrustedSettingCodeActions(diagnostics) {
    return [{
      title: nls.localize("manage workspace trust", "Manage Workspace Trust"),
      command: {
        id: "workbench.trust.manage",
        title: nls.localize("manage workspace trust", "Manage Workspace Trust")
      },
      diagnostics,
      kind: CodeActionKind.QuickFix.value
    }];
  }
  generatePreviewSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      ...setting.range,
      message: PREVIEW_INDICATOR_DESCRIPTION
    };
  }
  generateExperimentalSettingMarker(setting) {
    return {
      severity: MarkerSeverity.Hint,
      ...setting.range,
      message: EXPERIMENTAL_INDICATOR_DESCRIPTION
    };
  }
  addCodeActions(range, codeActions) {
    let actions = this.codeActions.get(this.settingsEditorModel.uri);
    if (!actions) {
      actions = [];
      this.codeActions.set(this.settingsEditorModel.uri, actions);
    }
    actions.push([Range.lift(range), codeActions]);
  }
  dispose() {
    this.markerService.remove("UnsupportedSettingsRenderer", [this.settingsEditorModel.uri]);
    this.codeActions.clear();
    super.dispose();
  }
};
UnsupportedSettingsRenderer = __decorateClass([
  __decorateParam(2, IMarkerService),
  __decorateParam(3, IWorkbenchEnvironmentService),
  __decorateParam(4, IWorkbenchConfigurationService),
  __decorateParam(5, IWorkspaceTrustManagementService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, ILanguageFeaturesService),
  __decorateParam(8, IUserDataProfileService),
  __decorateParam(9, IUserDataProfilesService)
], UnsupportedSettingsRenderer);
let McpSettingsRenderer = class extends Disposable {
  constructor(editor, settingsEditorModel, markerService, uriIdentityService, languageFeaturesService) {
    super();
    this.editor = editor;
    this.settingsEditorModel = settingsEditorModel;
    this.markerService = markerService;
    this.uriIdentityService = uriIdentityService;
    this.renderingDelayer = this._register(new Delayer(200));
    this.codeActions = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
    this._register(this.editor.getModel().onDidChangeContent(() => this.delayedRender()));
    this._register(languageFeaturesService.codeActionProvider.register({ pattern: settingsEditorModel.uri.path }, this));
  }
  delayedRender() {
    this.renderingDelayer.trigger(() => this.render());
  }
  render() {
    this.codeActions.clear();
    const markerData = this.generateMarkerData();
    if (markerData.length) {
      this.markerService.changeOne("McpSettingsRenderer", this.settingsEditorModel.uri, markerData);
    } else {
      this.markerService.remove("McpSettingsRenderer", [this.settingsEditorModel.uri]);
    }
  }
  async provideCodeActions(model, range, context, token) {
    const actions = [];
    const codeActionsByRange = this.codeActions.get(model.uri);
    if (codeActionsByRange) {
      for (const [codeActionsRange, codeActions] of codeActionsByRange) {
        if (codeActionsRange.containsRange(range)) {
          actions.push(...codeActions);
        }
      }
    }
    return {
      actions,
      dispose: () => {
      }
    };
  }
  generateMarkerData() {
    const markerData = [];
    if (this.settingsEditorModel.configurationTarget !== ConfigurationTarget.USER_LOCAL && this.settingsEditorModel.configurationTarget !== ConfigurationTarget.USER_REMOTE) {
      return markerData;
    }
    for (const settingsGroup of this.settingsEditorModel.settingsGroups) {
      for (const section of settingsGroup.sections) {
        for (const setting of section.settings) {
          if (setting.key === mcpConfigurationSection) {
            const marker = this.generateMcpConfigurationMarker(setting);
            markerData.push(marker);
            const codeActions = this.generateMcpConfigurationCodeActions([marker]);
            this.addCodeActions(setting.range, codeActions);
          }
        }
      }
    }
    return markerData;
  }
  generateMcpConfigurationMarker(setting) {
    const isRemote = this.settingsEditorModel.configurationTarget === ConfigurationTarget.USER_REMOTE;
    const message = isRemote ? nls.localize("mcp.renderer.remoteConfigFound", "MCP servers should not be configured in remote user settings. Use the dedicated MCP configuration instead.") : nls.localize("mcp.renderer.userConfigFound", "MCP servers should not be configured in user settings. Use the dedicated MCP configuration instead.");
    return {
      severity: MarkerSeverity.Warning,
      ...setting.range,
      message
    };
  }
  generateMcpConfigurationCodeActions(diagnostics) {
    const isRemote = this.settingsEditorModel.configurationTarget === ConfigurationTarget.USER_REMOTE;
    const openConfigLabel = isRemote ? nls.localize("mcp.renderer.openRemoteConfig", "Open Remote User MCP Configuration") : nls.localize("mcp.renderer.openUserConfig", "Open User MCP Configuration");
    const commandId = isRemote ? McpCommandIds.OpenRemoteUserMcp : McpCommandIds.OpenUserMcp;
    return [{
      title: openConfigLabel,
      command: {
        id: commandId,
        title: openConfigLabel
      },
      diagnostics,
      kind: CodeActionKind.QuickFix.value
    }];
  }
  addCodeActions(range, codeActions) {
    let actions = this.codeActions.get(this.settingsEditorModel.uri);
    if (!actions) {
      actions = [];
      this.codeActions.set(this.settingsEditorModel.uri, actions);
    }
    actions.push([Range.lift(range), codeActions]);
  }
  dispose() {
    this.markerService.remove("McpSettingsRenderer", [this.settingsEditorModel.uri]);
    this.codeActions.clear();
    super.dispose();
  }
};
McpSettingsRenderer = __decorateClass([
  __decorateParam(2, IMarkerService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, ILanguageFeaturesService)
], McpSettingsRenderer);
let WorkspaceConfigurationRenderer = class extends Disposable {
  constructor(editor, workspaceSettingsEditorModel, workspaceContextService, markerService) {
    super();
    this.editor = editor;
    this.workspaceSettingsEditorModel = workspaceSettingsEditorModel;
    this.workspaceContextService = workspaceContextService;
    this.markerService = markerService;
    this.renderingDelayer = this._register(new Delayer(200));
    this.decorations = this.editor.createDecorationsCollection();
    this._register(this.editor.getModel().onDidChangeContent(() => this.renderingDelayer.trigger(() => this.render())));
  }
  static {
    this.supportedKeys = ["folders", "tasks", "launch", "extensions", "settings", "remoteAuthority", "transient"];
  }
  render() {
    const markerData = [];
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.WORKSPACE && this.workspaceSettingsEditorModel instanceof WorkspaceConfigurationEditorModel) {
      const ranges = [];
      for (const settingsGroup of this.workspaceSettingsEditorModel.configurationGroups) {
        for (const section of settingsGroup.sections) {
          for (const setting of section.settings) {
            if (!WorkspaceConfigurationRenderer.supportedKeys.includes(setting.key)) {
              markerData.push({
                severity: MarkerSeverity.Hint,
                tags: [MarkerTag.Unnecessary],
                ...setting.range,
                message: nls.localize("unsupportedProperty", "Unsupported Property")
              });
            }
          }
        }
      }
      this.decorations.set(ranges.map((range) => this.createDecoration(range)));
    }
    if (markerData.length) {
      this.markerService.changeOne("WorkspaceConfigurationRenderer", this.workspaceSettingsEditorModel.uri, markerData);
    } else {
      this.markerService.remove("WorkspaceConfigurationRenderer", [this.workspaceSettingsEditorModel.uri]);
    }
  }
  static {
    this._DIM_CONFIGURATION_ = ModelDecorationOptions.register({
      description: "dim-configuration",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      inlineClassName: "dim-configuration"
    });
  }
  createDecoration(range) {
    return {
      range,
      options: WorkspaceConfigurationRenderer._DIM_CONFIGURATION_
    };
  }
  dispose() {
    this.markerService.remove("WorkspaceConfigurationRenderer", [this.workspaceSettingsEditorModel.uri]);
    this.decorations.clear();
    super.dispose();
  }
};
WorkspaceConfigurationRenderer = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IMarkerService)
], WorkspaceConfigurationRenderer);
export {
  UserSettingsRenderer,
  WorkspaceSettingsRenderer
};
