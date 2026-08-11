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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IRemoteCodingAgentsService } from "../common/remoteCodingAgentsService.js";
const extensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "remoteCodingAgents",
  jsonSchema: {
    description: localize("remoteCodingAgentsExtPoint", "Contributes remote coding agent integrations to the chat widget."),
    type: "array",
    items: {
      type: "object",
      properties: {
        id: {
          description: localize("remoteCodingAgentsExtPoint.id", "A unique identifier for this item."),
          type: "string"
        },
        command: {
          description: localize("remoteCodingAgentsExtPoint.command", 'Identifier of the command to execute. The command must be declared in the "commands" section.'),
          type: "string"
        },
        displayName: {
          description: localize("remoteCodingAgentsExtPoint.displayName", "A user-friendly name for this item which is used for display in menus."),
          type: "string"
        },
        description: {
          description: localize("remoteCodingAgentsExtPoint.description", "Description of the remote agent for use in menus and tooltips."),
          type: "string"
        },
        followUpRegex: {
          description: localize("remoteCodingAgentsExtPoint.followUpRegex", "The last occurrence of pattern in an existing chat conversation is sent to the contributing extension to facilitate follow-up responses."),
          type: "string"
        },
        when: {
          description: localize("remoteCodingAgentsExtPoint.when", "Condition which must be true to show this item."),
          type: "string"
        }
      },
      required: ["command", "displayName"]
    }
  }
});
let RemoteCodingAgentsContribution = class extends Disposable {
  constructor(remoteCodingAgentsService) {
    super();
    this.remoteCodingAgentsService = remoteCodingAgentsService;
    extensionPoint.setHandler((extensions) => {
      for (const ext of extensions) {
        if (!isProposedApiEnabled(ext.description, "remoteCodingAgents")) {
          continue;
        }
        if (!Array.isArray(ext.value)) {
          continue;
        }
        for (const contribution of ext.value) {
          const command = MenuRegistry.getCommand(contribution.command);
          if (!command) {
            continue;
          }
          const agent = {
            id: contribution.id,
            command: contribution.command,
            displayName: contribution.displayName,
            description: contribution.description,
            followUpRegex: contribution.followUpRegex,
            when: contribution.when
          };
          this.remoteCodingAgentsService.registerAgent(agent);
        }
      }
    });
  }
};
RemoteCodingAgentsContribution = __decorateClass([
  __decorateParam(0, IRemoteCodingAgentsService)
], RemoteCodingAgentsContribution);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RemoteCodingAgentsContribution, LifecyclePhase.Restored);
export {
  RemoteCodingAgentsContribution
};
