import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../../base/common/observable.js";
import { isInConversationModelChoice, ModelSelectionReason, resolveConfiguredModel, resolveInitialModelSelection, resolveModelIdentifier } from "../../../common/modelSelection.js";
import { findBestMatchingModel, findDefaultModel, hasModelsTargetingSession, isModelValidForSession, resolveModelFromSyncState, shouldDropAgnosticDraftModel, shouldResetModelToDefault, shouldResetOnModelListChange } from "./chatInputModelUtils.js";
import { NullChatModelSelectionDiagnostics } from "./chatModelSelectionDiagnostics.js";
class ChatInputModelSelectionController extends Disposable {
  constructor(_runtime, _diagnostics = NullChatModelSelectionDiagnostics) {
    super();
    this._runtime = _runtime;
    this._diagnostics = _diagnostics;
    this._currentModel = observableValue(this, void 0);
    this.currentModel = this._currentModel;
    this._restorePerTypeModel = false;
    this._register(this._runtime.subscribeToModelChanges(() => this.reconcileModelListChange(this._runtime.getModels(this._runtime.getCurrentSessionType()))));
    this._register(toDisposable(() => this._clearIntent()));
  }
  get restorePerTypeModel() {
    return this._restorePerTypeModel;
  }
  get selectionReason() {
    return this._selectionReason;
  }
  get userExplicitlySelectedModel() {
    return this._selectionReason === ModelSelectionReason.UserSelection;
  }
  beginSessionSwitch(isEmpty, ownsPool, hadIncomingModel) {
    this._selectionReason = void 0;
    this._restorePerTypeModel = isEmpty && ownsPool && !hadIncomingModel;
    this._clearIntent();
  }
  endSessionSwitch() {
    this._restorePerTypeModel = false;
  }
  hasPendingIntent() {
    return !!this._intent;
  }
  /**
   * True while the remembered model is not selectable, i.e. whatever is currently selected is a
   * stand-in that {@link _restoreRememberedModel} will replace once the catalog offers the real
   * one. Callers use this to avoid acting on a selection that is about to change.
   */
  isAwaitingRememberedModel() {
    const modelId = this._rememberedSelection?.modelId;
    return !!modelId && !this._runtime.getModels(this._runtime.getCurrentSessionType()).some((model) => model.identifier === modelId);
  }
  hasPendingProgrammaticSelection() {
    return this._intent?.kind === "programmatic";
  }
  clearIntent() {
    this._clearIntent();
  }
  clearHistoryIntent() {
    if (this._intent?.kind === "history") {
      this._clearIntent();
    }
  }
  applyExplicitSelection(model, apply, rollbackOnError) {
    this._clearIntent();
    const previousModel = this._currentModel.get();
    const previousReason = this._selectionReason;
    const previousRememberedSelection = this._rememberedSelection;
    this._currentModel.set(model, void 0);
    this._selectionReason = ModelSelectionReason.UserSelection;
    this._remember({ modelId: model.identifier, model, reason: ModelSelectionReason.UserSelection });
    this._diagnostics.report("explicit-selection", { model: model.identifier }, "info");
    try {
      apply();
      this._diagnostics.report("explicit-selection-applied", { model: model.identifier }, "info");
    } catch (error) {
      if (rollbackOnError) {
        this._currentModel.set(previousModel, void 0);
        this._selectionReason = previousReason;
        this._remember(previousRememberedSelection);
      }
      this._diagnostics.report("explicit-selection-failed", { model: model.identifier, error: String(error) }, "error");
      throw error;
    }
  }
  applyAutomaticSelection(model, apply) {
    this._currentModel.set(model, void 0);
    apply();
  }
  applyProgrammaticSelection(model) {
    this._clearIntent();
    this._selectionReason = ModelSelectionReason.ProgrammaticSelection;
    this._remember({ modelId: model.identifier, model, reason: ModelSelectionReason.ProgrammaticSelection });
    this._applyModel(model);
  }
  requestProgrammaticSelection(resolveModel, conversationKey) {
    this._clearIntent();
    this._selectionReason = ModelSelectionReason.ProgrammaticSelection;
    return new Promise((resolve) => {
      let complete = resolve;
      this._intent = {
        kind: "programmatic",
        resolveModel,
        conversationKey,
        complete: (applied) => {
          complete(applied);
          complete = () => {
          };
        }
      };
      this._reconcileIntent();
    });
  }
  initialize(rememberedModelId, onInitialSelection) {
    this._clearIntent();
    this._remember(rememberedModelId ? { modelId: rememberedModelId, reason: ModelSelectionReason.Remembered } : void 0);
    const resolveSelection = () => {
      const configuredModelValue = this._runtime.getConfiguredModelValue();
      const models = this._runtime.getModels(this._runtime.getCurrentSessionType());
      const configuredModel = this._runtime.isEmpty() ? resolveConfiguredModel(configuredModelValue, models) : void 0;
      const resolution = resolveModelIdentifier(models, rememberedModelId, false);
      return resolveInitialModelSelection({
        configuredModel,
        desiredModelResolution: resolution,
        desiredReason: ModelSelectionReason.Remembered,
        fallbackModel: findDefaultModel(models, this._runtime.location),
        fallbackReason: ModelSelectionReason.FirstAvailable
      });
    };
    const selection = resolveSelection();
    onInitialSelection(selection);
    this._reportInitialization(this._runtime.getConfiguredModelValue(), rememberedModelId, selection);
    if (selection.kind === "apply") {
      this._selectionReason = selection.reason;
      this._applyModel(selection.model);
      this.ensureCurrentModelSupported();
    } else if (selection.kind === "pending") {
      const fallbackModel = findDefaultModel(this._runtime.getModels(this._runtime.getCurrentSessionType()), this._runtime.location);
      if (fallbackModel) {
        this._selectionReason = ModelSelectionReason.FirstAvailable;
        this._applyModel(fallbackModel);
      }
    }
  }
  ensureCurrentModelSupported() {
    const currentModel = this._currentModel.get();
    const sessionType = this._runtime.getCurrentSessionType();
    const models = this._runtime.getModels(sessionType);
    const context = {
      location: this._runtime.location,
      currentModeKind: this._runtime.getCurrentModeKind(),
      sessionType
    };
    const willReset = shouldResetModelToDefault(currentModel, models, context, this._runtime.getAllModels());
    this._diagnostics.report("compatibility-check", {
      currentModel: currentModel?.identifier,
      mode: context.currentModeKind,
      sessionType,
      willReset
    }, willReset ? "info" : "debug");
    if (willReset) {
      this.selectDefault(sessionType);
    }
  }
  selectDefault(sessionType = this._runtime.getCurrentSessionType()) {
    const allModels = this._runtime.getAllModels();
    if (sessionType && this._runtime.requiresCustomModels(sessionType) && !hasModelsTargetingSession(allModels, sessionType)) {
      return;
    }
    const models = this._runtime.getModels(sessionType);
    const configuredModel = resolveConfiguredModel(this._runtime.getConfiguredModelValue(), models);
    const defaultModel = configuredModel ?? findDefaultModel(models, this._runtime.location);
    this._diagnostics.report("select-default", {
      configuredModel: configuredModel?.identifier,
      defaultModel: defaultModel?.identifier,
      currentModel: this._currentModel.get()?.identifier
    }, defaultModel ? "info" : "debug");
    if (!defaultModel) {
      return;
    }
    if (!this.hasPendingProgrammaticSelection()) {
      this._selectionReason = configuredModel ? ModelSelectionReason.ConfiguredDefault : ModelSelectionReason.FirstAvailable;
    }
    this._applyModel(defaultModel);
  }
  applyConfiguredDefault() {
    if (!this._runtime.isEmpty() || isInConversationModelChoice(this._selectionReason) || this._intent) {
      return false;
    }
    const configuredValue = this._runtime.getConfiguredModelValue();
    if (!configuredValue) {
      return false;
    }
    const configuredModel = resolveConfiguredModel(configuredValue, this._runtime.getModels(this._runtime.getCurrentSessionType()));
    if (!configuredModel) {
      return false;
    }
    if (configuredModel.identifier === this._currentModel.get()?.identifier) {
      if (this._selectionReason !== ModelSelectionReason.ConfiguredDefault) {
        this._selectionReason = ModelSelectionReason.ConfiguredDefault;
        return true;
      }
      return false;
    }
    this._selectionReason = ModelSelectionReason.ConfiguredDefault;
    this._applyModel(configuredModel);
    this.ensureCurrentModelSupported();
    return true;
  }
  reconcileModelListChange(models) {
    if (this.applyConfiguredDefault() || this._reconcileIntent() || this._restoreRememberedModel()) {
      return;
    }
    if (this._intent?.kind === "history") {
      return;
    }
    const currentModel = this._currentModel.get();
    const locationDefault = models.find((model) => model.metadata.isDefaultForLocation[this._runtime.location]);
    if (this._runtime.isEmpty() && this._selectionReason === ModelSelectionReason.FirstAvailable && locationDefault && currentModel?.identifier !== locationDefault.identifier) {
      this._applyModel(locationDefault);
      return;
    }
    if (!shouldResetOnModelListChange(currentModel?.identifier, [...models])) {
      return;
    }
    const match = findBestMatchingModel(currentModel, models);
    if (match) {
      this._applyModel(match);
    } else {
      this.selectDefault();
    }
  }
  /**
   * Reclaims the remembered model whenever the catalog can offer it — no matter how long that
   * takes. A model can be missing for reasons that have nothing to do with intent: an agent host
   * publishes its catalog in waves, and restarting one drops the whole catalog and republishes it
   * moments later. The default shown meanwhile is a stand-in, not a decision. Every deliberate
   * choice updates {@link _rememberedSelection}, so a current model that differs from it is
   * always a stand-in of some kind and may be superseded. `chat.defaultModel` outranks a merely
   * remembered model, but never an in-conversation choice, which is why the displaced authority
   * is restored along with the model.
   */
  _restoreRememberedModel() {
    const remembered = this._rememberedSelection;
    if (!remembered || this._currentModel.get()?.identifier === remembered.modelId) {
      return false;
    }
    if (this._selectionReason === ModelSelectionReason.ConfiguredDefault && !isInConversationModelChoice(remembered.reason)) {
      return false;
    }
    const pool = this._runtime.getModels(this._runtime.getCurrentSessionType());
    const exact = pool.find((model2) => model2.identifier === remembered.modelId);
    const model = exact ?? (remembered.reason === ModelSelectionReason.SessionRestore ? findBestMatchingModel(remembered.model, pool) : void 0);
    if (!model || !exact && this._currentModel.get()?.identifier === model.identifier) {
      return false;
    }
    this._diagnostics.report("restore-remembered-model", { model: model.identifier, remembered: remembered.modelId, reason: remembered.reason }, "info");
    this._selectionReason = remembered.reason;
    if (exact && remembered.configuration) {
      this._runtime.restoreModelConfiguration(remembered.modelId, remembered.configuration);
    }
    this._applyModel(model);
    return true;
  }
  syncFromConversationState(desiredModel, modelConfiguration, sessionType, conversationKey, isRemoteEdit = false) {
    if (!isRemoteEdit && this._isEchoOfStandIn(desiredModel.identifier, conversationKey)) {
      this._diagnostics.report("conversation-restore-echo-ignored", {
        desiredModel: desiredModel.identifier,
        awaitingModel: this._rememberedSelection?.modelId
      }, "info");
      return;
    }
    this.clearHistoryIntent();
    const allModels = this._runtime.getAllModels();
    const currentModel = this._currentModel.get();
    const syncResult = resolveModelFromSyncState(desiredModel, currentModel, allModels, sessionType, {
      location: this._runtime.location,
      currentModeKind: this._runtime.getCurrentModeKind(),
      sessionType
    });
    this._diagnostics.report("conversation-restore", {
      desiredModel: desiredModel.identifier,
      currentModel: currentModel?.identifier,
      sessionType,
      action: syncResult.action
    }, syncResult.action === "keep" ? "debug" : "info");
    if (syncResult.action === "apply" || syncResult.action === "keep") {
      this._applySessionRestore(desiredModel, syncResult.action === "apply", modelConfiguration, conversationKey);
      return;
    }
    this._rememberOnBoundConversation(desiredModel, modelConfiguration, conversationKey);
    this._clearIntent();
    const pool = this._runtime.getModels(sessionType);
    const match = findBestMatchingModel(desiredModel, pool) ?? findBestMatchingModel(currentModel, pool);
    if (match) {
      this._applyModel(match);
      this._selectionReason = ModelSelectionReason.SessionRestore;
    } else {
      this.selectDefault(sessionType);
    }
  }
  /**
   * Whether a conversation-state sync is merely this controller's own stand-in coming back.
   *
   * Applying a model writes it into the conversation's input state, which the local sync then
   * hands straight back. While the real model is still missing from the catalog, that echo would
   * otherwise be mistaken for the session's model and overwrite the very selection being waited
   * for — the loop that makes a transient stand-in stick permanently.
   *
   * Two things keep this from swallowing a real change. Only the exact model this controller put
   * on screen as a stand-in qualifies, and only a *local* write does: a state pushed in by
   * another client carries {@link ChatInputStateOrigin.Remote}, so a peer that genuinely selects
   * the stand-in still supersedes the model being awaited. A local change cannot be mistaken for
   * an echo either, since every deliberate local choice updates {@link _rememberedSelection}
   * before the state is written.
   */
  _isEchoOfStandIn(desiredModelId, conversationKey) {
    const remembered = this._rememberedSelection;
    return !!remembered && remembered.conversationKey === conversationKey && desiredModelId === this._standInModelId && this.isAwaitingRememberedModel();
  }
  /**
   * Replaces the remembered selection. Any stand-in shown for the previous one stops being an
   * echo candidate at that moment, so the two are always updated together.
   */
  _remember(selection) {
    this._rememberedSelection = selection;
    this._standInModelId = void 0;
  }
  /**
   * Records the conversation's model as the one to reclaim, unless this sync belongs to a
   * conversation the input has already moved off — a late sync for an outgoing session must not
   * dictate the active one's model.
   */
  _rememberOnBoundConversation(model, configuration, conversationKey) {
    if (this._runtime.getBoundConversationKey() !== conversationKey) {
      return;
    }
    this._remember({ modelId: model.identifier, model, reason: ModelSelectionReason.SessionRestore, configuration, conversationKey });
  }
  ensureCurrentModelInSessionPool() {
    const currentModel = this._currentModel.get();
    if (currentModel && !isModelValidForSession(currentModel, this._runtime.getAllModels(), this._runtime.getCurrentSessionType())) {
      this.selectDefault();
    }
  }
  revalidateForSessionType(initialize) {
    const previousModel = this._currentModel.get();
    this._selectionReason = void 0;
    initialize();
    const restoredModel = this._currentModel.get();
    const sessionType = this._runtime.getCurrentSessionType();
    const models = this._runtime.getModels(sessionType);
    if (restoredModel && models.some((model) => model.identifier === restoredModel.identifier)) {
      return;
    }
    const match = findBestMatchingModel(previousModel, models);
    if (match) {
      this._applyModel(match);
    } else if (models.length === 0) {
      this._currentModel.set(void 0, void 0);
    } else {
      this.selectDefault(sessionType);
    }
  }
  preselectFromHistory(modelId, conversationKey) {
    this.clearIntent();
    const tryMatch = () => {
      const models = this._runtime.getModels(this._runtime.getCurrentSessionType());
      if (models.length === 0 || models.length === 1 && models[0].metadata.id.toLocaleLowerCase() === "auto") {
        return void 0;
      }
      return models.find((model) => model.identifier === modelId) ?? models.find((model) => model.metadata.id === modelId);
    };
    const match = tryMatch();
    if (match) {
      this._selectionReason = ModelSelectionReason.SessionRestore;
      this._remember({ modelId: match.identifier, model: match, reason: ModelSelectionReason.SessionRestore });
      this._applyModel(match);
      return;
    }
    this._intent = { kind: "history", modelId, conversationKey };
  }
  resolveDraftModel(draftModel, sessionTypeForValidation, validatePool) {
    let model = draftModel;
    if (validatePool && shouldDropAgnosticDraftModel(model, this._runtime.getAllModels(), sessionTypeForValidation)) {
      model = void 0;
    }
    const configuredValue = this._runtime.getConfiguredModelValue();
    if (configuredValue) {
      model = resolveConfiguredModel(configuredValue, this._runtime.getModels(this._runtime.getCurrentSessionType()));
    }
    return { model, changed: model?.identifier !== draftModel?.identifier };
  }
  _applySessionRestore(model, applyModel, configuration, conversationKey) {
    this._clearIntent();
    this._selectionReason = ModelSelectionReason.SessionRestore;
    this._remember({ modelId: model.identifier, model, reason: ModelSelectionReason.SessionRestore, configuration, conversationKey });
    if (configuration) {
      this._runtime.restoreModelConfiguration(model.identifier, configuration);
    }
    if (applyModel) {
      this._applyModel(model);
    }
  }
  _reconcileIntent() {
    const intent = this._intent;
    if (!intent) {
      return false;
    }
    if (intent.kind === "programmatic") {
      if (this._runtime.getBoundConversationKey() !== intent.conversationKey) {
        this._clearIntent();
        return true;
      }
      const model2 = intent.resolveModel();
      if (!model2) {
        return false;
      }
      this._intent = void 0;
      intent.complete(true);
      this.applyProgrammaticSelection(model2);
      return true;
    }
    if (this._runtime.getVisibleConversationKey() !== intent.conversationKey) {
      this._clearIntent();
      return true;
    }
    const models = this._runtime.getModels(this._runtime.getCurrentSessionType());
    const model = models.find((model2) => model2.identifier === intent.modelId) ?? models.find((model2) => model2.metadata.id === intent.modelId);
    if (model && !(models.length === 1 && model.metadata.id.toLocaleLowerCase() === "auto")) {
      this._intent = void 0;
      this._selectionReason = ModelSelectionReason.SessionRestore;
      this._remember({ modelId: model.identifier, model, reason: ModelSelectionReason.SessionRestore });
      this._applyModel(model);
      return true;
    }
    return false;
  }
  _clearIntent() {
    const intent = this._intent;
    this._intent = void 0;
    if (intent?.kind === "programmatic") {
      intent.complete(false);
      if (this._selectionReason === ModelSelectionReason.ProgrammaticSelection) {
        this._selectionReason = void 0;
      }
    }
  }
  _applyModel(model) {
    const remembered = this._rememberedSelection;
    if (remembered && model.identifier !== remembered.modelId) {
      this._standInModelId = model.identifier;
    }
    this._currentModel.set(model, void 0);
    this._runtime.applyModel(model);
  }
  _reportInitialization(configuredModel, rememberedModel, selection) {
    this._diagnostics.report("initialize", {
      configuredModel,
      rememberedModel,
      availableModels: this._runtime.getModels(this._runtime.getCurrentSessionType()).map((model) => model.identifier).join(","),
      selection: selection.kind,
      resultModel: selection.kind === "apply" ? selection.model.identifier : void 0,
      resultReason: selection.kind === "apply" ? selection.reason : void 0,
      pendingReference: selection.kind === "pending" ? selection.selection.reference : void 0
    }, selection.kind === "none" ? "debug" : "info");
  }
}
export {
  ChatInputModelSelectionController
};
