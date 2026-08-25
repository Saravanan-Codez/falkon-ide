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
import { TimeoutTimer } from "../../../../../base/common/async.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { runOnChange } from "../../../../../base/common/observable.js";
import { BaseStringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ArcTracker } from "../../common/arcTracker.js";
let ArcTelemetryReporter = class extends Disposable {
  constructor(_timesMs, _documentValueBeforeTrackedEdit, _document, _gitRepo, _trackedEdit, _sendTelemetryEvent, _dispose, _telemetryService) {
    super();
    this._timesMs = _timesMs;
    this._documentValueBeforeTrackedEdit = _documentValueBeforeTrackedEdit;
    this._document = _document;
    this._gitRepo = _gitRepo;
    this._trackedEdit = _trackedEdit;
    this._sendTelemetryEvent = _sendTelemetryEvent;
    this._dispose = _dispose;
    this._telemetryService = _telemetryService;
    this._arcTracker = new ArcTracker(this._documentValueBeforeTrackedEdit, this._trackedEdit);
    this._store.add(runOnChange(this._document.value, (_val, _prevVal, changes) => {
      const edit = BaseStringEdit.composeOrUndefined(changes.map((c) => c.edit));
      if (edit) {
        this._arcTracker.handleEdits(edit);
      }
    }));
    this._initialLineCounts = this._arcTracker.getLineCountInfo();
    this._initialBranchName = this._gitRepo.get()?.headBranchNameObs.get();
    for (let i = 0; i < this._timesMs.length; i++) {
      const timeMs = this._timesMs[i];
      if (timeMs <= 0) {
        this._report(timeMs);
      } else {
        this._reportAfter(timeMs, i === this._timesMs.length - 1 ? () => {
          this._dispose();
        } : void 0);
      }
    }
  }
  _reportAfter(timeoutMs, cb) {
    const timer = new TimeoutTimer(() => {
      this._report(timeoutMs);
      timer.dispose();
      if (cb) {
        cb();
      }
    }, timeoutMs);
    this._store.add(timer);
  }
  _report(timeMs) {
    const currentBranch = this._gitRepo.get()?.headBranchNameObs.get();
    const didBranchChange = currentBranch !== this._initialBranchName;
    const currentLineCounts = this._arcTracker.getLineCountInfo();
    this._sendTelemetryEvent({
      telemetryService: this._telemetryService,
      timeDelayMs: timeMs,
      didBranchChange,
      arc: this._arcTracker.getAcceptedRestrainedCharactersCount(),
      originalCharCount: this._arcTracker.getOriginalCharacterCount(),
      currentLineCount: currentLineCounts.insertedLineCounts,
      currentDeletedLineCount: currentLineCounts.deletedLineCounts,
      originalLineCount: this._initialLineCounts.insertedLineCounts,
      originalDeletedLineCount: this._initialLineCounts.deletedLineCounts
    });
  }
};
ArcTelemetryReporter = __decorateClass([
  __decorateParam(7, ITelemetryService)
], ArcTelemetryReporter);
export {
  ArcTelemetryReporter
};
