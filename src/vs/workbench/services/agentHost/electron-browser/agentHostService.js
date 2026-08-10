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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IAgentHostService } from "../../../../platform/agentHost/common/agentService.js";
import { LocalAgentHostServiceClient } from "../../../../platform/agentHost/electron-browser/localAgentHostService.js";
import { IAgentHostEnablementService } from "../../../../platform/agentHost/common/agentHostEnablementService.js";
import { agentsWindowAgentHostClientInfo, editorWindowAgentHostClientInfo } from "../../../../platform/agentHost/common/agentHostClientInfo.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { EditorRemoteAgentHostServiceClient } from "../browser/editorRemoteAgentHostServiceClient.js";
let WorkbenchAgentHostService = class {
  constructor(instantiationService, environmentService) {
    const inner = environmentService.remoteAuthority ? instantiationService.createInstance(EditorRemoteAgentHostServiceClient) : instantiationService.createInstance(
      LocalAgentHostServiceClient,
      environmentService.isSessionsWindow ? agentsWindowAgentHostClientInfo : editorWindowAgentHostClientInfo
    );
    return inner;
  }
};
WorkbenchAgentHostService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchEnvironmentService)
], WorkbenchAgentHostService);
let AgentHostPrewarmer = class {
  constructor(agentHostService) {
    agentHostService.startAgentHost();
  }
};
AgentHostPrewarmer = __decorateClass([
  __decorateParam(0, IAgentHostService)
], AgentHostPrewarmer);
let AgentHostPrewarmContribution = class extends Disposable {
  constructor(agentHostEnablementService, instantiationService, environmentService) {
    super();
    this.instantiationService = instantiationService;
    if (environmentService.remoteAuthority) {
      return;
    }
    this._register(autorun((reader) => {
      if (agentHostEnablementService.enabled.read(reader)) {
        this.start();
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostPrewarm";
  }
  start() {
    this.instantiationService.createInstance(AgentHostPrewarmer);
  }
};
AgentHostPrewarmContribution = __decorateClass([
  __decorateParam(0, IAgentHostEnablementService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], AgentHostPrewarmContribution);
registerSingleton(
  IAgentHostService,
  WorkbenchAgentHostService,
  InstantiationType.Delayed
);
registerWorkbenchContribution2(AgentHostPrewarmContribution.ID, AgentHostPrewarmContribution, WorkbenchPhase.BlockRestore);
export {
  AgentHostPrewarmContribution
};
