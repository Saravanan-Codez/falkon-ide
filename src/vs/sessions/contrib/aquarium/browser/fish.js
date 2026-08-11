import { VSCODE_LOGO_PATH } from "./vscodeLogoPath.js";
var FishSpecies = /* @__PURE__ */ ((FishSpecies2) => {
  FishSpecies2["Stable"] = "stable";
  FishSpecies2["Insiders"] = "insiders";
  FishSpecies2["Exploration"] = "exploration";
  return FishSpecies2;
})(FishSpecies || {});
const SPECIES_COLOR = {
  ["stable" /* Stable */]: "#007ACC",
  ["insiders" /* Insiders */]: "#24bfa5",
  ["exploration" /* Exploration */]: "#E04F00"
};
function pickRandomSpecies() {
  const roll = Math.random();
  if (roll < 0.5) {
    return "stable" /* Stable */;
  }
  if (roll < 0.8) {
    return "insiders" /* Insiders */;
  }
  return "exploration" /* Exploration */;
}
function disposeSharedFishDefs(targetDocument) {
  const container = sharedDefsByDocument.get(targetDocument);
  if (container) {
    container.remove();
    sharedDefsByDocument.delete(targetDocument);
  }
}
class Fish {
  constructor(opts, targetDocument) {
    /** Timestamp until which this fish is in "panic" mode (faster, scattering). */
    this.panicUntil = 0;
    /**
     * Smoothed facing in [-1, 1] (1 = right, -1 = left). Eased toward
     * sign(velocityX) each frame so direction changes look like a turn instead of
     * a snap-flip.
     */
    this.facing = 1;
    this.positionX = opts.positionX;
    this.positionY = opts.positionY;
    this.velocityX = opts.velocityX;
    this.velocityY = opts.velocityY;
    this.size = opts.size;
    this.wanderAngle = Math.atan2(opts.velocityY, opts.velocityX);
    this.element = targetDocument.createElement("div");
    this.element.className = "agents-aquarium-fish";
    this.element.style.width = `${opts.size}px`;
    this.element.style.height = `${opts.size}px`;
    this.element.style.color = SPECIES_COLOR[opts.species];
    this.innerElement = targetDocument.createElement("div");
    this.innerElement.className = "agents-aquarium-fish-inner";
    this.innerElement.appendChild(buildFishSvg(targetDocument));
    this.element.appendChild(this.innerElement);
    this.applyTransform();
  }
  /**
   * Write the current position/facing to the DOM.
   *
   * @param deltaSeconds seconds since last frame, used to ease facing toward
   * velocity direction. Pass 0 for the initial paint.
   */
  applyTransform(deltaSeconds = 0) {
    this.element.style.transform = `translate(${this.positionX.toFixed(2)}px, ${this.positionY.toFixed(2)}px)`;
    const targetFacing = this.velocityX >= 0 ? 1 : -1;
    if (deltaSeconds > 0) {
      const turnRate = 8;
      const easeFactor = 1 - Math.exp(-turnRate * deltaSeconds);
      this.facing += (targetFacing - this.facing) * easeFactor;
    } else {
      this.facing = targetFacing;
    }
    const flipScaleX = Math.sign(this.facing) * Math.max(Math.abs(this.facing), 0.05);
    this.innerElement.style.transform = `scaleX(${flipScaleX.toFixed(3)})`;
  }
  /**
   * Grow the fish by a multiplicative `factor`. Growth is intentionally
   * unbounded — a fish that keeps eating keeps getting bigger. The element's
   * footprint is updated so the body SVG (sized at 100%) scales with it.
   */
  grow(factor) {
    if (!isFinite(factor) || factor <= 0) {
      return;
    }
    const newSize = this.size * factor;
    const delta = newSize - this.size;
    this.positionX -= delta / 2;
    this.positionY -= delta / 2;
    this.size = newSize;
    this.element.style.transitionDelay = "0ms";
    this.element.style.width = `${this.size}px`;
    this.element.style.height = `${this.size}px`;
    this.applyTransform();
  }
}
const SVG_NS = "http://www.w3.org/2000/svg";
const NUM_BODY_STRIPS = 8;
const BODY_X_START = 5;
const BODY_X_END = 90;
const sharedDefsByDocument = /* @__PURE__ */ new WeakMap();
const SHARED_LOGO_SYMBOL_ID = "agents-aquarium-fish-logo";
function ensureSharedDefs(targetDocument) {
  if (sharedDefsByDocument.has(targetDocument)) {
    return;
  }
  const stripWidth = (BODY_X_END - BODY_X_START) / NUM_BODY_STRIPS;
  const container = targetDocument.createElementNS(SVG_NS, "svg");
  container.setAttribute("xmlns", SVG_NS);
  container.setAttribute("width", "0");
  container.setAttribute("height", "0");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "absolute";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  container.style.pointerEvents = "none";
  container.appendChild(createVSCodeLogoSymbol(targetDocument));
  const defs = targetDocument.createElementNS(SVG_NS, "defs");
  for (let i = 0; i < NUM_BODY_STRIPS; i++) {
    const clip = targetDocument.createElementNS(SVG_NS, "clipPath");
    clip.setAttribute("id", `agents-aquarium-fish-clip-${i}`);
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    const rect = targetDocument.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(BODY_X_START + i * stripWidth));
    rect.setAttribute("y", "-20");
    rect.setAttribute("width", String(stripWidth + 0.8));
    rect.setAttribute("height", "136");
    clip.appendChild(rect);
    defs.appendChild(clip);
  }
  container.appendChild(defs);
  targetDocument.body.appendChild(container);
  sharedDefsByDocument.set(targetDocument, container);
}
function createVSCodeLogoSymbol(targetDocument) {
  const symbol = targetDocument.createElementNS(SVG_NS, "symbol");
  symbol.setAttribute("id", SHARED_LOGO_SYMBOL_ID);
  symbol.setAttribute("viewBox", "0 0 96 96");
  symbol.setAttribute("overflow", "visible");
  const logoPath = targetDocument.createElementNS(SVG_NS, "path");
  logoPath.setAttribute("d", VSCODE_LOGO_PATH);
  logoPath.setAttribute("fill", "currentColor");
  logoPath.setAttribute("fill-rule", "evenodd");
  symbol.appendChild(logoPath);
  return symbol;
}
function buildFishSvg(targetDocument) {
  ensureSharedDefs(targetDocument);
  const svg = targetDocument.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("focusable", "false");
  svg.setAttribute("viewBox", "0 0 96 96");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("shape-rendering", "geometricPrecision");
  const bodyGroup = targetDocument.createElementNS(SVG_NS, "g");
  bodyGroup.setAttribute("class", "agents-aquarium-fish-body");
  for (let i = 0; i < NUM_BODY_STRIPS; i++) {
    const stripG = targetDocument.createElementNS(SVG_NS, "g");
    stripG.setAttribute("class", "agents-aquarium-fish-strip");
    stripG.style.setProperty("--agents-aquarium-strip-index", String(i));
    const stripUse = targetDocument.createElementNS(SVG_NS, "use");
    stripUse.setAttribute("href", `#${SHARED_LOGO_SYMBOL_ID}`);
    stripUse.setAttribute("clip-path", `url(#agents-aquarium-fish-clip-${i})`);
    stripG.appendChild(stripUse);
    bodyGroup.appendChild(stripG);
  }
  svg.appendChild(bodyGroup);
  return svg;
}
export {
  Fish,
  FishSpecies,
  disposeSharedFishDefs,
  pickRandomSpecies
};
