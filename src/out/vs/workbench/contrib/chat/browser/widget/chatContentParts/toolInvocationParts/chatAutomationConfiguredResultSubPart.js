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
import { ButtonWithIcon } from "../../../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { localize } from "../../../../../../../nls.js";
import { ICommandService } from "../../../../../../../platform/commands/common/commands.js";
import { defaultButtonStyles } from "../../../../../../../platform/theme/browser/defaultStyles.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import "../media/chatSessionCreatedResult.css";
let ChatAutomationConfiguredResultSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, data, _context, _renderer, commandService) {
    super(toolInvocation);
    this.commandService = commandService;
    this.codeblocks = [];
    this.domNode = dom.$(".chat-open-session-result");
    const label = data.operation === "created" ? localize("automationConfigured.created", "Created an automation: {0}", data.automationName) : localize("automationConfigured.updated", "Edited an automation: {0}", data.automationName);
    const button = this._register(new ButtonWithIcon(this.domNode, {
      ...defaultButtonStyles,
      secondary: true,
      title: localize("automationConfigured.open", "Open automation {0}", data.automationName)
    }));
    button.element.classList.add("chat-open-session-button");
    button.label = label;
    button.icon = Codicon.watch;
    this._register(button.onDidClick(() => this.commandService.executeCommand(
      "sessionsView.manageAutomations"
    )));
  }
};
ChatAutomationConfiguredResultSubPart = __decorateClass([
  __decorateParam(4, ICommandService)
], ChatAutomationConfiguredResultSubPart);
export {
  ChatAutomationConfiguredResultSubPart
};
