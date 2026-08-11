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
import { CancellationError } from "../../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { isNumber } from "../../../../../../base/common/types.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { isCI, isMacintosh } from "../../../../../../base/common/platform.js";
import { ITerminalLogService } from "../../../../../../platform/terminal/common/terminal.js";
import { trackIdleOnPrompt } from "./executeStrategy.js";
import { createAltBufferPromise, setupRecreatingStartMarker, stripCommandEchoAndPrompt } from "./strategyHelpers.js";
import { TerminalChatAgentToolsSettingId } from "../../common/terminalChatAgentToolsConfiguration.js";
import { isMultilineCommand } from "../runInTerminalHelpers.js";
function isTerminalLaunchError(value) {
  return typeof value === "object" && value !== null && "message" in value;
}
function formatExitCodeOrError(exitCodeOrError) {
  if (isTerminalLaunchError(exitCodeOrError)) {
    return `launch error: ${exitCodeOrError.message}${exitCodeOrError.code !== void 0 ? `, code=${exitCodeOrError.code}` : ""}`;
  }
  return `code=${exitCodeOrError}`;
}
function extractExitCode(exitCodeOrError) {
  if (isNumber(exitCodeOrError)) {
    return exitCodeOrError;
  }
  if (isTerminalLaunchError(exitCodeOrError)) {
    return exitCodeOrError.code;
  }
  return void 0;
}
let RichExecuteStrategy = class extends Disposable {
  constructor(_instance, _commandDetection, _isSyncMode, _configurationService, _logService) {
    super();
    this._instance = _instance;
    this._commandDetection = _commandDetection;
    this._isSyncMode = _isSyncMode;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this.type = "rich";
    this._startMarker = this._register(new MutableDisposable());
    this._onDidCreateStartMarker = this._register(new Emitter());
    this.onDidCreateStartMarker = this._onDidCreateStartMarker.event;
    /**
     * Tracks per-execute() DisposableStores so they can be cleaned up if the
     * strategy is disposed mid-flight, AND removed from this collection on
     * successful completion to avoid accumulating stale references when
     * execute() is invoked many times on the same strategy instance.
     */
    this._executionStores = this._register(new DisposableStore());
  }
  async execute(commandLine, token, commandId, commandLineForMetadata) {
    const store = new DisposableStore();
    this._executionStores.add(store);
    try {
      if (this._instance.isDisposed) {
        this._log("Terminal already disposed at strategy entry");
        throw new Error("The terminal was closed");
      }
      if (this._instance.exitCode !== void 0) {
        this._log(`Terminal pty already exited at strategy entry (code=${this._instance.exitCode})`);
        return {
          output: void 0,
          exitCode: this._instance.exitCode,
          additionalInformation: `Command exited with code ${this._instance.exitCode}`
        };
      }
      const idlePollInterval = this._configurationService.getValue(TerminalChatAgentToolsSettingId.IdlePollInterval) ?? 1e3;
      const staleMarker = this._commandDetection.executingCommandObject?.marker;
      const onCommandFinishedFiltered = staleMarker ? Event.filter(this._commandDetection.onCommandFinished, (e) => e.marker !== staleMarker, store) : this._commandDetection.onCommandFinished;
      const onDone = Promise.race([
        Event.toPromise(onCommandFinishedFiltered, store).then((e) => {
          this._log("onDone via end event");
          return {
            "type": "success",
            command: e
          };
        }),
        Event.toPromise(token.onCancellationRequested, store).then(() => {
          this._log("onDone via cancellation");
        }),
        Event.toPromise(this._instance.onDisposed, store).then(() => {
          this._log("onDone via terminal disposal");
          return { type: "disposal" };
        }),
        Event.toPromise(this._instance.onExit, store).then((exitCodeOrError) => {
          this._log(`onDone via process exit (${formatExitCodeOrError(exitCodeOrError)})`);
          return { type: "processExit", exitCodeOrError };
        }),
        // For sync mode, track idle-on-prompt as a race candidate so that
        // commands complete when the terminal returns to a prompt. For async
        // mode this is unnecessary — the OutputMonitor handles idle detection
        // and the strategy result is not awaited.
        ...this._isSyncMode ? [
          trackIdleOnPrompt(this._instance, idlePollInterval, store, idlePollInterval, this._logService, { disableFallbacks: true }).then(() => {
            this._log("onDone via idle prompt");
          })
        ] : []
      ]);
      this._log("Waiting for xterm");
      const xterm = await this._instance.xtermReadyPromise;
      if (!xterm) {
        throw new Error("Xterm is not available");
      }
      const alternateBufferPromise = createAltBufferPromise(xterm, store, this._log.bind(this));
      const markerRecreation = setupRecreatingStartMarker(
        xterm,
        this._startMarker,
        (m) => this._onDidCreateStartMarker.fire(m),
        store,
        this._log.bind(this)
      );
      this._log(`Executing command line \`${commandLine}\``);
      markerRecreation.dispose();
      const forceBracketedPasteMode = isMacintosh || isMultilineCommand(commandLine);
      this._instance.runCommand(commandLine, true, commandId, forceBracketedPasteMode, commandLineForMetadata);
      this._log("Waiting for done event");
      const onDoneResult = await Promise.race([onDone, alternateBufferPromise.then(() => ({ type: "alternateBuffer" }))]);
      if (onDoneResult && onDoneResult.type === "disposal") {
        throw new Error("The terminal was closed");
      }
      if (onDoneResult && onDoneResult.type === "alternateBuffer") {
        this._log("Detected alternate buffer entry, skipping output capture");
        return {
          output: void 0,
          exitCode: void 0,
          error: "alternateBuffer",
          didEnterAltBuffer: true
        };
      }
      const finishedCommand = onDoneResult && onDoneResult.type === "success" ? onDoneResult.command : void 0;
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      const endMarker = store.add(xterm.raw.registerMarker());
      let output;
      const additionalInformationLines = [];
      if (finishedCommand) {
        const commandOutput = finishedCommand?.getOutput();
        if (commandOutput !== void 0) {
          this._log("Fetched output via finished command");
          output = stripCommandEchoAndPrompt(commandOutput, commandLine, this._log.bind(this));
        }
      }
      if (output === void 0) {
        try {
          const startMarkerDisposed = this._startMarker.value?.line === -1;
          output = xterm.getContentsAsText(this._startMarker.value, endMarker);
          this._log("Fetched output via markers");
          if (output !== void 0) {
            output = stripCommandEchoAndPrompt(output, commandLine, this._log.bind(this));
          }
          if (startMarkerDisposed) {
            this._log("Start marker was disposed (output exceeded scrollback), output may be truncated from the beginning");
            additionalInformationLines.push("Output exceeded terminal scrollback; beginning of output was lost");
          }
        } catch {
          this._log("Failed to fetch output via markers");
          additionalInformationLines.push("Failed to retrieve command output");
        }
      }
      if (output !== void 0 && output.trim().length === 0) {
        additionalInformationLines.push("Command produced no output");
      }
      let exitCode = finishedCommand?.exitCode;
      if (exitCode === void 0 && onDoneResult && onDoneResult.type === "processExit") {
        exitCode = extractExitCode(onDoneResult.exitCodeOrError);
      }
      if (isNumber(exitCode) && exitCode > 0) {
        additionalInformationLines.push(`Command exited with code ${exitCode}`);
      }
      return {
        output,
        additionalInformation: additionalInformationLines.length > 0 ? additionalInformationLines.join("\n") : void 0,
        exitCode
      };
    } finally {
      this._executionStores.delete(store);
    }
  }
  _log(message) {
    const msg = `RunInTerminalTool#Rich: ${message}`;
    if (isCI) {
      this._logService.info(msg);
    } else {
      this._logService.debug(msg);
    }
  }
};
RichExecuteStrategy = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ITerminalLogService)
], RichExecuteStrategy);
export {
  RichExecuteStrategy
};
