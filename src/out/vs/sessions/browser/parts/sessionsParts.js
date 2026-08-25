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
import { Disposable } from "../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { getClientArea } from "../../../base/browser/dom.js";
import { mainWindow } from "../../../base/browser/window.js";
import { SessionsPart } from "./sessionsPart.js";
import { MobileSessionsPart } from "./mobile/mobileSessionsPart.js";
import { Emitter } from "../../../base/common/event.js";
import { ISessionsPartService } from "../../services/sessions/browser/sessionsPartService.js";
let SessionsParts = class extends Disposable {
  constructor(instantiationService) {
    super();
    this._onDidToggleMaximizeSession = this._register(new Emitter());
    this.onDidToggleMaximizeSession = this._onDidToggleMaximizeSession.event;
    const { width } = getClientArea(mainWindow.document.body);
    const isPhoneLayout = width < 640;
    this._mainPart = this._register(instantiationService.createInstance(isPhoneLayout ? MobileSessionsPart : SessionsPart));
  }
  get onDidFocusSession() {
    return this._mainPart.onDidFocusSession;
  }
  updateVisibleSessions(visible, active) {
    this._mainPart.updateVisibleSessions(visible, active);
  }
  toggleMaximizeSession(session) {
    if (!session) {
      this._mainPart.toggleMaximizeSession(void 0);
      return;
    }
    const maximized = this._mainPart.toggleMaximizeSession(session.sessionId);
    if (maximized !== void 0) {
      this._onDidToggleMaximizeSession.fire({ session, maximized });
    }
  }
  focusSession(session) {
    this._mainPart.focusSession(session?.sessionId);
  }
  getSessionView(sessionId) {
    return this._mainPart.getSessionView(sessionId);
  }
  getProgressIndicator() {
    return this._mainPart.getProgressIndicator();
  }
};
SessionsParts = __decorateClass([
  __decorateParam(0, IInstantiationService)
], SessionsParts);
registerSingleton(ISessionsPartService, SessionsParts, InstantiationType.Eager);
export {
  SessionsParts
};
