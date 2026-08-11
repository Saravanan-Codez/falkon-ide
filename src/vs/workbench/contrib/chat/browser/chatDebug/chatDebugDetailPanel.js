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
import * as DOM from "../../../../../base/browser/dom.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { Orientation, Sash, SashState } from "../../../../../base/browser/ui/sash/sash.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IChatDebugService } from "../../common/chatDebugService.js";
import { formatEventDetail } from "./chatDebugEventDetailRenderer.js";
import { renderCustomizationDiscoveryContent, fileListToPlainText, renderCustomizationSummaryContent, customizationSummaryToPlainText } from "./chatCustomizationDiscoveryRenderer.js";
import { renderUserMessageContent, renderAgentResponseContent, messageEventToPlainText, renderResolvedMessageContent, resolvedMessageToPlainText } from "./chatDebugMessageContentRenderer.js";
import { renderToolCallContent, toolCallContentToPlainText } from "./chatDebugToolCallContentRenderer.js";
import { renderModelTurnContent, modelTurnContentToPlainText } from "./chatDebugModelTurnContentRenderer.js";
import { renderHookContent, hookContentToPlainText } from "./chatDebugHookContentRenderer.js";
const $ = DOM.$;
const DETAIL_PANEL_DEFAULT_WIDTH = 350;
const DETAIL_PANEL_MIN_WIDTH = 200;
const DETAIL_PANEL_MAX_WIDTH = 800;
let ChatDebugDetailPanel = class extends Disposable {
  constructor(parent, chatDebugService, instantiationService, editorService, clipboardService, hoverService, openerService, languageService) {
    super();
    this.chatDebugService = chatDebugService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.clipboardService = clipboardService;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.languageService = languageService;
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this._onDidChangeWidth = this._register(new Emitter());
    this.onDidChangeWidth = this._onDidChangeWidth.event;
    this.detailDisposables = this._register(new DisposableStore());
    this.currentDetailText = "";
    this._width = DETAIL_PANEL_DEFAULT_WIDTH;
    this.element = DOM.append(parent, $(".chat-debug-detail-panel"));
    this.contentContainer = $(".chat-debug-detail-content");
    this.scrollable = this._register(new DomScrollableElement(this.contentContainer, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto
    }));
    this.element.style.width = `${this._width}px`;
    DOM.hide(this.element);
    this.sash = this._register(new Sash(parent, {
      getVerticalSashLeft: () => parent.offsetWidth - this._width
    }, { orientation: Orientation.VERTICAL }));
    this.sash.state = SashState.Disabled;
    let sashStartWidth;
    this._register(this.sash.onDidStart(() => sashStartWidth = this._width));
    this._register(this.sash.onDidEnd(() => {
      sashStartWidth = void 0;
      this.sash.layout();
    }));
    this._register(this.sash.onDidChange((e) => {
      if (sashStartWidth === void 0) {
        return;
      }
      const delta = e.startX - e.currentX;
      const newWidth = Math.max(DETAIL_PANEL_MIN_WIDTH, Math.min(DETAIL_PANEL_MAX_WIDTH, sashStartWidth + delta));
      this._width = newWidth;
      this.element.style.width = `${newWidth}px`;
      this.sash.layout();
      this._onDidChangeWidth.fire(newWidth);
    }));
    this._register(DOM.addDisposableListener(this.element, DOM.EventType.KEY_DOWN, (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        const target = e.target;
        if (target && this.element.contains(target)) {
          e.preventDefault();
          const targetWindow = DOM.getWindow(target);
          const selection = targetWindow.getSelection();
          if (selection) {
            const range = targetWindow.document.createRange();
            range.selectNodeContents(target);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    }));
  }
  get width() {
    return this._width;
  }
  async show(event) {
    if (event.id && event.id === this.currentDetailEventId) {
      return;
    }
    this.currentDetailEventId = event.id;
    const resolved = event.id ? await this.chatDebugService.resolveEvent(event.id) : void 0;
    DOM.show(this.element);
    this.sash.state = SashState.Enabled;
    this.sash.layout();
    DOM.clearNode(this.element);
    DOM.clearNode(this.contentContainer);
    this.detailDisposables.clear();
    const header = DOM.append(this.element, $(".chat-debug-detail-header"));
    this.headerElement = header;
    this.element.appendChild(this.scrollable.getDomNode());
    const fullScreenButton = this.detailDisposables.add(new Button(header, { ariaLabel: localize("chatDebug.openInEditor", "Open in Editor"), title: localize("chatDebug.openInEditor", "Open in Editor") }));
    fullScreenButton.element.classList.add("chat-debug-detail-button");
    fullScreenButton.icon = Codicon.goToFile;
    this.firstFocusableElement = fullScreenButton.element;
    this.detailDisposables.add(fullScreenButton.onDidClick(() => {
      this.editorService.openEditor({ contents: this.currentDetailText, resource: void 0 });
    }));
    const copyButton = this.detailDisposables.add(new Button(header, { ariaLabel: localize("chatDebug.copyToClipboard", "Copy"), title: localize("chatDebug.copyToClipboard", "Copy") }));
    copyButton.element.classList.add("chat-debug-detail-button");
    copyButton.icon = Codicon.copy;
    this.detailDisposables.add(copyButton.onDidClick(() => {
      this.clipboardService.writeText(this.currentDetailText);
    }));
    const closeButton = this.detailDisposables.add(new Button(header, { ariaLabel: localize("chatDebug.closeDetail", "Close"), title: localize("chatDebug.closeDetail", "Close") }));
    closeButton.element.classList.add("chat-debug-detail-button");
    closeButton.icon = Codicon.close;
    this.detailDisposables.add(closeButton.onDidClick(() => {
      this.hide();
    }));
    if (resolved && resolved.kind === "fileList") {
      this.currentDetailText = fileListToPlainText(resolved);
      const { element: contentEl, disposables: contentDisposables } = this.instantiationService.invokeFunction(
        (accessor) => renderCustomizationDiscoveryContent(resolved, this.openerService, accessor.get(IModelService), this.languageService, this.hoverService, accessor.get(ILabelService), this.scrollable)
      );
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (resolved && resolved.kind === "customizationSummary") {
      this.currentDetailText = customizationSummaryToPlainText(resolved);
      const { element: contentEl, disposables: contentDisposables } = this.instantiationService.invokeFunction(
        (accessor) => renderCustomizationSummaryContent(resolved, this.openerService, accessor.get(IModelService), this.languageService, this.hoverService, accessor.get(ILabelService), this.scrollable)
      );
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (resolved && resolved.kind === "toolCall") {
      this.currentDetailText = toolCallContentToPlainText(resolved);
      const { element: contentEl, disposables: contentDisposables } = await renderToolCallContent(resolved, this.languageService, this.clipboardService, this.scrollable);
      if (this.currentDetailEventId !== event.id) {
        contentDisposables.dispose();
        return;
      }
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (resolved && resolved.kind === "message") {
      this.currentDetailText = resolvedMessageToPlainText(resolved);
      const { element: contentEl, disposables: contentDisposables } = await renderResolvedMessageContent(resolved, this.languageService, this.clipboardService, this.scrollable);
      if (this.currentDetailEventId !== event.id) {
        contentDisposables.dispose();
        return;
      }
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (resolved && resolved.kind === "modelTurn") {
      this.currentDetailText = modelTurnContentToPlainText(resolved);
      const { element: contentEl, disposables: contentDisposables } = await renderModelTurnContent(resolved, this.languageService, this.clipboardService, this.scrollable);
      if (this.currentDetailEventId !== event.id) {
        contentDisposables.dispose();
        return;
      }
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (resolved && resolved.kind === "hook") {
      this.currentDetailText = hookContentToPlainText(resolved);
      const { element: contentEl, disposables: contentDisposables } = await renderHookContent(resolved, this.languageService, this.clipboardService, this.scrollable);
      if (this.currentDetailEventId !== event.id) {
        contentDisposables.dispose();
        return;
      }
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (event.kind === "userMessage") {
      this.currentDetailText = messageEventToPlainText(event);
      const { element: contentEl, disposables: contentDisposables } = await renderUserMessageContent(event, this.languageService, this.clipboardService, this.scrollable);
      if (this.currentDetailEventId !== event.id) {
        contentDisposables.dispose();
        return;
      }
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else if (event.kind === "agentResponse") {
      this.currentDetailText = messageEventToPlainText(event);
      const { element: contentEl, disposables: contentDisposables } = await renderAgentResponseContent(event, this.languageService, this.clipboardService, this.scrollable);
      if (this.currentDetailEventId !== event.id) {
        contentDisposables.dispose();
        return;
      }
      this.detailDisposables.add(contentDisposables);
      this.contentContainer.appendChild(contentEl);
    } else {
      const pre = DOM.append(this.contentContainer, $("pre"));
      pre.tabIndex = 0;
      if (resolved) {
        this.currentDetailText = resolved.value;
      } else {
        this.currentDetailText = formatEventDetail(event);
      }
      pre.textContent = this.currentDetailText;
    }
    const parentHeight = this.element.parentElement?.clientHeight ?? 0;
    if (parentHeight > 0) {
      this.layout(parentHeight);
    } else {
      this.scrollable.scanDomNode();
    }
  }
  get isVisible() {
    return this.element.style.display !== "none";
  }
  focus() {
    this.firstFocusableElement?.focus();
  }
  /**
   * Set explicit dimensions on the scrollable element so the scrollbar
   * can compute its size. Call after the panel is shown and whenever
   * the available space changes.
   */
  layout(height) {
    const headerHeight = this.headerElement?.offsetHeight ?? 0;
    const scrollableHeight = Math.max(0, height - headerHeight);
    const scrollPos = this.scrollable.getScrollPosition();
    this.contentContainer.style.height = `${scrollableHeight}px`;
    this.scrollable.scanDomNode();
    this.scrollable.setScrollPosition({ scrollTop: scrollPos.scrollTop });
    this.sash.layout();
  }
  layoutSash() {
    this.sash.layout();
  }
  hide() {
    this.currentDetailEventId = void 0;
    this.firstFocusableElement = void 0;
    this.headerElement = void 0;
    DOM.hide(this.element);
    this.sash.state = SashState.Disabled;
    DOM.clearNode(this.element);
    DOM.clearNode(this.contentContainer);
    this.detailDisposables.clear();
    this._onDidHide.fire();
  }
};
ChatDebugDetailPanel = __decorateClass([
  __decorateParam(1, IChatDebugService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IClipboardService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, ILanguageService)
], ChatDebugDetailPanel);
export {
  ChatDebugDetailPanel
};
