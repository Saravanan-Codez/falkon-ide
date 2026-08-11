import { parse as parseJSONC } from "../../../base/common/json.js";
import { joinPath } from "../../../base/common/resources.js";
const AGENT_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const AGENT_PLUGIN_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const agentPluginSchemaPrefix = "https://agent-plugins.org/schemas/";
async function readAgentPluginManifest(pluginUri, fileService) {
  const manifestUri = joinPath(pluginUri, "plugin.json");
  if (!await fileService.exists(manifestUri)) {
    return void 0;
  }
  let parsed;
  try {
    parsed = parseJSONC((await fileService.readFile(manifestUri)).value.toString());
  } catch {
    return void 0;
  }
  if (!isRecord(parsed) || !isAgentPluginSchema(parsed["$schema"])) {
    return void 0;
  }
  const manifest = {
    $schema: parsed["$schema"]
  };
  const name = asNonEmptyString(parsed["name"]);
  const version = asString(parsed["version"]);
  const description = asString(parsed["description"]);
  const extensions = isRecord(parsed["extensions"]) ? parsed["extensions"] : void 0;
  return {
    ...manifest,
    ...name ? { name } : {},
    ...version ? { version } : {},
    ...description ? { description } : {},
    ...extensions ? { extensions } : {}
  };
}
function isAgentPluginSchema(value) {
  return typeof value === "string" && value.startsWith(agentPluginSchemaPrefix) && value.endsWith("/plugin.schema.json");
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
function asNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : void 0;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export {
  AGENT_PLUGIN_MCP_SCHEMA,
  AGENT_PLUGIN_SCHEMA,
  readAgentPluginManifest
};
