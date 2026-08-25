import { softAssertNever } from "../../../../base/common/assert.js";
import { localize } from "../../../../nls.js";
function buildCopilotSystemNotification(event) {
  const data = event.data;
  const kind = data.kind;
  const content = cleanSystemNotificationContent(data.content);
  if (!content) {
    return void 0;
  }
  switch (kind.type) {
    case "shell_completed":
    case "shell_detached_completed": {
      const description = kind.description;
      return {
        messageText: description ? localize("agentHost.copilot.systemNotification.shellDescriptionCompleted", "`{0}` completed", description) : localize("agentHost.copilot.systemNotification.shellCompleted", "Shell completed"),
        startsTurn: true
      };
    }
    case "agent_completed":
      return {
        messageText: kind.status === "failed" ? localize("agentHost.copilot.systemNotification.agentFailed", "Background agent {0} failed", kind.agentId) : localize("agentHost.copilot.systemNotification.agentCompleted", "Background agent {0} completed", kind.agentId),
        startsTurn: true
      };
    case "agent_idle":
      return {
        messageText: localize("agentHost.copilot.systemNotification.agentIdle", "Background agent {0} is complete", kind.agentId),
        startsTurn: true
      };
    case "factory_completed":
      return {
        messageText: kind.status === "error" ? localize("agentHost.copilot.systemNotification.factoryFailed", "Factory {0} failed", kind.factoryName) : kind.status === "halted" ? localize("agentHost.copilot.systemNotification.factoryHalted", "Factory {0} was halted", kind.factoryName) : kind.status === "cancelled" ? localize("agentHost.copilot.systemNotification.factoryCancelled", "Factory {0} was cancelled", kind.factoryName) : localize("agentHost.copilot.systemNotification.factoryCompleted", "Factory {0} completed", kind.factoryName),
        startsTurn: true
      };
    case "new_inbox_message":
      return {
        messageText: localize("agentHost.copilot.systemNotification.newInboxMessage", "New inbox message from {0}", kind.senderName),
        startsTurn: false
      };
    case "instruction_discovered":
      return {
        messageText: localize("agentHost.copilot.systemNotification.instructionDiscovered", "Instruction discovered: {0}", kind.description ?? kind.sourcePath),
        startsTurn: false
      };
    case "unclassified":
      return {
        messageText: content,
        startsTurn: true
      };
    default:
      softAssertNever(kind);
      return void 0;
  }
}
function cleanSystemNotificationContent(content) {
  const trimmed = content.trim();
  const match = /^<system_notification>\s*([\s\S]*?)\s*<\/system_notification>$/.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}
export {
  buildCopilotSystemNotification
};
