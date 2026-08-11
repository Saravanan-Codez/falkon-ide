import { Codicon } from "../../../../../base/common/codicons.js";
import { fromNow } from "../../../../../base/common/date.js";
import { isUriComponents, URI } from "../../../../../base/common/uri.js";
import { localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IAgentSessionsService } from "../agentSessions/agentSessionsService.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ILanguageModelsService } from "../../common/languageModels.js";
import { IChatWidgetService } from "../chat.js";
import { IStorageService, StorageScope } from "../../../../../platform/storage/common/storage.js";
import { AUTOPILOT_DONT_SHOW_AGAIN_KEY, AUTO_APPROVE_DONT_SHOW_AGAIN_KEY } from "../../common/chatPermissionStorageKeys.js";
import { resetShownWarnings } from "../../common/chatPermissionWarnings.js";
import { OpenCopilotCliStateFileAction } from "./openCopilotCliStateFileAction.js";
import { IAgentHostConnectionsService } from "../../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { StateComponents } from "../../../../../platform/agentHost/common/state/sessionState.js";
function uriReplacer(_key, value) {
  if (URI.isUri(value)) {
    return value.toString();
  }
  if (isUriComponents(value)) {
    return URI.from(value).toString();
  }
  return value;
}
function registerChatDeveloperActions() {
  registerAction2(LogChatInputHistoryAction);
  registerAction2(LogChatIndexAction);
  registerAction2(InspectChatModelAction);
  registerAction2(InspectChatModelReferencesAction);
  registerAction2(InspectAgentHostSubscriptionsAction);
  registerAction2(ClearRecentlyUsedLanguageModelsAction);
  registerAction2(ResetChatPermissionWarningDialogsAction);
  registerAction2(OpenCopilotCliStateFileAction);
}
function formatChatModelReferenceInspection(accessor) {
  const chatService = accessor.get(IChatService);
  const agentSessionsService = accessor.get(IAgentSessionsService);
  const debugInfo = chatService.getChatModelReferenceDebugInfo();
  const referencedModels = debugInfo.models.filter((model) => model.referenceCount > 0);
  const pendingEditModels = debugInfo.models.filter((model) => model.hasPendingEdits);
  const pendingDisposalModels = debugInfo.models.filter((model) => model.pendingDisposal);
  let output = "# Chat Model References\n\n";
  output += `- Live models: ${debugInfo.totalModels}
`;
  output += `- Live references: ${debugInfo.totalReferences}
`;
  output += `- Models with active references: ${referencedModels.length}
`;
  output += `- Models with pending edits: ${pendingEditModels.length}
`;
  output += `- Models pending disposal: ${pendingDisposalModels.length}

`;
  output += "Created by shows who loaded or created the model. Holders shows who currently keeps the model alive.\n\n";
  if (!debugInfo.models.length) {
    output += "No live chat models.\n";
    return output;
  }
  for (const model of debugInfo.models) {
    const liveModel = chatService.getSession(model.sessionResource);
    const agentSession = agentSessionsService.getSession(model.sessionResource);
    const archived = agentSession ? agentSession.isArchived() : "unknown";
    const age = liveModel ? fromNow(liveModel.timing.created, true, true, true) : "unknown";
    output += `## ${model.title || "(untitled)"}

`;
    output += `- Session: ${model.sessionResource.toString()}
`;
    output += `- Created by: ${model.createdBy}
`;
    output += `- Archived: ${archived}
`;
    output += `- Age: ${age}
`;
    output += `- Initial location: ${model.initialLocation}
`;
    output += `- Imported: ${model.isImported}
`;
    output += `- Pending edits: ${model.hasPendingEdits}
`;
    output += `- Background keep-alive enabled: ${model.willKeepAlive}
`;
    output += `- Pending disposal: ${model.pendingDisposal}
`;
    output += `- Reference count: ${model.referenceCount}
`;
    if (model.holders.length) {
      output += "- Holders:\n";
      for (const holder of model.holders) {
        output += `  - ${holder.holder}: ${holder.count}
`;
      }
    } else {
      output += "- Holders: none\n";
    }
    output += "\n";
  }
  return output;
}
class LogChatInputHistoryAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.logInputHistory";
  }
  constructor() {
    super({
      id: LogChatInputHistoryAction.ID,
      title: localize2("workbench.action.chat.logInputHistory.label", "Log Chat Input History"),
      icon: Codicon.attach,
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor, ...args) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    chatWidgetService.lastFocusedWidget?.logInputHistory();
  }
}
class LogChatIndexAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.logChatIndex";
  }
  constructor() {
    super({
      id: LogChatIndexAction.ID,
      title: localize2("workbench.action.chat.logChatIndex.label", "Log Chat Index"),
      icon: Codicon.attach,
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    chatService.logChatIndex();
  }
}
class InspectChatModelAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.inspectChatModel";
  }
  constructor() {
    super({
      id: InspectChatModelAction.ID,
      title: localize2("workbench.action.chat.inspectChatModel.label", "Inspect Chat Model"),
      icon: Codicon.inspect,
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor, ...args) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const editorService = accessor.get(IEditorService);
    const widget = chatWidgetService.lastFocusedWidget;
    if (!widget?.viewModel) {
      return;
    }
    const model = widget.viewModel.model;
    const modelData = model.toJSON();
    let output = "# Chat Model Inspection\n\n";
    const requests = modelData.requests;
    if (requests && requests.length > 0) {
      const latestRequest = requests[requests.length - 1];
      if (latestRequest.response) {
        output += "## Latest Response\n\n";
        output += "```json\n" + JSON.stringify(latestRequest.response, uriReplacer, 2) + "\n```\n\n";
      }
    }
    output += "## Full Chat Model\n\n";
    output += "```json\n" + JSON.stringify(modelData, uriReplacer, 2) + "\n```\n";
    await editorService.openEditor({
      resource: void 0,
      contents: output,
      languageId: "markdown",
      options: {
        pinned: true
      }
    });
  }
}
class InspectChatModelReferencesAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.inspectChatModelReferences";
  }
  constructor() {
    super({
      id: InspectChatModelReferencesAction.ID,
      title: localize2("workbench.action.chat.inspectChatModelReferences.label", "Inspect Chat Model References"),
      icon: Codicon.inspect,
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({
      resource: void 0,
      contents: instantiationService.invokeFunction(formatChatModelReferenceInspection),
      languageId: "markdown",
      options: {
        pinned: true
      }
    });
  }
}
function subscriptionKindLabel(kind) {
  switch (kind) {
    case StateComponents.Root:
      return "root";
    case StateComponents.Session:
      return "session";
    case StateComponents.Terminal:
      return "terminal";
    case StateComponents.Changeset:
      return "changeset";
    default:
      return `unknown(${kind})`;
  }
}
function escapeMarkdownTableCell(value) {
  return value.replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
}
function formatConnectionSubscriptions(label, details, connection) {
  let output = `## ${label}

`;
  output += `- ${details}
`;
  if (!connection) {
    output += "- Not connected.\n\n";
    return output;
  }
  const root = connection.rootState.value;
  if (root === void 0) {
    output += "- Root state: pending (no snapshot yet)\n";
  } else if (root instanceof Error) {
    output += `- Root state: error (${root.message})
`;
  } else {
    const agents = root.agents?.map((a) => a.displayName).join(", ") || "none";
    output += `- Root state: agents=[${agents}], activeSessions=${root.activeSessions ?? 0}, terminals=${root.terminals?.length ?? 0}
`;
  }
  const subscriptions = connection.getActiveSubscriptions();
  output += `- Active subscriptions: ${subscriptions.length}

`;
  if (subscriptions.length) {
    const sorted = [...subscriptions].sort((a, b) => a.resource.toString().localeCompare(b.resource.toString()));
    output += "| Resource | Kind | Refs | Holders | Status |\n";
    output += "| --- | --- | --- | --- | --- |\n";
    for (const subscription of sorted) {
      const holders = subscription.holders.length ? subscription.holders.map((h) => h.count > 1 ? `${h.owner} (${h.count})` : h.owner).join(", ") : "(none)";
      const cells = [
        subscription.resource.toString(),
        subscriptionKindLabel(subscription.kind),
        String(subscription.refCount),
        holders,
        subscription.status
      ].map(escapeMarkdownTableCell);
      output += `| ${cells.join(" | ")} |
`;
    }
    output += "\n";
  }
  return output;
}
function formatAgentHostSubscriptionsInspection(accessor) {
  const connectionsService = accessor.get(IAgentHostConnectionsService);
  const connections = connectionsService.connections;
  const remoteCount = connections.filter((c) => !c.isAmbient).length;
  let output = "# Agent Host Subscriptions\n\n";
  output += `- Connections: ${connections.length} (1 ambient, ${remoteCount} remote)
`;
  output += "Lists every resource each connected agent host is currently subscribed to. The always-live root state is summarized separately from the per-resource subscription table.\n\n";
  for (const info of connections) {
    const heading = info.isAmbient ? "Ambient agent host" : `Remote: ${info.name}`;
    const details = [
      ...info.address ? [`address: ${info.address}`] : [],
      `clientId: ${info.connection?.clientId || "(none)"}`
    ].join(" \xB7 ");
    output += formatConnectionSubscriptions(heading, details, info.connection);
  }
  return output;
}
class InspectAgentHostSubscriptionsAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.inspectAgentHostSubscriptions";
  }
  constructor() {
    super({
      id: InspectAgentHostSubscriptionsAction.ID,
      title: localize2("workbench.action.chat.inspectAgentHostSubscriptions.label", "Inspect Agent Host Subscriptions"),
      icon: Codicon.inspect,
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({
      resource: void 0,
      contents: instantiationService.invokeFunction(formatAgentHostSubscriptionsInspection),
      languageId: "markdown",
      options: {
        pinned: true
      }
    });
  }
}
class ClearRecentlyUsedLanguageModelsAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.clearRecentlyUsedLanguageModels";
  }
  constructor() {
    super({
      id: ClearRecentlyUsedLanguageModelsAction.ID,
      title: localize2("workbench.action.chat.clearRecentlyUsedLanguageModels.label", "Clear Recently Used Language Models"),
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  run(accessor) {
    accessor.get(ILanguageModelsService).clearRecentlyUsedList();
  }
}
class ResetChatPermissionWarningDialogsAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.resetPermissionWarningDialogs";
  }
  constructor() {
    super({
      id: ResetChatPermissionWarningDialogsAction.ID,
      title: localize2("workbench.action.chat.resetPermissionWarningDialogs.label", "Reset Permission Warning Dialogs (Autopilot, Bypass Approvals)"),
      category: Categories.Developer,
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  run(accessor) {
    const storageService = accessor.get(IStorageService);
    storageService.remove(AUTOPILOT_DONT_SHOW_AGAIN_KEY, StorageScope.PROFILE);
    storageService.remove(AUTO_APPROVE_DONT_SHOW_AGAIN_KEY, StorageScope.PROFILE);
    resetShownWarnings();
  }
}
export {
  registerChatDeveloperActions
};
