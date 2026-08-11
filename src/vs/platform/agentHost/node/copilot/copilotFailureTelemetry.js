import { getErrorCode } from "../../../../base/common/errors.js";
import { packErrorForTelemetry } from "../../../telemetry/common/errorTelemetry.js";
import { TelemetryTrustedValue } from "../../../telemetry/common/telemetryUtils.js";
import { AgentSession } from "../../common/agentService.js";
import { getTelemetryChatSessionId } from "../../common/agentTelemetryCorrelation.js";
function createCopilotFailureCorrelation(sessionUri, chatUri, turnId, sdkSessionId) {
  return {
    agentSessionId: AgentSession.id(sessionUri),
    chatSessionId: getTelemetryChatSessionId(chatUri),
    turnId: turnId || void 0,
    sdkSessionId
  };
}
function classifyCopilotClientFailure(error) {
  if (!(error instanceof Error)) {
    return void 0;
  }
  switch (error.message) {
    case "Client not connected":
      return "clientNotConnected";
    case "Connection is closed.":
      return "connectionClosed";
    case "Connection is disposed.":
      return "connectionDisposed";
    case "The in-process runtime connection is closed.":
      return "runtimeConnectionClosed";
  }
  return error.message.startsWith("Failed to start CLI server:") || error.message.startsWith("CLI server exited with code ") || error.message.startsWith("CLI server exited unexpectedly with code ") || error.message === "Timeout waiting for CLI server to start" ? "startupFailed" : void 0;
}
function getCopilotStartupFailureCause(message) {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("specified procedure could not be found")) {
    return "nativeModuleProcedureNotFound";
  }
  if (normalizedMessage.includes("dynamic link library") && normalizedMessage.includes("initialization")) {
    return "nativeModuleInitializationFailed";
  }
  if (normalizedMessage.includes("permission denied") || /\b(?:eacces|eperm)\b/.test(normalizedMessage)) {
    return "permissionDenied";
  }
  if (normalizedMessage.includes("cannot find module")) {
    return "nativeModuleNotFound";
  }
  if (message === "Timeout waiting for CLI server to start") {
    return "timeout";
  }
  if (message.startsWith("Failed to start CLI server:")) {
    return "spawnFailed";
  }
  return message.startsWith("CLI server exited unexpectedly with code ") ? "processExitedUnexpectedly" : "processExited";
}
function getCopilotStartupFailureResource(message) {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("cli-native")) {
    return "cliNative";
  }
  if (normalizedMessage.includes("conpty")) {
    return "conpty";
  }
  if (normalizedMessage.includes("runtime.node") || normalizedMessage.includes("runtime.win32") || normalizedMessage.includes('native addon "runtime"')) {
    return "runtime";
  }
  if (normalizedMessage.includes("sandbox") || normalizedMessage.includes("lxc-exec") || normalizedMessage.includes("mxc-exec-mac") || normalizedMessage.includes("wxc-exec.exe")) {
    return "sandbox";
  }
  return "other";
}
function getCopilotStartupFailureDetails(error) {
  if (!(error instanceof Error) || classifyCopilotClientFailure(error) !== "startupFailed") {
    return {};
  }
  const message = error.message;
  const exitCodeMatch = /^CLI server exited(?: unexpectedly)? with code (?<exitCode>\d+)/.exec(message);
  const parsedExitCode = exitCodeMatch?.groups?.exitCode === void 0 ? void 0 : Number(exitCodeMatch.groups.exitCode);
  return {
    startupFailureCause: getCopilotStartupFailureCause(message),
    startupFailureResource: getCopilotStartupFailureResource(message),
    startupExitCode: parsedExitCode !== void 0 && Number.isSafeInteger(parsedExitCode) ? parsedExitCode : void 0
  };
}
function reportCopilotClientFailure(telemetryService, clientFailureId, failureKind, operation, activeTurnCount, recoveryStarted, error, correlation) {
  const packed = packErrorForTelemetry(error);
  telemetryService.publicLogError2("agentHost.copilotClientFailure", {
    clientFailureId,
    failureKind,
    operation,
    ...getCopilotStartupFailureDetails(error),
    ...correlation,
    activeTurnCount,
    recoveryStarted,
    errorName: error instanceof Error ? error.name : void 0,
    errorCode: getErrorCode(error),
    msg: packed.msg,
    callstack: packed.callstack
  });
}
function reportCopilotClientRecovery(telemetryService, event) {
  telemetryService.publicLog2("agentHost.copilotClientRecovery", event);
}
function reportCopilotClientRecoveryTurn(telemetryService, clientFailureId, correlation) {
  telemetryService.publicLogError2("agentHost.copilotClientRecoveryTurnFailed", {
    clientFailureId,
    ...correlation
  });
}
function reportCopilotSdkSessionError(telemetryService, event, correlation) {
  telemetryService.publicLogError2("agentHost.copilotSdkSessionError", {
    ...correlation,
    sdkEventId: event.id,
    sdkParentEventId: event.parentId ?? void 0,
    sdkAgentId: event.agentId,
    errorType: event.data.errorType,
    errorCode: event.data.errorCode,
    statusCode: event.data.statusCode,
    providerCallId: event.data.providerCallId,
    serviceRequestId: event.data.serviceRequestId,
    eligibleForAutoSwitch: event.data.eligibleForAutoSwitch,
    msg: event.data.message,
    callstack: event.data.stack
  });
}
function reportCopilotModelCallFailure(telemetryService, event, correlation) {
  const fingerprint = event.data.requestFingerprint;
  telemetryService.publicLogError2("agentHost.copilotModelCallFailure", {
    ...correlation,
    sdkEventId: event.id,
    sdkParentEventId: event.parentId ?? void 0,
    sdkAgentId: event.agentId,
    failureKind: event.data.failureKind,
    source: event.data.source,
    transport: event.data.transport,
    apiEndpoint: event.data.apiEndpoint ? new TelemetryTrustedValue(event.data.apiEndpoint) : void 0,
    statusCode: event.data.statusCode,
    durationMs: event.data.durationMs,
    model: event.data.isByok ? "byokModel" : event.data.model,
    reasoningEffort: event.data.reasoningEffort,
    isAuto: event.data.isAuto,
    isByok: event.data.isByok,
    rte: event.data.rte,
    badRequestKind: event.data.badRequestKind,
    apiCallId: event.data.apiCallId,
    providerCallId: event.data.providerCallId,
    serviceRequestId: event.data.serviceRequestId,
    messageCount: fingerprint?.messageCount,
    toolCallCount: fingerprint?.toolCallCount,
    toolResultMessageCount: fingerprint?.toolResultMessageCount,
    namelessToolCallCount: fingerprint?.namelessToolCallCount,
    imagePartCount: fingerprint?.imagePartCount,
    imagePartsMissingMediaType: fingerprint?.imagePartsMissingMediaType
  });
}
export {
  classifyCopilotClientFailure,
  createCopilotFailureCorrelation,
  reportCopilotClientFailure,
  reportCopilotClientRecovery,
  reportCopilotClientRecoveryTurn,
  reportCopilotModelCallFailure,
  reportCopilotSdkSessionError
};
