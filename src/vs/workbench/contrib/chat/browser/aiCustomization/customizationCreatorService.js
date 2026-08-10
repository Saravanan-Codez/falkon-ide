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
import { IAICustomizationWorkspaceService } from "../../common/aiCustomizationWorkspaceService.js";
import { IChatWidgetService } from "../chat.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatModeKind } from "../../common/constants.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { getPromptFileDefaultLocations } from "../../common/promptSyntax/config/promptFileLocations.js";
import { IPromptsService, PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { URI } from "../../../../../base/common/uri.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { localize } from "../../../../../nls.js";
import { ICustomizationHarnessService } from "../../common/customizationHarnessService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { PromptsServiceCustomizationItemProvider } from "./promptsServiceCustomizationItemProvider.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
let CustomizationCreatorService = class {
  constructor(commandService, chatService, chatWidgetService, workspaceService, promptsService, quickInputService, instantiationService, harnessService) {
    this.commandService = commandService;
    this.chatService = chatService;
    this.chatWidgetService = chatWidgetService;
    this.workspaceService = workspaceService;
    this.promptsService = promptsService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.harnessService = harnessService;
  }
  async createWithAI(type) {
    const currentSessionResource = this.harnessService.activeSessionResource.get();
    const typeLabel = getTypeLabel(type);
    const name = await this.quickInputService.input({
      prompt: localize("generateName", "Name for the new {0}", typeLabel),
      placeHolder: localize("generateNamePlaceholder", "e.g., my-{0}", typeLabel),
      validateInput: async (value) => {
        if (!value || !value.trim()) {
          return localize("nameRequired", "Name is required");
        }
        return void 0;
      }
    });
    if (!name) {
      return;
    }
    const trimmedName = name.trim();
    const picker = this.instantiationService.createInstance(CustomizationLocationPicker);
    const targetDir = await picker.resolveTargetDirectoryWithPicker(
      currentSessionResource,
      type,
      "local"
    );
    if (targetDir === null) {
      return;
    }
    const systemInstructions = buildAgentInstructions(type, targetDir, trimmedName);
    const userMessage = buildUserMessage(type, targetDir, trimmedName);
    await this.commandService.executeCommand("workbench.action.chat.newChat");
    const widget = this.chatWidgetService.lastFocusedWidget;
    const sessionResource = widget?.viewModel?.sessionResource;
    if (!sessionResource) {
      return;
    }
    await this.chatService.sendRequest(sessionResource, userMessage, {
      modeInfo: {
        kind: ChatModeKind.Agent,
        isBuiltin: false,
        telemetryModeId: "custom",
        applyCodeBlockSuggestionId: void 0,
        modeInstructions: {
          name: "customization-creator",
          content: systemInstructions,
          toolReferences: [],
          allowedSubagents: void 0
        }
      }
    });
  }
  /**
   * Resolves the workspace directory for a new customization file based on the
   * active project root.
   */
  resolveTargetDirectory(type) {
    return resolveWorkspaceTargetDirectory(this.workspaceService, type);
  }
  /**
   * Resolves the user-level directory for a new customization file.
   */
  async resolveUserDirectory(type) {
    return resolveUserTargetDirectory(this.promptsService, type);
  }
};
CustomizationCreatorService = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IChatService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, IAICustomizationWorkspaceService),
  __decorateParam(4, IPromptsService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ICustomizationHarnessService)
], CustomizationCreatorService);
let CustomizationLocationPicker = class {
  constructor(quickInputService, harnessService, instantiationService, labelService) {
    this.quickInputService = quickInputService;
    this.harnessService = harnessService;
    this.instantiationService = instantiationService;
    this.labelService = labelService;
  }
  /**
   * Resolves the target directory for creating a new customization file.
   * If multiple source folders exist for the given storage type, shows a
   * picker to let the user choose. Otherwise, returns the single match.
   *
   * Source folders come from the active harness's item provider (via the
   * items model) — each session can supply its own set of customization
   * locations through `ICustomizationItemProvider.provideSourceFolders`.
   *
   * @returns the resolved URI, `undefined` when no folder is available,
   *          or `null` when the user cancelled the picker.
   */
  async resolveTargetDirectoryWithPicker(sessionResource, type, target) {
    const sessionType = getChatSessionType(sessionResource);
    const descriptor = this.harnessService.findHarnessById(sessionType);
    const provider = descriptor?.itemProvider ?? this.instantiationService.createInstance(PromptsServiceCustomizationItemProvider);
    if (!provider.provideSourceFolders) {
      return void 0;
    }
    const allFolders = await provider.provideSourceFolders(sessionResource, type, CancellationToken.None);
    if (!allFolders) {
      return void 0;
    }
    const matchingFolders = allFolders.filter((f) => f.source === target);
    if (matchingFolders.length === 0) {
      return void 0;
    }
    const items = matchingFolders.map((folder) => ({
      label: folder.label,
      description: this.labelService.getUriLabel(folder.uri, { relative: true }),
      uri: folder.uri
    }));
    const picked = await this.quickInputService.pick(items, {
      placeHolder: localize("selectTargetDirectory", "Select a directory for the new customization file")
    });
    return picked?.uri ?? null;
  }
};
CustomizationLocationPicker = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, ICustomizationHarnessService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILabelService)
], CustomizationLocationPicker);
function resolveWorkspaceTargetDirectory(workspaceService, type) {
  const basePath = workspaceService.getActiveProjectRoot();
  if (!basePath) {
    return void 0;
  }
  const defaultLocations = getPromptFileDefaultLocations(type);
  const localLocation = defaultLocations.find((loc) => loc.storage === PromptsStorage.local);
  if (!localLocation) {
    return basePath;
  }
  return URI.joinPath(basePath, localLocation.path);
}
async function resolveUserTargetDirectory(promptsService, type) {
  const folders = await promptsService.getSourceFolders(type);
  const userFolder = folders.find((f) => f.storage === PromptsStorage.user);
  return userFolder?.uri;
}
function buildAgentInstructions(type, targetDir, name) {
  const targetHint = targetDir ? `
IMPORTANT: Save the file to this directory: ${targetDir.fsPath}. The name is "${name}".` : `
The name is "${name}".`;
  const writePolicy = `

CRITICAL WORKFLOW:
- In your VERY FIRST response, you MUST immediately create the file on disk from a starter template with placeholder content. Do not ask questions first -- write the file first so it appears in the diff view, then ask the user how they want to customize it.
- Every subsequent message from the user should result in you updating that same file on disk with the requested changes.
- Always write the complete file content, not partial diffs.${targetHint}`;
  switch (type) {
    case PromptsType.agent:
      return `You are a helpful assistant that guides users through creating a new custom AI agent.${writePolicy}

Create a file named "${name}.agent.md" with YAML frontmatter (name, description, tools) and system instructions. Ask the user what it should do.`;
    case PromptsType.skill:
      return `You are a helpful assistant that guides users through creating a new skill.${writePolicy}

Create a directory named "${name}" with a SKILL.md file inside it. The file should have YAML frontmatter (name, description) and instructions. Ask the user what it does.`;
    case PromptsType.instructions:
      return `You are a helpful assistant that guides users through creating a new instructions file.${writePolicy}

Create a file named "${name}.instructions.md" with YAML frontmatter (description, optional applyTo) and actionable content. Ask the user what it should cover.`;
    case PromptsType.prompt:
      return `You are a helpful assistant that guides users through creating a new reusable prompt.${writePolicy}

Create a file named "${name}.prompt.md" with YAML frontmatter (name, description) and prompt content. Ask the user what it should do.`;
    case PromptsType.hook:
      return `You are a helpful assistant that guides users through creating a new hook.${writePolicy}

Ask the user when the hook should trigger and what it should do, then write the configuration file.`;
    default:
      return `You are a helpful assistant that guides users through creating a new AI customization file.${writePolicy}

Ask the user what they want to create, then guide them step by step.`;
  }
}
function buildUserMessage(type, targetDir, name) {
  const pathHint = targetDir ? ` Write it to \`${targetDir.fsPath}\`.` : "";
  switch (type) {
    case PromptsType.agent:
      return `Help me create a new custom agent called "${name}".${pathHint}`;
    case PromptsType.skill:
      return `Help me create a new skill called "${name}".${pathHint}`;
    case PromptsType.instructions:
      return `Help me create new instructions called "${name}".${pathHint}`;
    case PromptsType.prompt:
      return `Help me create a new prompt called "${name}".${pathHint}`;
    case PromptsType.hook:
      return `Help me create a new hook called "${name}".${pathHint}`;
    default:
      return `Help me create a new customization called "${name}".${pathHint}`;
  }
}
function getTypeLabel(type) {
  switch (type) {
    case PromptsType.agent:
      return "agent";
    case PromptsType.skill:
      return "skill";
    case PromptsType.instructions:
      return "instructions";
    case PromptsType.prompt:
      return "prompt";
    case PromptsType.hook:
      return "hook";
    default:
      return "customization";
  }
}
export {
  CustomizationCreatorService,
  CustomizationLocationPicker,
  resolveUserTargetDirectory,
  resolveWorkspaceTargetDirectory
};
