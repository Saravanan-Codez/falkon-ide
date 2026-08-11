import { $, addDisposableListener, append, clearNode, EventType, getWindow, scheduleAtNextAnimationFrame } from "../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { Emitter } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { PromptTimelineCard } from "./promptTimelineCard.js";
import { MIN_HOST_WIDTH, spaceMarkCenters } from "./promptTimelineLayout.js";
import "./media/promptTimeline.css";
const MIN_TARGET = 24;
const RELAYOUT_MIN_DELTA = 0.5;
const FAN_SIGMA = 40;
const FAN_SPREAD = 14;
const FAN_LINGER = 2e3;
const HARD_WHEEL_REVEAL_WINDOW = 200;
const PILL_LAYOUT = "even";
const EVEN_PILL_SPACING = 26;
class PromptTimelineRulerRail extends Disposable {
  constructor() {
    super();
    this._markDisposables = this._register(new DisposableStore());
    this._marks = [];
    /** Delays enabling the glide until after a structural rebuild's first layout, so freshly created marks don't slide in from the top. */
    this._glideEnabler = this._register(new MutableDisposable());
    this._resizeObserverReady = false;
    this._hostWidth = Number.POSITIVE_INFINITY;
    /** Cached rail height; only changes on resize (observed), so we avoid reading it — a forced reflow — on every scroll. */
    this._railHeight = 0;
    /** Coalesces scroll-driven relayouts to one per animation frame. */
    this._relayoutScheduled = this._register(new MutableDisposable());
    /** Cached top (client px) of the marks column, captured on pointer-enter so the fan can follow the cursor without a per-move reflow. */
    this._laneTop = 0;
    /** True while the pointer is over the lane (keeps the fan open; the linger only collapses once it leaves). */
    this._hovering = false;
    /** Timestamp (ms) of the last hard/fast wheel flick; the fan blooms only if a real scroll follows it within {@link HARD_WHEEL_REVEAL_WINDOW}. */
    this._hardWheelAt = 0;
    /** Collapses the fan {@link FAN_LINGER}ms after the last scroll, unless the pointer is keeping it open. */
    this._fanHide = this._register(new MutableDisposable());
    /** Timestamp (ms) of the last scroll/leave that should keep the fan up; the linger timer re-checks this instead of being churned every scroll frame. */
    this._lastFanActivityAt = 0;
    /** When the user prefers reduced motion the fan is disabled (marks stay their calm rest size). */
    this._reducedMotion = false;
    /** True while keyboard focus is inside the rail: the marks stay revealed (`:focus-within`) but the fisheye is suppressed. */
    this._focused = false;
    this._onDidSelect = this._register(new Emitter());
    this.onDidSelect = this._onDidSelect.event;
    this._onDidReview = this._register(new Emitter());
    this.onDidReview = this._onDidReview.event;
    this._onDidReviewFile = this._register(new Emitter());
    this.onDidReviewFile = this._onDidReviewFile.event;
    this._domNode = $("nav.prompt-timeline-rail.prompt-timeline-rail-ruler");
    this._domNode.setAttribute("aria-label", localize("promptTimeline.railLabel", "Prompt timeline"));
    this._domNode.setAttribute("role", "toolbar");
    this._domNode.setAttribute("aria-orientation", "vertical");
    this._marksContainer = append(this._domNode, $(".prompt-timeline-ruler-marks"));
    this._card = this._register(new PromptTimelineCard(this._domNode));
    this._register(this._card.onDidReview((tick) => this._onDidReview.fire(tick)));
    this._register(this._card.onDidReviewFile((e) => this._onDidReviewFile.fire(e)));
    this._register(addDisposableListener(this._marksContainer, EventType.KEY_DOWN, (e) => this._onMarksKeyDown(e)));
    this._register(addDisposableListener(this._marksContainer, EventType.MOUSE_ENTER, (e) => {
      this._laneTop = this._laneTopNow();
      this._hovering = true;
      this._fanHide.clear();
      this._engage(e.clientY - this._laneTop);
    }));
    this._register(addDisposableListener(this._marksContainer, EventType.MOUSE_MOVE, (e) => {
      this._hovering = true;
      this._engage(e.clientY - this._laneTop);
    }));
    this._register(addDisposableListener(this._marksContainer, EventType.MOUSE_LEAVE, () => {
      this._hovering = false;
      this._scheduleFanHide();
    }));
    const win = getWindow(this._domNode);
    const reducedMotionQuery = win.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reducedMotionQuery) {
      this._reducedMotion = reducedMotionQuery.matches;
      this._register(addDisposableListener(reducedMotionQuery, "change", () => {
        this._reducedMotion = reducedMotionQuery.matches;
        this._applyFan();
      }));
    }
    this._register(addDisposableListener(this._domNode, EventType.FOCUS_IN, () => {
      this._focused = true;
      this._collapseFan();
    }));
    this._register(addDisposableListener(this._domNode, EventType.FOCUS_OUT, () => {
      if (!this._domNode.contains(getWindow(this._domNode).document.activeElement)) {
        this._focused = false;
        this._card.scheduleHide();
      }
    }));
  }
  get domNode() {
    return this._domNode;
  }
  setFilesProvider(provider) {
    this._card.setFilesProvider(provider);
  }
  setTicks(ticks) {
    const sameStructure = ticks.length === this._marks.length && ticks.every((t, i) => this._marks[i]?.tick.requestId === t.requestId);
    if (sameStructure) {
      for (let i = 0; i < ticks.length; i++) {
        this._renderMark(this._marks[i], ticks[i]);
      }
      this._updateActiveClasses();
      this._relayout();
      return;
    }
    this._markDisposables.clear();
    this._marks.length = 0;
    clearNode(this._marksContainer);
    this._card.hide();
    this._marksContainer.classList.remove("glide");
    this._glideEnabler.clear();
    for (const tick of ticks) {
      const button = append(this._marksContainer, $("button.prompt-timeline-ruler-mark"));
      button.tabIndex = -1;
      const bar = append(button, $("span.prompt-timeline-ruler-bar"));
      const entry = { tick, button, bar };
      this._renderMark(entry, tick);
      const requestId = tick.requestId;
      this._markDisposables.add(addDisposableListener(button, EventType.CLICK, () => this._onDidSelect.fire(requestId)));
      this._markDisposables.add(addDisposableListener(button, EventType.MOUSE_ENTER, () => this._showCard(entry)));
      this._markDisposables.add(addDisposableListener(button, EventType.FOCUS, () => {
        this._showCard(entry);
        this._updateTabStops(this._marks.indexOf(entry));
      }));
      this._markDisposables.add(addDisposableListener(button, EventType.MOUSE_LEAVE, () => this._card.scheduleHide()));
      this._marks.push(entry);
    }
    this._ensureResizeObserver();
    const activeIndex = this._marks.findIndex((m) => m.tick.requestId === this._activeRequestId);
    this._updateTabStops(activeIndex >= 0 ? activeIndex : 0);
    this._updateActiveClasses();
    this._relayout();
    this._glideEnabler.value = scheduleAtNextAnimationFrame(getWindow(this._domNode), () => this._marksContainer.classList.add("glide"));
  }
  /** Roving tabindex: exactly one mark is tabbable so the toolbar is a single Tab stop. */
  _updateTabStops(focusIndex) {
    for (let i = 0; i < this._marks.length; i++) {
      this._marks[i].button.tabIndex = i === focusIndex ? 0 : -1;
    }
  }
  _onMarksKeyDown(e) {
    if (this._marks.length === 0) {
      return;
    }
    const event = new StandardKeyboardEvent(e);
    const currentIndex = this._marks.findIndex((m) => m.button === getWindow(this._domNode).document.activeElement);
    let nextIndex;
    switch (event.keyCode) {
      case KeyCode.DownArrow:
        nextIndex = Math.min(this._marks.length - 1, currentIndex + 1);
        break;
      case KeyCode.UpArrow:
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case KeyCode.Home:
        nextIndex = 0;
        break;
      case KeyCode.End:
        nextIndex = this._marks.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._updateTabStops(nextIndex);
    this._marks[nextIndex]?.button.focus();
  }
  _renderMark(entry, tick) {
    entry.tick = tick;
    entry.button.setAttribute("aria-label", tick.ariaLabel);
    clearNode(entry.bar);
    const stat = tick.stat;
    const edited = !!stat && stat.added + stat.removed > 0;
    entry.bar.classList.toggle("edited", edited);
    if (edited) {
      if (stat.added > 0) {
        append(entry.bar, $("span.seg-add")).style.flexGrow = String(stat.added);
      }
      if (stat.removed > 0) {
        append(entry.bar, $("span.seg-del")).style.flexGrow = String(stat.removed);
      }
    }
  }
  /**
   * Records a hard/fast wheel flick. The fan does NOT bloom here — it blooms only if the transcript
   * actually scrolls shortly after (see {@link setScrollLayout}). This way a hard flick against the
   * top/bottom scroll limit, which moves nothing, never reveals the fan.
   */
  notifyHardWheel() {
    this._hardWheelAt = Date.now();
  }
  /** Lane-local Y of the active mark (the prompt currently scrolled to), or the nearest visible one. */
  _activeCenter() {
    const active = this._marks.find((m) => m.tick.requestId === this._activeRequestId && m.baseCenter !== void 0);
    if (active?.baseCenter !== void 0) {
      return active.baseCenter;
    }
    const laidOut = this._marks.filter((m) => m.baseCenter !== void 0);
    return laidOut.at(-1)?.baseCenter;
  }
  /**
   * Lane-local Y for the fisheye focus while SCROLLING: glides continuously with the viewport by
   * interpolating between pills. Each prompt has a content position (`layout.marks[].top`) and a dock
   * position (`baseCenter`); we find where the viewport (`scrollTop`) sits between two prompts in
   * content space and place the focus at the matching fraction between their dock positions. So the
   * fisheye travels smoothly through the pills as you scroll (rather than snapping at prompt
   * boundaries), while still tracking the real scroll position. Returns `undefined` if not laid out.
   */
  _scrollFanCenter() {
    const layout = this._layout;
    if (!layout) {
      return void 0;
    }
    const topById = new Map(layout.marks.map((m) => [m.requestId, m.top]));
    const pts = [];
    for (const entry of this._marks) {
      const contentTop = topById.get(entry.tick.requestId);
      if (contentTop !== void 0 && entry.baseCenter !== void 0) {
        pts.push({ contentTop, center: entry.baseCenter });
      }
    }
    if (pts.length === 0) {
      return void 0;
    }
    pts.sort((a, b) => a.contentTop - b.contentTop);
    const scrollTop = layout.scrollHeight > 0 ? layout.scrollTop / layout.scrollHeight * layout.total : layout.scrollTop;
    if (scrollTop <= pts[0].contentTop) {
      return pts[0].center;
    }
    const last = pts[pts.length - 1];
    if (scrollTop >= last.contentTop) {
      return last.center;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (scrollTop >= a.contentTop && scrollTop <= b.contentTop) {
        const span = b.contentTop - a.contentTop;
        const frac = span > 0 ? (scrollTop - a.contentTop) / span : 0;
        return a.center + frac * (b.center - a.center);
      }
    }
    return last.center;
  }
  setActive(requestId) {
    this._activeRequestId = requestId;
    this._updateActiveClasses();
  }
  focusTick(requestId) {
    this._marks.find((m) => m.tick.requestId === requestId || m.tick.allRequestIds.includes(requestId))?.button.focus();
  }
  setHostWidth(width) {
    if (width > 0 && width !== this._hostWidth) {
      this._hostWidth = width;
      this._relayout();
    }
  }
  setScrollLayout(layout) {
    const prevScrollTop = this._lastScrollTop;
    this._layout = layout;
    if (layout) {
      this._lastScrollTop = layout.scrollTop;
      if (prevScrollTop !== void 0 && Math.abs(layout.scrollTop - prevScrollTop) > 0.5) {
        this._onScrolled();
      }
    }
    this._scheduleRelayout();
  }
  /**
   * Handles a real transcript scroll: blooms the fan if it followed a deliberate hard flick, and
   * keeps it alive (re-arms the linger) while you keep scrolling. Pointer hover owns the fan on its
   * own, so this defers to it.
   */
  _onScrolled() {
    if (this._hovering || this._focused) {
      return;
    }
    if (this._domNode.classList.contains("engaged")) {
      this._scheduleFanHide();
      return;
    }
    if (Date.now() - this._hardWheelAt <= HARD_WHEEL_REVEAL_WINDOW) {
      const center = this._scrollFanCenter() ?? this._activeCenter();
      if (center !== void 0) {
        this._engage(center);
        this._scheduleFanHide();
      }
    }
  }
  /** Coalesces relayout to at most once per animation frame. */
  _scheduleRelayout() {
    if (this._relayoutScheduled.value) {
      return;
    }
    this._relayoutScheduled.value = scheduleAtNextAnimationFrame(getWindow(this._domNode), () => {
      this._relayoutScheduled.clear();
      this._relayout();
    });
  }
  /** Places each mark at its proportional scroll position, spaced so hit targets never overlap. */
  _relayout() {
    const height = this._railHeight > 0 ? this._railHeight : this._railHeight = this._domNode.clientHeight;
    const layout = this._layout;
    const overflowing = this._hostWidth < MIN_HOST_WIDTH;
    this._domNode.classList.toggle("overflowing", overflowing);
    if (overflowing || height <= 0 || !layout || layout.total <= 0) {
      return;
    }
    const scale = height / layout.total;
    const topById = new Map(layout.marks.map((m) => [m.requestId, m.top]));
    const visible = [];
    for (const entry of this._marks) {
      const top = topById.get(entry.tick.requestId);
      if (top === void 0) {
        entry.button.classList.add("hidden");
        entry.lastTop = void 0;
        entry.baseCenter = void 0;
        entry.button.style.transform = "";
        entry.bar.style.transform = "";
        continue;
      }
      entry.button.classList.remove("hidden");
      visible.push({ entry, center: top * scale });
    }
    if (PILL_LAYOUT === "even") {
      this._spaceEvenCenters(visible, height);
    } else {
      spaceMarkCenters(visible, height, MIN_TARGET);
    }
    for (const { entry, center } of visible) {
      entry.baseCenter = center;
      const y = center - MIN_TARGET / 2;
      if (entry.lastTop !== void 0 && Math.abs(y - entry.lastTop) < RELAYOUT_MIN_DELTA) {
        continue;
      }
      entry.lastTop = y;
      entry.button.style.top = `${y}px`;
    }
    if (this._domNode.classList.contains("engaged") && !this._hovering && !this._focused) {
      const scrollCenter = this._scrollFanCenter();
      if (scrollCenter !== void 0) {
        this._fanCenter = scrollCenter;
      }
    }
    this._applyFan();
  }
  /**
   * Even (dock) placement: stacks the pills at a fixed spacing and centres the whole group in the
   * lane. If the group is taller than the lane it distributes across the full height instead, so a
   * long session still fits. Mutates each item's `center` in place.
   */
  _spaceEvenCenters(visible, height) {
    const n = visible.length;
    if (n === 0) {
      return;
    }
    const groupHeight = n * EVEN_PILL_SPACING;
    let start;
    let step;
    if (groupHeight <= height) {
      step = EVEN_PILL_SPACING;
      start = (height - groupHeight) / 2 + step / 2;
    } else {
      step = (height - EVEN_PILL_SPACING) / (n - 1);
      start = EVEN_PILL_SPACING / 2;
    }
    for (let i = 0; i < n; i++) {
      visible[i].center = start + i * step;
    }
  }
  /**
   * Fisheye "fan": magnify the marks near {@link _fanCenter} and gently spread their neighbours
   * apart, so a dense cluster becomes easy to read and click. It is a pointer-only flourish layered
   * on top of the proportional layout — the marks' `top` (owned by `_relayout`) is untouched; the
   * fan only adds a CSS `transform`, so keyboard navigation and the base layout are unaffected.
   * Disabled entirely under reduced-motion.
   */
  _applyFan() {
    const center = this._fanCenter;
    const fanning = center !== void 0 && !this._reducedMotion;
    for (const entry of this._marks) {
      if (entry.baseCenter === void 0) {
        continue;
      }
      if (!fanning) {
        entry.button.style.transform = "";
        entry.bar.style.transform = "";
        continue;
      }
      const d = entry.baseCenter - center;
      const m = Math.exp(-(d * d) / (2 * FAN_SIGMA * FAN_SIGMA));
      entry.button.style.transform = `translateY(${FAN_SPREAD * Math.tanh(d / FAN_SIGMA)}px)`;
      entry.bar.style.transform = `scale(${1 + m * 0.9}, ${1 + m * 0.6})`;
    }
  }
  /**
   * Opens the fan at {@link center} (lane-local Y): reveals the marks (via `.engaged`) and applies
   * the fisheye. Reveal happens even under reduced motion (the marks just don't magnify).
   */
  _engage(center) {
    this._domNode.classList.add("engaged");
    this._fanCenter = center;
    this._applyFan();
  }
  /** Collapses the fan back to the plain scrollbar (marks hidden, no fisheye). */
  _collapseFan() {
    if (!this._domNode.classList.contains("engaged")) {
      return;
    }
    this._domNode.classList.remove("engaged");
    this._fanCenter = void 0;
    this._applyFan();
  }
  /**
   * (Re)starts the linger countdown: {@link FAN_LINGER}ms after the last scroll the fan collapses —
   * but only if the pointer is not keeping it open. Called on every scroll frame and when the pointer
   * leaves, so it avoids churning the timer: it just stamps the activity time and, when the single
   * running timer fires, it re-arms for the remaining time if more scrolling happened since.
   */
  _scheduleFanHide() {
    this._lastFanActivityAt = Date.now();
    if (!this._fanHide.value) {
      this._armFanHide(FAN_LINGER);
    }
  }
  _armFanHide(delay) {
    this._fanHide.value = disposableTimeout(() => {
      this._fanHide.clear();
      if (this._hovering) {
        return;
      }
      const remaining = FAN_LINGER - (Date.now() - this._lastFanActivityAt);
      if (remaining > 0) {
        this._armFanHide(remaining);
      } else {
        this._collapseFan();
      }
    }, delay);
  }
  _updateActiveClasses() {
    for (const entry of this._marks) {
      const isActive = entry.tick.requestId === this._activeRequestId;
      entry.button.classList.toggle("active", isActive);
      if (isActive) {
        entry.button.setAttribute("aria-current", "location");
      } else {
        entry.button.removeAttribute("aria-current");
      }
    }
  }
  /** Lane-local Y (client px) of the marks column top, from the cached rail top (refreshed on resize). Reads layout lazily only if the cache is not yet primed, so hovering never forces a reflow mid-scroll. */
  _laneTopNow() {
    if (this._domTop === void 0) {
      this._domTop = this._domNode.getBoundingClientRect().top;
    }
    return this._domTop;
  }
  _showCard(entry) {
    const centerY = entry.baseCenter ?? entry.button.getBoundingClientRect().top - this._domNode.getBoundingClientRect().top + MIN_TARGET / 2;
    this._card.show(entry.tick, centerY);
  }
  _ensureResizeObserver() {
    if (this._resizeObserverReady) {
      return;
    }
    const ResizeObserverCtor = getWindow(this._domNode).ResizeObserver;
    if (!ResizeObserverCtor) {
      return;
    }
    this._resizeObserverReady = true;
    const observer = new ResizeObserverCtor(() => {
      this._railHeight = this._domNode.clientHeight;
      this._domTop = this._domNode.getBoundingClientRect().top;
      this._relayout();
    });
    observer.observe(this._domNode);
    this._register(toDisposable(() => observer.disconnect()));
  }
}
export {
  PromptTimelineRulerRail
};
