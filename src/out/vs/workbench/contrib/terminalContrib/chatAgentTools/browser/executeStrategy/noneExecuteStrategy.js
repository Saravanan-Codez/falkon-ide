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
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ITerminalLogService } from "../../../../../../platform/terminal/common/terminal.js";
import { waitForIdle, waitForIdleWithPromptHeuristics } from "./executeStrategy.js";
import { createAltBufferPromise, setupRecreatingStartMarker, stripCommandEchoAndPrompt } from "./strategyHelpers.js";
import { TerminalChatAgentToolsSettingId } from "../../common/terminalChatAgentToolsConfiguration.js";
import { isMacintosh } from "../../../../../../base/common/platform.js";
import { isMultilineCommand } from "../runInTerminalHelpers.js";
let NoneExecuteStrategy = class extends Disposable {
  constructor(_instance, _hasReceivedUserInput, _configurationService, _logService) {
    super();
    this._instance = _instance;
    this._hasReceivedUserInput = _hasReceivedUserInput;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this.type = "none";
    this._startMarker = this._register(new MutableDisposable());
    this._onDidCreateStartMarker = this._register(new Emitter());
    this.onDidCreateStartMarker = this._onDidCreateStartMarker.event;
  }
  async execute(commandLine, token, _commandId, _commandLineForMetadata) {
    const store = new DisposableStore();
    try {
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      this._log("Waiting for xterm");
      const xterm = await this._instance.xtermReadyPromise;
      if (!xterm) {
        throw new Error("Xterm is not available");
      }
      const alternateBufferPromise = createAltBufferPromise(xterm, store, this._log.bind(this));
      const idlePollInterval = this._configurationService.getValue(TerminalChatAgentToolsSettingId.IdlePollInterval) ?? 1e3;
      this._log("Waiting for idle");
      await waitForIdle(this._instance.onData, idlePollInterval);
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      const markerRecreation = setupRecreatingStartMarker(
        xterm,
        this._startMarker,
        (m) => this._onDidCreateStartMarker.fire(m),
        store,
        this._log.bind(this)
      );
      if (this._hasReceivedUserInput()) {
        this._log("Sending Ctrl+U to clear any pending input before sending command");
        await this._instance.sendText("", false);
        await waitForIdle(this._instance.onData, 100);
      }
      this._log(`Executing command line \`${commandLine}\``);
      markerRecreation.dispose();
      const startLine = this._startMarker.value?.line;
      const forceBracketedPasteMode = isMacintosh || isMultilineCommand(commandLine);
      this._instance.sendText(commandLine, true, forceBracketedPasteMode);
      if (startLine !== void 0) {
        this._log("Waiting for cursor to move past start line");
        const cursorMovedPromise = new Promise((resolve) => {
          const check = () => {
            const buffer = xterm.raw.buffer.active;
            const cursorLine = buffer.baseY + buffer.cursorY;
            if (cursorLine > startLine) {
              resolve();
            }
          };
          const listener = this._instance.onData(() => check());
          store.add(listener);
          check();
        });
        const cursorMoveTimeout = new Promise((resolve) => {
          const handle = setTimeout(() => resolve("timeout"), 1e3);
          store.add({ dispose: () => clearTimeout(handle) });
        });
        const raceResult = await Promise.race([cursorMovedPromise, cursorMoveTimeout]);
        if (raceResult === "timeout") {
          this._log("Cursor did not move past start line before timeout, proceeding with idle detection");
        }
      }
      this._log("Waiting for idle with prompt heuristics");
      const promptResultOrAltBuffer = await Promise.race([
        waitForIdleWithPromptHeuristics(this._instance.onData, this._instance, idlePollInterval, idlePollInterval * 10),
        alternateBufferPromise.then(() => "alternateBuffer")
      ]);
      if (promptResultOrAltBuffer === "alternateBuffer") {
        this._log("Detected alternate buffer entry, skipping output capture");
        return {
          output: void 0,
          additionalInformation: void 0,
          exitCode: void 0,
          error: "alternateBuffer",
          didEnterAltBuffer: true
        };
      }
      const promptResult = promptResultOrAltBuffer;
      this._log(`Prompt detection result: ${promptResult.detected ? "detected" : "not detected"} - ${promptResult.reason}`);
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      const endMarker = store.add(xterm.raw.registerMarker());
      let output;
      const additionalInformationLines = [];
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
      if (output !== void 0 && output.trim().length === 0) {
        additionalInformationLines.push("Command produced no output");
      }
      return {
        output,
        additionalInformation: additionalInformationLines.length > 0 ? additionalInformationLines.join("\n") : void 0,
        exitCode: void 0
      };
    } finally {
      store.dispose();
    }
  }
  _log(message) {
    this._logService.debug(`RunInTerminalTool#None: ${message}`);
  }
};
NoneExecuteStrategy = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITerminalLogService)
], NoneExecuteStrategy);
export {
  NoneExecuteStrategy
};
