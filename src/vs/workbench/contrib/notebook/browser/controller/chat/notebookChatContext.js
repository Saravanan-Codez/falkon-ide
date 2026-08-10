import { localize } from "../../../../../../nls.js";
import { RawContextKey } from "../../../../../../platform/contextkey/common/contextkey.js";
const CTX_NOTEBOOK_CHAT_HAS_AGENT = new RawContextKey("notebookChatAgentRegistered", false, localize("notebookChatAgentRegistered", "Whether a chat agent for notebook is registered"));
export {
  CTX_NOTEBOOK_CHAT_HAS_AGENT
};
