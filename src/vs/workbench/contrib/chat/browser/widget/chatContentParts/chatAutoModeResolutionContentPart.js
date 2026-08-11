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
import { $ } from "../../../../../../base/browser/dom.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ILanguageModelChatMetadata } from "../../../common/languageModels.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import "./media/chatAutoModeResolution.css";
let ChatAutoModeResolutionContentPart = class extends ChatCollapsibleContentPart {
  constructor(content, context, chatContentMarkdownRenderer, hoverService, configurationService) {
    super(
      localize("autoModeResolution.title", "Routed to {0}", content.resolvedModelName),
      context,
      void 0,
      hoverService,
      configurationService
    );
    this.content = content;
    this.chatContentMarkdownRenderer = chatContentMarkdownRenderer;
  }
  initContent() {
    const wrapper = $(".chat-auto-mode-resolution-content.chat-used-context-list");
    const body = $(".chat-auto-mode-resolution-body");
    const explanation = $(".chat-auto-mode-resolution-explanation");
    const explanationMd = new MarkdownString(ILanguageModelChatMetadata.getAutoModelDescription());
    const rendered = this._register(this.chatContentMarkdownRenderer.render(explanationMd));
    explanation.appendChild(rendered.element);
    body.appendChild(explanation);
    const detailLine = $(".chat-auto-mode-resolution-detail");
    let detailText;
    if (this.content.predictedLabel === "fallback") {
      detailText = localize("autoModeResolution.fallback", "Unable to resolve");
    } else {
      const label = this.content.predictedLabel === "needs_reasoning" ? localize("autoModeResolution.reasoning", "Reasoning") : localize("autoModeResolution.nonReasoning", "Non-reasoning");
      const confidencePercent = (this.content.confidence * 100).toFixed(0);
      detailText = localize("autoModeResolution.detail", "{0} - Confidence {1}%", label, confidencePercent);
    }
    const detailRendered = this._register(this.chatContentMarkdownRenderer.render(new MarkdownString(detailText)));
    detailLine.appendChild(detailRendered.element);
    body.appendChild(detailLine);
    wrapper.appendChild(body);
    return wrapper;
  }
  hasSameContent(other, _followingContent, _element) {
    return other.kind === "autoModeResolution" && other.resolvedModel === this.content.resolvedModel && other.resolvedModelName === this.content.resolvedModelName && other.confidence === this.content.confidence && other.predictedLabel === this.content.predictedLabel;
  }
};
ChatAutoModeResolutionContentPart = __decorateClass([
  __decorateParam(3, IHoverService),
  __decorateParam(4, IConfigurationService)
], ChatAutoModeResolutionContentPart);
export {
  ChatAutoModeResolutionContentPart
};
