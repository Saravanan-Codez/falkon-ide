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
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IProgressService, ProgressLocation } from "../../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../../browser/editor.js";
import { EditorExtensions } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ResourceContextKey } from "../../../../common/contextkeys.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { ChatEntitlementContextKeys } from "../../../../services/chat/common/chatEntitlementService.js";
import { CONTEXT_MODELS_EDITOR, CONTEXT_MODELS_SEARCH_FOCUS, MANAGE_CHAT_COMMAND_ID } from "../../common/constants.js";
import { CHAT_CATEGORY } from "../actions/chatActions.js";
import { ModelsManagementEditor } from "./chatManagementEditor.js";
import { ModelsManagementEditorInput } from "./chatManagementEditorInput.js";
import { ILanguageModelsConfigurationService } from "../../common/languageModelsConfiguration.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { EnablementState, IWorkbenchExtensionEnablementService } from "../../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
const languageModelsOpenSettingsIcon = registerIcon("language-models-open-settings", Codicon.goToFile, localize("languageModelsOpenSettings", "Icon for open language models settings commands."));
const LANGUAGE_MODELS_ENTITLEMENT_PRECONDITION = ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(
  ChatContextKeys.Entitlement.planFree,
  ChatContextKeys.Entitlement.planEdu,
  ChatContextKeys.Entitlement.planPro,
  ChatContextKeys.Entitlement.planProPlus,
  ChatContextKeys.Entitlement.planMax,
  ChatContextKeys.Entitlement.planBusiness,
  ChatContextKeys.Entitlement.planEnterprise,
  ChatContextKeys.Entitlement.internal,
  ChatEntitlementContextKeys.clientByokEnabled
));
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    ModelsManagementEditor,
    ModelsManagementEditor.ID,
    localize("modelsManagementEditor", "Models Management Editor")
  ),
  [
    new SyncDescriptor(ModelsManagementEditorInput)
  ]
);
class ModelsManagementEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(input) {
    return "";
  }
  deserialize(instantiationService) {
    return instantiationService.createInstance(ModelsManagementEditorInput);
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ModelsManagementEditorInput.ID, ModelsManagementEditorInputSerializer);
async function ensureChatExtensionEnabled(accessor) {
  const chatExtensionId = accessor.get(IProductService).defaultChatAgent?.chatExtensionId;
  if (!chatExtensionId) {
    return;
  }
  const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
  const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
  const progressService = accessor.get(IProgressService);
  const localExtensions = await extensionsWorkbenchService.queryLocal();
  const chatExtension = localExtensions.find((e) => ExtensionIdentifier.equals(e.identifier.id, chatExtensionId));
  if (!chatExtension?.local || extensionEnablementService.isEnabled(chatExtension.local)) {
    return;
  }
  await progressService.withProgress(
    { location: ProgressLocation.Window, title: localize("enableChatForByok", "Enabling AI features\u2026") },
    async () => {
      await extensionsWorkbenchService.setEnablement([chatExtension], EnablementState.EnabledGlobally);
      await extensionsWorkbenchService.updateRunningExtensions(localize("enableChatForByokReason", "Enabling AI features"));
    }
  );
}
let ChatManagementActionsContribution = class extends Disposable {
  constructor(languageModelsConfigurationService) {
    super();
    this.languageModelsConfigurationService = languageModelsConfigurationService;
    this.registerChatManagementActions();
    this.registerLanguageModelsEditorTitleActions();
  }
  static {
    this.ID = "workbench.contrib.chatManagementActions";
  }
  registerChatManagementActions() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: MANAGE_CHAT_COMMAND_ID,
          title: localize2("openAiManagement", "Manage Language Models"),
          category: CHAT_CATEGORY,
          precondition: LANGUAGE_MODELS_ENTITLEMENT_PRECONDITION,
          f1: true
        });
      }
      async run(accessor, searchQuery) {
        const editorService = accessor.get(IEditorService);
        await ensureChatExtensionEnabled(accessor);
        const pane = await editorService.openEditor(new ModelsManagementEditorInput(), { pinned: true });
        if (searchQuery && pane instanceof ModelsManagementEditor) {
          pane.search(searchQuery);
        }
        return pane;
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "chat.models.action.clearSearchResults",
          precondition: CONTEXT_MODELS_EDITOR,
          keybinding: {
            primary: KeyCode.Escape,
            weight: KeybindingWeight.EditorContrib,
            when: CONTEXT_MODELS_SEARCH_FOCUS
          },
          title: localize2("models.clearResults", "Clear Models Search Results")
        });
      }
      run(accessor) {
        const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
        if (activeEditorPane instanceof ModelsManagementEditor) {
          activeEditorPane.clearSearch();
        }
        return null;
      }
    }));
    const openLanguageModelsJsonWhen = ContextKeyExpr.and(
      CONTEXT_MODELS_EDITOR,
      LANGUAGE_MODELS_ENTITLEMENT_PRECONDITION
    );
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openLanguageModelsJson",
          title: localize2("openLanguageModelsJson", "Open Language Models (JSON)"),
          category: CHAT_CATEGORY,
          precondition: LANGUAGE_MODELS_ENTITLEMENT_PRECONDITION,
          icon: languageModelsOpenSettingsIcon,
          f1: true,
          menu: [{
            id: MenuId.EditorTitle,
            when: openLanguageModelsJsonWhen,
            group: "navigation",
            order: 1
          }, {
            id: MenuId.ModalEditorEditorTitle,
            when: openLanguageModelsJsonWhen,
            group: "navigation",
            order: 1
          }]
        });
      }
      async run(accessor) {
        const languageModelsConfigurationService = accessor.get(ILanguageModelsConfigurationService);
        await languageModelsConfigurationService.configureLanguageModels();
      }
    }));
  }
  registerLanguageModelsEditorTitleActions() {
    const modelsConfigurationFile = this.languageModelsConfigurationService.configurationFile;
    const openModelsManagementEditorWhen = ContextKeyExpr.and(
      CONTEXT_MODELS_EDITOR.toNegated(),
      ResourceContextKey.Resource.isEqualTo(modelsConfigurationFile.toString()),
      ContextKeyExpr.not("isInDiffEditor"),
      LANGUAGE_MODELS_ENTITLEMENT_PRECONDITION
    );
    MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
      command: {
        id: MANAGE_CHAT_COMMAND_ID,
        title: localize2("openAiManagement", "Manage Language Models"),
        icon: languageModelsOpenSettingsIcon
      },
      when: openModelsManagementEditorWhen,
      group: "navigation",
      order: 1
    });
  }
};
ChatManagementActionsContribution = __decorateClass([
  __decorateParam(0, ILanguageModelsConfigurationService)
], ChatManagementActionsContribution);
registerWorkbenchContribution2(ChatManagementActionsContribution.ID, ChatManagementActionsContribution, WorkbenchPhase.AfterRestored);
