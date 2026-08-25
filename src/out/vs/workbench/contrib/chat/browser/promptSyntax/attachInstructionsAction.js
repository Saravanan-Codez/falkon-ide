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
import { ChatViewId } from "../chat.js";
import { CHAT_CATEGORY, CHAT_CONFIG_MENU_ID } from "../actions/chatActions.js";
import { localize, localize2 } from "../../../../../nls.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { PromptFilePickers } from "./pickers/promptFilePickers.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { getCleanPromptName } from "../../common/promptSyntax/config/promptFileLocations.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { compare } from "../../../../../base/common/strings.js";
import { PromptFileVariableKind, toPromptFileVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
const ATTACH_INSTRUCTIONS_ACTION_ID = "workbench.action.chat.attach.instructions";
const CONFIGURE_INSTRUCTIONS_ACTION_ID = "workbench.action.chat.configure.instructions";
class ManageInstructionsFilesAction extends Action2 {
  constructor() {
    super({
      id: CONFIGURE_INSTRUCTIONS_ACTION_ID,
      title: localize2("configure-instructions", "Configure Instructions & Rules..."),
      shortTitle: localize2("configure-instructions.short", "Instructions & Rules"),
      icon: Codicon.bookmark,
      f1: true,
      precondition: ChatContextKeys.enabled,
      category: CHAT_CATEGORY,
      menu: {
        id: CHAT_CONFIG_MENU_ID,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals("view", ChatViewId)),
        order: 10,
        group: "1_level"
      }
    });
  }
  async run(accessor) {
    const openerService = accessor.get(IOpenerService);
    const instaService = accessor.get(IInstantiationService);
    const pickers = instaService.createInstance(PromptFilePickers);
    const placeholder = localize(
      "commands.prompt.manage-dialog.placeholder",
      "Select the instructions file to open"
    );
    const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.instructions, optionEdit: false });
    if (result !== void 0) {
      await openerService.open(result.promptFile);
    }
  }
}
function registerAttachPromptActions() {
  registerAction2(ManageInstructionsFilesAction);
}
let ChatInstructionsPickerPick = class {
  constructor(promptsService) {
    this.promptsService = promptsService;
    this.type = "pickerPick";
    this.label = localize("chatContext.attach.instructions.label", "Instructions...");
    this.icon = Codicon.bookmark;
    this.commandId = ATTACH_INSTRUCTIONS_ACTION_ID;
  }
  isEnabled(widget) {
    return !!widget.attachmentCapabilities.supportsInstructionAttachments;
  }
  asPicker() {
    const picks = this.promptsService.listPromptFiles(PromptsType.instructions, CancellationToken.None).then((value) => {
      const result = [];
      value = value.slice(0).sort((a, b) => compare(a.storage, b.storage));
      let storageType;
      for (const promptsPath of value) {
        if (storageType !== promptsPath.storage) {
          storageType = promptsPath.storage;
          result.push({
            type: "separator",
            label: this.promptsService.getPromptLocationLabel(promptsPath)
          });
        }
        result.push({
          label: promptsPath.name ?? getCleanPromptName(promptsPath.uri),
          asAttachment: () => {
            return toPromptFileVariableEntry(promptsPath.uri, PromptFileVariableKind.Instruction);
          }
        });
      }
      return result;
    });
    return {
      placeholder: localize("placeholder", "Select instructions files to attach"),
      picks,
      configure: {
        label: localize("configureInstructions", "Configure Instructions..."),
        commandId: CONFIGURE_INSTRUCTIONS_ACTION_ID
      }
    };
  }
};
ChatInstructionsPickerPick = __decorateClass([
  __decorateParam(0, IPromptsService)
], ChatInstructionsPickerPick);
export {
  ATTACH_INSTRUCTIONS_ACTION_ID,
  CONFIGURE_INSTRUCTIONS_ACTION_ID,
  ChatInstructionsPickerPick,
  registerAttachPromptActions
};
