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
import * as dom from "../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableMap, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { WorkbenchObjectTree } from "../../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { asCssVariable, buttonSecondaryBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { katexContainerClassName } from "../../../markdown/common/markedKatexExtension.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatConfiguration, ChatModeKind } from "../../common/constants.js";
import { isRequestVM, isResponseVM } from "../../common/model/chatViewModel.js";
import { ChatAccessibilityProvider } from "../accessibility/chatAccessibilityProvider.js";
import { IChatAccessibilityService } from "../chat.js";
import { ChatCollapsibleContentPart } from "./chatContentParts/chatCollapsibleContentPart.js";
import { ChatListDelegate, ChatListItemRenderer } from "./chatListRenderer.js";
import { sanitizeChatClipboardFragment } from "./chatClipboard.js";
import { ChatEditorOptions } from "./chatOptions.js";
import { ChatPendingDragController } from "./chatPendingDragAndDrop.js";
class AutoScrollHolds {
  constructor() {
    this._count = 0;
  }
  get isHeld() {
    return this._count > 0;
  }
  acquire() {
    this._count++;
    let released = false;
    return toDisposable(() => {
      if (!released) {
        released = true;
        this._count--;
      }
    });
  }
}
class UserToggleResizeState {
  constructor(requiredStableFrames) {
    this.requiredStableFrames = requiredStableFrames;
    this.framesUntilSettled = 0;
    this.transitionInProgress = false;
  }
  get isActive() {
    return this.transitionInProgress || this.framesUntilSettled > 0;
  }
  start() {
    this.framesUntilSettled = this.requiredStableFrames;
  }
  markResized() {
    if (this.isActive) {
      this.framesUntilSettled = this.requiredStableFrames;
    }
  }
  startTransition() {
    this.transitionInProgress = true;
  }
  endTransition() {
    this.transitionInProgress = false;
    this.framesUntilSettled = this.requiredStableFrames;
  }
  advanceFrame() {
    if (this.isActive) {
      this.framesUntilSettled--;
    }
  }
}
function getAnchoredScrollTop(scrollTop, currentTargetTop, anchorTargetTop) {
  return scrollTop + currentTargetTop - anchorTargetTop;
}
function computeScrollDownState(isScrolledToBottom, scrollLock) {
  return {
    showButton: !isScrolledToBottom,
    atBottom: isScrolledToBottom || scrollLock
  };
}
class UserToggleResizeTracker extends Disposable {
  constructor(target, restoreScrollPosition, onDidSettle) {
    super();
    this.restoreScrollPosition = restoreScrollPosition;
    this.onDidSettle = onDidSettle;
    this.state = new UserToggleResizeState(2);
    this.pendingFrame = this._register(new MutableDisposable());
    const targetWindow = dom.getWindow(target);
    const resizeObserver = this._register(new dom.DisposableResizeObserver("ChatListWidget.userToggleResize", () => {
      this.state.markResized();
      this.scheduleFrame(targetWindow);
    }, targetWindow));
    this._register(resizeObserver.observe(target));
    this._register(dom.addDisposableListener(target, "transitionrun", (e) => {
      if (e.propertyName === "grid-template-rows") {
        this.state.startTransition();
        this.scheduleFrame(targetWindow);
      }
    }));
    const finishTransition = (e) => {
      if (e.propertyName === "grid-template-rows") {
        this.state.endTransition();
        this.scheduleFrame(targetWindow);
      }
    };
    this._register(dom.addDisposableListener(target, "transitionend", finishTransition));
    this._register(dom.addDisposableListener(target, "transitioncancel", finishTransition));
    this.state.start();
    this.scheduleFrame(targetWindow);
  }
  restoreScrollAnchor() {
    this.restoreScrollPosition?.();
  }
  cancelScrollRestoration() {
    this.restoreScrollPosition = void 0;
  }
  scheduleFrame(targetWindow) {
    if (this.pendingFrame.value) {
      return;
    }
    this.pendingFrame.value = dom.scheduleAtNextAnimationFrame(targetWindow, () => {
      this.pendingFrame.clear();
      this.restoreScrollPosition?.();
      this.state.advanceFrame();
      if (this.state.isActive) {
        this.scheduleFrame(targetWindow);
      } else {
        this.onDidSettle();
      }
    });
  }
}
let ChatListWidget = class extends Disposable {
  //#endregion
  constructor(container, options, instantiationService, contextKeyService, chatService, contextMenuService, logService, configurationService, chatAccessibilityService) {
    super();
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.chatService = chatService;
    this.contextMenuService = contextMenuService;
    this.logService = logService;
    this.configurationService = configurationService;
    this.chatAccessibilityService = chatAccessibilityService;
    //#region Events
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidChangeContentHeight = this._register(new Emitter());
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this._onDidClickFollowup = this._register(new Emitter());
    this.onDidClickFollowup = this._onDidClickFollowup.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidChangeItemHeight = this._register(new Emitter());
    /** Event fired when an item's height changes. Used for dynamic layout mode. */
    this.onDidChangeItemHeight = this._onDidChangeItemHeight.event;
    this._visible = true;
    this._mostRecentlyFocusedItemIndex = -1;
    this._scrollLock = true;
    this._autoScrollHolds = new AutoScrollHolds();
    this._settingChangeCounter = 0;
    this._visibleChangeCount = 0;
    this._userToggleResizeTrackers = this._register(new DisposableMap());
    this._viewModel = options.viewModel;
    this._location = options.location;
    this._getSelectedModelRequestOptions = options.getSelectedModelRequestOptions;
    this._getCurrentModeInfo = options.getCurrentModeInfo;
    this._lastItemIdContextKey = ChatContextKeys.lastItemId.bindTo(this.contextKeyService);
    this._container = container;
    const updateInlineReferencesStyle = () => {
      const style = this.configurationService.getValue(ChatConfiguration.InlineReferencesStyle);
      this._container.classList.toggle("chat-inline-references-link-style", style === "link");
    };
    updateInlineReferencesStyle();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.InlineReferencesStyle)) {
        updateInlineReferencesStyle();
      }
    }));
    const scopedInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([IContextKeyService, this.contextKeyService])
    ));
    const overflowWidgetsContainer = options.overflowWidgetsDomNode ?? document.createElement("div");
    if (!options.overflowWidgetsDomNode) {
      overflowWidgetsContainer.classList.add("chat-overflow-widget-container", "monaco-editor");
      this._container.append(overflowWidgetsContainer);
      this._register(toDisposable(() => overflowWidgetsContainer.remove()));
    }
    const editorOptions = options.editorOptions ?? this._register(scopedInstantiationService.createInstance(
      ChatEditorOptions,
      options.viewId,
      "foreground",
      options.inputEditorBackground ?? "chat.requestEditor.background",
      options.resultEditorBackground ?? "chat.responseEditor.background"
    ));
    this._delegate = scopedInstantiationService.createInstance(
      ChatListDelegate,
      options.defaultElementHeight ?? 200
    );
    const rendererDelegate = {
      getListLength: () => this._tree.getNode(null).visibleChildrenCount,
      onDidScroll: this.onDidScroll,
      container: this._container,
      currentChatMode: options.currentChatMode ?? (() => ChatModeKind.Ask)
    };
    this._renderer = this._register(scopedInstantiationService.createInstance(
      ChatListItemRenderer,
      editorOptions,
      options.rendererOptions ?? {},
      rendererDelegate,
      overflowWidgetsContainer,
      this._viewModel
    ));
    this._register(this._renderer.onDidClickFollowup((item) => {
      this._onDidClickFollowup.fire(item);
    }));
    this._register(this._renderer.onDidChangeItemHeight((e) => {
      this._updateElementHeight(e.element, e.height);
      this._onDidChangeItemHeight.fire(e);
    }));
    this._register(this._renderer.onDidClickRerunWithAgentOrCommandDetection((e) => {
      const request = this.chatService.getSession(e.sessionResource)?.getRequests().find((candidate) => candidate.id === e.requestId);
      if (request) {
        const sendOptions = {
          noCommandDetection: true,
          attempt: request.attempt + 1,
          location: this._location,
          ...this._getSelectedModelRequestOptions?.(),
          modeInfo: this._getCurrentModeInfo?.()
        };
        this.chatAccessibilityService.acceptRequest(e.sessionResource);
        this.chatService.resendRequest(request, sendOptions).catch((e2) => this.logService.error("FAILED to rerun request", e2));
      }
    }));
    this._renderer.pendingDragController = this._register(
      scopedInstantiationService.createInstance(ChatPendingDragController, this._container, () => this._viewModel)
    );
    const styles = options.styles ?? {};
    this._tree = this._register(scopedInstantiationService.createInstance(
      WorkbenchObjectTree,
      "ChatList",
      this._container,
      this._delegate,
      [this._renderer],
      {
        identityProvider: { getId: (e) => e.id },
        horizontalScrolling: false,
        alwaysConsumeMouseWheel: false,
        supportDynamicHeights: true,
        hideTwistiesOfChildlessElements: true,
        accessibilityProvider: this.instantiationService.createInstance(ChatAccessibilityProvider),
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (e) => isRequestVM(e) ? e.message : isResponseVM(e) ? e.response.value : ""
        },
        setRowLineHeight: false,
        scrollToActiveElement: true,
        filter: options.filter,
        overrideStyles: {
          listFocusBackground: styles.listBackground,
          listInactiveFocusBackground: styles.listBackground,
          listActiveSelectionBackground: styles.listBackground,
          listFocusAndSelectionBackground: styles.listBackground,
          listInactiveSelectionBackground: styles.listBackground,
          listHoverBackground: styles.listBackground,
          listBackground: styles.listBackground,
          listFocusForeground: styles.listForeground,
          listHoverForeground: styles.listForeground,
          listInactiveFocusForeground: styles.listForeground,
          listInactiveSelectionForeground: styles.listForeground,
          listActiveSelectionForeground: styles.listForeground,
          listFocusAndSelectionForeground: styles.listForeground,
          listActiveSelectionIconForeground: void 0,
          listInactiveSelectionIconForeground: void 0
        }
      }
    ));
    this._scrollDownButton = this._register(new Button(this._container, {
      buttonBackground: asCssVariable(buttonSecondaryBackground),
      buttonForeground: asCssVariable(buttonSecondaryForeground),
      buttonHoverBackground: asCssVariable(buttonSecondaryHoverBackground),
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0,
      supportIcons: true
    }));
    this._scrollDownButton.element.classList.add("chat-scroll-down");
    this._scrollDownButton.label = `$(${Codicon.chevronDown.id})`;
    this._scrollDownButton.element.style.display = "none";
    this._register(this._scrollDownButton.onDidClick(() => {
      this.cancelUserToggleScrollRestoration();
      this.setScrollLock(true);
      this.scrollToEnd();
    }));
    this._register(this._tree.onDidChangeContentHeight(() => {
      this._onDidChangeContentHeight.fire();
    }));
    this._register(this._tree.onDidFocus(() => {
      this._onDidFocus.fire();
    }));
    this._register(this._tree.onDidChangeFocus(() => {
      const focused = this.getFocus();
      if (focused && focused.length > 0) {
        const focusedItem = focused[0];
        const items = this.getItems();
        const idx = items.findIndex((i) => i === focusedItem);
        if (idx !== -1) {
          this._mostRecentlyFocusedItemIndex = idx;
        }
      }
    }));
    this._register(this._tree.onDidScroll((e) => {
      this._onDidScroll.fire(e);
      this.updateScrollDownButtonVisibility();
    }));
    this.updateScrollDownButtonVisibility();
    this._register(dom.addDisposableListener(this._container, ChatCollapsibleContentPart.userToggleEvent, (e) => {
      if (!dom.isHTMLElement(e.target)) {
        return;
      }
      const element = this._renderer.getElementFromNode(e.target);
      if (element) {
        this.trackUserToggleResize(element, e.target);
      }
    }));
    this._register(dom.addDisposableListener(this._container, dom.EventType.WHEEL, () => this.cancelUserToggleScrollRestoration()));
    this._register(dom.addDisposableListener(this._container, dom.EventType.POINTER_DOWN, () => this.cancelUserToggleScrollRestoration()));
    this._register(dom.addDisposableListener(this._container, dom.EventType.KEY_DOWN, (e) => {
      const keyCode = new StandardKeyboardEvent(e).keyCode;
      if (keyCode === KeyCode.UpArrow || keyCode === KeyCode.DownArrow || keyCode === KeyCode.PageUp || keyCode === KeyCode.PageDown || keyCode === KeyCode.Home || keyCode === KeyCode.End) {
        this.cancelUserToggleScrollRestoration();
      }
    }, true));
    this._register(this._tree.onContextMenu((e) => {
      this.handleContextMenu(e);
    }));
    this._register(dom.addDisposableListener(this._container, "copy", (e) => this.handleCopy(e)));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.EditRequests) || e.affectsConfiguration(ChatConfiguration.CheckpointsEnabled)) {
        this._settingChangeCounter++;
        this.refresh();
      }
    }));
  }
  /**
   * Event fired when a request item is clicked.
   */
  get onDidClickRequest() {
    return this._renderer.onDidClickRequest;
  }
  /**
   * Event fired when an item is re-rendered.
   */
  get onDidRerender() {
    return this._renderer.onDidRerender;
  }
  /**
   * Event fired when a template is disposed.
   */
  get onDidDispose() {
    return this._renderer.onDidDispose;
  }
  /**
   * Event fired when focus moves outside the editing area.
   */
  get onDidFocusOutside() {
    return this._renderer.onDidFocusOutside;
  }
  //#endregion
  //#region Properties
  get domNode() {
    return this._container;
  }
  get scrollTop() {
    return this._tree.scrollTop;
  }
  set scrollTop(value) {
    this._tree.scrollTop = value;
  }
  get scrollHeight() {
    return this._tree.scrollHeight;
  }
  get renderHeight() {
    return this._tree.renderHeight;
  }
  get contentHeight() {
    return this._tree.contentHeight;
  }
  /**
   * Whether the list is scrolled to the bottom.
   */
  get isScrolledToBottom() {
    return this._tree.scrollTop + this._tree.renderHeight >= this._tree.scrollHeight - 2;
  }
  /**
   * The last item in the list.
   */
  get lastItem() {
    return this._lastItem;
  }
  //#region Internal event handlers
  /**
   * Rewrites the rich-text flavor of a copied selection so links that only resolve here
   * don't paste as `vscode-file:` targets or local paths. Selections whose links all resolve
   * elsewhere are left to the browser, which keeps the styling other apps rely on.
   */
  handleCopy(e) {
    const selection = dom.getWindow(this._container).getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !e.clipboardData) {
      return;
    }
    const touched = Array.from(this._container.querySelectorAll("a, img")).filter((element) => selection.containsNode(element, true));
    if (!touched.length) {
      return;
    }
    const ranges = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (!dom.isAncestor(range.commonAncestorContainer, this._container)) {
        return;
      }
      ranges.push(range);
    }
    const fragments = ranges.map((range) => this.cloneSelectedContents(range));
    if (!fragments.map((fragment) => sanitizeChatClipboardFragment(fragment)).some(Boolean)) {
      return;
    }
    const holder = this._container.ownerDocument.createElement("div");
    for (const fragment of fragments) {
      holder.appendChild(fragment);
    }
    e.clipboardData.setData(Mimes.text, selection.toString());
    e.clipboardData.setData(Mimes.html, holder.innerHTML);
    e.preventDefault();
  }
  /**
   * Clones a range along with the elements it sits inside. `cloneContents` returns only what
   * lies between the range boundaries, which drops both the heading or list item giving the
   * text its shape and, for a partly selected link, the rest of its label.
   */
  cloneSelectedContents(range) {
    let content = range.cloneContents();
    for (let ancestor = range.commonAncestorContainer; ancestor && ancestor !== this._container; ancestor = ancestor.parentNode) {
      if (!dom.isHTMLElement(ancestor)) {
        continue;
      }
      if (ancestor.tagName === "A") {
        content = ancestor.cloneNode(true);
        continue;
      }
      const wrapper = ancestor.cloneNode(false);
      wrapper.appendChild(content);
      content = wrapper;
    }
    if (content.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return content;
    }
    const fragment = this._container.ownerDocument.createDocumentFragment();
    fragment.appendChild(content);
    return fragment;
  }
  /**
   * Update scroll-down button visibility based on scroll position and scroll lock.
   */
  updateScrollDownButtonVisibility() {
    const { showButton, atBottom } = computeScrollDownState(this.isScrolledToBottom, this._scrollLock);
    this._scrollDownButton.element.style.display = showButton ? "flex" : "none";
    this._container.classList.toggle("chat-list-at-bottom", atBottom);
  }
  /**
   * Handle context menu events.
   */
  handleContextMenu(e) {
    e.browserEvent.preventDefault();
    e.browserEvent.stopPropagation();
    const selected = e.element;
    const target = e.browserEvent.target;
    const isKatexElement = target.closest(`.${katexContainerClassName}`) !== null;
    const scopedContextKeyService = this.contextKeyService.createOverlay([
      [ChatContextKeys.isResponse.key, isResponseVM(selected)],
      [ChatContextKeys.responseIsFiltered.key, isResponseVM(selected) && !!selected.errorDetails?.responseIsFiltered],
      [ChatContextKeys.isKatexMathElement.key, isKatexElement]
    ]);
    this.contextMenuService.showContextMenu({
      menuId: MenuId.ChatContext,
      menuActionOptions: { shouldForwardArgs: true },
      contextKeyService: scopedContextKeyService,
      getAnchor: () => e.anchor,
      getActionsContext: () => selected
    });
  }
  //#endregion
  //#region ViewModel methods
  /**
   * Set the view model for the list to render.
   */
  setViewModel(viewModel) {
    this._viewModel = viewModel;
    this._renderer.updateViewModel(viewModel);
  }
  /**
   * Refresh the list from the current view model.
   * Uses internal state for diff identity calculation.
   */
  refresh() {
    if (!this._viewModel) {
      this._tree.setChildren(null, []);
      this._lastItem = void 0;
      this._lastItemIdContextKey.set([]);
      return;
    }
    const items = this._viewModel.getItems();
    this._lastItem = items.at(-1);
    this._lastItemIdContextKey.set(this._lastItem ? [this._lastItem.id] : []);
    const treeItems = items.map((item) => ({
      element: item,
      collapsed: false,
      collapsible: false
    }));
    const editing = this._viewModel.editing;
    this._withPersistedAutoScroll(() => {
      this._tree.setChildren(null, treeItems, {
        diffIdentityProvider: {
          getId: (element) => {
            const baseId = isRequestVM(element) || isResponseVM(element) ? element.dataId : element.id;
            const disablement = isRequestVM(element) || isResponseVM(element) ? element.shouldBeRemovedOnSend : void 0;
            const isEditTarget = isRequestVM(element) && editing?.id === element.id;
            const isBlocked = isRequestVM(element) || isResponseVM(element) ? element.shouldBeBlocked.get() : false;
            return baseId + // If a response is in the process of progressive rendering, we need to ensure that it will
            // be re-rendered so progressive rendering is restarted, even if the model wasn't updated.
            `${isResponseVM(element) && element.renderData ? `_${this._visibleChangeCount}` : ""}` + // Re-render once content references are loaded
            (isResponseVM(element) ? `_${element.contentReferences.length}` : "") + // Re-render if element becomes hidden due to undo/redo
            `_${disablement ? `${disablement.afterUndoStop || "1"}` : "0"}_${isEditTarget ? "edit" : ""}_${isBlocked ? "blocked" : ""}` + // Re-render requests when editing starts/stops (for hover button visibility, click handlers)
            (isRequestVM(element) ? `_${editing ? "1" : "0"}` : "") + // Re-render all if invoked by setting change
            `_setting${this._settingChangeCounter}` + // Rerender request if we got new content references in the response
            // since this may change how we render the corresponding attachments in the request
            (isRequestVM(element) && element.contentReferences ? `_${element.contentReferences?.length}` : "");
          }
        }
      });
    });
  }
  /**
   * Set scroll lock state.
   */
  setScrollLock(value) {
    this._scrollLock = value;
    this.updateScrollDownButtonVisibility();
  }
  /**
   * Get scroll lock state.
   */
  get scrollLock() {
    return this._scrollLock;
  }
  /**
   * Set the visible change count (for diff identity).
   */
  setVisibleChangeCount(value) {
    this._visibleChangeCount = value;
  }
  /**
   * Scroll to reveal an element if editing.
   */
  scrollToCurrentItem(currentElement) {
    if (!this._viewModel?.editing || !currentElement) {
      return;
    }
    if (!this._tree.hasElement(currentElement)) {
      return;
    }
    const relativeTop = this._tree.getRelativeTop(currentElement);
    if (relativeTop === null || relativeTop < 0 || relativeTop > 1) {
      this._tree.reveal(currentElement, 0);
    }
  }
  //#endregion
  //#region Tree methods
  /**
   * Rerender the tree.
   */
  rerender() {
    this._tree.rerender();
  }
  getItems() {
    const items = [];
    const root = this._tree.getNode(null);
    for (const child of root.children) {
      if (child.element) {
        items.push(child.element);
      }
    }
    return items;
  }
  /**
   * Delegate scroll events from a mouse wheel event to the tree.
   */
  delegateScrollFromMouseWheelEvent(event) {
    this.cancelUserToggleScrollRestoration();
    this._tree.delegateScrollFromMouseWheelEvent(event);
  }
  /**
   * Whether the tree has a specific element.
   */
  hasElement(element) {
    return this._tree.hasElement(element);
  }
  /**
   * Update the height of an element.
   */
  _updateElementHeight(element, height) {
    if (this._tree.hasElement(element) && this._visible) {
      const userToggleResizeTracker = this._userToggleResizeTrackers.get(element);
      if (userToggleResizeTracker) {
        this._tree.updateElementHeight(element, height);
        userToggleResizeTracker.restoreScrollAnchor();
        return;
      }
      this._withPersistedAutoScroll(() => {
        this._tree.updateElementHeight(element, height);
      });
    }
  }
  trackUserToggleResize(element, target) {
    const anchorTargetTop = this.isScrolledToBottom ? target.getBoundingClientRect().top : void 0;
    const restoreScrollPosition = anchorTargetTop === void 0 ? void 0 : () => {
      if (target.isConnected) {
        this._tree.scrollTop = getAnchoredScrollTop(this._tree.scrollTop, target.getBoundingClientRect().top, anchorTargetTop);
      }
    };
    const tracker = new UserToggleResizeTracker(target, restoreScrollPosition, () => {
      if (this._userToggleResizeTrackers.get(element) === tracker) {
        this._userToggleResizeTrackers.deleteAndDispose(element);
      }
    });
    this._userToggleResizeTrackers.set(element, tracker);
  }
  cancelUserToggleScrollRestoration() {
    for (const tracker of this._userToggleResizeTrackers.values()) {
      tracker.cancelScrollRestoration();
    }
  }
  /**
   * Scroll to reveal an element.
   */
  reveal(element, relativeTop) {
    this._tree.reveal(element, relativeTop);
  }
  /**
   * The top offset of an element in transcript content space (same space as
   * `scrollTop`/`scrollHeight`), or `undefined` if it is not in the list. Reads
   * the layout height model, so it also resolves off-screen elements.
   */
  getElementTop(element) {
    if (!this._tree.hasElement(element)) {
      return void 0;
    }
    return this._tree.getElementTop(element);
  }
  /**
   * Get the focused elements.
   */
  getFocus() {
    return this._tree.getFocus().filter((e) => e !== null);
  }
  /**
   * Set the focused elements.
   */
  setFocus(elements) {
    this._tree.setFocus(elements);
  }
  focusItem(item) {
    if (!this.hasElement(item)) {
      return;
    }
    this._tree.setFocus([item]);
    this._tree.domFocus();
  }
  /**
   * Focus the last item in the list. Returns the index of the focused item.
   * @param useMostRecentlyFocusedIndex If true, use the mostRecentlyFocusedIndex if valid
   */
  focusLastItem(useMostRecentlyFocusedIndex) {
    const items = this.getItems();
    if (items.length === 0) {
      return -1;
    }
    let focusIndex;
    if (useMostRecentlyFocusedIndex && this._mostRecentlyFocusedItemIndex >= 0 && this._mostRecentlyFocusedItemIndex < items.length) {
      focusIndex = this._mostRecentlyFocusedItemIndex;
    } else {
      focusIndex = items.length - 1;
    }
    this._tree.setFocus([items[focusIndex]]);
    this._tree.domFocus();
    return focusIndex;
  }
  /**
   * Scroll the list to reveal the last item.
   */
  scrollToEnd() {
    const lastElement = this._tree.getNode(null).children.at(-1)?.element;
    if (lastElement) {
      const offset = Math.max(lastElement.currentRenderedHeight ?? 0, 1e6);
      this._tree.reveal(lastElement, offset);
    }
  }
  /**
   * Suppresses auto-scrolling to the bottom until the returned disposable is
   * disposed. Holds compose, so unrelated features (request editing, an open
   * text selection) can suppress concurrently without clobbering each other;
   * auto-scroll resumes only once the last hold is released.
   */
  acquireAutoScrollHold() {
    return this._autoScrollHolds.acquire();
  }
  /** Whether any {@link acquireAutoScrollHold} hold is currently active. */
  get isAutoScrollHeld() {
    return this._autoScrollHolds.isHeld;
  }
  _withPersistedAutoScroll(fn) {
    if (this.isAutoScrollHeld) {
      fn();
      return;
    }
    const wasScrolledToBottom = this.isScrolledToBottom;
    fn();
    if (wasScrolledToBottom) {
      this.scrollToEnd();
    }
  }
  /**
   * Focus the list.
   */
  focus() {
    this._tree.domFocus();
  }
  /**
   * Get the DOM focus state.
   */
  isDOMFocused() {
    return this._tree.isDOMFocused();
  }
  //#endregion
  //#region Renderer methods
  /**
   * Get code block info for a response.
   */
  getCodeBlockInfosForResponse(response) {
    return this._renderer.getCodeBlockInfosForResponse(response);
  }
  /**
   * Get code block info by URI.
   */
  getCodeBlockInfoForEditor(uri) {
    return this._renderer.getCodeBlockInfoForEditor(uri);
  }
  /**
   * Get file tree info for a response.
   */
  getFileTreeInfosForResponse(response) {
    return this._renderer.getFileTreeInfosForResponse(response);
  }
  /**
   * Get the last focused file tree for a response.
   */
  getLastFocusedFileTreeForResponse(response) {
    return this._renderer.getLastFocusedFileTreeForResponse(response);
  }
  /**
   * Get editors currently in use.
   */
  editorsInUse() {
    return this._renderer.editorsInUse();
  }
  /**
   * Get template data for a request ID.
   */
  getTemplateDataForRequestId(requestId) {
    if (!requestId) {
      return void 0;
    }
    return this._renderer.getTemplateDataForRequestId(requestId);
  }
  /**
   * Returns the currently rendered chat item containing the node.
   */
  getElementFromNode(node) {
    return this._renderer.getElementFromNode(node);
  }
  /**
   * Update renderer options.
   */
  updateRendererOptions(options) {
    this._renderer.updateOptions(options);
  }
  /**
   * Update the list/tree color overrides. Re-applies the same fan-out from
   * `listBackground`/`listForeground` to all interaction states that was
   * originally configured at construction time.
   */
  setStyles(styles) {
    this._tree.updateOptions({
      overrideStyles: {
        listFocusBackground: styles.listBackground,
        listInactiveFocusBackground: styles.listBackground,
        listActiveSelectionBackground: styles.listBackground,
        listFocusAndSelectionBackground: styles.listBackground,
        listInactiveSelectionBackground: styles.listBackground,
        listHoverBackground: styles.listBackground,
        listBackground: styles.listBackground,
        listFocusForeground: styles.listForeground,
        listHoverForeground: styles.listForeground,
        listInactiveFocusForeground: styles.listForeground,
        listInactiveSelectionForeground: styles.listForeground,
        listActiveSelectionForeground: styles.listForeground,
        listFocusAndSelectionForeground: styles.listForeground,
        listActiveSelectionIconForeground: void 0,
        listInactiveSelectionIconForeground: void 0
      }
    });
  }
  /**
   * Set the visibility of the list.
   */
  setVisible(visible) {
    this._visible = visible;
    this._renderer.setVisible(visible);
  }
  /**
   * Layout the list.
   */
  layout(height, width) {
    this._tree.layout(height, width);
    this._renderer.layout(width ?? this._container.clientWidth);
  }
  //#endregion
};
ChatListWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IChatAccessibilityService)
], ChatListWidget);
export {
  AutoScrollHolds,
  ChatListWidget,
  UserToggleResizeState,
  computeScrollDownState,
  getAnchoredScrollTop
};
