import { unwrapShellInvocation } from "./codexShellCommand.js";
function guardianStatusToEvent(status) {
  switch (status) {
    case "inProgress":
      return "in_progress";
    case "timedOut":
      return "timed_out";
    // `approved`, `denied`, `aborted` are identical in both casings.
    default:
      return status;
  }
}
function commandSourceToEvent(source) {
  return source === "unifiedExec" ? "unified_exec" : source;
}
function networkProtocolToEvent(protocol) {
  switch (protocol) {
    case "socks5Tcp":
      return "socks5_tcp";
    case "socks5Udp":
      return "socks5_udp";
    // `http`, `https` are identical in both casings.
    default:
      return protocol;
  }
}
function requestPermissionProfileToEvent(profile) {
  const fs = profile.fileSystem;
  let fileSystem = null;
  if (fs) {
    const mapped = { read: fs.read, write: fs.write };
    if (fs.globScanMaxDepth !== void 0) {
      mapped.glob_scan_max_depth = fs.globScanMaxDepth;
    }
    if (fs.entries !== void 0) {
      mapped.entries = fs.entries;
    }
    fileSystem = mapped;
  }
  return { network: profile.network, file_system: fileSystem };
}
function guardianReviewActionToEventAction(action) {
  switch (action.type) {
    case "command":
      return { type: "command", source: commandSourceToEvent(action.source), command: action.command, cwd: action.cwd };
    case "execve":
      return { type: "execve", source: commandSourceToEvent(action.source), program: action.program, argv: action.argv, cwd: action.cwd };
    case "applyPatch":
      return { type: "apply_patch", cwd: action.cwd, files: action.files };
    case "networkAccess":
      return { type: "network_access", target: action.target, host: action.host, protocol: networkProtocolToEvent(action.protocol), port: action.port };
    case "mcpToolCall":
      return { type: "mcp_tool_call", server: action.server, tool_name: action.toolName, connector_id: action.connectorId, connector_name: action.connectorName, tool_title: action.toolTitle };
    case "requestPermissions":
      return { type: "request_permissions", reason: action.reason, permissions: requestPermissionProfileToEvent(action.permissions) };
  }
}
function toGuardianAssessmentEventJson(notification) {
  const event = {
    id: notification.reviewId,
    turn_id: notification.turnId,
    started_at_ms: notification.startedAtMs,
    status: guardianStatusToEvent(notification.review.status),
    action: guardianReviewActionToEventAction(notification.action)
  };
  if (notification.targetItemId !== null) {
    event.target_item_id = notification.targetItemId;
  }
  if (notification.completedAtMs !== null && notification.completedAtMs !== void 0) {
    event.completed_at_ms = notification.completedAtMs;
  }
  if (notification.review.riskLevel !== null) {
    event.risk_level = notification.review.riskLevel;
  }
  if (notification.review.userAuthorization !== null) {
    event.user_authorization = notification.review.userAuthorization;
  }
  if (notification.review.rationale !== null) {
    event.rationale = notification.review.rationale;
  }
  if (notification.decisionSource !== null && notification.decisionSource !== void 0) {
    event.decision_source = notification.decisionSource;
  }
  return event;
}
function summarizeGuardianReviewAction(action) {
  switch (action.type) {
    case "command":
      return { title: "Run command", detail: unwrapShellInvocation(action.command), toolKind: "terminal" };
    case "execve":
      return { title: "Run program", detail: unwrapShellInvocation([action.program, ...action.argv].join(" ")), toolKind: "terminal" };
    case "applyPatch":
      return { title: "Apply file changes", detail: action.files.join(", ") };
    case "networkAccess":
      return { title: "Network access", detail: action.target || `${action.protocol}://${action.host}:${action.port}`, toolKind: "search" };
    case "mcpToolCall":
      return { title: "MCP tool call", detail: `${action.server}/${action.toolName}` };
    case "requestPermissions":
      return { title: "Elevated permissions", detail: action.reason ?? "Requested additional permissions" };
  }
}
function inlineCode(text) {
  const longestRun = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(longestRun + 1);
  const padding = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${padding}${text}${padding}${fence}`;
}
function formatGuardianDenialNotification(summary, rationale) {
  const detail = summary.detail?.trim();
  const header = "**Auto-review denied**";
  const lines = [
    detail ? `\u26A0\uFE0F ${header} \u2014 ${summary.title}: ${inlineCode(detail)}` : `\u26A0\uFE0F ${header} \u2014 ${summary.title}`
  ];
  const reason = rationale?.trim();
  if (reason) {
    lines.push("", ...reason.split("\n"));
  }
  const quoted = lines.map((line) => line ? `> ${line}` : ">").join("\n");
  return `

${quoted}
`;
}
export {
  formatGuardianDenialNotification,
  guardianReviewActionToEventAction,
  summarizeGuardianReviewAction,
  toGuardianAssessmentEventJson
};
