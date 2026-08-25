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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, debouncedObservable, derived, ObservablePromise, observableValue } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Range } from "../../../../editor/common/core/range.js";
import { localize } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { IChatContextPickService } from "../../chat/browser/attachments/chatContextPickService.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
import { IDebugService, State } from "../common/debug.js";
import { Variable } from "../common/debugModel.js";
var PickerMode = /* @__PURE__ */ ((PickerMode2) => {
  PickerMode2["Main"] = "main";
  PickerMode2["Expression"] = "expression";
  return PickerMode2;
})(PickerMode || {});
let DebugSessionContextPick = class {
  constructor(debugService) {
    this.debugService = debugService;
    this.type = "pickerPick";
    this.label = localize("chatContext.debugSession", "Debug Session...");
    this.icon = Codicon.debug;
    this.ordinal = -200;
  }
  isEnabled() {
    const viewModel = this.debugService.getViewModel();
    const focusedSession = viewModel.focusedSession;
    return !!focusedSession && focusedSession.state === State.Stopped;
  }
  asPicker(_widget) {
    const store = new DisposableStore();
    const mode = observableValue("debugPicker.mode", "main" /* Main */);
    const query = observableValue("debugPicker.query", "");
    const picksObservable = this.createPicksObservable(mode, query, store);
    return {
      placeholder: localize("selectDebugData", "Select debug data to attach"),
      picks: (_queryObs, token) => {
        store.add(autorun((reader) => {
          query.set(_queryObs.read(reader), void 0);
        }));
        const cts = new CancellationTokenSource(token);
        store.add(toDisposable(() => cts.dispose(true)));
        return picksObservable;
      },
      goBack: () => {
        if (mode.get() === "expression" /* Expression */) {
          mode.set("main" /* Main */, void 0);
          return true;
        }
        return false;
      },
      dispose: () => store.dispose()
    };
  }
  createPicksObservable(mode, query, store) {
    const debouncedQuery = debouncedObservable(query, 300);
    return derived((reader) => {
      const currentMode = mode.read(reader);
      if (currentMode === "expression" /* Expression */) {
        return this.getExpressionPicks(debouncedQuery, store);
      } else {
        return this.getMainPicks(mode);
      }
    }).flatten();
  }
  getMainPicks(mode) {
    const promise = derived((_reader) => {
      return new ObservablePromise(this.buildMainPicks(mode));
    });
    return promise.map((value, reader) => {
      const result = value.promiseResult.read(reader);
      return { picks: result?.data || [], busy: result === void 0 };
    });
  }
  async buildMainPicks(mode) {
    const picks = [];
    const viewModel = this.debugService.getViewModel();
    const stackFrame = viewModel.focusedStackFrame;
    const session = viewModel.focusedSession;
    if (!session || !stackFrame) {
      return picks;
    }
    picks.push({
      label: localize("expressionValue", "Expression Value..."),
      iconClass: ThemeIcon.asClassName(Codicon.symbolVariable),
      asAttachment: () => {
        mode.set("expression" /* Expression */, void 0);
        return "noop";
      }
    });
    const watches = this.debugService.getModel().getWatchExpressions();
    if (watches.length > 0) {
      picks.push({ type: "separator", label: localize("watchExpressions", "Watch Expressions") });
      for (const watch of watches) {
        picks.push({
          label: watch.name,
          description: watch.value,
          iconClass: ThemeIcon.asClassName(Codicon.eye),
          asAttachment: () => createDebugAttachments(stackFrame, createDebugVariableEntry(watch))
        });
      }
    }
    let scopes = [];
    try {
      scopes = await stackFrame.getScopes();
    } catch {
    }
    for (const scope of scopes) {
      if (scope.expensive && !scope.childrenHaveBeenLoaded) {
        continue;
      }
      picks.push({ type: "separator", label: scope.name });
      try {
        const variables = await scope.getChildren();
        if (variables.length > 1) {
          picks.push({
            label: localize("allVariablesInScope", "All variables in {0}", scope.name),
            iconClass: ThemeIcon.asClassName(Codicon.symbolNamespace),
            asAttachment: () => createDebugAttachments(stackFrame, createScopeEntry(scope, variables))
          });
        }
        for (const variable of variables) {
          picks.push({
            label: variable.name,
            description: formatVariableDescription(variable),
            iconClass: ThemeIcon.asClassName(Codicon.symbolVariable),
            asAttachment: () => createDebugAttachments(stackFrame, createDebugVariableEntry(variable))
          });
        }
      } catch {
      }
    }
    return picks;
  }
  getExpressionPicks(query, _store) {
    const promise = derived((reader) => {
      const queryValue = query.read(reader);
      const cts = new CancellationTokenSource();
      reader.store.add(toDisposable(() => cts.dispose(true)));
      return new ObservablePromise(this.evaluateExpression(queryValue, cts.token));
    });
    return promise.map((value, r) => {
      const result = value.promiseResult.read(r);
      return { picks: result?.data || [], busy: result === void 0 };
    });
  }
  async evaluateExpression(expression, token) {
    if (!expression.trim()) {
      return [{
        label: localize("typeExpression", "Type an expression to evaluate..."),
        disabled: true,
        asAttachment: () => "noop"
      }];
    }
    const viewModel = this.debugService.getViewModel();
    const session = viewModel.focusedSession;
    const stackFrame = viewModel.focusedStackFrame;
    if (!session || !stackFrame) {
      return [{
        label: localize("noDebugSession", "No active debug session"),
        disabled: true,
        asAttachment: () => "noop"
      }];
    }
    try {
      const response = await session.evaluate(expression, stackFrame.frameId, "watch");
      if (token.isCancellationRequested) {
        return [];
      }
      if (response?.body) {
        const resultValue = response.body.result;
        const resultType = response.body.type;
        return [{
          label: expression,
          description: formatExpressionResult(resultValue, resultType),
          iconClass: ThemeIcon.asClassName(Codicon.symbolVariable),
          asAttachment: () => createDebugAttachments(stackFrame, {
            kind: "debugVariable",
            id: `debug-expression:${expression}`,
            name: expression,
            fullName: expression,
            icon: Codicon.debug,
            value: resultValue,
            expression,
            type: resultType,
            modelDescription: formatModelDescription(expression, resultValue, resultType)
          })
        }];
      } else {
        return [{
          label: expression,
          description: localize("noResult", "No result"),
          disabled: true,
          asAttachment: () => "noop"
        }];
      }
    } catch (err) {
      return [{
        label: expression,
        description: err instanceof Error ? err.message : localize("evaluationError", "Evaluation error"),
        disabled: true,
        asAttachment: () => "noop"
      }];
    }
  }
};
DebugSessionContextPick = __decorateClass([
  __decorateParam(0, IDebugService)
], DebugSessionContextPick);
function createDebugVariableEntry(expression) {
  return {
    kind: "debugVariable",
    id: `debug-variable:${expression.getId()}`,
    name: expression.name,
    fullName: expression.name,
    icon: Codicon.debug,
    value: expression.value,
    expression: expression.name,
    type: expression.type,
    modelDescription: formatModelDescription(expression.name, expression.value, expression.type)
  };
}
function createPausedLocationEntry(stackFrame) {
  const uri = stackFrame.source.uri;
  let range = Range.lift(stackFrame.range);
  if (range.isEmpty()) {
    range = range.setEndPosition(range.startLineNumber + 1, 1);
  }
  return {
    kind: "file",
    value: { uri, range },
    id: `debug-paused-location:${uri.toString()}:${range.startLineNumber}`,
    name: basename(uri),
    modelDescription: "The debugger is currently paused at this location"
  };
}
function createDebugAttachments(stackFrame, variableEntry) {
  return [
    createPausedLocationEntry(stackFrame),
    variableEntry
  ];
}
function createScopeEntry(scope, variables) {
  const variablesSummary = variables.map((v) => `${v.name}: ${v.value}`).join("\n");
  return {
    kind: "debugVariable",
    id: `debug-scope:${scope.name}`,
    name: `Scope: ${scope.name}`,
    fullName: `Scope: ${scope.name}`,
    icon: Codicon.debug,
    value: variablesSummary,
    expression: scope.name,
    type: "scope",
    modelDescription: `Debug scope "${scope.name}" with ${variables.length} variables:
${variablesSummary}`
  };
}
function formatVariableDescription(expression) {
  const value = expression.value;
  const type = expression.type;
  if (type && value) {
    return `${type}: ${value}`;
  }
  return value || type || "";
}
function formatExpressionResult(value, type) {
  if (type && value) {
    return `${type}: ${value}`;
  }
  return value || type || "";
}
function formatModelDescription(name, value, type) {
  let description = `Debug variable "${name}"`;
  if (type) {
    description += ` of type ${type}`;
  }
  description += ` with value: ${value}`;
  return description;
}
let DebugChatContextContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.chat.debugChatContextContribution";
  }
  constructor(contextPickService, instantiationService) {
    super();
    this._register(contextPickService.registerChatContextItem(instantiationService.createInstance(DebugSessionContextPick)));
  }
};
DebugChatContextContribution = __decorateClass([
  __decorateParam(0, IChatContextPickService),
  __decorateParam(1, IInstantiationService)
], DebugChatContextContribution);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.action.addVariableToChat",
      title: localize("addToChat", "Add to Chat"),
      f1: false,
      menu: {
        id: MenuId.DebugVariablesContext,
        group: "z_commands",
        order: 110,
        when: ChatContextKeys.enabled
      }
    });
  }
  async run(accessor, context) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const debugService = accessor.get(IDebugService);
    const widget = await chatWidgetService.revealWidget();
    if (!widget) {
      return;
    }
    const entry = createDebugVariableEntryFromContext(context);
    if (entry) {
      const stackFrame = debugService.getViewModel().focusedStackFrame;
      if (stackFrame) {
        widget.attachmentModel.addContext(createPausedLocationEntry(stackFrame));
      }
      widget.attachmentModel.addContext(entry);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.action.addWatchExpressionToChat",
      title: localize("addToChat", "Add to Chat"),
      f1: false,
      menu: {
        id: MenuId.DebugWatchContext,
        group: "z_commands",
        order: 110,
        when: ChatContextKeys.enabled
      }
    });
  }
  async run(accessor, context) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const debugService = accessor.get(IDebugService);
    const widget = await chatWidgetService.revealWidget();
    if (!context || !widget) {
      return;
    }
    const stackFrame = debugService.getViewModel().focusedStackFrame;
    if (stackFrame) {
      widget.attachmentModel.addContext(createPausedLocationEntry(stackFrame));
    }
    widget.attachmentModel.addContext(createDebugVariableEntry(context));
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.action.addScopeToChat",
      title: localize("addToChat", "Add to Chat"),
      f1: false,
      menu: {
        id: MenuId.DebugScopesContext,
        group: "z_commands",
        order: 1,
        when: ChatContextKeys.enabled
      }
    });
  }
  async run(accessor, context) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const debugService = accessor.get(IDebugService);
    const widget = await chatWidgetService.revealWidget();
    if (!context || !widget) {
      return;
    }
    const viewModel = debugService.getViewModel();
    const stackFrame = viewModel.focusedStackFrame;
    if (!stackFrame) {
      return;
    }
    try {
      const scopes = await stackFrame.getScopes();
      const scope = scopes.find((s) => s.name === context.scope.name);
      if (scope) {
        const variables = await scope.getChildren();
        widget.attachmentModel.addContext(createPausedLocationEntry(stackFrame));
        widget.attachmentModel.addContext(createScopeEntry(scope, variables));
      }
    } catch {
    }
  }
});
function isVariablesContext(context) {
  return typeof context === "object" && context !== null && "variable" in context && "sessionId" in context;
}
function createDebugVariableEntryFromContext(context) {
  if (context instanceof Variable) {
    return createDebugVariableEntry(context);
  }
  if (isVariablesContext(context)) {
    const variable = context.variable;
    return {
      kind: "debugVariable",
      id: `debug-variable:${variable.name}`,
      name: variable.name,
      fullName: variable.evaluateName ?? variable.name,
      icon: Codicon.debug,
      value: variable.value,
      expression: variable.evaluateName ?? variable.name,
      type: variable.type,
      modelDescription: formatModelDescription(variable.evaluateName || variable.name, variable.value, variable.type)
    };
  }
  return void 0;
}
export {
  DebugChatContextContribution
};
