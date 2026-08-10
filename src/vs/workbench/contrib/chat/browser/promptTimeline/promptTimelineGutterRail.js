import { $, addDisposableListener, append, clearNode, EventType, getWindow } from "../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { Emitter } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { MIN_HOST_WIDTH } from "./promptTimelineLayout.js";
import "./media/promptTimeline.css";
const MAX_REST_DOTS = 50;
let gutterIdSeq = 0;
class PromptTimelineGutterRail extends Disposable {
  constructor() {
    super();
    this._rowDisposables = this._register(new DisposableStore());
    this._rows = [];
    /** The resting dots, in order; `_dotTicks[i]` is the tick index dot `i` stands for. */
    this._dots = [];
    this._dotTicks = [];
    this._hostWidth = Number.POSITIVE_INFINITY;
    /** Disclosure held open by explicit activation (handle click/tap/keyboard, or a row focused via keyboard). */
    this._open = false;
    /** Pointer is over the rail; reveals the flyout transiently (independent of {@link _open}). */
    this._hovering = false;
    /** Tick index previewed by the dot currently under the pointer, or `-1` when no dot is hovered. */
    this._previewIndex = -1;
    this._onDidSelect = this._register(new Emitter());
    this.onDidSelect = this._onDidSelect.event;
    // The gutter rail lists prompts and jumps to them; it never opens the review drill-down the ruler's hover
    // card offers, so these stay unused. They are kept to satisfy the shared rail contract.
    this._onDidReview = this._register(new Emitter());
    this.onDidReview = this._onDidReview.event;
    this._onDidReviewFile = this._register(new Emitter());
    this.onDidReviewFile = this._onDidReviewFile.event;
    this._domNode = $("nav.prompt-timeline-rail.prompt-timeline-rail-gutter");
    this._domNode.setAttribute("aria-label", localize("promptTimeline.gutter.railLabel", "Prompt timeline"));
    this._domNode.setAttribute("role", "toolbar");
    this._domNode.setAttribute("aria-orientation", "vertical");
    const panelId = `prompt-timeline-gutter-panel-${gutterIdSeq++}`;
    this._rest = append(this._domNode, $("button.prompt-timeline-gutter-rest"));
    this._rest.setAttribute("aria-haspopup", "true");
    this._rest.setAttribute("aria-expanded", "false");
    this._rest.setAttribute("aria-controls", panelId);
    this._rest.setAttribute("aria-label", localize("promptTimeline.gutter.toggleLabel", "Show prompts"));
    this._rest.tabIndex = 0;
    this._list = append(this._domNode, $(".prompt-timeline-gutter-panel"));
    this._list.id = panelId;
    this._register(addDisposableListener(this._domNode, EventType.MOUSE_OVER, () => {
      this._hovering = true;
      this._updateRevealed();
    }));
    this._register(addDisposableListener(this._domNode, EventType.MOUSE_OUT, (e) => {
      if (!this._domNode.contains(e.relatedTarget)) {
        this._hovering = false;
        this._setPreview(-1);
        this._updateRevealed();
      }
    }));
    this._register(addDisposableListener(this._list, EventType.MOUSE_OVER, (e) => {
      const target = e.target;
      const rowIndex = target === null ? -1 : this._rows.findIndex((row) => row.button.contains(target));
      this._setPreview(rowIndex);
    }));
    this._register(Gesture.addTarget(this._rest));
    this._register(addDisposableListener(this._rest, EventType.CLICK, (e) => {
      e.preventDefault();
      this._toggleOpen();
    }));
    this._register(addDisposableListener(this._rest, TouchEventType.Tap, () => this._toggleOpen()));
    this._register(addDisposableListener(this._rest, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) {
        event.preventDefault();
        event.stopPropagation();
        this._toggleOpen();
      }
    }));
    this._register(addDisposableListener(this._list, EventType.KEY_DOWN, (e) => this._onListKeyDown(e)));
    this._register(addDisposableListener(this._domNode, EventType.FOCUS_OUT, (e) => {
      if (!this._domNode.contains(e.relatedTarget)) {
        this._open = false;
        this._updateRevealed();
      }
    }));
  }
  get domNode() {
    return this._domNode;
  }
  /** Reveal whenever the disclosure is open OR the pointer is hovering; keep `aria-expanded` in sync. */
  _updateRevealed() {
    const revealed = this._open || this._hovering;
    this._domNode.classList.toggle("revealed", revealed);
    this._rest.setAttribute("aria-expanded", String(revealed));
  }
  /** Toggle the disclosure via explicit activation: opening focuses a row, closing returns to the handle. */
  _toggleOpen() {
    if (this._open) {
      this._close();
    } else {
      this._open = true;
      this._updateRevealed();
      this._focusActiveRow();
    }
  }
  /** Collapse the disclosure and return focus to the handle (shared close path for activation and Escape). */
  _close() {
    this._open = false;
    this._updateRevealed();
    this._rest.focus();
  }
  _focusActiveRow() {
    const activeIndex = this._rows.findIndex((r) => r.button.tabIndex === 0);
    this._rows[activeIndex >= 0 ? activeIndex : 0]?.button.focus();
  }
  setFilesProvider(_provider) {
  }
  /**
   * Rebuilds the resting handle's dots. There is one dot per prompt up to {@link MAX_REST_DOTS};
   * beyond that the dots are evenly sampled across the session so every dot still stands for a real
   * prompt (and the active prompt always maps to one), with a trailing marker signalling the sampling.
   */
  _renderDots(count) {
    clearNode(this._rest);
    this._dots.length = 0;
    this._dotTicks.length = 0;
    const dots = Math.min(count, MAX_REST_DOTS);
    for (let i = 0; i < dots; i++) {
      const dot = append(this._rest, $(".prompt-timeline-gutter-dot"));
      const tickIndex = dots === count ? i : Math.round(i * (count - 1) / (dots - 1));
      this._dots.push(dot);
      this._dotTicks.push(tickIndex);
      this._rowDisposables.add(addDisposableListener(dot, EventType.MOUSE_OVER, () => this._setPreview(tickIndex)));
    }
    if (count > MAX_REST_DOTS) {
      append(this._rest, $(".prompt-timeline-gutter-dot-more"));
    }
  }
  /** Previews the prompt a hovered dot stands for by highlighting its row and scrolling it into view. */
  _setPreview(index) {
    if (this._previewIndex === index) {
      return;
    }
    this._previewIndex = index;
    for (let i = 0; i < this._rows.length; i++) {
      this._rows[i].button.classList.toggle("preview", i === index);
    }
    const previewDot = this._findNearestDotIndex(index);
    for (let i = 0; i < this._dots.length; i++) {
      this._dots[i].classList.toggle("preview", i === previewDot);
    }
    if (index >= 0) {
      this._revealRow(index);
    }
  }
  _findNearestDotIndex(tickIndex) {
    if (tickIndex < 0) {
      return -1;
    }
    let nearestDot = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this._dotTicks.length; i++) {
      const delta = Math.abs(this._dotTicks[i] - tickIndex);
      if (delta < bestDelta) {
        bestDelta = delta;
        nearestDot = i;
      }
    }
    return nearestDot;
  }
  /**
   * Scrolls a row into view inside the flyout. Done by hand rather than with `scrollIntoView` so a
   * hover can never scroll the transcript (or any other ancestor) behind the rail.
   */
  _revealRow(index) {
    const button = this._rows[index]?.button;
    if (!button) {
      return;
    }
    const top = button.offsetTop;
    const bottom = top + button.offsetHeight;
    const viewTop = this._list.scrollTop;
    const viewBottom = viewTop + this._list.clientHeight;
    if (top < viewTop) {
      this._list.scrollTop = top;
    } else if (bottom > viewBottom) {
      this._list.scrollTop = bottom - this._list.clientHeight;
    }
  }
  setTicks(ticks) {
    const sameStructure = ticks.length === this._rows.length && ticks.every((t, i) => this._rows[i]?.tick.requestId === t.requestId);
    if (sameStructure) {
      for (let i = 0; i < ticks.length; i++) {
        this._renderRow(this._rows[i], ticks[i]);
      }
      this._updateActiveClasses();
      return;
    }
    this._rowDisposables.clear();
    this._rows.length = 0;
    this._previewIndex = -1;
    clearNode(this._list);
    this._renderDots(ticks.length);
    for (const tick of ticks) {
      const button = append(this._list, $("button.prompt-timeline-gutter-row"));
      button.tabIndex = -1;
      const label = append(button, $("span.prompt-timeline-gutter-row-label"));
      const stat = append(button, $("span.prompt-timeline-gutter-row-stat"));
      const entry = { tick, button, label, stat };
      this._renderRow(entry, tick);
      const requestId = tick.requestId;
      this._rowDisposables.add(addDisposableListener(button, EventType.CLICK, () => {
        this._onDidSelect.fire(requestId);
        this._close();
      }));
      this._rowDisposables.add(addDisposableListener(button, EventType.FOCUS, () => {
        this._open = true;
        this._updateRevealed();
        this._updateTabStops(this._rows.indexOf(entry));
      }));
      this._rows.push(entry);
    }
    const activeIndex = this._rows.findIndex((r) => r.tick.requestId === this._activeRequestId);
    this._updateTabStops(activeIndex >= 0 ? activeIndex : 0);
    this._updateActiveClasses();
  }
  _renderRow(entry, tick) {
    entry.tick = tick;
    entry.button.setAttribute("aria-label", tick.ariaLabel);
    entry.label.textContent = tick.text;
    entry.label.title = tick.text;
    this._renderStat(entry.stat, tick.stat);
  }
  _renderStat(container, stat) {
    clearNode(container);
    if (!stat || stat.added + stat.removed === 0) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    append(container, $("span.added")).textContent = `+${stat.added}`;
    append(container, $("span.removed")).textContent = `\u2212${stat.removed}`;
  }
  /** Roving tabindex: exactly one row is tabbable so the flyout is a single Tab stop. */
  _updateTabStops(focusIndex) {
    for (let i = 0; i < this._rows.length; i++) {
      this._rows[i].button.tabIndex = i === focusIndex ? 0 : -1;
    }
  }
  _onListKeyDown(e) {
    if (this._rows.length === 0) {
      return;
    }
    const event = new StandardKeyboardEvent(e);
    if (event.keyCode === KeyCode.Escape) {
      event.preventDefault();
      event.stopPropagation();
      this._close();
      return;
    }
    const currentIndex = this._rows.findIndex((r) => r.button === getWindow(this._domNode).document.activeElement);
    let nextIndex;
    switch (event.keyCode) {
      case KeyCode.DownArrow:
        nextIndex = Math.min(this._rows.length - 1, currentIndex + 1);
        break;
      case KeyCode.UpArrow:
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case KeyCode.Home:
        nextIndex = 0;
        break;
      case KeyCode.End:
        nextIndex = this._rows.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._updateTabStops(nextIndex);
    this._rows[nextIndex]?.button.focus();
  }
  setActive(requestId) {
    this._activeRequestId = requestId;
    this._updateActiveClasses();
  }
  _updateActiveClasses() {
    let activeIndex = -1;
    for (let i = 0; i < this._rows.length; i++) {
      const row = this._rows[i];
      const active = this._activeRequestId !== void 0 && (row.tick.requestId === this._activeRequestId || row.tick.allRequestIds.includes(this._activeRequestId));
      if (active) {
        activeIndex = i;
      }
      row.button.classList.toggle("active", active);
      if (active) {
        row.button.setAttribute("aria-current", "location");
      } else {
        row.button.removeAttribute("aria-current");
      }
    }
    this._updateActiveDot(activeIndex);
  }
  /**
   * Accents the dot standing for the prompt the transcript is scrolled to, so the resting handle
   * reads as a "you are here" and tracks scrolling. Once the dots are sampled
   * ({@link MAX_REST_DOTS}) the nearest dot stands in for the active prompt.
   */
  _updateActiveDot(activeIndex) {
    const activeDot = activeIndex >= 0 ? this._findNearestDotIndex(activeIndex) : -1;
    for (let i = 0; i < this._dots.length; i++) {
      this._dots[i].classList.toggle("active", i === activeDot);
    }
  }
  focusTick(requestId) {
    this._rows.find((r) => r.tick.requestId === requestId || r.tick.allRequestIds.includes(requestId))?.button.focus();
  }
  setHostWidth(width) {
    if (width > 0 && width !== this._hostWidth) {
      this._hostWidth = width;
      this._domNode.classList.toggle("overflowing", width < MIN_HOST_WIDTH);
    }
  }
  // The ruler blooms its fan on a hard scroll and scatters marks by scroll position; the gutter rail is a
  // static, evenly-spaced list, so both are intentionally no-ops.
  notifyHardWheel() {
  }
  setScrollLayout(_layout) {
  }
}
export {
  PromptTimelineGutterRail
};
