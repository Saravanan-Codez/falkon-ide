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
import * as DOM from "../../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import { DefaultStyleController } from "../../../../base/browser/ui/list/listWidget.js";
import { RenderIndentGuides } from "../../../../base/browser/ui/tree/abstractTree.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IListService, WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { getListStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { editorBackground, focusBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { settingsHeaderForeground, settingsHeaderHoverForeground } from "../common/settingsEditorColorRegistry.js";
import { SettingsTreeFilter } from "./settingsTree.js";
import { SettingsTreeGroupElement, SettingsTreeSettingElement } from "./settingsTreeModels.js";
const $ = DOM.$;
let TOCTreeModel = class {
  constructor(_viewState, environmentService) {
    this._viewState = _viewState;
    this.environmentService = environmentService;
    this._currentSearchModel = null;
  }
  get settingsTreeRoot() {
    return this._settingsTreeRoot;
  }
  set settingsTreeRoot(value) {
    this._settingsTreeRoot = value;
    this.update();
  }
  get currentSearchModel() {
    return this._currentSearchModel;
  }
  set currentSearchModel(model) {
    this._currentSearchModel = model;
    this.update();
  }
  get children() {
    return this._settingsTreeRoot.children;
  }
  update() {
    if (this._settingsTreeRoot) {
      this.updateGroupCount(this._settingsTreeRoot);
    }
  }
  updateGroupCount(group) {
    group.children.forEach((child) => {
      if (child instanceof SettingsTreeGroupElement) {
        this.updateGroupCount(child);
      }
    });
    const childCount = group.children.filter((child) => child instanceof SettingsTreeGroupElement).reduce((acc, cur) => acc + cur.count, 0);
    group.count = childCount + this.getGroupCount(group);
  }
  getGroupCount(group) {
    return group.children.filter((child) => {
      if (!(child instanceof SettingsTreeSettingElement)) {
        return false;
      }
      if (this._currentSearchModel && !this._currentSearchModel.root.containsSetting(child.setting.key)) {
        return false;
      }
      const isRemote = !!this.environmentService.remoteAuthority;
      return child.matchesScope(this._viewState.settingsTarget, isRemote) && child.matchesAllTags(this._viewState.tagFilters) && child.matchesAnyFeature(this._viewState.featureFilters) && child.matchesAnyExtension(this._viewState.extensionFilters) && child.matchesAnyId(this._viewState.idFilters);
    }).length;
  }
};
TOCTreeModel = __decorateClass([
  __decorateParam(1, IWorkbenchEnvironmentService)
], TOCTreeModel);
const TOC_ENTRY_TEMPLATE_ID = "settings.toc.entry";
class TOCRenderer {
  constructor(_hoverService) {
    this._hoverService = _hoverService;
    this.templateId = TOC_ENTRY_TEMPLATE_ID;
  }
  renderTemplate(container) {
    return {
      labelElement: DOM.append(container, $(".settings-toc-entry")),
      countElement: DOM.append(container, $(".settings-toc-count")),
      elementDisposables: new DisposableStore()
    };
  }
  renderElement(node, index, template) {
    template.elementDisposables.clear();
    const element = node.element;
    const count = element.count;
    const label = element.label;
    template.labelElement.textContent = label;
    template.elementDisposables.add(this._hoverService.setupDelayedHover(template.labelElement, { content: label }));
    if (count) {
      template.countElement.textContent = ` (${count})`;
    } else {
      template.countElement.textContent = "";
    }
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
  }
}
class TOCTreeDelegate {
  getTemplateId(element) {
    return TOC_ENTRY_TEMPLATE_ID;
  }
  getHeight(element) {
    return 22;
  }
}
function createTOCIterator(model, tree) {
  const groupChildren = model.children.filter((c) => c instanceof SettingsTreeGroupElement);
  return Iterable.map(groupChildren, (g) => {
    const hasGroupChildren = g.children.some((c) => c instanceof SettingsTreeGroupElement);
    return {
      element: g,
      collapsed: void 0,
      collapsible: hasGroupChildren,
      children: g instanceof SettingsTreeGroupElement ? createTOCIterator(g, tree) : void 0
    };
  });
}
class SettingsAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize(
      {
        key: "settingsTOC",
        comment: ["A label for the table of contents for the full settings list"]
      },
      "Settings Table of Contents"
    );
  }
  getAriaLabel(element) {
    if (!element) {
      return "";
    }
    if (element instanceof SettingsTreeGroupElement) {
      return localize("groupRowAriaLabel", "{0}, group", element.label);
    }
    return "";
  }
  getAriaLevel(element) {
    let i = 1;
    while (element instanceof SettingsTreeGroupElement && element.parent) {
      i++;
      element = element.parent;
    }
    return i;
  }
}
let TOCTree = class extends WorkbenchObjectTree {
  constructor(container, viewState, contextKeyService, listService, configurationService, hoverService, instantiationService) {
    const filter = instantiationService.createInstance(SettingsTreeFilter, viewState, false);
    const options = {
      filter,
      multipleSelectionSupport: false,
      identityProvider: {
        getId(e) {
          return e.id;
        }
      },
      styleController: (id) => new DefaultStyleController(domStylesheetsJs.createStyleSheet(container), id),
      accessibilityProvider: instantiationService.createInstance(SettingsAccessibilityProvider),
      collapseByDefault: true,
      horizontalScrolling: false,
      hideTwistiesOfChildlessElements: true,
      renderIndentGuides: RenderIndentGuides.None
    };
    super(
      "SettingsTOC",
      container,
      new TOCTreeDelegate(),
      [new TOCRenderer(hoverService)],
      options,
      instantiationService,
      contextKeyService,
      listService,
      configurationService
    );
    this.style(getListStyles({
      listBackground: editorBackground,
      listFocusOutline: focusBorder,
      listActiveSelectionBackground: editorBackground,
      listActiveSelectionForeground: settingsHeaderForeground,
      listFocusAndSelectionBackground: editorBackground,
      listFocusAndSelectionForeground: settingsHeaderForeground,
      listFocusBackground: editorBackground,
      listFocusForeground: settingsHeaderHoverForeground,
      listHoverForeground: settingsHeaderHoverForeground,
      listHoverBackground: editorBackground,
      listInactiveSelectionBackground: editorBackground,
      listInactiveSelectionForeground: settingsHeaderForeground,
      listInactiveFocusBackground: editorBackground,
      listInactiveFocusOutline: editorBackground,
      treeIndentGuidesStroke: void 0,
      treeInactiveIndentGuidesStroke: void 0
    }));
  }
};
TOCTree = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IListService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IInstantiationService)
], TOCTree);
export {
  TOCRenderer,
  TOCTree,
  TOCTreeModel,
  createTOCIterator
};
