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
import { renderMarkdown } from "../../../base/browser/markdownRenderer.js";
import { onUnexpectedError } from "../../../base/common/errors.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { IOpenerService } from "../../opener/common/opener.js";
const IMarkdownRendererService = createDecorator("markdownRendererService");
let MarkdownRendererService = class {
  constructor(_openerService) {
    this._openerService = _openerService;
  }
  render(markdown, options, outElement) {
    const resolvedOptions = { ...options };
    if (!resolvedOptions.actionHandler) {
      resolvedOptions.actionHandler = (link, mdStr) => {
        return openLinkFromMarkdown(this._openerService, link, mdStr.isTrusted);
      };
    }
    if (!resolvedOptions.codeBlockRenderer) {
      resolvedOptions.codeBlockRenderer = (alias, value) => {
        return this._defaultCodeBlockRenderer?.renderCodeBlock(alias, value, resolvedOptions ?? {}) ?? Promise.resolve(document.createElement("span"));
      };
    }
    const rendered = renderMarkdown(markdown, resolvedOptions, outElement);
    rendered.element.classList.add("rendered-markdown");
    return rendered;
  }
  setDefaultCodeBlockRenderer(renderer) {
    this._defaultCodeBlockRenderer = renderer;
  }
};
MarkdownRendererService = __decorateClass([
  __decorateParam(0, IOpenerService)
], MarkdownRendererService);
async function openLinkFromMarkdown(openerService, link, isTrusted, skipValidation) {
  try {
    return await openerService.open(link, {
      fromUserGesture: true,
      allowContributedOpeners: true,
      allowCommands: toAllowCommandsOption(isTrusted),
      skipValidation
    });
  } catch (e) {
    onUnexpectedError(e);
    return false;
  }
}
function toAllowCommandsOption(isTrusted) {
  if (isTrusted === true) {
    return true;
  }
  if (isTrusted && Array.isArray(isTrusted.enabledCommands)) {
    return isTrusted.enabledCommands;
  }
  return false;
}
registerSingleton(IMarkdownRendererService, MarkdownRendererService, InstantiationType.Delayed);
export {
  IMarkdownRendererService,
  MarkdownRendererService,
  openLinkFromMarkdown
};
