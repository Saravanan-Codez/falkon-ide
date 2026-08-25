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
import { SequencerByKey, TimeoutTimer } from "../../../../base/common/async.js";
import { EditArcTracker } from "../../../../base/common/editArcTracker.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { dirname, extname } from "../../../../base/common/path.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { URI } from "../../../../base/common/uri.js";
import { FileChangeType, FileOperationResult, IFileService, toFileOperationResult } from "../../../files/common/files.js";
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { ITelemetryService, TelemetryLevel } from "../../../telemetry/common/telemetry.js";
import { AgentSession } from "../../common/agentService.js";
import { IAgentHostGitService } from "../../common/agentHostGitService.js";
import { AgentHostEditTelemetryEnabledConfigKey, platformRootSchema } from "../../common/agentHostSchema.js";
import { IDiffComputeService } from "../../common/diffComputeService.js";
import { isAhpChatChannel, isSubagentChatUri, isSubagentSession, parseRequiredSessionUriFromChatUri } from "../../common/state/sessionState.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { isAgentHostTelemetryService } from "../agentHostTelemetryService.js";
const IEditArcReporterService = createDecorator("editArcReporterService");
class NullEditArcReporterService {
  async reportEdit(_params) {
  }
}
const SAMPLE_SCHEDULE_MS = [0, 6e4, 3e5];
const MAX_TRACKED_FILE_SIZE_CHARS = 5 * 1024 * 1024;
const MAX_REPORTERS_PER_RESOURCE = 20;
const MAX_REPORTERS_HOST_WIDE = 200;
const MAX_RETAINED_CHARACTERS_HOST_WIDE = 100 * 1024 * 1024;
let EditArcReporterService = class extends Disposable {
  constructor(_sampleScheduleMs = SAMPLE_SCHEDULE_MS, _fileService, _diffComputeService, _gitService, _configurationService, _logService, _telemetryService) {
    super();
    this._sampleScheduleMs = _sampleScheduleMs;
    this._fileService = _fileService;
    this._diffComputeService = _diffComputeService;
    this._gitService = _gitService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
    this._resourceSequencer = new SequencerByKey();
    this._resources = this._register(new DisposableMap());
    this._reporterCount = 0;
    this._retainedCharacters = 0;
    this._register(this._configurationService.onDidRootConfigChange(() => {
      if (!this._isEnabled()) {
        this._disposeAllReporters("configuration disabled");
      }
    }));
  }
  async reportEdit(params) {
    const resource = URI.file(params.filePath);
    const key = extUriBiasedIgnorePathCase.getComparisonKey(resource);
    await this._resourceSequencer.queue(key, async () => {
      if (!this._isEnabled()) {
        this._logService.trace(`[EditArcReporter] Skipping ${params.filePath}: telemetry is disabled`);
        return;
      }
      if (extname(params.filePath).toLowerCase() === ".ipynb") {
        this._logService.trace(`[EditArcReporter] Skipping notebook: ${params.filePath}`);
        return;
      }
      const retainedCharacters = params.beforeText.length + params.afterText.length;
      if (Math.max(params.beforeText.length, params.afterText.length) > MAX_TRACKED_FILE_SIZE_CHARS) {
        this._logService.warn(`[EditArcReporter] Skipping oversized file: ${params.filePath}`);
        return;
      }
      let state = this._resources.get(key);
      if (state) {
        if (!await this._applyCompletedEdit(state, params)) {
          return;
        }
        if (!this._isEnabled() || this._resources.get(key) !== state) {
          return;
        }
      }
      if (state && state.reporters.size >= MAX_REPORTERS_PER_RESOURCE) {
        this._logService.warn(`[EditArcReporter] Skipping edit: per-resource reporter limit reached for ${params.filePath}`);
        return;
      }
      if (this._reporterCount >= MAX_REPORTERS_HOST_WIDE || this._retainedCharacters + retainedCharacters > MAX_RETAINED_CHARACTERS_HOST_WIDE) {
        this._logService.warn(`[EditArcReporter] Skipping edit: host reporter memory limit reached`);
        return;
      }
      state ??= this._createResourceState(key, resource, params.afterText);
      const resourceState = state;
      const reporter = new EditArcReporter(params, this._sampleScheduleMs, resourceState.gitWorkingDirectory, this._gitService, this._telemetryService, this._logService, (timeDelayMs) => this.reconcileAndSample(resourceState, reporter, timeDelayMs), () => {
        resourceState.reporters.delete(reporter);
        this._reporterCount--;
        this._retainedCharacters -= retainedCharacters;
        if (!resourceState.isDisposing && resourceState.reporters.size === 0) {
          this._resources.deleteAndDispose(key);
        }
      });
      resourceState.reporters.add(reporter);
      this._reporterCount++;
      this._retainedCharacters += retainedCharacters;
    });
  }
  _createResourceState(key, resource, logicalText) {
    const store = new DisposableStore();
    const fileDirectory = URI.file(dirname(resource.fsPath));
    const state = {
      resource,
      gitWorkingDirectory: this._gitService.getRepositoryRoot(fileDirectory).then((repositoryRoot) => repositoryRoot ?? fileDirectory),
      logicalText,
      reporters: /* @__PURE__ */ new Set(),
      isDisposing: false,
      dispose: () => {
        state.isDisposing = true;
        store.dispose();
      }
    };
    store.add(toDisposable(() => {
      for (const reporter of [...state.reporters]) {
        reporter.dispose();
      }
    }));
    try {
      const watcher = store.add(this._fileService.createWatcher(URI.file(dirname(resource.fsPath)), { recursive: false, excludes: [] }));
      store.add(watcher.onDidChange((event) => {
        if (event.contains(resource, FileChangeType.ADDED, FileChangeType.UPDATED, FileChangeType.DELETED)) {
          this._resourceSequencer.queue(key, async () => {
            try {
              await this._reconcileFromDisk(state, false);
            } catch (error) {
              this._logService.warn(`[EditArcReporter] Watcher reconciliation failed for ${resource.fsPath}`, error);
            }
          });
        }
      }));
    } catch (error) {
      this._logService.warn(`[EditArcReporter] Failed to watch ${resource.fsPath}; delayed samples will use forced reconciliation`, error);
    }
    this._resources.set(key, state);
    return state;
  }
  async _applyCompletedEdit(state, params) {
    if (state.logicalText === params.afterText) {
      return true;
    }
    if (state.logicalText === params.beforeText) {
      await this._applyEdit(state, params.initialEdit, params.afterText);
      return true;
    }
    const detailed = await this._diffComputeService.computeDetailedDiff(state.logicalText, params.afterText);
    if (detailed.hitTimeout) {
      this._logService.warn(`[EditArcReporter] Could not update older reporters before ${params.toolCallId}: detailed diff timed out`);
      return false;
    }
    await this._applyEdit(state, { replacements: detailed.replacements }, params.afterText);
    return true;
  }
  async _reconcileFromDisk(state, sample) {
    let currentText;
    try {
      currentText = (await this._fileService.readFile(state.resource)).value.toString();
    } catch (error) {
      if (toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND) {
        currentText = "";
      } else {
        this._logService.warn(`[EditArcReporter] Failed to read ${state.resource.fsPath}${sample ? " before sample" : ""}`, error);
        return false;
      }
    }
    if (currentText === state.logicalText) {
      return true;
    }
    const detailed = await this._diffComputeService.computeDetailedDiff(state.logicalText, currentText);
    if (detailed.hitTimeout) {
      this._logService.warn(`[EditArcReporter] Detailed diff timed out for ${state.resource.fsPath}`);
      return false;
    }
    await this._applyEdit(state, { replacements: detailed.replacements }, currentText);
    return true;
  }
  async _applyEdit(state, edit, afterText) {
    for (const reporter of state.reporters) {
      reporter.handleEdit(edit);
    }
    state.logicalText = afterText;
  }
  _isEnabled() {
    return this._telemetryService.telemetryLevel >= TelemetryLevel.USAGE && this._configurationService.getRootValue(platformRootSchema, AgentHostEditTelemetryEnabledConfigKey) !== false;
  }
  _disposeAllReporters(reason) {
    if (this._reporterCount > 0) {
      this._logService.info(`[EditArcReporter] Disposing ${this._reporterCount} active reporters: ${reason}`);
    }
    this._resources.clearAndDisposeAll();
    this._reporterCount = 0;
    this._retainedCharacters = 0;
  }
  async reconcileAndSample(state, reporter, timeDelayMs) {
    const key = extUriBiasedIgnorePathCase.getComparisonKey(state.resource);
    await this._resourceSequencer.queue(key, async () => {
      if (!this._isEnabled()) {
        reporter.dispose();
        return;
      }
      if (timeDelayMs !== 0 && !await this._reconcileFromDisk(state, true)) {
        return;
      }
      await reporter.emit(timeDelayMs);
    });
  }
};
EditArcReporterService = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IDiffComputeService),
  __decorateParam(3, IAgentHostGitService),
  __decorateParam(4, IAgentConfigurationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ITelemetryService)
], EditArcReporterService);
class EditArcReporter extends Disposable {
  constructor(_params, _sampleScheduleMs, _gitWorkingDirectory, _gitService, _telemetryService, _logService, _sample, onDispose) {
    super();
    this._params = _params;
    this._sampleScheduleMs = _sampleScheduleMs;
    this._gitWorkingDirectory = _gitWorkingDirectory;
    this._gitService = _gitService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._sample = _sample;
    this._uniqueEditId = generateUuid();
    this._sampleIndex = 0;
    this._tracker = new EditArcTracker(_params.beforeText, _params.initialEdit);
    this._initialBranch = this._getCurrentBranchName();
    this._register(toDisposable(onDispose));
    this._scheduleNext();
  }
  handleEdit(edit) {
    this._tracker.handleEdits(edit);
  }
  _scheduleNext() {
    if (this._store.isDisposed) {
      return;
    }
    if (this._sampleIndex >= this._sampleScheduleMs.length) {
      this.dispose();
      return;
    }
    const delay = Math.max(0, this._params.completionTime + this._sampleScheduleMs[this._sampleIndex] - Date.now());
    const timer = this._register(new TimeoutTimer());
    timer.setIfNotSet(async () => {
      const timeDelayMs = this._sampleScheduleMs[this._sampleIndex++];
      try {
        await this._sample(timeDelayMs);
      } catch (error) {
        this._logService.warn(`[EditArcReporter] Failed to sample ${this._params.filePath} after ${timeDelayMs}ms`, error);
      } finally {
        this._scheduleNext();
      }
    }, delay);
  }
  async emit(timeDelayMs) {
    const sessionUri = isAhpChatChannel(this._params.sessionUri) ? parseRequiredSessionUriFromChatUri(this._params.sessionUri) : this._params.sessionUri;
    const provider = AgentSession.provider(sessionUri) ?? "unknown";
    const originalLineCounts = new EditArcTracker(this._params.beforeText, this._params.initialEdit).getLineCountInfo();
    const currentLineCounts = this._tracker.getLineCountInfo();
    const event = {
      sourceKeyCleaned: "source:Chat.applyEdits",
      extensionId: void 0,
      extensionVersion: void 0,
      opportunityId: void 0,
      editSessionId: AgentSession.id(sessionUri),
      requestId: this._params.turnId,
      modelId: this._params.modelId,
      languageId: void 0,
      mode: this._params.mode,
      uniqueEditId: this._uniqueEditId,
      provider,
      agentSessionId: AgentSession.id(sessionUri),
      isSubagentSession: isSubagentChatUri(this._params.sessionUri) || isSubagentSession(sessionUri) ? "true" : "false",
      didBranchChange: await this._initialBranch === await this._getCurrentBranchName() ? 0 : 1,
      timeDelayMs,
      originalCharCount: this._tracker.getOriginalCharacterCount(),
      originalLineCount: originalLineCounts.insertedLineCounts,
      originalDeletedLineCount: originalLineCounts.deletedLineCounts,
      arc: this._tracker.getAcceptedRestrainedCharactersCount(),
      currentLineCount: currentLineCounts.insertedLineCounts,
      currentDeletedLineCount: currentLineCounts.deletedLineCounts
    };
    this._telemetryService.publicLog2("editTelemetry.reportEditArc", event);
    if (provider === "copilotcli" && isAgentHostTelemetryService(this._telemetryService)) {
      const { didBranchChange, timeDelayMs: delay, originalCharCount, originalLineCount, originalDeletedLineCount, arc, currentLineCount, currentDeletedLineCount, ...properties } = event;
      const telemetry = this._telemetryService;
      telemetry.sendGHTelemetryEvent("vscode.editTelemetry.reportEditArc", withoutUndefined(properties), {
        didBranchChange,
        timeDelayMs: delay,
        originalCharCount,
        originalLineCount,
        originalDeletedLineCount,
        arc,
        currentLineCount,
        currentDeletedLineCount
      });
    }
    if (timeDelayMs === this._sampleScheduleMs.at(-1)) {
      this.dispose();
    }
  }
  async _getCurrentBranchName() {
    const workingDirectory = await this._gitWorkingDirectory;
    return this._gitService.getCurrentBranchName?.(workingDirectory) ?? this._gitService.getCurrentBranch(workingDirectory);
  }
}
function withoutUndefined(values) {
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return result;
}
export {
  EditArcReporterService,
  IEditArcReporterService,
  NullEditArcReporterService
};
