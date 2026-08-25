import { Disposable } from "../../../../base/common/lifecycle.js";
import { sessionOpenerRegistry } from "../../../../workbench/contrib/chat/browser/agentSessions/agentSessionsOpener.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
class SessionsOpenerParticipant {
  async handleOpenSession(accessor, session, openOptions) {
    return this.handleOpenSessionResource(accessor, session.resource, openOptions);
  }
  async handleOpenSessionResource(accessor, resource, openOptions) {
    const sessionsManagementService = accessor.get(ISessionsManagementService);
    const sessionsService = accessor.get(ISessionsService);
    const target = sessionsManagementService.getSession(resource);
    if (!target) {
      return false;
    }
    await sessionsService.openSession(resource, { preserveFocus: openOptions?.editorOptions?.preserveFocus });
    return true;
  }
}
class SessionsOpenerParticipantContribution extends Disposable {
  static {
    this.ID = "sessions.sessionOpenerParticipant";
  }
  constructor() {
    super();
    this._register(sessionOpenerRegistry.registerParticipant(new SessionsOpenerParticipant()));
  }
}
export {
  SessionsOpenerParticipantContribution
};
