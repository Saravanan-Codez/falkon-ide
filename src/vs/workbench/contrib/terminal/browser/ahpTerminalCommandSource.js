import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { AhpCommandMarkKind, getAhpCommandMarkId } from "./agentHostPty.js";
class AhpTerminalCommand {
  constructor(commandId, commandLine, timestamp, options) {
    this.commandLineConfidence = "high";
    this.isTrusted = false;
    this.duration = 0;
    // -- IBaseTerminalCommand optional fields --
    this.cwd = void 0;
    this.exitCode = void 0;
    this.commandStartLineContent = void 0;
    this.markProperties = void 0;
    this.executedX = void 0;
    this.startX = void 0;
    this._isComplete = false;
    this.id = commandId;
    this.command = commandLine;
    this.timestamp = timestamp;
    this._resolveMarker = options?.resolveMarker;
    this._storedOutput = options?.storedOutput;
    this.wasReplayed = options?.wasReplayed;
  }
  /**
   * Lazily resolved executed marker. Uses a getter so that the marker is
   * resolved on first access rather than at construction time, giving xterm
   * a chance to flush the SetMark sequence through its async write queue.
   */
  get executedMarker() {
    if (this._executedMarker === void 0 && this._resolveMarker) {
      this._executedMarker = this._resolveMarker(AhpCommandMarkKind.Executed);
    }
    return this._executedMarker;
  }
  /**
   * Lazily resolved end marker, same rationale as {@link executedMarker}.
   */
  get endMarker() {
    if (this._endMarker === void 0 && this._isComplete && this._resolveMarker) {
      this._endMarker = this._resolveMarker(AhpCommandMarkKind.End);
    }
    return this._endMarker;
  }
  set endMarker(value) {
    this._endMarker = value;
  }
  extractCommandLine() {
    return this.command;
  }
  getOutput() {
    return this._storedOutput !== void 0 ? removeAnsiEscapeCodes(this._storedOutput) : void 0;
  }
  /**
   * Get the raw VT output (with ANSI escape codes preserved).
   * Used by the terminal mirror for rendering.
   */
  getRawOutput() {
    return this._storedOutput;
  }
  hasOutput() {
    if (this._storedOutput !== void 0) {
      return this._storedOutput.length > 0;
    }
    return false;
  }
  getOutputMatch(_outputMatcher) {
    return void 0;
  }
  getPromptRowCount() {
    return 1;
  }
  getCommandRowCount() {
    return 1;
  }
  /**
   * Append VT output to the stored output buffer. Called during streaming
   * as `terminal/data` actions arrive.
   */
  appendOutput(data) {
    if (this._storedOutput === void 0) {
      this._storedOutput = data;
    } else {
      this._storedOutput += data;
    }
  }
  /**
   * Mark this command as finished with the given exit code and duration.
   */
  finish(exitCode, durationMs) {
    this.exitCode = exitCode;
    this.duration = durationMs ?? 0;
    this._isComplete = true;
  }
}
class AhpTerminalCommandSource extends Disposable {
  constructor() {
    super(...arguments);
    this._commands = [];
    this._onCommandExecuted = this._register(new Emitter());
    this.onCommandExecuted = this._onCommandExecuted.event;
    this._onCommandFinished = this._register(new Emitter());
    this.onCommandFinished = this._onCommandFinished.event;
  }
  get commands() {
    return this._commands;
  }
  get executingCommandObject() {
    return this._executingCommand;
  }
  connect(terminalInstance, pty) {
    this._terminalInstance = terminalInstance;
    this._register(pty.onCommandExecuted((e) => this._handleCommandExecuted(e)));
    this._register(pty.onCommandFinished((e) => this._handleCommandFinished(e)));
    this._register(terminalInstance.onWillData((data) => {
      if (this._executingCommand && !this._executingCommand.wasReplayed) {
        this._executingCommand.appendOutput(data);
      }
    }));
  }
  getCommandById(id) {
    if (this._executingCommand?.id === id) {
      return this._executingCommand;
    }
    return this._commands.find((c) => c.id === id);
  }
  /**
   * Resolves an xterm marker by its AHP command mark ID from the
   * {@link IBufferMarkCapability}. The marker is placed by xterm's OSC 633
   * parser when it processes the SetMark sequence injected by
   * {@link AgentHostPty}, so it is always at the correct cursor position
   * regardless of whether the data was replayed or streamed.
   */
  _resolveMarkById(commandId, kind) {
    const markId = getAhpCommandMarkId(commandId, kind);
    const bufferMarkCapability = this._terminalInstance?.capabilities.get(TerminalCapability.BufferMarkDetection);
    return bufferMarkCapability?.getMark(markId);
  }
  _handleCommandExecuted(event) {
    const command = new AhpTerminalCommand(
      event.commandId,
      event.commandLine,
      event.timestamp,
      {
        resolveMarker: (kind) => this._resolveMarkById(event.commandId, kind),
        storedOutput: event.storedOutput,
        wasReplayed: event.storedOutput !== void 0
      }
    );
    this._executingCommand = command;
    this._onCommandExecuted.fire(command);
  }
  _handleCommandFinished(event) {
    const command = this._executingCommand?.id === event.commandId ? this._executingCommand : this._commands.find((c) => c.id === event.commandId);
    if (!command) {
      return;
    }
    command.finish(event.exitCode, event.durationMs);
    if (this._executingCommand === command) {
      this._executingCommand = void 0;
      this._commands.push(command);
    }
    this._onCommandFinished.fire(command);
  }
}
export {
  AhpTerminalCommand,
  AhpTerminalCommandSource
};
