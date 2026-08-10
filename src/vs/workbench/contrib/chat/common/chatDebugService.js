import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var ChatDebugLogLevel = /* @__PURE__ */ ((ChatDebugLogLevel2) => {
  ChatDebugLogLevel2[ChatDebugLogLevel2["Trace"] = 0] = "Trace";
  ChatDebugLogLevel2[ChatDebugLogLevel2["Info"] = 1] = "Info";
  ChatDebugLogLevel2[ChatDebugLogLevel2["Warning"] = 2] = "Warning";
  ChatDebugLogLevel2[ChatDebugLogLevel2["Error"] = 3] = "Error";
  return ChatDebugLogLevel2;
})(ChatDebugLogLevel || {});
var ChatDebugHookResult = /* @__PURE__ */ ((ChatDebugHookResult2) => {
  ChatDebugHookResult2[ChatDebugHookResult2["Success"] = 0] = "Success";
  ChatDebugHookResult2[ChatDebugHookResult2["Error"] = 1] = "Error";
  ChatDebugHookResult2[ChatDebugHookResult2["NonBlockingError"] = 2] = "NonBlockingError";
  return ChatDebugHookResult2;
})(ChatDebugHookResult || {});
const IChatDebugService = createDecorator("chatDebugService");
export {
  ChatDebugHookResult,
  ChatDebugLogLevel,
  IChatDebugService
};
