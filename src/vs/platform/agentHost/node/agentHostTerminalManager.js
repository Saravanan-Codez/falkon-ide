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
import * as fs from "fs";
import { DeferredPromise, raceCancellablePromises, timeout } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { dirname, parse as pathParse } from "../../../base/common/path.js";
import * as platform from "../../../base/common/platform.js";
import { getSystemShell } from "../../../base/node/shell.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { AiAgentEnvValue, AiAgentEnvVar } from "../../chat/common/aiAgentEnv.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { getShellIntegrationInjection } from "../../terminal/node/terminalEnvironment.js";
import { AgentHostConfigKey, agentHostCustomizationConfigSchema } from "../common/agentHostCustomizationConfig.js";
import { ActionType } from "../common/state/protocol/actions.js";
import { TerminalClaimKind } from "../common/state/protocol/state.js";
import { isTerminalAction } from "../common/state/sessionActions.js";
import { ROOT_STATE_URI } from "../common/state/sessionState.js";
import { IAgentConfigurationService } from "./agentConfigurationService.js";
import { AgentHostHeadlessTerminal } from "./agentHostHeadlessTerminal.js";
import { isZsh } from "./agentHostShellUtils.js";
import { IAgentHostStateManager } from "./agentHostStateManager.js";
import { Osc633EventType, Osc633Parser } from "./osc633Parser.js";
const WAIT_FOR_PROMPT_TIMEOUT = 1e4;
const HEADLESS_TERMINAL_SCROLLBACK = 0;
const DSR_CURSOR_POSITION_QUERY = "\x1B[6n";
const DEC_DSR_CURSOR_POSITION_QUERY = "\x1B[?6n";
const OSC_FOREGROUND_COLOR_QUERY_ST = "\x1B]10;?\x1B\\";
const OSC_FOREGROUND_COLOR_QUERY_BEL = "\x1B]10;?\x07";
const OSC_BACKGROUND_COLOR_QUERY_ST = "\x1B]11;?\x1B\\";
const OSC_BACKGROUND_COLOR_QUERY_BEL = "\x1B]11;?\x07";
const TERMINAL_QUERIES_SUPPRESSED_FROM_CLIENT = [
  DEC_DSR_CURSOR_POSITION_QUERY,
  DSR_CURSOR_POSITION_QUERY,
  OSC_FOREGROUND_COLOR_QUERY_ST,
  OSC_FOREGROUND_COLOR_QUERY_BEL,
  OSC_BACKGROUND_COLOR_QUERY_ST,
  OSC_BACKGROUND_COLOR_QUERY_BEL
];
const TERMINAL_QUERY_SUPPRESSION_REGEX = /\x1b(?:\[\??6n|\]1[01];\?(?:\x07|\x1b\\))/g;
const TERMINAL_QUERY_PREFIXES_SUPPRESSED_FROM_CLIENT = [...new Set(TERMINAL_QUERIES_SUPPRESSED_FROM_CLIENT.flatMap((query) => {
  const prefixes = [];
  for (let i = 1; i < query.length; i++) {
    prefixes.push(query.substring(0, i));
  }
  return prefixes;
}))].sort((a, b) => b.length - a.length);
const IAgentHostTerminalManager = createDecorator("agentHostTerminalManager");
function removeTerminalQueriesSuppressedFromClient(data, state) {
  if (!state.pendingData && !data.includes("\x1B")) {
    return data;
  }
  const combinedData = state.pendingData + data;
  const pendingData = getTerminalQueryPrefixSuppressedFromClient(combinedData);
  const dataToFilter = pendingData ? combinedData.substring(0, combinedData.length - pendingData.length) : combinedData;
  state.pendingData = pendingData;
  return dataToFilter.replace(TERMINAL_QUERY_SUPPRESSION_REGEX, "");
}
function getTerminalQueryPrefixSuppressedFromClient(data) {
  for (const prefix of TERMINAL_QUERY_PREFIXES_SUPPRESSED_FROM_CLIENT) {
    if (data.endsWith(prefix)) {
      return prefix;
    }
  }
  return "";
}
function formatTerminalText(data, options) {
  if (options.forceBracketedPasteMode) {
    data = `\x1B[200~${data}\x1B[201~`;
  }
  data = data.replace(/\r?\n/g, "\r");
  if (options.shouldExecute && !data.endsWith("\r")) {
    data += "\r";
  }
  return data;
}
let nodePtyModule;
async function getNodePty() {
  if (!nodePtyModule) {
    nodePtyModule = await import("node-pty");
  }
  return nodePtyModule;
}
let AgentHostTerminalManager = class extends Disposable {
  constructor(_stateManager, _logService, _productService, _configurationService) {
    super();
    this._stateManager = _stateManager;
    this._logService = _logService;
    this._productService = _productService;
    this._configurationService = _configurationService;
    this._terminals = /* @__PURE__ */ new Map();
    this._outputTerminals = /* @__PURE__ */ new Map();
    this._register(this._stateManager.onDidEmitEnvelope((envelope) => {
      const action = envelope.action;
      if (!isTerminalAction(action)) {
        return;
      }
      const channel = envelope.channel;
      switch (action.type) {
        case ActionType.TerminalInput:
          this._writeInput(channel, action.data);
          break;
        case ActionType.TerminalResized:
          this._resize(channel, action.cols, action.rows);
          break;
        case ActionType.TerminalClaimed:
          this._setClaim(channel, action.claim);
          break;
        case ActionType.TerminalTitleChanged:
          this._setTitle(channel, action.title);
          break;
        case ActionType.TerminalCleared:
          this._clearContent(channel);
          break;
      }
    }));
  }
  /** Get metadata for all active terminals (for root state). */
  getTerminalInfos() {
    return [...this._terminals.values()].map((t) => ({
      resource: t.uri,
      title: t.title,
      claim: t.claim,
      exitCode: t.exitCode
    }));
  }
  /** Get the full state for a terminal (for subscribe snapshots). */
  getTerminalState(uri) {
    const outputTerminal = this._outputTerminals.get(uri);
    if (outputTerminal) {
      return {
        title: outputTerminal.title,
        content: outputTerminal.content,
        exitCode: outputTerminal.exitCode,
        claim: outputTerminal.claim,
        isPty: false
      };
    }
    const terminal = this._terminals.get(uri);
    if (!terminal) {
      return void 0;
    }
    return {
      title: terminal.title,
      cwd: terminal.cwd,
      cols: terminal.cols,
      rows: terminal.rows,
      content: terminal.content,
      exitCode: terminal.exitCode,
      claim: terminal.claim,
      supportsCommandDetection: terminal.commandTracker?.detectionAvailableEmitted,
      isPty: true
    };
  }
  /**
   * Create a new terminal backed by node-pty.
   * Spawns the user's default shell.
   */
  async createTerminal(params, options) {
    const uri = params.channel;
    if (this._terminals.has(uri)) {
      throw new Error(`Terminal already exists: ${uri}`);
    }
    const cwd = await this._resolveCwd(params.cwd, uri);
    const cols = params.cols ?? 80;
    const rows = params.rows ?? 24;
    const shell = options?.shell ?? await this.getDefaultShell();
    const name = platform.isWindows ? "cmd" : "xterm-256color";
    this._logService.info(`[TerminalManager] Creating terminal ${uri}: shell=${shell}, cwd=${cwd}, cols=${cols}, rows=${rows}`);
    const nonce = generateUuid();
    const env = { ...process.env };
    env[AiAgentEnvVar] = AiAgentEnvValue;
    if (options?.preventShellHistory) {
      env["VSCODE_PREVENT_SHELL_HISTORY"] = "1";
    }
    if (params.claim?.kind === TerminalClaimKind.Session && isZsh(shell)) {
      env["VSCODE_AGENT_ZSH_FIXUPS"] = "1";
    }
    if (options?.nonInteractive) {
      env["LC_ALL"] = "C.UTF-8";
      env["PAGER"] = "";
      env["GIT_PAGER"] = "";
      env["GH_PAGER"] = "";
      env["GIT_TERMINAL_PROMPT"] = "0";
      env["DEBIAN_FRONTEND"] = "noninteractive";
    }
    let shellArgs = [];
    if (platform.isMacintosh) {
      const shellName = pathParse(shell).name;
      if (shellName.match(/(zsh|bash)/)) {
        shellArgs = ["--login"];
      }
    }
    const injection = await getShellIntegrationInjection(
      { executable: shell, args: shellArgs, forceShellIntegration: true },
      {
        shellIntegration: { enabled: true, suggestEnabled: false, nonce },
        windowsUseConptyDll: false,
        environmentVariableCollections: void 0,
        workspaceFolder: void 0,
        isScreenReaderOptimized: false
      },
      void 0,
      this._logService,
      this._productService
    );
    let commandTracker;
    if (injection.type === "injection") {
      this._logService.info(`[TerminalManager] Shell integration injected for ${uri}`);
      if (injection.envMixin) {
        for (const [key, value] of Object.entries(injection.envMixin)) {
          if (value !== void 0) {
            env[key] = value;
          }
        }
      }
      if (injection.newArgs) {
        shellArgs = injection.newArgs;
      }
      if (injection.filesToCopy) {
        for (const f of injection.filesToCopy) {
          try {
            await fs.promises.mkdir(dirname(f.dest), { recursive: true });
            await fs.promises.copyFile(f.source, f.dest);
          } catch {
          }
        }
      }
      commandTracker = {
        parser: new Osc633Parser(),
        nonce,
        commandCounter: 0,
        detectionAvailableEmitted: false
      };
    } else {
      this._logService.info(`[TerminalManager] Shell integration not available for ${uri}: ${injection.reason}`);
    }
    const ptyProcess = await this._spawnPty(shell, shellArgs, {
      name,
      cwd,
      env,
      cols,
      rows
    });
    const store = new DisposableStore();
    const claim = params.claim ?? { kind: TerminalClaimKind.Client, clientId: "" };
    const onDataEmitter = store.add(new Emitter());
    const onExitEmitter = store.add(new Emitter());
    const onClaimChangedEmitter = store.add(new Emitter());
    const onCommandFinishedEmitter = store.add(new Emitter());
    const headlessTerminal = store.add(new AgentHostHeadlessTerminal({
      cols,
      rows,
      scrollback: HEADLESS_TERMINAL_SCROLLBACK,
      logService: this._logService
    }));
    const managed = {
      uri,
      store,
      pty: ptyProcess,
      onDataEmitter,
      onExitEmitter,
      onClaimChangedEmitter,
      onCommandFinishedEmitter,
      title: params.name ?? shell,
      cwd,
      cols,
      rows,
      content: [],
      contentSize: 0,
      claim,
      commandTracker,
      headlessTerminal,
      terminalQueryFilterState: { pendingData: "" }
    };
    this._terminals.set(uri, managed);
    store.add(headlessTerminal.onResponseData((data) => {
      this._logService.debug(`[TerminalManager] Writing headless terminal response for ${uri}: ${JSON.stringify(data)}`);
      try {
        ptyProcess.write(data);
      } catch (err) {
        this._logService.debug(`[TerminalManager] Failed to write headless terminal response for ${uri}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }));
    store.add(toDisposable(() => {
      try {
        ptyProcess.kill();
      } catch {
      }
    }));
    const onFirstData = new DeferredPromise();
    const dataListener = ptyProcess.onData((rawData) => {
      void managed.headlessTerminal?.writePtyData(rawData);
      this._handlePtyData(managed, rawData);
      onFirstData.complete();
    });
    store.add(toDisposable(() => dataListener.dispose()));
    const exitListener = ptyProcess.onExit((e) => {
      managed.exitCode = e.exitCode;
      managed.onExitEmitter.fire(e.exitCode);
      onFirstData.complete();
      this._stateManager.dispatchServerAction(uri, {
        type: ActionType.TerminalExited,
        exitCode: e.exitCode
      });
      this._broadcastTerminalList();
    });
    store.add(toDisposable(() => exitListener.dispose()));
    if (!platform.isWindows) {
      const titleInterval = setInterval(() => {
        const newTitle = ptyProcess.process;
        if (newTitle && newTitle !== managed.title) {
          managed.title = newTitle;
          this._stateManager.dispatchServerAction(uri, {
            type: ActionType.TerminalTitleChanged,
            title: newTitle
          });
          this._broadcastTerminalList();
        }
      }, 200);
      store.add(toDisposable(() => clearInterval(titleInterval)));
    }
    await raceCancellablePromises([onFirstData.p, timeout(WAIT_FOR_PROMPT_TIMEOUT)]);
    this._broadcastTerminalList();
  }
  async _spawnPty(file, args, options) {
    const nodePty = await getNodePty();
    return nodePty.spawn(file, args, options);
  }
  /** Send input data to a terminal's PTY process (from client-dispatched actions). */
  _writeInput(uri, data) {
    this.writeInput(uri, data);
  }
  /** Send input data to a terminal's PTY process. */
  writeInput(uri, data) {
    const terminal = this._terminals.get(uri);
    if (terminal && terminal.exitCode === void 0) {
      terminal.pty.write(data);
    }
  }
  /** Send formatted text to a terminal's PTY process. */
  async sendText(uri, data, options) {
    const terminal = this._terminals.get(uri);
    let forceBracketedPasteMode = false;
    if (options.bracketedPasteMode) {
      await terminal?.headlessTerminal?.whenPtyDataFlushed();
      forceBracketedPasteMode = !!terminal?.headlessTerminal?.isBracketedPasteMode();
    }
    this.writeInput(uri, formatTerminalText(data, { shouldExecute: options.shouldExecute, forceBracketedPasteMode }));
  }
  /** Register a callback for PTY data events on a terminal. */
  onData(uri, cb) {
    const terminal = this._terminals.get(uri);
    if (!terminal) {
      return toDisposable(() => {
      });
    }
    return terminal.onDataEmitter.event(cb);
  }
  /** Register a callback for PTY exit events on a terminal. */
  onExit(uri, cb) {
    const terminal = this._terminals.get(uri);
    if (!terminal) {
      return toDisposable(() => {
      });
    }
    return terminal.onExitEmitter.event(cb);
  }
  /** Register a callback for terminal claim changes. */
  onClaimChanged(uri, cb) {
    const terminal = this._terminals.get(uri);
    if (!terminal) {
      return toDisposable(() => {
      });
    }
    return terminal.onClaimChangedEmitter.event(cb);
  }
  /** Register a callback for command completion events (requires shell integration). */
  onCommandFinished(uri, cb) {
    const terminal = this._terminals.get(uri);
    if (!terminal) {
      return toDisposable(() => {
      });
    }
    return terminal.onCommandFinishedEmitter.event(cb);
  }
  createAltBufferPromise(uri, store) {
    const terminal = this._terminals.get(uri);
    if (!terminal?.headlessTerminal) {
      return new Promise(() => {
      });
    }
    return terminal.headlessTerminal.createAltBufferPromise(store);
  }
  /** Get accumulated scrollback content for a terminal as raw text. */
  getContent(uri) {
    const terminal = this._terminals.get(uri);
    if (!terminal) {
      return void 0;
    }
    return terminal.content.map((p) => p.type === "command" ? p.output : p.value).join("");
  }
  /** Get the current claim for a terminal. */
  getClaim(uri) {
    return this._terminals.get(uri)?.claim;
  }
  /** Check whether a terminal exists. */
  hasTerminal(uri) {
    return this._terminals.has(uri);
  }
  /** Whether the terminal has shell integration active for command detection. */
  supportsCommandDetection(uri) {
    const terminal = this._terminals.get(uri);
    return terminal?.commandTracker?.detectionAvailableEmitted ?? false;
  }
  /** Get the exit code for a terminal, or undefined if still running. */
  getExitCode(uri) {
    return this._terminals.get(uri)?.exitCode;
  }
  /** Resize a terminal. */
  _resize(uri, cols, rows) {
    const terminal = this._terminals.get(uri);
    if (terminal && terminal.exitCode === void 0) {
      terminal.cols = cols;
      terminal.rows = rows;
      terminal.pty.resize(cols, rows);
      terminal.headlessTerminal?.resize(cols, rows);
    }
  }
  /** Update a terminal's claim. */
  _setClaim(uri, claim) {
    const terminal = this._terminals.get(uri);
    if (terminal) {
      terminal.claim = claim;
      terminal.onClaimChangedEmitter.fire(claim);
      this._broadcastTerminalList();
    }
  }
  /** Update a terminal's title. */
  _setTitle(uri, title) {
    const terminal = this._terminals.get(uri);
    if (terminal) {
      terminal.title = title;
      this._broadcastTerminalList();
    }
  }
  /** Clear a terminal's scrollback buffer. */
  _clearContent(uri) {
    const terminal = this._terminals.get(uri);
    if (terminal) {
      terminal.content = [];
      terminal.contentSize = 0;
      terminal.headlessTerminal?.clear();
    }
  }
  /** Process raw PTY output: parse OSC 633 sequences, dispatch actions, track content. */
  _handlePtyData(managed, rawData) {
    const tracker = managed.commandTracker;
    const segments = tracker ? tracker.parser.parseSegments(rawData) : rawData.length > 0 ? [{ kind: "data", data: rawData }] : [];
    let pendingClientData = "";
    const flushClientData = () => {
      if (pendingClientData.length === 0) {
        return;
      }
      managed.onDataEmitter.fire(pendingClientData);
      this._stateManager.dispatchServerAction(managed.uri, {
        type: ActionType.TerminalData,
        data: pendingClientData
      });
      pendingClientData = "";
    };
    for (const segment of segments) {
      if (segment.kind === "event") {
        flushClientData();
        this._handleOsc633Event(managed, tracker, segment.event);
        continue;
      }
      const cleanedData = removeTerminalQueriesSuppressedFromClient(segment.data, managed.terminalQueryFilterState);
      if (cleanedData.length > 0) {
        this._appendToContent(managed, cleanedData);
        pendingClientData += cleanedData;
      }
    }
    flushClientData();
    this._trimContent(managed);
  }
  /** Handle a parsed OSC 633 event by dispatching the appropriate protocol actions. */
  _handleOsc633Event(managed, tracker, event) {
    if (!tracker.detectionAvailableEmitted) {
      tracker.detectionAvailableEmitted = true;
      this._stateManager.dispatchServerAction(managed.uri, {
        type: ActionType.TerminalCommandDetectionAvailable
      });
    }
    switch (event.type) {
      case Osc633EventType.CommandLine: {
        if (event.nonce === tracker.nonce) {
          tracker.pendingCommandLine = event.commandLine;
        }
        break;
      }
      case Osc633EventType.CommandExecuted: {
        const commandId = `cmd-${++tracker.commandCounter}`;
        const commandLine = tracker.pendingCommandLine ?? "";
        const timestamp = Date.now();
        tracker.pendingCommandLine = void 0;
        tracker.activeCommandId = commandId;
        tracker.activeCommandTimestamp = timestamp;
        managed.content.push({
          type: "command",
          commandId,
          commandLine,
          output: "",
          timestamp,
          isComplete: false
        });
        this._stateManager.dispatchServerAction(managed.uri, {
          type: ActionType.TerminalCommandExecuted,
          commandId,
          commandLine,
          timestamp
        });
        break;
      }
      case Osc633EventType.CommandFinished: {
        const finishedCommandId = tracker.activeCommandId;
        if (!finishedCommandId) {
          break;
        }
        const durationMs = tracker.activeCommandTimestamp !== void 0 ? Date.now() - tracker.activeCommandTimestamp : void 0;
        let commandLine = "";
        let commandOutput = "";
        for (const part of managed.content) {
          if (part.type === "command" && part.commandId === finishedCommandId) {
            part.isComplete = true;
            part.exitCode = event.exitCode;
            part.durationMs = durationMs;
            commandLine = part.commandLine;
            commandOutput = part.output;
            break;
          }
        }
        tracker.activeCommandId = void 0;
        tracker.activeCommandTimestamp = void 0;
        managed.onCommandFinishedEmitter.fire({
          commandId: finishedCommandId,
          exitCode: event.exitCode,
          command: commandLine,
          output: commandOutput
        });
        this._stateManager.dispatchServerAction(managed.uri, {
          type: ActionType.TerminalCommandFinished,
          commandId: finishedCommandId,
          exitCode: event.exitCode,
          durationMs
        });
        break;
      }
      case Osc633EventType.Property: {
        if (event.key === "Cwd") {
          managed.cwd = event.value;
          this._stateManager.dispatchServerAction(managed.uri, {
            type: ActionType.TerminalCwdChanged,
            cwd: event.value
          });
        }
        break;
      }
    }
  }
  /** Append cleaned data to the terminal's structured content array. */
  _appendToContent(managed, data) {
    const tail = managed.content.length > 0 ? managed.content[managed.content.length - 1] : void 0;
    if (tail?.type === "command" && !tail.isComplete) {
      tail.output += data;
      managed.contentSize += data.length;
    } else if (tail?.type === "unclassified") {
      tail.value += data;
      managed.contentSize += data.length;
    } else {
      managed.content.push({ type: "unclassified", value: data });
      managed.contentSize += data.length;
    }
  }
  _getContentPartSize(part) {
    return part.type === "command" ? part.output.length : part.value.length;
  }
  /** Trim content parts to stay within the rolling buffer limit. */
  _trimContent(managed) {
    const maxSize = 1e5;
    const targetSize = 8e4;
    if (managed.contentSize <= maxSize) {
      return;
    }
    while (managed.contentSize > targetSize && managed.content.length > 1) {
      const removed = managed.content.shift();
      managed.contentSize -= this._getContentPartSize(removed);
    }
    if (managed.contentSize > targetSize && managed.content.length > 0) {
      const head = managed.content[0];
      const excess = managed.contentSize - targetSize;
      if (head.type === "command") {
        head.output = head.output.slice(excess);
      } else {
        head.value = head.value.slice(excess);
      }
      managed.contentSize -= excess;
    }
  }
  /**
   * Create an output-only terminal channel. Unlike {@link createTerminal}
   * there is no PTY behind it: the owner appends plain-text output via
   * {@link appendOutputTerminalData}. The channel is not announced on the
   * root terminal list — clients discover it through the tool result's
   * terminal content block and subscribe to its URI.
   */
  createOutputTerminal(uri, options) {
    if (this._terminals.has(uri) || this._outputTerminals.has(uri)) {
      throw new Error(`Terminal already exists: ${uri}`);
    }
    this._outputTerminals.set(uri, {
      title: options.title,
      content: [],
      contentSize: 0,
      claim: options.claim
    });
  }
  /** Append plain-text data to an output-only terminal and stream it to subscribers. */
  appendOutputTerminalData(uri, data) {
    const terminal = this._outputTerminals.get(uri);
    if (!terminal || data.length === 0) {
      return;
    }
    this._appendToContent(terminal, data);
    this._trimContent(terminal);
    this._stateManager.dispatchServerAction(uri, {
      type: ActionType.TerminalData,
      data
    });
  }
  /** Clear an output-only terminal's content (e.g. when cumulative source output was rewritten). */
  resetOutputTerminal(uri) {
    const terminal = this._outputTerminals.get(uri);
    if (!terminal) {
      return;
    }
    terminal.content = [];
    terminal.contentSize = 0;
    this._stateManager.dispatchServerAction(uri, {
      type: ActionType.TerminalCleared
    });
  }
  /** Record the command's exit on an output-only terminal and notify subscribers. */
  finalizeOutputTerminal(uri, exitCode) {
    const terminal = this._outputTerminals.get(uri);
    if (!terminal || terminal.exitCode !== void 0) {
      return;
    }
    if (exitCode !== void 0) {
      terminal.exitCode = exitCode;
      this._stateManager.dispatchServerAction(uri, {
        type: ActionType.TerminalExited,
        exitCode
      });
    }
  }
  /** Dispose a terminal: kill the process and remove it. */
  disposeTerminal(uri) {
    if (this._outputTerminals.delete(uri)) {
      return;
    }
    const terminal = this._terminals.get(uri);
    if (terminal) {
      this._terminals.delete(uri);
      terminal.store.dispose();
      this._broadcastTerminalList();
    }
  }
  async getDefaultShell() {
    const configured = this._configurationService.getRootValue(agentHostCustomizationConfigSchema, AgentHostConfigKey.DefaultShell);
    if (configured) {
      try {
        await fs.promises.access(configured, fs.constants.X_OK);
        return configured;
      } catch (err) {
        this._logService.warn(`[TerminalManager] Configured defaultShell '${configured}' is not accessible, falling back to system shell: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return getSystemShell(platform.OS, process.env);
  }
  /**
   * Resolves the cwd string from {@link CreateTerminalParams} to an
   * accessible filesystem path, falling back to $HOME if the requested
   * directory is missing (otherwise node-pty exits silently with code 1).
   * Accepts either a `file://` URI string or a raw absolute filesystem path.
   */
  async _resolveCwd(cwd, terminalURI) {
    let resolved = cwd;
    if (cwd) {
      const parsed = URI.parse(cwd);
      if (parsed.scheme === "file" && parsed.fsPath && parsed.fsPath !== "/") {
        resolved = parsed.fsPath;
      } else {
        this._logService.warn(`[TerminalManager] Ignoring non-file cwd for ${terminalURI}: ${cwd}`);
      }
    }
    try {
      if (resolved) {
        const stat = await fs.promises.stat(resolved);
        if (stat.isDirectory()) {
          return resolved;
        }
      }
    } catch {
    }
    const fallback = process.env["HOME"] || process.env["USERPROFILE"] || process.cwd();
    this._logService.warn(`[TerminalManager] cwd '${resolved}' is not accessible, falling back to ${fallback}`);
    return fallback;
  }
  /** Dispatch root/terminalsChanged with the current terminal list. */
  _broadcastTerminalList() {
    this._stateManager.dispatchServerAction(ROOT_STATE_URI, {
      type: ActionType.RootTerminalsChanged,
      terminals: this.getTerminalInfos()
    });
  }
  dispose() {
    for (const terminal of this._terminals.values()) {
      terminal.store.dispose();
    }
    this._terminals.clear();
    super.dispose();
  }
};
AgentHostTerminalManager = __decorateClass([
  __decorateParam(0, IAgentHostStateManager),
  __decorateParam(1, ILogService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IAgentConfigurationService)
], AgentHostTerminalManager);
export {
  AgentHostTerminalManager,
  IAgentHostTerminalManager,
  formatTerminalText,
  removeTerminalQueriesSuppressedFromClient
};
