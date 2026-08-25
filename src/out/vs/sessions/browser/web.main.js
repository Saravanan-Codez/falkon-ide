import { onUnexpectedError } from "../../base/common/errors.js";
import { IStorageService } from "../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchConfigurationService } from "../../workbench/services/configuration/common/configuration.js";
import { IWorkspaceEditingService } from "../../workbench/services/workspaces/common/workspaceEditing.js";
import { WorkspaceTrustEnablementService, WorkspaceTrustManagementService } from "../../workbench/services/workspaces/common/workspaceTrust.js";
import { BrowserMain } from "../../workbench/browser/web.main.js";
import { getWorkspaceIdentifier } from "../../platform/workspaces/common/workspaceIdentifier.js";
import { SessionsWorkspaceContextService } from "../services/workspace/browser/workspaceContextService.js";
import { ConfigurationService } from "../services/configuration/browser/configurationService.js";
import { ConfigurationCache } from "../../workbench/services/configuration/common/configurationCache.js";
import { Schemas } from "../../base/common/network.js";
import { createSessionsWorkbench } from "./workbenchFactory.js";
class SessionsBrowserMain extends BrowserMain {
  createWorkbench(domElement, serviceCollection, logService) {
    return createSessionsWorkbench(domElement, void 0, serviceCollection, logService);
  }
  async createWorkspaceConfigAndStorageServices(serviceCollection, _workspace, environmentService, userDataProfileService, _userDataProfilesService, fileService, _remoteAgentService, uriIdentityService, policyService, logService, remoteAuthorityResolverService) {
    const workspaceIdentifier = getWorkspaceIdentifier(environmentService.agentSessionsWorkspace);
    const workspaceContextService = new SessionsWorkspaceContextService(workspaceIdentifier, uriIdentityService);
    serviceCollection.set(IWorkspaceContextService, workspaceContextService);
    serviceCollection.set(IWorkspaceEditingService, workspaceContextService);
    const configurationCache = new ConfigurationCache([Schemas.file, Schemas.vscodeUserData], environmentService, fileService);
    const configurationService = new ConfigurationService(
      userDataProfileService,
      workspaceContextService,
      uriIdentityService,
      fileService,
      policyService,
      logService,
      configurationCache,
      environmentService
    );
    try {
      await configurationService.initialize();
    } catch (error) {
      onUnexpectedError(error);
    }
    serviceCollection.set(IWorkbenchConfigurationService, configurationService);
    const storageService = await this.createStorageService(workspaceIdentifier, logService, userDataProfileService);
    serviceCollection.set(IStorageService, storageService);
    const workspaceTrustEnablementService = new WorkspaceTrustEnablementService(configurationService, environmentService);
    serviceCollection.set(IWorkspaceTrustEnablementService, workspaceTrustEnablementService);
    const workspaceTrustManagementService = new WorkspaceTrustManagementService(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, workspaceContextService, workspaceTrustEnablementService, fileService);
    serviceCollection.set(IWorkspaceTrustManagementService, workspaceTrustManagementService);
    return { configurationService, storageService };
  }
}
export {
  SessionsBrowserMain
};
