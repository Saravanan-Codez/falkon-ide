import { URI } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const VIEWLET_ID = "workbench.view.debug";
const VARIABLES_VIEW_ID = "workbench.debug.variablesView";
const WATCH_VIEW_ID = "workbench.debug.watchExpressionsView";
const CALLSTACK_VIEW_ID = "workbench.debug.callStackView";
const LOADED_SCRIPTS_VIEW_ID = "workbench.debug.loadedScriptsView";
const BREAKPOINTS_VIEW_ID = "workbench.debug.breakPointsView";
const DISASSEMBLY_VIEW_ID = "workbench.debug.disassemblyView";
const DEBUG_PANEL_ID = "workbench.panel.repl";
const REPL_VIEW_ID = "workbench.panel.repl.view";
const CONTEXT_DEBUG_TYPE = new RawContextKey("debugType", void 0, { type: "string", description: nls.localize("debugType", "Debug type of the active debug session. For example 'python'.") });
const CONTEXT_DEBUG_CONFIGURATION_TYPE = new RawContextKey("debugConfigurationType", void 0, { type: "string", description: nls.localize("debugConfigurationType", "Debug type of the selected launch configuration. For example 'python'.") });
const CONTEXT_DEBUG_STATE = new RawContextKey("debugState", "inactive", { type: "string", description: nls.localize("debugState", "State that the focused debug session is in. One of the following: 'inactive', 'initializing', 'stopped' or 'running'.") });
const CONTEXT_DEBUG_UX_KEY = "debugUx";
const CONTEXT_DEBUG_UX = new RawContextKey(CONTEXT_DEBUG_UX_KEY, "default", { type: "string", description: nls.localize("debugUX", "Debug UX state. When there are no debug configurations it is 'simple', otherwise 'default'. Used to decide when to show welcome views in the debug viewlet.") });
const CONTEXT_HAS_DEBUGGED = new RawContextKey("hasDebugged", false, { type: "boolean", description: nls.localize("hasDebugged", "True when a debug session has been started at least once, false otherwise.") });
const CONTEXT_IN_DEBUG_MODE = new RawContextKey("inDebugMode", false, { type: "boolean", description: nls.localize("inDebugMode", "True when debugging, false otherwise.") });
const CONTEXT_IN_DEBUG_REPL = new RawContextKey("inDebugRepl", false, { type: "boolean", description: nls.localize("inDebugRepl", "True when focus is in the debug console, false otherwise.") });
const CONTEXT_BREAKPOINT_WIDGET_VISIBLE = new RawContextKey("breakpointWidgetVisible", false, { type: "boolean", description: nls.localize("breakpointWidgetVisibile", "True when breakpoint editor zone widget is visible, false otherwise.") });
const CONTEXT_IN_BREAKPOINT_WIDGET = new RawContextKey("inBreakpointWidget", false, { type: "boolean", description: nls.localize("inBreakpointWidget", "True when focus is in the breakpoint editor zone widget, false otherwise.") });
const CONTEXT_BREAKPOINTS_FOCUSED = new RawContextKey("breakpointsFocused", true, { type: "boolean", description: nls.localize("breakpointsFocused", "True when the BREAKPOINTS view is focused, false otherwise.") });
const CONTEXT_WATCH_EXPRESSIONS_FOCUSED = new RawContextKey("watchExpressionsFocused", true, { type: "boolean", description: nls.localize("watchExpressionsFocused", "True when the WATCH view is focused, false otherwise.") });
const CONTEXT_WATCH_EXPRESSIONS_EXIST = new RawContextKey("watchExpressionsExist", false, { type: "boolean", description: nls.localize("watchExpressionsExist", "True when at least one watch expression exists, false otherwise.") });
const CONTEXT_VARIABLES_FOCUSED = new RawContextKey("variablesFocused", true, { type: "boolean", description: nls.localize("variablesFocused", "True when the VARIABLES views is focused, false otherwise") });
const CONTEXT_EXPRESSION_SELECTED = new RawContextKey("expressionSelected", false, { type: "boolean", description: nls.localize("expressionSelected", "True when an expression input box is open in either the WATCH or the VARIABLES view, false otherwise.") });
const CONTEXT_BREAKPOINT_INPUT_FOCUSED = new RawContextKey("breakpointInputFocused", false, { type: "boolean", description: nls.localize("breakpointInputFocused", "True when the input box has focus in the BREAKPOINTS view.") });
const CONTEXT_CALLSTACK_ITEM_TYPE = new RawContextKey("callStackItemType", void 0, { type: "string", description: nls.localize("callStackItemType", "Represents the item type of the focused element in the CALL STACK view. For example: 'session', 'thread', 'stackFrame'") });
const CONTEXT_CALLSTACK_SESSION_IS_ATTACH = new RawContextKey("callStackSessionIsAttach", false, { type: "boolean", description: nls.localize("callStackSessionIsAttach", "True when the session in the CALL STACK view is attach, false otherwise. Used internally for inline menus in the CALL STACK view.") });
const CONTEXT_CALLSTACK_ITEM_STOPPED = new RawContextKey("callStackItemStopped", false, { type: "boolean", description: nls.localize("callStackItemStopped", "True when the focused item in the CALL STACK is stopped. Used internally for inline menus in the CALL STACK view.") });
const CONTEXT_CALLSTACK_SESSION_HAS_ONE_THREAD = new RawContextKey("callStackSessionHasOneThread", false, { type: "boolean", description: nls.localize("callStackSessionHasOneThread", "True when the focused session in the CALL STACK view has exactly one thread. Used internally for inline menus in the CALL STACK view.") });
const CONTEXT_CALLSTACK_FOCUSED = new RawContextKey("callStackFocused", true, { type: "boolean", description: nls.localize("callStackFocused", "True when the CALLSTACK view is focused, false otherwise.") });
const CONTEXT_WATCH_ITEM_TYPE = new RawContextKey("watchItemType", void 0, { type: "string", description: nls.localize("watchItemType", "Represents the item type of the focused element in the WATCH view. For example: 'expression', 'variable'") });
const CONTEXT_CAN_VIEW_MEMORY = new RawContextKey("canViewMemory", void 0, { type: "boolean", description: nls.localize("canViewMemory", "Indicates whether the item in the view has an associated memory reference.") });
const CONTEXT_BREAKPOINT_ITEM_TYPE = new RawContextKey("breakpointItemType", void 0, { type: "string", description: nls.localize("breakpointItemType", "Represents the item type of the focused element in the BREAKPOINTS view. For example: 'breakpoint', 'exceptionBreakpoint', 'functionBreakpoint', 'dataBreakpoint'") });
const CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES = new RawContextKey("breakpointItemBytes", void 0, { type: "boolean", description: nls.localize("breakpointItemIsDataBytes", "Whether the breakpoint item is a data breakpoint on a byte range.") });
const CONTEXT_BREAKPOINT_HAS_MODES = new RawContextKey("breakpointHasModes", false, { type: "boolean", description: nls.localize("breakpointHasModes", "Whether the breakpoint has multiple modes it can switch to.") });
const CONTEXT_BREAKPOINT_SUPPORTS_CONDITION = new RawContextKey("breakpointSupportsCondition", false, { type: "boolean", description: nls.localize("breakpointSupportsCondition", "True when the focused breakpoint supports conditions.") });
const CONTEXT_LOADED_SCRIPTS_SUPPORTED = new RawContextKey("loadedScriptsSupported", false, { type: "boolean", description: nls.localize("loadedScriptsSupported", "True when the focused sessions supports the LOADED SCRIPTS view") });
const CONTEXT_LOADED_SCRIPTS_ITEM_TYPE = new RawContextKey("loadedScriptsItemType", void 0, { type: "string", description: nls.localize("loadedScriptsItemType", "Represents the item type of the focused element in the LOADED SCRIPTS view.") });
const CONTEXT_FOCUSED_SESSION_IS_ATTACH = new RawContextKey("focusedSessionIsAttach", false, { type: "boolean", description: nls.localize("focusedSessionIsAttach", "True when the focused session is 'attach'.") });
const CONTEXT_FOCUSED_SESSION_IS_NO_DEBUG = new RawContextKey("focusedSessionIsNoDebug", false, { type: "boolean", description: nls.localize("focusedSessionIsNoDebug", "True when the focused session is run without debugging.") });
const CONTEXT_STEP_BACK_SUPPORTED = new RawContextKey("stepBackSupported", false, { type: "boolean", description: nls.localize("stepBackSupported", "True when the focused session supports 'stepBack' requests.") });
const CONTEXT_RESTART_FRAME_SUPPORTED = new RawContextKey("restartFrameSupported", false, { type: "boolean", description: nls.localize("restartFrameSupported", "True when the focused session supports 'restartFrame' requests.") });
const CONTEXT_STACK_FRAME_SUPPORTS_RESTART = new RawContextKey("stackFrameSupportsRestart", false, { type: "boolean", description: nls.localize("stackFrameSupportsRestart", "True when the focused stack frame supports 'restartFrame'.") });
const CONTEXT_JUMP_TO_CURSOR_SUPPORTED = new RawContextKey("jumpToCursorSupported", false, { type: "boolean", description: nls.localize("jumpToCursorSupported", "True when the focused session supports 'jumpToCursor' request.") });
const CONTEXT_STEP_INTO_TARGETS_SUPPORTED = new RawContextKey("stepIntoTargetsSupported", false, { type: "boolean", description: nls.localize("stepIntoTargetsSupported", "True when the focused session supports 'stepIntoTargets' request.") });
const CONTEXT_BREAKPOINTS_EXIST = new RawContextKey("breakpointsExist", false, { type: "boolean", description: nls.localize("breakpointsExist", "True when at least one breakpoint exists.") });
const CONTEXT_DEBUGGERS_AVAILABLE = new RawContextKey("debuggersAvailable", false, { type: "boolean", description: nls.localize("debuggersAvailable", "True when there is at least one debug extensions active.") });
const CONTEXT_DEBUG_EXTENSION_AVAILABLE = new RawContextKey("debugExtensionAvailable", true, { type: "boolean", description: nls.localize("debugExtensionsAvailable", "True when there is at least one debug extension installed and enabled.") });
const CONTEXT_DEBUG_PROTOCOL_VARIABLE_MENU_CONTEXT = new RawContextKey("debugProtocolVariableMenuContext", void 0, { type: "string", description: nls.localize("debugProtocolVariableMenuContext", "Represents the context the debug adapter sets on the focused variable in the VARIABLES view.") });
const CONTEXT_SET_VARIABLE_SUPPORTED = new RawContextKey("debugSetVariableSupported", false, { type: "boolean", description: nls.localize("debugSetVariableSupported", "True when the focused session supports 'setVariable' request.") });
const CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED = new RawContextKey("debugSetDataBreakpointAddressSupported", false, { type: "boolean", description: nls.localize("debugSetDataBreakpointAddressSupported", "True when the focused session supports 'getBreakpointInfo' request on an address.") });
const CONTEXT_SET_EXPRESSION_SUPPORTED = new RawContextKey("debugSetExpressionSupported", false, { type: "boolean", description: nls.localize("debugSetExpressionSupported", "True when the focused session supports 'setExpression' request.") });
const CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED = new RawContextKey("breakWhenValueChangesSupported", false, { type: "boolean", description: nls.localize("breakWhenValueChangesSupported", "True when the focused session supports to break when value changes.") });
const CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED = new RawContextKey("breakWhenValueIsAccessedSupported", false, { type: "boolean", description: nls.localize("breakWhenValueIsAccessedSupported", "True when the focused breakpoint supports to break when value is accessed.") });
const CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED = new RawContextKey("breakWhenValueIsReadSupported", false, { type: "boolean", description: nls.localize("breakWhenValueIsReadSupported", "True when the focused breakpoint supports to break when value is read.") });
const CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED = new RawContextKey("terminateDebuggeeSupported", false, { type: "boolean", description: nls.localize("terminateDebuggeeSupported", "True when the focused session supports the terminate debuggee capability.") });
const CONTEXT_SUSPEND_DEBUGGEE_SUPPORTED = new RawContextKey("suspendDebuggeeSupported", false, { type: "boolean", description: nls.localize("suspendDebuggeeSupported", "True when the focused session supports the suspend debuggee capability.") });
const CONTEXT_TERMINATE_THREADS_SUPPORTED = new RawContextKey("terminateThreadsSupported", false, { type: "boolean", description: nls.localize("terminateThreadsSupported", "True when the focused session supports the terminate threads capability.") });
const CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT = new RawContextKey("variableEvaluateNamePresent", false, { type: "boolean", description: nls.localize("variableEvaluateNamePresent", "True when the focused variable has an 'evaluateName' field set.") });
const CONTEXT_VARIABLE_IS_READONLY = new RawContextKey("variableIsReadonly", false, { type: "boolean", description: nls.localize("variableIsReadonly", "True when the focused variable is read-only.") });
const CONTEXT_VARIABLE_VALUE = new RawContextKey("variableValue", false, { type: "string", description: nls.localize("variableValue", "Value of the variable, present for debug visualization clauses.") });
const CONTEXT_VARIABLE_TYPE = new RawContextKey("variableType", false, { type: "string", description: nls.localize("variableType", "Type of the variable, present for debug visualization clauses.") });
const CONTEXT_VARIABLE_INTERFACES = new RawContextKey("variableInterfaces", false, { type: "array", description: nls.localize("variableInterfaces", "Any interfaces or contracts that the variable satisfies, present for debug visualization clauses.") });
const CONTEXT_VARIABLE_NAME = new RawContextKey("variableName", false, { type: "string", description: nls.localize("variableName", "Name of the variable, present for debug visualization clauses.") });
const CONTEXT_VARIABLE_LANGUAGE = new RawContextKey("variableLanguage", false, { type: "string", description: nls.localize("variableLanguage", "Language of the variable source, present for debug visualization clauses.") });
const CONTEXT_VARIABLE_EXTENSIONID = new RawContextKey("variableExtensionId", false, { type: "string", description: nls.localize("variableExtensionId", "Extension ID of the variable source, present for debug visualization clauses.") });
const CONTEXT_EXCEPTION_WIDGET_VISIBLE = new RawContextKey("exceptionWidgetVisible", false, { type: "boolean", description: nls.localize("exceptionWidgetVisible", "True when the exception widget is visible.") });
const CONTEXT_MULTI_SESSION_REPL = new RawContextKey("multiSessionRepl", false, { type: "boolean", description: nls.localize("multiSessionRepl", "True when there is more than 1 debug console.") });
const CONTEXT_MULTI_SESSION_DEBUG = new RawContextKey("multiSessionDebug", false, { type: "boolean", description: nls.localize("multiSessionDebug", "True when there is more than 1 active debug session.") });
const CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED = new RawContextKey("disassembleRequestSupported", false, { type: "boolean", description: nls.localize("disassembleRequestSupported", "True when the focused sessions supports disassemble request.") });
const CONTEXT_DISASSEMBLY_VIEW_FOCUS = new RawContextKey("disassemblyViewFocus", false, { type: "boolean", description: nls.localize("disassemblyViewFocus", "True when the Disassembly View is focused.") });
const CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST = new RawContextKey("languageSupportsDisassembleRequest", false, { type: "boolean", description: nls.localize("languageSupportsDisassembleRequest", "True when the language in the current editor supports disassemble request.") });
const CONTEXT_FOCUSED_STACK_FRAME_HAS_INSTRUCTION_POINTER_REFERENCE = new RawContextKey("focusedStackFrameHasInstructionReference", false, { type: "boolean", description: nls.localize("focusedStackFrameHasInstructionReference", "True when the focused stack frame has instruction pointer reference.") });
const debuggerDisabledMessage = (debugType) => nls.localize("debuggerDisabled", "Configured debug type '{0}' is installed but not supported in this environment.", debugType);
const EDITOR_CONTRIBUTION_ID = "editor.contrib.debug";
const BREAKPOINT_EDITOR_CONTRIBUTION_ID = "editor.contrib.breakpoint";
const DEBUG_SCHEME = "debug";
const INTERNAL_CONSOLE_OPTIONS_SCHEMA = {
  enum: ["neverOpen", "openOnSessionStart", "openOnFirstSessionStart"],
  default: "openOnFirstSessionStart",
  description: nls.localize("internalConsoleOptions", "Controls when the internal Debug Console should open.")
};
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Inactive"] = 0] = "Inactive";
  State2[State2["Initializing"] = 1] = "Initializing";
  State2[State2["Stopped"] = 2] = "Stopped";
  State2[State2["Running"] = 3] = "Running";
  return State2;
})(State || {});
function getStateLabel(state) {
  switch (state) {
    case 1 /* Initializing */:
      return "initializing";
    case 2 /* Stopped */:
      return "stopped";
    case 3 /* Running */:
      return "running";
    default:
      return "inactive";
  }
}
var MemoryRangeType = /* @__PURE__ */ ((MemoryRangeType2) => {
  MemoryRangeType2[MemoryRangeType2["Valid"] = 0] = "Valid";
  MemoryRangeType2[MemoryRangeType2["Unreadable"] = 1] = "Unreadable";
  MemoryRangeType2[MemoryRangeType2["Error"] = 2] = "Error";
  return MemoryRangeType2;
})(MemoryRangeType || {});
const DEBUG_MEMORY_SCHEME = "vscode-debug-memory";
function isFrameDeemphasized(frame) {
  const hint = frame.presentationHint ?? frame.source.presentationHint;
  return hint === "deemphasize" || hint === "subtle";
}
var DataBreakpointSetType = /* @__PURE__ */ ((DataBreakpointSetType2) => {
  DataBreakpointSetType2[DataBreakpointSetType2["Variable"] = 0] = "Variable";
  DataBreakpointSetType2[DataBreakpointSetType2["Address"] = 1] = "Address";
  return DataBreakpointSetType2;
})(DataBreakpointSetType || {});
function isDebugConfig(thing) {
  return "type" in thing && "request" in thing;
}
var DebugConfigurationProviderTriggerKind = /* @__PURE__ */ ((DebugConfigurationProviderTriggerKind2) => {
  DebugConfigurationProviderTriggerKind2[DebugConfigurationProviderTriggerKind2["Initial"] = 1] = "Initial";
  DebugConfigurationProviderTriggerKind2[DebugConfigurationProviderTriggerKind2["Dynamic"] = 2] = "Dynamic";
  return DebugConfigurationProviderTriggerKind2;
})(DebugConfigurationProviderTriggerKind || {});
var DebuggerString = /* @__PURE__ */ ((DebuggerString2) => {
  DebuggerString2["UnverifiedBreakpoints"] = "unverifiedBreakpoints";
  return DebuggerString2;
})(DebuggerString || {});
const IDebugService = createDecorator("debugService");
var BreakpointWidgetContext = /* @__PURE__ */ ((BreakpointWidgetContext2) => {
  BreakpointWidgetContext2[BreakpointWidgetContext2["CONDITION"] = 0] = "CONDITION";
  BreakpointWidgetContext2[BreakpointWidgetContext2["HIT_COUNT"] = 1] = "HIT_COUNT";
  BreakpointWidgetContext2[BreakpointWidgetContext2["LOG_MESSAGE"] = 2] = "LOG_MESSAGE";
  BreakpointWidgetContext2[BreakpointWidgetContext2["TRIGGER_POINT"] = 3] = "TRIGGER_POINT";
  return BreakpointWidgetContext2;
})(BreakpointWidgetContext || {});
var DebugVisualizationType = /* @__PURE__ */ ((DebugVisualizationType2) => {
  DebugVisualizationType2[DebugVisualizationType2["Command"] = 0] = "Command";
  DebugVisualizationType2[DebugVisualizationType2["Tree"] = 1] = "Tree";
  return DebugVisualizationType2;
})(DebugVisualizationType || {});
var DebugTreeItemCollapsibleState = /* @__PURE__ */ ((DebugTreeItemCollapsibleState2) => {
  DebugTreeItemCollapsibleState2[DebugTreeItemCollapsibleState2["None"] = 0] = "None";
  DebugTreeItemCollapsibleState2[DebugTreeItemCollapsibleState2["Collapsed"] = 1] = "Collapsed";
  DebugTreeItemCollapsibleState2[DebugTreeItemCollapsibleState2["Expanded"] = 2] = "Expanded";
  return DebugTreeItemCollapsibleState2;
})(DebugTreeItemCollapsibleState || {});
var IDebugVisualizationTreeItem;
((IDebugVisualizationTreeItem2) => {
  IDebugVisualizationTreeItem2.deserialize = (v) => v;
  IDebugVisualizationTreeItem2.serialize = (item) => item;
})(IDebugVisualizationTreeItem || (IDebugVisualizationTreeItem = {}));
var IDebugVisualization;
((IDebugVisualization2) => {
  IDebugVisualization2.deserialize = (v) => ({
    id: v.id,
    name: v.name,
    iconPath: v.iconPath && { light: URI.revive(v.iconPath.light), dark: URI.revive(v.iconPath.dark) },
    iconClass: v.iconClass,
    visualization: v.visualization
  });
  IDebugVisualization2.serialize = (visualizer) => visualizer;
})(IDebugVisualization || (IDebugVisualization = {}));
export {
  BREAKPOINTS_VIEW_ID,
  BREAKPOINT_EDITOR_CONTRIBUTION_ID,
  BreakpointWidgetContext,
  CALLSTACK_VIEW_ID,
  CONTEXT_BREAKPOINTS_EXIST,
  CONTEXT_BREAKPOINTS_FOCUSED,
  CONTEXT_BREAKPOINT_HAS_MODES,
  CONTEXT_BREAKPOINT_INPUT_FOCUSED,
  CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES,
  CONTEXT_BREAKPOINT_ITEM_TYPE,
  CONTEXT_BREAKPOINT_SUPPORTS_CONDITION,
  CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
  CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED,
  CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED,
  CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED,
  CONTEXT_CALLSTACK_FOCUSED,
  CONTEXT_CALLSTACK_ITEM_STOPPED,
  CONTEXT_CALLSTACK_ITEM_TYPE,
  CONTEXT_CALLSTACK_SESSION_HAS_ONE_THREAD,
  CONTEXT_CALLSTACK_SESSION_IS_ATTACH,
  CONTEXT_CAN_VIEW_MEMORY,
  CONTEXT_DEBUGGERS_AVAILABLE,
  CONTEXT_DEBUG_CONFIGURATION_TYPE,
  CONTEXT_DEBUG_EXTENSION_AVAILABLE,
  CONTEXT_DEBUG_PROTOCOL_VARIABLE_MENU_CONTEXT,
  CONTEXT_DEBUG_STATE,
  CONTEXT_DEBUG_TYPE,
  CONTEXT_DEBUG_UX,
  CONTEXT_DEBUG_UX_KEY,
  CONTEXT_DISASSEMBLE_REQUEST_SUPPORTED,
  CONTEXT_DISASSEMBLY_VIEW_FOCUS,
  CONTEXT_EXCEPTION_WIDGET_VISIBLE,
  CONTEXT_EXPRESSION_SELECTED,
  CONTEXT_FOCUSED_SESSION_IS_ATTACH,
  CONTEXT_FOCUSED_SESSION_IS_NO_DEBUG,
  CONTEXT_FOCUSED_STACK_FRAME_HAS_INSTRUCTION_POINTER_REFERENCE,
  CONTEXT_HAS_DEBUGGED,
  CONTEXT_IN_BREAKPOINT_WIDGET,
  CONTEXT_IN_DEBUG_MODE,
  CONTEXT_IN_DEBUG_REPL,
  CONTEXT_JUMP_TO_CURSOR_SUPPORTED,
  CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST,
  CONTEXT_LOADED_SCRIPTS_ITEM_TYPE,
  CONTEXT_LOADED_SCRIPTS_SUPPORTED,
  CONTEXT_MULTI_SESSION_DEBUG,
  CONTEXT_MULTI_SESSION_REPL,
  CONTEXT_RESTART_FRAME_SUPPORTED,
  CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED,
  CONTEXT_SET_EXPRESSION_SUPPORTED,
  CONTEXT_SET_VARIABLE_SUPPORTED,
  CONTEXT_STACK_FRAME_SUPPORTS_RESTART,
  CONTEXT_STEP_BACK_SUPPORTED,
  CONTEXT_STEP_INTO_TARGETS_SUPPORTED,
  CONTEXT_SUSPEND_DEBUGGEE_SUPPORTED,
  CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED,
  CONTEXT_TERMINATE_THREADS_SUPPORTED,
  CONTEXT_VARIABLES_FOCUSED,
  CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT,
  CONTEXT_VARIABLE_EXTENSIONID,
  CONTEXT_VARIABLE_INTERFACES,
  CONTEXT_VARIABLE_IS_READONLY,
  CONTEXT_VARIABLE_LANGUAGE,
  CONTEXT_VARIABLE_NAME,
  CONTEXT_VARIABLE_TYPE,
  CONTEXT_VARIABLE_VALUE,
  CONTEXT_WATCH_EXPRESSIONS_EXIST,
  CONTEXT_WATCH_EXPRESSIONS_FOCUSED,
  CONTEXT_WATCH_ITEM_TYPE,
  DEBUG_MEMORY_SCHEME,
  DEBUG_PANEL_ID,
  DEBUG_SCHEME,
  DISASSEMBLY_VIEW_ID,
  DataBreakpointSetType,
  DebugConfigurationProviderTriggerKind,
  DebugTreeItemCollapsibleState,
  DebugVisualizationType,
  DebuggerString,
  EDITOR_CONTRIBUTION_ID,
  IDebugService,
  IDebugVisualization,
  IDebugVisualizationTreeItem,
  INTERNAL_CONSOLE_OPTIONS_SCHEMA,
  LOADED_SCRIPTS_VIEW_ID,
  MemoryRangeType,
  REPL_VIEW_ID,
  State,
  VARIABLES_VIEW_ID,
  VIEWLET_ID,
  WATCH_VIEW_ID,
  debuggerDisabledMessage,
  getStateLabel,
  isDebugConfig,
  isFrameDeemphasized
};
