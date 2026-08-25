import { ChatAgentLocation, ChatModeKind } from "../../../common/constants.js";
import { ILanguageModelChatMetadata, isLanguageModelVendorAbsenceConclusive } from "../../../common/languageModels.js";
import { localChatSessionType } from "../../../common/chatSessionsService.js";
import { getChatSessionType, isUntitledChatSession } from "../../../common/model/chatUri.js";
function filterModelsForSession(models, sessionType, currentModeKind, location) {
  if (sessionType && sessionType !== "local" && hasModelsTargetingSession(models, sessionType)) {
    return models.filter(
      (entry) => entry.metadata?.targetChatSessionType === sessionType && entry.metadata?.isUserSelectable !== false
    );
  }
  return models.filter(
    (entry) => !entry.metadata?.targetChatSessionType && entry.metadata?.isUserSelectable !== false && isModelSupportedForMode(entry, currentModeKind) && isModelSupportedForInlineChat(entry, location)
  );
}
function isModelSupportedForMode(model, currentModeKind) {
  if (currentModeKind === ChatModeKind.Agent) {
    return ILanguageModelChatMetadata.suitableForAgentMode(model.metadata);
  }
  return true;
}
function isModelSupportedForInlineChat(model, location) {
  if (location !== ChatAgentLocation.EditorInline) {
    return true;
  }
  return !!model.metadata.capabilities?.toolCalling;
}
function hasModelsTargetingSession(allModels, sessionType) {
  if (!sessionType) {
    return false;
  }
  return allModels.some((m) => m.metadata.targetChatSessionType === sessionType);
}
function isModelValidForSession(model, allModels, sessionType) {
  if (hasModelsTargetingSession(allModels, sessionType)) {
    return model.metadata.targetChatSessionType === sessionType;
  }
  return !model.metadata.targetChatSessionType;
}
const getAgentHostByokManageModelsIdentifier = ILanguageModelChatMetadata.getAgentHostByokManageModelsIdentifier;
function isModelHiddenInPicker(model, isModelHidden) {
  if (isModelHidden(model.identifier)) {
    return true;
  }
  const manageModelsIdentifier = getAgentHostByokManageModelsIdentifier(model.metadata);
  return manageModelsIdentifier !== void 0 && isModelHidden(manageModelsIdentifier);
}
function shouldDropAgnosticDraftModel(draftModel, allModels, sessionType) {
  return !!draftModel && !isModelValidForSession(draftModel, allModels, sessionType);
}
function isNewConversation(sessionResource, hasNoRequests) {
  return hasNoRequests && (getChatSessionType(sessionResource) === localChatSessionType || isUntitledChatSession(sessionResource));
}
function shouldRestorePerTypeModelOnSessionSwitch(isEmpty, sessionOwnsPool, hadIncomingModel) {
  return isEmpty && sessionOwnsPool && !hadIncomingModel;
}
function findBestMatchingModel(previous, pool) {
  if (!previous || pool.length === 0) {
    return void 0;
  }
  const id = previous.metadata.id?.trim().toLowerCase();
  const family = previous.metadata.family?.trim().toLowerCase();
  const name = previous.metadata.name?.trim().toLowerCase();
  return (id ? pool.find((m) => m.metadata.id?.trim().toLowerCase() === id) : void 0) ?? (family ? pool.find((m) => m.metadata.family?.trim().toLowerCase() === family) : void 0) ?? (name ? pool.find((m) => m.metadata.name?.trim().toLowerCase() === name) : void 0);
}
function findDefaultModel(models, location) {
  return models.find((m) => m.metadata.isDefaultForLocation[location]) || models[0];
}
function shouldResetModelToDefault(currentModel, availableModels, context, allModels) {
  if (!currentModel) {
    return true;
  }
  if (!availableModels.some((m) => m.identifier === currentModel.identifier)) {
    return true;
  }
  if (!isModelSupportedForMode(currentModel, context.currentModeKind)) {
    return true;
  }
  if (!isModelSupportedForInlineChat(currentModel, context.location)) {
    return true;
  }
  if (!isModelValidForSession(currentModel, allModels, context.sessionType)) {
    return true;
  }
  return false;
}
function resolveModelFromSyncState(stateModel, currentModel, allModels, sessionType, context) {
  if (!isModelValidForSession(stateModel, allModels, sessionType)) {
    return { action: "default" };
  }
  if (currentModel && currentModel.identifier === stateModel.identifier) {
    return { action: "keep" };
  }
  if (context) {
    if (!isModelSupportedForMode(stateModel, context.currentModeKind)) {
      return { action: "default" };
    }
    if (!isModelSupportedForInlineChat(stateModel, context.location)) {
      return { action: "default" };
    }
  }
  return { action: "apply" };
}
function mergeModelsWithCache(liveModels, cachedModels, contributedVendors, resolvedVendors) {
  if (contributedVendors.size === 0 && liveModels.length === 0) {
    return cachedModels;
  }
  const liveVendors = new Set(liveModels.map((m) => m.metadata.vendor));
  const usableCached = cachedModels.filter((m) => {
    const vendor = m.metadata.vendor;
    if (!contributedVendors.has(vendor) || liveVendors.has(vendor)) {
      return false;
    }
    if (isLanguageModelVendorAbsenceConclusive(vendor, liveVendors.has(vendor), resolvedVendors?.has(vendor) ?? false)) {
      return false;
    }
    return true;
  });
  return [...liveModels, ...usableCached];
}
function shouldResetOnModelListChange(currentModelId, availableModels) {
  if (!currentModelId) {
    return true;
  }
  return !availableModels.some((m) => m.identifier === currentModelId);
}
export {
  filterModelsForSession,
  findBestMatchingModel,
  findDefaultModel,
  getAgentHostByokManageModelsIdentifier,
  hasModelsTargetingSession,
  isModelHiddenInPicker,
  isModelSupportedForInlineChat,
  isModelSupportedForMode,
  isModelValidForSession,
  isNewConversation,
  mergeModelsWithCache,
  resolveModelFromSyncState,
  shouldDropAgnosticDraftModel,
  shouldResetModelToDefault,
  shouldResetOnModelListChange,
  shouldRestorePerTypeModelOnSessionSwitch
};
