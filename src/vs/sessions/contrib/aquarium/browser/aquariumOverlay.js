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
import { addDisposableGenericMouseDownListener, addDisposableGenericMouseMoveListener, addDisposableListener, EventType, getWindow, scheduleAtNextAnimationFrame } from "../../../../base/browser/dom.js";
import { createInstantHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkbenchLayoutService, Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { SessionsAquariumActiveContext } from "../../../common/contextkeys.js";
import { disposeSharedFishDefs, Fish, pickRandomSpecies } from "./fish.js";
import { FishFeedingStreak } from "./fishFeedingStreak.js";
const SESSIONS_DEVELOPER_JOY_ENABLED_SETTING = "sessions.developerJoy.enabled";
const FISH_COUNT = 50;
const FISH_MIN_SIZE = 22;
const FISH_MAX_SIZE = 48;
const FISH_GROWTH_FACTOR = 1.08;
const SCATTER_RADIUS = 145;
const SCATTER_RADIUS_SQ = SCATTER_RADIUS * SCATTER_RADIUS;
const EAT_RADIUS = 14;
const FOOD_DETECT_RADIUS = 160;
const FOOD_DETECT_RADIUS_SQ = FOOD_DETECT_RADIUS * FOOD_DETECT_RADIUS;
const MAX_FOOD = 12;
const WALL_MARGIN = 36;
const BASE_SPEED = 24;
const MAX_SPEED = 50;
const MAX_SPEED_SQ = MAX_SPEED * MAX_SPEED;
const PANIC_MAX_SPEED = 240;
const PANIC_MAX_SPEED_SQ = PANIC_MAX_SPEED * PANIC_MAX_SPEED;
const PANIC_DURATION_MS = 600;
const EXIT_DURATION_MS = 900;
const ACTIVE_FRAME_INTERVAL_MS = 1e3 / 30;
const DART_RATE_PER_SECOND = 0.04;
const DART_IMPULSE = 150;
const ENABLED_STORAGE_KEY = "sessions.developerJoy.enabled";
const ACTION_VISIBLE_STORAGE_KEY = "sessions.aquarium.action.visible";
const FISH_HUNGER_ICONS = {
  happy: Codicon.fish1Happy,
  neutral: Codicon.fish1Neutral,
  sad: Codicon.fish1Sad,
  verySad: Codicon.fish1VerySad
};
const IAquariumService = createDecorator("aquariumService");
let AquariumService = class extends Disposable {
  constructor(layoutService, contextKeyService, hoverService, storageService, configurationService, accessibilityService, telemetryService) {
    super();
    this.layoutService = layoutService;
    this.hoverService = hoverService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this.telemetryService = telemetryService;
    this.mounts = /* @__PURE__ */ new Set();
    this.activeRef = this._register(new MutableDisposable());
    this.pendingExit = this._register(new MutableDisposable());
    this._actionVisible = observableValue(this, true);
    this.actionVisible = this._actionVisible;
    this.mainContainer = layoutService.mainContainer;
    this.activeContextKey = SessionsAquariumActiveContext.bindTo(contextKeyService);
    this.streak = new FishFeedingStreak(storageService);
    this._actionVisible.set(this.storageService.getBoolean(ACTION_VISIBLE_STORAGE_KEY, StorageScope.APPLICATION, true), void 0);
    this.hungerRefreshScheduler = this._register(new RunOnceScheduler(() => {
      this.updateAllToggleButtonsVisual(!!this.activeRef.value);
    }, 0));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, ACTION_VISIBLE_STORAGE_KEY, this._store)(() => {
      this.setActionVisible(this.storageService.getBoolean(ACTION_VISIBLE_STORAGE_KEY, StorageScope.APPLICATION, true));
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SESSIONS_DEVELOPER_JOY_ENABLED_SETTING)) {
        this.applyFeatureEnabledState();
      }
    }));
  }
  mountToggle(parent) {
    const doc = parent.ownerDocument;
    const button = doc.createElement("button");
    button.className = "agents-aquarium-toggle";
    button.type = "button";
    this.updateToggleButtonVisual(button, !!this.activeRef.value);
    const store = new DisposableStore();
    store.add(addDisposableListener(button, EventType.CLICK, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }));
    const hoverDelegate = store.add(createInstantHoverDelegate());
    store.add(this.hoverService.setupManagedHover(
      hoverDelegate,
      button,
      () => this.getToggleLabel(!!this.activeRef.value)
    ));
    parent.appendChild(button);
    const mount = { button, hostVisible: true };
    this.mounts.add(mount);
    this.applyFeatureEnabledStateForButton(button);
    this.reconcileActivation();
    this.scheduleHungerRefresh();
    return {
      setHostVisible: (visible) => {
        if (mount.hostVisible === visible) {
          return;
        }
        mount.hostVisible = visible;
        this.reconcileActivation();
      },
      dispose: () => {
        store.dispose();
        button.remove();
        this.mounts.delete(mount);
        if (this.mounts.size === 0) {
          this.hungerRefreshScheduler.cancel();
        }
        this.reconcileActivation();
      }
    };
  }
  toggleActionVisibility() {
    const visible = !this._actionVisible.get();
    this.setActionVisible(visible);
    this.storageService.store(ACTION_VISIBLE_STORAGE_KEY, visible, StorageScope.APPLICATION, StorageTarget.USER);
    this.accessibilityService.status(visible ? localize("aquarium.action.shown", "Aquarium action shown") : localize("aquarium.action.hidden", "Aquarium action hidden"));
    return visible;
  }
  simulateStreak(count, alive) {
    this.streak.simulate(count, alive);
    this.updateAllToggleButtonsVisual(!!this.activeRef.value);
  }
  setActionVisible(visible) {
    this._actionVisible.set(visible, void 0);
    for (const mount of this.mounts) {
      this.applyFeatureEnabledStateForButton(mount.button);
    }
  }
  /**
   * Activate when at least one mount is host-visible and the user has it on;
   * otherwise deactivate synchronously (no fade) so the aquarium can't flash
   * behind a sibling view during a view swap.
   */
  reconcileActivation() {
    const anyHostVisible = this.hasVisibleMount();
    if (anyHostVisible && this.isFeatureEnabled() && this.isStoredEnabled() && !this.activeRef.value) {
      this.activate(
        /* persist */
        false
      );
    } else if (!anyHostVisible) {
      this.pendingExit.clear();
      if (this.activeRef.value) {
        this.deactivate(
          /* persist */
          false,
          /* animate */
          false
        );
      }
    }
  }
  hasVisibleMount() {
    for (const m of this.mounts) {
      if (m.hostVisible) {
        return true;
      }
    }
    return false;
  }
  isFeatureEnabled() {
    return this.configurationService.getValue(SESSIONS_DEVELOPER_JOY_ENABLED_SETTING) === true;
  }
  isStoredEnabled() {
    return this.storageService.getBoolean(ENABLED_STORAGE_KEY, StorageScope.APPLICATION, false);
  }
  setStoredEnabled(enabled) {
    this.storageService.store(ENABLED_STORAGE_KEY, enabled, StorageScope.APPLICATION, StorageTarget.USER);
  }
  applyFeatureEnabledState() {
    for (const mount of this.mounts) {
      this.applyFeatureEnabledStateForButton(mount.button);
    }
    if (!this.isFeatureEnabled() && this.activeRef.value) {
      this.deactivate(
        /* persist */
        false
      );
    } else if (this.isFeatureEnabled()) {
      this.reconcileActivation();
    }
  }
  applyFeatureEnabledStateForButton(button) {
    button.style.display = this.isFeatureEnabled() && this._actionVisible.get() ? "" : "none";
  }
  updateToggleButtonVisual(button, active) {
    button.classList.toggle("active", active);
    this.streak.collectExpired();
    const streak = this.streak.count;
    const revivable = streak > 0 ? 0 : this.streak.revivableCount;
    const hungerIcon = FISH_HUNGER_ICONS[this.streak.hungerState];
    const icon = active ? Codicon.close : hungerIcon;
    button.replaceChildren();
    const iconSpan = button.ownerDocument.createElement("span");
    iconSpan.setAttribute("aria-hidden", "true");
    addIconClasses(iconSpan, icon);
    if (!active) {
      button.appendChild(iconSpan);
    }
    const showStreak = streak > 0 || revivable > 0;
    button.classList.toggle("has-streak", showStreak);
    if (showStreak) {
      const streakSpan = button.ownerDocument.createElement("span");
      streakSpan.className = "agents-aquarium-toggle-streak";
      streakSpan.setAttribute("aria-hidden", "true");
      if (active) {
        const hungerIconSpan = button.ownerDocument.createElement("span");
        addIconClasses(hungerIconSpan, hungerIcon);
        streakSpan.appendChild(hungerIconSpan);
      }
      if (streak > 0) {
        streakSpan.append(String(streak));
      } else {
        streakSpan.classList.add("revivable");
        streakSpan.append(localize("aquarium.reviveBadge", "{0} \xB7 Feed again to revive", revivable));
      }
      button.appendChild(streakSpan);
    }
    if (active) {
      button.appendChild(iconSpan);
    }
    const label = this.getToggleLabel(active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", label);
  }
  getToggleLabel(active) {
    const base = active ? localize("aquarium.hide", "Hide Aquarium") : localize("aquarium.show", "Show Aquarium");
    const streak = this.streak.count;
    if (streak > 0) {
      const hungerDescription = getFishHungerDescription(this.streak.hungerState);
      return streak === 1 ? localize("aquarium.streakLabel.one", "{0} \u2014 {1} \u2014 {2} day feeding streak", base, hungerDescription, streak) : localize("aquarium.streakLabel.other", "{0} \u2014 {1} \u2014 {2} days feeding streak", base, hungerDescription, streak);
    }
    const revivable = this.streak.revivableCount;
    if (revivable > 0) {
      return revivable === 1 ? localize("aquarium.reviveLabel.one", "{0} \u2014 feed a fish to revive your {1} day streak", base, revivable) : localize("aquarium.reviveLabel.other", "{0} \u2014 feed a fish to revive your {1} day streak", base, revivable);
    }
    return base;
  }
  toggle() {
    const willActivate = !this.activeRef.value;
    this.telemetryService.publicLog2("vscodeAgents.aquarium/toggle", {
      activated: willActivate
    });
    if (this.activeRef.value) {
      this.deactivate(
        /* persist */
        true
      );
    } else if (this.hasVisibleMount()) {
      this.activate(
        /* persist */
        true
      );
    }
  }
  updateAllToggleButtonsVisual(active) {
    for (const mount of this.mounts) {
      this.updateToggleButtonVisual(mount.button, active);
    }
    this.scheduleHungerRefresh();
  }
  scheduleHungerRefresh() {
    this.hungerRefreshScheduler.cancel();
    if (this.mounts.size === 0) {
      return;
    }
    const delay = this.streak.millisecondsUntilHungerStateChange;
    if (delay !== void 0) {
      this.hungerRefreshScheduler.schedule(delay);
    }
  }
  /** @param persist false when restoring previously-stored state. */
  activate(persist) {
    if (this.activeRef.value) {
      return;
    }
    this.pendingExit.clear();
    let active;
    try {
      active = createActiveAquarium(this.mainContainer, this.layoutService, this.accessibilityService, () => this.handleFishFed());
    } catch (e) {
      console.error("[aquarium] failed to activate", e);
      return;
    }
    if (!active) {
      return;
    }
    this.activeRef.value = active;
    this.activeContextKey.set(true);
    this.updateAllToggleButtonsVisual(true);
    if (persist) {
      this.setStoredEnabled(true);
    }
    this.streak.collectExpired();
    this.updateAllToggleButtonsVisual(true);
  }
  /** Called whenever a fish eats a pellet. */
  handleFishFed() {
    const before = this.streak.count;
    const result = this.streak.recordFeed();
    if (result.count !== before || result.revived) {
      this.updateAllToggleButtonsVisual(!!this.activeRef.value);
    }
  }
  /**
   * @param persist false when tearing down for non-user reasons.
   * @param animate false to dispose synchronously (no fade-out). Used for
   * host-driven teardown where running a 900ms fade would let fish stay
   * visible while the next view layers on top.
   */
  deactivate(persist, animate = true) {
    if (!animate) {
      this.activeRef.clear();
      this.activeContextKey.set(false);
      this.updateAllToggleButtonsVisual(false);
      if (persist) {
        this.setStoredEnabled(false);
      }
      return;
    }
    const active = this.activeRef.clearAndLeak();
    if (!active) {
      return;
    }
    this.activeContextKey.set(false);
    this.updateAllToggleButtonsVisual(false);
    const pending = active.exit(() => {
      if (this.pendingExit.value === pending) {
        this.pendingExit.clear();
      }
    });
    this.pendingExit.value = pending;
    if (persist) {
      this.setStoredEnabled(false);
    }
  }
};
AquariumService = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IAccessibilityService),
  __decorateParam(6, ITelemetryService)
], AquariumService);
function createActiveAquarium(mainContainer, layoutService, accessibilityService, onFishFed) {
  const targetWindow = getWindow(mainContainer);
  const sessionsContainer = layoutService.getContainer(targetWindow, Parts.SESSIONS_PART);
  if (!sessionsContainer || !layoutService.isVisible(Parts.SESSIONS_PART, targetWindow)) {
    return void 0;
  }
  const store = new DisposableStore();
  const doc = targetWindow.document;
  const water = doc.createElement("div");
  water.className = "agents-aquarium-water";
  water.setAttribute("aria-hidden", "true");
  sessionsContainer.insertBefore(water, sessionsContainer.firstChild);
  sessionsContainer.classList.add("aquarium-active");
  store.add(toDisposable(() => {
    water.remove();
    sessionsContainer.classList.remove("aquarium-active");
  }));
  const fishLayer = doc.createElement("div");
  fishLayer.className = "agents-aquarium-fish-layer";
  water.appendChild(fishLayer);
  const foodLayer = doc.createElement("div");
  foodLayer.className = "agents-aquarium-food-layer";
  water.appendChild(foodLayer);
  const bounds = { width: 0, height: 0 };
  const waterScreenOffset = { left: 0, top: 0 };
  const updateBounds = () => {
    bounds.width = water.clientWidth;
    bounds.height = water.clientHeight;
    const rect = water.getBoundingClientRect();
    waterScreenOffset.left = rect.left;
    waterScreenOffset.top = rect.top;
  };
  const fish = [];
  updateBounds();
  const resizeObserver = new ResizeObserver(() => {
    updateBounds();
    for (const f of fish) {
      f.positionX = Math.min(f.positionX, Math.max(0, bounds.width - f.size));
      f.positionY = Math.min(f.positionY, Math.max(0, bounds.height - f.size));
    }
  });
  resizeObserver.observe(water);
  store.add(toDisposable(() => resizeObserver.disconnect()));
  for (let i = 0; i < FISH_COUNT; i++) {
    const size = randomBetween(FISH_MIN_SIZE, FISH_MAX_SIZE);
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(BASE_SPEED * 0.6, BASE_SPEED * 1.2);
    const f = new Fish({
      species: pickRandomSpecies(),
      size,
      positionX: randomBetween(0, Math.max(1, bounds.width - size)),
      positionY: randomBetween(0, Math.max(1, bounds.height - size)),
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed
    }, targetWindow.document);
    fish.push(f);
  }
  const SYNC_BATCH = Math.ceil(FISH_COUNT / 2);
  const firstBatch = targetWindow.document.createDocumentFragment();
  for (let i = 0; i < Math.min(SYNC_BATCH, fish.length); i++) {
    firstBatch.appendChild(fish[i].element);
  }
  fishLayer.appendChild(firstBatch);
  let exiting = false;
  if (SYNC_BATCH < fish.length) {
    const deferred = scheduleAtNextAnimationFrame(targetWindow, () => {
      if (exiting) {
        return;
      }
      const restBatch = targetWindow.document.createDocumentFragment();
      for (let i = SYNC_BATCH; i < fish.length; i++) {
        restBatch.appendChild(fish[i].element);
      }
      fishLayer.appendChild(restBatch);
      const fadeIn2 = scheduleAtNextAnimationFrame(targetWindow, () => {
        if (exiting) {
          return;
        }
        for (let i = SYNC_BATCH; i < fish.length; i++) {
          const localIndex = i - SYNC_BATCH;
          const delay = Math.min(localIndex * 12, 400);
          fish[i].element.style.transitionDelay = `${delay}ms`;
          fish[i].element.classList.add("visible");
        }
      });
      store.add(fadeIn2);
    });
    store.add(deferred);
  }
  store.add(toDisposable(() => {
    for (const f of fish) {
      f.element.remove();
    }
    disposeSharedFishDefs(targetWindow.document);
  }));
  const food = [];
  const removeFood = (pellet) => {
    const idx = food.indexOf(pellet);
    if (idx !== -1) {
      food.splice(idx, 1);
      pellet.element.remove();
    }
  };
  let boundsDirty = false;
  const markBoundsDirty = () => {
    boundsDirty = true;
  };
  store.add(addDisposableListener(targetWindow, EventType.RESIZE, markBoundsDirty, { passive: true }));
  store.add(addDisposableListener(targetWindow, "scroll", markBoundsDirty, { passive: true, capture: true }));
  let mouseX = -1e6;
  let mouseY = -1e6;
  const resetMousePosition = () => {
    mouseX = -1e6;
    mouseY = -1e6;
  };
  store.add(addDisposableGenericMouseMoveListener(mainContainer, (e) => {
    mouseX = e.clientX - waterScreenOffset.left;
    mouseY = e.clientY - waterScreenOffset.top;
  }));
  store.add(addDisposableListener(mainContainer, EventType.MOUSE_LEAVE, resetMousePosition, { passive: true }));
  store.add(addDisposableListener(mainContainer, EventType.POINTER_LEAVE, resetMousePosition, { passive: true }));
  store.add(addDisposableGenericMouseDownListener(mainContainer, (e) => {
    if (e.button !== 0) {
      return;
    }
    const target = e.target;
    if (!isBackgroundClick(target)) {
      return;
    }
    updateBounds();
    const dropX = e.clientX - waterScreenOffset.left;
    const dropY = e.clientY - waterScreenOffset.top;
    if (dropX < 0 || dropY < 0 || dropX > bounds.width || dropY > bounds.height) {
      return;
    }
    spawnFood(dropX, dropY);
  }));
  function spawnFood(dropX, dropY) {
    while (food.length >= MAX_FOOD) {
      const oldest = food[0];
      removeFood(oldest);
    }
    const el = doc.createElement("div");
    el.className = "agents-aquarium-food";
    el.style.transform = `translate(${dropX}px, ${dropY}px)`;
    foodLayer.appendChild(el);
    food.push({ element: el, positionX: dropX, positionY: dropY, fallSpeed: randomBetween(20, 35) });
  }
  let lastFrame = performance.now();
  let rafDisposable;
  const stopAnimation = () => {
    rafDisposable?.dispose();
    rafDisposable = void 0;
  };
  const startAnimation = () => {
    if (rafDisposable || accessibilityService.isMotionReduced()) {
      return;
    }
    lastFrame = performance.now();
    rafDisposable = scheduleAtNextAnimationFrame(targetWindow, tick);
  };
  const tick = () => {
    rafDisposable = void 0;
    const now = performance.now();
    const elapsedMs = now - lastFrame;
    if (elapsedMs < ACTIVE_FRAME_INTERVAL_MS) {
      rafDisposable = scheduleAtNextAnimationFrame(targetWindow, tick);
      return;
    }
    const dtMs = Math.min(elapsedMs, 100);
    const dt = dtMs / 1e3;
    lastFrame = now;
    if (boundsDirty) {
      boundsDirty = false;
      updateBounds();
    }
    if (!accessibilityService.isMotionReduced() && targetWindow.document.visibilityState !== "hidden") {
      updateFood(dt);
      updateFish(dt);
    }
    if (!accessibilityService.isMotionReduced()) {
      rafDisposable = scheduleAtNextAnimationFrame(targetWindow, tick);
    }
  };
  function updateFood(dt) {
    for (let i = food.length - 1; i >= 0; i--) {
      const pellet = food[i];
      pellet.positionY += pellet.fallSpeed * dt;
      pellet.element.style.transform = `translate(${pellet.positionX.toFixed(1)}px, ${pellet.positionY.toFixed(1)}px)`;
      if (pellet.positionY > bounds.height + 10) {
        removeFood(pellet);
      }
    }
  }
  function updateFish(dt) {
    const now = performance.now();
    for (const f of fish) {
      const centerX = f.positionX + f.size / 2;
      const centerY = f.positionY + f.size / 2;
      const wallEscapeAngle = computeWallAvoidAngle(centerX, centerY, bounds.width, bounds.height);
      if (wallEscapeAngle !== void 0) {
        const turnDelta = shortestAngleDelta(f.wanderAngle, wallEscapeAngle);
        const maxTurnPerFrame = 4 * dt;
        f.wanderAngle += Math.max(-maxTurnPerFrame, Math.min(maxTurnPerFrame, turnDelta));
      } else {
        f.wanderAngle += (Math.random() - 0.5) * 1.2 * dt + (Math.random() - 0.5) * 0.04;
      }
      const thrust = 32;
      let accelX = Math.cos(f.wanderAngle) * thrust;
      let accelY = Math.sin(f.wanderAngle) * thrust;
      if (Math.random() < DART_RATE_PER_SECOND * dt) {
        const dartAngle = Math.random() * Math.PI * 2;
        f.velocityX += Math.cos(dartAngle) * DART_IMPULSE;
        f.velocityY += Math.sin(dartAngle) * DART_IMPULSE;
        f.panicUntil = now + PANIC_DURATION_MS;
      }
      if (centerX < WALL_MARGIN) {
        accelX += (WALL_MARGIN - centerX) * 6;
      } else if (centerX > bounds.width - WALL_MARGIN) {
        accelX -= (centerX - (bounds.width - WALL_MARGIN)) * 6;
      }
      if (centerY < WALL_MARGIN) {
        accelY += (WALL_MARGIN - centerY) * 6;
      } else if (centerY > bounds.height - WALL_MARGIN) {
        accelY -= (centerY - (bounds.height - WALL_MARGIN)) * 6;
      }
      const mouseDeltaX = centerX - mouseX;
      const mouseDeltaY = centerY - mouseY;
      const mouseDistSq = mouseDeltaX * mouseDeltaX + mouseDeltaY * mouseDeltaY;
      if (mouseDistSq < SCATTER_RADIUS_SQ) {
        const mouseDist = Math.max(Math.sqrt(mouseDistSq), 1);
        const force = (1 - mouseDist / SCATTER_RADIUS) * 1100;
        accelX += mouseDeltaX / mouseDist * force;
        accelY += mouseDeltaY / mouseDist * force;
        f.panicUntil = now + PANIC_DURATION_MS;
      }
      let nearestPellet;
      let nearestDistSq = FOOD_DETECT_RADIUS_SQ;
      for (const pellet of food) {
        const foodDeltaX = pellet.positionX - centerX;
        const foodDeltaY = pellet.positionY - centerY;
        const distSq = foodDeltaX * foodDeltaX + foodDeltaY * foodDeltaY;
        if (distSq < nearestDistSq) {
          nearestDistSq = distSq;
          nearestPellet = pellet;
        }
      }
      if (nearestPellet) {
        const nearestDist = Math.max(Math.sqrt(nearestDistSq), 1);
        if (nearestDist < EAT_RADIUS) {
          removeFood(nearestPellet);
          f.grow(FISH_GROWTH_FACTOR);
          onFishFed?.();
        } else {
          accelX += (nearestPellet.positionX - centerX) / nearestDist * 200;
          accelY += (nearestPellet.positionY - centerY) / nearestDist * 200;
        }
      }
      f.velocityX += accelX * dt;
      f.velocityY += accelY * dt;
      const speedSq = f.velocityX * f.velocityX + f.velocityY * f.velocityY;
      const maxSpeed = now < f.panicUntil ? PANIC_MAX_SPEED : MAX_SPEED;
      const maxSpeedSq = now < f.panicUntil ? PANIC_MAX_SPEED_SQ : MAX_SPEED_SQ;
      if (speedSq > maxSpeedSq) {
        const speed = Math.sqrt(speedSq);
        f.velocityX = f.velocityX / speed * maxSpeed;
        f.velocityY = f.velocityY / speed * maxSpeed;
      }
      f.positionX += f.velocityX * dt;
      f.positionY += f.velocityY * dt;
      f.positionX = clamp(f.positionX, -f.size * 0.25, bounds.width - f.size * 0.75);
      f.positionY = clamp(f.positionY, -f.size * 0.25, bounds.height - f.size * 0.75);
      f.applyTransform(dt);
    }
  }
  store.add(accessibilityService.onDidChangeReducedMotion(() => {
    if (accessibilityService.isMotionReduced()) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }));
  store.add(toDisposable(() => stopAnimation()));
  startAnimation();
  const fadeIn = scheduleAtNextAnimationFrame(targetWindow, () => {
    if (exiting) {
      return;
    }
    water.classList.add("visible");
    for (let i = 0; i < Math.min(SYNC_BATCH, fish.length); i++) {
      const f = fish[i];
      const delay = Math.min(i * 12, 400);
      f.element.style.transitionDelay = `${delay}ms`;
      f.element.classList.add("visible");
    }
  });
  store.add(fadeIn);
  const result = new class extends Disposable {
    constructor() {
      super();
      this._register(store);
    }
    exit(onDidComplete) {
      if (exiting) {
        return toDisposable(() => this.dispose());
      }
      exiting = true;
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        const delay = Math.min(i * 12, 400);
        f.element.style.transitionDelay = `${delay}ms`;
        f.element.classList.remove("visible");
      }
      water.classList.remove("visible");
      let timer = setTimeout(() => {
        timer = void 0;
        this.dispose();
        onDidComplete();
      }, EXIT_DURATION_MS);
      return toDisposable(() => {
        if (timer !== void 0) {
          clearTimeout(timer);
          timer = void 0;
        }
        this.dispose();
      });
    }
  }();
  return result;
}
function isBackgroundClick(target) {
  if (!target) {
    return false;
  }
  if (target.closest('input, textarea, select, button, a, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="menuitem"], [role="tab"], .monaco-editor, .scroll-decoration, .monaco-list-row')) {
    return false;
  }
  return true;
}
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(value, min, max) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
function addIconClasses(element, icon) {
  const iconClasses = ThemeIcon.asClassName(icon).split(/\s+/).filter(Boolean);
  for (const cls of iconClasses) {
    element.classList.add(cls);
  }
}
function getFishHungerDescription(state) {
  switch (state) {
    case "happy":
      return localize("aquarium.hunger.happy", "fish is happy");
    case "neutral":
      return localize("aquarium.hunger.neutral", "fish is getting hungry");
    case "sad":
      return localize("aquarium.hunger.sad", "fish is hungry");
    case "verySad":
      return localize("aquarium.hunger.verySad", "fish is starving");
  }
}
function computeWallAvoidAngle(centerX, centerY, width, height) {
  let escapeX = 0;
  let escapeY = 0;
  if (centerX < WALL_MARGIN) {
    escapeX += (WALL_MARGIN - centerX) / WALL_MARGIN;
  } else if (centerX > width - WALL_MARGIN) {
    escapeX -= (centerX - (width - WALL_MARGIN)) / WALL_MARGIN;
  }
  if (centerY < WALL_MARGIN) {
    escapeY += (WALL_MARGIN - centerY) / WALL_MARGIN;
  } else if (centerY > height - WALL_MARGIN) {
    escapeY -= (centerY - (height - WALL_MARGIN)) / WALL_MARGIN;
  }
  if (escapeX === 0 && escapeY === 0) {
    return void 0;
  }
  return Math.atan2(escapeY, escapeX) + (Math.random() - 0.5) * 0.4;
}
function shortestAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}
export {
  AquariumService,
  IAquariumService,
  SESSIONS_DEVELOPER_JOY_ENABLED_SETTING
};
