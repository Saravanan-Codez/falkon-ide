var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key2, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key2) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key2, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key2, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key2) => decorator(target, key2, index);
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { joinPath, isEqualOrParent } from "../../../../../base/common/resources.js";
import { localize } from "../../../../../nls.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { IPromptsService, PromptsStorage } from "./service/promptsService.js";
import { PromptsType } from "./promptTypes.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../services/extensionManagement/common/extensionFeatures.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
var ChatContributionPoint = /* @__PURE__ */ ((ChatContributionPoint2) => {
  ChatContributionPoint2["chatInstructions"] = "chatInstructions";
  ChatContributionPoint2["chatAgents"] = "chatAgents";
  ChatContributionPoint2["chatPromptFiles"] = "chatPromptFiles";
  ChatContributionPoint2["chatSkills"] = "chatSkills";
  return ChatContributionPoint2;
})(ChatContributionPoint || {});
function registerChatFilesExtensionPoint(point) {
  return extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: point,
    jsonSchema: {
      description: localize("chatContribution.schema.description", "Contributes {0} for chat prompts.", point),
      type: "array",
      items: {
        additionalProperties: false,
        type: "object",
        defaultSnippets: [{
          body: {
            path: point === "chatSkills" /* chatSkills */ ? "./relative/path/to/skill-name/SKILL.md" : "./relative/path/to/file.md"
          }
        }],
        required: ["path"],
        properties: {
          path: {
            description: point === "chatSkills" /* chatSkills */ ? localize("chatContribution.property.path.skills", 'Path to the SKILL.md file relative to the extension root. The folder name must match the "name" property in SKILL.md.') : localize("chatContribution.property.path", "Path to the file relative to the extension root."),
            type: "string"
          },
          name: {
            description: localize("chatContribution.property.name", "(Optional) Name for this entry."),
            deprecationMessage: localize("chatContribution.property.name.deprecated", 'Specify "name" in the prompt file itself instead.'),
            type: "string"
          },
          description: {
            description: localize("chatContribution.property.description", "(Optional) Description of the entry."),
            deprecationMessage: localize("chatContribution.property.description.deprecated", 'Specify "description" in the prompt file itself instead.'),
            type: "string"
          },
          when: {
            description: localize("chatContribution.property.when", "(Optional) A condition which must be true to enable this entry."),
            type: "string"
          },
          sessionTypes: {
            description: localize("chatContribution.property.sessionTypes", "(Optional) The chat session types where this entry should be offered."),
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  });
}
const epPrompt = registerChatFilesExtensionPoint("chatPromptFiles" /* chatPromptFiles */);
const epInstructions = registerChatFilesExtensionPoint("chatInstructions" /* chatInstructions */);
const epAgents = registerChatFilesExtensionPoint("chatAgents" /* chatAgents */);
const epSkills = registerChatFilesExtensionPoint("chatSkills" /* chatSkills */);
function pointToType(contributionPoint) {
  switch (contributionPoint) {
    case "chatPromptFiles" /* chatPromptFiles */:
      return PromptsType.prompt;
    case "chatInstructions" /* chatInstructions */:
      return PromptsType.instructions;
    case "chatAgents" /* chatAgents */:
      return PromptsType.agent;
    case "chatSkills" /* chatSkills */:
      return PromptsType.skill;
    default: {
      const exhaustiveCheck = contributionPoint;
      throw new Error(`Unknown contribution point: ${exhaustiveCheck}`);
    }
  }
}
function key(extensionId, type, path) {
  return `${extensionId.value}/${type}/${path}`;
}
let ChatPromptFilesExtensionPointHandler = class {
  constructor(promptsService) {
    this.promptsService = promptsService;
    this.registrations = new DisposableMap();
    this.handle(epPrompt, "chatPromptFiles" /* chatPromptFiles */);
    this.handle(epInstructions, "chatInstructions" /* chatInstructions */);
    this.handle(epAgents, "chatAgents" /* chatAgents */);
    this.handle(epSkills, "chatSkills" /* chatSkills */);
  }
  static {
    this.ID = "workbench.contrib.chatPromptFilesExtensionPointHandler";
  }
  handle(extensionPoint, contributionPoint) {
    extensionPoint.setHandler((_extensions, delta) => {
      for (const ext of delta.added) {
        const type = pointToType(contributionPoint);
        for (const raw of ext.value) {
          if (!raw.path) {
            ext.collector.error(localize("extension.missing.path", "Extension '{0}' cannot register {1} entry without path.", ext.description.identifier.value, contributionPoint));
            continue;
          }
          const fileUri = joinPath(ext.description.extensionLocation, raw.path);
          if (!isEqualOrParent(fileUri, ext.description.extensionLocation)) {
            ext.collector.error(localize("extension.invalid.path", "Extension '{0}' {1} entry '{2}' resolves outside the extension.", ext.description.identifier.value, contributionPoint, raw.path));
            continue;
          }
          if (raw.when && !ContextKeyExpr.deserialize(raw.when)) {
            ext.collector.error(localize("extension.invalid.when", "Extension '{0}' {1} entry '{2}' has an invalid when clause: '{3}'.", ext.description.identifier.value, contributionPoint, raw.path, raw.when));
            continue;
          }
          try {
            const d = this.promptsService.registerContributedFile(type, fileUri, ext.description, raw.name, raw.description, raw.when, raw.sessionTypes);
            this.registrations.set(key(ext.description.identifier, type, raw.path), d);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            ext.collector.error(localize("extension.registration.failed", "Extension '{0}' {1}. Failed to register {2}: {3}", ext.description.identifier.value, contributionPoint, raw.path, msg));
          }
        }
      }
      for (const ext of delta.removed) {
        const type = pointToType(contributionPoint);
        for (const raw of ext.value) {
          this.registrations.deleteAndDispose(key(ext.description.identifier, type, raw.path));
        }
      }
    });
  }
};
ChatPromptFilesExtensionPointHandler = __decorateClass([
  __decorateParam(0, IPromptsService)
], ChatPromptFilesExtensionPointHandler);
CommandsRegistry.registerCommand("_listExtensionPromptFiles", async (accessor) => {
  const promptsService = accessor.get(IPromptsService);
  const [agents, instructions, prompts, skills, hooks] = await Promise.all([
    promptsService.listPromptFiles(PromptsType.agent, CancellationToken.None),
    promptsService.listPromptFiles(PromptsType.instructions, CancellationToken.None),
    promptsService.listPromptFiles(PromptsType.prompt, CancellationToken.None),
    promptsService.listPromptFiles(PromptsType.skill, CancellationToken.None),
    promptsService.listPromptFiles(PromptsType.hook, CancellationToken.None)
  ]);
  const result = [];
  for (const file of [...agents, ...instructions, ...prompts, ...skills, ...hooks]) {
    if (file.storage === PromptsStorage.extension) {
      result.push({ uri: file.uri.toJSON(), type: file.type, extensionId: file.extension.identifier.value });
    } else if (file.storage === PromptsStorage.plugin) {
      result.push({ uri: file.uri.toJSON(), type: file.type, extensionId: file.pluginUri.toString() });
    }
  }
  return result;
});
class ChatPromptFilesDataRenderer extends Disposable {
  constructor(contributionPoint) {
    super();
    this.contributionPoint = contributionPoint;
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.[this.contributionPoint];
  }
  render(manifest) {
    const contributions = manifest.contributes?.[this.contributionPoint] ?? [];
    if (!contributions.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("chatFilesName", "Name"),
      localize("chatFilesDescription", "Description"),
      localize("chatFilesPath", "Path")
    ];
    const rows = contributions.map((d) => {
      return [
        d.name ?? "-",
        d.description ?? "-",
        d.path
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "chatPromptFiles" /* chatPromptFiles */,
  label: localize("chatPromptFiles", "Chat Prompt Files"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ChatPromptFilesDataRenderer, ["chatPromptFiles" /* chatPromptFiles */])
});
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "chatInstructions" /* chatInstructions */,
  label: localize("chatInstructions", "Chat Instructions"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ChatPromptFilesDataRenderer, ["chatInstructions" /* chatInstructions */])
});
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "chatAgents" /* chatAgents */,
  label: localize("chatAgents", "Chat Agents"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ChatPromptFilesDataRenderer, ["chatAgents" /* chatAgents */])
});
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "chatSkills" /* chatSkills */,
  label: localize("chatSkills", "Chat Skills"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ChatPromptFilesDataRenderer, ["chatSkills" /* chatSkills */])
});
export {
  ChatPromptFilesExtensionPointHandler
};
