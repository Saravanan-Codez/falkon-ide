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
import { Emitter } from "../../../base/common/event.js";
import { MainContext } from "./extHost.protocol.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { URI } from "../../../base/common/uri.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { DisposableStore, Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { Disposable as VSCodeDisposable, EnvironmentVariableMutatorType } from "./extHostTypes.js";
import { localize } from "../../../nls.js";
import { NotSupportedError } from "../../../base/common/errors.js";
import { serializeEnvironmentDescriptionMap, serializeEnvironmentVariableCollection } from "../../../platform/terminal/common/environmentVariableShared.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ProcessPropertyType, WindowsShellType } from "../../../platform/terminal/common/terminal.js";
import { TerminalDataBufferer } from "../../../platform/terminal/common/terminalDataBuffering.js";
import { ThemeColor } from "../../../base/common/themables.js";
import { Promises } from "../../../base/common/async.js";
import { TerminalCompletionList, TerminalQuickFix, ViewColumn } from "./extHostTypeConverters.js";
import { IExtHostCommands } from "./extHostCommands.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { isWindows } from "../../../base/common/platform.js";
import { hasKey } from "../../../base/common/types.js";
import { isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
const IExtHostTerminalService = createDecorator("IExtHostTerminalService");
class ExtHostTerminal extends Disposable {
  constructor(_proxy, _id, _creationOptions, _name) {
    super();
    this._proxy = _proxy;
    this._id = _id;
    this._creationOptions = _creationOptions;
    this._name = _name;
    this._disposed = false;
    this._state = { isInteractedWith: false, shell: void 0 };
    this.isOpen = false;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._creationOptions = Object.freeze(this._creationOptions);
    this._pidPromise = new Promise((c) => this._pidPromiseComplete = c);
    const that = this;
    this.value = {
      get name() {
        return that._name || "";
      },
      get processId() {
        return that._pidPromise;
      },
      get creationOptions() {
        return that._creationOptions;
      },
      get exitStatus() {
        return that._exitStatus;
      },
      get state() {
        return that._state;
      },
      get selection() {
        return that._selection;
      },
      get shellIntegration() {
        return that.shellIntegration;
      },
      sendText(text, shouldExecute = true) {
        that._checkDisposed();
        that._proxy.$sendText(that._id, text, shouldExecute);
      },
      show(preserveFocus) {
        that._checkDisposed();
        that._proxy.$show(that._id, preserveFocus);
      },
      hide() {
        that._checkDisposed();
        that._proxy.$hide(that._id);
      },
      dispose() {
        if (!that._disposed) {
          that._disposed = true;
          that._proxy.$dispose(that._id);
        }
      },
      get dimensions() {
        if (that._cols === void 0 || that._rows === void 0) {
          return void 0;
        }
        return {
          columns: that._cols,
          rows: that._rows
        };
      }
    };
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
  async create(options, internalOptions) {
    if (typeof this._id !== "string") {
      throw new Error("Terminal has already been created");
    }
    await this._proxy.$createTerminal(this._id, {
      name: options.name,
      shellPath: options.shellPath ?? void 0,
      shellArgs: options.shellArgs ?? void 0,
      cwd: options.cwd ?? internalOptions?.cwd ?? void 0,
      env: options.env ?? void 0,
      icon: asTerminalIcon(options.iconPath) ?? void 0,
      color: ThemeColor.isThemeColor(options.color) ? options.color.id : void 0,
      initialText: options.message ?? void 0,
      strictEnv: options.strictEnv ?? void 0,
      hideFromUser: options.hideFromUser ?? void 0,
      forceShellIntegration: internalOptions?.forceShellIntegration ?? void 0,
      isFeatureTerminal: internalOptions?.isFeatureTerminal ?? void 0,
      isRemoteResolverTerminal: internalOptions?.isRemoteResolverTerminal ?? void 0,
      isExtensionOwnedTerminal: true,
      useShellEnvironment: internalOptions?.useShellEnvironment ?? void 0,
      location: internalOptions?.location || this._serializeParentTerminal(options.location, internalOptions?.resolvedExtHostIdentifier),
      isTransient: options.isTransient ?? void 0,
      shellIntegrationNonce: options.shellIntegrationNonce ?? void 0,
      titleTemplate: options.titleTemplate ?? void 0
    });
  }
  async createExtensionTerminal(location, internalOptions, parentTerminal, iconPath, color, shellIntegrationNonce, titleTemplate) {
    if (typeof this._id !== "string") {
      throw new Error("Terminal has already been created");
    }
    await this._proxy.$createTerminal(this._id, {
      name: this._name,
      isExtensionCustomPtyTerminal: true,
      icon: iconPath,
      color: ThemeColor.isThemeColor(color) ? color.id : void 0,
      location: internalOptions?.location || this._serializeParentTerminal(location, parentTerminal),
      isTransient: true,
      shellIntegrationNonce: shellIntegrationNonce ?? void 0,
      titleTemplate: titleTemplate ?? void 0
    });
    if (typeof this._id === "string") {
      throw new Error("Terminal creation failed");
    }
    return this._id;
  }
  _serializeParentTerminal(location, parentTerminal) {
    if (typeof location === "object") {
      if (hasKey(location, { parentTerminal: true }) && location.parentTerminal && parentTerminal) {
        return { parentTerminal };
      }
      if (hasKey(location, { viewColumn: true })) {
        return { viewColumn: ViewColumn.from(location.viewColumn), preserveFocus: location.preserveFocus };
      }
      return void 0;
    }
    return location;
  }
  _checkDisposed() {
    if (this._disposed) {
      throw new Error("Terminal has already been disposed");
    }
  }
  set name(name) {
    this._name = name;
  }
  setExitStatus(code, reason) {
    this._exitStatus = Object.freeze({ code, reason });
  }
  setDimensions(cols, rows) {
    if (cols === this._cols && rows === this._rows) {
      return false;
    }
    if (cols === 0 || rows === 0) {
      return false;
    }
    this._cols = cols;
    this._rows = rows;
    return true;
  }
  setInteractedWith() {
    if (!this._state.isInteractedWith) {
      this._state = {
        ...this._state,
        isInteractedWith: true
      };
      return true;
    }
    return false;
  }
  setShellType(shellType) {
    if (this._state.shell !== shellType) {
      this._state = {
        ...this._state,
        shell: shellType
      };
      return true;
    }
    return false;
  }
  setSelection(selection) {
    this._selection = selection;
  }
  _setProcessId(processId) {
    if (this._pidPromiseComplete) {
      this._pidPromiseComplete(processId);
      this._pidPromiseComplete = void 0;
    } else {
      this._pidPromise.then((pid) => {
        if (pid !== processId) {
          this._pidPromise = Promise.resolve(processId);
        }
      });
    }
  }
}
class ExtHostPseudoterminal {
  constructor(_pty) {
    this._pty = _pty;
    this.id = 0;
    this.shouldPersist = false;
    this._onProcessData = new Emitter();
    this.onProcessData = this._onProcessData.event;
    this._onProcessReady = new Emitter();
    this._onDidChangeProperty = new Emitter();
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = new Emitter();
    this.onProcessExit = this._onProcessExit.event;
  }
  get onProcessReady() {
    return this._onProcessReady.event;
  }
  refreshProperty(property) {
    throw new Error(`refreshProperty is not suppported in extension owned terminals. property: ${property}`);
  }
  updateProperty(property, value) {
    throw new Error(`updateProperty is not suppported in extension owned terminals. property: ${property}, value: ${value}`);
  }
  async start() {
    return void 0;
  }
  shutdown() {
    this._pty.close();
  }
  input(data) {
    this._pty.handleInput?.(data);
  }
  sendSignal(signal) {
  }
  resize(cols, rows) {
    this._pty.setDimensions?.({ columns: cols, rows });
  }
  clearBuffer() {
  }
  async processBinary(data) {
  }
  acknowledgeDataEvent(charCount) {
  }
  async setUnicodeVersion(version) {
  }
  getInitialCwd() {
    return Promise.resolve("");
  }
  getCwd() {
    return Promise.resolve("");
  }
  startSendingEvents(initialDimensions) {
    this._pty.onDidWrite((e) => this._onProcessData.fire(e));
    this._pty.onDidClose?.((e = void 0) => {
      this._onProcessExit.fire(e === void 0 ? void 0 : e);
    });
    this._pty.onDidOverrideDimensions?.((e) => {
      if (e) {
        this._onDidChangeProperty.fire({ type: ProcessPropertyType.OverrideDimensions, value: { cols: e.columns, rows: e.rows } });
      }
    });
    this._pty.onDidChangeName?.((title) => {
      this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: title });
    });
    this._pty.open(initialDimensions ? initialDimensions : void 0);
    if (initialDimensions) {
      this._pty.setDimensions?.(initialDimensions);
    }
    this._onProcessReady.fire({ pid: -1, cwd: "", windowsPty: void 0 });
  }
}
let nextLinkId = 1;
let BaseExtHostTerminalService = class extends Disposable {
  constructor(supportsProcesses, _extHostCommands, extHostRpc) {
    super();
    this._extHostCommands = _extHostCommands;
    this._terminals = [];
    this._terminalProcesses = /* @__PURE__ */ new Map();
    this._terminalProcessDisposables = {};
    this._extensionTerminalAwaitingStart = {};
    this._getTerminalPromises = {};
    this._environmentVariableCollections = /* @__PURE__ */ new Map();
    this._lastQuickFixCommands = this._register(new MutableDisposable());
    this._linkProviders = /* @__PURE__ */ new Set();
    this._completionProviders = /* @__PURE__ */ new Map();
    this._profileProviders = /* @__PURE__ */ new Map();
    this._quickFixProviders = /* @__PURE__ */ new Map();
    this._terminalLinkCache = /* @__PURE__ */ new Map();
    this._terminalLinkCancellationSource = /* @__PURE__ */ new Map();
    this._onDidCloseTerminal = new Emitter();
    this.onDidCloseTerminal = this._onDidCloseTerminal.event;
    this._onDidOpenTerminal = new Emitter();
    this.onDidOpenTerminal = this._onDidOpenTerminal.event;
    this._onDidChangeActiveTerminal = new Emitter();
    this.onDidChangeActiveTerminal = this._onDidChangeActiveTerminal.event;
    this._onDidChangeTerminalDimensions = new Emitter();
    this.onDidChangeTerminalDimensions = this._onDidChangeTerminalDimensions.event;
    this._onDidChangeTerminalState = new Emitter();
    this.onDidChangeTerminalState = this._onDidChangeTerminalState.event;
    this._onDidChangeShell = new Emitter();
    this.onDidChangeShell = this._onDidChangeShell.event;
    this._onDidWriteTerminalData = new Emitter({
      onWillAddFirstListener: () => this._proxy.$startSendingDataEvents(),
      onDidRemoveLastListener: () => this._proxy.$stopSendingDataEvents()
    });
    this.onDidWriteTerminalData = this._onDidWriteTerminalData.event;
    this._onDidExecuteCommand = new Emitter({
      onWillAddFirstListener: () => this._proxy.$startSendingCommandEvents(),
      onDidRemoveLastListener: () => this._proxy.$stopSendingCommandEvents()
    });
    this.onDidExecuteTerminalCommand = this._onDidExecuteCommand.event;
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadTerminalService);
    this._bufferer = new TerminalDataBufferer(this._proxy.$sendProcessData);
    this._proxy.$registerProcessSupport(supportsProcesses);
    this._extHostCommands.registerArgumentProcessor({
      processArgument: (arg) => {
        const deserialize = (arg2) => {
          return this.getTerminalById(arg2.instanceId)?.value;
        };
        switch (arg?.$mid) {
          case MarshalledId.TerminalContext:
            return deserialize(arg);
          default: {
            if (Array.isArray(arg)) {
              for (let i = 0; i < arg.length; i++) {
                if (arg[i].$mid === MarshalledId.TerminalContext) {
                  arg[i] = deserialize(arg[i]);
                } else {
                  break;
                }
              }
            }
            return arg;
          }
        }
      }
    });
    this._register({
      dispose: () => {
        for (const [_, terminalProcess] of this._terminalProcesses) {
          terminalProcess.shutdown(true);
        }
      }
    });
  }
  get activeTerminal() {
    return this._activeTerminal?.value;
  }
  get terminals() {
    return this._terminals.map((term) => term.value);
  }
  getDefaultShell(useAutomationShell) {
    const profile = useAutomationShell ? this._defaultAutomationProfile : this._defaultProfile;
    return profile?.path || "";
  }
  getDefaultShellArgs(useAutomationShell) {
    const profile = useAutomationShell ? this._defaultAutomationProfile : this._defaultProfile;
    return profile?.args || [];
  }
  createExtensionTerminal(options, internalOptions) {
    const terminal = new ExtHostTerminal(this._proxy, generateUuid(), options, options.name);
    const p = new ExtHostPseudoterminal(options.pty);
    terminal.createExtensionTerminal(options.location, internalOptions, this._serializeParentTerminal(options, internalOptions).resolvedExtHostIdentifier, asTerminalIcon(options.iconPath), asTerminalColor(options.color), options.shellIntegrationNonce, options.titleTemplate).then((id) => {
      const disposable = this._setupExtHostProcessListeners(id, p);
      this._terminalProcessDisposables[id] = disposable;
    });
    this._terminals.push(terminal);
    return terminal.value;
  }
  _serializeParentTerminal(options, internalOptions) {
    internalOptions = internalOptions ? internalOptions : {};
    if (options.location && typeof options.location === "object" && hasKey(options.location, { parentTerminal: true })) {
      const parentTerminal = options.location.parentTerminal;
      if (parentTerminal) {
        const parentExtHostTerminal = this._terminals.find((t) => t.value === parentTerminal);
        if (parentExtHostTerminal) {
          internalOptions.resolvedExtHostIdentifier = parentExtHostTerminal._id;
        }
      }
    } else if (options.location && typeof options.location !== "object") {
      internalOptions.location = options.location;
    } else if (internalOptions.location && typeof internalOptions.location === "object" && hasKey(internalOptions.location, { splitActiveTerminal: true })) {
      internalOptions.location = { splitActiveTerminal: true };
    }
    return internalOptions;
  }
  attachPtyToTerminal(id, pty) {
    const terminal = this.getTerminalById(id);
    if (!terminal) {
      throw new Error(`Cannot resolve terminal with id ${id} for virtual process`);
    }
    const p = new ExtHostPseudoterminal(pty);
    const disposable = this._setupExtHostProcessListeners(id, p);
    this._terminalProcessDisposables[id] = disposable;
  }
  async $acceptActiveTerminalChanged(id) {
    const original = this._activeTerminal;
    if (id === null) {
      this._activeTerminal = void 0;
      if (original !== this._activeTerminal) {
        this._onDidChangeActiveTerminal.fire(this._activeTerminal);
      }
      return;
    }
    const terminal = this.getTerminalById(id);
    if (terminal) {
      this._activeTerminal = terminal;
      if (original !== this._activeTerminal) {
        this._onDidChangeActiveTerminal.fire(this._activeTerminal.value);
      }
    }
  }
  async $acceptTerminalProcessData(id, data) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      this._onDidWriteTerminalData.fire({ terminal: terminal.value, data });
    }
  }
  async $acceptTerminalDimensions(id, cols, rows) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      if (terminal.setDimensions(cols, rows)) {
        this._onDidChangeTerminalDimensions.fire({
          terminal: terminal.value,
          dimensions: terminal.value.dimensions
        });
      }
    }
  }
  async $acceptDidExecuteCommand(id, command) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      this._onDidExecuteCommand.fire({ terminal: terminal.value, ...command });
    }
  }
  async $acceptTerminalMaximumDimensions(id, cols, rows) {
    this._terminalProcesses.get(id)?.resize(cols, rows);
  }
  async $acceptTerminalTitleChange(id, name) {
    const terminal = this.getTerminalById(id);
    if (terminal) {
      terminal.name = name;
    }
  }
  async $acceptTerminalClosed(id, exitCode, exitReason) {
    this._terminalLinkCache.delete(id);
    const cancellationSource = this._terminalLinkCancellationSource.get(id);
    if (cancellationSource) {
      this._terminalLinkCancellationSource.delete(id);
      cancellationSource.dispose(true);
    }
    const index = this._getTerminalObjectIndexById(this._terminals, id);
    if (index !== null) {
      const terminal = this._terminals.splice(index, 1)[0];
      terminal.setExitStatus(exitCode, exitReason);
      this._onDidCloseTerminal.fire(terminal.value);
    }
  }
  $acceptTerminalOpened(id, extHostTerminalId, name, shellLaunchConfigDto) {
    if (extHostTerminalId) {
      const index = this._getTerminalObjectIndexById(this._terminals, extHostTerminalId);
      if (index !== null) {
        this._terminals[index]._id = id;
        this._onDidOpenTerminal.fire(this.terminals[index]);
        this._terminals[index].isOpen = true;
        return;
      }
    }
    const creationOptions = {
      name: shellLaunchConfigDto.name,
      shellPath: shellLaunchConfigDto.executable,
      shellArgs: shellLaunchConfigDto.args,
      cwd: typeof shellLaunchConfigDto.cwd === "string" ? shellLaunchConfigDto.cwd : URI.revive(shellLaunchConfigDto.cwd),
      env: shellLaunchConfigDto.env,
      hideFromUser: shellLaunchConfigDto.hideFromUser,
      titleTemplate: shellLaunchConfigDto.titleTemplate
    };
    const terminal = new ExtHostTerminal(this._proxy, id, creationOptions, name);
    this._terminals.push(terminal);
    this._onDidOpenTerminal.fire(terminal.value);
    terminal.isOpen = true;
  }
  async $acceptTerminalProcessId(id, processId) {
    const terminal = this.getTerminalById(id);
    terminal?._setProcessId(processId);
  }
  async $startExtensionTerminal(id, initialDimensions) {
    const terminal = this.getTerminalById(id);
    if (!terminal) {
      return { message: localize("launchFail.idMissingOnExtHost", "Could not find the terminal with id {0} on the extension host", id) };
    }
    if (!terminal.isOpen) {
      await new Promise((r) => {
        const listener = this.onDidOpenTerminal(async (e) => {
          if (e === terminal.value) {
            listener.dispose();
            r();
          }
        });
      });
    }
    const terminalProcess = this._terminalProcesses.get(id);
    if (terminalProcess) {
      terminalProcess.startSendingEvents(initialDimensions);
    } else {
      this._extensionTerminalAwaitingStart[id] = { initialDimensions };
    }
    return void 0;
  }
  _setupExtHostProcessListeners(id, p) {
    const disposables = new DisposableStore();
    disposables.add(p.onProcessReady((e) => this._proxy.$sendProcessReady(id, e.pid, e.cwd, e.windowsPty)));
    disposables.add(p.onDidChangeProperty((property) => this._proxy.$sendProcessProperty(id, property)));
    this._bufferer.startBuffering(id, p.onProcessData);
    disposables.add(p.onProcessExit((exitCode) => this._onProcessExit(id, exitCode)));
    this._terminalProcesses.set(id, p);
    const awaitingStart = this._extensionTerminalAwaitingStart[id];
    if (awaitingStart && p instanceof ExtHostPseudoterminal) {
      p.startSendingEvents(awaitingStart.initialDimensions);
      delete this._extensionTerminalAwaitingStart[id];
    }
    return disposables;
  }
  $acceptProcessAckDataEvent(id, charCount) {
    this._terminalProcesses.get(id)?.acknowledgeDataEvent(charCount);
  }
  $acceptProcessInput(id, data) {
    this._terminalProcesses.get(id)?.input(data);
  }
  $acceptTerminalInteraction(id) {
    const terminal = this.getTerminalById(id);
    if (terminal?.setInteractedWith()) {
      this._onDidChangeTerminalState.fire(terminal.value);
    }
  }
  $acceptTerminalSelection(id, selection) {
    this.getTerminalById(id)?.setSelection(selection);
  }
  $acceptProcessResize(id, cols, rows) {
    try {
      this._terminalProcesses.get(id)?.resize(cols, rows);
    } catch (error) {
      if (error.code !== "EPIPE" && error.code !== "ERR_IPC_CHANNEL_CLOSED") {
        throw error;
      }
    }
  }
  $acceptProcessShutdown(id, immediate) {
    this._terminalProcesses.get(id)?.shutdown(immediate);
  }
  $acceptProcessRequestInitialCwd(id) {
    this._terminalProcesses.get(id)?.getInitialCwd().then((initialCwd) => this._proxy.$sendProcessProperty(id, { type: ProcessPropertyType.InitialCwd, value: initialCwd }));
  }
  $acceptProcessRequestCwd(id) {
    this._terminalProcesses.get(id)?.getCwd().then((cwd) => this._proxy.$sendProcessProperty(id, { type: ProcessPropertyType.Cwd, value: cwd }));
  }
  $acceptProcessRequestLatency(id) {
    return Promise.resolve(id);
  }
  registerProfileProvider(extension, id, provider) {
    if (this._profileProviders.has(id)) {
      throw new Error(`Terminal profile provider "${id}" already registered`);
    }
    this._profileProviders.set(id, { provider, extension });
    this._proxy.$registerProfileProvider(id, extension.identifier.value);
    return new VSCodeDisposable(() => {
      this._profileProviders.delete(id);
      this._proxy.$unregisterProfileProvider(id);
    });
  }
  registerTerminalCompletionProvider(extension, provider, ...triggerCharacters) {
    if (this._completionProviders.has(extension.identifier.value)) {
      throw new Error(`Terminal completion provider "${extension.identifier.value}" already registered`);
    }
    this._completionProviders.set(extension.identifier.value, provider);
    this._proxy.$registerCompletionProvider(extension.identifier.value, extension.identifier.value, ...triggerCharacters);
    return new VSCodeDisposable(() => {
      this._completionProviders.delete(extension.identifier.value);
      this._proxy.$unregisterCompletionProvider(extension.identifier.value);
    });
  }
  async $provideTerminalCompletions(id, options) {
    const token = new CancellationTokenSource().token;
    if (token.isCancellationRequested || !this.activeTerminal) {
      return void 0;
    }
    const provider = this._completionProviders.get(id);
    if (!provider) {
      return;
    }
    const completions = await provider.provideTerminalCompletions(this.activeTerminal, options, token);
    if (completions === null || completions === void 0) {
      return void 0;
    }
    const pathSeparator = !isWindows || this.activeTerminal.state?.shell === WindowsShellType.GitBash ? "/" : "\\";
    return TerminalCompletionList.from(completions, pathSeparator);
  }
  $acceptTerminalShellType(id, shellType) {
    const terminal = this.getTerminalById(id);
    if (terminal?.setShellType(shellType)) {
      this._onDidChangeTerminalState.fire(terminal.value);
    }
  }
  registerTerminalQuickFixProvider(id, extensionId, provider) {
    if (this._quickFixProviders.has(id)) {
      throw new Error(`Terminal quick fix provider "${id}" is already registered`);
    }
    this._quickFixProviders.set(id, provider);
    this._proxy.$registerQuickFixProvider(id, extensionId);
    return new VSCodeDisposable(() => {
      this._quickFixProviders.delete(id);
      this._proxy.$unregisterQuickFixProvider(id);
    });
  }
  async $provideTerminalQuickFixes(id, matchResult) {
    const token = new CancellationTokenSource().token;
    if (token.isCancellationRequested) {
      return;
    }
    const provider = this._quickFixProviders.get(id);
    if (!provider) {
      return;
    }
    const quickFixes = await provider.provideTerminalQuickFixes(matchResult, token);
    if (quickFixes === null || Array.isArray(quickFixes) && quickFixes.length === 0) {
      return void 0;
    }
    const store = new DisposableStore();
    this._lastQuickFixCommands.value = store;
    if (!Array.isArray(quickFixes)) {
      return quickFixes ? TerminalQuickFix.from(quickFixes, this._extHostCommands.converter, store) : void 0;
    }
    const result = [];
    for (const fix of quickFixes) {
      const converted = TerminalQuickFix.from(fix, this._extHostCommands.converter, store);
      if (converted) {
        result.push(converted);
      }
    }
    return result;
  }
  async $createContributedProfileTerminal(id, options) {
    const token = new CancellationTokenSource().token;
    const profileProviderData = this._profileProviders.get(id);
    if (!profileProviderData) {
      throw new Error(`No terminal profile provider registered for id "${id}"`);
    }
    let profile = await profileProviderData.provider.provideTerminalProfile(token);
    if (token.isCancellationRequested) {
      return;
    }
    if (profile && !hasKey(profile, { options: true })) {
      profile = { options: profile };
    }
    if (!profile || !hasKey(profile, { options: true })) {
      throw new Error(`No terminal profile options provided for id "${id}"`);
    }
    const hasTerminalTitleProposal = isProposedApiEnabled(profileProviderData.extension, "terminalTitle");
    if (!hasTerminalTitleProposal && profile.options.titleTemplate !== void 0) {
      console.error(`[${profileProviderData.extension.identifier.value}] \`titleTemplate\` returned from TerminalProfileProvider is ignored because the \`terminalTitle\` proposed API is not enabled.`);
      profile = { options: { ...profile.options, titleTemplate: void 0 } };
    }
    if (!hasTerminalTitleProposal && options.titleTemplate !== void 0) {
      console.error(`[${profileProviderData.extension.identifier.value}] \`titleTemplate\` passed to createContributedTerminalProfile is ignored because the \`terminalTitle\` proposed API is not enabled.`);
    }
    const profileOptions = hasTerminalTitleProposal && options.titleTemplate && !profile.options.titleTemplate ? { ...profile.options, titleTemplate: options.titleTemplate } : profile.options;
    if (hasKey(profileOptions, { pty: true })) {
      this.createExtensionTerminal(profileOptions, options);
      return;
    }
    this.createTerminalFromOptions(profileOptions, options);
  }
  registerLinkProvider(provider) {
    this._linkProviders.add(provider);
    if (this._linkProviders.size === 1) {
      this._proxy.$startLinkProvider();
    }
    return new VSCodeDisposable(() => {
      this._linkProviders.delete(provider);
      if (this._linkProviders.size === 0) {
        this._proxy.$stopLinkProvider();
      }
    });
  }
  async $provideLinks(terminalId, line) {
    const terminal = this.getTerminalById(terminalId);
    if (!terminal) {
      return [];
    }
    this._terminalLinkCache.delete(terminalId);
    const oldToken = this._terminalLinkCancellationSource.get(terminalId);
    oldToken?.dispose(true);
    const cancellationSource = new CancellationTokenSource();
    this._terminalLinkCancellationSource.set(terminalId, cancellationSource);
    const result = [];
    const context = { terminal: terminal.value, line };
    const promises = [];
    for (const provider of this._linkProviders) {
      promises.push(Promises.withAsyncBody(async (r) => {
        const cancelSubscription = cancellationSource.token.onCancellationRequested(() => r({ provider, links: [] }));
        try {
          const links = await provider.provideTerminalLinks(context, cancellationSource.token) || [];
          if (!cancellationSource.token.isCancellationRequested) {
            r({ provider, links });
          }
        } finally {
          cancelSubscription.dispose();
        }
      }));
    }
    const provideResults = await Promise.all(promises);
    if (cancellationSource.token.isCancellationRequested) {
      return [];
    }
    const cacheLinkMap = /* @__PURE__ */ new Map();
    for (const provideResult of provideResults) {
      if (provideResult && provideResult.links.length > 0) {
        result.push(...provideResult.links.map((providerLink) => {
          const link = {
            id: nextLinkId++,
            startIndex: providerLink.startIndex,
            length: providerLink.length,
            label: providerLink.tooltip
          };
          cacheLinkMap.set(link.id, {
            provider: provideResult.provider,
            link: providerLink
          });
          return link;
        }));
      }
    }
    this._terminalLinkCache.set(terminalId, cacheLinkMap);
    return result;
  }
  $activateLink(terminalId, linkId) {
    const cachedLink = this._terminalLinkCache.get(terminalId)?.get(linkId);
    if (!cachedLink) {
      return;
    }
    cachedLink.provider.handleTerminalLink(cachedLink.link);
  }
  _onProcessExit(id, exitCode) {
    this._bufferer.stopBuffering(id);
    this._terminalProcesses.delete(id);
    delete this._extensionTerminalAwaitingStart[id];
    const processDiposable = this._terminalProcessDisposables[id];
    if (processDiposable) {
      processDiposable.dispose();
      delete this._terminalProcessDisposables[id];
    }
    this._proxy.$sendProcessExit(id, exitCode);
  }
  getTerminalById(id) {
    return this._getTerminalObjectById(this._terminals, id);
  }
  getTerminalIdByApiObject(terminal) {
    const index = this._terminals.findIndex((item) => {
      return item.value === terminal;
    });
    return index >= 0 ? index : null;
  }
  _getTerminalObjectById(array, id) {
    const index = this._getTerminalObjectIndexById(array, id);
    return index !== null ? array[index] : null;
  }
  _getTerminalObjectIndexById(array, id) {
    const index = array.findIndex((item) => {
      return item._id === id;
    });
    return index >= 0 ? index : null;
  }
  getEnvironmentVariableCollection(extension) {
    let collection = this._environmentVariableCollections.get(extension.identifier.value);
    if (!collection) {
      collection = this._register(new UnifiedEnvironmentVariableCollection());
      this._setEnvironmentVariableCollection(extension.identifier.value, collection);
    }
    return collection.getScopedEnvironmentVariableCollection(void 0);
  }
  _syncEnvironmentVariableCollection(extensionIdentifier, collection) {
    const serialized = serializeEnvironmentVariableCollection(collection.map);
    const serializedDescription = serializeEnvironmentDescriptionMap(collection.descriptionMap);
    this._proxy.$setEnvironmentVariableCollection(extensionIdentifier, collection.persistent, serialized.length === 0 ? void 0 : serialized, serializedDescription);
  }
  $initEnvironmentVariableCollections(collections) {
    collections.forEach((entry) => {
      const extensionIdentifier = entry[0];
      const collection = this._register(new UnifiedEnvironmentVariableCollection(entry[1]));
      this._setEnvironmentVariableCollection(extensionIdentifier, collection);
    });
  }
  $acceptDefaultProfile(profile, automationProfile) {
    const oldProfile = this._defaultProfile;
    this._defaultProfile = profile;
    this._defaultAutomationProfile = automationProfile;
    if (oldProfile?.path !== profile.path) {
      this._onDidChangeShell.fire(profile.path);
    }
  }
  _setEnvironmentVariableCollection(extensionIdentifier, collection) {
    this._environmentVariableCollections.set(extensionIdentifier, collection);
    this._register(collection.onDidChangeCollection(() => {
      this._syncEnvironmentVariableCollection(extensionIdentifier, collection);
    }));
  }
};
BaseExtHostTerminalService = __decorateClass([
  __decorateParam(1, IExtHostCommands),
  __decorateParam(2, IExtHostRpcService)
], BaseExtHostTerminalService);
class UnifiedEnvironmentVariableCollection extends Disposable {
  constructor(serialized) {
    super();
    this.map = /* @__PURE__ */ new Map();
    this.scopedCollections = /* @__PURE__ */ new Map();
    this.descriptionMap = /* @__PURE__ */ new Map();
    this._persistent = true;
    this._onDidChangeCollection = this._register(new Emitter());
    this.map = new Map(serialized);
  }
  get persistent() {
    return this._persistent;
  }
  set persistent(value) {
    this._persistent = value;
    this._onDidChangeCollection.fire();
  }
  get onDidChangeCollection() {
    return this._onDidChangeCollection && this._onDidChangeCollection.event;
  }
  getScopedEnvironmentVariableCollection(scope) {
    const scopedCollectionKey = this.getScopeKey(scope);
    let scopedCollection = this.scopedCollections.get(scopedCollectionKey);
    if (!scopedCollection) {
      scopedCollection = new ScopedEnvironmentVariableCollection(this, scope);
      this.scopedCollections.set(scopedCollectionKey, scopedCollection);
      this._register(scopedCollection.onDidChangeCollection(() => this._onDidChangeCollection.fire()));
    }
    return scopedCollection;
  }
  replace(variable, value, options, scope) {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Replace, options: options ?? { applyAtProcessCreation: true }, scope });
  }
  append(variable, value, options, scope) {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Append, options: options ?? { applyAtProcessCreation: true }, scope });
  }
  prepend(variable, value, options, scope) {
    this._setIfDiffers(variable, { value, type: EnvironmentVariableMutatorType.Prepend, options: options ?? { applyAtProcessCreation: true }, scope });
  }
  _setIfDiffers(variable, mutator) {
    if (mutator.options && mutator.options.applyAtProcessCreation === false && !mutator.options.applyAtShellIntegration) {
      throw new Error("EnvironmentVariableMutatorOptions must apply at either process creation or shell integration");
    }
    const key = this.getKey(variable, mutator.scope);
    const current = this.map.get(key);
    const newOptions = mutator.options ? {
      applyAtProcessCreation: mutator.options.applyAtProcessCreation ?? false,
      applyAtShellIntegration: mutator.options.applyAtShellIntegration ?? false
    } : {
      applyAtProcessCreation: true
    };
    if (!current || current.value !== mutator.value || current.type !== mutator.type || current.options?.applyAtProcessCreation !== newOptions.applyAtProcessCreation || current.options?.applyAtShellIntegration !== newOptions.applyAtShellIntegration || current.scope?.workspaceFolder?.index !== mutator.scope?.workspaceFolder?.index) {
      const key2 = this.getKey(variable, mutator.scope);
      const value = {
        variable,
        ...mutator,
        options: newOptions
      };
      this.map.set(key2, value);
      this._onDidChangeCollection.fire();
    }
  }
  get(variable, scope) {
    const key = this.getKey(variable, scope);
    const value = this.map.get(key);
    return value ? convertMutator(value) : void 0;
  }
  getKey(variable, scope) {
    const scopeKey = this.getScopeKey(scope);
    return scopeKey.length ? `${variable}:::${scopeKey}` : variable;
  }
  getScopeKey(scope) {
    return this.getWorkspaceKey(scope?.workspaceFolder) ?? "";
  }
  getWorkspaceKey(workspaceFolder) {
    return workspaceFolder ? workspaceFolder.uri.toString() : void 0;
  }
  getVariableMap(scope) {
    const map = /* @__PURE__ */ new Map();
    for (const [_, value] of this.map) {
      if (this.getScopeKey(value.scope) === this.getScopeKey(scope)) {
        map.set(value.variable, convertMutator(value));
      }
    }
    return map;
  }
  delete(variable, scope) {
    const key = this.getKey(variable, scope);
    this.map.delete(key);
    this._onDidChangeCollection.fire();
  }
  clear(scope) {
    if (scope?.workspaceFolder) {
      for (const [key, mutator] of this.map) {
        if (mutator.scope?.workspaceFolder?.index === scope.workspaceFolder.index) {
          this.map.delete(key);
        }
      }
      this.clearDescription(scope);
    } else {
      this.map.clear();
      this.descriptionMap.clear();
    }
    this._onDidChangeCollection.fire();
  }
  setDescription(description, scope) {
    const key = this.getScopeKey(scope);
    const current = this.descriptionMap.get(key);
    if (!current || current.description !== description) {
      let descriptionStr;
      if (typeof description === "string") {
        descriptionStr = description;
      } else {
        descriptionStr = description?.value.split("\n\n")[0];
      }
      const value = { description: descriptionStr, scope };
      this.descriptionMap.set(key, value);
      this._onDidChangeCollection.fire();
    }
  }
  getDescription(scope) {
    const key = this.getScopeKey(scope);
    return this.descriptionMap.get(key)?.description;
  }
  clearDescription(scope) {
    const key = this.getScopeKey(scope);
    this.descriptionMap.delete(key);
  }
}
class ScopedEnvironmentVariableCollection {
  constructor(collection, scope) {
    this.collection = collection;
    this.scope = scope;
    this._onDidChangeCollection = new Emitter();
  }
  get persistent() {
    return this.collection.persistent;
  }
  set persistent(value) {
    this.collection.persistent = value;
  }
  get onDidChangeCollection() {
    return this._onDidChangeCollection && this._onDidChangeCollection.event;
  }
  getScoped(scope) {
    return this.collection.getScopedEnvironmentVariableCollection(scope);
  }
  replace(variable, value, options) {
    this.collection.replace(variable, value, options, this.scope);
  }
  append(variable, value, options) {
    this.collection.append(variable, value, options, this.scope);
  }
  prepend(variable, value, options) {
    this.collection.prepend(variable, value, options, this.scope);
  }
  get(variable) {
    return this.collection.get(variable, this.scope);
  }
  forEach(callback, thisArg) {
    this.collection.getVariableMap(this.scope).forEach((value, variable) => callback.call(thisArg, variable, value, this), this.scope);
  }
  [Symbol.iterator]() {
    return this.collection.getVariableMap(this.scope).entries();
  }
  delete(variable) {
    this.collection.delete(variable, this.scope);
    this._onDidChangeCollection.fire(void 0);
  }
  clear() {
    this.collection.clear(this.scope);
  }
  set description(description) {
    this.collection.setDescription(description, this.scope);
  }
  get description() {
    return this.collection.getDescription(this.scope);
  }
}
let WorkerExtHostTerminalService = class extends BaseExtHostTerminalService {
  constructor(extHostCommands, extHostRpc, initData) {
    super(false, extHostCommands, extHostRpc);
    this._hasRemoteAuthority = !!initData.remote.authority;
  }
  createTerminal(name, shellPath, shellArgs) {
    if (!this._hasRemoteAuthority) {
      throw new NotSupportedError();
    }
    return this.createTerminalFromOptions({ name, shellPath, shellArgs });
  }
  createTerminalFromOptions(options, internalOptions) {
    if (!this._hasRemoteAuthority) {
      throw new NotSupportedError();
    }
    const terminal = new ExtHostTerminal(this._proxy, generateUuid(), options, options.name);
    this._terminals.push(terminal);
    terminal.create(options, this._serializeParentTerminal(options, internalOptions));
    return terminal.value;
  }
};
WorkerExtHostTerminalService = __decorateClass([
  __decorateParam(0, IExtHostCommands),
  __decorateParam(1, IExtHostRpcService),
  __decorateParam(2, IExtHostInitDataService)
], WorkerExtHostTerminalService);
function asTerminalIcon(iconPath) {
  if (!iconPath || typeof iconPath === "string") {
    return void 0;
  }
  if (!hasKey(iconPath, { id: true })) {
    return iconPath;
  }
  return {
    id: iconPath.id,
    color: iconPath.color
  };
}
function asTerminalColor(color) {
  return ThemeColor.isThemeColor(color) ? color : void 0;
}
function convertMutator(mutator) {
  const newMutator = { ...mutator };
  delete newMutator.scope;
  newMutator.options = newMutator.options ?? void 0;
  return newMutator;
}
export {
  BaseExtHostTerminalService,
  ExtHostTerminal,
  IExtHostTerminalService,
  WorkerExtHostTerminalService
};
