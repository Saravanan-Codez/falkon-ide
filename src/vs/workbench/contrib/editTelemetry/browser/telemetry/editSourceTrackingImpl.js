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
import { reverseOrder, compareBy, numberComparator, sumBy } from "../../../../../base/common/arrays.js";
import { IntervalTimer } from "../../../../../base/common/async.js";
import { toDisposable, Disposable } from "../../../../../base/common/lifecycle.js";
import { mapObservableArrayCached, derived, observableSignal, runOnChange, autorun } from "../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { sendEditSourcesDetailsTelemetry, sendEditSourcesStatsTelemetry } from "../../../../../platform/telemetry/common/editTelemetry.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IUserAttentionService } from "../../../../services/userAttention/common/userAttentionService.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { CreateSuggestionIdForChatOrInlineChatCaller, EditTelemetryReportEditArcForChatOrInlineChatSender, EditTelemetryReportInlineEditArcSender } from "./arcTelemetrySender.js";
import { createDocWithJustReason } from "../helpers/documentWithAnnotatedEdits.js";
import { DocumentEditSourceTracker } from "./editTracker.js";
import { sumByCategory } from "../helpers/utils.js";
import { ScmAdapter } from "./scmAdapter.js";
import { IRandomService } from "../randomService.js";
import { AgentHostEditAttributionDeferredError, AgentHostEditAttributionUnknownOutcomeError } from "./agentHostEditMarkerService.js";
const FOCUS_CORRELATION_DRAIN_TIMEOUT = 1e3;
function getEditTelemetryCategory(source) {
  if (source.category === "ai" && source.kind === "nes") {
    return "nes";
  }
  if (source.category === "ai" && source.kind === "completion" && source.extensionId === "github.copilot") {
    return "inlineCompletionsCopilot";
  }
  if (source.category === "ai" && source.kind === "completion" && source.extensionId === "github.copilot-chat" && source.providerId === "nes") {
    return "inlineCompletionsNES";
  }
  if (source.category === "ai" && source.kind === "completion" && source.extensionId === "github.copilot-chat" && source.providerId === "completions") {
    return "inlineCompletionsCopilot";
  }
  if (source.category === "ai" && source.kind === "completion") {
    return "inlineCompletionsOther";
  }
  if (source.category === "ai") {
    return "otherAI";
  }
  if (source.category === "agentHost") {
    return "agentHost";
  }
  if (source.category === "user") {
    return "user";
  }
  if (source.category === "ide") {
    return "ide";
  }
  if (source.category === "external") {
    return "external";
  }
  return "unknown";
}
let EditSourceTrackingImpl = class extends Disposable {
  constructor(_statsEnabled, _annotatedDocuments, _agentHostEditMarkerService, _instantiationService) {
    super();
    this._statsEnabled = _statsEnabled;
    this._annotatedDocuments = _annotatedDocuments;
    this._agentHostEditMarkerService = _agentHostEditMarkerService;
    this._instantiationService = _instantiationService;
    const scmBridge = this._instantiationService.createInstance(ScmAdapter);
    this._states = mapObservableArrayCached(this, this._annotatedDocuments.documents, (doc, store) => {
      return [doc.document, store.add(this._instantiationService.createInstance(TrackedDocumentInfo, doc, scmBridge, this._statsEnabled, this._agentHostEditMarkerService))];
    });
    this.docsState = this._states.map((entries) => new Map(entries));
    this.docsState.recomputeInitiallyAndOnChange(this._store);
  }
};
EditSourceTrackingImpl = __decorateClass([
  __decorateParam(3, IInstantiationService)
], EditSourceTrackingImpl);
let TrackedDocumentInfo = class extends Disposable {
  constructor(_doc, _scm, _statsEnabled, _agentHostEditMarkerService, _instantiationService, _telemetryService, _randomService, _userAttentionService, _textFileService, _logService) {
    super();
    this._doc = _doc;
    this._scm = _scm;
    this._statsEnabled = _statsEnabled;
    this._agentHostEditMarkerService = _agentHostEditMarkerService;
    this._instantiationService = _instantiationService;
    this._telemetryService = _telemetryService;
    this._randomService = _randomService;
    this._userAttentionService = _userAttentionService;
    this._textFileService = _textFileService;
    this._logService = _logService;
    this._repo = derived(this, (reader) => this._scm.getRepo(_doc.document.uri, reader));
    const docWithJustReason = createDocWithJustReason(_doc.documentWithAnnotations, this._store);
    const externalEditCorrelation = this._agentHostEditMarkerService?.createCorrelation(_doc.document.uri);
    const longtermResetSignal = observableSignal("resetSignal");
    let longtermReason = "closed";
    this.longtermTracker = derived((reader) => {
      if (!this._statsEnabled.read(reader)) {
        return void 0;
      }
      longtermResetSignal.read(reader);
      const t = new DocumentEditSourceTracker(docWithJustReason, void 0, externalEditCorrelation);
      const startFocusTime = this._userAttentionService.totalFocusTimeMs;
      const startTime = Date.now();
      reader.store.add(toDisposable(() => {
        t.stopTracking();
        this._sendTelemetryAndLog("longterm", longtermReason, t, this._userAttentionService.totalFocusTimeMs - startFocusTime, Date.now() - startTime);
      }));
      return t;
    }).recomputeInitiallyAndOnChange(this._store);
    this._store.add(new IntervalTimer()).cancelAndSet(() => {
      longtermReason = "10hours";
      longtermResetSignal.trigger(void 0);
      longtermReason = "closed";
    }, 10 * 60 * 60 * 1e3);
    this._store.add(autorun((reader) => {
      const repo = this._repo.read(reader);
      if (repo) {
        reader.store.add(runOnChange(repo.headCommitHashObs, () => {
          longtermReason = "hashChange";
          longtermResetSignal.trigger(void 0);
          longtermReason = "closed";
        }));
        reader.store.add(runOnChange(repo.headBranchNameObs, () => {
          longtermReason = "branchChange";
          longtermResetSignal.trigger(void 0);
          longtermReason = "closed";
        }));
      }
    }));
    this._store.add(this._instantiationService.createInstance(EditTelemetryReportInlineEditArcSender, _doc.documentWithAnnotations, this._repo));
    this._store.add(this._instantiationService.createInstance(EditTelemetryReportEditArcForChatOrInlineChatSender, _doc.documentWithAnnotations, this._repo));
    this._store.add(this._instantiationService.createInstance(CreateSuggestionIdForChatOrInlineChatCaller, _doc.documentWithAnnotations));
    const resetSignal = observableSignal("resetSignal");
    this.windowedTracker = derived((reader) => {
      if (!this._statsEnabled.read(reader)) {
        return void 0;
      }
      if (!this._doc.isVisible.read(reader)) {
        return void 0;
      }
      resetSignal.read(reader);
      reader.store.add(this._userAttentionService.fireAfterGivenFocusTimePassed(10 * 60 * 1e3, () => {
        resetSignal.trigger(void 0);
      }));
      const t = new DocumentEditSourceTracker(docWithJustReason, void 0, externalEditCorrelation, "reattribute");
      const startFocusTime = this._userAttentionService.totalFocusTimeMs;
      const startTime = Date.now();
      reader.store.add(toDisposable(() => {
        t.stopTracking();
        this._sendTelemetryAndLog("10minFocusWindow", "time", t, this._userAttentionService.totalFocusTimeMs - startFocusTime, Date.now() - startTime);
      }));
      return t;
    }).recomputeInitiallyAndOnChange(this._store);
    const focusResetSignal = observableSignal("focusResetSignal");
    this.windowedFocusTracker = derived((reader) => {
      if (!this._statsEnabled.read(reader)) {
        return void 0;
      }
      if (!this._doc.isVisible.read(reader)) {
        return void 0;
      }
      focusResetSignal.read(reader);
      reader.store.add(this._userAttentionService.fireAfterGivenFocusTimePassed(20 * 60 * 1e3, () => {
        focusResetSignal.trigger(void 0);
      }));
      const t = new DocumentEditSourceTracker(docWithJustReason, void 0, externalEditCorrelation, "reattribute");
      const startFocusTime = this._userAttentionService.totalFocusTimeMs;
      const startTime = Date.now();
      reader.store.add(toDisposable(() => {
        t.stopTracking();
        this._sendTelemetryAndLog("20minFocusWindow", "time", t, this._userAttentionService.totalFocusTimeMs - startFocusTime, Date.now() - startTime);
      }));
      return t;
    }).recomputeInitiallyAndOnChange(this._store);
  }
  _sendTelemetryAndLog(mode, trigger, tracker, focusTime, actualTime) {
    void this.sendTelemetry(mode, trigger, tracker, focusTime, actualTime).catch((error) => {
      this._logService.error(`[EditSourceTrackingImpl] Failed to send ${mode} edit telemetry: ${error}`);
    }).finally(() => {
      tracker.releaseExternalEditCorrelations();
      tracker.dispose();
    });
  }
  async sendTelemetry(mode, trigger, t, focusTime, actualTime) {
    if (mode !== "longterm") {
      await t.waitForExternalEditCorrelations(FOCUS_CORRELATION_DRAIN_TIMEOUT);
    }
    t.applyPendingExternalEdits();
    let ranges = t.getTrackedRanges();
    let internalKeys = t.getAllKeys();
    let data = this.getTelemetryData(ranges);
    const statsUuid = this._randomService.generateUuid();
    let preparedAgentFlush;
    let deferSuppressedExternal = false;
    const isDirty = this._textFileService.isDirty(this._doc.document.uri);
    if (mode === "longterm" && this._agentHostEditMarkerService) {
      try {
        preparedAgentFlush = await this._agentHostEditMarkerService.prepareFlush(
          this._doc.document.uri,
          trigger,
          statsUuid,
          isDirty,
          this._doc.document.languageId.get()
        );
      } catch (error) {
        this._logService.error(`[EditSourceTrackingImpl] Failed to prepare Agent Host edit attribution: ${error}`);
        deferSuppressedExternal = error instanceof AgentHostEditAttributionDeferredError || error instanceof AgentHostEditAttributionUnknownOutcomeError;
      }
    }
    if (preparedAgentFlush) {
      t.applyPendingExternalEdits();
      ranges = t.getTrackedRanges();
      internalKeys = t.getAllKeys();
      data = this.getTelemetryData(ranges);
      try {
        await preparedAgentFlush.commit(data.totalModifiedCharactersInFinalState + preparedAgentFlush.agentModifiedCount);
      } catch (error) {
        this._logService.error(`[EditSourceTrackingImpl] Failed to commit Agent Host edit attribution: ${error}`);
        if (!(error instanceof AgentHostEditAttributionUnknownOutcomeError)) {
          preparedAgentFlush = void 0;
        }
        deferSuppressedExternal = error instanceof AgentHostEditAttributionDeferredError || error instanceof AgentHostEditAttributionUnknownOutcomeError;
      }
    }
    const includeSuppressedExternal = !preparedAgentFlush && !deferSuppressedExternal && !isDirty && mode === "longterm" && !!this._agentHostEditMarkerService;
    if (includeSuppressedExternal) {
      ranges = t.getTrackedRanges(void 0, true);
      internalKeys = t.getAllKeys(true);
      data = this.getTelemetryData(ranges);
    }
    const coverageGap = mode === "longterm" && !isDirty && !deferSuppressedExternal && !preparedAgentFlush?.deferCoverageGap ? this._agentHostEditMarkerService?.takeCoverageGap?.(this._doc.document.uri, preparedAgentFlush?.coverageGapThroughSequence ?? preparedAgentFlush?.lastSequence) : void 0;
    const agentModifiedCount = mode === "longterm" ? preparedAgentFlush?.agentModifiedCount ?? 0 : data.agentHostModifiedCount;
    if (internalKeys.length === 0 && agentModifiedCount === 0 && !coverageGap) {
      return;
    }
    const totalModifiedCount = data.totalModifiedCharactersInFinalState + (preparedAgentFlush?.agentModifiedCount ?? 0);
    const telemetryKeys = /* @__PURE__ */ new Map();
    for (const internalKey of internalKeys) {
      const representative = t.getRepresentative(internalKey);
      const telemetryKey = representative.toKey(1);
      const entry = telemetryKeys.get(telemetryKey) ?? {
        representative,
        modifiedCount: 0,
        deltaModifiedCount: 0
      };
      entry.deltaModifiedCount += t.getTotalInsertedCharactersCount(internalKey, includeSuppressedExternal);
      telemetryKeys.set(telemetryKey, entry);
    }
    for (const range of ranges) {
      const representative = t.getRepresentative(range.sourceKey);
      const entry = telemetryKeys.get(representative.toKey(1));
      if (entry) {
        entry.modifiedCount += range.range.length;
      }
    }
    const sums = Object.fromEntries(Array.from(telemetryKeys, ([key, value]) => [key, value.modifiedCount]));
    const entries = Object.entries(sums).filter((entry) => entry[1] !== void 0).sort(reverseOrder(compareBy(([, value]) => value, numberComparator))).slice(0, mode === "longterm" ? 30 : 10);
    for (const [key, value] of entries) {
      const telemetryEntry = telemetryKeys.get(key);
      const repr = telemetryEntry.representative;
      const deltaModifiedCount = telemetryEntry.deltaModifiedCount;
      sendEditSourcesDetailsTelemetry(this._telemetryService, {
        mode,
        sourceKey: key,
        sourceKeyCleaned: repr.toKey(1, { $extensionId: false, $extensionVersion: false, $modelId: false }),
        extensionId: repr.props.$extensionId,
        extensionVersion: repr.props.$extensionVersion,
        modelId: repr.props.$modelId,
        trigger,
        languageId: this._doc.document.languageId.get(),
        statsUuid,
        conversationId: repr.props.$$sessionId,
        requestId: repr.props.$$requestId,
        origin: repr.props.$origin,
        harness: repr.props.$harness,
        modifiedCount: value,
        deltaModifiedCount,
        totalModifiedCount
      });
    }
    const isTrackedByGit = await data.isTrackedByGit;
    sendEditSourcesStatsTelemetry(this._telemetryService, {
      attributionSchemaVersion: 2,
      mode,
      languageId: this._doc.document.languageId.get(),
      statsUuid,
      nesModifiedCount: data.nesModifiedCount,
      inlineCompletionsCopilotModifiedCount: data.inlineCompletionsCopilotModifiedCount,
      inlineCompletionsNESModifiedCount: data.inlineCompletionsNESModifiedCount,
      otherAIModifiedCount: data.otherAIModifiedCount,
      agentHostModifiedCount: agentModifiedCount,
      unknownModifiedCount: data.unknownModifiedCount,
      userModifiedCount: data.userModifiedCount,
      ideModifiedCount: data.ideModifiedCount,
      totalModifiedCharacters: totalModifiedCount,
      externalModifiedCount: data.externalModifiedCount,
      isTrackedByGit: isTrackedByGit ? 1 : 0,
      focusTime,
      actualTime,
      trigger,
      ...mode === "longterm" ? {
        agentHostAttributionCoverage: coverageGap ? "partial" : "complete",
        agentHostUntrackedEditCount: coverageGap?.editCount ?? 0,
        agentHostUntrackedInsertedCount: coverageGap?.insertedCount ?? 0
      } : {}
    });
  }
  getTelemetryData(ranges) {
    const sums = sumByCategory(ranges, (r) => r.range.length, (r) => getEditTelemetryCategory(r.source));
    const totalModifiedCharactersInFinalState = sumBy(ranges, (r) => r.range.length);
    return {
      nesModifiedCount: sums.nes ?? 0,
      inlineCompletionsCopilotModifiedCount: sums.inlineCompletionsCopilot ?? 0,
      inlineCompletionsNESModifiedCount: sums.inlineCompletionsNES ?? 0,
      otherAIModifiedCount: sums.otherAI ?? 0,
      agentHostModifiedCount: sums.agentHost ?? 0,
      userModifiedCount: sums.user ?? 0,
      ideModifiedCount: sums.ide ?? 0,
      unknownModifiedCount: sums.unknown ?? 0,
      externalModifiedCount: sums.external ?? 0,
      totalModifiedCharactersInFinalState,
      languageId: this._doc.document.languageId.get(),
      isTrackedByGit: this._repo.get()?.isIgnored(this._doc.document.uri)
    };
  }
};
TrackedDocumentInfo = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IRandomService),
  __decorateParam(7, IUserAttentionService),
  __decorateParam(8, ITextFileService),
  __decorateParam(9, ILogService)
], TrackedDocumentInfo);
export {
  EditSourceTrackingImpl,
  getEditTelemetryCategory
};
