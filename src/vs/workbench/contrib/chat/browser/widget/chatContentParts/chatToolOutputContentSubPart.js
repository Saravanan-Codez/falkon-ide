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
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { CodeBlockPart } from "./codeBlockPart.js";
import { ChatResourceGroupWidget } from "./chatResourceGroupWidget.js";
let ChatToolOutputContentSubPart = class extends Disposable {
  constructor(context, parts, _instantiationService, contextKeyService, _markdownRendererService) {
    super();
    this.context = context;
    this.parts = parts;
    this._instantiationService = _instantiationService;
    this.contextKeyService = contextKeyService;
    this._markdownRendererService = _markdownRendererService;
    this._editorReferences = [];
    this.codeblocks = [];
    this.domNode = this.createOutputContents();
  }
  toMdString(value) {
    if (typeof value === "string") {
      return new MarkdownString("").appendText(value);
    }
    return new MarkdownString(value.value, { isTrusted: value.isTrusted });
  }
  createOutputContents() {
    const container = dom.$("div");
    for (let i = 0; i < this.parts.length; i++) {
      const part = this.parts[i];
      if (part.kind === "code") {
        const codeParts = [part];
        while (i + 1 < this.parts.length) {
          const nextPart = this.parts[i + 1];
          if (nextPart.kind !== "code" || nextPart.title) {
            break;
          }
          codeParts.push(nextPart);
          i++;
        }
        this.addCodeBlock(codeParts, container);
        continue;
      }
      const group = [];
      for (let k = i; k < this.parts.length; k++) {
        const part2 = this.parts[k];
        if (part2.kind !== "data") {
          break;
        }
        group.push(part2);
      }
      this.addResourceGroup(group, container);
      i += group.length - 1;
    }
    return container;
  }
  addResourceGroup(parts, container) {
    const widget = this._register(this._instantiationService.createInstance(ChatResourceGroupWidget, parts));
    container.appendChild(widget.domNode);
  }
  addCodeBlock(parts, container) {
    const firstPart = parts[0];
    if (firstPart.title) {
      const title = dom.$("div.chat-confirmation-widget-title");
      const renderedTitle = this._register(this._markdownRendererService.render(this.toMdString(firstPart.title)));
      title.appendChild(renderedTitle.element);
      container.appendChild(title);
    }
    const combinedText = parts.map((p) => p.data).join("\n");
    const data = {
      languageId: firstPart.languageId,
      text: combinedText,
      codeBlockIndex: firstPart.codeBlockIndex,
      element: this.context.element,
      parentContextKeyService: this.contextKeyService,
      renderOptions: firstPart.options,
      chatSessionResource: this.context.element.sessionResource
    };
    const key = CodeBlockPart.poolKey(this.context.element.id, firstPart.codeBlockIndex);
    const editorReference = this._register(this.context.editorPool.get(key));
    editorReference.object.render(data, this.context.currentWidth.get());
    container.appendChild(editorReference.object.element);
    this._editorReferences.push(editorReference);
    this.codeblocks.push({
      ownerMarkdownPartId: firstPart.ownerMarkdownPartId,
      codeBlockIndex: firstPart.codeBlockIndex,
      elementId: this.context.element.id,
      uri: editorReference.object.uri,
      codemapperUri: void 0,
      chatSessionResource: this.context.element.sessionResource,
      focus: () => {
      }
    });
  }
  layout(width) {
    this._editorReferences.forEach((r) => r.object.layout(width));
  }
};
ChatToolOutputContentSubPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IMarkdownRendererService)
], ChatToolOutputContentSubPart);
export {
  ChatToolOutputContentSubPart
};
