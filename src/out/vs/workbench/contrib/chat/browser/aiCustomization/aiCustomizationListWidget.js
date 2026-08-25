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
import * as aria from "../../../../../base/browser/ui/aria/aria.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchList } from "../../../../../platform/list/browser/listService.js";
import { NotSelectableGroupId } from "../../../../../base/browser/ui/list/list.js";
import { IPromptsService, PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { agentIcon, instructionsIcon, promptIcon, skillIcon, hookIcon, userIcon, workspaceIcon, extensionIcon, pluginIcon, builtinIcon } from "./aiCustomizationIcons.js";
import { AI_CUSTOMIZATION_ITEM_STORAGE_KEY, AI_CUSTOMIZATION_ITEM_TYPE_KEY, AI_CUSTOMIZATION_ITEM_URI_KEY, AI_CUSTOMIZATION_ITEM_PLUGIN_URI_KEY, AICustomizationManagementItemMenuId, AICustomizationManagementCreateMenuId, AICustomizationManagementSection, AI_CUSTOMIZATION_ITEM_DISABLED_KEY, sectionToPromptType } from "./aiCustomizationManagement.js";
import { IAgentPluginService } from "../../common/plugins/agentPluginService.js";
import { InputBox } from "../../../../../base/browser/ui/inputbox/inputBox.js";
import { defaultButtonStyles, defaultInputBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { Delayer } from "../../../../../base/common/async.js";
import { IContextMenuService, IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { HighlightedLabel } from "../../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { matchesContiguousSubString } from "../../../../../base/common/filters.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { Button, ButtonWithDropdown } from "../../../../../base/browser/ui/button/button.js";
import { IMenuService, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { createActionViewItem, getContextMenuActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { AICustomizationSources, IAICustomizationWorkspaceService } from "../../common/aiCustomizationWorkspaceService.js";
import { Action, Separator } from "../../../../../base/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { generateCustomizationDebugReport } from "./aiCustomizationDebugPanel.js";
import { getCustomizationSecondaryText } from "./aiCustomizationListWidgetUtils.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ICustomizationHarnessService } from "../../common/customizationHarnessService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IAICustomizationItemsModel } from "./aiCustomizationItemsModel.js";
import { truncateToFirstLine } from "./aiCustomizationListWidgetUtils.js";
const $ = DOM.$;
const ITEM_HEIGHT = 44;
const GROUP_HEADER_HEIGHT = 36;
const GROUP_HEADER_HEIGHT_WITH_SEPARATOR = 40;
class AICustomizationListDelegate {
  getHeight(element) {
    if (element.type === "group-header") {
      return element.isFirst ? GROUP_HEADER_HEIGHT : GROUP_HEADER_HEIGHT_WITH_SEPARATOR;
    }
    return ITEM_HEIGHT;
  }
  getTemplateId(element) {
    return element.type === "group-header" ? "groupHeader" : "aiCustomizationItem";
  }
}
class GroupHeaderRenderer {
  constructor(hoverService) {
    this.hoverService = hoverService;
    this.templateId = "groupHeader";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    container.classList.add("ai-customization-group-header");
    const chevron = DOM.append(container, $(".group-chevron"));
    const icon = DOM.append(container, $(".group-icon"));
    const labelGroup = DOM.append(container, $(".group-label-group"));
    const label = DOM.append(labelGroup, $(".group-label"));
    const count = DOM.append(container, $(".group-count"));
    const infoIcon = DOM.append(container, $(".group-info"));
    infoIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
    return { container, chevron, icon, label, count, infoIcon, disposables, elementDisposables };
  }
  renderElement(element, _index, templateData) {
    templateData.elementDisposables.clear();
    templateData.chevron.className = "group-chevron";
    templateData.chevron.classList.add(...ThemeIcon.asClassNameArray(element.collapsed ? Codicon.chevronRight : Codicon.chevronDown));
    templateData.icon.className = "group-icon";
    templateData.icon.classList.add(...ThemeIcon.asClassNameArray(element.icon));
    templateData.label.textContent = element.label;
    templateData.count.textContent = `${element.count}`;
    templateData.elementDisposables.add(this.hoverService.setupDelayedHover(templateData.infoIcon, () => ({
      content: element.description,
      appearance: {
        compact: true,
        skipFadeInAnimation: true
      }
    })));
    templateData.container.classList.toggle("collapsed", element.collapsed);
    templateData.container.classList.toggle("has-previous-group", !element.isFirst);
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.disposables.dispose();
  }
}
function promptTypeToIcon(type) {
  switch (type) {
    case PromptsType.agent:
      return agentIcon;
    case PromptsType.skill:
      return skillIcon;
    case PromptsType.instructions:
      return instructionsIcon;
    case PromptsType.prompt:
      return promptIcon;
    case PromptsType.hook:
      return hookIcon;
    default:
      return promptIcon;
  }
}
function formatDisplayName(name) {
  return name.replace(/\.md$/i, "");
}
let AICustomizationItemRenderer = class {
  constructor(hoverService, labelService, menuService, contextKeyService, instantiationService, agentPluginService) {
    this.hoverService = hoverService;
    this.labelService = labelService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.agentPluginService = agentPluginService;
    this.templateId = "aiCustomizationItem";
    /**
     * Live (non-disposed) templates. Used to keep only the focused row's
     * inline action bar in the document tab order so that Tab from a focused
     * row enters that row's actions exactly once instead of cycling through
     * every row's actions.
     */
    this.templates = /* @__PURE__ */ new Set();
    this.focusedIndex = -1;
  }
  /**
   * Tell the renderer which row index is currently focused in the list.
   * The action bar of that row (and only that row) is made tab-focusable.
   * Pass -1 to clear focus; in that case all action bars are made non-focusable.
   */
  setFocusedIndex(index) {
    this.focusedIndex = index;
    for (const template of this.templates) {
      template.actionBar.setFocusable(index !== -1 && template.currentIndex === index);
    }
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    container.classList.add("ai-customization-list-item");
    const leftSection = DOM.append(container, $(".item-left"));
    const typeIcon = DOM.append(leftSection, $(".item-type-icon"));
    const textContainer = DOM.append(leftSection, $(".item-text"));
    const nameRow = DOM.append(textContainer, $(".item-name-row"));
    const nameLabel = disposables.add(new HighlightedLabel(DOM.append(nameRow, $(".item-name"))));
    const badge = DOM.append(nameRow, $(".inline-badge.item-badge"));
    const statusIcon = DOM.append(nameRow, $(".item-status-icon"));
    const description = disposables.add(new HighlightedLabel(DOM.append(textContainer, $(".item-description"))));
    const actionsContainer = DOM.append(container, $(".item-right"));
    const actionBar = disposables.add(new ActionBar(actionsContainer, {
      actionViewItemProvider: createActionViewItem.bind(void 0, this.instantiationService)
    }));
    actionBar.setFocusable(false);
    const template = {
      container,
      actionsContainer,
      actionBar,
      typeIcon,
      nameLabel,
      badge,
      statusIcon,
      description,
      disposables,
      elementDisposables,
      currentIndex: -1
    };
    this.templates.add(template);
    return template;
  }
  renderElement(entry, index, templateData) {
    templateData.elementDisposables.clear();
    templateData.currentIndex = index;
    templateData.actionBar.setFocusable(this.focusedIndex !== -1 && index === this.focusedIndex);
    const element = entry.item;
    templateData.typeIcon.className = "item-type-icon";
    templateData.typeIcon.classList.add(...ThemeIcon.asClassNameArray(element.typeIcon ?? promptTypeToIcon(element.promptType)));
    templateData.elementDisposables.add(this.hoverService.setupDelayedHover(templateData.container, () => {
      let content;
      if (element.isBuiltin) {
        content = `${element.name}
${localize("builtinSource", "Built-in")}`;
      } else if (element.extensionId) {
        content = `${element.name}
${localize("fromExtension", "Extension: {0}", element.extensionId)}`;
      } else {
        const isWorkspaceItem = element.source === AICustomizationSources.local;
        const uriLabel = this.labelService.getUriLabel(element.uri, { relative: isWorkspaceItem });
        content = `${element.name}
${uriLabel}`;
      }
      if (element.badgeTooltip) {
        content += `

${element.badgeTooltip}`;
      }
      const plugin = element.pluginUri && this.agentPluginService.plugins.get().find((p) => isEqual(p.uri, element.pluginUri));
      if (plugin) {
        content += `
${localize("fromPlugin", "Plugin: {0}", plugin.label)}`;
      }
      return {
        content,
        appearance: {
          compact: true,
          skipFadeInAnimation: true
        }
      };
    }));
    templateData.container.classList.toggle("disabled", element.disabled);
    const displayName = element.displayName ?? formatDisplayName(element.name);
    templateData.nameLabel.set(displayName, element.nameMatches);
    if (element.badge) {
      templateData.badge.textContent = element.badge;
      templateData.badge.style.display = "";
      if (element.badgeTooltip) {
        templateData.elementDisposables.add(this.hoverService.setupManagedHover(
          getDefaultHoverDelegate("mouse"),
          templateData.badge,
          element.badgeTooltip
        ));
      }
    } else {
      templateData.badge.textContent = "";
      templateData.badge.style.display = "none";
    }
    if (element.status) {
      templateData.statusIcon.style.display = "";
      templateData.statusIcon.className = "item-status-icon";
      switch (element.status) {
        case "loading":
          templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
          break;
        case "loaded":
          templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.check));
          break;
        case "degraded":
          templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
          break;
        case "error":
          templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.error));
          break;
      }
      if (element.statusMessage) {
        templateData.elementDisposables.add(this.hoverService.setupManagedHover(
          getDefaultHoverDelegate("mouse"),
          templateData.statusIcon,
          element.statusMessage
        ));
      }
    } else {
      templateData.statusIcon.style.display = "none";
      templateData.statusIcon.className = "item-status-icon";
    }
    const secondaryText = getCustomizationSecondaryText(element.description, element.filename, element.promptType);
    let secondaryTextMatches;
    if (secondaryText && element.description && element.descriptionMatches) {
      if (secondaryText === element.description) {
        secondaryTextMatches = element.descriptionMatches;
      } else {
        const maxLength = secondaryText.length;
        const clampedMatches = element.descriptionMatches.map((match) => {
          if (match.start >= maxLength || match.end <= 0) {
            return void 0;
          }
          const clampedStart = Math.max(0, match.start);
          const clampedEnd = Math.min(match.end, maxLength);
          return clampedEnd > clampedStart ? { start: clampedStart, end: clampedEnd } : void 0;
        }).filter((match) => !!match);
        secondaryTextMatches = clampedMatches.length ? clampedMatches : void 0;
      }
    }
    if (secondaryText) {
      templateData.description.set(secondaryText, secondaryTextMatches);
      templateData.description.element.style.display = "";
      templateData.description.element.classList.toggle("is-filename", !element.description);
    } else {
      templateData.description.set("", void 0);
      templateData.description.element.style.display = "none";
    }
    const context = {
      uri: element.uri.toString(),
      name: element.name,
      promptType: element.promptType,
      source: element.source,
      pluginUri: element.pluginUri?.toString(),
      itemId: element.id
    };
    const overlayPairs = [
      [AI_CUSTOMIZATION_ITEM_TYPE_KEY, element.promptType],
      [AI_CUSTOMIZATION_ITEM_URI_KEY, element.uri.toString()],
      [AI_CUSTOMIZATION_ITEM_DISABLED_KEY, element.disabled]
    ];
    if (element.source) {
      overlayPairs.push([AI_CUSTOMIZATION_ITEM_STORAGE_KEY, element.source]);
    }
    if (element.pluginUri) {
      overlayPairs.push([AI_CUSTOMIZATION_ITEM_PLUGIN_URI_KEY, element.pluginUri.toString()]);
    }
    const overlay = this.contextKeyService.createOverlay(overlayPairs);
    const menu = templateData.elementDisposables.add(
      this.menuService.createMenu(AICustomizationManagementItemMenuId, overlay)
    );
    const updateActions = () => {
      const actions = menu.getActions({ arg: context, shouldForwardArgs: true });
      const { primary } = getContextMenuActions(actions, "inline");
      templateData.actionBar.clear();
      templateData.actionBar.push(primary, { icon: true, label: false });
    };
    updateActions();
    templateData.elementDisposables.add(menu.onDidChange(updateActions));
    templateData.actionBar.context = context;
  }
  disposeElement(_entry, _index, templateData) {
    templateData.currentIndex = -1;
  }
  disposeTemplate(templateData) {
    this.templates.delete(templateData);
    templateData.elementDisposables.dispose();
    templateData.disposables.dispose();
  }
};
AICustomizationItemRenderer = __decorateClass([
  __decorateParam(0, IHoverService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IAgentPluginService)
], AICustomizationItemRenderer);
function toItemsModelSection(section) {
  switch (section) {
    case AICustomizationManagementSection.Agents:
    case AICustomizationManagementSection.Skills:
    case AICustomizationManagementSection.Instructions:
    case AICustomizationManagementSection.Prompts:
    case AICustomizationManagementSection.Hooks:
      return section;
    default:
      return void 0;
  }
}
function getCountAnnouncement(section, count, isFiltering) {
  switch (section) {
    case AICustomizationManagementSection.Agents:
      if (isFiltering) {
        if (count === 0) {
          return localize("countAgentsNoResults", "No agents found");
        }
        if (count === 1) {
          return localize("countAgentsOneResult", "1 agent found");
        }
        return localize("countAgentsResults", "{0} agents found", count);
      }
      if (count === 0) {
        return localize("countAgentsNone", "No agents");
      }
      if (count === 1) {
        return localize("countAgentsOne", "1 agent");
      }
      return localize("countAgents", "{0} agents", count);
    case AICustomizationManagementSection.Skills:
      if (isFiltering) {
        if (count === 0) {
          return localize("countSkillsNoResults", "No skills found");
        }
        if (count === 1) {
          return localize("countSkillsOneResult", "1 skill found");
        }
        return localize("countSkillsResults", "{0} skills found", count);
      }
      if (count === 0) {
        return localize("countSkillsNone", "No skills");
      }
      if (count === 1) {
        return localize("countSkillsOne", "1 skill");
      }
      return localize("countSkills", "{0} skills", count);
    case AICustomizationManagementSection.Instructions:
      if (isFiltering) {
        if (count === 0) {
          return localize("countInstructionsNoResults", "No instructions found");
        }
        if (count === 1) {
          return localize("countInstructionsOneResult", "1 instruction file found");
        }
        return localize("countInstructionsResults", "{0} instruction files found", count);
      }
      if (count === 0) {
        return localize("countInstructionsNone", "No instructions");
      }
      if (count === 1) {
        return localize("countInstructionsOne", "1 instruction file");
      }
      return localize("countInstructions", "{0} instruction files", count);
    case AICustomizationManagementSection.Hooks:
      if (isFiltering) {
        if (count === 0) {
          return localize("countHooksNoResults", "No hooks found");
        }
        if (count === 1) {
          return localize("countHooksOneResult", "1 hook found");
        }
        return localize("countHooksResults", "{0} hooks found", count);
      }
      if (count === 0) {
        return localize("countHooksNone", "No hooks");
      }
      if (count === 1) {
        return localize("countHooksOne", "1 hook");
      }
      return localize("countHooks", "{0} hooks", count);
    case AICustomizationManagementSection.Prompts:
    default:
      if (isFiltering) {
        if (count === 0) {
          return localize("countPromptsNoResults", "No prompts found");
        }
        if (count === 1) {
          return localize("countPromptsOneResult", "1 prompt found");
        }
        return localize("countPromptsResults", "{0} prompts found", count);
      }
      if (count === 0) {
        return localize("countPromptsNone", "No prompts");
      }
      if (count === 1) {
        return localize("countPromptsOne", "1 prompt");
      }
      return localize("countPrompts", "{0} prompts", count);
  }
}
let AICustomizationListWidget = class extends Disposable {
  constructor(instantiationService, promptsService, contextViewService, openerService, contextMenuService, menuService, contextKeyService, labelService, workspaceService, clipboardService, hoverService, fileService, telemetryService, harnessService, commandService, itemsModel, agentPluginService) {
    super();
    this.instantiationService = instantiationService;
    this.promptsService = promptsService;
    this.contextViewService = contextViewService;
    this.openerService = openerService;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.labelService = labelService;
    this.workspaceService = workspaceService;
    this.clipboardService = clipboardService;
    this.hoverService = hoverService;
    this.fileService = fileService;
    this.telemetryService = telemetryService;
    this.harnessService = harnessService;
    this.commandService = commandService;
    this.itemsModel = itemsModel;
    this.agentPluginService = agentPluginService;
    this.currentSection = AICustomizationManagementSection.Agents;
    this.allItems = [];
    this.displayEntries = [];
    this.searchQuery = "";
    this.collapsedGroups = /* @__PURE__ */ new Set();
    this._layoutDeferred = false;
    this.lastLayoutWidth = 0;
    this.lastLayoutHeight = 0;
    this.lastHeaderHeight = 0;
    this.dropdownActionDisposables = this._register(new DisposableStore());
    /** Monotonically increasing counter; guards the post-load announcement against stale calls. */
    this._sectionLoadId = 0;
    this.delayedFilter = new Delayer(200);
    /** Subscription to the items model for the current section; refreshed on setSection. */
    this.currentSectionSubscription = this._register(new MutableDisposable());
    this._onDidSelectItem = this._register(new Emitter());
    this.onDidSelectItem = this._onDidSelectItem.event;
    this._onDidChangeItemCount = this._register(new Emitter());
    this.onDidChangeItemCount = this._onDidChangeItemCount.event;
    this._onDidRequestCreate = this._register(new Emitter());
    this.onDidRequestCreate = this._onDidRequestCreate.event;
    this._onDidRequestCreateManual = this._register(new Emitter());
    this.onDidRequestCreateManual = this._onDidRequestCreateManual.event;
    this.element = $(".ai-customization-list-widget");
    this.create();
    this._register(autorun((reader) => {
      this.workspaceService.activeProjectRoot.read(reader);
      this.updateAddButton();
    }));
    this._register(autorun((reader) => {
      this.harnessService.activeHarness.read(reader);
      this.harnessService.availableHarnesses.read(reader);
      this.updateAddButton();
    }));
  }
  create() {
    this.sectionTitleHeader = DOM.append(this.element, $(".section-title-header"));
    const titleRow = DOM.append(this.sectionTitleHeader, $(".section-title-row"));
    this.sectionTitle = DOM.append(titleRow, $("h2.section-title"));
    this.sectionTitleDescription = DOM.append(this.sectionTitleHeader, $("p.section-title-description"));
    this.sectionTitleDescriptionText = DOM.append(this.sectionTitleDescription, $("span.section-title-description-text"));
    this.sectionTitleDescription.appendChild(document.createTextNode(" "));
    this.sectionLink = DOM.append(this.sectionTitleDescription, $("a.section-title-link"));
    this._register(DOM.addDisposableListener(this.sectionLink, "click", (e) => {
      e.preventDefault();
      const href = this.sectionLink.href;
      if (href) {
        this.openerService.open(URI.parse(href));
      }
    }));
    const targetWindow = DOM.getWindow(this.element);
    const headerObserver = this._register(new DOM.DisposableResizeObserver(
      "AICustomizationListWidget.sectionTitleHeader",
      () => {
        if (this.lastLayoutWidth <= 0 || this.lastLayoutHeight <= 0) {
          return;
        }
        const headerHeight = this.sectionTitleHeader.offsetHeight;
        if (headerHeight === this.lastHeaderHeight) {
          return;
        }
        this.layout(this.lastLayoutHeight, this.lastLayoutWidth);
      },
      targetWindow
    ));
    this._register(headerObserver.observe(this.sectionTitleHeader));
    this.searchAndButtonContainer = DOM.append(this.element, $(".list-search-and-button-container"));
    this.searchContainer = DOM.append(this.searchAndButtonContainer, $(".list-search-container"));
    this.searchInput = this._register(new InputBox(this.searchContainer, this.contextViewService, {
      placeholder: localize("searchPlaceholder", "Type to search..."),
      inputBoxStyles: defaultInputBoxStyles
    }));
    this._register(this.searchInput.onDidChange(() => {
      this.searchQuery = this.searchInput.value;
      this.delayedFilter.trigger(() => {
        const matchCount = this.filterItems();
        this.announceItemCount(matchCount);
        if (this.searchQuery.trim()) {
          this.telemetryService.publicLog2("chatCustomizationEditor.search", {
            section: this.currentSection,
            resultCount: matchCount
          });
        }
      });
    }));
    this.addButtonContainer = DOM.append(this.searchAndButtonContainer, $(".list-add-button-container"));
    this.addButtonSimple = this._register(new Button(this.addButtonContainer, {
      ...defaultButtonStyles,
      supportIcons: true
    }));
    this.addButtonSimple.element.classList.add("list-add-button");
    this._register(this.addButtonSimple.onDidClick(() => this.executePrimaryCreateAction()));
    this.addButton = this._register(new ButtonWithDropdown(this.addButtonContainer, {
      ...defaultButtonStyles,
      supportIcons: true,
      contextMenuProvider: this.contextMenuService,
      addPrimaryActionToDropdown: false,
      actions: { getActions: () => this.getDropdownActions() }
    }));
    this.addButton.element.classList.add("list-add-button");
    this._register(this.addButton.onDidClick(() => this.executePrimaryCreateAction()));
    this.updateAddButton();
    this.listContainer = DOM.append(this.element, $(".list-container"));
    this.emptyStateContainer = DOM.append(this.element, $(".list-empty-state"));
    const emptyStateHeader = DOM.append(this.emptyStateContainer, $(".empty-state-header"));
    this.emptyStateText = DOM.append(emptyStateHeader, $(".empty-state-text"));
    this.emptyStateSubtext = DOM.append(this.emptyStateContainer, $(".empty-state-subtext"));
    this.emptyStateContainer.style.display = "none";
    const itemRenderer = this.instantiationService.createInstance(AICustomizationItemRenderer);
    this.list = this._register(this.instantiationService.createInstance(
      WorkbenchList,
      "AICustomizationManagementList",
      this.listContainer,
      new AICustomizationListDelegate(),
      [
        new GroupHeaderRenderer(this.hoverService),
        itemRenderer
      ],
      {
        identityProvider: {
          getId: (entry) => entry.type === "group-header" ? entry.id : entry.item.id,
          getGroupId: (entry) => entry.type === "group-header" ? NotSelectableGroupId : 0
        },
        accessibilityProvider: {
          getAriaLabel: (entry) => {
            if (entry.type === "group-header") {
              return localize("groupAriaLabel", "{0}, {1} items, {2}", entry.label, entry.count, entry.collapsed ? localize("collapsed", "collapsed") : localize("expanded", "expanded"));
            }
            const displayName = entry.item.displayName ?? formatDisplayName(entry.item.name);
            const secondaryText = getCustomizationSecondaryText(entry.item.description, entry.item.filename, entry.item.promptType);
            const nameAndDesc = secondaryText ? localize("itemAriaLabel", "{0}. {1}", displayName, secondaryText) : displayName;
            return entry.item.disabled ? localize("itemAriaLabelDisabled", "{0}, disabled", nameAndDesc) : nameAndDesc;
          },
          getWidgetAriaLabel: () => localize("listAriaLabel", "Agent Customizations")
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (entry) => entry.type === "group-header" ? entry.label : entry.item.name
        },
        multipleSelectionSupport: false,
        openOnSingleClick: true
      }
    ));
    this._register(this.list.onDidOpen((e) => {
      if (e.element) {
        if (e.element.type === "group-header") {
          this.toggleGroup(e.element);
        } else {
          this._onDidSelectItem.fire(e.element.item);
        }
      }
    }));
    this._register(this.list.onDidChangeFocus((e) => {
      itemRenderer.setFocusedIndex(e.indexes.length ? e.indexes[0] : -1);
    }));
    this._register(this.list.onDidFocus(() => {
      if (this.list.getFocus().length === 0 && this.displayEntries.length > 0) {
        const firstItemIndex = this.displayEntries.findIndex((e) => e.type !== "group-header");
        if (firstItemIndex >= 0) {
          this.list.setFocus([firstItemIndex]);
        }
      }
    }));
    this._register(this.list.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.fileService.onDidFilesChange((e) => {
      if (e.gotDeleted()) {
        this.refresh();
      }
    }));
    this.updateSectionHeader();
  }
  /**
   * Handles context menu for list items.
   */
  onContextMenu(e) {
    if (!e.element || e.element.type !== "file-item") {
      return;
    }
    const item = e.element.item;
    const context = {
      uri: item.uri.toString(),
      name: item.name,
      promptType: item.promptType,
      source: item.source,
      pluginUri: item.pluginUri?.toString(),
      itemId: item.id
    };
    const overlayPairs = [
      [AI_CUSTOMIZATION_ITEM_TYPE_KEY, item.promptType],
      [AI_CUSTOMIZATION_ITEM_URI_KEY, item.uri.toString()],
      [AI_CUSTOMIZATION_ITEM_DISABLED_KEY, item.disabled]
    ];
    if (item.source) {
      overlayPairs.push([AI_CUSTOMIZATION_ITEM_STORAGE_KEY, item.source]);
    }
    if (item.pluginUri) {
      overlayPairs.push([AI_CUSTOMIZATION_ITEM_PLUGIN_URI_KEY, item.pluginUri.toString()]);
    }
    const overlay = this.contextKeyService.createOverlay(overlayPairs);
    const actions = this.menuService.getMenuActions(AICustomizationManagementItemMenuId, overlay, {
      arg: context,
      shouldForwardArgs: true
    });
    const { secondary } = getContextMenuActions(actions, "inline");
    const copyActions = item.isBuiltin ? [] : [
      new Separator(),
      new Action("copyFullPath", localize("copyFullPath", "Copy Full Path"), void 0, true, async () => {
        await this.clipboardService.writeText(item.uri.fsPath);
      }),
      new Action("copyRelativePath", localize("copyRelativePath", "Copy Relative Path"), void 0, true, async () => {
        const basePath = this.workspaceService.getActiveProjectRoot();
        if (basePath && item.uri.fsPath.startsWith(basePath.fsPath)) {
          const relative = item.uri.fsPath.substring(basePath.fsPath.length + 1);
          await this.clipboardService.writeText(relative);
        } else {
          const relativePath = this.labelService.getUriLabel(item.uri, { relative: true });
          await this.clipboardService.writeText(relativePath);
        }
      })
    ];
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => [...secondary, ...copyActions]
    });
  }
  /**
   * Sets the current section and binds the list to the model's per-section
   * observable. Returns once the initial fetch for the section has resolved
   * so that callers (e.g. tests/fixtures) can rely on rendered output
   * reflecting at least one fetch.
   */
  async setSection(section) {
    const loadId = ++this._sectionLoadId;
    this.currentSection = section;
    this.updateSectionHeader();
    const modelSection = toItemsModelSection(section);
    if (!modelSection) {
      this.currentSectionSubscription.clear();
      this.allItems = [];
      const matchCount = this.filterItems();
      this._onDidChangeItemCount.fire(0);
      this.updateAddButton();
      this.announceItemCount(matchCount);
      return;
    }
    const observable = this.itemsModel.getItems(modelSection);
    this.currentSectionSubscription.value = autorun((reader) => {
      const items = observable.read(reader);
      this.allItems = items;
      this.filterItems();
      this._onDidChangeItemCount.fire(items.length);
    });
    this.updateAddButton();
    await this.itemsModel.whenSectionLoaded(modelSection);
    if (loadId === this._sectionLoadId) {
      this.announceItemCount(this.applySearchFilter(this.allItems).length);
    }
  }
  /**
   * Updates the section header based on the current section.
   */
  updateSectionHeader() {
    let title;
    let description;
    let docsUrl;
    let learnMoreLabel;
    switch (this.currentSection) {
      case AICustomizationManagementSection.Agents:
        title = localize("agents", "Agents");
        description = localize("agentsDescription", "Configure the AI to adopt different personas tailored to specific development tasks. Each agent has its own instructions, tools, and behavior.");
        docsUrl = "https://code.visualstudio.com/docs/agent-customization/custom-agents?referrer=in-product";
        learnMoreLabel = localize("learnMoreAgents", "Learn more about custom agents");
        break;
      case AICustomizationManagementSection.Skills:
        title = localize("skills", "Skills");
        description = localize("skillsDescription", "Folders of instructions, scripts, and resources that Copilot loads when relevant to perform specialized tasks.");
        docsUrl = "https://code.visualstudio.com/docs/agent-customization/agent-skills?referrer=in-product";
        learnMoreLabel = localize("learnMoreSkills", "Learn more about agent skills");
        break;
      case AICustomizationManagementSection.Instructions:
        title = localize("instructions", "Instructions");
        description = localize("instructionsDescription", "Define common guidelines and rules that automatically influence how AI generates code and handles development tasks.");
        docsUrl = "https://code.visualstudio.com/docs/agent-customization/custom-instructions?referrer=in-product";
        learnMoreLabel = localize("learnMoreInstructions", "Learn more about custom instructions");
        break;
      case AICustomizationManagementSection.Hooks:
        title = localize("hooks", "Hooks");
        description = localize("hooksDescription", "Prompts executed at specific points during an agentic lifecycle.");
        docsUrl = "https://code.visualstudio.com/docs/agent-customization/hooks?referrer=in-product";
        learnMoreLabel = localize("learnMoreHooks", "Learn more about hooks");
        break;
      case AICustomizationManagementSection.Prompts:
      default:
        title = localize("prompts", "Prompts");
        description = localize("promptsDescription", "Reusable prompts for common development tasks like generating code, performing reviews, or scaffolding components.");
        docsUrl = "https://code.visualstudio.com/docs/agent-customization/prompt-files?referrer=in-product";
        learnMoreLabel = localize("learnMorePrompts", "Learn more about prompt files");
        break;
    }
    this.sectionTitle.textContent = title;
    this.sectionTitleDescriptionText.textContent = description;
    this.sectionLink.textContent = learnMoreLabel;
    this.sectionLink.href = docsUrl;
  }
  /**
   * Updates the add button by building a unified action list.
   * The first action becomes the primary button; the rest go in the dropdown.
   */
  updateAddButton() {
    const actions = this.buildCreateActions();
    const [primary, ...dropdown] = actions;
    const hasDropdown = dropdown.length > 0;
    this.addButton.element.style.display = hasDropdown ? "" : "none";
    this.addButtonSimple.element.style.display = hasDropdown ? "none" : "";
    if (!primary) {
      this.addButtonSimple.element.style.display = "none";
      this.addButton.element.style.display = "none";
      return;
    }
    if (hasDropdown) {
      this.addButton.label = primary.label;
      this.addButton.enabled = primary.enabled;
      this.addButton.primaryButton.setTitle(primary.tooltip ?? "");
      this.addButton.dropdownButton.setTitle("");
    } else {
      this.addButtonSimple.label = primary.label;
      this.addButtonSimple.enabled = primary.enabled;
      this.addButtonSimple.setTitle(primary.tooltip ?? "");
    }
  }
  /**
   * Builds an ordered list of create actions for the current section.
   * The first entry is the primary button; remaining entries are dropdown items.
   */
  buildCreateActions() {
    const typeLabel = this.getTypeLabel();
    const promptType = sectionToPromptType(this.currentSection);
    const descriptor = this.harnessService.getActiveDescriptor();
    const override = descriptor.sectionOverrides?.get(this.currentSection);
    const hasWorkspace = this.hasActiveWorkspace();
    if (override?.commandId) {
      return [{
        label: `$(${Codicon.add.id}) ${override.label}`,
        enabled: true,
        run: () => {
          this.commandService.executeCommand(override.commandId);
        }
      }];
    }
    const menuActions = this.menuService.getMenuActions(
      AICustomizationManagementCreateMenuId,
      this.contextKeyService,
      { shouldForwardArgs: true }
    );
    const extensionCreateActions = [];
    for (const [, group] of menuActions) {
      for (const menuItem of group) {
        if (menuItem instanceof MenuItemAction) {
          const icon = ThemeIcon.isThemeIcon(menuItem.item.icon) ? menuItem.item.icon.id : Codicon.add.id;
          extensionCreateActions.push({
            label: `$(${icon}) ${typeof menuItem.item.title === "string" ? menuItem.item.title : menuItem.item.title.value}`,
            enabled: menuItem.enabled,
            run: () => {
              menuItem.run();
            }
          });
        }
      }
    }
    if (extensionCreateActions.length > 0) {
      return extensionCreateActions;
    }
    const createTypeLabel = override?.typeLabel ?? typeLabel;
    const actions = [];
    const addedTargets = /* @__PURE__ */ new Set();
    if (override?.rootFile && hasWorkspace) {
      actions.push({
        label: `$(${Codicon.add.id}) ${override.label}`,
        enabled: true,
        run: () => {
          this._onDidRequestCreateManual.fire({ type: promptType, target: "workspace-root" });
        }
      });
      addedTargets.add("workspace-root");
    }
    if (promptType === PromptsType.hook) {
      if (!this.workspaceService.isSessionsWindow && !descriptor.hideGenerateButton) {
        actions.push({
          label: `$(${Codicon.sparkle.id}) Generate ${typeLabel}`,
          enabled: true,
          run: () => {
            this._onDidRequestCreate.fire(promptType);
          }
        });
        if (hasWorkspace) {
          actions.push({
            label: `$(${Codicon.add.id}) ${localize("configureHooks", "Configure Hooks")}`,
            enabled: true,
            run: () => {
              this._onDidRequestCreateManual.fire({ type: promptType, target: "local" });
            }
          });
        }
      } else if (!override?.commandId) {
        actions.push({
          label: `$(${Codicon.add.id}) ${localize("configureHooks", "Configure Hooks")}`,
          enabled: hasWorkspace,
          tooltip: hasWorkspace ? void 0 : localize("configureHooksDisabled", "Open a workspace folder to configure hooks."),
          run: () => {
            this._onDidRequestCreateManual.fire({ type: promptType, target: "local" });
          }
        });
      }
      return actions;
    }
    if (!override?.rootFile) {
      if (!this.workspaceService.isSessionsWindow && !descriptor.hideGenerateButton) {
        actions.push({
          label: `$(${Codicon.sparkle.id}) Generate ${typeLabel}`,
          enabled: true,
          run: () => {
            this._onDidRequestCreate.fire(promptType);
          }
        });
      } else if (hasWorkspace) {
        actions.push({
          label: `$(${Codicon.add.id}) New ${createTypeLabel} (Workspace)`,
          enabled: true,
          run: () => {
            this._onDidRequestCreateManual.fire({ type: promptType, target: "local" });
          }
        });
        addedTargets.add("workspace");
      } else {
        actions.push({
          label: `$(${Codicon.add.id}) New ${createTypeLabel} (User)`,
          enabled: true,
          run: () => {
            this._onDidRequestCreateManual.fire({ type: promptType, target: "user" });
          }
        });
        addedTargets.add("user");
      }
    }
    if (hasWorkspace && !addedTargets.has("workspace")) {
      actions.push({
        label: `$(${Codicon.folder.id}) New ${createTypeLabel} (Workspace)`,
        enabled: true,
        run: () => {
          this._onDidRequestCreateManual.fire({ type: promptType, target: "local" });
        }
      });
    }
    if (!addedTargets.has("user")) {
      actions.push({
        label: `$(${Codicon.account.id}) New ${createTypeLabel} (User)`,
        enabled: true,
        run: () => {
          this._onDidRequestCreateManual.fire({ type: promptType, target: "user" });
        }
      });
    }
    if (hasWorkspace && override?.rootFileShortcuts && !addedTargets.has("workspace-root")) {
      for (const fileName of override.rootFileShortcuts) {
        actions.push({
          label: `$(${Codicon.file.id}) New ${fileName}`,
          enabled: true,
          run: () => {
            this._onDidRequestCreateManual.fire({ type: promptType, target: "workspace-root", rootFileName: fileName });
          }
        });
      }
    }
    return actions;
  }
  /**
   * Gets the dropdown actions for the add button (consumed by ButtonWithDropdown).
   * Returns all actions except the primary (first) from buildCreateActions.
   */
  getDropdownActions() {
    this.dropdownActionDisposables.clear();
    const allActions = this.buildCreateActions();
    return allActions.slice(1).map(
      (a, i) => this.dropdownActionDisposables.add(new Action(`create_${i}`, a.label, void 0, a.enabled, () => a.run()))
    );
  }
  /**
   * Checks if there's an active project root (workspace folder or session repository).
   */
  hasActiveWorkspace() {
    return !!this.workspaceService.getActiveProjectRoot();
  }
  /**
   * Executes the primary create action based on context.
   */
  executePrimaryCreateAction() {
    const actions = this.buildCreateActions();
    if (actions.length > 0 && actions[0].enabled) {
      actions[0].run();
    }
  }
  /**
   * Gets the type label for the current section.
   */
  getTypeLabel() {
    switch (this.currentSection) {
      case AICustomizationManagementSection.Agents:
        return localize("agent", "Agent");
      case AICustomizationManagementSection.Skills:
        return localize("skill", "Skill");
      case AICustomizationManagementSection.Instructions:
        return localize("instructions", "Instructions");
      case AICustomizationManagementSection.Hooks:
        return localize("hook", "Hook");
      case AICustomizationManagementSection.Prompts:
      default:
        return localize("prompt", "Prompt");
    }
  }
  /**
   * Announces the current number of items (after search filtering) to
   * screen readers via an aria status message. Called when the section
   * is loaded and after the search filter changes so assistive technology
   * users hear the count, including "no results".
   */
  announceItemCount(count) {
    const isFiltering = this.searchQuery.trim().length > 0;
    aria.status(getCountAnnouncement(this.currentSection, count, isFiltering));
  }
  /**
   * Refreshes the current section's items.
   *
   * Item discovery is owned by `IAICustomizationItemsModel`. This method
   * pulls the current value from the model and re-renders. Callers do not
   * need to invoke this in response to data change events — the per-section
   * autorun bound in `setSection` already does that.
   */
  refresh() {
    if (this._store.isDisposed) {
      return;
    }
    this.applyItemsFromModel();
    this.updateAddButton();
  }
  applyItemsFromModel() {
    const section = toItemsModelSection(this.currentSection);
    this.allItems = section ? this.itemsModel.getItems(section).get() : [];
    this.filterItems();
    this._onDidChangeItemCount.fire(this.allItems.length);
  }
  /**
   * Computes the item count for a given section without updating the display.
   * Reads from the items model so the count is consistent with what the
   * editor and sidebar render. Returns 0 for sections not modeled here
   * (McpServers / Plugins / Models — those have their own services).
   */
  computeItemCountForSection(section) {
    const modelSection = toItemsModelSection(section);
    return modelSection ? this.itemsModel.getCount(modelSection).get() : 0;
  }
  /**
   * Filters items based on the current search query and builds grouped display entries.
   */
  /**
   * Applies the search query to items, returning matched items with highlight info.
   */
  applySearchFilter(items) {
    if (!this.searchQuery.trim()) {
      return items.map((item) => ({ ...item, nameMatches: void 0, descriptionMatches: void 0 }));
    }
    const query = this.searchQuery.toLowerCase();
    const matched = [];
    for (const item of items) {
      const displayName = item.displayName ?? formatDisplayName(item.name);
      const nameMatches = matchesContiguousSubString(query, displayName);
      const descriptionMatches = item.description ? matchesContiguousSubString(query, item.description) : null;
      const filenameMatches = matchesContiguousSubString(query, item.filename);
      const badgeMatches = item.badge ? matchesContiguousSubString(query, item.badge) : null;
      if (nameMatches || descriptionMatches || filenameMatches || badgeMatches) {
        matched.push({
          ...item,
          nameMatches: nameMatches || void 0,
          descriptionMatches: descriptionMatches || void 0
        });
      }
    }
    return matched;
  }
  /**
   * Builds grouped display entries from items assigned to groups.
   * Empty groups are omitted. Collapsed groups show only their header.
   */
  buildGroupedEntries(groups) {
    for (const group of groups) {
      group.items.sort((a, b) => a.name.localeCompare(b.name));
    }
    this.displayEntries = [];
    let isFirstGroup = true;
    for (const group of groups) {
      if (group.items.length === 0) {
        continue;
      }
      const collapsed = this.collapsedGroups.has(group.groupKey);
      this.displayEntries.push({
        type: "group-header",
        id: `group-${group.groupKey}`,
        groupKey: group.groupKey,
        label: group.label,
        icon: group.icon,
        count: group.items.length,
        isFirst: isFirstGroup,
        description: group.description,
        collapsed
      });
      isFirstGroup = false;
      if (!collapsed) {
        for (const item of group.items) {
          this.displayEntries.push({ type: "file-item", item });
        }
      }
    }
  }
  /**
   * Commits the current displayEntries to the list and updates empty state.
   */
  commitDisplayEntries() {
    this.list.splice(0, this.list.length, this.displayEntries);
    this.updateEmptyState();
  }
  /**
   * Groups normalized list items for display.
   * Groups items by normalized storage/groupKey.
   */
  groupMatchedItems(matchedItems) {
    const groups = this.currentSection === AICustomizationManagementSection.Instructions ? [
      { groupKey: "agent-instructions", label: localize("agentInstructionsGroup", "Agent Instructions"), icon: instructionsIcon, description: localize("agentInstructionsGroupDescription", "Instruction files automatically loaded for all agent interactions (e.g. AGENTS.md, CLAUDE.md, copilot-instructions.md)."), items: [] },
      { groupKey: "context-instructions", label: localize("contextInstructionsGroup", "Included Based on Context"), icon: instructionsIcon, description: localize("contextInstructionsGroupDescription", "Instructions automatically loaded when matching files are part of the context."), items: [] },
      { groupKey: "on-demand-instructions", label: localize("onDemandInstructionsGroup", "Loaded on Demand"), icon: instructionsIcon, description: localize("onDemandInstructionsGroupDescription", "Instructions loaded only when explicitly referenced."), items: [] },
      { groupKey: PromptsStorage.local, label: localize("workspaceGroup", "Workspace"), icon: workspaceIcon, description: localize("workspaceGroupDescription", "Customizations stored as files in your project folder and shared with your team via version control."), items: [] },
      { groupKey: PromptsStorage.user, label: localize("userGroup", "User"), icon: userIcon, description: localize("userGroupDescription", "Customizations stored locally on your machine in a central location. Private to you and available across all projects."), items: [] },
      { groupKey: PromptsStorage.plugin, label: localize("pluginGroup", "Plugins"), icon: pluginIcon, description: localize("pluginGroupDescription", "Read-only customizations provided by installed plugins."), items: [] },
      { groupKey: PromptsStorage.builtIn, label: localize("builtinGroup", "Built-in"), icon: builtinIcon, description: localize("builtinGroupDescription", "Built-in customizations shipped with the application."), items: [] }
    ] : [
      { groupKey: PromptsStorage.local, label: localize("workspaceGroup", "Workspace"), icon: workspaceIcon, description: localize("workspaceGroupDescription", "Customizations stored as files in your project folder and shared with your team via version control."), items: [] },
      { groupKey: PromptsStorage.user, label: localize("userGroup", "User"), icon: userIcon, description: localize("userGroupDescription", "Customizations stored locally on your machine in a central location. Private to you and available across all projects."), items: [] },
      { groupKey: PromptsStorage.plugin, label: localize("pluginGroup", "Plugins"), icon: pluginIcon, description: localize("pluginGroupDescription", "Read-only customizations provided by installed plugins."), items: [] },
      { groupKey: PromptsStorage.extension, label: localize("extensionGroup", "Extensions"), icon: extensionIcon, description: localize("extensionGroupDescription", "Read-only customizations provided by installed extensions."), items: [] },
      { groupKey: PromptsStorage.builtIn, label: localize("builtinGroup", "Built-in"), icon: builtinIcon, description: localize("builtinGroupDescription", "Built-in customizations shipped with the application."), items: [] }
    ];
    for (const item of matchedItems) {
      const key = item.groupKey ?? item.source ?? AICustomizationSources.local;
      let group = groups.find((g) => g.groupKey === key);
      if (!group) {
        let label;
        switch (key) {
          case "remote-host":
            label = localize("remoteHostGroupShort", "Remote");
            break;
          case "remote-client":
            label = localize("remoteClientGroupShort", "Local");
            break;
          default:
            label = formatDisplayName(key);
        }
        group = { groupKey: key, label, icon: Codicon.folder, description: "", items: [] };
        const builtinIdx = groups.findIndex((g) => g.groupKey === PromptsStorage.builtIn);
        if (builtinIdx >= 0) {
          groups.splice(builtinIdx, 0, group);
        } else {
          groups.push(group);
        }
      }
      group.items.push(item);
    }
    this.buildGroupedEntries(groups);
    this.commitDisplayEntries();
  }
  /**
   * Filters items based on the current search query and builds grouped display entries.
   */
  filterItems() {
    const matchedItems = this.applySearchFilter(this.allItems);
    this.groupMatchedItems(matchedItems);
    return matchedItems.length;
  }
  /**
   * Toggles the collapsed state of a group.
   */
  toggleGroup(entry) {
    if (this.collapsedGroups.has(entry.groupKey)) {
      this.collapsedGroups.delete(entry.groupKey);
    } else {
      this.collapsedGroups.add(entry.groupKey);
    }
    this.filterItems();
  }
  updateEmptyState() {
    const hasItems = this.displayEntries.length > 0;
    if (!hasItems) {
      this.emptyStateContainer.style.display = "flex";
      this.listContainer.style.display = "none";
      if (this.searchQuery.trim()) {
        this.emptyStateText.textContent = localize("noMatchingItems", "No items match '{0}'", this.searchQuery);
        this.emptyStateSubtext.textContent = localize("tryDifferentSearch", "Try a different search term");
      } else {
        const emptyInfo = this.getEmptyStateInfo();
        this.emptyStateText.textContent = emptyInfo.title;
        this.emptyStateSubtext.textContent = emptyInfo.description;
      }
    } else {
      this.emptyStateContainer.style.display = "none";
      this.listContainer.style.display = "";
    }
  }
  getEmptyStateInfo() {
    switch (this.currentSection) {
      case AICustomizationManagementSection.Agents:
        return {
          title: localize("noAgents", "No agents yet"),
          description: localize("createFirstAgent", "Create your first custom agent to get started")
        };
      case AICustomizationManagementSection.Skills:
        return {
          title: localize("noSkills", "No skills yet"),
          description: localize("createFirstSkill", "Create your first skill to extend agent capabilities")
        };
      case AICustomizationManagementSection.Instructions:
        return {
          title: localize("noInstructions", "No instructions yet"),
          description: localize("createFirstInstructions", "Add instructions to teach Copilot about your codebase")
        };
      case AICustomizationManagementSection.Hooks:
        return {
          title: localize("noHooks", "No hooks yet"),
          description: localize("createFirstHook", "Create hooks to execute commands at agent lifecycle events")
        };
      case AICustomizationManagementSection.Prompts:
      default:
        return {
          title: localize("noPrompts", "No prompts yet"),
          description: localize("createFirstPrompt", "Create reusable prompts for common tasks")
        };
    }
  }
  /**
   * Sets the search query programmatically.
   */
  setSearchQuery(query) {
    this.searchInput.value = query;
  }
  /**
   * Clears the search query.
   */
  clearSearch() {
    this.searchInput.value = "";
  }
  /**
   * Focuses the search input.
   */
  focusSearch() {
    this.searchInput.focus();
  }
  /**
   * Focuses the list.
   */
  focusList() {
    this.list.domFocus();
    if (this.displayEntries.length > 0) {
      this.list.setFocus([0]);
    }
  }
  /**
   * Scrolls the list so the last item is visible.
   */
  revealLastItem() {
    if (this.displayEntries.length > 0) {
      this.list.reveal(this.displayEntries.length - 1);
    }
  }
  /**
   * Reveals and selects the first list item whose URI matches one of the provided URIs.
   */
  revealAndSelectFirstItemByUri(uris) {
    const entryIndex = this.displayEntries.findIndex((entry) => {
      return entry.type === "file-item" && uris.some((uri) => isEqual(entry.item.uri, uri));
    });
    if (entryIndex < 0) {
      return false;
    }
    this.list.reveal(entryIndex);
    this.list.setFocus([entryIndex]);
    this.list.setSelection([entryIndex]);
    this.list.domFocus();
    return true;
  }
  /**
   * Layouts the widget.
   */
  layout(height, width) {
    this.lastLayoutHeight = height;
    this.lastLayoutWidth = width;
    this.element.style.height = "";
    this.searchInput.layout();
    const searchBarHeight = this.searchAndButtonContainer.offsetHeight;
    if (searchBarHeight === 0 && !this._layoutDeferred) {
      this._layoutDeferred = true;
      DOM.getWindow(this.element).requestAnimationFrame(() => {
        try {
          this.layout(height, width);
        } finally {
          this._layoutDeferred = false;
        }
      });
      return;
    }
    const headerHeight = this.sectionTitleHeader.offsetHeight;
    this.lastHeaderHeight = headerHeight;
    const availableHeight = this.element.clientHeight || height;
    const listHeight = Math.max(0, availableHeight - searchBarHeight - headerHeight);
    this.listContainer.style.height = `${listHeight}px`;
    this.list.layout(listHeight, width);
  }
  /**
   * Gets the total item count (before filtering).
   */
  get itemCount() {
    return this.allItems.length;
  }
  /**
   * Generates a debug report for the current section.
   */
  async generateDebugReport() {
    if (this._store.isDisposed) {
      return "";
    }
    return generateCustomizationDebugReport(
      this.currentSection,
      this.promptsService,
      this.workspaceService,
      { allItems: this.allItems, displayEntries: this.displayEntries },
      this.itemsModel.getActiveItemSource(),
      this.harnessService,
      this.agentPluginService
    );
  }
};
AICustomizationListWidget = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IPromptsService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IAICustomizationWorkspaceService),
  __decorateParam(9, IClipboardService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IFileService),
  __decorateParam(12, ITelemetryService),
  __decorateParam(13, ICustomizationHarnessService),
  __decorateParam(14, ICommandService),
  __decorateParam(15, IAICustomizationItemsModel),
  __decorateParam(16, IAgentPluginService)
], AICustomizationListWidget);
export {
  AICustomizationListWidget,
  formatDisplayName,
  getCountAnnouncement,
  truncateToFirstLine
};
