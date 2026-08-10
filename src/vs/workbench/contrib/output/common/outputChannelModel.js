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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import * as resources from "../../../../base/common/resources.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Promises, ThrottledDelayer } from "../../../../base/common/async.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { Disposable, toDisposable, MutableDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isNumber } from "../../../../base/common/types.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { ILoggerService, ILogService, LogLevel } from "../../../../platform/log/common/log.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { LOG_MIME, OutputChannelUpdateMode } from "../../../services/output/common/output.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { TextModel } from "../../../../editor/common/model/textModel.js";
import { binarySearch, sortedDiff } from "../../../../base/common/arrays.js";
const LOG_ENTRY_REGEX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s(\[(info|trace|debug|error|warning)\])\s(\[(.*?)\])?/;
function parseLogEntryAt(model, lineNumber) {
  const lineContent = model.getLineContent(lineNumber);
  const match = LOG_ENTRY_REGEX.exec(lineContent);
  if (match) {
    const timestamp = new Date(match[1]).getTime();
    const timestampRange = new Range(lineNumber, 1, lineNumber, match[1].length);
    const logLevel = parseLogLevel(match[3]);
    const logLevelRange = new Range(lineNumber, timestampRange.endColumn + 1, lineNumber, timestampRange.endColumn + 1 + match[2].length);
    const category = match[5];
    const startLine = lineNumber;
    let endLine = lineNumber;
    const lineCount = model.getLineCount();
    while (endLine < lineCount) {
      const nextLineContent = model.getLineContent(endLine + 1);
      const isLastLine = endLine + 1 === lineCount && nextLineContent === "";
      if (LOG_ENTRY_REGEX.test(nextLineContent) || isLastLine) {
        break;
      }
      endLine++;
    }
    const range = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
    return { range, timestamp, timestampRange, logLevel, logLevelRange, category };
  }
  return null;
}
function* logEntryIterator(model, process) {
  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
    const logEntry = parseLogEntryAt(model, lineNumber);
    if (logEntry) {
      yield process(logEntry);
      lineNumber = logEntry.range.endLineNumber;
    }
  }
}
function changeStartLineNumber(logEntry, lineNumber) {
  return {
    ...logEntry,
    range: new Range(lineNumber, logEntry.range.startColumn, lineNumber + logEntry.range.endLineNumber - logEntry.range.startLineNumber, logEntry.range.endColumn),
    timestampRange: new Range(lineNumber, logEntry.timestampRange.startColumn, lineNumber, logEntry.timestampRange.endColumn),
    logLevelRange: new Range(lineNumber, logEntry.logLevelRange.startColumn, lineNumber, logEntry.logLevelRange.endColumn)
  };
}
function parseLogLevel(level) {
  switch (level.toLowerCase()) {
    case "trace":
      return LogLevel.Trace;
    case "debug":
      return LogLevel.Debug;
    case "info":
      return LogLevel.Info;
    case "warning":
      return LogLevel.Warning;
    case "error":
      return LogLevel.Error;
    default:
      throw new Error(`Unknown log level: ${level}`);
  }
}
let FileContentProvider = class extends Disposable {
  constructor({ name, resource }, fileService, instantiationService, logService) {
    super();
    this.fileService = fileService;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this._onDidAppend = this._register(new Emitter());
    this._onDidReset = this._register(new Emitter());
    this.watching = false;
    this.etag = "";
    this.logEntries = [];
    this.startOffset = 0;
    this.endOffset = 0;
    this.name = name ?? "";
    this.resource = resource;
    this.syncDelayer = new ThrottledDelayer(500);
    this._register(toDisposable(() => this.unwatch()));
  }
  get onDidAppend() {
    return this._onDidAppend.event;
  }
  get onDidReset() {
    return this._onDidReset.event;
  }
  reset(offset) {
    this.endOffset = this.startOffset = offset ?? this.startOffset;
    this.logEntries = [];
  }
  resetToEnd() {
    this.startOffset = this.endOffset;
    this.logEntries = [];
  }
  watch() {
    if (!this.watching) {
      this.logService.trace("Started polling", this.resource.toString());
      this.poll();
      this.watching = true;
    }
  }
  unwatch() {
    if (this.watching) {
      this.syncDelayer.cancel();
      this.watching = false;
      this.logService.trace("Stopped polling", this.resource.toString());
    }
  }
  poll() {
    const loop = () => this.doWatch().then(() => this.poll());
    this.syncDelayer.trigger(loop).catch((error) => {
      if (!isCancellationError(error)) {
        throw error;
      }
    });
  }
  async doWatch() {
    try {
      if (!this.fileService.hasProvider(this.resource)) {
        return;
      }
      const stat = await this.fileService.stat(this.resource);
      if (stat.etag !== this.etag) {
        this.etag = stat.etag;
        if (isNumber(stat.size) && this.endOffset > stat.size) {
          this.reset(0);
          this._onDidReset.fire();
        } else {
          this._onDidAppend.fire();
        }
      }
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        throw error;
      }
    }
  }
  getLogEntries() {
    return this.logEntries;
  }
  async getContent(donotConsumeLogEntries) {
    try {
      if (!this.fileService.hasProvider(this.resource)) {
        return {
          name: this.name,
          content: "",
          consume: () => {
          }
        };
      }
      const fileContent = await this.fileService.readFile(this.resource, { position: this.endOffset });
      const content = fileContent.value.toString();
      const logEntries = donotConsumeLogEntries ? [] : this.parseLogEntries(content, this.logEntries[this.logEntries.length - 1]);
      let consumed = false;
      return {
        name: this.name,
        content,
        consume: () => {
          if (!consumed) {
            consumed = true;
            this.endOffset += fileContent.value.byteLength;
            this.etag = fileContent.etag;
            this.logEntries.push(...logEntries);
          }
        }
      };
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        throw error;
      }
      return {
        name: this.name,
        content: "",
        consume: () => {
        }
      };
    }
  }
  parseLogEntries(content, lastLogEntry) {
    const model = this.instantiationService.createInstance(TextModel, content, LOG_MIME, TextModel.DEFAULT_CREATION_OPTIONS, null);
    try {
      if (!parseLogEntryAt(model, 1)) {
        return [];
      }
      const logEntries = [];
      let logEntryStartLineNumber = lastLogEntry ? lastLogEntry.range.endLineNumber + 1 : 1;
      for (const entry of logEntryIterator(model, (e) => changeStartLineNumber(e, logEntryStartLineNumber))) {
        logEntries.push(entry);
        logEntryStartLineNumber = entry.range.endLineNumber + 1;
      }
      return logEntries;
    } finally {
      model.dispose();
    }
  }
};
FileContentProvider = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService)
], FileContentProvider);
let MultiFileContentProvider = class extends Disposable {
  constructor(filesInfos, instantiationService, fileService, logService) {
    super();
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.logService = logService;
    this._onDidAppend = this._register(new Emitter());
    this.onDidAppend = this._onDidAppend.event;
    this.onDidReset = Event.None;
    this.logEntries = [];
    this.fileContentProviderItems = [];
    this.watching = false;
    for (const file of filesInfos) {
      this.fileContentProviderItems.push(this.createFileContentProvider(file));
    }
    this._register(toDisposable(() => {
      for (const [, disposables] of this.fileContentProviderItems) {
        disposables.dispose();
      }
    }));
  }
  createFileContentProvider(file) {
    const disposables = new DisposableStore();
    const fileOutput = disposables.add(new FileContentProvider(file, this.fileService, this.instantiationService, this.logService));
    disposables.add(fileOutput.onDidAppend(() => this._onDidAppend.fire()));
    return [fileOutput, disposables];
  }
  watch() {
    if (!this.watching) {
      this.watching = true;
      for (const [output] of this.fileContentProviderItems) {
        output.watch();
      }
    }
  }
  unwatch() {
    if (this.watching) {
      this.watching = false;
      for (const [output] of this.fileContentProviderItems) {
        output.unwatch();
      }
    }
  }
  updateFiles(files) {
    const wasWatching = this.watching;
    if (wasWatching) {
      this.unwatch();
    }
    const result = sortedDiff(this.fileContentProviderItems.map(([output]) => output), files, (a, b) => resources.extUri.compare(a.resource, b.resource));
    for (const { start, deleteCount, toInsert } of result) {
      const outputs = toInsert.map((file) => this.createFileContentProvider(file));
      const outputsToRemove = this.fileContentProviderItems.splice(start, deleteCount, ...outputs);
      for (const [, disposables] of outputsToRemove) {
        disposables.dispose();
      }
    }
    if (wasWatching) {
      this.watch();
    }
  }
  reset() {
    for (const [output] of this.fileContentProviderItems) {
      output.reset();
    }
    this.logEntries = [];
  }
  resetToEnd() {
    for (const [output] of this.fileContentProviderItems) {
      output.resetToEnd();
    }
    this.logEntries = [];
  }
  getLogEntries() {
    return this.logEntries;
  }
  async getContent() {
    const outputs = await Promise.all(this.fileContentProviderItems.map(([output]) => output.getContent(true)));
    const { content, logEntries } = this.combineLogEntries(outputs, this.logEntries[this.logEntries.length - 1]);
    let consumed = false;
    return {
      content,
      consume: () => {
        if (!consumed) {
          consumed = true;
          outputs.forEach(({ consume }) => consume());
          this.logEntries.push(...logEntries);
        }
      }
    };
  }
  combineLogEntries(outputs, lastEntry) {
    outputs = outputs.filter((output) => !!output.content);
    if (outputs.length === 0) {
      return { logEntries: [], content: "" };
    }
    const logEntries = [];
    const contents = [];
    const process = (model2, logEntry, name) => {
      const lineContent = model2.getValueInRange(logEntry.range);
      const content2 = name ? `${lineContent.substring(0, logEntry.logLevelRange.endColumn)} [${name}]${lineContent.substring(logEntry.logLevelRange.endColumn)}` : lineContent;
      return [{
        ...logEntry,
        category: name,
        range: new Range(logEntry.range.startLineNumber, logEntry.logLevelRange.startColumn, logEntry.range.endLineNumber, name ? logEntry.range.endColumn + name.length + 3 : logEntry.range.endColumn)
      }, content2];
    };
    const model = this.instantiationService.createInstance(TextModel, outputs[0].content, LOG_MIME, TextModel.DEFAULT_CREATION_OPTIONS, null);
    try {
      for (const [logEntry, content2] of logEntryIterator(model, (e) => process(model, e, outputs[0].name))) {
        logEntries.push(logEntry);
        contents.push(content2);
      }
    } finally {
      model.dispose();
    }
    for (let index = 1; index < outputs.length; index++) {
      const { content: content2, name } = outputs[index];
      const model2 = this.instantiationService.createInstance(TextModel, content2, LOG_MIME, TextModel.DEFAULT_CREATION_OPTIONS, null);
      try {
        const iterator = logEntryIterator(model2, (e) => process(model2, e, name));
        let next = iterator.next();
        while (!next.done) {
          const [logEntry, content3] = next.value;
          const logEntriesToAdd = [logEntry];
          const contentsToAdd = [content3];
          let insertionIndex;
          if (logEntry.timestamp >= logEntries[logEntries.length - 1].timestamp) {
            insertionIndex = logEntries.length;
            for (next = iterator.next(); !next.done; next = iterator.next()) {
              logEntriesToAdd.push(next.value[0]);
              contentsToAdd.push(next.value[1]);
            }
          } else {
            if (logEntry.timestamp <= logEntries[0].timestamp) {
              insertionIndex = 0;
            } else {
              const idx = binarySearch(logEntries, logEntry, (a, b) => a.timestamp - b.timestamp);
              insertionIndex = idx < 0 ? ~idx : idx;
            }
            for (next = iterator.next(); !next.done && next.value[0].timestamp <= logEntries[insertionIndex].timestamp; next = iterator.next()) {
              logEntriesToAdd.push(next.value[0]);
              contentsToAdd.push(next.value[1]);
            }
          }
          contents.splice(insertionIndex, 0, ...contentsToAdd);
          logEntries.splice(insertionIndex, 0, ...logEntriesToAdd);
        }
      } finally {
        model2.dispose();
      }
    }
    let content = "";
    const updatedLogEntries = [];
    let logEntryStartLineNumber = lastEntry ? lastEntry.range.endLineNumber + 1 : 1;
    for (let i = 0; i < logEntries.length; i++) {
      content += contents[i] + "\n";
      const updatedLogEntry = changeStartLineNumber(logEntries[i], logEntryStartLineNumber);
      updatedLogEntries.push(updatedLogEntry);
      logEntryStartLineNumber = updatedLogEntry.range.endLineNumber + 1;
    }
    return { logEntries: updatedLogEntries, content };
  }
};
MultiFileContentProvider = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IFileService),
  __decorateParam(3, ILogService)
], MultiFileContentProvider);
let AbstractFileOutputChannelModel = class extends Disposable {
  constructor(modelUri, language, outputContentProvider, modelService, editorWorkerService) {
    super();
    this.modelUri = modelUri;
    this.language = language;
    this.outputContentProvider = outputContentProvider;
    this.modelService = modelService;
    this.editorWorkerService = editorWorkerService;
    this._onDispose = this._register(new Emitter());
    this.onDispose = this._onDispose.event;
    this.loadModelPromise = null;
    this.modelDisposable = this._register(new MutableDisposable());
    this.model = null;
    this.modelUpdateInProgress = false;
    this.modelUpdateCancellationSource = this._register(new MutableDisposable());
    this.appendThrottler = this._register(new ThrottledDelayer(300));
  }
  async loadModel() {
    this.loadModelPromise = Promises.withAsyncBody(async (c, e) => {
      try {
        this.modelDisposable.value = new DisposableStore();
        this.model = this.modelService.createModel("", this.language, this.modelUri);
        const { content, consume } = await this.outputContentProvider.getContent();
        consume();
        this.doAppendContent(this.model, content);
        this.modelDisposable.value.add(this.outputContentProvider.onDidReset(() => this.onDidContentChange(true, true)));
        this.modelDisposable.value.add(this.outputContentProvider.onDidAppend(() => this.onDidContentChange(false, false)));
        this.outputContentProvider.watch();
        this.modelDisposable.value.add(toDisposable(() => this.outputContentProvider.unwatch()));
        this.modelDisposable.value.add(this.model.onWillDispose(() => {
          this.outputContentProvider.reset();
          this.modelDisposable.value = void 0;
          this.cancelModelUpdate();
          this.model = null;
        }));
        c(this.model);
      } catch (error) {
        e(error);
      }
    });
    return this.loadModelPromise;
  }
  getLogEntries() {
    return this.outputContentProvider.getLogEntries();
  }
  onDidContentChange(reset, appendImmediately) {
    if (reset && !this.modelUpdateInProgress) {
      this.doUpdate(OutputChannelUpdateMode.Clear, true);
    }
    this.doUpdate(OutputChannelUpdateMode.Append, appendImmediately);
  }
  doUpdate(mode, immediate) {
    if (mode === OutputChannelUpdateMode.Clear || mode === OutputChannelUpdateMode.Replace) {
      this.cancelModelUpdate();
    }
    if (!this.model) {
      return;
    }
    this.modelUpdateInProgress = true;
    if (!this.modelUpdateCancellationSource.value) {
      this.modelUpdateCancellationSource.value = new CancellationTokenSource();
    }
    const token = this.modelUpdateCancellationSource.value.token;
    if (mode === OutputChannelUpdateMode.Clear) {
      this.clearContent(this.model);
    } else if (mode === OutputChannelUpdateMode.Replace) {
      this.replacePromise = this.replaceContent(this.model, token).finally(() => this.replacePromise = void 0);
    } else {
      this.appendContent(this.model, immediate, token);
    }
  }
  clearContent(model) {
    model.applyEdits([EditOperation.delete(model.getFullModelRange())]);
    this.modelUpdateInProgress = false;
  }
  appendContent(model, immediate, token) {
    this.appendThrottler.trigger(async () => {
      if (token.isCancellationRequested) {
        return;
      }
      if (this.replacePromise) {
        try {
          await this.replacePromise;
        } catch (e) {
        }
        if (token.isCancellationRequested) {
          return;
        }
      }
      const { content, consume } = await this.outputContentProvider.getContent();
      if (token.isCancellationRequested) {
        return;
      }
      consume();
      this.doAppendContent(model, content);
      this.modelUpdateInProgress = false;
    }, immediate ? 0 : void 0).catch((error) => {
      if (!isCancellationError(error)) {
        throw error;
      }
    });
  }
  doAppendContent(model, content) {
    const lastLine = model.getLineCount();
    const lastLineMaxColumn = model.getLineMaxColumn(lastLine);
    model.applyEdits([EditOperation.insert(new Position(lastLine, lastLineMaxColumn), content)]);
  }
  async replaceContent(model, token) {
    const { content, consume } = await this.outputContentProvider.getContent();
    if (token.isCancellationRequested) {
      return;
    }
    const edits = await this.getReplaceEdits(model, content.toString());
    if (token.isCancellationRequested) {
      return;
    }
    consume();
    if (edits.length) {
      model.applyEdits(edits);
    }
    this.modelUpdateInProgress = false;
  }
  async getReplaceEdits(model, contentToReplace) {
    if (!contentToReplace) {
      return [EditOperation.delete(model.getFullModelRange())];
    }
    if (contentToReplace !== model.getValue()) {
      const edits = await this.editorWorkerService.computeMoreMinimalEdits(model.uri, [{ text: contentToReplace.toString(), range: model.getFullModelRange() }]);
      if (edits?.length) {
        return edits.map((edit) => EditOperation.replace(Range.lift(edit.range), edit.text));
      }
    }
    return [];
  }
  cancelModelUpdate() {
    this.modelUpdateCancellationSource.value?.cancel();
    this.modelUpdateCancellationSource.value = void 0;
    this.appendThrottler.cancel();
    this.replacePromise = void 0;
    this.modelUpdateInProgress = false;
  }
  isVisible() {
    return !!this.model;
  }
  dispose() {
    this._onDispose.fire();
    super.dispose();
  }
  append(message) {
    throw new Error("Not supported");
  }
  replace(message) {
    throw new Error("Not supported");
  }
};
AbstractFileOutputChannelModel = __decorateClass([
  __decorateParam(3, IModelService),
  __decorateParam(4, IEditorWorkerService)
], AbstractFileOutputChannelModel);
let FileOutputChannelModel = class extends AbstractFileOutputChannelModel {
  constructor(modelUri, language, source, fileService, modelService, instantiationService, logService, editorWorkerService) {
    const fileOutput = new FileContentProvider(source, fileService, instantiationService, logService);
    super(modelUri, language, fileOutput, modelService, editorWorkerService);
    this.source = source;
    this.fileOutput = this._register(fileOutput);
  }
  clear() {
    this.update(OutputChannelUpdateMode.Clear, void 0, true);
  }
  update(mode, till, immediate) {
    const loadModelPromise = this.loadModelPromise ? this.loadModelPromise : Promise.resolve();
    loadModelPromise.then(() => {
      if (mode === OutputChannelUpdateMode.Clear || mode === OutputChannelUpdateMode.Replace) {
        if (isNumber(till)) {
          this.fileOutput.reset(till);
        } else {
          this.fileOutput.resetToEnd();
        }
      }
      this.doUpdate(mode, immediate);
    });
  }
  updateChannelSources(files) {
    throw new Error("Not supported");
  }
};
FileOutputChannelModel = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IEditorWorkerService)
], FileOutputChannelModel);
let MultiFileOutputChannelModel = class extends AbstractFileOutputChannelModel {
  constructor(modelUri, language, source, fileService, modelService, logService, editorWorkerService, instantiationService) {
    const multifileOutput = new MultiFileContentProvider(source, instantiationService, fileService, logService);
    super(modelUri, language, multifileOutput, modelService, editorWorkerService);
    this.source = source;
    this.multifileOutput = this._register(multifileOutput);
  }
  updateChannelSources(files) {
    this.multifileOutput.unwatch();
    this.multifileOutput.updateFiles(files);
    this.multifileOutput.reset();
    this.doUpdate(OutputChannelUpdateMode.Replace, true);
    if (this.isVisible()) {
      this.multifileOutput.watch();
    }
  }
  clear() {
    const loadModelPromise = this.loadModelPromise ? this.loadModelPromise : Promise.resolve();
    loadModelPromise.then(() => {
      this.multifileOutput.resetToEnd();
      this.doUpdate(OutputChannelUpdateMode.Clear, true);
    });
  }
  update(mode, till, immediate) {
    throw new Error("Not supported");
  }
};
MultiFileOutputChannelModel = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IEditorWorkerService),
  __decorateParam(7, IInstantiationService)
], MultiFileOutputChannelModel);
let OutputChannelBackedByFile = class extends FileOutputChannelModel {
  constructor(id, modelUri, language, file, fileService, modelService, loggerService, instantiationService, logService, editorWorkerService) {
    super(modelUri, language, { resource: file, name: "" }, fileService, modelService, instantiationService, logService, editorWorkerService);
    this.logger = loggerService.createLogger(file, { logLevel: "always", donotRotate: true, donotUseFormatters: true, hidden: true });
    this._offset = 0;
  }
  append(message) {
    this.write(message);
    this.update(OutputChannelUpdateMode.Append, void 0, this.isVisible());
  }
  replace(message) {
    const till = this._offset;
    this.write(message);
    this.update(OutputChannelUpdateMode.Replace, till, true);
  }
  write(content) {
    this._offset += VSBuffer.fromString(content).byteLength;
    this.logger.info(content);
    if (this.isVisible()) {
      this.logger.flush();
    }
  }
};
OutputChannelBackedByFile = __decorateClass([
  __decorateParam(4, IFileService),
  __decorateParam(5, IModelService),
  __decorateParam(6, ILoggerService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IEditorWorkerService)
], OutputChannelBackedByFile);
let DelegatedOutputChannelModel = class extends Disposable {
  constructor(id, modelUri, language, outputDir, outputDirCreationPromise, instantiationService, fileService) {
    super();
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this._onDispose = this._register(new Emitter());
    this.onDispose = this._onDispose.event;
    this.outputChannelModel = this.createOutputChannelModel(id, modelUri, language, outputDir, outputDirCreationPromise);
    const resource = resources.joinPath(outputDir, `${id.replace(/[\\/:\*\?"<>\|]/g, "")}.log`);
    this.source = { resource };
  }
  async createOutputChannelModel(id, modelUri, language, outputDir, outputDirPromise) {
    await outputDirPromise;
    const file = resources.joinPath(outputDir, `${id.replace(/[\\/:\*\?"<>\|]/g, "")}.log`);
    await this.fileService.createFile(file);
    const outputChannelModel = this._register(this.instantiationService.createInstance(OutputChannelBackedByFile, id, modelUri, language, file));
    this._register(outputChannelModel.onDispose(() => this._onDispose.fire()));
    return outputChannelModel;
  }
  getLogEntries() {
    return [];
  }
  append(output) {
    this.outputChannelModel.then((outputChannelModel) => outputChannelModel.append(output));
  }
  update(mode, till, immediate) {
    this.outputChannelModel.then((outputChannelModel) => outputChannelModel.update(mode, till, immediate));
  }
  loadModel() {
    return this.outputChannelModel.then((outputChannelModel) => outputChannelModel.loadModel());
  }
  clear() {
    this.outputChannelModel.then((outputChannelModel) => outputChannelModel.clear());
  }
  replace(value) {
    this.outputChannelModel.then((outputChannelModel) => outputChannelModel.replace(value));
  }
  updateChannelSources(files) {
    this.outputChannelModel.then((outputChannelModel) => outputChannelModel.updateChannelSources(files));
  }
};
DelegatedOutputChannelModel = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IFileService)
], DelegatedOutputChannelModel);
export {
  AbstractFileOutputChannelModel,
  DelegatedOutputChannelModel,
  FileOutputChannelModel,
  MultiFileOutputChannelModel,
  parseLogEntryAt
};
