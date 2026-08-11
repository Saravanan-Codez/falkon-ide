import { AiAgentEnvValue, AiAgentEnvVar } from "../../../chat/common/aiAgentEnv.js";
function buildCodexResumeParams(modelProvider, threadId, mcpServers, workingDirectories, configOverrides = {}, developerInstructions) {
  const config = {
    ...configOverrides,
    ...Object.keys(mcpServers).length > 0 ? { mcp_servers: mcpServers } : {}
  };
  return {
    threadId,
    modelProvider,
    ...workingDirectories?.length ? {
      cwd: workingDirectories[0],
      runtimeWorkspaceRoots: [...workingDirectories]
    } : {},
    ...Object.keys(config).length > 0 ? { config } : {},
    ...developerInstructions ? { developerInstructions } : {}
  };
}
function buildCodexLaunchConfig(inheritedEnv, proxy, extraArgs, telemetry) {
  const env = { ...inheritedEnv, [AiAgentEnvVar]: AiAgentEnvValue };
  if (telemetry) {
    delete env.OTEL_SERVICE_NAME;
    env.OTEL_RESOURCE_ATTRIBUTES = serializeResourceAttributes(telemetry.resourceAttributes);
  }
  env.OPENAI_API_KEY = proxy.nonce;
  const overrides = [
    `model_providers.vscode-proxy.name="VS Code Proxy"`,
    `model_providers.vscode-proxy.base_url="${proxy.baseUrl}/v1"`,
    `model_providers.vscode-proxy.wire_api="responses"`,
    `model_providers.vscode-proxy.env_key="OPENAI_API_KEY"`,
    `model_providers.vscode-proxy.requires_openai_auth=false`,
    `model_providers.vscode-proxy.supports_websockets=false`,
    // Codex filters its shell tool's env through `shell_environment_policy`,
    // so pin the marker there too — a user policy (e.g. `inherit = "core"`)
    // would otherwise drop it.
    `shell_environment_policy.set.${AiAgentEnvVar}="${AiAgentEnvValue}"`,
    `features.tool_call_mcp_elicitation=false`,
    `features.image_generation=false`,
    ...codexTelemetryOverrides(telemetry)
  ];
  return {
    env,
    args: ["app-server", ...overrides.flatMap((value) => ["-c", value]), ...extraArgs]
  };
}
function codexTelemetryOverrides(config) {
  if (!config) {
    return [];
  }
  return [
    `otel.log_user_prompt=${config.captureContent}`,
    config.traces ? `otel.trace_exporter=${codexExporter(config.traces)}` : 'otel.trace_exporter="none"',
    config.external ? `otel.exporter=${codexExporter({ ...config.external, endpoint: resolveSignalEndpoint(config.external.endpoint, "logs", config.external.protocol) })}` : 'otel.exporter="none"',
    config.external ? `otel.metrics_exporter=${codexExporter({ ...config.external, endpoint: resolveSignalEndpoint(config.external.endpoint, "metrics", config.external.protocol) })}` : 'otel.metrics_exporter="none"'
  ];
}
function codexExporter(config) {
  const headers = config.headers && Object.keys(config.headers).length > 0 ? `, headers = { ${Object.entries(config.headers).map(([key, value]) => `${JSON.stringify(key)} = ${JSON.stringify(value)}`).join(", ")} }` : "";
  if (config.protocol === "grpc") {
    return `{ otlp-grpc = { endpoint = ${JSON.stringify(config.endpoint)}${headers} } }`;
  }
  const protocol = config.protocol === "http/json" ? "json" : "binary";
  return `{ otlp-http = { endpoint = ${JSON.stringify(config.endpoint)}, protocol = ${JSON.stringify(protocol)}${headers} } }`;
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
export {
  buildCodexLaunchConfig,
  buildCodexResumeParams,
  codexTelemetryOverrides
};
