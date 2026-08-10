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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ILogService } from "../../../log/common/log.js";
import { ISessionDataService } from "../../common/sessionDataService.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { isAhpChatChannel, parseRequiredSessionUriFromChatUri, ResponsePartKind, ToolCallStatus, ToolResultContentType } from "../../common/state/sessionState.js";
import { IAgentHostTerminalManager } from "../agentHostTerminalManager.js";
import { persistSessionMetadata } from "../shared/persistSessionMetadata.js";
class LocalChatCommandRegistryImpl {
  constructor() {
    this._ctors = [];
  }
  register(ctor) {
    this._ctors.push(ctor);
  }
  createAll(context) {
    return this._ctors.map((ctor) => new ctor(context));
  }
}
const LocalChatCommandRegistry = new LocalChatCommandRegistryImpl();
let AgentHostLocalCommands = class extends Disposable {
  constructor(_stateManager, _localTurns, _notifyTurnConsumable, _logService, _terminalManager, _sessionDataService) {
    super();
    this._stateManager = _stateManager;
    this._localTurns = _localTurns;
    this._notifyTurnConsumable = _notifyTurnConsumable;
    this._logService = _logService;
    this._terminalManager = _terminalManager;
    this._sessionDataService = _sessionDataService;
    const context = {
      logService: this._logService,
      terminalManager: this._terminalManager,
      dispatch: (channel, action) => this._stateManager.dispatchServerAction(channel, action),
      getState: (channel) => this._stateManager.getSessionState(channel),
      updateChatTitle: (session, chat, title) => this._stateManager.updateChatTitle(session, chat, title),
      persistSessionFlag: (session, key, value) => persistSessionMetadata(this._sessionDataService, this._logService, session, key, value)
    };
    this._commands = LocalChatCommandRegistry.createAll(context).map((command) => this._register(command));
  }
  /**
   * Offers `request` to each command. When one handles it, the dispatcher has
   * already scheduled its `run`; it returns the {@link ILocalChatCommandHandling}
   * so the caller can act on carried metadata such as
   * {@link ILocalChatCommandHandling.suggestedTitle}. Its presence means the
   * caller MUST NOT forward the message to the agent (and MUST NOT invoke `run`
   * again). Returns `undefined` when no command applies.
   */
  tryHandle(request) {
    for (const command of this._commands) {
      const handling = command.tryHandle(request);
      if (handling) {
        void this._run(command, handling, request);
        return handling;
      }
    }
    return void 0;
  }
  async _run(command, handling, request) {
    const stopWatch = StopWatch.create(false);
    try {
      await handling.run();
    } catch (err) {
      this._logService.error(`[AgentHostLocalCommands] Command '${command.name}' failed: ${err instanceof Error ? err.message : String(err)}`, err);
    } finally {
      this._stateManager.dispatchServerAction(request.turnChannel, { type: ActionType.ChatTurnComplete, turnId: request.turnId, duration: Math.max(0, stopWatch.elapsed()) });
      if (command.recordsLocalTurn) {
        this._recordLocalTurn(request.turnChannel, request.turnId);
      }
      this._notifyTurnConsumable(request.turnChannel);
    }
  }
  /**
   * Records the just-completed turn `turnId` as a host-injected local turn so
   * it survives reload and fork/truncate can resolve it to the preceding
   * concrete turn. Works uniformly for the default chat and any peer chat —
   * the turn is keyed by its chat channel. Live terminal references are
   * stripped from the payload (the PTY does not survive a reload).
   */
  _recordLocalTurn(turnChannel, turnId) {
    const chat = turnChannel;
    const session = isAhpChatChannel(turnChannel) ? parseRequiredSessionUriFromChatUri(turnChannel) : turnChannel;
    const turns = this._stateManager.getSessionState(turnChannel)?.turns;
    if (!turns) {
      return;
    }
    const index = turns.findIndex((t) => t.id === turnId);
    if (index < 0) {
      return;
    }
    let anchorTurnId;
    for (let i = index - 1; i >= 0; i--) {
      if (!this._localTurns.isLocal(chat, turns[i].id)) {
        anchorTurnId = turns[i].id;
        break;
      }
    }
    this._localTurns.record(session, chat, sanitizeLocalTurnForPersistence(turns[index]), anchorTurnId);
  }
};
AgentHostLocalCommands = __decorateClass([
  __decorateParam(3, ILogService),
  __decorateParam(4, IAgentHostTerminalManager),
  __decorateParam(5, ISessionDataService)
], AgentHostLocalCommands);
function sanitizeLocalTurnForPersistence(turn) {
  const responseParts = turn.responseParts.map((part) => {
    if (part.kind !== ResponsePartKind.ToolCall) {
      return part;
    }
    const tc = part.toolCall;
    if (tc.status !== ToolCallStatus.Running && tc.status !== ToolCallStatus.Completed && tc.status !== ToolCallStatus.PendingResultConfirmation) {
      return part;
    }
    if (!tc.content) {
      return part;
    }
    const content = tc.content.filter((c) => c.type !== ToolResultContentType.Terminal);
    if (content.length === tc.content.length) {
      return part;
    }
    return { ...part, toolCall: { ...tc, content } };
  });
  return { ...turn, responseParts };
}
export {
  AgentHostLocalCommands,
  LocalChatCommandRegistry
};
