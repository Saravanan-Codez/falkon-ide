import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
class WorkspaceNotTrustedError extends Error {
  constructor() {
    super("Workspace not trusted");
    this.name = "WorkspaceNotTrustedError";
  }
}
const ISessionsManagementService = createDecorator("sessionsManagementService");
function inheritableSessionTarget(sessionsManagementService, session, folderUri) {
  if (!session || !folderUri) {
    return {};
  }
  const target = { providerId: session.providerId, sessionTypeId: session.sessionType };
  return sessionsManagementService.isNewSessionTargetAvailable(folderUri, target) ? target : {};
}
export {
  ISessionsManagementService,
  WorkspaceNotTrustedError,
  inheritableSessionTarget
};
