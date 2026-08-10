import { normalizeManagedSettings } from "../../../../platform/policy/common/copilotManagedSettings.js";
function adaptManagedSettings(response, onWarn) {
  return { managedSettings: normalizeManagedSettings(response, onWarn) };
}
export {
  adaptManagedSettings
};
