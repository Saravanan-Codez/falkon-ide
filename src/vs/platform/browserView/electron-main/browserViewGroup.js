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
import { Disposable, DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { BrowserView } from "./browserView.js";
import { CDPBrowserProxy } from "../common/cdp/proxy.js";
import { IBrowserViewMainService } from "./browserViewMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { BrowserSession } from "./browserSession.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { BrowserViewCDPTarget } from "./browserViewCDPTarget.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
let BrowserViewGroup = class extends Disposable {
  constructor(id, owner, browserViewMainService, productService, instantiationService) {
    super();
    this.id = id;
    this.owner = owner;
    this.browserViewMainService = browserViewMainService;
    this.productService = productService;
    this.instantiationService = instantiationService;
    this.views = /* @__PURE__ */ new Map();
    this.viewTargets = this._register(new DisposableMap());
    /** All context IDs known to this group, including those from views added to it. */
    this.knownContextIds = /* @__PURE__ */ new Set();
    /** Browser context IDs created by this group via {@link createBrowserContext}. */
    this.ownedContextIds = /* @__PURE__ */ new Set();
    this._onDidAddView = this._register(new Emitter());
    this.onDidAddView = this._onDidAddView.event;
    this._onDidRemoveView = this._register(new Emitter());
    this.onDidRemoveView = this._onDidRemoveView.event;
    this._onDidDestroy = this._register(new Emitter());
    this.onDidDestroy = this._onDidDestroy.event;
    this.debugger = this._register(new CDPBrowserProxy(this));
    // #endregion
    // #region ICDPBrowserTarget implementation
    this._onTargetInfoChanged = this._register(new Emitter());
    this.onTargetInfoChanged = this._onTargetInfoChanged.event;
    /** Browser target sessions are managed by the CDPBrowserProxy, not tracked here. */
    this.sessions = /* @__PURE__ */ new Map();
    this.onSessionCreated = Event.None;
    this.onClose = this._onDidDestroy.event;
  }
  get onCDPMessage() {
    return this.debugger.onMessage;
  }
  sendCDPMessage(msg) {
    return this.debugger.sendMessage(msg);
  }
  // #region View management
  /**
   * Add a {@link BrowserView} to this group.
   * Fires {@link onDidAddView} and registers the view as a CDP target.
   * Also subscribes to the view's sub-target events (iframes, workers)
   * and bubbles them as group-level target events.
   * Automatically removes the view when it closes.
   */
  async addView(viewId) {
    if (this.views.has(viewId)) {
      return;
    }
    const view = this.browserViewMainService.tryGetBrowserView(viewId);
    if (!view) {
      throw new Error(`Browser view ${viewId} not found`);
    }
    this.views.set(view.id, view);
    this.knownContextIds.add(view.session.id);
    this._onDidAddView.fire({ viewId: view.id });
    const closeListener = Event.once(view.onDidClose)(() => {
      this.removeView(viewId);
    });
    const info = await view.debugger.getTargetInfo();
    if (this.views.get(viewId) !== view) {
      closeListener.dispose();
      return;
    }
    const target = new BrowserViewCDPTarget(view, info);
    this.viewTargets.set(view.id, target);
    const store = new DisposableStore();
    store.add(closeListener);
    target.onClose(() => store.dispose());
    this.debugger.registerTarget(target);
    for (const targetInfo of view.debugger.knownTargets.values()) {
      this.debugger.registerTarget(new BrowserViewCDPTarget(view, targetInfo));
    }
    store.add(view.debugger.onTargetDiscovered((targetInfo) => {
      this.debugger.registerTarget(new BrowserViewCDPTarget(view, targetInfo));
    }));
    store.add(view.debugger.onSessionCreated(({ session, waitingForDebugger }) => {
      this.debugger.notifySessionCreated(session, waitingForDebugger);
    }));
  }
  /**
   * Remove a {@link BrowserView} from this group.
   * Disposes the associated {@link BrowserViewCDPTarget}, which cascades
   * destruction to sub-targets and sessions via {@link ICDPTarget.onClose}.
   */
  async removeView(viewId) {
    const view = this.views.get(viewId);
    if (view && this.views.delete(viewId)) {
      if (!this.ownedContextIds.has(view.session.id) && ![...this.views.values()].some((v) => v.session.id === view.session.id)) {
        this.knownContextIds.delete(view.session.id);
      }
      this._onDidRemoveView.fire({ viewId: view.id });
      this.viewTargets.deleteAndDispose(viewId);
    }
  }
  getVersion() {
    return {
      protocolVersion: "1.3",
      product: `${this.productService.nameShort}/${this.productService.version}`,
      revision: this.productService.commit || "unknown",
      userAgent: "Electron",
      jsVersion: process.versions.v8
    };
  }
  getWindowForTarget(target) {
    if (!(target instanceof BrowserViewCDPTarget)) {
      throw new Error("Can only get window for BrowserView targets");
    }
    const view = target.view.getWebContentsView();
    const viewBounds = view.getBounds();
    return {
      windowId: this.owner.mainWindowId,
      bounds: {
        left: viewBounds.x,
        top: viewBounds.y,
        width: viewBounds.width,
        height: viewBounds.height,
        windowState: "normal"
      }
    };
  }
  async attach() {
    return new CDPBrowserProxy(this);
  }
  notifySessionCreated() {
  }
  get targetInfo() {
    return {
      targetId: this.id,
      type: "browser",
      title: this.getVersion().product,
      url: "",
      attached: true,
      canAccessOpener: false
    };
  }
  async createTarget(url, browserContextId) {
    if (browserContextId && !this.knownContextIds.has(browserContextId)) {
      throw new Error(`Unknown browser context ${browserContextId}`);
    }
    const target = await this.browserViewMainService.createTarget(url, this.owner, browserContextId);
    if (target instanceof BrowserView) {
      await this.addView(target.id);
      return this.viewTargets.get(target.id);
    }
    return target;
  }
  async activateTarget(target) {
    if (!(target instanceof BrowserViewCDPTarget)) {
      throw new Error("Can only activate BrowserView targets");
    }
  }
  async closeTarget(target) {
    if (!(target instanceof BrowserViewCDPTarget)) {
      throw new Error("Can only close BrowserView targets");
    }
    await this.removeView(target.view.id);
    await this.browserViewMainService.destroyBrowserView(target.view.id);
    return true;
  }
  // Browser context management
  /**
   * Returns only the browser context IDs that are visible to this group,
   * i.e. contexts used by views currently in the group.
   */
  getBrowserContexts() {
    return [...this.knownContextIds];
  }
  async createBrowserContext() {
    const browserSession = BrowserSession.getOrCreateEphemeral(this.instantiationService, generateUuid(), "cdp-created");
    const contextId = browserSession.id;
    this.knownContextIds.add(contextId);
    this.ownedContextIds.add(contextId);
    return contextId;
  }
  async disposeBrowserContext(browserContextId) {
    if (!this.ownedContextIds.has(browserContextId)) {
      throw new Error("Can only dispose browser contexts created by this group");
    }
    const viewIds = [...this.views.entries()].filter(([, view]) => view.session.id === browserContextId).map(([id]) => id);
    for (const viewId of viewIds) {
      await this.removeView(viewId);
      await this.browserViewMainService.destroyBrowserView(viewId);
    }
    this.knownContextIds.delete(browserContextId);
    this.ownedContextIds.delete(browserContextId);
  }
  // #endregion
  dispose() {
    this._onDidDestroy.fire();
    super.dispose();
  }
};
BrowserViewGroup = __decorateClass([
  __decorateParam(2, IBrowserViewMainService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IInstantiationService)
], BrowserViewGroup);
export {
  BrowserViewGroup
};
