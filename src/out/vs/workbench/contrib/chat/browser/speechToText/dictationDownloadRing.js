import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
const SVG_NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
class DictationDownloadRing extends Disposable {
  constructor(container, _speechToTextService) {
    super();
    this._speechToTextService = _speechToTextService;
    const ownerDocument = container.ownerDocument;
    const svg = ownerDocument.createElementNS(SVG_NS, "svg");
    svg.classList.add("dictation-download-ring");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    const track = ownerDocument.createElementNS(SVG_NS, "circle");
    track.classList.add("dictation-download-ring-track");
    track.setAttribute("cx", "8");
    track.setAttribute("cy", "8");
    track.setAttribute("r", String(RING_RADIUS));
    const progress = ownerDocument.createElementNS(SVG_NS, "circle");
    progress.classList.add("dictation-download-ring-progress");
    progress.setAttribute("cx", "8");
    progress.setAttribute("cy", "8");
    progress.setAttribute("r", String(RING_RADIUS));
    progress.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
    svg.appendChild(track);
    svg.appendChild(progress);
    container.appendChild(svg);
    this._ringElement = svg;
    this._progressCircle = progress;
    this._register(this._speechToTextService.onDidChangeModelDownloadProgress(() => this.update()));
    this.update();
  }
  update() {
    const progress = this._speechToTextService.modelDownloadProgress;
    if (progress === void 0) {
      this._ringElement.classList.add("indeterminate");
      this._progressCircle.style.strokeDashoffset = String(RING_CIRCUMFERENCE * 0.75);
    } else {
      this._ringElement.classList.remove("indeterminate");
      this._progressCircle.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
    }
  }
}
function getDictationDownloadHoverMarkdown(service) {
  const markdown = new MarkdownString("", { supportThemeIcons: true });
  if (service.currentBackend === "mai") {
    markdown.appendMarkdown(localize("chatStt.hover.connectingTitle", "**Connecting to dictation service**"));
    markdown.appendMarkdown("\n\n");
    markdown.appendMarkdown(localize("chatStt.hover.connecting", "Establishing a connection. This happens each time you start cloud dictation. Click to cancel."));
    return markdown;
  }
  markdown.appendMarkdown(localize("chatStt.hover.title", "**Downloading local model**"));
  markdown.appendMarkdown("\n\n");
  markdown.appendMarkdown(localize("chatStt.hover.preparing", "This happens only the first time you dictate. Click to cancel."));
  return markdown;
}
function getDictationDownloadHoverContent(service) {
  const markdown = getDictationDownloadHoverMarkdown(service);
  return { markdown, markdownNotSupportedFallback: markdown.value };
}
function getDictationPreparingLabel(service) {
  if (service.currentBackend === "mai") {
    return localize("chatStt.preparing.connecting", "Connecting to dictation service\u2026");
  }
  const progress = service.modelDownloadProgress;
  if (typeof progress === "number") {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    return localize("chatStt.preparing.downloading", "Downloading speech-to-text model\u2026 {0}%", percent);
  }
  return localize("chatStt.preparing.preparing", "Preparing speech-to-text model\u2026");
}
export {
  DictationDownloadRing,
  getDictationDownloadHoverContent,
  getDictationDownloadHoverMarkdown,
  getDictationPreparingLabel
};
