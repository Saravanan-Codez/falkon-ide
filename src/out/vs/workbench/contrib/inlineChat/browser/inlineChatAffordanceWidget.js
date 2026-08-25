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
import "./media/inlineChatEditorAffordance.css";
import * as dom from "../../../../base/browser/dom.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { ContentWidgetPositionPreference } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { SelectionDirection } from "../../../../editor/common/core/selection.js";
import { computeIndentLevel } from "../../../../editor/common/model/utils.js";
import { autorun } from "../../../../base/common/observable.js";
import { MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { quickFixCommandId } from "../../../../editor/contrib/codeAction/browser/codeAction.js";
import { CodeActionController } from "../../../../editor/contrib/codeAction/browser/codeActionController.js";
import { MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ACTION_START, ACTION_ASK_IN_CHAT } from "../common/inlineChat.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
let QuickFixActionViewItem = class extends MenuEntryActionViewItem {
  #lightBulbStore = this._store.add(new MutableDisposable());
  #currentTitle;
  #editor;
  constructor(action, editor, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService, commandService) {
    const wrappedAction = new class extends MenuItemAction {
      constructor() {
        super(action.item, action.alt?.item, {}, action.hideActions, action.menuKeybinding, contextKeyService, commandService);
        this.elementGetter = () => void 0;
      }
      async run(...args) {
        const controller = CodeActionController.get(editor);
        const info = controller?.lightBulbState.get();
        const element = this.elementGetter();
        if (controller && info && element) {
          const { bottom, left } = element.getBoundingClientRect();
          await controller.showCodeActions(info.trigger, info.actions, { x: left, y: bottom });
        }
      }
    }();
    super(wrappedAction, { draggable: false }, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
    this.#editor = editor;
    wrappedAction.elementGetter = () => this.element;
  }
  render(container) {
    super.render(container);
    this.#updateFromLightBulb();
  }
  getTooltip() {
    return this.#currentTitle ?? super.getTooltip();
  }
  #updateFromLightBulb() {
    const controller = CodeActionController.get(this.#editor);
    if (!controller) {
      return;
    }
    const store = new DisposableStore();
    this.#lightBulbStore.value = store;
    store.add(autorun((reader) => {
      const info = controller.lightBulbState.read(reader);
      if (this.label) {
        const icon = info?.icon ?? Codicon.lightBulb;
        const iconClasses = ThemeIcon.asClassNameArray(icon);
        this.label.className = "";
        this.label.classList.add("codicon", "action-label", ...iconClasses);
      }
      this.#currentTitle = info?.title;
      this.updateTooltip();
    }));
  }
};
QuickFixActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IAccessibilityService),
  __decorateParam(8, ICommandService)
], QuickFixActionViewItem);
let LabelWithKeybindingActionViewItem = class extends MenuEntryActionViewItem {
  #kbLabel;
  constructor(action, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService) {
    super(action, { draggable: false }, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
    this.options.label = true;
    this.options.icon = false;
    this.#kbLabel = keybindingService.lookupKeybinding(action.id)?.getLabel() ?? void 0;
  }
  updateLabel() {
    if (this.label) {
      dom.reset(
        this.label,
        this.action.label,
        ...this.#kbLabel ? [dom.$("span.inline-chat-keybinding", void 0, this.#kbLabel)] : []
      );
    }
  }
};
LabelWithKeybindingActionViewItem = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IAccessibilityService)
], LabelWithKeybindingActionViewItem);
let InlineChatAffordanceWidget = class extends Disposable {
  constructor(editor, selection, instantiationService) {
    super();
    this.#id = `inline-chat-content-widget-${InlineChatAffordanceWidget.#idPool++}`;
    this.#position = null;
    this.#isVisible = false;
    this.#onDidRunAction = this._store.add(new Emitter());
    this.onDidRunAction = this.#onDidRunAction.event;
    this.allowEditorOverflow = true;
    this.suppressMouseDown = false;
    this.#editor = editor;
    this.#domNode = dom.$(".inline-chat-content-widget");
    const toolbar = this._store.add(instantiationService.createInstance(MenuWorkbenchToolBar, this.#domNode, MenuId.InlineChatEditorAffordance, {
      telemetrySource: "inlineChatEditorAffordance",
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      menuOptions: { renderShortTitle: true },
      toolbarOptions: { primaryGroup: () => true, useSeparatorsInPrimaryActions: true },
      actionViewItemProvider: (action) => {
        if (action instanceof MenuItemAction && action.id === quickFixCommandId) {
          return instantiationService.createInstance(QuickFixActionViewItem, action, this.#editor);
        }
        if (action instanceof MenuItemAction && (action.id === ACTION_START || action.id === ACTION_ASK_IN_CHAT || action.id === "inlineChat.fixDiagnostics")) {
          return instantiationService.createInstance(LabelWithKeybindingActionViewItem, action);
        }
        return void 0;
      }
    }));
    this._store.add(toolbar.actionRunner.onDidRun((e) => {
      this.#onDidRunAction.fire(e.action.id);
      this.#hide();
    }));
    this._store.add(autorun((r) => {
      const sel = selection.read(r);
      if (sel) {
        this.#show(sel);
      } else {
        this.#hide();
      }
    }));
    this._store.add(this.#editor.onDidScrollChange(() => {
      const sel = selection.get();
      if (!sel) {
        return;
      }
      const isInViewport = this.#isPositionInViewport();
      if (isInViewport && !this.#isVisible) {
        this.#show(sel);
      } else if (!isInViewport && this.#isVisible) {
        this.#hide();
      }
    }));
  }
  static #idPool = 0;
  #id;
  #domNode;
  #position;
  #isVisible;
  #onDidRunAction;
  #editor;
  #show(selection) {
    if (selection.isEmpty()) {
      this.#showAtLineStart(selection.getPosition().lineNumber);
    } else {
      this.#showAtSelection(selection);
    }
    if (this.#isVisible) {
      this.#editor.layoutContentWidget(this);
    } else {
      this.#editor.addContentWidget(this);
      this.#isVisible = true;
    }
  }
  #showAtSelection(selection) {
    const cursorPosition = selection.getPosition();
    const direction = selection.getDirection();
    const preference = direction === SelectionDirection.RTL ? ContentWidgetPositionPreference.ABOVE : ContentWidgetPositionPreference.BELOW;
    this.#position = {
      position: cursorPosition,
      preference: [preference]
    };
  }
  #showAtLineStart(lineNumber) {
    const model = this.#editor.getModel();
    if (!model) {
      return;
    }
    const tabSize = model.getOptions().tabSize;
    const fontInfo = this.#editor.getOptions().get(EditorOption.fontInfo);
    const lineContent = model.getLineContent(lineNumber);
    const indent = computeIndentLevel(lineContent, tabSize);
    const lineHasSpace = indent < 0 ? true : fontInfo.spaceWidth * indent > 22;
    let effectiveLineNumber = lineNumber;
    if (!lineHasSpace) {
      const isLineEmptyOrIndented = (ln) => {
        const content = model.getLineContent(ln);
        return /^\s*$|^\s+/.test(content);
      };
      const lineCount = model.getLineCount();
      if (lineNumber > 1 && isLineEmptyOrIndented(lineNumber - 1)) {
        effectiveLineNumber = lineNumber - 1;
      } else if (lineNumber < lineCount && isLineEmptyOrIndented(lineNumber + 1)) {
        effectiveLineNumber = lineNumber + 1;
      }
    }
    const effectiveColumnNumber = /^\S\s*$/.test(model.getLineContent(effectiveLineNumber)) ? 2 : 1;
    this.#position = {
      position: { lineNumber: effectiveLineNumber, column: effectiveColumnNumber },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  #isPositionInViewport() {
    const widgetPosition = this.#position?.position;
    if (!widgetPosition) {
      return false;
    }
    const visibleRanges = this.#editor.getVisibleRanges();
    const isLineVisible = visibleRanges.some(
      (range) => widgetPosition.lineNumber >= range.startLineNumber && widgetPosition.lineNumber <= range.endLineNumber
    );
    if (!isLineVisible) {
      return false;
    }
    const scrolledPos = this.#editor.getScrolledVisiblePosition(widgetPosition);
    if (!scrolledPos) {
      return false;
    }
    const layoutInfo = this.#editor.getOptions().get(EditorOption.layoutInfo);
    return scrolledPos.left >= 0 && scrolledPos.left <= layoutInfo.width;
  }
  #hide() {
    if (this.#isVisible) {
      this.#isVisible = false;
      this.#editor.removeContentWidget(this);
    }
  }
  getId() {
    return this.#id;
  }
  getDomNode() {
    return this.#domNode;
  }
  getPosition() {
    return this.#position;
  }
  beforeRender() {
    const position = this.#editor.getPosition();
    const lineHeight = position ? this.#editor.getLineHeightForPosition(position) : this.#editor.getOption(EditorOption.lineHeight);
    this.#domNode.style.setProperty("--vscode-inline-chat-affordance-height", `${lineHeight}px`);
    return null;
  }
  dispose() {
    if (this.#isVisible) {
      this.#editor.removeContentWidget(this);
    }
    super.dispose();
  }
};
InlineChatAffordanceWidget = __decorateClass([
  __decorateParam(2, IInstantiationService)
], InlineChatAffordanceWidget);
export {
  InlineChatAffordanceWidget
};
