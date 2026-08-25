import { isLocalAgentSessionItem } from "./agentSessionsModel.js";
import { ChatViewPaneTarget, IChatWidgetService } from "../chat.js";
import { ACTIVE_GROUP, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { IChatSessionsService, localChatSessionType } from "../../common/chatSessionsService.js";
import { Schemas } from "../../../../../base/common/network.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { localize } from "../../../../../nls.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IAgentSessionsService } from "./agentSessionsService.js";
class SessionOpenerRegistry {
  constructor() {
    this.participants = /* @__PURE__ */ new Set();
  }
  registerParticipant(participant) {
    this.participants.add(participant);
    return {
      dispose: () => {
        this.participants.delete(participant);
      }
    };
  }
  getParticipants() {
    return Array.from(this.participants);
  }
}
const sessionOpenerRegistry = new SessionOpenerRegistry();
async function openSessionByResource(accessor, resource, openOptions) {
  const instantiationService = accessor.get(IInstantiationService);
  const logService = accessor.get(ILogService);
  for (const participant of sessionOpenerRegistry.getParticipants()) {
    if (!participant.handleOpenSessionResource) {
      continue;
    }
    try {
      const handled = await instantiationService.invokeFunction((accessor2) => participant.handleOpenSessionResource?.(accessor2, resource, openOptions));
      if (handled) {
        return void 0;
      }
    } catch (error) {
      logService.error(error);
    }
  }
  const session = instantiationService.invokeFunction((accessor2) => accessor2.get(IAgentSessionsService).getSession(resource));
  if (!session) {
    throw new Error(`Chat session not found: ${resource.toString()}`);
  }
  return instantiationService.invokeFunction(openSession, session, openOptions);
}
async function openSession(accessor, session, openOptions) {
  const instantiationService = accessor.get(IInstantiationService);
  const logService = accessor.get(ILogService);
  for (const participant of sessionOpenerRegistry.getParticipants()) {
    try {
      const handled = await instantiationService.invokeFunction((accessor2) => participant.handleOpenSession(accessor2, session, openOptions));
      if (handled) {
        return void 0;
      }
    } catch (error) {
      logService.error(error);
    }
  }
  return instantiationService.invokeFunction((accessor2) => openSessionDefault(accessor2, session, openOptions));
}
async function openSessionDefault(accessor, session, openOptions) {
  const chatSessionsService = accessor.get(IChatSessionsService);
  const chatWidgetService = accessor.get(IChatWidgetService);
  const notificationService = accessor.get(INotificationService);
  try {
    session.setRead(true);
    let sessionOptions;
    if (isLocalAgentSessionItem(session)) {
      sessionOptions = {};
    } else {
      sessionOptions = { title: { preferred: session.label } };
    }
    let options = {
      ...sessionOptions,
      ...openOptions?.editorOptions,
      revealIfOpened: true
      // always try to reveal if already opened
    };
    await chatSessionsService.activateChatSessionItemProvider(session.providerType);
    let target;
    if (openOptions?.sideBySide) {
      target = ACTIVE_GROUP;
    } else {
      target = ChatViewPaneTarget;
    }
    const isLocalChatSession = session.resource.scheme === Schemas.vscodeChatEditor || getChatSessionType(session.resource) === localChatSessionType;
    if (!isLocalChatSession && !await chatSessionsService.canResolveChatSession(getChatSessionType(session.resource))) {
      target = openOptions?.sideBySide ? SIDE_GROUP : ACTIVE_GROUP;
      options = { ...options, revealIfOpened: true };
    }
    return await chatWidgetService.openSession(session.resource, target, options);
  } catch (error) {
    notificationService.error(localize("chat.openSessionFailed", "Failed to open chat session: {0}", toErrorMessage(error)));
    return void 0;
  }
}
export {
  openSession,
  openSessionByResource,
  sessionOpenerRegistry
};
