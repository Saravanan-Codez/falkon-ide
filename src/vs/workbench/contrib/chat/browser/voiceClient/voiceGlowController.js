import "./media/voiceGlow.css";
import { $ } from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { DEFAULT_VOICE_GLOW_COLORS, resolveVoiceRimAccent, voiceGlowStateColor } from "./voiceGlow.js";
const FADE = "opacity .6s cubic-bezier(.4,0,.2,1)";
const FADE_OUT_MS = 650;
const ACTIVE_RIM_STRENGTH = 1.02;
const RIM_LAYER_OPACITY = {
  dark: { ring: 1, inner: 0.44, bloom: 0.66 },
  light: { ring: 1, inner: 0.3, bloom: 0.8 }
};
const RIM_DURATION = 2.3;
function rimMotionParams(theme, duration) {
  const dark = theme === "dark";
  const scale = duration / RIM_DURATION;
  return {
    /** How much the blobs grow and shrink. */
    spread: 0.28,
    /** How far the blobs drift, in px. */
    drift: dark ? 33 : 40,
    /** Depth of the per-quadrant opacity swell. */
    opacityDepth: dark ? 0.48 : 0.45,
    /** Depth of the global height swell. */
    breathDepth: dark ? 0.34 : 0.22,
    /** Base period for the opacity swell. */
    opacityPeriod: (dark ? 1.9 : 2.6) * scale,
    /** Base period for the size swell. */
    sizePeriod: (dark ? 2.6 : 4.6) * scale,
    /** Period of the global height swell. */
    breathPeriod: (dark ? 2.4 : 5.5) * scale
  };
}
function rimOscillators(theme, duration) {
  const { spread, drift, opacityDepth, breathDepth, opacityPeriod, sizePeriod, breathPeriod } = rimMotionParams(theme, duration);
  return [
    { prop: "--vg-w1", from: 1 - spread, to: 1 + spread * 1.1, period: sizePeriod * 0.9, delay: 0, unit: "" },
    { prop: "--vg-h1", from: 1 + spread * 0.9, to: 1 - spread * 0.85, period: sizePeriod * 1.26, delay: 0, unit: "" },
    { prop: "--vg-x1", from: -drift, to: drift * 0.9, period: opacityPeriod * 1.6, delay: 0, unit: "px" },
    { prop: "--vg-y1", from: drift * 0.55, to: -drift * 0.7, period: opacityPeriod * 1.6, delay: 0, unit: "px" },
    { prop: "--vg-w2", from: 1 + spread, to: 1 - spread * 0.85, period: sizePeriod * 1.1, delay: 0, unit: "" },
    { prop: "--vg-h2", from: 1 - spread * 0.8, to: 1 + spread * 1.05, period: sizePeriod * 0.81, delay: 0, unit: "" },
    { prop: "--vg-x2", from: drift * 0.8, to: -drift * 0.9, period: opacityPeriod * 1.88, delay: 0, unit: "px" },
    { prop: "--vg-y2", from: -drift, to: drift * 0.65, period: opacityPeriod * 1.88, delay: 0, unit: "px" },
    { prop: "--vg-w3", from: 1 - spread * 0.6, to: 1 + spread * 1.15, period: sizePeriod * 0.98, delay: 0, unit: "" },
    { prop: "--vg-h3", from: 1 + spread * 0.75, to: 1 - spread, period: sizePeriod * 1.4, delay: 0, unit: "" },
    { prop: "--vg-x3", from: -drift * 0.6, to: drift, period: opacityPeriod * 1.45, delay: 0, unit: "px" },
    { prop: "--vg-y3", from: -drift * 0.85, to: drift * 0.45, period: opacityPeriod * 1.45, delay: 0, unit: "px" },
    { prop: "--vg-breath", from: 1 - breathDepth, to: 1 + breathDepth, period: breathPeriod, delay: 0, unit: "" },
    { prop: "--vg-op-tl", from: 1 - opacityDepth, to: 1, period: opacityPeriod, delay: 0, unit: "" },
    { prop: "--vg-op-tr", from: 1 - opacityDepth, to: 1, period: opacityPeriod * 1.32, delay: opacityPeriod * 0.28, unit: "" },
    { prop: "--vg-op-bl", from: 1 - opacityDepth, to: 1, period: opacityPeriod * 0.84, delay: opacityPeriod * 0.55, unit: "" },
    { prop: "--vg-op-br", from: 1 - opacityDepth, to: 1, period: opacityPeriod * 1.58, delay: opacityPeriod * 0.83, unit: "" }
  ];
}
function applyOscillators(host, oscillators, time, animate) {
  for (const osc of oscillators) {
    const value = animate ? osc.from + (osc.to - osc.from) * ((1 - Math.cos(2 * Math.PI * ((time - osc.delay) / osc.period))) / 2) : (osc.from + osc.to) / 2;
    host.style.setProperty(osc.prop, osc.unit === "px" ? `${value.toFixed(2)}px` : value.toFixed(4));
  }
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function nowSeconds(el) {
  const view = el.ownerDocument.defaultView;
  return (view?.performance ?? performance).now() / 1e3;
}
function mountRimLayers(host, options) {
  const store = new DisposableStore();
  const moodClass = `voice-glow-rim-${options.mood}`;
  host.classList.add("voice-glow-rim", moodClass);
  store.add(toDisposable(() => host.classList.remove("voice-glow-rim", moodClass)));
  for (const cls of ["voice-glow-rim-corners", "voice-glow-rim-bloom"]) {
    const el = $("div");
    el.className = cls;
    host.appendChild(el);
    store.add(toDisposable(() => el.remove()));
  }
  const layerOpacity = RIM_LAYER_OPACITY[options.theme];
  host.style.setProperty("--vg-sat", `${options.saturation}%`);
  host.style.setProperty("--vg-light", `${options.lightness}%`);
  host.style.setProperty("--vg-ring-opacity", String(layerOpacity.ring));
  host.style.setProperty("--vg-inner-opacity", String(layerOpacity.inner));
  host.style.setProperty("--vg-bloom-opacity", String(layerOpacity.bloom));
  if (options.size !== void 0) {
    host.style.setProperty("--vg-size", options.size.toFixed(3));
  }
  const oscillators = rimOscillators(options.theme, options.duration);
  let time = 0;
  let previousTimestamp;
  let level = 0.2;
  const apply = (input, animate) => {
    if (animate) {
      const timestamp = nowSeconds(host);
      const delta = previousTimestamp === void 0 ? 0 : Math.min(0.05, timestamp - previousTimestamp);
      previousTimestamp = timestamp;
      const target = clamp01(input);
      level += (target - level) * (target > level ? 0.3 : 0.08);
      time += delta * (options.speedGain === 0 ? 0.22 : 0.4 + options.speedGain * level);
    } else {
      level = clamp01(input);
    }
    applyOscillators(host, oscillators, time, animate);
    const peak = level * level;
    host.style.setProperty("--vg-strength", (options.strength * (0.5 + options.audioGain * level + options.peakGain * peak)).toFixed(3));
    host.style.setProperty("--vg-bloom-opacity", (layerOpacity.bloom * (1 + options.peakGain * peak)).toFixed(3));
    const drift = animate ? 14 * Math.sin(time * 0.4) : 0;
    host.style.setProperty("--vg-hue", (options.hue + drift).toFixed(1));
  };
  return {
    host,
    drive: (input) => apply(input, true),
    driveStatic: (input) => apply(input, false),
    dispose: () => store.dispose()
  };
}
function createVoiceGlowController(target, themeKind, colors) {
  return new VoiceGlowController(target, themeKind, colors);
}
const RIM_REFERENCE_HEIGHT = 78;
const RIM_SIZE_FLOOR = 0.35;
function createVoiceRimLight(target, accent, theme, mood = "cool", background) {
  const store = new DisposableStore();
  const doc = target.ownerDocument;
  if (!target.style.position) {
    target.style.position = "relative";
  }
  const slot = doc.createElement("div");
  slot.className = "voice-glow-slot voice-glow-slot-inline";
  target.appendChild(slot);
  store.add(toDisposable(() => slot.remove()));
  const mount = store.add(new MutableDisposable());
  let level = 0.3;
  const remount = (nextAccent, nextTheme, nextBackground) => {
    const rim = resolveVoiceRimAccent(nextAccent, mood, nextTheme, nextBackground);
    const height = target.getBoundingClientRect().height;
    const proportion = height > 0 ? Math.min(1, height / RIM_REFERENCE_HEIGHT) : 0;
    mount.clear();
    mount.value = mountRimLayers(slot, {
      theme: nextTheme,
      mood,
      hue: rim.hue,
      saturation: rim.saturation,
      lightness: rim.lightness,
      strength: ACTIVE_RIM_STRENGTH,
      duration: RIM_DURATION,
      audioGain: 0.8,
      peakGain: 0.95,
      speedGain: 0.9,
      size: RIM_SIZE_FLOOR + (1 - RIM_SIZE_FLOOR) * proportion
    });
    mount.value.driveStatic(level);
  };
  remount(accent, theme, background);
  return {
    drive: (input) => {
      level = input;
      mount.value?.drive(input);
    },
    driveStatic: (input) => {
      level = input;
      mount.value?.driveStatic(input);
    },
    refresh: remount,
    dispose: () => store.dispose()
  };
}
class VoiceGlowController extends Disposable {
  constructor(_target, _themeKind = () => "dark", _colorsProvider = () => DEFAULT_VOICE_GLOW_COLORS) {
    super();
    this._target = _target;
    this._themeKind = _themeKind;
    this._colorsProvider = _colorsProvider;
    /** One mount per slot, so mounting a new layer tears the old one down. */
    this._mounts = /* @__PURE__ */ new Map();
    this._currentState = "none";
    this._reducedMotion = false;
    this._disposed = false;
    try {
      this._colors = this._colorsProvider();
      _target.style.position = _target.style.position || "relative";
      const createSlot = () => {
        const el = $("div");
        el.className = "voice-glow-slot";
        el.style.zIndex = "11";
        _target.appendChild(el);
        this._register(toDisposable(() => el.remove()));
        this._mounts.set(el, this._register(new MutableDisposable()));
        return el;
      };
      this._slots = [createSlot(), createSlot()];
      this._register(toDisposable(() => {
        this._disposed = true;
        if (this._clearTimer !== void 0) {
          clearTimeout(this._clearTimer);
          this._clearTimer = void 0;
        }
      }));
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  dispose() {
    this._disposed = true;
    super.dispose();
  }
  render(state, level, reducedMotion) {
    if (this._disposed) {
      return;
    }
    const mood = resolveMood(state);
    this._reducedMotion = reducedMotion;
    if (!mood) {
      this.clear();
      return;
    }
    if (mood !== this._currentMood) {
      this._currentMood = mood;
      if (this._clearTimer !== void 0) {
        clearTimeout(this._clearTimer);
        this._clearTimer = void 0;
      }
      this._showLayer(mood, reducedMotion);
    }
    if (state !== this._currentState) {
      this._currentState = state;
      this._target.classList.add("voice-active");
      this._target.classList.toggle("voice-listening", state === "listening");
      this._target.classList.toggle("voice-processing", state === "processing");
      this._target.classList.toggle("voice-speaking", state === "speaking");
      this._target.classList.toggle("voice-confirmation", state === "confirmation");
      const accent = resolveVoiceRimAccent(voiceGlowStateColor(state, this._colors), mood, this._themeKind(), this._colors.background);
      this._target.style.setProperty("--voice-accent", `hsl(${accent.hue} ${accent.saturation}% ${accent.lightness}%)`);
    }
    if (this._front && !reducedMotion) {
      this._front.drive(level);
    }
  }
  clear() {
    if (this._disposed || this._currentState === "none") {
      return;
    }
    this._currentState = "none";
    this._currentMood = void 0;
    this._target.classList.remove("voice-active", "voice-listening", "voice-processing", "voice-speaking", "voice-confirmation");
    this._target.style.removeProperty("--voice-accent");
    const previous = this._front;
    this._front = void 0;
    if (previous) {
      this._fadeOut(previous.host);
      this._scheduleTeardown(previous.host);
    }
  }
  /**
   * Tear a slot's mount down once it has faded out so it stops driving CSS
   * variables. Guarded on re-entry: if the slot has since been reused as the
   * front layer, the new mount must survive.
   */
  _scheduleTeardown(host) {
    if (this._clearTimer !== void 0) {
      clearTimeout(this._clearTimer);
    }
    this._clearTimer = setTimeout(() => {
      this._clearTimer = void 0;
      if (this._front?.host !== host) {
        this._mounts.get(host)?.clear();
      }
    }, FADE_OUT_MS);
  }
  refreshTheme() {
    if (this._disposed) {
      return;
    }
    this._colors = this._colorsProvider();
    const state = this._currentState;
    if (this._front && state !== "none") {
      this._currentState = "none";
      this._currentMood = void 0;
      this.render(state, 0.3, this._reducedMotion);
    }
  }
  _showLayer(mood, reducedMotion) {
    const host = this._slots.find((slot) => slot !== this._front?.host) ?? this._slots[0];
    this._mounts.get(host).clear();
    const mounted = this._mount(host, mood);
    this._mounts.get(host).value = mounted;
    if (reducedMotion) {
      mounted.driveStatic(0.4);
    }
    const fade = reducedMotion ? "none" : FADE;
    const previous = this._front;
    host.style.transition = "none";
    host.style.opacity = "0";
    void host.offsetWidth;
    host.style.transition = fade;
    host.style.opacity = "1";
    if (previous && previous.host !== host) {
      this._fadeOut(previous.host, fade);
      this._scheduleTeardown(previous.host);
    }
    this._front = mounted;
  }
  _fadeOut(host, fade = FADE) {
    host.style.transition = fade;
    host.style.opacity = "0";
  }
  _mount(host, mood) {
    const theme = this._themeKind();
    const accentColor = mood === "warning" ? this._colors.confirmation : mood === "warm" ? this._colors.speaking : this._colors.listening;
    const accent = resolveVoiceRimAccent(accentColor, mood, theme, this._colors.background);
    return mountRimLayers(host, {
      theme,
      mood,
      hue: accent.hue,
      saturation: accent.saturation,
      lightness: accent.lightness,
      strength: ACTIVE_RIM_STRENGTH,
      duration: RIM_DURATION,
      audioGain: 0.8,
      // Lets the loudest moments read visibly denser rather than leaving the
      // whole range in a narrow band.
      peakGain: 0.95,
      speedGain: 0.9
    });
  }
}
function resolveMood(state) {
  switch (state) {
    case "listening":
      return "cool";
    case "speaking":
      return "warm";
    case "confirmation":
      return "warning";
    default:
      return void 0;
  }
}
export {
  createVoiceGlowController,
  createVoiceRimLight
};
