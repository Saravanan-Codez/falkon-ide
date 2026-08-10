import { Extensions as ConfigurationExtensions } from "../../configuration/common/configurationRegistry.js";
import { Registry } from "../../registry/common/platform.js";
function getRegistry() {
  return Registry.as(ConfigurationExtensions.Configuration);
}
function getPropertySchema(settingId) {
  const registry = getRegistry();
  return registry.getConfigurationProperties()[settingId] ?? registry.getExcludedConfigurationProperties()[settingId];
}
function matchesSchemaType(value, type) {
  if (type === void 0) {
    return true;
  }
  if (Array.isArray(type)) {
    return type.some((candidate) => matchesSchemaType(value, candidate));
  }
  switch (type) {
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}
function getGlobalConfigurationValue(configurationService, settingId) {
  const inspected = configurationService.inspect(settingId);
  const property = getPropertySchema(settingId);
  for (const value of [inspected.policyValue, inspected.userValue, inspected.applicationValue]) {
    if (value !== void 0 && matchesSchemaType(value, property?.type)) {
      return value;
    }
  }
  return inspected.defaultValue ?? property?.default;
}
function getAgentHostConfigurationSyncEntries(isLocalAgentHost) {
  const entries = [];
  for (const [settingId, sync] of getRegistry().getAgentHostSyncConfigurations()) {
    if (sync.localOnly && !isLocalAgentHost) {
      continue;
    }
    entries.push({ settingId, sync });
  }
  return entries;
}
function resolveAgentHostConfigurationSyncValue(configurationService, entry) {
  const value = getGlobalConfigurationValue(configurationService, entry.settingId);
  return entry.sync.transform ? entry.sync.transform(value) : value;
}
function resolveAgentHostConfigurationSyncPatch(configurationService, isLocalAgentHost) {
  const patch = {};
  for (const entry of getAgentHostConfigurationSyncEntries(isLocalAgentHost)) {
    const value = resolveAgentHostConfigurationSyncValue(configurationService, entry);
    if (value !== void 0) {
      patch[entry.sync.key] = value;
    }
  }
  return patch;
}
export {
  getAgentHostConfigurationSyncEntries,
  getGlobalConfigurationValue,
  resolveAgentHostConfigurationSyncPatch,
  resolveAgentHostConfigurationSyncValue
};
