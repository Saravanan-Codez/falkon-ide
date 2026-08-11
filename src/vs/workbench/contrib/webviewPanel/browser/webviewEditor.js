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
import * as DOM from "../../../../base/browser/dom.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import * as nls from "../../../../nls.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { WebviewWindowDragMonitor } from "../../webview/browser/webviewWindowDragMonitor.js";
import { WebviewInput } from "./webviewEditorInput.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { isHTMLElement } from "../../../../base/browser/dom.js";
const CONTEXT_ACTIVE_WEBVIEW_PANEL_ID = new RawContextKey("activeWebviewPanelId", "", {
  type: "string",
  description: nls.localize("context.activeWebviewId", "The viewType of the currently active webview panel.")
});
let WebviewEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, _editorGroupsService, _editorService, _workbenchLayoutService, _hostService, _contextKeyService) {
    super(WebviewEditor.ID, group, telemetryService, themeService, storageService);
    this._editorGroupsService = _editorGroupsService;
    this._editorService = _editorService;
    this._workbenchLayoutService = _workbenchLayoutService;
    this._hostService = _hostService;
    this._contextKeyService = _contextKeyService;
    this._visible = false;
    this._isDisposed = false;
    this._webviewVisibleDisposables = this._register(new DisposableStore());
    this._onFocusWindowHandler = this._register(new MutableDisposable());
    this._onDidFocusWebview = this._register(new Emitter());
    this._scopedContextKeyService = this._register(new MutableDisposable());
  }
  static {
    this.ID = "WebviewEditor";
  }
  get onDidFocus() {
    return this._onDidFocusWebview.event;
  }
  get webview() {
    return this.input instanceof WebviewInput ? this.input.webview : void 0;
  }
  get scopedContextKeyService() {
    return this._scopedContextKeyService.value;
  }
  createEditor(parent) {
    const element = document.createElement("div");
    this._element = element;
    this._element.id = `webview-editor-element-${generateUuid()}`;
    parent.appendChild(element);
    this._scopedContextKeyService.value = this._register(this._contextKeyService.createScoped(element));
  }
  dispose() {
    this._isDisposed = true;
    this._element?.remove();
    this._element = void 0;
    super.dispose();
  }
  layout(dimension) {
    this.setEditorVisible(dimension.width > 0 && dimension.height > 0);
  }
  focus() {
    super.focus();
    if (!this._onFocusWindowHandler.value && !isWeb) {
      this._onFocusWindowHandler.value = this._hostService.onDidChangeFocus((focused) => {
        if (focused && this._editorService.activeEditorPane === this && this._workbenchLayoutService.hasFocus(Parts.EDITOR_PART)) {
          this.focus();
        }
      });
    }
    this.webview?.focus();
  }
  setEditorVisible(visible) {
    if (visible === this._visible) {
      return;
    }
    this._visible = visible;
    if (this.input instanceof WebviewInput && this.webview) {
      if (visible) {
        this.claimWebview(this.input);
      } else {
        this.webview.release(this);
      }
    }
    super.setEditorVisible(visible);
  }
  clearInput() {
    if (this.webview) {
      this.webview.release(this);
      this._webviewVisibleDisposables.clear();
    }
    super.clearInput();
  }
  async setInput(input, options, context, token) {
    if (this.input && input.matches(this.input)) {
      return;
    }
    const alreadyOwnsWebview = input instanceof WebviewInput && input.webview === this.webview;
    if (this.webview && !alreadyOwnsWebview) {
      this.webview.release(this);
    }
    await super.setInput(input, options, context, token);
    await input.resolve();
    if (token.isCancellationRequested || this._isDisposed) {
      return;
    }
    if (input instanceof WebviewInput) {
      input.updateGroup(this.group.id);
      if (!alreadyOwnsWebview) {
        this.claimWebview(input);
      }
    }
  }
  claimWebview(input) {
    input.claim(this, this.window, this.scopedContextKeyService);
    if (this._element) {
      this._element.setAttribute("aria-flowto", input.webview.container.id);
      DOM.setParentFlowTo(input.webview.container, this._element);
    }
    const modalEditorContainer = this._editorGroupsService.activeModalEditorPart?.modalElement;
    const isModal = isHTMLElement(modalEditorContainer) && this._element && modalEditorContainer.contains(this._element);
    this._clippingContainer = isModal ? void 0 : this._workbenchLayoutService.getContainer(this.window, Parts.EDITOR_PART);
    this._webviewVisibleDisposables.clear();
    this._webviewVisibleDisposables.add(this._editorGroupsService.createEditorDropTarget(input.webview.container, {
      containsGroup: (group) => this.group.id === group.id
    }));
    this._webviewVisibleDisposables.add(new WebviewWindowDragMonitor(this.window, () => this.webview));
    this.setWebviewAnchorElement(input.webview);
    this._webviewVisibleDisposables.add(this.trackFocus(input.webview));
  }
  setWebviewAnchorElement(webview) {
    if (!this._element?.isConnected) {
      return;
    }
    webview.setAnchorElement(this._element.parentElement, this._clippingContainer);
  }
  trackFocus(webview) {
    const store = new DisposableStore();
    const webviewContentFocusTracker = DOM.trackFocus(webview.container);
    store.add(webviewContentFocusTracker);
    store.add(webviewContentFocusTracker.onDidFocus(() => this._onDidFocusWebview.fire()));
    store.add(webview.onDidFocus(() => this._onDidFocusWebview.fire()));
    return store;
  }
};
WebviewEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, IHostService),
  __decorateParam(8, IContextKeyService)
], WebviewEditor);
export {
  CONTEXT_ACTIVE_WEBVIEW_PANEL_ID,
  WebviewEditor
};
