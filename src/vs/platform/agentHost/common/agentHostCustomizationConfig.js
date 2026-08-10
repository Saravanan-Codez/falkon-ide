import { localize } from "../../../nls.js";
import { createSchema, schemaProperty } from "./agentHostSchema.js";
import { CustomizationType } from "./state/protocol/state.js";
import { customizationId } from "./state/sessionState.js";
var AgentHostConfigKey = /* @__PURE__ */ ((AgentHostConfigKey2) => {
  AgentHostConfigKey2["Customizations"] = "customizations";
  AgentHostConfigKey2["DefaultShell"] = "defaultShell";
  AgentHostConfigKey2["AllowSignedOutWhenUsable"] = "allowSignedOutWhenUsable";
  AgentHostConfigKey2["SessionCustomizationDiscoveryMode"] = "sessionCustomizationDiscoveryMode";
  AgentHostConfigKey2["GithubEnterpriseUri"] = "githubEnterpriseUri";
  return AgentHostConfigKey2;
})(AgentHostConfigKey || {});
const SESSION_CUSTOMIZATION_DISCOVERY_MODES = ["scan", "discover"];
const DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE = "scan";
const agentHostCustomizationConfigSchema = createSchema({
  ["customizations" /* Customizations */]: schemaProperty({
    type: "array",
    title: localize("agentHost.config.customizations.title", "Plugins"),
    description: localize("agentHost.config.customizations.description", "Plugins configured on this agent host and available to remote sessions."),
    default: [],
    items: {
      type: "object",
      title: localize("agentHost.config.customizations.itemTitle", "Plugin"),
      properties: {
        uri: {
          type: "string",
          title: localize("agentHost.config.customizations.uri", "Plugin URI")
        },
        displayName: {
          type: "string",
          title: localize("agentHost.config.customizations.displayName", "Name")
        },
        description: {
          type: "string",
          title: localize("agentHost.config.customizations.descriptionField", "Description")
        }
      },
      required: ["uri", "displayName"]
    }
  }),
  ["defaultShell" /* DefaultShell */]: schemaProperty({
    type: "string",
    title: localize("agentHost.config.defaultShell.title", "Default Shell"),
    description: localize("agentHost.config.defaultShell.description", "Absolute path to the shell executable used by host-managed terminals. Normally pushed by the connected VS Code client from `terminal.integrated.agentHostProfile.<os>` (falling back to `terminal.integrated.defaultProfile.<os>`); when unset, the agent host falls back to the system shell. Only the path is supported; `args` and `env` from the workbench profile are not piped through yet. The workbench only pushes this for the local agent host \u2014 remote agent host operators should set this directly in the remote machine's `agent-host-config.json`.")
  }),
  ["allowSignedOutWhenUsable" /* AllowSignedOutWhenUsable */]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.allowSignedOutWhenUsable.title", "Allow Signed-Out Agent Window"),
    description: localize("agentHost.config.allowSignedOutWhenUsable.description", "Experimental. When enabled, the agent window opens without forcing GitHub sign-in as long as at least one agent is usable without GitHub (for example Claude in native mode with your own Anthropic API key). When disabled (the default), GitHub sign-in is required."),
    default: false
  }),
  ["sessionCustomizationDiscoveryMode" /* SessionCustomizationDiscoveryMode */]: schemaProperty({
    type: "string",
    enum: [...SESSION_CUSTOMIZATION_DISCOVERY_MODES],
    title: localize("agentHost.config.sessionCustomizationDiscoveryMode.title", "Session Customization Discovery Mode"),
    description: localize("agentHost.config.sessionCustomizationDiscoveryMode.description", "Controls whether session-scoped customizations are populated from local file scanning or from Copilot SDK discovery."),
    default: DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE
  }),
  ["githubEnterpriseUri" /* GithubEnterpriseUri */]: schemaProperty({
    type: "string",
    title: localize("agentHost.config.githubEnterpriseUri.title", "GitHub Enterprise URI"),
    description: localize("agentHost.config.githubEnterpriseUri.description", 'Optional base URI of a GitHub Enterprise instance (for example "https://ghe.example.com" for GitHub Enterprise Server, or "https://tenant.ghe.com" for GitHub Enterprise Cloud). When set, the agent host authenticates and makes GitHub API calls against this instance instead of github.com. Normally pushed by the connected VS Code client from the `github-enterprise.uri` setting; remote agent host operators can set it directly in the remote `agent-host-config.json`.')
  })
});
const defaultAgentHostCustomizationConfigValues = {
  ["customizations" /* Customizations */]: []
};
function getAgentHostConfiguredCustomizations(values) {
  const raw = values?.["customizations" /* Customizations */];
  const entries = agentHostCustomizationConfigSchema.validate("customizations" /* Customizations */, raw) ? raw : defaultAgentHostCustomizationConfigValues["customizations" /* Customizations */];
  return entries.map(toContainerCustomization);
}
function toContainerCustomization(entry) {
  return {
    type: CustomizationType.Plugin,
    id: customizationId(entry.uri),
    uri: entry.uri,
    name: entry.displayName,
    enabled: true
  };
}
export {
  AgentHostConfigKey,
  DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE,
  SESSION_CUSTOMIZATION_DISCOVERY_MODES,
  agentHostCustomizationConfigSchema,
  defaultAgentHostCustomizationConfigValues,
  getAgentHostConfiguredCustomizations,
  toContainerCustomization
};
