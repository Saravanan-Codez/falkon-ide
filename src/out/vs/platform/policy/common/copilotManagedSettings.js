import { Event } from "../../../base/common/event.js";
import { extraKnownMarketplacesToConfigDict } from "../../../base/common/managedSettings.js";
import { isEmptyObject, isObject, isString } from "../../../base/common/types.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const GITHUB_COPILOT_WIN32_REGISTRY_PATH = "SOFTWARE\\Policies\\GitHubCopilot";
const GITHUB_COPILOT_WIN32_POLICY_NAME = "GitHubCopilot";
const GITHUB_COPILOT_MACOS_BUNDLE_ID = "com.github.copilot";
const COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY = "permissions.disableBypassPermissionsMode";
const COPILOT_ENABLED_PLUGINS_KEY = "enabledPlugins";
const COPILOT_EXTRA_MARKETPLACES_KEY = "extraKnownMarketplaces";
const COPILOT_STRICT_MARKETPLACES_KEY = "strictKnownMarketplaces";
const COPILOT_ALLOWED_MCP_SERVERS_KEY = "allowedMcpServers";
const COPILOT_DENIED_MCP_SERVERS_KEY = "deniedMcpServers";
const COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_KEY = "strictPluginOnlyCustomization";
const COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_KEY = "allowManagedMcpServersOnly";
const COPILOT_ALLOW_MANAGED_HOOKS_ONLY_KEY = "allowManagedHooksOnly";
const COPILOT_FORCE_REMOTE_SETTINGS_REFRESH_KEY = "forceRemoteSettingsRefresh";
const MANAGED_SETTINGS_CONTROL_DEFINITIONS = {
  [COPILOT_FORCE_REMOTE_SETTINGS_REFRESH_KEY]: { type: "boolean" }
};
const COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_CONFIG = "chat.customizations.strictPluginOnlyCustomization";
const COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG = "chat.mcp.allowManagedServersOnly";
const COPILOT_ALLOW_MANAGED_HOOKS_ONLY_CONFIG = "chat.hooks.allowManagedOnly";
const COPILOT_MODEL_KEY = "permissions.model";
const COPILOT_OTEL_ENABLED_KEY = "telemetry.enabled";
const COPILOT_OTEL_ENDPOINT_KEY = "telemetry.endpoint";
const COPILOT_OTEL_PROTOCOL_KEY = "telemetry.protocol";
const COPILOT_OTEL_CAPTURE_CONTENT_KEY = "telemetry.captureContent";
const COPILOT_OTEL_LOCK_CAPTURE_CONTENT_KEY = "telemetry.lockCaptureContent";
const COPILOT_OTEL_SERVICE_NAME_KEY = "telemetry.serviceName";
const COPILOT_OTEL_RESOURCE_ATTRIBUTES_KEY = "telemetry.resourceAttributes";
const COPILOT_OTEL_HEADERS_KEY = "telemetry.headers";
const managedSettingValueCallbacks = /* @__PURE__ */ new Map();
function managedSettingValue(key) {
  let callback = managedSettingValueCallbacks.get(key);
  if (!callback) {
    callback = (policyData) => policyData.managedSettings?.[key];
    managedSettingValueCallbacks.set(key, callback);
  }
  return callback;
}
function shouldForceRemoteSettingsRefresh(nativeMdm, server) {
  const nativeValue = nativeMdm?.[COPILOT_FORCE_REMOTE_SETTINGS_REFRESH_KEY];
  if (typeof nativeValue === "boolean") {
    return nativeValue;
  }
  return server?.[COPILOT_FORCE_REMOTE_SETTINGS_REFRESH_KEY] === true;
}
let managedModelValueCallback;
function managedModelValue() {
  if (!managedModelValueCallback) {
    managedModelValueCallback = (policyData) => {
      const model = policyData.managedSettings?.[COPILOT_MODEL_KEY];
      const trimmed = typeof model === "string" ? model.trim() : void 0;
      return trimmed ? trimmed : void 0;
    };
  }
  return managedModelValueCallback;
}
const INativeManagedSettingsService = createDecorator("nativeManagedSettingsService");
class NullNativeManagedSettingsService {
  constructor() {
    this.managedSettings = {};
    this.onDidChangeManagedSettings = Event.None;
  }
  async initialize() {
    return this.managedSettings;
  }
  async updatePolicyDefinitions() {
    return this.managedSettings;
  }
}
function flattenManagedSettings(object) {
  const result = {};
  flattenManagedSettingsValue(object, void 0, result);
  return result;
}
function flattenManagedSettingsValue(value, prefix, result) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix !== void 0) {
      result[prefix] = value;
    }
    return;
  }
  if (!isManagedSettingsObject(value)) {
    return;
  }
  for (const key in value) {
    flattenManagedSettingsValue(value[key], prefix ? `${prefix}.${key}` : key, result);
  }
}
function isManagedSettingsObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectManagedSettingsDefinitions(policyDefinitions) {
  const definitions = {};
  for (const policyName in policyDefinitions) {
    const policyManagedSettings = policyDefinitions[policyName].managedSettings;
    if (policyManagedSettings) {
      for (const key in policyManagedSettings) {
        definitions[key] = policyManagedSettings[key];
      }
    }
  }
  return definitions;
}
function hasManagedSettingsDefinitions(policyDefinitions) {
  for (const policyName in policyDefinitions) {
    const policyManagedSettings = policyDefinitions[policyName].managedSettings;
    if (policyManagedSettings && !isEmptyObject(policyManagedSettings)) {
      return true;
    }
  }
  return false;
}
function projectManagedSettings(values, definitions, onWarn) {
  const projected = {};
  for (const key in definitions) {
    const value = values[key];
    if (value === void 0) {
      continue;
    }
    if (typeof value === definitions[key].type) {
      projected[key] = value;
    } else {
      onWarn?.(`Ignoring managed setting "${key}": expected ${definitions[key].type}, got ${typeof value}`);
    }
  }
  return projected;
}
const MANAGED_SETTINGS_CHANNELS = ["nativeMdm", "server", "file"];
function pickManagedSettings(nativeMdm, server, file) {
  const bags = { nativeMdm, server, file };
  const resolutions = /* @__PURE__ */ new Map();
  for (const channel of MANAGED_SETTINGS_CHANNELS) {
    const bag = bags[channel];
    if (!bag) {
      continue;
    }
    for (const key of Object.keys(bag)) {
      const value = bag[key];
      if (value === void 0) {
        continue;
      }
      const existing = resolutions.get(key);
      if (existing) {
        existing.contributions.push({ channel, value });
      } else {
        resolutions.set(key, { value, source: channel, contributions: [{ channel, value }] });
      }
    }
  }
  const activeSources = /* @__PURE__ */ new Set();
  const entries = [];
  for (const [key, resolution] of resolutions) {
    entries.push([key, resolution.value]);
    activeSources.add(resolution.source);
  }
  return {
    // Build via Object.fromEntries (define-property semantics) rather than bracket assignment so
    // an untrusted `__proto__` key can't corrupt the merged bag's prototype chain.
    values: Object.fromEntries(entries),
    resolutions,
    // Preserve precedence order for a stable, readable report.
    activeSources: MANAGED_SETTINGS_CHANNELS.filter((channel) => activeSources.has(channel))
  };
}
const MANAGED_SETTINGS_MACOS_FILE_PATH = "/Library/Application Support/GitHubCopilot/managed-settings.json";
const MANAGED_SETTINGS_LINUX_FILE_PATH = "/etc/github-copilot/managed-settings.json";
const MANAGED_SETTINGS_WINDOWS_DIR = "GitHubCopilot";
const MANAGED_SETTINGS_FILE_NAME = "managed-settings.json";
function encodeStringMap(value) {
  if (!isObject(value)) {
    return void 0;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      continue;
    }
    if (isString(v)) {
      out[k] = v;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return out;
}
function encodeObject(value) {
  return isObject(value) ? value : void 0;
}
function encodeArray(value) {
  return Array.isArray(value) ? value : void 0;
}
function encodeExtraMarketplaces(value, onWarn) {
  return extraKnownMarketplacesToConfigDict(normalizeExtraKnownMarketplaces(value, onWarn));
}
const STRUCTURED_MANAGED_SETTINGS = [
  {
    key: COPILOT_ENABLED_PLUGINS_KEY,
    encode: encodeObject
  },
  {
    key: COPILOT_STRICT_MARKETPLACES_KEY,
    encode: encodeArray
  },
  {
    key: COPILOT_ALLOWED_MCP_SERVERS_KEY,
    encode: encodeArray
  },
  {
    key: COPILOT_DENIED_MCP_SERVERS_KEY,
    encode: encodeArray
  },
  {
    key: COPILOT_EXTRA_MARKETPLACES_KEY,
    encode: encodeExtraMarketplaces
  },
  {
    // Nested under `telemetry`; carried as a JSON-encoded `{ [k]: string }` map. Non-string
    // primitive values are coerced to strings; non-primitive values are dropped.
    key: COPILOT_OTEL_RESOURCE_ATTRIBUTES_KEY,
    encode: encodeStringMap
  },
  {
    // Nested under `telemetry`; carried as a JSON-encoded `{ [k]: string }` map of OTLP headers.
    key: COPILOT_OTEL_HEADERS_KEY,
    encode: encodeStringMap
  }
];
function readNestedManagedKey(obj, dottedKey) {
  let current = obj;
  for (const segment of dottedKey.split(".")) {
    if (!isObject(current)) {
      return void 0;
    }
    current = current[segment];
  }
  return current;
}
function withNestedManagedKeyDeleted(obj, dottedKey) {
  const dot = dottedKey.indexOf(".");
  if (dot === -1) {
    const clone = { ...obj };
    delete clone[dottedKey];
    return clone;
  }
  const head = dottedKey.slice(0, dot);
  const child = obj[head];
  if (!isObject(child)) {
    return obj;
  }
  return { ...obj, [head]: withNestedManagedKeyDeleted(child, dottedKey.slice(dot + 1)) };
}
function normalizeManagedSettings(parsed, onWarn) {
  let scalarRest = { ...parsed };
  for (const setting of STRUCTURED_MANAGED_SETTINGS) {
    scalarRest = withNestedManagedKeyDeleted(scalarRest, setting.key);
  }
  const result = { ...flattenManagedSettings(scalarRest) };
  for (const setting of STRUCTURED_MANAGED_SETTINGS) {
    const encoded = setting.encode(readNestedManagedKey(parsed, setting.key), onWarn);
    if (encoded !== void 0) {
      result[setting.key] = JSON.stringify(encoded);
    }
  }
  return result;
}
function normalizeExtraKnownMarketplaces(value, onWarn) {
  if (!isObject(value)) {
    return void 0;
  }
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  for (const [name, entry] of Object.entries(value)) {
    if (!isObject(entry) || !isObject(entry.source)) {
      onWarn?.(`Skipping malformed extraKnownMarketplaces entry "${name}": expected { source: { source, repo|url } }`);
      continue;
    }
    const rawEntry = entry;
    const src = rawEntry.source;
    const autoUpdate = typeof rawEntry.autoUpdate === "boolean" ? rawEntry.autoUpdate : void 0;
    if (rawEntry.autoUpdate !== void 0 && autoUpdate === void 0) {
      onWarn?.(`Ignoring invalid autoUpdate for extraKnownMarketplaces entry "${name}": expected boolean`);
    }
    let normalized;
    if (src.source === "github" && isString(src.repo)) {
      normalized = { name, ...autoUpdate === void 0 ? {} : { autoUpdate }, source: { source: "github", repo: src.repo, ...src.ref ? { ref: src.ref } : {} } };
    } else if (src.source === "git" && isString(src.url)) {
      normalized = { name, ...autoUpdate === void 0 ? {} : { autoUpdate }, source: { source: "git", url: src.url, ...src.ref ? { ref: src.ref } : {} } };
    } else if (src.source === "github" || src.source === "git") {
      onWarn?.(`Skipping extraKnownMarketplaces entry "${name}": source "${src.source}" requires ${src.source === "github" ? '"repo"' : '"url"'}`);
    } else {
      onWarn?.(`Skipping extraKnownMarketplaces entry "${name}": unknown source type "${src.source}"`);
    }
    if (normalized && !seen.has(name)) {
      seen.add(name);
      entries.push(normalized);
    }
  }
  return entries;
}
const IFileManagedSettingsService = createDecorator("fileManagedSettingsService");
class NullFileManagedSettingsService {
  constructor() {
    this.rawManagedSettings = {};
    this.managedSettings = {};
    this.onDidChangeRawManagedSettings = Event.None;
    this.onDidChangeManagedSettings = Event.None;
  }
}
export {
  COPILOT_ALLOWED_MCP_SERVERS_KEY,
  COPILOT_ALLOW_MANAGED_HOOKS_ONLY_CONFIG,
  COPILOT_ALLOW_MANAGED_HOOKS_ONLY_KEY,
  COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_CONFIG,
  COPILOT_ALLOW_MANAGED_MCP_SERVERS_ONLY_KEY,
  COPILOT_DENIED_MCP_SERVERS_KEY,
  COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY,
  COPILOT_ENABLED_PLUGINS_KEY,
  COPILOT_EXTRA_MARKETPLACES_KEY,
  COPILOT_FORCE_REMOTE_SETTINGS_REFRESH_KEY,
  COPILOT_MODEL_KEY,
  COPILOT_OTEL_CAPTURE_CONTENT_KEY,
  COPILOT_OTEL_ENABLED_KEY,
  COPILOT_OTEL_ENDPOINT_KEY,
  COPILOT_OTEL_HEADERS_KEY,
  COPILOT_OTEL_LOCK_CAPTURE_CONTENT_KEY,
  COPILOT_OTEL_PROTOCOL_KEY,
  COPILOT_OTEL_RESOURCE_ATTRIBUTES_KEY,
  COPILOT_OTEL_SERVICE_NAME_KEY,
  COPILOT_STRICT_MARKETPLACES_KEY,
  COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_CONFIG,
  COPILOT_STRICT_PLUGIN_ONLY_CUSTOMIZATION_KEY,
  GITHUB_COPILOT_MACOS_BUNDLE_ID,
  GITHUB_COPILOT_WIN32_POLICY_NAME,
  GITHUB_COPILOT_WIN32_REGISTRY_PATH,
  IFileManagedSettingsService,
  INativeManagedSettingsService,
  MANAGED_SETTINGS_CHANNELS,
  MANAGED_SETTINGS_CONTROL_DEFINITIONS,
  MANAGED_SETTINGS_FILE_NAME,
  MANAGED_SETTINGS_LINUX_FILE_PATH,
  MANAGED_SETTINGS_MACOS_FILE_PATH,
  MANAGED_SETTINGS_WINDOWS_DIR,
  NullFileManagedSettingsService,
  NullNativeManagedSettingsService,
  collectManagedSettingsDefinitions,
  hasManagedSettingsDefinitions,
  managedModelValue,
  managedSettingValue,
  normalizeManagedSettings,
  pickManagedSettings,
  projectManagedSettings,
  shouldForceRemoteSettingsRefresh
};
