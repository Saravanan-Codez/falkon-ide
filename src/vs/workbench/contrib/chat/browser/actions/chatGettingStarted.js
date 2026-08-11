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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { IExtensionManagementService, InstallOperation } from "../../../../../platform/extensionManagement/common/extensionManagement.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IChatWidgetService } from "../chat.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
let ChatGettingStartedContribution = class extends Disposable {
  constructor(productService, extensionService, extensionManagementService, storageService, chatWidgetService, configurationService) {
    super();
    this.productService = productService;
    this.extensionService = extensionService;
    this.extensionManagementService = extensionManagementService;
    this.storageService = storageService;
    this.chatWidgetService = chatWidgetService;
    this.configurationService = configurationService;
    this.recentlyInstalled = false;
    const defaultChatAgent = this.productService.defaultChatAgent;
    const hideWelcomeView = this.storageService.getBoolean(ChatGettingStartedContribution.hideWelcomeView, StorageScope.APPLICATION, false);
    if (!defaultChatAgent || hideWelcomeView) {
      return;
    }
    this.registerListeners(defaultChatAgent);
  }
  static {
    this.ID = "workbench.contrib.chatGettingStarted";
  }
  static {
    this.hideWelcomeView = "workbench.chat.hideWelcomeView";
  }
  registerListeners(defaultChatAgent) {
    this._register(this.extensionManagementService.onDidInstallExtensions(async (result) => {
      for (const e of result) {
        if (ExtensionIdentifier.equals(defaultChatAgent.extensionId, e.identifier.id) && e.operation === InstallOperation.Install) {
          this.recentlyInstalled = true;
          return;
        }
      }
    }));
    this._register(this.extensionService.onDidChangeExtensionsStatus(async (event) => {
      for (const ext of event) {
        if (ExtensionIdentifier.equals(defaultChatAgent.extensionId, ext.value)) {
          const extensionStatus = this.extensionService.getExtensionsStatus();
          if (extensionStatus[ext.value].activationTimes && this.recentlyInstalled) {
            this.onDidInstallChat();
            return;
          }
        }
      }
    }));
  }
  async onDidInstallChat() {
    const startupEditor = this.configurationService.getValue("workbench.startupEditor");
    if (startupEditor !== "agentSessionsWelcomePage") {
      this.chatWidgetService.revealWidget();
    }
    this.storageService.store(ChatGettingStartedContribution.hideWelcomeView, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    this.recentlyInstalled = false;
  }
};
ChatGettingStartedContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IExtensionManagementService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, IConfigurationService)
], ChatGettingStartedContribution);
export {
  ChatGettingStartedContribution
};
