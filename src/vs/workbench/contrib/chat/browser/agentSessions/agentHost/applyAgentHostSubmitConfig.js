import { applyAgentHostCompletionAction } from "../../agentHostCompletionAction.js";
import { applyAgentHostSessionConfigChange } from "./applyAgentHostSessionConfig.js";
async function applyAgentHostSubmitConfig(sessionResource, config, services) {
  let applied = false;
  const confirmed = await applyAgentHostCompletionAction({ applyConfig: config }, services.dialogService, services.storageService, async (config2) => {
    applied = await applyAgentHostSessionConfigChange(sessionResource, config2, services);
  });
  return confirmed && applied;
}
export {
  applyAgentHostSubmitConfig
};
