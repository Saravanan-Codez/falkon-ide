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
import * as dom from "../../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable, DisposableStore, markAsSingleton, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import Severity from "../../../../../base/common/severity.js";
import { equalsIgnoreCase } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsWebContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import product from "../../../../../platform/product/common/product.js";
import { GitHubPaths, IDefaultAccountService } from "../../../../../platform/defaultAccount/common/defaultAccount.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ToggleTitleBarConfigAction } from "../../../../browser/parts/titlebar/titlebarActions.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { ChatEntitlement, ChatEntitlementContextKeys, IChatEntitlementService, isProUser } from "../../../../services/chat/common/chatEntitlementService.js";
import { EnablementState, IWorkbenchExtensionEnablementService } from "../../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionUrlHandlerOverrideRegistry } from "../../../../services/extensions/browser/extensionUrlHandler.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { CONTEXT_DEFAULT_ACCOUNT_STATE, DefaultAccountStatus } from "../../../../services/accounts/browser/defaultAccount.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../../services/layout/browser/layoutService.js";
import { InEditorZenModeContext } from "../../../../common/contextkeys.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatSessionsService } from "../../common/chatSessionsService.js";
import { ChatAIDisabledSettingId, ChatAgentLocation, ChatConfiguration, ChatModeKind } from "../../common/constants.js";
import { CHAT_CATEGORY, CHAT_SETUP_ACTION_ID, CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID } from "../actions/chatActions.js";
import { ChatViewContainerId, IChatWidgetService } from "../chat.js";
import { ChatInputNotificationSeverity, IChatInputNotificationService } from "../widget/input/chatInputNotificationService.js";
import { chatViewsWelcomeRegistry } from "../viewsWelcome/chatViewsWelcome.js";
import { buildUpgradeUrlWithRedirect, ChatSetupAnonymous, refreshTokens } from "./chatSetup.js";
import { ChatSetupController } from "./chatSetupController.js";
import { GrowthSessionController, registerGrowthSession } from "./chatSetupGrowthSession.js";
import { AICodeActionsHelper, AINewSymbolNamesProvider, ChatCodeActionsProvider, SetupAgent } from "./chatSetupProviders.js";
import { ChatSetup } from "./chatSetupRunner.js";
const defaultChat = {
  chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? ""
};
const SIGN_IN_TITLE_BAR_ACTION_ID = "workbench.action.chat.signInIndicator";
let ChatSetupContribution = class extends Disposable {
  constructor(actionViewItemService, instantiationService, chatEntitlementService, logService, contextKeyService, extensionEnablementService, extensionsWorkbenchService, extensionService, environmentService, chatSessionsService, configurationService) {
    super();
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionService = extensionService;
    this.environmentService = environmentService;
    this.chatSessionsService = chatSessionsService;
    this.configurationService = configurationService;
    const context = chatEntitlementService.context?.value;
    const requests = chatEntitlementService.requests?.value;
    if (!context || !requests) {
      return;
    }
    const controller = new Lazy(() => this._register(this.instantiationService.createInstance(ChatSetupController, context, requests)));
    this.registerSetupAgents(context, controller);
    this.registerGrowthSession(chatEntitlementService);
    this.registerActions(context, requests, controller);
    this.registerSignInTitleBarEntry(actionViewItemService);
    this.registerUrlLinkHandler();
    this.checkExtensionInstallation(context);
  }
  static {
    this.ID = "workbench.contrib.chatSetup";
  }
  registerSetupAgents(context, controller) {
    const defaultAgentDisposables = markAsSingleton(new MutableDisposable());
    const vscodeAgentDisposables = markAsSingleton(new MutableDisposable());
    const renameProviderDisposables = markAsSingleton(new MutableDisposable());
    const codeActionsProviderDisposables = markAsSingleton(new MutableDisposable());
    const updateRegistration = () => {
      {
        if (!context.state.hidden && !context.state.disabledInWorkspace) {
          if (!defaultAgentDisposables.value) {
            const disposables = defaultAgentDisposables.value = new DisposableStore();
            const panelAgentDisposables = disposables.add(new DisposableStore());
            for (const mode of [ChatModeKind.Ask, ChatModeKind.Edit, ChatModeKind.Agent]) {
              const { agent, disposable } = SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Chat, mode, context, controller);
              panelAgentDisposables.add(disposable);
              panelAgentDisposables.add(agent.onUnresolvableError(() => {
                const panelAgentHasGuidance = chatViewsWelcomeRegistry.get().some((descriptor) => this.contextKeyService.contextMatchesRules(descriptor.when));
                if (panelAgentHasGuidance) {
                  this.logService.error("[chat setup] Unresolvable error from Chat agent registration, clearing registration.");
                  panelAgentDisposables.dispose();
                }
              }));
            }
            disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Terminal, ChatModeKind.Ask, context, controller).disposable);
            disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.Notebook, ChatModeKind.Ask, context, controller).disposable);
            disposables.add(SetupAgent.registerDefaultAgents(this.instantiationService, ChatAgentLocation.EditorInline, ChatModeKind.Ask, context, controller).disposable);
          }
          if ((!context.state.completed || context.state.entitlement === ChatEntitlement.Unknown || context.state.entitlement === ChatEntitlement.Unresolved) && !vscodeAgentDisposables.value) {
            const disposables = vscodeAgentDisposables.value = new DisposableStore();
            disposables.add(SetupAgent.registerBuiltInAgents(this.instantiationService, context, controller));
          }
        } else {
          defaultAgentDisposables.clear();
          vscodeAgentDisposables.clear();
        }
        if (context.state.completed) {
          vscodeAgentDisposables.clear();
        }
      }
      {
        if (!context.state.completed && !context.state.hidden && !context.state.disabledInWorkspace) {
          if (!renameProviderDisposables.value) {
            renameProviderDisposables.value = AINewSymbolNamesProvider.registerProvider(this.instantiationService, context, controller);
          }
        } else {
          renameProviderDisposables.clear();
        }
      }
      {
        if (!context.state.completed && !context.state.hidden && !context.state.disabledInWorkspace) {
          if (!codeActionsProviderDisposables.value) {
            codeActionsProviderDisposables.value = ChatCodeActionsProvider.registerProvider(this.instantiationService);
          }
        } else {
          codeActionsProviderDisposables.clear();
        }
      }
    };
    this._register(Event.runAndSubscribe(context.onDidChange, () => updateRegistration()));
  }
  registerGrowthSession(chatEntitlementService) {
    const growthSessionDisposables = markAsSingleton(new MutableDisposable());
    const updateGrowthSession = () => {
      const experimentEnabled = this.configurationService.getValue(ChatConfiguration.GrowthNotificationEnabled) === true;
      const shouldShow = experimentEnabled && !chatEntitlementService.sentiment.completed;
      if (shouldShow && !growthSessionDisposables.value) {
        const disposables = new DisposableStore();
        const controller = disposables.add(this.instantiationService.createInstance(GrowthSessionController));
        if (!controller.isDismissed) {
          disposables.add(registerGrowthSession(this.chatSessionsService, controller));
          disposables.add(controller.onDidDismiss(() => {
            growthSessionDisposables.clear();
          }));
          growthSessionDisposables.value = disposables;
        } else {
          disposables.dispose();
        }
      } else if (!shouldShow) {
        growthSessionDisposables.clear();
      }
    };
    this._register(chatEntitlementService.onDidChangeSentiment(() => updateGrowthSession()));
    updateGrowthSession();
  }
  registerActions(context, requests, controller) {
    class ChatSetupTriggerAction extends Action2 {
      static {
        this.CHAT_SETUP_ACTION_LABEL = localize2("triggerChatSetup", "Use AI Features with Copilot for free...");
      }
      constructor() {
        super({
          id: CHAT_SETUP_ACTION_ID,
          title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL,
          category: CHAT_CATEGORY,
          f1: true,
          precondition: ContextKeyExpr.or(
            ChatContextKeys.Setup.hidden,
            ChatContextKeys.Setup.disabledInWorkspace,
            ChatContextKeys.Setup.untrusted,
            ChatContextKeys.Setup.completed.negate(),
            ChatContextKeys.Entitlement.canSignUp
          )
        });
      }
      async run(accessor, mode, options) {
        const widgetService = accessor.get(IChatWidgetService);
        const instantiationService = accessor.get(IInstantiationService);
        const dialogService = accessor.get(IDialogService);
        const commandService = accessor.get(ICommandService);
        const lifecycleService = accessor.get(ILifecycleService);
        const configurationService = accessor.get(IConfigurationService);
        await context.update({ hidden: false });
        configurationService.updateValue(ChatAIDisabledSettingId, false);
        if (mode) {
          const chatWidget = await widgetService.revealWidget();
          if (chatWidget) {
            const resolvedMode = this.resolveAgentId(mode, chatWidget);
            if (resolvedMode) {
              chatWidget.input.setChatMode(resolvedMode);
            }
          }
        }
        if (options?.inputValue) {
          const chatWidget = await widgetService.revealWidget();
          chatWidget?.input.showScrollbarUntilAccept();
          chatWidget?.setInput(options.inputValue);
        }
        const setup = ChatSetup.getInstance(instantiationService, context, controller);
        const result = await setup.run(options);
        if (options?.returnResult) {
          return result;
        }
        const { success } = result;
        if (success === false && !result.errorAlreadyHandled && !lifecycleService.willShutdown) {
          const { confirmed } = await dialogService.confirm({
            type: Severity.Error,
            message: localize("setupErrorDialog", "Chat setup failed. Would you like to try again?"),
            primaryButton: localize("retry", "Retry")
          });
          if (confirmed) {
            return Boolean(await commandService.executeCommand(CHAT_SETUP_ACTION_ID, mode, options));
          }
        }
        return Boolean(success);
      }
      resolveAgentId(agentParam, chatWidget) {
        const modes = chatWidget.input.currentChatModesObs.get();
        const foundAgent = modes.findModeById(agentParam);
        if (foundAgent) {
          return foundAgent.id;
        }
        const allAgents = [...modes.builtin, ...modes.custom];
        const nameLower = agentParam.toLowerCase();
        const agentByName = allAgents.find((agent) => agent.name.get().toLowerCase() === nameLower);
        return agentByName?.id;
      }
    }
    class ChatSetupTriggerSupportAnonymousAction extends Action2 {
      constructor() {
        super({
          id: CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID,
          title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL
        });
      }
      async run(accessor, options) {
        const commandService = accessor.get(ICommandService);
        const telemetryService = accessor.get(ITelemetryService);
        const chatEntitlementService = accessor.get(IChatEntitlementService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "api" });
        return commandService.executeCommand(CHAT_SETUP_ACTION_ID, void 0, {
          forceAnonymous: chatEntitlementService.anonymous ? ChatSetupAnonymous.EnabledWithDialog : void 0,
          ...options
        });
      }
    }
    class ChatSetupTriggerForceSignInDialogAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.triggerSetupForceSignIn",
          title: localize2("forceSignIn", "Sign in to use GitHub Copilot")
        });
      }
      async run(accessor) {
        const commandService = accessor.get(ICommandService);
        const telemetryService = accessor.get(ITelemetryService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "api" });
        return commandService.executeCommand(CHAT_SETUP_ACTION_ID, void 0, { forceSignInDialog: true });
      }
    }
    class ChatSetupTriggerAnonymousWithoutDialogAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.triggerSetupAnonymousWithoutDialog",
          title: ChatSetupTriggerAction.CHAT_SETUP_ACTION_LABEL
        });
      }
      async run(accessor) {
        const commandService = accessor.get(ICommandService);
        const telemetryService = accessor.get(ITelemetryService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "api" });
        return commandService.executeCommand(CHAT_SETUP_ACTION_ID, void 0, { forceAnonymous: ChatSetupAnonymous.EnabledWithoutDialog });
      }
    }
    class ChatSetupFromAccountsAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.triggerSetupFromAccounts",
          title: localize2("triggerChatSetupFromAccounts", "Sign in to use GitHub Copilot..."),
          menu: {
            id: MenuId.AccountsContext,
            group: "2_copilot",
            when: ContextKeyExpr.and(
              ChatContextKeys.Setup.hidden.negate(),
              ChatContextKeys.Setup.disabledInWorkspace.negate(),
              CONTEXT_DEFAULT_ACCOUNT_STATE.notEqualsTo(DefaultAccountStatus.Available),
              // hide only when signed in (a default GitHub account is present); still shown while signed out or before the account state resolves, incl. untrusted workspaces — no auth prompt
              ChatContextKeys.Setup.completed.negate(),
              ChatContextKeys.Entitlement.signedOut
            )
          }
        });
      }
      async run(accessor) {
        const commandService = accessor.get(ICommandService);
        const telemetryService = accessor.get(ITelemetryService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "accounts" });
        return commandService.executeCommand(CHAT_SETUP_ACTION_ID);
      }
    }
    class ChatSetupSignInTitleBarAction extends Action2 {
      static {
        this.ID = SIGN_IN_TITLE_BAR_ACTION_ID;
      }
      constructor() {
        super({
          id: ChatSetupSignInTitleBarAction.ID,
          title: localize("signInIndicatorTitleBarAction", "Sign In"),
          f1: false,
          menu: [{
            id: MenuId.TitleBarAdjacentCenter,
            order: 0,
            when: ContextKeyExpr.and(
              IsWebContext.negate(),
              ChatContextKeys.Entitlement.signedOut,
              CONTEXT_DEFAULT_ACCOUNT_STATE.notEqualsTo(DefaultAccountStatus.Available),
              // hide only when signed in (a default GitHub account is present); still shown while signed out or before the account state resolves, incl. untrusted workspaces — no auth prompt
              ChatEntitlementContextKeys.hasByokModels.negate(),
              ChatContextKeys.Setup.hidden.negate(),
              ChatContextKeys.Setup.disabledInWorkspace.negate(),
              ContextKeyExpr.equals(`config.${ChatConfiguration.TitleBarSignInEnabled}`, true),
              InEditorZenModeContext.negate()
            )
          }]
        });
      }
      async run(accessor) {
        const commandService = accessor.get(ICommandService);
        const telemetryService = accessor.get(ITelemetryService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "titlebar" });
        return commandService.executeCommand(CHAT_SETUP_ACTION_ID);
      }
    }
    class ToggleSignInTitleBarAction extends ToggleTitleBarConfigAction {
      constructor() {
        super(
          ChatConfiguration.TitleBarSignInEnabled,
          localize("toggle.chatSignIn", "Copilot Sign In"),
          localize("toggle.chatSignInDescription", "Toggle visibility of the Copilot Sign In button in title bar"),
          3,
          ContextKeyExpr.and(
            IsWebContext.negate(),
            ChatContextKeys.Entitlement.signedOut,
            ChatContextKeys.Setup.hidden.negate(),
            ChatContextKeys.Setup.disabledInWorkspace.negate()
          )
        );
      }
    }
    const windowFocusListener = this._register(new MutableDisposable());
    class UpgradePlanAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.upgradePlan",
          title: localize2("managePlan", "Upgrade to GitHub Copilot Pro"),
          category: localize2("chat.category", "Chat"),
          f1: true,
          precondition: ContextKeyExpr.and(
            ChatContextKeys.Setup.hidden.negate(),
            ChatContextKeys.Setup.disabledInWorkspace.negate(),
            ContextKeyExpr.or(
              ChatContextKeys.Entitlement.canSignUp,
              ChatContextKeys.Entitlement.planFree
            )
          ),
          menu: {
            id: MenuId.ChatTitleBarMenu,
            group: "a_first",
            order: 1,
            when: ContextKeyExpr.and(
              ChatContextKeys.Entitlement.planFree,
              ContextKeyExpr.or(
                ChatContextKeys.chatQuotaExceeded,
                ChatContextKeys.completionsQuotaExceeded
              )
            )
          }
        });
      }
      async run(accessor) {
        const openerService = accessor.get(IOpenerService);
        const hostService = accessor.get(IHostService);
        const commandService = accessor.get(ICommandService);
        const telemetryService = accessor.get(ITelemetryService);
        const defaultAccountService = accessor.get(IDefaultAccountService);
        const productService = accessor.get(IProductService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.action.chat.upgradePlan", from: "command" });
        const baseUrl = defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotUpgrade);
        const upgradeUrl = buildUpgradeUrlWithRedirect(baseUrl, productService.urlProtocol, productService.quality);
        openerService.open(upgradeUrl);
        const entitlement = context.state.entitlement;
        if (!isProUser(entitlement)) {
          windowFocusListener.value = hostService.onDidChangeFocus((focus) => this.onWindowFocus(focus, commandService));
        }
      }
      async onWindowFocus(focus, commandService) {
        if (focus) {
          windowFocusListener.clear();
          const entitlements = await requests.forceResolveEntitlement();
          if (entitlements?.entitlement && isProUser(entitlements?.entitlement)) {
            refreshTokens(commandService);
          }
        }
      }
    }
    class ManageAdditionalSpendAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.manageAdditionalSpend",
          title: localize2("manageAdditionalSpend", "Manage GitHub Copilot Budget"),
          category: localize2("chat.category", "Chat"),
          f1: true,
          precondition: ContextKeyExpr.and(
            ChatContextKeys.Setup.hidden.negate(),
            ChatContextKeys.Setup.disabledInWorkspace.negate(),
            ContextKeyExpr.or(
              ChatContextKeys.Entitlement.planPro,
              ChatContextKeys.Entitlement.planProPlus,
              ChatContextKeys.Entitlement.planMax,
              ChatContextKeys.Entitlement.planEdu
            )
          ),
          menu: {
            id: MenuId.ChatTitleBarMenu,
            group: "a_first",
            order: 1,
            when: ContextKeyExpr.and(
              ContextKeyExpr.or(
                ChatContextKeys.Entitlement.planPro,
                ChatContextKeys.Entitlement.planProPlus,
                ChatContextKeys.Entitlement.planMax,
                ChatContextKeys.Entitlement.planEdu
              ),
              ContextKeyExpr.or(
                ChatContextKeys.chatQuotaExceeded,
                ChatContextKeys.completionsQuotaExceeded
              )
            )
          }
        });
      }
      async run(accessor) {
        const openerService = accessor.get(IOpenerService);
        const telemetryService = accessor.get(ITelemetryService);
        const defaultAccountService = accessor.get(IDefaultAccountService);
        telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.action.chat.manageAdditionalSpend", from: "command" });
        openerService.open(URI.parse(defaultAccountService.resolveGitHubUrl(GitHubPaths.billingBudgets)));
      }
    }
    registerAction2(ChatSetupTriggerAction);
    registerAction2(ChatSetupTriggerForceSignInDialogAction);
    registerAction2(ChatSetupFromAccountsAction);
    registerAction2(ChatSetupSignInTitleBarAction);
    registerAction2(ToggleSignInTitleBarAction);
    registerAction2(ChatSetupTriggerAnonymousWithoutDialogAction);
    registerAction2(ChatSetupTriggerSupportAnonymousAction);
    registerAction2(UpgradePlanAction);
    registerAction2(ManageAdditionalSpendAction);
    function registerGenerateCodeCommand(coreCommand, actualCommand) {
      CommandsRegistry.registerCommand(coreCommand, async (accessor, ...args) => {
        const commandService = accessor.get(ICommandService);
        const codeEditorService = accessor.get(ICodeEditorService);
        const markerService = accessor.get(IMarkerService);
        switch (coreCommand) {
          case "chat.internal.explain":
          case "chat.internal.fix": {
            const textEditor = codeEditorService.getActiveCodeEditor();
            const uri = textEditor?.getModel()?.uri;
            const range = textEditor?.getSelection();
            if (!uri || !range) {
              return;
            }
            const markers = AICodeActionsHelper.warningOrErrorMarkersAtRange(markerService, uri, range);
            const actualCommand2 = coreCommand === "chat.internal.explain" ? AICodeActionsHelper.explainMarkers(markers) : AICodeActionsHelper.fixMarkers(markers, range);
            await commandService.executeCommand(actualCommand2.id, ...actualCommand2.arguments ?? []);
            break;
          }
          case "chat.internal.review": {
            const result = await commandService.executeCommand(CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID);
            if (result) {
              await commandService.executeCommand(actualCommand);
            }
            break;
          }
        }
      });
    }
    registerGenerateCodeCommand("chat.internal.explain", "github.copilot.chat.explain");
    registerGenerateCodeCommand("chat.internal.fix", "github.copilot.chat.fix");
    registerGenerateCodeCommand("chat.internal.review", "github.copilot.chat.review");
    const internalGenerateCodeContext = ContextKeyExpr.and(
      ChatContextKeys.Setup.hidden.negate(),
      ChatContextKeys.Setup.disabledInWorkspace.negate(),
      ChatContextKeys.Setup.completed.negate()
    );
    MenuRegistry.appendMenuItem(MenuId.EditorContext, {
      command: {
        id: "chat.internal.explain",
        title: localize("explain", "Explain")
      },
      group: "1_chat",
      order: 4,
      when: internalGenerateCodeContext
    });
    MenuRegistry.appendMenuItem(MenuId.EditorContext, {
      command: {
        id: "chat.internal.fix",
        title: localize("fix", "Fix")
      },
      group: "1_chat",
      order: 5,
      when: ContextKeyExpr.and(
        internalGenerateCodeContext,
        EditorContextKeys.readOnly.negate()
      )
    });
    MenuRegistry.appendMenuItem(MenuId.EditorContext, {
      command: {
        id: "chat.internal.review",
        title: localize("review", "Code Review")
      },
      group: "1_chat",
      order: 6,
      when: internalGenerateCodeContext
    });
  }
  registerSignInTitleBarEntry(actionViewItemService) {
    this._register(actionViewItemService.register(
      MenuId.TitleBarAdjacentCenter,
      SIGN_IN_TITLE_BAR_ACTION_ID,
      (action, options) => new SignInTitleBarEntry(action, options)
    ));
  }
  registerUrlLinkHandler() {
    this._register(ExtensionUrlHandlerOverrideRegistry.registerHandler(this.instantiationService.createInstance(ChatSetupExtensionUrlHandler)));
  }
  async checkExtensionInstallation(context) {
    if (this.environmentService.isExtensionDevelopment) {
      await this.extensionService.whenInstalledExtensionsRegistered();
      if (this.extensionService.extensions.find((ext) => ExtensionIdentifier.equals(ext.identifier, defaultChat.chatExtensionId))) {
        context.update({ installed: true, disabled: false, untrusted: false, disabledInWorkspace: false });
        return;
      }
    }
    await this.extensionsWorkbenchService.queryLocal();
    this._register(Event.runAndSubscribe(this.extensionsWorkbenchService.onChange, (e) => {
      if (e && !ExtensionIdentifier.equals(e.identifier.id, defaultChat.chatExtensionId)) {
        return;
      }
      const defaultChatExtension = this.extensionsWorkbenchService.local.find((value) => ExtensionIdentifier.equals(value.identifier.id, defaultChat.chatExtensionId));
      const installed = !!defaultChatExtension?.local;
      let disabled;
      let untrusted = false;
      let disabledInWorkspace = false;
      if (installed) {
        disabled = !this.extensionEnablementService.isEnabled(defaultChatExtension.local);
        if (disabled) {
          const state = this.extensionEnablementService.getEnablementState(defaultChatExtension.local);
          if (state === EnablementState.DisabledByTrustRequirement) {
            disabled = false;
            untrusted = true;
          } else if (state === EnablementState.DisabledWorkspace) {
            disabledInWorkspace = true;
          }
        }
      } else {
        disabled = false;
      }
      context.update({ installed, disabled, untrusted, disabledInWorkspace });
    }));
  }
};
ChatSetupContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IChatEntitlementService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IWorkbenchExtensionEnablementService),
  __decorateParam(6, IExtensionsWorkbenchService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IEnvironmentService),
  __decorateParam(9, IChatSessionsService),
  __decorateParam(10, IConfigurationService)
], ChatSetupContribution);
let ChatSetupExtensionUrlHandler = class {
  constructor(productService, commandService, telemetryService, chatEntitlementService, chatInputNotificationService) {
    this.productService = productService;
    this.commandService = commandService;
    this.telemetryService = telemetryService;
    this.chatEntitlementService = chatEntitlementService;
    this.chatInputNotificationService = chatInputNotificationService;
  }
  static {
    this.UPGRADE_SUCCESS_NOTIFICATION_ID = "copilot.upgradeSuccess";
  }
  canHandleURL(url) {
    return url.scheme === this.productService.urlProtocol && equalsIgnoreCase(url.authority, defaultChat.chatExtensionId);
  }
  async handleURL(url) {
    if (url.path === "/upgrade-success") {
      return this._handleUpgradeSuccess();
    }
    const params = new URLSearchParams(url.query);
    this.telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "url", detail: params.get("referrer") ?? void 0 });
    const agentParam = params.get("agent") ?? params.get("mode");
    const inputParam = params.get("prompt");
    if (!agentParam && !inputParam) {
      return false;
    }
    await this.commandService.executeCommand(CHAT_SETUP_ACTION_ID, agentParam, inputParam ? { inputValue: inputParam } : void 0);
    return true;
  }
  async _handleUpgradeSuccess() {
    this.telemetryService.publicLog2("workbenchActionExecuted", { id: "workbench.action.chat.upgradePlan", from: "redirect" });
    await this.chatEntitlementService.update(CancellationToken.None);
    refreshTokens(this.commandService);
    this.chatInputNotificationService.setNotification({
      id: ChatSetupExtensionUrlHandler.UPGRADE_SUCCESS_NOTIFICATION_ID,
      severity: ChatInputNotificationSeverity.Info,
      message: localize("upgradeSuccess", "Upgrade Successful"),
      description: localize("upgradeSuccessDescription", "Please wait up to 10 minutes for your new plan to apply."),
      actions: [],
      dismissible: true,
      autoDismissOnMessage: true
    });
    return true;
  }
};
ChatSetupExtensionUrlHandler = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IChatEntitlementService),
  __decorateParam(4, IChatInputNotificationService)
], ChatSetupExtensionUrlHandler);
let ChatTeardownContribution = class extends Disposable {
  constructor(chatEntitlementService, configurationService, extensionsWorkbenchService, extensionEnablementService, viewDescriptorService, layoutService) {
    super();
    this.configurationService = configurationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.viewDescriptorService = viewDescriptorService;
    this.layoutService = layoutService;
    const context = chatEntitlementService.context?.value;
    if (!context) {
      return;
    }
    this.registerListeners();
    this.registerActions();
    this.handleChatDisabled(false);
  }
  static {
    this.ID = "workbench.contrib.chatTeardown";
  }
  handleChatDisabled(fromEvent) {
    const chatDisabled = this.configurationService.inspect(ChatAIDisabledSettingId);
    if (chatDisabled.value === true) {
      this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === "boolean" ? EnablementState.DisabledWorkspace : EnablementState.DisabledGlobally);
      if (fromEvent) {
        this.maybeHideAuxiliaryBar();
      }
    } else if (chatDisabled.value === false && fromEvent) {
      this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === "boolean" ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally);
    }
  }
  async registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(ChatAIDisabledSettingId)) {
        return;
      }
      this.handleChatDisabled(true);
    }));
    await this.extensionsWorkbenchService.queryLocal();
    this._register(this.extensionsWorkbenchService.onChange((e) => {
      if (e && !ExtensionIdentifier.equals(e.identifier.id, defaultChat.chatExtensionId)) {
        return;
      }
      const defaultChatExtension = this.extensionsWorkbenchService.local.find((value) => ExtensionIdentifier.equals(value.identifier.id, defaultChat.chatExtensionId));
      if (defaultChatExtension?.local && this.extensionEnablementService.isEnabled(defaultChatExtension.local)) {
        if (defaultChatExtension.enablementState === EnablementState.EnabledWorkspace) {
          if (this.configurationService.inspect(ChatAIDisabledSettingId).workspaceValue === true) {
            this.configurationService.updateValue(ChatAIDisabledSettingId, false, ConfigurationTarget.WORKSPACE);
          }
        } else {
          this.configurationService.updateValue(ChatAIDisabledSettingId, false);
        }
      }
    }));
  }
  async maybeEnableOrDisableExtension(state) {
    const defaultChatExtension = this.extensionsWorkbenchService.local.find((value) => ExtensionIdentifier.equals(value.identifier.id, defaultChat.chatExtensionId));
    if (!defaultChatExtension?.local) {
      return;
    }
    const workspace = state === EnablementState.EnabledWorkspace || state === EnablementState.DisabledWorkspace;
    const canChange = workspace ? this.extensionEnablementService.canChangeWorkspaceEnablement(defaultChatExtension.local) : this.extensionEnablementService.canChangeEnablement(defaultChatExtension.local);
    if (!canChange) {
      return;
    }
    await this.extensionsWorkbenchService.setEnablement([defaultChatExtension], state);
    await this.extensionsWorkbenchService.updateRunningExtensions(state === EnablementState.EnabledGlobally || state === EnablementState.EnabledWorkspace ? localize("restartExtensionHost.reason.enable", "Enabling AI features") : localize("restartExtensionHost.reason.disable", "Disabling AI features"));
  }
  maybeHideAuxiliaryBar() {
    const activeContainers = this.viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.AuxiliaryBar).filter(
      (container) => this.viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0
    );
    if (activeContainers.length === 0 || // chat view is already gone but we know it was there before
    activeContainers.length === 1 && activeContainers.at(0)?.id === ChatViewContainerId) {
      this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
    }
  }
  registerActions() {
    class ChatSetupHideAction extends Action2 {
      static {
        this.ID = "workbench.action.chat.hideSetup";
      }
      static {
        this.TITLE = localize2("hideChatSetup", "Learn How to Hide AI Features");
      }
      constructor() {
        super({
          id: ChatSetupHideAction.ID,
          title: ChatSetupHideAction.TITLE,
          f1: true,
          category: CHAT_CATEGORY,
          precondition: ContextKeyExpr.and(ChatContextKeys.Setup.hidden.negate(), ChatContextKeys.Setup.disabledInWorkspace.negate()),
          menu: {
            id: MenuId.ChatTitleBarMenu,
            group: "z_hide",
            order: 1,
            when: ChatContextKeys.Setup.completed.negate()
          }
        });
      }
      async run(accessor) {
        const preferencesService = accessor.get(IPreferencesService);
        preferencesService.openSettings({ jsonEditor: false, query: `@id:${ChatAIDisabledSettingId}` });
      }
    }
    registerAction2(ChatSetupHideAction);
  }
};
ChatTeardownContribution = __decorateClass([
  __decorateParam(0, IChatEntitlementService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IWorkbenchExtensionEnablementService),
  __decorateParam(4, IViewDescriptorService),
  __decorateParam(5, IWorkbenchLayoutService)
], ChatTeardownContribution);
class SignInTitleBarEntry extends BaseActionViewItem {
  constructor(action, options) {
    super(void 0, action, options);
  }
  render(container) {
    super.render(container);
    container.setAttribute("role", "button");
    container.setAttribute("aria-label", this.action.label);
    const content = dom.append(container, dom.$(".update-indicator.prominent"));
    this.label = dom.append(content, dom.$(".indicator-label"));
    this.label.textContent = this.action.label;
  }
  updateLabel() {
    if (this.label) {
      this.label.textContent = this.action.label;
    }
    if (this.element) {
      this.element.setAttribute("aria-label", this.action.label);
    }
  }
  updateEnabled() {
    if (this.element) {
      this.element.classList.toggle("disabled", !this.action.enabled);
    }
  }
}
export {
  ChatSetupContribution,
  ChatTeardownContribution
};
