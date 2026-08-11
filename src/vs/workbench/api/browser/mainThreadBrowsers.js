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
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IBrowserViewCDPService, IBrowserViewWorkbenchService } from "../../contrib/browserView/common/browserView.js";
import { BrowserViewUri } from "../../../platform/browserView/common/browserViewUri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { columnToEditorGroup } from "../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { BrowserEditorInput } from "../../contrib/browserView/common/browserEditorInput.js";
let MainThreadBrowsers = class extends Disposable {
  constructor(extHostContext, editorService, cdpService, browserViewService, editorGroupsService, configurationService) {
    super();
    this.editorService = editorService;
    this.cdpService = cdpService;
    this.browserViewService = browserViewService;
    this.editorGroupsService = editorGroupsService;
    this.configurationService = configurationService;
    this._cdpSessions = this._register(new DisposableMap());
    this._knownBrowsers = this._register(new DisposableMap());
    // #endregion
    // #region Browser tab tracking
    this._lastActiveBrowserId = void 0;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostBrowsers);
    this._register(this.browserViewService.onDidChangeBrowserViews(() => {
      for (const editor of this.browserViewService.getKnownBrowserViews().values()) {
        this._track(editor);
      }
    }));
    this._register(this.editorService.onDidActiveEditorChange(() => this._syncActiveBrowserTab()));
    for (const editor of this.browserViewService.getKnownBrowserViews().values()) {
      this._track(editor);
    }
    this._syncActiveBrowserTab();
  }
  // #region Browser tab open
  async $openBrowserTab(url, viewColumn, options) {
    const id = generateUuid();
    const browserUri = BrowserViewUri.forId(id);
    await this.editorService.openEditor(
      {
        resource: browserUri,
        options: { ...options, viewState: { url } }
      },
      columnToEditorGroup(this.editorGroupsService, this.configurationService, viewColumn)
    );
    const known = this._knownBrowsers.get(id);
    if (!known) {
      throw new Error("Failed to open browser tab");
    }
    return this._toDto(known.input);
  }
  async _syncActiveBrowserTab() {
    const active = this.editorService.activeEditorPane?.input;
    let activeId;
    if (active instanceof BrowserEditorInput) {
      this._track(active);
      activeId = active.id;
    }
    if (this._lastActiveBrowserId !== activeId) {
      this._lastActiveBrowserId = activeId;
      this._proxy.$onDidChangeActiveBrowserTab(activeId);
    }
  }
  _track(input) {
    if (this._knownBrowsers.has(input.id)) {
      return;
    }
    const disposables = new DisposableStore();
    disposables.add(input.onDidChangeLabel(() => {
      this._proxy.$onDidChangeBrowserTabState(this._toDto(input));
    }));
    disposables.add(input.onWillDispose(() => {
      this._knownBrowsers.deleteAndDispose(input.id);
    }));
    disposables.add(toDisposable(() => {
      this._proxy.$onDidCloseBrowserTab(input.id);
    }));
    this._knownBrowsers.set(input.id, { input, dispose: () => disposables.dispose() });
    this._proxy.$onDidOpenBrowserTab(this._toDto(input));
  }
  _toDto(input) {
    return {
      id: input.id,
      url: input.url || "about:blank",
      title: input.getTitle(),
      favicon: input.favicon
    };
  }
  // #endregion
  // #region CDP session management
  async $startCDPSession(sessionId, browserId) {
    const known = this._knownBrowsers.get(browserId);
    if (!known) {
      throw new Error(`Unknown browser id: ${browserId}`);
    }
    await known.input.resolve();
    const groupId = await this.cdpService.createSessionGroup(browserId);
    const disposables = new DisposableStore();
    disposables.add(this.cdpService.onCDPMessage(groupId)((message) => {
      this._proxy.$onCDPSessionMessage(sessionId, message);
    }));
    disposables.add(this.cdpService.onDidDestroy(groupId)(() => {
      this._cdpSessions.deleteAndDispose(sessionId);
    }));
    disposables.add(toDisposable(() => {
      this.cdpService.destroySessionGroup(groupId).catch(() => {
      });
      this._proxy.$onCDPSessionClosed(sessionId);
    }));
    this._cdpSessions.set(sessionId, { groupId, dispose: () => disposables.dispose() });
  }
  async $closeCDPSession(sessionId) {
    this._cdpSessions.deleteAndDispose(sessionId);
  }
  async $sendCDPMessage(sessionId, message) {
    const session = this._cdpSessions.get(sessionId);
    if (session) {
      await this.cdpService.sendCDPMessage(session.groupId, message);
    }
  }
  async $closeBrowserTab(browserId) {
    const known = this._knownBrowsers.get(browserId);
    if (!known) {
      throw new Error(`Unknown browser id: ${browserId}`);
    }
    known.input.dispose();
  }
  // #endregion
};
MainThreadBrowsers = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadBrowsers),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IBrowserViewCDPService),
  __decorateParam(3, IBrowserViewWorkbenchService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IConfigurationService)
], MainThreadBrowsers);
export {
  MainThreadBrowsers
};
