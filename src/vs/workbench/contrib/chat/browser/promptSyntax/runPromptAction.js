import { ChatViewId, IChatWidgetService } from "../chat.js";
import { ACTION_ID_NEW_CHAT, CHAT_CATEGORY, CHAT_CONFIG_MENU_ID } from "../actions/chatActions.js";
import { OS } from "../../../../../base/common/platform.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { assertDefined } from "../../../../../base/common/types.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { PromptsType, PROMPT_LANGUAGE_ID } from "../../common/promptSyntax/promptTypes.js";
import { localize, localize2 } from "../../../../../nls.js";
import { UILabelProvider } from "../../../../../base/common/keybindingLabels.js";
import { PromptFilePickers } from "./pickers/promptFilePickers.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ResourceContextKey } from "../../../../common/contextkeys.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
const EDITOR_ACTIONS_CONDITION = ContextKeyExpr.and(
  ChatContextKeys.enabled,
  ResourceContextKey.HasResource,
  ResourceContextKey.LangId.isEqualTo(PROMPT_LANGUAGE_ID)
);
const COMMAND_KEY_BINDING = KeyMod.WinCtrl | KeyCode.Slash | KeyMod.Alt;
const RUN_CURRENT_PROMPT_ACTION_ID = "workbench.action.chat.run.prompt.current";
const RUN_SELECTED_PROMPT_ACTION_ID = "workbench.action.chat.run.prompt";
const CONFIGURE_PROMPTS_ACTION_ID = "workbench.action.chat.configure.prompts";
class RunPromptBaseAction extends Action2 {
  constructor(options) {
    super({
      id: options.id,
      title: options.title,
      f1: false,
      precondition: ChatContextKeys.enabled,
      category: CHAT_CATEGORY,
      icon: options.icon,
      keybinding: {
        when: ContextKeyExpr.and(
          EditorContextKeys.editorTextFocus,
          EDITOR_ACTIONS_CONDITION
        ),
        weight: KeybindingWeight.WorkbenchContrib,
        primary: options.keybinding
      },
      menu: [
        {
          id: MenuId.EditorTitleRun,
          group: "navigation",
          order: options.alt ? 0 : 1,
          alt: options.alt,
          when: EDITOR_ACTIONS_CONDITION
        }
      ]
    });
  }
  /**
   * Executes the run prompt action with provided options.
   */
  async execute(resource, inNewChat, accessor) {
    const commandService = accessor.get(ICommandService);
    const promptsService = accessor.get(IPromptsService);
    const widgetService = accessor.get(IChatWidgetService);
    resource ||= getActivePromptFileUri(accessor);
    assertDefined(
      resource,
      "Cannot find URI resource for an active text editor."
    );
    if (inNewChat === true) {
      await commandService.executeCommand(ACTION_ID_NEW_CHAT);
    }
    const widget = await widgetService.revealWidget();
    if (widget) {
      widget.setInput(`/${await promptsService.getPromptSlashCommandName(resource, CancellationToken.None)}`);
      await widget.acceptInput();
    }
    return widget;
  }
}
const RUN_CURRENT_PROMPT_ACTION_TITLE = localize2(
  "run-prompt.capitalized",
  "Run Prompt in Current Chat"
);
const RUN_CURRENT_PROMPT_ACTION_ICON = Codicon.playCircle;
class RunCurrentPromptAction extends RunPromptBaseAction {
  constructor() {
    super({
      id: RUN_CURRENT_PROMPT_ACTION_ID,
      title: RUN_CURRENT_PROMPT_ACTION_TITLE,
      icon: RUN_CURRENT_PROMPT_ACTION_ICON,
      keybinding: COMMAND_KEY_BINDING
    });
  }
  async run(accessor, resource) {
    return await super.execute(
      resource,
      false,
      accessor
    );
  }
}
class RunSelectedPromptAction extends Action2 {
  constructor() {
    super({
      id: RUN_SELECTED_PROMPT_ACTION_ID,
      title: localize2("run-prompt.capitalized.ellipses", "Run Prompt..."),
      icon: Codicon.bookmark,
      f1: true,
      precondition: ChatContextKeys.enabled,
      keybinding: {
        when: ChatContextKeys.enabled,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: COMMAND_KEY_BINDING
      },
      category: CHAT_CATEGORY
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    const instaService = accessor.get(IInstantiationService);
    const promptsService = accessor.get(IPromptsService);
    const widgetService = accessor.get(IChatWidgetService);
    const pickers = instaService.createInstance(PromptFilePickers);
    const placeholder = localize(
      "commands.prompt.select-dialog.placeholder",
      "Select the prompt file to run (hold {0}-key to use in new chat)",
      UILabelProvider.modifierLabels[OS].ctrlKey
    );
    const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.prompt });
    if (result === void 0) {
      return;
    }
    const { promptFile, keyMods } = result;
    if (keyMods.ctrlCmd === true) {
      await commandService.executeCommand(ACTION_ID_NEW_CHAT);
    }
    const widget = await widgetService.revealWidget();
    if (widget) {
      widget.setInput(`/${await promptsService.getPromptSlashCommandName(promptFile, CancellationToken.None)}`);
      await widget.acceptInput();
      widget.focusInput();
    }
  }
}
class ManagePromptFilesAction extends Action2 {
  constructor() {
    super({
      id: CONFIGURE_PROMPTS_ACTION_ID,
      title: localize2("configure-prompts", "Configure Prompt Files..."),
      shortTitle: localize2("configure-prompts.short", "Prompt Files"),
      icon: Codicon.bookmark,
      f1: true,
      precondition: ChatContextKeys.enabled,
      category: CHAT_CATEGORY,
      menu: {
        id: CHAT_CONFIG_MENU_ID,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals("view", ChatViewId)),
        order: 11,
        group: "0_level"
      }
    });
  }
  async run(accessor) {
    const openerService = accessor.get(IOpenerService);
    const instaService = accessor.get(IInstantiationService);
    const pickers = instaService.createInstance(PromptFilePickers);
    const placeholder = localize(
      "commands.prompt.manage-dialog.placeholder",
      "Select the prompt file to open"
    );
    const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.prompt, optionEdit: false });
    if (result !== void 0) {
      await openerService.open(result.promptFile);
    }
  }
}
function getActivePromptFileUri(accessor) {
  const codeEditorService = accessor.get(ICodeEditorService);
  const model = codeEditorService.getActiveCodeEditor()?.getModel();
  if (model?.getLanguageId() === PROMPT_LANGUAGE_ID) {
    return model.uri;
  }
  return void 0;
}
const RUN_CURRENT_PROMPT_IN_NEW_CHAT_ACTION_ID = "workbench.action.chat.run-in-new-chat.prompt.current";
const RUN_IN_NEW_CHAT_ACTION_TITLE = localize2(
  "run-prompt-in-new-chat.capitalized",
  "Run Prompt In New Chat"
);
const RUN_IN_NEW_CHAT_ACTION_ICON = Codicon.play;
class RunCurrentPromptInNewChatAction extends RunPromptBaseAction {
  constructor() {
    super({
      id: RUN_CURRENT_PROMPT_IN_NEW_CHAT_ACTION_ID,
      title: RUN_IN_NEW_CHAT_ACTION_TITLE,
      icon: RUN_IN_NEW_CHAT_ACTION_ICON,
      keybinding: COMMAND_KEY_BINDING | KeyMod.CtrlCmd,
      alt: {
        id: RUN_CURRENT_PROMPT_ACTION_ID,
        title: RUN_CURRENT_PROMPT_ACTION_TITLE,
        icon: RUN_CURRENT_PROMPT_ACTION_ICON
      }
    });
  }
  async run(accessor, resource) {
    return await super.execute(
      resource,
      true,
      accessor
    );
  }
}
function registerRunPromptActions() {
  registerAction2(RunCurrentPromptInNewChatAction);
  registerAction2(RunCurrentPromptAction);
  registerAction2(RunSelectedPromptAction);
  registerAction2(ManagePromptFilesAction);
}
export {
  CONFIGURE_PROMPTS_ACTION_ID,
  registerRunPromptActions
};
