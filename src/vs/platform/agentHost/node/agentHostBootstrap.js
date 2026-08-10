import { joinPath } from "../../../base/common/resources.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { ConfigurationService } from "../../configuration/common/configurationService.js";
import { IPolicyService, NullPolicyService } from "../../policy/common/policy.js";
import { IRequestService } from "../../request/common/request.js";
import { AgentHostProxyResolver, IAgentHostProxyResolver } from "./agentHostProxyResolver.js";
import { AgentHostRequestService } from "./agentHostRequestService.js";
async function registerAgentHostNetworkServices(diServices, fileService, environmentService, logService, disposables) {
  const policyService = new NullPolicyService();
  diServices.set(IPolicyService, policyService);
  const settingsResource = joinPath(environmentService.appSettingsHome, "settings.json");
  const configurationService = disposables.add(new ConfigurationService(settingsResource, fileService, policyService, logService));
  await configurationService.initialize();
  diServices.set(IConfigurationService, configurationService);
  const proxyResolver = new AgentHostProxyResolver(configurationService, logService);
  diServices.set(IAgentHostProxyResolver, proxyResolver);
  const requestService = disposables.add(new AgentHostRequestService(configurationService, environmentService, logService, proxyResolver));
  diServices.set(IRequestService, requestService);
  return { proxyResolver, requestService };
}
export {
  registerAgentHostNetworkServices
};
