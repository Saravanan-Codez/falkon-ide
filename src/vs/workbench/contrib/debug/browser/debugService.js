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
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { toAction } from "../../../../base/common/actions.js";
import { distinct } from "../../../../base/common/arrays.js";
import { RunOnceScheduler, raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isErrorWithActions } from "../../../../base/common/errorMessage.js";
import * as errors from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { deepClone, equals } from "../../../../base/common/objects.js";
import severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IExtensionHostDebugService } from "../../../../platform/debug/common/extensionHostDebug.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { EditorsOrder } from "../../../common/editor.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { VIEWLET_ID as EXPLORER_VIEWLET_ID } from "../../files/common/files.js";
import { ITestService } from "../../testing/common/testService.js";
import { CALLSTACK_VIEW_ID, CONTEXT_BREAKPOINTS_EXIST, CONTEXT_DEBUG_STATE, CONTEXT_DEBUG_TYPE, CONTEXT_DEBUG_UX, CONTEXT_DISASSEMBLY_VIEW_FOCUS, CONTEXT_HAS_DEBUGGED, CONTEXT_IN_DEBUG_MODE, DEBUG_MEMORY_SCHEME, DEBUG_SCHEME, REPL_VIEW_ID, State, VIEWLET_ID, debuggerDisabledMessage, getStateLabel } from "../common/debug.js";
import { DebugCompoundRoot } from "../common/debugCompoundRoot.js";
import { Breakpoint, DataBreakpoint, DebugModel, FunctionBreakpoint, InstructionBreakpoint } from "../common/debugModel.js";
import { Source } from "../common/debugSource.js";
import { DebugStorage } from "../common/debugStorage.js";
import { DebugTelemetry } from "../common/debugTelemetry.js";
import { getExtensionHostDebugSession, saveAllBeforeDebugStart } from "../common/debugUtils.js";
import { ViewModel } from "../common/debugViewModel.js";
import { DisassemblyViewInput } from "../common/disassemblyViewInput.js";
import { AdapterManager } from "./debugAdapterManager.js";
import { DEBUG_CONFIGURE_COMMAND_ID, DEBUG_CONFIGURE_LABEL } from "./debugCommands.js";
import { ConfigurationManager } from "./debugConfigurationManager.js";
import { DebugMemoryFileSystemProvider } from "./debugMemory.js";
import { DebugSession } from "./debugSession.js";
import { DebugTaskRunner, TaskRunResult } from "./debugTaskRunner.js";
let DebugService = class {
  constructor(editorService, paneCompositeService, viewsService, viewDescriptorService, notificationService, dialogService, layoutService, contextService, contextKeyService, lifecycleService, instantiationService, extensionService, fileService, configurationService, extensionHostDebugService, activityService, commandService, quickInputService, workspaceTrustRequestService, uriIdentityService, testService) {
    this.editorService = editorService;
    this.paneCompositeService = paneCompositeService;
    this.viewsService = viewsService;
    this.viewDescriptorService = viewDescriptorService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.layoutService = layoutService;
    this.contextService = contextService;
    this.contextKeyService = contextKeyService;
    this.lifecycleService = lifecycleService;
    this.instantiationService = instantiationService;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.extensionHostDebugService = extensionHostDebugService;
    this.activityService = activityService;
    this.commandService = commandService;
    this.quickInputService = quickInputService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.uriIdentityService = uriIdentityService;
    this.testService = testService;
    this.restartingSessions = /* @__PURE__ */ new Set();
    this.disposables = new DisposableStore();
    this.initializing = false;
    this.sessionCancellationTokens = /* @__PURE__ */ new Map();
    this.haveDoneLazySetup = false;
    this.breakpointsToSendOnResourceSaved = /* @__PURE__ */ new Set();
    this._onDidChangeState = this.disposables.add(new Emitter());
    this._onDidNewSession = this.disposables.add(new Emitter());
    this._onWillNewSession = this.disposables.add(new Emitter());
    this._onDidEndSession = this.disposables.add(new Emitter());
    this.adapterManager = this.instantiationService.createInstance(AdapterManager, {
      onDidNewSession: this.onDidNewSession,
      configurationManager: () => this.configurationManager
    });
    this.disposables.add(this.adapterManager);
    this.configurationManager = this.instantiationService.createInstance(ConfigurationManager, this.adapterManager);
    this.disposables.add(this.configurationManager);
    this.debugStorage = this.disposables.add(this.instantiationService.createInstance(DebugStorage));
    this.chosenEnvironments = this.debugStorage.loadChosenEnvironments();
    this.model = this.instantiationService.createInstance(DebugModel, this.debugStorage);
    this.telemetry = this.instantiationService.createInstance(DebugTelemetry, this.model);
    this.viewModel = this.disposables.add(new ViewModel(contextKeyService));
    this.taskRunner = this.instantiationService.createInstance(DebugTaskRunner);
    this.disposables.add(this.fileService.onDidFilesChange((e) => this.onFileChanges(e)));
    this.disposables.add(this.lifecycleService.onWillShutdown(this.dispose, this));
    this.disposables.add(this.extensionHostDebugService.onAttachSession((event) => {
      const session = this.model.getSession(event.sessionId, true);
      if (session) {
        session.configuration.request = "attach";
        session.configuration.port = event.port;
        session.setSubId(event.subId);
        this.launchOrAttachToSession(session);
      }
    }));
    this.disposables.add(this.extensionHostDebugService.onTerminateSession((event) => {
      const session = this.model.getSession(event.sessionId);
      if (session && session.subId === event.subId) {
        session.disconnect();
      }
    }));
    this.disposables.add(this.viewModel.onDidFocusStackFrame(() => {
      this.onStateChange();
    }));
    this.disposables.add(this.viewModel.onDidFocusSession((session) => {
      this.onStateChange();
      if (session) {
        this.setExceptionBreakpointFallbackSession(session.getId());
      }
    }));
    this.disposables.add(Event.any(this.adapterManager.onDidRegisterDebugger, this.configurationManager.onDidSelectConfiguration)(() => {
      const debugUxValue = this.state !== State.Inactive || this.configurationManager.getAllConfigurations().length > 0 && this.adapterManager.hasEnabledDebuggers() ? "default" : "simple";
      this.debugUx.set(debugUxValue);
      this.debugStorage.storeDebugUxState(debugUxValue);
    }));
    this.disposables.add(this.model.onDidChangeCallStack(() => {
      const numberOfSessions = this.model.getSessions().filter((s) => !s.parentSession).length;
      this.activity?.dispose();
      if (numberOfSessions > 0) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(CALLSTACK_VIEW_ID);
        if (viewContainer) {
          this.activity = this.activityService.showViewContainerActivity(viewContainer.id, { badge: new NumberBadge(numberOfSessions, (n) => n === 1 ? nls.localize("1activeSession", "1 active session") : nls.localize("nActiveSessions", "{0} active sessions", n)) });
        }
      }
    }));
    this.disposables.add(editorService.onDidActiveEditorChange(() => {
      this.contextKeyService.bufferChangeEvents(() => {
        if (editorService.activeEditor === DisassemblyViewInput.instance) {
          this.disassemblyViewFocus.set(true);
        } else {
          this.disassemblyViewFocus?.reset();
        }
      });
    }));
    this.disposables.add(this.lifecycleService.onBeforeShutdown(() => {
      for (const editor of editorService.editors) {
        if (editor.resource?.scheme === DEBUG_MEMORY_SCHEME) {
          editor.dispose();
        }
      }
    }));
    this.disposables.add(extensionService.onWillStop((evt) => {
      evt.veto(
        this.model.getSessions().length > 0,
        nls.localize("active debug session", "A debug session is still running that would terminate.")
      );
    }));
    this.initContextKeys(contextKeyService);
  }
  initContextKeys(contextKeyService) {
    queueMicrotask(() => {
      contextKeyService.bufferChangeEvents(() => {
        this.debugType = CONTEXT_DEBUG_TYPE.bindTo(contextKeyService);
        this.debugState = CONTEXT_DEBUG_STATE.bindTo(contextKeyService);
        this.hasDebugged = CONTEXT_HAS_DEBUGGED.bindTo(contextKeyService);
        this.inDebugMode = CONTEXT_IN_DEBUG_MODE.bindTo(contextKeyService);
        this.debugUx = CONTEXT_DEBUG_UX.bindTo(contextKeyService);
        this.debugUx.set(this.debugStorage.loadDebugUxState());
        this.breakpointsExist = CONTEXT_BREAKPOINTS_EXIST.bindTo(contextKeyService);
        this.disassemblyViewFocus = CONTEXT_DISASSEMBLY_VIEW_FOCUS.bindTo(contextKeyService);
      });
      const setBreakpointsExistContext = () => this.breakpointsExist.set(!!(this.model.getBreakpoints().length || this.model.getDataBreakpoints().length || this.model.getFunctionBreakpoints().length));
      setBreakpointsExistContext();
      this.disposables.add(this.model.onDidChangeBreakpoints(() => setBreakpointsExistContext()));
    });
  }
  getModel() {
    return this.model;
  }
  getViewModel() {
    return this.viewModel;
  }
  getConfigurationManager() {
    return this.configurationManager;
  }
  getAdapterManager() {
    return this.adapterManager;
  }
  sourceIsNotAvailable(uri2) {
    this.model.sourceIsNotAvailable(uri2);
  }
  dispose() {
    this.disposables.dispose();
  }
  //---- state management
  get state() {
    const focusedSession = this.viewModel.focusedSession;
    if (focusedSession) {
      return focusedSession.state;
    }
    return this.initializing ? State.Initializing : State.Inactive;
  }
  get initializingOptions() {
    return this._initializingOptions;
  }
  startInitializingState(options) {
    if (!this.initializing) {
      this.initializing = true;
      this._initializingOptions = options;
      this.onStateChange();
    }
  }
  endInitializingState() {
    if (this.initializing) {
      this.initializing = false;
      this._initializingOptions = void 0;
      this.onStateChange();
    }
  }
  cancelTokens(id) {
    if (id) {
      const token = this.sessionCancellationTokens.get(id);
      if (token) {
        token.cancel();
        this.sessionCancellationTokens.delete(id);
      }
    } else {
      this.sessionCancellationTokens.forEach((t) => t.cancel());
      this.sessionCancellationTokens.clear();
    }
  }
  onStateChange() {
    const state = this.state;
    if (this.previousState !== state) {
      this.contextKeyService.bufferChangeEvents(() => {
        this.debugState.set(getStateLabel(state));
        this.inDebugMode.set(state !== State.Inactive);
        const debugUxValue = state !== State.Inactive && state !== State.Initializing || this.adapterManager.hasEnabledDebuggers() && this.configurationManager.selectedConfiguration.name ? "default" : "simple";
        this.debugUx.set(debugUxValue);
        this.debugStorage.storeDebugUxState(debugUxValue);
      });
      this.previousState = state;
      this._onDidChangeState.fire(state);
    }
  }
  get onDidChangeState() {
    return this._onDidChangeState.event;
  }
  get onDidNewSession() {
    return this._onDidNewSession.event;
  }
  get onWillNewSession() {
    return this._onWillNewSession.event;
  }
  get onDidEndSession() {
    return this._onDidEndSession.event;
  }
  lazySetup() {
    if (!this.haveDoneLazySetup) {
      this.disposables.add(this.fileService.registerProvider(DEBUG_MEMORY_SCHEME, this.disposables.add(new DebugMemoryFileSystemProvider(this))));
      this.haveDoneLazySetup = true;
    }
  }
  //---- life cycle management
  /**
   * main entry point
   * properly manages compounds, checks for errors and handles the initializing state.
   */
  async startDebugging(launch, configOrName, options, saveBeforeStart = !options?.parentSession) {
    const message = options && options.noDebug ? nls.localize("runTrust", "Running executes build tasks and program code from your workspace.") : nls.localize("debugTrust", "Debugging executes build tasks and program code from your workspace.");
    const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({ message });
    if (!trust) {
      return false;
    }
    this.lazySetup();
    this.startInitializingState(options);
    this.hasDebugged.set(true);
    try {
      await this.extensionService.activateByEvent("onDebug");
      if (saveBeforeStart) {
        await saveAllBeforeDebugStart(this.configurationService, this.editorService);
      }
      await this.extensionService.whenInstalledExtensionsRegistered();
      let config;
      let compound;
      if (!configOrName) {
        configOrName = this.configurationManager.selectedConfiguration.name;
      }
      if (typeof configOrName === "string" && launch) {
        config = launch.getConfiguration(configOrName);
        compound = launch.getCompound(configOrName);
      } else if (typeof configOrName !== "string") {
        config = configOrName;
      }
      if (compound) {
        if (!compound.configurations) {
          throw new Error(nls.localize(
            { key: "compoundMustHaveConfigurations", comment: ['compound indicates a "compounds" configuration item', '"configurations" is an attribute and should not be localized'] },
            'Compound must have "configurations" attribute set in order to start multiple configurations.'
          ));
        }
        if (compound.preLaunchTask) {
          const taskResult = await this.taskRunner.runTaskAndCheckErrors(launch?.workspace || this.contextService.getWorkspace(), compound.preLaunchTask);
          if (taskResult === TaskRunResult.Failure) {
            this.endInitializingState();
            return false;
          }
        }
        if (compound.stopAll) {
          options = { ...options, compoundRoot: new DebugCompoundRoot() };
        }
        const values = await Promise.all(compound.configurations.map((configData) => {
          const name = typeof configData === "string" ? configData : configData.name;
          if (name === compound.name) {
            return Promise.resolve(false);
          }
          let launchForName;
          if (typeof configData === "string") {
            const launchesContainingName = this.configurationManager.getLaunches().filter((l) => !!l.getConfiguration(name));
            if (launchesContainingName.length === 1) {
              launchForName = launchesContainingName[0];
            } else if (launch && launchesContainingName.length > 1 && launchesContainingName.indexOf(launch) >= 0) {
              launchForName = launch;
            } else {
              throw new Error(launchesContainingName.length === 0 ? nls.localize("noConfigurationNameInWorkspace", "Could not find launch configuration '{0}' in the workspace.", name) : nls.localize("multipleConfigurationNamesInWorkspace", "There are multiple launch configurations '{0}' in the workspace. Use folder name to qualify the configuration.", name));
            }
          } else if (configData.folder) {
            const launchesMatchingConfigData = this.configurationManager.getLaunches().filter((l) => l.workspace && l.workspace.name === configData.folder && !!l.getConfiguration(configData.name));
            if (launchesMatchingConfigData.length === 1) {
              launchForName = launchesMatchingConfigData[0];
            } else {
              throw new Error(nls.localize("noFolderWithName", "Can not find folder with name '{0}' for configuration '{1}' in compound '{2}'.", configData.folder, configData.name, compound.name));
            }
          }
          return this.createSession(launchForName, launchForName.getConfiguration(name), options);
        }));
        const result2 = values.every((success) => !!success);
        this.endInitializingState();
        return result2;
      }
      if (configOrName && !config) {
        const message2 = !!launch ? nls.localize("configMissing", "Configuration '{0}' is missing in 'launch.json'.", typeof configOrName === "string" ? configOrName : configOrName.name) : nls.localize("launchJsonDoesNotExist", "'launch.json' does not exist for passed workspace folder.");
        throw new Error(message2);
      }
      const result = await this.createSession(launch, config, options);
      this.endInitializingState();
      return result;
    } catch (err) {
      this.notificationService.error(err);
      this.endInitializingState();
      return Promise.reject(err);
    }
  }
  /**
   * gets the debugger for the type, resolves configurations by providers, substitutes variables and runs prelaunch tasks
   */
  async createSession(launch, config, options) {
    let type;
    if (config) {
      type = config.type;
    } else {
      config = /* @__PURE__ */ Object.create(null);
    }
    if (options && options.noDebug) {
      config.noDebug = true;
    } else if (options && typeof options.noDebug === "undefined" && options.parentSession && options.parentSession.configuration.noDebug) {
      config.noDebug = true;
    }
    const unresolvedConfig = deepClone(config);
    let guess;
    let activeEditor;
    if (!type) {
      activeEditor = this.editorService.activeEditor;
      if (activeEditor && activeEditor.resource) {
        const chosen = this.chosenEnvironments[activeEditor.resource.toString()];
        if (chosen) {
          type = chosen.type;
          if (chosen.dynamicLabel) {
            const dyn = await this.configurationManager.getDynamicConfigurationsByType(chosen.type);
            const found = dyn.find((d) => d.label === chosen.dynamicLabel);
            if (found) {
              launch = found.launch;
              Object.assign(config, found.config);
            }
          }
        }
      }
      if (!type) {
        guess = await this.adapterManager.guessDebugger(false);
        if (guess) {
          type = guess.debugger.type;
          if (guess.withConfig) {
            launch = guess.withConfig.launch;
            Object.assign(config, guess.withConfig.config);
          }
        }
      }
    }
    const initCancellationToken = new CancellationTokenSource();
    const sessionId = generateUuid();
    this.sessionCancellationTokens.set(sessionId, initCancellationToken);
    const configByProviders = await this.configurationManager.resolveConfigurationByProviders(launch && launch.workspace ? launch.workspace.uri : void 0, type, config, initCancellationToken.token);
    if (configByProviders && configByProviders.type) {
      try {
        let resolvedConfig = await this.substituteVariables(launch, configByProviders);
        if (!resolvedConfig) {
          return false;
        }
        if (initCancellationToken.token.isCancellationRequested) {
          return false;
        }
        let userConfirmedConcurrentSession = false;
        if (options?.startedByUser && resolvedConfig && resolvedConfig.suppressMultipleSessionWarning !== true) {
          const existingSessions = this.model.getSessions();
          const workspace2 = launch?.workspace;
          const existingSession = existingSessions.find(
            (s) => s.configuration.name === resolvedConfig.name && s.configuration.type === resolvedConfig.type && s.configuration.request === resolvedConfig.request && s.root === workspace2
          );
          if (existingSession) {
            const confirmed = await this.confirmConcurrentSession(existingSession.getLabel());
            if (!confirmed) {
              return false;
            }
            userConfirmedConcurrentSession = true;
          }
        }
        const workspace = launch?.workspace || this.contextService.getWorkspace();
        const taskResult = await this.taskRunner.runTaskAndCheckErrors(workspace, resolvedConfig.preLaunchTask);
        if (taskResult === TaskRunResult.Failure) {
          return false;
        }
        const cfg = await this.configurationManager.resolveDebugConfigurationWithSubstitutedVariables(launch && launch.workspace ? launch.workspace.uri : void 0, resolvedConfig.type, resolvedConfig, initCancellationToken.token);
        if (!cfg) {
          if (launch && type && cfg === null && !initCancellationToken.token.isCancellationRequested) {
            await launch.openConfigFile({ preserveFocus: true, type }, initCancellationToken.token);
          }
          return false;
        }
        resolvedConfig = cfg;
        const dbg = this.adapterManager.getDebugger(resolvedConfig.type);
        if (!dbg || configByProviders.request !== "attach" && configByProviders.request !== "launch") {
          let message;
          if (configByProviders.request !== "attach" && configByProviders.request !== "launch") {
            message = configByProviders.request ? nls.localize("debugRequestNotSupported", "Attribute '{0}' has an unsupported value '{1}' in the chosen debug configuration.", "request", configByProviders.request) : nls.localize("debugRequesMissing", "Attribute '{0}' is missing from the chosen debug configuration.", "request");
          } else {
            message = resolvedConfig.type ? nls.localize("debugTypeNotSupported", "Configured debug type '{0}' is not supported.", resolvedConfig.type) : nls.localize("debugTypeMissing", "Missing property 'type' for the chosen launch configuration.");
          }
          const actionList = [];
          actionList.push(toAction({
            id: "installAdditionalDebuggers",
            label: nls.localize({ key: "installAdditionalDebuggers", comment: ['Placeholder is the debug type, so for example "node", "python"'] }, "Install {0} Extension", resolvedConfig.type),
            enabled: true,
            run: async () => this.commandService.executeCommand("debug.installAdditionalDebuggers", resolvedConfig?.type)
          }));
          await this.showError(message, actionList);
          return false;
        }
        if (!dbg.enabled) {
          await this.showError(debuggerDisabledMessage(dbg.type), []);
          return false;
        }
        const result = await this.doCreateSession(sessionId, launch?.workspace, { resolved: resolvedConfig, unresolved: unresolvedConfig }, options, userConfirmedConcurrentSession);
        if (result && guess && activeEditor && activeEditor.resource) {
          this.chosenEnvironments[activeEditor.resource.toString()] = { type: guess.debugger.type, dynamicLabel: guess.withConfig?.label };
          this.debugStorage.storeChosenEnvironments(this.chosenEnvironments);
        }
        return result;
      } catch (err) {
        if (err && err.message) {
          await this.showError(err.message);
        } else if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
          await this.showError(nls.localize("noFolderWorkspaceDebugError", "The active file can not be debugged. Make sure it is saved and that you have a debug extension installed for that file type."));
        }
        if (launch && !initCancellationToken.token.isCancellationRequested) {
          await launch.openConfigFile({ preserveFocus: true }, initCancellationToken.token);
        }
        return false;
      }
    }
    if (launch && type && configByProviders === null && !initCancellationToken.token.isCancellationRequested) {
      await launch.openConfigFile({ preserveFocus: true, type }, initCancellationToken.token);
    }
    return false;
  }
  /**
   * instantiates the new session, initializes the session, registers session listeners and reports telemetry
   */
  async doCreateSession(sessionId, root, configuration, options, userConfirmedConcurrentSession = false) {
    const session = this.instantiationService.createInstance(DebugSession, sessionId, configuration, root, this.model, options);
    if (!userConfirmedConcurrentSession && options?.startedByUser && this.model.getSessions().some(
      (s) => s.configuration.name === configuration.resolved.name && s.configuration.type === configuration.resolved.type && s.configuration.request === configuration.resolved.request && s.root === root
    ) && configuration.resolved.suppressMultipleSessionWarning !== true) {
      const confirmed = await this.confirmConcurrentSession(session.getLabel());
      if (!confirmed) {
        return false;
      }
    }
    this.model.addSession(session);
    this._onWillNewSession.fire(session);
    const openDebug = this.configurationService.getValue("debug").openDebug;
    if (!configuration.resolved.noDebug && (openDebug === "openOnSessionStart" || openDebug === "openOnFirstSessionStart" && this.viewModel.firstSessionStart) && !session.suppressDebugView) {
      await this.paneCompositeService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar);
    }
    try {
      await this.launchOrAttachToSession(session);
      const internalConsoleOptions = session.configuration.internalConsoleOptions || this.configurationService.getValue("debug").internalConsoleOptions;
      if (internalConsoleOptions === "openOnSessionStart" || this.viewModel.firstSessionStart && internalConsoleOptions === "openOnFirstSessionStart") {
        this.viewsService.openView(REPL_VIEW_ID, false);
      }
      this.viewModel.firstSessionStart = false;
      const showSubSessions = this.configurationService.getValue("debug").showSubSessionsInToolBar;
      const sessions = this.model.getSessions();
      const shownSessions = showSubSessions ? sessions : sessions.filter((s) => !s.parentSession);
      if (shownSessions.length > 1) {
        this.viewModel.setMultiSessionView(true);
      }
      this._onDidNewSession.fire(session);
      return true;
    } catch (error) {
      if (errors.isCancellationError(error)) {
        return false;
      }
      if (session && session.getReplElements().length > 0) {
        this.viewsService.openView(REPL_VIEW_ID, false);
      }
      if (session.configuration && session.configuration.request === "attach" && session.configuration.__autoAttach) {
        return false;
      }
      const errorMessage = error instanceof Error ? error.message : error;
      if (error.showUser !== false) {
        await this.showError(errorMessage, isErrorWithActions(error) ? error.actions : []);
      }
      return false;
    }
  }
  async confirmConcurrentSession(sessionLabel) {
    const result = await this.dialogService.confirm({
      message: nls.localize("multipleSession", "'{0}' is already running. Do you want to start another instance?", sessionLabel)
    });
    return result.confirmed;
  }
  async launchOrAttachToSession(session, forceFocus = false) {
    this.registerSessionListeners(session);
    const dbgr = this.adapterManager.getDebugger(session.configuration.type);
    try {
      await session.initialize(dbgr);
      await session.launchOrAttach(session.configuration);
      const launchJsonExists = !!session.root && !!this.configurationService.getValue("launch", { resource: session.root.uri });
      await this.telemetry.logDebugSessionStart(dbgr, launchJsonExists);
      if (forceFocus || !this.viewModel.focusedSession || session.parentSession === this.viewModel.focusedSession && session.compact) {
        await this.focusStackFrame(void 0, void 0, session);
      }
    } catch (err) {
      if (this.viewModel.focusedSession === session) {
        await this.focusStackFrame(void 0);
      }
      return Promise.reject(err);
    }
  }
  registerSessionListeners(session) {
    const listenerDisposables = new DisposableStore();
    this.disposables.add(listenerDisposables);
    const sessionRunningScheduler = listenerDisposables.add(new RunOnceScheduler(() => {
      if (session.state === State.Running && this.viewModel.focusedSession === session) {
        this.viewModel.setFocus(void 0, this.viewModel.focusedThread, session, false);
      }
    }, 200));
    listenerDisposables.add(session.onDidChangeState(() => {
      if (session.state === State.Running && this.viewModel.focusedSession === session) {
        sessionRunningScheduler.schedule();
      }
      if (session === this.viewModel.focusedSession) {
        this.onStateChange();
      }
    }));
    listenerDisposables.add(this.onDidEndSession((e) => {
      if (e.session === session) {
        this.disposables.delete(listenerDisposables);
      }
    }));
    listenerDisposables.add(session.onDidEndAdapter(async (adapterExitEvent) => {
      if (adapterExitEvent) {
        if (adapterExitEvent.error) {
          this.notificationService.error(nls.localize("debugAdapterCrash", "Debug adapter process has terminated unexpectedly ({0})", adapterExitEvent.error.message || adapterExitEvent.error.toString()));
        }
        this.telemetry.logDebugSessionStop(session, adapterExitEvent);
      }
      const extensionDebugSession = getExtensionHostDebugSession(session);
      if (extensionDebugSession && extensionDebugSession.state === State.Running && extensionDebugSession.configuration.noDebug) {
        this.extensionHostDebugService.close(extensionDebugSession.getId());
      }
      if (session.configuration.postDebugTask) {
        const root = session.root ?? this.contextService.getWorkspace();
        try {
          await this.taskRunner.runTask(root, session.configuration.postDebugTask);
        } catch (err) {
          this.notificationService.error(err);
        }
      }
      this.endInitializingState();
      this.cancelTokens(session.getId());
      if (this.configurationService.getValue("debug").closeReadonlyTabsOnEnd) {
        const editorsToClose = this.editorService.getEditors(EditorsOrder.SEQUENTIAL).filter(({ editor }) => {
          return editor.resource?.scheme === DEBUG_SCHEME && session.getId() === Source.getEncodedDebugData(editor.resource).sessionId;
        });
        this.editorService.closeEditors(editorsToClose);
      }
      this._onDidEndSession.fire({ session, restart: this.restartingSessions.has(session) });
      const focusedSession = this.viewModel.focusedSession;
      if (focusedSession && focusedSession.getId() === session.getId()) {
        const { session: session2, thread, stackFrame } = getStackFrameThreadAndSessionToFocus(this.model, void 0, void 0, void 0, focusedSession);
        this.viewModel.setFocus(stackFrame, thread, session2, false);
      }
      if (this.model.getSessions().length === 0) {
        this.viewModel.setMultiSessionView(false);
        if (this.layoutService.isVisible(Parts.SIDEBAR_PART) && this.configurationService.getValue("debug").openExplorerOnEnd) {
          this.paneCompositeService.openPaneComposite(EXPLORER_VIEWLET_ID, ViewContainerLocation.Sidebar);
        }
        const dataBreakpoints = this.model.getDataBreakpoints().filter((dbp) => !dbp.canPersist);
        dataBreakpoints.forEach((dbp) => this.model.removeDataBreakpoints(dbp.getId()));
        if (this.configurationService.getValue("debug").console.closeOnEnd) {
          const debugConsoleContainer = this.viewDescriptorService.getViewContainerByViewId(REPL_VIEW_ID);
          if (debugConsoleContainer && this.viewsService.isViewContainerVisible(debugConsoleContainer.id)) {
            this.viewsService.closeViewContainer(debugConsoleContainer.id);
          }
        }
      }
      this.model.removeExceptionBreakpointsForSession(session.getId());
    }));
  }
  async restartSession(session, restartData) {
    if (session.saveBeforeRestart) {
      await saveAllBeforeDebugStart(this.configurationService, this.editorService);
    }
    const isAutoRestart = !!restartData;
    const runTasks = async () => {
      if (isAutoRestart) {
        return Promise.resolve(TaskRunResult.Success);
      }
      const root = session.root || this.contextService.getWorkspace();
      await this.taskRunner.runTask(root, session.configuration.preRestartTask);
      await this.taskRunner.runTask(root, session.configuration.postDebugTask);
      const taskResult1 = await this.taskRunner.runTaskAndCheckErrors(root, session.configuration.preLaunchTask);
      if (taskResult1 !== TaskRunResult.Success) {
        return taskResult1;
      }
      return this.taskRunner.runTaskAndCheckErrors(root, session.configuration.postRestartTask);
    };
    const extensionDebugSession = getExtensionHostDebugSession(session);
    if (extensionDebugSession) {
      const taskResult = await runTasks();
      if (taskResult === TaskRunResult.Success) {
        this.extensionHostDebugService.reload(extensionDebugSession.getId());
      }
      return;
    }
    let needsToSubstitute = false;
    let unresolved;
    const launch = session.root ? this.configurationManager.getLaunch(session.root.uri) : void 0;
    if (launch) {
      unresolved = launch.getConfiguration(session.configuration.name);
      if (unresolved && !equals(unresolved, session.unresolvedConfiguration)) {
        unresolved.noDebug = session.configuration.noDebug;
        needsToSubstitute = true;
      }
    }
    let resolved = session.configuration;
    if (launch && needsToSubstitute && unresolved) {
      const initCancellationToken = new CancellationTokenSource();
      this.sessionCancellationTokens.set(session.getId(), initCancellationToken);
      const resolvedByProviders = await this.configurationManager.resolveConfigurationByProviders(launch.workspace ? launch.workspace.uri : void 0, unresolved.type, unresolved, initCancellationToken.token);
      if (resolvedByProviders) {
        resolved = await this.substituteVariables(launch, resolvedByProviders);
        if (resolved && !initCancellationToken.token.isCancellationRequested) {
          resolved = await this.configurationManager.resolveDebugConfigurationWithSubstitutedVariables(launch && launch.workspace ? launch.workspace.uri : void 0, resolved.type, resolved, initCancellationToken.token);
        }
      } else {
        resolved = resolvedByProviders;
      }
    }
    if (resolved) {
      session.setConfiguration({ resolved, unresolved });
    }
    session.configuration.__restart = restartData;
    const doRestart = async (fn) => {
      this.restartingSessions.add(session);
      let didRestart = false;
      try {
        didRestart = await fn() !== false;
      } catch (e) {
        didRestart = false;
        throw e;
      } finally {
        this.restartingSessions.delete(session);
        if (!didRestart) {
          this._onDidEndSession.fire({ session, restart: false });
        }
      }
    };
    for (const breakpoint of this.model.getBreakpoints({ triggeredOnly: true })) {
      breakpoint.setSessionDidTrigger(session.getId(), false);
    }
    if (session.correlatedTestRun) {
      if (!session.correlatedTestRun.completedAt) {
        session.cancelCorrelatedTestRun();
        await Event.toPromise(session.correlatedTestRun.onComplete);
      }
      this.testService.runResolvedTests(session.correlatedTestRun.request);
      return;
    }
    if (session.capabilities.supportsRestartRequest) {
      const taskResult = await runTasks();
      if (taskResult === TaskRunResult.Success) {
        await doRestart(async () => {
          await session.restart();
          return true;
        });
      }
      return;
    }
    const shouldFocus = !!this.viewModel.focusedSession && session.getId() === this.viewModel.focusedSession.getId();
    return doRestart(async () => {
      if (isAutoRestart) {
        await session.disconnect(true);
      } else {
        await session.terminate(true);
      }
      return new Promise((c, e) => {
        setTimeout(async () => {
          const taskResult = await runTasks();
          if (taskResult !== TaskRunResult.Success) {
            return c(false);
          }
          if (!resolved) {
            return c(false);
          }
          try {
            await this.launchOrAttachToSession(session, shouldFocus);
            this._onDidNewSession.fire(session);
            c(true);
          } catch (error) {
            e(error);
          }
        }, 300);
      });
    });
  }
  async stopSession(session, disconnect = false, suspend = false) {
    if (session) {
      return disconnect ? session.disconnect(void 0, suspend) : session.terminate();
    }
    const sessions = this.model.getSessions();
    if (sessions.length === 0) {
      this.taskRunner.cancel();
      await this.quickInputService.cancel();
      this.endInitializingState();
      this.cancelTokens(void 0);
    }
    return Promise.all(sessions.map((s) => disconnect ? s.disconnect(void 0, suspend) : s.terminate()));
  }
  async substituteVariables(launch, config) {
    const dbg = this.adapterManager.getDebugger(config.type);
    if (dbg) {
      let folder = void 0;
      if (launch && launch.workspace) {
        folder = launch.workspace;
      } else {
        const folders = this.contextService.getWorkspace().folders;
        if (folders.length === 1) {
          folder = folders[0];
        }
      }
      try {
        return await dbg.substituteVariables(folder, config);
      } catch (err) {
        if (err.message !== errors.canceledName) {
          this.showError(err.message, void 0, !!launch?.getConfiguration(config.name));
        }
        return void 0;
      }
    }
    return Promise.resolve(config);
  }
  async showError(message, errorActions = [], promptLaunchJson = true) {
    const configureAction = toAction({ id: DEBUG_CONFIGURE_COMMAND_ID, label: DEBUG_CONFIGURE_LABEL, enabled: true, run: () => this.commandService.executeCommand(DEBUG_CONFIGURE_COMMAND_ID) });
    const actions = errorActions.filter((action) => action.id.endsWith(".command")).length > 0 ? errorActions : [...errorActions, ...promptLaunchJson ? [configureAction] : []];
    await this.dialogService.prompt({
      type: severity.Error,
      message,
      buttons: actions.map((action) => ({
        label: action.label,
        run: () => action.run()
      })),
      cancelButton: true
    });
  }
  //---- focus management
  async focusStackFrame(_stackFrame, _thread, _session, options) {
    const { stackFrame, thread, session } = getStackFrameThreadAndSessionToFocus(this.model, _stackFrame, _thread, _session);
    if (stackFrame) {
      const editor = await stackFrame.openInEditor(this.editorService, options?.preserveFocus ?? true, options?.sideBySide, options?.pinned);
      if (editor) {
        if (editor.input === DisassemblyViewInput.instance) {
        } else {
          const control = editor.getControl();
          if (stackFrame && isCodeEditor(control) && control.hasModel()) {
            const model = control.getModel();
            const lineNumber = stackFrame.range.startLineNumber;
            if (lineNumber >= 1 && lineNumber <= model.getLineCount()) {
              const lineContent = control.getModel().getLineContent(lineNumber);
              aria.alert(nls.localize(
                { key: "debuggingPaused", comment: ['First placeholder is the file line content, second placeholder is the reason why debugging is stopped, for example "breakpoint", third is the stack frame name, and last is the line number.'] },
                "{0}, debugging paused {1}, {2}:{3}",
                lineContent,
                thread && thread.stoppedDetails ? `, reason ${thread.stoppedDetails.reason}` : "",
                stackFrame.source ? stackFrame.source.name : "",
                stackFrame.range.startLineNumber
              ));
            }
          }
        }
      }
    }
    if (session) {
      this.debugType.set(session.configuration.type);
    } else {
      this.debugType.reset();
    }
    this.viewModel.setFocus(stackFrame, thread, session, !!options?.explicit);
  }
  //---- watches
  addWatchExpression(name) {
    const we = this.model.addWatchExpression(name);
    if (!name) {
      this.viewModel.setSelectedExpression(we, false);
    }
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  renameWatchExpression(id, newName) {
    this.model.renameWatchExpression(id, newName);
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  moveWatchExpression(id, position) {
    this.model.moveWatchExpression(id, position);
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  removeWatchExpressions(id) {
    this.model.removeWatchExpressions(id);
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  //---- breakpoints
  canSetBreakpointsIn(model) {
    return this.adapterManager.canSetBreakpointsIn(model);
  }
  async enableOrDisableBreakpoints(enable, breakpoint) {
    if (breakpoint) {
      this.model.setEnablement(breakpoint, enable);
      this.debugStorage.storeBreakpoints(this.model);
      if (breakpoint instanceof Breakpoint) {
        await this.makeTriggeredBreakpointsMatchEnablement(enable, breakpoint);
        await this.sendBreakpoints(breakpoint.originalUri);
      } else if (breakpoint instanceof FunctionBreakpoint) {
        await this.sendFunctionBreakpoints();
      } else if (breakpoint instanceof DataBreakpoint) {
        await this.sendDataBreakpoints();
      } else if (breakpoint instanceof InstructionBreakpoint) {
        await this.sendInstructionBreakpoints();
      } else {
        await this.sendExceptionBreakpoints();
      }
    } else {
      this.model.enableOrDisableAllBreakpoints(enable);
      this.debugStorage.storeBreakpoints(this.model);
      await this.sendAllBreakpoints();
    }
    this.debugStorage.storeBreakpoints(this.model);
  }
  async addBreakpoints(uri2, rawBreakpoints, ariaAnnounce = true) {
    const breakpoints = this.model.addBreakpoints(uri2, rawBreakpoints);
    if (ariaAnnounce) {
      breakpoints.forEach((bp) => aria.status(nls.localize("breakpointAdded", "Added breakpoint, line {0}, file {1}", bp.lineNumber, uri2.fsPath)));
    }
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendBreakpoints(uri2);
    this.debugStorage.storeBreakpoints(this.model);
    return breakpoints;
  }
  async updateBreakpoints(uri2, data, sendOnResourceSaved) {
    this.model.updateBreakpoints(data);
    this.debugStorage.storeBreakpoints(this.model);
    if (sendOnResourceSaved) {
      this.breakpointsToSendOnResourceSaved.add(uri2);
    } else {
      await this.sendBreakpoints(uri2);
      this.debugStorage.storeBreakpoints(this.model);
    }
  }
  async removeBreakpoints(id) {
    const breakpoints = this.model.getBreakpoints();
    const toRemove = id === void 0 ? breakpoints : id instanceof Array ? breakpoints.filter((bp) => id.includes(bp.getId())) : breakpoints.filter((bp) => bp.getId() === id);
    toRemove.forEach((bp) => aria.status(nls.localize("breakpointRemoved", "Removed breakpoint, line {0}, file {1}", bp.lineNumber, bp.uri.fsPath)));
    const urisToClear = new Set(toRemove.map((bp) => bp.originalUri.toString()));
    this.model.removeBreakpoints(toRemove);
    this.unlinkTriggeredBreakpoints(breakpoints, toRemove).forEach((uri2) => urisToClear.add(uri2.toString()));
    this.debugStorage.storeBreakpoints(this.model);
    await Promise.all([...urisToClear].map((uri2) => this.sendBreakpoints(URI.parse(uri2))));
  }
  setBreakpointsActivated(activated) {
    this.model.setBreakpointsActivated(activated);
    return this.sendAllBreakpoints();
  }
  async addFunctionBreakpoint(opts, id) {
    this.model.addFunctionBreakpoint(opts ?? { name: "" }, id);
    if (opts) {
      this.debugStorage.storeBreakpoints(this.model);
      await this.sendFunctionBreakpoints();
      this.debugStorage.storeBreakpoints(this.model);
    }
  }
  async updateFunctionBreakpoint(id, update) {
    this.model.updateFunctionBreakpoint(id, update);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendFunctionBreakpoints();
  }
  async removeFunctionBreakpoints(id) {
    this.model.removeFunctionBreakpoints(id);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendFunctionBreakpoints();
  }
  async addDataBreakpoint(opts) {
    this.model.addDataBreakpoint(opts);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendDataBreakpoints();
    this.debugStorage.storeBreakpoints(this.model);
  }
  async updateDataBreakpoint(id, update) {
    this.model.updateDataBreakpoint(id, update);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendDataBreakpoints();
  }
  async removeDataBreakpoints(id) {
    this.model.removeDataBreakpoints(id);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendDataBreakpoints();
  }
  async addInstructionBreakpoint(opts) {
    this.model.addInstructionBreakpoint(opts);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendInstructionBreakpoints();
    this.debugStorage.storeBreakpoints(this.model);
  }
  async removeInstructionBreakpoints(instructionReference, offset, address) {
    this.model.removeInstructionBreakpoints(instructionReference, offset, address);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendInstructionBreakpoints();
  }
  setExceptionBreakpointFallbackSession(sessionId) {
    this.model.setExceptionBreakpointFallbackSession(sessionId);
    this.debugStorage.storeBreakpoints(this.model);
  }
  setExceptionBreakpointsForSession(session, filters) {
    this.model.setExceptionBreakpointsForSession(session.getId(), filters);
    this.debugStorage.storeBreakpoints(this.model);
  }
  async setExceptionBreakpointCondition(exceptionBreakpoint, condition) {
    this.model.setExceptionBreakpointCondition(exceptionBreakpoint, condition);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendExceptionBreakpoints();
  }
  async sendAllBreakpoints(session) {
    const setBreakpointsPromises = distinct(this.model.getBreakpoints(), (bp) => bp.originalUri.toString()).map((bp) => this.sendBreakpoints(bp.originalUri, false, session));
    if (session?.capabilities.supportsConfigurationDoneRequest) {
      await Promise.all([
        ...setBreakpointsPromises,
        this.sendFunctionBreakpoints(session),
        this.sendDataBreakpoints(session),
        this.sendInstructionBreakpoints(session),
        this.sendExceptionBreakpoints(session)
      ]);
    } else {
      await Promise.all(setBreakpointsPromises);
      await this.sendFunctionBreakpoints(session);
      await this.sendDataBreakpoints(session);
      await this.sendInstructionBreakpoints(session);
      await this.sendExceptionBreakpoints(session);
    }
  }
  /**
   * Removes the condition of triggered breakpoints that depended on
   * breakpoints in `removedBreakpoints`. Returns the URIs of resources that
   * had their breakpoints changed in this way.
   */
  unlinkTriggeredBreakpoints(allBreakpoints, removedBreakpoints) {
    const affectedUris = [];
    for (const removed of removedBreakpoints) {
      for (const existing of allBreakpoints) {
        if (!removedBreakpoints.includes(existing) && existing.triggeredBy === removed.getId()) {
          this.model.updateBreakpoints(/* @__PURE__ */ new Map([[existing.getId(), { triggeredBy: void 0 }]]));
          affectedUris.push(existing.originalUri);
        }
      }
    }
    return affectedUris;
  }
  async makeTriggeredBreakpointsMatchEnablement(enable, breakpoint) {
    if (enable) {
      if (breakpoint.triggeredBy) {
        const trigger = this.model.getBreakpoints().find((bp) => breakpoint.triggeredBy === bp.getId());
        if (trigger && !trigger.enabled) {
          await this.enableOrDisableBreakpoints(enable, trigger);
        }
      }
    }
    await Promise.all(
      this.model.getBreakpoints().filter((bp) => bp.triggeredBy === breakpoint.getId() && bp.enabled !== enable).map((bp) => this.enableOrDisableBreakpoints(enable, bp))
    );
  }
  async sendBreakpoints(modelUri, sourceModified = false, session) {
    const breakpointsToSend = this.model.getBreakpoints({ originalUri: modelUri, enabledOnly: true });
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (!s.configuration.noDebug) {
        const sessionBps = breakpointsToSend.filter((bp) => !bp.triggeredBy || bp.getSessionDidTrigger(s.getId()));
        await s.sendBreakpoints(modelUri, sessionBps, sourceModified);
      }
    });
  }
  async sendFunctionBreakpoints(session) {
    const breakpointsToSend = this.model.getFunctionBreakpoints().filter((fbp) => fbp.enabled && this.model.areBreakpointsActivated());
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (s.capabilities.supportsFunctionBreakpoints && !s.configuration.noDebug) {
        await s.sendFunctionBreakpoints(breakpointsToSend);
      }
    });
  }
  async sendDataBreakpoints(session) {
    const breakpointsToSend = this.model.getDataBreakpoints().filter((fbp) => fbp.enabled && this.model.areBreakpointsActivated());
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (s.capabilities.supportsDataBreakpoints && !s.configuration.noDebug) {
        await s.sendDataBreakpoints(breakpointsToSend);
      }
    });
  }
  async sendInstructionBreakpoints(session) {
    const breakpointsToSend = this.model.getInstructionBreakpoints().filter((fbp) => fbp.enabled && this.model.areBreakpointsActivated());
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (s.capabilities.supportsInstructionBreakpoints && !s.configuration.noDebug) {
        await s.sendInstructionBreakpoints(breakpointsToSend);
      }
    });
  }
  sendExceptionBreakpoints(session) {
    return sendToOneOrAllSessions(this.model, session, async (s) => {
      const enabledExceptionBps = this.model.getExceptionBreakpointsForSession(s.getId()).filter((exb) => exb.enabled);
      if (s.capabilities.supportsConfigurationDoneRequest && (!s.capabilities.exceptionBreakpointFilters || s.capabilities.exceptionBreakpointFilters.length === 0)) {
        return;
      }
      if (!s.configuration.noDebug) {
        await s.sendExceptionBreakpoints(enabledExceptionBps);
      }
    });
  }
  onFileChanges(fileChangesEvent) {
    const toRemove = this.model.getBreakpoints().filter((bp) => fileChangesEvent.contains(bp.originalUri, FileChangeType.DELETED));
    if (toRemove.length) {
      this.model.removeBreakpoints(toRemove);
    }
    const toSend = [];
    for (const uri2 of this.breakpointsToSendOnResourceSaved) {
      if (fileChangesEvent.contains(uri2, FileChangeType.UPDATED)) {
        toSend.push(uri2);
      }
    }
    for (const uri2 of toSend) {
      this.breakpointsToSendOnResourceSaved.delete(uri2);
      this.sendBreakpoints(uri2, true);
    }
  }
  async runTo(uri2, lineNumber, column) {
    let breakpointToRemove;
    let threadToContinue = this.getViewModel().focusedThread;
    const addTempBreakPoint = async () => {
      const bpExists = !!this.getModel().getBreakpoints({ column, lineNumber, uri: uri2 }).length;
      if (!bpExists) {
        const addResult = await this.addAndValidateBreakpoints(uri2, lineNumber, column);
        if (addResult.thread) {
          threadToContinue = addResult.thread;
        }
        if (addResult.breakpoint) {
          breakpointToRemove = addResult.breakpoint;
        }
      }
      return { threadToContinue, breakpointToRemove };
    };
    const removeTempBreakPoint = (state) => {
      if (state === State.Stopped || state === State.Inactive) {
        if (breakpointToRemove) {
          this.removeBreakpoints(breakpointToRemove.getId());
        }
        return true;
      }
      return false;
    };
    await addTempBreakPoint();
    if (this.state === State.Inactive) {
      const { launch, name, getConfig } = this.getConfigurationManager().selectedConfiguration;
      const config = await getConfig();
      const configOrName = config ? Object.assign(deepClone(config), {}) : name;
      const listener = this.onDidChangeState((state) => {
        if (removeTempBreakPoint(state)) {
          listener.dispose();
        }
      });
      await this.startDebugging(launch, configOrName, void 0, true);
    }
    if (this.state === State.Stopped) {
      const focusedSession = this.getViewModel().focusedSession;
      if (!focusedSession || !threadToContinue) {
        return;
      }
      const listener = threadToContinue.session.onDidChangeState(() => {
        if (removeTempBreakPoint(focusedSession.state)) {
          listener.dispose();
        }
      });
      await threadToContinue.continue();
    }
  }
  async addAndValidateBreakpoints(uri2, lineNumber, column) {
    const debugModel = this.getModel();
    const viewModel = this.getViewModel();
    const breakpoints = await this.addBreakpoints(uri2, [{ lineNumber, column }], false);
    const breakpoint = breakpoints?.[0];
    if (!breakpoint) {
      return { breakpoint: void 0, thread: viewModel.focusedThread };
    }
    if (!breakpoint.verified) {
      let listener;
      await raceTimeout(new Promise((resolve) => {
        listener = debugModel.onDidChangeBreakpoints(() => {
          if (breakpoint.verified) {
            resolve();
          }
        });
      }), 2e3);
      listener.dispose();
    }
    let Score;
    ((Score2) => {
      Score2[Score2["Focused"] = 0] = "Focused";
      Score2[Score2["Verified"] = 1] = "Verified";
      Score2[Score2["VerifiedAndPausedInFile"] = 2] = "VerifiedAndPausedInFile";
      Score2[Score2["VerifiedAndFocused"] = 3] = "VerifiedAndFocused";
    })(Score || (Score = {}));
    let bestThread = viewModel.focusedThread;
    let bestScore = 0 /* Focused */;
    for (const sessionId of breakpoint.sessionsThatVerified) {
      const session = debugModel.getSession(sessionId);
      if (!session) {
        continue;
      }
      const threads = session.getAllThreads().filter((t) => t.stopped);
      if (bestScore < 3 /* VerifiedAndFocused */) {
        if (viewModel.focusedThread && threads.includes(viewModel.focusedThread)) {
          bestThread = viewModel.focusedThread;
          bestScore = 3 /* VerifiedAndFocused */;
        }
      }
      if (bestScore < 2 /* VerifiedAndPausedInFile */) {
        const pausedInThisFile = threads.find((t) => {
          const top = t.getTopStackFrame();
          return top && this.uriIdentityService.extUri.isEqual(top.source.uri, uri2);
        });
        if (pausedInThisFile) {
          bestThread = pausedInThisFile;
          bestScore = 2 /* VerifiedAndPausedInFile */;
        }
      }
      if (bestScore < 1 /* Verified */) {
        bestThread = threads[0];
        bestScore = 2 /* VerifiedAndPausedInFile */;
      }
    }
    return { thread: bestThread, breakpoint };
  }
};
DebugService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, IViewsService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, ILifecycleService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IFileService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IExtensionHostDebugService),
  __decorateParam(15, IActivityService),
  __decorateParam(16, ICommandService),
  __decorateParam(17, IQuickInputService),
  __decorateParam(18, IWorkspaceTrustRequestService),
  __decorateParam(19, IUriIdentityService),
  __decorateParam(20, ITestService)
], DebugService);
function getStackFrameThreadAndSessionToFocus(model, stackFrame, thread, session, avoidSession) {
  if (!session) {
    if (stackFrame || thread) {
      session = stackFrame ? stackFrame.thread.session : thread.session;
    } else {
      const sessions = model.getSessions();
      const stoppedSession = sessions.find((s) => s.state === State.Stopped);
      session = stoppedSession || sessions.find((s) => s !== avoidSession && s !== avoidSession?.parentSession) || (sessions.length ? sessions[0] : void 0);
    }
  }
  if (!thread) {
    if (stackFrame) {
      thread = stackFrame.thread;
    } else {
      const threads = session ? session.getAllThreads() : void 0;
      const stoppedThread = threads && threads.find((t) => t.stopped);
      thread = stoppedThread || (threads && threads.length ? threads[0] : void 0);
    }
  }
  if (!stackFrame && thread) {
    stackFrame = thread.getTopStackFrame();
  }
  return { session, thread, stackFrame };
}
async function sendToOneOrAllSessions(model, session, send) {
  if (session) {
    await send(session);
  } else {
    await Promise.all(model.getSessions().map((s) => send(s)));
  }
}
export {
  DebugService,
  getStackFrameThreadAndSessionToFocus
};
