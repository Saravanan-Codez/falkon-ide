import { getDomNodePagePosition } from "../../../../base/browser/dom.js";
import { toAction } from "../../../../base/common/actions.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { EditorAction, registerEditorAction } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Position } from "../../../../editor/common/core/position.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import * as nls from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { PanelFocusContext } from "../../../common/contextkeys.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
import { openBreakpointSource } from "./breakpointsView.js";
import { DisassemblyView } from "./disassemblyView.js";
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, BreakpointWidgetContext, CONTEXT_CALLSTACK_ITEM_TYPE, CONTEXT_DEBUG_STATE, CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED, CONTEXT_DISASSEMBLY_VIEW_FOCUS, CONTEXT_EXCEPTION_WIDGET_VISIBLE, CONTEXT_FOCUSED_STACK_FRAME_HAS_INSTRUCTION_POINTER_REFERENCE, CONTEXT_IN_DEBUG_MODE, CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST, CONTEXT_STEP_INTO_TARGETS_SUPPORTED, EDITOR_CONTRIBUTION_ID, IDebugService, REPL_VIEW_ID, WATCH_VIEW_ID } from "../common/debug.js";
import { getEvaluatableExpressionAtPosition } from "../common/debugUtils.js";
import { DisassemblyViewInput } from "../common/disassemblyViewInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { TOGGLE_BREAKPOINT_ID } from "../../../../workbench/contrib/debug/browser/debugCommands.js";
class ToggleBreakpointAction extends Action2 {
  constructor() {
    super({
      id: TOGGLE_BREAKPOINT_ID,
      title: {
        ...nls.localize2("toggleBreakpointAction", "Toggle Breakpoint"),
        mnemonicTitle: nls.localize({ key: "miToggleBreakpoint", comment: ["&& denotes a mnemonic"] }, "Toggle &&Breakpoint")
      },
      category: nls.localize2("debugCategory", "Debug"),
      f1: true,
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      keybinding: {
        when: ContextKeyExpr.or(EditorContextKeys.editorTextFocus, CONTEXT_DISASSEMBLY_VIEW_FOCUS),
        primary: KeyCode.F9,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [{
        id: MenuId.MenubarDebugMenu,
        when: CONTEXT_DEBUGGERS_AVAILABLE,
        group: "4_new_breakpoint",
        order: 1
      }]
    });
  }
  async run(accessor, entry) {
    const editorService = accessor.get(IEditorService);
    const debugService = accessor.get(IDebugService);
    const activePane = editorService.activeEditorPane;
    if (activePane instanceof DisassemblyView) {
      const location = entry ? activePane.getAddressAndOffset(entry) : activePane.focusedAddressAndOffset;
      if (location) {
        const bps = debugService.getModel().getInstructionBreakpoints();
        const toRemove = bps.find((bp) => bp.address === location.address);
        if (toRemove) {
          debugService.removeInstructionBreakpoints(toRemove.instructionReference, toRemove.offset);
        } else {
          debugService.addInstructionBreakpoint({ instructionReference: location.reference, offset: location.offset, address: location.address, canPersist: false });
        }
      }
      return;
    }
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (editor?.hasModel()) {
      const modelUri = editor.getModel().uri;
      const canSet = debugService.canSetBreakpointsIn(editor.getModel());
      const lineNumbers = [...new Set(editor.getSelections().map((s) => s.getPosition().lineNumber))];
      await Promise.all(lineNumbers.map(async (line) => {
        const bps = debugService.getModel().getBreakpoints({ lineNumber: line, uri: modelUri });
        if (bps.length) {
          await Promise.all(bps.map((bp) => debugService.removeBreakpoints(bp.getId())));
        } else if (canSet) {
          await debugService.addBreakpoints(modelUri, [{ lineNumber: line }]);
        }
      }));
    }
  }
}
class ConditionalBreakpointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.conditionalBreakpoint",
      label: nls.localize2("conditionalBreakpointEditorAction", "Debug: Add Conditional Breakpoint..."),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menuOpts: {
        menuId: MenuId.MenubarNewBreakpointMenu,
        title: nls.localize({ key: "miConditionalBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Conditional Breakpoint..."),
        group: "1_breakpoints",
        order: 1,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    if (position && editor.hasModel() && debugService.canSetBreakpointsIn(editor.getModel())) {
      editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(position.lineNumber, void 0, BreakpointWidgetContext.CONDITION);
    }
  }
}
class LogPointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.addLogPoint",
      label: nls.localize2("logPointEditorAction", "Debug: Add Logpoint..."),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menuOpts: [
        {
          menuId: MenuId.MenubarNewBreakpointMenu,
          title: nls.localize({ key: "miLogPoint", comment: ["&& denotes a mnemonic"] }, "&&Logpoint..."),
          group: "1_breakpoints",
          order: 4,
          when: CONTEXT_DEBUGGERS_AVAILABLE
        }
      ]
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    if (position && editor.hasModel() && debugService.canSetBreakpointsIn(editor.getModel())) {
      editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(position.lineNumber, position.column, BreakpointWidgetContext.LOG_MESSAGE);
    }
  }
}
class TriggerByBreakpointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.triggerByBreakpoint",
      label: nls.localize("triggerByBreakpointEditorAction", "Debug: Add Triggered Breakpoint..."),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      alias: "Debug: Triggered Breakpoint...",
      menuOpts: [
        {
          menuId: MenuId.MenubarNewBreakpointMenu,
          title: nls.localize({ key: "miTriggerByBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Triggered Breakpoint..."),
          group: "1_breakpoints",
          order: 4,
          when: CONTEXT_DEBUGGERS_AVAILABLE
        }
      ]
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    if (position && editor.hasModel() && debugService.canSetBreakpointsIn(editor.getModel())) {
      editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(position.lineNumber, position.column, BreakpointWidgetContext.TRIGGER_POINT);
    }
  }
}
class EditBreakpointAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.editBreakpoint",
      label: nls.localize("EditBreakpointEditorAction", "Debug: Edit Breakpoint"),
      alias: "Debug: Edit Existing Breakpoint",
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menuOpts: {
        menuId: MenuId.MenubarNewBreakpointMenu,
        title: nls.localize({ key: "miEditBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Edit Breakpoint"),
        group: "1_breakpoints",
        order: 1,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const position = editor.getPosition();
    const debugModel = debugService.getModel();
    if (!(editor.hasModel() && position)) {
      return;
    }
    const lineBreakpoints = debugModel.getBreakpoints({ lineNumber: position.lineNumber });
    if (lineBreakpoints.length === 0) {
      return;
    }
    const breakpointDistances = lineBreakpoints.map((b) => {
      if (!b.column) {
        return position.column;
      }
      return Math.abs(b.column - position.column);
    });
    const closestBreakpointIndex = breakpointDistances.indexOf(Math.min(...breakpointDistances));
    const closestBreakpoint = lineBreakpoints[closestBreakpointIndex];
    editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(closestBreakpoint.lineNumber, closestBreakpoint.column);
  }
}
class OpenDisassemblyViewAction extends Action2 {
  static {
    this.ID = "debug.action.openDisassemblyView";
  }
  constructor() {
    super({
      id: OpenDisassemblyViewAction.ID,
      title: {
        ...nls.localize2("openDisassemblyView", "Open Disassembly View"),
        mnemonicTitle: nls.localize({ key: "miDisassemblyView", comment: ["&& denotes a mnemonic"] }, "&&DisassemblyView")
      },
      precondition: CONTEXT_FOCUSED_STACK_FRAME_HAS_INSTRUCTION_POINTER_REFERENCE,
      menu: [
        {
          id: MenuId.EditorContext,
          group: "debug",
          order: 5,
          when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, PanelFocusContext.toNegated(), CONTEXT_DEBUG_STATE.isEqualTo("stopped"), EditorContextKeys.editorTextFocus, CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED, CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST)
        },
        {
          id: MenuId.DebugCallStackContext,
          group: "z_commands",
          order: 50,
          when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped"), CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("stackFrame"), CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED)
        },
        {
          id: MenuId.CommandPalette,
          when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped"), CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED)
        }
      ]
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true });
  }
}
class ToggleDisassemblyViewSourceCodeAction extends Action2 {
  static {
    this.ID = "debug.action.toggleDisassemblyViewSourceCode";
  }
  static {
    this.configID = "debug.disassemblyView.showSourceCode";
  }
  constructor() {
    super({
      id: ToggleDisassemblyViewSourceCodeAction.ID,
      title: {
        ...nls.localize2("toggleDisassemblyViewSourceCode", "Toggle Source Code in Disassembly View"),
        mnemonicTitle: nls.localize({ key: "mitogglesource", comment: ["&& denotes a mnemonic"] }, "&&ToggleSource")
      },
      metadata: {
        description: nls.localize2("toggleDisassemblyViewSourceCodeDescription", "Shows or hides source code in disassembly")
      },
      f1: true
    });
  }
  run(accessor, editor, ...args) {
    const configService = accessor.get(IConfigurationService);
    if (configService) {
      const value = configService.getValue("debug").disassemblyView.showSourceCode;
      configService.updateValue(ToggleDisassemblyViewSourceCodeAction.configID, !value);
    }
  }
}
class RunToCursorAction extends EditorAction {
  static {
    this.ID = "editor.debug.action.runToCursor";
  }
  static {
    this.LABEL = nls.localize2("runToCursor", "Run to Cursor");
  }
  constructor() {
    super({
      id: RunToCursorAction.ID,
      label: RunToCursorAction.LABEL.value,
      alias: "Debug: Run to Cursor",
      precondition: ContextKeyExpr.and(
        CONTEXT_DEBUGGERS_AVAILABLE,
        PanelFocusContext.toNegated(),
        ContextKeyExpr.or(EditorContextKeys.editorTextFocus, CONTEXT_DISASSEMBLY_VIEW_FOCUS),
        ChatContextKeys.inChatSession.negate()
      ),
      contextMenuOpts: {
        group: "debug",
        order: 2,
        when: CONTEXT_IN_DEBUG_MODE
      }
    });
  }
  async run(accessor, editor) {
    const position = editor.getPosition();
    if (!(editor.hasModel() && position)) {
      return;
    }
    const uri = editor.getModel().uri;
    const debugService = accessor.get(IDebugService);
    const viewModel = debugService.getViewModel();
    const uriIdentityService = accessor.get(IUriIdentityService);
    let column = void 0;
    const focusedStackFrame = viewModel.focusedStackFrame;
    if (focusedStackFrame && uriIdentityService.extUri.isEqual(focusedStackFrame.source.uri, uri) && focusedStackFrame.range.startLineNumber === position.lineNumber) {
      column = position.column;
    }
    await debugService.runTo(uri, position.lineNumber, column);
  }
}
class SelectionToReplAction extends EditorAction {
  static {
    this.ID = "editor.debug.action.selectionToRepl";
  }
  static {
    this.LABEL = nls.localize2("evaluateInDebugConsole", "Evaluate in Debug Console");
  }
  constructor() {
    super({
      id: SelectionToReplAction.ID,
      label: SelectionToReplAction.LABEL.value,
      alias: "Debug: Evaluate in Console",
      precondition: ContextKeyExpr.and(
        CONTEXT_IN_DEBUG_MODE,
        EditorContextKeys.editorTextFocus,
        ChatContextKeys.inChatSession.negate()
      ),
      contextMenuOpts: {
        group: "debug",
        order: 0
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const viewsService = accessor.get(IViewsService);
    const viewModel = debugService.getViewModel();
    const session = viewModel.focusedSession;
    if (!editor.hasModel() || !session) {
      return;
    }
    const selection = editor.getSelection();
    let text;
    if (selection.isEmpty()) {
      text = editor.getModel().getLineContent(selection.selectionStartLineNumber).trim();
    } else {
      text = editor.getModel().getValueInRange(selection);
    }
    const replView = await viewsService.openView(REPL_VIEW_ID, false);
    replView?.sendReplInput(text);
  }
}
class SelectionToWatchExpressionsAction extends EditorAction {
  static {
    this.ID = "editor.debug.action.selectionToWatch";
  }
  static {
    this.LABEL = nls.localize2("addToWatch", "Add to Watch");
  }
  constructor() {
    super({
      id: SelectionToWatchExpressionsAction.ID,
      label: SelectionToWatchExpressionsAction.LABEL.value,
      alias: "Debug: Add to Watch",
      precondition: ContextKeyExpr.and(
        CONTEXT_IN_DEBUG_MODE,
        EditorContextKeys.editorTextFocus,
        ChatContextKeys.inChatSession.negate()
      ),
      contextMenuOpts: {
        group: "debug",
        order: 1
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const viewsService = accessor.get(IViewsService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    if (!editor.hasModel()) {
      return;
    }
    let expression = void 0;
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!selection.isEmpty()) {
      expression = model.getValueInRange(selection);
    } else {
      const position = editor.getPosition();
      const evaluatableExpression = await getEvaluatableExpressionAtPosition(languageFeaturesService, model, position);
      if (!evaluatableExpression) {
        return;
      }
      expression = evaluatableExpression.matchingExpression;
    }
    if (!expression) {
      return;
    }
    await viewsService.openView(WATCH_VIEW_ID);
    debugService.addWatchExpression(expression);
  }
}
class ShowDebugHoverAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.showDebugHover",
      label: nls.localize2("showDebugHover", "Debug: Show Hover"),
      precondition: CONTEXT_IN_DEBUG_MODE,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor, editor) {
    const position = editor.getPosition();
    if (!position || !editor.hasModel()) {
      return;
    }
    return editor.getContribution(EDITOR_CONTRIBUTION_ID)?.showHover(position, true);
  }
}
const NO_TARGETS_MESSAGE = nls.localize("editor.debug.action.stepIntoTargets.notAvailable", "Step targets are not available here");
class StepIntoTargetsAction extends EditorAction {
  static {
    this.ID = "editor.debug.action.stepIntoTargets";
  }
  static {
    this.LABEL = nls.localize({ key: "stepIntoTargets", comment: ["Step Into Targets lets the user step into an exact function he or she is interested in."] }, "Step Into Target");
  }
  constructor() {
    super({
      id: StepIntoTargetsAction.ID,
      label: StepIntoTargetsAction.LABEL,
      alias: "Debug: Step Into Target",
      precondition: ContextKeyExpr.and(CONTEXT_STEP_INTO_TARGETS_SUPPORTED, CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo("stopped"), EditorContextKeys.editorTextFocus),
      contextMenuOpts: {
        group: "debug",
        order: 1.5
      }
    });
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const contextMenuService = accessor.get(IContextMenuService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    const session = debugService.getViewModel().focusedSession;
    const frame = debugService.getViewModel().focusedStackFrame;
    const selection = editor.getSelection();
    const targetPosition = selection?.getPosition() || frame && { lineNumber: frame.range.startLineNumber, column: frame.range.startColumn };
    if (!session || !frame || !editor.hasModel() || !uriIdentityService.extUri.isEqual(editor.getModel().uri, frame.source.uri)) {
      if (targetPosition) {
        MessageController.get(editor)?.showMessage(NO_TARGETS_MESSAGE, targetPosition);
      }
      return;
    }
    const targets = await session.stepInTargets(frame.frameId);
    if (!targets?.length) {
      MessageController.get(editor)?.showMessage(NO_TARGETS_MESSAGE, targetPosition);
      return;
    }
    if (selection) {
      const positionalTargets = [];
      for (const target of targets) {
        if (target.line) {
          positionalTargets.push({
            start: new Position(target.line, target.column || 1),
            end: target.endLine ? new Position(target.endLine, target.endColumn || 1) : void 0,
            target
          });
        }
      }
      positionalTargets.sort((a, b) => b.start.lineNumber - a.start.lineNumber || b.start.column - a.start.column);
      const needle = selection.getPosition();
      const best = positionalTargets.find((t) => t.end && needle.isBefore(t.end) && t.start.isBeforeOrEqual(needle)) || positionalTargets.find((t) => t.end === void 0 && t.start.isBeforeOrEqual(needle));
      if (best) {
        session.stepIn(frame.thread.threadId, best.target.id);
        return;
      }
    }
    editor.revealLineInCenterIfOutsideViewport(frame.range.startLineNumber);
    const cursorCoords = editor.getScrolledVisiblePosition(targetPosition);
    const editorCoords = getDomNodePagePosition(editor.getDomNode());
    const x = editorCoords.left + cursorCoords.left;
    const y = editorCoords.top + cursorCoords.top + cursorCoords.height;
    contextMenuService.showContextMenu({
      getAnchor: () => ({ x, y }),
      getActions: () => {
        return targets.map((t) => toAction({ id: `stepIntoTarget:${t.id}`, label: t.label, enabled: true, run: () => session.stepIn(frame.thread.threadId, t.id) }));
      }
    });
  }
}
class GoToBreakpointAction extends EditorAction {
  constructor(isNext, opts) {
    super(opts);
    this.isNext = isNext;
  }
  async run(accessor, editor) {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    if (editor.hasModel()) {
      const currentUri = editor.getModel().uri;
      const currentLine = editor.getPosition().lineNumber;
      const allEnabledBreakpoints = debugService.getModel().getBreakpoints({ enabledOnly: true });
      let moveBreakpoint = this.isNext ? allEnabledBreakpoints.filter((bp) => uriIdentityService.extUri.isEqual(bp.uri, currentUri) && bp.lineNumber > currentLine).shift() : allEnabledBreakpoints.filter((bp) => uriIdentityService.extUri.isEqual(bp.uri, currentUri) && bp.lineNumber < currentLine).pop();
      if (!moveBreakpoint) {
        moveBreakpoint = this.isNext ? allEnabledBreakpoints.filter((bp) => bp.uri.toString() > currentUri.toString()).shift() : allEnabledBreakpoints.filter((bp) => bp.uri.toString() < currentUri.toString()).pop();
      }
      if (!moveBreakpoint && allEnabledBreakpoints.length) {
        moveBreakpoint = this.isNext ? allEnabledBreakpoints[0] : allEnabledBreakpoints[allEnabledBreakpoints.length - 1];
      }
      if (moveBreakpoint) {
        return openBreakpointSource(moveBreakpoint, false, true, false, debugService, editorService);
      }
    }
  }
}
class GoToNextBreakpointAction extends GoToBreakpointAction {
  constructor() {
    super(true, {
      id: "editor.debug.action.goToNextBreakpoint",
      label: nls.localize2("goToNextBreakpoint", "Debug: Go to Next Breakpoint"),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE
    });
  }
}
class GoToPreviousBreakpointAction extends GoToBreakpointAction {
  constructor() {
    super(false, {
      id: "editor.debug.action.goToPreviousBreakpoint",
      label: nls.localize2("goToPreviousBreakpoint", "Debug: Go to Previous Breakpoint"),
      precondition: CONTEXT_DEBUGGERS_AVAILABLE
    });
  }
}
class CloseExceptionWidgetAction extends EditorAction {
  constructor() {
    super({
      id: "editor.debug.action.closeExceptionWidget",
      label: nls.localize2("closeExceptionWidget", "Close Exception Widget"),
      precondition: CONTEXT_EXCEPTION_WIDGET_VISIBLE,
      kbOpts: {
        primary: KeyCode.Escape,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(_accessor, editor) {
    const contribution = editor.getContribution(EDITOR_CONTRIBUTION_ID);
    contribution?.closeExceptionWidget();
  }
}
registerAction2(OpenDisassemblyViewAction);
registerAction2(ToggleDisassemblyViewSourceCodeAction);
registerAction2(ToggleBreakpointAction);
registerEditorAction(ConditionalBreakpointAction);
registerEditorAction(LogPointAction);
registerEditorAction(TriggerByBreakpointAction);
registerEditorAction(EditBreakpointAction);
registerEditorAction(RunToCursorAction);
registerEditorAction(StepIntoTargetsAction);
registerEditorAction(SelectionToReplAction);
registerEditorAction(SelectionToWatchExpressionsAction);
registerEditorAction(ShowDebugHoverAction);
registerEditorAction(GoToNextBreakpointAction);
registerEditorAction(GoToPreviousBreakpointAction);
registerEditorAction(CloseExceptionWidgetAction);
export {
  RunToCursorAction,
  SelectionToReplAction,
  SelectionToWatchExpressionsAction
};
