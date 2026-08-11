import { mark, clearMarks } from "../../../../base/common/performance.js";
import { chatSessionResourceToId } from "./model/chatUri.js";
const chatPerfPrefix = "code/chat/";
const chatMarksBySession = /* @__PURE__ */ new Map();
const ChatPerfMark = {
  /** User pressed Enter / request initiated */
  RequestStart: "request/start",
  /** Request added to model → UI shows the message */
  RequestUiUpdated: "request/uiUpdated",
  /** Begin collecting .instructions.md / skills / hooks */
  WillCollectInstructions: "request/willCollectInstructions",
  /** Done collecting instructions */
  DidCollectInstructions: "request/didCollectInstructions",
  /** First streamed response content received */
  FirstToken: "request/firstToken",
  /** Response fully complete */
  RequestComplete: "request/complete",
  /** Agent invoke begins (LLM round-trip start) */
  AgentWillInvoke: "agent/willInvoke",
  /** Agent invoke returns (LLM round-trip end) */
  AgentDidInvoke: "agent/didInvoke"
};
function markChat(sessionResource, name) {
  const sessionId = chatSessionResourceToId(sessionResource);
  const fullName = `${chatPerfPrefix}${sessionId}/${name}`;
  let names = chatMarksBySession.get(sessionId);
  if (!names) {
    names = /* @__PURE__ */ new Set();
    chatMarksBySession.set(sessionId, names);
  }
  names.add(fullName);
  mark(fullName);
}
function clearChatMarks(sessionResource) {
  const sessionId = chatSessionResourceToId(sessionResource);
  const names = chatMarksBySession.get(sessionId);
  if (names) {
    for (const name of names) {
      clearMarks(name);
    }
    chatMarksBySession.delete(sessionId);
  }
}
const ChatGlobalPerfMark = {
  /** Begin waiting for chat extension activation (SetupAgent) */
  WillWaitForActivation: "willWaitForActivation",
  /** Extension activation + readiness complete (SetupAgent) */
  DidWaitForActivation: "didWaitForActivation"
};
function markChatGlobal(name) {
  mark(`${chatPerfPrefix}${name}`);
}
export {
  ChatGlobalPerfMark,
  ChatPerfMark,
  clearChatMarks,
  markChat,
  markChatGlobal
};
