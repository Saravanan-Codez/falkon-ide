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
import { isMarkdownString, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { ElicitationState } from "../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../common/tools/languageModelToolsService.js";
import { IChatAccessibilityService } from "../../chat.js";
import { AcceptElicitationRequestActionId } from "../../actions/chatElicitationActions.js";
import { IChatToolRiskAssessmentService } from "../../tools/chatToolRiskAssessmentService.js";
import { ChatConfirmationWidget } from "./chatConfirmationWidget.js";
import { createToolRiskBadge } from "./toolInvocationParts/toolRiskBadgeHelper.js";
let ChatElicitationContentPart = class extends Disposable {
  constructor(elicitation, context, instantiationService, chatAccessibilityService, contextKeyService, keybindingService, languageModelToolsService, riskAssessmentService) {
    super();
    this.elicitation = elicitation;
    this.instantiationService = instantiationService;
    this.chatAccessibilityService = chatAccessibilityService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this.languageModelToolsService = languageModelToolsService;
    this.riskAssessmentService = riskAssessmentService;
    const buttons = [];
    if (elicitation.kind === "elicitation2") {
      const acceptTooltip = this.keybindingService.appendKeybinding(elicitation.acceptButtonLabel, AcceptElicitationRequestActionId);
      buttons.push({
        label: elicitation.acceptButtonLabel,
        tooltip: acceptTooltip,
        data: true,
        moreActions: elicitation.moreActions?.map((action) => ({
          label: action.label,
          data: action,
          run: action.run
        }))
      });
      if (elicitation.rejectButtonLabel && elicitation.reject) {
        buttons.push({ label: elicitation.rejectButtonLabel, data: false, isSecondary: true });
      }
      this._register(autorun((reader) => {
        if (elicitation.isHidden?.read(reader)) {
          this.domNode.remove();
        }
      }));
      const hasElicitationKey = ChatContextKeys.Editing.hasElicitationRequest.bindTo(this.contextKeyService);
      this._register(autorun((reader) => {
        hasElicitationKey.set(elicitation.state.read(reader) === ElicitationState.Pending);
      }));
      this._register(toDisposable(() => hasElicitationKey.reset()));
      this.chatAccessibilityService.acceptElicitation(elicitation);
    }
    const confirmationWidget = this._register(this.instantiationService.createInstance(ChatConfirmationWidget, context, {
      title: elicitation.title,
      subtitle: elicitation.subtitle,
      buttons,
      message: this.getMessageToRender(elicitation),
      footerBanner: this._createRiskBadge(elicitation),
      toolbarData: { partType: "elicitation", partSource: elicitation.source?.type, arg: elicitation }
    }));
    this._confirmWidget = confirmationWidget;
    confirmationWidget.setShowButtons(elicitation.kind === "elicitation2" && elicitation.state.get() === ElicitationState.Pending);
    this._register(confirmationWidget.onDidClick(async ({ button: e }) => {
      if (elicitation.kind !== "elicitation2") {
        return;
      }
      let result;
      if (typeof e.data === "boolean" && e.data === true) {
        result = e.data;
      } else if (e.data && typeof e.data === "object" && "run" in e.data && "label" in e.data) {
        result = e.data;
      } else {
        result = void 0;
      }
      if (result !== void 0) {
        await elicitation.accept(result);
      } else if (elicitation.reject) {
        await elicitation.reject();
      }
      confirmationWidget.setShowButtons(false);
      confirmationWidget.updateMessage(this.getMessageToRender(elicitation));
    }));
    this.domNode = confirmationWidget.domNode;
    this.domNode.tabIndex = 0;
    const messageToRender = this.getMessageToRender(elicitation);
    this.domNode.ariaLabel = elicitation.title + " " + (typeof messageToRender === "string" ? messageToRender : messageToRender.value || "");
  }
  get codeblocks() {
    return this._confirmWidget.codeblocks;
  }
  get codeblocksPartId() {
    return this._confirmWidget.codeblocksPartId;
  }
  getMessageToRender(elicitation) {
    if (!elicitation.acceptedResult) {
      return elicitation.message;
    }
    const messageMd = isMarkdownString(elicitation.message) ? MarkdownString.lift(elicitation.message) : new MarkdownString(elicitation.message);
    messageMd.appendCodeblock("json", JSON.stringify(elicitation.acceptedResult, null, 2));
    return messageMd;
  }
  _createRiskBadge(elicitation) {
    if (elicitation.kind !== "elicitation2" || !elicitation.riskAssessment) {
      return void 0;
    }
    const { toolId, parameters } = elicitation.riskAssessment;
    return createToolRiskBadge(this._store, this.instantiationService, this.riskAssessmentService, this.languageModelToolsService, toolId, parameters)?.domNode;
  }
  hasSameContent(other) {
    return other === this.elicitation;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatElicitationContentPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IChatAccessibilityService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, ILanguageModelToolsService),
  __decorateParam(7, IChatToolRiskAssessmentService)
], ChatElicitationContentPart);
export {
  ChatElicitationContentPart
};
