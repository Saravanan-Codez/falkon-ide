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
import { ListDragOverEffectPosition, ListDragOverEffectType } from "../../../../base/browser/ui/list/list.js";
import { ElementsDragAndDropData, ListViewTargetSector } from "../../../../base/browser/ui/list/listView.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { localize } from "../../../../nls.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { CONTEXT_CAN_VIEW_MEMORY, CONTEXT_EXPRESSION_SELECTED, CONTEXT_VARIABLE_IS_READONLY, CONTEXT_VARIABLE_TYPE, CONTEXT_WATCH_EXPRESSIONS_EXIST, CONTEXT_WATCH_EXPRESSIONS_FOCUSED, CONTEXT_WATCH_ITEM_TYPE, IDebugService, CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED, CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED, CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED, CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT, WATCH_VIEW_ID, CONTEXT_DEBUG_TYPE } from "../common/debug.js";
import { Expression, Variable, VisualizedExpression } from "../common/debugModel.js";
import { AbstractExpressionDataSource, AbstractExpressionsRenderer, expressionAndScopeLabelProvider, renderViewTree } from "./baseDebugView.js";
import { COPY_WATCH_EXPRESSION_COMMAND_ID, setDataBreakpointInfoResponse } from "./debugCommands.js";
import { DebugExpressionRenderer } from "./debugExpressionRenderer.js";
import { watchExpressionsAdd, watchExpressionsRemoveAll } from "./debugIcons.js";
import { VariablesRenderer, VisualizedVariableRenderer } from "./variablesView.js";
const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
let ignoreViewUpdates = false;
let useCachedEvaluation = false;
let WatchExpressionsView = class extends ViewPane {
  constructor(options, contextMenuService, debugService, keybindingService, instantiationService, viewDescriptorService, configurationService, contextKeyService, openerService, themeService, hoverService, menuService, logService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.debugService = debugService;
    this.menuService = menuService;
    this.logService = logService;
    this.needsRefresh = false;
    this.watchExpressionsUpdatedScheduler = this._register(new RunOnceScheduler(() => {
      this.needsRefresh = false;
      this.tree.updateChildren();
    }, 50));
    this.watchExpressionsExist = CONTEXT_WATCH_EXPRESSIONS_EXIST.bindTo(contextKeyService);
    this.watchExpressionsExist.set(this.debugService.getModel().getWatchExpressions().length > 0);
    this.expressionRenderer = instantiationService.createInstance(DebugExpressionRenderer);
  }
  get treeSelection() {
    return this.tree.getSelection();
  }
  renderBody(container) {
    super.renderBody(container);
    this.element.classList.add("debug-pane");
    container.classList.add("debug-watch");
    const treeContainer = renderViewTree(container);
    const expressionsRenderer = this.instantiationService.createInstance(WatchExpressionsRenderer, this.expressionRenderer);
    this.tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "WatchExpressions",
      treeContainer,
      new WatchExpressionsDelegate(),
      [
        expressionsRenderer,
        this.instantiationService.createInstance(VariablesRenderer, this.expressionRenderer),
        this.instantiationService.createInstance(VisualizedVariableRenderer, this.expressionRenderer)
      ],
      this.instantiationService.createInstance(WatchExpressionsDataSource),
      {
        accessibilityProvider: new WatchExpressionsAccessibilityProvider(),
        identityProvider: { getId: (element) => element.getId() },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (e) => {
            if (e === this.debugService.getViewModel().getSelectedExpression()?.expression) {
              return void 0;
            }
            return expressionAndScopeLabelProvider.getKeyboardNavigationLabel(e);
          }
        },
        dnd: new WatchExpressionsDragAndDrop(this.debugService),
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    this._register(this.tree);
    this.tree.setInput(this.debugService);
    CONTEXT_WATCH_EXPRESSIONS_FOCUSED.bindTo(this.tree.contextKeyService);
    this._register(VisualizedVariableRenderer.rendererOnVisualizationRange(this.debugService.getViewModel(), this.tree));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.tree.onMouseDblClick((e) => this.onMouseDblClick(e)));
    this._register(this.debugService.getModel().onDidChangeWatchExpressions(async (we) => {
      this.watchExpressionsExist.set(this.debugService.getModel().getWatchExpressions().length > 0);
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
      } else {
        if (we && !we.name) {
          useCachedEvaluation = true;
        }
        await this.tree.updateChildren();
        useCachedEvaluation = false;
        if (we instanceof Expression) {
          this.tree.reveal(we);
        }
      }
    }));
    this._register(this.debugService.getViewModel().onDidFocusStackFrame(() => {
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
        return;
      }
      if (!this.watchExpressionsUpdatedScheduler.isScheduled()) {
        this.watchExpressionsUpdatedScheduler.schedule();
      }
    }));
    this._register(this.debugService.getViewModel().onWillUpdateViews(() => {
      if (!ignoreViewUpdates) {
        this.tree.updateChildren();
      }
    }));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible && this.needsRefresh) {
        this.watchExpressionsUpdatedScheduler.schedule();
      }
    }));
    let horizontalScrolling;
    this._register(this.debugService.getViewModel().onDidSelectExpression((e) => {
      const expression = e?.expression;
      if (expression && this.tree.hasNode(expression)) {
        horizontalScrolling = this.tree.options.horizontalScrolling;
        if (horizontalScrolling) {
          this.tree.updateOptions({ horizontalScrolling: false });
        }
        if (expression.name) {
          this.tree.rerender(expression);
        }
      } else if (!expression && horizontalScrolling !== void 0) {
        this.tree.updateOptions({ horizontalScrolling });
        horizontalScrolling = void 0;
      }
    }));
    this._register(this.debugService.getViewModel().onDidEvaluateLazyExpression(async (e) => {
      if (e instanceof Variable && this.tree.hasNode(e)) {
        await this.tree.updateChildren(e, false, true);
        await this.tree.expand(e);
      }
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.layout(height, width);
  }
  focus() {
    super.focus();
    this.tree.domFocus();
  }
  collapseAll() {
    this.tree.collapseAll();
  }
  onMouseDblClick(e) {
    if (e.browserEvent.target.className.indexOf("twistie") >= 0) {
      return;
    }
    const element = e.element;
    const selectedExpression = this.debugService.getViewModel().getSelectedExpression();
    if (element instanceof Expression && element !== selectedExpression?.expression || element instanceof VisualizedExpression && element.treeItem.canEdit) {
      this.debugService.getViewModel().setSelectedExpression(element, false);
    } else if (!element) {
      this.debugService.addWatchExpression();
    }
  }
  async onContextMenu(e) {
    const element = e.element;
    if (!element) {
      return;
    }
    const selection = this.tree.getSelection();
    const contextKeyService = element && await getContextForWatchExpressionMenuWithDataAccess(this.contextKeyService, element, this.debugService, this.logService);
    const menu = this.menuService.getMenuActions(MenuId.DebugWatchContext, contextKeyService, { arg: element, shouldForwardArgs: false });
    const { secondary } = getContextMenuActions(menu, "inline");
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => secondary,
      getActionsContext: () => element && selection.includes(element) ? selection : element ? [element] : []
    });
  }
};
WatchExpressionsView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IDebugService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, ILogService)
], WatchExpressionsView);
class WatchExpressionsDelegate {
  getHeight(_element) {
    return 22;
  }
  getTemplateId(element) {
    if (element instanceof Expression) {
      return WatchExpressionsRenderer.ID;
    }
    if (element instanceof VisualizedExpression) {
      return VisualizedVariableRenderer.ID;
    }
    return VariablesRenderer.ID;
  }
}
function isDebugService(element) {
  return typeof element.getConfigurationManager === "function";
}
class WatchExpressionsDataSource extends AbstractExpressionDataSource {
  hasChildren(element) {
    return isDebugService(element) || element.hasChildren;
  }
  doGetChildren(element) {
    if (isDebugService(element)) {
      const debugService = element;
      const watchExpressions = debugService.getModel().getWatchExpressions();
      const viewModel = debugService.getViewModel();
      return Promise.all(watchExpressions.map((we) => !!we.name && !useCachedEvaluation ? we.evaluate(viewModel.focusedSession, viewModel.focusedStackFrame, "watch").then(() => we) : Promise.resolve(we)));
    }
    return element.getChildren();
  }
}
let WatchExpressionsRenderer = class extends AbstractExpressionsRenderer {
  constructor(expressionRenderer, menuService, contextKeyService, debugService, contextViewService, hoverService, configurationService) {
    super(debugService, contextViewService, hoverService);
    this.expressionRenderer = expressionRenderer;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
  }
  static {
    this.ID = "watchexpression";
  }
  get templateId() {
    return WatchExpressionsRenderer.ID;
  }
  renderElement(node, index, data) {
    data.elementDisposable.clear();
    data.elementDisposable.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.showVariableTypes")) {
        super.renderExpressionElement(node.element, node, data);
      }
    }));
    super.renderExpressionElement(node.element, node, data);
  }
  renderExpression(expression, data, highlights) {
    let text;
    data.type.textContent = "";
    const showType = this.configurationService.getValue("debug").showVariableTypes;
    if (showType && expression.type) {
      text = typeof expression.value === "string" ? `${expression.name}: ` : expression.name;
      data.type.textContent = expression.type + " =";
    } else {
      text = typeof expression.value === "string" ? `${expression.name} =` : expression.name;
    }
    let title;
    if (expression.type) {
      if (showType) {
        title = `${expression.name}`;
      } else {
        title = expression.type === expression.value ? expression.type : `${expression.type}`;
      }
    } else {
      title = expression.value;
    }
    data.label.set(text, highlights, title);
    data.elementDisposable.add(this.expressionRenderer.renderValue(data.value, expression, {
      showChanged: true,
      maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
      colorize: true,
      session: expression.getSession()
    }));
  }
  getInputBoxOptions(expression, settingValue) {
    if (settingValue) {
      return {
        initialValue: expression.value,
        ariaLabel: localize("typeNewValue", "Type new value"),
        onFinish: async (value, success) => {
          if (success && value) {
            const focusedFrame = this.debugService.getViewModel().focusedStackFrame;
            if (focusedFrame && (expression instanceof Variable || expression instanceof Expression)) {
              await expression.setExpression(value, focusedFrame);
              this.debugService.getViewModel().updateViews();
            }
          }
        }
      };
    }
    return {
      initialValue: expression.name ? expression.name : "",
      ariaLabel: localize("watchExpressionInputAriaLabel", "Type watch expression"),
      placeholder: localize("watchExpressionPlaceholder", "Expression to watch"),
      onFinish: (value, success) => {
        if (success && value) {
          this.debugService.renameWatchExpression(expression.getId(), value);
          ignoreViewUpdates = true;
          this.debugService.getViewModel().updateViews();
          ignoreViewUpdates = false;
        } else if (!expression.name) {
          this.debugService.removeWatchExpressions(expression.getId());
        }
      }
    };
  }
  renderActionBar(actionBar, expression) {
    const contextKeyService = getContextForWatchExpressionMenu(this.contextKeyService, expression);
    const context = expression;
    const menu = this.menuService.getMenuActions(MenuId.DebugWatchContext, contextKeyService, { arg: context, shouldForwardArgs: false });
    const { primary } = getContextMenuActions(menu, "inline");
    actionBar.clear();
    actionBar.context = context;
    actionBar.push(primary, { icon: true, label: false });
  }
};
WatchExpressionsRenderer = __decorateClass([
  __decorateParam(1, IMenuService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IDebugService),
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IConfigurationService)
], WatchExpressionsRenderer);
function getContextForWatchExpressionMenu(parentContext, expression, additionalContext = []) {
  const session = expression.getSession();
  return parentContext.createOverlay([
    [CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.key, "evaluateName" in expression],
    [CONTEXT_WATCH_ITEM_TYPE.key, expression instanceof Expression ? "expression" : expression instanceof Variable ? "variable" : void 0],
    [CONTEXT_CAN_VIEW_MEMORY.key, !!session?.capabilities.supportsReadMemoryRequest && expression.memoryReference !== void 0],
    [CONTEXT_VARIABLE_IS_READONLY.key, !!expression.presentationHint?.attributes?.includes("readOnly") || expression.presentationHint?.lazy],
    [CONTEXT_VARIABLE_TYPE.key, expression.type],
    [CONTEXT_DEBUG_TYPE.key, session?.configuration.type],
    ...additionalContext
  ]);
}
async function getContextForWatchExpressionMenuWithDataAccess(parentContext, expression, debugService, logService) {
  const session = expression.getSession();
  if (!session || !session.capabilities.supportsDataBreakpoints) {
    return getContextForWatchExpressionMenu(parentContext, expression);
  }
  const contextKeys = [];
  const stackFrame = debugService.getViewModel().focusedStackFrame;
  let dataBreakpointInfoResponse;
  try {
    if ("evaluateName" in expression && expression.evaluateName) {
      dataBreakpointInfoResponse = await session.dataBreakpointInfo(
        expression.evaluateName,
        void 0,
        stackFrame?.frameId
      );
    } else if (expression instanceof Variable) {
      dataBreakpointInfoResponse = await session.dataBreakpointInfo(
        expression.name,
        expression.parent.reference,
        stackFrame?.frameId
      );
    } else {
      dataBreakpointInfoResponse = await session.dataBreakpointInfo(
        expression.name,
        void 0,
        stackFrame?.frameId
      );
    }
  } catch (error) {
    logService.error("Failed to get data breakpoint info for watch expression:", error);
  }
  const dataBreakpointId = dataBreakpointInfoResponse?.dataId;
  const dataBreakpointAccessTypes = dataBreakpointInfoResponse?.accessTypes;
  setDataBreakpointInfoResponse(dataBreakpointInfoResponse);
  if (!dataBreakpointAccessTypes) {
    contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED.key, !!dataBreakpointId]);
  } else {
    for (const accessType of dataBreakpointAccessTypes) {
      switch (accessType) {
        case "read":
          contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED.key, !!dataBreakpointId]);
          break;
        case "write":
          contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED.key, !!dataBreakpointId]);
          break;
        case "readWrite":
          contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED.key, !!dataBreakpointId]);
          break;
      }
    }
  }
  return getContextForWatchExpressionMenu(parentContext, expression, contextKeys);
}
class WatchExpressionsAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize({ comment: ["Debug is a noun in this context, not a verb."], key: "watchAriaTreeLabel" }, "Debug Watch Expressions");
  }
  getAriaLabel(element) {
    if (element instanceof Expression) {
      return localize("watchExpressionAriaLabel", "{0}, value {1}", element.name, element.value);
    }
    return localize("watchVariableAriaLabel", "{0}, value {1}", element.name, element.value);
  }
}
class WatchExpressionsDragAndDrop {
  constructor(debugService) {
    this.debugService = debugService;
  }
  onDragStart(data, originalEvent) {
    if (data instanceof ElementsDragAndDropData) {
      originalEvent.dataTransfer.setData("text/plain", data.elements[0].name);
    }
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    if (!(data instanceof ElementsDragAndDropData)) {
      return false;
    }
    const expressions = data.elements;
    if (!(expressions.length > 0 && expressions[0] instanceof Expression)) {
      return false;
    }
    let dropEffectPosition = void 0;
    if (targetIndex === void 0) {
      dropEffectPosition = ListDragOverEffectPosition.After;
      targetIndex = -1;
    } else {
      switch (targetSector) {
        case ListViewTargetSector.TOP:
        case ListViewTargetSector.CENTER_TOP:
          dropEffectPosition = ListDragOverEffectPosition.Before;
          break;
        case ListViewTargetSector.CENTER_BOTTOM:
        case ListViewTargetSector.BOTTOM:
          dropEffectPosition = ListDragOverEffectPosition.After;
          break;
      }
    }
    return { accept: true, effect: { type: ListDragOverEffectType.Move, position: dropEffectPosition }, feedback: [targetIndex] };
  }
  getDragURI(element) {
    if (!(element instanceof Expression) || element === this.debugService.getViewModel().getSelectedExpression()?.expression) {
      return null;
    }
    return element.getId();
  }
  getDragLabel(elements) {
    if (elements.length === 1) {
      return elements[0].name;
    }
    return void 0;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
    if (!(data instanceof ElementsDragAndDropData)) {
      return;
    }
    const draggedElement = data.elements[0];
    if (!(draggedElement instanceof Expression)) {
      throw new Error("Invalid dragged element");
    }
    const watches = this.debugService.getModel().getWatchExpressions();
    const sourcePosition = watches.indexOf(draggedElement);
    let targetPosition;
    if (targetElement instanceof Expression) {
      targetPosition = watches.indexOf(targetElement);
      switch (targetSector) {
        case ListViewTargetSector.BOTTOM:
        case ListViewTargetSector.CENTER_BOTTOM:
          targetPosition++;
          break;
      }
      if (sourcePosition < targetPosition) {
        targetPosition--;
      }
    } else {
      targetPosition = watches.length - 1;
    }
    this.debugService.moveWatchExpression(draggedElement.getId(), targetPosition);
  }
  dispose() {
  }
}
registerAction2(class Collapse extends ViewAction {
  constructor() {
    super({
      id: "watch.collapse",
      viewId: WATCH_VIEW_ID,
      title: localize("collapse", "Collapse All"),
      f1: false,
      icon: Codicon.collapseAll,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      menu: {
        id: MenuId.ViewTitle,
        order: 30,
        group: "navigation",
        when: ContextKeyExpr.equals("view", WATCH_VIEW_ID)
      }
    });
  }
  runInView(_accessor, view) {
    view.collapseAll();
  }
});
const ADD_WATCH_ID = "workbench.debug.viewlet.action.addWatchExpression";
const ADD_WATCH_LABEL = localize("addWatchExpression", "Add Expression");
registerAction2(class AddWatchExpressionAction extends Action2 {
  constructor() {
    super({
      id: ADD_WATCH_ID,
      title: ADD_WATCH_LABEL,
      f1: false,
      icon: watchExpressionsAdd,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", WATCH_VIEW_ID)
      }
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.addWatchExpression();
  }
});
const REMOVE_WATCH_EXPRESSIONS_COMMAND_ID = "workbench.debug.viewlet.action.removeAllWatchExpressions";
const REMOVE_WATCH_EXPRESSIONS_LABEL = localize("removeAllWatchExpressions", "Remove All Expressions");
registerAction2(class RemoveAllWatchExpressionsAction extends Action2 {
  constructor() {
    super({
      id: REMOVE_WATCH_EXPRESSIONS_COMMAND_ID,
      // Use old and long id for backwards compatibility
      title: REMOVE_WATCH_EXPRESSIONS_LABEL,
      f1: false,
      icon: watchExpressionsRemoveAll,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      menu: {
        id: MenuId.ViewTitle,
        order: 20,
        group: "navigation",
        when: ContextKeyExpr.equals("view", WATCH_VIEW_ID)
      }
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.removeWatchExpressions();
  }
});
registerAction2(class CopyExpression extends ViewAction {
  constructor() {
    super({
      id: COPY_WATCH_EXPRESSION_COMMAND_ID,
      title: localize("copyWatchExpression", "Copy Expression"),
      f1: false,
      viewId: WATCH_VIEW_ID,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyC,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          FocusedViewContext.isEqualTo(WATCH_VIEW_ID),
          CONTEXT_EXPRESSION_SELECTED.negate()
        )
      },
      menu: {
        id: MenuId.DebugWatchContext,
        order: 20,
        group: "3_modification",
        when: CONTEXT_WATCH_ITEM_TYPE.isEqualTo("expression")
      }
    });
  }
  runInView(accessor, view, value) {
    const clipboardService = accessor.get(IClipboardService);
    if (!value) {
      value = view.treeSelection.at(-1);
    }
    if (value) {
      clipboardService.writeText(value.name);
    }
  }
});
const COPY_ALL_WATCH_EXPRESSIONS_COMMAND_ID = "workbench.debug.viewlet.action.copyAllWatchExpressions";
registerAction2(class CopyAllWatchExpressions extends ViewAction {
  constructor() {
    super({
      id: COPY_ALL_WATCH_EXPRESSIONS_COMMAND_ID,
      title: localize("copyAllWatchExpressions", "Copy All"),
      f1: false,
      viewId: WATCH_VIEW_ID,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      menu: {
        id: MenuId.DebugWatchContext,
        order: 45,
        group: "3_modification"
      }
    });
  }
  runInView(accessor) {
    const clipboardService = accessor.get(IClipboardService);
    const debugService = accessor.get(IDebugService);
    const watches = debugService.getModel().getWatchExpressions();
    const lines = watches.map((w) => `${w.name}: ${w.value}`);
    clipboardService.writeText(lines.join("\n"));
  }
});
export {
  ADD_WATCH_ID,
  ADD_WATCH_LABEL,
  COPY_ALL_WATCH_EXPRESSIONS_COMMAND_ID,
  REMOVE_WATCH_EXPRESSIONS_COMMAND_ID,
  REMOVE_WATCH_EXPRESSIONS_LABEL,
  WatchExpressionsRenderer,
  WatchExpressionsView
};
