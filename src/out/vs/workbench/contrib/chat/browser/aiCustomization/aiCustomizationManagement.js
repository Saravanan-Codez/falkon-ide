import { RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { AICustomizationManagementSection } from "../../common/aiCustomizationWorkspaceService.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { localize } from "../../../../../nls.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { AICustomizationManagementSection as AICustomizationManagementSection2 } from "../../common/aiCustomizationWorkspaceService.js";
import { BUILTIN_STORAGE } from "../../common/aiCustomizationWorkspaceService.js";
function sectionToPromptType(section) {
  switch (section) {
    case AICustomizationManagementSection.Agents:
      return PromptsType.agent;
    case AICustomizationManagementSection.Skills:
      return PromptsType.skill;
    case AICustomizationManagementSection.Instructions:
      return PromptsType.instructions;
    case AICustomizationManagementSection.Hooks:
      return PromptsType.hook;
    case AICustomizationManagementSection.Prompts:
    default:
      return PromptsType.prompt;
  }
}
const AI_CUSTOMIZATION_MANAGEMENT_EDITOR_ID = "workbench.editor.aiCustomizationManagement";
const AI_CUSTOMIZATION_MANAGEMENT_EDITOR_INPUT_ID = "workbench.input.aiCustomizationManagement";
const AICustomizationManagementCommands = {
  OpenEditor: "aiCustomization.openManagementEditor",
  OpenMarketplace: "aiCustomization.openMarketplace",
  CreateNewAgent: "aiCustomization.createNewAgent",
  CreateNewSkill: "aiCustomization.createNewSkill",
  CreateNewInstructions: "aiCustomization.createNewInstructions",
  CreateNewPrompt: "aiCustomization.createNewPrompt",
  GenerateDebugReport: "aiCustomization.generateDebugReport"
};
const CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_EDITOR = new RawContextKey(
  "aiCustomizationManagementEditorFocused",
  false,
  localize("aiCustomizationManagementEditorFocused", "Whether the Agent Customizations editor is focused")
);
const CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_SECTION = new RawContextKey(
  "chatCustomizationSection",
  AICustomizationManagementSection.Agents,
  localize("chatCustomizationSection", "The currently selected section in the Agent Customizations editor")
);
const CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_HARNESS = new RawContextKey(
  "chatCustomizationSessionType",
  "",
  localize("chatCustomizationSessionType", "The active harness (session type) in the Agent Customizations editor")
);
const AICustomizationManagementTitleMenuId = MenuId.for("AICustomizationManagementEditorTitle");
const AICustomizationManagementItemMenuId = MenuId.for("AICustomizationManagementEditorItem");
const AICustomizationManagementCreateMenuId = MenuId.for("AICustomizationManagementCreate");
const AI_CUSTOMIZATION_ITEM_TYPE_KEY = "aiCustomizationManagementItemType";
const AI_CUSTOMIZATION_ITEM_STORAGE_KEY = "aiCustomizationManagementItemStorage";
const AI_CUSTOMIZATION_ITEM_URI_KEY = "aiCustomizationManagementItemUri";
const AI_CUSTOMIZATION_ITEM_PLUGIN_URI_KEY = "aiCustomizationManagementItemPluginUri";
const AI_CUSTOMIZATION_ITEM_DISABLED_KEY = "aiCustomizationManagementItemDisabled";
const AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY = "aiCustomizationManagement.selectedSection";
const AI_CUSTOMIZATION_MANAGEMENT_SIDEBAR_WIDTH_KEY = "aiCustomizationManagement.sidebarWidth";
const AI_CUSTOMIZATION_MANAGEMENT_SEARCH_KEY = "aiCustomizationManagement.searchQuery";
const SIDEBAR_DEFAULT_WIDTH = 200;
const SIDEBAR_MIN_WIDTH = 150;
const SIDEBAR_MAX_WIDTH = 350;
const CONTENT_MIN_WIDTH = 400;
export {
  AICustomizationManagementCommands,
  AICustomizationManagementCreateMenuId,
  AICustomizationManagementItemMenuId,
  AICustomizationManagementSection2 as AICustomizationManagementSection,
  AICustomizationManagementTitleMenuId,
  AI_CUSTOMIZATION_ITEM_DISABLED_KEY,
  AI_CUSTOMIZATION_ITEM_PLUGIN_URI_KEY,
  AI_CUSTOMIZATION_ITEM_STORAGE_KEY,
  AI_CUSTOMIZATION_ITEM_TYPE_KEY,
  AI_CUSTOMIZATION_ITEM_URI_KEY,
  AI_CUSTOMIZATION_MANAGEMENT_EDITOR_ID,
  AI_CUSTOMIZATION_MANAGEMENT_EDITOR_INPUT_ID,
  AI_CUSTOMIZATION_MANAGEMENT_SEARCH_KEY,
  AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY,
  AI_CUSTOMIZATION_MANAGEMENT_SIDEBAR_WIDTH_KEY,
  BUILTIN_STORAGE,
  CONTENT_MIN_WIDTH,
  CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_EDITOR,
  CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_HARNESS,
  CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_SECTION,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  sectionToPromptType
};
