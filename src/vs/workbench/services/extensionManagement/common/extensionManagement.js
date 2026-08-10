import { createDecorator, refineServiceDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
const IProfileAwareExtensionManagementService = refineServiceDecorator(IExtensionManagementService);
var ExtensionInstallLocation = /* @__PURE__ */ ((ExtensionInstallLocation2) => {
  ExtensionInstallLocation2[ExtensionInstallLocation2["Local"] = 1] = "Local";
  ExtensionInstallLocation2[ExtensionInstallLocation2["Remote"] = 2] = "Remote";
  ExtensionInstallLocation2[ExtensionInstallLocation2["Web"] = 3] = "Web";
  return ExtensionInstallLocation2;
})(ExtensionInstallLocation || {});
const IExtensionManagementServerService = createDecorator("extensionManagementServerService");
const IWorkbenchExtensionManagementService = refineServiceDecorator(IProfileAwareExtensionManagementService);
var EnablementState = /* @__PURE__ */ ((EnablementState2) => {
  EnablementState2[EnablementState2["DisabledByTrustRequirement"] = 0] = "DisabledByTrustRequirement";
  EnablementState2[EnablementState2["DisabledByExtensionKind"] = 1] = "DisabledByExtensionKind";
  EnablementState2[EnablementState2["DisabledByEnvironment"] = 2] = "DisabledByEnvironment";
  EnablementState2[EnablementState2["EnabledByEnvironment"] = 3] = "EnabledByEnvironment";
  EnablementState2[EnablementState2["DisabledByMalicious"] = 4] = "DisabledByMalicious";
  EnablementState2[EnablementState2["DisabledByVirtualWorkspace"] = 5] = "DisabledByVirtualWorkspace";
  EnablementState2[EnablementState2["DisabledByInvalidExtension"] = 6] = "DisabledByInvalidExtension";
  EnablementState2[EnablementState2["DisabledByAllowlist"] = 7] = "DisabledByAllowlist";
  EnablementState2[EnablementState2["DisabledByExtensionDependency"] = 8] = "DisabledByExtensionDependency";
  EnablementState2[EnablementState2["DisabledByUnification"] = 9] = "DisabledByUnification";
  EnablementState2[EnablementState2["DisabledGlobally"] = 10] = "DisabledGlobally";
  EnablementState2[EnablementState2["DisabledWorkspace"] = 11] = "DisabledWorkspace";
  EnablementState2[EnablementState2["EnabledGlobally"] = 12] = "EnabledGlobally";
  EnablementState2[EnablementState2["EnabledWorkspace"] = 13] = "EnabledWorkspace";
  return EnablementState2;
})(EnablementState || {});
const IWorkbenchExtensionEnablementService = createDecorator("extensionEnablementService");
const IWebExtensionsScannerService = createDecorator("IWebExtensionsScannerService");
export {
  EnablementState,
  ExtensionInstallLocation,
  IExtensionManagementServerService,
  IProfileAwareExtensionManagementService,
  IWebExtensionsScannerService,
  IWorkbenchExtensionEnablementService,
  IWorkbenchExtensionManagementService
};
