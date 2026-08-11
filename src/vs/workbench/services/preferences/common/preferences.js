import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../common/editor.js";
var SettingValueType = /* @__PURE__ */ ((SettingValueType2) => {
  SettingValueType2["Null"] = "null";
  SettingValueType2["Enum"] = "enum";
  SettingValueType2["String"] = "string";
  SettingValueType2["MultilineString"] = "multiline-string";
  SettingValueType2["Integer"] = "integer";
  SettingValueType2["Number"] = "number";
  SettingValueType2["Boolean"] = "boolean";
  SettingValueType2["Array"] = "array";
  SettingValueType2["Exclude"] = "exclude";
  SettingValueType2["Include"] = "include";
  SettingValueType2["Complex"] = "complex";
  SettingValueType2["NullableInteger"] = "nullable-integer";
  SettingValueType2["NullableNumber"] = "nullable-number";
  SettingValueType2["Object"] = "object";
  SettingValueType2["BooleanObject"] = "boolean-object";
  SettingValueType2["LanguageTag"] = "language-tag";
  SettingValueType2["ExtensionToggle"] = "extension-toggle";
  SettingValueType2["ComplexObject"] = "complex-object";
  return SettingValueType2;
})(SettingValueType || {});
var SettingMatchType = /* @__PURE__ */ ((SettingMatchType2) => {
  SettingMatchType2[SettingMatchType2["None"] = 0] = "None";
  SettingMatchType2[SettingMatchType2["LanguageTagSettingMatch"] = 1] = "LanguageTagSettingMatch";
  SettingMatchType2[SettingMatchType2["RemoteMatch"] = 2] = "RemoteMatch";
  SettingMatchType2[SettingMatchType2["NonContiguousQueryInSettingId"] = 4] = "NonContiguousQueryInSettingId";
  SettingMatchType2[SettingMatchType2["DescriptionOrValueMatch"] = 8] = "DescriptionOrValueMatch";
  SettingMatchType2[SettingMatchType2["NonContiguousWordsInSettingsLabel"] = 16] = "NonContiguousWordsInSettingsLabel";
  SettingMatchType2[SettingMatchType2["ContiguousWordsInSettingsLabel"] = 32] = "ContiguousWordsInSettingsLabel";
  SettingMatchType2[SettingMatchType2["ContiguousQueryInSettingId"] = 64] = "ContiguousQueryInSettingId";
  SettingMatchType2[SettingMatchType2["AllWordsInSettingsLabel"] = 128] = "AllWordsInSettingsLabel";
  SettingMatchType2[SettingMatchType2["ExactMatch"] = 256] = "ExactMatch";
  return SettingMatchType2;
})(SettingMatchType || {});
const SettingKeyMatchTypes = 128 /* AllWordsInSettingsLabel */ | 32 /* ContiguousWordsInSettingsLabel */ | 16 /* NonContiguousWordsInSettingsLabel */ | 4 /* NonContiguousQueryInSettingId */ | 64 /* ContiguousQueryInSettingId */;
function validateSettingsEditorOptions(options) {
  return {
    // Inherit provided options
    ...options,
    // Enforce some options for settings specifically
    override: DEFAULT_EDITOR_ASSOCIATION.id,
    pinned: true
  };
}
const IPreferencesService = createDecorator("preferencesService");
const DEFINE_KEYBINDING_EDITOR_CONTRIB_ID = "editor.contrib.defineKeybinding";
const FOLDER_SETTINGS_PATH = ".vscode/settings.json";
const DEFAULT_SETTINGS_EDITOR_SETTING = "workbench.settings.openDefaultSettings";
const USE_SPLIT_JSON_SETTING = "workbench.settings.useSplitJSON";
const ALWAYS_SHOW_ADVANCED_SETTINGS_SETTING = "workbench.settings.alwaysShowAdvancedSettings";
const SETTINGS_AUTHORITY = "settings";
export {
  ALWAYS_SHOW_ADVANCED_SETTINGS_SETTING,
  DEFAULT_SETTINGS_EDITOR_SETTING,
  DEFINE_KEYBINDING_EDITOR_CONTRIB_ID,
  FOLDER_SETTINGS_PATH,
  IPreferencesService,
  SETTINGS_AUTHORITY,
  SettingKeyMatchTypes,
  SettingMatchType,
  SettingValueType,
  USE_SPLIT_JSON_SETTING,
  validateSettingsEditorOptions
};
