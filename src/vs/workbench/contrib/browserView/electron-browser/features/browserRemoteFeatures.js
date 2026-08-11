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
import { localize } from "../../../../../nls.js";
import { $ } from "../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { BrowserEditor, BrowserEditorContribution, BrowserWidgetLocation } from "../browserEditor.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../../common/configuration.js";
import { BrowserRemoteProxyEnabledSettingId } from "../browserViewWorkbenchService.js";
import product from "../../../../../platform/product/common/product.js";
let BrowserRemoteIndicatorContribution = class extends BrowserEditorContribution {
  constructor(editor, hoverService, browserViewWorkbenchService) {
    super(editor);
    this.browserViewWorkbenchService = browserViewWorkbenchService;
    this._message = "";
    this._container = $(".browser-remote-indicator");
    this._container.setAttribute("role", "img");
    const icon = renderIcon(Codicon.remote);
    this._container.appendChild(icon);
    this._register(hoverService.setupDelayedHover(
      this._container,
      () => ({
        content: this._message
      })
    ));
    this.refresh(null);
  }
  get widgets() {
    return [{ location: BrowserWidgetLocation.PreUrl, element: this._container, order: 0 }];
  }
  onModelAttached(model, store) {
    this.refresh(model);
    store.add(model.onDidNavigate(() => this.refresh(model)));
    store.add(model.onDidChangeRemoteStatus(() => this.refresh(model)));
  }
  onModelDetached() {
    this.refresh(null);
  }
  refresh(model) {
    let statusMessage = "";
    let isConnected = false;
    let isWarning = false;
    if (model) {
      if (model.url.startsWith("file://")) {
        isConnected = false;
        statusMessage = localize("browser.connectedLocally.file", "File URLs are served locally, not over the remote connection.");
        isWarning = true;
      } else if (model.isRemoteSession) {
        isConnected = true;
        statusMessage = localize("browser.connectedRemotely", "Connected via remote");
      } else {
        isConnected = false;
        statusMessage = localize("browser.connectedLocally.generic", "Connected locally");
      }
    }
    this._container.classList.toggle("connected", isConnected);
    this._container.classList.toggle("warning", isWarning);
    this._container.style.display = isConnected || this.browserViewWorkbenchService.willUseRemoteProxy() ? "" : "none";
    this._container.setAttribute("aria-label", statusMessage);
    this._message = statusMessage;
  }
};
BrowserRemoteIndicatorContribution = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, IBrowserViewWorkbenchService)
], BrowserRemoteIndicatorContribution);
BrowserEditor.registerContribution(BrowserRemoteIndicatorContribution);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    [BrowserRemoteProxyEnabledSettingId]: {
      type: "boolean",
      default: product.quality !== "stable",
      tags: ["experimental"],
      scope: ConfigurationScope.WINDOW,
      experiment: { mode: "startup" },
      markdownDescription: localize("browser.enableRemoteProxy", "When enabled, browser requests in remote workspaces are proxied through the remote connection. This allows web pages to access resources available on the remote host.")
    }
  }
});
