import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const CHAT_USER_SELECTED_SESSION_TYPE_STORAGE_KEY = "chat.userSelectedSessionType";
const CHAT_PREFERRED_COPILOT_HARNESS_STORAGE_KEY = "chat.preferredCopilotHarness";
function getRememberedSessionType(storageService) {
  return storageService.get(CHAT_USER_SELECTED_SESSION_TYPE_STORAGE_KEY, StorageScope.PROFILE);
}
function storeUserSelectedSessionType(storageService, sessionType) {
  storageService.store(CHAT_USER_SELECTED_SESSION_TYPE_STORAGE_KEY, sessionType, StorageScope.PROFILE, StorageTarget.MACHINE);
}
function clearUserSelectedSessionType(storageService) {
  storageService.remove(CHAT_USER_SELECTED_SESSION_TYPE_STORAGE_KEY, StorageScope.PROFILE);
}
function hasPreferredCopilotHarness(storageService) {
  return storageService.getBoolean(CHAT_PREFERRED_COPILOT_HARNESS_STORAGE_KEY, StorageScope.PROFILE, false);
}
function markPreferredCopilotHarness(storageService) {
  storageService.store(CHAT_PREFERRED_COPILOT_HARNESS_STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.MACHINE);
}
export {
  CHAT_USER_SELECTED_SESSION_TYPE_STORAGE_KEY,
  clearUserSelectedSessionType,
  getRememberedSessionType,
  hasPreferredCopilotHarness,
  markPreferredCopilotHarness,
  storeUserSelectedSessionType
};
