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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { IChatContextService } from "./chatContextService.js";
import { isProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../../../services/extensions/common/extensionsRegistry.js";
const extensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "chatContext",
  jsonSchema: {
    description: localize("chatContextExtPoint", "Contributes chat context integrations to the chat widget."),
    type: "array",
    items: {
      type: "object",
      properties: {
        id: {
          description: localize("chatContextExtPoint.id", "A unique identifier for this item."),
          type: "string"
        },
        icon: {
          description: localize("chatContextExtPoint.icon", "The icon associated with this chat context item."),
          type: "string"
        },
        displayName: {
          description: localize("chatContextExtPoint.title", "A user-friendly name for this item which is used for display in menus."),
          type: "string"
        }
      },
      required: ["id", "icon", "displayName"]
    }
  },
  activationEventsGenerator: function* (contributions) {
    for (const contrib of contributions) {
      yield `onChatContextProvider:${contrib.id}`;
    }
  }
});
let ChatContextContribution = class extends Disposable {
  constructor(_chatContextService) {
    super();
    this._chatContextService = _chatContextService;
    extensionPoint.setHandler((extensions) => {
      for (const ext of extensions) {
        if (!isProposedApiEnabled(ext.description, "chatContextProvider")) {
          continue;
        }
        if (!Array.isArray(ext.value)) {
          continue;
        }
        for (const contribution of ext.value) {
          const icon = contribution.icon ? ThemeIcon.fromString(contribution.icon) : void 0;
          if (!icon && contribution.icon) {
            ext.collector.error(localize("chatContextExtPoint.invalidIcon", "Invalid icon format for chat context contribution '{0}'. Icon must be in the format '{1}' or '{2}', e.g. '{3}'.", contribution.id, "$(iconId)", "$(iconId~spin)", "$(copilot)"));
            continue;
          }
          if (!icon) {
            continue;
          }
          this._chatContextService.setChatContextProvider(`${ext.description.id}-${contribution.id}`, { title: contribution.displayName, icon });
        }
      }
    });
  }
  static {
    this.ID = "workbench.contrib.chatContextContribution";
  }
};
ChatContextContribution = __decorateClass([
  __decorateParam(0, IChatContextService)
], ChatContextContribution);
registerWorkbenchContribution2(ChatContextContribution.ID, ChatContextContribution, WorkbenchPhase.AfterRestored);
export {
  ChatContextContribution
};
