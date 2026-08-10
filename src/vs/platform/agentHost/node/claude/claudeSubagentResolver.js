import { vObjAny, vString as vStringValidator } from "../../../../base/common/validation.js";
import { AgentSession } from "../../common/agentService.js";
import { parseSubagentSessionUri } from "../../common/state/sessionState.js";
import {
  ResponsePartKind,
  ToolCallStatus
} from "../../common/state/protocol/state.js";
import { mapSessionMessagesToTurns } from "./claudeReplayMapper.js";
import { scanTranscriptForAgentIds, SUBAGENT_TOOL_NAMES } from "./claudeSubagentRegistry.js";
class TextSuffixStrategy {
  constructor(_sdk, _logService) {
    this._sdk = _sdk;
    this._logService = _logService;
    this.name = "text_suffix";
  }
  async lookup(toolCallId, ctx) {
    const transcript = await fetchParentTurns(this._sdk, this._logService, ctx, "TextSuffix");
    if (!transcript) {
      return void 0;
    }
    return scanTranscriptForAgentIds(transcript).get(toolCallId);
  }
}
async function fetchParentTurns(sdk, logService, ctx, strategyLabel) {
  if (ctx.parentTranscript) {
    return ctx.parentTranscript;
  }
  try {
    const messages = await sdk.getSessionMessages(ctx.parentSessionId, { includeSystemMessages: true });
    return mapSessionMessagesToTurns(messages, ctx.parentUri, logService);
  } catch (err) {
    logService.warn(`[claudeSubagentResolver] ${strategyLabel}: parent transcript fetch failed: ${err}`);
    return void 0;
  }
}
function vString(input) {
  const r = vStringValidator().validate(input);
  return r.error ? void 0 : r.content;
}
function vObj(input) {
  const r = vObjAny().validate(input);
  if (r.error || r.content === null || Array.isArray(r.content)) {
    return void 0;
  }
  return r.content;
}
class PromptMatchStrategy {
  constructor(_sdk, _logService) {
    this._sdk = _sdk;
    this._logService = _logService;
    this.name = "prompt_match";
  }
  async lookup(toolCallId, ctx) {
    const prompt = await this._loadParentPrompt(toolCallId, ctx);
    if (!prompt) {
      return void 0;
    }
    let agentIds;
    try {
      agentIds = await this._sdk.listSubagents(ctx.parentSessionId);
    } catch (err) {
      this._logService.warn(`[claudeSubagentResolver] PromptMatch: listSubagents failed: ${err}`);
      return void 0;
    }
    for (const agentId of agentIds) {
      if (ctx.token.isCancellationRequested) {
        return void 0;
      }
      let messages;
      try {
        messages = await this._sdk.getSubagentMessages(ctx.parentSessionId, agentId);
      } catch (err) {
        this._logService.warn(`[claudeSubagentResolver] PromptMatch: getSubagentMessages(${agentId}) failed: ${err}`);
        continue;
      }
      const firstMessage = extractFirstUserText(messages);
      if (firstMessage === void 0) {
        continue;
      }
      if (firstMessage === prompt) {
        return agentId;
      }
    }
    return void 0;
  }
  async _loadParentPrompt(toolCallId, ctx) {
    const transcript = await fetchParentTurns(this._sdk, this._logService, ctx, "PromptMatch");
    if (!transcript) {
      return void 0;
    }
    return extractSpawningPromptFromTranscript(transcript, toolCallId);
  }
}
function extractSpawningPromptFromTranscript(transcript, toolCallId) {
  for (const turn of transcript) {
    for (const part of turn.responseParts) {
      if (part.kind !== ResponsePartKind.ToolCall) {
        continue;
      }
      const state = part.toolCall;
      if (state.toolCallId !== toolCallId) {
        continue;
      }
      if (!SUBAGENT_TOOL_NAMES.has(state.toolName)) {
        return void 0;
      }
      if (state.status === ToolCallStatus.Streaming) {
        return void 0;
      }
      const inputRaw = state.toolInput;
      if (typeof inputRaw !== "string") {
        return void 0;
      }
      let parsed;
      try {
        parsed = JSON.parse(inputRaw);
      } catch {
        return void 0;
      }
      const bag = vObj(parsed);
      if (!bag) {
        return void 0;
      }
      return vString(bag.prompt);
    }
  }
  return void 0;
}
function extractFirstUserText(messages) {
  for (const msg of messages) {
    if (msg.type !== "user") {
      continue;
    }
    const inner = vObj(msg.message);
    if (!inner) {
      continue;
    }
    const content = inner.content;
    if (typeof content === "string") {
      return content;
    }
    if (!Array.isArray(content)) {
      continue;
    }
    for (const block of content) {
      const obj = vObj(block);
      if (!obj || obj.type !== "text") {
        continue;
      }
      const text = vString(obj.text);
      if (text !== void 0) {
        return text;
      }
    }
  }
  return void 0;
}
class NativeStrategy {
  constructor() {
    this.name = "native";
  }
  async lookup() {
    return void 0;
  }
}
async function resolveAgentIdViaChain(toolCallId, ctx, deps) {
  const cached = deps.cacheGet(toolCallId);
  if (cached) {
    return cached;
  }
  for (const strategy of deps.strategies) {
    if (ctx.token.isCancellationRequested) {
      return void 0;
    }
    const hit = await strategy.lookup(toolCallId, ctx);
    if (hit) {
      deps.cacheSet(toolCallId, hit);
      return hit;
    }
  }
  return void 0;
}
function buildDefaultStrategies(sdk, logService) {
  return [
    new TextSuffixStrategy(sdk, logService),
    new PromptMatchStrategy(sdk, logService),
    new NativeStrategy()
  ];
}
async function getSubagentTranscript(subagentUri, parentRegistry, sdk, logService, token) {
  const parsed = parseSubagentSessionUri(subagentUri);
  if (!parsed) {
    throw new Error(`getSubagentTranscript: not a subagent URI: ${subagentUri.toString()}`);
  }
  const { parentSession, toolCallId } = parsed;
  const parentSessionId = AgentSession.id(parentSession);
  const agentId = await resolveAgentIdViaChain(toolCallId, {
    parentUri: parentSession,
    parentSessionId,
    token
  }, {
    strategies: buildDefaultStrategies(sdk, logService),
    cacheGet: (id) => parentRegistry.getSpawn(id)?.agentId,
    cacheSet: (id, resolved) => {
      parentRegistry.recordSpawn(id, { agentId: resolved });
    }
  });
  if (!agentId) {
    return [];
  }
  let messages;
  try {
    messages = await sdk.getSubagentMessages(parentSessionId, agentId);
  } catch (err) {
    logService.warn(`[getSubagentTranscript] getSubagentMessages(${agentId}) failed: ${err}`);
    return [];
  }
  return mapSessionMessagesToTurns(messages, subagentUri, logService);
}
export {
  NativeStrategy,
  PromptMatchStrategy,
  TextSuffixStrategy,
  extractSpawningPromptFromTranscript,
  fetchParentTurns,
  getSubagentTranscript,
  resolveAgentIdViaChain
};
