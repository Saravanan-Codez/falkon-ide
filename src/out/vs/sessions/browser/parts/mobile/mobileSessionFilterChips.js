import "./media/mobileSessionFilterChips.css";
import * as DOM from "../../../../base/browser/dom.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { EventType } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
const $ = DOM.$;
class MobileSessionFilterChips extends Disposable {
  constructor(parent, host) {
    super();
    this.host = host;
    this.chipElements = /* @__PURE__ */ new Map();
    this.chipDisposables = this._register(new DisposableStore());
    this._onDidRequestSortGroup = this._register(new Emitter());
    /**
     * Fired when the user taps the "Sort" chip. The argument is
     * the chip's DOM element so the host can anchor a sheet/menu to it.
     */
    this.onDidRequestSortGroup = this._onDidRequestSortGroup.event;
    this._onDidRequestFind = this._register(new Emitter());
    /**
     * Fired when the user taps the "Find" chip. The host should open the
     * sessions find widget.
     */
    this.onDidRequestFind = this._onDidRequestFind.event;
    this.container = DOM.append(parent, $(".mobile-session-filter-chips"));
    this.container.setAttribute("role", "toolbar");
    this.container.setAttribute("aria-label", localize("filterChipsLabel", "Session status filters"));
    this.scrollContainer = DOM.append(this.container, $(".mobile-session-filter-chips-scroll"));
    this.renderChips();
    this._register(this.host.onDidUpdate(() => this.syncActiveStates()));
  }
  static {
    this.CHIP_DEFS = [
      {
        label: localize("chipCompleted", "Completed"),
        statuses: [SessionStatus.Completed]
      },
      {
        label: localize("chipInProgress", "In Progress"),
        statuses: [SessionStatus.InProgress, SessionStatus.NeedsInput]
      },
      {
        label: localize("chipFailed", "Failed"),
        statuses: [SessionStatus.Error]
      }
    ];
  }
  renderChips() {
    this.chipDisposables.clear();
    this.chipElements.clear();
    DOM.clearNode(this.scrollContainer);
    for (const child of Array.from(this.container.children)) {
      if (child !== this.scrollContainer) {
        child.remove();
      }
    }
    for (const def of MobileSessionFilterChips.CHIP_DEFS) {
      this.createStatusChip(def);
    }
    this.createSortGroupChip();
    this.createFindChip();
    this.syncActiveStates();
  }
  createStatusChip(def) {
    const chip = DOM.append(this.scrollContainer, $(".mobile-session-filter-chip"));
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("aria-pressed", "false");
    const label = DOM.append(chip, $("span.chip-label"));
    label.textContent = def.label;
    this.chipElements.set(def.label, chip);
    this.chipDisposables.add(Gesture.addTarget(chip));
    this.chipDisposables.add(DOM.addDisposableListener(chip, EventType.CLICK, (e) => {
      e.preventDefault();
      this.toggleStatusChip(def);
    }));
    this.chipDisposables.add(DOM.addDisposableListener(chip, TouchEventType.Tap, () => {
      this.toggleStatusChip(def);
    }));
    this.chipDisposables.add(DOM.addDisposableListener(chip, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleStatusChip(def);
      }
    }));
  }
  createSortGroupChip() {
    const chip = DOM.append(this.scrollContainer, $(".mobile-session-filter-chip.mobile-session-filter-chip-action"));
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("aria-label", localize("sortGroupAriaLabel", "Sort and group options"));
    const icon = DOM.append(chip, $("span.chip-icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.listFilter));
    const label = DOM.append(chip, $("span.chip-label"));
    label.textContent = localize("sortGroup", "Sort");
    const fire = () => this._onDidRequestSortGroup.fire(chip);
    this.chipDisposables.add(Gesture.addTarget(chip));
    this.chipDisposables.add(DOM.addDisposableListener(chip, EventType.CLICK, (e) => {
      e.preventDefault();
      fire();
    }));
    this.chipDisposables.add(DOM.addDisposableListener(chip, TouchEventType.Tap, () => {
      fire();
    }));
    this.chipDisposables.add(DOM.addDisposableListener(chip, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire();
      }
    }));
  }
  createFindChip() {
    const chip = DOM.append(this.container, $(".mobile-session-filter-chip.mobile-session-filter-chip-action.icon-only"));
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.setAttribute("aria-label", localize("findAriaLabel", "Find session"));
    const icon = DOM.append(chip, $("span.chip-icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.search));
    const fire = () => this._onDidRequestFind.fire();
    this.chipDisposables.add(Gesture.addTarget(chip));
    this.chipDisposables.add(DOM.addDisposableListener(chip, EventType.CLICK, (e) => {
      e.preventDefault();
      fire();
    }));
    this.chipDisposables.add(DOM.addDisposableListener(chip, TouchEventType.Tap, () => {
      fire();
    }));
    this.chipDisposables.add(DOM.addDisposableListener(chip, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire();
      }
    }));
  }
  /**
   * Toggle a status filter chip. The chip applies an _inclusive_ filter:
   *
   * - When a chip is activated, only sessions matching the chip's statuses
   *   are shown (all other statuses become excluded).
   * - Tapping the same chip again deactivates it, restoring the default
   *   (no status exclusions).
   * - When multiple chips are active, sessions matching ANY active chip
   *   are shown.
   */
  toggleStatusChip(def) {
    const isCurrentlyActive = this.isChipActive(def);
    if (isCurrentlyActive) {
      for (const chipDef of MobileSessionFilterChips.CHIP_DEFS) {
        for (const status of chipDef.statuses) {
          this.host.setStatusExcluded(status, false);
        }
      }
    } else {
      const willBeActive = /* @__PURE__ */ new Set();
      willBeActive.add(def);
      for (const otherDef of MobileSessionFilterChips.CHIP_DEFS) {
        if (otherDef !== def && this.isChipActive(otherDef)) {
          willBeActive.add(otherDef);
        }
      }
      const includedStatuses = /* @__PURE__ */ new Set();
      for (const activeDef of willBeActive) {
        for (const status of activeDef.statuses) {
          includedStatuses.add(status);
        }
      }
      for (const chipDef of MobileSessionFilterChips.CHIP_DEFS) {
        for (const status of chipDef.statuses) {
          this.host.setStatusExcluded(status, !includedStatuses.has(status));
        }
      }
    }
    this.syncActiveStates();
  }
  /**
   * A chip is considered "active" when ALL of its statuses are NOT excluded
   * AND at least one other status IS excluded (meaning the user is
   * filtering).
   */
  isChipActive(def) {
    const allStatuses = MobileSessionFilterChips.CHIP_DEFS.flatMap((d) => [...d.statuses]);
    const hasAnyExclusion = allStatuses.some((s) => this.host.isStatusExcluded(s));
    if (!hasAnyExclusion) {
      return false;
    }
    return def.statuses.every((s) => !this.host.isStatusExcluded(s));
  }
  syncActiveStates() {
    for (const def of MobileSessionFilterChips.CHIP_DEFS) {
      const chip = this.chipElements.get(def.label);
      if (chip) {
        const active = this.isChipActive(def);
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      }
    }
  }
  get element() {
    return this.container;
  }
}
export {
  MobileSessionFilterChips
};
