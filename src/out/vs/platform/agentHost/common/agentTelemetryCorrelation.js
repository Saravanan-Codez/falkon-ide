import { hash } from "../../../base/common/hash.js";
import { DEFAULT_CHAT_ID, parseChatUri } from "./state/sessionState.js";
function getTelemetryChatSessionId(chat) {
  return String(hash(parseChatUri(chat)?.chatId ?? DEFAULT_CHAT_ID));
}
export {
  getTelemetryChatSessionId
};
