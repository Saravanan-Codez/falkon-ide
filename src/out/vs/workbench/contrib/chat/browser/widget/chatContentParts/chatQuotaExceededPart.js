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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { assertType } from "../../../../../../base/common/types.js";
import { localize } from "../../../../../../nls.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { ChatEntitlement, IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
const $ = dom.$;
let ChatQuotaExceededPart = class extends Disposable {
  constructor(element, content, renderer, commandService, telemetryService, chatEntitlementService) {
    super();
    this.content = content;
    const errorDetails = element.errorDetails;
    assertType(!!errorDetails, "errorDetails");
    this.domNode = $(".chat-quota-error-widget");
    const icon = dom.append(this.domNode, $("span"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
    const messageContainer = dom.append(this.domNode, $(".chat-quota-error-message"));
    const markdownContent = this._register(renderer.render(new MarkdownString(errorDetails.message)));
    dom.append(messageContainer, markdownContent.element);
    let primaryButtonLabel;
    switch (chatEntitlementService.entitlement) {
      case ChatEntitlement.EDU:
      case ChatEntitlement.Pro:
      case ChatEntitlement.ProPlus:
      case ChatEntitlement.Max:
        primaryButtonLabel = localize("manageBudget", "Manage Budget");
        break;
      case ChatEntitlement.Free:
        primaryButtonLabel = localize("upgradeToCopilotPro", "Upgrade to GitHub Copilot Pro");
        break;
    }
    if (primaryButtonLabel) {
      const primaryButton = this._register(new Button(messageContainer, { ...defaultButtonStyles, supportIcons: true }));
      primaryButton.label = primaryButtonLabel;
      primaryButton.element.classList.add("chat-quota-error-button");
      this._register(primaryButton.onDidClick(async () => {
        const commandId = chatEntitlementService.entitlement === ChatEntitlement.Free ? "workbench.action.chat.upgradePlan" : "workbench.action.chat.manageAdditionalSpend";
        telemetryService.publicLog2("workbenchActionExecuted", { id: commandId, from: "chat-response" });
        await commandService.executeCommand(commandId);
      }));
    }
  }
  hasSameContent(other) {
    return other.kind === this.content.kind && !!other.errorDetails.isQuotaExceeded;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatQuotaExceededPart = __decorateClass([
  __decorateParam(3, ICommandService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IChatEntitlementService)
], ChatQuotaExceededPart);
export {
  ChatQuotaExceededPart
};
