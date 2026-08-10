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
import * as dom from "../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { assertIsResponseVM } from "../../../common/model/chatViewModel.js";
import { IChatAccessibilityService, IChatWidgetService } from "../../chat.js";
import { ChatErrorWidget } from "./chatErrorContentPart.js";
const $ = dom.$;
let ChatErrorConfirmationContentPart = class extends Disposable {
  constructor(kind, content, errorDetails, confirmationButtons, renderer, context, instantiationService, chatWidgetService, chatService, chatAccessibilityService) {
    super();
    this.errorDetails = errorDetails;
    this.chatAccessibilityService = chatAccessibilityService;
    const element = context.element;
    assertIsResponseVM(element);
    this.domNode = $(".chat-error-confirmation");
    this.domNode.append(this._register(new ChatErrorWidget(kind, content, renderer)).domNode);
    const buttonOptions = { ...defaultButtonStyles };
    const buttonContainer = dom.append(this.domNode, $(".chat-buttons-container"));
    confirmationButtons.forEach((buttonData) => {
      const button = this._register(new Button(buttonContainer, buttonOptions));
      button.label = buttonData.label;
      this._register(button.onDidClick(async () => {
        const prompt = buttonData.label;
        const options = buttonData.isSecondary ? { rejectedConfirmationData: [buttonData.data] } : { acceptedConfirmationData: [buttonData.data] };
        options.agentId = element.agent?.id;
        options.slashCommand = element.slashCommand?.name;
        options.confirmation = buttonData.label;
        const widget = chatWidgetService.getWidgetBySessionResource(element.sessionResource);
        Object.assign(options, widget?.getSelectedModelRequestOptions());
        Object.assign(options, widget?.getModeRequestOptions());
        this.chatAccessibilityService.acceptRequest(element.sessionResource);
        await chatService.sendRequest(element.sessionResource, prompt, options);
      }));
    });
  }
  hasSameContent(other) {
    return other.kind === this.errorDetails.kind && other.isLast === this.errorDetails.isLast;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatErrorConfirmationContentPart = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IChatWidgetService),
  __decorateParam(8, IChatService),
  __decorateParam(9, IChatAccessibilityService)
], ChatErrorConfirmationContentPart);
export {
  ChatErrorConfirmationContentPart
};
