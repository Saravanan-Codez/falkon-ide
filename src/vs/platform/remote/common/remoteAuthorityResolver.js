import { ErrorNoTelemetry } from "../../../base/common/errors.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IRemoteAuthorityResolverService = createDecorator("remoteAuthorityResolverService");
var RemoteConnectionType = /* @__PURE__ */ ((RemoteConnectionType2) => {
  RemoteConnectionType2[RemoteConnectionType2["WebSocket"] = 0] = "WebSocket";
  RemoteConnectionType2[RemoteConnectionType2["Managed"] = 1] = "Managed";
  return RemoteConnectionType2;
})(RemoteConnectionType || {});
class ManagedRemoteConnection {
  constructor(id) {
    this.id = id;
    this.type = 1 /* Managed */;
  }
  toString() {
    return `Managed(${this.id})`;
  }
}
class WebSocketRemoteConnection {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.type = 0 /* WebSocket */;
  }
  toString() {
    return `WebSocket(${this.host}:${this.port})`;
  }
}
var RemoteAuthorityResolverErrorCode = /* @__PURE__ */ ((RemoteAuthorityResolverErrorCode2) => {
  RemoteAuthorityResolverErrorCode2["Unknown"] = "Unknown";
  RemoteAuthorityResolverErrorCode2["NotAvailable"] = "NotAvailable";
  RemoteAuthorityResolverErrorCode2["TemporarilyNotAvailable"] = "TemporarilyNotAvailable";
  RemoteAuthorityResolverErrorCode2["NoResolverFound"] = "NoResolverFound";
  RemoteAuthorityResolverErrorCode2["InvalidAuthority"] = "InvalidAuthority";
  return RemoteAuthorityResolverErrorCode2;
})(RemoteAuthorityResolverErrorCode || {});
class RemoteAuthorityResolverError extends ErrorNoTelemetry {
  static isNotAvailable(err) {
    return err instanceof RemoteAuthorityResolverError && err._code === "NotAvailable" /* NotAvailable */;
  }
  static isTemporarilyNotAvailable(err) {
    return err instanceof RemoteAuthorityResolverError && err._code === "TemporarilyNotAvailable" /* TemporarilyNotAvailable */;
  }
  static isNoResolverFound(err) {
    return err instanceof RemoteAuthorityResolverError && err._code === "NoResolverFound" /* NoResolverFound */;
  }
  static isInvalidAuthority(err) {
    return err instanceof RemoteAuthorityResolverError && err._code === "InvalidAuthority" /* InvalidAuthority */;
  }
  static isHandled(err) {
    return err instanceof RemoteAuthorityResolverError && err.isHandled;
  }
  constructor(message, code = "Unknown" /* Unknown */, detail) {
    super(message);
    this._message = message;
    this._code = code;
    this._detail = detail;
    this.isHandled = code === "NotAvailable" /* NotAvailable */ && detail === true;
    Object.setPrototypeOf(this, RemoteAuthorityResolverError.prototype);
  }
}
function getRemoteAuthorityPrefix(remoteAuthority) {
  const plusIndex = remoteAuthority.indexOf("+");
  if (plusIndex === -1) {
    return remoteAuthority;
  }
  return remoteAuthority.substring(0, plusIndex);
}
export {
  IRemoteAuthorityResolverService,
  ManagedRemoteConnection,
  RemoteAuthorityResolverError,
  RemoteAuthorityResolverErrorCode,
  RemoteConnectionType,
  WebSocketRemoteConnection,
  getRemoteAuthorityPrefix
};
