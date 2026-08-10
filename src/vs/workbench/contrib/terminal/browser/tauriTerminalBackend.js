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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../base/common/platform.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import {
  ITerminalLogService,
  TerminalExtensions
} from "../../../../platform/terminal/common/terminal.js";
import { ITerminalInstanceService } from "./terminal.js";
let _nextProcessId = 1;
class TauriTerminalChildProcess extends Disposable {
  constructor(_cwd, _cols, _rows, _logService) {
    super();
    this._cwd = _cwd;
    this._cols = _cols;
    this._rows = _rows;
    this._logService = _logService;
    this.id = _nextProcessId++;
    this.shouldPersist = false;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
  }
  async start() {
    const tauriTerminal = globalThis.__tauri_terminal__;
    if (!tauriTerminal) {
      return { message: "Tauri terminal bridge not available" };
    }
    try {
      this._tauriSessionId = await tauriTerminal.create(this._cwd, this._rows, this._cols);
      this._logService.info(`[TauriTerminal] Created PTY session: ${this._tauriSessionId}`);
      tauriTerminal.onData(this._tauriSessionId, (data) => {
        this._onProcessData.fire(data);
      });
      tauriTerminal.onExit(this._tauriSessionId, () => {
        this._onProcessExit.fire(0);
      });
      this._onProcessReady.fire({
        pid: this.id,
        cwd: this._cwd,
        windowsPty: void 0
      });
      return void 0;
    } catch (err) {
      this._logService.error(`[TauriTerminal] Failed to start terminal:`, err);
      return { message: err?.message || String(err) };
    }
  }
  input(data) {
    if (!this._tauriSessionId) return;
    const tauriTerminal = globalThis.__tauri_terminal__;
    tauriTerminal?.write(this._tauriSessionId, data);
  }
  resize(cols, rows) {
    this._cols = cols;
    this._rows = rows;
    if (!this._tauriSessionId) return;
    const tauriTerminal = globalThis.__tauri_terminal__;
    tauriTerminal?.resize(this._tauriSessionId, rows, cols);
  }
  shutdown(immediate) {
    if (!this._tauriSessionId) return;
    const tauriTerminal = globalThis.__tauri_terminal__;
    tauriTerminal?.kill(this._tauriSessionId);
    this._tauriSessionId = void 0;
  }
  sendSignal(signal) {
  }
  processBinary(data) {
    return Promise.resolve();
  }
  clearBuffer() {
  }
}
let TauriTerminalBackend = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this.remoteAuthority = void 0;
    this.isResponsive = true;
    this.whenReady = Promise.resolve();
    this._onPtyHostUnresponsive = this._register(new Emitter());
    this.onPtyHostUnresponsive = this._onPtyHostUnresponsive.event;
    this._onPtyHostResponsive = this._register(new Emitter());
    this.onPtyHostResponsive = this._onPtyHostResponsive.event;
    this._onPtyHostRestart = this._register(new Emitter());
    this.onPtyHostRestart = this._onPtyHostRestart.event;
    this._onDidRequestDetach = this._register(new Emitter());
    this.onDidRequestDetach = this._onDidRequestDetach.event;
  }
  setReady() {
  }
  async createProcess(shellLaunchConfig, cwd, cols, rows, unicodeVersion, env, options, shouldPersist) {
    const targetCwd = cwd || (shellLaunchConfig.cwd ? String(shellLaunchConfig.cwd) : "/");
    return new TauriTerminalChildProcess(targetCwd, cols, rows, this._logService);
  }
  async attachToProcess(id) {
    return void 0;
  }
  async attachToRevivedProcess(id) {
    return void 0;
  }
  async listProcesses() {
    return [];
  }
  async getLatency() {
    return [];
  }
  async getDefaultSystemShell(osOverride) {
    if (isWindows) return "powershell.exe";
    return "/bin/bash";
  }
  async getProfiles(profiles, defaultProfile, includeDetectedProfiles) {
    if (isWindows) {
      return [
        { profileName: "PowerShell", path: "powershell.exe", isDefault: true },
        { profileName: "Command Prompt", path: "cmd.exe", isDefault: false }
      ];
    }
    return [
      { profileName: "bash", path: "/bin/bash", isDefault: true },
      { profileName: "sh", path: "/bin/sh", isDefault: false }
    ];
  }
  async getWslPath(original, direction) {
    return original;
  }
  async getEnvironment() {
    return {};
  }
  async getShellEnvironment() {
    return void 0;
  }
  async setTerminalLayoutInfo(layoutInfo) {
  }
  async updateTitle(id, title, titleSource) {
  }
  async updateIcon(id, userInitiated, icon, color) {
  }
  async setNextCommandId(id, commandLine, commandId) {
  }
  async getTerminalLayoutInfo() {
    return void 0;
  }
  async getPerformanceMarks() {
    return [];
  }
  async reduceConnectionGraceTime() {
  }
  async requestDetachInstance(workspaceId, instanceId) {
    return void 0;
  }
  async acceptDetachInstanceReply(requestId, persistentProcessId) {
  }
  async persistTerminalState() {
  }
  restartPtyHost() {
  }
};
TauriTerminalBackend = __decorateClass([
  __decorateParam(0, ITerminalLogService)
], TauriTerminalBackend);
let TauriTerminalContribution = class {
  static {
    this.ID = "workbench.contrib.tauriTerminal";
  }
  constructor(instantiationService, terminalInstanceService) {
    const tauriTerminal = globalThis.__tauri_terminal__;
    if (tauriTerminal) {
      const backend = instantiationService.createInstance(TauriTerminalBackend);
      Registry.as(TerminalExtensions.Backend).registerTerminalBackend(backend);
      terminalInstanceService.didRegisterBackend(backend);
    }
  }
};
TauriTerminalContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ITerminalInstanceService)
], TauriTerminalContribution);
export {
  TauriTerminalBackend,
  TauriTerminalChildProcess,
  TauriTerminalContribution
};
