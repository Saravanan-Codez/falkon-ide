import { equals } from "../../base/common/objects.js";
const LOCAL_AGENT_HOST_PROVIDER_ID = "local-agent-host";
const REMOTE_AGENT_HOST_PROVIDER_PREFIX = "agenthost-";
const REMOTE_AGENT_HOST_PROVIDER_RE = /^agenthost-/;
const ANY_AGENT_HOST_PROVIDER_RE = /^(local-agent-host|agenthost-)/;
function isAgentHostProvider(provider) {
  return isAgentHostProviderId(provider.id);
}
function isAgentHostProviderId(providerId) {
  return providerId === LOCAL_AGENT_HOST_PROVIDER_ID || providerId.startsWith(REMOTE_AGENT_HOST_PROVIDER_PREFIX);
}
function resolvedConfigsEqual(a, b) {
  const aValueKeys = Object.keys(a.values);
  const bValueKeys = Object.keys(b.values);
  if (aValueKeys.length !== bValueKeys.length) {
    return false;
  }
  for (const key of aValueKeys) {
    if (!equals(a.values[key], b.values[key])) {
      return false;
    }
  }
  const aPropKeys = Object.keys(a.schema.properties);
  const bPropKeys = Object.keys(b.schema.properties);
  if (aPropKeys.length !== bPropKeys.length) {
    return false;
  }
  for (const key of aPropKeys) {
    if (a.schema.properties[key] !== b.schema.properties[key]) {
      return false;
    }
  }
  return true;
}
const AUTO_APPROVE_ENUM = ["default", "autoApprove", "autopilot"];
function buildMutableConfigSchemaItem(key, value) {
  if (typeof value === "string") {
    return {
      type: "string",
      title: key,
      sessionMutable: true,
      enum: key === "autoApprove" ? AUTO_APPROVE_ENUM : [value]
    };
  }
  if (typeof value === "number") {
    return { type: "number", title: key, sessionMutable: true };
  }
  if (typeof value === "boolean") {
    return { type: "boolean", title: key, sessionMutable: true };
  }
  if (Array.isArray(value)) {
    return { type: "array", title: key, sessionMutable: true };
  }
  if (value && typeof value === "object") {
    return { type: "object", title: key, sessionMutable: true };
  }
  return void 0;
}
function buildMutableConfigSchema(config) {
  const properties = {};
  for (const key of Object.keys(config)) {
    const property = buildMutableConfigSchemaItem(key, config[key]);
    if (property) {
      properties[key] = property;
    }
  }
  return properties;
}
export {
  ANY_AGENT_HOST_PROVIDER_RE,
  LOCAL_AGENT_HOST_PROVIDER_ID,
  REMOTE_AGENT_HOST_PROVIDER_PREFIX,
  REMOTE_AGENT_HOST_PROVIDER_RE,
  buildMutableConfigSchema,
  isAgentHostProvider,
  isAgentHostProviderId,
  resolvedConfigsEqual
};
