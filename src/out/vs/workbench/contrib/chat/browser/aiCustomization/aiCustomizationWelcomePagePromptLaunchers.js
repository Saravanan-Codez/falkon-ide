import "./media/aiCustomizationWelcomePromptLaunchers.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { AICustomizationManagementSection } from "./aiCustomizationManagement.js";
import { agentIcon, instructionsIcon, pluginIcon, skillIcon, hookIcon, toolsIcon } from "./aiCustomizationIcons.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID, CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID } from "../actions/configureVoiceInstructionsAction.js";
const $ = DOM.$;
class PromptLaunchersAICustomizationWelcomePage extends Disposable {
  constructor(parent, welcomePageFeatures, callbacks, commandService, workspaceService, hoverService, harnessLabel) {
    super();
    this.welcomePageFeatures = welcomePageFeatures;
    this.callbacks = callbacks;
    this.commandService = commandService;
    this.workspaceService = workspaceService;
    this.hoverService = hoverService;
    this.harnessLabel = harnessLabel;
    this.cardDisposables = this._register(new DisposableStore());
    this.visibleSectionIds = /* @__PURE__ */ new Set();
    this.categoryDescriptions = [
      {
        id: AICustomizationManagementSection.Agents,
        label: localize("agents", "Agents"),
        icon: agentIcon,
        description: localize("agentsDesc", "Define custom agents with specialized personas, tool access, and instructions for specific tasks."),
        promptType: PromptsType.agent
      },
      {
        id: AICustomizationManagementSection.Skills,
        label: localize("skills", "Skills"),
        icon: skillIcon,
        description: localize("skillsDesc", "Create reusable skill files that provide domain-specific knowledge and workflows."),
        promptType: PromptsType.skill
      },
      {
        id: AICustomizationManagementSection.Instructions,
        label: localize("instructions", "Instructions"),
        icon: instructionsIcon,
        description: localize("instructionsDesc", "Set always-on instructions that guide AI behavior across your workspace or user profile."),
        promptType: PromptsType.instructions
      },
      {
        id: AICustomizationManagementSection.Hooks,
        label: localize("hooks", "Hooks"),
        icon: hookIcon,
        description: localize("hooksDesc", "Configure automated actions triggered by events like saving files or running tasks."),
        promptType: PromptsType.hook
      },
      {
        id: AICustomizationManagementSection.McpServers,
        label: localize("mcpServers", "MCP Servers"),
        icon: Codicon.server,
        description: localize("mcpServersDesc", "Connect external tool servers that extend AI capabilities with custom tools and data sources.")
      },
      {
        id: AICustomizationManagementSection.Plugins,
        label: localize("plugins", "Plugins"),
        icon: pluginIcon,
        description: localize("pluginsDesc", "Install and manage agent plugins that add additional tools, skills, and integrations.")
      },
      {
        id: AICustomizationManagementSection.Tools,
        label: localize("tools", "Tools"),
        icon: toolsIcon,
        description: localize("toolsDesc", "Enable or disable the tools available to chat.")
      }
    ];
    this.standaloneCustomizations = [
      {
        label: localize("voiceModeInstructions", "Voice Mode Instructions"),
        icon: Codicon.voiceMode,
        description: localize("voiceModeInstructionsDesc", "Customize Voice Mode behavior and terminology with voice.md."),
        commandId: CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID
      },
      {
        label: localize("dictationInstructions", "Dictation Instructions"),
        icon: Codicon.mic,
        description: localize("dictationInstructionsDesc", "Customize Dictation terminology and transcript formatting with dictation.md."),
        commandId: CONFIGURE_DICTATION_INSTRUCTIONS_ACTION_ID
      }
    ];
    this.container = $(".welcome-prompts-content-container");
    this.scrollable = this._register(new DomScrollableElement(this.container, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto,
      useShadows: false
    }));
    const scrollableNode = this.scrollable.getDomNode();
    scrollableNode.classList.add("welcome-prompts-scrollable");
    parent.appendChild(scrollableNode);
    const resizeObserver = this._register(new DOM.DisposableResizeObserver("AICustomizationWelcomePagePromptLaunchers.scrollable", () => this.scrollable.scanDomNode()));
    this._register(resizeObserver.observe(scrollableNode));
    const welcomeInner = DOM.append(this.container, $(".welcome-prompts-inner"));
    this.heading = DOM.append(welcomeInner, $("h2.welcome-prompts-heading"));
    this.updateHeading();
    const subtitle = DOM.append(welcomeInner, $("p.welcome-prompts-subtitle"));
    subtitle.textContent = localize("welcomeSubtitle", "Tailor how agents work in your projects. Configure workspace customizations for the entire team, or create personal ones that follow you across projects.");
    if (this.welcomePageFeatures?.showGettingStartedBanner !== false) {
      const gettingStarted = DOM.append(welcomeInner, $(".welcome-prompts-primary"));
      const header = DOM.append(gettingStarted, $(".welcome-prompts-section-label"));
      const icon = DOM.append(header, $("span.welcome-prompts-section-label-icon.codicon.codicon-sparkle"));
      icon.setAttribute("aria-hidden", "true");
      const title = DOM.append(header, $("span"));
      title.textContent = localize("gettingStartedTitle", "Customize Your Agent");
      const description = DOM.append(gettingStarted, $("p.welcome-prompts-input-helper"));
      description.textContent = localize("gettingStartedDesc", "Describe your preferences and conventions to draft agents, skills, and instructions.");
      const inputRow = DOM.append(gettingStarted, $(".welcome-prompts-input-row"));
      this.inputRow = inputRow;
      this.inputElement = DOM.append(inputRow, $("input.welcome-prompts-input"));
      this.inputElement.type = "text";
      this.inputElement.placeholder = localize("workflowInputPlaceholder", "Prefer concise commits, thorough reviews, and tested code...");
      this.inputElement.setAttribute("aria-label", localize("workflowInputAriaLabel", "Describe your preferences to customize your agent"));
      const submitBtn = DOM.append(inputRow, $("button.welcome-prompts-input-submit"));
      this.submitBtn = submitBtn;
      submitBtn.setAttribute("aria-label", localize("workflowSubmitAriaLabel", "Customize agent"));
      this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), submitBtn, localize("workflowSubmitTooltip", "Open in Chat")));
      const chevron = DOM.append(submitBtn, $("span.codicon.codicon-arrow-up"));
      chevron.setAttribute("aria-hidden", "true");
      const updateSubmitState = () => {
        const hasValue = !!this.inputElement?.value?.trim();
        submitBtn.disabled = !hasValue;
        submitBtn.classList.toggle("welcome-prompts-input-submit-disabled", !hasValue);
      };
      const submit = () => {
        const value = this.inputElement?.value?.trim();
        if (!value) {
          return;
        }
        let query;
        if (this.workspaceService.isSessionsWindow) {
          query = `Generate agent customizations. ${value}`;
        } else {
          query = `/init ${value}`;
        }
        if (this.inputElement) {
          this.inputElement.value = "";
        }
        updateSubmitState();
        inputRow.classList.add("sent");
        submitBtn.style.display = "none";
        if (this.sentLabel) {
          this.sentLabel.remove();
        }
        this.sentLabel = DOM.append(inputRow, $("span.welcome-prompts-sent-label"));
        this.sentLabel.textContent = localize("sentToChat", "Sent to chat \u2713");
        this.callbacks.prefillChat(query, { isPartialQuery: false, newChat: true });
      };
      this._register(DOM.addDisposableListener(submitBtn, "click", (e) => {
        e.stopPropagation();
        submit();
      }));
      this._register(DOM.addDisposableListener(this.inputElement, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }));
      this._register(DOM.addDisposableListener(this.inputElement, "input", () => {
        updateSubmitState();
        this._clearSentState();
      }));
      updateSubmitState();
    }
    this.cardsContainer = DOM.append(welcomeInner, $(".welcome-prompts-cards"));
  }
  _clearSentState() {
    if (this.sentLabel) {
      this.sentLabel.remove();
      this.sentLabel = void 0;
    }
    if (this.submitBtn) {
      this.submitBtn.style.display = "";
    }
    if (this.inputRow) {
      this.inputRow.classList.remove("sent");
    }
  }
  reset() {
    this._clearSentState();
  }
  rebuildCards(visibleSectionIds) {
    if (!this.cardsContainer) {
      return;
    }
    this.visibleSectionIds = new Set(visibleSectionIds);
    this.cardDisposables.clear();
    DOM.clearNode(this.cardsContainer);
    this.firstCard = void 0;
    for (const category of this.categoryDescriptions) {
      if (!visibleSectionIds.has(category.id)) {
        continue;
      }
      const card = DOM.append(this.cardsContainer, $(".welcome-prompts-card"));
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      if (!this.firstCard) {
        this.firstCard = card;
      }
      const cardHeader = DOM.append(card, $(".welcome-prompts-card-header"));
      const iconEl = DOM.append(cardHeader, $(".welcome-prompts-card-icon"));
      iconEl.classList.add(...ThemeIcon.asClassNameArray(category.icon));
      const labelEl = DOM.append(cardHeader, $("span.welcome-prompts-card-label"));
      labelEl.textContent = category.label;
      const descEl = DOM.append(card, $("p.welcome-prompts-card-description"));
      descEl.textContent = category.description;
      const footer = DOM.append(card, $(".welcome-prompts-card-footer"));
      if (category.promptType) {
        const generateBtn = DOM.append(footer, $("button.welcome-prompts-card-action"));
        generateBtn.textContent = localize("new", "New...");
        generateBtn.setAttribute("aria-label", localize("newCategoryAriaLabel", "New {0}...", category.label));
        this.cardDisposables.add(DOM.addDisposableListener(generateBtn, "click", (e) => {
          e.stopPropagation();
          this.callbacks.closeEditor();
          if (this.workspaceService.isSessionsWindow) {
            const typeLabel = category.label.toLowerCase().replace(/s$/, "");
            this.callbacks.prefillChat(`Create me a custom ${typeLabel} that `, { isPartialQuery: true, newChat: true });
          } else {
            this.workspaceService.generateCustomization(category.promptType);
          }
        }));
      } else {
        const browseBtn = DOM.append(footer, $("button.welcome-prompts-card-action"));
        browseBtn.textContent = localize("browse", "Browse...");
        browseBtn.setAttribute("aria-label", localize("browseCategoryAriaLabel", "Browse {0}...", category.label));
        this.cardDisposables.add(DOM.addDisposableListener(browseBtn, "click", (e) => {
          e.stopPropagation();
          this.callbacks.selectSectionWithMarketplace(category.id);
        }));
      }
      this.cardDisposables.add(DOM.addDisposableListener(card, "click", () => {
        this.callbacks.selectSection(category.id);
      }));
      this.cardDisposables.add(DOM.addDisposableListener(card, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.callbacks.selectSection(category.id);
        }
      }));
    }
    if (!this.workspaceService.isSessionsWindow) {
      for (const customization of this.standaloneCustomizations) {
        this.renderStandaloneCustomization(customization);
      }
    }
    if (this.promptMigrationInfo) {
      this.renderPromptMigrationCard();
    }
    this.scrollable.scanDomNode();
  }
  renderStandaloneCustomization(customization) {
    if (!this.cardsContainer) {
      return;
    }
    const card = DOM.append(this.cardsContainer, $(".welcome-prompts-card"));
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    if (!this.firstCard) {
      this.firstCard = card;
    }
    const cardHeader = DOM.append(card, $(".welcome-prompts-card-header"));
    const iconEl = DOM.append(cardHeader, $(".welcome-prompts-card-icon"));
    iconEl.classList.add(...ThemeIcon.asClassNameArray(customization.icon));
    const labelEl = DOM.append(cardHeader, $("span.welcome-prompts-card-label"));
    labelEl.textContent = customization.label;
    const descEl = DOM.append(card, $("p.welcome-prompts-card-description"));
    descEl.textContent = customization.description;
    const footer = DOM.append(card, $(".welcome-prompts-card-footer"));
    const configureButton = DOM.append(footer, $("button.welcome-prompts-card-action"));
    configureButton.textContent = localize("configure", "Configure...");
    configureButton.setAttribute("aria-label", localize("configureCategoryAriaLabel", "Configure {0}...", customization.label));
    const configure = () => {
      void this.commandService.executeCommand(customization.commandId);
    };
    this.cardDisposables.add(DOM.addDisposableListener(configureButton, "click", (e) => {
      e.stopPropagation();
      configure();
    }));
    this.cardDisposables.add(DOM.addDisposableListener(card, "click", configure));
    this.cardDisposables.add(DOM.addDisposableListener(card, "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        configure();
      }
    }));
  }
  setPromptMigrationInfo(info) {
    const didChange = this.promptMigrationInfo?.totalPromptCount !== info?.totalPromptCount || this.promptMigrationInfo?.workspacePromptCount !== info?.workspacePromptCount || this.promptMigrationInfo?.userPromptCount !== info?.userPromptCount;
    this.promptMigrationInfo = info;
    if (didChange) {
      this.rebuildCards(this.visibleSectionIds);
    }
  }
  setHarnessLabel(label) {
    if (this.harnessLabel === label) {
      return;
    }
    this.harnessLabel = label;
    this.updateHeading();
  }
  updateHeading() {
    if (this.heading) {
      this.heading.textContent = localize("welcomeHeadingWithHarness", "Agent Customizations for {0}", this.harnessLabel);
    }
  }
  renderPromptMigrationCard() {
    if (!this.cardsContainer || !this.promptMigrationInfo) {
      return;
    }
    const migrationCard = DOM.append(this.cardsContainer, $(".welcome-prompts-card.welcome-prompts-migration-card"));
    migrationCard.setAttribute("tabindex", "0");
    migrationCard.setAttribute("role", "button");
    if (!this.firstCard) {
      this.firstCard = migrationCard;
    }
    const cardHeader = DOM.append(migrationCard, $(".welcome-prompts-card-header"));
    const iconEl = DOM.append(cardHeader, $(".welcome-prompts-card-icon"));
    iconEl.classList.add(...ThemeIcon.asClassNameArray(Codicon.sync));
    const labelEl = DOM.append(cardHeader, $("span.welcome-prompts-card-label"));
    labelEl.textContent = localize("migratePromptFiles", "Migrate");
    const descEl = DOM.append(migrationCard, $("p.welcome-prompts-card-description"));
    descEl.textContent = this.getPromptMigrationDescription();
    const footer = DOM.append(migrationCard, $(".welcome-prompts-card-footer"));
    const migrateBtn = DOM.append(footer, $("button.welcome-prompts-card-action"));
    migrateBtn.textContent = localize("convertToSkills", "Convert to Skills...");
    migrateBtn.setAttribute("aria-label", localize("convertPromptFilesAriaLabel", "Convert prompt files to skills"));
    this.cardDisposables.add(DOM.addDisposableListener(migrateBtn, "click", (e) => {
      e.stopPropagation();
      this.callbacks.migratePromptFiles();
    }));
    this.cardDisposables.add(DOM.addDisposableListener(migrationCard, "click", () => {
      this.callbacks.migratePromptFiles();
    }));
    this.cardDisposables.add(DOM.addDisposableListener(migrationCard, "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.callbacks.migratePromptFiles();
      }
    }));
  }
  getPromptMigrationDescription() {
    if (!this.promptMigrationInfo) {
      return "";
    }
    const { workspacePromptCount, userPromptCount, totalPromptCount } = this.promptMigrationInfo;
    if (workspacePromptCount > 0 && userPromptCount > 0) {
      return localize(
        "promptMigrationCardDescriptionWorkspaceAndUser",
        "Prompt files are deprecated for this harness. Found {0} prompt files ({1} workspace, {2} global) that local VS Code can still run, but {3} ignores. Convert them to skills to keep them available.",
        totalPromptCount,
        workspacePromptCount,
        userPromptCount,
        this.harnessLabel
      );
    }
    if (workspacePromptCount > 0) {
      return localize(
        "promptMigrationCardDescriptionWorkspace",
        "Prompt files are deprecated for this harness. Found {0} workspace prompt files that local VS Code can still run, but {1} ignores. Convert them to skills to keep them available.",
        workspacePromptCount,
        this.harnessLabel
      );
    }
    return localize(
      "promptMigrationCardDescriptionUser",
      "Prompt files are deprecated for this harness. Found {0} global prompt files that local VS Code can still run, but {1} ignores. Convert them to skills to keep them available.",
      userPromptCount,
      this.harnessLabel
    );
  }
  focus() {
    if (this.inputElement) {
      this.inputElement.focus();
      return;
    }
    this.firstCard?.focus();
  }
}
export {
  PromptLaunchersAICustomizationWelcomePage
};
