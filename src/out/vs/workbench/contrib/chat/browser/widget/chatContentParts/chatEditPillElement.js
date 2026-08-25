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
import { StandardMouseEvent } from "../../../../../../base/browser/mouseEvent.js";
import { HoverStyle } from "../../../../../../base/browser/ui/hover/hover.js";
import { HoverPosition } from "../../../../../../base/browser/ui/hover/hoverWidget.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { FileKind } from "../../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { registerOpenEditorListeners } from "../../../../../../platform/editor/browser/editor.js";
import "./media/chatCodeBlockPill.css";
const $ = dom.$;
let ChatEditPillElement = class extends Disposable {
  constructor(labelService, modelService, languageService, hoverService) {
    super();
    this.labelService = labelService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.hoverService = hoverService;
    this._hover = this._register(new MutableDisposable());
    this._statusIconClasses = [];
    this._pillIconClasses = [];
    this._onDidClick = this._register(new Emitter());
    /** Fires when the pill is activated (click / keyboard). Carries the standard open-editor options. */
    this.onDidClick = this._onDidClick.event;
    this._onDidContextMenu = this._register(new Emitter());
    /** Fires on right-click. Subclasses can present a context menu. */
    this.onDidContextMenu = this._onDidContextMenu.event;
    this.element = $("div.chat-codeblock-pill-container");
    this.statusIndicatorContainer = $("div.status-indicator-container");
    this.statusIconEl = $("span.status-icon");
    this.statusLabelEl = $("span.status-label", {}, "");
    this.statusIndicatorContainer.append(this.statusIconEl, this.statusLabelEl);
    this.pillElement = $(".chat-codeblock-pill-widget");
    this.pillElement.tabIndex = 0;
    this.pillElement.classList.add("show-file-icons");
    this.pillElement.role = "button";
    this.progressFillEl = $("span.progress-fill");
    this.fileIconEl = $("span.icon");
    this.fileIconLabelEl = $("span.icon-label", {}, "");
    this.labelDetailEl = $("span.label-detail", {}, "");
    this.pillElement.append(this.progressFillEl, this.fileIconEl, this.fileIconLabelEl, this.labelDetailEl);
    this.element.append(this.statusIndicatorContainer, this.pillElement);
    this._register(registerOpenEditorListeners(this.pillElement, (opts) => this._onDidClick.fire(opts)));
    this._register(dom.addDisposableListener(this.pillElement, dom.EventType.CONTEXT_MENU, (e) => {
      const event = new StandardMouseEvent(dom.getWindow(e), e);
      dom.EventHelper.stop(e, true);
      this._onDidContextMenu.fire(event);
    }));
  }
  get uri() {
    return this._uri;
  }
  /**
   * Renders or updates the file icon + name. Call this whenever the URI
   * changes; also resets the +added / -removed counters since they no
   * longer apply to the previous file.
   */
  setUri(uri) {
    this._uri = uri;
    const iconText = this.labelService.getUriBasenameLabel(uri);
    this.fileIconLabelEl.textContent = iconText;
    const fileKind = uri.path.endsWith("/") ? FileKind.FOLDER : FileKind.FILE;
    this.fileIconEl.classList.remove(...this._pillIconClasses);
    this._pillIconClasses = getIconClasses(this.modelService, this.languageService, uri, fileKind);
    this.fileIconEl.classList.add(...this._pillIconClasses);
    this.setTooltip(this.labelService.getUriLabel(uri, { relative: true }));
  }
  /**
   * Updates the leading status indicator (icon + textual label). Pass
   * `undefined` to clear the icon.
   */
  setStatus(icon, label) {
    this.statusIconEl.classList.remove(...this._statusIconClasses);
    this._statusIconClasses = icon ? ThemeIcon.asClassNameArray(icon) : [];
    if (this._statusIconClasses.length > 0) {
      this.statusIconEl.classList.add(...this._statusIconClasses);
    }
    this.statusLabelEl.textContent = label;
  }
  /**
   * Sets the trailing detail label (e.g. "Generating edits...", "(35%)").
   * Pass an empty string to clear.
   */
  setLabelDetail(text) {
    this.labelDetailEl.textContent = text;
  }
  /**
   * Renders the progress-fill animation behind the pill. `percent` is in
   * the range [0, 100]. Pass `undefined` (or omit) to clear.
   */
  setProgressFill(percent) {
    if (typeof percent === "number") {
      this.progressFillEl.style.width = `${percent}%`;
      this.pillElement.classList.add("progress-filling");
    } else {
      this.progressFillEl.style.width = "0%";
      this.pillElement.classList.remove("progress-filling");
    }
  }
  /**
   * Renders the +added / -removed counters at the trailing end of the pill
   * and sets the aria label to a localized summary. Pass `undefined` to
   * hide the counters.
   */
  setDiff(diff) {
    if (!diff) {
      this._labelAddedEl?.remove();
      this._labelRemovedEl?.remove();
      this._labelAddedEl = void 0;
      this._labelRemovedEl = void 0;
      return;
    }
    if (!this._labelAddedEl) {
      this._labelAddedEl = this.pillElement.appendChild($("span.label-added"));
    }
    if (!this._labelRemovedEl) {
      this._labelRemovedEl = this.pillElement.appendChild($("span.label-removed"));
    }
    this._labelAddedEl.textContent = `+${diff.added}`;
    this._labelRemovedEl.textContent = `-${diff.removed}`;
  }
  /**
   * Sets the screen-reader announcement for the pill.
   */
  setAriaLabel(label) {
    this.element.ariaLabel = label;
  }
  /**
   * Sets the delayed hover tooltip text. Re-using the existing hover binding
   * so subsequent calls just swap the displayed text.
   */
  setTooltip(tooltip) {
    this._tooltip = tooltip;
    if (!this._hover.value) {
      this._hover.value = this.hoverService.setupDelayedHover(this.pillElement, () => ({
        content: this._tooltip,
        style: HoverStyle.Pointer,
        position: { hoverPosition: HoverPosition.BELOW },
        persistence: { hideOnKeyDown: true }
      }));
    }
  }
};
ChatEditPillElement = __decorateClass([
  __decorateParam(0, ILabelService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IHoverService)
], ChatEditPillElement);
async function isResourceContentEmpty(textModelService, uri) {
  try {
    const ref = await textModelService.createModelReference(uri);
    try {
      return ref.object.textEditorModel.getValueLength() === 0;
    } finally {
      ref.dispose();
    }
  } catch {
    return false;
  }
}
export {
  ChatEditPillElement,
  isResourceContentEmpty
};
