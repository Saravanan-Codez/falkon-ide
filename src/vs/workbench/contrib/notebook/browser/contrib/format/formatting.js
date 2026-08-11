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
import { localize, localize2 } from "../../../../../../nls.js";
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { EditorAction, registerEditorAction } from "../../../../../../editor/browser/editorExtensions.js";
import { IBulkEditService, ResourceTextEdit } from "../../../../../../editor/browser/services/bulkEditService.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { IEditorWorkerService } from "../../../../../../editor/common/services/editorWorker.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { FormattingMode, formatDocumentWithSelectedProvider, getDocumentFormattingEditsWithSelectedProvider } from "../../../../../../editor/contrib/format/browser/format.js";
import { Action2, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Progress } from "../../../../../../platform/progress/common/progress.js";
import { NOTEBOOK_ACTIONS_CATEGORY } from "../../controller/coreActions.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_IS_ACTIVE_EDITOR } from "../../../common/notebookContextKeys.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { INotebookExecutionService } from "../../../common/notebookExecutionService.js";
import { NotebookSetting } from "../../../common/notebookCommon.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchContributionsExtensions } from "../../../../../common/contributions.js";
import { INotebookService } from "../../../common/notebookService.js";
import { CodeActionParticipantUtils } from "../saveParticipants/saveParticipants.js";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "notebook.format",
      title: localize2("format.title", "Format Notebook"),
      category: NOTEBOOK_ACTIONS_CATEGORY,
      precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE),
      keybinding: {
        when: EditorContextKeys.editorTextFocus.toNegated(),
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF,
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI },
        weight: KeybindingWeight.WorkbenchContrib
      },
      f1: true,
      menu: {
        id: MenuId.EditorContext,
        when: ContextKeyExpr.and(EditorContextKeys.inCompositeEditor, EditorContextKeys.hasDocumentFormattingProvider),
        group: "1_modification",
        order: 1.3
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const textModelService = accessor.get(ITextModelService);
    const editorWorkerService = accessor.get(IEditorWorkerService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const bulkEditService = accessor.get(IBulkEditService);
    const instantiationService = accessor.get(IInstantiationService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor || !editor.hasModel()) {
      return;
    }
    const notebook = editor.textModel;
    const formatApplied = await instantiationService.invokeFunction(CodeActionParticipantUtils.checkAndRunFormatCodeAction, notebook, Progress.None, CancellationToken.None);
    const disposable = new DisposableStore();
    try {
      if (!formatApplied) {
        const allCellEdits = await Promise.all(notebook.cells.map(async (cell) => {
          const ref = await textModelService.createModelReference(cell.uri);
          disposable.add(ref);
          const model = ref.object.textEditorModel;
          const formatEdits = await getDocumentFormattingEditsWithSelectedProvider(
            editorWorkerService,
            languageFeaturesService,
            model,
            FormattingMode.Explicit,
            CancellationToken.None
          );
          const edits = [];
          if (formatEdits) {
            for (const edit of formatEdits) {
              edits.push(new ResourceTextEdit(model.uri, edit, model.getVersionId()));
            }
            return edits;
          }
          return [];
        }));
        await bulkEditService.apply(
          /* edit */
          allCellEdits.flat(),
          { label: localize("label", "Format Notebook"), code: "undoredo.formatNotebook" }
        );
      }
    } finally {
      disposable.dispose();
    }
  }
});
registerEditorAction(class FormatCellAction extends EditorAction {
  constructor() {
    super({
      id: "notebook.formatCell",
      label: localize2("formatCell.label", "Format Cell"),
      precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE, EditorContextKeys.inCompositeEditor, EditorContextKeys.writable, EditorContextKeys.hasDocumentFormattingProvider),
      kbOpts: {
        kbExpr: ContextKeyExpr.and(EditorContextKeys.editorTextFocus),
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF,
        linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI },
        weight: KeybindingWeight.EditorContrib
      },
      contextMenuOpts: {
        group: "1_modification",
        order: 1.301
      }
    });
  }
  async run(accessor, editor) {
    if (editor.hasModel()) {
      const instaService = accessor.get(IInstantiationService);
      await instaService.invokeFunction(formatDocumentWithSelectedProvider, editor, FormattingMode.Explicit, Progress.None, CancellationToken.None, true);
    }
  }
});
let FormatOnCellExecutionParticipant = class {
  constructor(bulkEditService, languageFeaturesService, textModelService, editorWorkerService, configurationService, _notebookService) {
    this.bulkEditService = bulkEditService;
    this.languageFeaturesService = languageFeaturesService;
    this.textModelService = textModelService;
    this.editorWorkerService = editorWorkerService;
    this.configurationService = configurationService;
    this._notebookService = _notebookService;
  }
  async onWillExecuteCell(executions) {
    const enabled = this.configurationService.getValue(NotebookSetting.formatOnCellExecution);
    if (!enabled) {
      return;
    }
    const disposable = new DisposableStore();
    try {
      const allCellEdits = await Promise.all(executions.map(async (cellExecution) => {
        const nbModel = this._notebookService.getNotebookTextModel(cellExecution.notebook);
        if (!nbModel) {
          return [];
        }
        let activeCell;
        for (const cell of nbModel.cells) {
          if (cell.handle === cellExecution.cellHandle) {
            activeCell = cell;
            break;
          }
        }
        if (!activeCell) {
          return [];
        }
        const ref = await this.textModelService.createModelReference(activeCell.uri);
        disposable.add(ref);
        const model = ref.object.textEditorModel;
        const formatEdits = await getDocumentFormattingEditsWithSelectedProvider(
          this.editorWorkerService,
          this.languageFeaturesService,
          model,
          FormattingMode.Silent,
          CancellationToken.None
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
        { label: localize("formatCells.label", "Format Cells"), code: "undoredo.notebooks.onWillExecuteFormat" }
      );
    } finally {
      disposable.dispose();
    }
  }
};
FormatOnCellExecutionParticipant = __decorateClass([
  __decorateParam(0, IBulkEditService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IEditorWorkerService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, INotebookService)
], FormatOnCellExecutionParticipant);
let CellExecutionParticipantsContribution = class extends Disposable {
  constructor(instantiationService, notebookExecutionService) {
    super();
    this.instantiationService = instantiationService;
    this.notebookExecutionService = notebookExecutionService;
    this.registerKernelExecutionParticipants();
  }
  registerKernelExecutionParticipants() {
    this._register(this.notebookExecutionService.registerExecutionParticipant(this.instantiationService.createInstance(FormatOnCellExecutionParticipant)));
  }
};
CellExecutionParticipantsContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, INotebookExecutionService)
], CellExecutionParticipantsContribution);
const workbenchContributionsRegistry = Registry.as(WorkbenchContributionsExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(CellExecutionParticipantsContribution, LifecyclePhase.Restored);
export {
  CellExecutionParticipantsContribution
};
