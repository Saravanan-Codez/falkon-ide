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
import { reset } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { ContributionEnablementState } from "../common/enablement.js";
let EnablementStatusWidget = class extends Disposable {
  constructor(_container, enablement, _labels, _markdownRendererService) {
    super();
    this._container = _container;
    this._labels = _labels;
    this._markdownRendererService = _markdownRendererService;
    this._renderDisposables = this._register(new MutableDisposable());
    this._register(autorun((reader) => {
      this._render(enablement.read(reader));
    }));
  }
  _render(state) {
    reset(this._container);
    this._renderDisposables.value = void 0;
    let message;
    if (state === ContributionEnablementState.DisabledProfile) {
      message = this._labels.disabledProfile;
    } else if (state === ContributionEnablementState.DisabledWorkspace) {
      message = this._labels.disabledWorkspace;
    }
    if (!message) {
      return;
    }
    const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    markdown.appendMarkdown(`$(${Codicon.info.id})&nbsp;`);
    markdown.appendText(message);
    const rendered = this._markdownRendererService.render(markdown);
    this._renderDisposables.value = rendered;
    this._container.appendChild(rendered.element);
  }
};
EnablementStatusWidget = __decorateClass([
  __decorateParam(3, IMarkdownRendererService)
], EnablementStatusWidget);
const pluginEnablementLabels = {
  disabledProfile: localize("pluginDisabled", "This plugin is disabled."),
  disabledWorkspace: localize("pluginDisabledWorkspace", "This plugin is disabled for this workspace.")
};
const mcpServerEnablementLabels = {
  disabledProfile: localize("mcpServerDisabled", "This MCP server is disabled."),
  disabledWorkspace: localize("mcpServerDisabledWorkspace", "This MCP server is disabled for this workspace.")
};
export {
  EnablementStatusWidget,
  mcpServerEnablementLabels,
  pluginEnablementLabels
};
