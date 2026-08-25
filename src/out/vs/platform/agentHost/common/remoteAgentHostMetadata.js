import { PROTOCOL_VERSION } from "./state/protocol/version/registry.js";
const remoteAgentHostStateSchemaVersion = 1;
function createRemoteAgentHostState(options) {
  return {
    schemaVersion: remoteAgentHostStateSchemaVersion,
    pid: options.pid,
    port: options.port,
    host: options.host,
    connectionToken: options.connectionToken ?? null,
    protocolVersion: PROTOCOL_VERSION,
    quality: options.quality,
    tunnelName: options.tunnelName
  };
}
function parseRemoteAgentHostState(raw) {
  if (typeof raw !== "object" || raw === null) {
    return void 0;
  }
  const obj = raw;
  if (obj.schemaVersion !== remoteAgentHostStateSchemaVersion) {
    return void 0;
  }
  if (typeof obj.pid !== "number" || !Number.isSafeInteger(obj.pid) || obj.pid <= 0) {
    return void 0;
  }
  if (typeof obj.port !== "number" || !Number.isSafeInteger(obj.port) || obj.port <= 0 || obj.port > 65535) {
    return void 0;
  }
  if (obj.host !== void 0 && typeof obj.host !== "string") {
    return void 0;
  }
  if (obj.connectionToken !== void 0 && obj.connectionToken !== null && typeof obj.connectionToken !== "string") {
    return void 0;
  }
  if (typeof obj.protocolVersion !== "string") {
    return void 0;
  }
  if (obj.quality !== void 0 && typeof obj.quality !== "string") {
    return void 0;
  }
  if (obj.tunnelName !== void 0 && typeof obj.tunnelName !== "string") {
    return void 0;
  }
  return {
    schemaVersion: remoteAgentHostStateSchemaVersion,
    pid: obj.pid,
    port: obj.port,
    host: obj.host,
    connectionToken: obj.connectionToken ?? null,
    protocolVersion: obj.protocolVersion,
    quality: obj.quality,
    tunnelName: obj.tunnelName
  };
}
export {
  createRemoteAgentHostState,
  parseRemoteAgentHostState,
  remoteAgentHostStateSchemaVersion
};
