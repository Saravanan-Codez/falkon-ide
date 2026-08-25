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
import { Delayer } from "../../../../base/common/async.js";
import { Schemas } from "../../../../base/common/network.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { ITunnelService } from "../../../../platform/tunnel/common/tunnel.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { WebviewElement } from "../browser/webviewElement.js";
import { WindowIgnoreMenuShortcutsManager } from "./windowIgnoreMenuShortcutsManager.js";
let ElectronWebviewElement = class extends WebviewElement {
  constructor(initInfo, webviewThemeDataProvider, contextMenuService, tunnelService, environmentService, remoteAuthorityResolverService, logService, configurationService, mainProcessService, notificationService, _nativeHostService, instantiationService, accessibilityService) {
    super(
      initInfo,
      webviewThemeDataProvider,
      configurationService,
      contextMenuService,
      notificationService,
      environmentService,
      logService,
      remoteAuthorityResolverService,
      tunnelService,
      accessibilityService,
      instantiationService
    );
    this._nativeHostService = _nativeHostService;
    this._findStarted = false;
    this._iframeDelayer = this._register(new Delayer(200));
    this._webviewKeyboardHandler = new WindowIgnoreMenuShortcutsManager(configurationService, mainProcessService, _nativeHostService);
    this._webviewMainService = ProxyChannel.toService(mainProcessService.getChannel("webview"));
    if (initInfo.options.enableFindWidget) {
      this._register(this.onDidHtmlChange((newContent) => {
        if (this._findStarted && this._cachedHtmlContent !== newContent) {
          this.stopFind(false);
          this._cachedHtmlContent = newContent;
        }
      }));
      this._register(this._webviewMainService.onFoundInFrame((result) => {
        this._hasFindResult.fire(result.matches > 0);
      }));
    }
  }
  get platform() {
    return "electron";
  }
  dispose() {
    this._webviewKeyboardHandler.didBlur();
    super.dispose();
  }
  webviewContentEndpoint(iframeId) {
    return `${Schemas.vscodeWebview}://${iframeId}`;
  }
  /**
   * Webviews expose a stateful find API.
   * Successive calls to find will move forward or backward through onFindResults
   * depending on the supplied options.
   *
   * @param value The string to search for. Empty strings are ignored.
   */
  find(value, previous) {
    if (!this.element) {
      return;
    }
    if (!this._findStarted) {
      this.updateFind(value);
    } else {
      const options = { forward: !previous, findNext: false, matchCase: false };
      this._webviewMainService.findInFrame({ windowId: this._nativeHostService.windowId }, this.id, value, options);
    }
  }
  updateFind(value) {
    if (!value || !this.element) {
      return;
    }
    const options = {
      forward: true,
      findNext: true,
      matchCase: false
    };
    this._iframeDelayer.trigger(() => {
      this._findStarted = true;
      this._webviewMainService.findInFrame({ windowId: this._nativeHostService.windowId }, this.id, value, options);
    });
  }
  stopFind(keepSelection) {
    if (!this.element) {
      return;
    }
    this._iframeDelayer.cancel();
    this._findStarted = false;
    this._webviewMainService.stopFindInFrame({ windowId: this._nativeHostService.windowId }, this.id, {
      keepSelection
    });
    this._onDidStopFind.fire();
  }
  handleFocusChange(isFocused) {
    super.handleFocusChange(isFocused);
    if (isFocused) {
      this._webviewKeyboardHandler.didFocus();
    } else {
      this._webviewKeyboardHandler.didBlur();
    }
  }
};
ElectronWebviewElement = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, ITunnelService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IRemoteAuthorityResolverService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IMainProcessService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, INativeHostService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IAccessibilityService)
], ElectronWebviewElement);
export {
  ElectronWebviewElement
};
