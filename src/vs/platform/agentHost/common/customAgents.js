import { CustomizationType } from "./state/protocol/state.js";
function getEffectiveAgents(sessionCustomizations) {
  const seen = /* @__PURE__ */ new Map();
  if (sessionCustomizations) {
    for (const container of sessionCustomizations) {
      if (container.type === CustomizationType.McpServer) {
        continue;
      }
      if (container.enabled === false || !container.children) {
        continue;
      }
      for (const child of container.children) {
        if (child.type !== CustomizationType.Agent) {
          continue;
        }
        const key = child.uri.toString();
        if (!seen.has(key)) {
          seen.set(key, child);
        }
      }
    }
  }
  const result = [...seen.values()];
  result.sort((a, b) => a.name.localeCompare(b.name) || a.uri.toString().localeCompare(b.uri.toString()));
  return result;
}
function agentHostAgentPickerStorageKey(resourceScheme) {
  return `workbench.agentsession.agentHostAgentPicker.${resourceScheme}.selectedAgentUri`;
}
function resolveAgentHostAgent(agents, sessionAgentUri, storedAgentUri) {
  if (sessionAgentUri !== void 0) {
    const sessionStr = typeof sessionAgentUri === "string" ? sessionAgentUri : sessionAgentUri.toString();
    const match = agents.find((a) => a.uri === sessionStr);
    if (match) {
      return match;
    }
  }
  return storedAgentUri ? agents.find((a) => a.uri === storedAgentUri) : void 0;
}
export {
  agentHostAgentPickerStorageKey,
  getEffectiveAgents,
  resolveAgentHostAgent
};
