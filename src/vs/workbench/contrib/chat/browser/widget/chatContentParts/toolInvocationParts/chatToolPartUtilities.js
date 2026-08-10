import { createMarkdownCommandLink, MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../../../nls.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
function isMcpToolInvocation(toolInvocation) {
  return toolInvocation.source?.type === "mcp" || toolInvocation.toolId.toLowerCase().includes("mcp");
}
function isAskQuestionsToolInvocation(toolInvocation) {
  return toolInvocation.toolId === "copilot_askQuestions" || toolInvocation.toolId === "vscode_askQuestions" || toolInvocation.toolId === "ask_user" || toolInvocation.toolId === "AskUserQuestion" || toolInvocation.toolId === "request_user_input";
}
function shouldShimmerForTool(toolInvocation, content) {
  if (!isAskQuestionsToolInvocation(toolInvocation) || IChatToolInvocation.isComplete(toolInvocation)) {
    return false;
  }
  return getMarkdownValue(content) === getMarkdownValue(toolInvocation.invocationMessage);
}
function getMarkdownValue(content) {
  return (typeof content === "string" ? content : content?.value)?.replaceAll("&nbsp;", " ").replace(/\\[\\`*_{}\[\]()#+\-!~]/g, (escaped) => escaped.slice(1));
}
function getToolApprovalMessage(toolInvocation) {
  const reason = IChatToolInvocation.executionConfirmedOrDenied(toolInvocation);
  if (!reason || typeof reason === "boolean") {
    return void 0;
  }
  return getApprovalMessageFromReason(reason);
}
function getApprovalMessageFromReason(reason) {
  let md;
  switch (reason.type) {
    case ToolConfirmKind.Setting:
      md = localize("chat.autoapprove.setting", "Auto approved by {0}", createMarkdownCommandLink({ text: "`" + reason.id + "`", id: "workbench.action.openSettings", arguments: [reason.id], tooltip: localize("openSettings.tooltip", "Open settings") }, false));
      break;
    case ToolConfirmKind.LmServicePerTool:
      md = reason.scope === "session" ? localize("chat.autoapprove.lmServicePerTool.session", "Auto approved for this session") : reason.scope === "workspace" ? localize("chat.autoapprove.lmServicePerTool.workspace", "Auto approved for this workspace") : localize("chat.autoapprove.lmServicePerTool.profile", "Auto approved for this profile");
      md += " (" + createMarkdownCommandLink({ text: localize("edit", "Edit"), id: "workbench.action.chat.editToolApproval", arguments: [reason.scope], tooltip: localize("editToolApproval.tooltip", "Edit tool approval settings") }) + ")";
      break;
    case ToolConfirmKind.ConfirmationNotNeeded:
      if (reason.reason) {
        return typeof reason.reason === "string" ? new MarkdownString(reason.reason, { isTrusted: true }) : reason.reason;
      }
      return void 0;
    case ToolConfirmKind.UserAction:
    case ToolConfirmKind.Denied:
    default:
      return void 0;
  }
  return new MarkdownString(md, { isTrusted: true });
}
export {
  getApprovalMessageFromReason,
  getToolApprovalMessage,
  isAskQuestionsToolInvocation,
  isMcpToolInvocation,
  shouldShimmerForTool
};
