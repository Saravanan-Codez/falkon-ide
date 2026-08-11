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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { McpManagementChannelClient } from "../../../../platform/mcp/common/mcpManagementIpc.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IRemoteUserDataProfilesService } from "../../userDataProfile/common/remoteUserDataProfiles.js";
import { WorkbenchMcpManagementService as BaseWorkbenchMcpManagementService, IWorkbenchMcpManagementService } from "../common/mcpWorkbenchManagementService.js";
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { IAllowedMcpServersService } from "../../../../platform/mcp/common/mcpManagement.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let WorkbenchMcpManagementService = class extends BaseWorkbenchMcpManagementService {
  constructor(allowedMcpServersService, logService, userDataProfileService, uriIdentityService, workspaceContextService, remoteAgentService, userDataProfilesService, remoteUserDataProfilesService, instantiationService, sharedProcessService) {
    const mcpManagementService = new McpManagementChannelClient(sharedProcessService.getChannel("mcpManagement"), allowedMcpServersService, logService);
    super(mcpManagementService, allowedMcpServersService, logService, userDataProfileService, uriIdentityService, workspaceContextService, remoteAgentService, userDataProfilesService, remoteUserDataProfilesService, instantiationService);
    this._register(mcpManagementService);
  }
};
WorkbenchMcpManagementService = __decorateClass([
  __decorateParam(0, IAllowedMcpServersService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IUserDataProfileService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IRemoteAgentService),
  __decorateParam(6, IUserDataProfilesService),
  __decorateParam(7, IRemoteUserDataProfilesService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ISharedProcessService)
], WorkbenchMcpManagementService);
registerSingleton(IWorkbenchMcpManagementService, WorkbenchMcpManagementService, InstantiationType.Delayed);
export {
  WorkbenchMcpManagementService
};
