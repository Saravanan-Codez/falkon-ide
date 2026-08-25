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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { ChatOriginKind, isActiveSessionStatus } from "../../../services/sessions/common/session.js";
import { SessionActivityPill } from "./sessionActivityPill.js";
const SUBAGENT_LABEL_MAX_LENGTH = 30;
let SessionBackgroundActivitiesControl = class extends Disposable {
  constructor(_session, _chat, _enabled, actionWidgetService, _sessionsService) {
    super();
    this._session = _session;
    this._chat = _chat;
    this._enabled = _enabled;
    this._sessionsService = _sessionsService;
    this._runningSubagents = [];
    this._pill = this._register(new SessionActivityPill({
      className: "session-background-activities",
      widgetId: "sessionBackgroundActivities",
      getWidgetAriaLabel: () => localize("backgroundActivities.ariaLabel", "Background Activities"),
      getSummary: (activities) => this._summary(activities),
      openActivity: (activity) => this._openActivity(activity)
    }, actionWidgetService));
    this.element = this._pill.element;
    this.isVisible = this._pill.isVisible;
    this._register(autorun((reader) => {
      const session = this._session.read(reader);
      const chat = this._chat.read(reader);
      const enabled = this._enabled.read(reader);
      this._currentSession = session;
      this._runningSubagents = enabled && session && chat ? this._collectRunningSubagents(session, chat, reader) : [];
      this._refresh();
    }));
  }
  setDebugData(data) {
    this._debugData = data;
    this._refresh();
  }
  _collectRunningSubagents(session, parentChat, reader) {
    return session.chats.read(reader).filter((chat) => chat.origin?.kind === ChatOriginKind.Tool && !!chat.origin.parentChat && isEqual(chat.origin.parentChat, parentChat.resource) && isActiveSessionStatus(chat.status.read(reader))).map((chat) => ({
      chat,
      icon: Codicon.agent,
      label: this._subagentLabel(chat.title.read(reader))
    }));
  }
  _subagentLabel(title) {
    const label = title.trim() || localize("backgroundActivities.subagent", "Subagent");
    return label.length > SUBAGENT_LABEL_MAX_LENGTH ? `${label.slice(0, SUBAGENT_LABEL_MAX_LENGTH)}...` : label;
  }
  _refresh() {
    const subagents = this._debugData ? this._debugData.subagents.map((label) => ({ label, icon: Codicon.agent, chat: void 0 })) : this._runningSubagents;
    this._pill.setCategories([{ title: localize("backgroundActivities.subagents", "Subagents"), activities: subagents }]);
  }
  _summary(activities) {
    return {
      icon: Codicon.agent,
      label: localize("backgroundActivities.activeSubagents", "{0} Active Subagents", activities.length),
      ariaLabel: localize("backgroundActivities.show", "Show {0} background activities", activities.length)
    };
  }
  _openActivity(activity) {
    if (activity.chat && this._currentSession) {
      this._sessionsService.openChat(this._currentSession, activity.chat.resource);
    }
  }
};
SessionBackgroundActivitiesControl = __decorateClass([
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, ISessionsService)
], SessionBackgroundActivitiesControl);
export {
  SessionBackgroundActivitiesControl
};
