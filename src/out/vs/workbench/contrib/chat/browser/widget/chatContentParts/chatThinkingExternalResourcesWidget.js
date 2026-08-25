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
import { $, clearNode, hide, show } from "../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ChatResourceGroupWidget } from "./chatResourceGroupWidget.js";
let ChatThinkingExternalResourceWidget = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this.resourcePartsByToolCallId = /* @__PURE__ */ new Map();
    this.resourceGroupWidget = this._register(new MutableDisposable());
    this.resourceGroupWidgetHeightListener = this._register(new MutableDisposable());
    this.isCollapsed = true;
    this.domNode = $(".chat-thinking-external-resources");
    hide(this.domNode);
  }
  setToolInvocationParts(toolCallId, parts) {
    if (parts.length === 0) {
      return;
    }
    this.resourcePartsByToolCallId.set(toolCallId, parts);
    this.rebuild();
  }
  removeToolInvocation(toolCallId) {
    if (!this.resourcePartsByToolCallId.delete(toolCallId)) {
      return;
    }
    this.rebuild();
  }
  setCollapsed(collapsed) {
    this.isCollapsed = collapsed;
    if (!this.resourceGroupWidget.value) {
      hide(this.domNode);
      return;
    }
    if (this.isCollapsed) {
      show(this.domNode);
    } else {
      hide(this.domNode);
    }
  }
  rebuild() {
    const allParts = [];
    for (const parts of this.resourcePartsByToolCallId.values()) {
      allParts.push(...parts);
    }
    this.resourceGroupWidgetHeightListener.clear();
    this.resourceGroupWidget.clear();
    clearNode(this.domNode);
    if (allParts.length === 0) {
      hide(this.domNode);
      this._onDidChangeHeight.fire();
      return;
    }
    const widget = this.instantiationService.createInstance(ChatResourceGroupWidget, allParts);
    this.resourceGroupWidgetHeightListener.value = widget.onDidChangeHeight(() => this._onDidChangeHeight.fire());
    this.resourceGroupWidget.value = widget;
    this.domNode.appendChild(widget.domNode);
    this.setCollapsed(this.isCollapsed);
    this._onDidChangeHeight.fire();
  }
};
ChatThinkingExternalResourceWidget = __decorateClass([
  __decorateParam(0, IInstantiationService)
], ChatThinkingExternalResourceWidget);
export {
  ChatThinkingExternalResourceWidget
};
