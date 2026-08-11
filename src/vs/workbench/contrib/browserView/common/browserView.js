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
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Emitter } from "../../../../base/common/event.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { localize } from "../../../../nls.js";
import { IPlaywrightService } from "../../../../platform/browserView/common/playwrightService.js";
import {
  BrowserHistoryStore
} from "../../../../platform/browserView/common/browserHistory.js";
import {
  BrowserPermissionStore
} from "../../../../platform/browserView/common/browserPermissions.js";
import {
  BrowserViewStorageScope,
  browserZoomDefaultIndex,
  browserZoomFactors
} from "../../../../platform/browserView/common/browserView.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isLocalhostAuthority } from "../../../../platform/url/common/trustedDomains.js";
import { IAgentNetworkFilterService } from "../../../../platform/networkFilter/common/networkFilterService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IBrowserZoomService } from "./browserZoomService.js";
var BrowserViewSharingState = /* @__PURE__ */ ((BrowserViewSharingState2) => {
  BrowserViewSharingState2["Shared"] = "shared";
  BrowserViewSharingState2["NotShared"] = "notShared";
  BrowserViewSharingState2["Unavailable"] = "unavailable";
  return BrowserViewSharingState2;
})(BrowserViewSharingState || {});
function browserViewUrlMatches(candidateUrl, targetUrl, includeBlank = false) {
  const target = URL.parse(targetUrl);
  if (!target || target.protocol !== "file:" && !target.host) {
    return false;
  }
  if (includeBlank && (!candidateUrl || candidateUrl === "about:blank")) {
    return true;
  }
  const candidate = URL.parse(candidateUrl ?? "");
  return candidate?.host === target.host || target.protocol === "file:" && candidate?.protocol === "file:" || !!(candidate?.host && target.host && (candidate.host.endsWith("." + target.host) || target.host.endsWith("." + candidate.host)));
}
function parseZoomHost(url) {
  const parsed = URL.parse(url);
  if (!parsed?.host || parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return void 0;
  }
  return parsed.host;
}
function parseHistorySnapshot(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return void 0;
    }
    return parsed;
  } catch {
    return void 0;
  }
}
const IBrowserViewWorkbenchService = createDecorator("browserViewWorkbenchService");
const IBrowserViewCDPService = createDecorator("browserViewCDPService");
let BrowserViewModel = class extends Disposable {
  constructor(id, owner, initialState, browserViewService, browserViewWorkbenchService, telemetryService, playwrightService, dialogService, storageService, zoomService, agentNetworkFilterService, logService) {
    super();
    this.id = id;
    this.owner = owner;
    this.browserViewService = browserViewService;
    this.browserViewWorkbenchService = browserViewWorkbenchService;
    this.telemetryService = telemetryService;
    this.playwrightService = playwrightService;
    this.dialogService = dialogService;
    this.storageService = storageService;
    this.zoomService = zoomService;
    this.agentNetworkFilterService = agentNetworkFilterService;
    this.logService = logService;
    this._url = "";
    this._title = "";
    this._favicon = void 0;
    this._screenshot = void 0;
    this._loading = false;
    this._focused = false;
    this._visible = false;
    this._isDevToolsOpen = false;
    this._canGoBack = false;
    this._canGoForward = false;
    this._error = void 0;
    this._certificateError = void 0;
    this._storageScope = BrowserViewStorageScope.Ephemeral;
    this._isRemoteSession = false;
    this._isEphemeral = false;
    this._zoomHost = void 0;
    this._sharedWithAgent = false;
    this._browserZoomIndex = browserZoomDefaultIndex;
    this._elementSelectionState = { active: false, options: {} };
    this._isAreaSelectionActive = false;
    this.history = this._register(new BrowserHistoryStore());
    this.permissions = this._register(new BrowserPermissionStore());
    this._onDidChangeDevice = this._register(new Emitter());
    this.onDidChangeDevice = this._onDidChangeDevice.event;
    this._onDidChangeSharingState = this._register(new Emitter());
    this.onDidChangeSharingState = this._onDidChangeSharingState.event;
    this._onDidChangeZoom = this._register(new Emitter());
    this.onDidChangeZoom = this._onDidChangeZoom.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._onWillNavigate = this._register(new Emitter());
    this.onWillNavigate = this._onWillNavigate.event;
    this._url = initialState.url;
    this._title = initialState.title;
    this._loading = initialState.loading;
    this._focused = initialState.focused;
    this._visible = initialState.visible;
    this._isDevToolsOpen = initialState.isDevToolsOpen;
    this._canGoBack = initialState.canGoBack;
    this._canGoForward = initialState.canGoForward;
    this._screenshot = initialState.lastScreenshot;
    this._favicon = initialState.lastFavicon;
    this._error = initialState.lastError;
    this._certificateError = initialState.certificateError;
    this._storageScope = initialState.storageScope;
    this._isRemoteSession = initialState.isRemoteSession;
    this._browserZoomIndex = initialState.browserZoomIndex;
    this._elementSelectionState = initialState.elementSelectionState;
    this._isAreaSelectionActive = initialState.isAreaSelectionActive;
    this._device = initialState.device;
    this._isEphemeral = this._storageScope === BrowserViewStorageScope.Ephemeral;
    this._zoomHost = parseZoomHost(this._url);
    const { history: entriesKey, favicons: faviconsKey } = initialState.storageKeys;
    if (entriesKey) {
      this._reloadHistoryEntries(entriesKey);
      this._register(this.storageService.onDidChangeValue(
        StorageScope.APPLICATION,
        entriesKey,
        this._store
      )(() => this._reloadHistoryEntries(entriesKey)));
    }
    if (faviconsKey) {
      this._reloadHistoryFavicons(faviconsKey);
      this._register(this.storageService.onDidChangeValue(
        StorageScope.APPLICATION,
        faviconsKey,
        this._store
      )(() => this._reloadHistoryFavicons(faviconsKey)));
    }
    this.permissions.hydrate(initialState.permissions);
    this._register(this.browserViewService.onDynamicDidChangePermissions(this.id)(
      (snapshot) => this.permissions.hydrate(snapshot)
    ));
    const effectiveZoomIndex = this.zoomService.getEffectiveZoomIndex(this._zoomHost, this._isEphemeral);
    if (effectiveZoomIndex !== this._browserZoomIndex) {
      void this.setBrowserZoomIndex(effectiveZoomIndex).catch((e) => {
        this.logService.warn(`[BrowserViewModel] Failed to set initial zoom:`, e);
      });
    }
    void this.playwrightService.isPageTracked(this.id).then((shared) => this._setSharedWithAgent(shared)).catch((e) => {
      this.logService.warn(`[BrowserViewModel] Failed to check initial page tracking:`, e);
    });
    this._register(this.zoomService.onDidChangeZoom(({ host, isEphemeralChange }) => {
      if (isEphemeralChange && !this._isEphemeral) {
        return;
      }
      if (host === void 0 || host === this._zoomHost) {
        void this.setBrowserZoomIndex(
          this.zoomService.getEffectiveZoomIndex(this._zoomHost, this._isEphemeral)
        ).catch(() => {
        });
      }
    }));
    this._register(this.onDidNavigate((e) => {
      if (URL.parse(e.url)?.host !== URL.parse(this._url)?.host) {
        this._favicon = void 0;
      }
      this._zoomHost = parseZoomHost(e.url);
      this._url = e.url;
      this._title = e.title;
      this._canGoBack = e.canGoBack;
      this._canGoForward = e.canGoForward;
      this._certificateError = e.certificateError;
      void this.setBrowserZoomIndex(
        this.zoomService.getEffectiveZoomIndex(this._zoomHost, this._isEphemeral),
        true
      );
    }));
    this._register(this.onDidChangeLoadingState((e) => {
      this._loading = e.loading;
      this._error = e.error;
    }));
    this._register(this.onDidChangeDevToolsState((e) => {
      this._isDevToolsOpen = e.isDevToolsOpen;
    }));
    this._register(this.onDidChangeTitle((e) => {
      this._title = e.title;
    }));
    this._register(this.onDidChangeFavicon((e) => {
      this._favicon = e.favicon;
    }));
    this._register(this.onDidChangeFocus(({ focused }) => {
      this._focused = focused;
    }));
    this._register(this.onDidChangeVisibility(({ visible }) => {
      this._visible = visible;
    }));
    this._register(this.browserViewService.onDynamicDidChangeDeviceEmulation(this.id)((device) => {
      if (!structuralEquals(this._device, device)) {
        this._device = device;
        this._onDidChangeDevice.fire(device);
      }
    }));
    this._register(this.onDidChangeElementSelectionState((state) => {
      if (state.active && !this._elementSelectionState.active) {
        this.telemetryService.publicLog2("integratedBrowser.addElementToChat.start", {});
      }
      this._elementSelectionState = state;
    }));
    this._register(this.onDidChangeAreaSelectionActive((active) => {
      this._isAreaSelectionActive = active;
    }));
    this._register(this.playwrightService.onDidChangeTrackedPages((ids) => {
      this._setSharedWithAgent(ids.includes(this.id));
    }));
    this._register(this.browserViewWorkbenchService.onDidChangeSharingAvailable(() => {
      this._onDidChangeSharingState.fire(this.sharingState);
    }));
    this._register(this.onDidChangeRemoteStatus((isRemoteSession) => {
      this._isRemoteSession = isRemoteSession;
    }));
  }
  get url() {
    return this._url;
  }
  get title() {
    return this._title;
  }
  get favicon() {
    return this._favicon;
  }
  get loading() {
    return this._loading;
  }
  get focused() {
    return this._focused;
  }
  get visible() {
    return this._visible;
  }
  get isDevToolsOpen() {
    return this._isDevToolsOpen;
  }
  get canGoBack() {
    return this._canGoBack;
  }
  get canGoForward() {
    return this._canGoForward;
  }
  get screenshot() {
    return this._screenshot;
  }
  get error() {
    return this._error;
  }
  get certificateError() {
    return this._certificateError;
  }
  get storageScope() {
    return this._storageScope;
  }
  get isRemoteSession() {
    return this._isRemoteSession;
  }
  get sharingState() {
    if (!this.browserViewWorkbenchService.isSharingAvailable) {
      return "unavailable" /* Unavailable */;
    }
    return this._sharedWithAgent ? "shared" /* Shared */ : "notShared" /* NotShared */;
  }
  get zoomFactor() {
    return browserZoomFactors[this._browserZoomIndex];
  }
  get canZoomIn() {
    return this._browserZoomIndex < browserZoomFactors.length - 1;
  }
  get canZoomOut() {
    return this._browserZoomIndex > 0;
  }
  get elementSelectionState() {
    return this._elementSelectionState;
  }
  get isAreaSelectionActive() {
    return this._isAreaSelectionActive;
  }
  get device() {
    return this._device;
  }
  get onDidNavigate() {
    return this.browserViewService.onDynamicDidNavigate(this.id);
  }
  get onDidChangeLoadingState() {
    return this.browserViewService.onDynamicDidChangeLoadingState(this.id);
  }
  get onDidChangeFocus() {
    return this.browserViewService.onDynamicDidChangeFocus(this.id);
  }
  get onDidChangeDevToolsState() {
    return this.browserViewService.onDynamicDidChangeDevToolsState(this.id);
  }
  get onDidKeyCommand() {
    return this.browserViewService.onDynamicDidKeyCommand(this.id);
  }
  get onDidChangeTitle() {
    return this.browserViewService.onDynamicDidChangeTitle(this.id);
  }
  get onDidChangeFavicon() {
    return this.browserViewService.onDynamicDidChangeFavicon(this.id);
  }
  get onDidFindInPage() {
    return this.browserViewService.onDynamicDidFindInPage(this.id);
  }
  get onDidChangeVisibility() {
    return this.browserViewService.onDynamicDidChangeVisibility(this.id);
  }
  get onDidClose() {
    return this.browserViewService.onDynamicDidClose(this.id);
  }
  get onDidChangeRemoteStatus() {
    return this.browserViewService.onDynamicDidChangeRemoteStatus(this.id);
  }
  get onDidRequestPermission() {
    return this.browserViewService.onDynamicDidRequestPermission(this.id);
  }
  async layout(bounds) {
    return this.browserViewService.layout(this.id, bounds);
  }
  async setVisible(visible) {
    this._visible = visible;
    return this.browserViewService.setVisible(this.id, visible);
  }
  async loadURL(url, options) {
    this.logNavigationTelemetry(options?.source ?? "urlInput", url);
    this._onWillNavigate.fire(url);
    if (/^localhost(:|\/|$)/i.test(url)) {
      url = "http://" + url;
    } else if (!URL.parse(url)?.protocol) {
      url = "http://" + url;
    }
    return this.browserViewService.loadURL(this.id, url);
  }
  async goBack() {
    this.logNavigationTelemetry("goBack", this._url);
    return this.browserViewService.goBack(this.id);
  }
  async goForward() {
    this.logNavigationTelemetry("goForward", this._url);
    return this.browserViewService.goForward(this.id);
  }
  async reload(hard) {
    this.logNavigationTelemetry("reload", this._url);
    return this.browserViewService.reload(this.id, hard);
  }
  async toggleDevTools() {
    return this.browserViewService.toggleDevTools(this.id);
  }
  async captureScreenshot(options) {
    const result = await this.browserViewService.captureScreenshot(this.id, options);
    if (!options?.screenRect && !options?.pageRect && !options?.fullPage) {
      this._screenshot = result;
    }
    return result;
  }
  async focus(force) {
    return this.browserViewService.focus(this.id, force);
  }
  async findInPage(text, options) {
    return this.browserViewService.findInPage(this.id, text, options);
  }
  async stopFindInPage(keepSelection) {
    return this.browserViewService.stopFindInPage(this.id, keepSelection);
  }
  async getSelectedText() {
    return this.browserViewService.getSelectedText(this.id);
  }
  async clearStorage() {
    return this.browserViewService.clearStorage(this.id);
  }
  async trustCertificate(host, fingerprint) {
    return this.browserViewService.trustCertificate(this.id, host, fingerprint);
  }
  async untrustCertificate(host, fingerprint) {
    return this.browserViewService.untrustCertificate(this.id, host, fingerprint);
  }
  async deleteHistory(entryIds) {
    if (entryIds === void 0) {
      this.history.clear();
    } else {
      for (const id of entryIds) {
        this.history.entries.delete(id);
      }
    }
    return this.browserViewService.deleteBrowserHistory(this.id, entryIds);
  }
  async setPermissions(origin, grants) {
    this.permissions.setMany(origin, grants);
    return this.browserViewService.setPermissions(this.id, origin, grants);
  }
  async selectDevice(requestId, deviceId) {
    return this.browserViewService.selectDevice(this.id, requestId, deviceId);
  }
  /**
   * @param forceApply When true, the IPC call is made even if the local cached zoom index
   * already matches the requested value. Pass true after cross-document navigation because
   * Chromium resets the zoom to its per-origin default, making the cache stale.
   */
  async setBrowserZoomIndex(zoomIndex, forceApply = false) {
    const clamped = Math.max(0, Math.min(zoomIndex, browserZoomFactors.length - 1));
    if (!forceApply && clamped === this._browserZoomIndex) {
      return;
    }
    this._browserZoomIndex = clamped;
    await this.browserViewService.setBrowserZoomIndex(this.id, this._browserZoomIndex);
    this._onDidChangeZoom.fire();
  }
  async zoomIn() {
    if (!this.canZoomIn) {
      return;
    }
    await this.setBrowserZoomIndex(this._browserZoomIndex + 1);
    if (this._zoomHost) {
      this.zoomService.setHostZoomIndex(this._zoomHost, this._browserZoomIndex, this._isEphemeral);
    }
  }
  async zoomOut() {
    if (!this.canZoomOut) {
      return;
    }
    await this.setBrowserZoomIndex(this._browserZoomIndex - 1);
    if (this._zoomHost) {
      this.zoomService.setHostZoomIndex(this._zoomHost, this._browserZoomIndex, this._isEphemeral);
    }
  }
  async resetZoom() {
    const defaultIndex = this.zoomService.getEffectiveZoomIndex(void 0, false);
    await this.setBrowserZoomIndex(defaultIndex);
    if (this._zoomHost) {
      this.zoomService.setHostZoomIndex(this._zoomHost, defaultIndex, this._isEphemeral);
    }
  }
  async getConsoleLogs() {
    return this.browserViewService.getConsoleLogs(this.id);
  }
  async toggleElementSelection(enabled, options) {
    return this.browserViewService.toggleElementSelection(this.id, enabled, options);
  }
  async setElementComments(update) {
    return this.browserViewService.setElementComments(this.id, update);
  }
  async toggleAreaSelection(enabled) {
    return this.browserViewService.toggleAreaSelection(this.id, enabled);
  }
  get onDidSelectElement() {
    return this.browserViewService.onDynamicDidSelectElement(this.id);
  }
  get onDidRemoveElementComment() {
    return this.browserViewService.onDynamicDidRemoveElementComment(this.id);
  }
  get onDidChangeElementSelectionState() {
    return this.browserViewService.onDynamicDidChangeElementSelectionState(this.id);
  }
  get onDidPickArea() {
    return this.browserViewService.onDynamicDidPickArea(this.id);
  }
  get onDidChangeAreaSelectionActive() {
    return this.browserViewService.onDynamicDidChangeAreaSelectionActive(this.id);
  }
  async setDevice(device) {
    if (!structuralEquals(this._device, device)) {
      this._device = device;
      this._onDidChangeDevice.fire(device);
    }
    return this.browserViewService.setDeviceEmulation(this.id, device);
  }
  static {
    this.SHARE_DONT_ASK_KEY = "browserView.shareWithAgent.dontAskAgain";
  }
  async setSharedWithAgent(shared) {
    if (shared) {
      if (this._url) {
        try {
          const uri = URI.parse(this._url);
          if (!this.agentNetworkFilterService.isUriAllowed(uri)) {
            await this.dialogService.info(
              localize("browserView.shareBlocked.title", "Cannot Share with Agent"),
              this.agentNetworkFilterService.formatError(uri)
            );
            return false;
          }
        } catch {
        }
      }
      const storedChoice = this.storageService.getBoolean(BrowserViewModel.SHARE_DONT_ASK_KEY, StorageScope.PROFILE);
      if (!storedChoice) {
        const result = await this.dialogService.confirm({
          type: "question",
          title: localize("browserView.shareWithAgent.title", "Share with Agent?"),
          message: localize("browserView.shareWithAgent.message", "Share this browser page with the agent?"),
          detail: localize(
            "browserView.shareWithAgent.detail",
            "The agent will be able to read and modify browser content and saved data, including cookies."
          ),
          primaryButton: localize("browserView.shareWithAgent.allow", "&&Allow"),
          cancelButton: localize("browserView.shareWithAgent.deny", "Deny"),
          checkbox: { label: localize("browserView.shareWithAgent.dontAskAgain", "Don't ask again"), checked: false }
        });
        if (result.confirmed && result.checkboxChecked) {
          this.storageService.store(BrowserViewModel.SHARE_DONT_ASK_KEY, result.confirmed, StorageScope.PROFILE, StorageTarget.USER);
        }
        this.telemetryService.publicLog2(
          "integratedBrowser.shareWithAgent",
          {
            shared: result.confirmed,
            dontAskAgain: result.checkboxChecked ?? false
          }
        );
        if (!result.confirmed) {
          return false;
        }
      } else {
        this.telemetryService.publicLog2(
          "integratedBrowser.shareWithAgent",
          {
            shared: true,
            dontAskAgain: true
          }
        );
      }
      await this.playwrightService.startTrackingPage(this.id);
      this._setSharedWithAgent(true);
    } else {
      await this.playwrightService.stopTrackingPage(this.id);
      this._setSharedWithAgent(false);
    }
    return true;
  }
  _setSharedWithAgent(isShared) {
    if (isShared !== this._sharedWithAgent) {
      this._sharedWithAgent = isShared;
      this._onDidChangeSharingState.fire(this.sharingState);
    }
  }
  _reloadHistoryEntries(key) {
    const raw = this.storageService.get(key, StorageScope.APPLICATION);
    this.history.entries.hydrate(parseHistorySnapshot(raw));
  }
  _reloadHistoryFavicons(key) {
    const raw = this.storageService.get(key, StorageScope.APPLICATION);
    this.history.favicons.hydrate(parseHistorySnapshot(raw));
  }
  /**
   * Log navigation telemetry event
   */
  logNavigationTelemetry(navigationType, url) {
    let localhost;
    try {
      localhost = isLocalhostAuthority(new URL(url).host);
    } catch {
      localhost = false;
    }
    this.telemetryService.publicLog2(
      "integratedBrowser.navigation",
      {
        navigationType,
        isLocalhost: localhost
      }
    );
  }
  dispose() {
    this._onWillDispose.fire();
    if (this._sharedWithAgent) {
      void this.playwrightService.stopTrackingPage(this.id);
    }
    void this.browserViewService.destroyBrowserView(this.id);
    super.dispose();
  }
};
BrowserViewModel = __decorateClass([
  __decorateParam(4, IBrowserViewWorkbenchService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IPlaywrightService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IBrowserZoomService),
  __decorateParam(10, IAgentNetworkFilterService),
  __decorateParam(11, ILogService)
], BrowserViewModel);
export {
  BrowserViewModel,
  BrowserViewSharingState,
  IBrowserViewCDPService,
  IBrowserViewWorkbenchService,
  browserViewUrlMatches
};
