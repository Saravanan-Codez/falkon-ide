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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { getSelectedModelStorageKey, getStoredSelectedModel, storeSelectedModel } from "../../../../workbench/contrib/chat/common/chatSelectedModel.js";
import { ChatAgentLocation, ChatConfiguration } from "../../../../workbench/contrib/chat/common/constants.js";
import { ModelSelectionReason, transitionModelSelection } from "../../../../workbench/contrib/chat/common/modelSelection.js";
import { ChatModelSelectionDiagnostics } from "../../../../workbench/contrib/chat/browser/widget/input/chatModelSelectionDiagnostics.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
const DEFAULT_MODEL_PICKER_OPTIONS = {
  useGroupedModelPicker: true,
  showFeatured: true,
  showUnavailableFeatured: false,
  showManageModelsAction: false,
  showAutoModel: true
};
function normalizeModelPickerOptions(options) {
  return {
    ...DEFAULT_MODEL_PICKER_OPTIONS,
    ...options,
    showAutoModel: options?.showAutoModel ?? true
  };
}
function legacyModelPickerStorageKey(providerId, sessionType) {
  return `sessions.modelPicker.${providerId}.${sessionType}.selectedModelId`;
}
function persistSessionModelSelection(session, provider, storageService, model, modelTarget) {
  provider.setModel(session.sessionId, model.identifier);
  storeSelectedModel(storageService, ChatAgentLocation.Chat, modelTarget, model.identifier);
}
function hasSelectableModel(models, options) {
  return models.length > 0 || options.showAutoModel;
}
const ISessionModelSelectionModel = createDecorator("sessionModelSelectionModel");
let SessionModelSelectionModel = class extends Disposable {
  constructor(_session, _sessionsProvidersService, _storageService, _configurationService, logService) {
    super();
    this._session = _session;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._storageService = _storageService;
    this._configurationService = _configurationService;
    this._state = observableValue(this, {
      currentModel: void 0,
      pendingSelection: void 0,
      models: [],
      options: normalizeModelPickerOptions(void 0),
      hasSelectableModel: false
    });
    this.state = this._state;
    this._providerListener = this._register(new MutableDisposable());
    this._memory = {
      sessionKey: void 0,
      lastPushedChatKey: void 0,
      currentModel: void 0,
      currentReason: void 0
    };
    this._sharedDiagnostics = new ChatModelSelectionDiagnostics(logService, this._storageService, () => {
      const session = this._session.get();
      return {
        surface: "sessions",
        location: ChatAgentLocation.Chat,
        modelTarget: this._modelTarget,
        sessionKey: session ? this._sessionKey(session) : void 0,
        conversationKey: session?.activeChat.get().resource.toString(),
        metadata: {
          providerId: session?.providerId,
          sessionType: session?.sessionType,
          sessionId: session?.sessionId
        }
      };
    });
    this._register(autorun((reader) => {
      const session = this._session.read(reader);
      session?.modelId.read(reader);
      session?.status.read(reader);
      session?.activeChat.read(reader);
      this._refresh("sessionState", session);
    }));
    this._register(this._configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ChatConfiguration.DefaultModel)) {
        this._refresh("configuration");
      }
    }));
    this._register(this._sessionsProvidersService.onDidChangeProviders(() => this._refresh("providers")));
    this._register(this._storageService.onDidChangeValue(StorageScope.PROFILE, void 0, this._store)((event) => {
      this._sharedDiagnostics.logStorageChange(event, this._state.get().currentModel?.identifier);
    }));
  }
  selectModel(modelIdentifier) {
    const session = this._session.get();
    const provider = session ? this._sessionsProvidersService.getProvider(session.providerId) : void 0;
    if (!session || !provider) {
      this._sharedDiagnostics.report("selection-rejected", {
        requestedModel: modelIdentifier,
        reason: !session ? "noSession" : "noProvider"
      }, "info");
      return false;
    }
    const snapshot = provider.getModelsSnapshot(session.sessionId);
    this._modelTarget = snapshot.modelTarget;
    const models = snapshot.models;
    const model = models.find((model2) => model2.identifier === modelIdentifier);
    if (!model) {
      this._sharedDiagnostics.report("selection-rejected", {
        requestedModel: modelIdentifier,
        reason: "modelUnavailable",
        availableModels: models.map((model2) => model2.identifier).join(",")
      }, "info");
      return false;
    }
    const options = normalizeModelPickerOptions(provider.getModelPickerOptions(session.sessionId));
    const previousState = this._state.get();
    const previousMemory = this._memory;
    const providerModelBefore = session.modelId.get();
    const storageKey = getSelectedModelStorageKey(ChatAgentLocation.Chat, snapshot.modelTarget);
    this._state.set({
      models,
      options,
      hasSelectableModel: hasSelectableModel(models, options),
      currentModel: model,
      pendingSelection: void 0
    }, void 0);
    this._memory = {
      sessionKey: this._sessionKey(session),
      lastPushedChatKey: session.activeChat.get().resource.toString(),
      currentModel: model,
      currentReason: ModelSelectionReason.UserSelection
    };
    this._sharedDiagnostics.report("explicit-selection", { model: model.identifier }, "info");
    try {
      persistSessionModelSelection(session, provider, this._storageService, model, snapshot.modelTarget);
      this._sharedDiagnostics.report("explicit-selection-applied", { model: model.identifier }, "info");
    } catch (error) {
      this._memory = previousMemory;
      this._sharedDiagnostics.report("explicit-selection-failed", { model: model.identifier, error: String(error) }, "error");
      this._sharedDiagnostics.report("provider-selection-failed", {
        requestedModel: modelIdentifier,
        providerModelBefore,
        providerModelAfter: session.modelId.get(),
        storedModelAfter: this._storageService.get(storageKey, StorageScope.PROFILE),
        error: String(error)
      }, "error");
      this._state.set({
        models,
        options,
        hasSelectableModel: hasSelectableModel(models, options),
        currentModel: previousState.currentModel,
        pendingSelection: previousState.pendingSelection
      }, void 0);
      throw error;
    }
    this._sharedDiagnostics.report("provider-selection-applied", {
      requestedModel: modelIdentifier,
      providerModelBefore,
      providerModelAfter: session.modelId.get(),
      storedModelAfter: this._storageService.get(storageKey, StorageScope.PROFILE)
    }, "info");
    return true;
  }
  _refresh(trigger, session = this._session.get()) {
    const provider = session ? this._sessionsProvidersService.getProvider(session.providerId) : void 0;
    this._setProvider(provider);
    const sessionKey = session ? this._sessionKey(session) : void 0;
    const sessionModelId = session?.modelId.get();
    const previousState = this._state.get();
    const previousMemory = this._memory;
    const sessionContext = session ? {
      kind: session.status.get() === SessionStatus.Untitled ? "untitled" : "existing",
      key: sessionKey,
      chatKey: session.activeChat.get().resource.toString(),
      modelId: sessionModelId
    } : { kind: "none" };
    const currentReason = sessionKey === this._memory.sessionKey ? this._memory.currentReason : void 0;
    const initialSnapshot = session && provider ? provider.getModelsSnapshot(session.sessionId, sessionModelId) : { models: [], desiredModelResolution: { kind: "notRequested" }, modelTarget: void 0 };
    const rememberedSelection = session ? this._getRememberedModel(session, initialSnapshot.modelTarget) : void 0;
    const rememberedModelId = rememberedSelection?.identifier;
    const desiredModelIdentifier = sessionContext.kind === "untitled" ? currentReason === ModelSelectionReason.FirstAvailable ? rememberedModelId : sessionModelId ?? rememberedModelId : sessionModelId;
    const snapshot = desiredModelIdentifier !== sessionModelId && session && provider ? provider.getModelsSnapshot(session.sessionId, desiredModelIdentifier) : initialSnapshot;
    const fallbackModel = snapshot.models.find((model) => model.metadata.isDefaultForLocation[ChatAgentLocation.Chat]) ?? snapshot.models[0];
    const result = transitionModelSelection({
      session: sessionContext,
      models: {
        available: snapshot.models,
        configuredModel: this._configurationService.getValue(ChatConfiguration.DefaultModel),
        rememberedModelId,
        desiredModelResolution: snapshot.desiredModelResolution,
        fallbackModel
      },
      previous: { ...this._memory, currentReason }
    });
    this._memory = {
      sessionKey: result.sessionKey,
      lastPushedChatKey: result.lastPushedChatKey,
      currentModel: result.currentModel,
      currentReason: result.currentReason
    };
    this._modelTarget = snapshot.modelTarget;
    const models = snapshot.models;
    const options = normalizeModelPickerOptions(session && provider ? provider.getModelPickerOptions(session.sessionId) : void 0);
    this._state.set({
      models,
      options,
      hasSelectableModel: !!session && !!provider && hasSelectableModel(models, options),
      currentModel: result.currentModel,
      pendingSelection: result.pendingSelection
    }, void 0);
    this._sharedDiagnostics.report("transition", {
      trigger,
      sessionKind: sessionContext.kind,
      modelTarget: snapshot.modelTarget,
      configuredModel: this._configurationService.getValue(ChatConfiguration.DefaultModel),
      rememberedModel: rememberedModelId,
      rememberedSource: rememberedSelection?.source,
      desiredModel: desiredModelIdentifier,
      desiredResolution: snapshot.desiredModelResolution.kind,
      fallbackModel: fallbackModel?.identifier,
      availableModels: snapshot.models.map((model) => model.identifier).join(","),
      previousModel: previousMemory.currentModel?.identifier,
      previousReason: currentReason,
      resultModel: result.currentModel?.identifier,
      resultReason: result.currentReason,
      pendingReference: result.pendingSelection?.reference,
      effect: result.effect.kind,
      effectModel: result.effect.kind === "apply" ? result.effect.model.identifier : void 0,
      effectReason: result.effect.kind === "none" ? void 0 : result.effect.reason
    }, result.effect.kind === "none" && previousMemory.currentModel?.identifier === result.currentModel?.identifier ? "debug" : "info");
    if (result.effect.kind === "apply" && session && provider) {
      const effect = result.effect;
      const providerModelBefore = session.modelId.get();
      try {
        provider.setModel(session.sessionId, effect.model.identifier);
      } catch (error) {
        this._memory = previousMemory;
        this._state.set(previousState, void 0);
        this._sharedDiagnostics.report("provider-automatic-selection-failed", {
          model: effect.model.identifier,
          reason: effect.reason,
          providerModelBefore,
          providerModelAfter: session.modelId.get(),
          error: String(error)
        }, "error");
        throw error;
      }
      this._sharedDiagnostics.report("provider-automatic-selection-applied", {
        model: effect.model.identifier,
        reason: effect.reason,
        providerModelBefore,
        providerModelAfter: session.modelId.get()
      }, "info");
    }
  }
  _getRememberedModel(session, modelTarget) {
    const storedSelection = getStoredSelectedModel(this._storageService, ChatAgentLocation.Chat, modelTarget);
    if (storedSelection) {
      return { identifier: storedSelection, source: "stored" };
    }
    const legacyStorageKey = legacyModelPickerStorageKey(session.providerId, session.sessionType);
    const legacyIdentifier = this._storageService.get(legacyStorageKey, StorageScope.PROFILE);
    if (legacyIdentifier) {
      storeSelectedModel(this._storageService, ChatAgentLocation.Chat, modelTarget, legacyIdentifier);
      this._sharedDiagnostics.report("legacy-selection-migrated", {
        legacyStorageKey,
        model: legacyIdentifier
      }, "info");
      return { identifier: legacyIdentifier, source: "legacy" };
    }
    return void 0;
  }
  _setProvider(provider) {
    if (this._provider === provider) {
      return;
    }
    this._provider = provider;
    this._providerListener.value = provider?.onDidChangeModels(() => this._refresh("models"));
  }
  _sessionKey(session) {
    return session.sessionId;
  }
};
SessionModelSelectionModel = __decorateClass([
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ILogService)
], SessionModelSelectionModel);
export {
  ISessionModelSelectionModel,
  SessionModelSelectionModel,
  hasSelectableModel,
  normalizeModelPickerOptions
};
