import { ContentEncoding, ReconnectResultType, ResourceType, ResourceWriteMode } from "./protocol/commands.js";
import { ResourceChangeType } from "./protocol/channels-resource-watch/state.js";
import { AhpErrorCodes, JsonRpcErrorCodes } from "./protocol/errors.js";
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INTERNAL_ERROR = -32603;
const AHP_SESSION_NOT_FOUND = -32001;
const AHP_PROVIDER_NOT_FOUND = -32002;
const AHP_SESSION_ALREADY_EXISTS = -32003;
const AHP_TURN_IN_PROGRESS = -32004;
const AHP_UNSUPPORTED_PROTOCOL_VERSION = -32005;
const AHP_CONTENT_NOT_FOUND = -32006;
const AHP_AUTH_REQUIRED = -32007;
function isJsonRpcRequest(msg) {
  return "method" in msg && "id" in msg;
}
function isJsonRpcNotification(msg) {
  return "method" in msg && !("id" in msg);
}
function isJsonRpcResponse(msg) {
  return "id" in msg && !("method" in msg);
}
class ProtocolError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
export {
  AHP_AUTH_REQUIRED,
  AHP_CONTENT_NOT_FOUND,
  AHP_PROVIDER_NOT_FOUND,
  AHP_SESSION_ALREADY_EXISTS,
  AHP_SESSION_NOT_FOUND,
  AHP_TURN_IN_PROGRESS,
  AHP_UNSUPPORTED_PROTOCOL_VERSION,
  AhpErrorCodes,
  ContentEncoding,
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_PARSE_ERROR,
  JsonRpcErrorCodes,
  ProtocolError,
  ReconnectResultType,
  ResourceChangeType,
  ResourceType,
  ResourceWriteMode,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse
};
