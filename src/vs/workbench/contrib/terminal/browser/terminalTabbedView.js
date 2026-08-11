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
import { LayoutPriority, Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITerminalChatService, ITerminalConfigurationService, ITerminalGroupService, ITerminalService, TerminalConnectionState, TerminalDataTransfers } from "./terminal.js";
import { TerminalTabsListSizes, TerminalTabList } from "./terminalTabsList.js";
import * as dom from "../../../../base/browser/dom.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { localize } from "../../../../nls.js";
import { openContextMenu } from "./terminalContextMenu.js";
import { TerminalStorageKeys } from "../common/terminalStorageKeys.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { getInstanceHoverInfo } from "./terminalTooltip.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { TerminalTabsChatEntry } from "./terminalTabsChatEntry.js";
import { containsDragType } from "../../../../platform/dnd/browser/dnd.js";
import { getTerminalResourcesFromDragEvent, parseTerminalUri } from "./terminalUri.js";
import { TerminalContribContextKeyStrings } from "../terminalContribExports.js";
const $ = dom.$;
var CssClass = /* @__PURE__ */ ((CssClass2) => {
  CssClass2["ViewIsVertical"] = "terminal-side-view";
  return CssClass2;
})(CssClass || {});
var WidthConstants = /* @__PURE__ */ ((WidthConstants2) => {
  WidthConstants2[WidthConstants2["StatusIcon"] = 30] = "StatusIcon";
  WidthConstants2[WidthConstants2["SplitAnnotation"] = 30] = "SplitAnnotation";
  return WidthConstants2;
})(WidthConstants || {});
let TerminalTabbedView = class extends Disposable {
  constructor(parentElement, _terminalService, _terminalChatService, _terminalConfigurationService, _terminalGroupService, _instantiationService, _contextMenuService, _configurationService, menuService, _storageService, contextKeyService, _hoverService) {
    super();
    this._terminalService = _terminalService;
    this._terminalChatService = _terminalChatService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalGroupService = _terminalGroupService;
    this._instantiationService = _instantiationService;
    this._contextMenuService = _contextMenuService;
    this._configurationService = _configurationService;
    this._storageService = _storageService;
    this._hoverService = _hoverService;
    this._cancelContextMenu = false;
    this._emptyAreaDropTargetCount = 0;
    this._tabContainer = $(".tabs-container");
    const tabListContainer = $(".tabs-list-container");
    this._tabListContainer = tabListContainer;
    this._tabListElement = $(".tabs-list");
    tabListContainer.appendChild(this._tabListElement);
    this._tabContainer.appendChild(tabListContainer);
    this._instanceMenu = this._register(menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService));
    this._tabsListMenu = this._register(menuService.createMenu(MenuId.TerminalTabContext, contextKeyService));
    this._tabsListEmptyMenu = this._register(menuService.createMenu(MenuId.TerminalTabEmptyAreaContext, contextKeyService));
    this._tabList = this._register(this._instantiationService.createInstance(TerminalTabList, this._tabListElement));
    this._tabListDomElement = this._tabList.getHTMLElement();
    this._chatEntry = this._register(this._instantiationService.createInstance(TerminalTabsChatEntry, tabListContainer, this._tabContainer));
    const terminalOuterContainer = $(".terminal-outer-container");
    this._terminalContainer = $(".terminal-groups-container");
    terminalOuterContainer.appendChild(this._terminalContainer);
    this._terminalService.setContainers(parentElement, this._terminalContainer);
    this._terminalIsTabsNarrowContextKey = TerminalContextKeys.tabsNarrow.bindTo(contextKeyService);
    this._terminalTabsFocusContextKey = TerminalContextKeys.tabsFocus.bindTo(contextKeyService);
    this._terminalTabsMouseContextKey = TerminalContextKeys.tabsMouse.bindTo(contextKeyService);
    this._tabTreeIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 0 : 1;
    this._terminalContainerIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 1 : 0;
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.TabsEnabled) || e.affectsConfiguration(TerminalSettingId.TabsHideCondition)) {
        this._refreshShowTabs();
      } else if (e.affectsConfiguration(TerminalSettingId.TabsLocation)) {
        this._tabTreeIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 0 : 1;
        this._terminalContainerIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 1 : 0;
        if (this._shouldShowTabs()) {
          this._splitView.swapViews(0, 1);
          this._removeSashListener();
          this._addSashListener();
          this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
        }
      }
    }));
    this._register(Event.any(this._terminalGroupService.onDidChangeInstances, this._terminalGroupService.onDidChangeGroups)(() => {
      this._refreshShowTabs();
      this._updateChatTerminalsEntry();
    }));
    this._register(Event.any(this._terminalChatService.onDidRegisterTerminalInstanceWithToolSession, this._terminalService.onDidChangeInstances, this._terminalService.onDidDisposeInstance)(() => {
      this._refreshShowTabs();
      this._updateChatTerminalsEntry();
    }));
    this._register(contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set([TerminalContribContextKeyStrings.ChatHasHiddenTerminals]))) {
        this._refreshShowTabs();
        this._updateChatTerminalsEntry();
      }
    }));
    this._attachEventListeners(parentElement, this._terminalContainer);
    this._register(this._terminalGroupService.onDidChangePanelOrientation((orientation) => {
      this._panelOrientation = orientation;
      if (this._panelOrientation === Orientation.VERTICAL) {
        this._terminalContainer.classList.add("terminal-side-view" /* ViewIsVertical */);
      } else {
        this._terminalContainer.classList.remove("terminal-side-view" /* ViewIsVertical */);
      }
    }));
    this._splitView = new SplitView(parentElement, { orientation: Orientation.HORIZONTAL, proportionalLayout: false });
    this._setupSplitView(terminalOuterContainer);
    this._updateChatTerminalsEntry();
  }
  _shouldShowTabs() {
    const enabled = this._terminalConfigurationService.config.tabs.enabled;
    const hide = this._terminalConfigurationService.config.tabs.hideCondition;
    const hiddenChatTerminals = this._terminalChatService.getToolSessionTerminalInstances(true);
    if (!enabled) {
      return false;
    }
    if (hiddenChatTerminals.length > 0) {
      return true;
    }
    switch (hide) {
      case "never":
        return true;
      case "singleTerminal":
        if (this._terminalGroupService.instances.length > 1) {
          return true;
        }
        break;
      case "singleGroup":
        if (this._terminalGroupService.groups.length > 1) {
          return true;
        }
        break;
    }
    return false;
  }
  _refreshShowTabs() {
    if (this._shouldShowTabs()) {
      if (this._splitView.length === 1) {
        this._addTabTree();
        this._addSashListener();
        this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
        this.rerenderTabs();
      }
    } else {
      if (this._splitView.length === 2 && !this._terminalTabsMouseContextKey.get()) {
        this._splitView.removeView(this._tabTreeIndex);
        this._plusButton?.remove();
        this._removeSashListener();
      }
    }
  }
  _updateChatTerminalsEntry() {
    this._chatEntry?.update();
  }
  _getLastListWidth() {
    const widthKey = this._panelOrientation === Orientation.VERTICAL ? TerminalStorageKeys.TabsListWidthVertical : TerminalStorageKeys.TabsListWidthHorizontal;
    const storedValue = this._storageService.get(widthKey, StorageScope.PROFILE);
    if (!storedValue || !parseInt(storedValue)) {
      return this._panelOrientation === Orientation.VERTICAL ? TerminalTabsListSizes.NarrowViewWidth : TerminalTabsListSizes.DefaultWidth;
    }
    return parseInt(storedValue);
  }
  _handleOnDidSashReset() {
    let idealWidth = TerminalTabsListSizes.WideViewMinimumWidth;
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
    const ctx = offscreenCanvas.getContext("2d");
    if (ctx) {
      const style = dom.getWindow(this._tabListElement).getComputedStyle(this._tabListElement);
      ctx.font = `${style.fontStyle} ${style.fontSize} ${style.fontFamily}`;
      const maxInstanceWidth = this._terminalGroupService.instances.reduce((p, c) => {
        return Math.max(p, ctx.measureText(c.title + (c.description || "")).width + this._getAdditionalWidth(c));
      }, 0);
      idealWidth = Math.ceil(Math.max(maxInstanceWidth, TerminalTabsListSizes.WideViewMinimumWidth));
    }
    const currentWidth = Math.ceil(this._splitView.getViewSize(this._tabTreeIndex));
    if (currentWidth === idealWidth) {
      idealWidth = TerminalTabsListSizes.NarrowViewWidth;
    }
    this._splitView.resizeView(this._tabTreeIndex, idealWidth);
    this._updateListWidth(idealWidth);
  }
  _getAdditionalWidth(instance) {
    const additionalWidth = 40;
    const statusIconWidth = instance.statusList.statuses.length > 0 ? 30 /* StatusIcon */ : 0;
    const splitAnnotationWidth = (this._terminalGroupService.getGroupForInstance(instance)?.terminalInstances.length || 0) > 1 ? 30 /* SplitAnnotation */ : 0;
    return additionalWidth + splitAnnotationWidth + statusIconWidth;
  }
  _handleOnDidSashChange() {
    const listWidth = this._splitView.getViewSize(this._tabTreeIndex);
    if (!this._width || listWidth <= 0) {
      return;
    }
    this._updateListWidth(listWidth);
  }
  _updateListWidth(width) {
    if (width < TerminalTabsListSizes.MidpointViewWidth && width >= TerminalTabsListSizes.NarrowViewWidth) {
      width = TerminalTabsListSizes.NarrowViewWidth;
      this._splitView.resizeView(this._tabTreeIndex, width);
    } else if (width >= TerminalTabsListSizes.MidpointViewWidth && width < TerminalTabsListSizes.WideViewMinimumWidth) {
      width = TerminalTabsListSizes.WideViewMinimumWidth;
      this._splitView.resizeView(this._tabTreeIndex, width);
    }
    this.rerenderTabs();
    const widthKey = this._panelOrientation === Orientation.VERTICAL ? TerminalStorageKeys.TabsListWidthVertical : TerminalStorageKeys.TabsListWidthHorizontal;
    this._storageService.store(widthKey, width, StorageScope.PROFILE, StorageTarget.USER);
  }
  _setupSplitView(terminalOuterContainer) {
    this._register(this._splitView.onDidSashReset(() => this._handleOnDidSashReset()));
    this._register(this._splitView.onDidSashChange(() => this._handleOnDidSashChange()));
    if (this._shouldShowTabs()) {
      this._addTabTree();
    }
    this._splitView.addView({
      element: terminalOuterContainer,
      layout: (width) => this._terminalGroupService.groups.forEach((tab) => tab.layout(width, this._height || 0)),
      minimumSize: 120,
      maximumSize: Number.POSITIVE_INFINITY,
      onDidChange: () => Disposable.None,
      priority: LayoutPriority.High
    }, Sizing.Distribute, this._terminalContainerIndex);
    if (this._shouldShowTabs()) {
      this._addSashListener();
    }
  }
  _addTabTree() {
    this._splitView.addView({
      element: this._tabContainer,
      layout: (width) => this._tabList.layout(this._height || 0, width),
      minimumSize: TerminalTabsListSizes.NarrowViewWidth,
      maximumSize: TerminalTabsListSizes.MaximumWidth,
      onDidChange: () => Disposable.None,
      priority: LayoutPriority.Low
    }, Sizing.Distribute, this._tabTreeIndex);
    this.rerenderTabs();
  }
  rerenderTabs() {
    this._updateHasText();
    this._tabList.refresh();
  }
  _addSashListener() {
    let interval;
    this._sashDisposables = [
      this._splitView.sashes[0].onDidStart((e) => {
        interval = dom.disposableWindowInterval(dom.getWindow(this._splitView.el), () => {
          this.rerenderTabs();
        }, 100);
      }),
      this._splitView.sashes[0].onDidEnd((e) => {
        interval.dispose();
      })
    ];
  }
  _removeSashListener() {
    if (this._sashDisposables) {
      dispose(this._sashDisposables);
      this._sashDisposables = void 0;
    }
  }
  _updateHasText() {
    const hasText = this._tabListElement.clientWidth > TerminalTabsListSizes.MidpointViewWidth;
    this._tabContainer.classList.toggle("has-text", hasText);
    this._terminalIsTabsNarrowContextKey.set(!hasText);
    this._updateChatTerminalsEntry();
  }
  layout(width, height) {
    const chatItemHeight = this._chatEntry?.element.style.display === "none" ? 0 : this._chatEntry?.element.clientHeight;
    this._height = height - (chatItemHeight ?? 0);
    this._width = width;
    this._splitView.layout(width);
    if (this._shouldShowTabs()) {
      this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
    }
    this._updateHasText();
  }
  _attachEventListeners(parentDomElement, terminalContainer) {
    this._register(dom.addDisposableListener(this._tabContainer, "mouseleave", async (event) => {
      this._terminalTabsMouseContextKey.set(false);
      this._refreshShowTabs();
      event.stopPropagation();
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "mouseenter", async (event) => {
      this._terminalTabsMouseContextKey.set(true);
      event.stopPropagation();
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "dragenter", (event) => {
      if (!this._shouldHandleEmptyAreaDrop(event)) {
        this._resetEmptyAreaDropState();
        return;
      }
      this._emptyAreaDropTargetCount++;
      this._setEmptyAreaDropState(true);
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "dragover", (event) => {
      if (!this._shouldHandleEmptyAreaDrop(event)) {
        this._resetEmptyAreaDropState();
        return;
      }
      event.preventDefault();
      this._setEmptyAreaDropState(true);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "dragleave", (event) => {
      if (!this._shouldHandleEmptyAreaDrop(event)) {
        if (!this._tabContainer.contains(event.relatedTarget)) {
          this._resetEmptyAreaDropState();
        }
        return;
      }
      if (this._tabContainer.contains(event.relatedTarget)) {
        return;
      }
      this._emptyAreaDropTargetCount = Math.max(0, this._emptyAreaDropTargetCount - 1);
      if (this._emptyAreaDropTargetCount === 0) {
        this._resetEmptyAreaDropState();
      }
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "drop", (event) => {
      if (!this._shouldHandleEmptyAreaDrop(event)) {
        return;
      }
      void this._handleContainerDrop(event);
    }));
    this._register(dom.addDisposableListener(terminalContainer, "mousedown", async (event) => {
      const terminal = this._terminalGroupService.activeInstance;
      if (this._terminalGroupService.instances.length > 0 && terminal) {
        const result = await terminal.handleMouseEvent(event, this._instanceMenu);
        if (typeof result === "object" && result.cancelContextMenu) {
          this._cancelContextMenu = true;
        }
      }
    }));
    this._register(dom.addDisposableListener(terminalContainer, "contextmenu", (event) => {
      const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
      if (rightClickBehavior === "nothing" && !event.shiftKey) {
        this._cancelContextMenu = true;
      }
      terminalContainer.focus();
      if (!this._cancelContextMenu) {
        openContextMenu(dom.getWindow(terminalContainer), event, this._terminalGroupService.activeInstance, this._instanceMenu, this._contextMenuService);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this._cancelContextMenu = false;
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "contextmenu", (event) => {
      const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
      if (rightClickBehavior === "nothing" && !event.shiftKey) {
        this._cancelContextMenu = true;
      }
      if (!this._cancelContextMenu) {
        const emptyList = this._tabList.getFocus().length === 0;
        if (!emptyList) {
          this._terminalGroupService.lastAccessedMenu = "tab-list";
        }
        const selectedInstances = this._tabList.getSelectedElements();
        const focusedInstance = this._tabList.getFocusedElements()?.[0];
        if (focusedInstance) {
          selectedInstances.splice(selectedInstances.findIndex((e) => e.instanceId === focusedInstance.instanceId), 1);
          selectedInstances.unshift(focusedInstance);
        }
        openContextMenu(dom.getWindow(this._tabContainer), event, selectedInstances, emptyList ? this._tabsListEmptyMenu : this._tabsListMenu, this._contextMenuService, emptyList ? this._getTabActions() : void 0);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this._cancelContextMenu = false;
    }));
    this._register(dom.addDisposableListener(terminalContainer.ownerDocument, "keydown", (event) => {
      terminalContainer.classList.toggle("alt-active", !!event.altKey);
    }));
    this._register(dom.addDisposableListener(terminalContainer.ownerDocument, "keyup", (event) => {
      terminalContainer.classList.toggle("alt-active", !!event.altKey);
    }));
    this._register(dom.addDisposableListener(parentDomElement, "keyup", (event) => {
      if (event.keyCode === 27) {
        event.stopPropagation();
      }
    }));
    this._register(dom.addDisposableListener(this._tabContainer, dom.EventType.FOCUS_IN, () => {
      this._terminalTabsFocusContextKey.set(true);
    }));
    this._register(dom.addDisposableListener(this._tabContainer, dom.EventType.FOCUS_OUT, () => {
      this._terminalTabsFocusContextKey.set(false);
    }));
  }
  _shouldHandleEmptyAreaDrop(event) {
    const targetNode = event.target;
    if (targetNode && (this._tabListDomElement.contains(targetNode) || this._tabListElement.contains(targetNode))) {
      return false;
    }
    return !!event.dataTransfer && containsDragType(event, TerminalDataTransfers.Terminals);
  }
  _setEmptyAreaDropState(active) {
    this._tabListContainer.classList.toggle("drop-target", active);
    this._tabContainer.classList.toggle("drop-target", active);
    this._chatEntry?.element.classList.toggle("drop-target", active);
  }
  _resetEmptyAreaDropState() {
    this._emptyAreaDropTargetCount = 0;
    this._setEmptyAreaDropState(false);
  }
  async _handleContainerDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    this._resetEmptyAreaDropState();
    const primaryBackend = this._terminalService.getPrimaryBackend();
    const resources = getTerminalResourcesFromDragEvent(event);
    let sourceInstances;
    const promises = [];
    if (resources) {
      for (const uri of resources) {
        const instance = this._terminalService.getInstanceFromResource(uri);
        if (instance) {
          if (sourceInstances) {
            sourceInstances.push(instance);
          } else {
            sourceInstances = [instance];
          }
          this._terminalService.moveToTerminalView(instance);
        } else if (primaryBackend) {
          const terminalIdentifier = parseTerminalUri(uri);
          if (terminalIdentifier.instanceId) {
            promises.push(primaryBackend.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId));
          }
        }
      }
    }
    if (promises.length) {
      const processes = (await Promise.all(promises)).filter((process) => !!process);
      let lastInstance;
      for (const attachPersistentProcess of processes) {
        lastInstance = await this._terminalService.createTerminal({ config: { attachPersistentProcess } });
      }
      if (lastInstance) {
        this._terminalService.setActiveInstance(lastInstance);
      }
      return;
    }
    if (!sourceInstances || !sourceInstances.length) {
      sourceInstances = this._tabList.getSelectedElements();
      if (!sourceInstances.length) {
        return;
      }
    }
    this._terminalGroupService.moveGroupToEnd(sourceInstances);
    this._terminalService.setActiveInstance(sourceInstances[0]);
    const indexes = sourceInstances.map((instance) => this._terminalGroupService.instances.indexOf(instance)).filter((index) => index >= 0);
    if (indexes.length) {
      this._tabList.setSelection(indexes);
      this._tabList.setFocus([indexes[0]]);
    }
  }
  _getTabActions() {
    return [
      new Separator(),
      this._configurationService.inspect(TerminalSettingId.TabsLocation).userValue === "left" ? new Action("moveRight", localize("moveTabsRight", "Move Tabs Right"), void 0, void 0, async () => {
        this._configurationService.updateValue(TerminalSettingId.TabsLocation, "right");
      }) : new Action("moveLeft", localize("moveTabsLeft", "Move Tabs Left"), void 0, void 0, async () => {
        this._configurationService.updateValue(TerminalSettingId.TabsLocation, "left");
      }),
      new Action("hideTabs", localize("hideTabs", "Hide Tabs"), void 0, void 0, async () => {
        this._configurationService.updateValue(TerminalSettingId.TabsEnabled, false);
      })
    ];
  }
  setEditable(isEditing) {
    if (!isEditing) {
      this._tabList.domFocus();
    }
    this._tabList.refresh(false);
  }
  focusTabs() {
    if (!this._shouldShowTabs()) {
      return;
    }
    this._terminalTabsFocusContextKey.set(true);
    const selected = this._tabList.getSelection();
    this._tabList.domFocus();
    if (selected) {
      this._tabList.setFocus(selected);
    }
  }
  focus() {
    if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
      this._focus();
      return;
    }
    const previousActiveElement = this._tabListElement.ownerDocument.activeElement;
    if (previousActiveElement) {
      const listener = this._register(Event.once(this._terminalService.onDidChangeConnectionState)(() => {
        if (dom.isActiveElement(previousActiveElement)) {
          this._focus();
        }
        this._store.delete(listener);
      }));
    }
  }
  focusHover() {
    if (this._shouldShowTabs()) {
      this._tabList.focusHover();
      return;
    }
    const instance = this._terminalGroupService.activeInstance;
    if (!instance) {
      return;
    }
    this._hoverService.showInstantHover({
      ...getInstanceHoverInfo(instance, this._storageService),
      target: this._terminalContainer,
      trapFocus: true
    }, true);
  }
  _focus() {
    this._terminalGroupService.activeInstance?.focusWhenReady();
  }
};
TerminalTabbedView = __decorateClass([
  __decorateParam(1, ITerminalService),
  __decorateParam(2, ITerminalChatService),
  __decorateParam(3, ITerminalConfigurationService),
  __decorateParam(4, ITerminalGroupService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IHoverService)
], TerminalTabbedView);
export {
  TerminalTabbedView
};
