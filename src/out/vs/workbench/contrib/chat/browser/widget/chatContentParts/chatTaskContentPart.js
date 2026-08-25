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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ChatProgressContentPart } from "./chatProgressContentPart.js";
import { ChatCollapsibleListContentPart } from "./chatReferencesContentPart.js";
let ChatTaskContentPart = class extends Disposable {
  constructor(task, contentReferencesListPool, chatContentMarkdownRenderer, context, instantiationService) {
    super();
    this.task = task;
    if (task.progress.length) {
      this.isSettled = true;
      const refsPart = this._register(instantiationService.createInstance(ChatCollapsibleListContentPart, task.progress, task.content.value, context, contentReferencesListPool, void 0));
      this.domNode = dom.$(".chat-progress-task");
      this.domNode.appendChild(refsPart.domNode);
    } else {
      const isSettled = task.kind === "progressTask" ? task.isSettled() : true;
      this.isSettled = isSettled;
      const showSpinner = !isSettled && !context.element.isComplete;
      const progressPart = this._register(instantiationService.createInstance(ChatProgressContentPart, task, chatContentMarkdownRenderer, context, showSpinner, true, void 0, void 0, void 0));
      this.domNode = progressPart.domNode;
    }
  }
  hasSameContent(other) {
    if (other.kind === "progressTask" && this.task.kind === "progressTask" && other.isSettled() !== this.isSettled) {
      return false;
    }
    return other.kind === this.task.kind && other.progress.length === this.task.progress.length;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatTaskContentPart = __decorateClass([
  __decorateParam(4, IInstantiationService)
], ChatTaskContentPart);
export {
  ChatTaskContentPart
};
