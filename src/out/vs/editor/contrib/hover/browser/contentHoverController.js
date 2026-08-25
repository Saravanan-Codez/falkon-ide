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
import { DECREASE_HOVER_VERBOSITY_ACTION_ID, INCREASE_HOVER_VERBOSITY_ACTION_ID, SHOW_OR_FOCUS_HOVER_ACTION_ID } from "./hoverActionIds.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { InlineSuggestionHintsContentWidget } from "../../inlineCompletions/browser/hintsWidget/inlineCompletionsHintsWidget.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ResultKind } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { isMousePositionWithinElement, shouldShowHover, isTriggerModifierPressed } from "./hoverUtils.js";
import { ContentHoverWidgetWrapper } from "./contentHoverWidgetWrapper.js";
import "./hover.css";
import { Emitter } from "../../../../base/common/event.js";
import { isOnColorDecorator } from "../../colorPicker/browser/hoverColorPicker/hoverColorPicker.js";
import { isModifierKey, KeyCode } from "../../../../base/common/keyCodes.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
const _sticky = false;
let ContentHoverController = class extends Disposable {
  constructor(_editor, _contextMenuService, _instantiationService, _keybindingService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._keybindingService = _keybindingService;
    this._onHoverContentsChanged = this._register(new Emitter());
    this.onHoverContentsChanged = this._onHoverContentsChanged.event;
    this.shouldKeepOpenOnEditorMouseMoveOrLeave = false;
    this._listenersStore = new DisposableStore();
    this._isMouseDown = false;
    this._ignoreMouseEvents = false;
    this._reactToEditorMouseMoveRunner = this._register(new RunOnceScheduler(
      () => {
        if (this._mouseMoveEvent) {
          this._reactToEditorMouseMove(this._mouseMoveEvent);
        }
      },
      0
    ));
    this._register(_contextMenuService.onDidShowContextMenu(() => {
      this.hideContentHover();
      this._ignoreMouseEvents = true;
    }));
    this._register(_contextMenuService.onDidHideContextMenu(() => {
      this._ignoreMouseEvents = false;
    }));
    this._hookListeners();
    this._register(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.hover)) {
        this._unhookListeners();
        this._hookListeners();
      }
    }));
  }
  static {
    this.ID = "editor.contrib.contentHover";
  }
  static get(editor) {
    return editor.getContribution(ContentHoverController.ID);
  }
  _hookListeners() {
    const hoverOpts = this._editor.getOption(EditorOption.hover);
    this._hoverSettings = {
      enabled: hoverOpts.enabled,
      sticky: hoverOpts.sticky,
      hidingDelay: hoverOpts.hidingDelay
    };
    if (hoverOpts.enabled === "off") {
      this._cancelSchedulerAndHide();
    }
    this._listenersStore.add(this._editor.onMouseDown((e) => this._onEditorMouseDown(e)));
    this._listenersStore.add(this._editor.onMouseUp(() => this._onEditorMouseUp()));
    this._listenersStore.add(this._editor.onMouseMove((e) => this._onEditorMouseMove(e)));
    this._listenersStore.add(this._editor.onKeyDown((e) => this._onKeyDown(e)));
    this._listenersStore.add(this._editor.onMouseLeave((e) => this._onEditorMouseLeave(e)));
    this._listenersStore.add(this._editor.onDidChangeModel(() => this._cancelSchedulerAndHide()));
    this._listenersStore.add(this._editor.onDidChangeModelContent(() => this._cancelScheduler()));
    this._listenersStore.add(this._editor.onDidScrollChange((e) => this._onEditorScrollChanged(e)));
  }
  _unhookListeners() {
    this._listenersStore.clear();
  }
  _cancelSchedulerAndHide() {
    this._cancelScheduler();
    this.hideContentHover();
  }
  _cancelScheduler() {
    this._mouseMoveEvent = void 0;
    this._reactToEditorMouseMoveRunner.cancel();
  }
  _onEditorScrollChanged(e) {
    if (this._ignoreMouseEvents) {
      return;
    }
    if (e.scrollTopChanged || e.scrollLeftChanged) {
      this.hideContentHover();
    }
  }
  _onEditorMouseDown(mouseEvent) {
    if (this._ignoreMouseEvents) {
      return;
    }
    this._isMouseDown = true;
    const shouldKeepHoverWidgetVisible = this._shouldKeepHoverWidgetVisible(mouseEvent);
    if (shouldKeepHoverWidgetVisible) {
      return;
    }
    this.hideContentHover();
  }
  _shouldKeepHoverWidgetVisible(mouseEvent) {
    return this._isMouseOnContentHoverWidget(mouseEvent) || this._isContentWidgetResizing() || isOnColorDecorator(mouseEvent);
  }
  _isMouseOnContentHoverWidget(mouseEvent) {
    if (!this._contentWidget || !this._contentWidget.getDomNode().isConnected) {
      return false;
    }
    return isMousePositionWithinElement(this._contentWidget.getDomNode(), mouseEvent.event.posx, mouseEvent.event.posy);
  }
  _onEditorMouseUp() {
    if (this._ignoreMouseEvents) {
      return;
    }
    this._isMouseDown = false;
  }
  _onEditorMouseLeave(mouseEvent) {
    if (this._ignoreMouseEvents) {
      return;
    }
    if (this.shouldKeepOpenOnEditorMouseMoveOrLeave) {
      return;
    }
    this._cancelScheduler();
    const shouldKeepHoverWidgetVisible = this._shouldKeepHoverWidgetVisible(mouseEvent);
    if (shouldKeepHoverWidgetVisible) {
      return;
    }
    if (_sticky) {
      return;
    }
    this.hideContentHover();
  }
  _shouldKeepCurrentHover(mouseEvent) {
    const contentWidget = this._contentWidget;
    if (!contentWidget) {
      return false;
    }
    const isHoverSticky = this._hoverSettings.sticky;
    const isMouseOnStickyContentHoverWidget = (mouseEvent2, isHoverSticky2) => {
      const isMouseOnContentHoverWidget = this._isMouseOnContentHoverWidget(mouseEvent2);
      return isHoverSticky2 && isMouseOnContentHoverWidget;
    };
    const isMouseOnColorPickerOrChoosingColor = (mouseEvent2) => {
      const isColorPickerVisible = contentWidget.isColorPickerVisible;
      const isMouseOnContentHoverWidget = this._isMouseOnContentHoverWidget(mouseEvent2);
      const isMouseOnHoverWithColorPicker = isColorPickerVisible && isMouseOnContentHoverWidget;
      const isMaybeChoosingColor = isColorPickerVisible && this._isMouseDown;
      return isMouseOnHoverWithColorPicker || isMaybeChoosingColor;
    };
    const isTextSelectedWithinContentHoverWidget = (mouseEvent2, sticky) => {
      const view = mouseEvent2.event.browserEvent.view;
      if (!view) {
        return false;
      }
      return sticky && contentWidget.containsNode(view.document.activeElement) && !view.getSelection()?.isCollapsed;
    };
    const isFocused = contentWidget.isFocused;
    const isResizing = contentWidget.isResizing;
    const isStickyAndVisibleFromKeyboard = this._hoverSettings.sticky && contentWidget.isVisibleFromKeyboard;
    return this.shouldKeepOpenOnEditorMouseMoveOrLeave || isFocused || isResizing || isStickyAndVisibleFromKeyboard || isMouseOnStickyContentHoverWidget(mouseEvent, isHoverSticky) || isMouseOnColorPickerOrChoosingColor(mouseEvent) || isTextSelectedWithinContentHoverWidget(mouseEvent, isHoverSticky);
  }
  _onEditorMouseMove(mouseEvent) {
    if (this._ignoreMouseEvents) {
      return;
    }
    if (this._isMouseDown && !this._shouldKeepHoverWidgetVisible(mouseEvent)) {
      this._cancelSchedulerAndHide();
      return;
    }
    this._mouseMoveEvent = mouseEvent;
    const shouldKeepCurrentHover = this._shouldKeepCurrentHover(mouseEvent);
    if (shouldKeepCurrentHover) {
      this._reactToEditorMouseMoveRunner.cancel();
      return;
    }
    const shouldRescheduleHoverComputation = this._shouldRescheduleHoverComputation();
    if (shouldRescheduleHoverComputation) {
      if (!this._reactToEditorMouseMoveRunner.isScheduled()) {
        this._reactToEditorMouseMoveRunner.schedule(this._hoverSettings.hidingDelay);
      }
      return;
    }
    this._reactToEditorMouseMove(mouseEvent);
  }
  _shouldRescheduleHoverComputation() {
    const hidingDelay = this._hoverSettings.hidingDelay;
    const isContentHoverWidgetVisible = this._contentWidget?.isVisible ?? false;
    return isContentHoverWidgetVisible && this._hoverSettings.sticky && hidingDelay > 0;
  }
  _reactToEditorMouseMove(mouseEvent) {
    if (shouldShowHover(
      this._hoverSettings.enabled,
      this._editor.getOption(EditorOption.multiCursorModifier),
      mouseEvent
    )) {
      const contentWidget = this._getOrCreateContentWidget();
      if (contentWidget.showsOrWillShow(mouseEvent)) {
        return;
      }
    }
    if (_sticky) {
      return;
    }
    this.hideContentHover();
  }
  _onKeyDown(e) {
    if (this._ignoreMouseEvents || !this._contentWidget) {
      return;
    }
    if (this._hoverSettings.enabled === "onKeyboardModifier" && isTriggerModifierPressed(this._editor.getOption(EditorOption.multiCursorModifier), e) && this._mouseMoveEvent) {
      if (!this._contentWidget.isVisible) {
        this._contentWidget.showsOrWillShow(this._mouseMoveEvent);
      }
      return;
    }
    const isPotentialKeyboardShortcut = this._isPotentialKeyboardShortcut(e);
    const isModifierKeyPressed = isModifierKey(e.keyCode);
    if (isPotentialKeyboardShortcut || isModifierKeyPressed) {
      return;
    }
    if (this._contentWidget.isFocused && e.keyCode === KeyCode.Tab) {
      return;
    }
    this.hideContentHover();
  }
  _isPotentialKeyboardShortcut(e) {
    if (!this._editor.hasModel() || !this._contentWidget) {
      return false;
    }
    const resolvedKeyboardEvent = this._keybindingService.softDispatch(e, this._editor.getDomNode());
    const moreChordsAreNeeded = resolvedKeyboardEvent.kind === ResultKind.MoreChordsNeeded;
    const isHoverAction = resolvedKeyboardEvent.kind === ResultKind.KbFound && (resolvedKeyboardEvent.commandId === SHOW_OR_FOCUS_HOVER_ACTION_ID || resolvedKeyboardEvent.commandId === INCREASE_HOVER_VERBOSITY_ACTION_ID || resolvedKeyboardEvent.commandId === DECREASE_HOVER_VERBOSITY_ACTION_ID) && this._contentWidget.isVisible;
    return moreChordsAreNeeded || isHoverAction;
  }
  hideContentHover() {
    if (_sticky) {
      return;
    }
    if (InlineSuggestionHintsContentWidget.dropDownVisible) {
      return;
    }
    this._contentWidget?.hide();
  }
  _getOrCreateContentWidget() {
    if (!this._contentWidget) {
      this._contentWidget = this._instantiationService.createInstance(ContentHoverWidgetWrapper, this._editor);
      this._listenersStore.add(this._contentWidget.onContentsChanged(() => this._onHoverContentsChanged.fire()));
    }
    return this._contentWidget;
  }
  showContentHover(range, mode, source, focus) {
    this._getOrCreateContentWidget().startShowingAtRange(range, mode, source, focus);
  }
  _isContentWidgetResizing() {
    return this._contentWidget?.widget.isResizing || false;
  }
  focusedHoverPartIndex() {
    return this._getOrCreateContentWidget().focusedHoverPartIndex();
  }
  doesHoverAtIndexSupportVerbosityAction(index, action) {
    return this._getOrCreateContentWidget().doesHoverAtIndexSupportVerbosityAction(index, action);
  }
  updateHoverVerbosityLevel(action, index, focus) {
    this._getOrCreateContentWidget().updateHoverVerbosityLevel(action, index, focus);
  }
  focus() {
    this._contentWidget?.focus();
  }
  focusHoverPartWithIndex(index) {
    this._contentWidget?.focusHoverPartWithIndex(index);
  }
  scrollUp() {
    this._contentWidget?.scrollUp();
  }
  scrollDown() {
    this._contentWidget?.scrollDown();
  }
  scrollLeft() {
    this._contentWidget?.scrollLeft();
  }
  scrollRight() {
    this._contentWidget?.scrollRight();
  }
  pageUp() {
    this._contentWidget?.pageUp();
  }
  pageDown() {
    this._contentWidget?.pageDown();
  }
  goToTop() {
    this._contentWidget?.goToTop();
  }
  goToBottom() {
    this._contentWidget?.goToBottom();
  }
  getWidgetContent() {
    return this._contentWidget?.getWidgetContent();
  }
  getAccessibleWidgetContent() {
    return this._contentWidget?.getAccessibleWidgetContent();
  }
  getAccessibleWidgetContentAtIndex(index) {
    return this._contentWidget?.getAccessibleWidgetContentAtIndex(index);
  }
  get isColorPickerVisible() {
    return this._contentWidget?.isColorPickerVisible;
  }
  get isHoverVisible() {
    return this._contentWidget?.isVisible;
  }
  dispose() {
    super.dispose();
    this._unhookListeners();
    this._listenersStore.dispose();
    this._contentWidget?.dispose();
  }
};
ContentHoverController = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IKeybindingService)
], ContentHoverController);
export {
  ContentHoverController
};
