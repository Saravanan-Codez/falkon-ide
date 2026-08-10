import { KeyChord, KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { URI } from "../../../../../base/common/uri.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { CommandExecutor } from "../../../../../editor/common/cursor/cursor.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../../editor/common/languages/languageConfigurationRegistry.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { getIconClasses } from "../../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { LineCommentCommand, Type } from "../../../../../editor/contrib/comment/browser/lineCommentCommand.js";
import { localize, localize2 } from "../../../../../nls.js";
import { MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContext, InputFocusedContextKey } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { InlineChatController } from "../../../inlineChat/browser/inlineChatController.js";
import { CTX_INLINE_CHAT_FOCUSED } from "../../../inlineChat/common/inlineChat.js";
import { changeCellToKind, runDeleteAction } from "./cellOperations.js";
import { CELL_TITLE_CELL_GROUP_ID, CELL_TITLE_OUTPUT_GROUP_ID, CellToolbarOrder, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, NotebookAction, NotebookCellAction, NotebookMultiCellAction, executeNotebookCondition, findTargetCellEditor } from "./coreActions.js";
import { NotebookChangeTabDisplaySize, NotebookIndentUsingSpaces, NotebookIndentUsingTabs, NotebookIndentationToSpacesAction, NotebookIndentationToTabsAction } from "./notebookIndentationActions.js";
import { CHANGE_CELL_LANGUAGE, CellEditState, DETECT_CELL_LANGUAGE, QUIT_EDIT_CELL_COMMAND_ID, getNotebookEditorFromEditorPane } from "../notebookBrowser.js";
import * as icons from "../notebookIcons.js";
import { CellEditType, CellKind, NotebookCellExecutionState, NotebookSetting } from "../../common/notebookCommon.js";
import { NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_IS_FIRST_OUTPUT, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_TYPE, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_HAS_OUTPUTS, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_OUTPUT_FOCUSED, NOTEBOOK_OUTPUT_INPUT_FOCUSED, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON } from "../../common/notebookContextKeys.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../common/notebookKernelService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ILanguageDetectionService } from "../../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { NotebookInlineVariablesController } from "../contrib/notebookVariables/notebookInlineVariables.js";
const CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID = "notebook.clearAllCellsOutputs";
const EDIT_CELL_COMMAND_ID = "notebook.cell.edit";
const DELETE_CELL_COMMAND_ID = "notebook.cell.delete";
const QUIT_EDIT_ALL_CELLS_COMMAND_ID = "notebook.quitEditAllCells";
const CLEAR_CELL_OUTPUTS_COMMAND_ID = "notebook.cell.clearOutputs";
const SELECT_NOTEBOOK_INDENTATION_ID = "notebook.selectIndentation";
const COMMENT_SELECTED_CELLS_ID = "notebook.commentSelectedCells";
registerAction2(class EditCellAction extends NotebookCellAction {
  constructor() {
    super(
      {
        id: EDIT_CELL_COMMAND_ID,
        title: localize("notebookActions.editCell", "Edit Cell"),
        keybinding: {
          when: ContextKeyExpr.and(
            NOTEBOOK_CELL_LIST_FOCUSED,
            ContextKeyExpr.not(InputFocusedContextKey),
            EditorContextKeys.hoverFocused.toNegated(),
            NOTEBOOK_OUTPUT_INPUT_FOCUSED.toNegated()
          ),
          primary: KeyCode.Enter,
          weight: KeybindingWeight.WorkbenchContrib
        },
        menu: {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true),
            NOTEBOOK_CELL_TYPE.isEqualTo("markup"),
            NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.toNegated(),
            NOTEBOOK_CELL_EDITABLE
          ),
          order: CellToolbarOrder.EditCell,
          group: CELL_TITLE_CELL_GROUP_ID
        },
        icon: icons.editIcon
      }
    );
  }
  async runWithContext(accessor, context) {
    if (!context.notebookEditor.hasModel()) {
      return;
    }
    await context.notebookEditor.focusNotebookCell(context.cell, "editor");
    const foundEditor = context.cell ? findTargetCellEditor(context, context.cell) : void 0;
    if (foundEditor && foundEditor.hasTextFocus() && InlineChatController.get(foundEditor)?.getWidgetPosition()?.lineNumber === foundEditor.getPosition()?.lineNumber) {
      InlineChatController.get(foundEditor)?.focus();
    }
  }
});
const quitEditCondition = ContextKeyExpr.and(
  NOTEBOOK_EDITOR_FOCUSED,
  InputFocusedContext,
  CTX_INLINE_CHAT_FOCUSED.toNegated()
);
registerAction2(class QuitEditCellAction extends NotebookCellAction {
  constructor() {
    super(
      {
        id: QUIT_EDIT_CELL_COMMAND_ID,
        title: localize("notebookActions.quitEdit", "Stop Editing Cell"),
        menu: {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_CELL_TYPE.isEqualTo("markup"),
            NOTEBOOK_CELL_MARKDOWN_EDIT_MODE,
            NOTEBOOK_CELL_EDITABLE
          ),
          order: CellToolbarOrder.SaveCell,
          group: CELL_TITLE_CELL_GROUP_ID
        },
        icon: icons.stopEditIcon,
        keybinding: [
          {
            when: ContextKeyExpr.and(
              quitEditCondition,
              EditorContextKeys.hoverVisible.toNegated(),
              EditorContextKeys.hasNonEmptySelection.toNegated(),
              EditorContextKeys.hasMultipleSelections.toNegated()
            ),
            primary: KeyCode.Escape,
            weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT - 5
          },
          {
            when: ContextKeyExpr.and(
              NOTEBOOK_EDITOR_FOCUSED,
              NOTEBOOK_OUTPUT_FOCUSED
            ),
            primary: KeyCode.Escape,
            weight: KeybindingWeight.WorkbenchContrib + 5
          },
          {
            when: ContextKeyExpr.and(
              quitEditCondition,
              NOTEBOOK_CELL_TYPE.isEqualTo("markup")
            ),
            primary: KeyMod.WinCtrl | KeyCode.Enter,
            win: {
              primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
            },
            weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT - 5
          }
        ]
      }
    );
  }
  async runWithContext(accessor, context) {
    if (context.cell.cellKind === CellKind.Markup) {
      context.cell.updateEditState(CellEditState.Preview, QUIT_EDIT_CELL_COMMAND_ID);
    }
    await context.notebookEditor.focusNotebookCell(context.cell, "container", { skipReveal: true });
  }
});
registerAction2(class QuitEditAllCellsAction extends NotebookAction {
  constructor() {
    super(
      {
        id: QUIT_EDIT_ALL_CELLS_COMMAND_ID,
        title: localize("notebookActions.quitEditAllCells", "Stop Editing All Cells")
      }
    );
  }
  async runWithContext(accessor, context) {
    if (!context.notebookEditor.hasModel()) {
      return;
    }
    const viewModel = context.notebookEditor.getViewModel();
    if (!viewModel) {
      return;
    }
    const activeCell = context.notebookEditor.getActiveCell();
    const editingCells = viewModel.viewCells.filter(
      (cell) => cell.cellKind === CellKind.Markup && cell.getEditState() === CellEditState.Editing
    );
    editingCells.forEach((cell) => {
      cell.updateEditState(CellEditState.Preview, QUIT_EDIT_ALL_CELLS_COMMAND_ID);
    });
    if (activeCell) {
      await context.notebookEditor.focusNotebookCell(activeCell, "container", { skipReveal: true });
    }
  }
});
registerAction2(class DeleteCellAction extends NotebookCellAction {
  constructor() {
    super(
      {
        id: DELETE_CELL_COMMAND_ID,
        title: localize("notebookActions.deleteCell", "Delete Cell"),
        keybinding: {
          primary: KeyCode.Delete,
          mac: {
            primary: KeyMod.CtrlCmd | KeyCode.Backspace
          },
          when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey), NOTEBOOK_OUTPUT_INPUT_FOCUSED.toNegated()),
          weight: KeybindingWeight.WorkbenchContrib
        },
        menu: [
          {
            id: MenuId.NotebookCellDelete,
            when: NOTEBOOK_EDITOR_EDITABLE,
            group: CELL_TITLE_CELL_GROUP_ID
          },
          {
            id: MenuId.InteractiveCellDelete,
            group: CELL_TITLE_CELL_GROUP_ID
          }
        ],
        icon: icons.deleteCellIcon
      }
    );
  }
  async runWithContext(accessor, context) {
    if (!context.notebookEditor.hasModel()) {
      return;
    }
    let confirmation;
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const runState = notebookExecutionStateService.getCellExecution(context.cell.uri)?.state;
    const configService = accessor.get(IConfigurationService);
    if (runState === NotebookCellExecutionState.Executing && configService.getValue(NotebookSetting.confirmDeleteRunningCell)) {
      const dialogService = accessor.get(IDialogService);
      const primaryButton = localize("confirmDeleteButton", "Delete");
      confirmation = await dialogService.confirm({
        type: "question",
        message: localize("confirmDeleteButtonMessage", "This cell is running, are you sure you want to delete it?"),
        primaryButton,
        checkbox: {
          label: localize("doNotAskAgain", "Do not ask me again")
        }
      });
    } else {
      confirmation = { confirmed: true };
    }
    if (!confirmation.confirmed) {
      return;
    }
    if (confirmation.checkboxChecked === true) {
      await configService.updateValue(NotebookSetting.confirmDeleteRunningCell, false);
    }
    runDeleteAction(context.notebookEditor, context.cell);
  }
});
registerAction2(class ClearCellOutputsAction extends NotebookCellAction {
  constructor() {
    super({
      id: CLEAR_CELL_OUTPUTS_COMMAND_ID,
      title: localize("clearCellOutputs", "Clear Cell Outputs"),
      menu: [
        {
          id: MenuId.NotebookCellTitle,
          when: ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo("code"), executeNotebookCondition, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON.toNegated()),
          order: CellToolbarOrder.ClearCellOutput,
          group: CELL_TITLE_OUTPUT_GROUP_ID
        },
        {
          id: MenuId.NotebookOutputToolbar,
          when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_IS_FIRST_OUTPUT, NOTEBOOK_USE_CONSOLIDATED_OUTPUT_BUTTON)
        }
      ],
      keybinding: {
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey), NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
        primary: KeyMod.Alt | KeyCode.Delete,
        weight: KeybindingWeight.WorkbenchContrib
      },
      icon: icons.clearIcon
    });
  }
  async runWithContext(accessor, context) {
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const editor = context.notebookEditor;
    if (!editor.hasModel() || !editor.textModel.length) {
      return;
    }
    const cell = context.cell;
    const index = editor.textModel.cells.indexOf(cell.model);
    if (index < 0) {
      return;
    }
    const computeUndoRedo = !editor.isReadOnly;
    editor.textModel.applyEdits([{ editType: CellEditType.Output, index, outputs: [] }], true, void 0, () => void 0, void 0, computeUndoRedo);
    const runState = notebookExecutionStateService.getCellExecution(context.cell.uri)?.state;
    if (runState !== NotebookCellExecutionState.Executing) {
      context.notebookEditor.textModel.applyEdits([{
        editType: CellEditType.PartialInternalMetadata,
        index,
        internalMetadata: {
          runStartTime: null,
          runStartTimeAdjustment: null,
          runEndTime: null,
          executionOrder: null,
          lastRunSuccess: null
        }
      }], true, void 0, () => void 0, void 0, computeUndoRedo);
    }
  }
});
registerAction2(class ClearAllCellOutputsAction extends NotebookAction {
  constructor() {
    super({
      id: CLEAR_ALL_CELLS_OUTPUTS_COMMAND_ID,
      title: localize("clearAllCellsOutputs", "Clear All Outputs"),
      precondition: NOTEBOOK_HAS_OUTPUTS,
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true)
          ),
          group: "navigation",
          order: 0
        },
        {
          id: MenuId.NotebookToolbar,
          when: ContextKeyExpr.and(
            executeNotebookCondition,
            ContextKeyExpr.equals("config.notebook.globalToolbar", true)
          ),
          group: "navigation/execute",
          order: 10
        }
      ],
      icon: icons.clearIcon
    });
  }
  async runWithContext(accessor, context) {
    const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
    const editor = context.notebookEditor;
    if (!editor.hasModel() || !editor.textModel.length) {
      return;
    }
    const computeUndoRedo = !editor.isReadOnly;
    editor.textModel.applyEdits(
      editor.textModel.cells.map((cell, index) => ({
        editType: CellEditType.Output,
        index,
        outputs: []
      })),
      true,
      void 0,
      () => void 0,
      void 0,
      computeUndoRedo
    );
    const clearExecutionMetadataEdits = editor.textModel.cells.map((cell, index) => {
      const runState = notebookExecutionStateService.getCellExecution(cell.uri)?.state;
      if (runState !== NotebookCellExecutionState.Executing) {
        return {
          editType: CellEditType.PartialInternalMetadata,
          index,
          internalMetadata: {
            runStartTime: null,
            runStartTimeAdjustment: null,
            runEndTime: null,
            executionOrder: null,
            lastRunSuccess: null
          }
        };
      } else {
        return void 0;
      }
    }).filter((edit) => !!edit);
    if (clearExecutionMetadataEdits.length) {
      context.notebookEditor.textModel.applyEdits(clearExecutionMetadataEdits, true, void 0, () => void 0, void 0, computeUndoRedo);
    }
    const controller = editor.getContribution(NotebookInlineVariablesController.id);
    controller.clearNotebookInlineDecorations();
  }
});
registerAction2(class ChangeCellLanguageAction extends NotebookCellAction {
  constructor() {
    super({
      id: CHANGE_CELL_LANGUAGE,
      title: localize("changeLanguage", "Change Cell Language"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyM),
        when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE)
      },
      metadata: {
        description: localize("changeLanguage", "Change Cell Language"),
        args: [
          {
            name: "range",
            description: "The cell range",
            schema: {
              "type": "object",
              "required": ["start", "end"],
              "properties": {
                "start": {
                  "type": "number"
                },
                "end": {
                  "type": "number"
                }
              }
            }
          },
          {
            name: "language",
            description: "The target cell language",
            schema: {
              "type": "string"
            }
          }
        ]
      }
    });
  }
  getCellContextFromArgs(accessor, context, ...additionalArgs) {
    if (!context || typeof context.start !== "number" || typeof context.end !== "number" || context.start >= context.end) {
      return;
    }
    const language = additionalArgs.length && typeof additionalArgs[0] === "string" ? additionalArgs[0] : void 0;
    const activeEditorContext = this.getEditorContextFromArgsOrActive(accessor);
    if (!activeEditorContext || !activeEditorContext.notebookEditor.hasModel() || context.start >= activeEditorContext.notebookEditor.getLength()) {
      return;
    }
    return {
      notebookEditor: activeEditorContext.notebookEditor,
      cell: activeEditorContext.notebookEditor.cellAt(context.start),
      language
    };
  }
  async runWithContext(accessor, context) {
    if (context.language) {
      await this.setLanguage(context, context.language);
    } else {
      await this.showLanguagePicker(accessor, context);
    }
  }
  async showLanguagePicker(accessor, context) {
    const topItems = [];
    const mainItems = [];
    const languageService = accessor.get(ILanguageService);
    const modelService = accessor.get(IModelService);
    const quickInputService = accessor.get(IQuickInputService);
    const languageDetectionService = accessor.get(ILanguageDetectionService);
    const kernelService = accessor.get(INotebookKernelService);
    let languages = context.notebookEditor.activeKernel?.supportedLanguages;
    if (!languages) {
      const matchResult = kernelService.getMatchingKernel(context.notebookEditor.textModel);
      const allSupportedLanguages = matchResult.all.flatMap((kernel) => kernel.supportedLanguages);
      languages = allSupportedLanguages.length > 0 ? allSupportedLanguages : languageService.getRegisteredLanguageIds();
    }
    const providerLanguages = /* @__PURE__ */ new Set([
      ...languages,
      "markdown"
    ]);
    providerLanguages.forEach((languageId2) => {
      let description;
      if (context.cell.cellKind === CellKind.Markup ? languageId2 === "markdown" : languageId2 === context.cell.language) {
        description = localize("languageDescription", "({0}) - Current Language", languageId2);
      } else {
        description = localize("languageDescriptionConfigured", "({0})", languageId2);
      }
      const languageName = languageService.getLanguageName(languageId2);
      if (!languageName) {
        return;
      }
      const item = {
        label: languageName,
        iconClasses: getIconClasses(modelService, languageService, this.getFakeResource(languageName, languageService)),
        description,
        languageId: languageId2
      };
      if (languageId2 === "markdown" || languageId2 === context.cell.language) {
        topItems.push(item);
      } else {
        mainItems.push(item);
      }
    });
    mainItems.sort((a, b) => {
      return a.description.localeCompare(b.description);
    });
    const autoDetectMode = {
      label: localize("autoDetect", "Auto Detect")
    };
    const picks = [
      autoDetectMode,
      { type: "separator", label: localize("languagesPicks", "languages (identifier)") },
      ...topItems,
      { type: "separator" },
      ...mainItems
    ];
    const selection = await quickInputService.pick(picks, { placeHolder: localize("pickLanguageToConfigure", "Select Language Mode") });
    const languageId = selection === autoDetectMode ? await languageDetectionService.detectLanguage(context.cell.uri) : selection?.languageId;
    if (languageId) {
      await this.setLanguage(context, languageId);
    }
  }
  async setLanguage(context, languageId) {
    await setCellToLanguage(languageId, context);
  }
  /**
   * Copied from editorStatus.ts
   */
  getFakeResource(lang, languageService) {
    let fakeResource;
    const languageId = languageService.getLanguageIdByLanguageName(lang);
    if (languageId) {
      const extensions = languageService.getExtensions(languageId);
      if (extensions.length) {
        fakeResource = URI.file(extensions[0]);
      } else {
        const filenames = languageService.getFilenames(languageId);
        if (filenames.length) {
          fakeResource = URI.file(filenames[0]);
        }
      }
    }
    return fakeResource;
  }
});
registerAction2(class DetectCellLanguageAction extends NotebookCellAction {
  constructor() {
    super({
      id: DETECT_CELL_LANGUAGE,
      title: localize2("detectLanguage", "Accept Detected Language for Cell"),
      f1: true,
      precondition: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE),
      keybinding: { primary: KeyCode.KeyD | KeyMod.Alt | KeyMod.Shift, weight: KeybindingWeight.WorkbenchContrib }
    });
  }
  async runWithContext(accessor, context) {
    const languageDetectionService = accessor.get(ILanguageDetectionService);
    const notificationService = accessor.get(INotificationService);
    const kernelService = accessor.get(INotebookKernelService);
    const kernel = kernelService.getSelectedOrSuggestedKernel(context.notebookEditor.textModel);
    const providerLanguages = [...kernel?.supportedLanguages ?? []];
    providerLanguages.push("markdown");
    const detection = await languageDetectionService.detectLanguage(context.cell.uri, providerLanguages);
    if (detection) {
      setCellToLanguage(detection, context);
    } else {
      notificationService.warn(localize("noDetection", "Unable to detect cell language"));
    }
  }
});
async function setCellToLanguage(languageId, context) {
  if (languageId === "markdown" && context.cell?.language !== "markdown") {
    const idx = context.notebookEditor.getCellIndex(context.cell);
    await changeCellToKind(CellKind.Markup, { cell: context.cell, notebookEditor: context.notebookEditor, ui: true }, "markdown", Mimes.markdown);
    const newCell = context.notebookEditor.cellAt(idx);
    if (newCell) {
      await context.notebookEditor.focusNotebookCell(newCell, "editor");
    }
  } else if (languageId !== "markdown" && context.cell?.cellKind === CellKind.Markup) {
    await changeCellToKind(CellKind.Code, { cell: context.cell, notebookEditor: context.notebookEditor, ui: true }, languageId);
  } else {
    const index = context.notebookEditor.textModel.cells.indexOf(context.cell.model);
    context.notebookEditor.textModel.applyEdits(
      [{ editType: CellEditType.CellLanguage, index, language: languageId }],
      true,
      void 0,
      () => void 0,
      void 0,
      !context.notebookEditor.isReadOnly
    );
  }
}
registerAction2(class SelectNotebookIndentation extends NotebookAction {
  constructor() {
    super({
      id: SELECT_NOTEBOOK_INDENTATION_ID,
      title: localize2("selectNotebookIndentation", "Select Indentation"),
      f1: true,
      precondition: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_CELL_EDITABLE)
    });
  }
  async runWithContext(accessor, context) {
    await this.showNotebookIndentationPicker(accessor, context);
  }
  async showNotebookIndentationPicker(accessor, context) {
    const quickInputService = accessor.get(IQuickInputService);
    const editorService = accessor.get(IEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    const activeNotebook = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!activeNotebook || activeNotebook.isDisposed) {
      return quickInputService.pick([{ label: localize("noNotebookEditor", "No notebook editor active at this time") }]);
    }
    if (activeNotebook.isReadOnly) {
      return quickInputService.pick([{ label: localize("noWritableCodeEditor", "The active notebook editor is read-only.") }]);
    }
    const picks = [
      new NotebookIndentUsingTabs(),
      // indent using tabs
      new NotebookIndentUsingSpaces(),
      // indent using spaces
      new NotebookChangeTabDisplaySize(),
      // change tab size
      new NotebookIndentationToTabsAction(),
      // convert indentation to tabs
      new NotebookIndentationToSpacesAction()
      // convert indentation to spaces
    ].map((item) => {
      return {
        id: item.desc.id,
        label: item.desc.title.toString(),
        run: () => {
          instantiationService.invokeFunction(item.run);
        }
      };
    });
    picks.splice(3, 0, { type: "separator", label: localize("indentConvert", "convert file") });
    picks.unshift({ type: "separator", label: localize("indentView", "change view") });
    const action = await quickInputService.pick(picks, { placeHolder: localize("pickAction", "Select Action"), matchOnDetail: true });
    if (!action) {
      return;
    }
    action.run();
    context.notebookEditor.focus();
    return;
  }
});
registerAction2(class CommentSelectedCellsAction extends NotebookMultiCellAction {
  constructor() {
    super({
      id: COMMENT_SELECTED_CELLS_ID,
      title: localize("commentSelectedCells", "Comment Selected Cells"),
      keybinding: {
        when: ContextKeyExpr.and(
          NOTEBOOK_EDITOR_FOCUSED,
          NOTEBOOK_EDITOR_EDITABLE,
          ContextKeyExpr.not(InputFocusedContextKey)
        ),
        primary: KeyMod.CtrlCmd | KeyCode.Slash,
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async runWithContext(accessor, context) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    context.selectedCells.forEach(async (cellViewModel) => {
      const textModel = await cellViewModel.resolveTextModel();
      const commentsOptions = cellViewModel.commentOptions;
      const cellCommentCommand = new LineCommentCommand(
        languageConfigurationService,
        new Selection(1, 1, textModel.getLineCount(), textModel.getLineMaxColumn(textModel.getLineCount())),
        // comment the entire cell
        textModel.getOptions().tabSize,
        Type.Toggle,
        commentsOptions.insertSpace ?? true,
        commentsOptions.ignoreEmptyLines ?? true,
        false
      );
      const cellEditorSelections = cellViewModel.getSelections();
      const initialTrackedRangesIDs = cellEditorSelections.map((selection) => {
        return textModel._setTrackedRange(null, selection, TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges);
      });
      CommandExecutor.executeCommands(textModel, cellEditorSelections, [cellCommentCommand]);
      const newTrackedSelections = initialTrackedRangesIDs.map((i) => {
        return textModel._getTrackedRange(i);
      }).filter((r) => !!r).map((range) => {
        return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
      });
      cellViewModel.setSelections(newTrackedSelections ?? []);
    });
  }
});
export {
  CLEAR_CELL_OUTPUTS_COMMAND_ID,
  COMMENT_SELECTED_CELLS_ID,
  SELECT_NOTEBOOK_INDENTATION_ID
};
