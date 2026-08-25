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
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { registerThemingParticipant } from "../../theme/common/themeService.js";
import { editorHoverBorder } from "../../theme/common/colorRegistry.js";
import { IHoverService } from "./hover.js";
import { IContextMenuService } from "../../contextview/browser/contextView.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { HoverWidget } from "./hoverWidget.js";
import { ContextView, ContextViewDOMPosition } from "../../../base/browser/ui/contextview/contextview.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { addDisposableListener, EventType, getActiveElement, isAncestorOfActiveElement, isAncestor, getWindow, isHTMLElement, isEditableElement } from "../../../base/browser/dom.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { ResultKind } from "../../keybinding/common/keybindingResolver.js";
import { IAccessibilityService } from "../../accessibility/common/accessibility.js";
import { ILayoutService } from "../../layout/browser/layoutService.js";
import { mainWindow } from "../../../base/browser/window.js";
import { HoverStyle, isManagedHoverTooltipMarkdownString } from "../../../base/browser/ui/hover/hover.js";
import { ManagedHoverWidget } from "./updatableHoverWidget.js";
import { timeout, TimeoutTimer } from "../../../base/common/async.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { isNumber, isString } from "../../../base/common/types.js";
import { KeyChord, KeyCode, KeyMod } from "../../../base/common/keyCodes.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../keybinding/common/keybindingsRegistry.js";
import { stripIcons } from "../../../base/common/iconLabels.js";
const MAX_HOVER_NESTING_DEPTH = 3;
let HoverService = class extends Disposable {
  constructor(_instantiationService, _configurationService, contextMenuService, _keybindingService, _layoutService, _accessibilityService) {
    super();
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._keybindingService = _keybindingService;
    this._layoutService = _layoutService;
    this._accessibilityService = _accessibilityService;
    /**
     * Stack of currently visible hovers. The last entry is the topmost hover.
     * This enables nested hovers where hovering inside a hover can show another hover.
     */
    this._hoverStack = [];
    this._currentDelayedHoverWasShown = false;
    this._delayedHovers = /* @__PURE__ */ new Map();
    this._managedHovers = /* @__PURE__ */ new Map();
    this._register(contextMenuService.onDidShowContextMenu(() => this.hideHover()));
    this._register(KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: "workbench.action.showHover",
      weight: KeybindingWeight.EditorCore,
      primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
      handler: () => {
        this._showAndFocusHoverForActiveElement();
      }
    }));
  }
  /**
   * Gets the current (topmost) hover from the stack, if any.
   */
  get _currentHover() {
    return this._hoverStack.at(-1)?.hover;
  }
  /**
   * Gets the current (topmost) hover options from the stack, if any.
   */
  get _currentHoverOptions() {
    return this._hoverStack.at(-1)?.options;
  }
  /**
   * Returns whether the target element is inside any of the hovers in the stack.
   * If it is, returns the index of the containing hover, otherwise returns -1.
   */
  _getContainingHoverIndex(target) {
    const targetElements = isHTMLElement(target) ? [target] : target.targetElements;
    for (let i = this._hoverStack.length - 1; i >= 0; i--) {
      for (const targetElement of targetElements) {
        if (isAncestor(targetElement, this._hoverStack[i].hover.domNode)) {
          return i;
        }
      }
    }
    return -1;
  }
  showInstantHover(options, focus, skipLastFocusedUpdate, dontShow) {
    const hover = this._createHover(options, skipLastFocusedUpdate);
    if (!hover) {
      return void 0;
    }
    this._showHover(hover, options, focus);
    return hover.hover;
  }
  showDelayedHover(options, lifecycleOptions) {
    if (options.id === void 0) {
      options.id = getHoverIdFromContent(options.content);
    }
    if (!this._currentDelayedHover || this._currentDelayedHoverWasShown) {
      if (this._currentHover?.isLocked && this._getContainingHoverIndex(options.target) < 0) {
        return void 0;
      }
      if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
        return this._currentHover;
      }
      if (this._currentHover && !this._currentHover.isDisposed && this._currentDelayedHoverGroupId !== void 0 && this._currentDelayedHoverGroupId === lifecycleOptions?.groupId) {
        return this.showInstantHover({
          ...options,
          appearance: {
            ...options.appearance,
            skipFadeInAnimation: true
          }
        });
      }
    } else if (this._currentDelayedHover && getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
      return this._currentDelayedHover;
    }
    const hover = this._createHover(options, void 0);
    if (!hover) {
      this._currentDelayedHover = void 0;
      this._currentDelayedHoverWasShown = false;
      this._currentDelayedHoverGroupId = void 0;
      return void 0;
    }
    this._currentDelayedHover = hover.hover;
    this._currentDelayedHoverWasShown = false;
    this._currentDelayedHoverGroupId = lifecycleOptions?.groupId;
    const delay = lifecycleOptions?.reducedDelay ? this._configurationService.getValue("workbench.hover.reducedDelay") : this._configurationService.getValue("workbench.hover.delay");
    timeout(delay).then(() => {
      if (hover.hover && !hover.hover.isDisposed) {
        this._currentDelayedHoverWasShown = true;
        this._showHover(hover, options);
      }
    });
    return hover.hover;
  }
  setupDelayedHover(target, options, lifecycleOptions) {
    const resolveHoverOptions = (e) => {
      const resolved = {
        ...typeof options === "function" ? options() : options,
        target
      };
      if (resolved.style === HoverStyle.Mouse && e) {
        resolved.target = resolveMouseStyleHoverTarget(target, e);
      }
      return resolved;
    };
    return this._setupDelayedHover(target, resolveHoverOptions, lifecycleOptions);
  }
  setupDelayedHoverAtMouse(target, options, lifecycleOptions) {
    const resolveHoverOptions = (e) => ({
      ...typeof options === "function" ? options() : options,
      target: e ? resolveMouseStyleHoverTarget(target, e) : target
    });
    return this._setupDelayedHover(target, resolveHoverOptions, lifecycleOptions);
  }
  _setupDelayedHover(target, resolveHoverOptions, lifecycleOptions) {
    const store = new DisposableStore();
    store.add(addDisposableListener(target, EventType.MOUSE_OVER, (e) => {
      this.showDelayedHover(resolveHoverOptions(e), {
        groupId: lifecycleOptions?.groupId,
        reducedDelay: lifecycleOptions?.reducedDelay
      });
    }));
    if (lifecycleOptions?.setupKeyboardEvents) {
      store.add(addDisposableListener(target, EventType.KEY_DOWN, (e) => {
        const evt = new StandardKeyboardEvent(e);
        if (evt.equals(KeyCode.Space) || evt.equals(KeyCode.Enter)) {
          this.showInstantHover(resolveHoverOptions(), true);
        }
      }));
    }
    this._delayedHovers.set(target, { show: (focus) => {
      this.showInstantHover(resolveHoverOptions(), focus);
    } });
    store.add(toDisposable(() => this._delayedHovers.delete(target)));
    return store;
  }
  _createHover(options, skipLastFocusedUpdate) {
    this._currentDelayedHover?.dispose();
    this._currentDelayedHover = void 0;
    if (options.content === "") {
      return void 0;
    }
    if (options.id === void 0) {
      options.id = getHoverIdFromContent(options.content);
    }
    const containingHoverIndex = this._getContainingHoverIndex(options.target);
    const isNesting = containingHoverIndex >= 0;
    if (isNesting) {
      if (this._hoverStack.length >= MAX_HOVER_NESTING_DEPTH) {
        return void 0;
      }
    } else {
      if (this._currentHover?.isLocked) {
        return void 0;
      }
      if (getHoverOptionsIdentity(this._currentHoverOptions) === getHoverOptionsIdentity(options)) {
        return void 0;
      }
    }
    this._lastHoverOptions = options;
    const trapFocus = options.trapFocus || this._accessibilityService.isScreenReaderOptimized();
    const activeElement = getActiveElement();
    let lastFocusedElementBeforeOpen;
    if (!skipLastFocusedUpdate) {
      if (trapFocus && activeElement) {
        if (!activeElement.classList.contains("monaco-hover")) {
          lastFocusedElementBeforeOpen = activeElement;
        }
      }
    }
    const hoverDisposables = new DisposableStore();
    const hover = this._instantiationService.createInstance(HoverWidget, options);
    if (options.persistence?.sticky) {
      hover.isLocked = true;
    }
    if (options.position?.hoverPosition && !isNumber(options.position.hoverPosition)) {
      options.target = {
        targetElements: isHTMLElement(options.target) ? [options.target] : options.target.targetElements,
        x: options.position.hoverPosition.x + 10
      };
    }
    hover.onDispose(() => {
      const stackIndex = this._hoverStack.findIndex((entry) => entry.hover === hover);
      if (stackIndex >= 0) {
        const entry = this._hoverStack[stackIndex];
        const hoverWasFocused = isAncestorOfActiveElement(hover.domNode);
        if (hoverWasFocused && entry.lastFocusedElementBeforeOpen) {
          entry.lastFocusedElementBeforeOpen.focus();
        }
        while (this._hoverStack.length > stackIndex + 1) {
          const nestedEntry = this._hoverStack.pop();
          nestedEntry.contextView.dispose();
          nestedEntry.hover.dispose();
        }
        this._hoverStack.splice(stackIndex, 1);
        entry.contextView.dispose();
      }
      hoverDisposables.dispose();
    }, void 0, hoverDisposables);
    if (!options.container) {
      const targetElement = isHTMLElement(options.target) ? options.target : options.target.targetElements[0];
      options.container = this._layoutService.getContainer(getWindow(targetElement));
    }
    hoverDisposables.add(addDisposableListener(getWindow(options.container).document, EventType.MOUSE_DOWN, (e) => {
      if (!isAncestor(e.target, hover.domNode)) {
        this._hideHoverAndDescendants(hover);
      }
    }));
    if (!options.persistence?.sticky) {
      if ("targetElements" in options.target) {
        for (const element of options.target.targetElements) {
          hoverDisposables.add(addDisposableListener(element, EventType.CLICK, () => this._hideHoverAndDescendants(hover)));
        }
      } else {
        hoverDisposables.add(addDisposableListener(options.target, EventType.CLICK, () => this._hideHoverAndDescendants(hover)));
      }
      const focusedElement = getActiveElement();
      if (focusedElement) {
        const focusedElementDocument = getWindow(focusedElement).document;
        hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_DOWN, (e) => this._keyDown(e, hover, !!options.persistence?.hideOnKeyDown)));
        hoverDisposables.add(addDisposableListener(focusedElementDocument, EventType.KEY_DOWN, (e) => this._keyDown(e, hover, !!options.persistence?.hideOnKeyDown)));
        hoverDisposables.add(addDisposableListener(focusedElement, EventType.KEY_UP, (e) => this._keyUp(e, hover)));
        hoverDisposables.add(addDisposableListener(focusedElementDocument, EventType.KEY_UP, (e) => this._keyUp(e, hover)));
      }
    }
    if ("IntersectionObserver" in mainWindow) {
      const observer = new IntersectionObserver((e) => this._intersectionChange(e, hover), { threshold: 0 });
      const firstTargetElement = "targetElements" in options.target ? options.target.targetElements[0] : options.target;
      observer.observe(firstTargetElement);
      hoverDisposables.add(toDisposable(() => observer.disconnect()));
    }
    return { hover, lastFocusedElementBeforeOpen, store: hoverDisposables };
  }
  _showHover(result, options, focus) {
    const { hover, lastFocusedElementBeforeOpen, store } = result;
    const containingHoverIndex = this._getContainingHoverIndex(options.target);
    const isNesting = containingHoverIndex >= 0;
    if (!isNesting) {
      this._hideAllHovers();
    } else {
      for (let i = this._hoverStack.length - 1; i > containingHoverIndex; i--) {
        this._hoverStack[i].hover.dispose();
      }
      this._hoverStack.length = containingHoverIndex + 1;
    }
    if (isNesting) {
      for (let i = 0; i <= containingHoverIndex; i++) {
        store.add(this._hoverStack[i].hover.addMouseTrackingElement(hover.domNode));
      }
    }
    const container = options.container ?? this._layoutService.getContainer(getWindow(isHTMLElement(options.target) ? options.target : options.target.targetElements[0]));
    const contextView = new ContextView(container, ContextViewDOMPosition.ABSOLUTE);
    const stackEntry = {
      hover,
      options,
      contextView,
      lastFocusedElementBeforeOpen
    };
    this._hoverStack.push(stackEntry);
    const delegate = new HoverContextViewDelegate(hover, focus, this._hoverStack.length);
    contextView.show(delegate);
    store.add(hover.onRequestLayout(() => contextView.layout()));
    if (focus || options.persistence?.sticky) {
      const targetWindow = getWindow(container);
      store.add(addDisposableListener(targetWindow, EventType.RESIZE, () => contextView.layout()));
    }
    if (options.onDidHide) {
      const onDidHide = options.onDidHide;
      store.add(toDisposable(() => onDidHide()));
    }
    options.onDidShow?.();
  }
  /**
   * Hides a specific hover and all hovers nested inside it.
   */
  _hideHoverAndDescendants(hover) {
    const stackIndex = this._hoverStack.findIndex((entry) => entry.hover === hover);
    if (stackIndex < 0) {
      return;
    }
    for (let i = this._hoverStack.length - 1; i >= stackIndex; i--) {
      this._hoverStack[i].hover.dispose();
    }
    this._hoverStack.length = stackIndex;
  }
  /**
   * Hides all hovers in the stack.
   */
  _hideAllHovers() {
    for (let i = this._hoverStack.length - 1; i >= 0; i--) {
      this._hoverStack[i].hover.dispose();
    }
    this._hoverStack.length = 0;
  }
  hideHover(force) {
    if (this._hoverStack.length === 0) {
      return;
    }
    if (!force && this._currentHover?.isLocked) {
      return;
    }
    this.doHideHover();
  }
  doHideHover() {
    const length = this._hoverStack.length;
    this._hoverStack[length - 1]?.hover.dispose();
    this._hoverStack.length = length - 1;
  }
  _intersectionChange(entries, hover) {
    const entry = entries[entries.length - 1];
    if (!entry.isIntersecting) {
      hover.dispose();
    }
  }
  showAndFocusLastHover() {
    if (!this._lastHoverOptions) {
      return;
    }
    this.showInstantHover(this._lastHoverOptions, true, true);
  }
  _showAndFocusHoverForActiveElement() {
    let activeElement = getActiveElement();
    while (activeElement) {
      const hover = this._delayedHovers.get(activeElement) ?? this._managedHovers.get(activeElement);
      if (hover) {
        hover.show(true);
        return;
      }
      activeElement = activeElement.parentElement;
    }
  }
  _keyDown(e, hover, hideOnKeyDown) {
    if (e.key === "Alt") {
      for (const entry of this._hoverStack) {
        entry.hover.isLocked = true;
      }
      return;
    }
    const event = new StandardKeyboardEvent(e);
    const keybinding = this._keybindingService.resolveKeyboardEvent(event);
    if (keybinding.getSingleModifierDispatchChords().some((value) => !!value) || this._keybindingService.softDispatch(event, event.target).kind !== ResultKind.NoMatchingKb) {
      return;
    }
    if (hideOnKeyDown && (!this._currentHoverOptions?.trapFocus || e.key !== "Tab")) {
      const stackEntry = this._hoverStack.find((entry) => entry.hover === hover);
      this._hideHoverAndDescendants(hover);
      stackEntry?.lastFocusedElementBeforeOpen?.focus();
    }
  }
  _keyUp(e, hover) {
    if (e.key === "Alt") {
      for (const entry of this._hoverStack) {
        if (!entry.options.persistence?.sticky) {
          entry.hover.isLocked = false;
        }
      }
      const anyMouseIn = this._hoverStack.some((entry) => entry.hover.isMouseIn);
      if (!anyMouseIn) {
        const topEntry = this._hoverStack[this._hoverStack.length - 1];
        this._hideAllHovers();
        topEntry?.lastFocusedElementBeforeOpen?.focus();
      }
    }
  }
  // TODO: Investigate performance of this function. There seems to be a lot of content created
  //       and thrown away on start up
  setupManagedHover(hoverDelegate, targetElement, content, options) {
    if (hoverDelegate.showNativeHover) {
      return setupNativeHover(targetElement, content);
    }
    targetElement.setAttribute("custom-hover", "true");
    if (targetElement.title !== "") {
      console.warn("HTML element already has a title attribute, which will conflict with the custom hover. Please remove the title attribute.");
      targetElement.title = "";
    }
    let hoverPreparation;
    let hoverWidget;
    const hideHover = (disposeWidget, disposePreparation) => {
      const hadHover = hoverWidget !== void 0;
      if (disposeWidget) {
        hoverWidget?.dispose();
        hoverWidget = void 0;
      }
      if (disposePreparation) {
        hoverPreparation?.dispose();
        hoverPreparation = void 0;
      }
      if (hadHover) {
        hoverDelegate.onDidHideHover?.();
        hoverWidget = void 0;
      }
    };
    const triggerShowHover = (delay, focus, target, trapFocus) => {
      return new TimeoutTimer(async () => {
        if (!hoverWidget || hoverWidget.isDisposed) {
          hoverWidget = new ManagedHoverWidget(hoverDelegate, target || targetElement, delay > 0);
          await hoverWidget.update(typeof content === "function" ? content() : content, focus, { ...options, trapFocus });
        }
      }, delay);
    };
    const store = new DisposableStore();
    let isMouseDown = false;
    store.add(addDisposableListener(targetElement, EventType.MOUSE_DOWN, () => {
      isMouseDown = true;
      hideHover(true, true);
    }, true));
    store.add(addDisposableListener(targetElement, EventType.MOUSE_UP, () => {
      isMouseDown = false;
    }, true));
    store.add(addDisposableListener(targetElement, EventType.MOUSE_LEAVE, (e) => {
      isMouseDown = false;
      hideHover(false, e.fromElement === targetElement);
    }, true));
    store.add(addDisposableListener(targetElement, EventType.MOUSE_OVER, (e) => {
      if (hoverPreparation) {
        return;
      }
      const mouseOverStore = new DisposableStore();
      const target = {
        targetElements: [targetElement],
        dispose: () => {
        }
      };
      if (hoverDelegate.placement === void 0 || hoverDelegate.placement === "mouse") {
        const onMouseMove = (e2) => {
          target.x = e2.x + 10;
          if (!eventIsRelatedToTarget(e2, targetElement)) {
            hideHover(true, true);
          }
        };
        mouseOverStore.add(addDisposableListener(targetElement, EventType.MOUSE_MOVE, onMouseMove, true));
      }
      hoverPreparation = mouseOverStore;
      if (!eventIsRelatedToTarget(e, targetElement)) {
        return;
      }
      mouseOverStore.add(triggerShowHover(typeof hoverDelegate.delay === "function" ? hoverDelegate.delay(content) : hoverDelegate.delay, false, target));
    }, true));
    const onFocus = (e) => {
      if (isMouseDown || hoverPreparation) {
        return;
      }
      if (hoverWidget?.isDisposed) {
        hoverWidget = void 0;
      }
      const fromHover = isHTMLElement(e.relatedTarget) && e.relatedTarget.closest(".monaco-hover");
      if (fromHover || !e.relatedTarget) {
        return;
      }
      if (!eventIsRelatedToTarget(e, targetElement)) {
        return;
      }
      const target = {
        targetElements: [targetElement],
        dispose: () => {
        }
      };
      const toDispose = new DisposableStore();
      const onBlur = () => hideHover(true, true);
      toDispose.add(addDisposableListener(targetElement, EventType.BLUR, onBlur, true));
      toDispose.add(triggerShowHover(typeof hoverDelegate.delay === "function" ? hoverDelegate.delay(content) : hoverDelegate.delay, false, target));
      hoverPreparation = toDispose;
    };
    if (!isEditableElement(targetElement)) {
      store.add(addDisposableListener(targetElement, EventType.FOCUS, onFocus, true));
    }
    const hover = {
      show: (focus) => {
        hideHover(false, true);
        triggerShowHover(0, focus, void 0, focus);
      },
      hide: () => {
        hideHover(true, true);
      },
      update: async (newContent, hoverOptions) => {
        content = newContent;
        await hoverWidget?.update(content, void 0, hoverOptions);
      },
      dispose: () => {
        this._managedHovers.delete(targetElement);
        store.dispose();
        hideHover(true, true);
      }
    };
    this._managedHovers.set(targetElement, hover);
    return hover;
  }
  showManagedHover(target) {
    const hover = this._managedHovers.get(target);
    if (hover) {
      hover.show(true);
    }
  }
  dispose() {
    this._managedHovers.forEach((hover) => hover.dispose());
    super.dispose();
  }
};
HoverService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, ILayoutService),
  __decorateParam(5, IAccessibilityService)
], HoverService);
function getHoverOptionsIdentity(options) {
  if (options === void 0) {
    return void 0;
  }
  return options?.id ?? options;
}
function getHoverIdFromContent(content) {
  if (isHTMLElement(content)) {
    return void 0;
  }
  if (typeof content === "string") {
    return content.toString();
  }
  return content.value;
}
function getStringContent(contentOrFactory) {
  const content = typeof contentOrFactory === "function" ? contentOrFactory() : contentOrFactory;
  if (isString(content)) {
    return stripIcons(content);
  }
  if (isManagedHoverTooltipMarkdownString(content)) {
    return content.markdownNotSupportedFallback;
  }
  return void 0;
}
function setupNativeHover(targetElement, content) {
  function updateTitle(title) {
    if (title) {
      targetElement.setAttribute("title", title);
    } else {
      targetElement.removeAttribute("title");
    }
  }
  updateTitle(getStringContent(content));
  return {
    update: (content2) => updateTitle(getStringContent(content2)),
    show: () => {
    },
    hide: () => {
    },
    dispose: () => updateTitle(void 0)
  };
}
class HoverContextViewDelegate {
  constructor(_hover, _focus = false, stackDepth = 1) {
    this._hover = _hover;
    this._focus = _focus;
    this.layer = stackDepth;
  }
  get anchorPosition() {
    return this._hover.anchor;
  }
  render(container) {
    this._hover.render(container);
    if (this._focus) {
      this._hover.focus();
    }
    return this._hover;
  }
  getAnchor() {
    return {
      x: this._hover.x,
      y: this._hover.y
    };
  }
  layout() {
    this._hover.layout();
  }
}
function eventIsRelatedToTarget(event, target) {
  return isHTMLElement(event.target) && getHoverTargetElement(event.target, target) === target;
}
function getHoverTargetElement(element, stopElement) {
  stopElement = stopElement ?? getWindow(element).document.body;
  while (!element.hasAttribute("custom-hover") && element !== stopElement) {
    element = element.parentElement;
  }
  return element;
}
function resolveMouseStyleHoverTarget(target, e) {
  return {
    targetElements: [target],
    x: e.x + 10
  };
}
registerSingleton(IHoverService, HoverService, InstantiationType.Delayed);
registerThemingParticipant((theme, collector) => {
  const hoverBorder = theme.getColor(editorHoverBorder);
  if (hoverBorder) {
    collector.addRule(`.monaco-hover.workbench-hover .hover-row:not(:first-child):not(:empty) { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
    collector.addRule(`.monaco-hover.workbench-hover hr { border-top: 1px solid ${hoverBorder.transparent(0.5)}; }`);
  }
});
export {
  HoverService
};
