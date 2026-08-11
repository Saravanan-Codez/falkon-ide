import { disposableTimeout } from "../../../base/common/async.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { ToolCallContributorKind } from "../common/state/sessionState.js";
const TOOL_CALL_STALL_THRESHOLD_MS = 5 * 60 * 1e3;
function deriveToolInvokedResult(result) {
  if (result.success) {
    return "success";
  }
  const code = result.error?.code;
  if (code === "rejected" || code === "denied" || code === "cancelled") {
    return "userCancelled";
  }
  return "error";
}
function toolSourceKindFromContributor(contributor) {
  if (!contributor) {
    return "agentHost";
  }
  const kind = contributor.kind;
  switch (kind) {
    case ToolCallContributorKind.MCP:
      return "mcp";
    case ToolCallContributorKind.Client:
      return "client";
    default:
      return kind;
  }
}
function canRefineContributor(current, next) {
  if (current?.kind === ToolCallContributorKind.Client) {
    return next.kind === ToolCallContributorKind.Client && next.clientId === current.clientId;
  }
  return next.kind !== ToolCallContributorKind.Client;
}
class AgentHostToolCallTracker extends Disposable {
  constructor(_reporter) {
    super();
    this._reporter = _reporter;
    this._toolCalls = /* @__PURE__ */ new Map();
    this._turnModels = /* @__PURE__ */ new Map();
    this._pendingToolReports = /* @__PURE__ */ new Map();
    this._toolCallStallTimers = this._register(new DisposableMap());
    this._stalledToolCalls = /* @__PURE__ */ new Map();
  }
  toolCallStarted(provider, session, turnId, toolCallId, toolName, contributor, model, modelTelemetryKind) {
    const resolvedModel = this._turnModels.get(this._turnKey(session, turnId));
    this._toolCalls.set(this._key(session, toolCallId), {
      lifecycleStopWatch: StopWatch.create(true),
      provider,
      session,
      turnId,
      toolId: toolName,
      contributor,
      toolSourceKind: toolSourceKindFromContributor(contributor),
      model: resolvedModel?.model ?? model,
      modelTelemetryKind: resolvedModel?.modelTelemetryKind ?? modelTelemetryKind,
      modelResolvedFromUsage: resolvedModel !== void 0
    });
  }
  updateTurnModel(session, turnId, model, modelTelemetryKind) {
    const turnKey = this._turnKey(session, turnId);
    this._turnModels.set(turnKey, { model, modelTelemetryKind });
    for (const timing of this._toolCalls.values()) {
      if (timing.session === session && timing.turnId === turnId) {
        timing.model = model;
        timing.modelTelemetryKind = modelTelemetryKind;
        timing.modelResolvedFromUsage = true;
      }
    }
    const pending = this._pendingToolReports.get(turnKey);
    if (pending) {
      this._pendingToolReports.delete(turnKey);
      for (const report of pending) {
        this._reporter.toolInvoked({ ...report, model, modelTelemetryKind });
      }
    }
  }
  toolCallMetadataUpdated(session, toolCallId, contributor) {
    const timing = this._toolCalls.get(this._key(session, toolCallId));
    if (!timing) {
      return;
    }
    if (contributor && canRefineContributor(timing.contributor, contributor)) {
      timing.contributor = contributor;
      timing.toolSourceKind = toolSourceKindFromContributor(contributor);
    }
  }
  toolCallExecutionStarted(session, toolCallId) {
    const timing = this._toolCalls.get(this._key(session, toolCallId));
    if (timing && !timing.invocationStopWatch) {
      timing.invocationStopWatch = StopWatch.create(true);
    }
  }
  toolCallCompleted(session, toolCallId, result) {
    const key = this._key(session, toolCallId);
    const timing = this._toolCalls.get(key);
    if (!timing) {
      return;
    }
    this._toolCalls.delete(key);
    const resultBucket = deriveToolInvokedResult(result);
    const totalTimeMs = timing.lifecycleStopWatch.elapsed();
    const resultSizeInCharacters = JSON.stringify(result).length;
    const report = {
      provider: timing.provider,
      session: timing.session,
      turnId: timing.turnId,
      toolId: timing.toolId,
      toolSourceKind: timing.toolSourceKind,
      toolCallId,
      result: resultBucket,
      invocationTimeMs: timing.invocationStopWatch?.elapsed(),
      resultSizeInCharacters,
      model: timing.model,
      modelTelemetryKind: timing.modelTelemetryKind
    };
    if (timing.modelResolvedFromUsage) {
      this._reporter.toolInvoked(report);
    } else {
      const turnKey = this._turnKey(timing.session, timing.turnId);
      const pending = this._pendingToolReports.get(turnKey) ?? [];
      pending.push(report);
      this._pendingToolReports.set(turnKey, pending);
    }
    const stalled = this._stalledToolCalls.get(key);
    if (stalled) {
      this._stalledToolCalls.delete(key);
      this._reporter.stalledToolCallCompleted({
        provider: timing.provider,
        session: timing.session,
        blockerKind: stalled.blockerKind,
        toolId: timing.toolId,
        toolSourceKind: timing.toolSourceKind,
        result: resultBucket,
        totalTimeMs,
        timeAfterStallMs: stalled.completionStopWatch.elapsed()
      });
    }
  }
  toolCallBlocked(provider, session, request) {
    const key = this._key(session, request.id);
    const toolCallKey = this._key(session, request.toolCall.toolCallId);
    if (this._toolCallStallTimers.has(key) || this._stalledToolCalls.has(toolCallKey)) {
      return;
    }
    const stopWatch = StopWatch.create(true);
    this._toolCallStallTimers.set(key, disposableTimeout(() => {
      const stalledTimeMs = stopWatch.elapsed();
      this._stalledToolCalls.set(toolCallKey, { blockerKind: request.kind, completionStopWatch: StopWatch.create(true) });
      this._reporter.toolCallStalled({
        provider,
        session,
        blockerKind: request.kind,
        toolId: request.toolCall.toolName,
        toolSourceKind: toolSourceKindFromContributor(request.toolCall.contributor),
        stalledTimeMs
      });
    }, TOOL_CALL_STALL_THRESHOLD_MS));
  }
  toolCallUnblocked(session, requestId) {
    this._toolCallStallTimers.deleteAndDispose(this._key(session, requestId));
  }
  /**
   * Drops any in-flight (never-completed) tool calls for a session. Called
   * when a turn ends or a session is torn down so the tracking map cannot
   * leak. A no-op in the normal case where every tool call completes.
   */
  clearSession(session) {
    const prefix = `${session}\0`;
    for (const [key, reports] of this._pendingToolReports) {
      if (key.startsWith(prefix)) {
        this._pendingToolReports.delete(key);
        for (const report of reports) {
          this._reporter.toolInvoked(report);
        }
      }
    }
    for (const key of this._toolCalls.keys()) {
      if (key.startsWith(prefix)) {
        this._toolCalls.delete(key);
      }
    }
    for (const key of this._toolCallStallTimers.keys()) {
      if (key.startsWith(prefix)) {
        this._toolCallStallTimers.deleteAndDispose(key);
      }
    }
    for (const key of this._stalledToolCalls.keys()) {
      if (key.startsWith(prefix)) {
        this._stalledToolCalls.delete(key);
      }
    }
    for (const key of this._turnModels.keys()) {
      if (key.startsWith(prefix)) {
        this._turnModels.delete(key);
      }
    }
  }
  clear() {
    this._toolCalls.clear();
    this._turnModels.clear();
    this._pendingToolReports.clear();
    this._toolCallStallTimers.clearAndDisposeAll();
    this._stalledToolCalls.clear();
  }
  _key(session, toolCallId) {
    return `${session}\0${toolCallId}`;
  }
  _turnKey(session, turnId) {
    return `${session}\0${turnId}`;
  }
}
export {
  AgentHostToolCallTracker,
  deriveToolInvokedResult,
  toolSourceKindFromContributor
};
