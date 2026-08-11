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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { SideBySideEditor } from "../../../browser/parts/editor/sideBySideEditor.js";
import { isEditorPaneWithScrolling } from "../../../common/editor.js";
import { ReentrancyBarrier } from "../../../../base/common/controlFlow.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
let SyncScroll = class extends Disposable {
  constructor(editorService, statusbarService) {
    super();
    this.editorService = editorService;
    this.statusbarService = statusbarService;
    this.paneInitialScrollTop = /* @__PURE__ */ new Map();
    this.syncScrollDispoasbles = this._register(new DisposableStore());
    this.paneDisposables = this._register(new DisposableStore());
    this.statusBarEntry = this._register(new MutableDisposable());
    this.isActive = false;
    // makes sure that the onDidEditorPaneScroll is not called multiple times for the same event
    this._reentrancyBarrier = new ReentrancyBarrier();
    this.registerActions();
  }
  static {
    this.ID = "workbench.contrib.syncScrolling";
  }
  registerActiveListeners() {
    this.syncScrollDispoasbles.add(this.editorService.onDidVisibleEditorsChange(() => this.trackVisiblePanes()));
  }
  activate() {
    this.registerActiveListeners();
    this.trackVisiblePanes();
  }
  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
    this.isActive = !this.isActive;
    this.toggleStatusbarItem(this.isActive);
  }
  trackVisiblePanes() {
    this.paneDisposables.clear();
    this.paneInitialScrollTop.clear();
    for (const pane of this.getAllVisiblePanes()) {
      if (!isEditorPaneWithScrolling(pane)) {
        continue;
      }
      this.paneInitialScrollTop.set(pane, pane.getScrollPosition());
      this.paneDisposables.add(pane.onDidChangeScroll(
        () => this._reentrancyBarrier.runExclusivelyOrSkip(() => {
          this.onDidEditorPaneScroll(pane);
        })
      ));
    }
  }
  onDidEditorPaneScroll(scrolledPane) {
    const scrolledPaneInitialOffset = this.paneInitialScrollTop.get(scrolledPane);
    if (scrolledPaneInitialOffset === void 0) {
      throw new Error("Scrolled pane not tracked");
    }
    if (!isEditorPaneWithScrolling(scrolledPane)) {
      throw new Error("Scrolled pane does not support scrolling");
    }
    const scrolledPaneCurrentPosition = scrolledPane.getScrollPosition();
    const scrolledFromInitial = {
      scrollTop: scrolledPaneCurrentPosition.scrollTop - scrolledPaneInitialOffset.scrollTop,
      scrollLeft: scrolledPaneCurrentPosition.scrollLeft !== void 0 && scrolledPaneInitialOffset.scrollLeft !== void 0 ? scrolledPaneCurrentPosition.scrollLeft - scrolledPaneInitialOffset.scrollLeft : void 0
    };
    for (const pane of this.getAllVisiblePanes()) {
      if (pane === scrolledPane) {
        continue;
      }
      if (!isEditorPaneWithScrolling(pane)) {
        continue;
      }
      const initialOffset = this.paneInitialScrollTop.get(pane);
      if (initialOffset === void 0) {
        throw new Error("Could not find initial offset for pane");
      }
      const currentPanePosition = pane.getScrollPosition();
      const newPaneScrollPosition = {
        scrollTop: initialOffset.scrollTop + scrolledFromInitial.scrollTop,
        scrollLeft: initialOffset.scrollLeft !== void 0 && scrolledFromInitial.scrollLeft !== void 0 ? initialOffset.scrollLeft + scrolledFromInitial.scrollLeft : void 0
      };
      if (currentPanePosition.scrollTop === newPaneScrollPosition.scrollTop && currentPanePosition.scrollLeft === newPaneScrollPosition.scrollLeft) {
        continue;
      }
      pane.setScrollPosition(newPaneScrollPosition);
    }
  }
  getAllVisiblePanes() {
    const panes = [];
    for (const pane of this.editorService.visibleEditorPanes) {
      if (pane instanceof SideBySideEditor) {
        const primaryPane = pane.getPrimaryEditorPane();
        const secondaryPane = pane.getSecondaryEditorPane();
        if (primaryPane) {
          panes.push(primaryPane);
        }
        if (secondaryPane) {
          panes.push(secondaryPane);
        }
        continue;
      }
      panes.push(pane);
    }
    return panes;
  }
  deactivate() {
    this.paneDisposables.clear();
    this.syncScrollDispoasbles.clear();
    this.paneInitialScrollTop.clear();
  }
  // Actions & Commands
  toggleStatusbarItem(active) {
    if (active) {
      if (!this.statusBarEntry.value) {
        const text = localize("mouseScrolllingLocked", "Scrolling Locked");
        const tooltip = localize("mouseLockScrollingEnabled", "Lock Scrolling Enabled");
        this.statusBarEntry.value = this.statusbarService.addEntry({
          name: text,
          text,
          tooltip,
          ariaLabel: text,
          command: {
            id: "workbench.action.toggleLockedScrolling",
            title: ""
          },
          kind: "prominent",
          showInAllWindows: true
        }, "status.scrollLockingEnabled", StatusbarAlignment.RIGHT, 102);
      }
    } else {
      this.statusBarEntry.clear();
    }
  }
  registerActions() {
    const $this = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.toggleLockedScrolling",
          title: {
            ...localize2("toggleLockedScrolling", "Toggle Locked Scrolling Across Editors"),
            mnemonicTitle: localize({ key: "miToggleLockedScrolling", comment: ["&& denotes a mnemonic"] }, "Locked Scrolling")
          },
          category: Categories.View,
          f1: true,
          metadata: {
            description: localize("synchronizeScrolling", "Synchronize Scrolling Editors")
          }
        });
      }
      run() {
        $this.toggle();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.holdLockedScrolling",
          title: {
            ...localize2("holdLockedScrolling", "Hold Locked Scrolling Across Editors"),
            mnemonicTitle: localize({ key: "miHoldLockedScrolling", comment: ["&& denotes a mnemonic"] }, "Locked Scrolling")
          },
          category: Categories.View
        });
      }
      run(accessor) {
        const keybindingService = accessor.get(IKeybindingService);
        $this.toggle();
        const holdMode = keybindingService.enableKeybindingHoldMode("workbench.action.holdLockedScrolling");
        if (!holdMode) {
          return;
        }
        holdMode.finally(() => {
          $this.toggle();
        });
      }
    }));
  }
  dispose() {
    this.deactivate();
    super.dispose();
  }
};
SyncScroll = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IStatusbarService)
], SyncScroll);
export {
  SyncScroll
};
