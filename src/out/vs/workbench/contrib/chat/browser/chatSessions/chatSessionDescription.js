import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { localize } from "../../../../../nls.js";
import { IChatToolInvocation } from "../../common/chatService/chatService.js";
function getInProgressSessionDescription(chatModel) {
  const requests = chatModel.getRequests();
  if (requests.length === 0) {
    return void 0;
  }
  const lastRequest = requests.at(-1);
  const response = lastRequest?.response;
  if (!response) {
    return void 0;
  }
  if (response.isComplete) {
    return void 0;
  }
  const responseParts = response.response.value;
  let description = "";
  for (let i = responseParts.length - 1; i >= 0; i--) {
    const part = responseParts[i];
    if (description) {
      break;
    }
    if (part.kind === "confirmation" && typeof part.message === "string") {
      description = part.message;
    } else if (part.kind === "toolInvocation") {
      const toolInvocation = part;
      if (IChatToolInvocation.isEffectivelyHidden(toolInvocation)) {
        continue;
      }
      const state = toolInvocation.state.get();
      description = toolInvocation.generatedTitle || toolInvocation.pastTenseMessage || toolInvocation.invocationMessage;
      if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation) {
        const confirmationTitle = state.confirmationMessages?.title;
        const titleMessage = confirmationTitle && (typeof confirmationTitle === "string" ? confirmationTitle : confirmationTitle.value);
        const descriptionValue = typeof description === "string" ? description : description.value;
        description = titleMessage ?? localize("chat.sessions.description.waitingForConfirmation", "Waiting for confirmation: {0}", descriptionValue);
      }
    } else if (part.kind === "toolInvocationSerialized") {
      if (IChatToolInvocation.isEffectivelyHidden(part)) {
        continue;
      }
      description = part.invocationMessage;
    } else if (part.kind === "progressMessage") {
      description = part.content;
    } else if (part.kind === "thinking") {
      description = localize("chat.sessions.description.thinking", "Thinking...");
    }
  }
  return description ? renderAsPlaintext(description, { useLinkFormatter: true }) : "";
}
export {
  getInProgressSessionDescription
};
