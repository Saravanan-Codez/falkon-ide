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
import * as dom from "../../../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../../../base/browser/keyboardEvent.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { localize } from "../../../../../../../nls.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { getDefaultHoverDelegate } from "../../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ToolRiskLevel } from "../../../tools/chatToolRiskAssessmentService.js";
import "./media/toolRiskBadge.css";
const RISK_BADGE_CLASS = "tool-risk-badge";
let ToolRiskBadgeWidget = class extends Disposable {
  constructor(_hoverService) {
    super();
    this._hoverService = _hoverService;
    this._hoverStore = this._register(new DisposableStore());
    this._detailsHoverStore = this._register(new DisposableStore());
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this.domNode = dom.$(`span.${RISK_BADGE_CLASS}`);
    this._iconEl = dom.$("span.tool-risk-icon");
    this._iconEl.setAttribute("aria-hidden", "true");
    this._textEl = dom.$("span.tool-risk-text");
    this._detailsIconEl = dom.$("span.tool-risk-details-icon");
    this._detailsIconEl.classList.add(...ThemeIcon.asClassNameArray(Codicon.info));
    this._detailsIconEl.tabIndex = 0;
    this._detailsIconEl.setAttribute("role", "button");
    this._detailsIconEl.setAttribute("aria-label", localize("toolRisk.detailsIconLabel", "Risk assessment details"));
    this.domNode.append(this._iconEl, this._textEl, this._detailsIconEl);
    this._refreshDetailsHover();
    this.setLoading();
    this._register(dom.addDisposableListener(this._detailsIconEl, dom.EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._hoverService.showManagedHover(this._detailsIconEl);
    }));
    this._register(dom.addDisposableListener(this._detailsIconEl, dom.EventType.KEY_DOWN, (e) => {
      const ev = new StandardKeyboardEvent(e);
      if (ev.keyCode === KeyCode.Enter || ev.keyCode === KeyCode.Space) {
        ev.preventDefault();
        ev.stopPropagation();
        this._hoverService.showManagedHover(this._detailsIconEl);
      }
    }));
  }
  get isDisposed() {
    return this._store.isDisposed;
  }
  setLoading() {
    this._setVariant("loading");
    this._setIcon(ThemeIcon.modify(Codicon.loadingCompact, "spin"));
    const text = localize("toolRisk.assessing", "Assessing risk\u2026");
    this._textEl.textContent = text;
    this._setHover(localize("toolRisk.assessingHover", "Generating a risk assessment for this tool call."));
  }
  setHidden() {
    this.domNode.style.display = "none";
    this._onDidHide.fire();
  }
  setAssessment(assessment) {
    switch (assessment.risk) {
      case ToolRiskLevel.Green:
        this._setVariant("green");
        this._setIcon(Codicon.passCompact);
        break;
      case ToolRiskLevel.Orange:
        this._setVariant("orange");
        this._setIcon(Codicon.warningCompact);
        break;
      case ToolRiskLevel.Red:
        this._setVariant("red");
        this._setIcon(Codicon.errorCompact);
        break;
    }
    this.domNode.style.display = "";
    this._textEl.textContent = assessment.explanation;
    this._setHover(assessment.explanation);
  }
  /**
   * Provide additional context to surface in the trailing info icon's hover.
   * The hover always notes that the assessment is AI-generated; any details
   * passed here are appended below that note.
   */
  setDetails(details) {
    this._details = details;
    this._refreshDetailsHover();
  }
  /**
   * The markdown content currently shown in the trailing info icon's hover.
   * Exposed so component fixtures can render a preview of the hover content.
   */
  getDetailsMarkdown() {
    return this._buildDetailsMarkdown();
  }
  _setVariant(variant) {
    this.domNode.classList.remove("green", "orange", "red", "loading");
    this.domNode.classList.add(variant);
  }
  _setIcon(icon) {
    this._iconEl.textContent = "";
    this._iconEl.className = "tool-risk-icon " + ThemeIcon.asClassName(icon);
  }
  _setHover(content) {
    this._hoverStore.clear();
    this._hoverStore.add(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.domNode, content));
  }
  _refreshDetailsHover() {
    this._detailsHoverStore.clear();
    const md = this._buildDetailsMarkdown();
    const fallback = md.value.replace(/\$\([^)]+\)\s?/g, "");
    this._detailsHoverStore.add(this._hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      this._detailsIconEl,
      { markdown: md, markdownNotSupportedFallback: fallback }
    ));
  }
  _buildDetailsMarkdown() {
    const aiNote = localize("toolRisk.aiGenerated", "Risk assessments are AI-generated and may be inaccurate.");
    const details = this._details;
    const md = new MarkdownString(void 0, {
      supportThemeIcons: true,
      isTrusted: typeof details === "object" && details ? details.isTrusted : void 0
    });
    md.appendText(aiNote);
    if (details) {
      md.appendMarkdown("\n\n");
      if (typeof details === "string") {
        md.appendText(details);
      } else {
        md.appendMarkdown(details.value);
      }
    }
    return md;
  }
};
ToolRiskBadgeWidget = __decorateClass([
  __decorateParam(0, IHoverService)
], ToolRiskBadgeWidget);
export {
  ToolRiskBadgeWidget
};
