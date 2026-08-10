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
import { HierarchicalKind } from "../../../../../../base/common/hierarchicalKind.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { IBulkEditService, ResourceTextEdit } from "../../../../../../editor/browser/services/bulkEditService.js";
import { trimTrailingWhitespace } from "../../../../../../editor/common/commands/trimTrailingWhitespaceCommand.js";
import { Position } from "../../../../../../editor/common/core/position.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { CodeActionTriggerType } from "../../../../../../editor/common/languages.js";
import { IEditorWorkerService } from "../../../../../../editor/common/services/editorWorker.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { ApplyCodeActionReason, applyCodeAction, getCodeActions } from "../../../../../../editor/contrib/codeAction/browser/codeAction.js";
import { CodeActionKind, CodeActionTriggerSource } from "../../../../../../editor/contrib/codeAction/common/types.js";
import { FormattingMode, getDocumentFormattingEditsWithSelectedProvider } from "../../../../../../editor/contrib/format/browser/format.js";
import { SnippetController2 } from "../../../../../../editor/contrib/snippet/browser/snippetController2.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { IWorkspaceTrustManagementService } from "../../../../../../platform/workspace/common/workspaceTrust.js";
import { Extensions as WorkbenchContributionsExtensions } from "../../../../../common/contributions.js";
import { SaveReason } from "../../../../../common/editor.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { CellKind, NotebookSetting } from "../../../common/notebookCommon.js";
import { NotebookFileWorkingCopyModel } from "../../../common/notebookEditorModel.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
import { IWorkingCopyFileService } from "../../../../../services/workingCopy/common/workingCopyFileService.js";
import { NotebookMultiCursorController, NotebookMultiCursorState } from "../multicursor/notebookMulticursor.js";
class NotebookSaveParticipant {
  constructor(_editorService) {
    this._editorService = _editorService;
  }
  canParticipate() {
    const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    const controller = editor?.getContribution(NotebookMultiCursorController.id);
    if (!controller) {
      return true;
    }
    return controller.getState() !== NotebookMultiCursorState.Editing;
  }
}
let FormatOnSaveParticipant = class {
  constructor(editorWorkerService, languageFeaturesService, instantiationService, textModelService, bulkEditService, configurationService) {
    this.editorWorkerService = editorWorkerService;
    this.languageFeaturesService = languageFeaturesService;
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.bulkEditService = bulkEditService;
    this.configurationService = configurationService;
  }
  async participate(workingCopy, context, progress, token) {
    if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
      return;
    }
    if (context.reason === SaveReason.AUTO) {
      return void 0;
    }
    const enabled = this.configurationService.getValue(NotebookSetting.formatOnSave);
    if (!enabled) {
      return void 0;
    }
    progress.report({ message: localize("notebookFormatSave.formatting", "Formatting") });
    const notebook = workingCopy.model.notebookModel;
    const formatApplied = await this.instantiationService.invokeFunction(CodeActionParticipantUtils.checkAndRunFormatCodeAction, notebook, progress, token);
    const disposable = new DisposableStore();
    try {
      if (!formatApplied) {
        const allCellEdits = await Promise.all(notebook.cells.map(async (cell) => {
          const ref = await this.textModelService.createModelReference(cell.uri);
          disposable.add(ref);
          const model = ref.object.textEditorModel;
          const formatEdits = await getDocumentFormattingEditsWithSelectedProvider(
            this.editorWorkerService,
            this.languageFeaturesService,
            model,
            FormattingMode.Silent,
            token
          );
          const edits = [];
          if (formatEdits) {
            edits.push(...formatEdits.map((edit) => new ResourceTextEdit(model.uri, edit, model.getVersionId())));
            return edits;
          }
          return [];
        }));
        await this.bulkEditService.apply(
          /* edit */
          allCellEdits.flat(),
          { label: localize("formatNotebook", "Format Notebook"), code: "undoredo.formatNotebook" }
        );
      }
    } finally {
      progress.report({ increment: 100 });
      disposable.dispose();
    }
  }
};
FormatOnSaveParticipant = __decorateClass([
  __decorateParam(0, IEditorWorkerService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITextModelService),
  __decorateParam(4, IBulkEditService),
  __decorateParam(5, IConfigurationService)
], FormatOnSaveParticipant);
let TrimWhitespaceParticipant = class extends NotebookSaveParticipant {
  constructor(configurationService, editorService, textModelService, bulkEditService) {
    super(editorService);
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.textModelService = textModelService;
    this.bulkEditService = bulkEditService;
  }
  async participate(workingCopy, context, progress, _token) {
    const trimTrailingWhitespaceOption = this.configurationService.getValue("files.trimTrailingWhitespace");
    const trimInRegexAndStrings = this.configurationService.getValue("files.trimTrailingWhitespaceInRegexAndStrings");
    if (trimTrailingWhitespaceOption && this.canParticipate()) {
      await this.doTrimTrailingWhitespace(workingCopy, context.reason === SaveReason.AUTO, trimInRegexAndStrings, progress);
    }
  }
  async doTrimTrailingWhitespace(workingCopy, isAutoSaved, trimInRegexesAndStrings, progress) {
    if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
      return;
    }
    const disposable = new DisposableStore();
    const notebook = workingCopy.model.notebookModel;
    const activeCellEditor = getActiveCellCodeEditor(this.editorService);
    let cursors = [];
    let prevSelection = [];
    try {
      const allCellEdits = await Promise.all(notebook.cells.map(async (cell) => {
        if (cell.cellKind !== CellKind.Code) {
          return [];
        }
        const ref = await this.textModelService.createModelReference(cell.uri);
        disposable.add(ref);
        const model = ref.object.textEditorModel;
        const isActiveCell = activeCellEditor && cell.uri.toString() === activeCellEditor.getModel()?.uri.toString();
        if (isActiveCell) {
          prevSelection = activeCellEditor.getSelections() ?? [];
          if (isAutoSaved) {
            cursors = prevSelection.map((s) => s.getPosition());
            const snippetsRange = SnippetController2.get(activeCellEditor)?.getSessionEnclosingRange();
            if (snippetsRange) {
              for (let lineNumber = snippetsRange.startLineNumber; lineNumber <= snippetsRange.endLineNumber; lineNumber++) {
                cursors.push(new Position(lineNumber, model.getLineMaxColumn(lineNumber)));
              }
            }
          }
        }
        const ops = trimTrailingWhitespace(model, cursors, trimInRegexesAndStrings);
        if (!ops.length) {
          return [];
        }
        return ops.map((op) => new ResourceTextEdit(model.uri, { ...op, text: op.text || "" }, model.getVersionId()));
      }));
      const filteredEdits = allCellEdits.flat().filter((edit) => edit !== void 0);
      await this.bulkEditService.apply(filteredEdits, { label: localize("trimNotebookWhitespace", "Notebook Trim Trailing Whitespace"), code: "undoredo.notebookTrimTrailingWhitespace" });
    } finally {
      progress.report({ increment: 100 });
      disposable.dispose();
    }
  }
};
TrimWhitespaceParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IBulkEditService)
], TrimWhitespaceParticipant);
let TrimFinalNewLinesParticipant = class extends NotebookSaveParticipant {
  constructor(configurationService, editorService, bulkEditService) {
    super(editorService);
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.bulkEditService = bulkEditService;
  }
  async participate(workingCopy, context, progress, _token) {
    if (this.configurationService.getValue("files.trimFinalNewlines") && this.canParticipate()) {
      await this.doTrimFinalNewLines(workingCopy, context.reason === SaveReason.AUTO, progress);
    }
  }
  /**
   * returns 0 if the entire file is empty
   */
  findLastNonEmptyLine(textBuffer) {
    for (let lineNumber = textBuffer.getLineCount(); lineNumber >= 1; lineNumber--) {
      const lineLength = textBuffer.getLineLength(lineNumber);
      if (lineLength) {
        return lineNumber;
      }
    }
    return 0;
  }
  async doTrimFinalNewLines(workingCopy, isAutoSaved, progress) {
    if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
      return;
    }
    const disposable = new DisposableStore();
    const notebook = workingCopy.model.notebookModel;
    const activeCellEditor = getActiveCellCodeEditor(this.editorService);
    try {
      const allCellEdits = await Promise.all(notebook.cells.map(async (cell) => {
        if (cell.cellKind !== CellKind.Code) {
          return;
        }
        let cannotTouchLineNumber = 0;
        const isActiveCell = activeCellEditor && cell.uri.toString() === activeCellEditor.getModel()?.uri.toString();
        if (isAutoSaved && isActiveCell) {
          const selections = activeCellEditor.getSelections() ?? [];
          for (const sel of selections) {
            cannotTouchLineNumber = Math.max(cannotTouchLineNumber, sel.selectionStartLineNumber);
          }
        }
        const textBuffer = cell.textBuffer;
        const lastNonEmptyLine = this.findLastNonEmptyLine(textBuffer);
        const deleteFromLineNumber = Math.max(lastNonEmptyLine + 1, cannotTouchLineNumber + 1);
        if (deleteFromLineNumber > textBuffer.getLineCount()) {
          return;
        }
        const deletionRange = new Range(deleteFromLineNumber, 1, textBuffer.getLineCount(), textBuffer.getLineLastNonWhitespaceColumn(textBuffer.getLineCount()));
        if (deletionRange.isEmpty()) {
          return;
        }
        return new ResourceTextEdit(cell.uri, { range: deletionRange, text: "" }, cell.textModel?.getVersionId());
      }));
      const filteredEdits = allCellEdits.flat().filter((edit) => edit !== void 0);
      await this.bulkEditService.apply(filteredEdits, { label: localize("trimNotebookNewlines", "Trim Final New Lines"), code: "undoredo.trimFinalNewLines" });
    } finally {
      progress.report({ increment: 100 });
      disposable.dispose();
    }
  }
};
TrimFinalNewLinesParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IBulkEditService)
], TrimFinalNewLinesParticipant);
let InsertFinalNewLineParticipant = class extends NotebookSaveParticipant {
  constructor(configurationService, bulkEditService, editorService) {
    super(editorService);
    this.configurationService = configurationService;
    this.bulkEditService = bulkEditService;
    this.editorService = editorService;
  }
  async participate(workingCopy, context, progress, _token) {
    if (this.configurationService.getValue(NotebookSetting.insertFinalNewline) && this.canParticipate()) {
      await this.doInsertFinalNewLine(workingCopy, context.reason === SaveReason.AUTO, progress);
    }
  }
  async doInsertFinalNewLine(workingCopy, isAutoSaved, progress) {
    if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
      return;
    }
    const disposable = new DisposableStore();
    const notebook = workingCopy.model.notebookModel;
    const activeCellEditor = getActiveCellCodeEditor(this.editorService);
    let selections;
    if (activeCellEditor) {
      selections = activeCellEditor.getSelections() ?? [];
    }
    try {
      const allCellEdits = await Promise.all(notebook.cells.map(async (cell) => {
        if (cell.cellKind !== CellKind.Code) {
          return;
        }
        const lineCount = cell.textBuffer.getLineCount();
        const lastLineIsEmptyOrWhitespace = cell.textBuffer.getLineFirstNonWhitespaceColumn(lineCount) === 0;
        if (!lineCount || lastLineIsEmptyOrWhitespace) {
          return;
        }
        return new ResourceTextEdit(cell.uri, { range: new Range(lineCount + 1, cell.textBuffer.getLineLength(lineCount), lineCount + 1, cell.textBuffer.getLineLength(lineCount)), text: cell.textBuffer.getEOL() }, cell.textModel?.getVersionId());
      }));
      const filteredEdits = allCellEdits.filter((edit) => edit !== void 0);
      await this.bulkEditService.apply(filteredEdits, { label: localize("insertFinalNewLine", "Insert Final New Line"), code: "undoredo.insertFinalNewLine" });
      if (activeCellEditor && selections) {
        activeCellEditor.setSelections(selections);
      }
    } finally {
      progress.report({ increment: 100 });
      disposable.dispose();
    }
  }
};
InsertFinalNewLineParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IBulkEditService),
  __decorateParam(2, IEditorService)
], InsertFinalNewLineParticipant);
let CodeActionOnSaveParticipant = class {
  constructor(configurationService, logService, workspaceTrustManagementService, textModelService, instantiationService) {
    this.configurationService = configurationService;
    this.logService = logService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.textModelService = textModelService;
    this.instantiationService = instantiationService;
  }
  async participate(workingCopy, context, progress, token) {
    const isTrusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
    if (!isTrusted) {
      return;
    }
    if (!workingCopy.model || !(workingCopy.model instanceof NotebookFileWorkingCopyModel)) {
      return;
    }
    let saveTrigger = "";
    if (context.reason === SaveReason.AUTO) {
      return void 0;
    } else if (context.reason === SaveReason.EXPLICIT) {
      saveTrigger = "explicit";
    } else {
      return void 0;
    }
    const notebookModel = workingCopy.model.notebookModel;
    const setting = this.configurationService.getValue(NotebookSetting.codeActionsOnSave);
    const settingItems = Array.isArray(setting) ? setting : Object.keys(setting).filter((x) => setting[x]);
    const allCodeActions = this.createCodeActionsOnSave(settingItems);
    const excludedActions = allCodeActions.filter((x) => setting[x.value] === "never" || setting[x.value] === false);
    const includedActions = allCodeActions.filter((x) => setting[x.value] === saveTrigger || setting[x.value] === true);
    const editorCodeActionsOnSave = includedActions.filter((x) => !CodeActionKind.Notebook.contains(x));
    const notebookCodeActionsOnSave = includedActions.filter((x) => CodeActionKind.Notebook.contains(x));
    if (notebookCodeActionsOnSave.length) {
      const nbDisposable = new DisposableStore();
      progress.report({ message: localize("notebookSaveParticipants.notebookCodeActions", "Running 'Notebook' code actions") });
      try {
        const cell = notebookModel.cells[0];
        const ref = await this.textModelService.createModelReference(cell.uri);
        nbDisposable.add(ref);
        const textEditorModel = ref.object.textEditorModel;
        await this.instantiationService.invokeFunction(CodeActionParticipantUtils.applyOnSaveGenericCodeActions, textEditorModel, notebookCodeActionsOnSave, excludedActions, progress, token);
      } catch {
        this.logService.error("Failed to apply notebook code action on save");
      } finally {
        progress.report({ increment: 100 });
        nbDisposable.dispose();
      }
    }
    if (editorCodeActionsOnSave.length) {
      if (!Array.isArray(setting)) {
        editorCodeActionsOnSave.sort((a, b) => {
          if (CodeActionKind.SourceFixAll.contains(a)) {
            if (CodeActionKind.SourceFixAll.contains(b)) {
              return 0;
            }
            return -1;
          }
          if (CodeActionKind.SourceFixAll.contains(b)) {
            return 1;
          }
          return 0;
        });
      }
      const cellDisposable = new DisposableStore();
      progress.report({ message: localize("notebookSaveParticipants.cellCodeActions", "Running 'Cell' code actions") });
      try {
        await Promise.all(notebookModel.cells.map(async (cell) => {
          const ref = await this.textModelService.createModelReference(cell.uri);
          cellDisposable.add(ref);
          const textEditorModel = ref.object.textEditorModel;
          await this.instantiationService.invokeFunction(CodeActionParticipantUtils.applyOnSaveGenericCodeActions, textEditorModel, editorCodeActionsOnSave, excludedActions, progress, token);
        }));
      } catch {
        this.logService.error("Failed to apply code action on save");
      } finally {
        progress.report({ increment: 100 });
        cellDisposable.dispose();
      }
    }
  }
  createCodeActionsOnSave(settingItems) {
    const kinds = settingItems.map((x) => new HierarchicalKind(x));
    return kinds.filter((kind) => {
      return kinds.every((otherKind) => otherKind.equals(kind) || !otherKind.contains(kind));
    });
  }
};
CodeActionOnSaveParticipant = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IWorkspaceTrustManagementService),
  __decorateParam(3, ITextModelService),
  __decorateParam(4, IInstantiationService)
], CodeActionOnSaveParticipant);
class CodeActionParticipantUtils {
  static async checkAndRunFormatCodeAction(accessor, notebookModel, progress, token) {
    const instantiationService = accessor.get(IInstantiationService);
    const textModelService = accessor.get(ITextModelService);
    const logService = accessor.get(ILogService);
    const configurationService = accessor.get(IConfigurationService);
    const formatDisposable = new DisposableStore();
    let formatResult = false;
    progress.report({ message: localize("notebookSaveParticipants.formatCodeActions", "Running 'Format' code actions") });
    try {
      const cell = notebookModel.cells[0];
      const ref = await textModelService.createModelReference(cell.uri);
      formatDisposable.add(ref);
      const textEditorModel = ref.object.textEditorModel;
      const defaultFormatterExtId = configurationService.getValue(NotebookSetting.defaultFormatter);
      formatResult = await instantiationService.invokeFunction(CodeActionParticipantUtils.applyOnSaveFormatCodeAction, textEditorModel, new HierarchicalKind("notebook.format"), [], defaultFormatterExtId, progress, token);
    } catch {
      logService.error("Failed to apply notebook format action on save");
    } finally {
      progress.report({ increment: 100 });
      formatDisposable.dispose();
    }
    return formatResult;
  }
  static async applyOnSaveGenericCodeActions(accessor, model, codeActionsOnSave, excludes, progress, token) {
    const instantiationService = accessor.get(IInstantiationService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const logService = accessor.get(ILogService);
    const getActionProgress = new class {
      constructor() {
        this._names = /* @__PURE__ */ new Set();
      }
      _report() {
        progress.report({
          message: localize(
            { key: "codeaction.get2", comment: ["[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}"] },
            "Getting code actions from '{0}' ([configure]({1})).",
            [...this._names].map((name) => `'${name}'`).join(", "),
            "command:workbench.action.openSettings?%5B%22notebook.codeActionsOnSave%22%5D"
          )
        });
      }
      report(provider) {
        if (provider.displayName && !this._names.has(provider.displayName)) {
          this._names.add(provider.displayName);
          this._report();
        }
      }
    }();
    for (const codeActionKind of codeActionsOnSave) {
      const actionsToRun = await CodeActionParticipantUtils.getActionsToRun(model, codeActionKind, excludes, languageFeaturesService, getActionProgress, token);
      if (token.isCancellationRequested) {
        actionsToRun.dispose();
        return;
      }
      try {
        for (const action of actionsToRun.validActions) {
          const codeActionEdits = action.action.edit?.edits;
          let breakFlag = false;
          if (!action.action.kind?.startsWith("notebook")) {
            for (const edit of codeActionEdits ?? []) {
              const workspaceTextEdit = edit;
              if (workspaceTextEdit.resource && isEqual(workspaceTextEdit.resource, model.uri)) {
                continue;
              } else {
                breakFlag = true;
                break;
              }
            }
          }
          if (breakFlag) {
            logService.warn("Failed to apply code action on save, applied to multiple resources.");
            continue;
          }
          progress.report({ message: localize("codeAction.apply", "Applying code action '{0}'.", action.action.title) });
          await instantiationService.invokeFunction(applyCodeAction, action, ApplyCodeActionReason.OnSave, {}, token);
          if (token.isCancellationRequested) {
            return;
          }
        }
      } catch {
      } finally {
        actionsToRun.dispose();
      }
    }
  }
  static async applyOnSaveFormatCodeAction(accessor, model, formatCodeActionOnSave, excludes, extensionId, progress, token) {
    const instantiationService = accessor.get(IInstantiationService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const logService = accessor.get(ILogService);
    const getActionProgress = new class {
      constructor() {
        this._names = /* @__PURE__ */ new Set();
      }
      _report() {
        progress.report({
          message: localize(
            { key: "codeaction.get2", comment: ["[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}"] },
            "Getting code actions from '{0}' ([configure]({1})).",
            [...this._names].map((name) => `'${name}'`).join(", "),
            "command:workbench.action.openSettings?%5B%22notebook.defaultFormatter%22%5D"
          )
        });
      }
      report(provider) {
        if (provider.displayName && !this._names.has(provider.displayName)) {
          this._names.add(provider.displayName);
          this._report();
        }
      }
    }();
    const providedActions = await CodeActionParticipantUtils.getActionsToRun(model, formatCodeActionOnSave, excludes, languageFeaturesService, getActionProgress, token);
    if (providedActions.validActions.length > 1 && !extensionId) {
      logService.warn("More than one format code action is provided, the 0th one will be used. A default can be specified via `notebook.defaultFormatter` in your settings.");
    }
    if (token.isCancellationRequested) {
      providedActions.dispose();
      return false;
    }
    try {
      const action = extensionId ? providedActions.validActions.find((action2) => action2.provider?.extensionId === extensionId) : providedActions.validActions[0];
      if (!action) {
        return false;
      }
      progress.report({ message: localize("codeAction.apply", "Applying code action '{0}'.", action.action.title) });
      await instantiationService.invokeFunction(applyCodeAction, action, ApplyCodeActionReason.OnSave, {}, token);
      if (token.isCancellationRequested) {
        return false;
      }
    } catch {
      logService.error("Failed to apply notebook format code action on save");
      return false;
    } finally {
      providedActions.dispose();
    }
    return true;
  }
  // @Yoyokrazy this could likely be modified to leverage the extensionID, therefore not getting actions from providers unnecessarily -- future work
  static getActionsToRun(model, codeActionKind, excludes, languageFeaturesService, progress, token) {
    return getCodeActions(languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), {
      type: CodeActionTriggerType.Invoke,
      triggerAction: CodeActionTriggerSource.OnSave,
      filter: { include: codeActionKind, excludes, includeSourceActions: true }
    }, progress, token);
  }
}
function getActiveCellCodeEditor(editorService) {
  const activePane = editorService.activeEditorPane;
  const notebookEditor = getNotebookEditorFromEditorPane(activePane);
  const activeCodeEditor = notebookEditor?.activeCodeEditor;
  return activeCodeEditor;
}
let SaveParticipantsContribution = class extends Disposable {
  constructor(instantiationService, workingCopyFileService) {
    super();
    this.instantiationService = instantiationService;
    this.workingCopyFileService = workingCopyFileService;
    this.registerSaveParticipants();
  }
  registerSaveParticipants() {
    this._register(this.workingCopyFileService.addSaveParticipant(this.instantiationService.createInstance(TrimWhitespaceParticipant)));
    this._register(this.workingCopyFileService.addSaveParticipant(this.instantiationService.createInstance(CodeActionOnSaveParticipant)));
    this._register(this.workingCopyFileService.addSaveParticipant(this.instantiationService.createInstance(FormatOnSaveParticipant)));
    this._register(this.workingCopyFileService.addSaveParticipant(this.instantiationService.createInstance(InsertFinalNewLineParticipant)));
    this._register(this.workingCopyFileService.addSaveParticipant(this.instantiationService.createInstance(TrimFinalNewLinesParticipant)));
  }
};
SaveParticipantsContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkingCopyFileService)
], SaveParticipantsContribution);
const workbenchContributionsRegistry = Registry.as(WorkbenchContributionsExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(SaveParticipantsContribution, LifecyclePhase.Restored);
export {
  CodeActionParticipantUtils,
  NotebookSaveParticipant,
  SaveParticipantsContribution
};
