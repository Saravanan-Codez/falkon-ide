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
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IAgentHostByokLmHandler } from "../../../../platform/agentHost/common/agentHostByokLm.js";
import { AgentHostByokLmHandler } from "../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostByokLmHandler.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { IViewsService } from "../../../../workbench/services/views/common/viewsService.js";
import { ILifecycleService, LifecyclePhase } from "../../../../workbench/services/lifecycle/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { SessionsViewId as SessionsListViewId } from "../../sessions/browser/views/sessionsView.js";
import { ISessionsSetUpService } from "../../../browser/sessionsSetUpService.js";
import { ISessionsPartService } from "../../../services/sessions/browser/sessionsPartService.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { SessionsCopilotConfigSlashSubmitHandlerContribution } from "../browser/copilotConfigSlashSubmitHandler.js";
import { AgentsWindowOpenSource, isAgentsWindowOpenSource } from "../../../../platform/window/common/window.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { TOTAL_SESSIONS_KEY } from "../../sessions/browser/sessionsLifecycleTracker.js";
import { SessionsWindowOpenTelemetry } from "../../sessions/browser/sessionsWindowOpenTelemetry.js";
import { SessionsWindowStartupExperiment } from "../../sessions/browser/sessionsWindowStartupExperiment.js";
let SelectAgentsFolderContribution = class extends Disposable {
  constructor(sessionsManagementService, sessionsService, sessionsProvidersService, viewsService, lifecycleService, sessionsSetUpService, logService, sessionsPartService, storageService, telemetryService) {
    super();
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.viewsService = viewsService;
    this.lifecycleService = lifecycleService;
    this.sessionsSetUpService = sessionsSetUpService;
    this.logService = logService;
    this.sessionsPartService = sessionsPartService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this._windowOpenTelemetry = this._register(new MutableDisposable());
    this._didHandleInitialWindowOpen = false;
    const handleSelectAgentsFolder = (_, ...args) => {
      const folderUri = args[0] ? URI.revive(args[0]) : void 0;
      const sessionResource = args[1] ? URI.revive(args[1]) : void 0;
      const source = isAgentsWindowOpenSource(args[2]) ? args[2] : AgentsWindowOpenSource.Unknown;
      this.logService.info(`[AgentsHandoff] IPC received: folderUri=${folderUri?.toString() ?? "(none)"} sessionResource=${sessionResource?.toString() ?? "(none)"}`);
      this._startWindowOpenTelemetry(source);
      this._handleOpenIntentAndCaptureInitialState(folderUri, sessionResource).catch((err) => this.logService.error("[AgentsHandoff] handleOpenIntent failed", err));
    };
    ipcRenderer.on("vscode:selectAgentsFolder", handleSelectAgentsFolder);
    this._register({ dispose: () => ipcRenderer.removeListener("vscode:selectAgentsFolder", handleSelectAgentsFolder) });
  }
  static {
    this.ID = "sessions.selectAgentsFolder";
  }
  _startWindowOpenTelemetry(source) {
    if (this._didHandleInitialWindowOpen) {
      return;
    }
    this._didHandleInitialWindowOpen = true;
    if (this.storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0) !== 0) {
      return;
    }
    this._windowOpenTelemetry.value = new SessionsWindowOpenTelemetry(
      source,
      () => this.sessionsSetUpService.initialSignInDialogShown,
      () => this._getWindowOpenViewState(),
      this.telemetryService,
      this.lifecycleService
    );
  }
  async _captureInitialWindowViewState() {
    await this.lifecycleService.when(LifecyclePhase.Eventually);
    this._windowOpenTelemetry.value?.captureInitialViewState();
  }
  async _handleOpenIntentAndCaptureInitialState(folderUri, sessionResource) {
    try {
      await this.handleOpenIntent(folderUri, sessionResource);
    } finally {
      await this._captureInitialWindowViewState();
    }
  }
  _getWindowOpenViewState() {
    const activeSession = this.sessionsService.activeSession.get();
    return {
      workspacePreselected: !activeSession || !activeSession.isCreated.get() ? activeSession?.workspace.get() !== void 0 : void 0
    };
  }
  async handleOpenIntent(folderUri, sessionResource) {
    if (sessionResource) {
      await this.openExistingSession(sessionResource);
      return;
    }
    if (folderUri) {
      await this.selectFolder(folderUri);
    }
  }
  async openExistingSession(sessionResource) {
    this.logService.info(`[AgentsHandoff] openExistingSession: target=${sessionResource.toString()}`);
    await this.lifecycleService.when(LifecyclePhase.Eventually);
    this.logService.info("[AgentsHandoff] reached LifecyclePhase.Eventually");
    const current = this.sessionsService.activeSession.get();
    if (current && current.resource.toString() === sessionResource.toString()) {
      this.logService.info("[AgentsHandoff] already on target session");
      return;
    }
    await this.sessionsPartService.getProgressIndicator().showWhile(this.resolveAndOpenSession(sessionResource));
  }
  async resolveAndOpenSession(sessionResource) {
    const found = await this.waitForSessionAvailable(sessionResource);
    if (!found) {
      this.logService.warn(`[AgentsHandoff] target session never appeared in providers; aborting`);
      return;
    }
    this.logService.info("[AgentsHandoff] target session available; opening");
    await this.sessionsService.openSession(sessionResource);
  }
  async waitForSessionAvailable(sessionResource, timeoutMs = 15e3) {
    if (this.sessionsManagementService.getSession(sessionResource)) {
      return true;
    }
    return new Promise((resolve) => {
      const store = new DisposableStore();
      const done = (result) => {
        store.dispose();
        resolve(result);
      };
      const timer = setTimeout(() => done(!!this.sessionsManagementService.getSession(sessionResource)), timeoutMs);
      store.add({ dispose: () => clearTimeout(timer) });
      store.add(this.sessionsManagementService.onDidChangeSessions(() => {
        if (this.sessionsManagementService.getSession(sessionResource)) {
          done(true);
        }
      }));
    });
  }
  async selectFolder(folderUri) {
    await this.sessionsSetUpService.whenWelcomeDone();
    this.sessionsService.openNewSession();
    const sessionsView = this.viewsService.getViewWithId(SessionsListViewId);
    sessionsView?.sessionsControl?.setOpenWindowSourceFolder(folderUri);
    if (this.tryResolveAndSelect(folderUri)) {
      return;
    }
    const disposable = this.sessionsProvidersService.onDidChangeProviders(() => {
      if (this.tryResolveAndSelect(folderUri)) {
        disposable.dispose();
      }
    });
    this.lifecycleService.when(LifecyclePhase.Eventually).then(() => disposable.dispose());
  }
  tryResolveAndSelect(folderUri) {
    const resolved = this.sessionsManagementService.resolveWorkspace(folderUri);
    if (!resolved) {
      return false;
    }
    const activeSession = this.sessionsService.activeSession.get();
    if (activeSession === void 0 || activeSession.status.get() === SessionStatus.Untitled) {
      this.sessionsPartService.getSessionView(activeSession?.sessionId)?.selectWorkspace(folderUri, resolved.providerId);
    }
    return true;
  }
};
SelectAgentsFolderContribution = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, IViewsService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, ISessionsSetUpService),
  __decorateParam(6, ILogService),
  __decorateParam(7, ISessionsPartService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, ITelemetryService)
], SelectAgentsFolderContribution);
registerWorkbenchContribution2(SelectAgentsFolderContribution.ID, SelectAgentsFolderContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(SessionsWindowStartupExperiment.ID, SessionsWindowStartupExperiment, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(SessionsCopilotConfigSlashSubmitHandlerContribution.ID, SessionsCopilotConfigSlashSubmitHandlerContribution, WorkbenchPhase.AfterRestored);
registerSingleton(IAgentHostByokLmHandler, AgentHostByokLmHandler, InstantiationType.Delayed);
