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
import "./media/chatPet.css";
import * as dom from "../../../../../base/browser/dom.js";
import { GlobalPointerMoveMonitor } from "../../../../../base/browser/globalPointerMoveMonitor.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { Action, Separator } from "../../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { FileAccess } from "../../../../../base/common/network.js";
import { autorun, observableFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IChatPetService } from "../chatPetService.js";
const CHAT_PET_IDLE_SLEEP_DELAY = 2e4;
const TRANSIENT_STATE_DURATION = 2e3;
const COMPLETE_STATE_DURATION = 960;
const BUTTON_PRESS_STATE_DURATION = 2850;
const SPLAT_STATE_DURATION = 520;
const LOVE_STATE_DURATION = 2940;
const COOL_STATE_DURATION = 3e3;
const SING_STATE_DURATION = 2880;
const SPEECHLESS_STATE_DURATION = 2720;
const WORRY_STATE_DURATION = 2400;
const WAKE_STATE_DURATION = 880;
const SEARCH_INTERVAL = 1e4;
const RESPAWN_SIGN_DURATION = 600;
const RESPAWN_EFFECT_DURATION = 800;
const RESPAWN_EFFECT_REDUCED_MOTION_DURATION = 400;
const DRAG_THRESHOLD = 2;
const HOP_DISTANCE = 24;
const HOP_APEX_DELAY = 300;
const HOP_REST_DELAY = 90;
const HOP_HOLD_GRACE = 350;
const HOP_IDLE_DEBOUNCE = 900;
const POSITION_EPSILON = 0.5;
const CHAT_PET_SOURCE_SIZE = 96;
const CHAT_PET_TYPING_SOURCE_WIDTH = 168;
const CHAT_PET_BUTTON_PRESS_SOURCE_WIDTH = 160;
const CHAT_PET_SING_SOURCE_WIDTH = 164;
const CHAT_PET_SING_SOURCE_HEIGHT = 124;
const CHAT_PET_MAX_VERTICAL_OFFSET = 10;
const CHAT_PET_DEFAULT_RIGHT_INSET = 32;
const CHAT_PET_MIN_SCALE = 0.4;
const CHAT_PET_SCALE_STEP = 0.2;
const CHAT_PET_SPEECH_BUBBLE_RIGHT_OVERHANG = 20;
const CHAT_PET_TYPING_RIGHT_OVERHANG = (CHAT_PET_TYPING_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
const CHAT_PET_BUTTON_PRESS_RIGHT_OVERHANG = (CHAT_PET_BUTTON_PRESS_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
const CHAT_PET_SING_RIGHT_OVERHANG = (CHAT_PET_SING_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
const IDLE_FRAME_DURATIONS = Array.from({ length: 50 }, () => 40);
const SLEEP_FRAME_DURATIONS = Array.from({ length: 8 }, () => 300);
const WAKE_FRAME_DURATIONS = [160, 100, 80, 90, 90, 90, 100, 170];
const TYPING_FRAME_DURATIONS = [400, 600];
const BUTTON_PRESS_FRAME_DURATIONS = [500, 300, 350, 250, 450, 1e3];
const FALLING_FRAME_DURATIONS = Array.from({ length: 4 }, () => 120);
const JUMP_FRAME_DURATIONS = [70, 80, 90, 160, 100, 100];
const SPLAT_FRAME_DURATIONS = [120, 100, 100, 200];
const RESPAWN_FRAME_DURATIONS = [120, 100, 120, 240, 100, 120];
const SPEECH_FRAME_DURATIONS = [220, 220, 220, 100, 160, 180];
const CLAPPING_FRAME_DURATIONS = [80, 40, 40, 40, 80, 40, 40, 40, 40, 80, 40, 40, 80];
const LOVE_FRAME_DURATIONS = [200, 200, 380, 100, 80, 1980];
const COOL_FRAME_DURATIONS = [600, 120, 120, 120, 160, 80, 80, 80, 1640];
const SING_FRAME_DURATIONS = [180, 180, 180, 180];
const SPEECHLESS_FRAME_DURATIONS = [400, 120, 1e3, 120, 1080];
const WORRY_FRAME_DURATIONS = [600, 600];
const SEARCH_FRAME_DURATIONS = [500, 500, 500, 500];
function getChatPetBuddyName(quality) {
  return quality === "stable" ? "buddy-idle-stable" : "buddy-idle-insiders";
}
const spriteSources = /* @__PURE__ */ new Map();
const speechSpriteSources = /* @__PURE__ */ new Map();
const respawnSpriteSources = /* @__PURE__ */ new Map();
function doesChatPetStateTrackCursor(state) {
  return state !== void 0 && state !== "sleep" && state !== "waking" && state !== "typing" && state !== "buttonPress" && state !== "complete" && state !== "jump" && state !== "love" && state !== "cool" && state !== "yappingMouthOpen" && state !== "sing" && state !== "speechless" && state !== "worry" && state !== "falling" && state !== "splat" && state !== "onTheRun" && state !== "searching" && state !== "searchingDown";
}
function getChatPetSpriteName(state, quality) {
  const variant = quality === "stable" ? "stable" : "insiders";
  switch (state) {
    case "love":
      return `buddy-love-${variant}`;
    case "clapping":
      return `buddy-clapping-${variant}`;
    case "cool":
      return `buddy-cool-${variant}`;
    case "buttonPress":
      return `buddy-press-button-${variant}`;
    case "falling":
      return `buddy-falling-${variant}`;
    case "jump":
      return `buddy-jump-${variant}`;
    case "splat":
      return `buddy-splat-${variant}`;
    case "onTheRun":
    case "searching":
    case "searchingDown":
      return `buddy-search-${variant}`;
    case "sleep":
      return `buddy-sleep-${variant}`;
    case "waking":
      return `buddy-waking-${variant}`;
    case "typing":
      return `buddy-typing-${variant}`;
    case "rendering":
      return `buddy-rendering-${variant}`;
    case "yappingMouthOpen":
      return `buddy-yapping-${variant}`;
    case "sing":
    case "speechless":
    case "worry":
      return `buddy-${state}-${variant}`;
    default:
      return getChatPetBuddyName(quality);
  }
}
function getChatPetFrameDurations(state) {
  switch (state) {
    case "sleep":
      return SLEEP_FRAME_DURATIONS;
    case "waking":
      return WAKE_FRAME_DURATIONS;
    case "typing":
      return TYPING_FRAME_DURATIONS;
    case "buttonPress":
      return BUTTON_PRESS_FRAME_DURATIONS;
    case "falling":
      return FALLING_FRAME_DURATIONS;
    case "jump":
      return JUMP_FRAME_DURATIONS;
    case "splat":
      return SPLAT_FRAME_DURATIONS;
    case "rendering":
      return IDLE_FRAME_DURATIONS;
    case "clapping":
      return CLAPPING_FRAME_DURATIONS;
    case "love":
      return LOVE_FRAME_DURATIONS;
    case "cool":
      return COOL_FRAME_DURATIONS;
    case "sing":
      return SING_FRAME_DURATIONS;
    case "speechless":
      return SPEECHLESS_FRAME_DURATIONS;
    case "worry":
      return WORRY_FRAME_DURATIONS;
    case "searching":
      return SEARCH_FRAME_DURATIONS;
    case "onTheRun":
    case "searchingDown":
      return [];
    case "yappingMouthOpen":
    case "yapping":
      return [];
    default:
      return IDLE_FRAME_DURATIONS;
  }
}
function createSpriteSources(name, state, tracksCursor = true, sourceWidth, sourceHeight = CHAT_PET_SOURCE_SIZE) {
  const root = "vs/workbench/contrib/chat/browser/widget/media/chatPet";
  const suffix = tracksCursor ? "-tracking-96" : `-${sourceHeight}`;
  const frameDurations = getChatPetFrameDurations(state);
  const frameWidth = sourceWidth ?? (state === "typing" ? CHAT_PET_TYPING_SOURCE_WIDTH : state === "buttonPress" ? CHAT_PET_BUTTON_PRESS_SOURCE_WIDTH : CHAT_PET_SOURCE_SIZE);
  const staticSource = {
    url: FileAccess.asBrowserUri(`${root}/${name}${suffix}.png`).toString(true),
    frameWidth,
    frameHeight: sourceHeight,
    frameDurations: [],
    iterations: 1
  };
  return {
    animated: frameDurations.length === 0 ? staticSource : {
      url: FileAccess.asBrowserUri(`${root}/${name}${suffix}.spritesheet.png`).toString(true),
      frameWidth,
      frameHeight: sourceHeight,
      frameDurations,
      iterations: state === "waking" || state === "buttonPress" || state === "cool" || state === "splat" || state === "searching" || state === "jump" ? 1 : Infinity
    },
    reducedMotion: staticSource
  };
}
function getChatPetSpeechFrameDurations() {
  return SPEECH_FRAME_DURATIONS;
}
function getChatPetRespawnFrameDurations() {
  return RESPAWN_FRAME_DURATIONS;
}
function getSpriteSources(variant) {
  let sources = spriteSources.get(variant);
  if (!sources) {
    const createStateSpriteSources = (state) => createSpriteSources(getChatPetSpriteName(state, variant), state, doesChatPetStateTrackCursor(state));
    sources = {
      idle: createStateSpriteSources("idle"),
      sleep: createStateSpriteSources("sleep"),
      waking: createStateSpriteSources("waking"),
      typing: createStateSpriteSources("typing"),
      rendering: createStateSpriteSources("rendering"),
      buttonPress: createStateSpriteSources("buttonPress"),
      complete: createStateSpriteSources("complete"),
      love: createStateSpriteSources("love"),
      clapping: createStateSpriteSources("clapping"),
      jump: createStateSpriteSources("jump"),
      cool: createStateSpriteSources("cool"),
      yapping: createStateSpriteSources("yapping"),
      yappingMouthOpen: createStateSpriteSources("yappingMouthOpen"),
      sing: createSpriteSources(getChatPetSpriteName("sing", variant), "sing", false, CHAT_PET_SING_SOURCE_WIDTH, CHAT_PET_SING_SOURCE_HEIGHT),
      speechless: createStateSpriteSources("speechless"),
      worry: createStateSpriteSources("worry"),
      falling: createStateSpriteSources("falling"),
      splat: createStateSpriteSources("splat"),
      onTheRun: createStateSpriteSources("onTheRun"),
      searching: createStateSpriteSources("searching"),
      searchingDown: createStateSpriteSources("searchingDown")
    };
    spriteSources.set(variant, sources);
  }
  return sources;
}
function getSpeechSpriteSources(variant) {
  let sources = speechSpriteSources.get(variant);
  if (!sources) {
    const root = "vs/workbench/contrib/chat/browser/widget/media/chatPet";
    const name = `buddy-speech-${variant}-96`;
    sources = {
      animated: {
        url: FileAccess.asBrowserUri(`${root}/${name}.spritesheet.png`).toString(true),
        frameWidth: CHAT_PET_SOURCE_SIZE,
        frameDurations: SPEECH_FRAME_DURATIONS,
        iterations: Infinity
      },
      reducedMotion: {
        url: FileAccess.asBrowserUri(`${root}/${name}.png`).toString(true),
        frameWidth: CHAT_PET_SOURCE_SIZE,
        frameDurations: [],
        iterations: 1
      }
    };
    speechSpriteSources.set(variant, sources);
  }
  return sources;
}
function getRespawnSpriteSources(variant) {
  let sources = respawnSpriteSources.get(variant);
  if (!sources) {
    const root = "vs/workbench/contrib/chat/browser/widget/media/chatPet";
    const name = `buddy-respawn-${variant}-96`;
    sources = {
      animated: {
        url: FileAccess.asBrowserUri(`${root}/${name}.spritesheet.png`).toString(true),
        frameWidth: CHAT_PET_SOURCE_SIZE,
        frameDurations: RESPAWN_FRAME_DURATIONS,
        iterations: 1
      },
      reducedMotion: {
        url: FileAccess.asBrowserUri(`${root}/${name}.png`).toString(true),
        frameWidth: CHAT_PET_SOURCE_SIZE,
        frameDurations: [],
        iterations: 1
      }
    };
    respawnSpriteSources.set(variant, sources);
  }
  return sources;
}
function doesChatPetStateSpeak(state) {
  return state === "rendering";
}
function isChatPetImageSource(image, source) {
  return image.getAttribute("src") === source;
}
function getChatPetBaseState(hasActiveRequest, needsInput, hasInput, idleExpired) {
  if (needsInput) {
    return "clapping";
  }
  if (hasActiveRequest) {
    return "rendering";
  }
  if (idleExpired) {
    return "sleep";
  }
  if (hasInput) {
    return "typing";
  }
  return "idle";
}
function isChatPetVisible(enabled, isLatestFocusedWidget) {
  return enabled && isLatestFocusedWidget;
}
function isChatPetYapState(state) {
  return state === "yapping" || state === "yappingMouthOpen";
}
function getChatPetRenderedState(baseState, transientState, isDragging) {
  if (isDragging) {
    return "idle";
  }
  if (isChatPetYapState(transientState) && baseState !== "idle") {
    return baseState;
  }
  return transientState ?? baseState;
}
function getChatPetAnimationFrame(frameDurations, elapsed, iterations) {
  if (frameDurations.length === 0) {
    return { frameIndex: 0, complete: true };
  }
  const totalDuration = frameDurations.reduce((total, duration) => total + duration, 0);
  if (elapsed >= totalDuration * iterations) {
    return { frameIndex: frameDurations.length - 1, complete: true };
  }
  const iterationElapsed = Math.max(0, elapsed) % totalDuration;
  let frameEnd = 0;
  for (let frameIndex = 0; frameIndex < frameDurations.length; frameIndex++) {
    frameEnd += frameDurations[frameIndex];
    if (iterationElapsed < frameEnd) {
      return { frameIndex, complete: false, nextFrameDelay: frameEnd - iterationElapsed };
    }
  }
  return { frameIndex: frameDurations.length - 1, complete: false, nextFrameDelay: totalDuration };
}
function getTransientStateDuration(state) {
  switch (state) {
    case "buttonPress":
      return BUTTON_PRESS_STATE_DURATION;
    case "complete":
      return COMPLETE_STATE_DURATION;
    case "splat":
      return SPLAT_STATE_DURATION;
    case "love":
      return LOVE_STATE_DURATION;
    case "cool":
      return COOL_STATE_DURATION;
    case "sing":
      return SING_STATE_DURATION;
    case "speechless":
      return SPEECHLESS_STATE_DURATION;
    case "worry":
      return WORRY_STATE_DURATION;
    case "waking":
      return WAKE_STATE_DURATION;
    default:
      return TRANSIENT_STATE_DURATION;
  }
}
function getChatPetClickInteraction(random, previousInteraction) {
  if (random < 0.01) {
    return "complete";
  }
  const interactions = ["buttonPress", "love", "cool", "yapping", "sing", "speechless", "worry"];
  const availableInteractions = interactions.filter((interaction) => interaction !== previousInteraction);
  const normalizedRandom = (random - 0.01) / 0.99;
  return availableInteractions[Math.min(Math.floor(normalizedRandom * availableInteractions.length), availableInteractions.length - 1)];
}
function getChatPetGazeDirection(cursorX, cursorY, petCenterX, petCenterY) {
  const deltaX = cursorX - petCenterX;
  const deltaY = cursorY - petCenterY;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance === 0) {
    return [0, 0];
  }
  return [
    Math.round(deltaX / distance),
    Math.round(deltaY / distance)
  ];
}
function getChatPetHorizontalPosition(left, minimumLeft, maximumLeft) {
  return Math.max(minimumLeft, Math.min(Math.max(minimumLeft, maximumLeft), left));
}
function getChatPetDefaultHorizontalPosition(minimumLeft, maximumLeft) {
  return Math.max(minimumLeft, maximumLeft - CHAT_PET_DEFAULT_RIGHT_INSET);
}
function getChatPetScale(scale, delta) {
  return Math.max(CHAT_PET_MIN_SCALE, Math.round((scale + delta) * 10) / 10);
}
function getChatPetDragPosition(left, top, minimumLeft, maximumLeft, minimumTop, maximumTop) {
  return [
    getChatPetHorizontalPosition(left, minimumLeft, maximumLeft),
    Math.max(minimumTop, Math.min(Math.max(minimumTop, maximumTop), top))
  ];
}
function getChatPetFallTarget(petLeft, petTop, petWidth, petHeight, platformLeft, platformRight, platformTop, floorTop) {
  const petCenter = petLeft + petWidth / 2;
  const landsOnPlatform = petCenter >= platformLeft && petCenter <= platformRight && petTop + petHeight <= platformTop;
  return {
    top: landsOnPlatform ? platformTop - petHeight : floorTop,
    landsOnPlatform
  };
}
function getChatPetFallDuration(distance) {
  return Math.max(180, Math.min(700, Math.sqrt(Math.abs(distance)) * 20));
}
function getChatPetVerticalOffset(hostTop, inputTop) {
  return Math.max(0, Math.min(CHAT_PET_MAX_VERTICAL_OFFSET, inputTop - hostTop));
}
function getChatPetPlatformTop(hostTop, inputTop, substantiveSurfaceTop) {
  if (substantiveSurfaceTop !== void 0 && substantiveSurfaceTop >= hostTop && substantiveSurfaceTop <= inputTop) {
    return substantiveSurfaceTop;
  }
  return hostTop + getChatPetVerticalOffset(hostTop, inputTop);
}
function shouldPlaceChatPetSpeechBubbleLeft(state, buttonRight, inputRight, scale = 1) {
  return state === "rendering" && buttonRight + CHAT_PET_SPEECH_BUBBLE_RIGHT_OVERHANG * scale > inputRight;
}
function shouldFlipChatPetWideSprite(state, buttonRight, inputRight, scale = 1) {
  const rightOverhang = state === "typing" ? CHAT_PET_TYPING_RIGHT_OVERHANG : state === "buttonPress" ? CHAT_PET_BUTTON_PRESS_RIGHT_OVERHANG : state === "sing" ? CHAT_PET_SING_RIGHT_OVERHANG : 0;
  return rightOverhang > 0 && buttonRight + rightOverhang * scale > inputRight;
}
class ChatPetHopController extends Disposable {
  constructor(callbacks) {
    super();
    this.callbacks = callbacks;
    this._stepScheduler = this._register(new RunOnceScheduler(() => this._applyStep(), HOP_APEX_DELAY));
    this._restScheduler = this._register(new RunOnceScheduler(() => this._beginHop(), HOP_REST_DELAY));
    this._direction = 0;
    this._heldUntil = 0;
    this._active = false;
  }
  request(direction, motionReduced) {
    this._direction = direction;
    this.callbacks.onDirectionChange(direction);
    this.callbacks.onRequest();
    if (motionReduced) {
      this.cancel();
      this.callbacks.onMove(direction * HOP_DISTANCE);
      this.callbacks.onReducedMotionStart();
      return;
    }
    this._heldUntil = Date.now() + HOP_HOLD_GRACE;
    if (!this._active) {
      this._beginHop();
    }
  }
  cancel() {
    this._active = false;
    this._direction = 0;
    this._heldUntil = 0;
    this._stepScheduler.cancel();
    this._restScheduler.cancel();
  }
  onAnimationComplete() {
    if (!this._active) {
      return;
    }
    if (Date.now() < this._heldUntil) {
      this._restScheduler.schedule();
    } else {
      this._active = false;
    }
  }
  _beginHop() {
    this._active = true;
    this.callbacks.onStart();
    this._stepScheduler.schedule();
  }
  _applyStep() {
    if (!this._active || this._direction === 0) {
      return;
    }
    this.callbacks.onMove(this._direction * HOP_DISTANCE);
  }
}
let ChatPetWidget = class extends Disposable {
  constructor(parent, dragBounds, movementBounds, model, hasInput, isLatestFocusedWidget, inputChanged, chatPetService, accessibilityService, contextMenuService) {
    super();
    this.parent = parent;
    this.dragBounds = dragBounds;
    this.movementBounds = movementBounds;
    this.chatPetService = chatPetService;
    this.accessibilityService = accessibilityService;
    this.contextMenuService = contextMenuService;
    this._pupils = [];
    this._dragMonitor = this._register(new GlobalPointerMoveMonitor());
    this._idleExpired = observableValue(this, false);
    this._transientState = observableValue(this, void 0);
    this._isDragging = observableValue(this, false);
    this._isDead = observableValue(this, false);
    this._idleScheduler = this._register(new RunOnceScheduler(() => this._idleExpired.set(true, void 0), CHAT_PET_IDLE_SLEEP_DELAY));
    this._transientScheduler = this._register(new RunOnceScheduler(() => this._transientState.set(void 0, void 0), TRANSIENT_STATE_DURATION));
    this._clickSuppressionScheduler = this._register(new RunOnceScheduler(() => this._suppressNextPointerClick = false, 0));
    this._spriteAnimation = this._register(new MutableDisposable());
    this._speechAnimation = this._register(new MutableDisposable());
    this._respawnAnimation = this._register(new MutableDisposable());
    this._respawnEffectScheduler = this._register(new RunOnceScheduler(() => this._showRespawnEffect(), RESPAWN_SIGN_DURATION));
    this._respawnFallScheduler = this._register(new RunOnceScheduler(() => this._beginRespawnFall(), RESPAWN_EFFECT_DURATION));
    this._hopController = this._register(new ChatPetHopController({
      onDirectionChange: (direction) => this._button.element.dataset.hopDirection = direction < 0 ? "left" : "right",
      onMove: (delta) => this._setHorizontalPosition(this._getCurrentLeft() + delta),
      onStart: () => {
        if (this._transientState.get() === "jump") {
          this._renderState("jump", true);
        } else {
          this._transientState.set("jump", void 0);
        }
      },
      onReducedMotionStart: () => this._transientState.set("jump", void 0),
      onRequest: () => this._transientScheduler.schedule(HOP_IDLE_DEBOUNCE)
    }));
    this._contextMenuActions = this._register(new MutableDisposable());
    this._motionReduced = false;
    this._enabled = false;
    this._busy = false;
    this._enablementInitialized = false;
    this._hasCustomPosition = false;
    this._suppressNextPointerClick = false;
    this._contextMenuVisible = false;
    this._fallLandsOnPlatform = false;
    this._respawnPhase = "none";
    this._scale = 1;
    this._variant = this.chatPetService.variant.get();
    this._serviceEnabled = this.chatPetService.enabled.get();
    this._searchScheduler = this._register(new RunOnceScheduler(() => this._trySearch(), SEARCH_INTERVAL));
    this.parent.classList.add("chat-pet-host");
    this._overlay = dom.$(".chat-pet-overlay");
    this.parent.prepend(this._overlay);
    this._register(toDisposable(() => this._overlay.remove()));
    this._button = this._register(new Button(this._overlay, {
      ariaLabel: this._getAriaLabel(false)
    }));
    this._button.element.classList.add("chat-pet-button");
    this._visual = dom.append(this._button.element, dom.$(".chat-pet-visual"));
    this._reviveSign = dom.append(this._overlay, dom.$(".chat-pet-revive-sign.hidden"));
    this._reviveSign.setAttribute("aria-hidden", "true");
    this._reviveImage = dom.append(this._reviveSign, dom.$("img.chat-pet-revive-image"));
    this._reviveImage.alt = "";
    this._reviveImage.setAttribute("aria-hidden", "true");
    const respawnEffectCanvas = dom.append(this._overlay, dom.$("canvas.chat-pet-canvas.chat-pet-respawn-effect.hidden"));
    respawnEffectCanvas.width = CHAT_PET_SOURCE_SIZE;
    respawnEffectCanvas.height = CHAT_PET_SOURCE_SIZE;
    respawnEffectCanvas.setAttribute("aria-hidden", "true");
    const respawnEffectImage = dom.append(this._overlay, dom.$("img.chat-pet-spritesheet"));
    respawnEffectImage.alt = "";
    respawnEffectImage.setAttribute("aria-hidden", "true");
    this._respawnEffect = { container: respawnEffectCanvas, image: respawnEffectImage, canvas: respawnEffectCanvas };
    this._register(dom.addDisposableListener(respawnEffectImage, "load", () => this._startRespawnEffectAnimation()));
    this._resizeObserver = this._register(new dom.DisposableResizeObserver("ChatPetWidget.dragBounds", () => {
      this._updateSpeechBubblePosition();
      if (this._isDead.get()) {
        if (this._respawnPhase === "effect") {
          this._updateRespawnEffectPosition();
        } else {
          this._updateRevivePosition();
        }
      } else if (this._fallLandsOnPlatform && !this._isDragging.get() && !this._button.element.classList.contains("falling")) {
        if (this._hasCustomPosition) {
          this._setPlatformPosition(this._getCurrentLeft());
        } else {
          this._setDefaultPlatformPosition();
        }
      } else {
        this._updateVerticalPosition();
        if (this._hasCustomPosition && !this._isDragging.get() && !this._button.element.classList.contains("falling")) {
          this._setHorizontalPosition(this._getCurrentLeft());
        } else if (!this._isDragging.get() && !this._button.element.classList.contains("falling")) {
          this._setDefaultHorizontalPosition();
        }
      }
    }, dom.getWindow(this._button.element)));
    this._register(this._resizeObserver.observe(this.dragBounds));
    this._register(this._resizeObserver.observe(this.movementBounds));
    this._register(this._resizeObserver.observe(this.parent));
    this._updateVerticalPosition();
    this._setDefaultHorizontalPosition();
    this._updateSpeechBubblePosition();
    this._sprites = [0, 1].map(() => {
      const container = dom.append(this._visual, dom.$(".chat-pet-sprite.hidden"));
      const canvas = dom.append(container, dom.$("canvas.chat-pet-canvas"));
      canvas.width = CHAT_PET_SOURCE_SIZE;
      canvas.height = CHAT_PET_SOURCE_SIZE;
      canvas.setAttribute("aria-hidden", "true");
      const image = dom.append(container, dom.$("img.chat-pet-spritesheet"));
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      const sprite = { container, image, canvas };
      this._register(dom.addDisposableListener(image, "load", () => this._onImageLoad(sprite)));
      return sprite;
    });
    this._eyes = dom.append(this._visual, dom.$(".chat-pet-eyes"));
    this._eyes.setAttribute("aria-hidden", "true");
    for (const side of ["left", "right"]) {
      const eye = dom.append(this._eyes, dom.$(`.chat-pet-eye.${side}`));
      this._pupils.push(dom.append(eye, dom.$(".chat-pet-pupil")));
    }
    const speechBubbleContainer = dom.append(this._visual, dom.$(".chat-pet-speech-bubble.hidden"));
    const speechBubbleCanvas = dom.append(speechBubbleContainer, dom.$("canvas.chat-pet-canvas.chat-pet-speech-canvas"));
    speechBubbleCanvas.width = CHAT_PET_SOURCE_SIZE;
    speechBubbleCanvas.height = CHAT_PET_SOURCE_SIZE;
    speechBubbleCanvas.setAttribute("aria-hidden", "true");
    const speechBubbleImage = dom.append(speechBubbleContainer, dom.$("img.chat-pet-spritesheet"));
    speechBubbleImage.alt = "";
    speechBubbleImage.setAttribute("aria-hidden", "true");
    this._speechBubble = { container: speechBubbleContainer, image: speechBubbleImage, canvas: speechBubbleCanvas };
    this._register(dom.addDisposableListener(speechBubbleImage, "load", () => this._updateSpeechBubble(this._renderedState, true)));
    this._gazeScheduler = this._register(new dom.AnimationFrameScheduler(this._button.element, () => this._updateGaze()));
    this._register(dom.addDisposableListener(dom.getWindow(this._button.element).document, dom.EventType.POINTER_MOVE, (event) => {
      this._cursorPosition = [event.clientX, event.clientY];
      if (this._enabled && doesChatPetStateTrackCursor(this._renderedState)) {
        this._gazeScheduler.schedule();
      }
    }));
    const onAnimationComplete = (event) => {
      if (event.animationName === "chat-pet-enter") {
        this._button.element.classList.remove("entering");
      } else if (event.animationName === "chat-pet-exit" && !this._enabled) {
        this._finishDisable();
      } else if (event.animationName === "chat-pet-yapping-fall" && !this._isDragging.get() && event.target === this._activeSprite?.container && this._button.element.dataset.state === "yapping") {
        this._transientState.set("yappingMouthOpen", void 0);
      } else if (event.animationName === "chat-pet-search-down" && this._button.element.dataset.state === "searchingDown") {
        this._transientState.set(void 0, void 0);
      }
    };
    this._register(dom.addDisposableListener(this._button.element, dom.EventType.ANIMATION_END, onAnimationComplete));
    this._register(dom.addDisposableListener(this._button.element, "animationcancel", onAnimationComplete));
    const onTransitionComplete = (event) => {
      if (event.propertyName === "top" && this._button.element.classList.contains("falling")) {
        this._finishFall();
      }
    };
    this._register(dom.addDisposableListener(this._button.element, "transitionend", onTransitionComplete));
    this._register(dom.addDisposableListener(this._button.element, "transitioncancel", onTransitionComplete));
    this._register(dom.addDisposableListener(this._button.element, dom.EventType.POINTER_DOWN, (event) => this._startDrag(event)));
    this._register(dom.addDisposableListener(this._button.element, dom.EventType.KEY_DOWN, (event) => this._onKeyDown(event)));
    this._register(dom.addDisposableListener(this._button.element, dom.EventType.CONTEXT_MENU, (event) => {
      if (!this._enabled) {
        return;
      }
      dom.EventHelper.stop(event, true);
      this._showContextMenu(event);
    }));
    this._register(inputChanged(() => {
      if (this._enabled && !this.chatPetService.onTheRun.get()) {
        this._wake();
      }
    }));
    this._register(this._button.onDidClick((e) => {
      dom.EventHelper.stop(e, true);
      if (this._contextMenuVisible) {
        return;
      }
      if (this._suppressNextPointerClick && e.type !== dom.EventType.KEY_DOWN) {
        this._suppressNextPointerClick = false;
        this._clickSuppressionScheduler.cancel();
        return;
      }
      if (this.chatPetService.onTheRun.get()) {
        this._transientState.set(void 0, void 0);
        this.chatPetService.setOnTheRun(false);
        return;
      }
      const wasSleeping = this._idleExpired.get() || this._renderedState === "sleep";
      if (wasSleeping) {
        this._wake();
      }
      if (wasSleeping || this._transientState.get() === "waking") {
        status(localize("chatPet.wokeUp", "The VS Code pet woke up"));
        return;
      }
      const interaction = getChatPetClickInteraction(Math.random(), this._lastClickInteraction);
      this._lastClickInteraction = interaction;
      this._showTransientState(interaction);
      switch (interaction) {
        case "buttonPress":
          status(localize("chatPet.pressedButton", "The VS Code pet pressed its button"));
          break;
        case "complete":
          status(localize("chatPet.spun", "The VS Code pet did a rare spin"));
          break;
        case "love":
          status(localize("chatPet.loved", "The VS Code pet feels loved"));
          break;
        case "cool":
          status(localize("chatPet.cool", "The VS Code pet put on sunglasses"));
          break;
        case "yapping":
          status(localize("chatPet.yapping", "The VS Code pet is yapping"));
          break;
        case "sing":
          status(localize("chatPet.singing", "The VS Code pet is singing"));
          break;
        case "speechless":
          status(localize("chatPet.speechless", "The VS Code pet is speechless"));
          break;
        case "worry":
          status(localize("chatPet.worried", "The VS Code pet is worried"));
          break;
      }
    }));
    const motionReduced = observableFromEvent(this, this.accessibilityService.onDidChangeReducedMotion, () => this.accessibilityService.isMotionReduced());
    this._register(autorun((reader) => {
      this._motionReduced = motionReduced.read(reader);
      const serviceEnabled = this.chatPetService.enabled.read(reader);
      if (serviceEnabled !== this._serviceEnabled) {
        this._serviceEnabled = serviceEnabled;
        if (!serviceEnabled) {
          this._setScale(1);
        }
      }
      const enabled = isChatPetVisible(serviceEnabled, isLatestFocusedWidget.read(reader));
      const variant = this.chatPetService.variant.read(reader);
      const variantChanged = variant !== this._variant;
      this._variant = variant;
      const onTheRun = this.chatPetService.onTheRun.read(reader);
      const isDead = this._isDead.read(reader);
      this._button.element.classList.toggle("on-the-run", onTheRun);
      this._button.setAriaLabel(this._getAriaLabel(onTheRun));
      const chatModel = model.read(reader);
      const request = chatModel?.lastRequestObs.read(reader);
      const needsInput = !!request?.response?.isPendingConfirmation.read(reader);
      const hasActiveRequest = chatModel?.hasActiveRequest.read(reader) ?? false;
      const inputHasContent = hasInput.read(reader);
      this._busy = hasActiveRequest || needsInput;
      let idleExpired = this._idleExpired.read(reader);
      let transientState = this._transientState.read(reader);
      const isDragging = this._isDragging.read(reader);
      if (!this._enablementInitialized || enabled !== this._enabled) {
        const wasInitialized = this._enablementInitialized;
        this._enablementInitialized = true;
        this._enabled = enabled;
        if (enabled) {
          if (isDead) {
            this._showReviveSign();
          } else {
            this._startEnableAnimation();
          }
        } else if (wasInitialized) {
          this._startDisableAnimation();
        } else {
          this._finishDisable();
        }
      }
      if (!enabled) {
        this._hopController.cancel();
        this._idleScheduler.cancel();
        this._searchScheduler.cancel();
        this._transientScheduler.cancel();
        if (transientState !== void 0) {
          this._transientState.set(void 0, void 0);
        }
        if (this._motionReduced) {
          this._finishDisable();
        }
        return;
      }
      if (isDead) {
        this._hopController.cancel();
        this._idleScheduler.cancel();
        this._searchScheduler.cancel();
        this._transientScheduler.cancel();
        this._showReviveSign();
        return;
      }
      this._hideReviveSign();
      if (onTheRun) {
        this._hopController.cancel();
        this._idleScheduler.cancel();
        if (!this._searchScheduler.isScheduled()) {
          this._searchScheduler.schedule();
        }
        const state = transientState === "searching" || transientState === "searchingDown" ? transientState : "onTheRun";
        this._renderState(state, variantChanged);
        return;
      }
      this._searchScheduler.cancel();
      if (this._busy) {
        this._idleScheduler.cancel();
        if (idleExpired) {
          idleExpired = false;
          this._idleExpired.set(false, void 0);
          transientState = this._beginWakeAnimation() ?? transientState;
        }
      } else if (!idleExpired && !this._idleScheduler.isScheduled()) {
        this._idleScheduler.schedule();
      }
      const baseState = getChatPetBaseState(hasActiveRequest, needsInput, inputHasContent, idleExpired);
      if (isChatPetYapState(transientState) && baseState !== "idle") {
        transientState = void 0;
        this._transientState.set(void 0, void 0);
      }
      const renderedState = getChatPetRenderedState(baseState, transientState, isDragging);
      if (renderedState !== "jump" || this._motionReduced) {
        this._hopController.cancel();
      }
      this._renderState(renderedState, variantChanged, isDragging);
    }));
    this._register(autorun((reader) => {
      const chatModel = model.read(reader);
      const response = chatModel?.lastRequestObs.read(reader)?.response;
      if (!response) {
        return;
      }
      reader.store.add(response.onDidChange((e) => {
        if (e.reason === "completedRequest" && !response.isCanceled) {
          this._showTransientState("buttonPress");
        }
      }));
    }));
  }
  setPlatformTopProvider(provider) {
    this._platformTopProvider = provider;
    this._updateVerticalPosition();
    if (this._fallLandsOnPlatform && !this._isDragging.get() && !this._button.element.classList.contains("falling")) {
      if (this._hasCustomPosition) {
        this._setPlatformPosition(this._getCurrentLeft());
      } else {
        this._setDefaultPlatformPosition();
      }
    }
  }
  _startDrag(event) {
    if (!this._enabled || this._isDead.get() || this._isDragging.get() || this.chatPetService.onTheRun.get() || event.button !== 0) {
      return;
    }
    this._wake();
    dom.EventHelper.stop(event);
    this._button.element.focus();
    const startX = event.clientX;
    const startY = event.clientY;
    const buttonBounds = this._button.element.getBoundingClientRect();
    const overlayBounds = this._overlay.getBoundingClientRect();
    const startLeft = buttonBounds.left - overlayBounds.left;
    const startTop = buttonBounds.top - overlayBounds.top;
    let didDrag = false;
    this._dragMonitor.startMonitoring(this._button.element, event.pointerId, event.buttons, (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (!didDrag && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
        return;
      }
      if (!didDrag) {
        didDrag = true;
        this._button.element.classList.remove("entering");
        this._button.element.classList.add("dragging");
        this._spriteAnimation.clear();
        this._setDragPosition(startLeft, startTop);
        this._isDragging.set(true, void 0);
      }
      dom.EventHelper.stop(moveEvent, true);
      this._setDragPosition(startLeft + deltaX, startTop + deltaY);
    }, () => {
      this._button.element.classList.remove("dragging", "resisting", "soft-resisting");
      if (didDrag) {
        this._suppressNextPointerClick = true;
        this._clickSuppressionScheduler.schedule();
        this._beginFall();
      }
    });
  }
  _setDragPosition(left, top) {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const movementBounds = this.movementBounds.getBoundingClientRect();
    const minimumLeft = movementBounds.left - overlayBounds.left;
    const maximumLeft = movementBounds.right - overlayBounds.left - this._button.element.offsetWidth;
    const minimumTop = movementBounds.top - overlayBounds.top;
    const maximumTop = movementBounds.bottom - overlayBounds.top - this._button.element.offsetHeight;
    const [clampedLeft, clampedTop] = getChatPetDragPosition(left, top, minimumLeft, maximumLeft, minimumTop, maximumTop);
    this._button.element.style.left = `${clampedLeft}px`;
    this._button.element.style.top = `${clampedTop}px`;
    this._button.element.style.right = "auto";
    this._button.element.style.bottom = "auto";
    this._hasCustomPosition = true;
    this._updateSpeechBubblePosition();
    if (this._button.element.classList.contains("dragging")) {
      this._updateDragWiggle();
    }
  }
  _getFallTarget() {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const platformBounds = this._getPlatformBounds();
    const movementBounds = this.movementBounds.getBoundingClientRect();
    return getChatPetFallTarget(
      Number.parseFloat(this._button.element.style.left),
      Number.parseFloat(this._button.element.style.top),
      this._getDisplaySize(),
      this._getDisplaySize(),
      platformBounds.left - overlayBounds.left,
      platformBounds.right - overlayBounds.left,
      platformBounds.top - overlayBounds.top,
      movementBounds.bottom - overlayBounds.top
    );
  }
  _updateDragWiggle() {
    const landsOnPlatform = this._getFallTarget().landsOnPlatform;
    this._button.element.classList.toggle("soft-resisting", landsOnPlatform);
    this._button.element.classList.toggle("resisting", !landsOnPlatform);
  }
  _beginFall() {
    const top = Number.parseFloat(this._button.element.style.top);
    const target = this._getFallTarget();
    this._button.element.classList.remove("resisting", "soft-resisting");
    this._fallLandsOnPlatform = target.landsOnPlatform;
    this._transientState.set("falling", void 0);
    this._isDragging.set(false, void 0);
    this._renderState("falling", true);
    this._button.element.style.transitionDuration = `${getChatPetFallDuration(target.top - top)}ms`;
    this._button.element.getBoundingClientRect();
    this._button.element.classList.add("falling");
    this._button.element.style.top = `${target.top}px`;
    if (this._motionReduced || Math.abs(target.top - top) <= POSITION_EPSILON) {
      this._finishFall();
    }
  }
  _finishFall(announce = true) {
    if (!this._button.element.classList.contains("falling")) {
      return;
    }
    this._button.element.classList.remove("falling");
    this._button.element.style.transitionDuration = "";
    if (this._fallLandsOnPlatform) {
      const respawned = this._respawnPhase === "falling";
      this._respawnPhase = "none";
      this._respawnPosition = void 0;
      const left = this._getCurrentLeft();
      this._setPlatformPosition(left);
      if (announce) {
        this._showTransientState("splat");
        status(respawned ? localize("chatPet.respawned", "The VS Code pet respawned") : localize("chatPet.landed", "The VS Code pet landed on the chat input"));
      }
      return;
    }
    this._deathPosition = [this._button.element.offsetLeft, this._button.element.offsetTop];
    this._respawnPhase = "none";
    this._respawnPosition = void 0;
    this._isDead.set(true, void 0);
    if (announce) {
      status(localize("chatPet.fellOff", "The VS Code pet fell off and will respawn automatically"));
    }
  }
  _showContextMenu(event) {
    this._contextMenuVisible = true;
    const onTheRun = this.chatPetService.onTheRun.get();
    const actions = new DisposableStore();
    this._contextMenuActions.value = actions;
    const stable = actions.add(new Action("chat.pet.variant.stable", localize("chatPet.variant.stable.action", "Stable Colors"), void 0, true, () => this.chatPetService.setVariant("stable")));
    stable.checked = this.chatPetService.variant.get() === "stable";
    const insiders = actions.add(new Action("chat.pet.variant.insiders", localize("chatPet.variant.insiders.action", "Insiders Colors"), void 0, true, () => this.chatPetService.setVariant("insiders")));
    insiders.checked = this.chatPetService.variant.get() === "insiders";
    const grow = actions.add(new Action("chat.pet.grow", localize("chatPet.grow.action", "Grow"), void 0, true, () => {
      this._setScale(getChatPetScale(this._scale, CHAT_PET_SCALE_STEP));
      status(localize("chatPet.grew", "VS Code pet size: {0} percent", Math.round(this._scale * 100)));
    }));
    const shrink = actions.add(new Action("chat.pet.shrink", localize("chatPet.shrink.action", "Shrink"), void 0, this._scale > CHAT_PET_MIN_SCALE, () => {
      this._setScale(getChatPetScale(this._scale, -CHAT_PET_SCALE_STEP));
      status(localize("chatPet.shrank", "VS Code pet size: {0} percent", Math.round(this._scale * 100)));
    }));
    const onTheRunAction = actions.add(new Action(
      "chat.pet.onTheRun",
      onTheRun ? localize("chatPet.comeBack.action", "Come Back") : localize("chatPet.goOnTheRun.action", "Go on the Run"),
      void 0,
      true,
      () => {
        this._transientState.set(void 0, void 0);
        this.chatPetService.setOnTheRun(!onTheRun);
      }
    ));
    const interactionSeparator = new Separator();
    const appearanceSeparator = new Separator();
    this.contextMenuService.showContextMenu({
      getAnchor: () => new StandardMouseEvent(dom.getWindow(this._button.element), event),
      getActions: () => [
        onTheRunAction,
        interactionSeparator,
        grow,
        shrink,
        appearanceSeparator,
        stable,
        insiders
      ],
      onHide: () => {
        this._contextMenuVisible = false;
        if (this._contextMenuActions.value === actions) {
          this._contextMenuActions.clear();
        }
      }
    });
  }
  _onKeyDown(event) {
    if (!this._enabled || this._isDead.get()) {
      return;
    }
    const keyboardEvent = new StandardKeyboardEvent(event);
    let direction = 0;
    let announcement;
    if (keyboardEvent.equals(KeyCode.LeftArrow)) {
      direction = -1;
      announcement = localize("chatPet.movedLeft", "VS Code pet moved left");
    } else if (keyboardEvent.equals(KeyCode.RightArrow)) {
      direction = 1;
      announcement = localize("chatPet.movedRight", "VS Code pet moved right");
    } else {
      return;
    }
    this._wake();
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this._hopController.request(direction, this._motionReduced);
    status(announcement);
  }
  _getAriaLabel(onTheRun) {
    return onTheRun ? localize("chatPet.restore", "Bring back the VS Code pet") : localize("chatPet.interact", "Interact with the VS Code pet. Drag it around the chat with the mouse, or use the left and right arrow keys to make it hop. Use the context menu to put it on the run.");
  }
  _getCurrentLeft() {
    return this._button.element.offsetLeft;
  }
  _getDisplaySize() {
    return CHAT_PET_SOURCE_SIZE / 2 * this._scale;
  }
  _setScale(scale) {
    this._scale = scale;
    const displaySize = this._getDisplaySize();
    this._button.element.style.width = `${displaySize}px`;
    this._button.element.style.height = `${displaySize}px`;
    this._visual.style.transform = `scale(${scale})`;
    if (this._isDead.get() || this._isDragging.get() || this._button.element.classList.contains("falling")) {
      return;
    }
    if (this._fallLandsOnPlatform) {
      if (this._hasCustomPosition) {
        this._setPlatformPosition(this._getCurrentLeft());
      } else {
        this._setDefaultPlatformPosition();
      }
    } else {
      this._updateVerticalPosition();
      if (this._hasCustomPosition) {
        this._setHorizontalPosition(this._getCurrentLeft());
      } else {
        this._setDefaultHorizontalPosition();
      }
    }
  }
  _setHorizontalPosition(left) {
    const parentBounds = this._overlay.getBoundingClientRect();
    const bounds = this.dragBounds.getBoundingClientRect();
    const minimumLeft = bounds.left - parentBounds.left;
    const maximumLeft = bounds.right - parentBounds.left - this._getDisplaySize();
    const clampedLeft = getChatPetHorizontalPosition(left, minimumLeft, maximumLeft);
    this._button.element.style.left = `${clampedLeft}px`;
    this._button.element.style.right = "auto";
    this._hasCustomPosition = true;
    this._updateSpeechBubblePosition();
    return clampedLeft !== left;
  }
  _setDefaultHorizontalPosition() {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const inputBounds = this.dragBounds.getBoundingClientRect();
    const minimumLeft = inputBounds.left - overlayBounds.left;
    const maximumLeft = inputBounds.right - overlayBounds.left - this._getDisplaySize();
    this._button.element.style.left = `${getChatPetDefaultHorizontalPosition(minimumLeft, maximumLeft)}px`;
    this._button.element.style.right = "auto";
    this._hasCustomPosition = false;
    this._updateSpeechBubblePosition();
  }
  _getPlatformBounds() {
    const hostBounds = this._overlay.getBoundingClientRect();
    const inputBounds = this.dragBounds.getBoundingClientRect();
    return {
      left: inputBounds.left,
      right: inputBounds.right,
      top: getChatPetPlatformTop(hostBounds.top, inputBounds.top, this._platformTopProvider?.())
    };
  }
  _updateVerticalPosition() {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const platformTop = this._getPlatformBounds().top;
    this._button.element.style.bottom = `calc(100% - ${platformTop - overlayBounds.top}px)`;
  }
  _setPlatformPosition(left) {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const platformBounds = this._getPlatformBounds();
    this._button.element.style.top = `${platformBounds.top - overlayBounds.top - this._getDisplaySize()}px`;
    this._button.element.style.bottom = "auto";
    this._setHorizontalPosition(left);
  }
  _setDefaultPlatformPosition() {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const platformBounds = this._getPlatformBounds();
    this._button.element.style.top = `${platformBounds.top - overlayBounds.top - this._getDisplaySize()}px`;
    this._button.element.style.bottom = "auto";
    this._setDefaultHorizontalPosition();
  }
  _updateReviveImage() {
    const root = "vs/workbench/contrib/chat/browser/widget/media/chatPet";
    this._reviveImage.src = FileAccess.asBrowserUri(`${root}/buddy-revive-sign-${this._variant}-96.png`).toString(true);
  }
  _showReviveSign() {
    this._button.element.classList.add("hidden");
    this._button.element.tabIndex = -1;
    if (this._respawnPhase === "effect") {
      this._hideReviveSign();
      this._respawnEffect.container.classList.remove("hidden");
      this._updateRespawnEffectPosition();
      this._startRespawnEffectAnimation();
      return;
    }
    this._updateReviveImage();
    this._respawnEffect.container.classList.add("hidden");
    this._respawnAnimation.clear();
    this._reviveSign.classList.remove("hidden");
    this._updateRevivePosition();
    if (this._respawnPhase === "none") {
      this._respawnPhase = "sign";
      this._respawnEffectScheduler.schedule();
    }
  }
  _hideReviveSign() {
    this._reviveSign.classList.add("hidden");
  }
  _updateRevivePosition() {
    if (!this._deathPosition) {
      return;
    }
    const overlayBounds = this._overlay.getBoundingClientRect();
    const movementBounds = this.movementBounds.getBoundingClientRect();
    const minimumLeft = movementBounds.left - overlayBounds.left;
    const maximumLeft = movementBounds.right - overlayBounds.left - CHAT_PET_SOURCE_SIZE / 2;
    const minimumTop = movementBounds.top - overlayBounds.top;
    const maximumTop = movementBounds.bottom - overlayBounds.top - CHAT_PET_SOURCE_SIZE / 2;
    const [left, top] = getChatPetDragPosition(this._deathPosition[0], this._deathPosition[1], minimumLeft, maximumLeft, minimumTop, maximumTop);
    this._deathPosition = [left, top];
    this._reviveSign.style.left = `${left}px`;
    this._reviveSign.style.top = `${top}px`;
  }
  _showRespawnEffect() {
    if (!this._enabled || !this._isDead.get() || this._respawnPhase !== "sign") {
      return;
    }
    this._respawnPhase = "effect";
    this._hideReviveSign();
    this._respawnEffect.container.classList.remove("hidden");
    this._updateRespawnEffectPosition();
    this._startRespawnEffectAnimation();
    this._respawnFallScheduler.schedule(this._motionReduced ? RESPAWN_EFFECT_REDUCED_MOTION_DURATION : RESPAWN_EFFECT_DURATION);
    status(localize("chatPet.respawning", "The VS Code pet is respawning"));
  }
  _updateRespawnEffectPosition() {
    const overlayBounds = this._overlay.getBoundingClientRect();
    const movementBounds = this.movementBounds.getBoundingClientRect();
    const inputBounds = this.dragBounds.getBoundingClientRect();
    const displaySize = this._getDisplaySize();
    const minimumLeft = inputBounds.left - overlayBounds.left;
    const maximumLeft = inputBounds.right - overlayBounds.left - displaySize;
    const left = getChatPetDefaultHorizontalPosition(minimumLeft, maximumLeft);
    const top = movementBounds.top - overlayBounds.top;
    this._respawnPosition = [left, top];
    this._respawnEffect.container.style.left = `${left}px`;
    this._respawnEffect.container.style.top = `${top}px`;
  }
  _startRespawnEffectAnimation() {
    if (this._respawnPhase !== "effect") {
      return;
    }
    const sources = getRespawnSpriteSources(this._variant);
    const source = this._motionReduced ? sources.reducedMotion : sources.animated;
    if (!isChatPetImageSource(this._respawnEffect.image, source.url)) {
      this._respawnAnimation.clear();
      this._respawnEffect.image.removeAttribute("src");
      this._respawnEffect.image.src = source.url;
      return;
    }
    if (this._respawnEffect.image.complete && this._respawnEffect.image.naturalWidth > 0) {
      this._respawnAnimation.clear();
      this._startSpriteAnimation(source, this._respawnEffect, this._respawnAnimation);
    }
  }
  _beginRespawnFall() {
    if (!this._enabled || !this._isDead.get() || this._respawnPhase !== "effect") {
      return;
    }
    this._respawnPhase = "falling";
    this._respawnAnimation.clear();
    this._respawnEffect.container.classList.add("hidden");
    this._deathPosition = void 0;
    this._fallLandsOnPlatform = true;
    this._transientState.set("falling", void 0);
    this._button.element.classList.remove("falling", "dragging", "resisting", "soft-resisting");
    this._button.element.classList.remove("hidden");
    this._button.element.tabIndex = 0;
    if (!this._respawnPosition) {
      this._updateRespawnEffectPosition();
    }
    const [spawnLeft, spawnTop] = this._respawnPosition ?? [this._getCurrentLeft(), 0];
    this._button.element.style.left = `${spawnLeft}px`;
    this._button.element.style.right = "auto";
    this._hasCustomPosition = false;
    const overlayBounds = this._overlay.getBoundingClientRect();
    const platformBounds = this._getPlatformBounds();
    const startTop = spawnTop;
    const targetTop = platformBounds.top - overlayBounds.top - this._getDisplaySize();
    this._button.element.style.top = `${startTop}px`;
    this._button.element.style.bottom = "auto";
    this._button.element.style.transitionDuration = `${getChatPetFallDuration(targetTop - startTop)}ms`;
    this._renderState("falling", true);
    this._isDead.set(false, void 0);
    this._button.element.getBoundingClientRect();
    this._button.element.classList.add("falling");
    this._button.element.style.top = `${targetTop}px`;
    if (this._motionReduced || startTop === targetTop) {
      this._finishFall();
    }
  }
  _updateSpeechBubblePosition() {
    const buttonRight = this._button.element.getBoundingClientRect().right;
    const inputRight = this.dragBounds.getBoundingClientRect().right;
    this._button.element.classList.toggle("speech-bubble-left", shouldPlaceChatPetSpeechBubbleLeft(this._renderedState, buttonRight, inputRight, this._scale));
    this._button.element.classList.toggle("wide-sprite-left", shouldFlipChatPetWideSprite(this._renderedState, buttonRight, inputRight, this._scale));
  }
  _updateGaze() {
    if (!this._cursorPosition) {
      return;
    }
    const bounds = this._button.element.getBoundingClientRect();
    const [x, y] = getChatPetGazeDirection(
      this._cursorPosition[0],
      this._cursorPosition[1],
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2
    );
    for (const pupil of this._pupils) {
      pupil.style.transform = `translate(${x * 2}px, ${y * 2}px)`;
    }
  }
  _startEnableAnimation() {
    this._button.element.classList.remove("hidden", "exiting", "entering");
    this._button.element.tabIndex = 0;
    this._button.element.getBoundingClientRect();
    this._gazeScheduler.schedule();
    if (!this._motionReduced) {
      this._button.element.classList.add("entering");
    }
  }
  _startDisableAnimation() {
    this._button.element.tabIndex = -1;
    this._button.element.classList.remove("entering");
    if (this._motionReduced || this._button.element.classList.contains("hidden")) {
      this._finishDisable();
      return;
    }
    this._button.element.classList.add("exiting");
  }
  _finishDisable() {
    if (this._button.element.classList.contains("falling")) {
      this._finishFall(false);
    }
    this._hopController.cancel();
    if (this._isDragging.get()) {
      this._isDragging.set(false, void 0);
    }
    this._button.element.classList.remove("entering", "exiting", "falling", "dragging", "resisting", "soft-resisting");
    this._button.element.style.transitionDuration = "";
    this._button.element.classList.add("hidden");
    this._hideReviveSign();
    this._respawnEffectScheduler.cancel();
    this._respawnFallScheduler.cancel();
    this._respawnAnimation.clear();
    this._respawnEffect.container.classList.add("hidden");
    this._respawnPhase = "none";
    this._respawnPosition = void 0;
    this._spriteAnimation.clear();
    this._speechAnimation.clear();
    this._speechBubble.container.classList.add("hidden");
    this._speechBubble.image.removeAttribute("src");
    this._pendingSprite = void 0;
    this._pendingSource = void 0;
    this._pendingState = void 0;
    this._activeSprite = void 0;
    this._renderedState = void 0;
    for (const sprite of this._sprites) {
      sprite.container.classList.add("hidden");
      sprite.image.removeAttribute("src");
    }
  }
  _showTransientState(state) {
    if (!this.chatPetService.enabled.get()) {
      return;
    }
    this._wake();
    const renderedState = state === "yapping" && this._motionReduced ? "yappingMouthOpen" : state;
    this._transientState.set(renderedState, void 0);
    if (renderedState === "yappingMouthOpen" || renderedState === "yapping") {
      this._transientScheduler.cancel();
    } else {
      this._transientScheduler.schedule(getTransientStateDuration(renderedState));
    }
    if (!this._isDragging.get() && this._transientState.get() === renderedState) {
      this._renderState(renderedState, true);
    }
  }
  _trySearch() {
    if (!this._enabled || !this.chatPetService.onTheRun.get()) {
      return;
    }
    if (this._motionReduced) {
      this._searchScheduler.schedule();
      return;
    }
    this._transientState.set("searching", void 0);
    this._renderState("searching", true);
    this._searchScheduler.schedule();
  }
  _wake() {
    const wasSleeping = this._idleExpired.get() || this._renderedState === "sleep";
    this._idleExpired.set(false, void 0);
    if (this._busy) {
      this._idleScheduler.cancel();
    } else {
      this._idleScheduler.schedule();
    }
    if (wasSleeping) {
      this._beginWakeAnimation();
    }
  }
  _beginWakeAnimation() {
    if (this._motionReduced) {
      return void 0;
    }
    this._transientState.set("waking", void 0);
    this._transientScheduler.schedule(WAKE_STATE_DURATION);
    return "waking";
  }
  _renderState(state, restart = false, useStaticSprite = false) {
    const sources = getSpriteSources(this._variant)[state];
    const source = this._motionReduced || useStaticSprite ? sources.reducedMotion : sources.animated;
    if (!restart && this._activeSprite && isChatPetImageSource(this._activeSprite.image, source.url)) {
      this._pendingSprite = void 0;
      this._pendingSource = void 0;
      this._pendingState = void 0;
      this._button.element.dataset.state = state;
      this._renderedState = state;
      this._eyes.classList.toggle("tracking", doesChatPetStateTrackCursor(state));
      this._updateSpeechBubble(state, restart);
      return;
    }
    const sprite = this._sprites.find((candidate) => candidate !== this._activeSprite);
    if (!sprite) {
      return;
    }
    this._pendingSprite = sprite;
    this._pendingSource = source;
    this._pendingState = state;
    sprite.image.removeAttribute("src");
    sprite.image.src = source.url;
  }
  _onImageLoad(sprite) {
    if (sprite !== this._pendingSprite || this._pendingSource === void 0 || !isChatPetImageSource(sprite.image, this._pendingSource.url) || this._pendingState === void 0) {
      return;
    }
    this._spriteAnimation.clear();
    this._activeSprite?.container.classList.add("hidden");
    sprite.container.classList.remove("hidden");
    this._activeSprite = sprite;
    const state = this._pendingState;
    this._startSpriteAnimation(this._pendingSource, sprite, this._spriteAnimation, () => this._onSpriteAnimationComplete(sprite, state));
    this._button.element.dataset.state = state;
    this._renderedState = state;
    this._eyes.classList.toggle("tracking", doesChatPetStateTrackCursor(state));
    this._updateSpeechBubble(state, true);
    this._pendingSprite = void 0;
    this._pendingSource = void 0;
    this._pendingState = void 0;
    this._restartEyeAnimation();
    if (doesChatPetStateTrackCursor(this._renderedState)) {
      this._gazeScheduler.schedule();
    }
  }
  _onSpriteAnimationComplete(sprite, state) {
    if (sprite !== this._activeSprite) {
      return;
    }
    if (state === "jump") {
      this._hopController.onAnimationComplete();
      return;
    }
    if (state !== "searching" || !this.chatPetService.onTheRun.get()) {
      return;
    }
    this._transientState.set("searchingDown", void 0);
    this._button.element.dataset.state = "searchingDown";
    this._renderedState = "searchingDown";
  }
  _startSpriteAnimation(source, sprite, animationDisposable, onComplete) {
    const { frameDurations } = source;
    const { image, canvas } = sprite;
    const displaySize = sprite === this._speechBubble ? 72 : sprite === this._respawnEffect ? this._getDisplaySize() : 48;
    const frameHeight = source.frameHeight ?? CHAT_PET_SOURCE_SIZE;
    const displayScale = displaySize / CHAT_PET_SOURCE_SIZE;
    const displayWidth = source.frameWidth * displayScale;
    const displayHeight = frameHeight * displayScale;
    sprite.container.style.width = `${displayWidth}px`;
    sprite.container.style.height = `${displayHeight}px`;
    canvas.width = source.frameWidth;
    canvas.height = frameHeight;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.imageSmoothingEnabled = false;
    const drawFrame = (frameIndex) => {
      context.clearRect(0, 0, source.frameWidth, frameHeight);
      context.drawImage(
        image,
        frameIndex * source.frameWidth,
        0,
        source.frameWidth,
        frameHeight,
        0,
        0,
        source.frameWidth,
        frameHeight
      );
    };
    drawFrame(0);
    if (frameDurations.length < 2) {
      return;
    }
    const targetWindow = dom.getWindow(canvas);
    const startTime = targetWindow.performance.now();
    let currentFrame = 0;
    let frameTimer;
    const animationDisposables = new DisposableStore();
    const clearFrameTimer = () => {
      if (frameTimer !== void 0) {
        targetWindow.clearTimeout(frameTimer);
        frameTimer = void 0;
      }
    };
    const scheduleFrame = (delay) => {
      clearFrameTimer();
      if (!targetWindow.document.hidden) {
        frameTimer = targetWindow.setTimeout(updateFrame, Math.max(1, Math.ceil(delay)));
      }
    };
    const updateFrame = () => {
      frameTimer = void 0;
      const frame = getChatPetAnimationFrame(frameDurations, targetWindow.performance.now() - startTime, source.iterations);
      if (frame.complete) {
        drawFrame(frame.frameIndex);
        animationDisposables.dispose();
        onComplete?.();
        return;
      }
      if (frame.frameIndex !== currentFrame) {
        currentFrame = frame.frameIndex;
        drawFrame(frame.frameIndex);
      }
      scheduleFrame(frame.nextFrameDelay);
    };
    animationDisposables.add(dom.addDisposableListener(targetWindow.document, "visibilitychange", () => {
      clearFrameTimer();
      if (!targetWindow.document.hidden) {
        updateFrame();
      }
    }));
    animationDisposables.add(toDisposable(clearFrameTimer));
    scheduleFrame(frameDurations[0]);
    animationDisposable.value = animationDisposables;
  }
  _updateSpeechBubble(state, restart = false) {
    this._updateSpeechBubblePosition();
    const visible = doesChatPetStateSpeak(state);
    this._speechBubble.container.classList.toggle("hidden", !visible);
    if (!visible) {
      this._speechAnimation.clear();
      return;
    }
    const sources = getSpeechSpriteSources(this._variant);
    const source = this._motionReduced ? sources.reducedMotion : sources.animated;
    if (!isChatPetImageSource(this._speechBubble.image, source.url)) {
      this._speechAnimation.clear();
      this._speechBubble.image.removeAttribute("src");
      this._speechBubble.image.src = source.url;
      return;
    }
    if (restart && this._speechBubble.image.complete && this._speechBubble.image.naturalWidth > 0) {
      this._speechAnimation.clear();
      this._startSpriteAnimation(source, this._speechBubble, this._speechAnimation);
    }
  }
  _restartEyeAnimation() {
    this._eyes.classList.remove("animated");
    this._eyes.getBoundingClientRect();
    if (!this._motionReduced) {
      this._eyes.classList.add("animated");
    }
  }
};
ChatPetWidget = __decorateClass([
  __decorateParam(7, IChatPetService),
  __decorateParam(8, IAccessibilityService),
  __decorateParam(9, IContextMenuService)
], ChatPetWidget);
export {
  CHAT_PET_IDLE_SLEEP_DELAY,
  ChatPetHopController,
  ChatPetWidget,
  doesChatPetStateTrackCursor,
  getChatPetAnimationFrame,
  getChatPetBaseState,
  getChatPetBuddyName,
  getChatPetClickInteraction,
  getChatPetDefaultHorizontalPosition,
  getChatPetDragPosition,
  getChatPetFallDuration,
  getChatPetFallTarget,
  getChatPetFrameDurations,
  getChatPetGazeDirection,
  getChatPetHorizontalPosition,
  getChatPetPlatformTop,
  getChatPetRenderedState,
  getChatPetRespawnFrameDurations,
  getChatPetScale,
  getChatPetSpeechFrameDurations,
  getChatPetSpriteName,
  getChatPetVerticalOffset,
  isChatPetImageSource,
  isChatPetVisible,
  shouldFlipChatPetWideSprite,
  shouldPlaceChatPetSpeechBubbleLeft
};
