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
import { addDisposableListener, EventType, getWindow } from "../../../../../base/browser/dom.js";
import { StandardWheelEvent } from "../../../../../base/browser/mouseEvent.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { MIN_PROMPTS, PROMPT_TIMELINE_CONTRIB_ID, PROMPT_TIMELINE_DISPLAY_SETTING, PROMPT_TIMELINE_STICKY_SCROLL_SETTING } from "../../common/promptTimeline.js";
import { PromptTimelineModel } from "./promptTimelineModel.js";
import { PromptTimelineGutterRail } from "./promptTimelineGutterRail.js";
import { PromptTimelineRulerRail } from "./promptTimelineRulerRail.js";
import { PromptTimelineStickyHeader } from "./promptTimelineStickyHeader.js";
const HARD_WHEEL_DISTANCE = 20;
const WHEEL_WINDOW_MS = 120;
function supportsPromptTimeline(widget) {
  return widget.location === ChatAgentLocation.Chat && !widget.rendersInputOnTop;
}
function isStickyPromptHeaderShown(widget, configurationService) {
  return supportsPromptTimeline(widget) && configurationService.getValue(PROMPT_TIMELINE_STICKY_SCROLL_SETTING) === true;
}
let PromptTimelineWidgetContrib = class extends Disposable {
  constructor(widget, instantiationService, configurationService, environmentService) {
    super();
    this.widget = widget;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.environmentService = environmentService;
    this.id = PromptTimelineWidgetContrib.ID;
    /** Holds the model and every surface's wiring while at least one surface is enabled. */
    this._enablement = this._register(new DisposableStore());
    if (!supportsPromptTimeline(widget)) {
      return;
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(PROMPT_TIMELINE_DISPLAY_SETTING) || e.affectsConfiguration(PROMPT_TIMELINE_STICKY_SCROLL_SETTING)) {
        this._update();
      }
    }));
    this._update();
  }
  static {
    this.ID = PROMPT_TIMELINE_CONTRIB_ID;
  }
  /** (Re)builds the timeline to match the current settings, or tears it down if no surface is enabled. */
  _update() {
    this._enablement.clear();
    this._rail = void 0;
    const railStyle = this.environmentService.isSessionsWindow ? this.configurationService.getValue(PROMPT_TIMELINE_DISPLAY_SETTING) : "off";
    const stickyEnabled = this.configurationService.getValue(PROMPT_TIMELINE_STICKY_SCROLL_SETTING) === true;
    if (railStyle !== "off" || stickyEnabled) {
      this._createFeature(railStyle, stickyEnabled);
    }
  }
  /**
   * Builds the model shared by both surfaces, mounts the host anchor, then creates whichever surfaces
   * are enabled: the rail beside the transcript and/or the sticky header at the top. Each is
   * independently toggleable, so header-only and rail-only configurations both work.
   */
  _createFeature(railStyle, stickyEnabled) {
    const model = this._enablement.add(this.instantiationService.createInstance(PromptTimelineModel, this.widget));
    const host = this.widget.domNode;
    host.classList.add("prompt-timeline-host");
    this._enablement.add(toDisposable(() => host.classList.remove("prompt-timeline-host", "prompt-timeline-with-rail")));
    const ResizeObserverCtor = getWindow(host).ResizeObserver;
    if (ResizeObserverCtor) {
      const observer = new ResizeObserverCtor(() => {
        this._rail?.setHostWidth(host.clientWidth);
      });
      observer.observe(host);
      this._enablement.add(toDisposable(() => observer.disconnect()));
    }
    if (railStyle !== "off") {
      this._createRail(model, host, railStyle);
    }
    if (stickyEnabled) {
      this._createStickyHeader(model);
    }
  }
  _createRail(model, host, railStyle) {
    const rail = this._enablement.add(
      railStyle === "gutter" ? new PromptTimelineGutterRail() : new PromptTimelineRulerRail()
    );
    this._rail = rail;
    if (railStyle === "ruler") {
      host.classList.add("prompt-timeline-with-rail");
    }
    host.appendChild(rail.domNode);
    this._enablement.add(toDisposable(() => rail.domNode.remove()));
    rail.setFilesProvider((tick) => model.getRequestFiles(tick));
    this._enablement.add(rail.onDidSelect((requestId) => model.reveal(requestId)));
    this._enablement.add(rail.onDidReview((tick) => {
      void model.reviewChanges(tick);
    }));
    this._enablement.add(rail.onDidReviewFile((e) => {
      void model.reviewChanges(e.tick, e.file);
    }));
    if (railStyle === "ruler") {
      this._enablement.add(this._registerHardWheelDetector(rail));
    }
    const inputPart = this.widget.inputPart;
    this._enablement.add(autorun((reader) => {
      rail.domNode.style.setProperty("--prompt-timeline-bottom", `${inputPart.height.read(reader)}px`);
    }));
    const ticksObs = railStyle === "gutter" ? model.promptTicks : model.ticks;
    const activeObs = railStyle === "gutter" ? model.activePromptId : model.activeRequestId;
    this._enablement.add(autorun((reader) => {
      const ticks = ticksObs.read(reader);
      rail.domNode.classList.toggle("hidden", ticks.length < MIN_PROMPTS);
      rail.setTicks(ticks);
    }));
    this._enablement.add(autorun((reader) => {
      rail.setActive(activeObs.read(reader));
    }));
    this._enablement.add(autorun((reader) => {
      model.onDidChangeScrollLayout.read(reader);
      rail.setScrollLayout(model.getScrollLayout());
    }));
    rail.setHostWidth(host.clientWidth);
  }
  /**
   * Mounts the flat sticky header that pins the current prompt to the top of the transcript. It shows
   * only once that prompt's row has scrolled above the viewport (via {@link PromptTimelineModel.activePinned}).
   * Its previous/next toolbar actions step through prompts; activating the label jumps straight to the
   * prompt it names (scrolling it to the top of the transcript).
   */
  _createStickyHeader(model) {
    const sticky = this._enablement.add(this.instantiationService.createInstance(PromptTimelineStickyHeader, this.widget.domNode));
    this._enablement.add(sticky.onDidActivate(() => model.revealActivePrompt()));
    this._enablement.add(sticky.onDidNavigate((delta) => model.navigate(delta)));
    this._enablement.add(autorun((reader) => {
      const active = model.activePrompt.read(reader);
      const pinned = model.activePinned.read(reader);
      if (active) {
        sticky.update(active.text, active.index, active.total);
      }
      sticky.setVisible(pinned && !!active && active.total >= MIN_PROMPTS);
    }));
  }
  /**
   * Detects a deliberate hard/fast scroll from wheel velocity and tells the rail (it only blooms if a
   * real scroll movement follows, so flicking against a scroll limit never opens it). Deltas are
   * normalized via {@link StandardWheelEvent} so line-mode devices are not stuck below the threshold,
   * and the listener is on the capture phase so it is seen before the transcript's ScrollableElement
   * consumes the wheel mid-content.
   */
  _registerHardWheelDetector(rail) {
    let wheelAcc = 0;
    let wheelWindowStart = 0;
    return addDisposableListener(this.widget.domNode, EventType.MOUSE_WHEEL, (e) => {
      const now = Date.now();
      if (now - wheelWindowStart > WHEEL_WINDOW_MS) {
        wheelAcc = 0;
        wheelWindowStart = now;
      }
      wheelAcc += Math.abs(new StandardWheelEvent(e).deltaY);
      if (wheelAcc >= HARD_WHEEL_DISTANCE) {
        wheelAcc = 0;
        rail.notifyHardWheel();
      }
    }, { capture: true, passive: true });
  }
};
PromptTimelineWidgetContrib = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IWorkbenchEnvironmentService)
], PromptTimelineWidgetContrib);
export {
  PromptTimelineWidgetContrib,
  isStickyPromptHeaderShown
};
