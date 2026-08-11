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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { clamp } from "../../../../../base/common/numbers.js";
import { autorun, derived, observableValue, observableValueOpts, transaction } from "../../../../../base/common/observable.js";
import { EditDeltaInfo } from "../../../../../editor/common/textModelEditSource.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { editorBackground, registerColor, transparent } from "../../../../../platform/theme/common/colorRegistry.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IAiEditTelemetryService } from "../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatEditKind, ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
class AutoAcceptControl {
  constructor(total, remaining, cancel) {
    this.total = total;
    this.remaining = remaining;
    this.cancel = cancel;
  }
}
const pendingRewriteMinimap = registerColor(
  "minimap.chatEditHighlight",
  transparent(editorBackground, 0.6),
  localize("editorSelectionBackground", "Color of pending edit regions in the minimap")
);
let AbstractChatEditingModifiedFileEntry = class extends Disposable {
  constructor(modifiedURI, _telemetryInfo, kind, configService, _fileConfigService, _chatService, _fileService, _undoRedoService, _instantiationService, _aiEditTelemetryService) {
    super();
    this.modifiedURI = modifiedURI;
    this._telemetryInfo = _telemetryInfo;
    this._fileConfigService = _fileConfigService;
    this._chatService = _chatService;
    this._fileService = _fileService;
    this._undoRedoService = _undoRedoService;
    this._instantiationService = _instantiationService;
    this._aiEditTelemetryService = _aiEditTelemetryService;
    this.entryId = `${AbstractChatEditingModifiedFileEntry.scheme}::${++AbstractChatEditingModifiedFileEntry.lastEntryId}`;
    this._onDidDelete = this._register(new Emitter());
    this.onDidDelete = this._onDidDelete.event;
    this._stateObs = observableValue(this, ModifiedFileEntryState.Modified);
    this.state = this._stateObs;
    this._waitsForLastEdits = observableValue(this, false);
    this.waitsForLastEdits = this._waitsForLastEdits;
    this._isCurrentlyBeingModifiedByObs = observableValue(this, void 0);
    this.isCurrentlyBeingModifiedBy = this._isCurrentlyBeingModifiedByObs;
    /**
     * Flag to track if we're currently in an external edit operation.
     * When true, file system changes should be treated as agent edits, not user edits.
     */
    this._isExternalEditInProgress = false;
    this._lastModifyingResponseObs = observableValueOpts({ equalsFn: (a, b) => a?.requestId === b?.requestId }, void 0);
    this.lastModifyingResponse = this._lastModifyingResponseObs;
    this._lastModifyingResponseInProgressObs = this._lastModifyingResponseObs.map((value, r) => {
      return value?.isInProgress.read(r) ?? false;
    });
    this._rewriteRatioObs = observableValue(this, 0);
    this.rewriteRatio = this._rewriteRatioObs;
    this._reviewModeTempObs = observableValue(this, void 0);
    this._autoAcceptCtrl = observableValue(this, void 0);
    this.autoAcceptController = this._autoAcceptCtrl;
    this._refCounter = 1;
    this._userEditScheduler = this._register(new RunOnceScheduler(() => this._notifySessionAction("userModified"), 1e3));
    this._editorIntegrations = this._register(new DisposableMap());
    if (kind === ChatEditKind.Created) {
      this.createdInRequestId = this._telemetryInfo.requestId;
    }
    if (this.modifiedURI.scheme !== Schemas.untitled && this.modifiedURI.scheme !== Schemas.vscodeNotebookCell) {
      this._register(this._fileService.watch(this.modifiedURI));
      this._register(this._fileService.onDidFilesChange((e) => {
        if (e.affects(this.modifiedURI) && kind === ChatEditKind.Created && e.gotDeleted()) {
          this._onDidDelete.fire();
        }
      }));
    }
    const autoAcceptRaw = observableConfigValue("chat.editing.autoAcceptDelay", 0, configService);
    this._autoAcceptTimeout = derived((r) => {
      const value = autoAcceptRaw.read(r);
      return clamp(value, 0, 100);
    });
    this.reviewMode = derived((r) => {
      const configuredValue = this._autoAcceptTimeout.read(r);
      const tempValue = this._reviewModeTempObs.read(r);
      return tempValue ?? configuredValue === 0;
    });
    this._store.add(toDisposable(() => this._lastModifyingResponseObs.set(void 0, void 0)));
    const autoSaveOff = this._store.add(new MutableDisposable());
    this._store.add(autorun((r) => {
      if (this._waitsForLastEdits.read(r)) {
        autoSaveOff.value = _fileConfigService.disableAutoSave(this.modifiedURI);
      } else {
        autoSaveOff.clear();
      }
    }));
    this._store.add(autorun((r) => {
      const inProgress = this._lastModifyingResponseInProgressObs.read(r);
      if (inProgress === false && !this.reviewMode.read(r)) {
        const acceptTimeout = this._autoAcceptTimeout.read(void 0) * 1e3;
        const future = Date.now() + acceptTimeout;
        const update = () => {
          const reviewMode = this.reviewMode.read(void 0);
          if (reviewMode) {
            this._autoAcceptCtrl.set(void 0, void 0);
            return;
          }
          const remain = Math.round(future - Date.now());
          if (remain <= 0) {
            this.accept();
          } else {
            const handle = setTimeout(update, 100);
            this._autoAcceptCtrl.set(new AutoAcceptControl(acceptTimeout, remain, () => {
              clearTimeout(handle);
              this._autoAcceptCtrl.set(void 0, void 0);
            }), void 0);
          }
        };
        update();
      }
    }));
  }
  static {
    this.scheme = "modified-file-entry";
  }
  static {
    this.lastEntryId = 0;
  }
  get telemetryInfo() {
    return this._telemetryInfo;
  }
  get lastModifyingRequestId() {
    return this._telemetryInfo.requestId;
  }
  dispose() {
    if (--this._refCounter === 0) {
      super.dispose();
    }
  }
  acquire() {
    this._refCounter++;
    return this;
  }
  enableReviewModeUntilSettled() {
    if (this.state.get() !== ModifiedFileEntryState.Modified) {
      return;
    }
    this._reviewModeTempObs.set(true, void 0);
    const cleanup = autorun((r) => {
      const resetConfig = this.state.read(r) !== ModifiedFileEntryState.Modified;
      if (resetConfig) {
        this._store.delete(cleanup);
        this._reviewModeTempObs.set(void 0, void 0);
      }
    });
    this._store.add(cleanup);
  }
  updateTelemetryInfo(telemetryInfo) {
    this._telemetryInfo = telemetryInfo;
  }
  async accept() {
    const callback = await this.acceptDeferred();
    if (callback) {
      transaction(callback);
    }
  }
  /** Accepts and returns a function used to transition the state. This MUST be called by the consumer. */
  async acceptDeferred() {
    if (this._stateObs.get() !== ModifiedFileEntryState.Modified) {
      return;
    }
    await this._doAccept();
    return (tx) => {
      this._stateObs.set(ModifiedFileEntryState.Accepted, tx);
      this._autoAcceptCtrl.set(void 0, tx);
      this._notifySessionAction("accepted");
    };
  }
  async reject() {
    const callback = await this.rejectDeferred();
    if (callback) {
      transaction(callback);
    }
  }
  /** Rejects and returns a function used to transition the state. This MUST be called by the consumer. */
  async rejectDeferred() {
    if (this._stateObs.get() !== ModifiedFileEntryState.Modified) {
      return void 0;
    }
    this._notifySessionAction("rejected");
    await this._doReject();
    return (tx) => {
      this._stateObs.set(ModifiedFileEntryState.Rejected, tx);
      this._autoAcceptCtrl.set(void 0, tx);
    };
  }
  _notifySessionAction(outcome) {
    this._notifyAction({ kind: "chatEditingSessionAction", uri: this.modifiedURI, hasRemainingEdits: false, outcome });
  }
  _notifyAction(action) {
    if (action.kind === "chatEditingHunkAction" && action.outcome === "accepted") {
      this._aiEditTelemetryService.handleCodeAccepted({
        suggestionId: void 0,
        // TODO@hediet try to figure this out
        acceptanceMethod: "accept",
        presentation: "highlightedEdit",
        modelId: this._telemetryInfo.modelId,
        modeId: this._telemetryInfo.modeId,
        applyCodeBlockSuggestionId: this._telemetryInfo.applyCodeBlockSuggestionId,
        editDeltaInfo: new EditDeltaInfo(
          action.linesAdded,
          action.linesRemoved,
          -1,
          -1
        ),
        feature: this._telemetryInfo.feature,
        languageId: action.languageId,
        source: void 0,
        sourceRequestId: this._telemetryInfo.requestId
      });
    } else if (action.kind === "chatEditingHunkAction" && action.outcome === "rejected") {
      this._aiEditTelemetryService.handleCodeRejected({
        suggestionId: void 0,
        rejectionMethod: "reject",
        presentation: "highlightedEdit",
        modelId: this._telemetryInfo.modelId,
        modeId: this._telemetryInfo.modeId,
        applyCodeBlockSuggestionId: this._telemetryInfo.applyCodeBlockSuggestionId,
        editDeltaInfo: new EditDeltaInfo(
          action.linesAdded,
          action.linesRemoved,
          -1,
          -1
        ),
        feature: this._telemetryInfo.feature,
        languageId: action.languageId,
        source: void 0,
        sourceRequestId: this._telemetryInfo.requestId
      });
    }
    this._chatService.notifyUserAction({
      action,
      agentId: this._telemetryInfo.agentId,
      modelId: this._telemetryInfo.modelId,
      modeId: this._telemetryInfo.modeId,
      command: this._telemetryInfo.command,
      sessionResource: this._telemetryInfo.sessionResource,
      requestId: this._telemetryInfo.requestId,
      result: this._telemetryInfo.result
    });
  }
  getEditorIntegration(pane) {
    let value = this._editorIntegrations.get(pane);
    if (!value) {
      value = this._createEditorIntegration(pane);
      this._editorIntegrations.set(pane, value);
    }
    return value;
  }
  acceptStreamingEditsStart(responseModel, undoStopId, tx) {
    this._resetEditsState(tx);
    this._isCurrentlyBeingModifiedByObs.set({ responseModel, undoStopId }, tx);
    this._lastModifyingResponseObs.set(responseModel, tx);
    this._autoAcceptCtrl.get()?.cancel();
    const undoRedoElement = this._createUndoRedoElement(responseModel);
    if (undoRedoElement) {
      this._undoRedoService.pushElement(undoRedoElement);
    }
  }
  async acceptStreamingEditsEnd() {
    this._resetEditsState(void 0);
    if (await this._areOriginalAndModifiedIdentical()) {
      await this.accept();
    }
  }
  _resetEditsState(tx) {
    this._isCurrentlyBeingModifiedByObs.set(void 0, tx);
    this._rewriteRatioObs.set(0, tx);
    this._waitsForLastEdits.set(false, tx);
  }
  /**
   * Marks the start of an external edit operation.
   * File system changes will be treated as agent edits until stopExternalEdit is called.
   */
  startExternalEdit() {
    this._isExternalEditInProgress = true;
  }
  /**
   * Marks the end of an external edit operation.
   */
  stopExternalEdit() {
    this._isExternalEditInProgress = false;
  }
};
AbstractChatEditingModifiedFileEntry = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IFilesConfigurationService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IUndoRedoService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IAiEditTelemetryService)
], AbstractChatEditingModifiedFileEntry);
export {
  AbstractChatEditingModifiedFileEntry,
  pendingRewriteMinimap
};
