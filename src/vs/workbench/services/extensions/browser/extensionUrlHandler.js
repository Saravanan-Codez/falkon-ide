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
import { localize, localize2 } from "../../../../nls.js";
import { combinedDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { IHostService } from "../../host/browser/host.js";
import { ActivationKind, IExtensionService } from "../common/extensions.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { disposableWindowInterval } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { equalsIgnoreCase } from "../../../../base/common/strings.js";
const FIVE_MINUTES = 5 * 60 * 1e3;
const THIRTY_SECONDS = 30 * 1e3;
const URL_TO_HANDLE = "extensionUrlHandler.urlToHandle";
const USER_TRUSTED_EXTENSIONS_CONFIGURATION_KEY = "extensions.confirmedUriHandlerExtensionIds";
const USER_TRUSTED_EXTENSIONS_STORAGE_KEY = "extensionUrlHandler.confirmedExtensions";
function isExtensionId(value) {
  return /^[a-z0-9][a-z0-9\-]*\.[a-z0-9][a-z0-9\-]*$/i.test(value);
}
class UserTrustedExtensionIdStorage {
  constructor(storageService) {
    this.storageService = storageService;
  }
  get extensions() {
    const userTrustedExtensionIdsJson = this.storageService.get(USER_TRUSTED_EXTENSIONS_STORAGE_KEY, StorageScope.PROFILE, "[]");
    try {
      return JSON.parse(userTrustedExtensionIdsJson);
    } catch {
      return [];
    }
  }
  has(id) {
    return this.extensions.indexOf(id) > -1;
  }
  add(id) {
    this.set([...this.extensions, id]);
  }
  set(ids) {
    this.storageService.store(USER_TRUSTED_EXTENSIONS_STORAGE_KEY, JSON.stringify(ids), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
}
const IExtensionUrlHandler = createDecorator("extensionUrlHandler");
class ExtensionUrlHandlerOverrideRegistry {
  static {
    this.handlers = /* @__PURE__ */ new Set();
  }
  static registerHandler(handler) {
    this.handlers.add(handler);
    return toDisposable(() => this.handlers.delete(handler));
  }
  static getHandler(uri) {
    for (const handler of this.handlers) {
      if (handler.canHandleURL(uri)) {
        return handler;
      }
    }
    return void 0;
  }
}
let ExtensionUrlHandler = class {
  constructor(urlService, extensionService, dialogService, commandService, hostService, storageService, configurationService, notificationService, productService) {
    this.extensionService = extensionService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.productService = productService;
    this.extensionHandlers = /* @__PURE__ */ new Map();
    this.uriBuffer = /* @__PURE__ */ new Map();
    this.userTrustedExtensionsStorage = new UserTrustedExtensionIdStorage(storageService);
    const interval = disposableWindowInterval(mainWindow, () => this.garbageCollect(), THIRTY_SECONDS);
    const urlToHandleValue = this.storageService.get(URL_TO_HANDLE, StorageScope.WORKSPACE);
    if (urlToHandleValue) {
      this.storageService.remove(URL_TO_HANDLE, StorageScope.WORKSPACE);
      this.handleURL(URI.revive(JSON.parse(urlToHandleValue)), { trusted: true });
    }
    const cache = ExtensionUrlBootstrapHandler.cache;
    const drainTimeout = setTimeout(() => cache.forEach(([uri, option]) => this.handleURL(uri, option)));
    this.disposable = combinedDisposable(
      urlService.registerHandler(this),
      interval,
      toDisposable(() => clearTimeout(drainTimeout))
    );
  }
  async handleURL(uri, options) {
    if (!isExtensionId(uri.authority)) {
      return false;
    }
    const overrideHandler = ExtensionUrlHandlerOverrideRegistry.getHandler(uri);
    if (overrideHandler) {
      const handled = await overrideHandler.handleURL(uri);
      if (handled) {
        return handled;
      }
    }
    const extensionId = uri.authority;
    const initialHandler = this.extensionHandlers.get(ExtensionIdentifier.toKey(extensionId));
    let extensionDisplayName;
    if (!initialHandler) {
      const extension = await this.extensionService.getExtension(extensionId);
      if (!extension) {
        await this.handleUnhandledURL(uri, extensionId, options);
        return true;
      } else {
        extensionDisplayName = extension.displayName ?? "";
      }
    } else {
      extensionDisplayName = initialHandler.extensionDisplayName;
    }
    const trusted = options?.trusted || this.productService.trustedExtensionProtocolHandlers?.some((value) => equalsIgnoreCase(value, extensionId)) || this.didUserTrustExtension(ExtensionIdentifier.toKey(extensionId));
    if (!trusted) {
      const uriString = uri.toString(false);
      let uriLabel = uriString;
      if (uriLabel.length > 40) {
        uriLabel = `${uriLabel.substring(0, 30)}...${uriLabel.substring(uriLabel.length - 5)}`;
      }
      const result = await this.dialogService.confirm({
        message: localize("confirmUrl", "Allow '{0}' extension to open this URI?", extensionDisplayName),
        checkbox: {
          label: localize("rememberConfirmUrl", "Do not ask me again for this extension")
        },
        primaryButton: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open"),
        custom: {
          markdownDetails: [{
            markdown: new MarkdownString(`<div title="${uriString}" aria-label='${uriString}'>${uriLabel}</div>`, { supportHtml: true })
          }]
        }
      });
      if (!result.confirmed) {
        return true;
      }
      if (result.checkboxChecked) {
        this.userTrustedExtensionsStorage.add(ExtensionIdentifier.toKey(extensionId));
      }
    }
    const handler = this.extensionHandlers.get(ExtensionIdentifier.toKey(extensionId));
    if (handler) {
      if (!initialHandler) {
        return await this.handleURLByExtension(extensionId, handler, uri, options);
      }
      return false;
    }
    const timestamp = (/* @__PURE__ */ new Date()).getTime();
    let uris = this.uriBuffer.get(ExtensionIdentifier.toKey(extensionId));
    if (!uris) {
      uris = [];
      this.uriBuffer.set(ExtensionIdentifier.toKey(extensionId), uris);
    }
    uris.push({ timestamp, uri });
    await this.extensionService.activateByEvent(`onUri:${ExtensionIdentifier.toKey(extensionId)}`, ActivationKind.Immediate);
    return true;
  }
  registerExtensionHandler(extensionId, handler) {
    this.extensionHandlers.set(ExtensionIdentifier.toKey(extensionId), handler);
    const uris = this.uriBuffer.get(ExtensionIdentifier.toKey(extensionId)) || [];
    for (const { uri } of uris) {
      this.handleURLByExtension(extensionId, handler, uri);
    }
    this.uriBuffer.delete(ExtensionIdentifier.toKey(extensionId));
  }
  unregisterExtensionHandler(extensionId) {
    this.extensionHandlers.delete(ExtensionIdentifier.toKey(extensionId));
  }
  async handleURLByExtension(extensionId, handler, uri, options) {
    return await handler.handleURL(uri, options);
  }
  async handleUnhandledURL(uri, extensionId, options) {
    try {
      await this.commandService.executeCommand("workbench.extensions.installExtension", extensionId, {
        justification: {
          reason: `${localize("installDetail", "This extension wants to open a URI:")}
${uri.toString()}`,
          action: localize("openUri", "Open URI")
        },
        enable: true,
        installPreReleaseVersion: this.productService.quality !== "stable"
      });
    } catch (error) {
      if (!isCancellationError(error)) {
        this.notificationService.error(error);
      }
      return;
    }
    const extension = await this.extensionService.getExtension(extensionId);
    if (extension) {
      await this.handleURL(uri, { ...options, trusted: true });
    } else {
      const result = await this.dialogService.confirm({
        message: localize("reloadAndHandle", "Extension '{0}' is not loaded. Would you like to reload the window to load the extension and open the URL?", extensionId),
        primaryButton: localize({ key: "reloadAndOpen", comment: ["&& denotes a mnemonic"] }, "&&Reload Window and Open")
      });
      if (!result.confirmed) {
        return;
      }
      this.storageService.store(URL_TO_HANDLE, JSON.stringify(uri.toJSON()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
      await this.hostService.reload();
    }
  }
  // forget about all uris buffered more than 5 minutes ago
  garbageCollect() {
    const now = (/* @__PURE__ */ new Date()).getTime();
    const uriBuffer = /* @__PURE__ */ new Map();
    this.uriBuffer.forEach((uris, extensionId) => {
      uris = uris.filter(({ timestamp }) => now - timestamp < FIVE_MINUTES);
      if (uris.length > 0) {
        uriBuffer.set(extensionId, uris);
      }
    });
    this.uriBuffer = uriBuffer;
  }
  didUserTrustExtension(id) {
    if (this.userTrustedExtensionsStorage.has(id)) {
      return true;
    }
    return this.getConfirmedTrustedExtensionIdsFromConfiguration().indexOf(id) > -1;
  }
  getConfirmedTrustedExtensionIdsFromConfiguration() {
    const trustedExtensionIds = this.configurationService.getValue(USER_TRUSTED_EXTENSIONS_CONFIGURATION_KEY);
    if (!Array.isArray(trustedExtensionIds)) {
      return [];
    }
    return trustedExtensionIds;
  }
  dispose() {
    this.disposable.dispose();
    this.extensionHandlers.clear();
    this.uriBuffer.clear();
  }
};
ExtensionUrlHandler = __decorateClass([
  __decorateParam(0, IURLService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IProductService)
], ExtensionUrlHandler);
registerSingleton(IExtensionUrlHandler, ExtensionUrlHandler, InstantiationType.Eager);
let ExtensionUrlBootstrapHandler = class {
  static {
    this.ID = "workbench.contrib.extensionUrlBootstrapHandler";
  }
  static {
    this._cache = [];
  }
  static get cache() {
    ExtensionUrlBootstrapHandler.disposable.dispose();
    const result = ExtensionUrlBootstrapHandler._cache;
    ExtensionUrlBootstrapHandler._cache = [];
    return result;
  }
  constructor(urlService) {
    ExtensionUrlBootstrapHandler.disposable = urlService.registerHandler(this);
  }
  async handleURL(uri, options) {
    if (!isExtensionId(uri.authority)) {
      return false;
    }
    ExtensionUrlBootstrapHandler._cache.push([uri, options]);
    return true;
  }
};
ExtensionUrlBootstrapHandler = __decorateClass([
  __decorateParam(0, IURLService)
], ExtensionUrlBootstrapHandler);
registerWorkbenchContribution2(
  ExtensionUrlBootstrapHandler.ID,
  ExtensionUrlBootstrapHandler,
  WorkbenchPhase.BlockRestore
  /* registration only */
);
class ManageAuthorizedExtensionURIsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.extensions.action.manageAuthorizedExtensionURIs",
      title: localize2("manage", "Manage Authorized Extension URIs..."),
      category: localize2("extensions", "Extensions"),
      menu: {
        id: MenuId.CommandPalette,
        when: IsWebContext.toNegated()
      }
    });
  }
  async run(accessor) {
    const storageService = accessor.get(IStorageService);
    const quickInputService = accessor.get(IQuickInputService);
    const storage = new UserTrustedExtensionIdStorage(storageService);
    const items = storage.extensions.map((label) => ({ label, picked: true }));
    if (items.length === 0) {
      await quickInputService.pick([{ label: localize("no", "There are currently no authorized extension URIs.") }]);
      return;
    }
    const result = await quickInputService.pick(items, { canPickMany: true });
    if (!result) {
      return;
    }
    storage.set(result.map((item) => item.label));
  }
}
registerAction2(ManageAuthorizedExtensionURIsAction);
export {
  ExtensionUrlHandlerOverrideRegistry,
  IExtensionUrlHandler
};
