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
import { ButtonWithIcon } from "../../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { observableConfigValue } from "../../../../../../platform/observable/common/platformObservableUtils.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { LanguageModelPartAudience } from "../../../common/languageModels.js";
import { AccessibilityWorkbenchSettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { CodeBlockPart } from "./codeBlockPart.js";
import { ChatQueryTitlePart } from "./chatConfirmationWidget.js";
import { ChatToolOutputContentSubPart } from "./chatToolOutputContentSubPart.js";
import { getChatMarkdownRenderOptions } from "../chatContentMarkdownRenderer.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
let ChatCollapsibleInputOutputContentPart = class extends Disposable {
  constructor(title, subtitle, progressTooltip, context, input, output, isError, initiallyExpanded, shimmer, contextKeyService, _instantiationService, hoverService, configurationService) {
    super();
    this.context = context;
    this.input = input;
    this.output = output;
    this.contextKeyService = contextKeyService;
    this._instantiationService = _instantiationService;
    this.configurationService = configurationService;
    this._editorReferences = [];
    this._contentInitialized = false;
    const container = dom.h(".chat-confirmation-widget-container");
    const titleEl = dom.h(".chat-confirmation-widget-title-inner");
    const elements = dom.h(".chat-confirmation-widget.chat-confirmation-widget-collapsible");
    const contentAnimation = dom.h(".chat-confirmation-widget-message-animation", [
      dom.h(".chat-confirmation-widget-message-animation-inner@inner")
    ]);
    this.domNode = container.root;
    container.root.appendChild(elements.root);
    this._titlePart = this._register(_instantiationService.createInstance(
      ChatQueryTitlePart,
      titleEl.root,
      title,
      subtitle
    ));
    this._titlePart.setOptions({ markdownRenderOptions: getChatMarkdownRenderOptions(), renderFileWidgets: true });
    const spacer = document.createElement("span");
    spacer.style.flexGrow = "1";
    const btn = this._register(new ButtonWithIcon(elements.root, {}));
    btn.element.classList.add("chat-confirmation-widget-title", "monaco-text-button");
    btn.labelElement.append(titleEl.root);
    elements.root.appendChild(contentAnimation.root);
    const hoverChevron = dom.$("span.chat-collapsible-hover-chevron.codicon.codicon-chevron-right");
    hoverChevron.setAttribute("aria-hidden", "true");
    btn.element.appendChild(hoverChevron);
    const showCheckmarks = observableConfigValue(AccessibilityWorkbenchSettingId.ShowChatCheckmarks, false, this.configurationService);
    const expanded = this._expanded = observableValue(this, initiallyExpanded);
    this._register(autorun((r) => {
      const value = expanded.read(r);
      const checkmarksEnabled = showCheckmarks.read(r);
      const isInProgress = !output && !isError;
      if (isError) {
        btn.icon = Codicon.error;
      } else {
        btn.icon = output ? Codicon.check : ThemeIcon.modify(Codicon.loading, "spin");
      }
      elements.root.classList.toggle("shimmer-progress", shimmer && isInProgress);
      container.root.classList.toggle("show-checkmarks", checkmarksEnabled);
      hoverChevron.classList.toggle("expanded", value);
      if (value && !this._contentInitialized) {
        this._contentInitialized = true;
        const messageContainer = dom.h(".chat-confirmation-widget-message");
        messageContainer.root.appendChild(this.createMessageContents());
        contentAnimation.inner.appendChild(messageContainer.root);
        const resizeObserver = this._register(new dom.DisposableResizeObserver("ChatCollapsibleInputOutputContentPart.message", () => this.layoutToMessageWidth(messageContainer.root)));
        this._register(resizeObserver.observe(messageContainer.root));
        this.layoutToMessageWidth(messageContainer.root);
        contentAnimation.root.getBoundingClientRect();
      }
      elements.root.classList.toggle("collapsed", !value);
      contentAnimation.inner.inert = !value;
      btn.element.ariaExpanded = String(value);
    }));
    const toggle = (e) => {
      if (!e.defaultPrevented) {
        const value = expanded.get();
        container.root.dispatchEvent(new CustomEvent(ChatCollapsibleContentPart.userToggleEvent, { bubbles: true }));
        expanded.set(!value, void 0);
        e.preventDefault();
      }
    };
    this._register(btn.onDidClick(toggle));
    const topLevelResources = this.output?.parts.filter((p) => p.kind === "data").filter((p) => !p.audience || p.audience.includes(LanguageModelPartAudience.User));
    if (topLevelResources?.length) {
      const resourceSubPart = this._register(this._instantiationService.createInstance(
        ChatToolOutputContentSubPart,
        this.context,
        topLevelResources
      ));
      const group = resourceSubPart.domNode;
      group.classList.add("chat-collapsible-top-level-resource-group");
      container.root.appendChild(group);
      this._register(autorun((r) => {
        group.style.display = expanded.read(r) ? "none" : "";
      }));
    }
  }
  get codeblocks() {
    const outputCodeblocks = this._outputSubPart?.codeblocks ?? [];
    return outputCodeblocks;
  }
  set title(s) {
    this._titlePart.title = s;
  }
  get title() {
    return this._titlePart.title;
  }
  get expanded() {
    return this._expanded.get();
  }
  createMessageContents() {
    const contents = dom.h("div", [
      dom.h("h3@inputTitle"),
      dom.h("div@input"),
      dom.h("h3@outputTitle"),
      dom.h("div@output")
    ]);
    const { input, output } = this;
    contents.inputTitle.textContent = localize("chat.input", "Input");
    this.addCodeBlock(input, contents.input);
    if (!output) {
      contents.output.remove();
      contents.outputTitle.remove();
    } else {
      contents.outputTitle.textContent = localize("chat.output", "Output");
      const outputSubPart = this._register(this._instantiationService.createInstance(
        ChatToolOutputContentSubPart,
        this.context,
        output.parts
      ));
      this._outputSubPart = outputSubPart;
      contents.output.appendChild(outputSubPart.domNode);
    }
    return contents.root;
  }
  addCodeBlock(part, container) {
    const data = {
      languageId: part.languageId,
      text: part.data,
      codeBlockIndex: part.codeBlockIndex,
      element: this.context.element,
      parentContextKeyService: this.contextKeyService,
      renderOptions: part.options,
      chatSessionResource: this.context.element.sessionResource
    };
    const key = CodeBlockPart.poolKey(this.context.element.id, part.codeBlockIndex);
    const editorReference = this._register(this.context.editorPool.get(key));
    editorReference.object.render(data, this.context.currentWidth.get() || 300);
    container.appendChild(editorReference.object.element);
    this._editorReferences.push(editorReference);
  }
  layoutToMessageWidth(messageContainer) {
    const width = dom.getContentWidth(messageContainer);
    if (width <= 0 || width === this._lastLayoutWidth) {
      return;
    }
    this._lastLayoutWidth = width;
    this.layout(width);
  }
  hasSameContent(other, followingContent, element) {
    return false;
  }
  layout(width) {
    this._editorReferences.forEach((r) => r.object.layout(width));
    this._outputSubPart?.layout(width);
  }
};
ChatCollapsibleInputOutputContentPart = __decorateClass([
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IConfigurationService)
], ChatCollapsibleInputOutputContentPart);
export {
  ChatCollapsibleInputOutputContentPart
};
