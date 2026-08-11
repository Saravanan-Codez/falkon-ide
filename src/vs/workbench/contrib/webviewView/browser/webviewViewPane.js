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
import { addDisposableListener, EventType, findParentWithClass, getWindow } from "../../../../base/browser/dom.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewPane, ViewPaneShowActions } from "../../../browser/parts/views/viewPane.js";
import { Memento } from "../../../common/memento.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ExtensionKeyedWebviewOriginStore, IWebviewService, WebviewContentPurpose } from "../../webview/browser/webview.js";
import { WebviewWindowDragMonitor } from "../../webview/browser/webviewWindowDragMonitor.js";
import { IWebviewViewService } from "./webviewViewService.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const storageKeys = {
  webviewState: "webviewState"
};
let WebviewViewPane = class extends ViewPane {
  constructor(options, configurationService, contextKeyService, contextMenuService, instantiationService, keybindingService, openerService, hoverService, themeService, viewDescriptorService, activityService, extensionService, progressService, storageService, viewService, webviewService, webviewViewService) {
    super({ ...options, titleMenuId: MenuId.ViewTitle, showActions: ViewPaneShowActions.WhenExpanded }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.activityService = activityService;
    this.extensionService = extensionService;
    this.progressService = progressService;
    this.storageService = storageService;
    this.viewService = viewService;
    this.webviewService = webviewService;
    this.webviewViewService = webviewViewService;
    this._webview = this._register(new MutableDisposable());
    this._webviewDisposables = this._register(new DisposableStore());
    this._activated = false;
    this.activity = this._register(new MutableDisposable());
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDispose = this._register(new Emitter());
    this.onDispose = this._onDispose.event;
    this.extensionId = options.fromExtensionId;
    this.defaultTitle = this.title;
    this.memento = new Memento(`webviewView.${this.id}`, storageService);
    this.viewState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this._register(this.onDidChangeBodyVisibility(() => this.updateTreeVisibility()));
    this._register(this.webviewViewService.onNewResolverRegistered((e) => {
      if (e.viewType === this.id) {
        this.updateTreeVisibility();
      }
    }));
    this.updateTreeVisibility();
  }
  static getOriginStore(storageService) {
    this._originStore ??= new ExtensionKeyedWebviewOriginStore("webviewViews.origins", storageService);
    return this._originStore;
  }
  dispose() {
    this._onDispose.fire();
    super.dispose();
  }
  focus() {
    super.focus();
    this._webview.value?.focus();
  }
  renderBody(container) {
    super.renderBody(container);
    this._container = container;
    this._rootContainer = void 0;
    container.tabIndex = 0;
    container.setAttribute("role", "document");
    this._register(addDisposableListener(container, "focus", (e) => {
      if (e.target === container && this._webview.value) {
        this._webview.value.focus();
      }
    }));
    this.layoutWebview();
  }
  saveState() {
    if (this._webview.value) {
      this.viewState[storageKeys.webviewState] = this._webview.value.state;
    }
    this.memento.saveMemento();
    super.saveState();
  }
  updateTreeVisibility() {
    if (this.isBodyVisible()) {
      this.activate();
      this._webview.value?.claim(this, getWindow(this.element), void 0);
    } else {
      this._webview.value?.release(this);
    }
  }
  activate() {
    if (this._activated) {
      return;
    }
    this._activated = true;
    const origin = this.extensionId ? WebviewViewPane.getOriginStore(this.storageService).getOrigin(this.id, this.extensionId) : void 0;
    const webview = this.webviewService.createWebviewOverlay({
      origin,
      providedViewType: this.id,
      title: this.title,
      options: { purpose: WebviewContentPurpose.WebviewView },
      contentOptions: {},
      extension: this.extensionId ? { id: this.extensionId } : void 0
    });
    webview.state = this.viewState[storageKeys.webviewState];
    this._webview.value = webview;
    this.layoutWebview();
    this._webviewDisposables.add(toDisposable(() => {
      this._webview.value?.release(this);
    }));
    this._webviewDisposables.add(webview.onDidUpdateState(() => {
      this.viewState[storageKeys.webviewState] = webview.state;
    }));
    for (const event of [EventType.DRAG, EventType.DRAG_END, EventType.DRAG_ENTER, EventType.DRAG_LEAVE, EventType.DRAG_START]) {
      this._webviewDisposables.add(addDisposableListener(this._webview.value.container, event, (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.dropTargetElement.dispatchEvent(new DragEvent(e.type, e));
      }));
    }
    this._webviewDisposables.add(new WebviewWindowDragMonitor(getWindow(this.element), () => this._webview.value));
    const source = this._webviewDisposables.add(new CancellationTokenSource());
    this._webviewDisposables.add(toDisposable(() => source.cancel()));
    this.withProgress(async () => {
      await this.extensionService.activateByEvent(`onView:${this.id}`);
      const self = this;
      const webviewView = {
        webview,
        onDidChangeVisibility: this.onDidChangeBodyVisibility,
        onDispose: this.onDispose,
        get title() {
          return self.setTitle;
        },
        set title(value) {
          self.updateTitle(value);
        },
        get description() {
          return self.titleDescription;
        },
        set description(value) {
          self.updateTitleDescription(value);
        },
        get badge() {
          return self.badge;
        },
        set badge(badge) {
          self.updateBadge(badge);
        },
        dispose: () => {
          this._activated = false;
          this._webview.clear();
          this._webviewDisposables.clear();
        },
        show: (preserveFocus) => {
          this.viewService.openView(this.id, !preserveFocus);
        }
      };
      await this.webviewViewService.resolve(this.id, webviewView, source.token);
    });
  }
  updateTitle(value) {
    this.setTitle = value;
    super.updateTitle(typeof value === "string" ? value : this.defaultTitle);
  }
  updateBadge(badge) {
    if (this.badge?.value === badge?.value && this.badge?.tooltip === badge?.tooltip) {
      return;
    }
    this.badge = badge;
    if (badge) {
      const activity = {
        badge: new NumberBadge(badge.value, () => badge.tooltip),
        priority: 150
      };
      this.activity.value = this.activityService.showViewActivity(this.id, activity);
    }
  }
  async withProgress(task) {
    return this.progressService.withProgress({ location: this.id, delay: 500 }, task);
  }
  layoutWebview() {
    const webviewEntry = this._webview.value;
    if (!this._container || !webviewEntry) {
      return;
    }
    if (!this._rootContainer || !this._rootContainer.isConnected) {
      this._rootContainer = this.findRootContainer(this._container);
    }
    webviewEntry.setAnchorElement(this._container, this._rootContainer);
  }
  findRootContainer(container) {
    return findParentWithClass(container, "monaco-scrollable-element") ?? void 0;
  }
};
WebviewViewPane = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IHoverService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, IActivityService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IProgressService),
  __decorateParam(13, IStorageService),
  __decorateParam(14, IViewsService),
  __decorateParam(15, IWebviewService),
  __decorateParam(16, IWebviewViewService)
], WebviewViewPane);
export {
  WebviewViewPane
};
