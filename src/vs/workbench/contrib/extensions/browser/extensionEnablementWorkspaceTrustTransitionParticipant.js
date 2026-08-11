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
import { localize } from "../../../../nls.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
let ExtensionEnablementWorkspaceTrustTransitionParticipant = class extends Disposable {
  constructor(extensionService, hostService, environmentService, extensionEnablementService, workspaceTrustEnablementService, workspaceTrustManagementService) {
    super();
    if (workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
        const workspaceTrustTransitionParticipant = new class {
          async participate(trusted) {
            if (trusted) {
              await extensionEnablementService.updateExtensionsEnablementsWhenWorkspaceTrustChanges();
            } else {
              if (environmentService.remoteAuthority) {
                hostService.reload();
              } else {
                const stopped = await extensionService.stopExtensionHosts(localize("restartExtensionHost.reason", "Changing workspace trust"));
                await extensionEnablementService.updateExtensionsEnablementsWhenWorkspaceTrustChanges();
                if (stopped) {
                  extensionService.startExtensionHosts();
                }
              }
            }
          }
        }();
        this._register(workspaceTrustManagementService.addWorkspaceTrustTransitionParticipant(workspaceTrustTransitionParticipant));
      });
    }
  }
};
ExtensionEnablementWorkspaceTrustTransitionParticipant = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IHostService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IWorkbenchExtensionEnablementService),
  __decorateParam(4, IWorkspaceTrustEnablementService),
  __decorateParam(5, IWorkspaceTrustManagementService)
], ExtensionEnablementWorkspaceTrustTransitionParticipant);
export {
  ExtensionEnablementWorkspaceTrustTransitionParticipant
};
