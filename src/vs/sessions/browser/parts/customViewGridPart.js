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
import "./media/customViewGridPart.css";
import { $, size } from "../../../base/browser/dom.js";
import { LayoutPriority } from "../../../base/browser/ui/splitview/splitview.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { MutableDisposable } from "../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { Part } from "../../../workbench/browser/part.js";
import { Parts } from "../../../workbench/services/layout/browser/layoutService.js";
import { applyAgentsPartCardStyles, getAgentsPartCardContentSize } from "./agentsPartCard.js";
import { CustomViewNode } from "./customViewNode.js";
import { IAgentWorkbenchLayoutService } from "../workbench.js";
let CustomViewGridPart = class extends Part {
  constructor(themeService, storageService, agentWorkbenchLayoutService, instantiationService) {
    super(
      Parts.CUSTOM_VIEW_GRID_PART,
      { hasTitle: false, borderWidth: () => 0 },
      themeService,
      storageService,
      agentWorkbenchLayoutService
    );
    this.agentWorkbenchLayoutService = agentWorkbenchLayoutService;
    this.instantiationService = instantiationService;
    this.minimumWidth = 300;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this.priority = LayoutPriority.High;
    this._node = this._register(new MutableDisposable());
  }
  get snap() {
    return false;
  }
  create(parent) {
    this.element = parent;
    super.create(parent);
  }
  createContentArea(parent) {
    const contentArea = $(".custom-view-grid");
    parent.appendChild(contentArea);
    this._contentArea = contentArea;
    this._renderView();
    return contentArea;
  }
  /** Renders the given custom view, replacing (and disposing) the previous one. */
  setView(descriptor) {
    if (this._descriptor === descriptor) {
      return;
    }
    this._descriptor = descriptor;
    this._renderView();
  }
  _renderView() {
    if (!this._contentArea) {
      return;
    }
    this._node.clear();
    if (!this._descriptor) {
      return;
    }
    const node = this.instantiationService.createInstance(CustomViewNode, this._descriptor);
    this._node.value = node;
    this._contentArea.appendChild(node.element);
    if (this._lastContentSize) {
      this._layoutNode(this._lastContentSize.width, this._lastContentSize.height);
    }
  }
  focus() {
    this._node.value?.focus();
  }
  updateStyles() {
    super.updateStyles();
    applyAgentsPartCardStyles(assertReturnsDefined(this.getContainer()), this.theme);
  }
  layout(width, height, top, left) {
    if (!this.layoutService.isVisible(Parts.CUSTOM_VIEW_GRID_PART)) {
      return;
    }
    const cardSize = getAgentsPartCardContentSize(width, height, this.agentWorkbenchLayoutService.isEditorPaneVisible());
    const { contentSize } = this.layoutContents(cardSize.width, cardSize.height);
    this._layoutNode(contentSize.width, contentSize.height);
    super.layout(width, height, top, left);
  }
  _layoutNode(width, height) {
    this._lastContentSize = { width, height };
    const node = this._node.value;
    if (!node) {
      return;
    }
    size(node.element, width, height);
    node.layout(width, height);
  }
  toJSON() {
    return {
      type: Parts.CUSTOM_VIEW_GRID_PART
    };
  }
};
CustomViewGridPart = __decorateClass([
  __decorateParam(0, IThemeService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IAgentWorkbenchLayoutService),
  __decorateParam(3, IInstantiationService)
], CustomViewGridPart);
export {
  CustomViewGridPart
};
