import * as nls from "../../nls.js";
import { isFirefox } from "../../base/browser/browser.js";
import { KeyCode, KeyMod } from "../../base/common/keyCodes.js";
import * as types from "../../base/common/types.js";
import { status } from "../../base/browser/ui/aria/aria.js";
import { Command, EditorCommand, registerEditorCommand, UndoCommand, RedoCommand, SelectAllCommand } from "./editorExtensions.js";
import { ICodeEditorService } from "./services/codeEditorService.js";
import { ColumnSelection } from "../common/cursor/cursorColumnSelection.js";
import { CursorState, EditOperationType } from "../common/cursorCommon.js";
import { DeleteOperations } from "../common/cursor/cursorDeleteOperations.js";
import { CursorChangeReason } from "../common/cursorEvents.js";
import { CursorMove as CursorMove_, CursorMoveCommands } from "../common/cursor/cursorMoveCommands.js";
import { TypeOperations } from "../common/cursor/cursorTypeOperations.js";
import { Position } from "../common/core/position.js";
import { Range } from "../common/core/range.js";
import { Handler, ScrollType } from "../common/editorCommon.js";
import { EditorContextKeys } from "../common/editorContextKeys.js";
import { VerticalRevealType } from "../common/viewEvents.js";
import { ContextKeyExpr } from "../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight, KeybindingsRegistry } from "../../platform/keybinding/common/keybindingsRegistry.js";
import { EditorOption } from "../common/config/editorOptions.js";
import { getActiveElement, isEditableElement } from "../../base/browser/dom.js";
import { EnterOperation } from "../common/cursor/cursorTypeEditOperations.js";
import { TextEditorSelectionSource } from "../../platform/editor/common/editor.js";
const CORE_WEIGHT = KeybindingWeight.EditorCore;
class CoreEditorCommand extends EditorCommand {
  runEditorCommand(accessor, editor, args) {
    const viewModel = editor._getViewModel();
    if (!viewModel) {
      return;
    }
    this.runCoreEditorCommand(viewModel, args || {});
  }
}
var EditorScroll_;
((EditorScroll_2) => {
  const isEditorScrollArgs = function(arg) {
    if (!types.isObject(arg)) {
      return false;
    }
    const scrollArg = arg;
    if (!types.isString(scrollArg.to)) {
      return false;
    }
    if (!types.isUndefined(scrollArg.by) && !types.isString(scrollArg.by)) {
      return false;
    }
    if (!types.isUndefined(scrollArg.value) && !types.isNumber(scrollArg.value)) {
      return false;
    }
    if (!types.isUndefined(scrollArg.revealCursor) && !types.isBoolean(scrollArg.revealCursor)) {
      return false;
    }
    return true;
  };
  EditorScroll_2.metadata = {
    description: "Scroll editor in the given direction",
    args: [
      {
        name: "Editor scroll argument object",
        description: `Property-value pairs that can be passed through this argument:
					* 'to': A mandatory direction value.
						\`\`\`
						'up', 'down'
						\`\`\`
					* 'by': Unit to move. Default is computed based on 'to' value.
						\`\`\`
						'line', 'wrappedLine', 'page', 'halfPage', 'editor'
						\`\`\`
					* 'value': Number of units to move. Default is '1'.
					* 'revealCursor': If 'true' reveals the cursor if it is outside view port.
				`,
        constraint: isEditorScrollArgs,
        schema: {
          "type": "object",
          "required": ["to"],
          "properties": {
            "to": {
              "type": "string",
              "enum": ["up", "down"]
            },
            "by": {
              "type": "string",
              "enum": ["line", "wrappedLine", "page", "halfPage", "editor"]
            },
            "value": {
              "type": "number",
              "default": 1
            },
            "revealCursor": {
              "type": "boolean"
            }
          }
        }
      }
    ]
  };
  EditorScroll_2.RawDirection = {
    Up: "up",
    Right: "right",
    Down: "down",
    Left: "left"
  };
  EditorScroll_2.RawUnit = {
    Line: "line",
    WrappedLine: "wrappedLine",
    Page: "page",
    HalfPage: "halfPage",
    Editor: "editor",
    Column: "column"
  };
  function parse(args) {
    let direction;
    switch (args.to) {
      case EditorScroll_2.RawDirection.Up:
        direction = 1 /* Up */;
        break;
      case EditorScroll_2.RawDirection.Right:
        direction = 2 /* Right */;
        break;
      case EditorScroll_2.RawDirection.Down:
        direction = 3 /* Down */;
        break;
      case EditorScroll_2.RawDirection.Left:
        direction = 4 /* Left */;
        break;
      default:
        return null;
    }
    let unit;
    switch (args.by) {
      case EditorScroll_2.RawUnit.Line:
        unit = 1 /* Line */;
        break;
      case EditorScroll_2.RawUnit.WrappedLine:
        unit = 2 /* WrappedLine */;
        break;
      case EditorScroll_2.RawUnit.Page:
        unit = 3 /* Page */;
        break;
      case EditorScroll_2.RawUnit.HalfPage:
        unit = 4 /* HalfPage */;
        break;
      case EditorScroll_2.RawUnit.Editor:
        unit = 5 /* Editor */;
        break;
      case EditorScroll_2.RawUnit.Column:
        unit = 6 /* Column */;
        break;
      default:
        unit = 2 /* WrappedLine */;
    }
    const value = Math.floor(args.value || 1);
    const revealCursor = !!args.revealCursor;
    return {
      direction,
      unit,
      value,
      revealCursor,
      select: !!args.select
    };
  }
  EditorScroll_2.parse = parse;
  let Direction;
  ((Direction2) => {
    Direction2[Direction2["Up"] = 1] = "Up";
    Direction2[Direction2["Right"] = 2] = "Right";
    Direction2[Direction2["Down"] = 3] = "Down";
    Direction2[Direction2["Left"] = 4] = "Left";
  })(Direction = EditorScroll_2.Direction || (EditorScroll_2.Direction = {}));
  let Unit;
  ((Unit2) => {
    Unit2[Unit2["Line"] = 1] = "Line";
    Unit2[Unit2["WrappedLine"] = 2] = "WrappedLine";
    Unit2[Unit2["Page"] = 3] = "Page";
    Unit2[Unit2["HalfPage"] = 4] = "HalfPage";
    Unit2[Unit2["Editor"] = 5] = "Editor";
    Unit2[Unit2["Column"] = 6] = "Column";
  })(Unit = EditorScroll_2.Unit || (EditorScroll_2.Unit = {}));
})(EditorScroll_ || (EditorScroll_ = {}));
var RevealLine_;
((RevealLine_2) => {
  const isRevealLineArgs = function(arg) {
    if (!types.isObject(arg)) {
      return false;
    }
    const reveaLineArg = arg;
    if (!types.isNumber(reveaLineArg.lineNumber) && !types.isString(reveaLineArg.lineNumber)) {
      return false;
    }
    if (!types.isUndefined(reveaLineArg.at) && !types.isString(reveaLineArg.at)) {
      return false;
    }
    return true;
  };
  RevealLine_2.metadata = {
    description: "Reveal the given line at the given logical position",
    args: [
      {
        name: "Reveal line argument object",
        description: `Property-value pairs that can be passed through this argument:
					* 'lineNumber': A mandatory line number value.
					* 'at': Logical position at which line has to be revealed.
						\`\`\`
						'top', 'center', 'bottom'
						\`\`\`
				`,
        constraint: isRevealLineArgs,
        schema: {
          "type": "object",
          "required": ["lineNumber"],
          "properties": {
            "lineNumber": {
              "type": ["number", "string"]
            },
            "at": {
              "type": "string",
              "enum": ["top", "center", "bottom"]
            }
          }
        }
      }
    ]
  };
  RevealLine_2.RawAtArgument = {
    Top: "top",
    Center: "center",
    Bottom: "bottom"
  };
})(RevealLine_ || (RevealLine_ = {}));
class EditorOrNativeTextInputCommand {
  constructor(target) {
    target.addImplementation(1e4, "code-editor", (accessor, args) => {
      const focusedEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
      if (focusedEditor && focusedEditor.hasTextFocus()) {
        return this._runEditorCommand(accessor, focusedEditor, args);
      }
      return false;
    });
    target.addImplementation(1e3, "generic-dom-input-textarea", (accessor, args) => {
      const activeElement = getActiveElement();
      if (activeElement && isEditableElement(activeElement)) {
        this.runDOMCommand(activeElement);
        return true;
      }
      return false;
    });
    target.addImplementation(0, "generic-dom", (accessor, args) => {
      const activeEditor = accessor.get(ICodeEditorService).getActiveCodeEditor();
      if (activeEditor) {
        activeEditor.focus();
        return this._runEditorCommand(accessor, activeEditor, args);
      }
      return false;
    });
  }
  _runEditorCommand(accessor, editor, args) {
    const result = this.runEditorCommand(accessor, editor, args);
    if (result) {
      return result;
    }
    return true;
  }
}
var NavigationCommandRevealType = /* @__PURE__ */ ((NavigationCommandRevealType2) => {
  NavigationCommandRevealType2[NavigationCommandRevealType2["Regular"] = 0] = "Regular";
  NavigationCommandRevealType2[NavigationCommandRevealType2["Minimal"] = 1] = "Minimal";
  NavigationCommandRevealType2[NavigationCommandRevealType2["None"] = 2] = "None";
  return NavigationCommandRevealType2;
})(NavigationCommandRevealType || {});
var CoreNavigationCommands;
((CoreNavigationCommands2) => {
  class BaseMoveToCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      viewModel.model.pushStackElement();
      const cursorStateChanged = viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
        ]
      );
      if (cursorStateChanged && args.revealType !== 2 /* None */) {
        viewModel.revealAllCursors(args.source, true, true);
      }
    }
  }
  CoreNavigationCommands2.MoveTo = registerEditorCommand(new BaseMoveToCommand({
    id: "_moveTo",
    inSelectionMode: false,
    precondition: void 0
  }));
  CoreNavigationCommands2.MoveToSelect = registerEditorCommand(new BaseMoveToCommand({
    id: "_moveToSelect",
    inSelectionMode: true,
    precondition: void 0
  }));
  class ColumnSelectCommand extends CoreEditorCommand {
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      const result = this._getColumnSelectResult(viewModel, viewModel.getPrimaryCursorState(), viewModel.getCursorColumnSelectData(), args);
      if (result === null) {
        return;
      }
      viewModel.setCursorStates(args.source, CursorChangeReason.Explicit, result.viewStates.map((viewState) => CursorState.fromViewState(viewState)));
      viewModel.setCursorColumnSelectData({
        isReal: true,
        fromViewLineNumber: result.fromLineNumber,
        fromViewVisualColumn: result.fromVisualColumn,
        toViewLineNumber: result.toLineNumber,
        toViewVisualColumn: result.toVisualColumn
      });
      if (result.reversed) {
        viewModel.revealTopMostCursor(args.source);
      } else {
        viewModel.revealBottomMostCursor(args.source);
      }
    }
  }
  CoreNavigationCommands2.ColumnSelect = registerEditorCommand(new class extends ColumnSelectCommand {
    constructor() {
      super({
        id: "columnSelect",
        precondition: void 0
      });
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      if (typeof args.position === "undefined" || typeof args.viewPosition === "undefined" || typeof args.mouseColumn === "undefined") {
        return null;
      }
      const validatedPosition = viewModel.model.validatePosition(args.position);
      const validatedViewPosition = viewModel.coordinatesConverter.validateViewPosition(new Position(args.viewPosition.lineNumber, args.viewPosition.column), validatedPosition);
      const fromViewLineNumber = args.doColumnSelect ? prevColumnSelectData.fromViewLineNumber : validatedViewPosition.lineNumber;
      const fromViewVisualColumn = args.doColumnSelect ? prevColumnSelectData.fromViewVisualColumn : args.mouseColumn - 1;
      return ColumnSelection.columnSelect(viewModel.cursorConfig, viewModel, fromViewLineNumber, fromViewVisualColumn, validatedViewPosition.lineNumber, args.mouseColumn - 1);
    }
  }());
  CoreNavigationCommands2.CursorColumnSelectLeft = registerEditorCommand(new class extends ColumnSelectCommand {
    constructor() {
      super({
        id: "cursorColumnSelectLeft",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.LeftArrow,
          linux: { primary: 0 }
        }
      });
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectLeft(viewModel.cursorConfig, viewModel, prevColumnSelectData);
    }
  }());
  CoreNavigationCommands2.CursorColumnSelectRight = registerEditorCommand(new class extends ColumnSelectCommand {
    constructor() {
      super({
        id: "cursorColumnSelectRight",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.RightArrow,
          linux: { primary: 0 }
        }
      });
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectRight(viewModel.cursorConfig, viewModel, prevColumnSelectData);
    }
  }());
  class ColumnSelectUpCommand extends ColumnSelectCommand {
    constructor(opts) {
      super(opts);
      this._isPaged = opts.isPaged;
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectUp(viewModel.cursorConfig, viewModel, prevColumnSelectData, this._isPaged);
    }
  }
  CoreNavigationCommands2.CursorColumnSelectUp = registerEditorCommand(new ColumnSelectUpCommand({
    isPaged: false,
    id: "cursorColumnSelectUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.UpArrow,
      linux: { primary: 0 }
    }
  }));
  CoreNavigationCommands2.CursorColumnSelectPageUp = registerEditorCommand(new ColumnSelectUpCommand({
    isPaged: true,
    id: "cursorColumnSelectPageUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.PageUp,
      linux: { primary: 0 }
    }
  }));
  class ColumnSelectDownCommand extends ColumnSelectCommand {
    constructor(opts) {
      super(opts);
      this._isPaged = opts.isPaged;
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectDown(viewModel.cursorConfig, viewModel, prevColumnSelectData, this._isPaged);
    }
  }
  CoreNavigationCommands2.CursorColumnSelectDown = registerEditorCommand(new ColumnSelectDownCommand({
    isPaged: false,
    id: "cursorColumnSelectDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.DownArrow,
      linux: { primary: 0 }
    }
  }));
  CoreNavigationCommands2.CursorColumnSelectPageDown = registerEditorCommand(new ColumnSelectDownCommand({
    isPaged: true,
    id: "cursorColumnSelectPageDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.PageDown,
      linux: { primary: 0 }
    }
  }));
  class CursorMoveImpl extends CoreEditorCommand {
    constructor() {
      super({
        id: "cursorMove",
        precondition: void 0,
        metadata: CursorMove_.metadata
      });
    }
    runCoreEditorCommand(viewModel, args) {
      const parsed = CursorMove_.parse(args);
      if (!parsed) {
        return;
      }
      this._runCursorMove(viewModel, args.source, parsed);
    }
    _runCursorMove(viewModel, source, args) {
      const effectiveSource = args.noHistory ? TextEditorSelectionSource.PROGRAMMATIC : source;
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        effectiveSource,
        CursorChangeReason.Explicit,
        CursorMoveImpl._move(viewModel, viewModel.getCursorStates(), args)
      );
      viewModel.revealAllCursors(effectiveSource, true);
    }
    static _move(viewModel, cursors, args) {
      const inSelectionMode = args.select;
      const value = args.value;
      switch (args.direction) {
        case CursorMove_.Direction.Left:
        case CursorMove_.Direction.Right:
        case CursorMove_.Direction.Up:
        case CursorMove_.Direction.Down:
        case CursorMove_.Direction.PrevBlankLine:
        case CursorMove_.Direction.NextBlankLine:
        case CursorMove_.Direction.WrappedLineStart:
        case CursorMove_.Direction.WrappedLineFirstNonWhitespaceCharacter:
        case CursorMove_.Direction.WrappedLineColumnCenter:
        case CursorMove_.Direction.WrappedLineEnd:
        case CursorMove_.Direction.WrappedLineLastNonWhitespaceCharacter:
          return CursorMoveCommands.simpleMove(viewModel, cursors, args.direction, inSelectionMode, value, args.unit);
        case CursorMove_.Direction.ViewPortTop:
        case CursorMove_.Direction.ViewPortBottom:
        case CursorMove_.Direction.ViewPortCenter:
        case CursorMove_.Direction.ViewPortIfOutside:
          return CursorMoveCommands.viewportMove(viewModel, cursors, args.direction, inSelectionMode, value);
        default:
          return null;
      }
    }
  }
  CoreNavigationCommands2.CursorMoveImpl = CursorMoveImpl;
  CoreNavigationCommands2.CursorMove = registerEditorCommand(new CursorMoveImpl());
  let Constants;
  ((Constants2) => {
    Constants2[Constants2["PAGE_SIZE_MARKER"] = -1] = "PAGE_SIZE_MARKER";
  })(Constants || (Constants = {}));
  class CursorMoveBasedCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._staticArgs = opts.args;
    }
    runCoreEditorCommand(viewModel, dynamicArgs) {
      let args = this._staticArgs;
      if (this._staticArgs.value === -1 /* PAGE_SIZE_MARKER */) {
        args = {
          direction: this._staticArgs.direction,
          unit: this._staticArgs.unit,
          select: this._staticArgs.select,
          value: dynamicArgs.pageSize || viewModel.cursorConfig.pageSize
        };
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        dynamicArgs.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.simpleMove(viewModel, viewModel.getCursorStates(), args.direction, args.select, args.value, args.unit)
      );
      viewModel.revealAllCursors(dynamicArgs.source, true);
    }
  }
  CoreNavigationCommands2.CursorLeft = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Left,
      unit: CursorMove_.Unit.None,
      select: false,
      value: 1
    },
    id: "cursorLeft",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.LeftArrow,
      mac: { primary: KeyCode.LeftArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyB] }
    }
  }));
  CoreNavigationCommands2.CursorLeftSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Left,
      unit: CursorMove_.Unit.None,
      select: true,
      value: 1
    },
    id: "cursorLeftSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.LeftArrow
    }
  }));
  CoreNavigationCommands2.CursorRight = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Right,
      unit: CursorMove_.Unit.None,
      select: false,
      value: 1
    },
    id: "cursorRight",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.RightArrow,
      mac: { primary: KeyCode.RightArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyF] }
    }
  }));
  CoreNavigationCommands2.CursorRightSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Right,
      unit: CursorMove_.Unit.None,
      select: true,
      value: 1
    },
    id: "cursorRightSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.RightArrow
    }
  }));
  CoreNavigationCommands2.CursorUp = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: 1
    },
    id: "cursorUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.UpArrow,
      mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyP] }
    }
  }));
  CoreNavigationCommands2.CursorUpSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: 1
    },
    id: "cursorUpSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.UpArrow,
      secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow],
      mac: { primary: KeyMod.Shift | KeyCode.UpArrow },
      linux: { primary: KeyMod.Shift | KeyCode.UpArrow }
    }
  }));
  CoreNavigationCommands2.CursorPageUp = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.PageUp
    }
  }));
  CoreNavigationCommands2.CursorPageUpSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageUpSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.PageUp
    }
  }));
  CoreNavigationCommands2.CursorDown = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: 1
    },
    id: "cursorDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.DownArrow,
      mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyN] }
    }
  }));
  CoreNavigationCommands2.CursorDownSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: 1
    },
    id: "cursorDownSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.DownArrow,
      secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow],
      mac: { primary: KeyMod.Shift | KeyCode.DownArrow },
      linux: { primary: KeyMod.Shift | KeyCode.DownArrow }
    }
  }));
  CoreNavigationCommands2.CursorPageDown = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.PageDown
    }
  }));
  CoreNavigationCommands2.CursorPageDownSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageDownSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.PageDown
    }
  }));
  CoreNavigationCommands2.CreateCursor = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "createCursor",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      let newState;
      if (args.wholeLine) {
        newState = CursorMoveCommands.line(viewModel, viewModel.getPrimaryCursorState(), false, args.position, args.viewPosition);
      } else {
        newState = CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), false, args.position, args.viewPosition);
      }
      const states = viewModel.getCursorStates();
      if (states.length > 1) {
        const newModelPosition = newState.modelState ? newState.modelState.position : null;
        const newViewPosition = newState.viewState ? newState.viewState.position : null;
        for (let i = 0, len = states.length; i < len; i++) {
          const state = states[i];
          if (newModelPosition && !state.modelState.selection.containsPosition(newModelPosition)) {
            continue;
          }
          if (newViewPosition && !state.viewState.selection.containsPosition(newViewPosition)) {
            continue;
          }
          states.splice(i, 1);
          viewModel.model.pushStackElement();
          viewModel.setCursorStates(
            args.source,
            CursorChangeReason.Explicit,
            states
          );
          return;
        }
      }
      states.push(newState);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        states
      );
    }
  }());
  CoreNavigationCommands2.LastCursorMoveToSelect = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "_lastCursorMoveToSelect",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
      const states = viewModel.getCursorStates();
      const newStates = states.slice(0);
      newStates[lastAddedCursorIndex] = CursorMoveCommands.moveTo(viewModel, states[lastAddedCursorIndex], true, args.position, args.viewPosition);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        newStates
      );
    }
  }());
  class HomeCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToBeginningOfLine(viewModel, viewModel.getCursorStates(), this._inSelectionMode)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorHome = registerEditorCommand(new HomeCommand({
    inSelectionMode: false,
    id: "cursorHome",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.Home,
      mac: { primary: KeyCode.Home, secondary: [KeyMod.CtrlCmd | KeyCode.LeftArrow] }
    }
  }));
  CoreNavigationCommands2.CursorHomeSelect = registerEditorCommand(new HomeCommand({
    inSelectionMode: true,
    id: "cursorHomeSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.Home,
      mac: { primary: KeyMod.Shift | KeyCode.Home, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow] }
    }
  }));
  class LineStartCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        this._exec(viewModel.getCursorStates())
      );
      viewModel.revealAllCursors(args.source, true);
    }
    _exec(cursors) {
      const result = [];
      for (let i = 0, len = cursors.length; i < len; i++) {
        const cursor = cursors[i];
        const lineNumber = cursor.modelState.position.lineNumber;
        result[i] = CursorState.fromModelState(cursor.modelState.move(this._inSelectionMode, lineNumber, 1, 0));
      }
      return result;
    }
  }
  CoreNavigationCommands2.CursorLineStart = registerEditorCommand(new LineStartCommand({
    inSelectionMode: false,
    id: "cursorLineStart",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyCode.KeyA }
    }
  }));
  CoreNavigationCommands2.CursorLineStartSelect = registerEditorCommand(new LineStartCommand({
    inSelectionMode: true,
    id: "cursorLineStartSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyA }
    }
  }));
  class EndCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToEndOfLine(viewModel, viewModel.getCursorStates(), this._inSelectionMode, args.sticky || false)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorEnd = registerEditorCommand(new EndCommand({
    inSelectionMode: false,
    id: "cursorEnd",
    precondition: void 0,
    kbOpts: {
      args: { sticky: false },
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.End,
      mac: { primary: KeyCode.End, secondary: [KeyMod.CtrlCmd | KeyCode.RightArrow] }
    },
    metadata: {
      description: `Go to End`,
      args: [{
        name: "args",
        schema: {
          type: "object",
          properties: {
            "sticky": {
              description: nls.localize("stickydesc", "Stick to the end even when going to longer lines"),
              type: "boolean",
              default: false
            }
          }
        }
      }]
    }
  }));
  CoreNavigationCommands2.CursorEndSelect = registerEditorCommand(new EndCommand({
    inSelectionMode: true,
    id: "cursorEndSelect",
    precondition: void 0,
    kbOpts: {
      args: { sticky: false },
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.End,
      mac: { primary: KeyMod.Shift | KeyCode.End, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow] }
    },
    metadata: {
      description: `Select to End`,
      args: [{
        name: "args",
        schema: {
          type: "object",
          properties: {
            "sticky": {
              description: nls.localize("stickydesc", "Stick to the end even when going to longer lines"),
              type: "boolean",
              default: false
            }
          }
        }
      }]
    }
  }));
  class LineEndCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        this._exec(viewModel, viewModel.getCursorStates())
      );
      viewModel.revealAllCursors(args.source, true);
    }
    _exec(viewModel, cursors) {
      const result = [];
      for (let i = 0, len = cursors.length; i < len; i++) {
        const cursor = cursors[i];
        const lineNumber = cursor.modelState.position.lineNumber;
        const maxColumn = viewModel.model.getLineMaxColumn(lineNumber);
        result[i] = CursorState.fromModelState(cursor.modelState.move(this._inSelectionMode, lineNumber, maxColumn, 0));
      }
      return result;
    }
  }
  CoreNavigationCommands2.CursorLineEnd = registerEditorCommand(new LineEndCommand({
    inSelectionMode: false,
    id: "cursorLineEnd",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyCode.KeyE }
    }
  }));
  CoreNavigationCommands2.CursorLineEndSelect = registerEditorCommand(new LineEndCommand({
    inSelectionMode: true,
    id: "cursorLineEndSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyE }
    }
  }));
  class TopCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToBeginningOfBuffer(viewModel, viewModel.getCursorStates(), this._inSelectionMode)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorTop = registerEditorCommand(new TopCommand({
    inSelectionMode: false,
    id: "cursorTop",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyCode.Home,
      mac: { primary: KeyMod.CtrlCmd | KeyCode.UpArrow }
    }
  }));
  CoreNavigationCommands2.CursorTopSelect = registerEditorCommand(new TopCommand({
    inSelectionMode: true,
    id: "cursorTopSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Home,
      mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow }
    }
  }));
  class BottomCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToEndOfBuffer(viewModel, viewModel.getCursorStates(), this._inSelectionMode)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorBottom = registerEditorCommand(new BottomCommand({
    inSelectionMode: false,
    id: "cursorBottom",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyCode.End,
      mac: { primary: KeyMod.CtrlCmd | KeyCode.DownArrow }
    }
  }));
  CoreNavigationCommands2.CursorBottomSelect = registerEditorCommand(new BottomCommand({
    inSelectionMode: true,
    id: "cursorBottomSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.End,
      mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow }
    }
  }));
  class EditorScrollImpl extends CoreEditorCommand {
    constructor() {
      super({
        id: "editorScroll",
        precondition: void 0,
        metadata: EditorScroll_.metadata
      });
    }
    determineScrollMethod(args) {
      const horizontalUnits = [6 /* Column */];
      const verticalUnits = [
        1 /* Line */,
        2 /* WrappedLine */,
        3 /* Page */,
        4 /* HalfPage */,
        5 /* Editor */
      ];
      const horizontalDirections = [4 /* Left */, 2 /* Right */];
      const verticalDirections = [1 /* Up */, 3 /* Down */];
      if (horizontalUnits.includes(args.unit) && horizontalDirections.includes(args.direction)) {
        return this._runHorizontalEditorScroll.bind(this);
      }
      if (verticalUnits.includes(args.unit) && verticalDirections.includes(args.direction)) {
        return this._runVerticalEditorScroll.bind(this);
      }
      return null;
    }
    runCoreEditorCommand(viewModel, args) {
      const parsed = EditorScroll_.parse(args);
      if (!parsed) {
        return;
      }
      const runEditorScroll = this.determineScrollMethod(parsed);
      if (!runEditorScroll) {
        return;
      }
      runEditorScroll(viewModel, args.source, parsed);
    }
    _runVerticalEditorScroll(viewModel, source, args) {
      const desiredScrollTop = this._computeDesiredScrollTop(viewModel, args);
      if (args.revealCursor) {
        const desiredVisibleViewRange = viewModel.getCompletelyVisibleViewRangeAtScrollTop(desiredScrollTop);
        const paddedRange = viewModel.getViewRangeWithCursorPadding(desiredVisibleViewRange);
        viewModel.setCursorStates(
          source,
          CursorChangeReason.Explicit,
          [
            CursorMoveCommands.findPositionInViewportIfOutside(viewModel, viewModel.getPrimaryCursorState(), paddedRange, args.select)
          ]
        );
      }
      viewModel.viewLayout.setScrollPosition({ scrollTop: desiredScrollTop }, ScrollType.Smooth);
    }
    _computeDesiredScrollTop(viewModel, args) {
      if (args.unit === 1 /* Line */) {
        const futureViewport = viewModel.viewLayout.getFutureViewport();
        const visibleViewRange = viewModel.getCompletelyVisibleViewRangeAtScrollTop(futureViewport.top);
        const visibleModelRange = viewModel.coordinatesConverter.convertViewRangeToModelRange(visibleViewRange);
        let desiredTopModelLineNumber;
        if (args.direction === 1 /* Up */) {
          desiredTopModelLineNumber = Math.max(1, visibleModelRange.startLineNumber - args.value);
        } else {
          desiredTopModelLineNumber = Math.min(viewModel.model.getLineCount(), visibleModelRange.startLineNumber + args.value);
        }
        const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(new Position(desiredTopModelLineNumber, 1));
        return viewModel.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
      }
      if (args.unit === 5 /* Editor */) {
        let desiredTopModelLineNumber = 0;
        if (args.direction === 3 /* Down */) {
          desiredTopModelLineNumber = viewModel.model.getLineCount() - viewModel.cursorConfig.pageSize;
        }
        return viewModel.viewLayout.getVerticalOffsetForLineNumber(desiredTopModelLineNumber);
      }
      let noOfLines;
      if (args.unit === 3 /* Page */) {
        noOfLines = viewModel.cursorConfig.pageSize * args.value;
      } else if (args.unit === 4 /* HalfPage */) {
        noOfLines = Math.round(viewModel.cursorConfig.pageSize / 2) * args.value;
      } else {
        noOfLines = args.value;
      }
      const deltaLines = (args.direction === 1 /* Up */ ? -1 : 1) * noOfLines;
      return viewModel.viewLayout.getCurrentScrollTop() + deltaLines * viewModel.cursorConfig.lineHeight;
    }
    _runHorizontalEditorScroll(viewModel, source, args) {
      const desiredScrollLeft = this._computeDesiredScrollLeft(viewModel, args);
      viewModel.viewLayout.setScrollPosition({ scrollLeft: desiredScrollLeft }, ScrollType.Smooth);
    }
    _computeDesiredScrollLeft(viewModel, args) {
      const deltaColumns = (args.direction === 4 /* Left */ ? -1 : 1) * args.value;
      return viewModel.viewLayout.getCurrentScrollLeft() + deltaColumns * viewModel.cursorConfig.typicalHalfwidthCharacterWidth;
    }
  }
  CoreNavigationCommands2.EditorScrollImpl = EditorScrollImpl;
  CoreNavigationCommands2.EditorScroll = registerEditorCommand(new EditorScrollImpl());
  CoreNavigationCommands2.ScrollLineUp = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollLineUp",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
          mac: { primary: KeyMod.WinCtrl | KeyCode.PageUp }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Up,
        by: EditorScroll_.RawUnit.WrappedLine,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollPageUp = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollPageUp",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.PageUp,
          win: { primary: KeyMod.Alt | KeyCode.PageUp },
          linux: { primary: KeyMod.Alt | KeyCode.PageUp }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Up,
        by: EditorScroll_.RawUnit.Page,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollEditorTop = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollEditorTop",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Up,
        by: EditorScroll_.RawUnit.Editor,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollLineDown = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollLineDown",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
          mac: { primary: KeyMod.WinCtrl | KeyCode.PageDown }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Down,
        by: EditorScroll_.RawUnit.WrappedLine,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollPageDown = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollPageDown",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.PageDown,
          win: { primary: KeyMod.Alt | KeyCode.PageDown },
          linux: { primary: KeyMod.Alt | KeyCode.PageDown }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Down,
        by: EditorScroll_.RawUnit.Page,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollEditorBottom = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollEditorBottom",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Down,
        by: EditorScroll_.RawUnit.Editor,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollLeft = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollLeft",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Left,
        by: EditorScroll_.RawUnit.Column,
        value: 2,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollRight = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollRight",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Right,
        by: EditorScroll_.RawUnit.Column,
        value: 2,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  class WordCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.word(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position)
        ]
      );
      if (args.revealType !== 2 /* None */) {
        viewModel.revealAllCursors(args.source, true, true);
      }
    }
  }
  CoreNavigationCommands2.WordSelect = registerEditorCommand(new WordCommand({
    inSelectionMode: false,
    id: "_wordSelect",
    precondition: void 0
  }));
  CoreNavigationCommands2.WordSelectDrag = registerEditorCommand(new WordCommand({
    inSelectionMode: true,
    id: "_wordSelectDrag",
    precondition: void 0
  }));
  CoreNavigationCommands2.LastCursorWordSelect = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "lastCursorWordSelect",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
      const states = viewModel.getCursorStates();
      const newStates = states.slice(0);
      const lastAddedState = states[lastAddedCursorIndex];
      newStates[lastAddedCursorIndex] = CursorMoveCommands.word(viewModel, lastAddedState, lastAddedState.modelState.hasSelection(), args.position);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        newStates
      );
    }
  }());
  class LineCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.line(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
        ]
      );
      if (args.revealType !== 2 /* None */) {
        viewModel.revealAllCursors(args.source, false, true);
      }
    }
  }
  CoreNavigationCommands2.LineSelect = registerEditorCommand(new LineCommand({
    inSelectionMode: false,
    id: "_lineSelect",
    precondition: void 0
  }));
  CoreNavigationCommands2.LineSelectDrag = registerEditorCommand(new LineCommand({
    inSelectionMode: true,
    id: "_lineSelectDrag",
    precondition: void 0
  }));
  class LastCursorLineCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
      const states = viewModel.getCursorStates();
      const newStates = states.slice(0);
      newStates[lastAddedCursorIndex] = CursorMoveCommands.line(viewModel, states[lastAddedCursorIndex], this._inSelectionMode, args.position, args.viewPosition);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        newStates
      );
    }
  }
  CoreNavigationCommands2.LastCursorLineSelect = registerEditorCommand(new LastCursorLineCommand({
    inSelectionMode: false,
    id: "lastCursorLineSelect",
    precondition: void 0
  }));
  CoreNavigationCommands2.LastCursorLineSelectDrag = registerEditorCommand(new LastCursorLineCommand({
    inSelectionMode: true,
    id: "lastCursorLineSelectDrag",
    precondition: void 0
  }));
  CoreNavigationCommands2.CancelSelection = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "cancelSelection",
        precondition: EditorContextKeys.hasNonEmptySelection,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Escape,
          secondary: [KeyMod.Shift | KeyCode.Escape]
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.cancelSelection(viewModel, viewModel.getPrimaryCursorState())
        ]
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }());
  CoreNavigationCommands2.RemoveSecondaryCursors = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "removeSecondaryCursors",
        precondition: EditorContextKeys.hasMultipleSelections,
        kbOpts: {
          weight: CORE_WEIGHT + 1,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Escape,
          secondary: [KeyMod.Shift | KeyCode.Escape]
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          viewModel.getPrimaryCursorState()
        ]
      );
      viewModel.revealAllCursors(args.source, true);
      status(nls.localize("removedCursor", "Removed secondary cursors"));
    }
  }());
  CoreNavigationCommands2.RevealLine = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "revealLine",
        precondition: void 0,
        metadata: RevealLine_.metadata
      });
    }
    runCoreEditorCommand(viewModel, args) {
      const revealLineArg = args;
      const lineNumberArg = revealLineArg.lineNumber || 0;
      let lineNumber = typeof lineNumberArg === "number" ? lineNumberArg + 1 : parseInt(lineNumberArg) + 1;
      if (lineNumber < 1) {
        lineNumber = 1;
      }
      const lineCount = viewModel.model.getLineCount();
      if (lineNumber > lineCount) {
        lineNumber = lineCount;
      }
      const range = new Range(
        lineNumber,
        1,
        lineNumber,
        viewModel.model.getLineMaxColumn(lineNumber)
      );
      let revealAt = VerticalRevealType.Simple;
      if (revealLineArg.at) {
        switch (revealLineArg.at) {
          case RevealLine_.RawAtArgument.Top:
            revealAt = VerticalRevealType.Top;
            break;
          case RevealLine_.RawAtArgument.Center:
            revealAt = VerticalRevealType.Center;
            break;
          case RevealLine_.RawAtArgument.Bottom:
            revealAt = VerticalRevealType.Bottom;
            break;
          default:
            break;
        }
      }
      const viewRange = viewModel.coordinatesConverter.convertModelRangeToViewRange(range);
      viewModel.revealRange(args.source, false, viewRange, revealAt, ScrollType.Smooth);
    }
  }());
  CoreNavigationCommands2.SelectAll = new class extends EditorOrNativeTextInputCommand {
    constructor() {
      super(SelectAllCommand);
    }
    runDOMCommand(activeElement) {
      if (isFirefox) {
        activeElement.focus();
        activeElement.select();
      }
      activeElement.ownerDocument.execCommand("selectAll");
    }
    runEditorCommand(accessor, editor, args) {
      const viewModel = editor._getViewModel();
      if (!viewModel) {
        return;
      }
      this.runCoreEditorCommand(viewModel, args);
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        "keyboard",
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.selectAll(viewModel, viewModel.getPrimaryCursorState())
        ]
      );
    }
  }();
  CoreNavigationCommands2.SetSelection = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "setSelection",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.selection) {
        return;
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorState.fromModelSelection(args.selection)
        ]
      );
    }
  }());
})(CoreNavigationCommands || (CoreNavigationCommands = {}));
const columnSelectionCondition = ContextKeyExpr.and(
  EditorContextKeys.textInputFocus,
  EditorContextKeys.columnSelection
);
function registerColumnSelection(id, keybinding) {
  KeybindingsRegistry.registerKeybindingRule({
    id,
    primary: keybinding,
    when: columnSelectionCondition,
    weight: CORE_WEIGHT + 1
  });
}
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectLeft.id, KeyMod.Shift | KeyCode.LeftArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectRight.id, KeyMod.Shift | KeyCode.RightArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectUp.id, KeyMod.Shift | KeyCode.UpArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectPageUp.id, KeyMod.Shift | KeyCode.PageUp);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectDown.id, KeyMod.Shift | KeyCode.DownArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectPageDown.id, KeyMod.Shift | KeyCode.PageDown);
function registerCommand(command) {
  command.register();
  return command;
}
var CoreEditingCommands;
((CoreEditingCommands2) => {
  class CoreEditingCommand extends EditorCommand {
    runEditorCommand(accessor, editor, args) {
      const viewModel = editor._getViewModel();
      if (!viewModel) {
        return;
      }
      this.runCoreEditingCommand(editor, viewModel, args || {});
    }
  }
  CoreEditingCommands2.CoreEditingCommand = CoreEditingCommand;
  CoreEditingCommands2.LineBreakInsert = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "lineBreakInsert",
        precondition: EditorContextKeys.writable,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: 0,
          mac: { primary: KeyMod.WinCtrl | KeyCode.KeyO }
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      editor.pushUndoStop();
      editor.executeCommands(this.id, EnterOperation.lineBreakInsert(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection)));
    }
  }());
  CoreEditingCommands2.Outdent = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "outdent",
        precondition: EditorContextKeys.writable,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: ContextKeyExpr.and(
            EditorContextKeys.editorTextFocus,
            EditorContextKeys.tabDoesNotMoveFocus
          ),
          primary: KeyMod.Shift | KeyCode.Tab
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      editor.pushUndoStop();
      editor.executeCommands(this.id, TypeOperations.outdent(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection)));
      editor.pushUndoStop();
    }
  }());
  CoreEditingCommands2.Tab = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "tab",
        precondition: EditorContextKeys.writable,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: ContextKeyExpr.and(
            EditorContextKeys.editorTextFocus,
            EditorContextKeys.tabDoesNotMoveFocus
          ),
          primary: KeyCode.Tab
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      editor.pushUndoStop();
      editor.executeCommands(this.id, TypeOperations.tab(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection)));
      editor.pushUndoStop();
    }
  }());
  CoreEditingCommands2.DeleteLeft = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "deleteLeft",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Backspace,
          secondary: [KeyMod.Shift | KeyCode.Backspace],
          mac: { primary: KeyCode.Backspace, secondary: [KeyMod.Shift | KeyCode.Backspace, KeyMod.WinCtrl | KeyCode.KeyH, KeyMod.WinCtrl | KeyCode.Backspace] }
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteLeft(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection), viewModel.getCursorAutoClosedCharacters());
      if (shouldPushStackElementBefore) {
        editor.pushUndoStop();
      }
      editor.executeCommands(this.id, commands);
      viewModel.setPrevEditOperationType(EditOperationType.DeletingLeft);
    }
  }());
  CoreEditingCommands2.DeleteRight = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "deleteRight",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Delete,
          mac: { primary: KeyCode.Delete, secondary: [KeyMod.WinCtrl | KeyCode.KeyD, KeyMod.WinCtrl | KeyCode.Delete] }
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteRight(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection));
      if (shouldPushStackElementBefore) {
        editor.pushUndoStop();
      }
      editor.executeCommands(this.id, commands);
      viewModel.setPrevEditOperationType(EditOperationType.DeletingRight);
    }
  }());
  CoreEditingCommands2.Undo = new class extends EditorOrNativeTextInputCommand {
    constructor() {
      super(UndoCommand);
    }
    runDOMCommand(activeElement) {
      activeElement.ownerDocument.execCommand("undo");
    }
    runEditorCommand(accessor, editor, args) {
      if (!editor.hasModel() || editor.getOption(EditorOption.readOnly) === true) {
        return;
      }
      return editor.getModel().undo();
    }
  }();
  CoreEditingCommands2.Redo = new class extends EditorOrNativeTextInputCommand {
    constructor() {
      super(RedoCommand);
    }
    runDOMCommand(activeElement) {
      activeElement.ownerDocument.execCommand("redo");
    }
    runEditorCommand(accessor, editor, args) {
      if (!editor.hasModel() || editor.getOption(EditorOption.readOnly) === true) {
        return;
      }
      return editor.getModel().redo();
    }
  }();
})(CoreEditingCommands || (CoreEditingCommands = {}));
class EditorHandlerCommand extends Command {
  constructor(id, handlerId, metadata) {
    super({
      id,
      precondition: void 0,
      metadata
    });
    this._handlerId = handlerId;
  }
  runCommand(accessor, args) {
    const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (!editor) {
      return;
    }
    editor.trigger("keyboard", this._handlerId, args);
  }
}
function registerOverwritableCommand(handlerId, metadata) {
  registerCommand(new EditorHandlerCommand("default:" + handlerId, handlerId));
  registerCommand(new EditorHandlerCommand(handlerId, handlerId, metadata));
}
registerOverwritableCommand(Handler.Type, {
  description: `Type`,
  args: [{
    name: "args",
    schema: {
      "type": "object",
      "required": ["text"],
      "properties": {
        "text": {
          "type": "string"
        }
      }
    }
  }]
});
registerOverwritableCommand(Handler.ReplacePreviousChar);
registerOverwritableCommand(Handler.CompositionType);
registerOverwritableCommand(Handler.CompositionStart);
registerOverwritableCommand(Handler.CompositionEnd);
registerOverwritableCommand(Handler.Paste);
registerOverwritableCommand(Handler.Cut);
export {
  CoreEditingCommands,
  CoreEditorCommand,
  CoreNavigationCommands,
  EditorScroll_,
  NavigationCommandRevealType,
  RevealLine_
};
