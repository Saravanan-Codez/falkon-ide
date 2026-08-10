import { truncate } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { buildSubagentChatUri, parseRequiredSessionUriFromChatUri } from "./state/sessionState.js";
var AgentHostIpcChannels = /* @__PURE__ */ ((AgentHostIpcChannels2) => {
  AgentHostIpcChannels2["AgentHost"] = "agentHost";
  AgentHostIpcChannels2["Logger"] = "agentHostLogger";
  AgentHostIpcChannels2["ConnectionTracker"] = "agentHostConnectionTracker";
  AgentHostIpcChannels2["Protocol"] = "agentHostProtocol";
  AgentHostIpcChannels2["Management"] = "agentHostManagement";
  AgentHostIpcChannels2["RemoteProxy"] = "agentHostProxy";
  return AgentHostIpcChannels2;
})(AgentHostIpcChannels || {});
const AgentHostAhpJsonlLoggingSettingId = "chat.agentHost.ahpJsonlLoggingEnabled";
const AgentHostSystemProxyEnabledSettingId = "chat.agentHost.systemProxy.enabled";
const AgentHostCopilotMultiRootEnabledSettingId = "chat.agentHost.copilotAgent.multiRootEnabled";
const AgentHostClaudeMultiRootEnabledSettingId = "chat.agentHost.claudeAgent.multiRootEnabled";
const AgentHostCodexMultiRootEnabledSettingId = "chat.agentHost.codexAgent.multiRootEnabled";
const AgentHostAllowSignedOutWhenUsableSettingId = "chat.agentHost.allowSignedOutWhenUsable";
const AgentHostClaudeAgentEnabledSettingId = "chat.agentHost.claudeAgent.enabled";
const AgentHostCodexAgentEnabledSettingId = "chat.agentHost.codexAgent.enabled";
const AgentHostByokModelsEnabledSettingId = "chat.agentHost.byokModels.enabled";
const AgentHostClaudeSdkRootEnvVar = "VSCODE_AGENT_HOST_CLAUDE_SDK_ROOT";
const AgentHostClaudeAgentEnabledEnvVar = "VSCODE_AGENT_HOST_CLAUDE_AGENT_ENABLED";
const AgentHostCodexAgentEnabledEnvVar = "VSCODE_AGENT_HOST_CODEX_AGENT_ENABLED";
const AgentHostByokModelsEnabledEnvVar = "VSCODE_AGENT_HOST_BYOK_MODELS_ENABLED";
const AgentHostSessionReleaseGraceMsEnvVar = "VSCODE_AGENT_HOST_SESSION_RELEASE_GRACE_MS";
function isAgentEnabled(envValue, defaultEnabled) {
  if (envValue === void 0 || envValue === "") {
    return defaultEnabled;
  }
  const normalized = envValue.trim().toLowerCase();
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  return defaultEnabled;
}
const AgentHostSdkSandboxEnabledSettingId = "chat.agentHost.sdkSandbox.enabled";
const CodexPreferAgentHostEditorSettingId = "chat.editor.codex.preferAgentHost";
function affectsAgentHostProviderPreference(event, isSessionsWindow) {
  return event.affectsConfiguration(isSessionsWindow ? AgentHostCodexAgentEnabledSettingId : CodexPreferAgentHostEditorSettingId);
}
function shouldSurfaceLocalAgentHostProvider(provider, configurationService, isSessionsWindow) {
  switch (provider) {
    case CLAUDE_AGENT_PROVIDER_ID:
      return true;
    case CODEX_AGENT_PROVIDER_ID:
      return configurationService.getValue(isSessionsWindow ? AgentHostCodexAgentEnabledSettingId : CodexPreferAgentHostEditorSettingId) === true;
    default:
      return true;
  }
}
const AgentHostCodexAgentSdkRootSettingId = "chat.agentHost.codexAgent.sdkRoot";
const AgentHostCodexAgentCodexHomeSettingId = "chat.agentHost.codexAgent.codexHome";
const AgentHostCodexAgentBinaryArgsSettingId = "chat.agentHost.codexAgent.binaryArgs";
const AgentHostCodexAgentSdkRootEnvVar = "VSCODE_AGENT_HOST_CODEX_SDK_ROOT";
const AgentHostCodexAgentCodexHomeEnvVar = "CODEX_HOME";
const AgentHostCodexAgentBinaryArgsEnvVar = "VSCODE_AGENT_HOST_CODEX_APP_SERVER_ARGS";
const AgentHostOTelEnabledSettingId = "chat.agentHost.otel.enabled";
const AgentHostOTelExporterTypeSettingId = "chat.agentHost.otel.exporterType";
const AgentHostOTelOtlpProtocolSettingId = "chat.agentHost.otel.otlpProtocol";
const AgentHostOTelOtlpEndpointSettingId = "chat.agentHost.otel.otlpEndpoint";
const AgentHostOTelCaptureContentSettingId = "chat.agentHost.otel.captureContent";
const AgentHostOTelOutfileSettingId = "chat.agentHost.otel.outfile";
const AgentHostOTelServiceNameSettingId = "chat.agentHost.otel.serviceName";
const AgentHostOTelResourceAttributesSettingId = "chat.agentHost.otel.resourceAttributes";
const AgentHostOTelDbSpanExporterEnabledSettingId = "chat.agentHost.otel.dbSpanExporter.enabled";
const AgentHostOTelSpansDbSubPath = "agent-host/otel/agent-host-traces.db";
const AgentHostOTelEnvVars = Object.freeze({
  Enabled: "COPILOT_OTEL_ENABLED",
  ExporterType: "COPILOT_OTEL_EXPORTER_TYPE",
  OtlpEndpoint: "OTEL_EXPORTER_OTLP_ENDPOINT",
  OtlpEndpointAlt: "COPILOT_OTEL_ENDPOINT",
  OtlpProtocol: "OTEL_EXPORTER_OTLP_PROTOCOL",
  OtlpTracesProtocol: "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL",
  OtlpMetricsProtocol: "OTEL_EXPORTER_OTLP_METRICS_PROTOCOL",
  OtlpHeaders: "OTEL_EXPORTER_OTLP_HEADERS",
  CaptureContent: "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT",
  FilePath: "COPILOT_OTEL_FILE_EXPORTER_PATH",
  SourceName: "COPILOT_OTEL_SOURCE_NAME",
  ServiceName: "OTEL_SERVICE_NAME",
  ResourceAttributes: "OTEL_RESOURCE_ATTRIBUTES",
  DbSpanExporterEnabled: "COPILOT_OTEL_DB_SPAN_EXPORTER_ENABLED"
});
const AgentHostOTelPolicyIpcChannel = "vscode:agentHostOTelPolicy";
const AgentHostRestartIpcChannel = "vscode:restartAgentHost";
const AgentHostWillRestartIpcChannel = "vscode:agentHostWillRestart";
function readAgentHostOTelPolicySettings(configurationService) {
  const policyValue = (key) => configurationService.inspect(key).policyValue;
  return {
    enabled: policyValue(AgentHostOTelEnabledSettingId),
    exporterType: policyValue(AgentHostOTelExporterTypeSettingId),
    otlpProtocol: policyValue(AgentHostOTelOtlpProtocolSettingId),
    otlpEndpoint: policyValue(AgentHostOTelOtlpEndpointSettingId),
    captureContent: policyValue(AgentHostOTelCaptureContentSettingId),
    outfile: policyValue(AgentHostOTelOutfileSettingId),
    serviceName: policyValue(AgentHostOTelServiceNameSettingId),
    resourceAttributes: policyValue(AgentHostOTelResourceAttributesSettingId)
  };
}
function sanitizeAgentHostOTelPolicySettings(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const record = raw;
  const asString = (value) => typeof value === "string" ? value : void 0;
  const asBoolean = (value) => typeof value === "boolean" ? value : void 0;
  const asStringRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return void 0;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        continue;
      }
      if (typeof v === "string") {
        out[k] = v;
      }
    }
    return out;
  };
  return {
    enabled: asBoolean(record.enabled),
    exporterType: asString(record.exporterType),
    otlpProtocol: asString(record.otlpProtocol),
    otlpEndpoint: asString(record.otlpEndpoint),
    captureContent: asBoolean(record.captureContent),
    outfile: asString(record.outfile),
    serviceName: asString(record.serviceName),
    resourceAttributes: asStringRecord(record.resourceAttributes)
  };
}
function serializeResourceAttributes(attributes) {
  if (!attributes) {
    return void 0;
  }
  const parts = Object.entries(attributes).filter(([key, value]) => key !== "" && typeof value === "string").map(([key, value]) => `${key}=${value}`);
  return parts.length > 0 ? parts.join(",") : void 0;
}
function buildAgentHostOTelEnv(settings, inheritedEnv, policySettings = {}) {
  const out = {};
  const setIfMissing = (key, value) => {
    if (value === void 0 || value === "" || inheritedEnv[key] !== void 0) {
      return;
    }
    out[key] = value;
  };
  const setPolicy = (key, value) => {
    if (value !== void 0) {
      out[key] = value;
    }
  };
  if (settings.enabled) {
    setIfMissing(AgentHostOTelEnvVars.Enabled, "true");
  }
  setIfMissing(AgentHostOTelEnvVars.ExporterType, settings.exporterType);
  setIfMissing(AgentHostOTelEnvVars.OtlpEndpoint, settings.otlpEndpoint);
  setIfMissing(AgentHostOTelEnvVars.ServiceName, settings.serviceName);
  setIfMissing(AgentHostOTelEnvVars.ResourceAttributes, serializeResourceAttributes(settings.resourceAttributes));
  setIfMissing(AgentHostOTelEnvVars.FilePath, settings.outfile);
  if (settings.captureContent !== void 0) {
    setIfMissing(AgentHostOTelEnvVars.CaptureContent, settings.captureContent ? "true" : "false");
  }
  if (settings.dbSpanExporterEnabled) {
    setIfMissing(AgentHostOTelEnvVars.DbSpanExporterEnabled, "true");
  }
  if (policySettings.enabled !== void 0) {
    setPolicy(AgentHostOTelEnvVars.Enabled, policySettings.enabled ? "true" : "false");
    if (!policySettings.enabled) {
      setPolicy(AgentHostOTelEnvVars.OtlpEndpoint, "");
      setPolicy(AgentHostOTelEnvVars.OtlpEndpointAlt, "");
      setPolicy(AgentHostOTelEnvVars.FilePath, "");
    }
  }
  if (policySettings.exporterType !== void 0) {
    setPolicy(AgentHostOTelEnvVars.ExporterType, policySettings.exporterType);
    setPolicy(AgentHostOTelEnvVars.FilePath, "");
  }
  if (policySettings.otlpProtocol !== void 0 && policySettings.otlpProtocol !== "") {
    setPolicy(AgentHostOTelEnvVars.OtlpProtocol, policySettings.otlpProtocol);
    setPolicy(AgentHostOTelEnvVars.OtlpTracesProtocol, policySettings.otlpProtocol);
    setPolicy(AgentHostOTelEnvVars.OtlpMetricsProtocol, policySettings.otlpProtocol);
  }
  if (policySettings.otlpEndpoint !== void 0) {
    setPolicy(AgentHostOTelEnvVars.OtlpEndpoint, policySettings.otlpEndpoint);
    setPolicy(AgentHostOTelEnvVars.FilePath, "");
  }
  if (policySettings.outfile !== void 0) {
    setPolicy(AgentHostOTelEnvVars.FilePath, policySettings.outfile);
  }
  if (policySettings.captureContent !== void 0) {
    setPolicy(AgentHostOTelEnvVars.CaptureContent, policySettings.captureContent ? "true" : "false");
  }
  if (policySettings.serviceName !== void 0 && policySettings.serviceName !== "") {
    setPolicy(AgentHostOTelEnvVars.ServiceName, policySettings.serviceName);
  }
  const policyResourceAttributes = serializeResourceAttributes(policySettings.resourceAttributes);
  if (policyResourceAttributes !== void 0) {
    setPolicy(AgentHostOTelEnvVars.ResourceAttributes, policyResourceAttributes);
  }
  return out;
}
function buildAgentSdkEnv(settings, inheritedEnv) {
  const out = {};
  const setIfMissing = (key, value) => {
    if (value === void 0 || value === "" || inheritedEnv[key] !== void 0) {
      return;
    }
    out[key] = value;
  };
  setIfMissing(AgentHostCodexAgentSdkRootEnvVar, settings.codexSdkRoot);
  setIfMissing(AgentHostCodexAgentCodexHomeEnvVar, settings.codexHome);
  if (Array.isArray(settings.codexBinaryArgs) && settings.codexBinaryArgs.length > 0) {
    setIfMissing(AgentHostCodexAgentBinaryArgsEnvVar, JSON.stringify(settings.codexBinaryArgs));
  }
  if (settings.claudeAgentEnabled !== void 0) {
    setIfMissing(AgentHostClaudeAgentEnabledEnvVar, settings.claudeAgentEnabled ? "true" : "false");
  }
  if (settings.codexAgentEnabled !== void 0) {
    setIfMissing(AgentHostCodexAgentEnabledEnvVar, settings.codexAgentEnabled ? "true" : "false");
  }
  if (settings.byokModelsEnabled !== void 0) {
    setIfMissing(AgentHostByokModelsEnabledEnvVar, settings.byokModelsEnabled ? "true" : "false");
  }
  return out;
}
const CLAUDE_AGENT_PROVIDER_ID = "claude";
const CODEX_AGENT_PROVIDER_ID = "codex";
const GITHUB_COPILOT_PROTECTED_RESOURCE = {
  resource: "https://api.github.com",
  resource_name: "GitHub Copilot",
  authorization_servers: ["https://github.com/login/oauth"],
  scopes_supported: ["read:user", "user:email"],
  required: true
};
const GITHUB_REPO_PROTECTED_RESOURCE = {
  resource: "https://api.github.com/repos",
  resource_name: "GitHub Repository",
  authorization_servers: ["https://github.com/login/oauth"],
  scopes_supported: ["repo"],
  required: false
};
function protectedResourcesRequireGitHubCopilotSignIn(resources) {
  return resources.some((resource) => resource.resource === GITHUB_COPILOT_PROTECTED_RESOURCE.resource && resource.required !== false);
}
const SUBAGENT_CHAT_TITLE_MAX_LENGTH = 60;
function subagentChatTitle(taskDescription, agentDisplayName) {
  const task = taskDescription?.trim();
  if (task) {
    return truncate(task, SUBAGENT_CHAT_TITLE_MAX_LENGTH);
  }
  return agentDisplayName?.trim() || "Subagent";
}
var SubagentChatSignal;
((SubagentChatSignal2) => {
  function toSpawnEvent(signal) {
    if (signal.kind !== "subagent_started") {
      return void 0;
    }
    let session;
    try {
      session = parseRequiredSessionUriFromChatUri(signal.chat);
    } catch {
      return void 0;
    }
    return {
      session: URI.parse(session),
      chat: URI.parse(buildSubagentChatUri(session, signal.toolCallId)),
      parent: { chat: signal.chat, toolCallId: signal.toolCallId },
      // Prefer the concise per-task description so two subagents of the same
      // type still get distinct, meaningful tab names; fall back to the agent
      // type's display name. Truncate so an over-long description never blows
      // out the tab strip or the Subagents dropdown.
      title: subagentChatTitle(signal.taskDescription, signal.agentDisplayName)
    };
  }
  SubagentChatSignal2.toSpawnEvent = toSpawnEvent;
})(SubagentChatSignal || (SubagentChatSignal = {}));
var AgentSession;
((AgentSession2) => {
  function uri(provider2, rawSessionId) {
    return URI.from({ scheme: provider2, path: `/${rawSessionId}` });
  }
  AgentSession2.uri = uri;
  function id(session) {
    const parsed = typeof session === "string" ? URI.parse(session) : session;
    return parsed.path.substring(1);
  }
  AgentSession2.id = id;
  function provider(session) {
    const parsed = typeof session === "string" ? URI.parse(session) : session;
    return parsed.scheme || void 0;
  }
  AgentSession2.provider = provider;
})(AgentSession || (AgentSession = {}));
const IAgentService = createDecorator("agentService");
const IAgentHostService = createDecorator("agentHostService");
export {
  AgentHostAhpJsonlLoggingSettingId,
  AgentHostAllowSignedOutWhenUsableSettingId,
  AgentHostByokModelsEnabledEnvVar,
  AgentHostByokModelsEnabledSettingId,
  AgentHostClaudeAgentEnabledEnvVar,
  AgentHostClaudeAgentEnabledSettingId,
  AgentHostClaudeMultiRootEnabledSettingId,
  AgentHostClaudeSdkRootEnvVar,
  AgentHostCodexAgentBinaryArgsEnvVar,
  AgentHostCodexAgentBinaryArgsSettingId,
  AgentHostCodexAgentCodexHomeEnvVar,
  AgentHostCodexAgentCodexHomeSettingId,
  AgentHostCodexAgentEnabledEnvVar,
  AgentHostCodexAgentEnabledSettingId,
  AgentHostCodexAgentSdkRootEnvVar,
  AgentHostCodexAgentSdkRootSettingId,
  AgentHostCodexMultiRootEnabledSettingId,
  AgentHostCopilotMultiRootEnabledSettingId,
  AgentHostIpcChannels,
  AgentHostOTelCaptureContentSettingId,
  AgentHostOTelDbSpanExporterEnabledSettingId,
  AgentHostOTelEnabledSettingId,
  AgentHostOTelEnvVars,
  AgentHostOTelExporterTypeSettingId,
  AgentHostOTelOtlpEndpointSettingId,
  AgentHostOTelOtlpProtocolSettingId,
  AgentHostOTelOutfileSettingId,
  AgentHostOTelPolicyIpcChannel,
  AgentHostOTelResourceAttributesSettingId,
  AgentHostOTelServiceNameSettingId,
  AgentHostOTelSpansDbSubPath,
  AgentHostRestartIpcChannel,
  AgentHostSdkSandboxEnabledSettingId,
  AgentHostSessionReleaseGraceMsEnvVar,
  AgentHostSystemProxyEnabledSettingId,
  AgentHostWillRestartIpcChannel,
  AgentSession,
  CLAUDE_AGENT_PROVIDER_ID,
  CODEX_AGENT_PROVIDER_ID,
  CodexPreferAgentHostEditorSettingId,
  GITHUB_COPILOT_PROTECTED_RESOURCE,
  GITHUB_REPO_PROTECTED_RESOURCE,
  IAgentHostService,
  IAgentService,
  SubagentChatSignal,
  affectsAgentHostProviderPreference,
  buildAgentHostOTelEnv,
  buildAgentSdkEnv,
  isAgentEnabled,
  protectedResourcesRequireGitHubCopilotSignIn,
  readAgentHostOTelPolicySettings,
  sanitizeAgentHostOTelPolicySettings,
  shouldSurfaceLocalAgentHostProvider,
  subagentChatTitle
};
