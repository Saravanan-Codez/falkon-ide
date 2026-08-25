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
import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IPreferencesService } from "./preferences.js";
const SettingsEditorIcon = registerIcon("settings-editor-label-icon", Codicon.settings, nls.localize("settingsEditorLabelIcon", "Icon of the settings editor label."));
let SettingsEditor2Input = class extends EditorInput {
  constructor(_preferencesService) {
    super();
    this.resource = URI.from({
      scheme: Schemas.vscodeSettings,
      path: `settingseditor`
    });
    this._settingsModel = _preferencesService.createSettings2EditorModel();
  }
  static {
    this.ID = "workbench.input.settings2";
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof SettingsEditor2Input;
  }
  get typeId() {
    return SettingsEditor2Input.ID;
  }
  getName() {
    return nls.localize("settingsEditor2InputName", "Settings");
  }
  getIcon() {
    return SettingsEditorIcon;
  }
  async resolve() {
    return this._settingsModel;
  }
  dispose() {
    this._settingsModel.dispose();
    super.dispose();
  }
};
SettingsEditor2Input = __decorateClass([
  __decorateParam(0, IPreferencesService)
], SettingsEditor2Input);
const PreferencesEditorIcon = registerIcon("preferences-editor-label-icon", Codicon.settings, nls.localize("preferencesEditorLabelIcon", "Icon of the preferences editor label."));
class PreferencesEditorInput extends EditorInput {
  constructor() {
    super(...arguments);
    this.resource = URI.from({
      scheme: Schemas.vscodeSettings,
      path: `preferenceseditor`
    });
  }
  static {
    this.ID = "workbench.input.preferences";
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof PreferencesEditorInput;
  }
  get typeId() {
    return PreferencesEditorInput.ID;
  }
  getName() {
    return nls.localize("preferencesEditorInputName", "Preferences");
  }
  getIcon() {
    return PreferencesEditorIcon;
  }
  async resolve() {
    return null;
  }
}
export {
  PreferencesEditorInput,
  SettingsEditor2Input
};
