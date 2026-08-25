import { hasKey } from "../../../../base/common/types.js";
const MAX_FEATURES = 5;
function parseUpdateInfoInput(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  return tryParseUpdateInfoEnvelope(normalized) ?? parseUpdateInfoFrontmatter(normalized);
}
function tryParseUpdateInfoEnvelope(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return void 0;
  }
  try {
    const value = JSON.parse(trimmed);
    if (typeof value.markdown !== "string") {
      return void 0;
    }
    return buildParsedInput(value.markdown, value);
  } catch {
    return void 0;
  }
}
function buildParsedInput(markdown, meta) {
  const result = {
    markdown,
    buttons: parseUpdateInfoButtons(meta.buttons)
  };
  if (typeof meta.bannerImageUrl === "string") {
    result.bannerImageUrl = meta.bannerImageUrl;
  }
  if (typeof meta.badge === "string") {
    result.badge = meta.badge;
  }
  if (typeof meta.title === "string") {
    result.title = meta.title;
  }
  const features = parseUpdateInfoFeatures(meta.features);
  if (features) {
    result.features = features;
  }
  return result;
}
function parseUpdateInfoFrontmatter(text) {
  const blockMatch = text.match(/^---[ \t]*\r?\n(?<json>[\s\S]*?)\r?\n---[ \t]*(?:\r?\n(?<body>[\s\S]*))?$/);
  if (blockMatch?.groups) {
    return parseUpdateInfoFrontmatterMatch(text, blockMatch.groups["json"], blockMatch.groups["body"] ?? "");
  }
  const inlineMatch = text.match(/^---[ \t]*(?<json>\{.*\})[ \t]*---[ \t]*(?<body>[\s\S]*)$/);
  if (inlineMatch?.groups) {
    return parseUpdateInfoFrontmatterMatch(text, inlineMatch.groups["json"], inlineMatch.groups["body"]);
  }
  return { markdown: text };
}
function parseUpdateInfoFrontmatterMatch(text, jsonText, markdown) {
  try {
    const meta = JSON.parse(jsonText);
    return buildParsedInput(markdown, meta);
  } catch {
    return { markdown: text };
  }
}
function parseUpdateInfoButtons(buttons) {
  if (!Array.isArray(buttons)) {
    return void 0;
  }
  const parsedButtons = [];
  for (const button of buttons) {
    if (typeof button !== "object" || button === null) {
      continue;
    }
    if (!hasKey(button, { label: true, commandId: true }) || typeof button.label !== "string" || typeof button.commandId !== "string") {
      continue;
    }
    const style = hasKey(button, { style: true }) && (button.style === "primary" || button.style === "secondary") ? button.style : void 0;
    const args = hasKey(button, { args: true }) && Array.isArray(button.args) ? button.args : void 0;
    parsedButtons.push({
      label: button.label,
      commandId: button.commandId,
      args,
      style
    });
  }
  return parsedButtons.length ? parsedButtons : void 0;
}
function parseUpdateInfoFeatures(features) {
  if (!Array.isArray(features)) {
    return void 0;
  }
  const parsed = [];
  for (const feature of features) {
    if (typeof feature !== "object" || feature === null) {
      continue;
    }
    const candidate = feature;
    if (typeof candidate.title !== "string" || typeof candidate.description !== "string") {
      continue;
    }
    const icon = typeof candidate.icon === "string" ? candidate.icon : void 0;
    parsed.push({ icon, title: candidate.title, description: candidate.description });
    if (parsed.length >= MAX_FEATURES) {
      break;
    }
  }
  return parsed.length ? parsed : void 0;
}
export {
  parseUpdateInfoInput
};
