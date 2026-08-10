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
import { Codicon } from "../../../../../base/common/codicons.js";
import { TimeoutTimer } from "../../../../../base/common/async.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IExtensionGalleryService } from "../../../../../platform/extensionManagement/common/extensionManagement.js";
import { ICommandService, CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IWorkbenchExtensionManagementService } from "../../../../services/extensionManagement/common/extensionManagement.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { IChatService } from "../../common/chatService/chatService.js";
const INSTALL_CONTEXT_PREFIX = "chat.installRecommendationAvailable";
let ChatAgentRecommendation = class extends Disposable {
  constructor(productService, extensionGalleryService, extensionManagementService, contextKeyService) {
    super();
    this.productService = productService;
    this.extensionGalleryService = extensionGalleryService;
    this.extensionManagementService = extensionManagementService;
    this.contextKeyService = contextKeyService;
    this.availabilityContextKeys = /* @__PURE__ */ new Map();
    this.refreshRequestId = 0;
    const recommendations = this.productService.chatSessionRecommendations;
    if (!recommendations?.length || !this.extensionGalleryService.isEnabled()) {
      return;
    }
    for (const recommendation of recommendations) {
      this.registerRecommendation(recommendation);
    }
    const refresh = () => this.refreshInstallAvailability();
    this._register(this.extensionManagementService.onProfileAwareDidInstallExtensions(refresh));
    this._register(this.extensionManagementService.onProfileAwareDidUninstallExtension(refresh));
    this._register(this.extensionManagementService.onDidChangeProfile(refresh));
    this.refreshInstallAvailability();
  }
  static {
    this.ID = "workbench.contrib.chatAgentRecommendation";
  }
  registerRecommendation(recommendation) {
    const extensionKey = ExtensionIdentifier.toKey(recommendation.extensionId);
    const commandId = `chat.installRecommendation.${extensionKey}.${recommendation.name}`;
    const availabilityContextId = `${INSTALL_CONTEXT_PREFIX}.${extensionKey}`;
    const availabilityContext = new RawContextKey(availabilityContextId, false).bindTo(this.contextKeyService);
    this.availabilityContextKeys.set(extensionKey, availabilityContext);
    const title = localize2("chat.installRecommendation", "New {0}", recommendation.displayName);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: commandId,
          title,
          tooltip: recommendation.description,
          f1: false,
          category: CHAT_CATEGORY,
          icon: Codicon.extensions,
          menu: [
            {
              id: MenuId.ChatNewMenu,
              group: "4_recommendations",
              when: ContextKeyExpr.equals(availabilityContextId, true)
            }
          ]
        });
      }
      async run(accessor) {
        const commandService = accessor.get(ICommandService);
        const productService = accessor.get(IProductService);
        const chatService = accessor.get(IChatService);
        const installPreReleaseVersion = productService.quality !== "stable";
        await commandService.executeCommand("workbench.extensions.installExtension", recommendation.extensionId, {
          installPreReleaseVersion
        });
        await runPostInstallCommand(commandService, chatService, recommendation.postInstallCommand);
      }
    }));
  }
  refreshInstallAvailability() {
    if (!this.availabilityContextKeys.size) {
      return;
    }
    const currentRequest = ++this.refreshRequestId;
    this.extensionManagementService.getInstalled().then((installedExtensions) => {
      if (currentRequest !== this.refreshRequestId) {
        return;
      }
      const installed = new Set(installedExtensions.map((ext) => ExtensionIdentifier.toKey(ext.identifier.id)));
      for (const [extensionKey, context] of this.availabilityContextKeys) {
        context.set(!installed.has(extensionKey));
      }
    }, () => {
      if (currentRequest !== this.refreshRequestId) {
        return;
      }
      for (const [, context] of this.availabilityContextKeys) {
        context.set(false);
      }
    });
  }
};
ChatAgentRecommendation = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, IWorkbenchExtensionManagementService),
  __decorateParam(3, IContextKeyService)
], ChatAgentRecommendation);
async function runPostInstallCommand(commandService, chatService, commandId) {
  if (!commandId) {
    return;
  }
  await waitForCommandRegistration(commandId);
  await chatService.activateDefaultAgent(ChatAgentLocation.Chat);
  try {
    await commandService.executeCommand(commandId);
  } catch {
  }
}
function waitForCommandRegistration(commandId) {
  if (CommandsRegistry.getCommands().has(commandId)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = new TimeoutTimer();
    const listener = CommandsRegistry.onDidRegisterCommand((id) => {
      if (id === commandId) {
        listener.dispose();
        timer.dispose();
        resolve();
      }
    });
    timer.cancelAndSet(() => {
      listener.dispose();
      resolve();
    }, 1e4);
  });
}
export {
  ChatAgentRecommendation
};
