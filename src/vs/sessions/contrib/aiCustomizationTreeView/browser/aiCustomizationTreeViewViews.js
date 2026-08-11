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
import "./media/aiCustomizationTreeView.css";
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { createActionViewItem, getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewPane } from "../../../../workbench/browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../../workbench/common/views.js";
import { IPromptsService, PromptsStorage } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { PromptsType } from "../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js";
import { agentIcon, extensionIcon, instructionsIcon, mcpServerIcon, pluginIcon, promptIcon, skillIcon, userIcon, workspaceIcon, builtinIcon } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationIcons.js";
import { AICustomizationItemMenuId } from "./aiCustomizationTreeView.js";
import { AICustomizationManagementSection } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.js";
import { AICustomizationManagementEditorInput } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditorInput.js";
import { AICustomizationManagementEditor } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { AICustomizationSources, IAICustomizationWorkspaceService } from "../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
const AICustomizationIsEmptyContextKey = new RawContextKey("aiCustomization.isEmpty", true);
const AICustomizationItemTypeContextKey = new RawContextKey("aiCustomizationItemType", "");
const AICustomizationItemDisabledContextKey = new RawContextKey("aiCustomizationItemDisabled", false);
const AICustomizationItemStorageContextKey = new RawContextKey("aiCustomizationItemStorage", "");
const ROOT_ELEMENT = /* @__PURE__ */ Symbol("root");
class AICustomizationTreeDelegate {
  getHeight(_element) {
    return 22;
  }
  getTemplateId(element) {
    switch (element.type) {
      case "category":
      case "link":
        return "category";
      case "group":
        return "group";
      case "file":
        return "file";
    }
  }
}
class AICustomizationCategoryRenderer {
  constructor() {
    this.templateId = "category";
  }
  renderTemplate(container) {
    const element = dom.append(container, dom.$(".ai-customization-category"));
    const icon = dom.append(element, dom.$(".icon"));
    const label = dom.append(element, dom.$(".label"));
    return { container: element, icon, label };
  }
  renderElement(node, _index, templateData) {
    templateData.icon.className = "icon";
    templateData.icon.classList.add(...ThemeIcon.asClassNameArray(node.element.icon));
    templateData.label.textContent = node.element.label;
  }
  disposeTemplate(_templateData) {
  }
}
class AICustomizationGroupRenderer {
  constructor() {
    this.templateId = "group";
  }
  renderTemplate(container) {
    const element = dom.append(container, dom.$(".ai-customization-group-header"));
    const label = dom.append(element, dom.$(".label"));
    return { container: element, label };
  }
  renderElement(node, _index, templateData) {
    templateData.label.textContent = node.element.label;
  }
  disposeTemplate(_templateData) {
  }
}
class AICustomizationFileRenderer {
  constructor(menuService, contextKeyService, instantiationService) {
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.templateId = "file";
  }
  renderTemplate(container) {
    const element = dom.append(container, dom.$(".ai-customization-tree-item"));
    const icon = dom.append(element, dom.$(".icon"));
    const name = dom.append(element, dom.$(".name"));
    const actionsContainer = dom.append(element, dom.$(".actions"));
    const templateDisposables = new DisposableStore();
    const actionBar = templateDisposables.add(new ActionBar(actionsContainer, {
      actionViewItemProvider: createActionViewItem.bind(void 0, this.instantiationService)
    }));
    return { container: element, icon, name, actionBar, elementDisposables: new DisposableStore(), templateDisposables };
  }
  renderElement(node, _index, templateData) {
    const item = node.element;
    templateData.elementDisposables.clear();
    let icon;
    switch (item.promptType) {
      case PromptsType.agent:
        icon = agentIcon;
        break;
      case PromptsType.skill:
        icon = skillIcon;
        break;
      case PromptsType.instructions:
        icon = instructionsIcon;
        break;
      case PromptsType.prompt:
      default:
        icon = promptIcon;
        break;
    }
    templateData.icon.className = "icon";
    templateData.icon.classList.add(...ThemeIcon.asClassNameArray(icon));
    templateData.name.textContent = item.name;
    templateData.container.classList.toggle("disabled", item.disabled);
    const tooltip = item.description ? `${item.name} - ${item.description}` : item.name;
    templateData.container.title = tooltip;
    const context = {
      uri: item.uri.toString(),
      name: item.name,
      promptType: item.promptType,
      storage: item.storage
    };
    const overlay = this.contextKeyService.createOverlay([
      [AICustomizationItemTypeContextKey.key, item.promptType],
      [AICustomizationItemDisabledContextKey.key, item.disabled],
      [AICustomizationItemStorageContextKey.key, item.storage]
    ]);
    const menu = templateData.elementDisposables.add(
      this.menuService.createMenu(AICustomizationItemMenuId, overlay)
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
  disposeElement(_node, _index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
    templateData.elementDisposables.dispose();
  }
}
class UnifiedAICustomizationDataSource {
  constructor(promptsService, logService, onItemCountChanged) {
    this.promptsService = promptsService;
    this.logService = logService;
    this.onItemCountChanged = onItemCountChanged;
    this.cache = /* @__PURE__ */ new Map();
    this.totalItemCount = 0;
  }
  /**
   * Clears the cache. Should be called when the view refreshes.
   */
  clearCache() {
    this.cache.clear();
    this.totalItemCount = 0;
  }
  hasChildren(element) {
    if (element === ROOT_ELEMENT) {
      return true;
    }
    if (element.type === "link") {
      return false;
    }
    return element.type === "category" || element.type === "group";
  }
  async getChildren(element) {
    try {
      if (element === ROOT_ELEMENT) {
        return this.getTypeCategories();
      }
      if (element.type === "category") {
        return this.getStorageGroups(element.promptType);
      }
      if (element.type === "group") {
        return this.getFilesForStorageAndType(element.storage, element.promptType);
      }
      return [];
    } catch (error) {
      this.logService.error("[AICustomization] Error fetching tree children:", error);
      return [];
    }
  }
  getTypeCategories() {
    const items = [
      {
        type: "category",
        id: "category-agents",
        label: localize("customAgents", "Custom Agents"),
        promptType: PromptsType.agent,
        icon: agentIcon
      },
      {
        type: "category",
        id: "category-skills",
        label: localize("skills", "Skills"),
        promptType: PromptsType.skill,
        icon: skillIcon
      },
      {
        type: "category",
        id: "category-instructions",
        label: localize("instructions", "Instructions"),
        promptType: PromptsType.instructions,
        icon: instructionsIcon
      }
    ];
    items.push(
      {
        type: "link",
        id: "link-mcp-servers",
        label: localize("mcpServers", "MCP Servers"),
        icon: mcpServerIcon,
        section: AICustomizationManagementSection.McpServers
      }
    );
    return items;
  }
  /**
   * Fetches and caches data for a prompt type, returning storage groups with items.
   */
  async getStorageGroups(promptType) {
    const groups = [];
    let cached = this.cache.get(promptType);
    if (!cached) {
      cached = {};
      this.cache.set(promptType, cached);
    }
    if (promptType === PromptsType.skill) {
      if (!cached.skills) {
        const skills = await this.promptsService.findAgentSkills(CancellationToken.None);
        cached.skills = skills || [];
        this.totalItemCount += cached.skills.length;
        this.onItemCountChanged(this.totalItemCount);
      }
      const workspaceSkills = cached.skills.filter((s) => s.storage === PromptsStorage.local);
      const userSkills = cached.skills.filter((s) => s.storage === PromptsStorage.user);
      const extensionSkills = cached.skills.filter((s) => s.storage === PromptsStorage.extension);
      const builtinSkills = cached.skills.filter((s) => s.storage === PromptsStorage.builtIn);
      if (workspaceSkills.length > 0) {
        groups.push(this.createGroupItem(promptType, AICustomizationSources.local, workspaceSkills.length));
      }
      if (userSkills.length > 0) {
        groups.push(this.createGroupItem(promptType, AICustomizationSources.user, userSkills.length));
      }
      if (extensionSkills.length > 0) {
        groups.push(this.createGroupItem(promptType, AICustomizationSources.extension, extensionSkills.length));
      }
      if (builtinSkills.length > 0) {
        groups.push(this.createGroupItem(promptType, AICustomizationSources.builtin, builtinSkills.length));
      }
      return groups;
    }
    if (!cached.files) {
      const allItems = [...await this.promptsService.listPromptFiles(promptType, CancellationToken.None)];
      if (promptType === PromptsType.instructions) {
        const existingUris = new ResourceSet(allItems.map((item) => item.uri));
        const agentInstructions = await this.promptsService.listAgentInstructions(CancellationToken.None);
        for (const file of agentInstructions) {
          if (!existingUris.has(file.uri)) {
            allItems.push({ uri: file.uri, storage: PromptsStorage.local, type: PromptsType.instructions });
          }
        }
      }
      const workspaceItems2 = allItems.filter((item) => item.storage === PromptsStorage.local);
      const userItems2 = allItems.filter((item) => item.storage === PromptsStorage.user);
      const extensionItems2 = allItems.filter((item) => item.storage === PromptsStorage.extension);
      const builtinItems2 = allItems.filter((item) => item.storage === PromptsStorage.builtIn);
      cached.files = /* @__PURE__ */ new Map([
        [PromptsStorage.local, workspaceItems2],
        [PromptsStorage.user, userItems2],
        [PromptsStorage.extension, extensionItems2],
        [PromptsStorage.builtIn, builtinItems2]
      ]);
      const itemCount = allItems.length;
      this.totalItemCount += itemCount;
      this.onItemCountChanged(this.totalItemCount);
    }
    const workspaceItems = cached.files.get(PromptsStorage.local) || [];
    const userItems = cached.files.get(PromptsStorage.user) || [];
    const extensionItems = cached.files.get(PromptsStorage.extension) || [];
    const builtinItems = cached.files.get(PromptsStorage.builtIn) || [];
    if (workspaceItems.length > 0) {
      groups.push(this.createGroupItem(promptType, PromptsStorage.local, workspaceItems.length));
    }
    if (userItems.length > 0) {
      groups.push(this.createGroupItem(promptType, PromptsStorage.user, userItems.length));
    }
    if (extensionItems.length > 0) {
      groups.push(this.createGroupItem(promptType, PromptsStorage.extension, extensionItems.length));
    }
    if (builtinItems.length > 0) {
      groups.push(this.createGroupItem(promptType, PromptsStorage.builtIn, builtinItems.length));
    }
    return groups;
  }
  /**
   * Creates a group item with consistent structure.
   */
  createGroupItem(promptType, storage, count) {
    const storageLabels = {
      [AICustomizationSources.local]: localize("workspaceWithCount", "Workspace ({0})", count),
      [AICustomizationSources.user]: localize("userWithCount", "User ({0})", count),
      [AICustomizationSources.extension]: localize("extensionsWithCount", "Extensions ({0})", count),
      [AICustomizationSources.plugin]: localize("pluginsWithCount", "Plugins ({0})", count),
      [AICustomizationSources.builtin]: localize("builtinWithCount", "Built-in ({0})", count)
    };
    const storageIcons = {
      [AICustomizationSources.local]: workspaceIcon,
      [AICustomizationSources.user]: userIcon,
      [AICustomizationSources.extension]: extensionIcon,
      [AICustomizationSources.plugin]: pluginIcon,
      [AICustomizationSources.builtin]: builtinIcon
    };
    const storageSuffixes = {
      [AICustomizationSources.local]: "workspace",
      [AICustomizationSources.user]: "user",
      [AICustomizationSources.extension]: "extensions",
      [AICustomizationSources.plugin]: "plugins",
      [AICustomizationSources.builtin]: "builtin"
    };
    return {
      type: "group",
      id: `group-${promptType}-${storageSuffixes[storage]}`,
      label: storageLabels[storage],
      storage,
      promptType,
      icon: storageIcons[storage]
    };
  }
  /**
   * Returns files for a specific storage/type combination from cache.
   * getStorageGroups must be called first to populate the cache.
   */
  async getFilesForStorageAndType(storage, promptType) {
    const cached = this.cache.get(promptType);
    const disabledUris = this.promptsService.getDisabledPromptFiles(promptType);
    if (promptType === PromptsType.skill) {
      const skills = cached?.skills || [];
      const filtered = skills.filter((skill) => skill.storage === storage);
      const seenUris = /* @__PURE__ */ new Set();
      const result = filtered.map((skill) => {
        seenUris.add(skill.uri.toString());
        const skillName = skill.name || basename(dirname(skill.uri)) || basename(skill.uri);
        return {
          type: "file",
          id: skill.uri.toString(),
          uri: skill.uri,
          name: skillName,
          description: skill.description,
          storage: skill.storage,
          promptType,
          disabled: disabledUris.has(skill.uri)
        };
      });
      if (disabledUris.size > 0) {
        const allSkillFiles = await this.promptsService.listPromptFiles(PromptsType.skill, CancellationToken.None);
        for (const file of allSkillFiles) {
          if (file.storage === storage && !seenUris.has(file.uri.toString()) && disabledUris.has(file.uri)) {
            result.push({
              type: "file",
              id: file.uri.toString(),
              uri: file.uri,
              name: file.name || basename(dirname(file.uri)) || basename(file.uri),
              description: file.description,
              storage: file.storage,
              promptType,
              disabled: true
            });
          }
        }
      }
      return result;
    }
    const items = [...cached?.files?.get(storage) || []];
    return items.map((item) => ({
      type: "file",
      id: item.uri.toString(),
      uri: item.uri,
      name: item.name || basename(item.uri),
      description: item.description,
      storage: item.storage,
      promptType,
      disabled: disabledUris.has(item.uri)
    }));
  }
}
let AICustomizationViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, promptsService, editorService, menuService, logService, workspaceContextService, workspaceService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.promptsService = promptsService;
    this.editorService = editorService;
    this.menuService = menuService;
    this.logService = logService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceService = workspaceService;
    this.treeDisposables = this._register(new DisposableStore());
    this.isEmptyContextKey = AICustomizationIsEmptyContextKey.bindTo(contextKeyService);
    this.itemTypeContextKey = AICustomizationItemTypeContextKey.bindTo(contextKeyService);
    this.itemDisabledContextKey = AICustomizationItemDisabledContextKey.bindTo(contextKeyService);
    this.itemStorageContextKey = AICustomizationItemStorageContextKey.bindTo(contextKeyService);
    this._register(this.promptsService.onDidChangeCustomAgents(() => this.refresh()));
    this._register(this.promptsService.onDidChangeSlashCommands(() => this.refresh()));
    this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this.refresh()));
    this._register(autorun((reader) => {
      this.workspaceService.activeProjectRoot.read(reader);
      this.refresh();
    }));
  }
  static {
    this.ID = "aiCustomization.view";
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("ai-customization-view");
    this.treeContainer = dom.append(container, dom.$(".tree-container"));
    this.createTree();
  }
  createTree() {
    if (!this.treeContainer) {
      return;
    }
    this.dataSource = new UnifiedAICustomizationDataSource(
      this.promptsService,
      this.logService,
      (count) => this.isEmptyContextKey.set(count === 0)
    );
    this.tree = this.treeDisposables.add(this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "AICustomization",
      this.treeContainer,
      new AICustomizationTreeDelegate(),
      [
        new AICustomizationCategoryRenderer(),
        new AICustomizationGroupRenderer(),
        new AICustomizationFileRenderer(this.menuService, this.contextKeyService, this.instantiationService)
      ],
      this.dataSource,
      {
        identityProvider: {
          getId: (element) => element.id
        },
        accessibilityProvider: {
          getAriaLabel: (element) => {
            if (element.type === "category" || element.type === "link") {
              return element.label;
            }
            if (element.type === "group") {
              return element.label;
            }
            const nameAndDesc = element.description ? localize("fileAriaLabel", "{0}, {1}", element.name, element.description) : element.name;
            return element.disabled ? localize("fileAriaLabelDisabled", "{0}, disabled", nameAndDesc) : nameAndDesc;
          },
          getWidgetAriaLabel: () => localize("aiCustomizationTree", "Chat Customization Items")
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (element) => {
            if (element.type === "file") {
              return element.name;
            }
            return element.label;
          }
        }
      }
    ));
    this.treeDisposables.add(this.tree.onDidOpen(async (e) => {
      if (e.element && e.element.type === "file") {
        this.editorService.openEditor({
          resource: e.element.uri
        });
      } else if (e.element && e.element.type === "link") {
        const input = AICustomizationManagementEditorInput.getOrCreate();
        const editor = await this.editorService.openEditor(input, { pinned: true });
        if (editor instanceof AICustomizationManagementEditor) {
          editor.selectSectionById(e.element.section);
        }
      }
    }));
    this.treeDisposables.add(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    void this.tree.setInput(ROOT_ELEMENT).then(() => this.autoExpandCategories());
  }
  async autoExpandCategories() {
    if (!this.tree) {
      return;
    }
    const rootNode = this.tree.getNode(ROOT_ELEMENT);
    for (const child of rootNode.children) {
      if (child.element !== ROOT_ELEMENT) {
        await this.tree.expand(child.element);
      }
    }
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree?.layout(height, width);
  }
  refresh() {
    this.dataSource?.clearCache();
    this.isEmptyContextKey.set(true);
    void this.tree?.setInput(ROOT_ELEMENT).then(() => this.autoExpandCategories());
  }
  collapseAll() {
    this.tree?.collapseAll();
  }
  expandAll() {
    this.tree?.expandAll();
  }
  onContextMenu(e) {
    if (!e.element || e.element.type !== "file") {
      return;
    }
    const element = e.element;
    this.itemTypeContextKey.set(element.promptType);
    this.itemDisabledContextKey.set(element.disabled);
    this.itemStorageContextKey.set(element.storage);
    const context = {
      uri: element.uri.toString(),
      name: element.name,
      promptType: element.promptType,
      disabled: element.disabled
    };
    const menu = this.menuService.getMenuActions(AICustomizationItemMenuId, this.contextKeyService, { arg: context, shouldForwardArgs: true });
    const { secondary } = getContextMenuActions(menu, "inline");
    if (secondary.length > 0) {
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => secondary,
        getActionsContext: () => context,
        onHide: () => {
          this.itemTypeContextKey.reset();
          this.itemDisabledContextKey.reset();
          this.itemStorageContextKey.reset();
        }
      });
    }
  }
};
AICustomizationViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IPromptsService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, IMenuService),
  __decorateParam(13, ILogService),
  __decorateParam(14, IWorkspaceContextService),
  __decorateParam(15, IAICustomizationWorkspaceService)
], AICustomizationViewPane);
export {
  AICustomizationIsEmptyContextKey,
  AICustomizationItemDisabledContextKey,
  AICustomizationItemStorageContextKey,
  AICustomizationItemTypeContextKey,
  AICustomizationViewPane
};
