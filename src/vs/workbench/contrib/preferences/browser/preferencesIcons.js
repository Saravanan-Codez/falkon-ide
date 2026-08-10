import { Codicon } from "../../../../base/common/codicons.js";
import { localize } from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
const settingsScopeDropDownIcon = registerIcon("settings-folder-dropdown", Codicon.chevronDown, localize("settingsScopeDropDownIcon", "Icon for the folder dropdown button in the split JSON Settings editor."));
const settingsMoreActionIcon = registerIcon("settings-more-action", Codicon.gear, localize("settingsMoreActionIcon", "Icon for the 'more actions' action in the Settings UI."));
const keybindingsRecordKeysIcon = registerIcon("keybindings-record-keys", Codicon.recordKeys, localize("keybindingsRecordKeysIcon", "Icon for the 'record keys' action in the keybinding UI."));
const keybindingsSortIcon = registerIcon("keybindings-sort", Codicon.sortPrecedence, localize("keybindingsSortIcon", "Icon for the 'sort by precedence' toggle in the keybinding UI."));
const keybindingsEditIcon = registerIcon("keybindings-edit", Codicon.edit, localize("keybindingsEditIcon", "Icon for the edit action in the keybinding UI."));
const keybindingsAddIcon = registerIcon("keybindings-add", Codicon.add, localize("keybindingsAddIcon", "Icon for the add action in the keybinding UI."));
const settingsEditIcon = registerIcon("settings-edit", Codicon.edit, localize("settingsEditIcon", "Icon for the edit action in the Settings UI."));
const settingsRemoveIcon = registerIcon("settings-remove", Codicon.close, localize("settingsRemoveIcon", "Icon for the remove action in the Settings UI."));
const settingsDiscardIcon = registerIcon("settings-discard", Codicon.discard, localize("preferencesDiscardIcon", "Icon for the discard action in the Settings UI."));
const preferencesClearInputIcon = registerIcon("preferences-clear-input", Codicon.clearAll, localize("preferencesClearInput", "Icon for clear input in the Settings and keybinding UI."));
const preferencesAiResultsIcon = registerIcon("preferences-ai-results", Codicon.sparkle, localize("preferencesAiResults", "Icon for showing AI results in the Settings UI."));
const preferencesFilterIcon = registerIcon("preferences-filter", Codicon.filter, localize("settingsFilter", "Icon for the button that suggests filters for the Settings UI."));
const preferencesOpenSettingsIcon = registerIcon("preferences-open-settings", Codicon.goToFile, localize("preferencesOpenSettings", "Icon for open settings commands."));
export {
  keybindingsAddIcon,
  keybindingsEditIcon,
  keybindingsRecordKeysIcon,
  keybindingsSortIcon,
  preferencesAiResultsIcon,
  preferencesClearInputIcon,
  preferencesFilterIcon,
  preferencesOpenSettingsIcon,
  settingsDiscardIcon,
  settingsEditIcon,
  settingsMoreActionIcon,
  settingsRemoveIcon,
  settingsScopeDropDownIcon
};
