import { isLanguageModelVendorAbsenceConclusive } from "./languageModels.js";
import { isAgentHostTarget } from "./chatSessionsService.js";
function resolveModelIdentifier(models, identifier, isAbsenceConclusive) {
  if (!identifier) {
    return { kind: "notRequested" };
  }
  const model = models.find((model2) => model2.identifier === identifier);
  if (model) {
    return { kind: "available", model };
  }
  return isAbsenceConclusive ? { kind: "unavailable", identifier } : { kind: "pending", identifier };
}
function resolveModelIdentifierFromCatalog(models, identifier, vendorResolution) {
  if (!identifier) {
    return { kind: "notRequested" };
  }
  const separator = identifier.search(/[/:]/);
  const vendor = separator === -1 ? void 0 : identifier.substring(0, separator);
  const hasLive = vendor ? vendorResolution.hasLiveModels(vendor) : false;
  const isAbsenceConclusive = !vendor || isLanguageModelVendorAbsenceConclusive(
    vendor,
    hasLive,
    vendorResolution.hasResolved(vendor)
  ) && (hasLive || !isAgentHostTarget(vendor));
  return resolveModelIdentifier(models, identifier, isAbsenceConclusive);
}
function getRegisteredLanguageModels(languageModelsService) {
  return languageModelsService.getLanguageModelIds().map((identifier) => {
    const metadata = languageModelsService.lookupLanguageModel(identifier);
    return metadata ? { identifier, metadata } : void 0;
  }).filter((model) => model !== void 0);
}
function hasOwnLiveModels(models, vendor) {
  return models.some((model) => model.metadata.vendor === vendor && model.metadata.byokModelIdentifier === void 0);
}
function resolveModelIdentifierFromLanguageModels(models, identifier, languageModelsService, allModels) {
  return resolveModelIdentifierFromCatalog(models, identifier, {
    hasLiveModels: (vendor) => hasOwnLiveModels(allModels, vendor),
    hasResolved: (vendor) => languageModelsService.hasResolvedVendor(vendor)
  });
}
const AUTO_MODEL_ID = "auto";
function compareModelVersions(a, b) {
  const rawA = a ?? "";
  const rawB = b ?? "";
  const segmentsA = rawA.match(/\d+/g)?.map(Number) ?? [];
  const segmentsB = rawB.match(/\d+/g)?.map(Number) ?? [];
  const length = Math.max(segmentsA.length, segmentsB.length);
  for (let index = 0; index < length; index++) {
    const numberA = segmentsA[index] ?? 0;
    const numberB = segmentsB[index] ?? 0;
    if (numberA !== numberB) {
      return numberA - numberB;
    }
  }
  return rawA.localeCompare(rawB);
}
function resolveConfiguredModel(configuredValue, models) {
  const value = configuredValue?.trim().toLowerCase();
  if (!value) {
    return void 0;
  }
  if (value === AUTO_MODEL_ID) {
    return models.find((model) => model.metadata.id?.trim().toLowerCase() === AUTO_MODEL_ID);
  }
  const byId = models.find((model) => model.metadata.id?.trim().toLowerCase() === value);
  if (byId) {
    return byId;
  }
  const family = models.filter((model) => model.metadata.family?.trim().toLowerCase() === value);
  return family.length > 0 ? family.reduce((latest, candidate) => compareModelVersions(candidate.metadata.version, latest.metadata.version) > 0 ? candidate : latest) : void 0;
}
var ModelSelectionReason = /* @__PURE__ */ ((ModelSelectionReason2) => {
  ModelSelectionReason2["ConfiguredDefault"] = "configuredDefault";
  ModelSelectionReason2["FirstAvailable"] = "firstAvailable";
  ModelSelectionReason2["NoModels"] = "noModels";
  ModelSelectionReason2["ProgrammaticSelection"] = "programmaticSelection";
  ModelSelectionReason2["Remembered"] = "remembered";
  ModelSelectionReason2["RemovedModelFallback"] = "removedModelFallback";
  ModelSelectionReason2["SessionRestore"] = "sessionRestore";
  ModelSelectionReason2["NewChatRepush"] = "newChatRepush";
  ModelSelectionReason2["UserSelection"] = "userSelection";
  return ModelSelectionReason2;
})(ModelSelectionReason || {});
function isAuthoritativeModelSelectionReason(reason) {
  return reason === "programmaticSelection" /* ProgrammaticSelection */ || reason === "sessionRestore" /* SessionRestore */ || reason === "userSelection" /* UserSelection */;
}
function isInConversationModelChoice(reason) {
  return reason === "userSelection" /* UserSelection */ || reason === "programmaticSelection" /* ProgrammaticSelection */;
}
function resolveInitialModelSelection(input) {
  if (input.configuredModel) {
    return { kind: "apply", model: input.configuredModel, reason: "configuredDefault" /* ConfiguredDefault */ };
  }
  if (input.desiredModelResolution.kind === "available") {
    return { kind: "apply", model: input.desiredModelResolution.model, reason: input.desiredReason };
  }
  if (input.desiredModelResolution.kind === "pending") {
    return { kind: "pending", selection: { reference: input.desiredModelResolution.identifier } };
  }
  return input.fallbackModel ? { kind: "apply", model: input.fallbackModel, reason: input.fallbackReason } : { kind: "none" };
}
function transitionModelSelection(input) {
  const { session, models, previous } = input;
  const sessionKey = session.kind === "none" ? void 0 : session.key;
  const chatKey = session.kind === "none" ? void 0 : session.chatKey;
  const sessionModelId = session.kind === "none" ? void 0 : session.modelId;
  const sessionChanged = sessionKey !== previous.sessionKey;
  const currentModel = sessionChanged ? void 0 : previous.currentModel;
  const currentReason = sessionChanged ? void 0 : previous.currentReason;
  const sessionModel = sessionModelId ? models.available.find((model) => model.identifier === sessionModelId) : void 0;
  const fallbackModel = models.available.find((model) => model.identifier === models.rememberedModelId) ?? models.fallbackModel;
  const newConversation = session.kind === "untitled" && !sessionChanged && chatKey !== previous.lastPushedChatKey;
  const automaticSelection = currentReason === "configuredDefault" /* ConfiguredDefault */ || currentReason === "firstAvailable" /* FirstAvailable */ || currentReason === "remembered" /* Remembered */ || currentReason === "newChatRepush" /* NewChatRepush */;
  const configuredModelValue = session.kind === "untitled" && (newConversation || !newConversation && (!sessionModelId || automaticSelection) && !isAuthoritativeModelSelectionReason(currentReason)) ? models.configuredModel : void 0;
  const configuredModel = configuredModelValue ? resolveConfiguredModel(models.configuredModel, models.available) : void 0;
  if (configuredModel) {
    if (chatKey === previous.lastPushedChatKey && currentReason === "configuredDefault" /* ConfiguredDefault */ && currentModel?.identifier === configuredModel.identifier) {
      return { currentModel, currentReason, pendingSelection: void 0, effect: { kind: "none" }, sessionKey, lastPushedChatKey: previous.lastPushedChatKey };
    }
    return applyResult(sessionKey, chatKey, configuredModel, "configuredDefault" /* ConfiguredDefault */);
  }
  if (session.kind === "existing" && models.desiredModelResolution.kind === "pending") {
    return {
      currentModel: void 0,
      currentReason: void 0,
      pendingSelection: { reference: models.desiredModelResolution.identifier },
      effect: currentModel ? { kind: "clear", reason: "sessionRestore" /* SessionRestore */ } : { kind: "none" },
      sessionKey,
      lastPushedChatKey: chatKey
    };
  }
  if (!currentModel && session.kind === "untitled" && sessionModel) {
    return {
      currentModel: sessionModel,
      currentReason: "sessionRestore" /* SessionRestore */,
      pendingSelection: void 0,
      effect: { kind: "none" },
      sessionKey,
      lastPushedChatKey: chatKey
    };
  }
  if (!currentModel && session.kind === "untitled") {
    const initial = resolveInitialModelSelection({
      configuredModel,
      desiredModelResolution: models.desiredModelResolution,
      desiredReason: sessionModelId ? "sessionRestore" /* SessionRestore */ : "remembered" /* Remembered */,
      fallbackModel,
      fallbackReason: "firstAvailable" /* FirstAvailable */
    });
    if (initial.kind === "pending") {
      return { currentModel: void 0, currentReason: void 0, pendingSelection: initial.selection, effect: { kind: "none" }, sessionKey, lastPushedChatKey: previous.lastPushedChatKey };
    }
    if (initial.kind === "apply") {
      return applyResult(sessionKey, chatKey, initial.model, initial.reason);
    }
  }
  if (models.available.length === 0) {
    return {
      currentModel: void 0,
      currentReason: void 0,
      pendingSelection: void 0,
      effect: currentModel ? { kind: "clear", reason: "noModels" /* NoModels */ } : { kind: "none" },
      sessionKey,
      lastPushedChatKey: previous.lastPushedChatKey
    };
  }
  if (session.kind === "existing") {
    if (sessionModel) {
      return {
        currentModel: sessionModel,
        currentReason: "sessionRestore" /* SessionRestore */,
        pendingSelection: void 0,
        effect: { kind: "none" },
        sessionKey,
        lastPushedChatKey: chatKey
      };
    }
    if (fallbackModel) {
      return applyResult(sessionKey, chatKey, fallbackModel, sessionModelId ? "removedModelFallback" /* RemovedModelFallback */ : "firstAvailable" /* FirstAvailable */);
    }
  }
  const currentModelAvailable = !!currentModel && models.available.some((model) => model.identifier === currentModel.identifier);
  if (currentModel && !currentModelAvailable) {
    if (models.desiredModelResolution.kind === "pending") {
      return {
        currentModel: void 0,
        currentReason: void 0,
        pendingSelection: { reference: models.desiredModelResolution.identifier },
        effect: { kind: "clear", reason: "sessionRestore" /* SessionRestore */ },
        sessionKey,
        lastPushedChatKey: previous.lastPushedChatKey
      };
    }
    if (fallbackModel) {
      return applyResult(sessionKey, chatKey, fallbackModel, "removedModelFallback" /* RemovedModelFallback */);
    }
    return {
      currentModel: void 0,
      currentReason: void 0,
      pendingSelection: void 0,
      effect: { kind: "clear", reason: "noModels" /* NoModels */ },
      sessionKey,
      lastPushedChatKey: previous.lastPushedChatKey
    };
  }
  if (session.kind === "untitled" && currentModel && currentReason === "firstAvailable" /* FirstAvailable */) {
    const initial = resolveInitialModelSelection({
      configuredModel,
      desiredModelResolution: models.desiredModelResolution,
      desiredReason: "remembered" /* Remembered */,
      fallbackModel,
      fallbackReason: "firstAvailable" /* FirstAvailable */
    });
    if (initial.kind === "pending") {
      return { currentModel: void 0, currentReason: void 0, pendingSelection: initial.selection, effect: { kind: "clear", reason: "sessionRestore" /* SessionRestore */ }, sessionKey, lastPushedChatKey: previous.lastPushedChatKey };
    }
    if (initial.kind === "apply" && initial.model.identifier !== currentModel.identifier) {
      return applyResult(sessionKey, chatKey, initial.model, initial.reason);
    }
  }
  if (sessionModel && currentModel && sessionModel.identifier !== currentModel.identifier) {
    return { currentModel: sessionModel, currentReason: "sessionRestore" /* SessionRestore */, pendingSelection: void 0, effect: { kind: "none" }, sessionKey, lastPushedChatKey: chatKey };
  }
  if (session.kind === "untitled" && chatKey !== previous.lastPushedChatKey && currentModel && models.available.some((model) => model.identifier === currentModel.identifier)) {
    return applyResult(sessionKey, chatKey, currentModel, "newChatRepush" /* NewChatRepush */);
  }
  return { currentModel, currentReason, pendingSelection: void 0, effect: { kind: "none" }, sessionKey, lastPushedChatKey: previous.lastPushedChatKey };
}
function applyResult(sessionKey, chatKey, model, reason) {
  return { currentModel: model, currentReason: reason, pendingSelection: void 0, effect: { kind: "apply", model, reason }, sessionKey, lastPushedChatKey: chatKey };
}
export {
  ModelSelectionReason,
  getRegisteredLanguageModels,
  isAuthoritativeModelSelectionReason,
  isInConversationModelChoice,
  resolveConfiguredModel,
  resolveInitialModelSelection,
  resolveModelIdentifier,
  resolveModelIdentifierFromCatalog,
  resolveModelIdentifierFromLanguageModels,
  transitionModelSelection
};
