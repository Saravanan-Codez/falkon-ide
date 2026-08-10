import { localize } from "../../../nls.js";
import { structuralEquals } from "../../../base/common/equals.js";
import { ConfigurationTarget } from "../../configuration/common/configuration.js";
import { TelemetryConfiguration, TelemetryLevel } from "../../telemetry/common/telemetry.js";
import { SessionConfigKey } from "./sessionConfigKeys.js";
import { JsonRpcErrorCodes, ProtocolError } from "./state/sessionProtocol.js";
function schemaProperty(protocol) {
  const assertFn = buildAssert(protocol);
  const assertValid = (value, path = "") => assertFn(value, path);
  const validate = (value) => {
    try {
      assertFn(value, "");
      return true;
    } catch {
      return false;
    }
  };
  return { protocol, validate, assertValid };
}
function createSchema(definition) {
  return {
    definition,
    toProtocol() {
      const properties = {};
      for (const key of Object.keys(definition)) {
        properties[key] = definition[key].protocol;
      }
      return { type: "object", properties };
    },
    values(values) {
      const raw = values;
      for (const key of Object.keys(definition)) {
        const value = raw[key];
        if (value === void 0) {
          continue;
        }
        const prop = definition[key];
        prop.assertValid(value, key);
      }
      return { ...raw };
    },
    validate(key, value) {
      const prop = definition[key];
      return prop ? prop.validate(value) : false;
    },
    assertValid(key, value) {
      const prop = definition[key];
      if (!prop) {
        throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Unknown schema key '${key}'`);
      }
      const narrowed = prop;
      narrowed.assertValid(value, key);
    },
    validateOrDefault(values, defaults) {
      const result = {};
      const raw = values ?? {};
      for (const key of Object.keys(definition)) {
        const prop = definition[key];
        const candidate = raw[key];
        if (candidate !== void 0 && prop.validate(candidate)) {
          result[key] = candidate;
        } else if (Object.prototype.hasOwnProperty.call(defaults, key)) {
          result[key] = defaults[key];
        }
      }
      return result;
    }
  };
}
function buildAssert(schema) {
  if (schema.type === "object" && schema.properties) {
    const propAsserts = {};
    for (const key of Object.keys(schema.properties)) {
      propAsserts[key] = buildAssert(schema.properties[key]);
    }
    const required = new Set(schema.required ?? []);
    return (value, path) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw invalidParams(path, "object", value);
      }
      const obj = value;
      for (const key of Object.keys(propAsserts)) {
        const childPath = joinPath(path, key);
        if (obj[key] === void 0) {
          if (required.has(key)) {
            throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Missing required property at '${childPath}'`);
          }
          continue;
        }
        propAsserts[key](obj[key], childPath);
      }
    };
  }
  if (schema.type === "array" && schema.items) {
    const itemAssert = buildAssert(schema.items);
    return (value, path) => {
      if (!Array.isArray(value)) {
        throw invalidParams(path, "array", value);
      }
      for (let i = 0; i < value.length; i++) {
        itemAssert(value[i], `${path}[${i}]`);
      }
    };
  }
  return buildPrimitiveAssert(schema);
}
function buildPrimitiveAssert(schema) {
  const enumDynamic = schema.enumDynamic === true;
  return (value, path) => {
    switch (schema.type) {
      case "string":
        if (typeof value !== "string") {
          throw invalidParams(path, "string", value);
        }
        break;
      case "number":
        if (typeof value !== "number") {
          throw invalidParams(path, "number", value);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw invalidParams(path, "boolean", value);
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          throw invalidParams(path, "array", value);
        }
        break;
      case "object":
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw invalidParams(path, "object", value);
        }
        break;
    }
    if (schema.enum && !enumDynamic && !schema.enum.includes(value)) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Invalid value at '${path || "<root>"}': ${safeStringify(value)} is not one of [${schema.enum.map((v) => JSON.stringify(v)).join(", ")}]`);
    }
  };
}
function invalidParams(path, expected, value) {
  return new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Invalid value at '${path || "<root>"}': expected ${expected}, got ${safeStringify(value)}`);
}
function joinPath(parent, key) {
  return parent ? `${parent}.${key}` : key;
}
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
const permissionsProperty = schemaProperty({
  type: "object",
  title: localize("agentHost.sessionConfig.permissions", "Permissions"),
  description: localize("agentHost.sessionConfig.permissionsDescription", 'Per-tool session permissions. Updated automatically when approving a tool "in this Session".'),
  properties: {
    allow: {
      type: "array",
      title: localize("agentHost.sessionConfig.permissions.allow", "Allowed tools"),
      items: {
        type: "string",
        title: localize("agentHost.sessionConfig.permissions.toolName", "Tool name")
      }
    },
    deny: {
      type: "array",
      title: localize("agentHost.sessionConfig.permissions.deny", "Denied tools"),
      items: {
        type: "string",
        title: localize("agentHost.sessionConfig.permissions.toolName", "Tool name")
      }
    }
  },
  default: { allow: [], deny: [] },
  sessionMutable: true
});
const platformSessionSchema = createSchema({
  [SessionConfigKey.AutoApprove]: schemaProperty({
    type: "string",
    title: localize("agentHost.sessionConfig.autoApprove", "Approvals"),
    description: localize("agentHost.sessionConfig.autoApproveDescription", "Tool approval behavior for this session"),
    enum: ["default", "assisted", "autoApprove"],
    enumLabels: [
      localize("agentHost.sessionConfig.autoApprove.default", "Default permissions"),
      localize("agentHost.sessionConfig.autoApprove.assisted", "Assisted permissions"),
      localize("agentHost.sessionConfig.autoApprove.bypass", "Allow all")
    ],
    enumDescriptions: [
      localize("agentHost.sessionConfig.autoApprove.defaultDescription", "Asks when approval settings don't apply"),
      localize("agentHost.sessionConfig.autoApprove.assistedDescription", "Evaluates risk before running tools"),
      localize("agentHost.sessionConfig.autoApprove.bypassDescription", "Runs tool calls without asking")
    ],
    default: "default",
    sessionMutable: true
  }),
  [SessionConfigKey.Permissions]: permissionsProperty,
  [SessionConfigKey.Mode]: schemaProperty({
    type: "string",
    title: localize("agentHost.sessionConfig.mode", "Agent Mode"),
    description: localize("agentHost.sessionConfig.modeDescription", "How the agent should approach this turn"),
    enum: ["interactive", "plan", "autopilot"],
    enumLabels: [
      localize("agentHost.sessionConfig.mode.interactive", "Interactive"),
      localize("agentHost.sessionConfig.mode.plan", "Plan"),
      localize("agentHost.sessionConfig.mode.autopilot", "Autopilot")
    ],
    enumDescriptions: [
      localize("agentHost.sessionConfig.mode.interactiveDescription", "Step-by-step collaboration"),
      localize("agentHost.sessionConfig.mode.planDescription", "Plan first, execute when ready"),
      localize("agentHost.sessionConfig.mode.autopilotDescription", "Works autonomously within permissions")
    ],
    default: "interactive",
    sessionMutable: true
  })
});
function migrateLegacyAutopilotConfig(config) {
  if (!config || config[SessionConfigKey.AutoApprove] !== "autopilot") {
    return config;
  }
  const migrated = { ...config };
  if (migrated[SessionConfigKey.Mode] !== "plan") {
    migrated[SessionConfigKey.Mode] = "autopilot";
  }
  migrated[SessionConfigKey.AutoApprove] = "default";
  return migrated;
}
const AgentHostTelemetryLevelConfigKey = "telemetryLevel";
const AgentHostEditTelemetryEnabledConfigKey = "editTelemetryEnabled";
const AgentHostDisableRepoInfoTelemetryConfigKey = "disableRepoInfoTelemetry";
const DISABLE_REPO_INFO_TELEMETRY_SETTING_ID = "chat.advanced.debug.disableRepoInfoTelemetry";
const AgentHostSessionSyncEnabledConfigKey = "sessionSyncEnabled";
const AgentHostCodexEnabledConfigKey = "codexAgentEnabled";
const AgentHostTerminalAutoApproveEnabledConfigKey = "terminalAutoApproveEnabled";
const TERMINAL_AUTO_APPROVE_ENABLED_SETTING_ID = "chat.tools.terminal.enableAutoApprove";
const AgentHostGlobalAutoApproveEnabledConfigKey = "globalAutoApproveEnabled";
const AgentHostAutoReplyEnabledConfigKey = "autoReplyEnabled";
const AgentHostAutoReplyAnswer = "The user is not available to answer your question. Choose a pragmatic option best aligned with the context of the request.";
const AgentHostPreferLongContextEnabledConfigKey = "preferLongContextEnabled";
const PREFER_LONG_CONTEXT_SETTING_ID = "github.copilot.chat.preferLongContext.enabled";
const AgentHostSystemProxyEnabledConfigKey = "systemProxyEnabled";
const AgentHostMigrateLegacyCopilotCliEnabledConfigKey = "migrateLegacyCopilotCliEnabled";
const AgentHostCopilotMultiRootEnabledConfigKey = "copilotMultiRootEnabled";
const AgentHostClaudeMultiRootEnabledConfigKey = "claudeMultiRootEnabled";
const AgentHostCodexMultiRootEnabledConfigKey = "codexMultiRootEnabled";
const AgentHostTerminalAutoApproveRulesConfigKey = "terminalAutoApproveRules";
const TERMINAL_AUTO_APPROVE_SETTING_ID = "chat.tools.terminal.autoApprove";
const TERMINAL_IGNORE_DEFAULT_AUTO_APPROVE_RULES_SETTING_ID = "chat.tools.terminal.ignoreDefaultAutoApproveRules";
function getAgentHostTerminalAutoApproveRulesConfig(configurationService) {
  const config = configurationService.getValue(TERMINAL_AUTO_APPROVE_SETTING_ID);
  const configInspectValue = configurationService.inspect(TERMINAL_AUTO_APPROVE_SETTING_ID);
  const ignoreDefaults = configurationService.getValue(TERMINAL_IGNORE_DEFAULT_AUTO_APPROVE_RULES_SETTING_ID) === true;
  return normalizeAgentHostTerminalAutoApproveRulesConfig(config, configInspectValue, ignoreDefaults);
}
function normalizeAgentHostTerminalAutoApproveRulesConfig(config, configInspectValue, ignoreDefaults) {
  if (!config) {
    return {};
  }
  const rules = {};
  for (const [key, value] of Object.entries(config)) {
    if (ignoreDefaults && isDefaultOnlyAutoApproveRule(key, value, configInspectValue)) {
      continue;
    }
    rules[key] = value;
  }
  return rules;
}
function isDefaultOnlyAutoApproveRule(key, value, configInspectValue) {
  const defaultValue = configInspectValue.default?.value;
  const isDefaultRule = hasMatchingRule(defaultValue, key, value);
  if (!isDefaultRule) {
    return false;
  }
  const sourceTarget = getAutoApproveRuleSourceTarget(key, value, configInspectValue);
  return sourceTarget === ConfigurationTarget.DEFAULT;
}
function getAutoApproveRuleSourceTarget(key, value, configInspectValue) {
  if (hasMatchingRule(configInspectValue.workspaceFolderValue, key, value)) {
    return ConfigurationTarget.WORKSPACE_FOLDER;
  }
  if (hasMatchingRule(configInspectValue.workspaceValue, key, value)) {
    return ConfigurationTarget.WORKSPACE;
  }
  if (hasMatchingRule(configInspectValue.userRemoteValue, key, value)) {
    return ConfigurationTarget.USER_REMOTE;
  }
  if (hasMatchingRule(configInspectValue.userLocalValue, key, value)) {
    return ConfigurationTarget.USER_LOCAL;
  }
  if (hasMatchingRule(configInspectValue.userValue, key, value)) {
    return ConfigurationTarget.USER;
  }
  if (hasMatchingRule(configInspectValue.applicationValue, key, value)) {
    return ConfigurationTarget.APPLICATION;
  }
  return ConfigurationTarget.DEFAULT;
}
function hasMatchingRule(config, key, value) {
  return !!config && Object.prototype.hasOwnProperty.call(config, key) && structuralEquals(config[key], value);
}
const AgentHostMcpServersConfigKey = "mcpServers";
function telemetryLevelToAgentHostConfigValue(telemetryLevel) {
  switch (telemetryLevel) {
    case TelemetryLevel.NONE:
      return TelemetryConfiguration.OFF;
    case TelemetryLevel.CRASH:
      return TelemetryConfiguration.CRASH;
    case TelemetryLevel.ERROR:
      return TelemetryConfiguration.ERROR;
    case TelemetryLevel.USAGE:
      return TelemetryConfiguration.ON;
  }
}
function agentHostConfigValueToTelemetryLevel(value) {
  switch (value) {
    case TelemetryConfiguration.OFF:
      return TelemetryLevel.NONE;
    case TelemetryConfiguration.CRASH:
      return TelemetryLevel.CRASH;
    case TelemetryConfiguration.ERROR:
      return TelemetryLevel.ERROR;
    case TelemetryConfiguration.ON:
      return TelemetryLevel.USAGE;
    default:
      return void 0;
  }
}
const mcpServerConfigProperties = {
  type: {
    type: "string",
    title: localize("agentHost.config.mcpServers.type.title", "Server Type"),
    description: localize("agentHost.config.mcpServers.type.description", "The transport used to reach the server: `stdio` for a local command, `http` for a remote endpoint."),
    enum: ["stdio", "http"]
  },
  command: {
    type: "string",
    title: localize("agentHost.config.mcpServers.command.title", "Command"),
    description: localize("agentHost.config.mcpServers.command.description", "For `stdio` servers, the executable to spawn.")
  },
  args: {
    type: "array",
    title: localize("agentHost.config.mcpServers.args.title", "Arguments"),
    description: localize("agentHost.config.mcpServers.args.description", "For `stdio` servers, the arguments passed to the command."),
    items: { type: "string", title: localize("agentHost.config.mcpServers.arg.title", "Argument") }
  },
  env: {
    type: "object",
    title: localize("agentHost.config.mcpServers.env.title", "Environment"),
    description: localize("agentHost.config.mcpServers.env.description", "For `stdio` servers, environment variables set on the spawned process.")
  },
  cwd: {
    type: "string",
    title: localize("agentHost.config.mcpServers.cwd.title", "Working Directory"),
    description: localize("agentHost.config.mcpServers.cwd.description", "For `stdio` servers, the working directory the command runs in.")
  },
  url: {
    type: "string",
    title: localize("agentHost.config.mcpServers.url.title", "URL"),
    description: localize("agentHost.config.mcpServers.url.description", "For `http` servers, the endpoint URL of the MCP server.")
  },
  headers: {
    type: "object",
    title: localize("agentHost.config.mcpServers.headers.title", "Headers"),
    description: localize("agentHost.config.mcpServers.headers.description", "For `http` servers, HTTP headers sent with every request.")
  }
};
const mcpServersValueProperties = {
  "<serverName>": {
    type: "object",
    title: localize("agentHost.config.mcpServers.entry.title", "MCP Server"),
    description: localize("agentHost.config.mcpServers.entry.description", "A single MCP server entry. The property key is the server name."),
    properties: mcpServerConfigProperties
  }
};
const platformRootSchema = createSchema({
  [SessionConfigKey.Permissions]: permissionsProperty,
  [AgentHostDisableRepoInfoTelemetryConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.disableRepoInfoTelemetry.title", "Disable Repository Information Telemetry"),
    description: localize("agentHost.config.disableRepoInfoTelemetry.description", "Whether repository information telemetry is disabled for Agent Host sessions."),
    default: false
  }),
  [AgentHostTelemetryLevelConfigKey]: schemaProperty({
    type: "string",
    title: localize("agentHost.config.telemetryLevel.title", "Telemetry Level"),
    description: localize("agentHost.config.telemetryLevel.description", "Most restrictive telemetry level requested by connected clients."),
    enum: [TelemetryConfiguration.ON, TelemetryConfiguration.ERROR, TelemetryConfiguration.CRASH, TelemetryConfiguration.OFF],
    default: TelemetryConfiguration.ON
  }),
  [AgentHostEditTelemetryEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.editTelemetryEnabled.title", "Edit Telemetry"),
    description: localize("agentHost.config.editTelemetryEnabled.description", "Whether edit attribution telemetry is enabled for Agent Host sessions."),
    default: true
  }),
  [AgentHostSessionSyncEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.sessionSyncEnabled.title", "Session Sync"),
    description: localize("agentHost.config.sessionSyncEnabled.description", "Whether remote session sync is enabled for the copilot-sdk CLI."),
    default: false
  }),
  [AgentHostCodexEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.codexAgentEnabled.title", "Codex Agent"),
    description: localize("agentHost.config.codexAgentEnabled.description", "Whether the Codex provider is enabled."),
    default: false
  }),
  [AgentHostTerminalAutoApproveEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.terminalAutoApproveEnabled.title", "Terminal Auto Approve"),
    description: localize("agentHost.config.terminalAutoApproveEnabled.description", "Whether terminal auto-approve rules forwarded by the connected client are allowed to apply to agent-host shell permission requests."),
    default: true
  }),
  [AgentHostGlobalAutoApproveEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.globalAutoApproveEnabled.title", "Global Auto Approve"),
    description: localize("agentHost.config.globalAutoApproveEnabled.description", "Whether VS Code's global auto-approve setting is enabled. When `true`, every tool call is auto-approved, equivalent to a session using Allow all."),
    default: false
  }),
  [AgentHostAutoReplyEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.autoReplyEnabled.title", "Auto Reply"),
    description: localize("agentHost.config.autoReplyEnabled.description", "Whether VS Code's auto-reply setting is enabled. When `true`, `ask_user` questions are auto-answered instead of blocking on the user, mirroring autopilot mode."),
    default: false
  }),
  [AgentHostPreferLongContextEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.preferLongContextEnabled.title", "Prefer Long Context"),
    description: localize("agentHost.config.preferLongContextEnabled.description", "Whether Copilot Chat's prefer-long-context setting is enabled. When `true` (default), models with a free long context window only show the long context option in the picker. When `false`, the smaller default context option stays selectable."),
    default: true
  }),
  [AgentHostSystemProxyEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.systemProxyEnabled.title", "System Proxy Discovery"),
    description: localize("agentHost.config.systemProxyEnabled.description", "Whether Copilot sessions automatically discover and use the operating system's proxy configuration."),
    default: true
  }),
  [AgentHostMigrateLegacyCopilotCliEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.migrateLegacyCopilotCliEnabled.title", "Migrate Legacy Copilot CLI Sessions"),
    description: localize("agentHost.config.migrateLegacyCopilotCliEnabled.description", "Whether un-adopted extension-host Copilot CLI sessions are surfaced as adoptable agent-host sessions and migrated in place when opened."),
    default: false
  }),
  [AgentHostCopilotMultiRootEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.copilotMultiRootEnabled.title", "Copilot Multiple Working Directories"),
    description: localize("agentHost.config.copilotMultiRootEnabled.description", "Whether the Copilot provider advertises support for multiple working directories, letting a session span every folder of a multi-root workspace."),
    default: false
  }),
  [AgentHostClaudeMultiRootEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.claudeMultiRootEnabled.title", "Claude Multiple Working Directories"),
    description: localize("agentHost.config.claudeMultiRootEnabled.description", "Whether the Claude provider advertises support for multiple working directories, letting a session span every folder of a multi-root workspace."),
    default: false
  }),
  [AgentHostCodexMultiRootEnabledConfigKey]: schemaProperty({
    type: "boolean",
    title: localize("agentHost.config.codexMultiRootEnabled.title", "Codex Multiple Working Directories"),
    description: localize("agentHost.config.codexMultiRootEnabled.description", "Whether the Codex provider advertises support for multiple working directories, letting a session span every folder of a multi-root workspace."),
    default: false
  }),
  [AgentHostTerminalAutoApproveRulesConfigKey]: schemaProperty({
    type: "object",
    title: localize("agentHost.config.terminalAutoApproveRules.title", "Terminal Auto Approve Rules"),
    description: localize("agentHost.config.terminalAutoApproveRules.description", "Terminal auto-approve rules forwarded by the connected client for agent-host shell permission checks."),
    default: {}
  }),
  [AgentHostMcpServersConfigKey]: schemaProperty({
    type: "object",
    title: localize("agentHost.config.mcpServers.title", "MCP Servers"),
    description: localize("agentHost.config.mcpServers.description", "Agent-host-level MCP servers exposed to every session, keyed by server name. Each value is a server configuration (see `<serverName>`)."),
    properties: mcpServersValueProperties,
    default: {}
  })
});
export {
  AgentHostAutoReplyAnswer,
  AgentHostAutoReplyEnabledConfigKey,
  AgentHostClaudeMultiRootEnabledConfigKey,
  AgentHostCodexEnabledConfigKey,
  AgentHostCodexMultiRootEnabledConfigKey,
  AgentHostCopilotMultiRootEnabledConfigKey,
  AgentHostDisableRepoInfoTelemetryConfigKey,
  AgentHostEditTelemetryEnabledConfigKey,
  AgentHostGlobalAutoApproveEnabledConfigKey,
  AgentHostMcpServersConfigKey,
  AgentHostMigrateLegacyCopilotCliEnabledConfigKey,
  AgentHostPreferLongContextEnabledConfigKey,
  AgentHostSessionSyncEnabledConfigKey,
  AgentHostSystemProxyEnabledConfigKey,
  AgentHostTelemetryLevelConfigKey,
  AgentHostTerminalAutoApproveEnabledConfigKey,
  AgentHostTerminalAutoApproveRulesConfigKey,
  DISABLE_REPO_INFO_TELEMETRY_SETTING_ID,
  PREFER_LONG_CONTEXT_SETTING_ID,
  TERMINAL_AUTO_APPROVE_ENABLED_SETTING_ID,
  TERMINAL_AUTO_APPROVE_SETTING_ID,
  TERMINAL_IGNORE_DEFAULT_AUTO_APPROVE_RULES_SETTING_ID,
  agentHostConfigValueToTelemetryLevel,
  createSchema,
  getAgentHostTerminalAutoApproveRulesConfig,
  migrateLegacyAutopilotConfig,
  normalizeAgentHostTerminalAutoApproveRulesConfig,
  platformRootSchema,
  platformSessionSchema,
  schemaProperty,
  telemetryLevelToAgentHostConfigValue
};
