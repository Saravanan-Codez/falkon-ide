import { generateUuid } from "../../../../base/common/uuid.js";
import { ChatInputResponseKind } from "../../common/state/sessionState.js";
import { buildElicitationRequest, cancelledElicitationResult, elicitationResultFromAnswers } from "./claudeElicitation.js";
async function handleElicitation(deps, sessionId, request, options) {
  const session = deps.getSession(sessionId);
  if (!session) {
    return cancelledElicitationResult();
  }
  const requestId = generateUuid();
  if (options.signal.aborted) {
    return cancelledElicitationResult();
  }
  const chatRequest = buildElicitationRequest(requestId, request);
  if (!chatRequest.url && !chatRequest.questions?.length) {
    return cancelledElicitationResult();
  }
  const abortHandler = () => {
    session.respondToUserInputRequest(requestId, ChatInputResponseKind.Cancel);
  };
  options.signal.addEventListener("abort", abortHandler);
  try {
    const { response, answers } = await session.requestUserInput(chatRequest);
    return elicitationResultFromAnswers(request, response, answers);
  } finally {
    options.signal.removeEventListener("abort", abortHandler);
  }
}
export {
  handleElicitation
};
