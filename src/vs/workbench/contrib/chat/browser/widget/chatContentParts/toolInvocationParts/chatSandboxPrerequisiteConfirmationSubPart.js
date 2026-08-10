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
import * as dom from "../../../../../../../base/browser/dom.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../../common/tools/languageModelToolsService.js";
import { AcceptToolConfirmationActionId, SkipToolConfirmationActionId } from "../../../actions/chatToolActions.js";
import { IChatWidgetService } from "../../../chat.js";
import { IChatToolRiskAssessmentService } from "../../../tools/chatToolRiskAssessmentService.js";
import { AbstractToolConfirmationSubPart } from "./abstractToolConfirmationSubPart.js";
let ChatSandboxPrerequisiteConfirmationSubPart = class extends AbstractToolConfirmationSubPart {
  constructor(toolInvocation, terminalData, context, renderer, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService) {
    super(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService, riskAssessmentService);
    this.renderer = renderer;
    this.codeblocks = [];
    const hasSandboxRemediations = !!terminalData.sandboxRemediations?.length;
    this.render({
      allowActionId: AcceptToolConfirmationActionId,
      skipActionId: SkipToolConfirmationActionId,
      allowLabel: hasSandboxRemediations ? localize("sandboxPrerequisite.applyFix", "Apply Fix and Retry") : localize("missingDeps.install", "Install"),
      skipLabel: localize("sandboxPrerequisite.cancel", "Cancel"),
      partType: hasSandboxRemediations ? "chatSandboxRemediationConfirmation" : "chatMissingSandboxDepsConfirmation"
    });
  }
  createContentElement() {
    const state = this.toolInvocation.state.get();
    const message = state.type === IChatToolInvocation.StateKind.WaitingForConfirmation ? state.confirmationMessages?.message : void 0;
    const container = dom.$(".chat-sandbox-prerequisite-confirmation");
    if (message) {
      const mdMessage = typeof message === "string" ? new MarkdownString(message) : message;
      const rendered = this.renderer.render(mdMessage);
      this._register(rendered);
      container.appendChild(rendered.element);
    }
    return container;
  }
  getTitle() {
    const state = this.toolInvocation.state.get();
    if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && state.confirmationMessages?.title) {
      return typeof state.confirmationMessages.title === "string" ? state.confirmationMessages.title : state.confirmationMessages.title.value;
    }
    return "";
  }
};
ChatSandboxPrerequisiteConfirmationSubPart = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IChatWidgetService),
  __decorateParam(8, ILanguageModelToolsService),
  __decorateParam(9, IChatToolRiskAssessmentService)
], ChatSandboxPrerequisiteConfirmationSubPart);
export {
  ChatSandboxPrerequisiteConfirmationSubPart
};
