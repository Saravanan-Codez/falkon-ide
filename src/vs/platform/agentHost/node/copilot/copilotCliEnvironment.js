import { AiAgentEnvValue, AiAgentEnvVar } from "../../../chat/common/aiAgentEnv.js";
function createCopilotCliEnvironment(environment = process.env) {
  const env = Object.assign({}, environment, { ELECTRON_RUN_AS_NODE: "1" });
  delete env["NODE_OPTIONS"];
  delete env["VSCODE_INSPECTOR_OPTIONS"];
  delete env["VSCODE_ESM_ENTRYPOINT"];
  delete env["VSCODE_HANDLES_UNCAUGHT_ERRORS"];
  for (const key of Object.keys(env)) {
    if (key === "ELECTRON_RUN_AS_NODE" || key === "VSCODE_AGENT_HOST_CAPI_URL_OVERRIDE") {
      continue;
    }
    if (key.startsWith("VSCODE_") || key.startsWith("ELECTRON_")) {
      delete env[key];
    }
  }
  env["COPILOT_CLI_RUN_AS_NODE"] = "1";
  env["USE_BUILTIN_RIPGREP"] = "false";
  env["COPILOT_MCP_APPS"] = "true";
  env[AiAgentEnvVar] = AiAgentEnvValue;
  env["AUTO_APPROVAL"] = "true";
  return env;
}
export {
  createCopilotCliEnvironment
};
