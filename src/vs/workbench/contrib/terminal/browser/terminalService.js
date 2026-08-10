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
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import * as cssValue from "../../../../base/browser/cssValue.js";
import { DeferredPromise, timeout } from "../../../../base/common/async.js";
import { debounce, memoize } from "../../../../base/common/decorators.js";
import { DynamicListEventMultiplexer, Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isMacintosh, isWeb } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ITerminalLogService, TerminalExitReason, TerminalLocation, TerminalSettingId, TitleEventSource } from "../../../../platform/terminal/common/terminal.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { iconForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { isDark } from "../../../../platform/theme/common/theme.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { VirtualWorkspaceContext } from "../../../common/contextkeys.js";
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService, ITerminalService, TerminalConnectionState } from "./terminal.js";
import { getCwdForSplit } from "./terminalActions.js";
import { TerminalEditorInput } from "./terminalEditorInput.js";
import { getColorStyleContent, getUriClasses } from "./terminalIcon.js";
import { TerminalProfileQuickpick } from "./terminalProfileQuickpick.js";
import { getInstanceFromResource, getTerminalUri, parseTerminalUri } from "./terminalUri.js";
import { ITerminalProfileService } from "../common/terminal.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { columnToEditorGroup } from "../../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ILifecycleService, ShutdownReason, StartupKind } from "../../../services/lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { XtermTerminal } from "./xterm/xtermTerminal.js";
import { TerminalInstance } from "./terminalInstance.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { TerminalCapabilityStore } from "../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { mark } from "../../../../base/common/performance.js";
import { DetachedTerminal } from "./detachedTerminal.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { createInstanceCapabilityEventMultiplexer } from "./terminalEvents.js";
import { isAuxiliaryWindow, mainWindow } from "../../../../base/browser/window.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { hasKey, isString } from "../../../../base/common/types.js";
let TerminalService = class extends Disposable {
  constructor(_contextKeyService, _lifecycleService, _logService, _dialogService, _instantiationService, _remoteAgentService, _configurationService, _environmentService, _terminalConfigurationService, _terminalEditorService, _terminalGroupService, _terminalInstanceService, _editorGroupsService, _terminalProfileService, _extensionService, _notificationService, _workspaceContextService, _commandService, _keybindingService, _timerService, _themeService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._lifecycleService = _lifecycleService;
    this._logService = _logService;
    this._dialogService = _dialogService;
    this._instantiationService = _instantiationService;
    this._remoteAgentService = _remoteAgentService;
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalGroupService = _terminalGroupService;
    this._terminalInstanceService = _terminalInstanceService;
    this._editorGroupsService = _editorGroupsService;
    this._terminalProfileService = _terminalProfileService;
    this._extensionService = _extensionService;
    this._notificationService = _notificationService;
    this._workspaceContextService = _workspaceContextService;
    this._commandService = _commandService;
    this._keybindingService = _keybindingService;
    this._timerService = _timerService;
    this._themeService = _themeService;
    this._hostActiveTerminals = /* @__PURE__ */ new Map();
    this._detachedXterms = /* @__PURE__ */ new Set();
    this._detachedListenersRegistered = false;
    this._isShuttingDown = false;
    this._backgroundedTerminalInstances = [];
    this._backgroundedTerminalDisposables = this._register(new DisposableMap());
    this._connectionState = TerminalConnectionState.Connecting;
    this._whenConnected = new DeferredPromise();
    this._restoredGroupCount = 0;
    this._reconnectedTerminals = /* @__PURE__ */ new Map();
    this._onDidCreateInstance = this._register(new Emitter());
    this._onDidChangeInstanceDimensions = this._register(new Emitter());
    this._onDidRegisterProcessSupport = this._register(new Emitter());
    this._onDidChangeConnectionState = this._register(new Emitter());
    this._onDidRequestStartExtensionTerminal = this._register(new Emitter());
    // ITerminalInstanceHost events
    this._onDidDisposeInstance = this._register(new Emitter());
    this._onDidFocusInstance = this._register(new Emitter());
    this._onDidChangeActiveInstance = this._register(new Emitter());
    this._onDidChangeInstances = this._register(new Emitter());
    this._onDidChangeInstanceCapability = this._register(new Emitter());
    // Terminal view events
    this._onDidChangeActiveGroup = this._register(new Emitter());
    this._register(this.onDidCreateInstance(() => this._terminalProfileService.refreshAvailableProfiles()));
    this._forwardInstanceHostEvents(this._terminalGroupService);
    this._forwardInstanceHostEvents(this._terminalEditorService);
    this._register(this._terminalGroupService.onDidChangeActiveGroup(this._onDidChangeActiveGroup.fire, this._onDidChangeActiveGroup));
    this._register(this._terminalInstanceService.onDidCreateInstance((instance) => {
      this._initInstanceListeners(instance);
      this._onDidCreateInstance.fire(instance);
    }));
    this._register(this._terminalGroupService.onDidChangeActiveInstance((instance) => {
      if (!instance && !this._isShuttingDown && this._terminalConfigurationService.config.hideOnLastClosed) {
        this._terminalGroupService.hidePanel();
      }
      if (instance?.shellType) {
        this._terminalShellTypeContextKey.set(instance.shellType.toString());
      } else if (!instance || !instance.shellType) {
        this._terminalShellTypeContextKey.reset();
      }
    }));
    this._handleInstanceContextKeys();
    this._terminalShellTypeContextKey = TerminalContextKeys.shellType.bindTo(this._contextKeyService);
    this._processSupportContextKey = TerminalContextKeys.processSupported.bindTo(this._contextKeyService);
    this._processSupportContextKey.set(!isWeb || this._remoteAgentService.getConnection() !== null);
    this._terminalHasBeenCreated = TerminalContextKeys.terminalHasBeenCreated.bindTo(this._contextKeyService);
    this._terminalCountContextKey = TerminalContextKeys.count.bindTo(this._contextKeyService);
    this._register(_lifecycleService.onBeforeShutdown(async (e) => e.veto(this._onBeforeShutdown(e.reason), "veto.terminal")));
    this._register(_lifecycleService.onWillShutdown((e) => this._onWillShutdown(e)));
    this._initializePrimaryBackend();
    timeout(0).then(() => this._register(this._instantiationService.createInstance(TerminalEditorStyle, mainWindow.document.head)));
  }
  get isProcessSupportRegistered() {
    return !!this._processSupportContextKey.get();
  }
  get connectionState() {
    return this._connectionState;
  }
  get whenConnected() {
    return this._whenConnected.p;
  }
  get restoredGroupCount() {
    return this._restoredGroupCount;
  }
  get instances() {
    return this._terminalGroupService.instances.concat(this._terminalEditorService.instances).concat(this._backgroundedTerminalInstances.map((bg) => bg.instance));
  }
  /** Gets all non-background terminals. */
  get foregroundInstances() {
    return this._terminalGroupService.instances.concat(this._terminalEditorService.instances);
  }
  get detachedInstances() {
    return this._detachedXterms;
  }
  getReconnectedTerminals(reconnectionOwner) {
    return this._reconnectedTerminals.get(reconnectionOwner);
  }
  get activeInstance() {
    for (const activeHostTerminal of this._hostActiveTerminals.values()) {
      if (activeHostTerminal?.hasFocus) {
        return activeHostTerminal;
      }
    }
    return this._activeInstance;
  }
  get onDidCreateInstance() {
    return this._onDidCreateInstance.event;
  }
  get onDidChangeInstanceDimensions() {
    return this._onDidChangeInstanceDimensions.event;
  }
  get onDidRegisterProcessSupport() {
    return this._onDidRegisterProcessSupport.event;
  }
  get onDidChangeConnectionState() {
    return this._onDidChangeConnectionState.event;
  }
  get onDidRequestStartExtensionTerminal() {
    return this._onDidRequestStartExtensionTerminal.event;
  }
  get onDidDisposeInstance() {
    return this._onDidDisposeInstance.event;
  }
  get onDidFocusInstance() {
    return this._onDidFocusInstance.event;
  }
  get onDidChangeActiveInstance() {
    return this._onDidChangeActiveInstance.event;
  }
  get onDidChangeInstances() {
    return this._onDidChangeInstances.event;
  }
  get onDidChangeInstanceCapability() {
    return this._onDidChangeInstanceCapability.event;
  }
  get onDidChangeActiveGroup() {
    return this._onDidChangeActiveGroup.event;
  }
  get onAnyInstanceData() {
    return this._register(this.createOnInstanceEvent((instance) => Event.map(instance.onData, (data) => ({ instance, data })))).event;
  }
  get onAnyInstanceDataInput() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.onDidInputData, () => e, e.store))).event;
  }
  get onAnyInstanceIconChange() {
    return this._register(this.createOnInstanceEvent((e) => e.onIconChanged)).event;
  }
  get onAnyInstanceMaximumDimensionsChange() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.onMaximumDimensionsChanged, () => e, e.store))).event;
  }
  get onAnyInstancePrimaryStatusChange() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.statusList.onDidChangePrimaryStatus, () => e, e.store))).event;
  }
  get onAnyInstanceProcessIdReady() {
    return this._register(this.createOnInstanceEvent((e) => e.onProcessIdReady)).event;
  }
  get onAnyInstanceSelectionChange() {
    return this._register(this.createOnInstanceEvent((e) => e.onDidChangeSelection)).event;
  }
  get onAnyInstanceTitleChange() {
    return this._register(this.createOnInstanceEvent((e) => e.onTitleChanged)).event;
  }
  get onAnyInstanceShellTypeChanged() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.onDidChangeShellType, () => e))).event;
  }
  get onAnyInstanceAddedCapabilityType() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.capabilities.onDidAddCapability, (e2) => e2.id))).event;
  }
  async showProfileQuickPick(type, cwd) {
    const quickPick = this._instantiationService.createInstance(TerminalProfileQuickpick);
    const result = await quickPick.showAndGetResult(type);
    if (!result) {
      return;
    }
    if (isString(result)) {
      return;
    }
    const keyMods = result.keyMods;
    if (type === "createInstance") {
      const activeInstance = this.getDefaultInstanceHost().activeInstance;
      const defaultLocation = this._terminalConfigurationService.defaultLocation;
      let instance;
      if (result.config && hasKey(result.config, { id: true })) {
        await this.createContributedTerminalProfile(result.config.extensionIdentifier, result.config.id, {
          icon: result.config.options?.icon,
          color: result.config.options?.color,
          location: !!(keyMods?.alt && activeInstance) ? { splitActiveTerminal: true } : defaultLocation,
          titleTemplate: result.config.titleTemplate
        });
        return;
      } else if (result.config && hasKey(result.config, { profileName: true })) {
        if (keyMods?.alt && activeInstance) {
          instance = await this.createTerminal({ location: { parentTerminal: activeInstance }, config: result.config, cwd });
        } else {
          instance = await this.createTerminal({ location: defaultLocation, config: result.config, cwd });
        }
      }
      if (instance && defaultLocation !== TerminalLocation.Editor) {
        this._terminalGroupService.showPanel(true);
        this.setActiveInstance(instance);
        return instance;
      }
    }
    return void 0;
  }
  async _initializePrimaryBackend() {
    mark("code/terminal/willGetTerminalBackend");
    this._primaryBackend = await this._terminalInstanceService.getBackend(this._environmentService.remoteAuthority);
    mark("code/terminal/didGetTerminalBackend");
    const enableTerminalReconnection = this._terminalConfigurationService.config.enablePersistentSessions;
    this._connectionState = TerminalConnectionState.Connecting;
    const isPersistentRemote = !!this._environmentService.remoteAuthority && enableTerminalReconnection;
    if (this._primaryBackend) {
      this._register(this._primaryBackend.onDidRequestDetach(async (e) => {
        const instanceToDetach = this.getInstanceFromResource(getTerminalUri(e.workspaceId, e.instanceId));
        if (instanceToDetach) {
          const persistentProcessId = instanceToDetach?.persistentProcessId;
          if (persistentProcessId && !instanceToDetach.shellLaunchConfig.isFeatureTerminal && !instanceToDetach.shellLaunchConfig.customPtyImplementation) {
            if (instanceToDetach.target === TerminalLocation.Editor) {
              this._terminalEditorService.detachInstance(instanceToDetach);
            } else {
              this._terminalGroupService.getGroupForInstance(instanceToDetach)?.removeInstance(instanceToDetach);
            }
            await instanceToDetach.detachProcessAndDispose(TerminalExitReason.User);
            await this._primaryBackend?.acceptDetachInstanceReply(e.requestId, persistentProcessId);
          } else {
            await this._primaryBackend?.acceptDetachInstanceReply(e.requestId, void 0);
          }
        }
      }));
    }
    mark("code/terminal/willReconnect");
    let reconnectedPromise;
    if (isPersistentRemote) {
      reconnectedPromise = this._reconnectToRemoteTerminals();
    } else if (enableTerminalReconnection) {
      reconnectedPromise = this._reconnectToLocalTerminals();
    } else {
      reconnectedPromise = Promise.resolve();
    }
    reconnectedPromise.then(async () => {
      this._setConnected();
      mark("code/terminal/didReconnect");
      mark("code/terminal/willReplay");
      const instances = await this._reconnectedTerminalGroups?.then((groups) => groups.map((e) => e.terminalInstances).flat()) ?? [];
      await Promise.all(instances.map((e) => new Promise((r) => Event.once(e.onProcessReplayComplete)(r))));
      mark("code/terminal/didReplay");
      mark("code/terminal/willGetPerformanceMarks");
      await Promise.all(Array.from(this._terminalInstanceService.getRegisteredBackends()).map(async (backend) => {
        this._timerService.setPerformanceMarks(backend.remoteAuthority === void 0 ? "localPtyHost" : "remotePtyHost", await backend.getPerformanceMarks());
        backend.setReady();
      }));
      mark("code/terminal/didGetPerformanceMarks");
      this._whenConnected.complete();
    });
  }
  getPrimaryBackend() {
    return this._primaryBackend;
  }
  async setNextCommandId(id, commandLine, commandId) {
    if (!this._primaryBackend || id <= 0) {
      return;
    }
    await this._primaryBackend.setNextCommandId(id, commandLine, commandId);
  }
  _forwardInstanceHostEvents(host) {
    this._register(host.onDidChangeInstances(this._onDidChangeInstances.fire, this._onDidChangeInstances));
    this._register(host.onDidDisposeInstance(this._onDidDisposeInstance.fire, this._onDidDisposeInstance));
    this._register(host.onDidChangeActiveInstance((instance) => this._evaluateActiveInstance(host, instance)));
    this._register(host.onDidFocusInstance((instance) => {
      this._onDidFocusInstance.fire(instance);
      this._evaluateActiveInstance(host, instance);
    }));
    this._register(host.onDidChangeInstanceCapability((instance) => {
      this._onDidChangeInstanceCapability.fire(instance);
    }));
    this._hostActiveTerminals.set(host, void 0);
  }
  _evaluateActiveInstance(host, instance) {
    this._hostActiveTerminals.set(host, instance);
    if (instance === void 0) {
      for (const active of this._hostActiveTerminals.values()) {
        if (active) {
          instance = active;
        }
      }
    }
    this._activeInstance = instance;
    this._onDidChangeActiveInstance.fire(instance);
  }
  setActiveInstance(value) {
    if (!value) {
      return;
    }
    if (value.shellLaunchConfig.hideFromUser) {
      this.showBackgroundTerminal(value);
    }
    if (value.target === TerminalLocation.Editor) {
      this._terminalEditorService.setActiveInstance(value);
    } else {
      this._terminalGroupService.setActiveInstance(value);
    }
  }
  async focusInstance(instance) {
    if (this._activeInstance !== instance) {
      this.setActiveInstance(instance);
    }
    if (instance.target === TerminalLocation.Editor) {
      await this._terminalEditorService.focusInstance(instance);
      return;
    }
    await this._terminalGroupService.focusInstance(instance);
  }
  async focusActiveInstance() {
    if (!this._activeInstance) {
      return;
    }
    return this.focusInstance(this._activeInstance);
  }
  async createContributedTerminalProfile(extensionIdentifier, id, options) {
    await this._extensionService.activateByEvent(`onTerminalProfile:${id}`);
    const profileProvider = this._terminalProfileService.getContributedProfileProvider(extensionIdentifier, id);
    if (!profileProvider) {
      this._notificationService.error(`No terminal profile provider registered for id "${id}"`);
      return;
    }
    try {
      await profileProvider.createContributedTerminalProfile(options);
      this._terminalGroupService.setActiveInstanceByIndex(this._terminalGroupService.instances.length - 1);
      await this._terminalGroupService.activeInstance?.focusWhenReady();
    } catch (e) {
      this._notificationService.error(e.message);
    }
  }
  async safeDisposeTerminal(instance) {
    if (instance.target !== TerminalLocation.Editor && instance.hasChildProcesses && (this._terminalConfigurationService.config.confirmOnKill === "panel" || this._terminalConfigurationService.config.confirmOnKill === "always")) {
      const veto = await this._showTerminalCloseConfirmation(true);
      if (veto) {
        return;
      }
    }
    return new Promise((r) => {
      Event.once(instance.onExit)(() => r());
      instance.dispose(TerminalExitReason.User);
    });
  }
  _setConnected() {
    this._connectionState = TerminalConnectionState.Connected;
    this._onDidChangeConnectionState.fire();
    this._logService.trace("Pty host ready");
  }
  async _reconnectToRemoteTerminals() {
    const remoteAuthority = this._environmentService.remoteAuthority;
    if (!remoteAuthority) {
      return;
    }
    const backend = await this._terminalInstanceService.getBackend(remoteAuthority);
    if (!backend) {
      return;
    }
    mark("code/terminal/willGetTerminalLayoutInfo");
    const layoutInfo = await backend.getTerminalLayoutInfo();
    mark("code/terminal/didGetTerminalLayoutInfo");
    backend.reduceConnectionGraceTime();
    mark("code/terminal/willRecreateTerminalGroups");
    await this._recreateTerminalGroups(layoutInfo);
    mark("code/terminal/didRecreateTerminalGroups");
    this._attachProcessLayoutListeners();
    this._logService.trace("Reconnected to remote terminals");
  }
  async _reconnectToLocalTerminals() {
    const localBackend = await this._terminalInstanceService.getBackend();
    if (!localBackend) {
      return;
    }
    mark("code/terminal/willGetTerminalLayoutInfo");
    const layoutInfo = await localBackend.getTerminalLayoutInfo();
    mark("code/terminal/didGetTerminalLayoutInfo");
    if (layoutInfo && (layoutInfo.tabs.length > 0 || layoutInfo?.background?.length)) {
      mark("code/terminal/willRecreateTerminalGroups");
      this._reconnectedTerminalGroups = this._recreateTerminalGroups(layoutInfo);
      const revivedInstances = await this._reviveBackgroundTerminalInstances(layoutInfo.background || []);
      this._backgroundedTerminalInstances = revivedInstances.map((instance) => ({ instance }));
      mark("code/terminal/didRecreateTerminalGroups");
    }
    this._attachProcessLayoutListeners();
    this._logService.trace("Reconnected to local terminals");
  }
  _recreateTerminalGroups(layoutInfo) {
    const groupPromises = [];
    let activeGroup;
    if (layoutInfo) {
      for (const tabLayout of layoutInfo.tabs) {
        const terminalLayouts = tabLayout.terminals.filter((t) => t.terminal && t.terminal.isOrphan);
        if (terminalLayouts.length) {
          this._restoredGroupCount += terminalLayouts.length;
          const promise = this._recreateTerminalGroup(tabLayout, terminalLayouts);
          groupPromises.push(promise);
          if (tabLayout.isActive) {
            activeGroup = promise;
          }
          const activeInstance = this.instances.find((t) => t.shellLaunchConfig.attachPersistentProcess?.id === tabLayout.activePersistentProcessId);
          if (activeInstance) {
            this.setActiveInstance(activeInstance);
          }
        }
      }
      if (layoutInfo.tabs.length) {
        activeGroup?.then((group) => this._terminalGroupService.activeGroup = group);
      }
    }
    return Promise.all(groupPromises).then((result) => result.filter((e) => !!e));
  }
  async _reviveBackgroundTerminalInstances(bgTerminals) {
    const instances = [];
    for (const bg of bgTerminals) {
      const attachPersistentProcess = bg;
      if (!attachPersistentProcess) {
        continue;
      }
      const instance = await this.createTerminal({ config: { attachPersistentProcess, hideFromUser: true, forcePersist: true }, location: TerminalLocation.Panel });
      instances.push(instance);
    }
    return instances;
  }
  async _recreateTerminalGroup(tabLayout, terminalLayouts) {
    let lastInstance;
    for (const terminalLayout of terminalLayouts) {
      const attachPersistentProcess = terminalLayout.terminal;
      if (this._lifecycleService.startupKind !== StartupKind.ReloadedWindow && attachPersistentProcess.type === "Task") {
        continue;
      }
      mark(`code/terminal/willRecreateTerminal/${attachPersistentProcess.id}-${attachPersistentProcess.pid}`);
      lastInstance = this.createTerminal({
        config: { attachPersistentProcess },
        location: lastInstance ? { parentTerminal: lastInstance } : TerminalLocation.Panel
      });
      lastInstance.then(() => mark(`code/terminal/didRecreateTerminal/${attachPersistentProcess.id}-${attachPersistentProcess.pid}`));
    }
    const group = lastInstance?.then((instance) => {
      const g = this._terminalGroupService.getGroupForInstance(instance);
      g?.resizePanes(tabLayout.terminals.map((terminal) => terminal.relativeSize));
      return g;
    });
    return group;
  }
  _attachProcessLayoutListeners() {
    this._register(this.onDidChangeActiveGroup(() => this._saveState()));
    this._register(this.onDidChangeActiveInstance(() => this._saveState()));
    this._register(this.onDidChangeInstances(() => this._saveState()));
    this._register(this.onAnyInstanceProcessIdReady(() => this._saveState()));
    this._register(this.onAnyInstanceTitleChange((instance) => this._updateTitle(instance)));
    this._register(this.onAnyInstanceIconChange((e) => this._updateIcon(e.instance, e.userInitiated)));
  }
  _handleInstanceContextKeys() {
    const terminalIsOpenContext = TerminalContextKeys.isOpen.bindTo(this._contextKeyService);
    const updateTerminalContextKeys = () => {
      terminalIsOpenContext.set(this.instances.length > 0);
      this._terminalCountContextKey.set(this.instances.length);
    };
    this._register(this.onDidChangeInstances(() => updateTerminalContextKeys()));
  }
  async getActiveOrCreateInstance(options) {
    const activeInstance = this.activeInstance;
    if (!activeInstance) {
      return this.createTerminal();
    }
    if (!options?.acceptsInput || activeInstance.xterm?.isStdinDisabled !== true) {
      return activeInstance;
    }
    const instance = await this.createTerminal();
    this.setActiveInstance(instance);
    await this.revealActiveTerminal();
    return instance;
  }
  async revealTerminal(source, preserveFocus) {
    if (source.target === TerminalLocation.Editor) {
      await this._terminalEditorService.revealActiveEditor(preserveFocus);
    } else {
      await this._terminalGroupService.showPanel();
    }
  }
  async revealActiveTerminal(preserveFocus) {
    const instance = this.activeInstance;
    if (!instance) {
      return;
    }
    await this.revealTerminal(instance, preserveFocus);
  }
  requestStartExtensionTerminal(proxy, cols, rows) {
    return new Promise((callback) => {
      this._onDidRequestStartExtensionTerminal.fire({ proxy, cols, rows, callback });
    });
  }
  _onBeforeShutdown(reason) {
    if (isWeb) {
      this._isShuttingDown = true;
      return false;
    }
    return this._onBeforeShutdownAsync(reason);
  }
  async _onBeforeShutdownAsync(reason) {
    if (this.instances.length === 0) {
      return false;
    }
    try {
      this._shutdownWindowCount = await this._nativeDelegate?.getWindowCount();
      const shouldReviveProcesses = this._shouldReviveProcesses(reason);
      if (shouldReviveProcesses) {
        await Promise.race([
          this._primaryBackend?.persistTerminalState(),
          timeout(2e3)
        ]);
      }
      const shouldPersistProcesses = this._terminalConfigurationService.config.enablePersistentSessions && reason === ShutdownReason.RELOAD;
      if (!shouldPersistProcesses) {
        const hasDirtyInstances = this._terminalConfigurationService.config.confirmOnExit === "always" && this.foregroundInstances.length > 0 || this._terminalConfigurationService.config.confirmOnExit === "hasChildProcesses" && this.foregroundInstances.some((e) => e.hasChildProcesses);
        if (hasDirtyInstances) {
          return this._onBeforeShutdownConfirmation(reason);
        }
      }
    } catch (err) {
      this._logService.warn("Exception occurred during terminal shutdown", err);
    }
    this._isShuttingDown = true;
    return false;
  }
  setNativeDelegate(nativeDelegate) {
    this._nativeDelegate = nativeDelegate;
  }
  _shouldReviveProcesses(reason) {
    if (!this._terminalConfigurationService.config.enablePersistentSessions) {
      return false;
    }
    switch (this._terminalConfigurationService.config.persistentSessionReviveProcess) {
      case "onExit": {
        if (reason === ShutdownReason.CLOSE && (this._shutdownWindowCount === 1 && !isMacintosh)) {
          return true;
        }
        return reason === ShutdownReason.LOAD || reason === ShutdownReason.QUIT;
      }
      case "onExitAndWindowClose":
        return reason !== ShutdownReason.RELOAD;
      default:
        return false;
    }
  }
  async _onBeforeShutdownConfirmation(reason) {
    const veto = await this._showTerminalCloseConfirmation();
    if (!veto) {
      this._isShuttingDown = true;
    }
    return veto;
  }
  _onWillShutdown(e) {
    const shouldPersistTerminals = this._terminalConfigurationService.config.enablePersistentSessions && e.reason === ShutdownReason.RELOAD;
    for (const instance of [...this._terminalGroupService.instances, ...this._backgroundedTerminalInstances.map((bg) => bg.instance)]) {
      if (shouldPersistTerminals && instance.shouldPersist) {
        instance.detachProcessAndDispose(TerminalExitReason.Shutdown);
      } else {
        instance.dispose(TerminalExitReason.Shutdown);
      }
    }
    if (!shouldPersistTerminals && !this._shouldReviveProcesses(e.reason)) {
      this._primaryBackend?.setTerminalLayoutInfo(void 0);
    }
  }
  _saveState() {
    if (this._isShuttingDown) {
      return;
    }
    if (!this._terminalConfigurationService.config.enablePersistentSessions) {
      return;
    }
    const tabs = this._terminalGroupService.groups.map((g) => g.getLayoutInfo(g === this._terminalGroupService.activeGroup));
    const state = { tabs, background: this._backgroundedTerminalInstances.map((bg) => bg.instance).filter((i) => i.shellLaunchConfig.forcePersist).map((i) => i.persistentProcessId).filter((e) => e !== void 0) };
    this._primaryBackend?.setTerminalLayoutInfo(state);
  }
  _updateTitle(instance) {
    if (!this._terminalConfigurationService.config.enablePersistentSessions || !instance || instance.shellLaunchConfig.customPtyImplementation || !instance.persistentProcessId || !instance.title || instance.isDisposed) {
      return;
    }
    if (instance.staticTitle) {
      this._primaryBackend?.updateTitle(instance.persistentProcessId, instance.staticTitle, TitleEventSource.Api);
    } else {
      this._primaryBackend?.updateTitle(instance.persistentProcessId, instance.title, instance.titleSource);
    }
  }
  _updateIcon(instance, userInitiated) {
    if (!this._terminalConfigurationService.config.enablePersistentSessions || !instance || instance.shellLaunchConfig.customPtyImplementation || !instance.persistentProcessId || !instance.icon || instance.isDisposed) {
      return;
    }
    this._primaryBackend?.updateIcon(instance.persistentProcessId, userInitiated, instance.icon, instance.color);
  }
  refreshActiveGroup() {
    this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
  }
  getInstanceFromId(terminalId) {
    let bgIndex = -1;
    this._backgroundedTerminalInstances.forEach((bg, i) => {
      if (bg.instance.instanceId === terminalId) {
        bgIndex = i;
      }
    });
    if (bgIndex !== -1) {
      return this._backgroundedTerminalInstances[bgIndex].instance;
    }
    try {
      return this.instances[this._getIndexFromId(terminalId)];
    } catch {
      return void 0;
    }
  }
  getInstanceFromResource(resource) {
    return getInstanceFromResource(this.instances, resource);
  }
  openResource(resource) {
    const instance = this.getInstanceFromResource(resource);
    if (instance) {
      this.setActiveInstance(instance);
      this.revealTerminal(instance);
      const commands = instance.capabilities.get(TerminalCapability.CommandDetection)?.commands;
      const params = new URLSearchParams(resource.query);
      const relevantCommand = commands?.find((c) => c.id === params.get("command"));
      if (relevantCommand) {
        instance.xterm?.markTracker.revealCommand(relevantCommand);
      }
    }
  }
  isAttachedToTerminal(remoteTerm) {
    return this.instances.some((term) => term.processId === remoteTerm.pid);
  }
  moveToEditor(source, group) {
    if (source.target === TerminalLocation.Editor) {
      return;
    }
    const sourceGroup = this._terminalGroupService.getGroupForInstance(source);
    if (!sourceGroup) {
      return;
    }
    sourceGroup.removeInstance(source);
    this._terminalEditorService.openEditor(source, group ? { viewColumn: group } : void 0);
  }
  moveIntoNewEditor(source) {
    this.moveToEditor(source, AUX_WINDOW_GROUP);
  }
  async moveToTerminalView(source, target, side) {
    if (URI.isUri(source)) {
      source = this.getInstanceFromResource(source);
    }
    if (!source) {
      return;
    }
    this._terminalEditorService.detachInstance(source);
    if (source.target !== TerminalLocation.Editor) {
      await this._terminalGroupService.showPanel(true);
      return;
    }
    source.target = TerminalLocation.Panel;
    let group;
    if (target) {
      group = this._terminalGroupService.getGroupForInstance(target);
    }
    if (!group) {
      group = this._terminalGroupService.createGroup();
    }
    group.addInstance(source);
    this.setActiveInstance(source);
    await this._terminalGroupService.showPanel(true);
    if (target && side) {
      const index = group.terminalInstances.indexOf(target) + (side === "after" ? 1 : 0);
      group.moveInstance(source, index, side);
    }
    this._onDidChangeInstances.fire();
    this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
  }
  _initInstanceListeners(instance) {
    const instanceDisposables = new DisposableStore();
    instanceDisposables.add(instance.onDimensionsChanged(() => {
      this._onDidChangeInstanceDimensions.fire(instance);
      if (this._terminalConfigurationService.config.enablePersistentSessions && this.isProcessSupportRegistered) {
        this._saveState();
      }
    }));
    instanceDisposables.add(instance.onDidFocus(this._onDidChangeActiveInstance.fire, this._onDidChangeActiveInstance));
    instanceDisposables.add(instance.onRequestAddInstanceToGroup(async (e) => await this._addInstanceToGroup(instance, e)));
    instanceDisposables.add(instance.onDidChangeShellType(() => this._extensionService.activateByEvent(`onTerminal:${instance.shellType}`)));
    instanceDisposables.add(Event.runAndSubscribe(instance.capabilities.onDidAddCapability, (() => {
      if (instance.capabilities.has(TerminalCapability.CommandDetection)) {
        this._extensionService.activateByEvent(`onTerminalShellIntegration:${instance.shellType}`);
      }
    })));
    const disposeListener = this._register(instance.onDisposed(() => {
      instanceDisposables.dispose();
      this._store.delete(disposeListener);
    }));
  }
  async _addInstanceToGroup(instance, e) {
    const terminalIdentifier = parseTerminalUri(e.uri);
    if (terminalIdentifier.instanceId === void 0) {
      return;
    }
    let sourceInstance = this.getInstanceFromResource(e.uri);
    if (!sourceInstance) {
      const attachPersistentProcess = await this._primaryBackend?.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId);
      if (attachPersistentProcess) {
        sourceInstance = await this.createTerminal({ config: { attachPersistentProcess }, resource: e.uri });
        this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
        return;
      }
    }
    sourceInstance = this._terminalGroupService.getInstanceFromResource(e.uri);
    if (sourceInstance) {
      this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
      return;
    }
    sourceInstance = this._terminalEditorService.getInstanceFromResource(e.uri);
    if (sourceInstance) {
      this.moveToTerminalView(sourceInstance, instance, e.side);
      return;
    }
    return;
  }
  registerProcessSupport(isSupported) {
    if (!isSupported) {
      return;
    }
    this._processSupportContextKey.set(isSupported);
    this._onDidRegisterProcessSupport.fire();
  }
  // TODO: Remove this, it should live in group/editor servioce
  _getIndexFromId(terminalId) {
    let terminalIndex = -1;
    this.instances.forEach((terminalInstance, i) => {
      if (terminalInstance.instanceId === terminalId) {
        terminalIndex = i;
      }
    });
    if (terminalIndex === -1) {
      throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
    }
    return terminalIndex;
  }
  async _showTerminalCloseConfirmation(singleTerminal) {
    let message;
    const foregroundInstances = this.foregroundInstances;
    if (foregroundInstances.length === 1 || singleTerminal) {
      message = nls.localize("terminalService.terminalCloseConfirmationSingular", "Do you want to terminate the active terminal session?");
    } else {
      message = nls.localize("terminalService.terminalCloseConfirmationPlural", "Do you want to terminate the {0} active terminal sessions?", foregroundInstances.length);
    }
    const { confirmed } = await this._dialogService.confirm({
      type: "warning",
      message,
      primaryButton: nls.localize({ key: "terminate", comment: ["&& denotes a mnemonic"] }, "&&Terminate")
    });
    return !confirmed;
  }
  getDefaultInstanceHost() {
    if (this._terminalConfigurationService.defaultLocation === TerminalLocation.Editor) {
      return this._terminalEditorService;
    }
    return this._terminalGroupService;
  }
  async getInstanceHost(location) {
    if (location) {
      if (location === TerminalLocation.Editor) {
        return this._terminalEditorService;
      } else if (typeof location === "object") {
        if (hasKey(location, { viewColumn: true })) {
          return this._terminalEditorService;
        } else if (hasKey(location, { parentTerminal: true })) {
          return (await location.parentTerminal).target === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
        }
      } else {
        return this._terminalGroupService;
      }
    }
    return this;
  }
  async createTerminal(options) {
    const isLocalInRemoteTerminal = this._remoteAgentService.getConnection() && URI.isUri(options?.cwd) && options?.cwd.scheme === Schemas.file;
    if (this._terminalProfileService.availableProfiles.length === 0) {
      const isPtyTerminal = options?.config && hasKey(options.config, { customPtyImplementation: true });
      if (!isPtyTerminal && !isLocalInRemoteTerminal) {
        if (this._connectionState === TerminalConnectionState.Connecting) {
          mark(`code/terminal/willGetProfiles`);
        }
        await this._terminalProfileService.profilesReady;
        if (this._connectionState === TerminalConnectionState.Connecting) {
          mark(`code/terminal/didGetProfiles`);
        }
      }
    }
    let config = options?.config;
    if (!config && isLocalInRemoteTerminal) {
      const backend = await this._terminalInstanceService.getBackend(void 0);
      const executable = await backend?.getDefaultSystemShell();
      if (executable) {
        config = { executable };
      }
    }
    if (!config) {
      config = this._terminalProfileService.getDefaultProfile();
    }
    const shellLaunchConfig = config && hasKey(config, { extensionIdentifier: true }) ? {} : this._terminalInstanceService.convertProfileToShellLaunchConfig(config || {});
    const contributedProfile = options?.skipContributedProfileCheck ? void 0 : await this._getContributedProfile(shellLaunchConfig, options);
    const splitActiveTerminal = typeof options?.location === "object" && hasKey(options.location, { splitActiveTerminal: true }) ? options.location.splitActiveTerminal : typeof options?.location === "object" ? hasKey(options.location, { parentTerminal: true }) : false;
    await this._resolveCwd(shellLaunchConfig, splitActiveTerminal, options);
    if (!shellLaunchConfig.customPtyImplementation && contributedProfile) {
      const resolvedLocation = await this.resolveLocation(options?.location);
      let location2;
      if (splitActiveTerminal) {
        location2 = resolvedLocation === TerminalLocation.Editor ? { viewColumn: SIDE_GROUP } : { splitActiveTerminal: true };
      } else {
        location2 = typeof options?.location === "object" && hasKey(options.location, { viewColumn: true }) ? options.location : resolvedLocation;
      }
      await this.createContributedTerminalProfile(contributedProfile.extensionIdentifier, contributedProfile.id, {
        icon: contributedProfile.icon,
        color: contributedProfile.color,
        location: location2,
        cwd: shellLaunchConfig.cwd,
        titleTemplate: contributedProfile.titleTemplate
      });
      const instanceHost = resolvedLocation === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
      const instance2 = instanceHost.instances[instanceHost.instances.length - 1];
      await instance2?.focusWhenReady();
      this._terminalHasBeenCreated.set(true);
      return instance2;
    }
    if (!shellLaunchConfig.customPtyImplementation && !this.isProcessSupportRegistered) {
      const resolvedLocation = await this.resolveLocation(options?.location);
      let location2;
      if (splitActiveTerminal) {
        location2 = resolvedLocation === TerminalLocation.Editor ? { viewColumn: SIDE_GROUP } : { splitActiveTerminal: true };
      } else {
        location2 = typeof options?.location === "object" && hasKey(options.location, { viewColumn: true }) ? options.location : resolvedLocation;
      }
      const instanceHost = resolvedLocation === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
      for (const fallbackProfile of this._terminalProfileService.contributedProfiles) {
        const instanceCount = instanceHost.instances.length;
        await this.createContributedTerminalProfile(fallbackProfile.extensionIdentifier, fallbackProfile.id, {
          icon: fallbackProfile.icon,
          color: fallbackProfile.color,
          location: location2,
          cwd: shellLaunchConfig.cwd,
          titleTemplate: fallbackProfile.titleTemplate
        });
        const instance2 = instanceHost.instances[instanceCount];
        if (!instance2) {
          continue;
        }
        await instance2.focusWhenReady();
        this._terminalHasBeenCreated.set(true);
        return instance2;
      }
      throw new Error("Could not create terminal when process support is not registered");
    }
    this._evaluateLocalCwd(shellLaunchConfig);
    const location = await this.resolveLocation(options?.location) || this._terminalConfigurationService.defaultLocation;
    if (shellLaunchConfig.hideFromUser) {
      const instance2 = this._terminalInstanceService.createInstance(shellLaunchConfig, location);
      this._backgroundedTerminalInstances.push({ instance: instance2, terminalLocationOptions: options?.location });
      this._backgroundedTerminalDisposables.set(instance2.instanceId, instance2.onDisposed((instance3) => this._onBackgroundTerminalDisposed(instance3)));
      this._onDidChangeInstances.fire();
      return instance2;
    }
    const parent = await this._getSplitParent(options?.location);
    this._terminalHasBeenCreated.set(true);
    this._extensionService.activateByEvent("onTerminal:*");
    let instance;
    if (parent) {
      instance = await this._splitTerminal(shellLaunchConfig, location, parent);
    } else {
      instance = this._createTerminal(shellLaunchConfig, location, options);
    }
    if (instance.shellType) {
      this._extensionService.activateByEvent(`onTerminal:${instance.shellType}`);
    }
    return instance;
  }
  async createAndFocusTerminal(options) {
    const instance = await this.createTerminal(options);
    this.setActiveInstance(instance);
    await instance.focusWhenReady();
    return instance;
  }
  async _getContributedProfile(shellLaunchConfig, options) {
    if (options?.config && hasKey(options.config, { extensionIdentifier: true })) {
      return options.config;
    }
    return this._terminalProfileService.getContributedDefaultProfile(shellLaunchConfig);
  }
  async createDetachedTerminal(options) {
    const ctor = await TerminalInstance.getXtermConstructor(this._keybindingService, this._contextKeyService);
    const capabilities = options.capabilities ?? new TerminalCapabilityStore();
    const xterm = this._instantiationService.createInstance(XtermTerminal, void 0, ctor, {
      cols: options.cols,
      rows: options.rows,
      xtermColorProvider: options.colorProvider,
      capabilities,
      disableOverviewRuler: options.disableOverviewRuler,
      detached: true
    }, void 0);
    if (options.readonly) {
      xterm.raw.attachCustomKeyEventHandler(() => false);
    }
    const instance = new DetachedTerminal(xterm, { ...options, capabilities }, this._instantiationService);
    this._detachedXterms.add(instance);
    this._ensureDetachedTerminalListeners();
    const l = xterm.onDidDispose(() => {
      this._detachedXterms.delete(instance);
      l.dispose();
    });
    return instance;
  }
  /**
   * Registers a single set of global service listeners (theme/config/log-level
   * changes) that forward updates to all detached xterm instances. This avoids
   * each detached terminal registering its own listener on global singletons.
   */
  _ensureDetachedTerminalListeners() {
    if (this._detachedListenersRegistered) {
      return;
    }
    this._detachedListenersRegistered = true;
    this._register(this._themeService.onDidColorThemeChange(() => {
      for (const instance of this._detachedXterms) {
        instance.xterm.updateTheme();
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      const shouldUpdateConfig = e.affectsConfiguration("terminal.integrated") || e.affectsConfiguration("editor.fastScrollSensitivity") || e.affectsConfiguration("editor.mouseWheelScrollSensitivity") || e.affectsConfiguration("editor.multiCursorModifier");
      const shouldUpdateTheme = e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled);
      if (shouldUpdateConfig || shouldUpdateTheme) {
        for (const instance of this._detachedXterms) {
          if (shouldUpdateConfig) {
            instance.xterm.updateConfig();
          }
          if (shouldUpdateTheme) {
            instance.xterm.updateTheme();
          }
        }
      }
    }));
    this._register(this._logService.onDidChangeLogLevel(() => {
      for (const instance of this._detachedXterms) {
        instance.xterm.updateLogLevel();
      }
    }));
  }
  async _resolveCwd(shellLaunchConfig, splitActiveTerminal, options) {
    const cwd = shellLaunchConfig.cwd;
    if (!cwd) {
      if (options?.cwd) {
        shellLaunchConfig.cwd = options.cwd;
      } else if (splitActiveTerminal && options?.location) {
        let parent = this.activeInstance;
        if (typeof options.location === "object" && hasKey(options.location, { parentTerminal: true })) {
          parent = await options.location.parentTerminal;
        }
        if (!parent) {
          throw new Error("Cannot split without an active instance");
        }
        shellLaunchConfig.cwd = await getCwdForSplit(parent, this._workspaceContextService.getWorkspace().folders, this._commandService, this._terminalConfigurationService);
      }
    }
  }
  async _splitTerminal(shellLaunchConfig, location, parent) {
    let instance;
    if (typeof shellLaunchConfig.cwd !== "object" && typeof parent.shellLaunchConfig.cwd === "object") {
      let path = shellLaunchConfig.cwd || parent.shellLaunchConfig.cwd.path;
      if (parent.shellLaunchConfig.cwd.authority && path && path[0] !== "/") {
        path = "/" + path;
      }
      shellLaunchConfig.cwd = URI.from({
        scheme: parent.shellLaunchConfig.cwd.scheme,
        authority: parent.shellLaunchConfig.cwd.authority,
        path
      });
    }
    if (location === TerminalLocation.Editor || parent.target === TerminalLocation.Editor) {
      instance = await this._terminalEditorService.splitInstance(parent, shellLaunchConfig);
    } else {
      const group = this._terminalGroupService.getGroupForInstance(parent);
      if (!group) {
        throw new Error(`Cannot split a terminal without a group (instanceId: ${parent.instanceId}, title: ${parent.title})`);
      }
      shellLaunchConfig.parentTerminalId = parent.instanceId;
      instance = group.split(shellLaunchConfig);
    }
    return instance;
  }
  _createTerminal(shellLaunchConfig, location, options) {
    let instance;
    if (location === TerminalLocation.Editor) {
      instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Editor);
      if (!shellLaunchConfig.hideFromUser) {
        const editorOptions = this._getEditorOptions(options?.location);
        this._terminalEditorService.openEditor(instance, editorOptions);
      }
    } else {
      const group = this._terminalGroupService.createGroup(shellLaunchConfig);
      instance = group.terminalInstances[0];
    }
    return instance;
  }
  async resolveLocation(location) {
    if (location && typeof location === "object") {
      if (hasKey(location, { parentTerminal: true })) {
        const parentTerminal = await location.parentTerminal;
        return !parentTerminal.target ? TerminalLocation.Panel : parentTerminal.target;
      } else if (hasKey(location, { viewColumn: true })) {
        return TerminalLocation.Editor;
      } else if (hasKey(location, { splitActiveTerminal: true })) {
        return !this._activeInstance?.target ? TerminalLocation.Panel : this._activeInstance?.target;
      }
    }
    return location;
  }
  async _getSplitParent(location) {
    if (location && typeof location === "object" && hasKey(location, { parentTerminal: true })) {
      return location.parentTerminal;
    } else if (location && typeof location === "object" && hasKey(location, { splitActiveTerminal: true })) {
      return this.activeInstance;
    }
    return void 0;
  }
  _getEditorOptions(location) {
    if (location && typeof location === "object" && hasKey(location, { viewColumn: true })) {
      if (location.viewColumn === ACTIVE_GROUP && isAuxiliaryWindow(getActiveWindow())) {
        location.viewColumn = this._editorGroupsService.activeGroup.id;
        return location;
      }
      location.viewColumn = columnToEditorGroup(this._editorGroupsService, this._configurationService, location.viewColumn);
      return location;
    }
    return void 0;
  }
  _evaluateLocalCwd(shellLaunchConfig) {
    if (this._environmentService.isSessionsWindow) {
      return;
    }
    if (!isString(shellLaunchConfig.cwd) && shellLaunchConfig.cwd?.scheme === Schemas.file) {
      if (VirtualWorkspaceContext.getValue(this._contextKeyService)) {
        shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize("localTerminalVirtualWorkspace", "This shell is open to a {0}local{1} folder, NOT to the virtual folder", "\x1B[3m", "\x1B[23m"), { excludeLeadingNewLine: true, loudFormatting: true });
        shellLaunchConfig.type = "Local";
      } else if (this._remoteAgentService.getConnection()) {
        shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize("localTerminalRemote", "This shell is running on your {0}local{1} machine, NOT on the connected remote machine", "\x1B[3m", "\x1B[23m"), { excludeLeadingNewLine: true, loudFormatting: true });
        shellLaunchConfig.type = "Local";
      }
    }
  }
  moveToBackground(instance) {
    if (this._backgroundedTerminalInstances.some((bg) => bg.instance === instance)) {
      return;
    }
    if (instance.target === TerminalLocation.Editor) {
      this._terminalEditorService.detachInstance(instance);
    } else {
      const group = this._terminalGroupService.getGroupForInstance(instance);
      if (!group) {
        return;
      }
      group.removeInstance(instance);
    }
    instance.detachFromElement();
    this._backgroundedTerminalInstances.push({ instance, terminalLocationOptions: instance.target === TerminalLocation.Editor ? { viewColumn: ACTIVE_GROUP } : void 0 });
    this._backgroundedTerminalDisposables.set(instance.instanceId, instance.onDisposed((instance2) => this._onBackgroundTerminalDisposed(instance2)));
    this._onDidChangeInstances.fire();
  }
  _onBackgroundTerminalDisposed(instance) {
    const index = this._backgroundedTerminalInstances.findIndex((backgrounded) => backgrounded.instance === instance);
    if (index !== -1) {
      this._backgroundedTerminalInstances.splice(index, 1);
    }
    this._backgroundedTerminalDisposables.deleteAndDispose(instance.instanceId);
    this._onDidDisposeInstance.fire(instance);
  }
  async showBackgroundTerminal(instance, suppressSetActive) {
    const index = this._backgroundedTerminalInstances.findIndex((bg) => bg.instance === instance);
    if (index === -1) {
      return;
    }
    const backgroundTerminal = this._backgroundedTerminalInstances[index];
    this._backgroundedTerminalInstances.splice(index, 1);
    this._backgroundedTerminalDisposables.deleteAndDispose(instance.instanceId);
    if (instance.target === TerminalLocation.Panel) {
      this._terminalGroupService.createGroup(instance);
      if (this.instances.length === 1 && !suppressSetActive) {
        this._terminalGroupService.setActiveInstanceByIndex(0);
      }
    } else {
      const editorOptions = backgroundTerminal.terminalLocationOptions ? this._getEditorOptions(backgroundTerminal.terminalLocationOptions) : this._getEditorOptions(instance.target);
      this._terminalEditorService.openEditor(instance, editorOptions);
    }
    this._onDidChangeInstances.fire();
  }
  async setContainers(panelContainer, terminalContainer) {
    this._terminalConfigurationService.setPanelContainer(panelContainer);
    this._terminalGroupService.setContainer(terminalContainer);
  }
  createOnInstanceEvent(getEvent) {
    return new DynamicListEventMultiplexer(this.instances, this.onDidCreateInstance, this.onDidDisposeInstance, getEvent);
  }
  createOnInstanceCapabilityEvent(capabilityId, getEvent) {
    return createInstanceCapabilityEventMultiplexer(this.instances, this.onDidCreateInstance, this.onDidDisposeInstance, capabilityId, getEvent);
  }
};
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceData", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceDataInput", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceIconChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceMaximumDimensionsChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstancePrimaryStatusChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceProcessIdReady", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceSelectionChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceTitleChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceShellTypeChanged", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceAddedCapabilityType", 1);
__decorateClass([
  debounce(500)
], TerminalService.prototype, "_saveState", 1);
__decorateClass([
  debounce(500)
], TerminalService.prototype, "_updateTitle", 1);
__decorateClass([
  debounce(500)
], TerminalService.prototype, "_updateIcon", 1);
TerminalService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, ITerminalLogService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IRemoteAgentService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IWorkbenchEnvironmentService),
  __decorateParam(8, ITerminalConfigurationService),
  __decorateParam(9, ITerminalEditorService),
  __decorateParam(10, ITerminalGroupService),
  __decorateParam(11, ITerminalInstanceService),
  __decorateParam(12, IEditorGroupsService),
  __decorateParam(13, ITerminalProfileService),
  __decorateParam(14, IExtensionService),
  __decorateParam(15, INotificationService),
  __decorateParam(16, IWorkspaceContextService),
  __decorateParam(17, ICommandService),
  __decorateParam(18, IKeybindingService),
  __decorateParam(19, ITimerService),
  __decorateParam(20, IThemeService)
], TerminalService);
let TerminalEditorStyle = class extends Themable {
  constructor(container, _terminalService, _themeService, _terminalProfileService, _editorService) {
    super(_themeService);
    this._terminalService = _terminalService;
    this._themeService = _themeService;
    this._terminalProfileService = _terminalProfileService;
    this._editorService = _editorService;
    this._registerListeners();
    this._styleElement = domStylesheets.createStyleSheet(container);
    this._register(toDisposable(() => this._styleElement.remove()));
    this.updateStyles();
  }
  _registerListeners() {
    this._register(this._terminalService.onAnyInstanceIconChange(() => this.updateStyles()));
    this._register(this._terminalService.onDidCreateInstance(() => this.updateStyles()));
    this._register(this._editorService.onDidActiveEditorChange(() => {
      if (this._editorService.activeEditor instanceof TerminalEditorInput) {
        this.updateStyles();
      }
    }));
    this._register(this._editorService.onDidCloseEditor(() => {
      if (this._editorService.activeEditor instanceof TerminalEditorInput) {
        this.updateStyles();
      }
    }));
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => this.updateStyles()));
  }
  updateStyles() {
    super.updateStyles();
    const colorTheme = this._themeService.getColorTheme();
    let css = "";
    const productIconTheme = this._themeService.getProductIconTheme();
    for (const instance of this._terminalService.instances) {
      const icon = instance.icon;
      if (!icon) {
        continue;
      }
      let uri = void 0;
      if (icon instanceof URI) {
        uri = icon;
      } else if (icon instanceof Object && hasKey(icon, { light: true, dark: true })) {
        uri = isDark(colorTheme.type) ? icon.dark : icon.light;
      }
      const iconClasses = getUriClasses(instance, colorTheme.type);
      if (uri instanceof URI && iconClasses && iconClasses.length > 1) {
        css += cssValue.inline`.monaco-workbench .terminal-tab.${cssValue.className(iconClasses[0])}::before
					{content: ''; background-image: ${cssValue.asCSSUrl(uri)};}`;
      }
      if (ThemeIcon.isThemeIcon(icon)) {
        const iconRegistry = getIconRegistry();
        const iconContribution = iconRegistry.getIcon(icon.id);
        if (iconContribution) {
          const def = productIconTheme.getIcon(iconContribution);
          if (def) {
            css += cssValue.inline`.monaco-workbench .terminal-tab.codicon-${cssValue.className(icon.id)}::before
							{content: ${cssValue.stringValue(def.fontCharacter)} !important; font-family: ${cssValue.stringValue(def.font?.id ?? "codicon")} !important;}`;
          }
        }
      }
    }
    const iconForegroundColor = colorTheme.getColor(iconForeground);
    if (iconForegroundColor) {
      css += cssValue.inline`.monaco-workbench .show-file-icons .file-icon.terminal-tab::before { color: ${iconForegroundColor}; }`;
    }
    css += getColorStyleContent(colorTheme, true);
    this._styleElement.textContent = css;
  }
};
TerminalEditorStyle = __decorateClass([
  __decorateParam(1, ITerminalService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, ITerminalProfileService),
  __decorateParam(4, IEditorService)
], TerminalEditorStyle);
export {
  TerminalService
};
