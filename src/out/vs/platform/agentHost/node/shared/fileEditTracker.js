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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../files/common/files.js";
import { ILogService } from "../../../log/common/log.js";
import { IDiffComputeService } from "../../common/diffComputeService.js";
import { FILE_EDIT_ATTRIBUTION_PROPERTY, IAgentEditAttributionService } from "../../common/fileEditAttribution.js";
import { buildSessionDbUri } from "../../common/sessionDbUri.js";
import { FileEditKind, ToolResultContentType } from "../../common/state/sessionState.js";
import { extractAiChunks } from "./editChunkExtractor.js";
import { IEditSurvivalReporterFactory } from "./editSurvivalReporter.js";
import { IEditArcReporterService } from "./editArcReporter.js";
import { createArcTextEditFromDiff, extractArcTextEdit } from "./arcToolEdit.js";
let FileEditTracker = class {
  constructor(_sessionUri, _db, _fileService, _logService, _diffComputeService, _editSurvivalReporterFactory, _editAttributionService, _editArcReporterService) {
    this._sessionUri = _sessionUri;
    this._db = _db;
    this._fileService = _fileService;
    this._logService = _logService;
    this._diffComputeService = _diffComputeService;
    this._editSurvivalReporterFactory = _editSurvivalReporterFactory;
    this._editAttributionService = _editAttributionService;
    this._editArcReporterService = _editArcReporterService;
    /**
     * Pending edits keyed by file path. Populated by {@link trackEditStart}
     * before the edit tool runs; popped by {@link completeEdit} when it
     * finishes.
     */
    this._pendingEdits = /* @__PURE__ */ new Map();
    /**
     * Completed edits keyed by file path. Populated by {@link completeEdit};
     * drained by {@link takeCompletedEdit}, which persists the entry to
     * the database.
     */
    this._completedEdits = /* @__PURE__ */ new Map();
  }
  /**
   * Call before an edit tool runs. Reads the file's current content
   * into memory as the "before" state. Callers should await this so
   * the snapshot captures pre-edit content before the tool writes to
   * disk.
   *
   * @param filePath - Absolute path of the file being edited.
   * @param mode - Provider execution mode when the edit started.
   */
  async trackEditStart(filePath, mode) {
    const snapshotDone = this._readFileWithExistence(filePath);
    const entry = {
      beforeContent: VSBuffer.fromString(""),
      beforeExisted: false,
      mode,
      snapshotDone: snapshotDone.then(({ content, existed }) => {
        entry.beforeContent = content;
        entry.beforeExisted = existed;
      })
    };
    this._pendingEdits.set(filePath, entry);
    await entry.snapshotDone;
  }
  /**
   * Call after an edit tool finishes. Reads the file content again as
   * the "after" state and stores the result for later retrieval via
   * {@link takeCompletedEdit}.
   *
   * @param filePath - Absolute path of the file that was edited.
   */
  async completeEdit(filePath) {
    const pending = this._pendingEdits.get(filePath);
    if (!pending) {
      return;
    }
    this._pendingEdits.delete(filePath);
    await pending.snapshotDone;
    const afterContent = await this._readFile(filePath);
    this._completedEdits.set(filePath, {
      beforeContent: pending.beforeContent,
      beforeExisted: pending.beforeExisted,
      afterContent,
      mode: pending.mode
    });
  }
  /**
   * Retrieves and removes a completed edit for the given file path,
   * persists it to the session database with computed diff counts,
   * and returns the result as an {@link ToolResultFileEditContent}
   * for inclusion in the tool result.
   *
   * `toolName` and `toolInput` are forwarded to {@link extractAiChunks}
   * for region-based survival scoring; unknown shapes fall back to
   * whole-file scoring.
   */
  async takeCompletedEdit(turnId, toolCallId, filePath, toolName, toolInput, modelId) {
    const edit = this._completedEdits.get(filePath);
    if (!edit) {
      return void 0;
    }
    this._completedEdits.delete(filePath);
    if (!modelId) {
      this._logService.warn(`[FileEditTracker] No modelId for completed edit: ${filePath} (turn=${turnId}, toolCall=${toolCallId}, tool=${toolName || "<unknown>"}). Edit-survival telemetry will be emitted with an empty modelId.`);
    }
    const beforeBytes = edit.beforeContent.buffer;
    const afterBytes = edit.afterContent.buffer;
    const beforeText = edit.beforeContent.toString();
    const afterText = edit.afterContent.toString();
    const completionTime = Date.now();
    const isCreate = !edit.beforeExisted && afterBytes.length > 0;
    let addedLines;
    let removedLines;
    let changes = [];
    try {
      const counts = await this._diffComputeService.computeDiffCounts(beforeText, afterText);
      addedLines = counts.added;
      removedLines = isCreate ? 0 : counts.removed;
      changes = counts.changes;
    } catch (err) {
      this._logService.warn(`[FileEditTracker] Failed to compute diff counts: ${filePath}`, err);
    }
    try {
      await this._db.storeFileEdit({
        turnId,
        toolCallId,
        filePath,
        kind: isCreate ? FileEditKind.Create : FileEditKind.Edit,
        beforeContent: beforeBytes,
        afterContent: afterBytes,
        addedLines,
        removedLines
      });
    } catch (err) {
      this._logService.warn(`[FileEditTracker] Failed to persist file edit to database: ${filePath}`, err);
    }
    this._editSurvivalReporterFactory.launch({
      sessionUri: this._sessionUri,
      turnId,
      toolCallId,
      filePath,
      beforeText,
      afterText,
      isCreate,
      modelId,
      toolName,
      aiChunks: extractAiChunks(toolName, toolInput, filePath)
    });
    const content = {
      type: ToolResultContentType.FileEdit,
      before: {
        uri: URI.file(filePath).toString(),
        content: { uri: buildSessionDbUri(this._sessionUri, toolCallId, filePath, "before") }
      },
      after: {
        uri: URI.file(filePath).toString(),
        content: { uri: buildSessionDbUri(this._sessionUri, toolCallId, filePath, "after") }
      },
      diff: addedLines !== void 0 ? { added: addedLines, removed: removedLines } : void 0
    };
    let marker;
    try {
      marker = await this._editAttributionService.recordEdit({
        sessionUri: this._sessionUri,
        turnId,
        toolCallId,
        filePath,
        beforeText,
        afterText,
        changes,
        modelId,
        toolName
      });
    } catch (error) {
      this._logService.warn(`[FileEditTracker] Failed to record edit attribution for ${filePath}: ${error}`);
    }
    const initialEdit = extractArcTextEdit(toolName, toolInput, beforeText, afterText) ?? createArcTextEditFromDiff(changes, beforeText, afterText);
    this._editArcReporterService.reportEdit({
      sessionUri: this._sessionUri,
      turnId,
      toolCallId,
      filePath,
      beforeText,
      afterText,
      initialEdit,
      modelId,
      toolName,
      mode: edit.mode,
      completionTime
    }).catch((error) => {
      this._logService.warn(`[FileEditTracker] Failed to start ARC telemetry: ${filePath}`, error);
    });
    if (!marker) {
      return content;
    }
    const attributedContent = {
      ...content,
      [FILE_EDIT_ATTRIBUTION_PROPERTY]: marker
    };
    return attributedContent;
  }
  async flushAttribution() {
    await this._editAttributionService.flushSession(this._sessionUri);
  }
  async _readFile(filePath) {
    try {
      const content = await this._fileService.readFile(URI.file(filePath));
      return content.value;
    } catch (err) {
      this._logService.trace(`[FileEditTracker] Could not read file for snapshot: ${filePath}`, err);
      return VSBuffer.fromString("");
    }
  }
  async _readFileWithExistence(filePath) {
    try {
      const content = await this._fileService.readFile(URI.file(filePath));
      return { content: content.value, existed: true };
    } catch (err) {
      this._logService.trace(`[FileEditTracker] Could not read file for snapshot: ${filePath}`, err);
      return { content: VSBuffer.fromString(""), existed: false };
    }
  }
};
FileEditTracker = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IDiffComputeService),
  __decorateParam(5, IEditSurvivalReporterFactory),
  __decorateParam(6, IAgentEditAttributionService),
  __decorateParam(7, IEditArcReporterService)
], FileEditTracker);
export {
  FileEditTracker
};
