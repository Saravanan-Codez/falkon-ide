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
import "./media/browser.css";
import { localize, localize2 } from "../../../../nls.js";
import { $ } from "../../../../base/browser/dom.js";
import { ContextKeyExpr, RawContextKey, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { BrowserEditorInput } from "../common/browserEditorInput.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { getZoomFactor, onDidChangeZoomLevel } from "../../../../base/browser/browser.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
const CONTEXT_BROWSER_FOCUSED = new RawContextKey("browserFocused", true, localize("browser.editorFocused", "Whether the browser editor is focused"));
const CONTEXT_BROWSER_HAS_URL = new RawContextKey("browserHasUrl", false, localize("browser.hasUrl", "Whether the browser has a URL loaded"));
const CONTEXT_BROWSER_HAS_ERROR = new RawContextKey("browserHasError", false, localize("browser.hasError", "Whether the browser has a load error"));
const BROWSER_EDITOR_ACTIVE = ContextKeyExpr.equals("activeEditor", BrowserEditorInput.EDITOR_ID);
const BrowserActionCategory = localize2("browserCategory", "Browser");
var BrowserActionGroup = /* @__PURE__ */ ((BrowserActionGroup2) => {
  BrowserActionGroup2["Tabs"] = "1_tabs";
  BrowserActionGroup2["Zoom"] = "2_zoom";
  BrowserActionGroup2["Tools"] = "3_tools";
  BrowserActionGroup2["Data"] = "4_data";
  BrowserActionGroup2["Settings"] = "5_settings";
  return BrowserActionGroup2;
})(BrowserActionGroup || {});
const originalHtmlElementFocus = HTMLElement.prototype.focus;
class BrowserEditorContribution extends Disposable {
  constructor(editor) {
    super();
    this.editor = editor;
    this._modelStore = this._register(new DisposableStore());
    /**
     * Fires when {@link getActionViewItem} may return a different result.
     */
    this.onDidChangeActionViewItems = Event.None;
    this._register(editor.onDidChangeModel(({ model, isNew }) => {
      this._modelStore.clear();
      if (model) {
        this.onModelAttached(model, this._modelStore, isNew);
      } else {
        this.onModelDetached();
      }
    }));
  }
  /**
   * Called whenever the editor model changes to update state.
   */
  onModelAttached(_model, _store, _isNew) {
  }
  /**
   * Called when the model is cleared to reset state.
   */
  onModelDetached() {
  }
  /**
   * Called when an input is attached but no model exists yet. Use to render
   * placeholder UI from the input's metadata (e.g. show the URL in the navbar)
   * while the model resolves. Only fires when the input has no preloaded model;
   * after the model resolves, {@link onModelAttached} takes over.
   */
  prerenderInput(_input) {
  }
  /**
   * Widgets contributed by this feature. Each widget declares its target
   * {@link BrowserWidgetLocation}; the editor groups widgets by location
   * and stacks them in {@link IBrowserEditorWidget.order} order.
   */
  get widgets() {
    return [];
  }
  /**
   * Optional renderers for the URL displayed in the navbar. Each renderer is
   * given the URL and a container; the first to return `true` claims the
   * render. If none claim it, the navbar falls back to plain text. Used to
   * decorate URLs for special conditions (e.g. red strikethrough on the
   * `https:` prefix when a certificate error is active).
   */
  get urlRenderers() {
    return [];
  }
  /**
   * Optional URL bar suggestion providers (open tabs, history, favorites,
   * search engines, ...). The navbar invokes each provider in sorted order
   * when the URL picker opens or its value changes, and renders the merged
   * suggestions below the built-in "Go to" entry.
   */
  get urlSuggestionProviders() {
    return [];
  }
  /**
   * Optional action providers for buttons rendered in the URL picker chrome.
   * The navbar collects buttons from each provider when the picker opens
   * and refreshes them when a provider fires {@link IBrowserUrlPickerActionProvider.onDidChange}.
   */
  get urlPickerActionProviders() {
    return [];
  }
  /**
   * Creates a custom action view item, or returns `undefined` to use the default.
   */
  getActionViewItem(_action, _options, _instantiationService) {
    return void 0;
  }
  /**
   * Called when the editor is laid out with a new dimension.
   */
  onPaneResized(_width) {
  }
  /**
   * Called after the browser container has been laid out and its bounds
   * pushed to the model. Contributions can use this to react to position
   * changes (e.g. recompute overlay overlap), unlike {@link onPaneResized} which
   * only fires on pane dimension changes.
   */
  afterContainerLayout() {
  }
  /**
   * Called when the editor pane's visibility changes (e.g. tab switched).
   * Contributions that drive page rendering use this to pause/resume work.
   */
  onPaneVisibilityChanged(_visible) {
  }
  /**
   * Called when the editor wants focus. Contributions are tried in
   * registration order; the first to return `true` claims the focus. The
   * renderer-providing contribution typically handles this when a page is
   * loaded; the navbar handles it as a fallback by focusing the URL input.
   */
  tryFocus() {
    return false;
  }
  /**
   * Called once after the editor's browser container DOM has been created
   * and all toolbar widgets have been mounted. Use for any setup that needs
   * the editor's DOM to exist or needs to read sibling contributions (e.g.
   * the navbar pulls pre/post-URL widgets from other features here).
   */
  onContainerCreated(_container) {
  }
  /**
   * Optional contributions to how the browser container is sized and
   * positioned within the editor's wrapper. Multiple contributions are
   * supported: padding is taken as the max across all contributors (so each
   * contributor's reservation is honoured without double-counting);
   * `compute` callbacks are chained in priority order (lower {@link
   * IContainerLayoutOverride.priority} runs first), each receiving the
   * previous result so contributions can stack (e.g. device emulation sizes
   * and centers the viewport, then pixel-snap aligns it).
   */
  beforeContainerLayout() {
    return void 0;
  }
}
var BrowserWidgetLocation = /* @__PURE__ */ ((BrowserWidgetLocation2) => {
  BrowserWidgetLocation2["PreUrl"] = "preUrl";
  BrowserWidgetLocation2["PostUrl"] = "postUrl";
  BrowserWidgetLocation2["Toolbar"] = "toolbar";
  BrowserWidgetLocation2["ContentArea"] = "contentArea";
  return BrowserWidgetLocation2;
})(BrowserWidgetLocation || {});
let BrowserEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService, contextKeyService, layoutService) {
    super(BrowserEditorInput.EDITOR_ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.layoutService = layoutService;
    this._contributionInstances = /* @__PURE__ */ new Map();
    this._onDidChangeModel = this._register(new Emitter());
    this.onDidChangeModel = this._onDidChangeModel.event;
    this._inputDisposables = this._register(new DisposableStore());
    this._currentPadding = { top: 0, right: 0, bottom: 0, left: 0 };
  }
  static {
    // -- Contribution registry --------------------------------------------
    this._contributions = [];
  }
  static registerContribution(ctor) {
    BrowserEditor._contributions.push(ctor);
  }
  getContribution(ctor) {
    return this._contributionInstances.get(ctor);
  }
  /** All instantiated contributions in registration order. */
  getContributions() {
    return this._contributionInstances.values();
  }
  get model() {
    return this._model;
  }
  get browserContainer() {
    return this._browserContainer;
  }
  get input() {
    return super.input;
  }
  createEditor(parent) {
    const contextKeyService = this._register(this.contextKeyService.createScoped(parent));
    this._hasUrlContext = CONTEXT_BROWSER_HAS_URL.bindTo(contextKeyService);
    this._hasErrorContext = CONTEXT_BROWSER_HAS_ERROR.bindTo(contextKeyService);
    CONTEXT_BROWSER_FOCUSED.bindTo(contextKeyService);
    const scopedInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([IContextKeyService, contextKeyService])
    ));
    for (const ctor of BrowserEditor._contributions) {
      const instance = this._register(scopedInstantiationService.createInstance(ctor, this));
      this._contributionInstances.set(ctor, instance);
    }
    const root = $(".browser-root");
    root.tabIndex = -1;
    parent.appendChild(root);
    const widgetsByLocation = /* @__PURE__ */ new Map();
    for (const contribution of this._contributionInstances.values()) {
      for (const widget of contribution.widgets) {
        let bucket = widgetsByLocation.get(widget.location);
        if (!bucket) {
          bucket = [];
          widgetsByLocation.set(widget.location, bucket);
        }
        bucket.push(widget);
      }
    }
    for (const bucket of widgetsByLocation.values()) {
      bucket.sort((a, b) => a.order - b.order);
    }
    const widgetsAt = (location) => widgetsByLocation.get(location) ?? [];
    for (const widget of widgetsAt("toolbar" /* Toolbar */)) {
      root.appendChild(widget.element);
    }
    this._browserContainerWrapper = $(".browser-container-wrapper");
    this._browserContainerWrapper.style.setProperty("--zoom-factor", String(getZoomFactor(this.window)));
    root.appendChild(this._browserContainerWrapper);
    this._browserContainer = $(".browser-container");
    this._browserContainer.tabIndex = 0;
    this._browserContainerWrapper.appendChild(this._browserContainer);
    for (const contribution of this._contributionInstances.values()) {
      contribution.onContainerCreated(this._browserContainer);
    }
    const placeholderContents = $(".browser-placeholder-contents");
    this._browserContainer.appendChild(placeholderContents);
    for (const widget of widgetsAt("contentArea" /* ContentArea */)) {
      placeholderContents.appendChild(widget.element);
    }
  }
  focus() {
    for (const c of this._contributionInstances.values()) {
      if (c.tryFocus()) {
        return;
      }
    }
    this.ensureBrowserFocus();
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (token.isCancellationRequested) {
      return;
    }
    this._inputDisposables.clear();
    let model = input.model;
    const isNew = !model;
    if (!model) {
      this._hasUrlContext.set(!!input.url);
      this._hasErrorContext.set(false);
      for (const c of this._contributionInstances.values()) {
        c.prerenderInput(input);
      }
      model = await input.resolve();
    }
    if (token.isCancellationRequested || this.input !== input) {
      return;
    }
    this._model = model;
    this._onDidChangeModel.fire({ model, isNew });
    this._hasUrlContext.set(!!model.url);
    this._hasErrorContext.set(!!model.error);
    this._inputDisposables.add(this._model.onWillDispose(() => {
      if (this._model === model) {
        this._model = void 0;
        this._onDidChangeModel.fire({ model: void 0, isNew: false });
      }
    }));
    this._inputDisposables.add(this._model.onWillNavigate(() => {
      this.group.pinEditor(this.input);
      this.ensureBrowserFocus();
    }));
    this._inputDisposables.add(this._model.onDidNavigate(() => {
      this.group.pinEditor(this.input);
      this._hasUrlContext.set(!!model.url);
    }));
    this._inputDisposables.add(this._model.onDidChangeLoadingState(() => {
      this._hasErrorContext.set(!!model.error);
    }));
    this._inputDisposables.add(model.onDidChangeFocus(({ focused }) => {
      if (focused) {
        this._onDidFocus?.fire();
        this.ensureBrowserFocus();
      }
    }));
    this._inputDisposables.add(onDidChangeZoomLevel((targetWindowId) => {
      if (targetWindowId === this.window.vscodeWindowId) {
        this._browserContainerWrapper.style.setProperty("--zoom-factor", String(getZoomFactor(this.window)));
        this.layoutBrowserContainer();
      }
    }));
    this.layout();
  }
  setEditorVisible(visible) {
    for (const c of this._contributionInstances.values()) {
      c.onPaneVisibilityChanged(visible);
    }
  }
  /**
   * Make the browser container the active element without moving focus from the browser view.
   */
  ensureBrowserFocus() {
    originalHtmlElementFocus.call(this._browserContainer);
    this.window.document.getSelection()?.removeAllRanges();
  }
  /**
   * Close this editor tab (i.e. the editor input owning the current page).
   */
  closeTab() {
    this.group?.closeEditor(this.input);
  }
  layout(dimension, _position) {
    if (dimension) {
      for (const contribution of this._contributionInstances.values()) {
        contribution.onPaneResized(dimension.width);
      }
    }
    const whenContainerStylesLoaded = this.layoutService.whenContainerStylesLoaded(this.window);
    if (whenContainerStylesLoaded) {
      whenContainerStylesLoaded.then(() => this.layoutBrowserContainer());
    } else {
      this.layoutBrowserContainer();
    }
  }
  /**
   * Recompute the layout of the browser container and push the resulting
   * bounds + emulation to the renderer. Should generally only be called
   * via {@link layout} so the container is fully styled first.
   */
  layoutBrowserContainer(retries = 2) {
    if (!this._model) {
      return;
    }
    const overrides = [];
    for (const c of this._contributionInstances.values()) {
      const o = c.beforeContainerLayout();
      if (o) {
        overrides.push(o);
      }
    }
    const padding = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const o of overrides) {
      padding.top = Math.max(padding.top, o.padding?.top ?? 0);
      padding.right = Math.max(padding.right, o.padding?.right ?? 0);
      padding.bottom = Math.max(padding.bottom, o.padding?.bottom ?? 0);
      padding.left = Math.max(padding.left, o.padding?.left ?? 0);
    }
    this._currentPadding = padding;
    const wrapperRect = this._browserContainerWrapper.getBoundingClientRect();
    if ((wrapperRect.width === 0 || wrapperRect.height === 0) && retries > 0) {
      this.window.requestAnimationFrame(() => this.layoutBrowserContainer(retries - 1));
      return;
    }
    const paneWidth = Math.max(0, wrapperRect.width - padding.left - padding.right);
    const paneHeight = Math.max(0, wrapperRect.height - padding.top - padding.bottom);
    const pane = {
      width: paneWidth,
      height: paneHeight,
      originX: wrapperRect.left + padding.left,
      originY: wrapperRect.top + padding.top
    };
    const sorted = overrides.slice().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    let layout = { width: paneWidth, height: paneHeight, top: 0, left: 0 };
    for (const o of sorted) {
      const next = o.compute?.(layout, pane);
      if (next) {
        layout = next;
      }
    }
    const left = padding.left + (layout.left ?? 0);
    const top = padding.top + (layout.top ?? 0);
    this._browserContainer.style.width = `${layout.width}px`;
    this._browserContainer.style.height = `${layout.height}px`;
    this._browserContainer.style.left = `${left}px`;
    this._browserContainer.style.top = `${top}px`;
    const cornerRadius = parseFloat(this.window.getComputedStyle(this._browserContainer).borderTopLeftRadius ?? "0");
    void this._model.layout({
      windowId: this.group.windowId,
      x: wrapperRect.left + left,
      y: wrapperRect.top + top,
      width: layout.width,
      height: layout.height,
      zoomFactor: getZoomFactor(this.window),
      cornerRadius,
      emulation: layout.emulation
    });
    for (const c of this._contributionInstances.values()) {
      c.afterContainerLayout();
    }
  }
  /**
   * Wrapper content-area size in CSS px — the area available to layout
   * contributions after their aggregated padding is applied.
   */
  get paneSize() {
    const r = this._browserContainerWrapper.getBoundingClientRect();
    const p = this._currentPadding;
    return {
      width: Math.max(0, r.width - p.left - p.right),
      height: Math.max(0, r.height - p.top - p.bottom)
    };
  }
  clearInput() {
    this._inputDisposables.clear();
    if (this._model) {
      this._model = void 0;
      this._onDidChangeModel.fire({ model: void 0, isNew: false });
    }
    this._hasUrlContext.reset();
    this._hasErrorContext.reset();
    super.clearInput();
  }
};
BrowserEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ILayoutService)
], BrowserEditor);
export {
  BROWSER_EDITOR_ACTIVE,
  BrowserActionCategory,
  BrowserActionGroup,
  BrowserEditor,
  BrowserEditorContribution,
  BrowserWidgetLocation,
  CONTEXT_BROWSER_FOCUSED,
  CONTEXT_BROWSER_HAS_ERROR,
  CONTEXT_BROWSER_HAS_URL
};
