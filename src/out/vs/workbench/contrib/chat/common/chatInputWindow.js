import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const CHAT_INPUT_WINDOW_TOGGLE_COMMAND_ID = "workbench.action.chat.toggleInputWindow";
const CHAT_INPUT_WINDOW_ACCEPT_VOICE_COMMAND_ID = "_chat.omni.acceptVoiceInput";
const CHAT_INPUT_WINDOW_SET_VOICE_TARGET_COMMAND_ID = "_chat.voice.setOmniTarget";
const CHAT_INPUT_WINDOW_DEFAULT_HEIGHT = 110;
var ChatInputWindowStorageKeys = /* @__PURE__ */ ((ChatInputWindowStorageKeys2) => {
  ChatInputWindowStorageKeys2["WindowOpen"] = "chatInputWindow.windowOpen";
  ChatInputWindowStorageKeys2["WindowPosition"] = "chatInputWindow.windowPosition";
  return ChatInputWindowStorageKeys2;
})(ChatInputWindowStorageKeys || {});
const IChatInputWindowService = createDecorator("chatInputWindowService");
export {
  CHAT_INPUT_WINDOW_ACCEPT_VOICE_COMMAND_ID,
  CHAT_INPUT_WINDOW_DEFAULT_HEIGHT,
  CHAT_INPUT_WINDOW_SET_VOICE_TARGET_COMMAND_ID,
  CHAT_INPUT_WINDOW_TOGGLE_COMMAND_ID,
  ChatInputWindowStorageKeys,
  IChatInputWindowService
};
