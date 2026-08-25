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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import * as nls from "../../../nls.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { getDynamicAuthenticationProviderId, IAuthenticationService, IAuthenticationExtensionsService, isAuthenticationWwwAuthenticateRequest } from "../../services/authentication/common/authentication.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../base/common/severity.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { ActivationKind, IExtensionService } from "../../services/extensions/common/extensions.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { Emitter } from "../../../base/common/event.js";
import { IAuthenticationAccessService } from "../../services/authentication/browser/authenticationAccessService.js";
import { IAuthenticationUsageService } from "../../services/authentication/browser/authenticationUsageService.js";
import { getAuthenticationProviderActivationEvent } from "../../services/authentication/browser/authenticationService.js";
import { URI } from "../../../base/common/uri.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { CancellationError } from "../../../base/common/errors.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ExtensionHostKind } from "../../services/extensions/common/extensionHostKind.js";
import { IURLService } from "../../../platform/url/common/url.js";
import { DeferredPromise, raceTimeout } from "../../../base/common/async.js";
import { fetchAuthorizationServerMetadata } from "../../../base/common/oauth.js";
import { IDynamicAuthenticationProviderStorageService } from "../../services/authentication/common/dynamicAuthenticationProviderStorage.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { ISecretStorageService } from "../../../platform/secrets/common/secrets.js";
import { mcpOAuthClientSecretStorageKey } from "../../contrib/mcp/common/mcpTypes.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { mcpEnterpriseManagedAuthIdpSection } from "../../contrib/mcp/common/mcpConfiguration.js";
class MainThreadAuthenticationProvider extends Disposable {
  constructor(_proxy, id, label, supportsMultipleAccounts, authorizationServers, resourceServer, onDidChangeSessionsEmitter) {
    super();
    this._proxy = _proxy;
    this.id = id;
    this.label = label;
    this.supportsMultipleAccounts = supportsMultipleAccounts;
    this.authorizationServers = authorizationServers;
    this.resourceServer = resourceServer;
    this.onDidChangeSessions = onDidChangeSessionsEmitter.event;
  }
  async getSessions(scopes, options) {
    return this._proxy.$getSessions(this.id, scopes, options);
  }
  createSession(scopes, options) {
    return this._proxy.$createSession(this.id, scopes, options);
  }
  async removeSession(sessionId) {
    await this._proxy.$removeSession(this.id, sessionId);
  }
}
class MainThreadAuthenticationProviderWithChallenges extends MainThreadAuthenticationProvider {
  constructor(proxy, id, label, supportsMultipleAccounts, authorizationServers, resourceServer, onDidChangeSessionsEmitter) {
    super(
      proxy,
      id,
      label,
      supportsMultipleAccounts,
      authorizationServers,
      resourceServer,
      onDidChangeSessionsEmitter
    );
  }
  getSessionsFromChallenges(constraint, options) {
    return this._proxy.$getSessionsFromChallenges(this.id, constraint, options);
  }
  createSessionFromChallenges(constraint, options) {
    return this._proxy.$createSessionFromChallenges(this.id, constraint, options);
  }
}
let MainThreadAuthentication = class extends Disposable {
  constructor(extHostContext, productService, authenticationService, authenticationExtensionsService, authenticationAccessService, authenticationUsageService, dialogService, notificationService, extensionService, telemetryService, openerService, logService, urlService, dynamicAuthProviderStorageService, clipboardService, quickInputService, configurationService, secretStorageService) {
    super();
    this.productService = productService;
    this.authenticationService = authenticationService;
    this.authenticationExtensionsService = authenticationExtensionsService;
    this.authenticationAccessService = authenticationAccessService;
    this.authenticationUsageService = authenticationUsageService;
    this.dialogService = dialogService;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.telemetryService = telemetryService;
    this.openerService = openerService;
    this.logService = logService;
    this.urlService = urlService;
    this.dynamicAuthProviderStorageService = dynamicAuthProviderStorageService;
    this.clipboardService = clipboardService;
    this.quickInputService = quickInputService;
    this.configurationService = configurationService;
    this.secretStorageService = secretStorageService;
    this._registrations = this._register(new DisposableMap());
    this._sentProviderUsageEvents = /* @__PURE__ */ new Set();
    this._suppressUnregisterEvent = false;
    // TODO@TylerLeonhardt this is a temporary addition to telemetry to understand what extensions are overriding the client id.
    // We can use this telemetry to reach out to these extension authors and let them know that they many need configuration changes
    // due to the adoption of the Microsoft broker.
    // Remove this in a few iterations.
    this._sentClientIdUsageEvents = /* @__PURE__ */ new Set();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostAuthentication);
    this._register(this.authenticationService.onDidChangeSessions((e) => this._proxy.$onDidChangeAuthenticationSessions(e.providerId, e.label)));
    this._register(this.authenticationService.onDidUnregisterAuthenticationProvider((e) => {
      if (!this._suppressUnregisterEvent) {
        this._proxy.$onDidUnregisterAuthenticationProvider(e.id);
      }
    }));
    this._register(this.authenticationExtensionsService.onDidChangeAccountPreference((e) => {
      const providerInfo = this.authenticationService.getProvider(e.providerId);
      this._proxy.$onDidChangeAuthenticationSessions(providerInfo.id, providerInfo.label, e.extensionIds);
    }));
    this._register(this.dynamicAuthProviderStorageService.onDidChangeTokens((e) => {
      this._proxy.$onDidChangeDynamicAuthProviderTokens(e.authProviderId, e.clientId, e.tokens);
    }));
    this._register(authenticationService.registerAuthenticationProviderHostDelegate({
      // Prefer Node.js extension hosts when they're available. No CORS issues etc.
      priority: extHostContext.extensionHostKind === ExtensionHostKind.LocalWebWorker ? 0 : 1,
      create: async (authorizationServer, serverMetadata, resource, overrideClientId, overrideClientSecret) => {
        const authProviderId = getDynamicAuthenticationProviderId(authorizationServer, resource);
        const clientDetails = await this.dynamicAuthProviderStorageService.getClientRegistration(authProviderId);
        let clientId = overrideClientId ?? clientDetails?.clientId;
        const clientSecret = overrideClientId ? overrideClientSecret : overrideClientSecret ?? clientDetails?.clientSecret;
        let initialTokens = void 0;
        if (clientId) {
          initialTokens = await this.dynamicAuthProviderStorageService.getSessionsForDynamicAuthProvider(authProviderId, clientId);
        } else if (serverMetadata.client_id_metadata_document_supported) {
          clientId = this.productService.authClientIdMetadataUrl;
        }
        return await this._proxy.$registerDynamicAuthProvider(
          authorizationServer,
          serverMetadata,
          resource,
          clientId,
          clientSecret,
          initialTokens
        );
      },
      createXaa: async (issuer) => {
        const authProviderId = `xaa:${issuer.toString(true)}`;
        const { metadata: serverMetadata } = await fetchAuthorizationServerMetadata(issuer.toString(true));
        const configuredIdp = this.configurationService.getValue(mcpEnterpriseManagedAuthIdpSection) ?? {};
        const configuredClientId = configuredIdp.clientId?.trim() || void 0;
        const configuredClientSecret = configuredIdp.clientSecret?.trim() || void 0;
        const cached = await this.dynamicAuthProviderStorageService.getClientRegistration(authProviderId);
        const clientId = configuredClientId ?? cached?.clientId;
        const clientSecret = configuredClientSecret ?? cached?.clientSecret;
        let initialTokens = void 0;
        if (clientId) {
          initialTokens = await this.dynamicAuthProviderStorageService.getSessionsForDynamicAuthProvider(authProviderId, clientId);
        }
        return await this._proxy.$registerXaaAuthProvider(
          issuer,
          serverMetadata,
          clientId,
          clientSecret,
          initialTokens
        );
      }
    }));
  }
  async $registerAuthenticationProvider({ id, label, supportsMultipleAccounts, resourceServer, supportedAuthorizationServers, supportsChallenges }) {
    if (!this.authenticationService.declaredProviders.find((p) => p.id === id)) {
      this.logService.warn(`Authentication provider ${id} was not declared in the Extension Manifest.`);
      this.telemetryService.publicLog2("authentication.providerNotDeclared", { id });
    }
    const emitter = new Emitter();
    this._registrations.set(id, emitter);
    const supportedAuthorizationServerUris = (supportedAuthorizationServers ?? []).map((i) => URI.revive(i));
    const provider = supportsChallenges ? new MainThreadAuthenticationProviderWithChallenges(
      this._proxy,
      id,
      label,
      supportsMultipleAccounts,
      supportedAuthorizationServerUris,
      resourceServer ? URI.revive(resourceServer) : void 0,
      emitter
    ) : new MainThreadAuthenticationProvider(
      this._proxy,
      id,
      label,
      supportsMultipleAccounts,
      supportedAuthorizationServerUris,
      resourceServer ? URI.revive(resourceServer) : void 0,
      emitter
    );
    this.authenticationService.registerAuthenticationProvider(id, provider);
  }
  async $unregisterAuthenticationProvider(id) {
    this._registrations.deleteAndDispose(id);
    this._suppressUnregisterEvent = true;
    try {
      this.authenticationService.unregisterAuthenticationProvider(id);
    } finally {
      this._suppressUnregisterEvent = false;
    }
  }
  async $ensureProvider(id) {
    if (!this.authenticationService.isAuthenticationProviderRegistered(id)) {
      return await this.extensionService.activateByEvent(getAuthenticationProviderActivationEvent(id), ActivationKind.Immediate);
    }
  }
  async $sendDidChangeSessions(providerId, event) {
    const obj = this._registrations.get(providerId);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  $removeSession(providerId, sessionId) {
    return this.authenticationService.removeSession(providerId, sessionId);
  }
  async $waitForUriHandler(expectedUri) {
    const deferredPromise = new DeferredPromise();
    const disposable = this.urlService.registerHandler({
      handleURL: async (uri) => {
        if (uri.scheme !== expectedUri.scheme || uri.authority !== expectedUri.authority || uri.path !== expectedUri.path) {
          return false;
        }
        deferredPromise.complete(uri);
        disposable.dispose();
        return true;
      }
    });
    const result = await raceTimeout(deferredPromise.p, 5 * 60 * 1e3);
    if (!result) {
      throw new Error("Timed out waiting for URI handler");
    }
    return await deferredPromise.p;
  }
  $showContinueNotification(message) {
    const yes = nls.localize("yes", "Yes");
    const no = nls.localize("no", "No");
    const deferredPromise = new DeferredPromise();
    let result = false;
    const handle = this.notificationService.prompt(
      Severity.Warning,
      message,
      [{
        label: yes,
        run: () => result = true
      }, {
        label: no,
        run: () => result = false
      }]
    );
    const disposable = handle.onDidClose(() => {
      deferredPromise.complete(result);
      disposable.dispose();
    });
    return deferredPromise.p;
  }
  async $registerDynamicAuthenticationProvider(details) {
    await this.$registerAuthenticationProvider({
      id: details.id,
      label: details.label,
      supportsMultipleAccounts: true,
      supportedAuthorizationServers: [details.authorizationServer],
      resourceServer: details.resourceServer
    });
    await this.dynamicAuthProviderStorageService.storeClientRegistration(details.id, URI.revive(details.authorizationServer).toString(true), details.clientId, details.clientSecret, details.label);
  }
  async $setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions) {
    await this.dynamicAuthProviderStorageService.setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions);
  }
  async $sendDidChangeDynamicProviderInfo({ providerId, clientId, authorizationServer, label, clientSecret }) {
    this.logService.info(`Client ID for authentication provider ${providerId} changed to ${clientId}`);
    const existing = this.dynamicAuthProviderStorageService.getInteractedProviders().find((p) => p.providerId === providerId);
    if (!existing) {
      throw new Error(`Dynamic authentication provider ${providerId} not found. Has it been registered?`);
    }
    await this.dynamicAuthProviderStorageService.storeClientRegistration(
      providerId || existing.providerId,
      authorizationServer ? URI.revive(authorizationServer).toString(true) : existing.authorizationServer,
      clientId || existing.clientId,
      clientSecret,
      label || existing.label
    );
  }
  async loginPrompt(provider, extensionName, recreatingSession, options) {
    let message;
    const customMessage = provider.confirmation?.(extensionName, recreatingSession);
    if (customMessage) {
      message = customMessage;
    } else {
      message = recreatingSession ? nls.localize("confirmRelogin", "The extension '{0}' wants you to sign in again using {1}.", extensionName, provider.label) : nls.localize("confirmLogin", "The extension '{0}' wants to sign in using {1}.", extensionName, provider.label);
    }
    const buttons = [
      {
        label: nls.localize({ key: "allow", comment: ["&& denotes a mnemonic"] }, "&&Allow"),
        run() {
          return true;
        }
      }
    ];
    if (options?.learnMore) {
      buttons.push({
        label: nls.localize("learnMore", "Learn more"),
        run: async () => {
          const result2 = this.loginPrompt(provider, extensionName, recreatingSession, options);
          await this.openerService.open(URI.revive(options.learnMore), { allowCommands: true });
          return await result2;
        }
      });
    }
    const { result } = await this.dialogService.prompt({
      type: Severity.Info,
      message,
      buttons,
      detail: options?.detail,
      cancelButton: true
    });
    return result ?? false;
  }
  async continueWithIncorrectAccountPrompt(chosenAccountLabel, requestedAccountLabel) {
    const result = await this.dialogService.prompt({
      message: nls.localize("incorrectAccount", "Incorrect account detected"),
      detail: nls.localize("incorrectAccountDetail", "The chosen account, {0}, does not match the requested account, {1}.", chosenAccountLabel, requestedAccountLabel),
      type: Severity.Warning,
      cancelButton: true,
      buttons: [
        {
          label: nls.localize("keep", "Keep {0}", chosenAccountLabel),
          run: () => chosenAccountLabel
        },
        {
          label: nls.localize("loginWith", "Login with {0}", requestedAccountLabel),
          run: () => requestedAccountLabel
        }
      ]
    });
    if (!result.result) {
      throw new CancellationError();
    }
    return result.result === chosenAccountLabel;
  }
  async doGetSession(providerId, scopeListOrRequest, extensionId, extensionName, options) {
    const authorizationServer = URI.revive(options.authorizationServer);
    const sessions = await this.authenticationService.getSessions(providerId, scopeListOrRequest, { account: options.account, authorizationServer }, true);
    const provider = this.authenticationService.getProvider(providerId);
    if (options.forceNewSession && options.createIfNone) {
      throw new Error("Invalid combination of options. Please remove one of the following: forceNewSession, createIfNone");
    }
    if (options.forceNewSession && options.silent) {
      throw new Error("Invalid combination of options. Please remove one of the following: forceNewSession, silent");
    }
    if (options.createIfNone && options.silent) {
      throw new Error("Invalid combination of options. Please remove one of the following: createIfNone, silent");
    }
    if (options.clearSessionPreference) {
      this.authenticationExtensionsService.removeAccountPreference(extensionId, providerId);
    }
    const matchingAccountPreferenceSession = (
      // If an account was passed in, that takes precedence over the account preference
      options.account ? sessions[0] : this._getAccountPreference(extensionId, providerId, sessions)
    );
    if (!options.forceNewSession && sessions.length) {
      if (matchingAccountPreferenceSession && this.authenticationAccessService.isAccessAllowed(providerId, matchingAccountPreferenceSession.account.label, extensionId)) {
        return matchingAccountPreferenceSession;
      }
      if (!provider.supportsMultipleAccounts && this.authenticationAccessService.isAccessAllowed(providerId, sessions[0].account.label, extensionId)) {
        return sessions[0];
      }
    }
    if (options.createIfNone || options.forceNewSession) {
      let uiOptions;
      if (typeof options.forceNewSession === "object") {
        uiOptions = options.forceNewSession;
      } else if (typeof options.createIfNone === "object") {
        uiOptions = options.createIfNone;
      }
      const recreatingSession = !!(options.forceNewSession && sessions.length);
      const isAllowed = await this.loginPrompt(provider, extensionName, recreatingSession, uiOptions);
      if (!isAllowed) {
        throw new Error("User did not consent to login.");
      }
      let session;
      if (sessions?.length && !options.forceNewSession) {
        session = provider.supportsMultipleAccounts && !options.account ? await this.authenticationExtensionsService.selectSession(providerId, extensionId, extensionName, scopeListOrRequest, sessions) : sessions[0];
      } else {
        const accountToCreate = options.account ?? matchingAccountPreferenceSession?.account;
        do {
          session = await this.authenticationService.createSession(
            providerId,
            scopeListOrRequest,
            {
              activateImmediate: true,
              account: accountToCreate,
              authorizationServer
            }
          );
        } while (accountToCreate && accountToCreate.label !== session.account.label && !await this.continueWithIncorrectAccountPrompt(session.account.label, accountToCreate.label));
      }
      this.authenticationAccessService.updateAllowedExtensions(providerId, session.account.label, [{ id: extensionId, name: extensionName, allowed: true }]);
      this.authenticationExtensionsService.updateNewSessionRequests(providerId, [session]);
      this.authenticationExtensionsService.updateAccountPreference(extensionId, providerId, session.account);
      return session;
    }
    if (!matchingAccountPreferenceSession) {
      const validSessions = sessions.filter((session) => this.authenticationAccessService.isAccessAllowed(providerId, session.account.label, extensionId));
      if (validSessions.length === 1) {
        return validSessions[0];
      }
    }
    if (!options.silent) {
      sessions.length ? this.authenticationExtensionsService.requestSessionAccess(providerId, extensionId, extensionName, scopeListOrRequest, sessions) : await this.authenticationExtensionsService.requestNewSession(providerId, scopeListOrRequest, extensionId, extensionName);
    }
    return void 0;
  }
  async $getSession(providerId, scopeListOrRequest, extensionId, extensionName, options) {
    const scopes = isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) ? scopeListOrRequest.fallbackScopes : scopeListOrRequest;
    if (scopes) {
      this.sendClientIdUsageTelemetry(extensionId, providerId, scopes);
    }
    const session = await this.doGetSession(providerId, scopeListOrRequest, extensionId, extensionName, options);
    if (session) {
      this.sendProviderUsageTelemetry(extensionId, providerId);
      this.authenticationUsageService.addAccountUsage(providerId, session.account.label, session.scopes, extensionId, extensionName);
    }
    return session;
  }
  async $getAccounts(providerId) {
    const accounts = await this.authenticationService.getAccounts(providerId);
    return accounts;
  }
  sendClientIdUsageTelemetry(extensionId, providerId, scopes) {
    const containsVSCodeClientIdScope = scopes.some((scope) => scope.startsWith("VSCODE_CLIENT_ID:"));
    const key = `${extensionId}|${providerId}|${containsVSCodeClientIdScope}`;
    if (this._sentClientIdUsageEvents.has(key)) {
      return;
    }
    this._sentClientIdUsageEvents.add(key);
    if (containsVSCodeClientIdScope) {
      this.telemetryService.publicLog2("authentication.clientIdUsage", { extensionId });
    }
  }
  sendProviderUsageTelemetry(extensionId, providerId) {
    const key = `${extensionId}|${providerId}`;
    if (this._sentProviderUsageEvents.has(key)) {
      return;
    }
    this._sentProviderUsageEvents.add(key);
    this.telemetryService.publicLog2("authentication.providerUsage", { providerId, extensionId });
  }
  //#region Account Preferences
  // TODO@TylerLeonhardt: Update this after a few iterations to no longer fallback to the session preference
  _getAccountPreference(extensionId, providerId, sessions) {
    if (sessions.length === 0) {
      return void 0;
    }
    const accountNamePreference = this.authenticationExtensionsService.getAccountPreference(extensionId, providerId);
    if (accountNamePreference) {
      const session = sessions.find((session2) => session2.account.label === accountNamePreference);
      return session;
    }
    return void 0;
  }
  //#endregion
  async $showDeviceCodeModal(userCode, verificationUri) {
    const { result } = await this.dialogService.prompt({
      type: Severity.Info,
      message: nls.localize("deviceCodeTitle", "Device Code Authentication"),
      detail: nls.localize("deviceCodeDetail", "Your code: {0}\n\nTo complete authentication, navigate to {1} and enter the code above.", userCode, verificationUri),
      buttons: [
        {
          label: nls.localize("copyAndContinue", "Copy & Continue"),
          run: () => true
        }
      ],
      cancelButton: true
    });
    if (result) {
      try {
        await this.clipboardService.writeText(userCode);
        return await this.openerService.open(URI.parse(verificationUri));
      } catch (error) {
        this.notificationService.error(nls.localize("failedToOpenUri", "Failed to open {0}", verificationUri));
      }
    }
    return false;
  }
  async $promptForClientRegistration(authorizationServerUrl) {
    const redirectUrls = "http://127.0.0.1:33418\nhttps://vscode.dev/redirect";
    const result = await this.dialogService.prompt({
      type: Severity.Info,
      message: nls.localize("dcrNotSupported", "Dynamic Client Registration not supported"),
      detail: nls.localize("dcrNotSupportedDetail", "The authorization server '{0}' does not support automatic client registration. Do you want to proceed by manually providing a client registration (client ID)?\n\nNote: When registering your OAuth application, make sure to include these redirect URIs:\n{1}", authorizationServerUrl, redirectUrls),
      buttons: [
        {
          label: nls.localize("dcrCopyUrlsAndProceed", "Copy URIs & Proceed"),
          run: async () => {
            try {
              await this.clipboardService.writeText(redirectUrls);
            } catch (error) {
              this.notificationService.error(nls.localize("dcrFailedToCopy", "Failed to copy redirect URIs to clipboard."));
            }
            return true;
          }
        }
      ],
      cancelButton: {
        label: nls.localize("cancel", "Cancel"),
        run: () => false
      }
    });
    if (!result) {
      return void 0;
    }
    const sharedTitle = nls.localize("addClientRegistrationDetails", "Add Client Registration Details");
    const clientId = await this.quickInputService.input({
      title: sharedTitle,
      prompt: nls.localize("clientIdPrompt", "Enter an existing client ID that has been registered with the following redirect URIs: http://127.0.0.1:33418, https://vscode.dev/redirect"),
      placeHolder: nls.localize("clientIdPlaceholder", "OAuth client ID (azye39d...)"),
      ignoreFocusLost: true,
      validateInput: async (value) => {
        if (!value || value.trim().length === 0) {
          return nls.localize("clientIdRequired", "Client ID is required");
        }
        return void 0;
      }
    });
    if (!clientId || clientId.trim().length === 0) {
      return void 0;
    }
    const clientSecret = await this.quickInputService.input({
      title: sharedTitle,
      prompt: nls.localize("clientSecretPrompt", "(optional) Enter an existing client secret associated with the client id '{0}' or leave this field blank", clientId),
      placeHolder: nls.localize("clientSecretPlaceholder", "OAuth client secret (wer32o50f...) or leave it blank"),
      password: true,
      ignoreFocusLost: true
    });
    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret?.trim() || void 0
    };
  }
  async $promptForResourceClientSecret(resourceClientId, resource) {
    const value = await this.quickInputService.input({
      title: nls.localize("xaaResourceSecretTitle", "Resource Client Secret Required"),
      prompt: nls.localize(
        "xaaResourceSecretPrompt",
        "The resource at '{0}' uses a per-resource client identifier '{1}'. Enter the matching client secret (leave blank if none). The value is saved in OS secret storage; manage it later via the 'Set Client Secret' code lens in mcp.json.",
        resource,
        resourceClientId
      ),
      placeHolder: nls.localize("xaaResourceSecretPlaceholder", "Resource client secret"),
      password: true,
      ignoreFocusLost: true
    });
    if (value === void 0) {
      return void 0;
    }
    const trimmed = value.trim();
    const key = mcpOAuthClientSecretStorageKey(resource, resourceClientId);
    try {
      if (trimmed.length === 0) {
        await this.secretStorageService.delete(key);
      } else {
        await this.secretStorageService.set(key, trimmed);
      }
    } catch (err) {
      this.logService.warn(`[XAA] Failed to persist resource client secret for ${resource} / ${resourceClientId}: ${err.message}`);
    }
    return trimmed;
  }
};
MainThreadAuthentication = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadAuthentication),
  __decorateParam(1, IProductService),
  __decorateParam(2, IAuthenticationService),
  __decorateParam(3, IAuthenticationExtensionsService),
  __decorateParam(4, IAuthenticationAccessService),
  __decorateParam(5, IAuthenticationUsageService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IExtensionService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IURLService),
  __decorateParam(13, IDynamicAuthenticationProviderStorageService),
  __decorateParam(14, IClipboardService),
  __decorateParam(15, IQuickInputService),
  __decorateParam(16, IConfigurationService),
  __decorateParam(17, ISecretStorageService)
], MainThreadAuthentication);
export {
  MainThreadAuthentication
};
