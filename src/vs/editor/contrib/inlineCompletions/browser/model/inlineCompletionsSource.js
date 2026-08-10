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
import { booleanComparator, compareBy, compareUndefinedSmallest, numberComparator } from "../../../../../base/common/arrays.js";
import { findLastMax } from "../../../../../base/common/arraysFind.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { equalsIfDefined, thisEqualsC } from "../../../../../base/common/equals.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { cloneAndChange } from "../../../../../base/common/objects.js";
import { derived, observableValue, recordChangesLazy, runOnChange, transaction } from "../../../../../base/common/observable.js";
import { observableReducerSettable } from "../../../../../base/common/observableInternal/experimental/reducer.js";
import { isDefined, isObject } from "../../../../../base/common/types.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { DataChannelForwardingTelemetryService, forwardToChannelIf, isCopilotLikeExtension } from "../../../../../platform/dataChannel/browser/forwardingTelemetryService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { StringEdit } from "../../../../common/core/edits/stringEdit.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { Command, InlineCompletionEndOfLifeReasonKind, InlineCompletionTriggerKind } from "../../../../common/languages.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { offsetEditFromContentChanges } from "../../../../common/model/textModelStringEdit.js";
import { isCompletionsEnabledFromObject } from "../../../../common/services/completionsEnablement.js";
import { ITextModelService } from "../../../../common/services/resolverService.js";
import { formatRecordableLogEntry, StructuredLogger } from "../structuredLogger.js";
import { sendInlineCompletionsEndOfLifeTelemetry } from "../telemetry.js";
import { wait } from "../utils.js";
import { InlineSuggestionItem } from "./inlineSuggestionItem.js";
import { provideInlineCompletions, runWhenCancelled } from "./provideInlineCompletions.js";
import { RenameSymbolProcessor } from "./renameSymbolProcessor.js";
import { TextModelValueReference } from "./textModelValueReference.js";
let InlineCompletionsSource = class extends Disposable {
  constructor(_textModel, _versionId, _debounceValue, _cursorPosition, completionsEnablementSetting, _languageConfigurationService, _logService, _configurationService, _instantiationService, _contextKeyService, _textModelService) {
    super();
    this._textModel = _textModel;
    this._versionId = _versionId;
    this._debounceValue = _debounceValue;
    this._cursorPosition = _cursorPosition;
    this._languageConfigurationService = _languageConfigurationService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._textModelService = _textModelService;
    this._updateOperation = this._register(new MutableDisposable());
    this._state = observableReducerSettable(this, {
      initial: () => ({
        inlineCompletions: InlineCompletionsState.createEmpty(),
        suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty()
      }),
      disposeFinal: (values) => {
        values.inlineCompletions.dispose();
        values.suggestWidgetInlineCompletions.dispose();
      },
      changeTracker: recordChangesLazy(() => ({ versionId: this._versionId })),
      update: (reader, previousValue, changes) => {
        const edit = StringEdit.compose(changes.changes.map((c) => c.change ? offsetEditFromContentChanges(c.change.changes) : StringEdit.empty).filter(isDefined));
        if (edit.isEmpty()) {
          return previousValue;
        }
        try {
          return {
            inlineCompletions: previousValue.inlineCompletions.createStateWithAppliedEdit(edit, this._textModel),
            suggestWidgetInlineCompletions: previousValue.suggestWidgetInlineCompletions.createStateWithAppliedEdit(edit, this._textModel)
          };
        } finally {
          previousValue.inlineCompletions.dispose();
          previousValue.suggestWidgetInlineCompletions.dispose();
        }
      }
    });
    this.inlineCompletions = this._state.map(this, (v) => v.inlineCompletions);
    this.suggestWidgetInlineCompletions = this._state.map(this, (v) => v.suggestWidgetInlineCompletions);
    this._completionsEnabled = void 0;
    this.clearOperationOnTextModelChange = derived(this, (reader) => {
      this._versionId.read(reader);
      this._updateOperation.clear();
      return void 0;
    });
    this._loadingCount = observableValue(this, 0);
    this.loading = this._loadingCount.map(this, (v) => v > 0);
    this._dataChannelTelemetryService = this._instantiationService.createInstance(DataChannelForwardingTelemetryService);
    this._loggingEnabled = observableConfigValue("editor.inlineSuggest.logFetch", false, this._configurationService).recomputeInitiallyAndOnChange(this._store);
    this._sendRequestData = observableConfigValue("editor.inlineSuggest.emptyResponseInformation", true, this._configurationService).recomputeInitiallyAndOnChange(this._store);
    this._structuredFetchLogger = this._register(this._instantiationService.createInstance(
      StructuredLogger.cast(),
      "editor.inlineSuggest.logFetch.commandId"
    ));
    this._renameProcessor = this._store.add(this._instantiationService.createInstance(RenameSymbolProcessor));
    this.clearOperationOnTextModelChange.recomputeInitiallyAndOnChange(this._store);
    if (completionsEnablementSetting) {
      this._updateCompletionsEnablement(completionsEnablementSetting);
      this._register(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(completionsEnablementSetting)) {
          this._updateCompletionsEnablement(completionsEnablementSetting);
        }
      }));
    }
    this._state.recomputeInitiallyAndOnChange(this._store);
  }
  static {
    this._requestId = 0;
  }
  _updateCompletionsEnablement(enalementSetting) {
    const result = this._configurationService.getValue(enalementSetting);
    if (!isObject(result)) {
      this._completionsEnabled = void 0;
    } else {
      this._completionsEnabled = result;
    }
  }
  _log(entry) {
    if (this._loggingEnabled.get()) {
      this._logService.info(formatRecordableLogEntry(entry));
    }
    this._structuredFetchLogger.log(entry);
  }
  fetch(providers, providersLabel, context, activeInlineCompletion, withDebounce, userJumpedToActiveCompletion, requestInfo) {
    const position = this._cursorPosition.get();
    const request = new UpdateRequest(position, context, this._textModel.getVersionId(), new Set(providers));
    const target = context.selectedSuggestionInfo ? this.suggestWidgetInlineCompletions.get() : this.inlineCompletions.get();
    if (this._updateOperation.value?.request.satisfies(request)) {
      return this._updateOperation.value.promise;
    } else if (target?.request?.satisfies(request)) {
      return Promise.resolve(true);
    }
    const updateOngoing = !!this._updateOperation.value;
    this._updateOperation.clear();
    const source = new CancellationTokenSource();
    const promise = (async () => {
      const store = new DisposableStore();
      this._loadingCount.set(this._loadingCount.get() + 1, void 0);
      let didDecrease = false;
      const decreaseLoadingCount = () => {
        if (!didDecrease) {
          didDecrease = true;
          this._loadingCount.set(this._loadingCount.get() - 1, void 0);
        }
      };
      const loadingReset = store.add(new RunOnceScheduler(() => decreaseLoadingCount(), 10 * 1e3));
      loadingReset.schedule();
      const inlineSuggestionsProviders = providers.filter((p) => p.providerId);
      const requestResponseInfo = new RequestResponseData(context, requestInfo, inlineSuggestionsProviders);
      try {
        const recommendedDebounceValue = this._debounceValue.get(this._textModel);
        const debounceValue = findLastMax(
          providers.map((p) => p.debounceDelayMs),
          compareUndefinedSmallest(numberComparator)
        ) ?? recommendedDebounceValue;
        const shouldDebounce = updateOngoing || withDebounce && context.triggerKind === InlineCompletionTriggerKind.Automatic;
        if (shouldDebounce) {
          await wait(debounceValue, source.token);
        }
        if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId) {
          requestResponseInfo.setNoSuggestionReasonIfNotSet("canceled:beforeFetch");
          return false;
        }
        const requestId = InlineCompletionsSource._requestId++;
        if (this._loggingEnabled.get() || this._structuredFetchLogger.isEnabled.get()) {
          this._log({
            sourceId: "InlineCompletions.fetch",
            kind: "start",
            requestId,
            modelUri: this._textModel.uri,
            modelVersion: this._textModel.getVersionId(),
            context: { triggerKind: context.triggerKind, suggestInfo: context.selectedSuggestionInfo ? true : void 0 },
            time: Date.now(),
            provider: providersLabel
          });
        }
        const startTime = /* @__PURE__ */ new Date();
        const providerResult = provideInlineCompletions(providers, this._cursorPosition.get(), this._textModel, context, requestInfo, this._languageConfigurationService);
        runWhenCancelled(source.token, () => providerResult.cancelAndDispose({ kind: "tokenCancellation" }));
        let shouldStopEarly = false;
        let producedSuggestion = false;
        const providerSuggestions = [];
        for await (const list of providerResult.lists) {
          if (!list) {
            continue;
          }
          list.addRef();
          store.add(toDisposable(() => list.removeRef(list.inlineSuggestionsData.length === 0 ? { kind: "empty" } : { kind: "notTaken" })));
          for (const item of list.inlineSuggestionsData) {
            producedSuggestion = true;
            if (!context.includeInlineEdits && (item.isInlineEdit || item.showInlineEditMenu)) {
              item.setNotShownReason("notInlineEditRequested");
              continue;
            }
            if (!context.includeInlineCompletions && !(item.isInlineEdit || item.showInlineEditMenu)) {
              item.setNotShownReason("notInlineCompletionRequested");
              continue;
            }
            item.addPerformanceMarker("providerReturned");
            const targetUri = item.action?.uri;
            let targetModel;
            let disposable;
            if (targetUri && targetUri.toString() !== this._textModel.uri.toString()) {
              const modelRef = await this._textModelService.createModelReference(targetUri);
              targetModel = modelRef.object.textEditorModel;
              disposable = modelRef;
            } else {
              targetModel = this._textModel;
              disposable = void 0;
            }
            const ref = TextModelValueReference.snapshot(targetModel);
            const i = InlineSuggestionItem.create(item, ref);
            if (disposable) {
              const s = runOnChange(i.identity.onDispose, () => {
                disposable?.dispose();
                s.dispose();
              });
            }
            item.addPerformanceMarker("itemCreated");
            providerSuggestions.push(i);
            if (!i.isInlineEdit && !i.showInlineEditMenu && context.triggerKind === InlineCompletionTriggerKind.Automatic) {
              if (i.isVisible(this._textModel, this._cursorPosition.get())) {
                shouldStopEarly = true;
              }
            }
          }
          if (shouldStopEarly) {
            break;
          }
        }
        providerSuggestions.forEach((s) => s.addPerformanceMarker("providersResolved"));
        const suggestions = await Promise.all(providerSuggestions.map(async (s) => {
          return this._renameProcessor.proposeRenameRefactoring(this._textModel, s, context);
        }));
        suggestions.forEach((s) => s.addPerformanceMarker("renameProcessed"));
        providerResult.cancelAndDispose({ kind: "lostRace" });
        if (this._loggingEnabled.get() || this._structuredFetchLogger.isEnabled.get()) {
          const didAllProvidersReturn = providerResult.didAllProvidersReturn;
          let error = void 0;
          if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId) {
            error = "canceled";
          }
          const result = suggestions.map((c) => {
            const comp = c.getSourceCompletion();
            if (comp.doNotLog) {
              return void 0;
            }
            const obj = {
              insertText: comp.insertText,
              range: comp.range,
              additionalTextEdits: comp.additionalTextEdits,
              uri: comp.uri,
              command: comp.command,
              gutterMenuLinkAction: comp.gutterMenuLinkAction,
              shownCommand: comp.shownCommand,
              completeBracketPairs: comp.completeBracketPairs,
              isInlineEdit: comp.isInlineEdit,
              showInlineEditMenu: comp.showInlineEditMenu,
              showRange: comp.showRange,
              warning: comp.warning,
              hint: comp.hint,
              supportsRename: comp.supportsRename,
              correlationId: comp.correlationId,
              jumpToPosition: comp.jumpToPosition
            };
            return {
              ...cloneAndChange(obj, (v) => {
                if (Range.isIRange(v)) {
                  return Range.lift(v).toString();
                }
                if (Position.isIPosition(v)) {
                  return Position.lift(v).toString();
                }
                if (Command.is(v)) {
                  return { $commandId: v.id };
                }
                return v;
              }),
              $providerId: c.source.provider.providerId?.toString()
            };
          }).filter((result2) => result2 !== void 0);
          this._log({ sourceId: "InlineCompletions.fetch", kind: "end", requestId, durationMs: Date.now() - startTime.getTime(), error, result, time: Date.now(), didAllProvidersReturn });
        }
        requestResponseInfo.setRequestUuid(providerResult.contextWithUuid.requestUuid);
        if (producedSuggestion) {
          requestResponseInfo.setHasProducedSuggestion();
          if (suggestions.length > 0 && source.token.isCancellationRequested) {
            suggestions.forEach((s) => s.setNotShownReasonIfNotSet("canceled:whileAwaitingOtherProviders"));
          }
        } else {
          if (source.token.isCancellationRequested) {
            requestResponseInfo.setNoSuggestionReasonIfNotSet("canceled:whileFetching");
          } else {
            const completionsQuotaExceeded = this._contextKeyService.getContextKeyValue("completionsQuotaExceeded");
            requestResponseInfo.setNoSuggestionReasonIfNotSet(completionsQuotaExceeded ? "completionsQuotaExceeded" : "noSuggestion");
          }
        }
        const remainingTimeToWait = context.earliestShownDateTime - Date.now();
        if (remainingTimeToWait > 0) {
          await wait(remainingTimeToWait, source.token);
        }
        suggestions.forEach((s) => s.addPerformanceMarker("minShowDelayPassed"));
        if (source.token.isCancellationRequested || this._store.isDisposed || this._textModel.getVersionId() !== request.versionId || userJumpedToActiveCompletion.get()) {
          const notShownReason = source.token.isCancellationRequested ? "canceled:afterMinShowDelay" : this._store.isDisposed ? "canceled:disposed" : this._textModel.getVersionId() !== request.versionId ? "canceled:documentChanged" : userJumpedToActiveCompletion.get() ? "canceled:userJumped" : "unknown";
          suggestions.forEach((s) => s.setNotShownReasonIfNotSet(notShownReason));
          return false;
        }
        const endTime = /* @__PURE__ */ new Date();
        this._debounceValue.update(this._textModel, endTime.getTime() - startTime.getTime());
        const cursorPosition = this._cursorPosition.get();
        this._updateOperation.clear();
        transaction((tx) => {
          const v = this._state.get();
          if (context.selectedSuggestionInfo) {
            this._state.set({
              inlineCompletions: InlineCompletionsState.createEmpty(),
              suggestWidgetInlineCompletions: v.suggestWidgetInlineCompletions.createStateWithAppliedResults(suggestions, request, this._textModel, cursorPosition, activeInlineCompletion)
            }, tx);
          } else {
            this._state.set({
              inlineCompletions: v.inlineCompletions.createStateWithAppliedResults(suggestions, request, this._textModel, cursorPosition, activeInlineCompletion),
              suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty()
            }, tx);
          }
          v.inlineCompletions.dispose();
          v.suggestWidgetInlineCompletions.dispose();
        });
      } finally {
        store.dispose();
        decreaseLoadingCount();
        this._sendInlineCompletionsRequestTelemetry(requestResponseInfo);
      }
      return true;
    })();
    const updateOperation = new UpdateOperation(request, source, promise);
    this._updateOperation.value = updateOperation;
    return promise;
  }
  clear(tx) {
    if (this._store.isDisposed) {
      return;
    }
    this._updateOperation.clear();
    const v = this._state.get();
    this._state.set({
      inlineCompletions: InlineCompletionsState.createEmpty(),
      suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty()
    }, tx);
    v.inlineCompletions.dispose();
    v.suggestWidgetInlineCompletions.dispose();
  }
  seedInlineCompletionsWithSuggestWidget() {
    const inlineCompletions = this.inlineCompletions.get();
    const suggestWidgetInlineCompletions = this.suggestWidgetInlineCompletions.get();
    if (!suggestWidgetInlineCompletions) {
      return;
    }
    transaction((tx) => {
      if (!inlineCompletions || (suggestWidgetInlineCompletions.request?.versionId ?? -1) > (inlineCompletions.request?.versionId ?? -1)) {
        inlineCompletions?.dispose();
        const s = this._state.get();
        this._state.set({
          inlineCompletions: suggestWidgetInlineCompletions.clone(),
          suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty()
        }, tx);
        s.inlineCompletions.dispose();
        s.suggestWidgetInlineCompletions.dispose();
      }
      this.clearSuggestWidgetInlineCompletions(tx);
    });
  }
  /**
   * Seeds the inline completions with an external inline completion item.
   * Used when transplanting a completion from one model to another (cross-file edits).
   */
  seedWithCompletion(item, tx) {
    const s = this._state.get();
    this._state.set({
      inlineCompletions: new InlineCompletionsState([item], void 0),
      suggestWidgetInlineCompletions: InlineCompletionsState.createEmpty()
    }, tx);
    s.inlineCompletions.dispose();
    s.suggestWidgetInlineCompletions.dispose();
  }
  _sendInlineCompletionsRequestTelemetry(requestResponseInfo) {
    if (!this._sendRequestData.get() && !this._contextKeyService.getContextKeyValue("isRunningUnificationExperiment")) {
      return;
    }
    if (requestResponseInfo.requestUuid === void 0 || requestResponseInfo.hasProducedSuggestion) {
      return;
    }
    if (!isCompletionsEnabledFromObject(this._completionsEnabled, this._textModel.getLanguageId())) {
      return;
    }
    if (!requestResponseInfo.providers.some((p) => isCopilotLikeExtension(p.providerId?.extensionId))) {
      return;
    }
    const emptyEndOfLifeEvent = {
      opportunityId: requestResponseInfo.requestUuid,
      noSuggestionReason: requestResponseInfo.noSuggestionReason ?? "unknown",
      extensionId: "vscode-core",
      extensionVersion: "0.0.0",
      groupId: "empty",
      shown: false,
      skuPlan: requestResponseInfo.requestInfo.sku?.plan,
      skuType: requestResponseInfo.requestInfo.sku?.type,
      editorType: requestResponseInfo.requestInfo.editorType,
      requestReason: requestResponseInfo.requestInfo.reason,
      typingInterval: requestResponseInfo.requestInfo.typingInterval,
      typingIntervalCharacterCount: requestResponseInfo.requestInfo.typingIntervalCharacterCount,
      languageId: requestResponseInfo.requestInfo.languageId,
      selectedSuggestionInfo: !!requestResponseInfo.context.selectedSuggestionInfo,
      availableProviders: requestResponseInfo.providers.map((p) => p.providerId?.toString()).filter(isDefined).join(","),
      ...forwardToChannelIf(requestResponseInfo.providers.some((p) => isCopilotLikeExtension(p.providerId?.extensionId))),
      timeUntilProviderRequest: void 0,
      timeUntilProviderResponse: void 0,
      viewKind: void 0,
      preceeded: void 0,
      superseded: void 0,
      reason: void 0,
      acceptedAlternativeAction: void 0,
      correlationId: void 0,
      shownDuration: void 0,
      shownDurationUncollapsed: void 0,
      timeUntilShown: void 0,
      partiallyAccepted: void 0,
      partiallyAcceptedCountSinceOriginal: void 0,
      partiallyAcceptedRatioSinceOriginal: void 0,
      partiallyAcceptedCharactersSinceOriginal: void 0,
      cursorColumnDistance: void 0,
      cursorLineDistance: void 0,
      lineCountOriginal: void 0,
      lineCountModified: void 0,
      characterCountOriginal: void 0,
      characterCountModified: void 0,
      disjointReplacements: void 0,
      sameShapeReplacements: void 0,
      longDistanceHintVisible: void 0,
      longDistanceHintDistance: void 0,
      isForAnotherDocument: void 0,
      notShownReason: void 0,
      renameCreated: false,
      renameDuration: void 0,
      renameTimedOut: false,
      renameDroppedOtherEdits: void 0,
      renameDroppedRenameEdits: void 0,
      performanceMarkers: void 0,
      editKind: void 0
    };
    sendInlineCompletionsEndOfLifeTelemetry(this._dataChannelTelemetryService, emptyEndOfLifeEvent);
  }
  clearSuggestWidgetInlineCompletions(tx) {
    if (this._updateOperation.value?.request.context.selectedSuggestionInfo) {
      this._updateOperation.clear();
    }
  }
  cancelUpdate() {
    this._updateOperation.clear();
  }
};
InlineCompletionsSource = __decorateClass([
  __decorateParam(5, ILanguageConfigurationService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ITextModelService)
], InlineCompletionsSource);
class UpdateRequest {
  constructor(position, context, versionId, providers) {
    this.position = position;
    this.context = context;
    this.versionId = versionId;
    this.providers = providers;
  }
  satisfies(other) {
    return this.position.equals(other.position) && equalsIfDefined(this.context.selectedSuggestionInfo, other.context.selectedSuggestionInfo, thisEqualsC()) && (other.context.triggerKind === InlineCompletionTriggerKind.Automatic || this.context.triggerKind === InlineCompletionTriggerKind.Explicit) && this.versionId === other.versionId && isSubset(other.providers, this.providers);
  }
  get isExplicitRequest() {
    return this.context.triggerKind === InlineCompletionTriggerKind.Explicit;
  }
}
class RequestResponseData {
  constructor(context, requestInfo, providers) {
    this.context = context;
    this.requestInfo = requestInfo;
    this.providers = providers;
    this.hasProducedSuggestion = false;
  }
  setRequestUuid(uuid) {
    this.requestUuid = uuid;
  }
  setNoSuggestionReasonIfNotSet(type) {
    this.noSuggestionReason ??= type;
  }
  setHasProducedSuggestion() {
    this.hasProducedSuggestion = true;
  }
}
function isSubset(set1, set2) {
  return [...set1].every((item) => set2.has(item));
}
class UpdateOperation {
  constructor(request, cancellationTokenSource, promise) {
    this.request = request;
    this.cancellationTokenSource = cancellationTokenSource;
    this.promise = promise;
  }
  dispose() {
    this.cancellationTokenSource.cancel();
  }
}
class InlineCompletionsState extends Disposable {
  constructor(inlineCompletions, request) {
    super();
    this.inlineCompletions = inlineCompletions;
    this.request = request;
    for (const inlineCompletion of this.inlineCompletions) {
      inlineCompletion.addRef();
    }
    this._register({
      dispose: () => {
        for (const inlineCompletion of this.inlineCompletions) {
          inlineCompletion.removeRef();
        }
      }
    });
  }
  static createEmpty() {
    return new InlineCompletionsState([], void 0);
  }
  _findById(id) {
    return this.inlineCompletions.find((i) => i.identity === id);
  }
  _findByHash(hash) {
    return this.inlineCompletions.find((i) => i.hash === hash);
  }
  /**
   * Applies the edit on the state.
  */
  createStateWithAppliedEdit(edit, textModel) {
    const newInlineCompletions = this.inlineCompletions.map((i) => i.withEdit(edit, textModel)).filter(isDefined);
    return new InlineCompletionsState(newInlineCompletions, this.request);
  }
  createStateWithAppliedResults(updatedSuggestions, request, textModel, cursorPosition, itemIdToPreserveAtTop) {
    let itemToPreserve = void 0;
    if (itemIdToPreserveAtTop) {
      const itemToPreserveCandidate = this._findById(itemIdToPreserveAtTop);
      if (itemToPreserveCandidate && itemToPreserveCandidate.canBeReused(textModel, request.position)) {
        itemToPreserve = itemToPreserveCandidate;
        const updatedItemToPreserve = updatedSuggestions.find((i) => i.hash === itemToPreserveCandidate.hash);
        if (updatedItemToPreserve) {
          updatedSuggestions = moveToFront(updatedItemToPreserve, updatedSuggestions);
        } else {
          updatedSuggestions = [itemToPreserveCandidate, ...updatedSuggestions];
        }
      }
    }
    const preferInlineCompletions = itemToPreserve ? !itemToPreserve.isInlineEdit : updatedSuggestions.some((i) => !i.isInlineEdit && i.isVisible(textModel, cursorPosition));
    let updatedItems = [];
    for (const i of updatedSuggestions) {
      const oldItem = this._findByHash(i.hash);
      let item;
      if (oldItem && oldItem !== i) {
        item = i.withIdentity(oldItem.identity);
        i.setIsPreceeded(oldItem);
        oldItem.setEndOfLifeReason({ kind: InlineCompletionEndOfLifeReasonKind.Ignored, userTypingDisagreed: false, supersededBy: i.getSourceCompletion() });
      } else {
        item = i;
      }
      if (preferInlineCompletions !== item.isInlineEdit) {
        updatedItems.push(item);
      }
    }
    updatedItems.sort(compareBy((i) => i.showInlineEditMenu, booleanComparator));
    updatedItems = distinctByKey(updatedItems, (i) => i.semanticId);
    return new InlineCompletionsState(updatedItems, request);
  }
  clone() {
    return new InlineCompletionsState(this.inlineCompletions, this.request);
  }
}
function distinctByKey(items, key) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
}
function moveToFront(item, items) {
  const index = items.indexOf(item);
  if (index > -1) {
    return [item, ...items.slice(0, index), ...items.slice(index + 1)];
  }
  return items;
}
export {
  InlineCompletionsSource,
  InlineCompletionsState
};
