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
import { localize } from "../../../../../../nls.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
const $ = dom.$;
let ChatCommandButtonContentPart = class extends Disposable {
  constructor(commandButton, context, commandService) {
    super();
    this.commandService = commandService;
    this.domNode = $(".chat-command-button");
    const enabled = !isResponseVM(context.element) || !context.element.isStale;
    this.renderButton(this.domNode, commandButton.command, enabled);
    if (commandButton.additionalCommands) {
      for (const command of commandButton.additionalCommands) {
        this.renderButton(this.domNode, command, enabled, true);
      }
    }
  }
  renderButton(container, command, enabled, secondary) {
    const tooltip = enabled ? command.tooltip : localize("commandButtonDisabled", "Button not available in restored chat");
    const button = this._register(new Button(container, { ...defaultButtonStyles, supportIcons: true, title: tooltip, secondary }));
    button.label = command.title;
    button.enabled = enabled;
    this._register(button.onDidClick(() => this.commandService.executeCommand(command.id, ...command.arguments ?? [])));
  }
  hasSameContent(other) {
    return other.kind === "command";
  }
};
ChatCommandButtonContentPart = __decorateClass([
  __decorateParam(2, ICommandService)
], ChatCommandButtonContentPart);
export {
  ChatCommandButtonContentPart
};
