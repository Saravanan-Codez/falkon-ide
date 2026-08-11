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
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { createSyncHeaders } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { EDIT_SESSIONS_SIGNED_IN, EDIT_SESSION_SYNC_CATEGORY, EDIT_SESSIONS_SIGNED_IN_KEY, IEditSessionsLogService, EDIT_SESSIONS_PENDING_KEY } from "../common/editSessions.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { getCurrentAuthenticationSessionInfo } from "../../../services/authentication/browser/authenticationService.js";
import { isWeb } from "../../../../base/common/platform.js";
import { UserDataSyncMachinesService } from "../../../../platform/userDataSync/common/userDataSyncMachines.js";
import { Emitter } from "../../../../base/common/event.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
let EditSessionsWorkbenchService = class extends Disposable {
  // TODO@joyceerhl lifecycle hack
  constructor(fileService, storageService, quickInputService, authenticationService, extensionService, environmentService, logService, productService, contextKeyService, dialogService, secretStorageService) {
    super();
    this.fileService = fileService;
    this.storageService = storageService;
    this.quickInputService = quickInputService;
    this.authenticationService = authenticationService;
    this.extensionService = extensionService;
    this.environmentService = environmentService;
    this.logService = logService;
    this.productService = productService;
    this.contextKeyService = contextKeyService;
    this.dialogService = dialogService;
    this.secretStorageService = secretStorageService;
    this.SIZE_LIMIT = Math.floor(1024 * 1024 * 1.9);
    this.initialized = false;
    this._didSignIn = this._register(new Emitter());
    this._didSignOut = this._register(new Emitter());
    this._lastWrittenResources = /* @__PURE__ */ new Map();
    this._lastReadResources = /* @__PURE__ */ new Map();
    this.serverConfiguration = this.productService["editSessions.store"];
    this._register(this.authenticationService.onDidChangeSessions((e) => this.onDidChangeSessions(e.event)));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, EditSessionsWorkbenchService.CACHED_SESSION_STORAGE_KEY, this._store)(() => this.onDidChangeStorage()));
    this.registerSignInAction();
    this.registerResetAuthenticationAction();
    this.signedInContext = EDIT_SESSIONS_SIGNED_IN.bindTo(this.contextKeyService);
    this.signedInContext.set(this.existingSessionId !== void 0);
  }
  static {
    this.CACHED_SESSION_STORAGE_KEY = "editSessionAccountPreference";
  }
  get isSignedIn() {
    return this.existingSessionId !== void 0;
  }
  get onDidSignIn() {
    return this._didSignIn.event;
  }
  get onDidSignOut() {
    return this._didSignOut.event;
  }
  get lastWrittenResources() {
    return this._lastWrittenResources;
  }
  get lastReadResources() {
    return this._lastReadResources;
  }
  /**
   * @param resource: The resource to retrieve content for.
   * @param content An object representing resource state to be restored.
   * @returns The ref of the stored state.
   */
  async write(resource, content) {
    await this.initialize("write", false);
    if (!this.initialized) {
      throw new Error("Please sign in to store your edit session.");
    }
    if (typeof content !== "string" && content.machine === void 0) {
      content.machine = await this.getOrCreateCurrentMachineId();
    }
    content = typeof content === "string" ? content : JSON.stringify(content);
    const ref = await this.storeClient.writeResource(resource, content, null, void 0, createSyncHeaders(generateUuid()));
    this._lastWrittenResources.set(resource, { ref, content });
    return ref;
  }
  /**
   * @param resource: The resource to retrieve content for.
   * @param ref: A specific content ref to retrieve content for, if it exists.
   * If undefined, this method will return the latest saved edit session, if any.
   *
   * @returns An object representing the requested or latest state, if any.
   */
  async read(resource, ref) {
    await this.initialize("read", false);
    if (!this.initialized) {
      throw new Error("Please sign in to apply your latest edit session.");
    }
    let content;
    const headers = createSyncHeaders(generateUuid());
    try {
      if (ref !== void 0) {
        content = await this.storeClient?.resolveResourceContent(resource, ref, void 0, headers);
      } else {
        const result = await this.storeClient?.readResource(resource, null, void 0, headers);
        content = result?.content;
        ref = result?.ref;
      }
    } catch (ex) {
      this.logService.error(ex);
    }
    if (content !== void 0 && content !== null && ref !== void 0) {
      this._lastReadResources.set(resource, { ref, content });
      return { ref, content };
    }
    return void 0;
  }
  async delete(resource, ref) {
    await this.initialize("write", false);
    if (!this.initialized) {
      throw new Error(`Unable to delete edit session with ref ${ref}.`);
    }
    try {
      await this.storeClient?.deleteResource(resource, ref);
    } catch (ex) {
      this.logService.error(ex);
    }
  }
  async list(resource) {
    await this.initialize("read", false);
    if (!this.initialized) {
      throw new Error(`Unable to list edit sessions.`);
    }
    try {
      return this.storeClient?.getAllResourceRefs(resource) ?? [];
    } catch (ex) {
      this.logService.error(ex);
    }
    return [];
  }
  async initialize(reason, silent = false) {
    if (this.initialized) {
      return true;
    }
    this.initialized = await this.doInitialize(reason, silent);
    this.signedInContext.set(this.initialized);
    if (this.initialized) {
      this._didSignIn.fire();
    }
    return this.initialized;
  }
  /**
   *
   * Ensures that the store client is initialized,
   * meaning that authentication is configured and it
   * can be used to communicate with the remote storage service
   */
  async doInitialize(reason, silent) {
    await this.extensionService.whenInstalledExtensionsRegistered();
    if (!this.serverConfiguration?.url) {
      throw new Error("Unable to initialize sessions sync as session sync preference is not configured in product.json.");
    }
    if (this.storeClient === void 0) {
      return false;
    }
    this._register(this.storeClient.onTokenFailed(() => {
      this.logService.info("Clearing edit sessions authentication preference because of successive token failures.");
      this.clearAuthenticationPreference();
    }));
    if (this.machineClient === void 0) {
      this.machineClient = new UserDataSyncMachinesService(this.environmentService, this.fileService, this.storageService, this.storeClient, this.logService, this.productService);
    }
    if (this.authenticationInfo !== void 0) {
      return true;
    }
    const authenticationSession = await this.getAuthenticationSession(reason, silent);
    if (authenticationSession !== void 0) {
      this.authenticationInfo = authenticationSession;
      this.storeClient.setAuthToken(authenticationSession.token, authenticationSession.providerId);
    }
    return authenticationSession !== void 0;
  }
  async getMachineById(machineId) {
    await this.initialize("read", false);
    if (!this.cachedMachines) {
      const machines = await this.machineClient.getMachines();
      this.cachedMachines = machines.reduce((map, machine) => map.set(machine.id, machine.name), /* @__PURE__ */ new Map());
    }
    return this.cachedMachines.get(machineId);
  }
  async getOrCreateCurrentMachineId() {
    const currentMachineId = await this.machineClient.getMachines().then((machines) => machines.find((m) => m.isCurrent)?.id);
    if (currentMachineId === void 0) {
      await this.machineClient.addCurrentMachine();
      return await this.machineClient.getMachines().then((machines) => machines.find((m) => m.isCurrent).id);
    }
    return currentMachineId;
  }
  async getAuthenticationSession(reason, silent) {
    if (this.existingSessionId) {
      this.logService.info(`Searching for existing authentication session with ID ${this.existingSessionId}`);
      const existingSession = await this.getExistingSession();
      if (existingSession) {
        this.logService.info(`Found existing authentication session with ID ${existingSession.session.id}`);
        return { sessionId: existingSession.session.id, token: existingSession.session.idToken ?? existingSession.session.accessToken, providerId: existingSession.session.providerId };
      } else {
        this._didSignOut.fire();
      }
    }
    if (this.shouldAttemptEditSessionInit()) {
      this.logService.info(`Reusing user data sync enablement`);
      const authenticationSessionInfo = await getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService);
      if (authenticationSessionInfo !== void 0) {
        this.logService.info(`Using current authentication session with ID ${authenticationSessionInfo.id}`);
        this.existingSessionId = authenticationSessionInfo.id;
        return { sessionId: authenticationSessionInfo.id, token: authenticationSessionInfo.accessToken, providerId: authenticationSessionInfo.providerId };
      }
    }
    if (silent) {
      return;
    }
    const authenticationSession = await this.getAccountPreference(reason);
    if (authenticationSession !== void 0) {
      this.existingSessionId = authenticationSession.id;
      return { sessionId: authenticationSession.id, token: authenticationSession.idToken ?? authenticationSession.accessToken, providerId: authenticationSession.providerId };
    }
    return void 0;
  }
  shouldAttemptEditSessionInit() {
    return isWeb && this.storageService.isNew(StorageScope.APPLICATION) && this.storageService.isNew(StorageScope.WORKSPACE);
  }
  /**
   *
   * Prompts the user to pick an authentication option for storing and getting edit sessions.
   */
  async getAccountPreference(reason) {
    const disposables = new DisposableStore();
    const quickpick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    quickpick.ok = false;
    quickpick.placeholder = reason === "read" ? localize("choose account read placeholder", "Select an account to restore your working changes from the cloud") : localize("choose account placeholder", "Select an account to store your working changes in the cloud");
    quickpick.ignoreFocusOut = true;
    quickpick.items = await this.createQuickpickItems();
    return new Promise((resolve, reject) => {
      disposables.add(quickpick.onDidHide((e) => {
        reject(new CancellationError());
        disposables.dispose();
      }));
      disposables.add(quickpick.onDidAccept(async (e) => {
        const selection = quickpick.selectedItems[0];
        const session = "provider" in selection ? { ...await this.authenticationService.createSession(selection.provider.id, selection.provider.scopes), providerId: selection.provider.id } : "session" in selection ? selection.session : void 0;
        resolve(session);
        quickpick.hide();
      }));
      quickpick.show();
    });
  }
  async createQuickpickItems() {
    const options = [];
    options.push({ type: "separator", label: localize("signed in", "Signed In") });
    const sessions = await this.getAllSessions();
    options.push(...sessions);
    options.push({ type: "separator", label: localize("others", "Others") });
    for (const authenticationProvider of await this.getAuthenticationProviders()) {
      const signedInForProvider = sessions.some((account) => account.session.providerId === authenticationProvider.id);
      if (!signedInForProvider || this.authenticationService.getProvider(authenticationProvider.id).supportsMultipleAccounts) {
        const providerName = this.authenticationService.getProvider(authenticationProvider.id).label;
        options.push({ label: localize("sign in using account", "Sign in with {0}", providerName), provider: authenticationProvider });
      }
    }
    return options;
  }
  /**
   *
   * Returns all authentication sessions available from {@link getAuthenticationProviders}.
   */
  async getAllSessions() {
    const authenticationProviders = await this.getAuthenticationProviders();
    const accounts = /* @__PURE__ */ new Map();
    let currentSession;
    for (const provider of authenticationProviders) {
      const sessions = await this.authenticationService.getSessions(provider.id, provider.scopes);
      for (const session of sessions) {
        const item = {
          label: session.account.label,
          description: this.authenticationService.getProvider(provider.id).label,
          session: { ...session, providerId: provider.id }
        };
        accounts.set(item.session.account.id, item);
        if (this.existingSessionId === session.id) {
          currentSession = item;
        }
      }
    }
    if (currentSession !== void 0) {
      accounts.set(currentSession.session.account.id, currentSession);
    }
    return [...accounts.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  /**
   *
   * Returns all authentication providers which can be used to authenticate
   * to the remote storage service, based on product.json configuration
   * and registered authentication providers.
   */
  async getAuthenticationProviders() {
    if (!this.serverConfiguration) {
      throw new Error("Unable to get configured authentication providers as session sync preference is not configured in product.json.");
    }
    const authenticationProviders = this.serverConfiguration.authenticationProviders;
    const configuredAuthenticationProviders = Object.keys(authenticationProviders).reduce((result, id) => {
      result.push({ id, scopes: authenticationProviders[id].scopes });
      return result;
    }, []);
    const availableAuthenticationProviders = this.authenticationService.declaredProviders;
    return configuredAuthenticationProviders.filter(({ id }) => availableAuthenticationProviders.some((provider) => provider.id === id));
  }
  get existingSessionId() {
    return this.storageService.get(EditSessionsWorkbenchService.CACHED_SESSION_STORAGE_KEY, StorageScope.APPLICATION);
  }
  set existingSessionId(sessionId) {
    this.logService.trace(`Saving authentication session preference for ID ${sessionId}.`);
    if (sessionId === void 0) {
      this.storageService.remove(EditSessionsWorkbenchService.CACHED_SESSION_STORAGE_KEY, StorageScope.APPLICATION);
    } else {
      this.storageService.store(EditSessionsWorkbenchService.CACHED_SESSION_STORAGE_KEY, sessionId, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
  async getExistingSession() {
    const accounts = await this.getAllSessions();
    return accounts.find((account) => account.session.id === this.existingSessionId);
  }
  async onDidChangeStorage() {
    const newSessionId = this.existingSessionId;
    const previousSessionId = this.authenticationInfo?.sessionId;
    if (previousSessionId !== newSessionId) {
      this.logService.trace(`Resetting authentication state because authentication session ID preference changed from ${previousSessionId} to ${newSessionId}.`);
      this.authenticationInfo = void 0;
      this.initialized = false;
    }
  }
  clearAuthenticationPreference() {
    this.authenticationInfo = void 0;
    this.initialized = false;
    this.existingSessionId = void 0;
    this.signedInContext.set(false);
  }
  onDidChangeSessions(e) {
    if (this.authenticationInfo?.sessionId && e.removed?.find((session) => session.id === this.authenticationInfo?.sessionId)) {
      this.clearAuthenticationPreference();
    }
  }
  registerSignInAction() {
    if (!this.serverConfiguration?.url) {
      return;
    }
    const that = this;
    const id = "workbench.editSessions.actions.signIn";
    const when = ContextKeyExpr.and(ContextKeyExpr.equals(EDIT_SESSIONS_PENDING_KEY, false), ContextKeyExpr.equals(EDIT_SESSIONS_SIGNED_IN_KEY, false));
    this._register(registerAction2(class ResetEditSessionAuthenticationAction extends Action2 {
      constructor() {
        super({
          id,
          title: localize("sign in", "Turn on Cloud Changes..."),
          category: EDIT_SESSION_SYNC_CATEGORY,
          precondition: when,
          menu: [
            {
              id: MenuId.CommandPalette
            },
            {
              id: MenuId.AccountsContext,
              group: "2_editSessions",
              when
            }
          ]
        });
      }
      async run() {
        return await that.initialize("write", false);
      }
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
      group: "2_editSessions",
      command: {
        id,
        title: localize("sign in badge", "Turn on Cloud Changes... (1)")
      },
      when: ContextKeyExpr.and(ContextKeyExpr.equals(EDIT_SESSIONS_PENDING_KEY, true), ContextKeyExpr.equals(EDIT_SESSIONS_SIGNED_IN_KEY, false))
    }));
  }
  registerResetAuthenticationAction() {
    const that = this;
    this._register(registerAction2(class ResetEditSessionAuthenticationAction extends Action2 {
      constructor() {
        super({
          id: "workbench.editSessions.actions.resetAuth",
          title: localize("reset auth.v3", "Turn off Cloud Changes..."),
          category: EDIT_SESSION_SYNC_CATEGORY,
          precondition: ContextKeyExpr.equals(EDIT_SESSIONS_SIGNED_IN_KEY, true),
          menu: [
            {
              id: MenuId.CommandPalette
            },
            {
              id: MenuId.AccountsContext,
              group: "2_editSessions",
              when: ContextKeyExpr.equals(EDIT_SESSIONS_SIGNED_IN_KEY, true)
            }
          ]
        });
      }
      async run() {
        const result = await that.dialogService.confirm({
          message: localize("sign out of cloud changes clear data prompt", "Do you want to disable storing working changes in the cloud?"),
          checkbox: { label: localize("delete all cloud changes", "Delete all stored data from the cloud.") }
        });
        if (result.confirmed) {
          if (result.checkboxChecked) {
            that.storeClient?.deleteResource("editSessions", null);
          }
          that.clearAuthenticationPreference();
        }
      }
    }));
  }
};
EditSessionsWorkbenchService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IAuthenticationService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, IEnvironmentService),
  __decorateParam(6, IEditSessionsLogService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, ISecretStorageService)
], EditSessionsWorkbenchService);
export {
  EditSessionsWorkbenchService
};
