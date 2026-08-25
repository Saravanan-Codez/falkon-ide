var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { AgentHostConfigKey, agentHostCustomizationConfigSchema } from "../common/agentHostCustomizationConfig.js";
import { deriveGitHubEndpoints, gitHubCopilotResource, gitHubRepoResource } from "../common/githubEndpoints.js";
import { IAgentConfigurationService } from "./agentConfigurationService.js";
const IAgentHostGitHubEndpointService = createDecorator("agentHostGitHubEndpointService");
let AgentHostGitHubEndpointService = class extends Disposable {
  constructor(_configurationService, _logService) {
    super();
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    const resolved = this._resolve();
    this._endpoints = resolved.endpoints;
    this._enterpriseUri = resolved.enterpriseUri;
    this._register(this._configurationService.onDidRootConfigChange(() => {
      const next = this._resolve();
      if (next.endpoints.apiBaseUri === this._endpoints.apiBaseUri && next.endpoints.graphQlUri === this._endpoints.graphQlUri && next.endpoints.oauthServer === this._endpoints.oauthServer) {
        return;
      }
      this._logService.info(`[AgentHost] GitHub endpoints changed (api=${next.endpoints.apiBaseUri})`);
      this._endpoints = next.endpoints;
      this._enterpriseUri = next.enterpriseUri;
      this._onDidChange.fire();
    }));
  }
  _resolve() {
    const enterpriseUri = this._configurationService.getRootValue(agentHostCustomizationConfigSchema, AgentHostConfigKey.GithubEnterpriseUri);
    return { endpoints: deriveGitHubEndpoints(enterpriseUri), enterpriseUri: enterpriseUri || void 0 };
  }
  getApiBaseUri() {
    return this._endpoints.apiBaseUri;
  }
  getGraphQlUri() {
    return this._endpoints.graphQlUri;
  }
  getEnterpriseHost() {
    return this._endpoints.enterpriseHost;
  }
  getEnterpriseUri() {
    return this._enterpriseUri;
  }
  getCopilotResource() {
    return gitHubCopilotResource(this._endpoints);
  }
  getRepoResource() {
    return gitHubRepoResource(this._endpoints);
  }
};
AgentHostGitHubEndpointService = __decorateClass([
  __decorateParam(0, IAgentConfigurationService),
  __decorateParam(1, ILogService)
], AgentHostGitHubEndpointService);
export {
  AgentHostGitHubEndpointService,
  IAgentHostGitHubEndpointService
};
