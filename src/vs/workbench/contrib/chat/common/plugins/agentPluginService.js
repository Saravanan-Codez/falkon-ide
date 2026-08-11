import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../base/common/resources.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const IAgentPluginService = createDecorator("agentPluginService");
var AgentPluginDiscoveryPriority = /* @__PURE__ */ ((AgentPluginDiscoveryPriority2) => {
  AgentPluginDiscoveryPriority2[AgentPluginDiscoveryPriority2["Configured"] = 10] = "Configured";
  AgentPluginDiscoveryPriority2[AgentPluginDiscoveryPriority2["Marketplace"] = 20] = "Marketplace";
  AgentPluginDiscoveryPriority2[AgentPluginDiscoveryPriority2["Extension"] = 30] = "Extension";
  AgentPluginDiscoveryPriority2[AgentPluginDiscoveryPriority2["CopilotCli"] = 40] = "CopilotCli";
  return AgentPluginDiscoveryPriority2;
})(AgentPluginDiscoveryPriority || {});
function getCanonicalPluginCommandId(plugin, commandName) {
  const prefix = (plugin.label ? normalizePluginToken(plugin.label) : "") || normalizePluginToken(basename(plugin.uri));
  const normalizedCommand = normalizePluginToken(commandName);
  if (normalizedCommand.startsWith(`${prefix}:`)) {
    return normalizedCommand;
  }
  if (prefix === normalizedCommand) {
    return prefix;
  }
  return `${prefix}:${normalizedCommand}`;
}
function normalizePluginToken(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_.:-]/g, "-").replace(/-+/g, "-").replace(/^[-:.]+|[-:.]+$/g, "");
}
class AgentPluginDiscoveryRegistry {
  constructor() {
    this._discovery = [];
    this._order = 0;
  }
  register(descriptor, priority) {
    const registration = { descriptor, priority, order: this._order++ };
    this._discovery.push(registration);
    return toDisposable(() => {
      const index = this._discovery.indexOf(registration);
      if (index >= 0) {
        this._discovery.splice(index, 1);
      }
    });
  }
  getAll() {
    return [...this._discovery].sort((a, b) => a.priority - b.priority || a.order - b.order);
  }
}
const agentPluginDiscoveryRegistry = new AgentPluginDiscoveryRegistry();
export {
  AgentPluginDiscoveryPriority,
  IAgentPluginService,
  agentPluginDiscoveryRegistry,
  getCanonicalPluginCommandId
};
