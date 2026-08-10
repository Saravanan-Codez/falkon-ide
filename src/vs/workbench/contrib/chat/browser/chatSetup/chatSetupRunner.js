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
import "./media/chatSetup.css";
import { $ } from "../../../../../base/browser/dom.js";
import { Dialog, DialogContentsAlignment } from "../../../../../base/browser/ui/dialog/dialog.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { localize } from "../../../../../nls.js";
import { createWorkbenchDialogOptions } from "../../../../browser/parts/dialogs/dialog.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ILayoutService } from "../../../../../platform/layout/browser/layoutService.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import product from "../../../../../platform/product/common/product.js";
import { ITelemetryService, TelemetryLevel } from "../../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { ChatEntitlement, IChatEntitlementService, isProUser } from "../../../../services/chat/common/chatEntitlementService.js";
import { IChatWidgetService } from "../chat.js";
import { ChatSetupAnonymous, ChatSetupError, ChatSetupStrategy } from "./chatSetup.js";
import { GitHubPaths, IDefaultAccountService } from "../../../../../platform/defaultAccount/common/defaultAccount.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { raceTimeout } from "../../../../../base/common/async.js";
const fallbackProviders = {
  default: { id: "", name: "" },
  enterprise: { id: "", name: "" },
  apple: { id: "", name: "" },
  google: { id: "", name: "" }
};
const configuredProviders = product.defaultChatAgent?.provider;
const defaultChat = {
  chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? "",
  publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? "",
  provider: {
    default: configuredProviders?.default ?? fallbackProviders.default,
    enterprise: configuredProviders?.enterprise ?? fallbackProviders.enterprise,
    apple: configuredProviders?.apple ?? fallbackProviders.apple,
    google: configuredProviders?.google ?? fallbackProviders.google
  },
  chatRefreshTokenCommand: product.defaultChatAgent?.chatRefreshTokenCommand ?? "",
  termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? "",
  privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ""
};
let ChatSetupDialog = class extends Disposable {
  constructor(container, options, keybindingService, layoutService, hostService, markdownRendererService) {
    super();
    this.options = options;
    this.dialog = this._register(new Dialog(
      container,
      options.title,
      options.buttons.map((button) => button.label),
      createWorkbenchDialogOptions({
        type: "none",
        extraClasses: ["chat-setup-dialog", ...options.extraClasses ?? []],
        detail: " ",
        icon: options.icon,
        alignment: DialogContentsAlignment.Vertical,
        cancelId: options.buttons.length,
        disableCloseButton: options.disableCloseButton,
        renderFooter: (footer) => {
          const element = footer.appendChild($(".chat-setup-dialog-footer"));
          const renderedFooter = this._register(markdownRendererService.render(new MarkdownString(options.footer, { isTrusted: true })));
          element.appendChild($("p", void 0, renderedFooter.element));
          const customFooter = options.renderFooter?.(element);
          if (customFooter) {
            this._register(customFooter);
          }
        },
        buttonOptions: options.buttons.map((button) => {
          const classes = button.classes;
          return classes ? { styleButton: (control) => control.element.classList.add(...classes) } : void 0;
        })
      }, keybindingService, layoutService, hostService)
    ));
  }
  async show() {
    const { button } = await this.dialog.show();
    return this.options.buttons[button]?.strategy ?? ChatSetupStrategy.Canceled;
  }
};
ChatSetupDialog = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, ILayoutService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IMarkdownRendererService)
], ChatSetupDialog);
function getChatSetupDialogButtons(entitlement, options, enterpriseAuthentication, providers = defaultChat.provider) {
  const button = (label, strategy, ...classes) => ({ label, strategy, classes });
  if (!options?.forceAnonymous && (entitlement === ChatEntitlement.Unknown || options?.forceSignInDialog)) {
    const defaultProviderButton = button(localize("continueWith", "Continue with {0}", providers.default.name), ChatSetupStrategy.SetupWithoutEnterpriseProvider, "continue-button", "default");
    const defaultProviderLink = button(defaultProviderButton.label, defaultProviderButton.strategy, "link-button");
    const enterpriseProviderButton = button(localize("continueWith", "Continue with {0}", providers.enterprise.name), ChatSetupStrategy.SetupWithEnterpriseProvider, "continue-button", "default");
    const enterpriseProviderLink = button(enterpriseProviderButton.label, enterpriseProviderButton.strategy, "link-button");
    const googleProviderButton = button(localize("continueWith", "Continue with {0}", providers.google.name), ChatSetupStrategy.SetupWithGoogleProvider, "continue-button", "google");
    const appleProviderButton = button(localize("continueWith", "Continue with {0}", providers.apple.name), ChatSetupStrategy.SetupWithAppleProvider, "continue-button", "apple");
    return enterpriseAuthentication ? [enterpriseProviderButton, googleProviderButton, appleProviderButton, defaultProviderLink] : [defaultProviderButton, googleProviderButton, appleProviderButton, enterpriseProviderLink];
  }
  return [button(localize("setupAIButton", "Use AI Features"), ChatSetupStrategy.DefaultSetup)];
}
function getChatSetupDialogFooter(forceAnonymous, telemetryLevel, settingsUrl, content = {
  providerName: defaultChat.provider.default.name,
  termsStatementUrl: defaultChat.termsStatementUrl,
  privacyStatementUrl: defaultChat.privacyStatementUrl,
  publicCodeMatchesUrl: defaultChat.publicCodeMatchesUrl
}) {
  if (forceAnonymous || telemetryLevel === TelemetryLevel.NONE) {
    return localize({ key: "settingsAnonymous", comment: ['{Locked="["}', '{Locked="]({1})"}', '{Locked="]({2})"}'] }, "By continuing, you agree to {0}'s [Terms]({1}) and [Privacy Statement]({2}).", content.providerName, content.termsStatementUrl, content.privacyStatementUrl);
  }
  return localize({ key: "settings", comment: ['{Locked="["}', '{Locked="]({1})"}', '{Locked="]({2})"}', '{Locked="]({4})"}', '{Locked="]({5})"}'] }, "By continuing, you agree to {0}'s [Terms]({1}) and [Privacy Statement]({2}). {3} Copilot may show [public code]({4}) suggestions and use your data to improve the product. You can change these [settings]({5}) anytime.", content.providerName, content.termsStatementUrl, content.privacyStatementUrl, content.providerName, content.publicCodeMatchesUrl, settingsUrl);
}
let ChatSetup = class {
  constructor(context, controller, telemetryService, layoutService, chatEntitlementService, logService, widgetService, workspaceTrustRequestService, defaultAccountService, extensionService, workspaceTrustManagementService, instantiationService) {
    this.context = context;
    this.controller = controller;
    this.telemetryService = telemetryService;
    this.layoutService = layoutService;
    this.chatEntitlementService = chatEntitlementService;
    this.logService = logService;
    this.widgetService = widgetService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.defaultAccountService = defaultAccountService;
    this.extensionService = extensionService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.instantiationService = instantiationService;
    this.pendingRun = void 0;
    this.skipDialogOnce = false;
  }
  static {
    this.instance = void 0;
  }
  static getInstance(instantiationService, context, controller) {
    let instance = ChatSetup.instance;
    if (!instance) {
      instance = ChatSetup.instance = instantiationService.createInstance(ChatSetup, context, controller);
    }
    return instance;
  }
  skipDialog() {
    this.skipDialogOnce = true;
  }
  async run(options) {
    if (this.pendingRun) {
      return this.pendingRun;
    }
    this.pendingRun = this.doRun(options);
    try {
      return await this.pendingRun;
    } finally {
      this.pendingRun = void 0;
    }
  }
  async doRun(options) {
    this.context.update({ later: false });
    const dialogSkipped = this.skipDialogOnce;
    this.skipDialogOnce = false;
    const wasTrusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
    const trusted = await this.workspaceTrustRequestService.requestWorkspaceTrust({
      message: localize("chatWorkspaceTrust", "AI features are currently only supported in trusted workspaces.")
    });
    if (!trusted) {
      this.context.update({ later: true });
      this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: "failedNotTrusted", installDuration: 0, signUpErrorCode: void 0, provider: void 0 });
      return {
        dialogSkipped,
        success: void 0
        /* canceled */
      };
    }
    if (!wasTrusted) {
      await this.whenChatExtensionActivated();
    }
    let setupStrategy;
    if (options?.setupStrategy !== void 0) {
      setupStrategy = options.setupStrategy;
    } else if (!options?.forceSignInDialog && (dialogSkipped || isProUser(this.chatEntitlementService.entitlement) || this.chatEntitlementService.entitlement === ChatEntitlement.Free)) {
      setupStrategy = ChatSetupStrategy.DefaultSetup;
    } else if (options?.forceAnonymous === ChatSetupAnonymous.EnabledWithoutDialog) {
      setupStrategy = ChatSetupStrategy.DefaultSetup;
    } else {
      setupStrategy = await this.showDialog(options);
    }
    if (setupStrategy === ChatSetupStrategy.DefaultSetup && this.defaultAccountService.getDefaultAccountAuthenticationProvider().enterprise) {
      setupStrategy = ChatSetupStrategy.SetupWithEnterpriseProvider;
    }
    let success = void 0;
    let setupError;
    let errorAlreadyHandled = false;
    const setupCancellation = new CancellationTokenSource();
    try {
      if (setupStrategy !== ChatSetupStrategy.Canceled) {
        options?.onSignInStarted?.(() => setupCancellation.cancel());
      }
      if (setupStrategy !== ChatSetupStrategy.Canceled && !options?.disableChatViewReveal) {
        this.widgetService.revealWidget();
      }
      switch (setupStrategy) {
        case ChatSetupStrategy.SetupWithEnterpriseProvider:
          success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: true, useSocialProvider: void 0, additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous, cancellationToken: setupCancellation.token });
          break;
        case ChatSetupStrategy.SetupWithoutEnterpriseProvider:
          success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: void 0, additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous, cancellationToken: setupCancellation.token });
          break;
        case ChatSetupStrategy.SetupWithAppleProvider:
          success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: "apple", additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous, cancellationToken: setupCancellation.token });
          break;
        case ChatSetupStrategy.SetupWithGoogleProvider:
          success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: "google", additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous, cancellationToken: setupCancellation.token });
          break;
        case ChatSetupStrategy.DefaultSetup:
          success = await this.controller.value.setup({ ...options, forceAnonymous: options?.forceAnonymous, cancellationToken: setupCancellation.token });
          break;
        case ChatSetupStrategy.Canceled:
          this.context.update({ later: true });
          this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: "failedMaybeLater", installDuration: 0, signUpErrorCode: void 0, provider: void 0 });
          break;
      }
    } catch (error) {
      this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
      success = false;
      if (error instanceof ChatSetupError) {
        setupError = error.originalError;
        errorAlreadyHandled = error.userNotified;
      } else {
        setupError = error instanceof Error ? error : new Error(toErrorMessage(error));
      }
    } finally {
      setupCancellation.dispose();
    }
    if (success) {
      this.context.update({ completed: true });
    }
    return { success, dialogSkipped, error: setupError, errorAlreadyHandled };
  }
  /**
   * Whether the default chat extension has finished activating. `activationTimes`
   * is only set once activation completes, so `undefined` means "not yet active".
   */
  isChatExtensionActivated() {
    const status = this.extensionService.getExtensionsStatus();
    for (const id of Object.keys(status)) {
      if (ExtensionIdentifier.equals(id, defaultChat.chatExtensionId)) {
        return status[id].activationTimes !== void 0;
      }
    }
    return false;
  }
  /**
   * Resolves once the default chat extension has finished activating (bounded by
   * a timeout). Detection relies only on the extension lifecycle, so it never
   * touches the user's authentication session.
   */
  async whenChatExtensionActivated(timeoutMs = 1e4) {
    if (!defaultChat.chatExtensionId || this.isChatExtensionActivated()) {
      return;
    }
    const store = new DisposableStore();
    try {
      await raceTimeout(new Promise((resolve) => {
        const check = () => {
          if (this.isChatExtensionActivated()) {
            resolve();
          }
        };
        store.add(this.extensionService.onDidChangeExtensionsStatus(check));
        this.extensionService.whenInstalledExtensionsRegistered().then(check);
      }), timeoutMs);
    } finally {
      store.dispose();
    }
  }
  async showDialog(options) {
    const buttons = getChatSetupDialogButtons(this.context.state.entitlement, options, this.defaultAccountService.getDefaultAccountAuthenticationProvider().enterprise);
    const dialog = this.instantiationService.createInstance(ChatSetupDialog, this.layoutService.activeContainer, {
      title: this.getDialogTitle(options),
      buttons,
      icon: options?.dialogIcon ?? Codicon.copilotLarge,
      disableCloseButton: options?.disableCloseButton ?? false,
      footer: getChatSetupDialogFooter(options?.forceAnonymous, this.telemetryService.telemetryLevel, this.defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotSettings)),
      extraClasses: options?.dialogExtraClasses,
      renderFooter: options?.renderDialogFooter
    });
    try {
      return await dialog.show();
    } finally {
      dialog.dispose();
    }
  }
  getDialogTitle(options) {
    if (options?.dialogTitle) {
      return options.dialogTitle;
    }
    if (this.chatEntitlementService.anonymous) {
      if (options?.forceAnonymous) {
        return localize("startUsing", "Start using AI Features");
      } else {
        return localize("enableMore", "Enable more AI features");
      }
    }
    if (this.context.state.entitlement === ChatEntitlement.Unknown || options?.forceSignInDialog) {
      return localize("signIn", "Sign in to use GitHub Copilot");
    }
    return localize("startUsing", "Start using AI Features");
  }
};
ChatSetup = __decorateClass([
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, ILayoutService),
  __decorateParam(4, IChatEntitlementService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, IWorkspaceTrustRequestService),
  __decorateParam(8, IDefaultAccountService),
  __decorateParam(9, IExtensionService),
  __decorateParam(10, IWorkspaceTrustManagementService),
  __decorateParam(11, IInstantiationService)
], ChatSetup);
function refreshTokens(commandService) {
  commandService.executeCommand(defaultChat.chatRefreshTokenCommand);
}
export {
  ChatSetup,
  ChatSetupDialog,
  getChatSetupDialogButtons,
  getChatSetupDialogFooter,
  refreshTokens
};
