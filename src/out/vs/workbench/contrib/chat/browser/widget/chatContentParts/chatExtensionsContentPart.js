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
import "./media/chatExtensionsContent.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ExtensionsList, getExtensions } from "../../../../extensions/browser/extensionsViewer.js";
import { IExtensionsWorkbenchService } from "../../../../extensions/common/extensions.js";
import { ChatViewId } from "../../chat.js";
import { PagedModel } from "../../../../../../base/common/paging.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
let ChatExtensionsContentPart = class extends Disposable {
  constructor(extensionsContent, extensionsWorkbenchService, instantiationService) {
    super();
    this.extensionsContent = extensionsContent;
    this.domNode = dom.$(".chat-extensions-content-part");
    const loadingElement = dom.append(this.domNode, dom.$(".loading-extensions-element"));
    dom.append(loadingElement, dom.$(ThemeIcon.asCSSSelector(ThemeIcon.modify(Codicon.loading, "spin"))), dom.$("span.loading-message", void 0, localize("chat.extensions.loading", "Loading extensions...")));
    const extensionsList = dom.append(this.domNode, dom.$(".extensions-list"));
    const list = this._register(instantiationService.createInstance(ExtensionsList, extensionsList, ChatViewId, { alwaysConsumeMouseWheel: false }, { onFocus: Event.None, onBlur: Event.None, filters: {} }));
    getExtensions(extensionsContent.extensions, extensionsWorkbenchService).then((extensions) => {
      loadingElement.remove();
      if (this._store.isDisposed) {
        return;
      }
      list.setModel(new PagedModel(extensions));
      list.layout();
    });
  }
  get codeblocks() {
    return [];
  }
  get codeblocksPartId() {
    return void 0;
  }
  hasSameContent(other, followingContent, element) {
    return other.kind === "extensions" && other.extensions.length === this.extensionsContent.extensions.length && other.extensions.every((ext) => this.extensionsContent.extensions.includes(ext));
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatExtensionsContentPart = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IInstantiationService)
], ChatExtensionsContentPart);
export {
  ChatExtensionsContentPart
};
