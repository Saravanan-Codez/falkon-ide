const SUPPORTED_ANTHROPIC_BETAS = [
  "interleaved-thinking",
  "context-management",
  "advanced-tool-use"
];
function filterSupportedBetas(headerValue) {
  const filtered = headerValue.split(",").map((b) => b.trim()).filter((b) => b && SUPPORTED_ANTHROPIC_BETAS.some((supported) => b.startsWith(supported + "-")));
  return filtered.length > 0 ? filtered.join(",") : void 0;
}
export {
  filterSupportedBetas
};
