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
import { LRUCache } from "../../../../base/common/map.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ChatMessageRole, ILanguageModelsService } from "../common/languageModels.js";
const IChatGoalSummaryService = createDecorator("chatGoalSummaryService");
const MAX_PROMPT_CHARS = 4e3;
const MAX_SUMMARY_CHARS = 100;
const CACHE_SIZE = 50;
const REFUSAL_PREFIX_RE = /^(?:sorry\b|unfortunately\b|my apologies\b|as an ai\b|i\s+apologi[sz]e\b|i\s*['\u2019]?m\s+sorry\b|i\s+am\s+sorry\b|i\s*['\u2019]?m\s+unable\b|i\s+am\s+unable\b|i\s+am\s+not\s+able\b|i\s*(?:can['\u2019]?t|cannot|can\s?not|won['\u2019]?t)\b)/i;
let ChatGoalSummaryService = class {
  constructor(_languageModelsService) {
    this._languageModelsService = _languageModelsService;
    this._cache = new LRUCache(CACHE_SIZE);
    this._inFlight = /* @__PURE__ */ new Map();
  }
  async summarize(prompt, token) {
    const key = prompt.trim();
    if (!key) {
      return void 0;
    }
    const cached = this._cache.get(key);
    if (cached) {
      return cached;
    }
    const inflight = this._inFlight.get(key);
    if (inflight) {
      return inflight;
    }
    const promise = (async () => {
      try {
        const summary = await this._invokeModel(key, token);
        if (summary && !token.isCancellationRequested) {
          this._cache.set(key, summary);
        }
        return summary;
      } catch {
        return void 0;
      } finally {
        this._inFlight.delete(key);
      }
    })();
    this._inFlight.set(key, promise);
    return promise;
  }
  async _invokeModel(prompt, token) {
    const models = await this._languageModelsService.selectLanguageModels({ vendor: "copilot", id: "copilot-utility-small" });
    if (!models.length || token.isCancellationRequested) {
      return void 0;
    }
    const truncatedPrompt = prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) + "...[truncated]" : prompt;
    const systemPrompt = [
      "You summarize a user's coding request into a single short phrase suitable for a status badge.",
      'Reply with the phrase only \u2014 no prose, no quotes, no leading "Goal:", no punctuation at the end.',
      'Use the imperative ("Add tests for X", "Fix the avatar popup bug").',
      "Keep it under 80 characters. Prefer the user's own nouns and verbs.",
      "This is a benign labeling task: never refuse or apologize. Always restate the request as a phrase, even if it seems unusual."
    ].join(" ");
    const response = await this._languageModelsService.sendChatRequest(
      models[0],
      void 0,
      [
        { role: ChatMessageRole.System, content: [{ type: "text", value: systemPrompt }] },
        { role: ChatMessageRole.User, content: [{ type: "text", value: truncatedPrompt }] }
      ],
      {},
      token
    );
    let text = "";
    for await (const part of response.stream) {
      if (token.isCancellationRequested) {
        return void 0;
      }
      if (Array.isArray(part)) {
        for (const p of part) {
          if (p.type === "text") {
            text += p.value;
          }
        }
      } else if (part.type === "text") {
        text += part.value;
      }
    }
    await response.result;
    if (token.isCancellationRequested) {
      return void 0;
    }
    return cleanGoalSummary(text);
  }
};
ChatGoalSummaryService = __decorateClass([
  __decorateParam(0, ILanguageModelsService)
], ChatGoalSummaryService);
function cleanGoalSummary(raw) {
  let s = raw.trim();
  if (!s) {
    return void 0;
  }
  s = s.replace(/^["'`]+|["'`]+$/g, "");
  s = s.replace(/^\s*goal\s*[:\-—]\s*/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (!s || REFUSAL_PREFIX_RE.test(s)) {
    return void 0;
  }
  if (s.length > MAX_SUMMARY_CHARS) {
    s = s.slice(0, MAX_SUMMARY_CHARS - 1).replace(/\s+\S*$/, "") + "\u2026";
  }
  return s || void 0;
}
export {
  ChatGoalSummaryService,
  IChatGoalSummaryService,
  cleanGoalSummary
};
