import { h } from "../../dom.js";
import { pauseCSSAnimationsWhenHidden } from "../../animationSync.js";
import "./pixelSpinner.css";
function createPixelSpinner(parent, options) {
  const variant = options?.variant ?? "grid";
  const rootClass = variant === "ring" ? "span.monaco-pixel-spinner.monaco-pixel-spinner-ring" : "span.monaco-pixel-spinner";
  const root = h(rootClass).root;
  if (options?.ariaLabel) {
    root.setAttribute("role", "status");
    root.setAttribute("aria-label", options.ariaLabel);
  } else {
    root.setAttribute("aria-hidden", "true");
  }
  for (let i = 0; i < 6; i++) {
    root.appendChild(h("span.monaco-pixel-spinner-dot").root);
  }
  parent?.appendChild(root);
  const animationTracking = trackSpinner(root);
  return {
    element: root,
    dispose: () => animationTracking.dispose()
  };
}
const PAUSED_CLASS = "monaco-pixel-spinner-paused";
const SPINNER_ANIMATION_NAMES = /* @__PURE__ */ new Set([
  "monaco-pixel-spinner-dot-cycle",
  "monaco-pixel-spinner-dot-cycle-long",
  "monaco-pixel-spinner-dot-cycle-short",
  "monaco-pixel-spinner-ring-pulse"
]);
function trackSpinner(root) {
  return pauseCSSAnimationsWhenHidden(root, {
    pausedClass: PAUSED_CLASS,
    subtree: true,
    animationNames: SPINNER_ANIMATION_NAMES
  });
}
export {
  createPixelSpinner
};
