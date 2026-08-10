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
import * as dom from "../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../base/browser/domStylesheets.js";
import { ToolBar } from "../../../base/browser/ui/toolbar/toolbar.js";
import { Button } from "../../../base/browser/ui/button/button.js";
import { CountBadge } from "../../../base/browser/ui/countBadge/countBadge.js";
import { ProgressBar } from "../../../base/browser/ui/progressbar/progressbar.js";
import { disposableTimeout } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, MutableDisposable, dispose } from "../../../base/common/lifecycle.js";
import Severity from "../../../base/common/severity.js";
import { isString } from "../../../base/common/types.js";
import { isModifierKey } from "../../../base/common/keyCodes.js";
import { localize } from "../../../nls.js";
import { QuickInputHideReason, QuickPickFocus } from "../common/quickInput.js";
import { QuickInputBox } from "./quickInputBox.js";
import { QuickPick, backButton, InputBox, QuickWidget, InQuickInputContextKey, QuickInputTypeContextKey, EndOfQuickInputBoxContextKey, QuickInputAlignmentContextKey } from "./quickInput.js";
import { ILayoutService } from "../../layout/browser/layoutService.js";
import { mainWindow } from "../../../base/browser/window.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IContextMenuService } from "../../contextview/browser/contextView.js";
import { QuickInputList } from "./quickInputList.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import "./quickInputActions.js";
import { autorun, observableValue } from "../../../base/common/observable.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { Platform, platform, setTimeout0 } from "../../../base/common/platform.js";
import { getWindowControlsStyle, WindowControlsStyle } from "../../window/common/window.js";
import { getZoomFactor } from "../../../base/browser/browser.js";
import { TriStateCheckbox, createToggleActionViewItemProvider } from "../../../base/browser/ui/toggle/toggle.js";
import { defaultCheckboxStyles } from "../../theme/browser/defaultStyles.js";
import { QuickInputTreeController } from "./tree/quickInputTreeController.js";
import { QuickTree } from "./tree/quickTree.js";
import { AnchorAlignment, AnchorPosition, layout2d } from "../../../base/common/layout.js";
import { getAnchorRect } from "../../../base/browser/ui/contextview/contextview.js";
const $ = dom.$;
const VIEWSTATE_STORAGE_KEY = "workbench.quickInput.viewState";
const QUICK_INPUT_MOTION_CLOSING_CLASS = "quick-input-widget-closing";
const QUICK_INPUT_OVERLAY_CLASS = "quick-input-widget-overlay";
const QUICK_INPUT_CLOSE_ANIMATION_DURATION = 150;
const QUICK_INPUT_MOTION_ANCESTOR_CLASSES = ["style-override", "monaco-enable-motion"];
let QuickInputController = class extends Disposable {
  constructor(options, layoutService, instantiationService, contextKeyService, storageService, contextMenuService) {
    super();
    this.options = options;
    this.layoutService = layoutService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.contextMenuService = contextMenuService;
    this.enabled = true;
    this.onDidAcceptEmitter = this._register(new Emitter());
    this.onDidCustomEmitter = this._register(new Emitter());
    this.onDidTriggerButtonEmitter = this._register(new Emitter());
    this.keyMods = { ctrlCmd: false, alt: false, shift: false };
    this.controller = null;
    this.onShowEmitter = this._register(new Emitter());
    this.onShow = this.onShowEmitter.event;
    this.onHideEmitter = this._register(new Emitter());
    this.onHide = this.onHideEmitter.event;
    this.closeAnimation = this._register(new MutableDisposable());
    this._alignment = observableValue(this, "top");
    this.alignment = this._alignment;
    this.backButton = backButton;
    this.inQuickInputContext = InQuickInputContextKey.bindTo(contextKeyService);
    this.quickInputTypeContext = QuickInputTypeContextKey.bindTo(contextKeyService);
    this.endOfQuickInputBoxContext = EndOfQuickInputBoxContextKey.bindTo(contextKeyService);
    this.idPrefix = options.idPrefix;
    this._container = options.container;
    this.styles = options.styles;
    this._register(Event.runAndSubscribe(dom.onDidRegisterWindow, ({ window, disposables }) => this.registerKeyModsListeners(window, disposables), { window: mainWindow, disposables: this._store }));
    this._register(dom.onWillUnregisterWindow((window) => {
      if (this.ui && dom.getWindow(this.ui.container) === window) {
        this.reparentUI(this.layoutService.mainContainer);
        this.layout(this.layoutService.mainContainerDimension, this.layoutService.mainContainerOffset.quickPickTop);
      }
    }));
    this.viewState = this.loadViewState();
  }
  static {
    this.MAX_WIDTH = 600;
  }
  get currentQuickInput() {
    return this.controller ?? void 0;
  }
  get container() {
    return this._container;
  }
  registerKeyModsListeners(window, disposables) {
    const listener = (e) => {
      this.keyMods.ctrlCmd = e.ctrlKey || e.metaKey;
      this.keyMods.alt = e.altKey;
      this.keyMods.shift = e.shiftKey;
    };
    for (const event of [dom.EventType.KEY_DOWN, dom.EventType.KEY_UP, dom.EventType.MOUSE_DOWN]) {
      disposables.add(dom.addDisposableListener(window, event, listener, true));
    }
  }
  getUI(showInActiveContainer) {
    if (this.ui) {
      if (showInActiveContainer) {
        if (dom.getWindow(this._container) !== dom.getWindow(this.layoutService.activeContainer)) {
          this.reparentUI(this.layoutService.activeContainer);
          this.layout(this.layoutService.activeContainerDimension, this.layoutService.activeContainerOffset.quickPickTop);
        }
      }
      return this.ui;
    }
    const container = dom.append(this._container, $(".quick-input-widget.show-file-icons"));
    container.tabIndex = -1;
    container.style.display = "none";
    const styleSheet = domStylesheetsJs.createStyleSheet(container);
    const titleBar = dom.append(container, $(".quick-input-titlebar"));
    const leftActionBar = this._register(new ToolBar(titleBar, this.contextMenuService, {
      hoverDelegate: this.options.hoverDelegate,
      actionViewItemProvider: createToggleActionViewItemProvider(this.styles.toggle),
      icon: true,
      label: false
    }));
    leftActionBar.getElement().classList.add("quick-input-left-action-bar");
    const title = dom.append(titleBar, $(".quick-input-title"));
    const rightActionBar = this._register(new ToolBar(titleBar, this.contextMenuService, {
      hoverDelegate: this.options.hoverDelegate,
      actionViewItemProvider: createToggleActionViewItemProvider(this.styles.toggle),
      icon: true,
      label: false
    }));
    rightActionBar.getElement().classList.add("quick-input-right-action-bar");
    const headerContainer = dom.append(container, $(".quick-input-header"));
    const checkAll = this._register(new TriStateCheckbox(localize("quickInput.checkAll", "Toggle all checkboxes"), false, { ...defaultCheckboxStyles, size: 15 }));
    dom.append(headerContainer, checkAll.domNode);
    this._register(checkAll.onChange(() => {
      const checked = checkAll.checked;
      list.setAllVisibleChecked(checked === true);
    }));
    this._register(dom.addDisposableListener(checkAll.domNode, dom.EventType.CLICK, (e) => {
      if (e.x || e.y) {
        inputBox.setFocus();
      }
    }));
    const description2 = dom.append(headerContainer, $(".quick-input-description"));
    const inputContainer = dom.append(headerContainer, $(".quick-input-and-message"));
    const filterContainer = dom.append(inputContainer, $(".quick-input-filter"));
    const inputBox = this._register(new QuickInputBox(filterContainer, this.styles.inputBox, this.styles.toggle));
    inputBox.setAttribute("aria-describedby", `${this.idPrefix}message`);
    const visibleCountContainer = dom.append(filterContainer, $(".quick-input-visible-count"));
    visibleCountContainer.setAttribute("aria-live", "polite");
    visibleCountContainer.setAttribute("aria-atomic", "true");
    const visibleCount = this._register(new CountBadge(visibleCountContainer, { countFormat: localize({ key: "quickInput.visibleCount", comment: ["This tells the user how many items are shown in a list of items to select from. The items can be anything. Currently not visible, but read by screen readers."] }, "{0} Results") }, this.styles.countBadge));
    const countContainer = dom.append(filterContainer, $(".quick-input-count"));
    countContainer.setAttribute("aria-live", "polite");
    const count = this._register(new CountBadge(countContainer, { countFormat: localize({ key: "quickInput.countSelected", comment: ["This tells the user how many items are selected in a list of items to select from. The items can be anything."] }, "{0} Selected") }, this.styles.countBadge));
    const inlineActionBar = this._register(new ToolBar(headerContainer, this.contextMenuService, {
      hoverDelegate: this.options.hoverDelegate,
      actionViewItemProvider: createToggleActionViewItemProvider(this.styles.toggle),
      icon: true,
      label: false
    }));
    inlineActionBar.getElement().classList.add("quick-input-inline-action-bar");
    const okContainer = dom.append(headerContainer, $(".quick-input-action"));
    const ok = this._register(new Button(okContainer, this.styles.button));
    ok.label = localize("ok", "OK");
    this._register(ok.onDidClick((e) => {
      this.onDidAcceptEmitter.fire();
    }));
    const customButtonContainer = dom.append(headerContainer, $(".quick-input-action"));
    const customButton = this._register(new Button(customButtonContainer, { ...this.styles.button, supportIcons: true }));
    customButton.label = localize("custom", "Custom");
    this._register(customButton.onDidClick((e) => {
      this.onDidCustomEmitter.fire();
    }));
    const message = dom.append(inputContainer, $(`#${this.idPrefix}message.quick-input-message`));
    const progressBar = this._register(new ProgressBar(container, this.styles.progressBar));
    progressBar.getContainer().classList.add("quick-input-progress");
    const widget = dom.append(container, $(".quick-input-html-widget"));
    widget.tabIndex = -1;
    const description1 = dom.append(container, $(".quick-input-description"));
    const listId = this.idPrefix + "list";
    const list = this._register(this.instantiationService.createInstance(QuickInputList, container, this.options.hoverDelegate, this.options.linkOpenerDelegate, listId, this.styles));
    inputBox.setAttribute("aria-controls", listId);
    this._register(list.onDidChangeFocus(() => {
      if (inputBox.hasFocus()) {
        const activeDescendant = list.getActiveDescendant();
        if (activeDescendant) {
          inputBox.setAttribute("aria-activedescendant", activeDescendant);
          inputBox.setListFocusMode(true);
        } else {
          inputBox.removeAttribute("aria-activedescendant");
          inputBox.setListFocusMode(false);
        }
      }
    }));
    this._register(list.onChangedAllVisibleChecked((checked) => {
      checkAll.checked = checked;
    }));
    this._register(list.onChangedVisibleCount((c) => {
      visibleCount.setCount(c);
    }));
    this._register(list.onChangedCheckedCount((c) => {
      setTimeout0(() => count.setCount(c));
    }));
    this._register(list.onLeave(() => {
      setTimeout(() => {
        if (!this.controller) {
          return;
        }
        inputBox.setFocus();
        if (this.controller instanceof QuickPick && this.controller.canSelectMany) {
          list.clearFocus();
        }
      }, 0);
    }));
    const tree = this._register(this.instantiationService.createInstance(
      QuickInputTreeController,
      container,
      this.options.hoverDelegate,
      this.styles
    ));
    this._register(tree.tree.onDidChangeFocus(() => {
      if (inputBox.hasFocus()) {
        const activeDescendant = tree.getActiveDescendant();
        if (activeDescendant) {
          inputBox.setAttribute("aria-activedescendant", activeDescendant);
          inputBox.setListFocusMode(true);
        } else {
          inputBox.removeAttribute("aria-activedescendant");
          inputBox.setListFocusMode(false);
        }
      }
    }));
    this._register(tree.onLeave(() => {
      setTimeout(() => {
        if (!this.controller) {
          return;
        }
        inputBox.setFocus();
        tree.tree.setFocus([]);
      }, 0);
    }));
    this._register(tree.onDidAccept(() => {
      this.onDidAcceptEmitter.fire();
    }));
    this._register(tree.tree.onDidChangeContentHeight(() => this.updateLayout()));
    const focusTracker = dom.trackFocus(container);
    this._register(focusTracker);
    this._register(dom.addDisposableListener(container, dom.EventType.FOCUS, (e) => {
      const ui = this.getUI();
      if (dom.isAncestor(e.relatedTarget, ui.inputContainer)) {
        const value = ui.inputBox.isSelectionAtEnd();
        if (this.endOfQuickInputBoxContext.get() !== value) {
          this.endOfQuickInputBoxContext.set(value);
        }
      }
      if (dom.isAncestor(e.relatedTarget, ui.container)) {
        return;
      }
      this.inQuickInputContext.set(true);
      this.previousFocusElement = dom.isHTMLElement(e.relatedTarget) ? e.relatedTarget : void 0;
    }, true));
    this._register(focusTracker.onDidBlur(() => {
      if (!this.getUI().ignoreFocusOut && !this.options.ignoreFocusOut()) {
        this.hide(QuickInputHideReason.Blur);
      }
      this.inQuickInputContext.set(false);
      this.endOfQuickInputBoxContext.set(false);
      this.previousFocusElement = void 0;
    }));
    this._register(inputBox.onKeyDown((e) => {
      const value = this.getUI().inputBox.isSelectionAtEnd();
      if (this.endOfQuickInputBoxContext.get() !== value) {
        this.endOfQuickInputBoxContext.set(value);
      }
      if (!isModifierKey(e.keyCode)) {
        inputBox.removeAttribute("aria-activedescendant");
        inputBox.setListFocusMode(false);
      }
    }));
    this._register(dom.addDisposableListener(container, dom.EventType.FOCUS, (e) => {
      inputBox.setFocus();
    }));
    this.dndController = this._register(this.instantiationService.createInstance(
      QuickInputDragAndDropController,
      this._container,
      container,
      [
        {
          node: titleBar,
          includeChildren: true,
          excludeNodes: [leftActionBar.getElement(), rightActionBar.getElement()]
        },
        {
          node: headerContainer,
          includeChildren: false
        }
      ],
      this.viewState
    ));
    this._register(autorun((reader) => {
      const dndViewState = this.dndController?.dndViewState.read(reader);
      if (!dndViewState) {
        return;
      }
      if (dndViewState.top !== void 0 && dndViewState.left !== void 0) {
        this.viewState = {
          ...this.viewState,
          top: dndViewState.top,
          left: dndViewState.left
        };
      } else {
        this.viewState = void 0;
      }
      this.updateLayout();
      if (dndViewState.done) {
        this.saveViewState(this.viewState);
      }
    }));
    this._register(autorun((reader) => {
      this._alignment.set(this.dndController.alignment.read(reader), void 0);
    }));
    this.ui = {
      container,
      styleSheet,
      leftActionBar,
      titleBar,
      title,
      description1,
      description2,
      widget,
      rightActionBar,
      inlineActionBar,
      checkAll,
      inputContainer,
      filterContainer,
      inputBox,
      visibleCountContainer,
      visibleCount,
      countContainer,
      count,
      okContainer,
      ok,
      message,
      customButtonContainer,
      customButton,
      list,
      tree,
      progressBar,
      onDidAccept: this.onDidAcceptEmitter.event,
      onDidCustom: this.onDidCustomEmitter.event,
      onDidTriggerButton: this.onDidTriggerButtonEmitter.event,
      ignoreFocusOut: false,
      keyMods: this.keyMods,
      show: (controller) => this.show(controller),
      hide: () => this.hide(),
      setVisibilities: (visibilities) => this.setVisibilities(visibilities),
      setEnabled: (enabled) => this.setEnabled(enabled),
      setContextKey: (contextKey) => this.options.setContextKey(contextKey),
      linkOpenerDelegate: (content) => this.options.linkOpenerDelegate(content)
    };
    this.updateStyles();
    return this.ui;
  }
  reparentUI(container) {
    if (this.ui) {
      this._container = container;
      dom.append(this._container, this.ui.container);
      this.dndController?.reparentUI(this._container);
    }
  }
  pick(picks, options = {}, token = CancellationToken.None) {
    return new Promise((doResolve, reject) => {
      let resolve = (result) => {
        resolve = doResolve;
        options.onKeyMods?.(input.keyMods);
        doResolve(result);
      };
      if (token.isCancellationRequested) {
        resolve(void 0);
        return;
      }
      const input = this.createQuickPick({ useSeparators: true });
      let activeItem;
      const disposables = [
        input,
        input.onDidAccept(() => {
          if (input.canSelectMany) {
            resolve(input.selectedItems.slice());
            input.hide();
          } else {
            const result = input.activeItems[0];
            if (result) {
              resolve(result);
              input.hide();
            }
          }
        }),
        input.onDidChangeActive((items) => {
          const focused = items[0];
          if (focused && options.onDidFocus) {
            options.onDidFocus(focused);
          }
        }),
        input.onDidChangeSelection((items) => {
          if (!input.canSelectMany) {
            const result = items[0];
            if (result) {
              resolve(result);
              input.hide();
            }
          }
        }),
        input.onDidTriggerItemButton((event) => options.onDidTriggerItemButton && options.onDidTriggerItemButton({
          ...event,
          removeItem: () => {
            const index = input.items.indexOf(event.item);
            if (index !== -1) {
              const items = input.items.slice();
              const removed = items.splice(index, 1);
              const activeItems = input.activeItems.filter((activeItem2) => activeItem2 !== removed[0]);
              const keepScrollPositionBefore = input.keepScrollPosition;
              input.keepScrollPosition = true;
              input.items = items;
              if (activeItems) {
                input.activeItems = activeItems;
              }
              input.keepScrollPosition = keepScrollPositionBefore;
            }
          }
        })),
        input.onDidTriggerSeparatorButton((event) => options.onDidTriggerSeparatorButton?.(event)),
        input.onDidChangeValue((value) => {
          if (activeItem && !value && (input.activeItems.length !== 1 || input.activeItems[0] !== activeItem)) {
            input.activeItems = [activeItem];
          }
        }),
        token.onCancellationRequested(() => {
          input.hide();
        }),
        input.onDidHide(() => {
          dispose(disposables);
          resolve(void 0);
        })
      ];
      input.title = options.title;
      if (options.value) {
        input.value = options.value;
      }
      input.canSelectMany = !!options.canPickMany;
      input.placeholder = options.placeHolder;
      input.prompt = options.prompt;
      input.ignoreFocusOut = !!options.ignoreFocusLost;
      input.matchOnDescription = !!options.matchOnDescription;
      input.matchOnDetail = !!options.matchOnDetail;
      if (options.sortByLabel !== void 0) {
        input.sortByLabel = options.sortByLabel;
      }
      input.matchOnLabel = options.matchOnLabel === void 0 || options.matchOnLabel;
      input.quickNavigate = options.quickNavigate;
      input.hideInput = !!options.hideInput;
      input.contextKey = options.contextKey;
      input.anchor = options.anchor;
      input.anchorPosition = options.anchorPosition;
      input.busy = true;
      Promise.all([picks, options.activeItem]).then(([items, _activeItem]) => {
        activeItem = _activeItem;
        input.busy = false;
        input.items = items;
        if (input.canSelectMany) {
          input.selectedItems = items.filter((item) => item.type !== "separator" && item.picked);
        }
        if (activeItem) {
          input.activeItems = [activeItem];
        }
      });
      input.show();
      Promise.resolve(picks).then(void 0, (err) => {
        reject(err);
        input.hide();
      });
    });
  }
  setValidationOnInput(input, validationResult) {
    if (validationResult && isString(validationResult)) {
      input.severity = Severity.Error;
      input.validationMessage = validationResult;
    } else if (validationResult && !isString(validationResult)) {
      input.severity = validationResult.severity;
      input.validationMessage = validationResult.content;
    } else {
      input.severity = Severity.Ignore;
      input.validationMessage = void 0;
    }
  }
  input(options = {}, token = CancellationToken.None) {
    return new Promise((resolve) => {
      if (token.isCancellationRequested) {
        resolve(void 0);
        return;
      }
      const input = this.createInputBox();
      const validateInput = options.validateInput || (() => Promise.resolve(void 0));
      const onDidValueChange = Event.debounce(input.onDidChangeValue, (last, cur) => cur, 100);
      let validationValue = options.value || "";
      let validation = Promise.resolve(validateInput(validationValue));
      const disposables = [
        input,
        onDidValueChange((value) => {
          if (value !== validationValue) {
            validation = Promise.resolve(validateInput(value));
            validationValue = value;
          }
          validation.then((result) => {
            if (value === validationValue) {
              this.setValidationOnInput(input, result);
            }
          });
        }),
        input.onDidAccept(() => {
          const value = input.value;
          if (value !== validationValue) {
            validation = Promise.resolve(validateInput(value));
            validationValue = value;
          }
          validation.then((result) => {
            if (!result || !isString(result) && result.severity !== Severity.Error) {
              resolve(value);
              input.hide();
            } else if (value === validationValue) {
              this.setValidationOnInput(input, result);
            }
          });
        }),
        token.onCancellationRequested(() => {
          input.hide();
        }),
        input.onDidHide(() => {
          dispose(disposables);
          resolve(void 0);
        })
      ];
      input.title = options.title;
      input.value = options.value || "";
      input.valueSelection = options.valueSelection;
      input.prompt = options.prompt;
      input.placeholder = options.placeHolder;
      input.password = !!options.password;
      input.ignoreFocusOut = !!options.ignoreFocusLost;
      input.show();
    });
  }
  createQuickPick(options = { useSeparators: false }) {
    const ui = this.getUI(true);
    return new QuickPick(ui);
  }
  createInputBox() {
    const ui = this.getUI(true);
    return new InputBox(ui);
  }
  setAlignment(alignment) {
    if (this.controller?.anchor) {
      return;
    }
    this.dndController?.setAlignment(alignment);
  }
  createQuickWidget() {
    const ui = this.getUI(true);
    return new QuickWidget(ui);
  }
  createQuickTree() {
    const ui = this.getUI(true);
    return new QuickTree(ui);
  }
  show(controller) {
    this.completeCloseAnimation();
    const ui = this.getUI(true);
    const oldController = this.controller;
    this.controller = controller;
    oldController?.didHide();
    if (dom.isHTMLElement(controller.anchor)) {
      const anchorWindow = dom.getWindow(controller.anchor);
      if (dom.getWindow(this._container) !== anchorWindow) {
        this.reparentUI(this.layoutService.getContainer(anchorWindow));
      }
    }
    this.setEnabled(true);
    ui.leftActionBar.setActions([]);
    ui.title.textContent = "";
    ui.description1.textContent = "";
    ui.description2.textContent = "";
    dom.reset(ui.widget);
    ui.rightActionBar.setActions([]);
    ui.inlineActionBar.setActions([]);
    ui.checkAll.checked = false;
    ui.inputBox.placeholder = "";
    ui.inputBox.password = false;
    ui.inputBox.showDecoration(Severity.Ignore);
    ui.visibleCount.setCount(0);
    ui.count.setCount(0);
    ui.countContainer.style.right = "4px";
    dom.reset(ui.message);
    ui.progressBar.stop();
    ui.progressBar.getContainer().setAttribute("aria-hidden", "true");
    ui.list.setElements([]);
    ui.list.matchOnDescription = false;
    ui.list.matchOnDetail = false;
    ui.list.matchOnLabel = true;
    ui.list.sortByLabel = true;
    ui.tree.updateFilterOptions({
      matchOnDescription: false,
      matchOnLabel: true
    });
    ui.tree.sortByLabel = true;
    ui.ignoreFocusOut = false;
    ui.inputBox.toggles = void 0;
    ui.inputBox.actions = void 0;
    ui.inputBox.setHeight(void 0);
    const backKeybindingLabel = this.options.backKeybindingLabel();
    backButton.tooltip = backKeybindingLabel ? localize("quickInput.backWithKeybinding", "Back ({0})", backKeybindingLabel) : localize("quickInput.back", "Back");
    this.overlayLayoutCorrection = void 0;
    ui.container.classList.toggle(QUICK_INPUT_OVERLAY_CLASS, controller.anchorPosition === "overlay");
    ui.container.style.display = "";
    this.updateLayout();
    this.dndController?.setEnabled(!controller.anchor);
    this.dndController?.layoutContainer();
    if (controller.anchor) {
      this._alignment.set("custom", void 0);
    } else {
      this._alignment.set(this.dndController?.alignment.get() ?? "top", void 0);
    }
    this.onShowEmitter.fire();
    ui.inputBox.setFocus();
    this.quickInputTypeContext.set(controller.type);
  }
  isVisible() {
    return !!this.controller;
  }
  setVisibilities(visibilities) {
    const ui = this.getUI();
    ui.title.style.display = visibilities.title ? "" : "none";
    ui.description1.style.display = visibilities.description && (visibilities.inputBox || visibilities.checkAll) ? "" : "none";
    ui.description2.style.display = visibilities.description && !(visibilities.inputBox || visibilities.checkAll) ? "" : "none";
    ui.checkAll.domNode.style.display = visibilities.checkAll ? "" : "none";
    ui.inputContainer.style.display = visibilities.inputBox ? "" : "none";
    ui.filterContainer.style.display = visibilities.inputBox ? "" : "none";
    ui.visibleCountContainer.style.display = visibilities.visibleCount ? "" : "none";
    ui.countContainer.style.display = visibilities.count ? "" : "none";
    ui.okContainer.style.display = visibilities.ok ? "" : "none";
    ui.customButtonContainer.style.display = visibilities.customButton ? "" : "none";
    ui.message.style.display = visibilities.message ? "" : "none";
    ui.progressBar.getContainer().style.display = visibilities.progressBar ? "" : "none";
    ui.list.displayed = !!visibilities.list;
    ui.tree.displayed = !!visibilities.tree;
    ui.container.classList.toggle("show-checkboxes", !!visibilities.checkBox);
    ui.container.classList.toggle("hidden-input", !visibilities.inputBox && !visibilities.description);
    this.overlayLayoutCorrection = void 0;
    this.updateLayout();
  }
  setEnabled(enabled) {
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      const ui = this.getUI();
      for (let i = 0; i < ui.leftActionBar.getItemsLength(); i++) {
        const action = ui.leftActionBar.getItemAction(i);
        if (action) {
          action.enabled = enabled;
        }
      }
      for (let i = 0; i < ui.rightActionBar.getItemsLength(); i++) {
        const action = ui.rightActionBar.getItemAction(i);
        if (action) {
          action.enabled = enabled;
        }
      }
      if (enabled) {
        ui.checkAll.enable();
      } else {
        ui.checkAll.disable();
      }
      ui.inputBox.enabled = enabled;
      ui.ok.enabled = enabled;
      ui.list.enabled = enabled;
    }
  }
  hide(reason) {
    const controller = this.controller;
    if (!controller) {
      return;
    }
    controller.willHide(reason);
    const container = this.ui?.container;
    const focusChanged = container && !dom.isAncestorOfActiveElement(container);
    this.controller = null;
    this.onHideEmitter.fire();
    if (container) {
      if (!container.classList.contains(QUICK_INPUT_OVERLAY_CLASS) && dom.hasParentWithClass(container, QUICK_INPUT_MOTION_ANCESTOR_CLASSES)) {
        container.inert = true;
        container.classList.add(QUICK_INPUT_MOTION_CLOSING_CLASS);
        this.closeAnimation.value = disposableTimeout(() => this.completeCloseAnimation(), QUICK_INPUT_CLOSE_ANIMATION_DURATION);
      } else {
        container.style.display = "none";
      }
    }
    if (!focusChanged) {
      let currentElement = this.previousFocusElement;
      while (currentElement && !currentElement.offsetParent) {
        currentElement = currentElement.parentElement ?? void 0;
      }
      if (currentElement?.offsetParent) {
        currentElement.focus();
        this.previousFocusElement = void 0;
      } else {
        this.options.returnFocus();
      }
    }
    controller.didHide(reason);
  }
  completeCloseAnimation() {
    if (!this.closeAnimation.value) {
      return;
    }
    this.closeAnimation.clear();
    const container = this.ui?.container;
    if (container) {
      container.inert = false;
      container.classList.remove(QUICK_INPUT_MOTION_CLOSING_CLASS);
      container.style.display = "none";
    }
  }
  dispose() {
    this.completeCloseAnimation();
    super.dispose();
  }
  focus() {
    if (this.isVisible()) {
      const ui = this.getUI();
      if (ui.inputBox.enabled) {
        ui.inputBox.setFocus();
      } else {
        ui.list.domFocus();
      }
    }
  }
  toggle() {
    if (!this.isVisible()) {
      return;
    }
    if (this.controller instanceof QuickPick && this.controller.canSelectMany) {
      this.getUI().list.toggleCheckbox();
    } else if (this.controller instanceof QuickTree) {
      this.getUI().tree.toggleCheckbox();
    }
  }
  toggleHover() {
    if (this.isVisible() && this.controller instanceof QuickPick) {
      this.getUI().list.toggleHover();
    }
  }
  navigate(next, quickNavigate) {
    if (this.isVisible() && this.getUI().list.displayed) {
      this.getUI().list.focus(next ? QuickPickFocus.Next : QuickPickFocus.Previous);
      if (quickNavigate && this.controller instanceof QuickPick) {
        this.controller.quickNavigate = quickNavigate;
      }
    }
  }
  async accept(keyMods = { alt: false, ctrlCmd: false, shift: false }) {
    this.keyMods.alt = keyMods.alt;
    this.keyMods.ctrlCmd = keyMods.ctrlCmd;
    this.keyMods.shift = keyMods.shift;
    this.onDidAcceptEmitter.fire();
  }
  async back() {
    this.onDidTriggerButtonEmitter.fire(this.backButton);
  }
  async cancel(reason) {
    this.hide(reason);
  }
  layout(dimension, titleBarOffset) {
    this.dimension = dimension;
    this.titleBarOffset = titleBarOffset;
    this.overlayLayoutCorrection = void 0;
    this.updateLayout();
  }
  updateLayout() {
    if (this.ui && this.isVisible()) {
      const style = this.ui.container.style;
      let width = Math.min(this.dimension.width * 0.62, QuickInputController.MAX_WIDTH);
      style.width = width + "px";
      let listHeight = this.dimension && this.dimension.height * 0.4;
      let overlayAnchor;
      if (this.controller?.anchor) {
        const target = this.controller.anchor;
        const isElement = dom.isHTMLElement(target);
        const anchorWindow = isElement ? dom.getWindow(target) : dom.getActiveWindow();
        const container = this.layoutService.getContainer(anchorWindow).getBoundingClientRect();
        const verticalPadding = 6 + 26 + 16;
        let anchor = getAnchorRect(target);
        let preferredAnchorPosition = AnchorPosition.ABOVE;
        let listHeightRatio = 0.2;
        let maxListHeight = 200;
        if (this.controller.anchorPosition === "overlay") {
          overlayAnchor = anchor;
          this.ui.inputBox.setHeight(anchor.height);
          width = anchor.width;
          listHeightRatio = 0.4;
          anchor = { ...anchor, height: 0 };
          maxListHeight = Math.min(400, container.bottom - anchor.top - verticalPadding);
          preferredAnchorPosition = AnchorPosition.BELOW;
        } else {
          width = 380;
        }
        listHeight = this.dimension ? Math.min(this.dimension.height * listHeightRatio, maxListHeight) : maxListHeight;
        const containerHeight = Math.floor(listHeight) + verticalPadding;
        const { top, left, right, bottom, anchorAlignment, anchorPosition } = layout2d(container, { width, height: containerHeight }, anchor, { anchorPosition: preferredAnchorPosition });
        if (anchorAlignment === AnchorAlignment.RIGHT) {
          style.right = `${right}px`;
          style.left = "initial";
        } else {
          style.left = `${left}px`;
          style.right = "initial";
        }
        if (anchorPosition === AnchorPosition.ABOVE) {
          style.bottom = `${bottom}px`;
          style.top = "initial";
        } else {
          style.top = `${top}px`;
          style.bottom = "initial";
        }
        style.width = `${width}px`;
        style.height = "";
      } else {
        style.top = `${this.viewState?.top !== void 0 ? Math.round(this.dimension.height * this.viewState.top) : this.titleBarOffset}px`;
        style.left = `${Math.round(this.dimension.width * (this.viewState?.left ?? 0.5) - width / 2)}px`;
        style.right = "";
        style.bottom = "";
        style.height = "";
      }
      if (overlayAnchor) {
        this.alignOverlayInput(overlayAnchor);
      }
      this.ui.inputBox.layout();
      this.ui.list.layout(listHeight);
      this.ui.tree.layout(listHeight);
    }
  }
  alignOverlayInput(anchor) {
    const style = this.ui.container.style;
    let correction = this.overlayLayoutCorrection;
    if (!correction || correction.anchor.left !== anchor.left || correction.anchor.top !== anchor.top || correction.anchor.width !== anchor.width || correction.anchor.height !== anchor.height) {
      this.ui.inputBox.layout();
      const input = this.ui.filterContainer.getBoundingClientRect();
      correction = this.overlayLayoutCorrection = {
        anchor,
        left: anchor.left - input.left,
        right: input.right - (anchor.left + anchor.width),
        top: anchor.top - input.top,
        bottom: input.bottom - (anchor.top + anchor.height),
        width: anchor.width - input.width
      };
    }
    style.width = `${parseFloat(style.width) + correction.width}px`;
    if (style.left !== "initial") {
      style.left = `${parseFloat(style.left) + correction.left}px`;
    } else {
      style.right = `${parseFloat(style.right) + correction.right}px`;
    }
    if (style.top !== "initial") {
      style.top = `${parseFloat(style.top) + correction.top}px`;
    } else {
      style.bottom = `${parseFloat(style.bottom) + correction.bottom}px`;
    }
  }
  applyStyles(styles) {
    this.styles = styles;
    this.updateStyles();
  }
  updateStyles() {
    if (this.ui) {
      const {
        quickInputTitleBackground,
        quickInputBackground,
        quickInputForeground,
        widgetBorder
      } = this.styles.widget;
      this.ui.titleBar.style.backgroundColor = quickInputTitleBackground ?? "";
      this.ui.container.style.backgroundColor = quickInputBackground ?? "";
      this.ui.container.style.color = quickInputForeground ?? "";
      this.ui.container.style.border = widgetBorder ? `1px solid ${widgetBorder}` : "";
      this.ui.list.style(this.styles.list);
      this.ui.tree.tree.style(this.styles.list);
      const content = [];
      if (this.styles.pickerGroup.pickerGroupBorder) {
        content.push(`.quick-input-list .quick-input-list-entry { border-top-color:  ${this.styles.pickerGroup.pickerGroupBorder}; }`);
      }
      if (this.styles.pickerGroup.pickerGroupForeground) {
        content.push(`.quick-input-list .quick-input-list-separator { color:  ${this.styles.pickerGroup.pickerGroupForeground}; }`);
      }
      if (this.styles.pickerGroup.pickerGroupForeground) {
        content.push(`.quick-input-list .quick-input-list-separator-as-item { color: var(--vscode-descriptionForeground); }`);
      }
      if (this.styles.keybindingLabel.keybindingLabelBackground || this.styles.keybindingLabel.keybindingLabelBorder || this.styles.keybindingLabel.keybindingLabelBottomBorder || this.styles.keybindingLabel.keybindingLabelShadow || this.styles.keybindingLabel.keybindingLabelForeground) {
        content.push(".quick-input-list .monaco-keybinding > .monaco-keybinding-key {");
        if (this.styles.keybindingLabel.keybindingLabelBackground) {
          content.push(`background-color: ${this.styles.keybindingLabel.keybindingLabelBackground};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelBorder) {
          content.push(`border-color: ${this.styles.keybindingLabel.keybindingLabelBorder};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelBottomBorder) {
          content.push(`border-bottom-color: ${this.styles.keybindingLabel.keybindingLabelBottomBorder};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelShadow) {
          content.push(`box-shadow: inset 0 -1px 0 ${this.styles.keybindingLabel.keybindingLabelShadow};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelForeground) {
          content.push(`color: ${this.styles.keybindingLabel.keybindingLabelForeground};`);
        }
        content.push("}");
      }
      const newStyles = content.join("\n");
      if (newStyles !== this.ui.styleSheet.textContent) {
        this.ui.styleSheet.textContent = newStyles;
      }
    }
  }
  loadViewState() {
    try {
      const data = JSON.parse(this.storageService.get(VIEWSTATE_STORAGE_KEY, StorageScope.APPLICATION, "{}"));
      if (data.top !== void 0 || data.left !== void 0) {
        return data;
      }
    } catch {
    }
    return void 0;
  }
  saveViewState(viewState) {
    const isMainWindow = this.layoutService.activeContainer === this.layoutService.mainContainer;
    if (!isMainWindow) {
      return;
    }
    if (viewState !== void 0) {
      this.storageService.store(VIEWSTATE_STORAGE_KEY, JSON.stringify(viewState), StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(VIEWSTATE_STORAGE_KEY, StorageScope.APPLICATION);
    }
  }
};
QuickInputController = __decorateClass([
  __decorateParam(1, ILayoutService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IContextMenuService)
], QuickInputController);
let QuickInputDragAndDropController = class extends Disposable {
  constructor(_container, _quickInputContainer, _quickInputDragAreas, initialViewState, _layoutService, contextKeyService, configurationService) {
    super();
    this._container = _container;
    this._quickInputContainer = _quickInputContainer;
    this._quickInputDragAreas = _quickInputDragAreas;
    this._layoutService = _layoutService;
    this.configurationService = configurationService;
    this.dndViewState = observableValue(this, void 0);
    this._enabled = true;
    this._snapThreshold = 20;
    this._snapLineHorizontalRatio = 0.25;
    this._alignment = observableValue(this, "top");
    this.alignment = this._alignment;
    this._quickInputAlignmentContext = QuickInputAlignmentContextKey.bindTo(contextKeyService);
    const customWindowControls = getWindowControlsStyle(this.configurationService) === WindowControlsStyle.CUSTOM;
    this._controlsOnLeft = customWindowControls && platform === Platform.Mac;
    this._controlsOnRight = customWindowControls && (platform === Platform.Windows || platform === Platform.Linux);
    this._registerLayoutListener();
    this.registerMouseListeners();
    this.dndViewState.set({ ...initialViewState, done: true }, void 0);
    if (initialViewState?.top !== void 0 && initialViewState?.left !== void 0) {
      this._setAlignmentState(void 0);
    }
  }
  reparentUI(container) {
    this._container = container;
  }
  layoutContainer(dimension = this._layoutService.activeContainerDimension) {
    if (!this._enabled) {
      return;
    }
    const state = this.dndViewState.get();
    const dragAreaRect = this._quickInputContainer.getBoundingClientRect();
    if (state?.top !== void 0 && state?.left !== void 0) {
      const a = Math.round(state.left * 100) / 100;
      const b = dimension.width;
      const c = dragAreaRect.width;
      const d = a * b - c / 2;
      this._layout(state.top * dimension.height, d);
    }
  }
  setEnabled(enabled) {
    this._enabled = enabled;
    this._quickInputContainer.classList.toggle("no-drag", !enabled);
  }
  _setAlignmentState(value) {
    this._quickInputAlignmentContext.set(value);
    this._alignment.set(value ?? "custom", void 0);
  }
  setAlignment(alignment, done = true) {
    if (alignment === "top") {
      this.dndViewState.set({
        top: this._getTopSnapValue() / this._container.clientHeight,
        left: (this._getCenterXSnapValue() + this._quickInputContainer.clientWidth / 2) / this._container.clientWidth,
        done
      }, void 0);
      this._setAlignmentState("top");
    } else if (alignment === "center") {
      this.dndViewState.set({
        top: this._getCenterYSnapValue() / this._container.clientHeight,
        left: (this._getCenterXSnapValue() + this._quickInputContainer.clientWidth / 2) / this._container.clientWidth,
        done
      }, void 0);
      this._setAlignmentState("center");
    } else {
      this.dndViewState.set({ top: alignment.top, left: alignment.left, done }, void 0);
      this._setAlignmentState(void 0);
    }
  }
  _registerLayoutListener() {
    this._register(Event.filter(this._layoutService.onDidLayoutContainer, (e) => e.container === this._container)((e) => this.layoutContainer(e.dimension)));
  }
  registerMouseListeners() {
    const dragArea = this._quickInputContainer;
    this._register(dom.addDisposableGenericMouseUpListener(dragArea, (event) => {
      if (!this._enabled) {
        return;
      }
      const originEvent = new StandardMouseEvent(dom.getWindow(dragArea), event);
      if (originEvent.detail !== 2) {
        return;
      }
      const area = this._quickInputDragAreas.find(({ node, includeChildren }) => includeChildren ? dom.isAncestor(originEvent.target, node) : originEvent.target === node);
      if (!area || area.excludeNodes?.some((node) => dom.isAncestor(originEvent.target, node))) {
        return;
      }
      this.dndViewState.set({ top: void 0, left: void 0, done: true }, void 0);
      this._setAlignmentState("top");
    }));
    this._register(dom.addDisposableGenericMouseDownListener(dragArea, (e) => {
      if (!this._enabled) {
        return;
      }
      const activeWindow = dom.getWindow(this._layoutService.activeContainer);
      const originEvent = new StandardMouseEvent(activeWindow, e);
      const area = this._quickInputDragAreas.find(({ node, includeChildren }) => includeChildren ? dom.isAncestor(originEvent.target, node) : originEvent.target === node);
      if (!area || area.excludeNodes?.some((node) => dom.isAncestor(originEvent.target, node))) {
        return;
      }
      const dragAreaRect = this._quickInputContainer.getBoundingClientRect();
      const dragOffsetX = originEvent.browserEvent.clientX - dragAreaRect.left;
      const dragOffsetY = originEvent.browserEvent.clientY - dragAreaRect.top;
      let isMovingQuickInput = false;
      const mouseMoveListener = dom.addDisposableGenericMouseMoveListener(activeWindow, (e2) => {
        const mouseMoveEvent = new StandardMouseEvent(activeWindow, e2);
        mouseMoveEvent.preventDefault();
        if (!isMovingQuickInput) {
          isMovingQuickInput = true;
        }
        this._layout(e2.clientY - dragOffsetY, e2.clientX - dragOffsetX);
      });
      const mouseUpListener = dom.addDisposableGenericMouseUpListener(activeWindow, (e2) => {
        if (isMovingQuickInput) {
          const state = this.dndViewState.get();
          this.dndViewState.set({ top: state?.top, left: state?.left, done: true }, void 0);
        }
        mouseMoveListener.dispose();
        mouseUpListener.dispose();
      });
    }));
  }
  _layout(topCoordinate, leftCoordinate) {
    const snapCoordinateYTop = this._getTopSnapValue();
    const snapCoordinateY = this._getCenterYSnapValue();
    const snapCoordinateX = this._getCenterXSnapValue();
    topCoordinate = Math.max(0, Math.min(topCoordinate, this._container.clientHeight - this._quickInputContainer.clientHeight));
    if (topCoordinate < this._layoutService.activeContainerOffset.top) {
      if (this._controlsOnLeft) {
        leftCoordinate = Math.max(leftCoordinate, 80 / getZoomFactor(dom.getActiveWindow()));
      } else if (this._controlsOnRight) {
        leftCoordinate = Math.min(leftCoordinate, this._container.clientWidth - this._quickInputContainer.clientWidth - 140 / getZoomFactor(dom.getActiveWindow()));
      }
    }
    const snappingToTop = Math.abs(topCoordinate - snapCoordinateYTop) < this._snapThreshold;
    topCoordinate = snappingToTop ? snapCoordinateYTop : topCoordinate;
    const snappingToCenter = Math.abs(topCoordinate - snapCoordinateY) < this._snapThreshold;
    topCoordinate = snappingToCenter ? snapCoordinateY : topCoordinate;
    const top = topCoordinate / this._container.clientHeight;
    leftCoordinate = Math.max(0, Math.min(leftCoordinate, this._container.clientWidth - this._quickInputContainer.clientWidth));
    const snappingToCenterX = Math.abs(leftCoordinate - snapCoordinateX) < this._snapThreshold;
    leftCoordinate = snappingToCenterX ? snapCoordinateX : leftCoordinate;
    const b = this._container.clientWidth;
    const c = this._quickInputContainer.clientWidth;
    const d = leftCoordinate;
    const left = (d + c / 2) / b;
    this.dndViewState.set({ top, left, done: false }, void 0);
    if (snappingToCenterX) {
      if (snappingToTop) {
        this._setAlignmentState("top");
        return;
      } else if (snappingToCenter) {
        this._setAlignmentState("center");
        return;
      }
    }
    this._setAlignmentState(void 0);
  }
  _getTopSnapValue() {
    return this._layoutService.activeContainerOffset.quickPickTop;
  }
  _getCenterYSnapValue() {
    return Math.round(this._container.clientHeight * this._snapLineHorizontalRatio);
  }
  _getCenterXSnapValue() {
    return Math.round(this._container.clientWidth / 2) - Math.round(this._quickInputContainer.clientWidth / 2);
  }
};
QuickInputDragAndDropController = __decorateClass([
  __decorateParam(4, ILayoutService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IConfigurationService)
], QuickInputDragAndDropController);
export {
  QuickInputController
};
