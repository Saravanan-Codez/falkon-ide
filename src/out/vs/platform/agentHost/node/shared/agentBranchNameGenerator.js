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
import { ILogService } from "../../../log/common/log.js";
import { ICopilotApiService } from "./copilotApiService.js";
const AGENT_BRANCH_PREFIX = "agents/";
const AGENT_BRANCH_SESSION_ID_SUFFIX_LENGTH = 8;
const MAX_BRANCH_NAME_HINT_LENGTH = 48;
const MIN_GENERATED_BRANCH_NAME_LENGTH = 8;
const MAX_BRANCH_NAME_CANDIDATES = 100;
let AgentBranchNameGenerator = class {
  constructor(_copilotApiService, _logService) {
    this._copilotApiService = _copilotApiService;
    this._logService = _logService;
  }
  async generateBranchName(request) {
    const branchNameHint = await this._generateBranchNameHint(request) ?? getAgentBranchNameHintFromMessage(request.message ?? "");
    return this._buildBranchName(request, branchNameHint);
  }
  async _generateBranchNameHint(request) {
    const message = request.message?.trim();
    if (!message || !request.githubToken) {
      return void 0;
    }
    try {
      const rawBranchName = await this._copilotApiService.utilityChatCompletion(request.githubToken, {
        messages: this._buildBranchNamePrompt(message)
      }, {
        signal: request.signal
      });
      if (request.signal?.aborted) {
        return void 0;
      }
      let branchName = rawBranchName.trim();
      if (branchName.match(/^".*"$/)) {
        branchName = branchName.slice(1, -1);
      }
      if (branchName.includes("can't assist with that")) {
        return void 0;
      }
      branchName = normalizeAgentBranchName(branchName).slice(0, MAX_BRANCH_NAME_HINT_LENGTH).replace(/-+$/g, "");
      if (branchName.length < MIN_GENERATED_BRANCH_NAME_LENGTH) {
        this._logService.warn("Generated branch name is too short after normalization, discarding.");
        return void 0;
      }
      return branchName;
    } catch (err) {
      this._logService.warn("[AgentBranchNameGenerator] Failed to generate branch name", err);
      return void 0;
    }
  }
  _buildBranchNamePrompt(userRequest) {
    return [
      {
        role: "system",
        content: [
          "You are an expert in crafting pithy branch names for Git Repos based on chatbot conversations.",
          "You are presented with a chat request, and you reply with a brief branch name that captures the main topic of that request.",
          "The branch name should not be wrapped in quotes. It should be between 8-50 characters.",
          "Here are some examples of good branch names:",
          "- linkedlist-implementation",
          "- adding-tree-view",
          "- react-usestate-hook-usage"
        ].join(" ")
      },
      {
        role: "user",
        content: `Please write a brief branch name for the following request:

${userRequest}`
      }
    ];
  }
  async _buildBranchName(request, branchNameHint) {
    const prefix = `${request.branchPrefix ?? ""}${AGENT_BRANCH_PREFIX}`;
    const branchName = `${prefix}${branchNameHint ?? request.sessionId}`;
    const collisionBase = branchNameHint ? `${branchName}-${request.sessionId.substring(0, AGENT_BRANCH_SESSION_ID_SUFFIX_LENGTH)}` : branchName;
    for (let candidateIndex = 0; candidateIndex < MAX_BRANCH_NAME_CANDIDATES; candidateIndex++) {
      const candidate = candidateIndex === 0 ? branchName : branchNameHint && candidateIndex === 1 ? collisionBase : `${collisionBase}-${branchNameHint ? candidateIndex : candidateIndex + 1}`;
      if (!request.branchNameCollides || !await request.branchNameCollides(candidate)) {
        return candidate;
      }
    }
    throw new Error(`Unable to find an available branch name after checking ${MAX_BRANCH_NAME_CANDIDATES} candidates`);
  }
};
AgentBranchNameGenerator = __decorateClass([
  __decorateParam(0, ICopilotApiService),
  __decorateParam(1, ILogService)
], AgentBranchNameGenerator);
function normalizeAgentBranchName(branchName) {
  let normalized = branchName.replace(/[^a-zA-Z0-9\-]/g, "").toLowerCase();
  normalized = normalized.replace(/\.{2,}/g, ".");
  normalized = normalized.replace(/^[-.]+/, "");
  normalized = normalized.replace(/[./]+$/, "");
  normalized = normalized.replace(/\.lock$/, "");
  return normalized;
}
function getAgentBranchNameHintFromMessage(message) {
  const words = message.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").filter((word) => word.length > 0).slice(0, 8);
  const hint = words.join("-").slice(0, MAX_BRANCH_NAME_HINT_LENGTH).replace(/-+$/g, "");
  return hint.length > 0 ? hint : void 0;
}
export {
  AGENT_BRANCH_PREFIX,
  AgentBranchNameGenerator,
  getAgentBranchNameHintFromMessage,
  normalizeAgentBranchName
};
