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
import { TimeoutTimer } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { extname } from "../../../../base/common/path.js";
import { URI } from "../../../../base/common/uri.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../files/common/files.js";
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { ITelemetryService } from "../../../telemetry/common/telemetry.js";
import { AgentSession } from "../../common/agentService.js";
import { isAhpChatChannel, parseRequiredSessionUriFromChatUri } from "../../common/state/sessionState.js";
import { computeChunkedEditSurvival, computeWholeFileEditSurvival } from "./editSurvivalTracker.js";
const IEditSurvivalReporterFactory = createDecorator("editSurvivalReporterFactory");
class NullEditSurvivalReporterFactory {
  launch(_params) {
    return { dispose() {
    } };
  }
}
const SAMPLE_SCHEDULE_MS = [0, 5e3, 3e4, 12e4, 3e5, 6e5, 9e5];
class SessionEditSurvivalReporter extends Disposable {
  constructor(_params, _fileService, _logService, _telemetryService) {
    super();
    this._params = _params;
    this._fileService = _fileService;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
    this._startTime = Date.now();
    this._samplesTaken = 0;
    this._scheduleNext();
  }
  _scheduleNext() {
    if (this._samplesTaken >= SAMPLE_SCHEDULE_MS.length) {
      this.dispose();
      return;
    }
    const elapsed = Date.now() - this._startTime;
    const delay = Math.max(0, SAMPLE_SCHEDULE_MS[this._samplesTaken] - elapsed);
    const timer = this._register(new TimeoutTimer());
    timer.setIfNotSet(() => this._takeSample(), delay);
  }
  async _takeSample() {
    const sampleIndex = this._samplesTaken++;
    const timeDelayMs = SAMPLE_SCHEDULE_MS[sampleIndex];
    try {
      let currentText;
      let didFileGetDeleted = false;
      try {
        const content = await this._fileService.readFile(URI.file(this._params.filePath));
        currentText = content.value.toString();
      } catch (err) {
        if (toFileOperationResult(err) === FileOperationResult.FILE_NOT_FOUND) {
          didFileGetDeleted = true;
          currentText = "";
        } else {
          this._logService.warn(`[EditSurvivalReporter] readFile failed for ${this._params.filePath}, skipping sample: ${err}`);
          this._scheduleNext();
          return;
        }
      }
      const aiChunks = this._params.aiChunks ?? [];
      const useChunked = aiChunks.length > 0;
      const aiCharCount = useChunked ? aiChunks.reduce((sum, c) => sum + c.length, 0) : 0;
      const scores = didFileGetDeleted ? { fourGram: 0, noRevert: 0 } : useChunked ? computeChunkedEditSurvival(this._params.beforeText, this._params.afterText, aiChunks, currentText) : computeWholeFileEditSurvival(this._params.beforeText, this._params.afterText, currentText);
      const sessionUri = isAhpChatChannel(this._params.sessionUri) ? parseRequiredSessionUriFromChatUri(this._params.sessionUri) : this._params.sessionUri;
      this._telemetryService.publicLog2(
        "agentHost.trackEditSurvival",
        {
          provider: AgentSession.provider(sessionUri) ?? "unknown",
          modelId: this._params.modelId ?? "",
          toolName: this._params.toolName ?? "",
          agentSessionId: AgentSession.id(sessionUri),
          turnId: this._params.turnId,
          toolCallId: this._params.toolCallId,
          fileExtension: extname(this._params.filePath),
          survivalRateFourGram: scores.fourGram,
          survivalRateNoRevert: scores.noRevert,
          scoringMode: useChunked ? "chunked" : "whole-file",
          aiChunkCount: aiChunks.length,
          aiCharCount,
          timeDelayMs,
          didFileGetDeleted: didFileGetDeleted ? 1 : 0,
          isCreate: this._params.isCreate ? 1 : 0,
          beforeTextLength: this._params.beforeText.length,
          afterTextLength: this._params.afterText.length,
          currentTextLength: didFileGetDeleted ? 0 : currentText.length
        }
      );
      if (didFileGetDeleted) {
        this.dispose();
        return;
      }
    } catch (err) {
      this._logService.warn(`[EditSurvivalReporter] sample failed for ${this._params.filePath}: ${err}`);
    }
    this._scheduleNext();
  }
}
const MAX_TRACKED_FILE_SIZE_CHARS = 5 * 1024 * 1024;
let EditSurvivalReporterFactory = class {
  constructor(_fileService, _logService, _telemetryService) {
    this._fileService = _fileService;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
  }
  launch(params) {
    if (extname(params.filePath).toLowerCase() === ".ipynb") {
      return { dispose() {
      } };
    }
    if (Math.max(params.beforeText.length, params.afterText.length) > MAX_TRACKED_FILE_SIZE_CHARS) {
      return { dispose() {
      } };
    }
    return new SessionEditSurvivalReporter(params, this._fileService, this._logService, this._telemetryService);
  }
};
EditSurvivalReporterFactory = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ITelemetryService)
], EditSurvivalReporterFactory);
export {
  EditSurvivalReporterFactory,
  IEditSurvivalReporterFactory,
  NullEditSurvivalReporterFactory
};
