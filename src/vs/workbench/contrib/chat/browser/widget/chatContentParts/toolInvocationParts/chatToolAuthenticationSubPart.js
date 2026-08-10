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
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { localize } from "../../../../../../../nls.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IAgentHostCustomizationService } from "../../../../browser/agentSessions/agentHost/agentHostCustomizationService.js";
import { IChatToolInvocation } from "../../../../common/chatService/chatService.js";
import { IChatWidgetService } from "../../../chat.js";
import { ChatCustomConfirmationWidget } from "../chatConfirmationWidget.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
let ChatToolAuthenticationSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, context, instantiationService, customizationService, chatWidgetService) {
    super(toolInvocation);
    this.codeblocks = [];
    const state = toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForAuthentication) {
      throw new Error("Tool authentication state is missing");
    }
    const widget = this._register(instantiationService.createInstance(
      ChatCustomConfirmationWidget,
      context,
      {
        title: localize("chat.toolAuthentication.title", "MCP authentication required"),
        icon: Codicon.mcp,
        subtitle: state.server.name,
        buttons: [
          {
            label: localize("chat.toolAuthentication.authenticate", "Authenticate"),
            data: async () => {
              await customizationService.authenticateMcpServer(context.element.sessionResource, state.server.id);
            }
          },
          {
            label: localize("chat.toolAuthentication.cancel", "Cancel"),
            data: async () => {
              state.cancel();
            },
            isSecondary: true
          }
        ],
        message: localize("chat.toolAuthentication.message", "The MCP server {0} requires authentication to continue this tool call.", state.server.name),
        toolbarData: {
          arg: toolInvocation,
          partType: "chatToolAuthentication",
          partSource: toolInvocation.source.type
        }
      }
    ));
    this._register(widget.onDidClick(async ({ button, isTouchClick }) => {
      await button.data();
      if (!isTouchClick) {
        chatWidgetService.getWidgetBySessionResource(context.element.sessionResource)?.focusInput();
      }
    }));
    this.domNode = widget.domNode;
  }
};
ChatToolAuthenticationSubPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IAgentHostCustomizationService),
  __decorateParam(4, IChatWidgetService)
], ChatToolAuthenticationSubPart);
export {
  ChatToolAuthenticationSubPart
};
