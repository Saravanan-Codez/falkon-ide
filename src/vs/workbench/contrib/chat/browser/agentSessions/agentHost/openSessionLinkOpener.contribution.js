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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { AgentSession } from "../../../../../../platform/agentHost/common/agentService.js";
import { LOCAL_AGENT_HOST_SCHEME_PREFIX } from "../../../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { parseOpenSessionLinkUri } from "../../../../../../platform/agentHost/common/openSessionLink.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { getChatSessionType } from "../../../common/model/chatUri.js";
import { IChatSessionsService } from "../../../common/chatSessionsService.js";
import { ChatViewPaneTarget, IChatWidgetService } from "../../chat.js";
let AgentHostOpenSessionLinkOpenerContribution = class extends Disposable {
  constructor(openerService, _chatWidgetService, _chatSessionsService) {
    super();
    this._chatWidgetService = _chatWidgetService;
    this._chatSessionsService = _chatSessionsService;
    this._register(openerService.registerOpener({
      open: async (resource) => this._open(resource)
    }));
  }
  static {
    this.ID = "workbench.chat.agentHostOpenSessionLinkOpener";
  }
  async _open(resource) {
    const backendSession = parseOpenSessionLinkUri(resource);
    if (!backendSession) {
      return false;
    }
    const provider = AgentSession.provider(backendSession);
    const rawId = AgentSession.id(backendSession);
    if (!provider || !rawId) {
      return false;
    }
    const clientResource = URI.from({ scheme: `${LOCAL_AGENT_HOST_SCHEME_PREFIX}${provider}`, path: `/${rawId}` });
    await this._chatSessionsService.activateChatSessionItemProvider(getChatSessionType(clientResource));
    const widget = await this._chatWidgetService.openSession(clientResource, ChatViewPaneTarget, { revealIfOpened: true });
    return !!widget;
  }
};
AgentHostOpenSessionLinkOpenerContribution = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatSessionsService)
], AgentHostOpenSessionLinkOpenerContribution);
export {
  AgentHostOpenSessionLinkOpenerContribution
};
