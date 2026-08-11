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
import { IActionWidgetService } from "../../../../../../platform/actionWidget/browser/actionWidget.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { IChatWidgetService } from "../../../../../../workbench/contrib/chat/browser/chat.js";
import { IChatPhoneInputPresenter } from "../../../../../../workbench/contrib/chat/browser/widget/input/chatPhoneInputPresenter.js";
import { ISessionsProvidersService } from "../../../../../services/sessions/browser/sessionsProvidersService.js";
import { AgentHostModePicker } from "../agentHostModePicker.js";
import { createChatPhoneInputSessionContext } from "./mobileChatPhoneInputTarget.js";
let MobileAgentHostModePicker = class extends AgentHostModePicker {
  constructor(session, actionWidgetService, sessionsProvidersService, telemetryService, hoverService, _phonePresenter, _chatWidgetService) {
    super(session, actionWidgetService, sessionsProvidersService, telemetryService, hoverService);
    this._phonePresenter = _phonePresenter;
    this._chatWidgetService = _chatWidgetService;
  }
  _showPicker(anchor = this._triggerElement, onHide) {
    if (!anchor) {
      return false;
    }
    if (this._isCurrentlyResolvingConfig()) {
      return false;
    }
    if (this._phonePresenter.enabled.get()) {
      this._phonePresenter.showCombinedModeAndModelSheet(anchor, {
        kind: "session",
        getSessionContext: () => createChatPhoneInputSessionContext(this._session.get()),
        selectModel: (modelIdentifier) => {
          const chatResource = this._session.get()?.activeChat.get().resource;
          return chatResource ? this._chatWidgetService.getWidgetBySessionResource(chatResource)?.inputPart.switchModelByIdentifier(modelIdentifier, true, true) ?? false : false;
        }
      }).finally(() => {
        anchor.focus();
        onHide?.();
      });
      return true;
    }
    return super._showPicker(anchor, onHide);
  }
};
MobileAgentHostModePicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IChatPhoneInputPresenter),
  __decorateParam(6, IChatWidgetService)
], MobileAgentHostModePicker);
export {
  MobileAgentHostModePicker
};
