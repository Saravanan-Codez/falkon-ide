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
import "./media/scm.css";
import { DisposableStore, combinedDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableSignalFromEvent } from "../../../../base/common/observable.js";
import { append, $ } from "../../../../base/browser/dom.js";
import { ISCMViewService } from "../common/scm.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { connectPrimaryMenu, getRepositoryResourceCount, isSCMRepository, StatusBarAction } from "./util.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { shorten } from "../../../../base/common/labels.js";
import { dirname } from "../../../../base/common/resources.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Codicon } from "../../../../base/common/codicons.js";
class RepositoryActionRunner extends ActionRunner {
  constructor(getSelectedRepositories) {
    super();
    this.getSelectedRepositories = getSelectedRepositories;
  }
  async runAction(action, context) {
    if (!(action instanceof MenuItemAction)) {
      return super.runAction(action, context);
    }
    const actionContext = [context];
    const selection = this.getSelectedRepositories().map((r) => r.provider);
    if (selection.some((s) => s === context)) {
      actionContext.push(...selection.filter((s) => s !== context));
    }
    await action.run(...actionContext);
  }
}
let RepositoryRenderer = class {
  constructor(toolbarMenuId, actionViewItemProvider, commandService, contextKeyService, contextMenuService, keybindingService, labelService, menuService, scmViewService, telemetryService, uriIdentityService) {
    this.toolbarMenuId = toolbarMenuId;
    this.actionViewItemProvider = actionViewItemProvider;
    this.commandService = commandService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.labelService = labelService;
    this.menuService = menuService;
    this.scmViewService = scmViewService;
    this.telemetryService = telemetryService;
    this.uriIdentityService = uriIdentityService;
    this.onDidChangeVisibleRepositoriesSignal = observableSignalFromEvent(this, this.scmViewService.onDidChangeVisibleRepositories);
  }
  static {
    this.TEMPLATE_ID = "repository";
  }
  get templateId() {
    return RepositoryRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const provider = append(container, $(".scm-provider"));
    const icon = append(provider, $(".icon"));
    const label = new IconLabel(provider, { supportIcons: false });
    const actions = append(provider, $(".actions"));
    const toolBar = new WorkbenchToolBar(actions, { actionViewItemProvider: this.actionViewItemProvider, resetMenu: this.toolbarMenuId, responsiveBehavior: { enabled: true, kind: "all", minItems: 2 } }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService);
    const countContainer = append(provider, $(".count"));
    const count = new CountBadge(countContainer, {}, defaultCountBadgeStyles);
    const visibilityDisposable = toolBar.onDidChangeDropdownVisibility((e) => provider.classList.toggle("active", e));
    const templateDisposable = combinedDisposable(label, visibilityDisposable, toolBar);
    return { icon, label, countContainer, count, toolBar, elementDisposables: new DisposableStore(), templateDisposable };
  }
  renderElement(arg, index, templateData) {
    const repository = isSCMRepository(arg) ? arg : arg.element;
    templateData.elementDisposables.add(autorun((reader) => {
      this.onDidChangeVisibleRepositoriesSignal.read(reader);
      const isVisible = this.scmViewService.isVisible(repository);
      const icon = ThemeIcon.isThemeIcon(repository.provider.iconPath) ? repository.provider.iconPath : Codicon.repo;
      const showSelectedIcon = icon.id === Codicon.repo.id && isVisible && this.scmViewService.repositories.length > 1;
      templateData.icon.className = showSelectedIcon ? `icon ${ThemeIcon.asClassName(Codicon.repoSelected)}` : `icon ${ThemeIcon.asClassName(icon)}`;
    }));
    let description = void 0;
    if (repository.provider.rootUri) {
      const repositoriesWithRootUri = this.scmViewService.repositories.filter((r) => r.provider.rootUri !== void 0 && this.uriIdentityService.extUri.isEqual(r.provider.rootUri, repository.provider.rootUri));
      const repositoriesWithSameName = this.scmViewService.repositories.filter((r) => r.provider.rootUri !== void 0 && r.provider.name === repository.provider.name);
      if (repositoriesWithRootUri.length > 1) {
        description = repository.provider.label;
      } else if (repositoriesWithSameName.length > 1) {
        const repositoryIndex = repositoriesWithSameName.findIndex((r) => r === repository);
        const shortDescription = shorten(repositoriesWithSameName.map((r) => this.labelService.getUriLabel(dirname(r.provider.rootUri), { relative: true })));
        description = shortDescription[repositoryIndex];
      }
    }
    let label;
    if (this.scmViewService.explorerEnabledConfig.get() === false) {
      label = repository.provider.name;
    } else {
      const parentRepository = this.scmViewService.repositories.find((r) => r.provider.id === repository.provider.parentId);
      label = parentRepository ? `${parentRepository.provider.name} / ${repository.provider.name}` : repository.provider.name;
    }
    const title = repository.provider.rootUri ? `${repository.provider.label}: ${this.labelService.getUriLabel(repository.provider.rootUri)}` : repository.provider.label;
    templateData.label.setLabel(label, description, { title });
    let statusPrimaryActions = [];
    let menuPrimaryActions = [];
    let menuSecondaryActions = [];
    const updateToolbar = () => {
      templateData.toolBar.setActions([...statusPrimaryActions, ...menuPrimaryActions], menuSecondaryActions);
    };
    templateData.elementDisposables.add(autorun((reader) => {
      const commands = repository.provider.statusBarCommands.read(reader) ?? [];
      statusPrimaryActions = commands.map((c) => reader.store.add(new StatusBarAction(c, this.commandService)));
      updateToolbar();
    }));
    templateData.elementDisposables.add(autorun((reader) => {
      const count = repository.provider.count.read(reader) ?? getRepositoryResourceCount(repository.provider);
      templateData.countContainer.setAttribute("data-count", String(count));
      templateData.count.setCount(count);
    }));
    templateData.elementDisposables.add(autorun((reader) => {
      repository.provider.contextValue.read(reader);
      const repositoryMenus = this.scmViewService.menus.getRepositoryMenus(repository.provider);
      const menu = this.toolbarMenuId === MenuId.SCMTitle ? repositoryMenus.titleMenu.menu : repositoryMenus.getRepositoryMenu(repository);
      reader.store.add(connectPrimaryMenu(menu, (primary, secondary) => {
        menuPrimaryActions = primary;
        menuSecondaryActions = secondary;
        updateToolbar();
      }, this.toolbarMenuId === MenuId.SCMTitle ? "navigation" : "inline"));
    }));
    templateData.toolBar.context = repository.provider;
  }
  renderCompressedElements() {
    throw new Error("Should never happen since node is incompressible");
  }
  disposeElement(group, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.templateDisposable.dispose();
    templateData.count.dispose();
  }
};
RepositoryRenderer = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IKeybindingService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, ISCMViewService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IUriIdentityService)
], RepositoryRenderer);
export {
  RepositoryActionRunner,
  RepositoryRenderer
};
