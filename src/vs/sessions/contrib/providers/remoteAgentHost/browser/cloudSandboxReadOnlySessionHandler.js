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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { AgentSession } from "../../../../../platform/agentHost/common/agentService.js";
import { ICloudSandboxApiService } from "../../../../../platform/agentHost/common/cloudSandboxAgentHost.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { activeTurnToProgress, messageToVariableData, turnsToHistory } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.js";
const LOG_PREFIX = "[CloudSandboxReadOnly]";
class ReadOnlyChatSession extends Disposable {
  constructor(sessionResource, history, title, isReadOnly) {
    super();
    this.sessionResource = sessionResource;
    this.history = history;
    this.title = title;
    this.isReadOnly = isReadOnly;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
}
let CloudSandboxReadOnlySessionHandler = class extends Disposable {
  constructor(_config, _apiService, _logService) {
    super();
    this._config = _config;
    this._apiService = _apiService;
    this._logService = _logService;
    /**
     * Starts `false`: the transcript can be shown while the connect is still in flight, and an
     * environment that goes on to wake must not have been presented as read-only. Observable so an
     * already-rendered session can be settled in place by {@link markReadOnly}.
     */
    this._isReadOnly = observableValue("cloudSandboxReadOnly", false);
    this._prefetchedHistory = _config.prefetchedHistory;
  }
  /** Settle as read-only once the connect has failed; open sessions disable their composer. */
  markReadOnly() {
    this._isReadOnly.set(true, void 0);
  }
  /** Persisted history, preferring a prefetch already in flight over a fresh read. */
  async _readHistory(token) {
    const prefetched = this._prefetchedHistory;
    this._prefetchedHistory = void 0;
    if (prefetched) {
      const replayed = await prefetched;
      if (replayed) {
        return replayed;
      }
    }
    return this._apiService.getSessionHistory(this._config.taskId, token);
  }
  async provideChatSessionContent(sessionResource, token) {
    const sessionId = AgentSession.id(sessionResource);
    const replayed = await this._readHistory(token);
    const session = replayed?.sessions.find((s) => AgentSession.id(URI.parse(s.session)) === sessionId);
    if (!session) {
      this._logService.warn(`${LOG_PREFIX} No persisted history for session ${sessionId} in task ${this._config.taskId} (replayed sessions: [${replayed?.sessions.map((s) => s.session).join(", ") ?? "none"}]); opening an empty read-only session.`);
      return new ReadOnlyChatSession(sessionResource, [], void 0, this._isReadOnly);
    }
    const chat = session.chats.get(session.defaultChat) ?? [...session.chats.values()][0];
    const history = chat ? turnsToHistory(URI.parse(session.session), chat.turns, this._config.agentId, this._config.connectionAuthority) : [];
    const active = chat?.activeTurn;
    if (active) {
      history.push({
        id: active.id,
        type: "request",
        prompt: active.message.text,
        participant: this._config.agentId,
        variableData: messageToVariableData(active.message, this._config.connectionAuthority)
      });
      history.push({
        type: "response",
        parts: activeTurnToProgress(
          URI.parse(session.session),
          active,
          this._config.connectionAuthority,
          sessionResource.authority
        ),
        participant: this._config.agentId
      });
    }
    if (replayed?.truncated) {
      this._logService.warn(`${LOG_PREFIX} History for task ${this._config.taskId} is truncated; the final exchange may be incomplete.`);
      history.push({
        type: "response",
        parts: [{
          kind: "warning",
          content: new MarkdownString(localize(
            "cloudSandbox.truncatedHistory",
            "This conversation is incomplete. Its recorded history ends mid-response, so the last exchange may be missing."
          ))
        }],
        participant: this._config.agentId
      });
    }
    this._logService.info(`${LOG_PREFIX} Opened ${sessionResource.toString()} read-only with ${history.length} history item(s) from ${chat?.turns.length ?? 0} turn(s); chats=[${[...session.chats.keys()].join(", ")}], default=${session.defaultChat}.`);
    return new ReadOnlyChatSession(sessionResource, history, session.state.title || void 0, this._isReadOnly);
  }
};
CloudSandboxReadOnlySessionHandler = __decorateClass([
  __decorateParam(1, ICloudSandboxApiService),
  __decorateParam(2, ILogService)
], CloudSandboxReadOnlySessionHandler);
export {
  CloudSandboxReadOnlySessionHandler
};
