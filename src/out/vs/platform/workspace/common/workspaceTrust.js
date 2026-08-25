import { createDecorator } from "../../instantiation/common/instantiation.js";
var WorkspaceTrustScope = /* @__PURE__ */ ((WorkspaceTrustScope2) => {
  WorkspaceTrustScope2[WorkspaceTrustScope2["Local"] = 0] = "Local";
  WorkspaceTrustScope2[WorkspaceTrustScope2["Remote"] = 1] = "Remote";
  return WorkspaceTrustScope2;
})(WorkspaceTrustScope || {});
const IWorkspaceTrustEnablementService = createDecorator("workspaceTrustEnablementService");
const IWorkspaceTrustManagementService = createDecorator("workspaceTrustManagementService");
var WorkspaceTrustUriResponse = /* @__PURE__ */ ((WorkspaceTrustUriResponse2) => {
  WorkspaceTrustUriResponse2[WorkspaceTrustUriResponse2["Open"] = 1] = "Open";
  WorkspaceTrustUriResponse2[WorkspaceTrustUriResponse2["OpenInNewWindow"] = 2] = "OpenInNewWindow";
  WorkspaceTrustUriResponse2[WorkspaceTrustUriResponse2["Cancel"] = 3] = "Cancel";
  return WorkspaceTrustUriResponse2;
})(WorkspaceTrustUriResponse || {});
const IWorkspaceTrustRequestService = createDecorator("workspaceTrustRequestService");
export {
  IWorkspaceTrustEnablementService,
  IWorkspaceTrustManagementService,
  IWorkspaceTrustRequestService,
  WorkspaceTrustScope,
  WorkspaceTrustUriResponse
};
