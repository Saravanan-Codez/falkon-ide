import { localize } from "../../../../../nls.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { URI } from "../../../../../base/common/uri.js";
import { foreground, listActiveSelectionForeground, registerColor, transparent } from "../../../../../platform/theme/common/colorRegistry.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { isAgentHostTarget, SessionType } from "../../common/chatSessionsService.js";
var AgentSessionProviders = ((AgentSessionProviders2) => {
  AgentSessionProviders2[AgentSessionProviders2["Local"] = SessionType.Local] = "Local";
  AgentSessionProviders2[AgentSessionProviders2["Background"] = SessionType.CopilotCLI] = "Background";
  AgentSessionProviders2[AgentSessionProviders2["Cloud"] = SessionType.CopilotCloud] = "Cloud";
  AgentSessionProviders2[AgentSessionProviders2["Codex"] = SessionType.Codex] = "Codex";
  AgentSessionProviders2[AgentSessionProviders2["Growth"] = SessionType.Growth] = "Growth";
  AgentSessionProviders2[AgentSessionProviders2["AgentHostCopilot"] = SessionType.AgentHostCopilot] = "AgentHostCopilot";
  AgentSessionProviders2[AgentSessionProviders2["AgentHostClaude"] = SessionType.AgentHostClaude] = "AgentHostClaude";
  AgentSessionProviders2[AgentSessionProviders2["AgentHostCodex"] = SessionType.AgentHostCodex] = "AgentHostCodex";
  return AgentSessionProviders2;
})(AgentSessionProviders || {});
function isBuiltInAgentSessionProvider(provider) {
  return provider === AgentSessionProviders.Local || provider === AgentSessionProviders.Background || provider === AgentSessionProviders.Cloud;
}
function getAgentSessionProvider(sessionResource) {
  const type = URI.isUri(sessionResource) ? getChatSessionType(sessionResource) : sessionResource;
  switch (type) {
    case AgentSessionProviders.Local:
    case AgentSessionProviders.Background:
    case AgentSessionProviders.Cloud:
    case AgentSessionProviders.Codex:
    case AgentSessionProviders.AgentHostCopilot:
    case AgentSessionProviders.AgentHostClaude:
    case AgentSessionProviders.AgentHostCodex:
      return type;
    default:
      return void 0;
  }
}
function getAgentSessionProviderName(provider) {
  switch (provider) {
    case AgentSessionProviders.Local:
      return localize("chat.session.providerLabel.local", "Local");
    case AgentSessionProviders.Background:
      return localize("chat.session.providerLabel.background", "Copilot CLI");
    case AgentSessionProviders.Cloud:
      return localize("chat.session.providerLabel.cloud", "Cloud");
    case AgentSessionProviders.AgentHostClaude:
      return "Claude";
    case AgentSessionProviders.Codex:
    case AgentSessionProviders.AgentHostCodex:
      return "Codex";
    case AgentSessionProviders.Growth:
      return "Growth";
    case AgentSessionProviders.AgentHostCopilot:
      return localize("chat.session.providerLabel.agentHostCopilot", "Copilot");
    default:
      return provider;
  }
}
function getAgentSessionProviderIcon(provider) {
  switch (provider) {
    case AgentSessionProviders.Local:
      return Codicon.vm;
    case AgentSessionProviders.Background:
      return Codicon.copilot;
    case AgentSessionProviders.Cloud:
      return Codicon.cloud;
    case AgentSessionProviders.Codex:
    case AgentSessionProviders.AgentHostCodex:
      return Codicon.openai;
    case AgentSessionProviders.AgentHostClaude:
      return Codicon.claude;
    case AgentSessionProviders.Growth:
      return Codicon.lightbulb;
    case AgentSessionProviders.AgentHostCopilot:
      return Codicon.vm;
    default:
      return Codicon.extensions;
  }
}
function isFirstPartyAgentSessionProvider(provider) {
  switch (provider) {
    case AgentSessionProviders.Local:
    case AgentSessionProviders.Background:
    case AgentSessionProviders.Cloud:
    case AgentSessionProviders.AgentHostCopilot:
      return true;
    case AgentSessionProviders.AgentHostClaude:
    case AgentSessionProviders.Codex:
    case AgentSessionProviders.AgentHostCodex:
    case AgentSessionProviders.Growth:
      return false;
    default:
      return false;
  }
}
const CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID = "workbench.action.chat.delegateToAgentHostSession";
function getAgentCanContinueIn(provider) {
  switch (provider) {
    case AgentSessionProviders.Local:
    case AgentSessionProviders.Background:
    case AgentSessionProviders.Cloud:
    case AgentSessionProviders.AgentHostCopilot:
      return true;
    case AgentSessionProviders.Codex:
    case AgentSessionProviders.Growth:
      return false;
    default:
      return isAgentHostTarget(provider);
  }
}
function getAgentSessionProviderDescription(provider) {
  switch (provider) {
    case AgentSessionProviders.Local:
      return localize("chat.session.providerDescription.local", "Run tasks within VS Code chat. The agent iterates via chat and works interactively to implement changes on your main workspace.");
    case AgentSessionProviders.Background:
      return localize("chat.session.providerDescription.background", "Delegate tasks to a background agent running locally on your machine. The agent iterates via chat and works asynchronously in a Git worktree to implement changes isolated from your main workspace using the GitHub Copilot CLI.");
    case AgentSessionProviders.Cloud:
      return localize("chat.session.providerDescription.cloud", "Delegate tasks to the GitHub Copilot coding agent. The agent iterates via chat and works asynchronously in the cloud to implement changes and pull requests as needed.");
    case AgentSessionProviders.AgentHostClaude:
      return localize("chat.session.providerDescription.claude", "Delegate tasks to the Claude Agent SDK using the Claude models included in your GitHub Copilot subscription. The agent iterates via chat and works interactively to implement changes on your main workspace.");
    case AgentSessionProviders.Codex:
      return localize("chat.session.providerDescription.codex", "Open a new Codex session using the Codex extension from OpenAI. Codex sessions can be managed from the chat sessions view.");
    case AgentSessionProviders.AgentHostCodex:
      return localize("chat.session.providerDescription.agentHostCodex", "Delegate tasks to the Codex App Server using the Codex models included in your GitHub Copilot subscription. The agent iterates via chat and works interactively to implement changes on your main workspace.");
    case AgentSessionProviders.Growth:
      return localize("chat.session.providerDescription.growth", "Learn about Copilot features.");
    case AgentSessionProviders.AgentHostCopilot:
      return localize("chat.session.providerDescription.agentHostCopilot", "Run a Copilot SDK agent in the local agent host process.");
    default:
      return "";
  }
}
var AgentSessionsViewerOrientation = /* @__PURE__ */ ((AgentSessionsViewerOrientation2) => {
  AgentSessionsViewerOrientation2[AgentSessionsViewerOrientation2["Stacked"] = 1] = "Stacked";
  AgentSessionsViewerOrientation2[AgentSessionsViewerOrientation2["SideBySide"] = 2] = "SideBySide";
  return AgentSessionsViewerOrientation2;
})(AgentSessionsViewerOrientation || {});
var AgentSessionsViewerPosition = /* @__PURE__ */ ((AgentSessionsViewerPosition2) => {
  AgentSessionsViewerPosition2[AgentSessionsViewerPosition2["Left"] = 1] = "Left";
  AgentSessionsViewerPosition2[AgentSessionsViewerPosition2["Right"] = 2] = "Right";
  return AgentSessionsViewerPosition2;
})(AgentSessionsViewerPosition || {});
const agentSessionReadIndicatorForeground = registerColor(
  "agentSessionReadIndicator.foreground",
  { dark: transparent(foreground, 0.2), light: transparent(foreground, 0.2), hcDark: null, hcLight: null },
  localize("agentSessionReadIndicatorForeground", "Foreground color for the read indicator in an agent session.")
);
const agentSessionSelectedBadgeBorder = registerColor(
  "agentSessionSelectedBadge.border",
  { dark: transparent(listActiveSelectionForeground, 0.3), light: transparent(listActiveSelectionForeground, 0.3), hcDark: foreground, hcLight: foreground },
  localize("agentSessionSelectedBadgeBorder", "Border color for the badges in selected agent session items.")
);
const agentSessionSelectedUnfocusedBadgeBorder = registerColor(
  "agentSessionSelectedUnfocusedBadge.border",
  { dark: transparent(foreground, 0.3), light: transparent(foreground, 0.3), hcDark: foreground, hcLight: foreground },
  localize("agentSessionSelectedUnfocusedBadgeBorder", "Border color for the badges in selected agent session items when the view is unfocused.")
);
const AGENT_SESSION_RENAME_ACTION_ID = "agentSession.rename";
const AGENT_SESSION_DELETE_ACTION_ID = "agentSession.delete";
export {
  AGENT_SESSION_DELETE_ACTION_ID,
  AGENT_SESSION_RENAME_ACTION_ID,
  AgentSessionProviders,
  AgentSessionsViewerOrientation,
  AgentSessionsViewerPosition,
  CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID,
  agentSessionReadIndicatorForeground,
  agentSessionSelectedBadgeBorder,
  agentSessionSelectedUnfocusedBadgeBorder,
  getAgentCanContinueIn,
  getAgentSessionProvider,
  getAgentSessionProviderDescription,
  getAgentSessionProviderIcon,
  getAgentSessionProviderName,
  isAgentHostTarget,
  isBuiltInAgentSessionProvider,
  isFirstPartyAgentSessionProvider
};
