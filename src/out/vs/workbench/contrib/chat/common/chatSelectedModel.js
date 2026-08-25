import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ChatContextKeys } from "./actions/chatContextKeys.js";
import { COPILOT_VENDOR_ID } from "./languageModels.js";
const SELECTED_MODEL_STORAGE_KEY_PREFIX = "chat.currentLanguageModel.";
const SELECTED_MODEL_STORAGE_SCOPE = StorageScope.PROFILE;
const SELECTED_MODEL_STORAGE_TARGET = StorageTarget.USER;
function getSelectedModelStorageKey(location, modelTarget) {
  if (modelTarget) {
    return `${SELECTED_MODEL_STORAGE_KEY_PREFIX}${location}.${modelTarget}`;
  }
  return `${SELECTED_MODEL_STORAGE_KEY_PREFIX}${location}`;
}
function storeSelectedModel(storageService, location, modelTarget, identifier) {
  storageService.store(getSelectedModelStorageKey(location, modelTarget), identifier, SELECTED_MODEL_STORAGE_SCOPE, SELECTED_MODEL_STORAGE_TARGET);
}
function getStoredSelectedModel(storageService, location, modelTarget) {
  const key = getSelectedModelStorageKey(location, modelTarget);
  const isDefaultKey = `${key}.isDefault`;
  const identifier = storageService.get(key, SELECTED_MODEL_STORAGE_SCOPE);
  if (identifier) {
    const wasAutomaticDefault2 = storageService.getBoolean(isDefaultKey, SELECTED_MODEL_STORAGE_SCOPE);
    storageService.remove(isDefaultKey, SELECTED_MODEL_STORAGE_SCOPE);
    if (wasAutomaticDefault2) {
      storageService.remove(key, SELECTED_MODEL_STORAGE_SCOPE);
      return void 0;
    }
    return identifier;
  }
  const legacyIdentifier = storageService.get(key, StorageScope.APPLICATION);
  if (!legacyIdentifier) {
    return void 0;
  }
  const wasAutomaticDefault = storageService.getBoolean(isDefaultKey, StorageScope.APPLICATION, true);
  storageService.remove(key, StorageScope.APPLICATION);
  storageService.remove(isDefaultKey, StorageScope.APPLICATION);
  if (wasAutomaticDefault) {
    return void 0;
  }
  storeSelectedModel(storageService, location, modelTarget, legacyIdentifier);
  return legacyIdentifier;
}
function getSelectedModelIdentifier(contextKeyService, storageService) {
  const contextKeyModelId = contextKeyService.getContextKeyValue(ChatContextKeys.chatModelId.key);
  if (contextKeyModelId) {
    return contextKeyModelId;
  }
  return getPersistedSelectedModelIdentifier(contextKeyService, storageService);
}
function getPersistedSelectedModelIdentifier(contextKeyService, storageService) {
  const location = contextKeyService.getContextKeyValue(ChatContextKeys.location.key) ?? "panel";
  const sessionType = contextKeyService.getContextKeyValue(ChatContextKeys.chatSessionType.key) ?? "";
  const candidateKeys = sessionType ? [sessionType, void 0] : [void 0];
  for (const modelTarget of candidateKeys) {
    const persisted = getStoredSelectedModel(storageService, location, modelTarget);
    if (persisted) {
      return persisted;
    }
  }
  return void 0;
}
function getSelectedModelMetadata(contextKeyService, storageService, languageModelsService) {
  const modelId = getSelectedModelIdentifier(contextKeyService, storageService);
  if (!modelId) {
    return void 0;
  }
  const direct = languageModelsService.lookupLanguageModel(modelId);
  if (direct) {
    return direct;
  }
  const persistedId = getPersistedSelectedModelIdentifier(contextKeyService, storageService);
  if (persistedId && persistedId !== modelId) {
    return languageModelsService.lookupLanguageModel(persistedId);
  }
  return void 0;
}
function getSelectedModelVendor(contextKeyService, storageService, languageModelsService) {
  const metadata = getSelectedModelMetadata(contextKeyService, storageService, languageModelsService);
  if (metadata) {
    return metadata.vendor;
  }
  const modelId = getSelectedModelIdentifier(contextKeyService, storageService);
  if (modelId?.includes("/")) {
    return modelId.split("/")[0];
  }
  return void 0;
}
function isByokModel(metadata) {
  return metadata.isBYOK === true;
}
function isSelectedModelCopilot(contextKeyService, storageService, languageModelsService) {
  const metadata = getSelectedModelMetadata(contextKeyService, storageService, languageModelsService);
  if (metadata) {
    return !isByokModel(metadata);
  }
  const vendor = getSelectedModelVendor(contextKeyService, storageService, languageModelsService);
  if (!vendor) {
    return true;
  }
  return vendor === COPILOT_VENDOR_ID;
}
export {
  SELECTED_MODEL_STORAGE_KEY_PREFIX,
  SELECTED_MODEL_STORAGE_SCOPE,
  SELECTED_MODEL_STORAGE_TARGET,
  getPersistedSelectedModelIdentifier,
  getSelectedModelIdentifier,
  getSelectedModelMetadata,
  getSelectedModelStorageKey,
  getSelectedModelVendor,
  getStoredSelectedModel,
  isByokModel,
  isSelectedModelCopilot,
  storeSelectedModel
};
