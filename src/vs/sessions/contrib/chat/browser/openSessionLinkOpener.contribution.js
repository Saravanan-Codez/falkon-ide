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
import { IAgentHostConnectionsService } from "../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { parseOpenSessionLinkChatId, parseOpenSessionLinkUri } from "../../../../platform/agentHost/common/openSessionLink.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
let OpenSessionLinkOpenerContribution = class extends Disposable {
  constructor(openerService, _sessionsManagementService, _sessionsService, _connectionsService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._connectionsService = _connectionsService;
    this._register(openerService.registerOpener({
      open: async (resource) => this._open(resource)
    }));
  }
  static {
    this.ID = "sessions.openSessionLinkOpener";
  }
  async _open(resource) {
    const backendSession = parseOpenSessionLinkUri(resource);
    if (!backendSession) {
      return false;
    }
    const session = this._findSession(backendSession);
    if (!session) {
      return false;
    }
    const chatId = parseOpenSessionLinkChatId(resource);
    if (chatId) {
      await this._sessionsService.openChat(session, session.resource.with({ fragment: chatId }));
      return true;
    }
    await this._sessionsService.openSession(session.resource);
    return true;
  }
  _findSession(backendSession) {
    const backend = backendSession.toString();
    return this._sessionsManagementService.getSessions().find((session) => session.resource.toString() === backend || this._connectionsService.resolveSessionResource(session.resource)?.backendSession.toString() === backend);
  }
};
OpenSessionLinkOpenerContribution = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IAgentHostConnectionsService)
], OpenSessionLinkOpenerContribution);
export {
  OpenSessionLinkOpenerContribution
};
