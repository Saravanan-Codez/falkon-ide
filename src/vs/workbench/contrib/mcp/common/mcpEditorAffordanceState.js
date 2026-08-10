import { isEqual } from "../../../../base/common/resources.js";
import { McpServerStatus } from "../../../../platform/agentHost/common/state/protocol/state.js";
import { isAgentHostTarget } from "../../chat/common/chatSessionsService.js";
import { getChatSessionType } from "../../chat/common/model/chatUri.js";
function getActiveAgentHostMcpSessionResource(sessionResource) {
  return sessionResource && isAgentHostTarget(getChatSessionType(sessionResource)) ? sessionResource : void 0;
}
function countRunningMcpServersInOtherSessions(currentSession, sessions) {
  const counts = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    if (isEqual(session.resource, currentSession)) {
      continue;
    }
    const running = /* @__PURE__ */ new Set();
    for (const server of session.servers) {
      if (server.enabled && server.status === McpServerStatus.Ready) {
        running.add(server.name);
      }
    }
    for (const name of running) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}
export {
  countRunningMcpServersInOtherSessions,
  getActiveAgentHostMcpSessionResource
};
