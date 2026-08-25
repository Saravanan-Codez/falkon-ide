import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { TerminalClaimKind } from "../../common/state/protocol/state.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { isAhpChatChannel, parseRequiredSessionUriFromChatUri, ToolCallConfirmationReason, ToolResultContentType } from "../../common/state/sessionState.js";
import { parseBangCommand } from "../agentHostBangCommand.js";
import { DEFAULT_SHELL_COMMAND_TIMEOUT_MS, executeShellCommand, shellTypeForExecutable } from "../shared/shellCommandExecution.js";
import { LocalChatCommandRegistry } from "./localChatCommand.js";
class BangLocalCommand extends Disposable {
  constructor(_context) {
    super();
    this._context = _context;
    this.name = "bang";
    this.recordsLocalTurn = true;
    /** Terminals kept alive for transcript output; disposed with this command. */
    this._terminals = /* @__PURE__ */ new Set();
    this._register(toDisposable(() => {
      for (const terminalUri of this._terminals) {
        this._context.terminalManager.disposeTerminal(terminalUri);
      }
      this._terminals.clear();
    }));
  }
  tryHandle(request) {
    const command = parseBangCommand(request.text);
    if (command === void 0) {
      return void 0;
    }
    return { run: () => this._run(request.turnChannel, request.turnId, command), suggestedTitle: command };
  }
  async _run(turnChannel, turnId, command) {
    const ctx = this._context;
    const sessionChannel = isAhpChatChannel(turnChannel) ? parseRequiredSessionUriFromChatUri(turnChannel) : turnChannel;
    const toolCallId = generateUuid();
    const terminalUri = `agenthost-terminal://bang/${generateUuid()}`;
    const displayName = localize("agentHostBang.terminal", "Terminal");
    let terminalCreated = false;
    try {
      const workingDirStr = ctx.getState(sessionChannel)?.workingDirectories?.[0];
      const cwd = workingDirStr ? URI.parse(workingDirStr).fsPath : void 0;
      const shellPath = await ctx.terminalManager.getDefaultShell();
      const shellType = shellTypeForExecutable(shellPath);
      ctx.dispatch(turnChannel, {
        type: ActionType.ChatToolCallStart,
        turnId,
        toolCallId,
        toolName: "terminal",
        displayName,
        intention: command
      });
      ctx.dispatch(turnChannel, {
        type: ActionType.ChatToolCallReady,
        turnId,
        toolCallId,
        invocationMessage: command,
        toolInput: command,
        confirmed: ToolCallConfirmationReason.NotNeeded
      });
      const claim = {
        kind: TerminalClaimKind.Session,
        session: sessionChannel,
        turnId,
        toolCallId
      };
      const params = { channel: terminalUri, claim, name: displayName, cwd };
      await ctx.terminalManager.createTerminal(params, { shell: shellPath, preventShellHistory: true, nonInteractive: true });
      terminalCreated = true;
      this._terminals.add(terminalUri);
      const terminalContent = { type: ToolResultContentType.Terminal, resource: terminalUri, title: displayName };
      ctx.dispatch(turnChannel, {
        type: ActionType.ChatToolCallContentChanged,
        turnId,
        toolCallId,
        content: [terminalContent]
      });
      const result = await executeShellCommand({ terminalUri, shellType }, command, DEFAULT_SHELL_COMMAND_TIMEOUT_MS, ctx.terminalManager, ctx.logService);
      const { success, pastTenseMessage } = this._summarizeResult(result);
      const content = [terminalContent];
      if (result.output) {
        content.push({ type: ToolResultContentType.Text, text: result.output });
      }
      ctx.dispatch(turnChannel, {
        type: ActionType.ChatToolCallComplete,
        turnId,
        toolCallId,
        result: { success, pastTenseMessage, content }
      });
    } catch (err) {
      ctx.logService.error(`[BangLocalCommand] Command failed for session=${sessionChannel}: ${err instanceof Error ? err.message : String(err)}`, err);
      if (terminalCreated) {
        ctx.terminalManager.disposeTerminal(terminalUri);
        this._terminals.delete(terminalUri);
      }
      ctx.dispatch(turnChannel, {
        type: ActionType.ChatToolCallComplete,
        turnId,
        toolCallId,
        result: {
          success: false,
          pastTenseMessage: localize("agentHostBang.failed", "Failed to run command"),
          error: { message: err instanceof Error ? err.message : String(err) }
        }
      });
    }
  }
  /**
   * Maps a shell command result to a success flag and past-tense summary for
   * the completed tool call.
   */
  _summarizeResult(result) {
    switch (result.status) {
      case "completed": {
        const exitCode = result.exitCode ?? 0;
        return exitCode === 0 ? { success: true, pastTenseMessage: localize("agentHostBang.ran", "Ran command") } : { success: false, pastTenseMessage: localize("agentHostBang.exited", "Command exited with code {0}", exitCode) };
      }
      case "timeout":
        return { success: false, pastTenseMessage: localize("agentHostBang.timedOut", "Command timed out") };
      case "shellExited":
        return { success: false, pastTenseMessage: localize("agentHostBang.shellExited", "Shell exited unexpectedly") };
      case "background":
        return { success: true, pastTenseMessage: localize("agentHostBang.background", "Command is running in the background") };
      case "altBuffer":
        return { success: true, pastTenseMessage: localize("agentHostBang.interactive", "Command opened an interactive terminal") };
    }
  }
}
LocalChatCommandRegistry.register(BangLocalCommand);
export {
  BangLocalCommand
};
