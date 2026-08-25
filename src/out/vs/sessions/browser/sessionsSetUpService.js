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
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../base/common/lifecycle.js";
import { runOnChange } from "../../base/common/observable.js";
import { DeferredPromise, disposableTimeout } from "../../base/common/async.js";
import { createDecorator, IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../platform/storage/common/storage.js";
import { IUserDataProfileStorageService } from "../../platform/userDataProfile/common/userDataProfileStorageService.js";
import { IUserDataProfilesService } from "../../platform/userDataProfile/common/userDataProfile.js";
import { ServiceCollection } from "../../platform/instantiation/common/serviceCollection.js";
import { ChatEntitlementContext, IChatEntitlementService } from "../../workbench/services/chat/common/chatEntitlementService.js";
import { isWeb } from "../../base/common/platform.js";
import { GitHubPaths, IDefaultAccountService } from "../../platform/defaultAccount/common/defaultAccount.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { IContextKeyService } from "../../platform/contextkey/common/contextkey.js";
import { IWorkbenchEnvironmentService } from "../../workbench/services/environment/common/environmentService.js";
import { IAuthenticationService } from "../../workbench/services/authentication/common/authentication.js";
import { ICommandService } from "../../platform/commands/common/commands.js";
import { IWorkbenchLayoutService } from "../../workbench/services/layout/browser/layoutService.js";
import { IKeybindingService } from "../../platform/keybinding/common/keybinding.js";
import { IHostService } from "../../workbench/services/host/browser/host.js";
import { IMarkdownRendererService } from "../../platform/markdown/browser/markdownRenderer.js";
import { WELCOME_COMPLETE_KEY } from "../common/welcome.js";
import { SessionsWelcomeVisibleContext } from "../common/contextkeys.js";
import { ISessionsManagementService } from "../services/sessions/common/sessionsManagement.js";
import { ConditionalAuthState, conditionalAuthState, observeUsableWithoutGitHub } from "./sessionsAuthGate.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { Codicon } from "../../base/common/codicons.js";
import { $, append } from "../../base/browser/dom.js";
import { Dialog, DialogContentsAlignment } from "../../base/browser/ui/dialog/dialog.js";
import { createWorkbenchDialogOptions } from "../../workbench/browser/parts/dialogs/dialog.js";
import { MarkdownString } from "../../base/common/htmlContent.js";
import { localize } from "../../nls.js";
import { createSessionsSignInDialogOptions, SessionsSigningInDialog } from "./sessionsSignInDialog.js";
import { SHOULD_SHOW_RETURN_TO_VSCODE_EDITOR_COMMAND_ID } from "../common/sessionCommands.js";
const AIDisabledConfig = "chat.disableAIFeatures";
const ISessionsSetUpService = createDecorator("sessionsSetUpService");
function shouldSkipSessionsWelcome(environmentService) {
  if (environmentService.enableSmokeTestDriver) {
    return true;
  }
  const envArgs = environmentService.args;
  if (envArgs?.["skip-sessions-welcome"]) {
    return true;
  }
  return typeof globalThis.location !== "undefined" && new URLSearchParams(globalThis.location.search).has("skip-sessions-welcome");
}
let SessionsSetUpWidget = class extends Disposable {
  // Non-service params must come before @-decorated service params
  constructor(onCompleted, serviceWhenSetupDone, serviceMarkDone, onInitialSignInDialogShown, defaultAccountService, productService, storageService, contextKeyService, environmentService, authenticationService, logService, commandService, configurationService, layoutService, keybindingService, hostService, markdownRendererService, sessionsManagementService, instantiationService) {
    super();
    this.onCompleted = onCompleted;
    this.serviceWhenSetupDone = serviceWhenSetupDone;
    this.serviceMarkDone = serviceMarkDone;
    this.onInitialSignInDialogShown = onInitialSignInDialogShown;
    this.defaultAccountService = defaultAccountService;
    this.productService = productService;
    this.storageService = storageService;
    this.contextKeyService = contextKeyService;
    this.environmentService = environmentService;
    this.authenticationService = authenticationService;
    this.logService = logService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.keybindingService = keybindingService;
    this.hostService = hostService;
    this.markdownRendererService = markdownRendererService;
    this.sessionsManagementService = sessionsManagementService;
    this.instantiationService = instantiationService;
    this.dialogRef = this._register(new MutableDisposable());
    this.watcherRef = this._register(new MutableDisposable());
    this._initialSetupFlow = true;
    /** True while the window is open for a signed-out user via the conditional-auth opt-in. */
    this._proceedingSignedOut = false;
    /**
     * Set once the initial default-account resolution has completed. Until then
     * the synchronous {@link IDefaultAccountService.currentDefaultAccount} snapshot
     * is `null` even for a signed-in user, so a `null` reading means "not known
     * yet", not "signed out". The conditional-auth reaction stays inert until this
     * flips, otherwise it forces a sign-in modal on a signed-in user during the
     * startup gap — one nothing can retire, since the account resolves silently.
     */
    this._accountResolved = false;
    this._usableWithoutGitHub = observeUsableWithoutGitHub(this.sessionsManagementService, this.configurationService);
    this._register(runOnChange(this._usableWithoutGitHub, (usable) => this._onUsableWithoutGitHubChanged(usable)));
    this._start();
  }
  /**
   * The last-resort gate's answer changed while the window is open. Ignored
   * until the account has resolved (see {@link _accountResolved}) and for
   * signed-in users. For a signed-out user, becoming usable retires an
   * already-open sign-in modal (it was raised before the answer resolved);
   * becoming unusable falls back to demanding sign-in.
   */
  _onUsableWithoutGitHubChanged(usable) {
    const signedIn = this.defaultAccountService.currentDefaultAccount !== null;
    if (conditionalAuthState(this._accountResolved, signedIn) !== ConditionalAuthState.SignedOut) {
      return;
    }
    if (!usable) {
      this._proceedingSignedOut = false;
      void this._showWelcome(false);
      return;
    }
    this.dialogRef.clear();
    void this._proceedWithoutGitHub();
  }
  _start() {
    if (!this.productService.defaultChatAgent?.chatExtensionId) {
      this.onCompleted();
      return;
    }
    if (shouldSkipSessionsWelcome(this.environmentService)) {
      this.onCompleted();
      return;
    }
    this.defaultAccountService.getDefaultAccount().then(() => {
      if (this._store.isDisposed) {
        return;
      }
      this._accountResolved = true;
      if (this._usableWithoutGitHub.get()) {
        this._onUsableWithoutGitHubChanged(true);
      }
    });
    if (isWeb) {
      void this._checkWebAuth().finally(() => this._initialSetupFlow = false);
      this._watchWebAuth();
      return;
    }
    const isFirstLaunch = !this.storageService.getBoolean(WELCOME_COMPLETE_KEY, StorageScope.APPLICATION, false);
    if (isFirstLaunch) {
      void this._showWelcome(true).finally(() => this._initialSetupFlow = false);
    } else {
      void this._watchSignInState().finally(() => this._initialSetupFlow = false);
    }
  }
  async _checkWebAuth() {
    try {
      const sessions = await this.authenticationService.getSessions("github");
      if (sessions.length > 0) {
        this.logService.info("[sessions welcome] GitHub session found on web, skipping welcome");
        this.storageService.store(WELCOME_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
        this.onCompleted();
        return;
      }
    } catch {
    }
    this._showWelcome(false);
  }
  _watchWebAuth() {
    this._register(this.authenticationService.onDidChangeSessions(async (e) => {
      if (e.providerId !== "github" || !e.event.removed?.length) {
        return;
      }
      try {
        const remaining = await this.authenticationService.getSessions("github");
        if (remaining.length > 0) {
          return;
        }
      } catch {
      }
      this.logService.info("[sessions welcome] GitHub session removed on web, re-showing welcome");
      this.storageService.remove(WELCOME_COMPLETE_KEY, StorageScope.APPLICATION);
      this._showWelcome(false);
    }));
  }
  async _watchSignInState() {
    const initialAccount = await this.defaultAccountService.getDefaultAccount();
    if (this.dialogRef.value) {
      return;
    }
    if (!initialAccount) {
      this._showWelcome(false);
      return;
    }
    await this._ensureAIFeaturesEnabled();
    this.onCompleted();
    this.watcherRef.value = this._watchActiveState(true);
  }
  _watchActiveState(signedIn) {
    const disposables = new DisposableStore();
    disposables.add(this.defaultAccountService.onDidChangeDefaultAccount((account) => {
      const nowSignedIn = account !== null;
      if (signedIn && !nowSignedIn) {
        this.storageService.remove(WELCOME_COMPLETE_KEY, StorageScope.APPLICATION);
        this._reevaluateSignedOut();
      } else if (!signedIn && nowSignedIn) {
        this._proceedingSignedOut = false;
      }
      signedIn = nowSignedIn;
    }));
    disposables.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AIDisabledConfig)) {
        if (this.configurationService.getValue(AIDisabledConfig)) {
          this._showAIDisabledDialog();
        } else {
          this.dialogRef.clear();
        }
      }
    }));
    return disposables;
  }
  /**
   * The **window gate**: whether the Agents window must fall back to forcing
   * GitHub sign-in before showing any of the sessions UI. Every caller is on a
   * signed-out path, so this is simply the inverse of "can work without GitHub"
   * — always true while the opt-in is off, which is today's mandatory-sign-in
   * behavior.
   *
   * Deliberately a *last resort*, not the primary gate. The moment any session
   * type is usable without GitHub the window opens, and per-type on-demand
   * sign-in carries the rest — so this never blocks a user who has their own
   * credentials. See `sessionsAuthGate.ts` for the window-gate vs per-type-gate
   * distinction.
   */
  _mustForceGitHubSignIn() {
    return !this._usableWithoutGitHub.get();
  }
  /**
   * Re-run the signed-out decision after an input change: force GitHub sign-in
   * when the gate demands it, otherwise open the window without GitHub. A no-op
   * while a dialog is up — that dialog owns the next transition.
   */
  _reevaluateSignedOut() {
    if (this.dialogRef.value) {
      return;
    }
    if (this._mustForceGitHubSignIn()) {
      this._proceedingSignedOut = false;
      void this._showWelcome(false);
    } else {
      void this._proceedWithoutGitHub();
    }
  }
  /**
   * Open the Agents window for a signed-out user because at least one session
   * type is usable without GitHub. Mirrors the signed-in completion path, but
   * keeps watching so a later change (a usable type disappears, or the user
   * signs in) re-drives the decision. Idempotent while already proceeding.
   */
  async _proceedWithoutGitHub() {
    if (this._proceedingSignedOut) {
      return;
    }
    this._proceedingSignedOut = true;
    this.logService.info("[sessions welcome] Proceeding without GitHub sign-in; a session type is usable while signed out");
    await this._ensureAIFeaturesEnabled();
    if (this._store.isDisposed) {
      return;
    }
    this.onCompleted();
    this.watcherRef.value = this._watchActiveState(false);
  }
  async _ensureAIFeaturesEnabled() {
    if (this.configurationService.getValue(AIDisabledConfig)) {
      this.logService.info("[sessions welcome] AI features disabled, enabling");
      await this.configurationService.updateValue(AIDisabledConfig, false);
    }
  }
  async _showAIDisabledDialog() {
    if (this.dialogRef.value) {
      return;
    }
    this.logService.info("[sessions welcome] AI features disabled, showing enable dialog");
    const disposables = new DisposableStore();
    this.dialogRef.value = disposables;
    const welcomeVisibleKey = SessionsWelcomeVisibleContext.bindTo(this.contextKeyService);
    welcomeVisibleKey.set(true);
    disposables.add(toDisposable(() => welcomeVisibleKey.reset()));
    const dialog = disposables.add(new Dialog(
      this.layoutService.activeContainer,
      "",
      [localize("sessions.aiDisabled.enable", "Enable AI Features")],
      createWorkbenchDialogOptions({
        type: "none",
        extraClasses: ["chat-setup-dialog", "sessions-welcome-dialog"],
        detail: localize("sessions.aiDisabled.detail", "Enable AI features to continue using Agents."),
        icon: Codicon.agent,
        alignment: DialogContentsAlignment.Vertical,
        cancelId: 1,
        disableCloseButton: true,
        disableCloseAction: true
      }, this.keybindingService, this.layoutService, this.hostService)
    ));
    const { button } = await dialog.show();
    disposables.dispose();
    this.dialogRef.clear();
    if (button === 0) {
      this.logService.info("[sessions welcome] User chose to enable AI features");
      await this.configurationService.updateValue(AIDisabledConfig, false);
    }
  }
  async _showWelcome(isFirstLaunch) {
    if (this.dialogRef.value) {
      return;
    }
    if (!isFirstLaunch && !this._mustForceGitHubSignIn()) {
      await this._proceedWithoutGitHub();
      return;
    }
    this.watcherRef.clear();
    this.dialogRef.value = new DisposableStore();
    const welcomeVisibleKey = SessionsWelcomeVisibleContext.bindTo(this.contextKeyService);
    welcomeVisibleKey.set(true);
    this.dialogRef.value.add(toDisposable(() => welcomeVisibleKey.reset()));
    if (isFirstLaunch) {
      const overlay = this._showLoadingOverlay();
      this.dialogRef.value.add(overlay);
      const account = await this.defaultAccountService.getDefaultAccount();
      if (this._store.isDisposed) {
        return;
      }
      overlay.element.classList.add("sessions-loading-dismissed");
      this.dialogRef.value.add(disposableTimeout(() => overlay.element.remove(), 200));
      if (account) {
        const setupDone = await this.serviceWhenSetupDone();
        if (this._store.isDisposed) {
          return;
        }
        if (setupDone) {
          this.storageService.store(WELCOME_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
          this.dialogRef.clear();
          this._watchSignInState();
          return;
        }
        await this._showWelcomeDialog();
      } else if (this._mustForceGitHubSignIn()) {
        await this._showSignInDialog();
      } else {
        this.dialogRef.clear();
        await this._proceedWithoutGitHub();
        return;
      }
    } else {
      await this._showSignInDialog();
    }
    this.dialogRef.clear();
    await this._ensureAIFeaturesEnabled();
    this._watchSignInState();
  }
  _showLoadingOverlay() {
    const overlay = append(this.layoutService.mainContainer, $("div.sessions-loading-overlay"));
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-busy", "true");
    overlay.setAttribute("aria-label", localize("loading", "Loading"));
    append(overlay, $("div.sessions-loading-icon.codicon.codicon-agent"));
    return { element: overlay, dispose: () => overlay.remove() };
  }
  async _showSignInDialog() {
    if (this._initialSetupFlow) {
      this.onInitialSignInDialogShown();
    }
    this.logService.info("[sessions welcome] Showing sign-in dialog");
    while (true) {
      const attemptDisposables = new DisposableStore();
      const signingInDialogRef = attemptDisposables.add(new MutableDisposable());
      let canceled = false;
      const showReturnToVSCodeEditor = !isWeb && await this.commandService.executeCommand(SHOULD_SHOW_RETURN_TO_VSCODE_EDITOR_COMMAND_ID) === true;
      let success;
      try {
        success = await this.commandService.executeCommand("workbench.action.chat.triggerSetup", void 0, {
          ...createSessionsSignInDialogOptions(this.commandService, showReturnToVSCodeEditor),
          onSignInStarted: (cancel) => {
            signingInDialogRef.value = this.instantiationService.createInstance(SessionsSigningInDialog, () => {
              canceled = true;
              cancel();
            });
          }
        });
      } finally {
        attemptDisposables.dispose();
      }
      if (canceled) {
        this.logService.info("[sessions welcome] Sign-in canceled; returning to sign-in dialog");
        continue;
      }
      if (success) {
        this.logService.info("[sessions welcome] Sign-in completed successfully");
        this.storageService.store(WELCOME_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
        this.serviceMarkDone();
      } else {
        this.logService.info("[sessions welcome] Sign-in was canceled or failed");
      }
      return;
    }
  }
  async _showWelcomeDialog() {
    this.logService.info("[sessions welcome] Showing welcome dialog");
    const disposables = new DisposableStore();
    const productName = localize("walkthrough.productName", "{0} - Agents", this.productService.nameLong);
    const dialog = disposables.add(new Dialog(
      this.layoutService.activeContainer,
      localize("sessions.welcome.title", "Welcome to {0}", productName),
      [localize("sessions.welcome.getStarted", "Get Started")],
      createWorkbenchDialogOptions({
        type: "none",
        extraClasses: ["chat-setup-dialog", "sessions-welcome-dialog", "sessions-main-welcome-dialog"],
        detail: localize("sessions.welcome.detail", "Your AI-powered coding experience where agents explore, build, and iterate with you."),
        icon: Codicon.agent,
        alignment: DialogContentsAlignment.Vertical,
        cancelId: 1,
        disableCloseButton: true,
        renderFooter: (footer) => footer.appendChild(this._createWelcomeFooter(disposables))
      }, this.keybindingService, this.layoutService, this.hostService)
    ));
    await dialog.show();
    disposables.dispose();
    this.storageService.store(WELCOME_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    this.serviceMarkDone();
  }
  _createWelcomeFooter(disposables) {
    const element = $(".chat-setup-dialog-footer");
    const defaultChatAgent = this.productService.defaultChatAgent;
    const providerName = defaultChatAgent?.provider?.default?.name ?? "GitHub";
    const termsUrl = defaultChatAgent?.termsStatementUrl ?? "";
    const privacyUrl = defaultChatAgent?.privacyStatementUrl ?? "";
    const publicCodeUrl = defaultChatAgent?.publicCodeMatchesUrl ?? "";
    const settingsUrl = this.defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotSettings);
    const footer = localize(
      { key: "welcomeFooter", comment: ['{Locked="["}', '{Locked="]({1})"}', '{Locked="]({2})"}', '{Locked="]({4})"}', '{Locked="]({5})"}'] },
      "By continuing, you agree to {0}'s [Terms]({1}) and [Privacy Statement]({2}). {3} Copilot may show [public code]({4}) suggestions and use your data to improve the product. You can change these [settings]({5}) anytime.",
      providerName,
      termsUrl,
      privacyUrl,
      providerName,
      publicCodeUrl,
      settingsUrl
    );
    element.appendChild($("p", void 0, disposables.add(this.markdownRendererService.render(new MarkdownString(footer, { isTrusted: true }))).element));
    return element;
  }
};
SessionsSetUpWidget = __decorateClass([
  __decorateParam(4, IDefaultAccountService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IWorkbenchEnvironmentService),
  __decorateParam(9, IAuthenticationService),
  __decorateParam(10, ILogService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IWorkbenchLayoutService),
  __decorateParam(14, IKeybindingService),
  __decorateParam(15, IHostService),
  __decorateParam(16, IMarkdownRendererService),
  __decorateParam(17, ISessionsManagementService),
  __decorateParam(18, IInstantiationService)
], SessionsSetUpWidget);
let SessionsSetUpService = class extends Disposable {
  constructor(instantiationService, userDataProfileStorageService, userDataProfilesService, chatEntitlementService, logService) {
    super();
    this.instantiationService = instantiationService;
    this.userDataProfileStorageService = userDataProfileStorageService;
    this.userDataProfilesService = userDataProfilesService;
    this.chatEntitlementService = chatEntitlementService;
    this.logService = logService;
    this._welcomeDoneDeferred = new DeferredPromise();
    this._initialSignInDialogShown = false;
    this._initPromise = this.initialize();
    this._register(this.instantiationService.createInstance(
      SessionsSetUpWidget,
      () => this._welcomeDoneDeferred.complete(),
      () => this.whenSetupDone(),
      () => this.markDone(),
      () => this._initialSignInDialogShown = true
    ));
  }
  get initialSignInDialogShown() {
    return this._initialSignInDialogShown;
  }
  async whenSetupDone() {
    await this._initPromise;
    return this.chatEntitlementService.sentiment.completed === true;
  }
  markDone() {
    this.chatEntitlementService.markSetupCompleted();
  }
  whenWelcomeDone() {
    return this._welcomeDoneDeferred.p;
  }
  async initialize() {
    if (this.chatEntitlementService.sentiment.completed) {
      return;
    }
    try {
      const defaultProfile = this.userDataProfilesService.defaultProfile;
      await this.userDataProfileStorageService.withProfileScopedStorageService(defaultProfile, async (storageService) => {
        const defaultContext = this.instantiationService.createChild(new ServiceCollection([IStorageService, storageService])).createInstance(ChatEntitlementContext);
        try {
          if (defaultContext.state.completed) {
            this.logService.info("[sessions welcome] Setup already completed in default profile, marking done locally");
            this.markDone();
          }
        } finally {
          defaultContext.dispose();
        }
      });
    } catch (error) {
      this.logService.error("[sessions welcome] Failed to read setup state from default profile:", error);
    }
  }
};
SessionsSetUpService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IUserDataProfileStorageService),
  __decorateParam(2, IUserDataProfilesService),
  __decorateParam(3, IChatEntitlementService),
  __decorateParam(4, ILogService)
], SessionsSetUpService);
export {
  ISessionsSetUpService,
  SessionsSetUpService
};
