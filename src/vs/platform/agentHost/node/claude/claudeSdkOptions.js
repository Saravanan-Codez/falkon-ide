import { tmpdir } from "os";
import { delimiter, dirname } from "../../../../base/common/path.js";
import { rgDiskPath } from "../../../../base/node/ripgrep.js";
import { AiAgentEnvValue, AiAgentEnvVar } from "../../../chat/common/aiAgentEnv.js";
import { resolveClaudeEffort } from "../../common/claudeModelConfig.js";
import { buildClientToolMcpServer } from "./clientTools/claudeClientToolMcpServer.js";
import { toClaudeSdkModelId } from "./claudeModelSelection.js";
async function buildOptions(input, transport, logStderr) {
  const isProxy = transport.kind === "proxy";
  const subprocessEnv = buildSubprocessEnv(isProxy);
  const telemetryEnv = buildClaudeTelemetryEnv(input.telemetry, input.traceContext);
  Object.assign(subprocessEnv, telemetryEnv);
  const resolvedRgDiskPath = await rgDiskPath();
  const settingsEnv = {
    ...telemetryEnv,
    // Proxied (Copilot-routed) mode points the SDK at the local proxy on a
    // per-session bearer. Native (BYO-Anthropic) mode omits both so the SDK
    // uses its own credential resolution from the subprocess env
    // (`ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude
    // setup-token` — both forwarded by `buildSubprocessEnv`).
    ...transport.kind === "proxy" ? {
      ANTHROPIC_BASE_URL: transport.handle.baseUrl,
      ANTHROPIC_AUTH_TOKEN: `${transport.handle.nonce}.${input.sessionId}`
    } : {},
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    USE_BUILTIN_RIPGREP: "0",
    // Attribute the CLI's tool subprocesses (`gh`, …) to VS Code.
    // `settings.env` is what the CLI layers onto the commands it runs, so it
    // needs the marker in addition to the spawn env below. Note the CLI
    // re-stamps `AI_AGENT` as `claude-code_<version>_agent` for its own Bash
    // tool, so commands from that tool are not attributed to VS Code.
    [AiAgentEnvVar]: AiAgentEnvValue,
    PATH: `${dirname(resolvedRgDiskPath)}${delimiter}${process.env.PATH ?? ""}`
  };
  return {
    cwd: input.workingDirectory.fsPath,
    ...input.additionalDirectories && input.additionalDirectories.length > 0 ? { additionalDirectories: input.additionalDirectories.map((d) => d.fsPath) } : {},
    executable: process.execPath,
    env: subprocessEnv,
    abortController: input.abortController,
    allowDangerouslySkipPermissions: true,
    canUseTool: input.canUseTool,
    onElicitation: input.onElicitation,
    disallowedTools: ["WebSearch"],
    includePartialMessages: true,
    forwardSubagentText: true,
    enableFileCheckpointing: true,
    model: toClaudeSdkModelId(input.model),
    effort: resolveClaudeEffort(input.model),
    permissionMode: input.permissionMode,
    ...input.isResume ? { resume: input.sessionId, ...input.resumeSessionAt ? { resumeSessionAt: input.resumeSessionAt } : {} } : { sessionId: input.sessionId },
    ...input.mcpServers ? { mcpServers: input.mcpServers } : {},
    ...input.allowedTools && input.allowedTools.length > 0 ? { allowedTools: [...input.allowedTools] } : {},
    ...input.plugins && input.plugins.length > 0 ? { plugins: input.plugins.map((p) => ({ type: "local", path: p.fsPath })) } : {},
    ...input.agent ? { agent: input.agent } : {},
    settingSources: ["user", "project", "local"],
    settings: { env: settingsEnv },
    systemPrompt: { type: "preset", preset: "claude_code" },
    stderr: logStderr
  };
}
async function buildClientMcpServers(toolDiff, registry, sdkService) {
  const tools = toolDiff.consume();
  if (tools.length === 0) {
    return void 0;
  }
  const server = await buildClientToolMcpServer(tools, (id) => registry.register(id), sdkService);
  return { client: server };
}
function buildModelEnumerationOptions() {
  return {
    cwd: tmpdir(),
    executable: process.execPath,
    env: buildSubprocessEnv(false),
    abortController: new AbortController(),
    systemPrompt: { type: "preset", preset: "claude_code" },
    settings: {
      env: {
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
      }
    }
  };
}
function buildClaudeTelemetryEnv(config, traceContext) {
  if (!config) {
    return {};
  }
  const env = {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_SERVICE_NAME: "claude-code",
    OTEL_RESOURCE_ATTRIBUTES: serializeResourceAttributes(config.resourceAttributes),
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: config.traces ? "1" : "0",
    OTEL_TRACES_EXPORTER: config.traces ? "otlp" : "none",
    OTEL_LOGS_EXPORTER: config.external ? "otlp" : "none",
    OTEL_METRICS_EXPORTER: config.external ? "otlp" : "none",
    OTEL_LOG_USER_PROMPTS: config.captureContent ? "1" : "0",
    OTEL_LOG_ASSISTANT_RESPONSES: config.captureContent ? "1" : "0",
    OTEL_LOG_TOOL_DETAILS: config.captureContent ? "1" : "0",
    OTEL_LOG_TOOL_CONTENT: config.captureContent ? "1" : "0"
  };
  if (config.traces) {
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = config.traces.endpoint;
    env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL = config.traces.protocol;
  }
  if (config.external) {
    env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = resolveSignalEndpoint(config.external.endpoint, "logs", config.external.protocol);
    env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL = config.external.protocol;
    env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = resolveSignalEndpoint(config.external.endpoint, "metrics", config.external.protocol);
    env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL = config.external.protocol;
    if (config.external.headers && Object.keys(config.external.headers).length > 0) {
      env.OTEL_EXPORTER_OTLP_HEADERS = Object.entries(config.external.headers).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join(",");
    }
  }
  if (traceContext) {
    env.TRACEPARENT = traceContext.traceparent;
    if (traceContext.tracestate) {
      env.TRACESTATE = traceContext.tracestate;
    }
  }
  return env;
}
function serializeResourceAttributes(attributes) {
  return Object.entries(attributes).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join(",");
}
function resolveSignalEndpoint(endpoint, signal, protocol) {
  if (protocol === "grpc") {
    return endpoint;
  }
  try {
    const url = new URL(endpoint);
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = `/v1/${signal}`;
    } else if (url.pathname.endsWith("/v1/traces")) {
      url.pathname = `${url.pathname.slice(0, -"/v1/traces".length)}/v1/${signal}`;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return endpoint;
  }
}
function buildSubprocessEnv(proxied = true) {
  const env = proxied ? {
    ELECTRON_RUN_AS_NODE: "1",
    NODE_OPTIONS: void 0,
    ANTHROPIC_API_KEY: void 0,
    HOME: process.env["HOME"],
    USERPROFILE: process.env["USERPROFILE"],
    // Load rules from additional directories https://code.claude.com/docs/en/memory#load-from-additional-directories
    CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1"
  } : { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: void 0 };
  env[AiAgentEnvVar] = AiAgentEnvValue;
  for (const key of Object.keys(process.env)) {
    if (key === "ELECTRON_RUN_AS_NODE") {
      continue;
    }
    if (key.startsWith("VSCODE_") || key.startsWith("ELECTRON_")) {
      env[key] = void 0;
    }
  }
  return env;
}
export {
  buildClaudeTelemetryEnv,
  buildClientMcpServers,
  buildModelEnumerationOptions,
  buildOptions,
  buildSubprocessEnv
};
