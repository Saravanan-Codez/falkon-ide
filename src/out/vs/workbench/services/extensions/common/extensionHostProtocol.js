import { VSBuffer } from "../../../../base/common/buffer.js";
var UIKind = /* @__PURE__ */ ((UIKind2) => {
  UIKind2[UIKind2["Desktop"] = 1] = "Desktop";
  UIKind2[UIKind2["Web"] = 2] = "Web";
  return UIKind2;
})(UIKind || {});
var ExtensionHostExitCode = /* @__PURE__ */ ((ExtensionHostExitCode2) => {
  ExtensionHostExitCode2[ExtensionHostExitCode2["VersionMismatch"] = 55] = "VersionMismatch";
  ExtensionHostExitCode2[ExtensionHostExitCode2["UnexpectedError"] = 81] = "UnexpectedError";
  return ExtensionHostExitCode2;
})(ExtensionHostExitCode || {});
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2[MessageType2["Initialized"] = 0] = "Initialized";
  MessageType2[MessageType2["Ready"] = 1] = "Ready";
  MessageType2[MessageType2["Terminate"] = 2] = "Terminate";
  return MessageType2;
})(MessageType || {});
function createMessageOfType(type) {
  const result = VSBuffer.alloc(1);
  switch (type) {
    case 0 /* Initialized */:
      result.writeUInt8(1, 0);
      break;
    case 1 /* Ready */:
      result.writeUInt8(2, 0);
      break;
    case 2 /* Terminate */:
      result.writeUInt8(3, 0);
      break;
  }
  return result;
}
function isMessageOfType(message, type) {
  if (message.byteLength !== 1) {
    return false;
  }
  switch (message.readUInt8(0)) {
    case 1:
      return type === 0 /* Initialized */;
    case 2:
      return type === 1 /* Ready */;
    case 3:
      return type === 2 /* Terminate */;
    default:
      return false;
  }
}
var NativeLogMarkers = /* @__PURE__ */ ((NativeLogMarkers2) => {
  NativeLogMarkers2["Start"] = "START_NATIVE_LOG";
  NativeLogMarkers2["End"] = "END_NATIVE_LOG";
  return NativeLogMarkers2;
})(NativeLogMarkers || {});
export {
  ExtensionHostExitCode,
  MessageType,
  NativeLogMarkers,
  UIKind,
  createMessageOfType,
  isMessageOfType
};
