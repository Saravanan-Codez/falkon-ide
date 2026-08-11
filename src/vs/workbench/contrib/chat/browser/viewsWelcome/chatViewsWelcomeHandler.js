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
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { checkProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { ChatViewsWelcomeExtensions } from "./chatViewsWelcome.js";
const chatViewsWelcomeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["icon", "title", "contents", "when"],
  properties: {
    icon: {
      type: "string",
      description: localize("chatViewsWelcome.icon", "The icon for the welcome message.")
    },
    title: {
      type: "string",
      description: localize("chatViewsWelcome.title", "The title of the welcome message.")
    },
    content: {
      type: "string",
      description: localize("chatViewsWelcome.content", "The content of the welcome message. The first command link will be rendered as a button.")
    },
    when: {
      type: "string",
      description: localize("chatViewsWelcome.when", "Condition when the welcome message is shown.")
    }
  }
};
const chatViewsWelcomeExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "chatViewsWelcome",
  jsonSchema: {
    description: localize("vscode.extension.contributes.chatViewsWelcome", "Contributes a welcome message to a chat view"),
    type: "array",
    items: chatViewsWelcomeJsonSchema
  }
});
let ChatViewsWelcomeHandler = class {
  constructor(logService) {
    this.logService = logService;
    chatViewsWelcomeExtensionPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        for (const providerDescriptor of extension.value) {
          checkProposedApiEnabled(extension.description, "chatParticipantPrivate");
          const when = ContextKeyExpr.deserialize(providerDescriptor.when);
          if (!when) {
            this.logService.error(`Could not deserialize 'when' clause for chatViewsWelcome contribution: ${providerDescriptor.when}`);
            continue;
          }
          const descriptor = {
            ...providerDescriptor,
            when,
            icon: ThemeIcon.fromString(providerDescriptor.icon),
            content: new MarkdownString(providerDescriptor.content, { isTrusted: true })
            // private API with command links
          };
          Registry.as(ChatViewsWelcomeExtensions.ChatViewsWelcomeRegistry).register(descriptor);
        }
      }
    });
  }
  static {
    this.ID = "workbench.contrib.chatViewsWelcomeHandler";
  }
};
ChatViewsWelcomeHandler = __decorateClass([
  __decorateParam(0, ILogService)
], ChatViewsWelcomeHandler);
export {
  ChatViewsWelcomeHandler
};
