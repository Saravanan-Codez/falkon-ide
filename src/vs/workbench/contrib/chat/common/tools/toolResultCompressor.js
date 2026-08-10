import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const IToolResultCompressor = createDecorator("IToolResultCompressor");
function isProtectedFromCompression(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (first === "{" && last === "}" || first === "[" && last === "]") {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
    }
  }
  if (/^---\s*\n/.test(trimmed) || /^\[[A-Za-z_][A-Za-z0-9_.-]*\]\s*\n/.test(trimmed)) {
    return true;
  }
  return false;
}
const MIN_COMPRESSIBLE_LENGTH = 1024;
function formatCompressionBanner(filterIds, beforeChars, afterChars) {
  const ids = filterIds.length > 0 ? filterIds.join(", ") : "unknown";
  return `[Output compressed by ${ids} (${beforeChars} \u2192 ${afterChars} chars). To disable, set chat.tools.compressOutput.enabled to false.]`;
}
export {
  IToolResultCompressor,
  MIN_COMPRESSIBLE_LENGTH,
  formatCompressionBanner,
  isProtectedFromCompression
};
