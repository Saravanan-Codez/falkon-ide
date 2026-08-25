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
import { $, append } from "../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
let ChatAnonymousRateLimitedPart = class extends Disposable {
  constructor(content, commandService, telemetryService, chatEntitlementService) {
    super();
    this.content = content;
    this.domNode = $(".chat-rate-limited-widget");
    const icon = append(this.domNode, $("span"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
    const messageContainer = append(this.domNode, $(".chat-rate-limited-message"));
    const message = append(messageContainer, $("div"));
    message.textContent = localize("anonymousRateLimited", "Continue the conversation by signing in. Your free account gets 50 premium requests a month plus access to more models and AI features.");
    const signInButton = this._register(new Button(messageContainer, { ...defaultButtonStyles, supportIcons: true }));
    signInButton.label = localize("enableMoreAIFeatures", "Enable more AI features");
    signInButton.element.classList.add("chat-rate-limited-button");
    this._register(signInButton.onDidClick(async () => {
      const commandId = "workbench.action.chat.triggerSetup";
      telemetryService.publicLog2("workbenchActionExecuted", { id: commandId, from: "chat-response" });
      await commandService.executeCommand(commandId);
    }));
  }
  hasSameContent(other) {
    return other.kind === this.content.kind && !!other.errorDetails.isRateLimited;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatAnonymousRateLimitedPart = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IChatEntitlementService)
], ChatAnonymousRateLimitedPart);
export {
  ChatAnonymousRateLimitedPart
};
