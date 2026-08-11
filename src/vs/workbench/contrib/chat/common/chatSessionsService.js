import { URI } from "../../../../base/common/uri.js";
import { isRemoteAgentHostSessionType } from "../../../../platform/agentHost/common/agentHostSessionType.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { LOCAL_AGENT_HOST_SCHEME_PREFIX } from "../../../../platform/agentHost/common/agentHostConnectionsService.js";
var ChatSessionsExtensions = /* @__PURE__ */ ((ChatSessionsExtensions2) => {
  ChatSessionsExtensions2["AsyncActivation"] = "workbench.contrib.chatSessions.asyncActivation";
  return ChatSessionsExtensions2;
})(ChatSessionsExtensions || {});
class AsyncChatSessionActivationRegistry {
  constructor() {
    this._contributions = /* @__PURE__ */ new Set();
  }
  register(contribution) {
    this._contributions.add(contribution);
    return {
      dispose: () => this._contributions.delete(contribution)
    };
  }
  getActivators(sessionType) {
    return Array.from(this._contributions).filter((contribution) => contribution.matchSessionType(sessionType));
  }
}
Registry.add("workbench.contrib.chatSessions.asyncActivation" /* AsyncActivation */, new AsyncChatSessionActivationRegistry());
var ChatSessionStatus = /* @__PURE__ */ ((ChatSessionStatus2) => {
  ChatSessionStatus2[ChatSessionStatus2["Failed"] = 0] = "Failed";
  ChatSessionStatus2[ChatSessionStatus2["Completed"] = 1] = "Completed";
  ChatSessionStatus2[ChatSessionStatus2["InProgress"] = 2] = "InProgress";
  ChatSessionStatus2[ChatSessionStatus2["NeedsInput"] = 3] = "NeedsInput";
  return ChatSessionStatus2;
})(ChatSessionStatus || {});
function isTerminalCommandPrompt(text, prefix) {
  return !!prefix && text.startsWith(prefix) && text.slice(prefix.length).trim().length > 0;
}
var SessionType;
((SessionType2) => {
  SessionType2.CopilotCLI = "copilotcli";
  SessionType2.CopilotCloud = "copilot-cloud-agent";
  SessionType2.Local = "local";
  SessionType2.Codex = "openai-codex";
  SessionType2.Growth = "copilot-growth";
  SessionType2.AgentHostCopilot = "agent-host-copilotcli";
  SessionType2.AgentHostClaude = "agent-host-claude";
  SessionType2.AgentHostCodex = "agent-host-codex";
})(SessionType || (SessionType = {}));
function isLocalAgentHostTarget(target) {
  return target === SessionType.AgentHostCopilot || target.startsWith(LOCAL_AGENT_HOST_SCHEME_PREFIX);
}
function isRemoteAgentHostTarget(target) {
  return isRemoteAgentHostSessionType(target);
}
function isAgentHostTarget(target) {
  return isLocalAgentHostTarget(target) || isRemoteAgentHostTarget(target);
}
const localChatSessionType = SessionType.Local;
var ChatSessionOptionsMap;
((ChatSessionOptionsMap2) => {
  function fromRecord(obj) {
    return new Map(Object.entries(obj));
  }
  ChatSessionOptionsMap2.fromRecord = fromRecord;
  function toRecord(map) {
    const record = /* @__PURE__ */ Object.create(null);
    const entries = ensureIterable(map);
    for (const [key, value] of entries) {
      record[key] = value;
    }
    return record;
  }
  ChatSessionOptionsMap2.toRecord = toRecord;
  function toStrValueArray(map) {
    if (!map) {
      return void 0;
    }
    const entries = ensureIterable(map);
    return Array.from(entries, ([optionId, value]) => ({ optionId, value: typeof value === "string" ? value : value.id }));
  }
  ChatSessionOptionsMap2.toStrValueArray = toStrValueArray;
  function ensureIterable(map) {
    if (map instanceof Map) {
      return map;
    }
    return Object.entries(map);
  }
})(ChatSessionOptionsMap || (ChatSessionOptionsMap = {}));
const IChatSessionsService = createDecorator("chatSessionsService");
function isSessionInProgressStatus(state) {
  return state === 2 /* InProgress */ || state === 3 /* NeedsInput */;
}
function isIChatSessionFileChange2(obj) {
  const candidate = obj;
  return candidate && candidate.uri instanceof URI && typeof candidate.insertions === "number" && typeof candidate.deletions === "number";
}
export {
  ChatSessionOptionsMap,
  ChatSessionStatus,
  ChatSessionsExtensions,
  IChatSessionsService,
  SessionType,
  isAgentHostTarget,
  isIChatSessionFileChange2,
  isLocalAgentHostTarget,
  isRemoteAgentHostTarget,
  isSessionInProgressStatus,
  isTerminalCommandPrompt,
  localChatSessionType
};
