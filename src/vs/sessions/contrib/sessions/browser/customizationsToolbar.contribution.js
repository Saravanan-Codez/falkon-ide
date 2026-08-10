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
import "../../../browser/media/sidebarActionButton.css";
import "./media/customizationsToolbar.css";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { AICustomizationManagementEditor } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.js";
import { AICustomizationManagementEditorInput } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditorInput.js";
import { IAICustomizationItemsModel } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationItemsModel.js";
import { IMcpService } from "../../../../workbench/contrib/mcp/common/mcpTypes.js";
import { ILanguageModelToolsService } from "../../../../workbench/contrib/chat/common/tools/languageModelToolsService.js";
import { AGENT_HOST_COPILOT_CLI_SESSION_TYPE, countEnabledCustomizationTools, IAgentHostToolSetEnablementService } from "../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostToolSetEnablementService.js";
import { Menus } from "../../../browser/menus.js";
import { agentIcon, instructionsIcon, mcpServerIcon, pluginIcon, skillIcon, hookIcon, toolsIcon } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationIcons.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { $, append } from "../../../../base/browser/dom.js";
import { autorun } from "../../../../base/common/observable.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { AICustomizationManagementSection } from "../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { ICustomizationHarnessService } from "../../../../workbench/contrib/chat/common/customizationHarnessService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionType } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
function customizationSectionVisibleKey(section) {
  return `sessionsCustomizationSectionVisible.${section}`;
}
const CUSTOMIZATION_OVERVIEW_ITEM = {
  id: "sessions.customization.overview",
  label: localize("overview", "Overview"),
  icon: Codicon.home
};
const CUSTOMIZATION_ITEMS = [
  {
    id: "sessions.customization.agents",
    label: localize("agents", "Agents"),
    icon: agentIcon,
    section: AICustomizationManagementSection.Agents,
    modelSection: AICustomizationManagementSection.Agents
  },
  {
    id: "sessions.customization.skills",
    label: localize("skills", "Skills"),
    icon: skillIcon,
    section: AICustomizationManagementSection.Skills,
    modelSection: AICustomizationManagementSection.Skills
  },
  {
    id: "sessions.customization.instructions",
    label: localize("instructions", "Instructions"),
    icon: instructionsIcon,
    section: AICustomizationManagementSection.Instructions,
    modelSection: AICustomizationManagementSection.Instructions
  },
  {
    id: "sessions.customization.hooks",
    label: localize("hooks", "Hooks"),
    icon: hookIcon,
    section: AICustomizationManagementSection.Hooks,
    modelSection: AICustomizationManagementSection.Hooks
  },
  {
    id: "sessions.customization.mcpServers",
    label: localize("mcpServers", "MCP Servers"),
    icon: mcpServerIcon,
    section: AICustomizationManagementSection.McpServers,
    isMcp: true
  },
  {
    id: "sessions.customization.plugins",
    label: localize("plugins", "Plugins"),
    icon: pluginIcon,
    section: AICustomizationManagementSection.Plugins,
    isPlugins: true
  },
  {
    id: "sessions.customization.tools",
    label: localize("tools", "Tools"),
    icon: toolsIcon,
    section: AICustomizationManagementSection.Tools,
    isTools: true
  },
  {
    id: "sessions.customization.harnessSettings",
    label: localize("harnessSettings", "Codex"),
    icon: Codicon.openai,
    section: AICustomizationManagementSection.HarnessSettings
  }
];
async function openCustomizationOverviewPage(editorService, harnessService, sessionsService) {
  const sessionResource = sessionsService.activeSession.get()?.resource;
  if (sessionResource) {
    harnessService.setActiveSession(sessionResource);
  }
  const input = AICustomizationManagementEditorInput.getOrCreate();
  const pane = await editorService.openEditor(input, { pinned: true });
  if (pane instanceof AICustomizationManagementEditor) {
    pane.showWelcomePage();
  }
}
async function openCustomizationSectionPage(editorService, harnessService, sessionsService, section) {
  const sessionResource = sessionsService.activeSession.get()?.resource;
  if (sessionResource) {
    harnessService.setActiveSession(sessionResource);
  }
  const input = AICustomizationManagementEditorInput.getOrCreate();
  const pane = await editorService.openEditor(input, { pinned: true });
  if (pane instanceof AICustomizationManagementEditor) {
    pane.selectSectionById(section);
  }
}
let CustomizationLinkViewItem = class extends ActionViewItem {
  constructor(action, options, _config, _itemsModel, _mcpService, _toolsService, _toolEnablementService) {
    super(void 0, action, { ...options, icon: false, label: false });
    this._config = _config;
    this._itemsModel = _itemsModel;
    this._mcpService = _mcpService;
    this._toolsService = _toolsService;
    this._toolEnablementService = _toolEnablementService;
    this._viewItemDisposables = this._register(new DisposableStore());
  }
  getTooltip() {
    return void 0;
  }
  render(container) {
    super.render(container);
    container.classList.add("customization-link-widget", "sidebar-action");
    const buttonContainer = append(container, $(".customization-link-button-container"));
    this._button = this._viewItemDisposables.add(new Button(buttonContainer, {
      ...defaultButtonStyles,
      secondary: true,
      title: false,
      supportIcons: true,
      buttonSecondaryBackground: "transparent",
      buttonSecondaryHoverBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryBorder: void 0
    }));
    this._button.element.classList.add("customization-link-button", "sidebar-action-button");
    this._button.label = `$(${this._config.icon.id}) ${this._config.label}`;
    this._viewItemDisposables.add(this._button.onDidClick(() => {
      this._action.run();
    }));
    this._countContainer = append(this._button.element, $("span.customization-link-counts"));
    this._viewItemDisposables.add(autorun((reader) => {
      const count = this._readCount(reader);
      if (this._countContainer) {
        this._renderTotalCount(this._countContainer, count);
      }
    }));
  }
  _readCount(reader) {
    if (this._config.modelSection) {
      return this._itemsModel.getCount(this._config.modelSection).read(reader);
    }
    if (this._config.isMcp) {
      return this._mcpService.servers.read(reader).length;
    }
    if (this._config.isPlugins) {
      return this._itemsModel.getPluginCount().read(reader);
    }
    if (this._config.isTools) {
      const state = this._toolEnablementService.observe(AGENT_HOST_COPILOT_CLI_SESSION_TYPE).read(reader);
      const toolSets = this._toolsService.toolSets.read(reader);
      return countEnabledCustomizationTools(toolSets, state, reader);
    }
    return 0;
  }
  _renderTotalCount(container, count) {
    container.textContent = "";
    container.classList.toggle("hidden", count === 0);
    if (count > 0) {
      const badge = append(container, $("span.source-count-badge"));
      const num = append(badge, $("span.source-count-num"));
      num.textContent = `${count}`;
    }
  }
};
CustomizationLinkViewItem = __decorateClass([
  __decorateParam(3, IAICustomizationItemsModel),
  __decorateParam(4, IMcpService),
  __decorateParam(5, ILanguageModelToolsService),
  __decorateParam(6, IAgentHostToolSetEnablementService)
], CustomizationLinkViewItem);
let CustomizationsToolbarContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessionsCustomizationsToolbar";
  }
  constructor(actionViewItemService, instantiationService, harnessService, contextKeyService) {
    super();
    const visibilityKeys = /* @__PURE__ */ new Map();
    for (const config of CUSTOMIZATION_ITEMS) {
      if (!config.section) {
        continue;
      }
      const key = new RawContextKey(customizationSectionVisibleKey(config.section), true).bindTo(contextKeyService);
      visibilityKeys.set(config.section, key);
    }
    this._register(autorun((reader) => {
      const activeHarness = harnessService.activeHarness.read(reader);
      harnessService.availableHarnesses.read(reader);
      const descriptor = harnessService.getActiveDescriptor();
      const hidden = new Set(descriptor.hiddenSections ?? []);
      for (const config of CUSTOMIZATION_ITEMS) {
        if (!config.section) {
          continue;
        }
        const supported = config.section !== AICustomizationManagementSection.HarnessSettings || activeHarness === SessionType.AgentHostCodex;
        visibilityKeys.get(config.section).set(!hidden.has(config.section) && supported);
      }
    }));
    this._register(actionViewItemService.register(Menus.SidebarCustomizations, CUSTOMIZATION_OVERVIEW_ITEM.id, (action, options) => {
      return instantiationService.createInstance(CustomizationLinkViewItem, action, options, CUSTOMIZATION_OVERVIEW_ITEM);
    }, void 0));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: CUSTOMIZATION_OVERVIEW_ITEM.id,
          title: CUSTOMIZATION_OVERVIEW_ITEM.label,
          menu: {
            id: Menus.SidebarCustomizations,
            group: "navigation",
            order: 0,
            when: ChatContextKeys.enabled
          }
        });
      }
      async run(accessor) {
        await openCustomizationOverviewPage(
          accessor.get(IEditorService),
          accessor.get(ICustomizationHarnessService),
          accessor.get(ISessionsService)
        );
      }
    }));
    for (const [index, config] of CUSTOMIZATION_ITEMS.entries()) {
      if (!config.section) {
        continue;
      }
      const section = config.section;
      this._register(actionViewItemService.register(Menus.SidebarCustomizations, config.id, (action, options) => {
        return instantiationService.createInstance(CustomizationLinkViewItem, action, options, config);
      }, void 0));
      const sectionVisibleWhen = ContextKeyExpr.has(customizationSectionVisibleKey(section));
      const combinedWhen = config.when ? ContextKeyExpr.and(ChatContextKeys.enabled, sectionVisibleWhen, config.when) : ContextKeyExpr.and(ChatContextKeys.enabled, sectionVisibleWhen);
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: config.id,
            title: config.label,
            menu: {
              id: Menus.SidebarCustomizations,
              group: "navigation",
              order: index + 1,
              when: combinedWhen
            }
          });
        }
        async run(accessor) {
          const editorService = accessor.get(IEditorService);
          const harnessService2 = accessor.get(ICustomizationHarnessService);
          const sessionsService = accessor.get(ISessionsService);
          await openCustomizationSectionPage(editorService, harnessService2, sessionsService, section);
        }
      }));
    }
  }
};
CustomizationsToolbarContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ICustomizationHarnessService),
  __decorateParam(3, IContextKeyService)
], CustomizationsToolbarContribution);
registerWorkbenchContribution2(CustomizationsToolbarContribution.ID, CustomizationsToolbarContribution, WorkbenchPhase.AfterRestored);
function findHarnessIdForSession(session, harnessService) {
  if (!session) {
    return void 0;
  }
  const schemeId = session.resource.scheme;
  if (harnessService.findHarnessById(schemeId)) {
    return schemeId;
  }
  if (harnessService.findHarnessById(session.sessionType)) {
    return session.sessionType;
  }
  return void 0;
}
let ActiveSessionHarnessSyncContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessionsActiveHarnessSync";
  }
  constructor(sessionsService, harnessService) {
    super();
    this._register(autorun((reader) => {
      const session = sessionsService.activeSession.read(reader);
      if (!session) {
        return;
      }
      harnessService.availableHarnesses.read(reader);
      harnessService.setActiveSession(session.resource);
    }));
  }
};
ActiveSessionHarnessSyncContribution = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, ICustomizationHarnessService)
], ActiveSessionHarnessSyncContribution);
registerWorkbenchContribution2(ActiveSessionHarnessSyncContribution.ID, ActiveSessionHarnessSyncContribution, WorkbenchPhase.AfterRestored);
export {
  ActiveSessionHarnessSyncContribution,
  CUSTOMIZATION_ITEMS,
  CustomizationLinkViewItem,
  CustomizationsToolbarContribution,
  findHarnessIdForSession,
  openCustomizationOverviewPage
};
