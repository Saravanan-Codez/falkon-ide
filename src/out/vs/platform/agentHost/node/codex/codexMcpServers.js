import { McpServerType } from "../../../mcp/common/mcpPlatformTypes.js";
import { McpServerStatus } from "../../common/state/protocol/channels-session/state.js";
function translateCodexMcpStartupState(status, error) {
  switch (status) {
    case "ready":
      return { kind: McpServerStatus.Ready };
    case "starting":
      return { kind: McpServerStatus.Starting };
    case "failed":
      return {
        kind: McpServerStatus.Error,
        error: { errorType: "mcp-server-failed", message: error ?? "MCP server failed to start" }
      };
    case "cancelled":
      return { kind: McpServerStatus.Stopped };
    default:
      return { kind: McpServerStatus.Stopped };
  }
}
function codexToolMapToArray(tools) {
  const out = [];
  for (const key of Object.keys(tools)) {
    const tool = tools[key];
    if (tool) {
      out.push(tool);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
function codexMcpStatusToEntry(status) {
  return {
    state: { kind: McpServerStatus.Ready },
    tools: codexToolMapToArray(status.tools),
    resources: status.resources,
    resourceTemplates: status.resourceTemplates
  };
}
function codexMcpListToInventory(data) {
  const inventory = /* @__PURE__ */ new Map();
  for (const status of data) {
    inventory.set(status.name, codexMcpStatusToEntry(status));
  }
  return inventory;
}
function inventoryToSdkServers(inventory) {
  const out = [];
  for (const [name, entry] of inventory) {
    out.push({ name, state: entry.state });
  }
  return out;
}
function buildCodexMcpReadResult(method, entry) {
  switch (method) {
    case "tools/list":
      return { handled: true, result: { tools: entry.tools } };
    case "resources/list":
      return { handled: true, result: { resources: entry.resources } };
    case "resources/templates/list":
      return { handled: true, result: { resourceTemplates: entry.resourceTemplates } };
    default:
      return { handled: false };
  }
}
function codexMcpToolsChanged(previous, next) {
  const a = (previous?.tools ?? []).map((t) => t.name).sort();
  const b = (next?.tools ?? []).map((t) => t.name).sort();
  if (a.length !== b.length) {
    return true;
  }
  return a.some((name, i) => name !== b[i]);
}
function isSupportedMcpServerConfiguration(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  if (candidate.type === McpServerType.LOCAL) {
    return typeof candidate.command === "string";
  }
  if (candidate.type === McpServerType.REMOTE) {
    return typeof candidate.url === "string";
  }
  return false;
}
function toCodexStringRecord(record) {
  const result = {};
  if (!record) {
    return result;
  }
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && value !== void 0) {
      result[key] = String(value);
    }
  }
  return result;
}
function toCodexStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.filter((v) => v !== null && v !== void 0).map((v) => String(v));
}
function toCodexMcpServerJson(config) {
  if (config.type === McpServerType.LOCAL) {
    const out2 = { command: config.command };
    const args = toCodexStringArray(config.args);
    if (args.length > 0) {
      out2.args = args;
    }
    const env = toCodexStringRecord(config.env);
    if (Object.keys(env).length > 0) {
      out2.env = env;
    }
    if (typeof config.cwd === "string") {
      out2.cwd = config.cwd;
    }
    return out2;
  }
  const out = { url: config.url };
  const headers = toCodexStringRecord(config.headers);
  if (Object.keys(headers).length > 0) {
    out.http_headers = headers;
  }
  return out;
}
function codexMcpServersFromConfig(servers) {
  const out = {};
  for (const [name, config] of Object.entries(servers ?? {})) {
    if (isSupportedMcpServerConfiguration(config)) {
      out[name] = toCodexMcpServerJson(config);
    }
  }
  return out;
}
function normalizeCodexMcpResourceUrl(value) {
  if (!URL.canParse(value)) {
    return void 0;
  }
  const url = new URL(value);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}
function codexStartupErrorNeedsAuth(error) {
  if (!error) {
    return false;
  }
  return /not logged in|mcp login|log in to|unauthori[sz]ed|requires? (?:authentication|authorization|login)|\b401\b/i.test(error);
}
function injectCodexMcpAuthTokens(servers, tokensByNormalizedUrl) {
  if (tokensByNormalizedUrl.size === 0) {
    return servers;
  }
  const out = {};
  for (const [name, server] of Object.entries(servers)) {
    const normalized = server.url !== void 0 ? normalizeCodexMcpResourceUrl(server.url) : void 0;
    const token = normalized !== void 0 ? tokensByNormalizedUrl.get(normalized) : void 0;
    out[name] = token !== void 0 ? { ...server, http_headers: { ...withoutAuthorizationHeaders(server.http_headers), Authorization: `Bearer ${token}` } } : server;
  }
  return out;
}
function withoutAuthorizationHeaders(headers) {
  const out = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== "authorization") {
        out[key] = value;
      }
    }
  }
  return out;
}
export {
  buildCodexMcpReadResult,
  codexMcpListToInventory,
  codexMcpServersFromConfig,
  codexMcpStatusToEntry,
  codexMcpToolsChanged,
  codexStartupErrorNeedsAuth,
  codexToolMapToArray,
  injectCodexMcpAuthTokens,
  inventoryToSdkServers,
  isSupportedMcpServerConfiguration,
  normalizeCodexMcpResourceUrl,
  toCodexMcpServerJson,
  translateCodexMcpStartupState
};
