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
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { Checkbox, TriStateCheckbox } from "../../../../base/browser/ui/toggle/toggle.js";
import { Orientation } from "../../../../base/browser/ui/splitview/splitview.js";
import { Action } from "../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import * as resources from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { Constants } from "../../../../base/common/uint.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize, localize2 } from "../../../../nls.js";
import { getActionBarActions, getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchCompressibleObjectTree } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { defaultCheckboxStyles, defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { BREAKPOINTS_VIEW_ID, BREAKPOINT_EDITOR_CONTRIBUTION_ID, CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINTS_FOCUSED, CONTEXT_BREAKPOINT_HAS_MODES, CONTEXT_BREAKPOINT_INPUT_FOCUSED, CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES, CONTEXT_BREAKPOINT_ITEM_TYPE, CONTEXT_BREAKPOINT_SUPPORTS_CONDITION, CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_IN_DEBUG_MODE, CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED, DEBUG_SCHEME, DataBreakpointSetType, DebuggerString, IDebugService, State } from "../common/debug.js";
import { Breakpoint, DataBreakpoint, ExceptionBreakpoint, FunctionBreakpoint, InstructionBreakpoint } from "../common/debugModel.js";
import { DisassemblyViewInput } from "../common/disassemblyViewInput.js";
import * as icons from "./debugIcons.js";
import { equals } from "../../../../base/common/arrays.js";
import { hasKey } from "../../../../base/common/types.js";
const $ = dom.$;
function createCheckbox(disposables) {
  const checkbox = new Checkbox("", false, defaultCheckboxStyles);
  checkbox.domNode.tabIndex = -1;
  disposables.add(checkbox);
  return checkbox;
}
const MAX_VISIBLE_BREAKPOINTS = 9;
function getExpandedBodySize(model, sessionId, countLimit) {
  const length = model.getBreakpoints().length + model.getExceptionBreakpointsForSession(sessionId).length + model.getFunctionBreakpoints().length + model.getDataBreakpoints().length + model.getInstructionBreakpoints().length;
  return Math.min(countLimit, length) * 22;
}
class BreakpointsFolderItem {
  constructor(uri, breakpoints) {
    this.uri = uri;
    this.breakpoints = breakpoints;
  }
  getId() {
    return this.uri.toString();
  }
  get enabled() {
    return this.breakpoints.every((bp) => bp.enabled);
  }
  get indeterminate() {
    const enabledCount = this.breakpoints.filter((bp) => bp.enabled).length;
    return enabledCount > 0 && enabledCount < this.breakpoints.length;
  }
}
function getModeKindForBreakpoint(breakpoint) {
  const kind = breakpoint instanceof Breakpoint ? "source" : breakpoint instanceof InstructionBreakpoint ? "instruction" : "exception";
  return kind;
}
let BreakpointsView = class extends ViewPane {
  constructor(options, contextMenuService, debugService, keybindingService, instantiationService, themeService, editorService, contextViewService, configurationService, viewDescriptorService, contextKeyService, openerService, labelService, menuService, hoverService, languageService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.debugService = debugService;
    this.editorService = editorService;
    this.contextViewService = contextViewService;
    this.labelService = labelService;
    this.languageService = languageService;
    this.needsRefresh = false;
    this.needsStateChange = false;
    this.ignoreLayout = false;
    this.collapsedState = /* @__PURE__ */ new Set();
    this.menu = menuService.createMenu(MenuId.DebugBreakpointsContext, contextKeyService);
    this._register(this.menu);
    this.breakpointItemType = CONTEXT_BREAKPOINT_ITEM_TYPE.bindTo(contextKeyService);
    this.breakpointIsDataBytes = CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES.bindTo(contextKeyService);
    this.breakpointHasMultipleModes = CONTEXT_BREAKPOINT_HAS_MODES.bindTo(contextKeyService);
    this.breakpointSupportsCondition = CONTEXT_BREAKPOINT_SUPPORTS_CONDITION.bindTo(contextKeyService);
    this.breakpointInputFocused = CONTEXT_BREAKPOINT_INPUT_FOCUSED.bindTo(contextKeyService);
    this._register(this.debugService.getModel().onDidChangeBreakpoints(() => this.onBreakpointsChange()));
    this._register(this.debugService.getViewModel().onDidFocusSession(() => this.onBreakpointsChange()));
    this._register(this.debugService.onDidChangeState(() => this.onStateChange()));
    this.hintDelayer = this._register(new RunOnceScheduler(() => this.updateBreakpointsHint(true), 4e3));
  }
  getPresentation() {
    return this.configurationService.getValue("debug.breakpointsView.presentation");
  }
  renderBody(container) {
    super.renderBody(container);
    this.element.classList.add("debug-pane");
    container.classList.add("debug-breakpoints");
    this.tree = this.instantiationService.createInstance(
      WorkbenchCompressibleObjectTree,
      "BreakpointsView",
      container,
      new BreakpointsDelegate(this),
      [
        this.instantiationService.createInstance(BreakpointsFolderRenderer),
        this.instantiationService.createInstance(BreakpointsRenderer, this.menu, this.breakpointHasMultipleModes, this.breakpointSupportsCondition, this.breakpointItemType),
        new ExceptionBreakpointsRenderer(this.menu, this.breakpointHasMultipleModes, this.breakpointSupportsCondition, this.breakpointItemType, this.debugService, this.hoverService),
        new ExceptionBreakpointInputRenderer(this, this.debugService, this.contextViewService),
        this.instantiationService.createInstance(FunctionBreakpointsRenderer, this.menu, this.breakpointSupportsCondition, this.breakpointItemType),
        new FunctionBreakpointInputRenderer(this, this.debugService, this.contextViewService, this.hoverService, this.labelService),
        this.instantiationService.createInstance(DataBreakpointsRenderer, this.menu, this.breakpointHasMultipleModes, this.breakpointSupportsCondition, this.breakpointItemType, this.breakpointIsDataBytes),
        new DataBreakpointInputRenderer(this, this.debugService, this.contextViewService, this.hoverService, this.labelService),
        this.instantiationService.createInstance(InstructionBreakpointsRenderer)
      ],
      {
        compressionEnabled: this.getPresentation() === "tree",
        hideTwistiesOfChildlessElements: true,
        identityProvider: {
          getId: (element) => element.getId()
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (element) => {
            if (element instanceof BreakpointsFolderItem) {
              return resources.basenameOrAuthority(element.uri);
            }
            if (element instanceof Breakpoint) {
              return `${resources.basenameOrAuthority(element.uri)}:${element.lineNumber}`;
            }
            if (element instanceof FunctionBreakpoint) {
              return element.name;
            }
            if (element instanceof DataBreakpoint) {
              return element.description;
            }
            if (element instanceof ExceptionBreakpoint) {
              return element.label || element.filter;
            }
            if (element instanceof InstructionBreakpoint) {
              return `0x${element.address.toString(16)}`;
            }
            return "";
          },
          getCompressedNodeKeyboardNavigationLabel: (elements) => {
            return elements.map((e) => {
              if (e instanceof BreakpointsFolderItem) {
                return resources.basenameOrAuthority(e.uri);
              }
              return "";
            }).join("/");
          }
        },
        accessibilityProvider: new BreakpointsAccessibilityProvider(this.debugService, this.labelService),
        multipleSelectionSupport: false,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    this._register(this.tree);
    CONTEXT_BREAKPOINTS_FOCUSED.bindTo(this.tree.contextKeyService);
    this._register(this.tree.onContextMenu(this.onTreeContextMenu, this));
    this._register(this.tree.onMouseMiddleClick(async ({ element }) => {
      if (element instanceof Breakpoint) {
        await this.debugService.removeBreakpoints(element.getId());
      } else if (element instanceof FunctionBreakpoint) {
        await this.debugService.removeFunctionBreakpoints(element.getId());
      } else if (element instanceof DataBreakpoint) {
        await this.debugService.removeDataBreakpoints(element.getId());
      } else if (element instanceof InstructionBreakpoint) {
        await this.debugService.removeInstructionBreakpoints(element.instructionReference, element.offset);
      } else if (element instanceof BreakpointsFolderItem) {
        await this.debugService.removeBreakpoints(element.breakpoints.map((bp) => bp.getId()));
      }
    }));
    this._register(this.tree.onDidOpen(async (e) => {
      const element = e.element;
      if (!element) {
        return;
      }
      if (dom.isMouseEvent(e.browserEvent) && e.browserEvent.button === 1) {
        return;
      }
      if (element instanceof Breakpoint) {
        openBreakpointSource(element, e.sideBySide, e.editorOptions.preserveFocus || false, e.editorOptions.pinned || !e.editorOptions.preserveFocus, this.debugService, this.editorService);
      }
      if (element instanceof InstructionBreakpoint) {
        const disassemblyView = await this.editorService.openEditor(DisassemblyViewInput.instance);
        disassemblyView.goToInstructionAndOffset(element.instructionReference, element.offset, dom.isMouseEvent(e.browserEvent) && e.browserEvent.detail === 2);
      }
      if (dom.isMouseEvent(e.browserEvent) && e.browserEvent.detail === 2 && element instanceof FunctionBreakpoint && element !== this.inputBoxData?.breakpoint) {
        this.renderInputBox({ breakpoint: element, type: "name" });
      }
    }));
    this._register(this.tree.onKeyDown((e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Space) && !dom.isEditableElement(e.target)) {
        const focused = this.tree.getFocus();
        if (focused.length > 0) {
          const element = focused[0];
          if (element && !(element instanceof BreakpointsFolderItem)) {
            this.debugService.enableOrDisableBreakpoints(!element.enabled, element);
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    }));
    this._register(this.tree.onDidChangeCollapseState((e) => {
      const element = e.node.element;
      if (element instanceof BreakpointsFolderItem) {
        if (e.node.collapsed) {
          this.collapsedState.add(element.getId());
        } else {
          this.collapsedState.delete(element.getId());
        }
        this.updateSize();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.breakpointsView.presentation")) {
        const presentation = this.getPresentation();
        this.tree.updateOptions({ compressionEnabled: presentation === "tree" });
        this.onBreakpointsChange();
      }
    }));
    this.setTreeInput();
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible) {
        if (this.needsRefresh) {
          this.onBreakpointsChange();
        }
        if (this.needsStateChange) {
          this.onStateChange();
        }
      }
    }));
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    this._register(containerModel.onDidChangeAllViewDescriptors(() => {
      this.updateSize();
    }));
  }
  renderHeaderTitle(container, title) {
    super.renderHeaderTitle(container, title);
    const iconLabelContainer = dom.append(container, $("span.breakpoint-warning"));
    this.hintContainer = this._register(new IconLabel(iconLabelContainer, {
      supportIcons: true,
      hoverDelegate: {
        showHover: (options, focus) => this.hoverService.showInstantHover({ content: options.content, target: this.hintContainer.element }, focus),
        delay: this.configurationService.getValue("workbench.hover.delay")
      }
    }));
    dom.hide(this.hintContainer.element);
  }
  focus() {
    super.focus();
    this.tree?.domFocus();
  }
  renderInputBox(data) {
    this._inputBoxData = data;
    this.onBreakpointsChange();
    this._inputBoxData = void 0;
  }
  get inputBoxData() {
    return this._inputBoxData;
  }
  layoutBody(height, width) {
    if (this.ignoreLayout) {
      return;
    }
    super.layoutBody(height, width);
    this.tree?.layout(height, width);
    try {
      this.ignoreLayout = true;
      this.updateSize();
    } finally {
      this.ignoreLayout = false;
    }
  }
  onTreeContextMenu(e) {
    const element = e.element;
    if (element instanceof BreakpointsFolderItem) {
      this.breakpointItemType.set("breakpointFolder");
      const { secondary: secondary2 } = getContextMenuActions(this.menu.getActions({ arg: element, shouldForwardArgs: false }), "inline");
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => secondary2,
        getActionsContext: () => element
      });
      return;
    }
    const type = element instanceof Breakpoint ? "breakpoint" : element instanceof ExceptionBreakpoint ? "exceptionBreakpoint" : element instanceof FunctionBreakpoint ? "functionBreakpoint" : element instanceof DataBreakpoint ? "dataBreakpoint" : element instanceof InstructionBreakpoint ? "instructionBreakpoint" : void 0;
    this.breakpointItemType.set(type);
    const session = this.debugService.getViewModel().focusedSession;
    const conditionSupported = element instanceof ExceptionBreakpoint ? element.supportsCondition : !session || !!session.capabilities.supportsConditionalBreakpoints;
    this.breakpointSupportsCondition.set(conditionSupported);
    this.breakpointIsDataBytes.set(element instanceof DataBreakpoint && element.src.type === DataBreakpointSetType.Address);
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes(getModeKindForBreakpoint(element)).length > 1);
    const { secondary } = getContextMenuActions(this.menu.getActions({ arg: e.element, shouldForwardArgs: false }), "inline");
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => secondary,
      getActionsContext: () => element
    });
  }
  updateSize() {
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    const rowHeight = 22;
    this.minimumBodySize = this.orientation === Orientation.VERTICAL ? Math.min(MAX_VISIBLE_BREAKPOINTS * rowHeight, this.tree.contentHeight) : 170;
    this.maximumBodySize = this.orientation === Orientation.VERTICAL && containerModel.visibleViewDescriptors.length > 1 ? this.tree.contentHeight : Number.POSITIVE_INFINITY;
  }
  updateBreakpointsHint(delayed = false) {
    if (!this.hintContainer) {
      return;
    }
    const currentType = this.debugService.getViewModel().focusedSession?.configuration.type;
    const dbg = currentType ? this.debugService.getAdapterManager().getDebugger(currentType) : void 0;
    const message = dbg?.strings?.[DebuggerString.UnverifiedBreakpoints];
    const debuggerHasUnverifiedBps = message && this.debugService.getModel().getBreakpoints().filter((bp) => {
      if (bp.verified || !bp.enabled) {
        return false;
      }
      const langId = this.languageService.guessLanguageIdByFilepathOrFirstLine(bp.uri);
      return langId && dbg.interestedInLanguage(langId);
    });
    if (message && debuggerHasUnverifiedBps?.length && this.debugService.getModel().areBreakpointsActivated()) {
      if (delayed) {
        const mdown = new MarkdownString(void 0, { isTrusted: true }).appendMarkdown(message);
        this.hintContainer.setLabel("$(warning)", void 0, { title: { markdown: mdown, markdownNotSupportedFallback: message } });
        dom.show(this.hintContainer.element);
      } else {
        this.hintDelayer.schedule();
      }
    } else {
      dom.hide(this.hintContainer.element);
    }
  }
  onBreakpointsChange() {
    if (this.isBodyVisible()) {
      if (this.tree) {
        this.setTreeInput();
        this.needsRefresh = false;
      }
      this.updateBreakpointsHint();
      this.updateSize();
    } else {
      this.needsRefresh = true;
    }
  }
  onStateChange() {
    if (this.isBodyVisible()) {
      this.needsStateChange = false;
      const thread = this.debugService.getViewModel().focusedThread;
      let found = false;
      if (thread && thread.stoppedDetails && thread.stoppedDetails.hitBreakpointIds && thread.stoppedDetails.hitBreakpointIds.length > 0) {
        const hitBreakpointIds = thread.stoppedDetails.hitBreakpointIds;
        const elements = this.flatElements;
        const hitElement = elements.find((e) => {
          const id = e.getIdFromAdapter(thread.session.getId());
          return typeof id === "number" && hitBreakpointIds.indexOf(id) !== -1;
        });
        if (hitElement) {
          this.tree.setFocus([hitElement]);
          this.tree.setSelection([hitElement]);
          found = true;
          this.autoFocusedElement = hitElement;
        }
      }
      if (!found) {
        const focus = this.tree.getFocus();
        const selection = this.tree.getSelection();
        if (this.autoFocusedElement && equals(focus, selection) && selection.includes(this.autoFocusedElement)) {
          this.tree.setFocus([]);
          this.tree.setSelection([]);
        }
        this.autoFocusedElement = void 0;
      }
      this.updateBreakpointsHint();
    } else {
      this.needsStateChange = true;
    }
  }
  setTreeInput() {
    const treeInput = this.getTreeElements();
    this.tree.setChildren(null, treeInput);
  }
  getTreeElements() {
    const model = this.debugService.getModel();
    const sessionId = this.debugService.getViewModel().focusedSession?.getId();
    const showAsTree = this.getPresentation() === "tree";
    const result = [];
    for (const exBp of model.getExceptionBreakpointsForSession(sessionId)) {
      result.push({ element: exBp, incompressible: true });
    }
    for (const funcBp of model.getFunctionBreakpoints()) {
      result.push({ element: funcBp, incompressible: true });
    }
    for (const dataBp of model.getDataBreakpoints()) {
      result.push({ element: dataBp, incompressible: true });
    }
    const sourceBreakpoints = model.getBreakpoints();
    if (showAsTree && sourceBreakpoints.length > 0) {
      const breakpointsByUri = /* @__PURE__ */ new Map();
      for (const bp of sourceBreakpoints) {
        const key = bp.uri.toString();
        if (!breakpointsByUri.has(key)) {
          breakpointsByUri.set(key, []);
        }
        breakpointsByUri.get(key).push(bp);
      }
      for (const [uriStr, breakpoints] of breakpointsByUri) {
        const uri = URI.parse(uriStr);
        const folderItem = new BreakpointsFolderItem(uri, breakpoints);
        breakpoints.sort((a, b) => a.lineNumber - b.lineNumber);
        const children = breakpoints.map((bp) => ({
          element: bp,
          incompressible: false
        }));
        result.push({
          element: folderItem,
          incompressible: false,
          collapsed: this.collapsedState.has(folderItem.getId()),
          children
        });
      }
    } else {
      for (const bp of sourceBreakpoints) {
        result.push({ element: bp, incompressible: true });
      }
    }
    for (const instrBp of model.getInstructionBreakpoints()) {
      result.push({ element: instrBp, incompressible: true });
    }
    return result;
  }
  get flatElements() {
    const model = this.debugService.getModel();
    const sessionId = this.debugService.getViewModel().focusedSession?.getId();
    const elements = model.getExceptionBreakpointsForSession(sessionId).concat(model.getFunctionBreakpoints()).concat(model.getDataBreakpoints()).concat(model.getBreakpoints()).concat(model.getInstructionBreakpoints());
    return elements;
  }
};
BreakpointsView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IDebugService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IContextViewService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IOpenerService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IMenuService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, ILanguageService)
], BreakpointsView);
class BreakpointsDelegate {
  constructor(view) {
    this.view = view;
  }
  getHeight(_element) {
    return 22;
  }
  getTemplateId(element) {
    if (element instanceof BreakpointsFolderItem) {
      return BreakpointsFolderRenderer.ID;
    }
    if (element instanceof Breakpoint) {
      return BreakpointsRenderer.ID;
    }
    if (element instanceof FunctionBreakpoint) {
      const inputBoxBreakpoint = this.view.inputBoxData?.breakpoint;
      if (!element.name || inputBoxBreakpoint && inputBoxBreakpoint.getId() === element.getId()) {
        return FunctionBreakpointInputRenderer.ID;
      }
      return FunctionBreakpointsRenderer.ID;
    }
    if (element instanceof ExceptionBreakpoint) {
      const inputBoxBreakpoint = this.view.inputBoxData?.breakpoint;
      if (inputBoxBreakpoint && inputBoxBreakpoint.getId() === element.getId()) {
        return ExceptionBreakpointInputRenderer.ID;
      }
      return ExceptionBreakpointsRenderer.ID;
    }
    if (element instanceof DataBreakpoint) {
      const inputBoxBreakpoint = this.view.inputBoxData?.breakpoint;
      if (inputBoxBreakpoint && inputBoxBreakpoint.getId() === element.getId()) {
        return DataBreakpointInputRenderer.ID;
      }
      return DataBreakpointsRenderer.ID;
    }
    if (element instanceof InstructionBreakpoint) {
      return InstructionBreakpointsRenderer.ID;
    }
    return "";
  }
}
const breakpointIdToActionBarDomeNode = /* @__PURE__ */ new Map();
let BreakpointsFolderRenderer = class {
  constructor(debugService, labelService, hoverService) {
    this.debugService = debugService;
    this.labelService = labelService;
    this.hoverService = hoverService;
  }
  static {
    this.ID = "breakpointFolder";
  }
  get templateId() {
    return BreakpointsFolderRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.container = container;
    container.classList.add("breakpoint", "breakpoint-folder");
    data.templateDisposables.add(toDisposable(() => {
      container.classList.remove("breakpoint", "breakpoint-folder");
    }));
    data.checkbox = new TriStateCheckbox("", false, defaultCheckboxStyles);
    data.checkbox.domNode.tabIndex = -1;
    data.templateDisposables.add(data.checkbox);
    data.templateDisposables.add(data.checkbox.onChange(() => {
      const checked = data.checkbox.checked;
      const enabled = checked === "mixed" ? true : checked;
      for (const bp of data.context.breakpoints) {
        this.debugService.enableOrDisableBreakpoints(enabled, bp);
      }
    }));
    dom.append(data.container, data.checkbox.domNode);
    data.name = dom.append(data.container, $("span.name"));
    dom.append(data.container, $("span.file-path"));
    data.actionBar = new ActionBar(data.container);
    data.templateDisposables.add(data.actionBar);
    return data;
  }
  renderElement(node, _index, data) {
    const folderItem = node.element;
    data.context = folderItem;
    data.name.textContent = this.labelService.getUriBasenameLabel(folderItem.uri);
    data.container.classList.toggle("disabled", !this.debugService.getModel().areBreakpointsActivated());
    const fullPath = this.labelService.getUriLabel(folderItem.uri, { relative: true });
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.container, fullPath));
    if (folderItem.indeterminate) {
      data.checkbox.checked = "mixed";
    } else {
      data.checkbox.checked = folderItem.enabled;
    }
    data.actionBar.clear();
    const removeAction = data.elementDisposables.add(new Action(
      "debug.removeBreakpointsInFile",
      localize("removeBreakpointsInFile", "Remove Breakpoints in File"),
      ThemeIcon.asClassName(Codicon.close),
      true,
      async () => {
        for (const bp of folderItem.breakpoints) {
          await this.debugService.removeBreakpoints(bp.getId());
        }
      }
    ));
    data.actionBar.push(removeAction, { icon: true, label: false });
  }
  renderCompressedElements(node, _index, data) {
    const elements = node.element.elements;
    const folderItem = elements[elements.length - 1];
    data.context = folderItem;
    const names = elements.map((e) => resources.basenameOrAuthority(e.uri));
    data.name.textContent = names.join("/");
    const fullPath = this.labelService.getUriLabel(folderItem.uri, { relative: true });
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.container, fullPath));
    if (folderItem.indeterminate) {
      data.checkbox.checked = "mixed";
    } else {
      data.checkbox.checked = folderItem.enabled;
    }
    data.actionBar.clear();
    const removeAction = data.elementDisposables.add(new Action(
      "debug.removeBreakpointsInFile",
      localize("removeBreakpointsInFile", "Remove Breakpoints in File"),
      ThemeIcon.asClassName(Codicon.close),
      true,
      async () => {
        for (const bp of folderItem.breakpoints) {
          await this.debugService.removeBreakpoints(bp.getId());
        }
      }
    ));
    data.actionBar.push(removeAction, { icon: true, label: false });
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
BreakpointsFolderRenderer = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, IHoverService)
], BreakpointsFolderRenderer);
let BreakpointsRenderer = class {
  constructor(menu, breakpointHasMultipleModes, breakpointSupportsCondition, breakpointItemType, debugService, hoverService, labelService, textModelService) {
    this.menu = menu;
    this.breakpointHasMultipleModes = breakpointHasMultipleModes;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
    this.textModelService = textModelService;
  }
  static {
    this.ID = "breakpoints";
  }
  get templateId() {
    return BreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = container;
    container.classList.add("breakpoint");
    data.templateDisposables.add(toDisposable(() => {
      container.classList.remove("breakpoint");
    }));
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(data.checkbox.onChange(() => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox.domNode);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.filePath = dom.append(data.breakpoint, $("span.file-path"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(node, index, data) {
    const breakpoint = node.element;
    data.context = breakpoint;
    if (node.depth > 1) {
      this.renderBreakpointLineLabel(breakpoint, data);
    } else {
      this.renderBreakpointFileLabel(breakpoint, data);
    }
    this.renderBreakpointCommon(breakpoint, data);
  }
  renderCompressedElements(node, index, data) {
    const breakpoint = node.element.elements[node.element.elements.length - 1];
    data.context = breakpoint;
    this.renderBreakpointFileLabel(breakpoint, data);
    this.renderBreakpointCommon(breakpoint, data);
  }
  renderBreakpointCommon(breakpoint, data) {
    data.breakpoint.classList.toggle("disabled", !this.debugService.getModel().areBreakpointsActivated());
    let badgeContent = breakpoint.lineNumber.toString();
    if (breakpoint.column) {
      badgeContent += `:${breakpoint.column}`;
    }
    if (breakpoint.modeLabel) {
      badgeContent = `${breakpoint.modeLabel}: ${badgeContent}`;
    }
    data.badge.textContent = badgeContent;
    data.checkbox.checked = breakpoint.enabled;
    const { message, icon } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), breakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, breakpoint.message || message || ""));
    const debugActive = this.debugService.state === State.Running || this.debugService.state === State.Stopped;
    if (debugActive && !breakpoint.verified) {
      data.breakpoint.classList.add("disabled");
    }
    const session = this.debugService.getViewModel().focusedSession;
    this.breakpointSupportsCondition.set(!session || !!session.capabilities.supportsConditionalBreakpoints);
    this.breakpointItemType.set("breakpoint");
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes("source").length > 1);
    const { primary } = getActionBarActions(this.menu.getActions({ arg: breakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(breakpoint.getId(), data.actionBar.domNode);
  }
  renderBreakpointFileLabel(breakpoint, data) {
    data.name.textContent = resources.basenameOrAuthority(breakpoint.uri);
    data.filePath.textContent = this.labelService.getUriLabel(resources.dirname(breakpoint.uri), { relative: true });
  }
  renderBreakpointLineLabel(breakpoint, data) {
    data.name.textContent = localize("loading", "Loading...");
    data.filePath.textContent = "";
    this.textModelService.createModelReference(breakpoint.uri).then((reference) => {
      if (data.context !== breakpoint) {
        reference.dispose();
        return;
      }
      data.elementDisposables.add(reference);
      const model = reference.object.textEditorModel;
      if (model && breakpoint.lineNumber <= model.getLineCount()) {
        const lineContent = model.getLineContent(breakpoint.lineNumber).trim();
        data.name.textContent = lineContent || localize("emptyLine", "(empty line)");
      } else {
        data.name.textContent = localize("lineNotFound", "(line not found)");
      }
    }).catch(() => {
      if (data.context === breakpoint) {
        data.name.textContent = localize("cannotLoadLine", "(cannot load line)");
      }
    });
  }
  disposeElement(node, index, template) {
    template.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
BreakpointsRenderer = __decorateClass([
  __decorateParam(4, IDebugService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, ITextModelService)
], BreakpointsRenderer);
class ExceptionBreakpointsRenderer {
  constructor(menu, breakpointHasMultipleModes, breakpointSupportsCondition, breakpointItemType, debugService, hoverService) {
    this.menu = menu;
    this.breakpointHasMultipleModes = breakpointHasMultipleModes;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.debugService = debugService;
    this.hoverService = hoverService;
  }
  static {
    this.ID = "exceptionbreakpoints";
  }
  get templateId() {
    return ExceptionBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(data.checkbox.onChange(() => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.checkbox.domNode);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.condition = dom.append(data.breakpoint, $("span.condition"));
    data.breakpoint.classList.add("exception");
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(node, index, data) {
    const exceptionBreakpoint = node.element;
    this.renderExceptionBreakpoint(exceptionBreakpoint, data);
  }
  renderCompressedElements(node, index, data) {
    const exceptionBreakpoint = node.element.elements[node.element.elements.length - 1];
    this.renderExceptionBreakpoint(exceptionBreakpoint, data);
  }
  renderExceptionBreakpoint(exceptionBreakpoint, data) {
    data.context = exceptionBreakpoint;
    data.name.textContent = exceptionBreakpoint.label || `${exceptionBreakpoint.filter} exceptions`;
    const exceptionBreakpointtitle = exceptionBreakpoint.verified ? exceptionBreakpoint.description || data.name.textContent : exceptionBreakpoint.message || localize("unverifiedExceptionBreakpoint", "Unverified Exception Breakpoint");
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, exceptionBreakpointtitle));
    data.breakpoint.classList.toggle("disabled", !exceptionBreakpoint.verified);
    data.checkbox.checked = exceptionBreakpoint.enabled;
    data.condition.textContent = exceptionBreakpoint.condition || "";
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.condition, localize("expressionCondition", "Expression condition: {0}", exceptionBreakpoint.condition)));
    if (exceptionBreakpoint.modeLabel) {
      data.badge.textContent = exceptionBreakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
    this.breakpointSupportsCondition.set(exceptionBreakpoint.supportsCondition);
    this.breakpointItemType.set("exceptionBreakpoint");
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes("exception").length > 1);
    const { primary } = getActionBarActions(this.menu.getActions({ arg: exceptionBreakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(exceptionBreakpoint.getId(), data.actionBar.domNode);
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
let FunctionBreakpointsRenderer = class {
  constructor(menu, breakpointSupportsCondition, breakpointItemType, debugService, hoverService, labelService) {
    this.menu = menu;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  static {
    this.ID = "functionbreakpoints";
  }
  get templateId() {
    return FunctionBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(data.checkbox.onChange(() => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox.domNode);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.condition = dom.append(data.breakpoint, $("span.condition"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(node, _index, data) {
    this.renderFunctionBreakpoint(node.element, data);
  }
  renderCompressedElements(node, _index, data) {
    this.renderFunctionBreakpoint(node.element.elements[node.element.elements.length - 1], data);
  }
  renderFunctionBreakpoint(functionBreakpoint, data) {
    data.context = functionBreakpoint;
    data.name.textContent = functionBreakpoint.name;
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), functionBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ? message : ""));
    data.checkbox.checked = functionBreakpoint.enabled;
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, message ? message : ""));
    if (functionBreakpoint.condition && functionBreakpoint.hitCondition) {
      data.condition.textContent = localize("expressionAndHitCount", "Condition: {0} | Hit Count: {1}", functionBreakpoint.condition, functionBreakpoint.hitCondition);
    } else {
      data.condition.textContent = functionBreakpoint.condition || functionBreakpoint.hitCondition || "";
    }
    if (functionBreakpoint.modeLabel) {
      data.badge.textContent = functionBreakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
    const session = this.debugService.getViewModel().focusedSession;
    data.breakpoint.classList.toggle("disabled", session && !session.capabilities.supportsFunctionBreakpoints || !this.debugService.getModel().areBreakpointsActivated());
    if (session && !session.capabilities.supportsFunctionBreakpoints) {
      data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, localize("functionBreakpointsNotSupported", "Function breakpoints are not supported by this debug type")));
    }
    this.breakpointSupportsCondition.set(!session || !!session.capabilities.supportsConditionalBreakpoints);
    this.breakpointItemType.set("functionBreakpoint");
    const { primary } = getActionBarActions(this.menu.getActions({ arg: functionBreakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(functionBreakpoint.getId(), data.actionBar.domNode);
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
FunctionBreakpointsRenderer = __decorateClass([
  __decorateParam(3, IDebugService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, ILabelService)
], FunctionBreakpointsRenderer);
let DataBreakpointsRenderer = class {
  constructor(menu, breakpointHasMultipleModes, breakpointSupportsCondition, breakpointItemType, breakpointIsDataBytes, debugService, hoverService, labelService) {
    this.menu = menu;
    this.breakpointHasMultipleModes = breakpointHasMultipleModes;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.breakpointIsDataBytes = breakpointIsDataBytes;
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  static {
    this.ID = "databreakpoints";
  }
  get templateId() {
    return DataBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(data.checkbox.onChange(() => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox.domNode);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.accessType = dom.append(data.breakpoint, $("span.access-type"));
    data.condition = dom.append(data.breakpoint, $("span.condition"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(node, _index, data) {
    this.renderDataBreakpoint(node.element, data);
  }
  renderCompressedElements(node, _index, data) {
    this.renderDataBreakpoint(node.element.elements[node.element.elements.length - 1], data);
  }
  renderDataBreakpoint(dataBreakpoint, data) {
    data.context = dataBreakpoint;
    data.name.textContent = dataBreakpoint.description;
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), dataBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ? message : ""));
    data.checkbox.checked = dataBreakpoint.enabled;
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, message ? message : ""));
    if (dataBreakpoint.modeLabel) {
      data.badge.textContent = dataBreakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
    const session = this.debugService.getViewModel().focusedSession;
    data.breakpoint.classList.toggle("disabled", session && !session.capabilities.supportsDataBreakpoints || !this.debugService.getModel().areBreakpointsActivated());
    if (session && !session.capabilities.supportsDataBreakpoints) {
      data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, localize("dataBreakpointsNotSupported", "Data breakpoints are not supported by this debug type")));
    }
    if (dataBreakpoint.accessType) {
      const accessType = dataBreakpoint.accessType === "read" ? localize("read", "Read") : dataBreakpoint.accessType === "write" ? localize("write", "Write") : localize("access", "Access");
      data.accessType.textContent = accessType;
    } else {
      data.accessType.textContent = "";
    }
    if (dataBreakpoint.condition && dataBreakpoint.hitCondition) {
      data.condition.textContent = localize("expressionAndHitCount", "Condition: {0} | Hit Count: {1}", dataBreakpoint.condition, dataBreakpoint.hitCondition);
    } else {
      data.condition.textContent = dataBreakpoint.condition || dataBreakpoint.hitCondition || "";
    }
    this.breakpointSupportsCondition.set(!session || !!session.capabilities.supportsConditionalBreakpoints);
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes("data").length > 1);
    this.breakpointItemType.set("dataBreakpoint");
    this.breakpointIsDataBytes.set(dataBreakpoint.src.type === DataBreakpointSetType.Address);
    const { primary } = getActionBarActions(this.menu.getActions({ arg: dataBreakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(dataBreakpoint.getId(), data.actionBar.domNode);
    this.breakpointIsDataBytes.reset();
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
DataBreakpointsRenderer = __decorateClass([
  __decorateParam(5, IDebugService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, ILabelService)
], DataBreakpointsRenderer);
let InstructionBreakpointsRenderer = class {
  constructor(debugService, hoverService, labelService) {
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  static {
    this.ID = "instructionBreakpoints";
  }
  get templateId() {
    return InstructionBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(data.checkbox.onChange(() => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox.domNode);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.address = dom.append(data.breakpoint, $("span.file-path"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(node, index, data) {
    this.renderInstructionBreakpoint(node.element, data);
  }
  renderCompressedElements(node, index, data) {
    this.renderInstructionBreakpoint(node.element.elements[node.element.elements.length - 1], data);
  }
  renderInstructionBreakpoint(breakpoint, data) {
    data.context = breakpoint;
    data.breakpoint.classList.toggle("disabled", !this.debugService.getModel().areBreakpointsActivated());
    data.name.textContent = "0x" + breakpoint.address.toString(16);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.name, localize("debug.decimal.address", "Decimal Address: {0}", breakpoint.address.toString())));
    data.checkbox.checked = breakpoint.enabled;
    const { message, icon } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), breakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, breakpoint.message || message || ""));
    const debugActive = this.debugService.state === State.Running || this.debugService.state === State.Stopped;
    if (debugActive && !breakpoint.verified) {
      data.breakpoint.classList.add("disabled");
    }
    if (breakpoint.modeLabel) {
      data.badge.textContent = breakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
InstructionBreakpointsRenderer = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IHoverService),
  __decorateParam(2, ILabelService)
], InstructionBreakpointsRenderer);
class FunctionBreakpointInputRenderer {
  constructor(view, debugService, contextViewService, hoverService, labelService) {
    this.view = view;
    this.debugService = debugService;
    this.contextViewService = contextViewService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  static {
    this.ID = "functionbreakpointinput";
  }
  get templateId() {
    return FunctionBreakpointInputRenderer.ID;
  }
  renderTemplate(container) {
    const template = /* @__PURE__ */ Object.create(null);
    const toDispose = new DisposableStore();
    const breakpoint = dom.append(container, $(".breakpoint"));
    template.icon = $(".icon");
    template.checkbox = createCheckbox(toDispose);
    dom.append(breakpoint, template.icon);
    dom.append(breakpoint, template.checkbox.domNode);
    this.view.breakpointInputFocused.set(true);
    const inputBoxContainer = dom.append(breakpoint, $(".inputBoxContainer"));
    const inputBox = new InputBox(inputBoxContainer, this.contextViewService, { inputBoxStyles: defaultInputBoxStyles });
    toDispose.add(inputBox);
    const wrapUp = (success) => {
      template.updating = true;
      try {
        this.view.breakpointInputFocused.set(false);
        const id = template.breakpoint.getId();
        if (success) {
          if (template.type === "name") {
            this.debugService.updateFunctionBreakpoint(id, { name: inputBox.value });
          }
          if (template.type === "condition") {
            this.debugService.updateFunctionBreakpoint(id, { condition: inputBox.value });
          }
          if (template.type === "hitCount") {
            this.debugService.updateFunctionBreakpoint(id, { hitCondition: inputBox.value });
          }
        } else {
          if (template.type === "name" && !template.breakpoint.name) {
            this.debugService.removeFunctionBreakpoints(id);
          } else {
            this.view.renderInputBox(void 0);
          }
        }
      } finally {
        template.updating = false;
      }
    };
    toDispose.add(dom.addStandardDisposableListener(inputBox.inputElement, "keydown", (e) => {
      const isEscape = e.equals(KeyCode.Escape);
      const isEnter = e.equals(KeyCode.Enter);
      if (isEscape || isEnter) {
        e.preventDefault();
        e.stopPropagation();
        wrapUp(isEnter);
      }
    }));
    toDispose.add(dom.addDisposableListener(inputBox.inputElement, "blur", () => {
      if (!template.updating) {
        wrapUp(!!inputBox.value);
      }
    }));
    template.inputBox = inputBox;
    template.elementDisposables = new DisposableStore();
    template.templateDisposables = toDispose;
    template.templateDisposables.add(template.elementDisposables);
    return template;
  }
  renderElement(node, _index, data) {
    const functionBreakpoint = node.element;
    data.breakpoint = functionBreakpoint;
    data.type = this.view.inputBoxData?.type || "name";
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), functionBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ? message : ""));
    data.checkbox.checked = functionBreakpoint.enabled;
    data.checkbox.disable();
    data.inputBox.value = functionBreakpoint.name || "";
    let placeholder = localize("functionBreakpointPlaceholder", "Function to break on");
    let ariaLabel = localize("functionBreakPointInputAriaLabel", "Type function breakpoint.");
    if (data.type === "condition") {
      data.inputBox.value = functionBreakpoint.condition || "";
      placeholder = localize("functionBreakpointExpressionPlaceholder", "Break when expression evaluates to true");
      ariaLabel = localize("functionBreakPointExpresionAriaLabel", "Type expression. Function breakpoint will break when expression evaluates to true");
    } else if (data.type === "hitCount") {
      data.inputBox.value = functionBreakpoint.hitCondition || "";
      placeholder = localize("functionBreakpointHitCountPlaceholder", "Break when hit count is met");
      ariaLabel = localize("functionBreakPointHitCountAriaLabel", "Type hit count. Function breakpoint will break when hit count is met.");
    }
    data.inputBox.setAriaLabel(ariaLabel);
    data.inputBox.setPlaceHolder(placeholder);
    setTimeout(() => {
      data.inputBox.focus();
      data.inputBox.select();
    }, 0);
  }
  renderCompressedElements(node, _index, data) {
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
class DataBreakpointInputRenderer {
  constructor(view, debugService, contextViewService, hoverService, labelService) {
    this.view = view;
    this.debugService = debugService;
    this.contextViewService = contextViewService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  static {
    this.ID = "databreakpointinput";
  }
  get templateId() {
    return DataBreakpointInputRenderer.ID;
  }
  renderTemplate(container) {
    const template = /* @__PURE__ */ Object.create(null);
    const toDispose = new DisposableStore();
    const breakpoint = dom.append(container, $(".breakpoint"));
    template.icon = $(".icon");
    template.checkbox = createCheckbox(toDispose);
    dom.append(breakpoint, template.icon);
    dom.append(breakpoint, template.checkbox.domNode);
    this.view.breakpointInputFocused.set(true);
    const inputBoxContainer = dom.append(breakpoint, $(".inputBoxContainer"));
    const inputBox = new InputBox(inputBoxContainer, this.contextViewService, { inputBoxStyles: defaultInputBoxStyles });
    toDispose.add(inputBox);
    const wrapUp = (success) => {
      template.updating = true;
      try {
        this.view.breakpointInputFocused.set(false);
        const id = template.breakpoint.getId();
        if (success) {
          if (template.type === "condition") {
            this.debugService.updateDataBreakpoint(id, { condition: inputBox.value });
          }
          if (template.type === "hitCount") {
            this.debugService.updateDataBreakpoint(id, { hitCondition: inputBox.value });
          }
        } else {
          this.view.renderInputBox(void 0);
        }
      } finally {
        template.updating = false;
      }
    };
    toDispose.add(dom.addStandardDisposableListener(inputBox.inputElement, "keydown", (e) => {
      const isEscape = e.equals(KeyCode.Escape);
      const isEnter = e.equals(KeyCode.Enter);
      if (isEscape || isEnter) {
        e.preventDefault();
        e.stopPropagation();
        wrapUp(isEnter);
      }
    }));
    toDispose.add(dom.addDisposableListener(inputBox.inputElement, "blur", () => {
      if (!template.updating) {
        wrapUp(!!inputBox.value);
      }
    }));
    template.inputBox = inputBox;
    template.elementDisposables = new DisposableStore();
    template.templateDisposables = toDispose;
    template.templateDisposables.add(template.elementDisposables);
    return template;
  }
  renderElement(node, _index, data) {
    const dataBreakpoint = node.element;
    data.breakpoint = dataBreakpoint;
    data.type = this.view.inputBoxData?.type || "condition";
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), dataBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ?? ""));
    data.checkbox.checked = dataBreakpoint.enabled;
    data.checkbox.disable();
    data.inputBox.value = "";
    let placeholder = "";
    let ariaLabel = "";
    if (data.type === "condition") {
      data.inputBox.value = dataBreakpoint.condition || "";
      placeholder = localize("dataBreakpointExpressionPlaceholder", "Break when expression evaluates to true");
      ariaLabel = localize("dataBreakPointExpresionAriaLabel", "Type expression. Data breakpoint will break when expression evaluates to true");
    } else if (data.type === "hitCount") {
      data.inputBox.value = dataBreakpoint.hitCondition || "";
      placeholder = localize("dataBreakpointHitCountPlaceholder", "Break when hit count is met");
      ariaLabel = localize("dataBreakPointHitCountAriaLabel", "Type hit count. Data breakpoint will break when hit count is met.");
    }
    data.inputBox.setAriaLabel(ariaLabel);
    data.inputBox.setPlaceHolder(placeholder);
    setTimeout(() => {
      data.inputBox.focus();
      data.inputBox.select();
    }, 0);
  }
  renderCompressedElements(node, _index, data) {
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
class ExceptionBreakpointInputRenderer {
  constructor(view, debugService, contextViewService) {
    this.view = view;
    this.debugService = debugService;
    this.contextViewService = contextViewService;
  }
  static {
    this.ID = "exceptionbreakpointinput";
  }
  get templateId() {
    return ExceptionBreakpointInputRenderer.ID;
  }
  renderTemplate(container) {
    const toDispose = new DisposableStore();
    const breakpoint = dom.append(container, $(".breakpoint"));
    breakpoint.classList.add("exception");
    const checkbox = createCheckbox(toDispose);
    dom.append(breakpoint, checkbox.domNode);
    this.view.breakpointInputFocused.set(true);
    const inputBoxContainer = dom.append(breakpoint, $(".inputBoxContainer"));
    const inputBox = new InputBox(inputBoxContainer, this.contextViewService, {
      ariaLabel: localize("exceptionBreakpointAriaLabel", "Type exception breakpoint condition"),
      inputBoxStyles: defaultInputBoxStyles
    });
    toDispose.add(inputBox);
    const wrapUp = (success) => {
      if (!templateData.currentBreakpoint) {
        return;
      }
      this.view.breakpointInputFocused.set(false);
      let newCondition = templateData.currentBreakpoint.condition;
      if (success) {
        newCondition = inputBox.value !== "" ? inputBox.value : void 0;
      }
      this.debugService.setExceptionBreakpointCondition(templateData.currentBreakpoint, newCondition);
    };
    toDispose.add(dom.addStandardDisposableListener(inputBox.inputElement, "keydown", (e) => {
      const isEscape = e.equals(KeyCode.Escape);
      const isEnter = e.equals(KeyCode.Enter);
      if (isEscape || isEnter) {
        e.preventDefault();
        e.stopPropagation();
        wrapUp(isEnter);
      }
    }));
    toDispose.add(dom.addDisposableListener(inputBox.inputElement, "blur", () => {
      setTimeout(() => {
        wrapUp(true);
      });
    }));
    const elementDisposables = new DisposableStore();
    toDispose.add(elementDisposables);
    const templateData = {
      inputBox,
      checkbox,
      templateDisposables: toDispose,
      elementDisposables: new DisposableStore()
    };
    return templateData;
  }
  renderElement(node, _index, data) {
    const exceptionBreakpoint = node.element;
    const placeHolder = exceptionBreakpoint.conditionDescription || localize("exceptionBreakpointPlaceholder", "Break when expression evaluates to true");
    data.inputBox.setPlaceHolder(placeHolder);
    data.currentBreakpoint = exceptionBreakpoint;
    data.checkbox.checked = exceptionBreakpoint.enabled;
    data.checkbox.disable();
    data.inputBox.value = exceptionBreakpoint.condition || "";
    setTimeout(() => {
      data.inputBox.focus();
      data.inputBox.select();
    }, 0);
  }
  renderCompressedElements(node, _index, data) {
  }
  disposeElement(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
class BreakpointsAccessibilityProvider {
  constructor(debugService, labelService) {
    this.debugService = debugService;
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return localize("breakpoints", "Breakpoints");
  }
  getRole() {
    return "checkbox";
  }
  isChecked(element) {
    if (element instanceof BreakpointsFolderItem) {
      return element.enabled;
    }
    return element.enabled;
  }
  getAriaLabel(element) {
    if (element instanceof BreakpointsFolderItem) {
      return localize("breakpointFolder", "Breakpoints in {0}, {1} breakpoints", resources.basenameOrAuthority(element.uri), element.breakpoints.length);
    }
    if (element instanceof ExceptionBreakpoint) {
      return element.toString();
    }
    const { message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), element, this.labelService, this.debugService.getModel());
    const toString = element.toString();
    return message ? `${toString}, ${message}` : toString;
  }
}
function openBreakpointSource(breakpoint, sideBySide, preserveFocus, pinned, debugService, editorService) {
  if (breakpoint.uri.scheme === DEBUG_SCHEME && debugService.state === State.Inactive) {
    return Promise.resolve(void 0);
  }
  const selection = breakpoint.endLineNumber ? {
    startLineNumber: breakpoint.lineNumber,
    endLineNumber: breakpoint.endLineNumber,
    startColumn: breakpoint.column || 1,
    endColumn: breakpoint.endColumn || Constants.MAX_SAFE_SMALL_INTEGER
  } : {
    startLineNumber: breakpoint.lineNumber,
    startColumn: breakpoint.column || 1,
    endLineNumber: breakpoint.lineNumber,
    endColumn: breakpoint.column || Constants.MAX_SAFE_SMALL_INTEGER
  };
  return editorService.openEditor({
    resource: breakpoint.uri,
    options: {
      preserveFocus,
      selection,
      revealIfOpened: true,
      selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport,
      pinned
    }
  }, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
}
function getBreakpointMessageAndIcon(state, breakpointsActivated, breakpoint, labelService, debugModel) {
  const debugActive = state === State.Running || state === State.Stopped;
  const breakpointIcon = breakpoint instanceof DataBreakpoint ? icons.dataBreakpoint : breakpoint instanceof FunctionBreakpoint ? icons.functionBreakpoint : breakpoint.logMessage ? icons.logBreakpoint : icons.breakpoint;
  if (!breakpoint.enabled || !breakpointsActivated) {
    return {
      icon: breakpointIcon.disabled,
      message: breakpoint.logMessage ? localize("disabledLogpoint", "Disabled Logpoint") : localize("disabledBreakpoint", "Disabled Breakpoint")
    };
  }
  const appendMessage = (text) => {
    return breakpoint.message ? text.concat(", " + breakpoint.message) : text;
  };
  if (debugActive && breakpoint instanceof Breakpoint && breakpoint.pending) {
    return {
      icon: icons.breakpoint.pending
    };
  }
  if (debugActive && !breakpoint.verified) {
    return {
      icon: breakpointIcon.unverified,
      message: breakpoint.message ? breakpoint.message : breakpoint.logMessage ? localize("unverifiedLogpoint", "Unverified Logpoint") : localize("unverifiedBreakpoint", "Unverified Breakpoint"),
      showAdapterUnverifiedMessage: true
    };
  }
  if (breakpoint instanceof DataBreakpoint) {
    if (!breakpoint.supported) {
      return {
        icon: breakpointIcon.unverified,
        message: localize("dataBreakpointUnsupported", "Data breakpoints not supported by this debug type")
      };
    }
    return {
      icon: breakpointIcon.regular,
      message: breakpoint.message || localize("dataBreakpoint", "Data Breakpoint")
    };
  }
  if (breakpoint instanceof FunctionBreakpoint) {
    if (!breakpoint.supported) {
      return {
        icon: breakpointIcon.unverified,
        message: localize("functionBreakpointUnsupported", "Function breakpoints not supported by this debug type")
      };
    }
    const messages = [];
    messages.push(breakpoint.message || localize("functionBreakpoint", "Function Breakpoint"));
    if (breakpoint.condition) {
      messages.push(localize("expression", "Condition: {0}", breakpoint.condition));
    }
    if (breakpoint.hitCondition) {
      messages.push(localize("hitCount", "Hit Count: {0}", breakpoint.hitCondition));
    }
    return {
      icon: breakpointIcon.regular,
      message: appendMessage(messages.join("\n"))
    };
  }
  if (breakpoint instanceof InstructionBreakpoint) {
    if (!breakpoint.supported) {
      return {
        icon: breakpointIcon.unverified,
        message: localize("instructionBreakpointUnsupported", "Instruction breakpoints not supported by this debug type")
      };
    }
    const messages = [];
    if (breakpoint.message) {
      messages.push(breakpoint.message);
    } else if (breakpoint.instructionReference) {
      messages.push(localize("instructionBreakpointAtAddress", "Instruction breakpoint at address {0}", breakpoint.instructionReference));
    } else {
      messages.push(localize("instructionBreakpoint", "Instruction breakpoint"));
    }
    if (breakpoint.hitCondition) {
      messages.push(localize("hitCount", "Hit Count: {0}", breakpoint.hitCondition));
    }
    return {
      icon: breakpointIcon.regular,
      message: appendMessage(messages.join("\n"))
    };
  }
  let triggeringBreakpoint;
  if (breakpoint instanceof Breakpoint && breakpoint.triggeredBy) {
    triggeringBreakpoint = debugModel.getBreakpoints().find((bp) => bp.getId() === breakpoint.triggeredBy);
  }
  if (breakpoint.logMessage || breakpoint.condition || breakpoint.hitCondition || triggeringBreakpoint) {
    const messages = [];
    let icon = breakpoint.logMessage ? icons.logBreakpoint.regular : icons.conditionalBreakpoint.regular;
    if (!breakpoint.supported) {
      icon = icons.debugBreakpointUnsupported;
      messages.push(localize("breakpointUnsupported", "Breakpoints of this type are not supported by the debugger"));
    }
    if (breakpoint.logMessage) {
      messages.push(localize("logMessage", "Log Message: {0}", breakpoint.logMessage));
    }
    if (breakpoint.condition) {
      messages.push(localize("expression", "Condition: {0}", breakpoint.condition));
    }
    if (breakpoint.hitCondition) {
      messages.push(localize("hitCount", "Hit Count: {0}", breakpoint.hitCondition));
    }
    if (triggeringBreakpoint) {
      messages.push(localize("triggeredBy", "Hit after breakpoint: {0}", `${labelService.getUriLabel(triggeringBreakpoint.uri, { relative: true })}: ${triggeringBreakpoint.lineNumber}`));
    }
    return {
      icon,
      message: appendMessage(messages.join("\n"))
    };
  }
  const message = breakpoint.message ? breakpoint.message : breakpoint instanceof Breakpoint && labelService ? labelService.getUriLabel(breakpoint.uri) : localize("breakpoint", "Breakpoint");
  return {
    icon: breakpointIcon.regular,
    message
  };
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.addFunctionBreakpointAction",
      title: {
        ...localize2("addFunctionBreakpoint", "Add Function Breakpoint"),
        mnemonicTitle: localize({ key: "miFunctionBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Function Breakpoint...")
      },
      f1: true,
      icon: icons.watchExpressionsAddFuncBreakpoint,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 10,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }, {
        id: MenuId.MenubarNewBreakpointMenu,
        group: "1_breakpoints",
        order: 3,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    const viewService = accessor.get(IViewsService);
    await viewService.openView(BREAKPOINTS_VIEW_ID);
    debugService.addFunctionBreakpoint();
  }
});
class MemoryBreakpointAction extends Action2 {
  async run(accessor, existingBreakpoint) {
    const debugService = accessor.get(IDebugService);
    const session = debugService.getViewModel().focusedSession;
    if (!session) {
      return;
    }
    let defaultValue = void 0;
    if (existingBreakpoint && existingBreakpoint.src.type === DataBreakpointSetType.Address) {
      defaultValue = `${existingBreakpoint.src.address} + ${existingBreakpoint.src.bytes}`;
    }
    const quickInput = accessor.get(IQuickInputService);
    const notifications = accessor.get(INotificationService);
    const range = await this.getRange(quickInput, defaultValue);
    if (!range) {
      return;
    }
    let info;
    try {
      info = await session.dataBytesBreakpointInfo(range.address, range.bytes);
    } catch (e) {
      notifications.error(localize("dataBreakpointError", "Failed to set data breakpoint at {0}: {1}", range.address, e.message));
    }
    if (!info?.dataId) {
      return;
    }
    let accessType = "write";
    if (info.accessTypes && info.accessTypes?.length > 1) {
      const accessTypes = info.accessTypes.map((type) => ({ label: type }));
      const selectedAccessType = await quickInput.pick(accessTypes, { placeHolder: localize("dataBreakpointAccessType", "Select the access type to monitor") });
      if (!selectedAccessType) {
        return;
      }
      accessType = selectedAccessType.label;
    }
    const src = { type: DataBreakpointSetType.Address, ...range };
    if (existingBreakpoint) {
      await debugService.removeDataBreakpoints(existingBreakpoint.getId());
    }
    await debugService.addDataBreakpoint({
      description: info.description,
      src,
      canPersist: true,
      accessTypes: info.accessTypes,
      accessType,
      initialSessionData: { session, dataId: info.dataId }
    });
  }
  getRange(quickInput, defaultValue) {
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      const input = disposables.add(quickInput.createInputBox());
      input.prompt = localize("dataBreakpointMemoryRangePrompt", "Enter a memory range in which to break");
      input.placeholder = localize("dataBreakpointMemoryRangePlaceholder", "Absolute range (0x1234 - 0x1300) or range of bytes after an address (0x1234 + 0xff)");
      if (defaultValue) {
        input.value = defaultValue;
        input.valueSelection = [0, defaultValue.length];
      }
      disposables.add(input.onDidChangeValue((e) => {
        const err = this.parseAddress(e, false);
        input.validationMessage = err?.error;
      }));
      disposables.add(input.onDidAccept(() => {
        const r = this.parseAddress(input.value, true);
        if (hasKey(r, { error: true })) {
          input.validationMessage = r.error;
        } else {
          resolve(r);
        }
        input.dispose();
      }));
      disposables.add(input.onDidHide(() => {
        resolve(void 0);
        disposables.dispose();
      }));
      input.ignoreFocusOut = true;
      input.show();
    });
  }
  parseAddress(range, isFinal) {
    const parts = /^(\S+)\s*(?:([+-])\s*(\S+))?/.exec(range);
    if (!parts) {
      return { error: localize("dataBreakpointAddrFormat", 'Address should be a range of numbers the form "[Start] - [End]" or "[Start] + [Bytes]"') };
    }
    const isNum = (e) => isFinal ? /^0x[0-9a-f]*|[0-9]*$/i.test(e) : /^0x[0-9a-f]+|[0-9]+$/i.test(e);
    const [, startStr, sign = "+", endStr = "1"] = parts;
    for (const n of [startStr, endStr]) {
      if (!isNum(n)) {
        return { error: localize("dataBreakpointAddrStartEnd", 'Number must be a decimal integer or hex value starting with "0x", got {0}', n) };
      }
    }
    if (!isFinal) {
      return;
    }
    const start = BigInt(startStr);
    const end = BigInt(endStr);
    const address = `0x${start.toString(16)}`;
    if (sign === "-") {
      if (start > end) {
        return { error: localize("dataBreakpointAddrOrder", "End ({1}) should be greater than Start ({0})", startStr, endStr) };
      }
      return { address, bytes: Number(end - start) };
    }
    return { address, bytes: Number(end) };
  }
}
registerAction2(class extends MemoryBreakpointAction {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.addDataBreakpointOnAddress",
      title: {
        ...localize2("addDataBreakpointOnAddress", "Add Data Breakpoint at Address"),
        mnemonicTitle: localize({ key: "miDataBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Data Breakpoint...")
      },
      f1: true,
      icon: icons.watchExpressionsAddDataBreakpoint,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 11,
        when: ContextKeyExpr.and(CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED, ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID))
      }, {
        id: MenuId.MenubarNewBreakpointMenu,
        group: "1_breakpoints",
        order: 4,
        when: CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED
      }]
    });
  }
});
registerAction2(class extends MemoryBreakpointAction {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.editDataBreakpointOnAddress",
      title: localize2("editDataBreakpointOnAddress", "Edit Address..."),
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        when: ContextKeyExpr.and(CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED, CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES),
        group: "navigation",
        order: 15
      }]
    });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.toggleBreakpointsActivatedAction",
      title: localize2("activateBreakpoints", "Toggle Activate Breakpoints"),
      f1: true,
      icon: icons.breakpointsActivate,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 20,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.setBreakpointsActivated(!debugService.getModel().areBreakpointsActivated());
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.removeBreakpoint",
      title: localize("removeBreakpoint", "Remove Breakpoint"),
      icon: Codicon.removeClose,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "3_modification",
        order: 10,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint")
      }, {
        id: MenuId.DebugBreakpointsContext,
        group: "inline",
        order: 20,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint")
      }]
    });
  }
  async run(accessor, breakpoint) {
    const debugService = accessor.get(IDebugService);
    if (breakpoint instanceof Breakpoint) {
      await debugService.removeBreakpoints(breakpoint.getId());
    } else if (breakpoint instanceof FunctionBreakpoint) {
      await debugService.removeFunctionBreakpoints(breakpoint.getId());
    } else if (breakpoint instanceof DataBreakpoint) {
      await debugService.removeDataBreakpoints(breakpoint.getId());
    } else if (breakpoint instanceof InstructionBreakpoint) {
      await debugService.removeInstructionBreakpoints(breakpoint.instructionReference, breakpoint.offset);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.removeAllBreakpoints",
      title: {
        ...localize2("removeAllBreakpoints", "Remove All Breakpoints"),
        mnemonicTitle: localize({ key: "miRemoveAllBreakpoints", comment: ["&& denotes a mnemonic"] }, "Remove &&All Breakpoints")
      },
      f1: true,
      icon: icons.breakpointsRemoveAll,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 30,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }, {
        id: MenuId.DebugBreakpointsContext,
        group: "3_modification",
        order: 20,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }, {
        id: MenuId.MenubarDebugMenu,
        group: "5_breakpoints",
        order: 3,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.removeBreakpoints();
    debugService.removeFunctionBreakpoints();
    debugService.removeDataBreakpoints();
    debugService.removeInstructionBreakpoints();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.enableAllBreakpoints",
      title: {
        ...localize2("enableAllBreakpoints", "Enable All Breakpoints"),
        mnemonicTitle: localize({ key: "miEnableAllBreakpoints", comment: ["&& denotes a mnemonic"] }, "&&Enable All Breakpoints")
      },
      f1: true,
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "z_commands",
        order: 10,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }, {
        id: MenuId.MenubarDebugMenu,
        group: "5_breakpoints",
        order: 1,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    await debugService.enableOrDisableBreakpoints(true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.disableAllBreakpoints",
      title: {
        ...localize2("disableAllBreakpoints", "Disable All Breakpoints"),
        mnemonicTitle: localize({ key: "miDisableAllBreakpoints", comment: ["&& denotes a mnemonic"] }, "Disable A&&ll Breakpoints")
      },
      f1: true,
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "z_commands",
        order: 20,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }, {
        id: MenuId.MenubarDebugMenu,
        group: "5_breakpoints",
        order: 2,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    await debugService.enableOrDisableBreakpoints(false);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.reapplyBreakpointsAction",
      title: localize2("reapplyAllBreakpoints", "Reapply All Breakpoints"),
      f1: true,
      precondition: CONTEXT_IN_DEBUG_MODE,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "z_commands",
        order: 30,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    await debugService.setBreakpointsActivated(true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.toggleBreakpointsPresentation",
      title: localize2("toggleBreakpointsPresentation", "Toggle Breakpoints View Presentation"),
      f1: true,
      icon: icons.breakpointsViewIcon,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 10,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }
    });
  }
  async run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const currentPresentation = configurationService.getValue("debug.breakpointsView.presentation");
    const newPresentation = currentPresentation === "tree" ? "list" : "tree";
    await configurationService.updateValue("debug.breakpointsView.presentation", newPresentation);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editBreakpoint",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editCondition", "Edit Condition..."),
      icon: Codicon.edit,
      precondition: CONTEXT_BREAKPOINT_SUPPORTS_CONDITION,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("functionBreakpoint"),
        group: "navigation",
        order: 10
      }, {
        id: MenuId.DebugBreakpointsContext,
        group: "inline",
        order: 10
      }]
    });
  }
  async runInView(accessor, view, breakpoint) {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    if (breakpoint instanceof Breakpoint) {
      const editor = await openBreakpointSource(breakpoint, false, false, true, debugService, editorService);
      if (editor) {
        const codeEditor = editor.getControl();
        if (isCodeEditor(codeEditor)) {
          codeEditor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(breakpoint.lineNumber, breakpoint.column);
        }
      }
    } else if (breakpoint instanceof FunctionBreakpoint) {
      const contextMenuService = accessor.get(IContextMenuService);
      const actions = [
        new Action("breakpoint.editCondition", localize("editCondition", "Edit Condition..."), void 0, true, async () => view.renderInputBox({ breakpoint, type: "condition" })),
        new Action("breakpoint.editCondition", localize("editHitCount", "Edit Hit Count..."), void 0, true, async () => view.renderInputBox({ breakpoint, type: "hitCount" }))
      ];
      const domNode = breakpointIdToActionBarDomeNode.get(breakpoint.getId());
      if (domNode) {
        contextMenuService.showContextMenu({
          getActions: () => actions,
          getAnchor: () => domNode,
          onHide: () => dispose(actions)
        });
      }
    } else {
      view.renderInputBox({ breakpoint, type: "condition" });
    }
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editFunctionBreakpoint",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editBreakpoint", "Edit Function Condition..."),
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "navigation",
        order: 10,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("functionBreakpoint")
      }]
    });
  }
  runInView(_accessor, view, breakpoint) {
    view.renderInputBox({ breakpoint, type: "name" });
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editFunctionBreakpointHitCount",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editHitCount", "Edit Hit Count..."),
      precondition: CONTEXT_BREAKPOINT_SUPPORTS_CONDITION,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "navigation",
        order: 20,
        when: ContextKeyExpr.or(CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("functionBreakpoint"), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("dataBreakpoint"))
      }]
    });
  }
  runInView(_accessor, view, breakpoint) {
    view.renderInputBox({ breakpoint, type: "hitCount" });
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editBreakpointMode",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editMode", "Edit Mode..."),
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "navigation",
        order: 20,
        when: ContextKeyExpr.and(
          CONTEXT_BREAKPOINT_HAS_MODES,
          ContextKeyExpr.or(CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("breakpoint"), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("exceptionBreakpoint"), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("instructionBreakpoint"))
        )
      }]
    });
  }
  async runInView(accessor, view, breakpoint) {
    const debugService = accessor.get(IDebugService);
    const kind = getModeKindForBreakpoint(breakpoint);
    const modes = debugService.getModel().getBreakpointModes(kind);
    const picked = await accessor.get(IQuickInputService).pick(
      modes.map((mode) => ({ label: mode.label, description: mode.description, mode: mode.mode })),
      { placeHolder: localize("selectBreakpointMode", "Select Breakpoint Mode") }
    );
    if (!picked) {
      return;
    }
    if (kind === "source") {
      const data = /* @__PURE__ */ new Map();
      data.set(breakpoint.getId(), { mode: picked.mode, modeLabel: picked.label });
      debugService.updateBreakpoints(breakpoint.originalUri, data, false);
    } else if (breakpoint instanceof InstructionBreakpoint) {
      debugService.removeInstructionBreakpoints(breakpoint.instructionReference, breakpoint.offset);
      debugService.addInstructionBreakpoint({ ...breakpoint.toJSON(), mode: picked.mode, modeLabel: picked.label });
    } else if (breakpoint instanceof ExceptionBreakpoint) {
      breakpoint.mode = picked.mode;
      breakpoint.modeLabel = picked.label;
      debugService.setExceptionBreakpointCondition(breakpoint, breakpoint.condition);
    }
  }
});
export {
  BreakpointsFolderItem,
  BreakpointsView,
  getBreakpointMessageAndIcon,
  getExpandedBodySize,
  openBreakpointSource
};
