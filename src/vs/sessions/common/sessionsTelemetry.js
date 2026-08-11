import { isCancellationError } from "../../base/common/errors.js";
import { RemoteAgentHostConnectionStatus } from "../../platform/agentHost/common/remoteAgentHostService.js";
import { isSSHHostKeyDeniedError } from "../../platform/agentHost/common/sshRemoteAgentHost.js";
import { PROTOCOL_VERSION } from "../../platform/agentHost/common/state/protocol/version/registry.js";
function logSessionsInteraction(telemetryService, button, source) {
  telemetryService.publicLog2("vscodeAgents.interaction", source ? { button, source } : { button });
}
function logSidePanelToggle(telemetryService, visible) {
  telemetryService.publicLog2("vscodeAgents.layout/toggleSidePanel", { visible });
}
function logChangesViewVersionModeChange(telemetryService, mode) {
  telemetryService.publicLog2("vscodeAgents.changesView/versionModeChange", { mode });
}
function logChangesViewFileSelect(telemetryService, changeType) {
  telemetryService.publicLog2("vscodeAgents.changesView/fileSelect", { changeType });
}
function logChangesViewViewModeChange(telemetryService, mode) {
  telemetryService.publicLog2("vscodeAgents.changesView/viewModeChange", { mode });
}
function logTunnelDiscoveryResult(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.tunnelDiscovery/result", {
    trigger: data.trigger,
    totalFound: data.totalFound,
    withActiveHost: data.withActiveHost,
    cachedBefore: data.cachedBefore,
    autoConnectEnabled: data.autoConnectEnabled,
    hostsEnabled: data.hostsEnabled,
    success: data.success
  });
}
function logTunnelConnectAttempt(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.tunnelConnect/attempt", {
    isReconnect: data.isReconnect,
    attempt: data.attempt,
    durationMs: data.durationMs,
    success: data.success,
    errorCategory: data.errorCategory ?? ""
  });
}
function logTunnelConnectResolved(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.tunnelConnect/resolved", {
    isReconnect: data.isReconnect,
    totalAttempts: data.totalAttempts,
    totalDurationMs: data.totalDurationMs,
    success: data.success,
    failureReason: data.failureReason ?? ""
  });
}
function categorizeSSHConnectError(err) {
  if (isCancellationError(err)) {
    return "cancelled";
  }
  if (isSSHHostKeyDeniedError(err)) {
    return "hostKeyDenied";
  }
  if (RemoteAgentHostConnectionStatus.fromConnectError(err, [PROTOCOL_VERSION])) {
    return "incompatible";
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/authenticat|permission denied|no supported authentication methods|all configured authentication methods failed/i.test(message)) {
    return "authentication";
  }
  if (/ECONN|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|ETIMEDOUT|network|handshake.*timed out|closed before the handshake completed/i.test(message)) {
    return "network";
  }
  return "other";
}
function logSSHConnectAttempt(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.sshConnect/attempt", {
    ...data,
    errorCategory: data.errorCategory ?? ""
  });
}
function logSocketClose(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.socket/close", data);
}
function logSendDropped(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.socket/sendDropped", data);
}
function logVisibilityResumed(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.socket/visibilityResumed", data);
}
function logTerminalRecovery(telemetryService, data) {
  telemetryService.publicLog2("vscodeAgents.terminal/recovery", data);
}
export {
  categorizeSSHConnectError,
  logChangesViewFileSelect,
  logChangesViewVersionModeChange,
  logChangesViewViewModeChange,
  logSSHConnectAttempt,
  logSendDropped,
  logSessionsInteraction,
  logSidePanelToggle,
  logSocketClose,
  logTerminalRecovery,
  logTunnelConnectAttempt,
  logTunnelConnectResolved,
  logTunnelDiscoveryResult,
  logVisibilityResumed
};
