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
import * as dom from "../../../../base/browser/dom.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ResizableHTMLElement } from "../../../../base/browser/ui/resizable/resizable.js";
import * as nls from "../../../../nls.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
function canExpandCompletionItem(item) {
  return !!item && Boolean(item.completion.documentation || item.completion.detail && item.completion.detail !== item.completion.label);
}
const SuggestDetailsClassName = "suggest-details";
var SimpleSuggestDetailsPlacement = /* @__PURE__ */ ((SimpleSuggestDetailsPlacement2) => {
  SimpleSuggestDetailsPlacement2[SimpleSuggestDetailsPlacement2["East"] = 0] = "East";
  SimpleSuggestDetailsPlacement2[SimpleSuggestDetailsPlacement2["West"] = 1] = "West";
  SimpleSuggestDetailsPlacement2[SimpleSuggestDetailsPlacement2["South"] = 2] = "South";
  SimpleSuggestDetailsPlacement2[SimpleSuggestDetailsPlacement2["North"] = 3] = "North";
  return SimpleSuggestDetailsPlacement2;
})(SimpleSuggestDetailsPlacement || {});
let SimpleSuggestDetailsWidget = class {
  constructor(_getFontInfo, onDidFontInfoChange, _getAdvancedExplainModeDetails, instaService, markdownRendererService) {
    this._getFontInfo = _getFontInfo;
    this._getAdvancedExplainModeDetails = _getAdvancedExplainModeDetails;
    this.markdownRendererService = markdownRendererService;
    this._onDidClose = new Emitter();
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeContents = new Emitter();
    this.onDidChangeContents = this._onDidChangeContents.event;
    this._disposables = new DisposableStore();
    this._renderDisposeable = this._disposables.add(new DisposableStore());
    this._borderWidth = 1;
    this._size = new dom.Dimension(330, 0);
    this.domNode = dom.$(".suggest-details");
    this.domNode.classList.add("no-docs");
    this._body = dom.$(".body");
    this._scrollbar = new DomScrollableElement(this._body, {
      alwaysConsumeMouseWheel: true
    });
    dom.append(this.domNode, this._scrollbar.getDomNode());
    this._disposables.add(this._scrollbar);
    this._header = dom.append(this._body, dom.$(".header"));
    this._close = dom.append(this._header, dom.$("span" + ThemeIcon.asCSSSelector(Codicon.close)));
    this._close.title = nls.localize("details.close", "Close");
    this._close.role = "button";
    this._close.tabIndex = -1;
    this._type = dom.append(this._header, dom.$("p.type"));
    this._docs = dom.append(this._body, dom.$("p.docs"));
    this._configureFont();
    this._disposables.add(onDidFontInfoChange(() => this._configureFont()));
  }
  _configureFont() {
    const fontInfo = this._getFontInfo();
    const fontFamily = fontInfo.fontFamily;
    const fontSize = fontInfo.fontSize;
    const lineHeight = fontInfo.lineHeight;
    const fontWeight = fontInfo.fontWeight;
    const fontSizePx = `${fontSize}px`;
    const lineHeightPx = `${lineHeight}px`;
    this.domNode.style.fontSize = fontSizePx;
    this.domNode.style.lineHeight = `${lineHeight / fontSize}`;
    this.domNode.style.fontWeight = fontWeight;
    this._type.style.fontFamily = fontFamily;
    this._close.style.height = lineHeightPx;
    this._close.style.width = lineHeightPx;
  }
  dispose() {
    this._disposables.dispose();
    this._onDidClose.dispose();
    this._onDidChangeContents.dispose();
  }
  getLayoutInfo() {
    const lineHeight = this._getFontInfo().lineHeight;
    const borderWidth = this._borderWidth;
    const borderHeight = borderWidth * 2;
    return {
      lineHeight,
      borderWidth,
      borderHeight,
      verticalPadding: 22,
      horizontalPadding: 14
    };
  }
  renderLoading() {
    this._type.textContent = nls.localize("loading", "Loading...");
    this._docs.textContent = "";
    this.domNode.classList.remove("no-docs", "no-type");
    this.layout(this.size.width, this.getLayoutInfo().lineHeight * 2);
    this._onDidChangeContents.fire(this);
  }
  renderItem(item, explainMode) {
    this._renderDisposeable.clear();
    let { detail, documentation } = item.completion;
    let md = "";
    if (explainMode) {
      md += `score: ${item.score[0]}
`;
      md += `prefix: ${item.word ?? "(no prefix)"}
`;
      const vs = item.completion.replacementRange;
      md += `valueSelection: ${vs ? `[${vs[0]}, ${vs[1]}]` : "undefined"}
`;
      md += `index: ${item.idx}
`;
      if (this._getAdvancedExplainModeDetails) {
        const advancedDetails = this._getAdvancedExplainModeDetails();
        if (advancedDetails) {
          md += `${advancedDetails}
`;
        }
      }
      detail = `Provider: ${item.completion.provider}`;
      documentation = new MarkdownString().appendCodeblock("empty", md);
    }
    const hasDetail = typeof detail === "string" ? detail.trim().length > 0 : !!detail;
    const hasDocs = typeof documentation === "string" ? documentation.trim().length > 0 : !!(documentation && documentation.value?.trim().length > 0);
    const updateSize = () => {
      this.layout(this._size.width, this._type.clientHeight + this._docs.clientHeight);
      this._onDidChangeContents.fire(this);
    };
    if (!explainMode && (!canExpandCompletionItem(item) || !hasDetail && !hasDocs)) {
      this.clearContents();
      return;
    }
    this.domNode.classList.remove("no-docs", "no-type");
    if (hasDetail && detail) {
      const cappedDetail = detail.length > 1e5 ? `${detail.substr(0, 1e5)}\u2026` : detail;
      this._type.textContent = cappedDetail;
      this._type.title = cappedDetail;
      dom.show(this._type);
      this._type.classList.toggle("auto-wrap", !/\r?\n^\s+/gmi.test(cappedDetail));
    } else {
      dom.clearNode(this._type);
      this._type.title = "";
      dom.hide(this._type);
      this.domNode.classList.add("no-type");
    }
    dom.clearNode(this._docs);
    if (hasDocs && typeof documentation === "string") {
      this._docs.classList.remove("markdown-docs");
      this._docs.textContent = documentation;
    } else if (hasDocs && documentation && typeof documentation !== "string") {
      this._docs.classList.add("markdown-docs");
      dom.clearNode(this._docs);
      const renderedContents = this.markdownRendererService.render(documentation, {
        asyncRenderCallback: () => {
          updateSize();
        }
      });
      this._docs.appendChild(renderedContents.element);
      this._renderDisposeable.add(renderedContents);
    } else {
      this._docs.classList.remove("markdown-docs");
    }
    this.domNode.classList.toggle("detail-and-doc", hasDetail && hasDocs);
    this.domNode.style.userSelect = "text";
    this.domNode.tabIndex = -1;
    this._close.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    this._close.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._onDidClose.fire();
    };
    this._body.scrollTop = 0;
    updateSize();
  }
  clearContents() {
    this.domNode.classList.add("no-docs");
    this._type.textContent = "";
    this._docs.textContent = "";
  }
  get isEmpty() {
    return this.domNode.classList.contains("no-docs");
  }
  get size() {
    return this._size;
  }
  layout(width, height) {
    const newSize = new dom.Dimension(width, height);
    if (!dom.Dimension.equals(newSize, this._size)) {
      this._size = newSize;
      dom.size(this.domNode, width, height);
    }
    this._scrollbar.scanDomNode();
  }
  scrollDown(much = 8) {
    this._body.scrollTop += much;
  }
  scrollUp(much = 8) {
    this._body.scrollTop -= much;
  }
  scrollTop() {
    this._body.scrollTop = 0;
  }
  scrollBottom() {
    this._body.scrollTop = this._body.scrollHeight;
  }
  pageDown() {
    this.scrollDown(80);
  }
  pageUp() {
    this.scrollUp(80);
  }
  set borderWidth(width) {
    this._borderWidth = width;
  }
  get borderWidth() {
    return this._borderWidth;
  }
  focus() {
    this.domNode.focus();
  }
};
SimpleSuggestDetailsWidget = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IMarkdownRendererService)
], SimpleSuggestDetailsWidget);
class SimpleSuggestDetailsOverlay {
  constructor(widget, _container, preventPlacements) {
    this.widget = widget;
    this._container = _container;
    this._disposables = new DisposableStore();
    this._added = false;
    this._resizable = this._disposables.add(new ResizableHTMLElement());
    this._resizable.domNode.classList.add("suggest-details-container");
    this._resizable.domNode.appendChild(widget.domNode);
    this._resizable.enableSashes(false, true, true, false);
    this._preventPlacements = preventPlacements && preventPlacements.length ? new Set(preventPlacements) : void 0;
    let topLeftNow;
    let sizeNow;
    let deltaTop = 0;
    let deltaLeft = 0;
    this._disposables.add(this._resizable.onDidWillResize(() => {
      topLeftNow = this._topLeft;
      sizeNow = this._resizable.size;
    }));
    this._disposables.add(this._resizable.onDidResize((e) => {
      if (topLeftNow && sizeNow) {
        this.widget.layout(e.dimension.width, e.dimension.height);
        let updateTopLeft = false;
        if (e.west) {
          deltaLeft = sizeNow.width - e.dimension.width;
          updateTopLeft = true;
        }
        if (e.north) {
          deltaTop = sizeNow.height - e.dimension.height;
          updateTopLeft = true;
        }
        if (updateTopLeft) {
          this._applyTopLeft({
            top: topLeftNow.top + deltaTop,
            left: topLeftNow.left + deltaLeft
          });
        }
      }
      if (e.done) {
        topLeftNow = void 0;
        sizeNow = void 0;
        deltaTop = 0;
        deltaLeft = 0;
        this._userSize = e.dimension;
      }
    }));
    this._disposables.add(this.widget.onDidChangeContents(() => {
      if (this._anchorBox) {
        this._placeAtAnchor(this._anchorBox, this._userSize ?? this.widget.size);
      }
    }));
  }
  dispose() {
    this.widget.dispose();
    this._disposables.dispose();
    this.hide();
  }
  getId() {
    return "suggest.details";
  }
  getDomNode() {
    return this._resizable.domNode;
  }
  show() {
    if (!this._added) {
      this._container.appendChild(this._resizable.domNode);
      this._added = true;
    }
  }
  hide(sessionEnded = false) {
    this._resizable.clearSashHoverState();
    if (this._added) {
      this._container.removeChild(this._resizable.domNode);
      this._added = false;
      this._anchorBox = void 0;
    }
    if (sessionEnded) {
      this._userSize = void 0;
      this.widget.clearContents();
    }
  }
  placeAtAnchor(anchor) {
    const anchorBox = anchor.getBoundingClientRect();
    this._anchorBox = anchorBox;
    this.widget.layout(this._resizable.size.width, this._resizable.size.height);
    this._placeAtAnchor(this._anchorBox, this._userSize ?? this.widget.size);
  }
  _placeAtAnchor(anchorBox, size) {
    const bodyBox = dom.getClientArea(this.getDomNode().ownerDocument.body);
    const info = this.widget.getLayoutInfo();
    const defaultMinSize = new dom.Dimension(220, 2 * info.lineHeight);
    const defaultTop = anchorBox.top;
    const eastPlacement = (function() {
      const width = bodyBox.width - (anchorBox.left + anchorBox.width + info.borderWidth + info.horizontalPadding);
      const left2 = -info.borderWidth + anchorBox.left + anchorBox.width;
      const maxSizeTop = new dom.Dimension(width, bodyBox.height - anchorBox.top - info.borderHeight - info.verticalPadding);
      const maxSizeBottom = maxSizeTop.with(void 0, anchorBox.top + anchorBox.height - info.borderHeight - info.verticalPadding);
      return { top: defaultTop, left: left2, fit: width - size.width, maxSizeTop, maxSizeBottom, minSize: defaultMinSize.with(Math.min(width, defaultMinSize.width)) };
    })();
    const westPlacement = (function() {
      const width = anchorBox.left - info.borderWidth - info.horizontalPadding;
      const left2 = Math.max(info.horizontalPadding, anchorBox.left - size.width - info.borderWidth);
      const maxSizeTop = new dom.Dimension(width, bodyBox.height - anchorBox.top - info.borderHeight - info.verticalPadding);
      const maxSizeBottom = maxSizeTop.with(void 0, anchorBox.top + anchorBox.height - info.borderHeight - info.verticalPadding);
      return { top: defaultTop, left: left2, fit: width - size.width, maxSizeTop, maxSizeBottom, minSize: defaultMinSize.with(Math.min(width, defaultMinSize.width)) };
    })();
    const southPlacement = (function() {
      const left2 = anchorBox.left;
      const top2 = -info.borderWidth + anchorBox.top + anchorBox.height;
      const maxSizeBottom = new dom.Dimension(anchorBox.width - info.borderHeight, bodyBox.height - anchorBox.top - anchorBox.height - info.verticalPadding);
      return { top: top2, left: left2, fit: maxSizeBottom.height - size.height, maxSizeBottom, maxSizeTop: maxSizeBottom, minSize: defaultMinSize.with(maxSizeBottom.width) };
    })();
    const northPlacement = (function() {
      const width = Math.max(anchorBox.width - info.borderHeight, 0);
      const left2 = anchorBox.left;
      const maxHeightAbove = Math.max(anchorBox.top - info.verticalPadding, 0);
      const heightForTop = Math.min(size.height, maxHeightAbove);
      const top2 = anchorBox.top - info.borderWidth - heightForTop;
      const maxSize2 = new dom.Dimension(width, Math.max(maxHeightAbove, 0));
      return { top: top2, left: left2, fit: maxSize2.height - size.height, maxSizeTop: maxSize2, maxSizeBottom: maxSize2, minSize: defaultMinSize.with(maxSize2.width) };
    })();
    const placementEntries = [
      [0 /* East */, eastPlacement],
      [2 /* South */, southPlacement],
      [3 /* North */, northPlacement],
      [1 /* West */, westPlacement]
    ];
    const orientations = (this._preventPlacements ? placementEntries.filter(([direction]) => !this._preventPlacements.has(direction)) : placementEntries).map(([, entry]) => entry);
    const candidates = orientations.length ? orientations : placementEntries.map(([, entry]) => entry);
    const placement = candidates.find((p) => p.fit >= 0) ?? candidates.reduce((best, current) => !best || current.fit > best.fit ? current : best, void 0) ?? eastPlacement;
    const bottom = anchorBox.top + anchorBox.height - info.borderHeight;
    let alignAtTop;
    let height = size.height;
    const maxHeight = Math.max(placement.maxSizeTop.height, placement.maxSizeBottom.height);
    if (height > maxHeight) {
      height = maxHeight;
    }
    let maxSize;
    if (height <= placement.maxSizeTop.height) {
      alignAtTop = true;
      maxSize = placement.maxSizeTop;
    } else {
      alignAtTop = false;
      maxSize = placement.maxSizeBottom;
    }
    let { top, left } = placement;
    if (!alignAtTop && height > anchorBox.height) {
      top = bottom - height;
    }
    const editorDomNode = this._container;
    if (editorDomNode) {
      const editorBoundingBox = editorDomNode.getBoundingClientRect();
      top -= editorBoundingBox.top;
      left -= editorBoundingBox.left;
    }
    this._applyTopLeft({ left, top });
    this._resizable.enableSashes(!alignAtTop, placement === eastPlacement, alignAtTop, placement !== eastPlacement);
    this._resizable.minSize = placement.minSize;
    this._resizable.maxSize = maxSize;
    this._resizable.layout(height, Math.min(maxSize.width, size.width));
    this.widget.layout(this._resizable.size.width, this._resizable.size.height);
  }
  _applyTopLeft(topLeft) {
    this._topLeft = topLeft;
    this._resizable.domNode.style.top = `${topLeft.top}px`;
    this._resizable.domNode.style.left = `${topLeft.left}px`;
    this._resizable.domNode.style.position = "absolute";
  }
}
export {
  SimpleSuggestDetailsOverlay,
  SimpleSuggestDetailsPlacement,
  SimpleSuggestDetailsWidget,
  SuggestDetailsClassName,
  canExpandCompletionItem
};
