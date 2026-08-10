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
import { localize } from "../../../../../../nls.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ChatSendResult, IChatService } from "../../../common/chatService/chatService.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
import { IChatWidgetService } from "../../chat.js";
import { SimpleChatConfirmationWidget } from "./chatConfirmationWidget.js";
let ChatConfirmationContentPart = class extends Disposable {
  constructor(confirmation, context, instantiationService, chatService, chatWidgetService) {
    super();
    this.instantiationService = instantiationService;
    this.chatService = chatService;
    const element = context.element;
    const buttons = confirmation.buttons ? confirmation.buttons.map((button) => ({
      label: button,
      data: confirmation.data,
      isSecondary: button !== confirmation.buttons?.[0]
    })) : [
      { label: localize("accept", "Accept"), data: confirmation.data },
      { label: localize("dismiss", "Dismiss"), data: confirmation.data, isSecondary: true }
    ];
    const confirmationWidget = this._register(this.instantiationService.createInstance(SimpleChatConfirmationWidget, context, { title: confirmation.title, buttons, message: confirmation.message }));
    confirmationWidget.setShowButtons(!confirmation.isUsed);
    this._register(confirmationWidget.onDidClick(async ({ button: e }) => {
      if (isResponseVM(element)) {
        const prompt = `${e.label}: "${confirmation.title}"`;
        const options = e.isSecondary ? { rejectedConfirmationData: [e.data] } : { acceptedConfirmationData: [e.data] };
        options.agentId = element.agent?.id;
        options.slashCommand = element.slashCommand?.name;
        options.confirmation = e.label;
        const widget = chatWidgetService.getWidgetBySessionResource(element.sessionResource);
        Object.assign(options, widget?.getSelectedModelRequestOptions());
        options.modeInfo = widget?.input.currentModeInfo;
        options.location = widget?.location;
        Object.assign(options, widget?.getModeRequestOptions());
        const result = await this.chatService.sendRequest(element.sessionResource, prompt, options);
        if (ChatSendResult.isSent(result)) {
          confirmation.isUsed = true;
          confirmationWidget.setShowButtons(false);
        }
      }
    }));
    this.domNode = confirmationWidget.domNode;
  }
  hasSameContent(other) {
    return other.kind === "confirmation";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatConfirmationContentPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IChatWidgetService)
], ChatConfirmationContentPart);
export {
  ChatConfirmationContentPart
};
