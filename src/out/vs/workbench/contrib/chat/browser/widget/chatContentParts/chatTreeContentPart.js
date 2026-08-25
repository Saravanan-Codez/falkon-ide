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
import * as dom from "../../../../../../base/browser/dom.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { FileKind, FileType } from "../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { createFileIconThemableTreeContainerScope } from "../../../../files/browser/views/explorerView.js";
import { ResourcePool } from "./chatCollections.js";
const $ = dom.$;
let ChatTreeContentPart = class extends Disposable {
  constructor(data, treePool, openerService) {
    super();
    this.openerService = openerService;
    const ref = this._register(treePool.get());
    this.tree = ref.object;
    this.onDidFocus = this.tree.onDidFocus;
    this._register(this.tree.onDidOpen((e) => {
      if (e.element && !("children" in e.element)) {
        this.openerService.open(e.element.uri);
      }
    }));
    this._register(this.tree.onContextMenu((e) => {
      e.browserEvent.preventDefault();
      e.browserEvent.stopPropagation();
    }));
    this.tree.setInput(data).then(() => {
      if (!ref.isStale()) {
        this.tree.layout();
      }
    });
    this.domNode = this.tree.getHTMLElement().parentElement;
  }
  domFocus() {
    this.tree.domFocus();
  }
  hasSameContent(other) {
    return other.kind === "treeData";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatTreeContentPart = __decorateClass([
  __decorateParam(2, IOpenerService)
], ChatTreeContentPart);
let TreePool = class extends Disposable {
  constructor(_onDidChangeVisibility, instantiationService, configService, themeService) {
    super();
    this._onDidChangeVisibility = _onDidChangeVisibility;
    this.instantiationService = instantiationService;
    this.configService = configService;
    this.themeService = themeService;
    this._pool = this._register(new ResourcePool(() => this.treeFactory()));
  }
  get inUse() {
    return this._pool.inUse;
  }
  treeFactory() {
    const store = new DisposableStore();
    const resourceLabels = store.add(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility }));
    const container = $(".interactive-response-progress-tree");
    store.add(createFileIconThemableTreeContainerScope(container, this.themeService));
    const tree = this.instantiationService.createInstance(
      WorkbenchCompressibleAsyncDataTree,
      "ChatListRenderer",
      container,
      new ChatListTreeDelegate(),
      new ChatListTreeCompressionDelegate(),
      [new ChatListTreeRenderer(resourceLabels, this.configService.getValue("explorer.decorations"))],
      new ChatListTreeDataSource(),
      {
        collapseByDefault: () => false,
        expandOnlyOnTwistieClick: () => false,
        identityProvider: {
          getId: (e) => e.uri.toString()
        },
        accessibilityProvider: {
          getAriaLabel: (element) => element.label,
          getWidgetAriaLabel: () => localize("treeAriaLabel", "File Tree")
        },
        alwaysConsumeMouseWheel: false
      }
    );
    return {
      tree,
      dispose: () => store.dispose()
    };
  }
  get() {
    const wrapper = this._pool.get();
    let stale = false;
    return {
      object: wrapper.tree,
      isStale: () => stale,
      dispose: () => {
        stale = true;
        this._pool.release(wrapper);
      }
    };
  }
  clear() {
    this._pool.clear();
  }
};
TreePool = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IThemeService)
], TreePool);
class ChatListTreeDelegate {
  static {
    this.ITEM_HEIGHT = 22;
  }
  getHeight(element) {
    return ChatListTreeDelegate.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    return "chatListTreeTemplate";
  }
}
class ChatListTreeCompressionDelegate {
  isIncompressible(element) {
    return !element.children;
  }
}
class ChatListTreeRenderer {
  constructor(labels, decorations) {
    this.labels = labels;
    this.decorations = decorations;
    this.templateId = "chatListTreeTemplate";
  }
  renderCompressedElements(element, index, templateData) {
    templateData.label.element.style.display = "flex";
    const label = element.element.elements.map((e) => e.label);
    templateData.label.setResource({ resource: element.element.elements[0].uri, name: label }, {
      title: element.element.elements[0].label,
      fileKind: element.children ? FileKind.FOLDER : FileKind.FILE,
      extraClasses: ["explorer-item"],
      fileDecorations: this.decorations
    });
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const label = templateDisposables.add(this.labels.create(container, { supportHighlights: true }));
    return { templateDisposables, label };
  }
  renderElement(element, index, templateData) {
    templateData.label.element.style.display = "flex";
    if (!element.children.length && element.element.type !== FileType.Directory) {
      templateData.label.setFile(element.element.uri, {
        fileKind: FileKind.FILE,
        hidePath: true,
        fileDecorations: this.decorations
      });
    } else {
      templateData.label.setResource({ resource: element.element.uri, name: element.element.label }, {
        title: element.element.label,
        fileKind: FileKind.FOLDER,
        fileDecorations: this.decorations
      });
    }
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
class ChatListTreeDataSource {
  hasChildren(element) {
    return !!element.children;
  }
  async getChildren(element) {
    return element.children ?? [];
  }
}
export {
  ChatTreeContentPart,
  TreePool
};
