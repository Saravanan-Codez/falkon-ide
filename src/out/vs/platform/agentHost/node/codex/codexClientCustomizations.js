import { dirname } from "../../../../base/common/path.js";
import { basename, extUri, joinPath, relativePath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { parseFrontMatter } from "../../../../base/common/yaml.js";
import { SYNCED_CUSTOMIZATION_SCHEME } from "../../common/agentHostFileSystemService.js";
import { parseRuleFile } from "../../../agentPlugins/common/pluginParsers.js";
import { toCodexMcpServerJson } from "./codexMcpServers.js";
class CodexClientCustomizationStore {
  constructor() {
    this._byClient = /* @__PURE__ */ new Map();
    this._enablement = /* @__PURE__ */ new Map();
  }
  /** Replace one client's synced+parsed plugin set. */
  setClient(clientId, plugins) {
    this._byClient.set(clientId, plugins);
  }
  /** Drop a client's contribution. Returns whether anything was removed. */
  removeClient(clientId) {
    return this._byClient.delete(clientId);
  }
  /**
   * Toggle a client-pushed customization on/off. Returns whether the
   * enablement actually changed (so callers can skip a no-op refresh).
   */
  setEnabled(id, enabled) {
    const current = this._enablement.get(id);
    const effective = current !== false;
    if (effective === enabled) {
      return false;
    }
    if (enabled) {
      this._enablement.delete(id);
    } else {
      this._enablement.set(id, false);
    }
    return true;
  }
  /** Whether a client-pushed customization with this id exists in the store. */
  has(id) {
    return this._merged().some((p) => p.synced.customization.id === id);
  }
  /** Whether the store holds any client-pushed customizations. */
  isEmpty() {
    return this._merged().length === 0;
  }
  /** Merge of every client's plugins, deduplicated by customization id (first client wins). */
  _merged() {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const plugins of this._byClient.values()) {
      for (const plugin of plugins) {
        const id = plugin.synced.customization.id;
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        out.push(plugin);
      }
    }
    return out;
  }
  _isEnabled(id) {
    return this._enablement.get(id) !== false;
  }
  /** The merged plugins that are currently enabled and successfully parsed. */
  enabledPlugins() {
    return this._merged().filter((p) => p.parsed !== void 0 && this._isEnabled(p.synced.customization.id));
  }
  /**
   * Projects the store onto the AHP {@link PluginCustomization} surface, with
   * the enablement overlay applied and each plugin's parsed children folded
   * in (skills, MCP servers, agents, instructions, hooks).
   */
  toCustomizations() {
    return this._merged().map((plugin) => {
      const base = plugin.synced.customization;
      const children = plugin.parsed ? parsedPluginChildren(plugin.parsed) : base.children;
      return {
        ...base,
        enabled: this._isEnabled(base.id),
        ...children ? { children } : {}
      };
    });
  }
}
function parsedPluginChildren(parsed) {
  const byId = /* @__PURE__ */ new Map();
  const add = (c) => {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
    }
  };
  for (const a of parsed.agents) {
    add(a.customization);
  }
  for (const s of parsed.skills) {
    add(s.customization);
  }
  for (const r of parsed.instructions) {
    add(r.customization);
  }
  for (const h of parsed.hooks) {
    add(h.customization);
  }
  for (const m of parsed.mcpServers) {
    add(m.customization);
  }
  return [...byId.values()];
}
function codexMcpServersFromPlugins(plugins) {
  const out = {};
  for (const plugin of plugins) {
    for (const def of plugin.parsed?.mcpServers ?? emptyMcpDefs) {
      if (!Object.prototype.hasOwnProperty.call(out, def.name)) {
        out[def.name] = toCodexMcpServerJson(def.configuration);
      }
    }
  }
  return out;
}
const emptyMcpDefs = [];
function codexSkillRootsFromPlugins(plugins) {
  const roots = /* @__PURE__ */ new Set();
  for (const plugin of plugins) {
    for (const skill of plugin.parsed?.skills ?? []) {
      roots.add(dirname(dirname(skill.uri.fsPath)));
    }
  }
  return [...roots].sort();
}
async function codexCustomizationConfigFromPlugins(plugins, selectedAgent, fileService) {
  const agentRoles = /* @__PURE__ */ new Map();
  const pluginInstructions = [];
  let selectedAgentInstructions;
  let selectedAgentMatch = 0 /* None */;
  const selectedAgentUri = selectedAgent?.uri;
  for (const plugin of plugins) {
    for (const agent of plugin.parsed?.agents ?? []) {
      try {
        const content = (await fileService.readFile(agent.uri)).value.toString();
        const frontmatter = parseFrontMatter(content);
        const name = frontmatter?.getStringValue("name")?.trim() || agent.name;
        const description = frontmatter?.getStringValue("description")?.trim() || agent.description || name;
        const instructions = frontmatter?.body ?? content;
        const model = frontmatter?.getStringValue("model")?.trim() || void 0;
        if (!agentRoles.has(name)) {
          agentRoles.set(name, { name, description, instructions, ...model ? { model } : {} });
        }
        const match = selectedAgentUri ? matchSelectedAgent(plugin, agent.uri, selectedAgentUri) : 0 /* None */;
        if (match > selectedAgentMatch) {
          selectedAgentInstructions = instructions;
          selectedAgentMatch = match;
        }
      } catch {
      }
    }
    for (const instruction of plugin.parsed?.instructions ?? []) {
      try {
        const rule = await parseRuleFile(instruction.uri, fileService);
        if (!isAlwaysOnRule(rule.globs, rule.alwaysApply)) {
          continue;
        }
        const content = (await fileService.readFile(instruction.uri)).value.toString();
        const frontmatter = parseFrontMatter(content);
        const body = frontmatter?.body ?? content;
        if (body.trim()) {
          pluginInstructions.push(body.trim());
        }
      } catch {
      }
    }
  }
  const developerInstructions = [
    ...pluginInstructions,
    ...selectedAgentInstructions ? [selectedAgentInstructions.trim()] : []
  ].filter(Boolean).join("\n\n");
  return {
    agentRoles: [...agentRoles.values()],
    ...developerInstructions ? { developerInstructions } : {}
  };
}
function isAlwaysOnRule(globs, alwaysApply) {
  if (!globs?.length) {
    return alwaysApply !== false;
  }
  return globs.some((glob) => glob.trim() === "**" || glob.trim() === "**/*");
}
var SelectedAgentMatch = /* @__PURE__ */ ((SelectedAgentMatch2) => {
  SelectedAgentMatch2[SelectedAgentMatch2["None"] = 0] = "None";
  SelectedAgentMatch2[SelectedAgentMatch2["SyntheticBundleSource"] = 1] = "SyntheticBundleSource";
  SelectedAgentMatch2[SelectedAgentMatch2["Exact"] = 2] = "Exact";
  return SelectedAgentMatch2;
})(SelectedAgentMatch || {});
function matchSelectedAgent(plugin, agentUri, selectedAgentUri) {
  const selectedUri = URI.parse(selectedAgentUri);
  if (extUri.isEqual(agentUri, selectedUri)) {
    return 2 /* Exact */;
  }
  const pluginDir = plugin.synced.pluginDir;
  if (!pluginDir) {
    return 0 /* None */;
  }
  const relativeAgentPath = relativePath(pluginDir, agentUri);
  if (relativeAgentPath === void 0) {
    return 0 /* None */;
  }
  const sourcePluginUri = URI.parse(plugin.synced.customization.uri);
  const sourceAgentUri = relativeAgentPath ? joinPath(sourcePluginUri, relativeAgentPath) : sourcePluginUri;
  if (extUri.isEqual(sourceAgentUri, selectedUri)) {
    return 2 /* Exact */;
  }
  if (sourcePluginUri.scheme === SYNCED_CUSTOMIZATION_SCHEME && relativeAgentPath.startsWith("agents/") && basename(agentUri) === basename(selectedUri)) {
    return 1 /* SyntheticBundleSource */;
  }
  return 0 /* None */;
}
function codexAgentRoleToml(role) {
  return [
    `name = ${JSON.stringify(role.name)}`,
    `description = ${JSON.stringify(role.description)}`,
    `developer_instructions = ${JSON.stringify(role.instructions)}`,
    ...role.model ? [`model = ${JSON.stringify(role.model)}`] : [],
    ""
  ].join("\n");
}
function codexSkillCapabilityRoots(plugins) {
  return codexSkillRootsFromPlugins(plugins).map((path) => URI.file(path));
}
export {
  CodexClientCustomizationStore,
  codexAgentRoleToml,
  codexCustomizationConfigFromPlugins,
  codexMcpServersFromPlugins,
  codexSkillCapabilityRoots,
  codexSkillRootsFromPlugins
};
