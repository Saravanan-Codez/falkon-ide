import { vEnum, vLiteral, vNumber, vObj, vOptionalProp, vString, vUnion } from "../../../base/common/validation.js";
const AGENT_HOST_ENDPOINT_REGISTRY_SCHEMA_VERSION = 2;
const endpointAddressValidator = vUnion(
  vObj({ type: vLiteral("socket"), path: vString() }),
  vObj({ type: vLiteral("tcp"), host: vString(), port: vNumber() })
);
const entryValidator = vObj({
  schemaVersion: vNumber(),
  type: vEnum("editor", "standalone"),
  pid: vNumber(),
  instanceId: vString(),
  protocolVersion: vString(),
  connectionToken: vString(),
  endpoint: endpointAddressValidator,
  quality: vOptionalProp(vString()),
  tunnelName: vOptionalProp(vString())
});
function parseAgentHostEndpointMetadataEntry(raw) {
  const { content, error } = entryValidator.validate(raw);
  if (error) {
    return void 0;
  }
  if (content.schemaVersion !== AGENT_HOST_ENDPOINT_REGISTRY_SCHEMA_VERSION) {
    return void 0;
  }
  if (!Number.isSafeInteger(content.pid) || content.pid <= 0) {
    return void 0;
  }
  if (content.endpoint.type === "tcp" && (!Number.isSafeInteger(content.endpoint.port) || content.endpoint.port <= 0 || content.endpoint.port > 65535)) {
    return void 0;
  }
  return {
    schemaVersion: AGENT_HOST_ENDPOINT_REGISTRY_SCHEMA_VERSION,
    type: content.type,
    pid: content.pid,
    instanceId: content.instanceId,
    protocolVersion: content.protocolVersion,
    connectionToken: content.connectionToken,
    endpoint: content.endpoint,
    quality: content.quality,
    tunnelName: content.tunnelName
  };
}
function parseAgentHostEndpointRegistry(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries = [];
  for (const item of raw) {
    const entry = parseAgentHostEndpointMetadataEntry(item);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}
function getAgentHostEndpointIdentityKey(identity) {
  return `${identity.type}:${identity.pid}:${identity.instanceId}`;
}
function getAgentHostEndpointIdentityHashInput(identity) {
  return `${identity.type}\0${identity.pid}\0${identity.instanceId}`;
}
function isSameAgentHostEndpointIdentity(a, b) {
  return a.type === b.type && a.pid === b.pid && a.instanceId === b.instanceId;
}
function dedupeAgentHostEndpointMetadata(entries) {
  const byIdentity = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    byIdentity.set(getAgentHostEndpointIdentityKey(entry), entry);
  }
  return [...byIdentity.values()];
}
export {
  AGENT_HOST_ENDPOINT_REGISTRY_SCHEMA_VERSION,
  dedupeAgentHostEndpointMetadata,
  getAgentHostEndpointIdentityHashInput,
  getAgentHostEndpointIdentityKey,
  isSameAgentHostEndpointIdentity,
  parseAgentHostEndpointMetadataEntry,
  parseAgentHostEndpointRegistry
};
