import { RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
const CHAT_AUTOMATIONS_ENABLED_SETTING = "chat.automations.enabled";
const CHAT_AUTOMATIONS_RUN_TIMEOUT_MINUTES_SETTING = "chat.automations.runTimeoutMinutes";
const DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES = 30;
const ChatAutomationsEnabledContext = new RawContextKey("chatAutomationsEnabled", false, {
  type: "boolean",
  description: "True when the chat Automations feature is enabled via the chat.automations.enabled setting."
});
export {
  CHAT_AUTOMATIONS_ENABLED_SETTING,
  CHAT_AUTOMATIONS_RUN_TIMEOUT_MINUTES_SETTING,
  ChatAutomationsEnabledContext,
  DEFAULT_AUTOMATIONS_RUN_TIMEOUT_MINUTES
};
