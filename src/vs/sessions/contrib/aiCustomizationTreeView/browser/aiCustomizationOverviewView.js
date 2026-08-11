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
import "./media/aiCustomizationManagement.css";
import * as DOM from "../../../../base/browser/dom.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { autorun } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ViewPane } from "../../../../workbench/browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../../workbench/common/views.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { IPromptsService } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js";
import { PromptsType } from "../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js";
import { AICustomizationManagementSection, AI_CUSTOMIZATION_MANAGEMENT_EDITOR_ID } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.js";
import { AICustomizationManagementEditorInput } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditorInput.js";
import { agentIcon, instructionsIcon, mcpServerIcon, pluginIcon, skillIcon, toolsIcon } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationIcons.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IAICustomizationWorkspaceService } from "../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { IMcpService } from "../../../../workbench/contrib/mcp/common/mcpTypes.js";
import { IAgentPluginService } from "../../../../workbench/contrib/chat/common/plugins/agentPluginService.js";
import { ILanguageModelToolsService } from "../../../../workbench/contrib/chat/common/tools/languageModelToolsService.js";
import { AGENT_HOST_COPILOT_CLI_SESSION_TYPE, countEnabledCustomizationTools, IAgentHostToolSetEnablementService } from "../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostToolSetEnablementService.js";
const $ = DOM.$;
const AI_CUSTOMIZATION_OVERVIEW_VIEW_ID = "workbench.view.aiCustomizationOverview";
function isWelcomePageEditor(editor) {
  return typeof editor?.showWelcomePage === "function";
}
let AICustomizationOverviewView = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, editorService, promptsService, workspaceContextService, workspaceService, mcpService, agentPluginService, languageModelToolsService, toolEnablementService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.editorService = editorService;
    this.promptsService = promptsService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceService = workspaceService;
    this.mcpService = mcpService;
    this.agentPluginService = agentPluginService;
    this.languageModelToolsService = languageModelToolsService;
    this.toolEnablementService = toolEnablementService;
    this.sections = [];
    this.countElements = /* @__PURE__ */ new Map();
    this.sectionElements = /* @__PURE__ */ new Map();
    this.sections.push(
      { id: AICustomizationManagementSection.Agents, label: localize("agents", "Agents"), icon: agentIcon, count: 0 },
      { id: AICustomizationManagementSection.Skills, label: localize("skills", "Skills"), icon: skillIcon, count: 0 },
      { id: AICustomizationManagementSection.Instructions, label: localize("instructions", "Instructions"), icon: instructionsIcon, count: 0 }
    );
    this.sections.push(
      { id: AICustomizationManagementSection.McpServers, label: localize("mcpServers", "MCP Servers"), icon: mcpServerIcon, count: 0 },
      { id: AICustomizationManagementSection.Plugins, label: localize("plugins", "Plugins"), icon: pluginIcon, count: 0 },
      { id: AICustomizationManagementSection.Tools, label: localize("tools", "Tools"), icon: toolsIcon, count: 0 }
    );
    this._register(this.promptsService.onDidChangeCustomAgents(() => this.loadCounts()));
    this._register(this.promptsService.onDidChangeSlashCommands(() => this.loadCounts()));
    this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this.loadCounts()));
    this._register(autorun((reader) => {
      this.workspaceService.activeProjectRoot.read(reader);
      this.loadCounts();
    }));
  }
  renderBody(container) {
    super.renderBody(container);
    this.bodyElement = container;
    this.container = DOM.append(container, $(".ai-customization-overview"));
    this.sectionsContainer = DOM.append(this.container, $(".overview-sections"));
    this.renderSections();
    void this.loadCounts();
    this.layoutBody(this.bodyElement.offsetHeight, this.bodyElement.offsetWidth);
  }
  renderSections() {
    DOM.clearNode(this.sectionsContainer);
    this.countElements.clear();
    this.sectionElements.clear();
    for (const section of this.sections) {
      const sectionElement = DOM.append(this.sectionsContainer, $(".overview-section"));
      sectionElement.tabIndex = 0;
      sectionElement.setAttribute("role", "button");
      sectionElement.setAttribute("aria-label", this.getSectionAriaLabel(section));
      this.sectionElements.set(section.id, sectionElement);
      const iconElement = DOM.append(sectionElement, $(".section-icon"));
      iconElement.classList.add(...ThemeIcon.asClassNameArray(section.icon));
      const textContainer = DOM.append(sectionElement, $(".section-text"));
      const labelElement = DOM.append(textContainer, $(".section-label"));
      labelElement.textContent = section.label;
      const countElement = DOM.append(sectionElement, $(".section-count"));
      countElement.textContent = `${section.count}`;
      this.countElements.set(section.id, countElement);
      this._register(DOM.addDisposableListener(sectionElement, "click", () => {
        this.openOverview();
      }));
      this._register(DOM.addDisposableListener(sectionElement, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.openOverview();
        }
      }));
      this._register(this.hoverService.setupDelayedHoverAtMouse(sectionElement, () => ({
        content: localize("openOverview", "Open Chat Customizations editor"),
        appearance: { compact: true, skipFadeInAnimation: true }
      })));
    }
  }
  async loadCounts() {
    const sectionPromptTypes = [
      { section: AICustomizationManagementSection.Agents, type: PromptsType.agent },
      { section: AICustomizationManagementSection.Skills, type: PromptsType.skill },
      { section: AICustomizationManagementSection.Instructions, type: PromptsType.instructions }
    ];
    await Promise.all(sectionPromptTypes.map(async ({ section, type }) => {
      let count = 0;
      if (type === PromptsType.skill) {
        const skills = await this.promptsService.findAgentSkills(CancellationToken.None);
        if (skills) {
          count = skills.length;
        }
      } else {
        const allItems = await this.promptsService.listPromptFiles(type, CancellationToken.None);
        count = allItems.length;
        if (type === PromptsType.instructions) {
          const existingUris = new ResourceSet(allItems.map((item) => item.uri));
          const agentInstructions = await this.promptsService.listAgentInstructions(CancellationToken.None);
          for (const file of agentInstructions) {
            if (!existingUris.has(file.uri)) {
              count++;
            }
          }
        }
      }
      const sectionData = this.sections.find((s) => s.id === section);
      if (sectionData) {
        sectionData.count = count;
      }
    }));
    const mcpSection = this.sections.find((s) => s.id === AICustomizationManagementSection.McpServers);
    if (mcpSection) {
      this._register(autorun((reader) => {
        const servers = this.mcpService.servers.read(reader);
        mcpSection.count = servers.length;
        this.updateCountElements();
      }));
    }
    const pluginSection = this.sections.find((s) => s.id === AICustomizationManagementSection.Plugins);
    if (pluginSection) {
      this._register(autorun((reader) => {
        const plugins = this.agentPluginService.plugins.read(reader);
        pluginSection.count = plugins.length;
        this.updateCountElements();
      }));
    }
    const toolsSection = this.sections.find((s) => s.id === AICustomizationManagementSection.Tools);
    if (toolsSection) {
      this._register(autorun((reader) => {
        const state = this.toolEnablementService.observe(AGENT_HOST_COPILOT_CLI_SESSION_TYPE).read(reader);
        const toolSets = this.languageModelToolsService.toolSets.read(reader);
        toolsSection.count = countEnabledCustomizationTools(toolSets, state, reader);
        this.updateCountElements();
      }));
    }
    this.updateCountElements();
  }
  getSectionAriaLabel(section) {
    return localize("overviewSectionAriaLabelWithCount", "{0}, {1} items", section.label, section.count);
  }
  updateCountElements() {
    for (const section of this.sections) {
      const countElement = this.countElements.get(section.id);
      if (countElement) {
        countElement.textContent = `${section.count}`;
      }
      const sectionElement = this.sectionElements.get(section.id);
      if (sectionElement) {
        sectionElement.setAttribute("aria-label", this.getSectionAriaLabel(section));
      }
    }
  }
  async openOverview() {
    const input = AICustomizationManagementEditorInput.getOrCreate();
    const editor = await this.editorService.openEditor(input, { pinned: true });
    if (editor?.getId() === AI_CUSTOMIZATION_MANAGEMENT_EDITOR_ID && isWelcomePageEditor(editor)) {
      editor.showWelcomePage();
    }
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.container.style.height = `${height}px`;
  }
};
AICustomizationOverviewView = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IEditorService),
  __decorateParam(11, IPromptsService),
  __decorateParam(12, IWorkspaceContextService),
  __decorateParam(13, IAICustomizationWorkspaceService),
  __decorateParam(14, IMcpService),
  __decorateParam(15, IAgentPluginService),
  __decorateParam(16, ILanguageModelToolsService),
  __decorateParam(17, IAgentHostToolSetEnablementService)
], AICustomizationOverviewView);
export {
  AICustomizationOverviewView,
  AI_CUSTOMIZATION_OVERVIEW_VIEW_ID
};
