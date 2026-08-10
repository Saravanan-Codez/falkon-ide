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
import { mainWindow } from "../../../../base/browser/window.js";
import { decodeBase64 } from "../../../../base/common/buffer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { AgentPluginEditorInput } from "./agentPluginEditor/agentPluginEditorInput.js";
import { AgentPluginItemKind } from "./agentPluginEditor/agentPluginItems.js";
import { ChatConfiguration } from "../common/constants.js";
import { MarketplaceReferenceKind, parseMarketplaceReference, parseMarketplaceReferences, readConfiguredMarketplaces } from "../common/plugins/marketplaceReference.js";
import { IPluginInstallService } from "../common/plugins/pluginInstallService.js";
let PluginUrlHandler = class extends Disposable {
  constructor(urlService, _pluginInstallService, _dialogService, _configurationService, _extensionsWorkbenchService, _hostService, _logService, _notificationService, _editorService, _instantiationService) {
    super();
    this._pluginInstallService = _pluginInstallService;
    this._dialogService = _dialogService;
    this._configurationService = _configurationService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._hostService = _hostService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._register(urlService.registerHandler(this));
  }
  static {
    this.ID = "workbench.contrib.pluginUrlHandler";
  }
  async handleURL(uri) {
    if (uri.authority !== "chat-plugin") {
      return false;
    }
    switch (uri.path) {
      case "/install":
        return this._handleInstall(uri);
      case "/add-marketplace":
        return this._handleAddMarketplace(uri);
      default:
        return false;
    }
  }
  // --- install a plugin from source ---
  async _handleInstall(uri) {
    const source = this._decodeQueryParam(uri, "source");
    if (!source) {
      this._logService.warn('[PluginUrlHandler] Missing or invalid "source" query parameter');
      return true;
    }
    const ref = parseMarketplaceReference(source);
    if (!ref) {
      this._logService.warn(`[PluginUrlHandler] Invalid plugin source: ${source}`);
      return true;
    }
    if (ref.kind === MarketplaceReferenceKind.LocalFileUri) {
      this._logService.warn("[PluginUrlHandler] Local file URIs are not supported for install");
      return true;
    }
    await this._hostService.focus(mainWindow);
    const pluginName = this._decodeStringParam(uri, "plugin");
    const { confirmed } = await this._dialogService.confirm({
      type: "question",
      message: pluginName ? localize("confirmInstallTargetedPlugin", "Install Plugin '{0}' from '{1}'?", pluginName, ref.displayLabel) : localize("confirmInstallPlugin", "Install Plugin from '{0}'?", ref.displayLabel),
      detail: localize("confirmInstallPluginDetail", "An external application wants to install a plugin from this source. Plugins can run code on your machine. Only install plugins from sources you trust.\n\nSource: {0}", ref.rawValue),
      primaryButton: localize({ key: "installButton", comment: ["&& denotes a mnemonic"] }, "&&Install"),
      custom: { icon: Codicon.shield }
    });
    if (!confirmed) {
      return true;
    }
    if (pluginName) {
      return this._handleInstallTargetedPlugin(source, ref.displayLabel, pluginName);
    }
    const result = await this._pluginInstallService.installPluginFromSource(source);
    if (!result.success && result.message) {
      this._notificationService.notify({ severity: Severity.Error, message: result.message });
    }
    this._extensionsWorkbenchService.openSearch(`@agentPlugins ${ref.displayLabel}`);
    return true;
  }
  /**
   * Handles the case where a specific plugin is targeted within a
   * marketplace. Delegates trust and discovery to the install service,
   * then opens the plugin details in a modal editor.
   */
  async _handleInstallTargetedPlugin(source, displayLabel, pluginName) {
    const result = await this._pluginInstallService.installPluginFromSource(source, { plugin: pluginName });
    if (!result.success) {
      if (result.message) {
        this._logService.warn(`[PluginUrlHandler] ${result.message}`);
      }
      this._extensionsWorkbenchService.openSearch(`@agentPlugins ${displayLabel}`);
      return true;
    }
    if (!result.matchedPlugin) {
      this._extensionsWorkbenchService.openSearch(`@agentPlugins ${displayLabel}`);
      return true;
    }
    const plugin = result.matchedPlugin;
    const item = {
      kind: AgentPluginItemKind.Marketplace,
      name: plugin.name,
      description: plugin.description,
      source: plugin.source,
      sourceDescriptor: plugin.sourceDescriptor,
      marketplace: plugin.marketplace,
      marketplaceReference: plugin.marketplaceReference,
      marketplaceType: plugin.marketplaceType,
      readmeUri: plugin.readmeUri
    };
    const input = this._instantiationService.createInstance(AgentPluginEditorInput, item);
    await this._editorService.openEditor(input);
    return true;
  }
  // --- add a marketplace ---
  async _handleAddMarketplace(uri) {
    const refValue = this._decodeQueryParam(uri, "ref");
    if (!refValue) {
      this._logService.warn('[PluginUrlHandler] Missing or invalid "ref" query parameter');
      return true;
    }
    const ref = parseMarketplaceReference(refValue);
    if (!ref) {
      this._logService.warn(`[PluginUrlHandler] Invalid marketplace reference: ${refValue}`);
      return true;
    }
    await this._hostService.focus(mainWindow);
    const { confirmed } = await this._dialogService.confirm({
      type: "question",
      message: localize("confirmAddMarketplace", "Add Plugin Marketplace '{0}'?", ref.displayLabel),
      detail: localize("confirmAddMarketplaceDetail", "An external application wants to add a plugin marketplace. Plugins from this marketplace will appear in the plugin catalog and can be installed.\n\nSource: {0}", ref.rawValue),
      primaryButton: localize({ key: "addMarketplaceButton", comment: ["&& denotes a mnemonic"] }, "&&Add Marketplace"),
      custom: { icon: Codicon.shield }
    });
    if (!confirmed) {
      return true;
    }
    const { userValues, effectiveValues } = readConfiguredMarketplaces(this._configurationService);
    const existingRefs = parseMarketplaceReferences(effectiveValues);
    if (!existingRefs.some((e) => e.canonicalId === ref.canonicalId)) {
      await this._configurationService.updateValue(
        ChatConfiguration.PluginMarketplaces,
        [...userValues, refValue],
        ConfigurationTarget.USER
      );
    }
    this._extensionsWorkbenchService.openSearch(`@agentPlugins ${ref.displayLabel}`);
    return true;
  }
  // --- helpers ---
  /**
   * Reads a query parameter and attempts to parse it as a marketplace
   * reference. Tries base64-decoding first, then falls back to the raw
   * value so that plain-text `owner/repo` values also work in URLs.
   */
  _decodeQueryParam(uri, key) {
    const params = new URLSearchParams(uri.query);
    const raw = params.get(key);
    if (!raw) {
      return void 0;
    }
    const decoded = this._tryBase64Decode(raw);
    if (decoded && parseMarketplaceReference(decoded)) {
      return decoded;
    }
    return parseMarketplaceReference(raw) ? raw : void 0;
  }
  /**
   * Reads a query parameter and decodes it. Tries base64-decoding first,
   * then falls back to the raw value.
   */
  _decodeStringParam(uri, key) {
    const params = new URLSearchParams(uri.query);
    return params.get(key) ?? void 0;
  }
  _tryBase64Decode(raw) {
    try {
      const decoded = decodeBase64(raw).toString();
      return decoded || void 0;
    } catch {
      return void 0;
    }
  }
};
PluginUrlHandler = __decorateClass([
  __decorateParam(0, IURLService),
  __decorateParam(1, IPluginInstallService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IExtensionsWorkbenchService),
  __decorateParam(5, IHostService),
  __decorateParam(6, ILogService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IInstantiationService)
], PluginUrlHandler);
export {
  PluginUrlHandler
};
