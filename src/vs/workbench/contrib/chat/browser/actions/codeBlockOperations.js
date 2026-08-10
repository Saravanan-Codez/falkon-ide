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
import { AsyncIterableProducer } from "../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { CharCode } from "../../../../../base/common/charCode.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { isEqual } from "../../../../../base/common/resources.js";
import * as strings from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { IBulkEditService, ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { EditDeltaInfo } from "../../../../../editor/common/textModelEditSource.js";
import { localize } from "../../../../../nls.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProgressService, ProgressLocation } from "../../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { IAiEditTelemetryService } from "../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { reviewEdits, reviewNotebookEdits } from "./reviewEdits.js";
import { insertCell } from "../../../notebook/browser/controller/cellOperations.js";
import { CellKind, NOTEBOOK_EDITOR_ID } from "../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { ICodeMapperService } from "../../common/editing/chatCodeMapperService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { isRequestVM, isResponseVM } from "../../common/model/chatViewModel.js";
let InsertCodeBlockOperation = class {
  constructor(editorService, textFileService, bulkEditService, codeEditorService, chatService, languageService, dialogService, aiEditTelemetryService) {
    this.editorService = editorService;
    this.textFileService = textFileService;
    this.bulkEditService = bulkEditService;
    this.codeEditorService = codeEditorService;
    this.chatService = chatService;
    this.languageService = languageService;
    this.dialogService = dialogService;
    this.aiEditTelemetryService = aiEditTelemetryService;
  }
  async run(context) {
    const activeEditorControl = getEditableActiveCodeEditor(this.editorService);
    if (activeEditorControl) {
      await this.handleTextEditor(activeEditorControl, context);
    } else {
      const activeNotebookEditor = getActiveNotebookEditor(this.editorService);
      if (activeNotebookEditor) {
        await this.handleNotebookEditor(activeNotebookEditor, context);
      } else {
        this.notify(localize("insertCodeBlock.noActiveEditor", "To insert the code block, open a code editor or notebook editor and set the cursor at the location where to insert the code block."));
      }
    }
    if (isResponseVM(context.element)) {
      const requestId = context.element.requestId;
      const request = context.element.session.getItems().find((item) => item.id === requestId && isRequestVM(item));
      notifyUserAction(this.chatService, context, {
        kind: "insert",
        codeBlockIndex: context.codeBlockIndex,
        totalCharacters: context.code.length,
        totalLines: context.code.split("\n").length,
        languageId: context.languageId,
        modelId: request?.modelId ?? ""
      });
      const codeBlockInfo = context.element.model.codeBlockInfos?.at(context.codeBlockIndex);
      this.aiEditTelemetryService.handleCodeAccepted({
        acceptanceMethod: "insertAtCursor",
        suggestionId: codeBlockInfo?.suggestionId,
        editDeltaInfo: EditDeltaInfo.fromText(context.code),
        feature: "sideBarChat",
        languageId: context.languageId,
        modeId: context.element.model.request?.modeInfo?.telemetryModeId,
        modelId: request?.modelId,
        presentation: "codeBlock",
        applyCodeBlockSuggestionId: void 0,
        source: void 0,
        sourceRequestId: void 0
      });
    }
  }
  async handleNotebookEditor(notebookEditor, codeBlockContext) {
    if (notebookEditor.isReadOnly) {
      this.notify(localize("insertCodeBlock.readonlyNotebook", "Cannot insert the code block to read-only notebook editor."));
      return false;
    }
    const focusRange = notebookEditor.getFocus();
    const next = Math.max(focusRange.end - 1, 0);
    insertCell(this.languageService, notebookEditor, next, CellKind.Code, "below", codeBlockContext.code, true);
    return true;
  }
  async handleTextEditor(codeEditor, codeBlockContext) {
    const activeModel = codeEditor.getModel();
    if (isReadOnly(activeModel, this.textFileService)) {
      this.notify(localize("insertCodeBlock.readonly", "Cannot insert the code block to read-only code editor."));
      return false;
    }
    const range = codeEditor.getSelection() ?? new Range(activeModel.getLineCount(), 1, activeModel.getLineCount(), 1);
    const text = reindent(codeBlockContext.code, activeModel, range.startLineNumber);
    const edits = [new ResourceTextEdit(activeModel.uri, { range, text })];
    await this.bulkEditService.apply(edits);
    this.codeEditorService.listCodeEditors().find((editor) => isEqual(editor.getModel()?.uri, activeModel.uri))?.focus();
    return true;
  }
  notify(message) {
    this.dialogService.info(message);
  }
};
InsertCodeBlockOperation = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IBulkEditService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, IChatService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IAiEditTelemetryService)
], InsertCodeBlockOperation);
let ApplyCodeBlockOperation = class {
  constructor(editorService, textFileService, chatService, fileService, dialogService, logService, codeMapperService, progressService, quickInputService, labelService, instantiationService, notebookService) {
    this.editorService = editorService;
    this.textFileService = textFileService;
    this.chatService = chatService;
    this.fileService = fileService;
    this.dialogService = dialogService;
    this.logService = logService;
    this.codeMapperService = codeMapperService;
    this.progressService = progressService;
    this.quickInputService = quickInputService;
    this.labelService = labelService;
    this.instantiationService = instantiationService;
    this.notebookService = notebookService;
  }
  async run(context) {
    let activeEditorControl = getEditableActiveCodeEditor(this.editorService);
    const codemapperUri = await this.evaluateURIToUse(context.codemapperUri, activeEditorControl);
    if (!codemapperUri) {
      return;
    }
    if (codemapperUri && !isEqual(activeEditorControl?.getModel().uri, codemapperUri) && !this.notebookService.hasSupportedNotebooks(codemapperUri)) {
      try {
        const editorPane = await this.editorService.openEditor({ resource: codemapperUri });
        const codeEditor = getCodeEditor(editorPane?.getControl());
        if (codeEditor && codeEditor.hasModel()) {
          this.tryToRevealCodeBlock(codeEditor, context.code);
          activeEditorControl = codeEditor;
        } else {
          this.notify(localize("applyCodeBlock.errorOpeningFile", "Failed to open {0} in a code editor.", codemapperUri.toString()));
          return;
        }
      } catch (e) {
        this.logService.info("[ApplyCodeBlockOperation] error opening code mapper file", codemapperUri, e);
        return;
      }
    }
    let codeBlockSuggestionId = void 0;
    if (isResponseVM(context.element)) {
      const codeBlockInfo = context.element.model.codeBlockInfos?.at(context.codeBlockIndex);
      if (codeBlockInfo) {
        codeBlockSuggestionId = codeBlockInfo.suggestionId;
      }
    }
    let result = void 0;
    if (activeEditorControl && !this.notebookService.hasSupportedNotebooks(codemapperUri)) {
      result = await this.handleTextEditor(activeEditorControl, context.chatSessionResource, context.code, codeBlockSuggestionId);
    } else {
      const activeNotebookEditor = getActiveNotebookEditor(this.editorService);
      if (activeNotebookEditor) {
        result = await this.handleNotebookEditor(activeNotebookEditor, context.chatSessionResource, context.code);
      } else {
        this.notify(localize("applyCodeBlock.noActiveEditor", "To apply this code block, open a code or notebook editor."));
      }
    }
    if (isResponseVM(context.element)) {
      const requestId = context.element.requestId;
      const request = context.element.session.getItems().find((item) => item.id === requestId && isRequestVM(item));
      notifyUserAction(this.chatService, context, {
        kind: "apply",
        codeBlockIndex: context.codeBlockIndex,
        totalCharacters: context.code.length,
        codeMapper: result?.codeMapper,
        editsProposed: !!result?.editsProposed,
        totalLines: context.code.split("\n").length,
        modelId: request?.modelId ?? "",
        languageId: context.languageId
      });
    }
  }
  async evaluateURIToUse(resource, activeEditorControl) {
    if (resource && await this.fileService.exists(resource)) {
      return resource;
    }
    const activeEditorOption = activeEditorControl?.getModel().uri ? { label: localize("activeEditor", "Active editor '{0}'", this.labelService.getUriLabel(activeEditorControl.getModel().uri, { relative: true })), id: "activeEditor" } : void 0;
    const untitledEditorOption = { label: localize("newUntitledFile", "New untitled editor"), id: "newUntitledFile" };
    const options = [];
    if (resource) {
      options.push({ label: localize("createFile", "New file '{0}'", this.labelService.getUriLabel(resource, { relative: true })), id: "createFile" });
      options.push(untitledEditorOption);
      if (activeEditorOption) {
        options.push(activeEditorOption);
      }
    } else {
      if (activeEditorOption) {
        options.push(activeEditorOption);
      }
      options.push(untitledEditorOption);
    }
    const selected = options.length > 1 ? await this.quickInputService.pick(options, { placeHolder: localize("selectOption", "Select where to apply the code block") }) : options[0];
    if (selected) {
      switch (selected.id) {
        case "createFile":
          if (resource) {
            try {
              await this.fileService.writeFile(resource, VSBuffer.fromString(""));
            } catch (error) {
              this.notify(localize("applyCodeBlock.fileWriteError", "Failed to create file: {0}", error.message));
              return URI.from({ scheme: "untitled", path: resource.path });
            }
          }
          return resource;
        case "newUntitledFile":
          return URI.from({ scheme: "untitled", path: resource ? resource.path : "Untitled-1" });
        case "activeEditor":
          return activeEditorControl?.getModel().uri;
      }
    }
    return void 0;
  }
  async handleNotebookEditor(notebookEditor, chatSessionResource, code) {
    if (notebookEditor.isReadOnly) {
      this.notify(localize("applyCodeBlock.readonlyNotebook", "Cannot apply code block to read-only notebook editor."));
      return void 0;
    }
    const uri = notebookEditor.textModel.uri;
    const codeBlock = { code, resource: uri, markdownBeforeBlock: void 0 };
    const codeMapper = this.codeMapperService.providers[0]?.displayName;
    if (!codeMapper) {
      this.notify(localize("applyCodeBlock.noCodeMapper", "No code mapper available."));
      return void 0;
    }
    let editsProposed = false;
    const cancellationTokenSource = new CancellationTokenSource();
    try {
      const iterable = await this.progressService.withProgress(
        { location: ProgressLocation.Notification, delay: 500, sticky: true, cancellable: true },
        async (progress) => {
          progress.report({ message: localize("applyCodeBlock.progress", "Applying code block using {0}...", codeMapper) });
          const editsIterable = this.getNotebookEdits(codeBlock, chatSessionResource, cancellationTokenSource.token);
          return await this.waitForFirstElement(editsIterable);
        },
        () => cancellationTokenSource.cancel()
      );
      editsProposed = await this.applyNotebookEditsWithInlinePreview(iterable, uri, cancellationTokenSource);
    } catch (e) {
      if (!isCancellationError(e)) {
        this.notify(localize("applyCodeBlock.error", "Failed to apply code block: {0}", e.message));
      }
    } finally {
      cancellationTokenSource.dispose();
    }
    return {
      editsProposed,
      codeMapper
    };
  }
  async handleTextEditor(codeEditor, chatSessionResource, code, applyCodeBlockSuggestionId) {
    const activeModel = codeEditor.getModel();
    if (isReadOnly(activeModel, this.textFileService)) {
      this.notify(localize("applyCodeBlock.readonly", "Cannot apply code block to read-only file."));
      return void 0;
    }
    const codeBlock = { code, resource: activeModel.uri, chatSessionResource, markdownBeforeBlock: void 0 };
    const codeMapper = this.codeMapperService.providers[0]?.displayName;
    if (!codeMapper) {
      this.notify(localize("applyCodeBlock.noCodeMapper", "No code mapper available."));
      return void 0;
    }
    let editsProposed = false;
    const cancellationTokenSource = new CancellationTokenSource();
    try {
      const iterable = await this.progressService.withProgress(
        { location: ProgressLocation.Notification, delay: 500, sticky: true, cancellable: true },
        async (progress) => {
          progress.report({ message: localize("applyCodeBlock.progress", "Applying code block using {0}...", codeMapper) });
          const editsIterable = this.getTextEdits(codeBlock, chatSessionResource, cancellationTokenSource.token);
          return await this.waitForFirstElement(editsIterable);
        },
        () => cancellationTokenSource.cancel()
      );
      editsProposed = await this.applyWithInlinePreview(iterable, codeEditor, cancellationTokenSource, applyCodeBlockSuggestionId);
    } catch (e) {
      if (!isCancellationError(e)) {
        this.notify(localize("applyCodeBlock.error", "Failed to apply code block: {0}", e.message));
      }
    } finally {
      cancellationTokenSource.dispose();
    }
    return {
      editsProposed,
      codeMapper
    };
  }
  getTextEdits(codeBlock, chatSessionResource, token) {
    return new AsyncIterableProducer(async (executor) => {
      const request = {
        codeBlocks: [codeBlock],
        chatSessionResource
      };
      const response = {
        textEdit: (target, edit) => {
          executor.emitOne(edit);
        },
        notebookEdit(_resource, _edit) {
        }
      };
      const result = await this.codeMapperService.mapCode(request, response, token);
      if (result?.errorMessage) {
        executor.reject(new Error(result.errorMessage));
      }
    });
  }
  getNotebookEdits(codeBlock, chatSessionResource, token) {
    return new AsyncIterableProducer(async (executor) => {
      const request = {
        codeBlocks: [codeBlock],
        chatSessionResource,
        location: "panel"
      };
      const response = {
        textEdit: (target, edits) => {
          executor.emitOne([target, edits]);
        },
        notebookEdit(_resource, edit) {
          executor.emitOne(edit);
        }
      };
      const result = await this.codeMapperService.mapCode(request, response, token);
      if (result?.errorMessage) {
        executor.reject(new Error(result.errorMessage));
      }
    });
  }
  async waitForFirstElement(iterable) {
    const iterator = iterable[Symbol.asyncIterator]();
    let result = await iterator.next();
    if (result.done) {
      return {
        async *[Symbol.asyncIterator]() {
          return;
        }
      };
    }
    return {
      async *[Symbol.asyncIterator]() {
        while (!result.done) {
          yield result.value;
          result = await iterator.next();
        }
      }
    };
  }
  async applyWithInlinePreview(edits, codeEditor, tokenSource, applyCodeBlockSuggestionId) {
    return this.instantiationService.invokeFunction(reviewEdits, codeEditor, edits, tokenSource.token, applyCodeBlockSuggestionId);
  }
  async applyNotebookEditsWithInlinePreview(edits, uri, tokenSource) {
    return this.instantiationService.invokeFunction(reviewNotebookEdits, uri, edits, tokenSource.token);
  }
  tryToRevealCodeBlock(codeEditor, codeBlock) {
    const match = codeBlock.match(/(\S[^\n]*)\n/);
    if (match && match[1].length > 10) {
      const findMatch = codeEditor.getModel().findNextMatch(match[1], { lineNumber: 1, column: 1 }, false, false, null, false);
      if (findMatch) {
        codeEditor.revealRangeInCenter(findMatch.range);
      }
    }
  }
  notify(message) {
    this.dialogService.info(message);
  }
};
ApplyCodeBlockOperation = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ICodeMapperService),
  __decorateParam(7, IProgressService),
  __decorateParam(8, IQuickInputService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, INotebookService)
], ApplyCodeBlockOperation);
function notifyUserAction(chatService, context, action) {
  if (isResponseVM(context.element)) {
    chatService.notifyUserAction({
      agentId: context.element.agent?.id,
      command: context.element.slashCommand?.name,
      sessionResource: context.element.sessionResource,
      requestId: context.element.requestId,
      result: context.element.result,
      action
    });
  }
}
function getActiveNotebookEditor(editorService) {
  const activeEditorPane = editorService.activeEditorPane;
  if (activeEditorPane?.getId() === NOTEBOOK_EDITOR_ID) {
    const notebookEditor = activeEditorPane.getControl();
    if (notebookEditor.hasModel()) {
      return notebookEditor;
    }
  }
  return void 0;
}
function getEditableActiveCodeEditor(editorService) {
  const activeCodeEditorInNotebook = getActiveNotebookEditor(editorService)?.activeCodeEditor;
  if (activeCodeEditorInNotebook && activeCodeEditorInNotebook.hasTextFocus() && activeCodeEditorInNotebook.hasModel()) {
    return activeCodeEditorInNotebook;
  }
  let codeEditor = getCodeEditor(editorService.activeTextEditorControl);
  if (!codeEditor) {
    for (const editor of editorService.visibleTextEditorControls) {
      codeEditor = getCodeEditor(editor);
      if (codeEditor) {
        break;
      }
    }
  }
  if (!codeEditor || !codeEditor.hasModel()) {
    return void 0;
  }
  return codeEditor;
}
function isReadOnly(model, textFileService) {
  const activeTextModel = textFileService.files.get(model.uri) ?? textFileService.untitled.get(model.uri);
  return !!activeTextModel?.isReadonly();
}
function reindent(codeBlockContent, model, seletionStartLine) {
  const newContent = strings.splitLines(codeBlockContent);
  if (newContent.length === 0) {
    return codeBlockContent;
  }
  const formattingOptions = model.getFormattingOptions();
  const codeIndentLevel = computeIndentation(model.getLineContent(seletionStartLine), formattingOptions.tabSize).level;
  const indents = newContent.map((line) => computeIndentation(line, formattingOptions.tabSize));
  const newContentIndentLevel = indents.reduce((min, indent, index) => {
    if (indent.length !== newContent[index].length) {
      return Math.min(indent.level, min);
    }
    return min;
  }, Number.MAX_VALUE);
  if (newContentIndentLevel === Number.MAX_VALUE || newContentIndentLevel === codeIndentLevel) {
    return codeBlockContent;
  }
  const newLines = [];
  for (let i = 0; i < newContent.length; i++) {
    const { level, length } = indents[i];
    const newLevel = Math.max(0, codeIndentLevel + level - newContentIndentLevel);
    const newIndentation = formattingOptions.insertSpaces ? " ".repeat(formattingOptions.tabSize * newLevel) : "	".repeat(newLevel);
    newLines.push(newIndentation + newContent[i].substring(length));
  }
  return newLines.join("\n");
}
function computeIndentation(line, tabSize) {
  let nSpaces = 0;
  let level = 0;
  let i = 0;
  let length = 0;
  const len = line.length;
  while (i < len) {
    const chCode = line.charCodeAt(i);
    if (chCode === CharCode.Space) {
      nSpaces++;
      if (nSpaces === tabSize) {
        level++;
        nSpaces = 0;
        length = i + 1;
      }
    } else if (chCode === CharCode.Tab) {
      level++;
      nSpaces = 0;
      length = i + 1;
    } else {
      break;
    }
    i++;
  }
  return { level, length };
}
export {
  ApplyCodeBlockOperation,
  InsertCodeBlockOperation,
  computeIndentation
};
