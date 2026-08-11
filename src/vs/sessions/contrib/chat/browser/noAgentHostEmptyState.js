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
import "./media/noAgentHostEmptyState.css";
import * as dom from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isMobile } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
const $ = dom.$;
const LEARN_MORE_URL = "https://aka.ms/VSCode/Agents/docs";
let NoAgentHostEmptyState = class extends Disposable {
  constructor(_openerService, _productService) {
    super();
    this._openerService = _openerService;
    this._productService = _productService;
  }
  render(parent) {
    this._root = dom.append(parent, $(".no-agent-host-empty-state"));
    this._root.setAttribute("role", "group");
    this._root.setAttribute("aria-label", localize("noAgentHost.aria", "No agent hosts available"));
    this._root.tabIndex = -1;
    if (!isMobile) {
      const iconWrap = dom.append(this._root, $(".no-agent-host-icon"));
      iconWrap.append(...renderLabelWithIcons(`$(${Codicon.remote.id})`));
    }
    const heading = dom.append(this._root, $("h2.no-agent-host-title"));
    heading.textContent = localize("noAgentHost.title", "Connect a host to get started");
    const cliBinary = this._productService.quality === "stable" ? "code" : "code-insiders";
    const command = `${cliBinary} tunnel`;
    const description = dom.append(this._root, $("p.no-agent-host-description"));
    renderFormattedText(
      localize(
        "noAgentHost.description",
        "Run ``{0}`` from any device, then return here to run agent tasks on it.",
        command
      ),
      { renderCodeSegments: true },
      description
    );
    description.appendChild(document.createTextNode(" "));
    const learnMore = dom.append(description, $("a.no-agent-host-link"));
    learnMore.textContent = localize("noAgentHost.learnMore", "Learn more");
    learnMore.href = LEARN_MORE_URL;
    this._register(dom.addDisposableListener(learnMore, dom.EventType.CLICK, (e) => {
      e.preventDefault();
      this._openerService.open(URI.parse(LEARN_MORE_URL));
    }));
  }
  focus() {
    this._root?.focus();
  }
  dispose() {
    this._root?.remove();
    this._root = void 0;
    super.dispose();
  }
};
NoAgentHostEmptyState = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IProductService)
], NoAgentHostEmptyState);
export {
  NoAgentHostEmptyState
};
