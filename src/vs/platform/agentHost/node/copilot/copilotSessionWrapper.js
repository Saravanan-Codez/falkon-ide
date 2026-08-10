import { DeferredPromise } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
class CopilotSessionWrapper extends Disposable {
  constructor(session) {
    super();
    this.session = session;
    this._handledEventTypes = /* @__PURE__ */ new Set();
    this._onUnhandledEvent = this._register(new Emitter());
    this.onUnhandledEvent = this._onUnhandledEvent.event;
    this._shutdown = new DeferredPromise();
    const unsubscribeAll = session.on((event) => {
      if (event.type === "session.shutdown") {
        void this._shutdown.complete();
      }
      if (!this._handledEventTypes.has(event.type)) {
        this._onUnhandledEvent.fire(event);
      }
    });
    this._register(toDisposable(unsubscribeAll));
    this._register(toDisposable(() => {
      void this.disconnect().catch(() => {
      });
    }));
  }
  get sessionId() {
    return this.session.sessionId;
  }
  /** Disconnects once the request completes or the SDK reports session shutdown. */
  disconnect() {
    if (this._shutdown.isSettled) {
      return this._shutdown.p;
    }
    this._disconnectPromise ??= this.session.disconnect().catch((error) => {
      if (!this._shutdown.isSettled) {
        throw error;
      }
    });
    return Promise.race([this._disconnectPromise, this._shutdown.p]);
  }
  get onMessageDelta() {
    return this._onMessageDelta ??= this._sdkEvent("assistant.message_delta");
  }
  get onMessage() {
    return this._onMessage ??= this._sdkEvent("assistant.message");
  }
  get onToolCallDelta() {
    return this._onToolCallDelta ??= this._sdkEvent("assistant.tool_call_delta");
  }
  get onToolStart() {
    return this._onToolStart ??= this._sdkEvent("tool.execution_start");
  }
  get onToolComplete() {
    return this._onToolComplete ??= this._sdkEvent("tool.execution_complete");
  }
  get onPermissionRequested() {
    return this._onPermissionRequested ??= this._sdkEvent("permission.requested");
  }
  get onPermissionCompleted() {
    return this._onPermissionCompleted ??= this._sdkEvent("permission.completed");
  }
  get onIdle() {
    return this._onIdle ??= this._sdkEvent("session.idle");
  }
  get onSessionStart() {
    return this._onSessionStart ??= this._sdkEvent("session.start");
  }
  get onSessionResume() {
    return this._onSessionResume ??= this._sdkEvent("session.resume");
  }
  get onSessionError() {
    return this._onSessionError ??= this._sdkEvent("session.error");
  }
  get onSessionInfo() {
    return this._onSessionInfo ??= this._sdkEvent("session.info");
  }
  get onSessionWarning() {
    return this._onSessionWarning ??= this._sdkEvent("session.warning");
  }
  get onSessionModelChange() {
    return this._onSessionModelChange ??= this._sdkEvent("session.model_change");
  }
  get onAutoModeResolved() {
    return this._onAutoModeResolved ??= this._sdkEvent("session.auto_mode_resolved");
  }
  get onManagedSettingsResolved() {
    return this._onManagedSettingsResolved ??= this._sdkEvent("session.managed_settings_resolved");
  }
  get onManagedSettingsEnforced() {
    return this._onManagedSettingsEnforced ??= this._sdkEvent("session.managed_settings_enforced");
  }
  get onSessionHandoff() {
    return this._onSessionHandoff ??= this._sdkEvent("session.handoff");
  }
  get onSessionTruncation() {
    return this._onSessionTruncation ??= this._sdkEvent("session.truncation");
  }
  get onSessionSnapshotRewind() {
    return this._onSessionSnapshotRewind ??= this._sdkEvent("session.snapshot_rewind");
  }
  get onSessionShutdown() {
    return this._onSessionShutdown ??= this._sdkEvent("session.shutdown");
  }
  get onSessionUsageInfo() {
    return this._onSessionUsageInfo ??= this._sdkEvent("session.usage_info");
  }
  get onSessionCompactionStart() {
    return this._onSessionCompactionStart ??= this._sdkEvent("session.compaction_start");
  }
  get onSessionCompactionComplete() {
    return this._onSessionCompactionComplete ??= this._sdkEvent("session.compaction_complete");
  }
  get onUserMessage() {
    return this._onUserMessage ??= this._sdkEvent("user.message");
  }
  get onPendingMessagesModified() {
    return this._onPendingMessagesModified ??= this._sdkEvent("pending_messages.modified");
  }
  get onTurnStart() {
    return this._onTurnStart ??= this._sdkEvent("assistant.turn_start");
  }
  get onIntent() {
    return this._onIntent ??= this._sdkEvent("assistant.intent");
  }
  get onReasoning() {
    return this._onReasoning ??= this._sdkEvent("assistant.reasoning");
  }
  get onReasoningDelta() {
    return this._onReasoningDelta ??= this._sdkEvent("assistant.reasoning_delta");
  }
  get onTurnEnd() {
    return this._onTurnEnd ??= this._sdkEvent("assistant.turn_end");
  }
  get onUsage() {
    return this._onUsage ??= this._sdkEvent("assistant.usage");
  }
  get onModelCallFailure() {
    return this._onModelCallFailure ??= this._sdkEvent("model.call_failure");
  }
  get onAbort() {
    return this._onAbort ??= this._sdkEvent("abort");
  }
  get onToolUserRequested() {
    return this._onToolUserRequested ??= this._sdkEvent("tool.user_requested");
  }
  get onToolPartialResult() {
    return this._onToolPartialResult ??= this._sdkEvent("tool.execution_partial_result");
  }
  get onToolProgress() {
    return this._onToolProgress ??= this._sdkEvent("tool.execution_progress");
  }
  get onSkillInvoked() {
    return this._onSkillInvoked ??= this._sdkEvent("skill.invoked");
  }
  get onSubagentStarted() {
    return this._onSubagentStarted ??= this._sdkEvent("subagent.started");
  }
  get onSubagentCompleted() {
    return this._onSubagentCompleted ??= this._sdkEvent("subagent.completed");
  }
  get onSubagentFailed() {
    return this._onSubagentFailed ??= this._sdkEvent("subagent.failed");
  }
  get onSubagentSelected() {
    return this._onSubagentSelected ??= this._sdkEvent("subagent.selected");
  }
  get onHookStart() {
    return this._onHookStart ??= this._sdkEvent("hook.start");
  }
  get onHookEnd() {
    return this._onHookEnd ??= this._sdkEvent("hook.end");
  }
  get onSystemMessage() {
    return this._onSystemMessage ??= this._sdkEvent("system.message");
  }
  get onSystemNotification() {
    return this._onSystemNotification ??= this._sdkEvent("system.notification");
  }
  get onSessionModeChanged() {
    return this._onSessionModeChanged ??= this._sdkEvent("session.mode_changed");
  }
  get onMcpServersLoaded() {
    return this._onMcpServersLoaded ??= this._sdkEvent("session.mcp_servers_loaded");
  }
  get onMcpServerStatusChanged() {
    return this._onMcpServerStatusChanged ??= this._sdkEvent("session.mcp_server_status_changed");
  }
  get onToolsUpdated() {
    return this._onToolsUpdated ??= this._sdkEvent("session.tools_updated");
  }
  get onCommandsChanged() {
    return this._onCommandsChanged ??= this._sdkEvent("commands.changed");
  }
  _sdkEvent(eventType) {
    const emitter = this._register(new Emitter({
      onDidAddFirstListener: () => this._handledEventTypes.add(eventType),
      onDidRemoveLastListener: () => this._handledEventTypes.delete(eventType)
    }));
    const unsubscribe = this.session.on(eventType, (data) => emitter.fire(data));
    this._register(toDisposable(unsubscribe));
    return emitter.event;
  }
}
export {
  CopilotSessionWrapper
};
