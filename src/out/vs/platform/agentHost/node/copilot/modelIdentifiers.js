const GPT_56_MODEL_IDS = /* @__PURE__ */ new Set([
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna"
]);
function isGpt56Model(modelId) {
  return modelId !== void 0 && GPT_56_MODEL_IDS.has(modelId.toLowerCase());
}
export {
  isGpt56Model
};
