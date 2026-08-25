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
import * as DOM from "../../../../../base/browser/dom.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { RunOnceScheduler, timeout } from "../../../../../base/common/async.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Event } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { autorun } from "../../../../../base/common/observable.js";
import { Orientation, Sizing, SplitView } from "../../../../../base/browser/ui/splitview/splitview.js";
import { Color } from "../../../../../base/common/color.js";
import { localize } from "../../../../../nls.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { EditorPane } from "../../../../browser/parts/editor/editorPane.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { basename, dirname, isEqual } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { AICustomizationManagementEditorInput } from "./aiCustomizationManagementEditorInput.js";
import { aiCustomizationManagementSectionRegistry } from "./aiCustomizationManagementSectionRegistry.js";
import { AICustomizationListWidget } from "./aiCustomizationListWidget.js";
import { IAICustomizationItemsModel, ITEMS_MODEL_SECTIONS } from "./aiCustomizationItemsModel.js";
import { McpListWidget } from "./mcpListWidget.js";
import { PluginListWidget } from "./pluginListWidget.js";
import { ToolsListWidget } from "./toolsListWidget.js";
import { AGENT_HOST_COPILOT_CLI_SESSION_TYPE } from "../agentSessions/agentHost/agentHostToolSetEnablementService.js";
import {
  AI_CUSTOMIZATION_MANAGEMENT_EDITOR_ID,
  AI_CUSTOMIZATION_MANAGEMENT_SIDEBAR_WIDTH_KEY,
  AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY,
  AICustomizationManagementSection,
  CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_EDITOR,
  CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_SECTION,
  CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_HARNESS,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  CONTENT_MIN_WIDTH
} from "./aiCustomizationManagement.js";
import { agentIcon, instructionsIcon, promptIcon, skillIcon, hookIcon, pluginIcon, toolsIcon } from "./aiCustomizationIcons.js";
import { ChatModelsWidget } from "../chatManagement/chatModelsWidget.js";
import { PromptsType, Target } from "../../common/promptSyntax/promptTypes.js";
import { IPromptsService, PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { AGENT_MD_FILENAME } from "../../common/promptSyntax/config/promptFileLocations.js";
import { getAttributeDefinition, getTarget } from "../../common/promptSyntax/languageProviders/promptFileAttributes.js";
import { NEW_PROMPT_COMMAND_ID, NEW_INSTRUCTIONS_COMMAND_ID, NEW_AGENT_COMMAND_ID, NEW_SKILL_COMMAND_ID } from "../promptSyntax/newPromptFileActions.js";
import { showConfigureHooksQuickPick } from "../promptSyntax/hookActions.js";
import { resolveWorkspaceTargetDirectory, resolveUserTargetDirectory, CustomizationLocationPicker } from "./customizationCreatorService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { AICustomizationSources, IAICustomizationWorkspaceService } from "../../common/aiCustomizationWorkspaceService.js";
import { CodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { InputBox } from "../../../../../base/browser/ui/inputbox/inputBox.js";
import { Checkbox } from "../../../../../base/browser/ui/toggle/toggle.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../../editor/common/model/textModel.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { getSimpleEditorOptions } from "../../../codeEditor/browser/simpleEditorOptions.js";
import { IWorkingCopyService } from "../../../../services/workingCopy/common/workingCopyService.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { FileSystemProviderCapabilities, IFileService } from "../../../../../platform/files/common/files.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { EmbeddedMcpServerDetail } from "./embeddedMcpServerDetail.js";
import { EmbeddedAgentPluginDetail } from "./embeddedAgentPluginDetail.js";
import { EmbeddedExtensionToolsDetail } from "./embeddedExtensionToolsDetail.js";
import { ICustomizationHarnessService } from "../../common/customizationHarnessService.js";
import { ChatConfiguration } from "../../common/constants.js";
import { AICustomizationWelcomePage } from "./aiCustomizationWelcomePage.js";
import { getPromptMigrationInfo, migratePromptFilesToSkills } from "./promptMigration.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { showNoFoldersDialog } from "../promptSyntax/pickers/askForPromptSourceFolder.js";
import { isAgentHostTarget } from "../../common/chatSessionsService.js";
const $ = DOM.$;
class SectionItemDelegate {
  getHeight() {
    return 26;
  }
  getTemplateId() {
    return "sectionItem";
  }
}
class SectionItemRenderer {
  constructor(hoverService) {
    this.hoverService = hoverService;
    this.templateId = "sectionItem";
  }
  renderTemplate(container) {
    container.classList.add("section-list-item");
    const icon = DOM.append(container, $(".section-icon"));
    const label = DOM.append(container, $(".section-label"));
    const count = DOM.append(container, $(".section-count"));
    const templateDisposables = new DisposableStore();
    return { container, icon, label, count, templateDisposables };
  }
  renderElement(element, index, templateData) {
    templateData.templateDisposables.clear();
    templateData.icon.className = "section-icon";
    templateData.icon.classList.add(...ThemeIcon.asClassNameArray(element.icon));
    templateData.label.textContent = element.label;
    if (element.count > 0) {
      templateData.count.textContent = String(element.count);
      templateData.count.style.display = "";
    } else {
      templateData.count.textContent = "";
      templateData.count.style.display = "none";
    }
    templateData.templateDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), templateData.container, element.description));
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
let AICustomizationManagementEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService, contextKeyService, openerService, commandService, workspaceService, promptsService, textModelService, configurationService, workingCopyService, hoverService, contextViewService, markdownRendererService, modelService, quickInputService, fileService, notificationService, dialogService, harnessService, viewsService, labelService, itemsModel) {
    super(AICustomizationManagementEditor.ID, group, telemetryService, themeService, storageService);
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.commandService = commandService;
    this.workspaceService = workspaceService;
    this.promptsService = promptsService;
    this.textModelService = textModelService;
    this.configurationService = configurationService;
    this.workingCopyService = workingCopyService;
    this.hoverService = hoverService;
    this.contextViewService = contextViewService;
    this.markdownRendererService = markdownRendererService;
    this.modelService = modelService;
    this.quickInputService = quickInputService;
    this.fileService = fileService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.harnessService = harnessService;
    this.viewsService = viewsService;
    this.labelService = labelService;
    this.itemsModel = itemsModel;
    this.contributedSectionContainers = /* @__PURE__ */ new Map();
    this.contributedSectionWidgets = /* @__PURE__ */ new Map();
    this.editorActionButtonInProgress = false;
    this.editorDisplayMode = "preview";
    this.editorModelChangeDisposables = this._register(new DisposableStore());
    this.editorPreviewDisposables = this._register(new DisposableStore());
    this.editorPreviewRenderScheduler = this._register(new RunOnceScheduler(() => {
      if (this.viewMode === "editor" && this.editorDisplayMode === "preview") {
        this.renderCurrentEditorPreview();
      }
    }, 200));
    this.builtinEditingSessions = /* @__PURE__ */ new Map();
    this.currentEditingReadOnly = false;
    this.editorReturnViewMode = "list";
    this.viewMode = "list";
    this.migrationSearchQuery = "";
    this.collapsedPromptMigrationGroups = /* @__PURE__ */ new Set();
    this.selectedPromptMigrationUris = new ResourceSet();
    this.migrationPageDisposables = this._register(new DisposableStore());
    this.mcpDetailDisposables = this._register(new DisposableStore());
    this.pluginDetailDisposables = this._register(new DisposableStore());
    this.toolsDetailDisposables = this._register(new DisposableStore());
    this.sections = [];
    this.allSections = [];
    this.promptFilesToMigrate = [];
    this.promptMigrationRefreshSequence = 0;
    this.editorDisposables = this._register(new DisposableStore());
    this._editorContentChanged = false;
    this.sidebarWidth = 0;
    this.sidebarHeight = 0;
    this.inEditorContextKey = CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_EDITOR.bindTo(contextKeyService);
    this.sectionContextKey = CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_SECTION.bindTo(contextKeyService);
    this.harnessContextKey = CONTEXT_AI_CUSTOMIZATION_MANAGEMENT_HARNESS.bindTo(contextKeyService);
    this.updateHarnessLabelPresentation();
    this._register(autorun((reader) => {
      this.workspaceService.activeProjectRoot.read(reader);
      if (this.viewMode === "editor") {
        this.currentEditingProjectRoot = this.workspaceService.getActiveProjectRoot();
      }
    }));
    this._register(toDisposable(() => {
      this.currentModelRef?.dispose();
      this.currentModelRef = void 0;
    }));
    this._register(toDisposable(() => this.disposeBuiltinEditingSessions()));
    const sectionInfo = {
      [AICustomizationManagementSection.Agents]: { label: localize("agents", "Agents"), icon: agentIcon, description: localize("agentsDesc", "Define custom agents with specialized personas, tool access, and instructions for specific tasks.") },
      [AICustomizationManagementSection.Skills]: { label: localize("skills", "Skills"), icon: skillIcon, description: localize("skillsDesc", "Create reusable skill files that provide domain-specific knowledge and workflows.") },
      [AICustomizationManagementSection.Instructions]: { label: localize("instructions", "Instructions"), icon: instructionsIcon, description: localize("instructionsDesc", "Set always-on instructions that guide AI behavior across your workspace or user profile.") },
      [AICustomizationManagementSection.Prompts]: { label: localize("prompts", "Prompts"), icon: promptIcon, description: localize("promptsDesc", "Reusable prompt templates that can be invoked as slash commands.") },
      [AICustomizationManagementSection.Hooks]: { label: localize("hooks", "Hooks"), icon: hookIcon, description: localize("hooksDesc", "Configure automated actions triggered by events like saving files or running tasks.") },
      [AICustomizationManagementSection.McpServers]: { label: localize("mcpServers", "MCP Servers"), icon: Codicon.server, description: localize("mcpServersDesc", "Connect external tool servers that extend AI capabilities with custom tools and data sources.") },
      [AICustomizationManagementSection.Plugins]: { label: localize("plugins", "Plugins"), icon: pluginIcon, description: localize("pluginsDesc", "Install and manage agent plugins that add additional tools, skills, and integrations.") },
      [AICustomizationManagementSection.Models]: { label: localize("models", "Models"), icon: Codicon.vm, description: localize("modelsDesc", "Configure and manage language models available for use.") },
      [AICustomizationManagementSection.Tools]: { label: localize("tools", "Tools"), icon: toolsIcon, description: localize("toolsDesc", "Enable or disable groups of language model tools available to chat.") }
    };
    const activeHarnessId = this.harnessService.activeHarness.get();
    for (const id of this.workspaceService.managementSections) {
      const contribution = aiCustomizationManagementSectionRegistry.get(id, activeHarnessId) ?? aiCustomizationManagementSectionRegistry.getDefault(id);
      const info = contribution ?? sectionInfo[id];
      if (info) {
        this.allSections.push({ id, label: info.label, icon: info.icon, description: info.description, count: 0 });
      }
    }
    this.rebuildVisibleSections();
    const savedSection = this.storageService.get(AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY, StorageScope.PROFILE);
    if (savedSection && this.sections.some((s) => s.id === savedSection)) {
      this.selectedSection = savedSection;
    } else {
      this.selectedSection = void 0;
    }
  }
  static {
    this.ID = AI_CUSTOMIZATION_MANAGEMENT_EDITOR_ID;
  }
  createEditor(parent) {
    this.editorDisposables.clear();
    this.contributedSectionContainers.clear();
    this.contributedSectionWidgets.clear();
    this.container = DOM.append(parent, $(".ai-customization-management-editor"));
    this.createSplitView();
    this.updateStyles();
  }
  createSplitView() {
    this.splitViewContainer = DOM.append(this.container, $(".management-split-view"));
    this.sidebarContainer = $(".management-sidebar");
    this.contentContainer = $(".management-content");
    this.createSidebar();
    this.createContent();
    this.splitView = this.editorDisposables.add(new SplitView(this.splitViewContainer, {
      orientation: Orientation.HORIZONTAL,
      proportionalLayout: true
    }));
    const savedWidth = this.storageService.getNumber(AI_CUSTOMIZATION_MANAGEMENT_SIDEBAR_WIDTH_KEY, StorageScope.PROFILE, SIDEBAR_DEFAULT_WIDTH);
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.sidebarContainer,
      minimumSize: SIDEBAR_MIN_WIDTH,
      maximumSize: SIDEBAR_MAX_WIDTH,
      layout: (width, _, height) => {
        this.sidebarContainer.style.width = `${width}px`;
        if (height !== void 0) {
          this.layoutSidebar(width, height);
        }
      }
    }, savedWidth, void 0, true);
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.contentContainer,
      minimumSize: CONTENT_MIN_WIDTH,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        this.contentContainer.style.width = `${width}px`;
        if (height !== void 0) {
          this.listWidget.layout(height - 16, width - 24);
          this.mcpListWidget?.layout(height - 16, width - 24);
          this.pluginListWidget?.layout(height - 16, width - 24);
          this.toolsListWidget?.layout(height - 16, width - 24);
          const modelsFooterHeight = this.modelsFooterElement?.offsetHeight || 80;
          this.modelsWidget?.layout(height - 16 - modelsFooterHeight, width);
          if (this.viewMode === "editor" && this.embeddedEditor && this.embeddedEditorContainer) {
            const { clientWidth, clientHeight } = this.embeddedEditorContainer;
            if (clientWidth > 0 && clientHeight > 0) {
              this.embeddedEditor.layout({ width: clientWidth, height: clientHeight });
            } else if (this.dimension) {
              DOM.getWindow(this.embeddedEditorContainer).requestAnimationFrame(() => {
                if (this.embeddedEditor && this.embeddedEditorContainer) {
                  const { clientWidth: w, clientHeight: h } = this.embeddedEditorContainer;
                  if (w > 0 && h > 0) {
                    this.embeddedEditor.layout({ width: w, height: h });
                  }
                }
              });
            }
          }
        }
      }
    }, Sizing.Distribute, void 0, true);
    this.editorDisposables.add(this.splitView.onDidSashChange(() => {
      const width = this.splitView.getViewSize(0);
      this.storageService.store(AI_CUSTOMIZATION_MANAGEMENT_SIDEBAR_WIDTH_KEY, width, StorageScope.PROFILE, StorageTarget.USER);
    }));
    this.editorDisposables.add(this.splitView.onDidSashReset(() => {
      const totalWidth = this.splitView.getViewSize(0) + this.splitView.getViewSize(1);
      this.splitView.resizeView(0, SIDEBAR_DEFAULT_WIDTH);
      this.splitView.resizeView(1, totalWidth - SIDEBAR_DEFAULT_WIDTH);
    }));
  }
  getActiveHarnessLabel() {
    const label = this.harnessService.getActiveDescriptor().label;
    return label || (this.workspaceService.isSessionsWindow ? "" : localize("localHarnessLabel", "Local"));
  }
  updateHarnessLabelPresentation() {
    const harnessLabel = this.getActiveHarnessLabel();
    AICustomizationManagementEditorInput.getOrCreate().setHarnessLabel(harnessLabel);
    this.welcomePage?.setHarnessLabel(harnessLabel);
  }
  /**
   * Rebuilds the visible sections list based on the active harness's
   * `hiddenSections`. If the current selection falls into a hidden
   * section, the first visible section is selected instead.
   */
  rebuildVisibleSections() {
    const activeId = this.harnessService.activeHarness.get();
    const descriptor = this.harnessService.findHarnessById(activeId);
    const hidden = new Set(descriptor?.hiddenSections ?? []);
    this.sections.length = 0;
    for (const s of this.allSections) {
      const contribution = aiCustomizationManagementSectionRegistry.get(s.id, activeId);
      const contributed = aiCustomizationManagementSectionRegistry.has(s.id);
      if (!hidden.has(s.id) && (!contributed || !!contribution)) {
        this.sections.push(contribution ? { ...s, label: contribution.label, icon: contribution.icon, description: contribution.description } : s);
      }
    }
    if (this.sectionsList) {
      this.sectionsList.splice(0, this.sectionsList.length, this.sections);
      this.layoutSidebar(this.sidebarWidth, this.sidebarHeight);
    }
    this.welcomePage?.rebuildCards(new Set(this.sections.map((s) => s.id)));
    if (this.selectedSection !== void 0 && !this.sections.some((s) => s.id === this.selectedSection) && this.sections.length > 0) {
      this.showWelcomePage();
    } else {
      this.ensureSectionsListReflectsActiveSection();
    }
  }
  createSidebar() {
    const sidebarContent = DOM.append(this.sidebarContainer, $(".sidebar-content"));
    this.createSidebarHeader(sidebarContent);
    const sectionsListContainer = this.sectionsListContainer = DOM.append(sidebarContent, $(".sidebar-sections-list"));
    this.sectionsList = this.editorDisposables.add(this.instantiationService.createInstance(
      WorkbenchList,
      "AICustomizationManagementSections",
      sectionsListContainer,
      new SectionItemDelegate(),
      [new SectionItemRenderer(this.hoverService)],
      {
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel: (item) => item.count > 0 ? localize("sectionAriaLabelWithCount", "{0}, {1} items", item.label, item.count) : item.label,
          getWidgetAriaLabel: () => localize("sectionsAriaLabel", "Agent Customization Sections")
        },
        openOnSingleClick: true,
        identityProvider: {
          getId: (item) => item.id
        }
      }
    ));
    this.sectionsList.splice(0, this.sectionsList.length, this.sections);
    this.ensureSectionsListReflectsActiveSection();
    this.editorDisposables.add(this.sectionsList.onDidChangeSelection((e) => {
      if (e.elements.length === 0) {
        if (this.selectedSection !== void 0) {
          this.showWelcomePage();
        }
        return;
      }
      this.selectSection(e.elements[0].id);
    }));
    this.editorDisposables.add(autorun((reader) => {
      this.harnessService.availableHarnesses.read(reader);
      const activeId = this.harnessService.activeHarness.read(reader);
      this.harnessContextKey.set(activeId);
      this.updateHomeButtonHarnessPresentation();
      this.rebuildVisibleSections();
      if (this._previousActiveHarnessId !== void 0 && this._previousActiveHarnessId !== activeId) {
        for (const [section, widget] of this.contributedSectionWidgets) {
          this.editorDisposables.delete(widget);
          this.contributedSectionContainers.get(section)?.replaceChildren();
        }
        this.contributedSectionWidgets.clear();
        for (const section of this.sections) {
          this.updateSectionCount(section.id, 0);
        }
      }
      this._previousActiveHarnessId = activeId;
    }));
    this.editorDisposables.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.ChatCustomizationsStructuredPreviewEnabled)) {
        this.onStructuredPreviewSettingChanged();
      }
      if (e.affectsConfiguration(ChatConfiguration.ChatCustomizationsPromptMigrationEnabled)) {
        this.refreshPromptMigrationUi();
      }
    }));
    this.createSidebarMigrationShortcut(sidebarContent);
  }
  layoutSidebar(width, height) {
    this.sidebarWidth = width;
    this.sidebarHeight = height;
    if (!this.sectionsListContainer) {
      return;
    }
    const headerHeight = this.sidebarHeaderContainer?.offsetHeight ?? 0;
    const migrationHeight = this.migrationShortcutContainer?.style.display !== "none" ? this.migrationShortcutContainer?.offsetHeight ?? 0 : 0;
    const availableListHeight = Math.max(0, height - 8 - headerHeight - migrationHeight);
    const listHeight = Math.min(availableListHeight, this.sections.length * 26);
    this.sectionsListContainer.style.height = `${listHeight}px`;
    this.sectionsList.layout(listHeight, width);
  }
  createSidebarHeader(sidebarContent) {
    const headerRow = this.sidebarHeaderContainer = DOM.append(sidebarContent, $(".sidebar-header-row"));
    const homeButton = this.homeButton = DOM.append(headerRow, $("button.sidebar-home-button"));
    homeButton.classList.add("sidebar-harness-home-button");
    homeButton.setAttribute("aria-label", localize("homeButton", "Overview"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), homeButton, localize("homeButtonTooltip", "Back to overview")));
    const homeIcon = this.homeButtonIcon = DOM.append(homeButton, $("span.sidebar-home-icon"));
    homeIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.home));
    homeIcon.setAttribute("aria-hidden", "true");
    const homeLabel = this.homeButtonLabel = DOM.append(homeButton, $("span.sidebar-home-label"));
    homeLabel.textContent = localize("homeButtonLabel", "Overview");
    this.editorDisposables.add(DOM.addDisposableListener(homeButton, "click", () => {
      this.showWelcomePage();
    }));
    this.updateHomeButtonHarnessPresentation();
    this.updateHomeButtonStyle();
  }
  updateHomeButtonStyle() {
    if (!this.homeButtonLabel || !this.homeButton) {
      return;
    }
    this.homeButtonLabel.style.display = "";
    this.homeButton.style.flex = "1";
  }
  updateHomeButtonHarnessPresentation() {
    this.updateHarnessLabelPresentation();
    if (!this.homeButton || !this.homeButtonIcon || !this.homeButtonLabel) {
      return;
    }
    this.homeButtonIcon.className = "sidebar-home-icon";
    this.homeButtonIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.home));
    this.homeButtonLabel.textContent = localize("homeButtonLabel", "Overview");
    this.homeButton.setAttribute("aria-label", localize("homeButton", "Overview"));
    this.homeButton.title = localize("homeButtonTooltip", "Back to overview");
  }
  createSidebarMigrationShortcut(sidebarContent) {
    const container = this.migrationShortcutContainer = DOM.append(sidebarContent, $(".sidebar-migration-shortcut"));
    container.style.display = "none";
    DOM.append(container, $("div.sidebar-migration-separator"));
    const button = this.migrationShortcutButton = DOM.append(container, $("button.sidebar-migration-button"));
    button.type = "button";
    button.setAttribute("aria-label", localize("migrationShortcutAriaLabel", "Migrate prompt files to skills"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), button, localize("migrationShortcutTooltip", "Convert deprecated prompt files to skills")));
    const icon = DOM.append(button, $("span.sidebar-migration-icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
    icon.setAttribute("aria-hidden", "true");
    const label = DOM.append(button, $("span.sidebar-migration-label"));
    label.textContent = localize("migrationShortcutLabel", "Migrate Prompts");
    this.migrationShortcutCount = DOM.append(button, $("span.sidebar-migration-count"));
    this.editorDisposables.add(DOM.addDisposableListener(button, "click", () => {
      this.showPromptMigrationPage();
    }));
  }
  createWelcomePage(parent) {
    this.welcomePage = this.editorDisposables.add(new AICustomizationWelcomePage(
      parent,
      this.workspaceService.welcomePageFeatures,
      {
        selectSection: (section) => this.selectSection(section),
        selectSectionWithMarketplace: (section) => this.selectSection(section, { showMarketplace: true }),
        closeEditor: () => {
          if (this.input) {
            this.group.closeEditor(this.input);
          }
        },
        migratePromptFiles: () => {
          this.showPromptMigrationPage();
        },
        prefillChat: async (query, options) => {
          try {
            if (this.workspaceService.isSessionsWindow) {
              const sessionsViewId = "workbench.view.sessions.chat";
              if (options?.newChat) {
                await this.commandService.executeCommand("workbench.action.sessions.newChat");
              }
              const view = await this.viewsService.openView(sessionsViewId, true);
              const chatView = view;
              if (options?.isPartialQuery && chatView?.prefillInput) {
                chatView.prefillInput(query);
              } else if (chatView?.sendQuery) {
                chatView.sendQuery(query);
              }
            } else {
              if (options?.newChat) {
                await this.commandService.executeCommand("workbench.action.chat.newChat");
              }
              await this.commandService.executeCommand("workbench.action.chat.open", { query, isPartialQuery: options?.isPartialQuery ?? false });
            }
          } catch (err) {
            onUnexpectedError(err);
          }
        }
      },
      this.commandService,
      this.workspaceService,
      this.hoverService,
      this.getActiveHarnessLabel()
    ));
    this.welcomePage.rebuildCards(new Set(this.sections.map((s) => s.id)));
    this.welcomePage.setPromptMigrationInfo(getPromptMigrationInfo(this.promptFilesToMigrate));
  }
  createBackArrowButton(onClick) {
    const button = $("button.section-back-arrow-button");
    button.type = "button";
    button.setAttribute("aria-label", localize("backToOverview", "Back to overview"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), button, localize("backToOverviewTooltip", "Back to overview")));
    const icon = DOM.append(button, $("span.section-back-arrow-icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.arrowLeft));
    icon.setAttribute("aria-hidden", "true");
    this.editorDisposables.add(DOM.addDisposableListener(button, "click", () => {
      if (onClick) {
        onClick();
      } else {
        this.showWelcomePage();
      }
    }));
    return button;
  }
  createPromptMigrationContent(contentInner) {
    this.migrationContentContainer = DOM.append(contentInner, $(".prompt-migration-content-container.ai-customization-list-widget"));
    const header = DOM.append(this.migrationContentContainer, $(".section-title-header"));
    const titleRow = DOM.append(header, $(".section-title-row"));
    const title = DOM.append(titleRow, $("h2.section-title"));
    title.textContent = localize("promptMigrationPageTitle", "Migrate Prompt Files");
    this.migrationDescriptionElement = DOM.append(header, $("p.section-title-description"));
    const sectionLink = DOM.append(header, $("a.section-title-link"));
    sectionLink.textContent = localize("learnMoreSkills", "Learn more about agent skills");
    sectionLink.href = "https://code.visualstudio.com/docs/agent-customization/agent-skills?referrer=in-product";
    this.editorDisposables.add(DOM.addDisposableListener(sectionLink, "click", (e) => {
      e.preventDefault();
      this.openerService.open(URI.parse(sectionLink.href));
    }));
    const actions = DOM.append(this.migrationContentContainer, $(".list-search-and-button-container.prompt-migration-actions"));
    const searchContainer = DOM.append(actions, $(".list-search-container"));
    this.migrationSearchInput = this.editorDisposables.add(new InputBox(searchContainer, this.contextViewService, {
      placeholder: localize("promptMigrationSearchPlaceholder", "Type to search..."),
      inputBoxStyles: defaultInputBoxStyles
    }));
    this.editorDisposables.add(this.migrationSearchInput.onDidChange(() => {
      this.migrationSearchQuery = this.migrationSearchInput?.value ?? "";
      this.renderPromptMigrationPage();
    }));
    const actionButtonContainer = DOM.append(actions, $(".list-add-button-container"));
    this.migrationMigrateButton = this.editorDisposables.add(new Button(actionButtonContainer, defaultButtonStyles));
    this.migrationMigrateButton.element.classList.add("list-add-button", "prompt-migration-button");
    this.migrationMigrateButton.label = localize("promptMigrationPageButton", "Migrate");
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this.migrationMigrateButton.element, localize("promptMigrationPageButtonTooltip", "Convert selected prompt files to skills")));
    this.editorDisposables.add(this.migrationMigrateButton.onDidClick(() => {
      const selectedPromptFiles = this.promptFilesToMigrate.filter((file) => this.selectedPromptMigrationUris.has(file.uri));
      void this.migratePromptFiles(selectedPromptFiles);
    }));
    this.migrationListContainer = $(".prompt-migration-list.list-container");
    this.migrationListScrollable = this.editorDisposables.add(new DomScrollableElement(this.migrationListContainer, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto,
      useShadows: false
    }));
    const migrationListScrollableNode = this.migrationListScrollable.getDomNode();
    migrationListScrollableNode.classList.add("prompt-migration-list-scrollable");
    this.migrationContentContainer.appendChild(migrationListScrollableNode);
    const targetWindow = DOM.getWindow(this.migrationContentContainer);
    const migrationResizeObserver = this.editorDisposables.add(new DOM.DisposableResizeObserver(
      "AICustomizationManagementEditor.promptMigrationListScrollable",
      () => this.migrationListScrollable?.scanDomNode(),
      targetWindow
    ));
    this.editorDisposables.add(migrationResizeObserver.observe(migrationListScrollableNode));
    this.renderPromptMigrationPage();
  }
  createContent() {
    const contentInner = DOM.append(this.contentContainer, $(".content-inner"));
    this.createWelcomePage(contentInner);
    this.editorDisposables.add(this.promptsService.onDidChangeSlashCommands(() => {
      void this.refreshPromptMigrationInfo();
    }));
    this.editorDisposables.add(autorun((reader) => {
      this.harnessService.activeHarness.read(reader);
      void this.refreshPromptMigrationInfo();
    }));
    this.promptsContentContainer = DOM.append(contentInner, $(".prompts-content-container"));
    this.listWidget = this.editorDisposables.add(this.instantiationService.createInstance(AICustomizationListWidget));
    this.promptsContentContainer.appendChild(this.listWidget.element);
    this.createPromptMigrationContent(contentInner);
    this.editorDisposables.add(this.listWidget.onDidSelectItem((item) => {
      this.telemetryService.publicLog2("chatCustomizationEditor.itemSelected", {
        section: this.selectedSection ?? "welcome",
        promptType: item.promptType,
        storage: item.source ?? "external"
      });
      const source = item.source;
      const isWorkspaceFile = source === AICustomizationSources.local;
      const isReadOnly = !source || source === AICustomizationSources.extension || source === AICustomizationSources.plugin || source === AICustomizationSources.builtin;
      this.showEmbeddedEditor(item.uri, item.name, item.promptType, source ?? AICustomizationSources.builtin, isWorkspaceFile, isReadOnly);
    }));
    this.editorDisposables.add(this.listWidget.onDidRequestCreate((promptType) => {
      this.createNewItemWithAI(promptType);
    }));
    this.editorDisposables.add(this.listWidget.onDidRequestCreateManual(({ type, target, rootFileName }) => {
      this.createNewItemManual(type, target, rootFileName);
    }));
    const hasSections = new Set(this.workspaceService.managementSections);
    if (hasSections.has(AICustomizationManagementSection.Models)) {
      this.modelsContentContainer = DOM.append(contentInner, $(".models-content-container"));
      const modelsBackBar = DOM.append(this.modelsContentContainer, $(".section-back-bar"));
      modelsBackBar.appendChild(this.createBackArrowButton());
      this.modelsWidget = this.editorDisposables.add(this.instantiationService.createInstance(ChatModelsWidget));
      this.modelsContentContainer.appendChild(this.modelsWidget.element);
      this.modelsFooterElement = DOM.append(this.modelsContentContainer, $(".section-footer"));
      const modelsDescription = DOM.append(this.modelsFooterElement, $("p.section-footer-description"));
      modelsDescription.textContent = localize("modelsDescription", "Browse and manage language models from different providers. Select models for use in chat, code completion, and other AI features.");
      const modelsLink = DOM.append(this.modelsFooterElement, $("a.section-footer-link"));
      modelsLink.textContent = localize("learnMoreModels", "Learn more about language models");
      modelsLink.href = "https://code.visualstudio.com/docs/agent-customization/language-models?referrer=in-product";
      this.editorDisposables.add(DOM.addDisposableListener(modelsLink, "click", (e) => {
        e.preventDefault();
        this.openerService.open(URI.parse(modelsLink.href));
      }));
    }
    if (hasSections.has(AICustomizationManagementSection.McpServers)) {
      this.mcpContentContainer = DOM.append(contentInner, $(".mcp-content-container"));
      this.mcpListWidget = this.editorDisposables.add(this.instantiationService.createInstance(McpListWidget));
      this.mcpListWidget.setCloseCustomizationEditor(async () => {
        if (this.input) {
          await this.group.closeEditor(this.input);
        }
      });
      this.mcpContentContainer.appendChild(this.mcpListWidget.element);
      this.mcpDetailContainer = DOM.append(contentInner, $(".mcp-detail-container"));
      this.createEmbeddedMcpDetail();
      this.editorDisposables.add(this.mcpListWidget.onDidSelectServer((server) => {
        this.showEmbeddedMcpDetail(server);
      }));
      this.editorDisposables.add(this.mcpListWidget.onDidRequestShowPlugin((item) => {
        this.showPluginDetail(item);
      }));
    }
    if (hasSections.has(AICustomizationManagementSection.Plugins)) {
      this.pluginContentContainer = DOM.append(contentInner, $(".plugin-content-container"));
      this.pluginListWidget = this.editorDisposables.add(this.instantiationService.createInstance(PluginListWidget));
      this.pluginContentContainer.appendChild(this.pluginListWidget.element);
      this.pluginDetailContainer = DOM.append(contentInner, $(".plugin-detail-container"));
      this.createEmbeddedPluginDetail();
      this.editorDisposables.add(this.pluginListWidget.onDidSelectPlugin((item) => {
        this.pluginDetailReturnSection = void 0;
        this.showEmbeddedPluginDetail(item);
      }));
    }
    if (hasSections.has(AICustomizationManagementSection.Tools)) {
      this.toolsContentContainer = DOM.append(contentInner, $(".tools-content-container"));
      this.toolsListWidget = this.editorDisposables.add(this.instantiationService.createInstance(ToolsListWidget, AGENT_HOST_COPILOT_CLI_SESSION_TYPE));
      this.toolsContentContainer.appendChild(this.toolsListWidget.element);
      this.toolsDetailContainer = DOM.append(contentInner, $(".tools-detail-container"));
      this.createEmbeddedToolDetail();
      this.editorDisposables.add(this.toolsListWidget.onDidSelectExtension((extension) => {
        this.showEmbeddedToolDetail(extension);
      }));
    }
    for (const section of this.workspaceService.managementSections) {
      if (!aiCustomizationManagementSectionRegistry.has(section)) {
        continue;
      }
      const container = DOM.append(contentInner, $(".contributed-section-container"));
      this.contributedSectionContainers.set(section, container);
    }
    this.editorContentContainer = DOM.append(contentInner, $(".editor-content-container"));
    this.createEmbeddedEditor();
    this.updateContentVisibility();
    this.editorDisposables.add(this.listWidget.onDidChangeItemCount((count) => {
      if (this.isPromptsSection(this.selectedSection)) {
        this.updateSectionCount(this.selectedSection, count);
      }
    }));
    if (this.mcpListWidget) {
      this.editorDisposables.add(this.mcpListWidget.onDidChangeItemCount((count) => {
        this.updateSectionCount(AICustomizationManagementSection.McpServers, count);
      }));
      this.mcpListWidget.fireItemCount();
    }
    if (this.pluginListWidget) {
      this.editorDisposables.add(this.pluginListWidget.onDidChangeItemCount((count) => {
        this.updateSectionCount(AICustomizationManagementSection.Plugins, count);
      }));
      this.pluginListWidget.fireItemCount();
    }
    if (this.modelsWidget) {
      this.editorDisposables.add(this.modelsWidget.onDidChangeItemCount((count) => {
        this.updateSectionCount(AICustomizationManagementSection.Models, count);
      }));
      this.modelsWidget.fireItemCount();
    }
    if (this.toolsListWidget) {
      this.editorDisposables.add(this.toolsListWidget.onDidChangeItemCount((count) => {
        this.updateSectionCount(AICustomizationManagementSection.Tools, count);
      }));
      this.toolsListWidget.fireItemCount();
    }
    for (const section of ITEMS_MODEL_SECTIONS) {
      const observable = this.itemsModel.getCount(section);
      this.editorDisposables.add(autorun((reader) => {
        this.updateSectionCount(section, observable.read(reader));
      }));
    }
    if (this.isPromptsSection(this.selectedSection)) {
      void this.listWidget.setSection(this.selectedSection);
    }
    void this.refreshPromptMigrationInfo();
  }
  async refreshPromptMigrationInfo() {
    const activeHarnessId = this.harnessService.activeHarness.get();
    const refreshSequence = ++this.promptMigrationRefreshSequence;
    if (!isAgentHostTarget(activeHarnessId)) {
      this.setPromptFilesToMigrate([]);
      return;
    }
    try {
      const promptFiles = await this.promptsService.listPromptFiles(PromptsType.prompt, CancellationToken.None);
      if (refreshSequence !== this.promptMigrationRefreshSequence || activeHarnessId !== this.harnessService.activeHarness.get()) {
        return;
      }
      this.setPromptFilesToMigrate(promptFiles.filter((file) => file.storage === PromptsStorage.local || file.storage === PromptsStorage.user));
    } catch (error) {
      if (refreshSequence === this.promptMigrationRefreshSequence) {
        this.setPromptFilesToMigrate([]);
      }
      onUnexpectedError(error);
    }
  }
  setPromptFilesToMigrate(promptFiles) {
    const previousPromptUris = new ResourceSet(this.promptFilesToMigrate.map((promptFile) => promptFile.uri));
    const selectedPromptUris = new ResourceSet();
    for (const promptFile of promptFiles) {
      if (!previousPromptUris.has(promptFile.uri) || this.selectedPromptMigrationUris.has(promptFile.uri)) {
        selectedPromptUris.add(promptFile.uri);
      }
    }
    this.selectedPromptMigrationUris = selectedPromptUris;
    this.promptFilesToMigrate = promptFiles;
    this.refreshPromptMigrationUi();
  }
  refreshPromptMigrationUi() {
    const migrationInfo = this.isPromptMigrationEnabled() ? getPromptMigrationInfo(this.promptFilesToMigrate) : void 0;
    this.welcomePage?.setPromptMigrationInfo(migrationInfo);
    this.updateSidebarMigrationShortcut(migrationInfo);
    this.renderPromptMigrationPage();
  }
  updateSidebarMigrationShortcut(migrationInfo) {
    if (!this.migrationShortcutContainer || !this.migrationShortcutButton || !this.migrationShortcutCount) {
      return;
    }
    if (!migrationInfo) {
      this.migrationShortcutContainer.style.display = "none";
      this.layoutSidebar(this.sidebarWidth, this.sidebarHeight);
      return;
    }
    this.migrationShortcutContainer.style.display = "";
    this.migrationShortcutCount.textContent = String(migrationInfo.totalPromptCount);
    this.migrationShortcutButton.setAttribute(
      "aria-label",
      localize("migrationShortcutAriaLabelWithCount", "Prompts, {0} deprecated prompt files need migration", migrationInfo.totalPromptCount)
    );
    this.layoutSidebar(this.sidebarWidth, this.sidebarHeight);
  }
  async migratePromptFiles(promptFiles) {
    if (promptFiles.length === 0) {
      return;
    }
    if (!this.isPromptMigrationEnabled()) {
      return;
    }
    const migrationInfo = getPromptMigrationInfo(promptFiles);
    if (!migrationInfo) {
      return;
    }
    const confirmResult = await this.dialogService.confirm({
      type: "question",
      message: localize("promptMigrationConfirmMessage", "Convert prompt files to skills?"),
      detail: migrationInfo && migrationInfo.workspacePromptCount > 0 && migrationInfo.userPromptCount > 0 ? localize("promptMigrationConfirmDetailWorkspaceAndUser", "This converts {0} workspace prompt files and {1} user prompt files into skills.", migrationInfo.workspacePromptCount, migrationInfo.userPromptCount) : migrationInfo && migrationInfo.workspacePromptCount > 0 ? localize("promptMigrationConfirmDetailWorkspace", "This converts {0} workspace prompt files into skills.", migrationInfo.workspacePromptCount) : localize("promptMigrationConfirmDetailUser", "This converts {0} user prompt files into skills.", migrationInfo?.userPromptCount ?? this.promptFilesToMigrate.length),
      checkbox: {
        label: localize("promptMigrationDeletePromptFilesCheckbox", "Delete original prompt files after migration"),
        checked: true
      },
      primaryButton: localize("promptMigrationConfirmButton", "Convert to Skills")
    });
    if (!confirmResult.confirmed) {
      return;
    }
    const skillSourceFolders = await this.itemsModel.getActiveItemSource().fetchSourceFolders(PromptsType.skill);
    if (skillSourceFolders.length === 0) {
      this.notificationService.error(localize("promptMigrationNoSkillFolders", "No skill folders are configured for the active harness."));
      return;
    }
    const skillSourceFoldersByStorage = await this.resolveMigrationSkillSourceFolders(skillSourceFolders, migrationInfo);
    if (!skillSourceFoldersByStorage) {
      return;
    }
    const migrationResult = await migratePromptFilesToSkills(
      promptFiles,
      skillSourceFoldersByStorage,
      this.fileService,
      onUnexpectedError,
      { deleteOriginalPromptFiles: confirmResult.checkboxChecked !== false }
    );
    const { convertedCount, failedPromptFileNames, unsupportedHeaderKeys, convertedSkillFileUris } = migrationResult;
    if (failedPromptFileNames.length > 0) {
      const displayedFileNames = failedPromptFileNames.slice(0, 3);
      const hiddenFileCount = failedPromptFileNames.length - displayedFileNames.length;
      if (hiddenFileCount > 0) {
        this.notificationService.error(localize(
          "promptMigrationFilesFailedWithRemainder",
          "Failed to migrate {0} prompt files: {1}, and {2} more.",
          failedPromptFileNames.length,
          displayedFileNames.join(", "),
          hiddenFileCount
        ));
      } else {
        this.notificationService.error(localize(
          "promptMigrationFilesFailed",
          "Failed to migrate {0} prompt files: {1}.",
          failedPromptFileNames.length,
          displayedFileNames.join(", ")
        ));
      }
    }
    if (convertedCount === 0) {
      if (failedPromptFileNames.length === 0) {
        this.notificationService.warn(localize("promptMigrationNoFilesConverted", "No prompt files were converted."));
      }
      return;
    }
    await this.refreshPromptMigrationInfo();
    const unsupportedKeysLabel = Array.from(unsupportedHeaderKeys).sort().join(", ");
    if (unsupportedKeysLabel.length > 0) {
      this.notificationService.info(localize(
        "promptMigrationConvertedWithReview",
        "Converted {0} prompt files to skills. Review migrated skills that used unsupported prompt headers: {1}.",
        convertedCount,
        unsupportedKeysLabel
      ));
    } else {
      this.notificationService.info(localize("promptMigrationConverted", "Converted {0} prompt files to skills.", convertedCount));
    }
    this.selectSection(AICustomizationManagementSection.Skills);
    void this.revealMigratedSkills(convertedSkillFileUris);
  }
  renderPromptMigrationPage() {
    if (!this.migrationListContainer || !this.migrationMigrateButton) {
      return;
    }
    this.migrationPageDisposables.clear();
    DOM.clearNode(this.migrationListContainer);
    this.updatePromptMigrationPageDescription();
    if (this.promptFilesToMigrate.length === 0 || !this.isPromptMigrationEnabled()) {
      const emptyMessage = DOM.append(this.migrationListContainer, $("p.prompt-migration-empty"));
      emptyMessage.textContent = localize("promptMigrationPageEmpty", "No prompt files are available to migrate.");
      this.migrationMigrateButton.enabled = false;
      this.migrationListScrollable?.scanDomNode();
      return;
    }
    const query = this.migrationSearchQuery.trim().toLowerCase();
    const filteredPromptFiles = this.promptFilesToMigrate.filter((promptFile) => {
      if (!query) {
        return true;
      }
      const displayName = (promptFile.name ?? basename(promptFile.uri)).toLowerCase();
      const relativePath = this.labelService.getUriLabel(promptFile.uri, { relative: true }).toLowerCase();
      return displayName.includes(query) || relativePath.includes(query);
    });
    if (filteredPromptFiles.length === 0) {
      const emptyMessage = DOM.append(this.migrationListContainer, $("p.prompt-migration-empty"));
      emptyMessage.textContent = localize("promptMigrationSearchEmpty", "No prompt files match your search.");
      this.updatePromptMigrationActionState();
      this.migrationListScrollable?.scanDomNode();
      return;
    }
    const workspacePromptFiles = filteredPromptFiles.filter((file) => file.storage === PromptsStorage.local);
    const userPromptFiles = filteredPromptFiles.filter((file) => file.storage === PromptsStorage.user);
    const openPromptFileInEmbeddedEditor = (promptFile) => {
      const isWorkspaceFile = promptFile.storage === PromptsStorage.local;
      void this.showEmbeddedEditor(
        promptFile.uri,
        promptFile.name ?? basename(promptFile.uri),
        PromptsType.prompt,
        promptFile.storage,
        isWorkspaceFile
      );
    };
    const renderSelectionCheckbox = (row, promptFile) => {
      const checkboxContainer = DOM.append(row, $(".item-sync-checkbox.prompt-migration-checkbox"));
      const checkboxTitle = localize("promptMigrationSelectAriaLabel", "Select {0}", promptFile.name ?? basename(promptFile.uri));
      const checkbox = this.migrationPageDisposables.add(new Checkbox(checkboxTitle, this.selectedPromptMigrationUris.has(promptFile.uri), defaultCheckboxStyles));
      checkboxContainer.replaceChildren(checkbox.domNode);
      this.migrationPageDisposables.add(checkbox.onChange(() => {
        if (checkbox.checked) {
          this.selectedPromptMigrationUris.add(promptFile.uri);
        } else {
          this.selectedPromptMigrationUris.delete(promptFile.uri);
        }
        this.updatePromptMigrationActionState();
      }));
      return checkbox;
    };
    const renderItem = (container, promptFile) => {
      const row = DOM.append(container, $("div.ai-customization-list-item.prompt-migration-item"));
      const checkbox = renderSelectionCheckbox(row, promptFile);
      this.migrationPageDisposables.add(DOM.addDisposableListener(row, "click", (event) => {
        if (event.target instanceof Node && checkbox.domNode.contains(event.target)) {
          return;
        }
        openPromptFileInEmbeddedEditor(promptFile);
      }));
      const itemLeft = DOM.append(row, $("span.item-left"));
      const itemText = DOM.append(itemLeft, $("span.item-text"));
      const nameRow = DOM.append(itemText, $("span.item-name-row"));
      const nameLabel = DOM.append(nameRow, $("span.item-name.prompt-migration-item-name"));
      nameLabel.textContent = promptFile.name ?? basename(promptFile.uri);
      const pathLabel = DOM.append(itemText, $("span.item-description.is-filename.prompt-migration-item-path"));
      pathLabel.textContent = this.labelService.getUriLabel(promptFile.uri, { relative: true });
      const itemRight = DOM.append(row, $("span.item-right"));
      const deleteButton = DOM.append(itemRight, $("button.icon-button", {
        type: "button",
        "aria-label": localize("deletePromptFile", "Delete {0}", promptFile.name ?? basename(promptFile.uri))
      }));
      deleteButton.classList.add(...ThemeIcon.asClassNameArray(Codicon.trash));
      this.migrationPageDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), deleteButton, localize("deletePromptFileTooltip", "Delete")));
      this.migrationPageDisposables.add(DOM.addDisposableListener(deleteButton, "click", (event) => {
        event.stopPropagation();
        void this.deletePromptFile(promptFile);
      }));
    };
    const renderGroup = (groupKey, groupLabel, promptFiles) => {
      if (promptFiles.length === 0) {
        return;
      }
      const group = DOM.append(this.migrationListContainer, $(".prompt-migration-group"));
      const groupHeader = DOM.append(group, $(".ai-customization-group-header.prompt-migration-group-header"));
      const groupCheckboxContainer = DOM.append(groupHeader, $(".item-sync-checkbox.prompt-migration-group-checkbox"));
      const allInGroupSelected = promptFiles.every((file) => this.selectedPromptMigrationUris.has(file.uri));
      const groupCheckboxAriaLabel = localize("promptMigrationSelectGroupAriaLabel", "Select all {0} prompt files", groupLabel.toLowerCase());
      const groupCheckbox = this.migrationPageDisposables.add(new Checkbox(groupCheckboxAriaLabel, allInGroupSelected, defaultCheckboxStyles));
      groupCheckboxContainer.replaceChildren(groupCheckbox.domNode);
      this.migrationPageDisposables.add(groupCheckbox.onChange(() => {
        for (const promptFile of promptFiles) {
          if (groupCheckbox.checked) {
            this.selectedPromptMigrationUris.add(promptFile.uri);
          } else {
            this.selectedPromptMigrationUris.delete(promptFile.uri);
          }
        }
        this.renderPromptMigrationPage();
      }));
      const groupToggle = DOM.append(groupHeader, $("button.prompt-migration-group-toggle"));
      groupToggle.type = "button";
      const groupId = `prompt-migration-group-${groupKey}`;
      const collapsed = this.collapsedPromptMigrationGroups.has(groupId);
      groupToggle.setAttribute("aria-controls", `${groupId}-items`);
      groupToggle.setAttribute("aria-expanded", String(!collapsed));
      const chevron = DOM.append(groupToggle, $("span.group-chevron"));
      chevron.setAttribute("aria-hidden", "true");
      const groupLabelGroup = DOM.append(groupToggle, $(".group-label-group"));
      const label = DOM.append(groupLabelGroup, $("span.group-label"));
      label.textContent = groupLabel;
      const count = DOM.append(groupToggle, $("span.group-count"));
      count.textContent = String(promptFiles.length);
      const groupItems = DOM.append(group, $(".prompt-migration-group-items"));
      groupItems.id = `${groupId}-items`;
      const setGroupCollapsed = (collapsed2) => {
        groupItems.style.display = collapsed2 ? "none" : "";
        chevron.className = "group-chevron";
        chevron.classList.add(...ThemeIcon.asClassNameArray(collapsed2 ? Codicon.chevronRight : Codicon.chevronDown));
        groupToggle.setAttribute("aria-expanded", String(!collapsed2));
        this.migrationListScrollable?.scanDomNode();
      };
      setGroupCollapsed(collapsed);
      this.migrationPageDisposables.add(DOM.addDisposableListener(groupToggle, "click", () => {
        if (this.collapsedPromptMigrationGroups.has(groupId)) {
          this.collapsedPromptMigrationGroups.delete(groupId);
          setGroupCollapsed(false);
        } else {
          this.collapsedPromptMigrationGroups.add(groupId);
          setGroupCollapsed(true);
        }
      }));
      for (const promptFile of promptFiles) {
        renderItem(groupItems, promptFile);
      }
    };
    renderGroup(PromptsStorage.local, localize("promptMigrationWorkspaceGroup", "Workspace"), workspacePromptFiles);
    renderGroup(PromptsStorage.user, localize("promptMigrationUserGroup", "User"), userPromptFiles);
    for (const promptFile of filteredPromptFiles.filter((file) => file.storage !== PromptsStorage.local && file.storage !== PromptsStorage.user)) {
      renderItem(this.migrationListContainer, promptFile);
    }
    this.updatePromptMigrationActionState();
    this.migrationListScrollable?.scanDomNode();
  }
  updatePromptMigrationPageDescription() {
    if (!this.migrationDescriptionElement) {
      return;
    }
    const migrationInfo = getPromptMigrationInfo(this.promptFilesToMigrate);
    if (!migrationInfo) {
      this.migrationDescriptionElement.textContent = localize("promptMigrationPageDescription", "Select prompt files to convert into skills for the active harness.");
      return;
    }
    const { workspacePromptCount, userPromptCount, totalPromptCount } = migrationInfo;
    const harnessLabel = this.getActiveHarnessLabel();
    if (workspacePromptCount > 0 && userPromptCount > 0) {
      this.migrationDescriptionElement.textContent = localize(
        "promptMigrationPageDescriptionWorkspaceAndUser",
        "Prompt files are not supported for this harness. Found {0} prompt files ({1} workspace, {2} user) that local VS Code can still run, but {3} ignores. Convert them to skills to keep them available.",
        totalPromptCount,
        workspacePromptCount,
        userPromptCount,
        harnessLabel
      );
      return;
    }
    if (workspacePromptCount > 0) {
      this.migrationDescriptionElement.textContent = localize(
        "promptMigrationPageDescriptionWorkspace",
        "Prompt files are not supported for this harness. Found {0} workspace prompt files that local VS Code can still run, but {1} ignores. Convert them to skills to keep them available.",
        workspacePromptCount,
        harnessLabel
      );
      return;
    }
    this.migrationDescriptionElement.textContent = localize(
      "promptMigrationPageDescriptionUser",
      "Prompt files are not supported for this harness. Found {0} user prompt files that local VS Code can still run, but {1} ignores. Convert them to skills to keep them available.",
      userPromptCount,
      harnessLabel
    );
  }
  updatePromptMigrationActionState() {
    if (!this.migrationMigrateButton) {
      return;
    }
    const selectedCount = this.promptFilesToMigrate.filter((file) => this.selectedPromptMigrationUris.has(file.uri)).length;
    this.migrationMigrateButton.enabled = selectedCount > 0;
    this.migrationMigrateButton.label = selectedCount > 0 ? localize("promptMigrationPageButtonWithCount", "Migrate ({0})", selectedCount) : localize("promptMigrationPageButton", "Migrate");
  }
  async deletePromptFile(promptFile) {
    const fileName = promptFile.name ?? basename(promptFile.uri);
    const confirmation = await this.dialogService.confirm({
      message: localize("confirmDeletePromptFile", "Are you sure you want to delete '{0}'?", fileName),
      detail: localize("confirmDeleteDetail", "This action cannot be undone."),
      primaryButton: localize("delete", "Delete"),
      type: "warning"
    });
    if (!confirmation.confirmed) {
      return;
    }
    const useTrash = this.fileService.hasCapability(promptFile.uri, FileSystemProviderCapabilities.Trash);
    await this.fileService.del(promptFile.uri, { useTrash });
    if (promptFile.storage === PromptsStorage.local) {
      const projectRoot = this.workspaceService.getActiveProjectRoot();
      if (projectRoot) {
        await this.workspaceService.deleteFiles(projectRoot, [promptFile.uri]);
      }
    }
    const updatedFiles = this.promptFilesToMigrate.filter((f) => !isEqual(f.uri, promptFile.uri));
    this.setPromptFilesToMigrate(updatedFiles);
  }
  isPromptMigrationEnabled() {
    return this.configurationService.getValue(ChatConfiguration.ChatCustomizationsPromptMigrationEnabled) === true;
  }
  async resolveMigrationSkillSourceFolders(skillSourceFolders, migrationInfo) {
    const sourceFoldersByStorage = /* @__PURE__ */ new Map();
    const localSkillSourceFolders = skillSourceFolders.filter((folder) => folder.source === PromptsStorage.local);
    if (localSkillSourceFolders.length > 0) {
      if ((migrationInfo?.workspacePromptCount ?? 0) > 0 && localSkillSourceFolders.length > 1) {
        const pickedLocalFolder = await this.pickMigrationWorkspaceSkillSourceFolder(localSkillSourceFolders);
        if (!pickedLocalFolder) {
          return void 0;
        }
        sourceFoldersByStorage.set(PromptsStorage.local, pickedLocalFolder);
      } else {
        sourceFoldersByStorage.set(PromptsStorage.local, localSkillSourceFolders[0]);
      }
    }
    for (const folder of skillSourceFolders) {
      if (folder.source === PromptsStorage.user && !sourceFoldersByStorage.has(PromptsStorage.user)) {
        sourceFoldersByStorage.set(PromptsStorage.user, folder);
      }
      if (folder.source === PromptsStorage.local && !sourceFoldersByStorage.has(PromptsStorage.local)) {
        sourceFoldersByStorage.set(PromptsStorage.local, folder);
      }
    }
    return sourceFoldersByStorage;
  }
  async pickMigrationWorkspaceSkillSourceFolder(localSkillSourceFolders) {
    const picks = localSkillSourceFolders.map((folder) => ({
      label: folder.label,
      description: this.labelService.getUriLabel(folder.uri, { relative: true }),
      folder
    }));
    const selected = await this.quickInputService.pick(picks, {
      canPickMany: false,
      placeHolder: localize("promptMigrationPickWorkspaceSkillFolder", "Select a workspace skill folder for migrated prompts"),
      matchOnDescription: true
    });
    return selected?.folder;
  }
  async revealMigratedSkills(skillUris) {
    if (skillUris.length === 0) {
      return;
    }
    await this.listWidget.setSection(AICustomizationManagementSection.Skills);
    if (this.listWidget.revealAndSelectFirstItemByUri(skillUris)) {
      return;
    }
    this.listWidget.clearSearch();
    if (this.listWidget.revealAndSelectFirstItemByUri(skillUris)) {
      return;
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      await timeout(100);
      if (this.listWidget.revealAndSelectFirstItemByUri(skillUris)) {
        return;
      }
    }
  }
  isPromptsSection(section) {
    return section === AICustomizationManagementSection.Agents || section === AICustomizationManagementSection.Skills || section === AICustomizationManagementSection.Instructions || section === AICustomizationManagementSection.Prompts || section === AICustomizationManagementSection.Hooks;
  }
  //#region Section Counts
  /**
   * Updates the count for a specific section and re-renders the sidebar.
   */
  updateSectionCount(sectionId, count) {
    const section = this.sections.find((s) => s.id === sectionId);
    if (!section || section.count === count) {
      return;
    }
    section.count = count;
    this.sectionsList.splice(0, this.sectionsList.length, this.sections);
    this.ensureSectionsListReflectsActiveSection();
  }
  //#endregion
  /**
   * Navigates to the welcome page (no section selected).
   */
  showWelcomePage() {
    if (this.viewMode === "editor") {
      this.goBackToList();
    }
    if (this.viewMode === "migration") {
      this.viewMode = "list";
    }
    if (this.viewMode === "mcpDetail") {
      this.goBackFromMcpDetail();
    }
    if (this.viewMode === "pluginDetail") {
      this.goBackFromPluginDetail();
    }
    if (this.viewMode === "toolsDetail") {
      this.goBackFromToolDetail();
    }
    this.selectedSection = void 0;
    this.sectionContextKey.set("");
    this.storageService.remove(AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY, StorageScope.PROFILE);
    this.welcomePage?.reset();
    this.updateContentVisibility();
    this.ensureSectionsListReflectsActiveSection(void 0);
    this.welcomePage?.focus();
  }
  selectSection(section, options) {
    if (this.selectedSection === section && !options?.showMarketplace) {
      this.ensureSectionsListReflectsActiveSection(section);
      return;
    }
    this.telemetryService.publicLog2("chatCustomizationEditor.sectionChanged", {
      section
    });
    if (this.viewMode === "editor") {
      this.goBackToList();
    }
    if (this.viewMode === "migration") {
      this.viewMode = "list";
    }
    if (this.viewMode === "mcpDetail") {
      this.goBackFromMcpDetail();
    }
    if (this.viewMode === "pluginDetail") {
      this.goBackFromPluginDetail();
    }
    if (this.viewMode === "toolsDetail") {
      this.goBackFromToolDetail();
    }
    this.selectedSection = section;
    this.sectionContextKey.set(section);
    this.storageService.store(AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY, section, StorageScope.PROFILE, StorageTarget.USER);
    this.updateContentVisibility();
    if (this.isPromptsSection(section)) {
      void this.listWidget.setSection(section);
    }
    if (this.dimension) {
      this.layout(this.dimension);
    }
    this.ensureSectionsListReflectsActiveSection(section);
    if (options?.showMarketplace) {
      if (section === AICustomizationManagementSection.McpServers) {
        this.mcpListWidget?.showBrowseMarketplace();
      } else if (section === AICustomizationManagementSection.Plugins) {
        this.pluginListWidget?.showBrowseMarketplace();
      }
    }
    if (section === AICustomizationManagementSection.McpServers) {
      this.mcpListWidget?.focusSearch();
    } else if (section === AICustomizationManagementSection.Plugins) {
      this.pluginListWidget?.focusSearch();
    } else if (section === AICustomizationManagementSection.Models) {
      this.modelsWidget?.focusSearch();
    } else if (section === AICustomizationManagementSection.Tools) {
      this.toolsListWidget?.focusSearch();
    } else {
      this.listWidget?.focusSearch();
    }
  }
  ensureSectionsListReflectsActiveSection(section = this.selectedSection) {
    if (!this.sectionsList) {
      return;
    }
    if (section === void 0) {
      this.sectionsList.setSelection([]);
      this.sectionsList.setFocus([]);
      return;
    }
    const index = this.sections.findIndex((s) => s.id === section);
    if (index < 0) {
      return;
    }
    const selection = this.sectionsList.getSelection();
    if (selection.length !== 1 || selection[0] !== index) {
      this.sectionsList.setSelection([index]);
    }
    const focus = this.sectionsList.getFocus();
    if (focus.length !== 1 || focus[0] !== index) {
      this.sectionsList.setFocus([index]);
    }
  }
  updateContentVisibility() {
    const isEditorMode = this.viewMode === "editor";
    const isMigrationMode = this.viewMode === "migration";
    const isMcpDetailMode = this.viewMode === "mcpDetail";
    const isPluginDetailMode = this.viewMode === "pluginDetail";
    const isToolsDetailMode = this.viewMode === "toolsDetail";
    const isDetailMode = isMcpDetailMode || isPluginDetailMode || isToolsDetailMode;
    const isWelcome = this.selectedSection === void 0;
    const isPromptsSection = this.selectedSection !== void 0 && this.isPromptsSection(this.selectedSection);
    const isModelsSection = this.selectedSection === AICustomizationManagementSection.Models;
    const isMcpSection = this.selectedSection === AICustomizationManagementSection.McpServers;
    const isPluginsSection = this.selectedSection === AICustomizationManagementSection.Plugins;
    const isToolsSection = this.selectedSection === AICustomizationManagementSection.Tools;
    if (this.welcomePage) {
      this.welcomePage.container.style.display = isWelcome && !isEditorMode && !isMigrationMode && !isDetailMode ? "" : "none";
    }
    if (this.promptsContentContainer) {
      this.promptsContentContainer.style.display = !isEditorMode && !isMigrationMode && !isDetailMode && isPromptsSection ? "" : "none";
    }
    if (this.migrationContentContainer) {
      this.migrationContentContainer.style.display = isMigrationMode ? "" : "none";
    }
    if (this.modelsContentContainer) {
      this.modelsContentContainer.style.display = !isEditorMode && !isMigrationMode && !isDetailMode && isModelsSection ? "" : "none";
    }
    if (this.mcpContentContainer) {
      this.mcpContentContainer.style.display = !isEditorMode && !isMigrationMode && !isDetailMode && isMcpSection ? "" : "none";
    }
    if (this.mcpDetailContainer) {
      this.mcpDetailContainer.style.display = isMcpDetailMode ? "" : "none";
    }
    if (this.pluginContentContainer) {
      this.pluginContentContainer.style.display = !isEditorMode && !isMigrationMode && !isDetailMode && isPluginsSection ? "" : "none";
    }
    if (this.pluginDetailContainer) {
      this.pluginDetailContainer.style.display = isPluginDetailMode ? "" : "none";
    }
    if (this.toolsContentContainer) {
      this.toolsContentContainer.style.display = !isEditorMode && !isMigrationMode && !isDetailMode && isToolsSection ? "" : "none";
    }
    if (this.toolsDetailContainer) {
      this.toolsDetailContainer.style.display = isToolsDetailMode ? "" : "none";
    }
    for (const [section, container] of this.contributedSectionContainers) {
      const visible = !isEditorMode && !isMigrationMode && !isDetailMode && this.selectedSection === section;
      container.style.display = visible ? "" : "none";
      if (visible) {
        this.ensureContributedSectionWidget(section);
      }
    }
    if (this.editorContentContainer) {
      this.editorContentContainer.style.display = isEditorMode ? "" : "none";
    }
    if (isModelsSection && this.modelsWidget) {
      this.modelsWidget.render();
      if (this.dimension) {
        this.layout(this.dimension);
      }
    }
  }
  ensureContributedSectionWidget(section) {
    const existing = this.contributedSectionWidgets.get(section);
    if (existing) {
      return existing;
    }
    const contribution = aiCustomizationManagementSectionRegistry.get(section, this.harnessService.activeHarness.get());
    const container = this.contributedSectionContainers.get(section);
    if (!contribution || !container) {
      return void 0;
    }
    const widget = contribution.create(this.instantiationService, container);
    this.contributedSectionWidgets.set(section, widget);
    this.editorDisposables.add(widget);
    if (this.dimension) {
      widget.layout?.(this.dimension);
    }
    return widget;
  }
  /**
   * Creates a new customization using the AI-guided flow.
   */
  async createNewItemWithAI(type) {
    this.telemetryService.publicLog2("chatCustomizationEditor.createItem", {
      section: this.selectedSection ?? "welcome",
      promptType: type,
      creationMode: "ai",
      target: "workspace"
    });
    if (this.input) {
      this.group.closeEditor(this.input);
    }
    await this.workspaceService.generateCustomization(type);
  }
  /**
   * Creates a new prompt file and opens it in the embedded editor.
   */
  async createNewItemManual(type, target, rootFileName) {
    this.telemetryService.publicLog2("chatCustomizationEditor.createItem", {
      section: this.selectedSection ?? "welcome",
      promptType: type,
      creationMode: "manual",
      target: target === "workspace-root" ? "workspace" : target
    });
    if (target === "workspace-root") {
      const projectRoot = this.workspaceService.getActiveProjectRoot();
      if (!projectRoot) {
        return;
      }
      const override2 = this.selectedSection ? this.harnessService.getActiveDescriptor().sectionOverrides?.get(this.selectedSection) : void 0;
      const fileName = rootFileName ?? override2?.rootFile ?? AGENT_MD_FILENAME;
      const fileUri = URI.joinPath(projectRoot, fileName);
      if (await this.fileService.exists(fileUri)) {
        await this.showEmbeddedEditor(fileUri, fileName, PromptsType.instructions, PromptsStorage.local, true);
      } else {
        await this.fileService.createFile(fileUri);
        await this.showEmbeddedEditor(fileUri, fileName, PromptsType.instructions, PromptsStorage.local, true);
      }
      this.listWidget.refresh();
      return;
    }
    if (type === PromptsType.hook) {
      if (this.workspaceService.isSessionsWindow) {
        await this.instantiationService.invokeFunction(showConfigureHooksQuickPick, {
          openEditor: async (resource) => {
            await this.showEmbeddedEditor(resource, basename(resource), PromptsType.hook, PromptsStorage.local, true);
            return;
          },
          target: Target.GitHubCopilot
        });
      } else {
        await this.instantiationService.invokeFunction(showConfigureHooksQuickPick, {
          openEditor: async (resource) => {
            await this.showEmbeddedEditor(resource, basename(resource), PromptsType.hook, PromptsStorage.local, true);
            return;
          }
        });
      }
      return;
    }
    const sessionResource = this.harnessService.activeSessionResource.get();
    const picker = this.instantiationService.createInstance(CustomizationLocationPicker);
    const targetDir = await picker.resolveTargetDirectoryWithPicker(
      sessionResource,
      type,
      target
    );
    if (targetDir === null) {
      return;
    }
    if (targetDir === void 0) {
      await this.instantiationService.invokeFunction(showNoFoldersDialog, type);
      return;
    }
    const override = this.selectedSection ? this.harnessService.getActiveDescriptor().sectionOverrides?.get(this.selectedSection) : void 0;
    const options = {
      targetFolder: targetDir,
      targetStorage: target === AICustomizationSources.user ? PromptsStorage.user : PromptsStorage.local,
      fileExtension: override?.fileExtension,
      openFile: async (uri) => {
        const isWorkspace = target === AICustomizationSources.local;
        await this.showEmbeddedEditor(uri, basename(uri), type, target, isWorkspace);
        return this.embeddedEditor;
      }
    };
    let commandId;
    switch (type) {
      case PromptsType.prompt:
        commandId = NEW_PROMPT_COMMAND_ID;
        break;
      case PromptsType.instructions:
        commandId = NEW_INSTRUCTIONS_COMMAND_ID;
        break;
      case PromptsType.agent:
        commandId = NEW_AGENT_COMMAND_ID;
        break;
      case PromptsType.skill:
        commandId = NEW_SKILL_COMMAND_ID;
        break;
      default:
        return;
    }
    await this.commandService.executeCommand(commandId, options);
    this.listWidget.refresh();
  }
  updateStyles() {
    this.splitView?.style({ separatorBorder: Color.transparent });
  }
  async setInput(input, options, context, token) {
    this.workspaceService.clearOverrideProjectRoot();
    this.inEditorContextKey.set(true);
    this.sectionContextKey.set(this.selectedSection ?? "");
    input.setSaveHandler(() => this.handleBuiltinSave());
    this.telemetryService.publicLog2("chatCustomizationEditor.opened", {
      section: this.selectedSection ?? "welcome"
    });
    await super.setInput(input, options, context, token);
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  clearInput() {
    const input = this.input;
    if (input instanceof AICustomizationManagementEditorInput) {
      input.setSaveHandler(void 0);
      input.setDirty(false);
    }
    this.inEditorContextKey.set(false);
    if (this.viewMode === "editor") {
      this.goBackToList();
    }
    if (this.viewMode === "migration") {
      this.viewMode = "list";
    }
    if (this.viewMode === "mcpDetail") {
      this.goBackFromMcpDetail();
    }
    if (this.viewMode === "pluginDetail") {
      this.goBackFromPluginDetail();
    }
    if (this.viewMode === "toolsDetail") {
      this.goBackFromToolDetail();
    }
    this.workspaceService.clearOverrideProjectRoot();
    this.disposeBuiltinEditingSessions();
    super.clearInput();
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    if (visible && this.dimension) {
      this.layout(this.dimension);
    }
  }
  layout(dimension) {
    this.dimension = dimension;
    if (this.container && this.splitView) {
      this.splitViewContainer.style.height = `${dimension.height}px`;
      this.splitView.layout(dimension.width, dimension.height);
    }
    for (const widget of this.contributedSectionWidgets.values()) {
      widget.layout?.(dimension);
    }
    this.migrationSearchInput?.layout();
    this.migrationListScrollable?.scanDomNode();
  }
  focus() {
    super.focus();
    if (this.viewMode === "editor") {
      if (this.editorDisplayMode === "raw") {
        this.embeddedEditor?.focus();
      } else {
        this.editorModeButton?.focus();
      }
      return;
    }
    if (this.viewMode === "migration") {
      this.migrationSearchInput?.focus();
      return;
    }
    if (this.selectedSection === void 0) {
      this.welcomePage?.focus();
      return;
    }
    if (this.selectedSection === AICustomizationManagementSection.McpServers) {
      this.mcpListWidget?.focusSearch();
    } else if (this.selectedSection === AICustomizationManagementSection.Plugins) {
      this.pluginListWidget?.focusSearch();
    } else if (this.selectedSection === AICustomizationManagementSection.Models) {
      this.modelsWidget?.focusSearch();
    } else if (this.selectedSection === AICustomizationManagementSection.Tools) {
      this.toolsListWidget?.focusSearch();
    } else if (this.selectedSection && this.contributedSectionContainers.has(this.selectedSection)) {
      this.ensureContributedSectionWidget(this.selectedSection)?.focus?.();
    } else {
      this.listWidget?.focusSearch();
    }
  }
  /**
   * Selects a specific section programmatically.
   */
  selectSectionById(sectionId, options) {
    const index = this.sections.findIndex((s) => s.id === sectionId);
    if (index >= 0) {
      if (this.viewMode === "editor") {
        this.goBackToList();
      }
      if (this.viewMode === "migration") {
        this.viewMode = "list";
      }
      if (this.viewMode === "mcpDetail") {
        this.goBackFromMcpDetail();
      }
      if (this.viewMode === "pluginDetail") {
        this.goBackFromPluginDetail();
      }
      if (this.viewMode === "toolsDetail") {
        this.goBackFromToolDetail();
      }
      this.selectedSection = sectionId;
      this.sectionContextKey.set(sectionId);
      this.storageService.store(AI_CUSTOMIZATION_MANAGEMENT_SELECTED_SECTION_KEY, sectionId, StorageScope.PROFILE, StorageTarget.USER);
      this.updateContentVisibility();
      if (this.isPromptsSection(sectionId)) {
        void this.listWidget.setSection(sectionId);
      }
      if (this.dimension) {
        this.layout(this.dimension);
      }
      this.ensureSectionsListReflectsActiveSection(sectionId);
      if (options?.showMarketplace) {
        if (sectionId === AICustomizationManagementSection.McpServers) {
          this.mcpListWidget?.showBrowseMarketplace();
        } else if (sectionId === AICustomizationManagementSection.Plugins) {
          this.pluginListWidget?.showBrowseMarketplace();
        }
      }
    }
  }
  showPromptMigrationPage() {
    if (!this.isPromptMigrationEnabled()) {
      return;
    }
    if (this.viewMode === "editor") {
      this.goBackToList();
    }
    if (this.viewMode === "mcpDetail") {
      this.goBackFromMcpDetail();
    }
    if (this.viewMode === "pluginDetail") {
      this.goBackFromPluginDetail();
    }
    if (this.viewMode === "toolsDetail") {
      this.goBackFromToolDetail();
    }
    this.selectedSection = void 0;
    this.sectionContextKey.set("");
    this.viewMode = "migration";
    this.ensureSectionsListReflectsActiveSection(void 0);
    this.renderPromptMigrationPage();
    this.updateContentVisibility();
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  /**
   * Refreshes the list widget.
   */
  refreshList() {
    this.listWidget.refresh();
  }
  /**
   * Scrolls the active list widget so the last item is visible.
   */
  revealLastItem() {
    if (this.selectedSection === AICustomizationManagementSection.McpServers) {
      this.mcpListWidget?.revealLastItem();
    } else if (this.selectedSection === AICustomizationManagementSection.Plugins) {
      this.pluginListWidget?.revealLastItem();
    } else {
      this.listWidget.revealLastItem();
    }
  }
  /**
   * Generates a debug report for the current section.
   */
  async generateDebugReport() {
    return this.listWidget.generateDebugReport();
  }
  //#region Embedded Editor
  createEmbeddedEditor() {
    if (!this.editorContentContainer) {
      return;
    }
    const editorHeader = DOM.append(this.editorContentContainer, $(".editor-header"));
    this.editorActionButton = DOM.append(editorHeader, $("button.editor-back-button"));
    this.editorActionButton.setAttribute("aria-label", localize("backToList", "Back to list"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this.editorActionButton, localize("backToListTooltip", "Back to list")));
    this.editorActionButtonIcon = DOM.append(this.editorActionButton, $(`.codicon.codicon-${Codicon.arrowLeft.id}.editor-action-button-icon`));
    this.editorActionButtonIcon.setAttribute("aria-hidden", "true");
    this.editorDisposables.add(DOM.addDisposableListener(this.editorActionButton, "click", () => {
      void this.handleEditorActionButton().catch((error) => {
        console.error("Failed to handle editor back action:", error);
        this.notificationService.error(localize("editorActionButtonFailed", "Failed to finish the prompt action."));
      });
    }));
    const itemInfo = DOM.append(editorHeader, $(".editor-item-info"));
    this.editorItemNameElement = DOM.append(itemInfo, $(".editor-item-name"));
    this.editorItemPathElement = DOM.append(itemInfo, $(".editor-item-path"));
    this.editorModeButton = DOM.append(editorHeader, $("button.editor-mode-button"));
    this.editorModeButton.type = "button";
    this.editorModeButton.setAttribute("aria-pressed", "false");
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this.editorModeButton, () => this.getEditorModeButtonTooltip()));
    this.editorDisposables.add(DOM.addDisposableListener(this.editorModeButton, "click", () => {
      this.toggleEditorDisplayMode();
    }));
    this.editorSaveIndicator = DOM.append(editorHeader, $(".editor-save-indicator"));
    this.editorPreviewContainer = DOM.append(this.editorContentContainer, $(".editor-preview-container"));
    this.editorPreviewScrollContainer = DOM.append(this.editorPreviewContainer, $(".editor-preview-scroll-container"));
    this.editorPreviewScrollContainer.setAttribute("role", "region");
    this.editorPreviewScrollContainer.setAttribute("aria-label", localize("customizationPreviewAriaLabel", "Customization preview"));
    this.editorPreviewIssuesContainer = DOM.append(this.editorPreviewScrollContainer, $(".editor-preview-issues"));
    const frontMatterSection = DOM.append(this.editorPreviewScrollContainer, $(".editor-preview-section.editor-preview-frontmatter-section"));
    this.editorPreviewFrontMatterContainer = DOM.append(frontMatterSection, $(".editor-preview-frontmatter-list"));
    const bodySection = DOM.append(this.editorPreviewScrollContainer, $(".editor-preview-section.editor-preview-body-section"));
    this.editorPreviewBodyContainer = DOM.append(bodySection, $(".editor-preview-body-content"));
    this.embeddedEditorContainer = DOM.append(this.editorContentContainer, $(".embedded-editor-container"));
    const overflowWidgetsDomNode = DOM.append(this.editorContentContainer, $(".embedded-editor-overflow-widgets.monaco-editor"));
    this.editorDisposables.add(toDisposable(() => overflowWidgetsDomNode.remove()));
    this.embeddedEditor = this.editorDisposables.add(this.instantiationService.createInstance(
      CodeEditorWidget,
      this.embeddedEditorContainer,
      {
        ...getSimpleEditorOptions(this.configurationService),
        readOnly: false,
        minimap: { enabled: false },
        lineNumbers: "on",
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: false,
        folding: true,
        renderLineHighlight: "all",
        scrollbar: { vertical: "auto", horizontal: "auto" },
        overflowWidgetsDomNode
      },
      { isSimpleWidget: false }
    ));
    this.updateEditorDisplayMode();
  }
  async showEmbeddedEditor(uri, displayName, promptType, source, isWorkspaceFile = false, isReadOnly = false) {
    this.editorReturnViewMode = this.viewMode === "migration" ? "migration" : "list";
    this.currentModelRef?.dispose();
    this.currentModelRef = void 0;
    this.editorModelChangeDisposables.clear();
    this.editorPreviewDisposables.clear();
    this.editorPreviewRenderScheduler.cancel();
    this.currentEditingUri = uri;
    this.currentEditingProjectRoot = isWorkspaceFile ? this.workspaceService.getActiveProjectRoot() : void 0;
    this.currentEditingSource = source;
    this.currentEditingPromptType = promptType;
    this.currentEditingReadOnly = isReadOnly;
    this.editorDisplayMode = this.isStructuredPreviewSupported(promptType) ? "preview" : "raw";
    this.viewMode = "editor";
    this.editorItemNameElement.textContent = displayName;
    this.editorItemPathElement.textContent = basename(uri);
    this._editorContentChanged = false;
    this.resetEditorSaveIndicator();
    this.updateEditorActionButton();
    this.updateEditorDisplayMode();
    this.updateContentVisibility();
    try {
      if (source === AICustomizationSources.builtin && (promptType === PromptsType.prompt || promptType === PromptsType.skill)) {
        const session = await this.getOrCreateBuiltinEditingSession(uri);
        if (!isEqual(this.currentEditingUri, uri)) {
          return;
        }
        this.embeddedEditor.setModel(session.model);
        this.embeddedEditor.updateOptions({ readOnly: false });
        this._editorContentChanged = session.model.getValue() !== session.originalContent;
        this.renderCurrentEditorPreview();
        this.updateEditorActionButton();
        if (this.dimension) {
          this.layout(this.dimension);
        }
        if (this.editorDisplayMode === "raw") {
          this.embeddedEditor.focus();
        } else {
          this.editorModeButton?.focus();
        }
        this.editorModelChangeDisposables.add(session.model.onDidChangeContent(() => {
          this._editorContentChanged = session.model.getValue() !== session.originalContent;
          this.scheduleCurrentEditorPreviewRender();
          this.updateEditorActionButton();
        }));
        return;
      }
      const ref = await this.textModelService.createModelReference(uri);
      if (!isEqual(this.currentEditingUri, uri)) {
        ref.dispose();
        return;
      }
      this.currentModelRef = ref;
      this.embeddedEditor.setModel(ref.object.textEditorModel);
      this.embeddedEditor.updateOptions({ readOnly: isReadOnly });
      this.renderCurrentEditorPreview();
      if (this.dimension) {
        this.layout(this.dimension);
      }
      if (this.editorDisplayMode === "raw") {
        this.embeddedEditor.focus();
      } else {
        this.editorModeButton?.focus();
      }
      this._editorContentChanged = this.workingCopyService.isDirty(uri);
      this.editorModelChangeDisposables.add(ref.object.textEditorModel.onDidChangeContent(() => {
        this._editorContentChanged = true;
        this.scheduleCurrentEditorPreviewRender();
        this.resetEditorSaveIndicator();
      }));
      this.editorModelChangeDisposables.add(this.workingCopyService.onDidSave((e) => {
        if (isEqual(e.workingCopy.resource, uri)) {
          this._editorContentChanged = this.workingCopyService.isDirty(uri);
          this.editorSaveIndicator.className = "editor-save-indicator visible saved";
          this.editorSaveIndicator.classList.add(...ThemeIcon.asClassNameArray(Codicon.check));
          this.editorSaveIndicator.title = localize("saved", "Saved");
          this.editorSaveIndicator.setAttribute("aria-label", localize("saved", "Saved"));
          status(localize("saved", "Saved"));
        }
      }));
    } catch (error) {
      console.error("Failed to load model for embedded editor:", error);
      if (isEqual(this.currentEditingUri, uri)) {
        this.goBackToList();
      }
    }
  }
  goBackToList() {
    const returnViewMode = this.editorReturnViewMode;
    this.editorReturnViewMode = "list";
    const fileUri = this.currentEditingUri;
    const backgroundSaveRequest = this.createExistingCustomizationSaveRequest();
    if (backgroundSaveRequest) {
      this.telemetryService.publicLog2("chatCustomizationEditor.saveItem", {
        promptType: this.currentEditingPromptType ?? "",
        storage: String(this.currentEditingSource ?? ""),
        saveTarget: "existing"
      });
    }
    if (fileUri && this.currentEditingSource === AICustomizationSources.builtin) {
      this.disposeBuiltinEditingSession(fileUri);
    }
    this.currentModelRef?.dispose();
    this.currentModelRef = void 0;
    this.currentEditingUri = void 0;
    this.currentEditingProjectRoot = void 0;
    this.currentEditingSource = void 0;
    this.currentEditingPromptType = void 0;
    this.currentEditingReadOnly = false;
    this.editorDisplayMode = "preview";
    this._editorContentChanged = false;
    this.editorModelChangeDisposables.clear();
    this.editorPreviewRenderScheduler.cancel();
    this.clearEditorPreview();
    this.resetEditorSaveIndicator();
    this.updateEditorActionButton();
    this.updateEditorDisplayMode();
    this.embeddedEditor?.setModel(null);
    this.viewMode = returnViewMode;
    this.updateContentVisibility();
    if (returnViewMode === "migration") {
      this.renderPromptMigrationPage();
      void this.refreshPromptMigrationInfo();
    } else {
      void this.listWidget?.refresh();
    }
    if (this.dimension) {
      this.layout(this.dimension);
    }
    if (returnViewMode === "migration") {
      this.migrationSearchInput?.focus();
    } else {
      this.listWidget?.focusSearch();
    }
    if (backgroundSaveRequest) {
      const saveRequest = backgroundSaveRequest;
      void this.saveExistingCustomization(saveRequest).catch((error) => {
        console.error("Failed to save customization changes on exit:", error);
        this.notificationService.warn(localize("saveCustomizationOnExitFailed", "Could not save changes to {0}.", basename(saveRequest.fileUri)));
      });
    }
  }
  //#endregion
  async getOrCreateBuiltinEditingSession(uri) {
    const key = uri.toString();
    const existing = this.builtinEditingSessions.get(key);
    if (existing && !existing.model.isDisposed()) {
      return existing;
    }
    const ref = await this.textModelService.createModelReference(uri);
    try {
      const session = {
        model: this.modelService.createModel(
          createTextBufferFactoryFromSnapshot(ref.object.textEditorModel.createSnapshot()),
          { languageId: ref.object.textEditorModel.getLanguageId(), onDidChange: Event.None },
          URI.from({ scheme: "ai-customization-builtin", path: uri.path, query: generateUuid() }),
          false
        ),
        originalContent: ref.object.textEditorModel.getValue()
      };
      this.builtinEditingSessions.set(key, session);
      return session;
    } finally {
      ref.dispose();
    }
  }
  createBuiltinPromptSaveRequest(target) {
    const sourceUri = this.currentEditingUri;
    const promptType = this.currentEditingPromptType;
    if (!sourceUri || this.currentEditingSource !== AICustomizationSources.builtin || promptType !== PromptsType.prompt && promptType !== PromptsType.skill || !target.folder || target.target === "cancel") {
      return;
    }
    const session = this.builtinEditingSessions.get(sourceUri.toString());
    if (!session || !this._editorContentChanged) {
      return;
    }
    return {
      target: target.target,
      folder: target.folder,
      sourceUri,
      content: session.model.getValue(),
      promptType,
      projectRoot: target.target === "workspace" ? this.workspaceService.getActiveProjectRoot() : void 0
    };
  }
  createExistingCustomizationSaveRequest() {
    if (!this._editorContentChanged || this.currentEditingSource === AICustomizationSources.builtin || !this.currentEditingUri) {
      return void 0;
    }
    const model = this.currentModelRef?.object.textEditorModel;
    if (!model) {
      return void 0;
    }
    return {
      fileUri: this.currentEditingUri,
      content: model.getValue(),
      projectRoot: this.currentEditingProjectRoot
    };
  }
  async saveBuiltinPromptCopy(request) {
    let targetUri;
    if (request.promptType === PromptsType.skill) {
      const skillFolderName = basename(dirname(request.sourceUri));
      targetUri = URI.joinPath(request.folder, skillFolderName, basename(request.sourceUri));
    } else {
      targetUri = URI.joinPath(request.folder, basename(request.sourceUri));
    }
    await this.fileService.createFolder(dirname(targetUri));
    await this.fileService.writeFile(targetUri, VSBuffer.fromString(request.content));
    if (request.target === "workspace" && request.projectRoot) {
      await this.workspaceService.commitFiles(request.projectRoot, [targetUri]);
    }
  }
  async saveExistingCustomization(request) {
    await this.fileService.writeFile(request.fileUri, VSBuffer.fromString(request.content));
    if (request.projectRoot) {
      await this.workspaceService.commitFiles(request.projectRoot, [request.fileUri]);
    }
  }
  async pickBuiltinPromptSaveTarget() {
    const items = [];
    const promptType = this.currentEditingPromptType ?? PromptsType.prompt;
    const workspaceFolder = resolveWorkspaceTargetDirectory(this.workspaceService, promptType);
    if (workspaceFolder) {
      items.push({
        label: localize("workspaceSaveTarget", "Workspace"),
        description: this.labelService.getUriLabel(workspaceFolder, { relative: true }),
        target: "workspace",
        folder: workspaceFolder
      });
    }
    const userFolder = await resolveUserTargetDirectory(this.promptsService, promptType);
    if (userFolder) {
      items.push({
        label: localize("userSaveTarget", "User"),
        description: this.labelService.getUriLabel(userFolder, { relative: true }),
        target: "user",
        folder: userFolder
      });
    }
    items.push({
      label: localize("cancelSaveTarget", "Cancel"),
      target: "cancel"
    });
    return this.quickInputService.pick(items, {
      canPickMany: false,
      placeHolder: localize("saveBuiltinCopyPlaceholder", "Select Workspace, User, or Cancel"),
      matchOnDescription: true
    });
  }
  async handleEditorActionButton() {
    if (this.editorActionButtonInProgress) {
      return;
    }
    this.editorActionButtonInProgress = true;
    this.updateEditorActionButton();
    let backgroundSaveRequest;
    try {
      if (this.shouldShowBuiltinSaveAction()) {
        const selection = await this.pickBuiltinPromptSaveTarget();
        if (!selection || selection.target === "cancel") {
          return;
        }
        backgroundSaveRequest = this.createBuiltinPromptSaveRequest(selection);
        if (backgroundSaveRequest) {
          this.telemetryService.publicLog2("chatCustomizationEditor.saveItem", {
            promptType: this.currentEditingPromptType ?? "",
            storage: String(this.currentEditingSource ?? ""),
            saveTarget: selection.target
          });
        }
      }
      this.goBackToList();
      if (backgroundSaveRequest) {
        const saveRequest = backgroundSaveRequest;
        void this.saveBuiltinPromptCopy(saveRequest).then(() => {
          void this.listWidget?.refresh();
        }, (error) => {
          console.error("Failed to save built-in override:", error);
          this.notificationService.warn(saveRequest.target === "workspace" ? localize("saveBuiltinCopyFailedWorkspace", "Could not save the override to the workspace.") : localize("saveBuiltinCopyFailedUser", "Could not save the override to your user folder."));
        });
      }
    } finally {
      this.editorActionButtonInProgress = false;
      this.updateEditorActionButton();
    }
  }
  updateEditorActionButton() {
    this.updateInputDirtyState();
    if (!this.editorActionButton || !this.editorActionButtonIcon) {
      return;
    }
    const shouldShowBuiltinSaveAction = this.shouldShowBuiltinSaveAction();
    this.editorActionButtonIcon.className = `codicon codicon-${shouldShowBuiltinSaveAction ? Codicon.save.id : Codicon.arrowLeft.id} editor-action-button-icon`;
    this.editorActionButton.disabled = this.editorActionButtonInProgress;
    this.editorActionButton.setAttribute("aria-label", shouldShowBuiltinSaveAction ? localize("saveBuiltinCopyAndChooseLocation", "Save override") : this.editorReturnViewMode === "migration" ? localize("backToPromptMigration", "Back to Migrate Prompt Files") : localize("backToList", "Back to list"));
    this.editorActionButton.title = shouldShowBuiltinSaveAction ? localize("saveBuiltinCopyAndChooseLocationTooltip", "Save override (choose Workspace, User, or Cancel)") : this.editorReturnViewMode === "migration" ? localize("backToPromptMigrationTooltip", "Back to Migrate Prompt Files") : localize("backToList", "Back to list");
  }
  shouldShowBuiltinSaveAction() {
    return this._editorContentChanged && this.currentEditingSource === AICustomizationSources.builtin && (this.currentEditingPromptType === PromptsType.prompt || this.currentEditingPromptType === PromptsType.skill);
  }
  updateInputDirtyState() {
    const input = this.input;
    if (input instanceof AICustomizationManagementEditorInput) {
      input.setDirty(this.shouldShowBuiltinSaveAction());
    }
  }
  async handleBuiltinSave() {
    if (!this.shouldShowBuiltinSaveAction()) {
      return false;
    }
    const target = await this.pickBuiltinPromptSaveTarget();
    if (!target || target.target === "cancel") {
      return false;
    }
    const saveRequest = this.createBuiltinPromptSaveRequest(target);
    if (!saveRequest) {
      return false;
    }
    try {
      await this.saveBuiltinPromptCopy(saveRequest);
      this.telemetryService.publicLog2("chatCustomizationEditor.saveItem", {
        promptType: this.currentEditingPromptType ?? "",
        storage: String(this.currentEditingSource ?? ""),
        saveTarget: target.target
      });
      this._editorContentChanged = false;
      this.updateEditorActionButton();
      return true;
    } catch (error) {
      console.error("Failed to save built-in override:", error);
      this.notificationService.warn(target.target === "workspace" ? localize("saveBuiltinCopyFailedWorkspace", "Could not save the override to the workspace.") : localize("saveBuiltinCopyFailedUser", "Could not save the override to your user folder."));
      return false;
    }
  }
  resetEditorSaveIndicator() {
    this.editorSaveIndicator.className = "editor-save-indicator";
    this.editorSaveIndicator.title = "";
    this.editorSaveIndicator.removeAttribute("aria-label");
  }
  isStructuredPreviewSupported(promptType) {
    if (this.configurationService.getValue(ChatConfiguration.ChatCustomizationsStructuredPreviewEnabled) !== true) {
      return false;
    }
    return promptType === PromptsType.agent || promptType === PromptsType.skill || promptType === PromptsType.instructions || promptType === PromptsType.prompt;
  }
  onStructuredPreviewSettingChanged() {
    if (this.viewMode !== "editor") {
      return;
    }
    const supportsStructuredPreview = this.isStructuredPreviewSupported(this.currentEditingPromptType);
    if (!supportsStructuredPreview) {
      this.editorDisplayMode = "raw";
      this.editorPreviewRenderScheduler.cancel();
      this.clearEditorPreview();
    } else if (this.editorDisplayMode === "preview") {
      this.editorPreviewRenderScheduler.schedule();
    }
    this.updateEditorDisplayMode();
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  getCurrentEditingModel() {
    if (!this.currentEditingUri) {
      return void 0;
    }
    if (this.currentEditingSource === AICustomizationSources.builtin) {
      return this.builtinEditingSessions.get(this.currentEditingUri.toString())?.model;
    }
    return this.currentModelRef?.object.textEditorModel;
  }
  toggleEditorDisplayMode() {
    if (!this.isStructuredPreviewSupported(this.currentEditingPromptType)) {
      return;
    }
    this.editorDisplayMode = this.editorDisplayMode === "preview" ? "raw" : "preview";
    if (this.editorDisplayMode === "preview") {
      this.editorPreviewRenderScheduler.cancel();
      this.renderCurrentEditorPreview();
    }
    this.updateEditorDisplayMode();
    if (this.dimension) {
      this.layout(this.dimension);
    }
    if (this.editorDisplayMode === "raw") {
      this.embeddedEditor?.focus();
    } else {
      this.editorModeButton?.focus();
    }
  }
  updateEditorDisplayMode() {
    const supportsStructuredPreview = this.isStructuredPreviewSupported(this.currentEditingPromptType);
    const showPreview = supportsStructuredPreview && this.editorDisplayMode === "preview";
    if (this.editorModeButton) {
      this.editorModeButton.style.display = supportsStructuredPreview ? "" : "none";
      this.editorModeButton.textContent = this.getEditorModeButtonLabel();
      this.editorModeButton.setAttribute("aria-label", this.getEditorModeButtonTooltip());
      this.editorModeButton.setAttribute("aria-pressed", String(this.editorDisplayMode === "raw"));
      this.editorModeButton.title = this.getEditorModeButtonTooltip();
    }
    if (this.editorPreviewContainer) {
      this.editorPreviewContainer.style.display = showPreview ? "" : "none";
    }
    if (this.embeddedEditorContainer) {
      this.embeddedEditorContainer.style.display = showPreview ? "none" : "";
    }
  }
  getEditorModeButtonLabel() {
    if (!this.isStructuredPreviewSupported(this.currentEditingPromptType)) {
      return "";
    }
    if (this.editorDisplayMode === "raw") {
      return localize("editorPreviewButtonLabel", "Preview");
    }
    return this.canEditCurrentRaw() ? localize("editorEditRawButtonLabel", "Edit") : localize("editorViewRawButtonLabel", "View Raw");
  }
  getEditorModeButtonTooltip() {
    if (!this.isStructuredPreviewSupported(this.currentEditingPromptType)) {
      return "";
    }
    if (this.editorDisplayMode === "raw") {
      return localize("editorPreviewButtonTooltip", "Show structured preview");
    }
    return this.canEditCurrentRaw() ? localize("editorEditRawButtonTooltip", "Edit the raw markdown file") : localize("editorViewRawButtonTooltip", "Show the raw markdown file");
  }
  canEditCurrentRaw() {
    const promptType = this.currentEditingPromptType;
    if (!promptType) {
      return false;
    }
    return this.currentEditingSource === AICustomizationSources.builtin && (promptType === PromptsType.prompt || promptType === PromptsType.skill) || !this.currentEditingReadOnly;
  }
  scheduleCurrentEditorPreviewRender() {
    if (this.editorDisplayMode !== "preview") {
      return;
    }
    this.editorPreviewRenderScheduler.schedule();
  }
  renderCurrentEditorPreview() {
    const model = this.getCurrentEditingModel();
    const promptType = this.currentEditingPromptType;
    if (!model || !promptType || this.editorDisplayMode !== "preview" || !this.isStructuredPreviewSupported(promptType)) {
      this.clearEditorPreview();
      return;
    }
    const parsedPromptFile = this.promptsService.getParsedPromptFile(model);
    this.renderEditorPreview(parsedPromptFile, promptType);
  }
  renderEditorPreview(parsedPromptFile, promptType) {
    if (!this.editorPreviewIssuesContainer || !this.editorPreviewFrontMatterContainer || !this.editorPreviewBodyContainer) {
      return;
    }
    this.editorPreviewDisposables.clear();
    DOM.clearNode(this.editorPreviewIssuesContainer);
    DOM.clearNode(this.editorPreviewFrontMatterContainer);
    DOM.clearNode(this.editorPreviewBodyContainer);
    const target = getTarget(promptType, parsedPromptFile.header ?? parsedPromptFile.uri);
    this.renderPreviewIssues(parsedPromptFile);
    this.renderPreviewFrontMatter(parsedPromptFile, promptType, target);
    this.renderPreviewBody(parsedPromptFile);
  }
  renderPreviewIssues(parsedPromptFile) {
    if (!this.editorPreviewIssuesContainer || !parsedPromptFile.header?.errors.length) {
      return;
    }
    const issuesContainer = DOM.append(this.editorPreviewIssuesContainer, $(".editor-preview-issues-box"));
    DOM.append(issuesContainer, $("div.editor-preview-issues-title")).textContent = localize("previewHeaderIssuesTitle", "Header issues detected");
    DOM.append(issuesContainer, $("div.editor-preview-issues-description")).textContent = localize("previewHeaderIssuesDescription", "Switch to raw view to fix invalid or unsupported metadata entries.");
    const list = DOM.append(issuesContainer, $("ul.editor-preview-issues-list"));
    for (const error of parsedPromptFile.header.errors) {
      DOM.append(list, $("li.editor-preview-issues-item")).textContent = error.message;
    }
  }
  renderPreviewFrontMatter(parsedPromptFile, promptType, target) {
    if (!this.editorPreviewFrontMatterContainer) {
      return;
    }
    const attributes = parsedPromptFile.header?.attributes ?? [];
    if (!attributes.length) {
      DOM.append(this.editorPreviewFrontMatterContainer, $("div.editor-preview-empty-state")).textContent = localize("previewNoFrontMatter", "No metadata found in this file.");
      return;
    }
    for (const attribute of attributes) {
      this.renderPreviewAttribute(attribute, promptType, target);
    }
  }
  renderPreviewAttribute(attribute, promptType, target) {
    if (!this.editorPreviewFrontMatterContainer) {
      return;
    }
    const row = DOM.append(this.editorPreviewFrontMatterContainer, $(".editor-preview-row"));
    const header = DOM.append(row, $(".editor-preview-row-header"));
    DOM.append(header, $("div.editor-preview-row-key")).textContent = attribute.key;
    const helpButton = DOM.append(header, $("button.editor-preview-row-help"));
    helpButton.type = "button";
    helpButton.setAttribute("aria-label", localize("previewFieldHelpAriaLabel", "Show help for '{0}'", attribute.key));
    const helpIcon = DOM.append(helpButton, $("span.editor-preview-row-help-icon"));
    helpIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
    helpIcon.setAttribute("aria-hidden", "true");
    const description = getAttributeDefinition(attribute.key, promptType, target)?.description ?? localize("previewUnknownFieldDescription", "Custom metadata field `{0}`.", attribute.key);
    const helpHover = this.editorPreviewDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), helpButton, {
      markdown: new MarkdownString(description),
      markdownNotSupportedFallback: description
    }));
    this.editorPreviewDisposables.add(DOM.addDisposableListener(helpButton, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      helpHover.show(true);
    }));
    const valueElement = DOM.append(row, $("div.editor-preview-row-value"));
    const valueText = this.stringifyPreviewValue(attribute.value);
    valueElement.textContent = valueText;
    valueElement.classList.toggle("multiline", valueText.includes("\n"));
  }
  renderPreviewBody(parsedPromptFile) {
    if (!this.editorPreviewBodyContainer) {
      return;
    }
    const bodyContent = parsedPromptFile.body?.getContent() ?? "";
    if (!bodyContent.trim()) {
      DOM.append(this.editorPreviewBodyContainer, $("div.editor-preview-empty-state")).textContent = localize("previewNoBody", "No markdown body found in this file.");
      return;
    }
    const markdown = new MarkdownString(bodyContent, { supportThemeIcons: true });
    markdown.baseUri = parsedPromptFile.uri;
    const renderedMarkdown = this.editorPreviewDisposables.add(this.markdownRendererService.render(markdown));
    this.editorPreviewBodyContainer.appendChild(renderedMarkdown.element);
  }
  stringifyPreviewValue(value) {
    switch (value.type) {
      case "scalar":
        return value.value;
      case "sequence":
        if (value.items.every((item) => item.type === "scalar")) {
          return value.items.map((item) => item.value).join("\n");
        }
        return JSON.stringify(this.toPreviewObject(value), null, 2);
      case "map":
        return JSON.stringify(this.toPreviewObject(value), null, 2);
    }
  }
  toPreviewObject(value) {
    switch (value.type) {
      case "scalar":
        return value.value;
      case "sequence":
        return value.items.map((item) => this.toPreviewObject(item));
      case "map": {
        const entries = {};
        for (const property of value.properties) {
          entries[property.key.value] = this.toPreviewObject(property.value);
        }
        return entries;
      }
    }
  }
  clearEditorPreview() {
    this.editorPreviewRenderScheduler.cancel();
    this.editorPreviewDisposables.clear();
    if (this.editorPreviewIssuesContainer) {
      DOM.clearNode(this.editorPreviewIssuesContainer);
    }
    if (this.editorPreviewFrontMatterContainer) {
      DOM.clearNode(this.editorPreviewFrontMatterContainer);
    }
    if (this.editorPreviewBodyContainer) {
      DOM.clearNode(this.editorPreviewBodyContainer);
    }
  }
  disposeBuiltinEditingSessions() {
    for (const session of this.builtinEditingSessions.values()) {
      session.model.dispose();
    }
    this.builtinEditingSessions.clear();
  }
  disposeBuiltinEditingSession(uri) {
    const key = uri.toString();
    const session = this.builtinEditingSessions.get(key);
    if (!session) {
      return;
    }
    session.model.dispose();
    this.builtinEditingSessions.delete(key);
  }
  //#region Embedded MCP Server Detail
  createEmbeddedMcpDetail() {
    if (!this.mcpDetailContainer) {
      return;
    }
    const detailBody = DOM.append(this.mcpDetailContainer, $(".mcp-detail-editor-container"));
    this.embeddedMcpDetail = this.editorDisposables.add(this.instantiationService.createInstance(EmbeddedMcpServerDetail, detailBody));
    const backButton = DOM.append(this.embeddedMcpDetail.leadingSlot, $("button.editor-back-button"));
    backButton.setAttribute("type", "button");
    backButton.setAttribute("aria-label", localize("backToMcpList", "Back to MCP servers"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), backButton, localize("backToMcpListTooltip", "Back to MCP servers")));
    const backIconEl = DOM.append(backButton, $(`.codicon.codicon-${Codicon.arrowLeft.id}`));
    backIconEl.setAttribute("aria-hidden", "true");
    this.editorDisposables.add(DOM.addDisposableListener(backButton, "click", () => {
      this.goBackFromMcpDetail();
    }));
  }
  async showEmbeddedMcpDetail(server) {
    if (!this.embeddedMcpDetail) {
      return;
    }
    this.viewMode = "mcpDetail";
    this.updateContentVisibility();
    this.mcpDetailDisposables.clear();
    this.embeddedMcpDetail.setInput(server);
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  goBackFromMcpDetail() {
    this.mcpDetailDisposables.clear();
    this.embeddedMcpDetail?.clearInput();
    this.viewMode = "list";
    this.updateContentVisibility();
    if (this.dimension) {
      this.layout(this.dimension);
    }
    this.mcpListWidget?.focusSearch();
  }
  //#endregion
  //#region Embedded Plugin Detail
  createEmbeddedPluginDetail() {
    if (!this.pluginDetailContainer) {
      return;
    }
    const detailBody = DOM.append(this.pluginDetailContainer, $(".plugin-detail-editor-container"));
    this.embeddedPluginDetail = this.editorDisposables.add(this.instantiationService.createInstance(EmbeddedAgentPluginDetail, detailBody));
    const backButton = DOM.append(this.embeddedPluginDetail.leadingSlot, $("button.editor-back-button"));
    backButton.setAttribute("type", "button");
    backButton.setAttribute("aria-label", localize("backToPluginList", "Back to plugins"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), backButton, localize("backToPluginListTooltip", "Back to plugins")));
    const backIconEl = DOM.append(backButton, $(`.codicon.codicon-${Codicon.arrowLeft.id}`));
    backIconEl.setAttribute("aria-hidden", "true");
    this.editorDisposables.add(DOM.addDisposableListener(backButton, "click", () => {
      this.goBackFromPluginDetail();
    }));
  }
  async showEmbeddedPluginDetail(item) {
    if (!this.embeddedPluginDetail) {
      return;
    }
    this.viewMode = "pluginDetail";
    this.updateContentVisibility();
    this.pluginDetailDisposables.clear();
    this.embeddedPluginDetail.setInput(item);
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  /**
   * Public method to show a plugin detail from any section (e.g. from "Show Plugin" context menu).
   * Saves the current section so the back button returns the user to it.
   */
  async showPluginDetail(item) {
    if (this.selectedSection !== AICustomizationManagementSection.Plugins) {
      this.pluginDetailReturnSection = this.selectedSection ?? AICustomizationManagementSection.Agents;
    }
    await this.showEmbeddedPluginDetail(item);
  }
  goBackFromPluginDetail() {
    this.pluginDetailDisposables.clear();
    this.embeddedPluginDetail?.clearInput();
    const returnSection = this.pluginDetailReturnSection;
    this.pluginDetailReturnSection = void 0;
    if (returnSection) {
      this.viewMode = "list";
      this.updateContentVisibility();
      this.selectSection(returnSection);
    } else {
      this.viewMode = "list";
      this.updateContentVisibility();
      this.pluginListWidget?.focusSearch();
    }
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  //#endregion
  //#region Embedded Tool Extension Detail
  createEmbeddedToolDetail() {
    if (!this.toolsDetailContainer) {
      return;
    }
    const detailBody = DOM.append(this.toolsDetailContainer, $(".tools-detail-editor-container"));
    this.embeddedToolDetail = this.editorDisposables.add(this.instantiationService.createInstance(EmbeddedExtensionToolsDetail, detailBody));
    const backButton = DOM.append(this.embeddedToolDetail.leadingSlot, $("button.editor-back-button"));
    backButton.setAttribute("type", "button");
    backButton.setAttribute("aria-label", localize("backToToolsList", "Back to tools"));
    this.editorDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), backButton, localize("backToToolsListTooltip", "Back to tools")));
    const backIconEl = DOM.append(backButton, $(`.codicon.codicon-${Codicon.arrowLeft.id}`));
    backIconEl.setAttribute("aria-hidden", "true");
    this.editorDisposables.add(DOM.addDisposableListener(backButton, "click", () => {
      this.goBackFromToolDetail();
    }));
  }
  async showEmbeddedToolDetail(extension) {
    if (!this.embeddedToolDetail) {
      return;
    }
    this.viewMode = "toolsDetail";
    this.updateContentVisibility();
    this.toolsDetailDisposables.clear();
    this.embeddedToolDetail.setInput(extension);
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
  goBackFromToolDetail() {
    this.toolsDetailDisposables.clear();
    this.embeddedToolDetail?.clearInput();
    this.viewMode = "list";
    this.updateContentVisibility();
    if (this.dimension) {
      this.layout(this.dimension);
    }
    this.toolsListWidget?.focusSearch();
  }
  //#endregion
};
AICustomizationManagementEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IAICustomizationWorkspaceService),
  __decorateParam(9, IPromptsService),
  __decorateParam(10, ITextModelService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IWorkingCopyService),
  __decorateParam(13, IHoverService),
  __decorateParam(14, IContextViewService),
  __decorateParam(15, IMarkdownRendererService),
  __decorateParam(16, IModelService),
  __decorateParam(17, IQuickInputService),
  __decorateParam(18, IFileService),
  __decorateParam(19, INotificationService),
  __decorateParam(20, IDialogService),
  __decorateParam(21, ICustomizationHarnessService),
  __decorateParam(22, IViewsService),
  __decorateParam(23, ILabelService),
  __decorateParam(24, IAICustomizationItemsModel)
], AICustomizationManagementEditor);
export {
  AICustomizationManagementEditor
};
