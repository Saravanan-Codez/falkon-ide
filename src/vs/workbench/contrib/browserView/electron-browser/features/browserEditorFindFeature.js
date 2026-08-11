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
import { localize, localize2 } from "../../../../../nls.js";
import { $, DisposableResizeObserver, getWindow } from "../../../../../base/browser/dom.js";
import { IContextKeyService, ContextKeyExpr, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { Action2, registerAction2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Emitter } from "../../../../../base/common/event.js";
import { BrowserViewCommandId } from "../../../../../platform/browserView/common/browserView.js";
import { SimpleFindWidget } from "../../../codeEditor/browser/find/simpleFindWidget.js";
import { IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { BrowserEditor, BrowserEditorContribution, BrowserWidgetLocation, BROWSER_EDITOR_ACTIVE, BrowserActionCategory, BrowserActionGroup, CONTEXT_BROWSER_HAS_ERROR, CONTEXT_BROWSER_HAS_URL } from "../browserEditor.js";
import { Codicon } from "../../../../../base/common/codicons.js";
const CONTEXT_BROWSER_FIND_WIDGET_VISIBLE = new RawContextKey("browserFindWidgetVisible", false, localize("browser.findWidgetVisible", "Whether the browser find widget is visible"));
const CONTEXT_BROWSER_FIND_WIDGET_FOCUSED = new RawContextKey("browserFindWidgetFocused", false, localize("browser.findWidgetFocused", "Whether the browser find widget is focused"));
let BrowserFindWidget = class extends SimpleFindWidget {
  constructor(container, contextViewService, contextKeyService, hoverService, keybindingService, configurationService, accessibilityService) {
    super({
      showCommonFindToggles: true,
      checkImeCompletionState: true,
      showResultCount: true,
      enableSash: true,
      initialWidth: 350,
      previousMatchActionId: BrowserViewCommandId.FindPrevious,
      nextMatchActionId: BrowserViewCommandId.FindNext,
      closeWidgetActionId: BrowserViewCommandId.HideFind
    }, contextViewService, contextKeyService, hoverService, keybindingService, configurationService, accessibilityService);
    this._modelDisposables = this._register(new DisposableStore());
    this._hasFoundMatch = false;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._findWidgetVisible = CONTEXT_BROWSER_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
    this._findWidgetFocused = CONTEXT_BROWSER_FIND_WIDGET_FOCUSED.bindTo(contextKeyService);
    const domNode = this.getDomNode();
    container.appendChild(domNode);
    let lastHeight = domNode.offsetHeight;
    const resizeObserver = this._register(new DisposableResizeObserver("BrowserEditorFindFeature.heightChange", () => {
      const newHeight = domNode.offsetHeight;
      if (newHeight !== lastHeight) {
        lastHeight = newHeight;
        this._onDidChangeHeight.fire();
      }
    }, getWindow(container)));
    this._register(resizeObserver.observe(domNode));
  }
  /**
   * Set the browser view model to use for find operations.
   * This should be called whenever the editor input changes.
   */
  setModel(model) {
    this._modelDisposables.clear();
    this._model = model;
    this._lastFindResult = void 0;
    this._hasFoundMatch = false;
    if (model) {
      this._modelDisposables.add(model.onDidFindInPage((result) => {
        this._lastFindResult = {
          resultIndex: result.activeMatchOrdinal - 1,
          // Convert to 0-based index
          resultCount: result.matches
        };
        this._hasFoundMatch = result.matches > 0;
        this.updateButtons(this._hasFoundMatch);
        this.updateResultCount();
      }));
      this._modelDisposables.add(model.onWillDispose(() => {
        this.setModel(void 0);
      }));
    }
  }
  reveal(initialInput) {
    const wasVisible = this.isVisible();
    super.reveal(initialInput);
    this._findWidgetVisible.set(true);
    this.focusFindBox();
    if (this.inputValue && !wasVisible) {
      this._onInputChanged();
    }
  }
  hide() {
    super.hide(false);
    this._findWidgetVisible.reset();
    this._model?.stopFindInPage(true);
    this._model?.focus();
    this._lastFindResult = void 0;
    this._hasFoundMatch = false;
  }
  find(previous) {
    const value = this.inputValue;
    if (value && this._model) {
      this._model.findInPage(value, {
        forward: !previous,
        recompute: false,
        matchCase: this._getCaseSensitiveValue()
      });
    }
  }
  findFirst() {
    const value = this.inputValue;
    if (value && this._model) {
      this._model.findInPage(value, {
        forward: true,
        recompute: true,
        matchCase: this._getCaseSensitiveValue()
      });
    }
  }
  clear() {
    if (this._model) {
      this._model.stopFindInPage(false);
      this._lastFindResult = void 0;
      this._hasFoundMatch = false;
    }
  }
  _onInputChanged() {
    if (this.inputValue) {
      this.findFirst();
    } else if (this._model) {
      this.clear();
    }
    return false;
  }
  async _getResultCount() {
    return this._lastFindResult;
  }
  _onFocusTrackerFocus() {
    this._findWidgetFocused.set(true);
  }
  _onFocusTrackerBlur() {
    this._findWidgetFocused.reset();
  }
  _onFindInputFocusTrackerFocus() {
  }
  _onFindInputFocusTrackerBlur() {
  }
};
BrowserFindWidget = __decorateClass([
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IAccessibilityService)
], BrowserFindWidget);
let BrowserEditorFindContribution = class extends BrowserEditorContribution {
  constructor(editor, instantiationService) {
    super(editor);
    this.instantiationService = instantiationService;
    this._findWidgetContainer = $(".browser-find-widget-wrapper");
    this._findWidget = new Lazy(() => {
      const findWidget = this.instantiationService.createInstance(
        BrowserFindWidget,
        this._findWidgetContainer
      );
      if (editor.model) {
        findWidget.setModel(editor.model);
      }
      findWidget.onDidChangeHeight(() => {
        editor.layoutBrowserContainer();
      });
      return findWidget;
    });
    this._register(toDisposable(() => this._findWidget.rawValue?.dispose()));
  }
  /**
   * The container element to insert below the toolbar.
   */
  get widgets() {
    return [{ location: BrowserWidgetLocation.Toolbar, element: this._findWidgetContainer, order: 0 }];
  }
  onModelAttached(model, _store) {
    this._findWidget.rawValue?.setModel(model);
  }
  onModelDetached() {
    this._findWidget.rawValue?.setModel(void 0);
    this._findWidget.rawValue?.hide();
  }
  onPaneResized(width) {
    this._findWidget.rawValue?.layout(width);
  }
  /**
   * Show the find widget, optionally pre-populated with selected text from the browser view
   */
  async showFind() {
    const selectedText = (await this.editor.model?.getSelectedText())?.trim();
    const textToReveal = selectedText && !/[\r\n]/.test(selectedText) ? selectedText : void 0;
    this._findWidget.value.reveal(textToReveal);
    this._findWidget.value.layout(this._findWidgetContainer.clientWidth);
  }
  /**
   * Hide the find widget
   */
  hideFind() {
    this._findWidget.rawValue?.hide();
  }
  /**
   * Find the next match
   */
  findNext() {
    this._findWidget.rawValue?.find(false);
  }
  /**
   * Find the previous match
   */
  findPrevious() {
    this._findWidget.rawValue?.find(true);
  }
};
BrowserEditorFindContribution = __decorateClass([
  __decorateParam(1, IInstantiationService)
], BrowserEditorFindContribution);
BrowserEditor.registerContribution(BrowserEditorFindContribution);
class ShowBrowserFindAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ShowFind;
  }
  constructor() {
    super({
      id: ShowBrowserFindAction.ID,
      title: localize2("browser.showFindAction", "Find in Page"),
      category: BrowserActionCategory,
      icon: Codicon.search,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL, CONTEXT_BROWSER_HAS_ERROR.negate()),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Tools,
        order: 0,
        isHiddenByDefault: true
      },
      keybinding: {
        weight: KeybindingWeight.EditorContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyF
      }
    });
  }
  run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      void browserEditor.getContribution(BrowserEditorFindContribution)?.showFind();
    }
  }
}
class HideBrowserFindAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.HideFind;
  }
  constructor() {
    super({
      id: HideBrowserFindAction.ID,
      title: localize2("browser.hideFindAction", "Close Find Widget"),
      category: BrowserActionCategory,
      f1: false,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_FIND_WIDGET_VISIBLE),
      keybinding: {
        weight: KeybindingWeight.EditorContrib + 5,
        primary: KeyCode.Escape
      }
    });
  }
  run(accessor) {
    const browserEditor = accessor.get(IEditorService).activeEditorPane;
    if (browserEditor instanceof BrowserEditor) {
      browserEditor.getContribution(BrowserEditorFindContribution)?.hideFind();
    }
  }
}
class BrowserFindNextAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.FindNext;
  }
  constructor() {
    super({
      id: BrowserFindNextAction.ID,
      title: localize2("browser.findNextAction", "Find Next"),
      category: BrowserActionCategory,
      f1: false,
      precondition: BROWSER_EDITOR_ACTIVE,
      keybinding: [{
        when: CONTEXT_BROWSER_FIND_WIDGET_FOCUSED,
        weight: KeybindingWeight.EditorContrib,
        primary: KeyCode.Enter
      }, {
        when: CONTEXT_BROWSER_FIND_WIDGET_VISIBLE,
        weight: KeybindingWeight.EditorContrib,
        primary: KeyCode.F3,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyG }
      }]
    });
  }
  run(accessor) {
    const browserEditor = accessor.get(IEditorService).activeEditorPane;
    if (browserEditor instanceof BrowserEditor) {
      browserEditor.getContribution(BrowserEditorFindContribution)?.findNext();
    }
  }
}
class BrowserFindPreviousAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.FindPrevious;
  }
  constructor() {
    super({
      id: BrowserFindPreviousAction.ID,
      title: localize2("browser.findPreviousAction", "Find Previous"),
      category: BrowserActionCategory,
      f1: false,
      precondition: BROWSER_EDITOR_ACTIVE,
      keybinding: [{
        when: CONTEXT_BROWSER_FIND_WIDGET_FOCUSED,
        weight: KeybindingWeight.EditorContrib,
        primary: KeyMod.Shift | KeyCode.Enter
      }, {
        when: CONTEXT_BROWSER_FIND_WIDGET_VISIBLE,
        weight: KeybindingWeight.EditorContrib,
        primary: KeyMod.Shift | KeyCode.F3,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG }
      }]
    });
  }
  run(accessor) {
    const browserEditor = accessor.get(IEditorService).activeEditorPane;
    if (browserEditor instanceof BrowserEditor) {
      browserEditor.getContribution(BrowserEditorFindContribution)?.findPrevious();
    }
  }
}
registerAction2(ShowBrowserFindAction);
registerAction2(HideBrowserFindAction);
registerAction2(BrowserFindNextAction);
registerAction2(BrowserFindPreviousAction);
export {
  BrowserEditorFindContribution
};
