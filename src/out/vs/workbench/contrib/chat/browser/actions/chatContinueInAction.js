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
import { Codicon } from "../../../../../base/common/codicons.js";
import { h } from "../../../../../base/browser/dom.js";
import { Disposable, markAsSingleton } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { isAbsolute } from "../../../../../base/common/path.js";
import { basename } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { isITextModel } from "../../../../../editor/common/model.js";
import { localize, localize2 } from "../../../../../nls.js";
import { ActionWidgetDropdownActionViewItem } from "../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IsSessionsWindowContext, ResourceContextKey } from "../../../../common/contextkeys.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IChatAgentService } from "../../common/participants/chatAgents.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { chatEditingWidgetFileStateContextKey, ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { ChatRequestParser } from "../../common/requestParser/chatRequestParser.js";
import { getDynamicVariablesForWidget, getSelectedToolAndToolSetsForWidget } from "../attachments/chatVariables.js";
import { ChatSendResult, IChatService } from "../../common/chatService/chatService.js";
import { IChatSessionsService, SessionType } from "../../common/chatSessionsService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { PROMPT_LANGUAGE_ID } from "../../common/promptSyntax/promptTypes.js";
import { AgentSessionProviders, CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID, getAgentSessionProvider, getAgentSessionProviderIcon, getAgentSessionProviderName, isAgentHostTarget } from "../agentSessions/agentSessions.js";
import { ISCMService } from "../../../scm/common/scm.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IAgentSessionsService } from "../agentSessions/agentSessionsService.js";
import { IChatWidgetService, isIChatViewViewContext } from "../chat.js";
import { ctxHasEditorModification } from "../chatEditing/chatEditingEditorContextKeys.js";
import { CHAT_SETUP_ACTION_ID } from "./chatActions.js";
import { PromptFileVariableKind, toPasteVariableEntry, toPromptFileVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { ChatSessionPosition, openChatSession } from "../chatSessions/chatSessions.contribution.js";
import { importedTurnsFromChatModel } from "../agentSessions/agentHost/importLocalConversationToAgentSession.js";
function extractNwoFromRemoteUrl(remoteUrl) {
  const match = remoteUrl.match(/(?:github\.com)[/:](?<owner>[^/]+)\/(?<repo>[^/.]+)/);
  if (match?.groups) {
    return `${match.groups.owner}/${match.groups.repo}`;
  }
  return void 0;
}
async function resolveGitRemoteNwo(repoPath, fileService) {
  try {
    const gitPath = `${repoPath}/.git`;
    const gitUri = URI.file(gitPath);
    let configUri;
    try {
      const stat = await fileService.stat(gitUri);
      if (stat.isDirectory) {
        configUri = URI.file(`${gitPath}/config`);
      } else {
        const gitFile = await fileService.readFile(gitUri);
        const gitDir = gitFile.value.toString().trim().replace(/^gitdir:\s*/, "");
        const resolvedGitDir = gitDir.startsWith("/") ? gitDir : `${repoPath}/${gitDir}`;
        const commonDir = resolvedGitDir.replace(/\/worktrees\/[^/]+$/, "");
        configUri = URI.file(`${commonDir}/config`);
      }
    } catch {
      return void 0;
    }
    const content = await fileService.readFile(configUri);
    const configText = content.value.toString();
    const remoteMatch = configText.match(/\[remote\s+"origin"\][^[]*url\s*=\s*(.+)/m);
    if (remoteMatch?.[1]) {
      return extractNwoFromRemoteUrl(remoteMatch[1].trim());
    }
  } catch {
  }
  return void 0;
}
var ActionLocation = /* @__PURE__ */ ((ActionLocation2) => {
  ActionLocation2["ChatWidget"] = "chatWidget";
  ActionLocation2["Editor"] = "editor";
  return ActionLocation2;
})(ActionLocation || {});
class ContinueChatInSessionAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.continueChatInSession";
  }
  constructor() {
    super({
      id: ContinueChatInSessionAction.ID,
      title: localize2("continueChatInSession", "Continue Chat in..."),
      tooltip: localize("continueChatInSession", "Continue Chat in..."),
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ChatContextKeys.requestInProgress.negate(),
        ChatContextKeys.remoteJobCreating.negate(),
        ChatContextKeys.hasCanDelegateProviders
      ),
      menu: [
        {
          id: MenuId.ChatExecute,
          group: "navigation",
          order: 3.4,
          when: ContextKeyExpr.and(
            ChatContextKeys.lockedToCodingAgent.negate(),
            ChatContextKeys.hasCanDelegateProviders
          )
        },
        {
          id: MenuId.EditorContent,
          group: "continueIn",
          when: ContextKeyExpr.and(
            ContextKeyExpr.equals(ResourceContextKey.Scheme.key, Schemas.untitled),
            ContextKeyExpr.equals(ResourceContextKey.LangId.key, PROMPT_LANGUAGE_ID),
            ContextKeyExpr.notEquals(chatEditingWidgetFileStateContextKey.key, ModifiedFileEntryState.Modified),
            ctxHasEditorModification.negate(),
            ChatContextKeys.hasCanDelegateProviders
          )
        }
      ]
    });
  }
  async run() {
  }
}
let ChatContinueInSessionActionItem = class extends ActionWidgetDropdownActionViewItem {
  constructor(action, location, actionWidgetService, contextKeyService, keybindingService, chatSessionsService, instantiationService, openerService, telemetryService, scmService, workspaceContextService) {
    super(action, {
      actionProvider: ChatContinueInSessionActionItem.actionProvider(chatSessionsService, instantiationService, scmService, workspaceContextService, location),
      actionBarActions: ChatContinueInSessionActionItem.getActionBarActions(openerService),
      reporter: { id: "ChatContinueInSession", name: "ChatContinueInSession", includeOptions: true }
    }, actionWidgetService, keybindingService, contextKeyService, telemetryService);
    this.location = location;
    this.contextKeyService = contextKeyService;
  }
  static getActionBarActions(openerService) {
    const learnMoreUrl = "https://aka.ms/vscode-agent-handoff";
    return [{
      id: "workbench.action.chat.continueChatInSession.learnMore",
      label: localize("chat.learnMore", "Learn More"),
      tooltip: localize("chat.learnMore", "Learn More"),
      class: void 0,
      enabled: true,
      run: async () => {
        await openerService.open(URI.parse(learnMoreUrl));
      }
    }];
  }
  static actionProvider(chatSessionsService, instantiationService, scmService, workspaceContextService, location) {
    return {
      getActions: () => {
        const actions = [];
        const contributions = chatSessionsService.getAllChatSessionContributions();
        const folders = workspaceContextService.getWorkspace().folders;
        let hasGitRepo = false;
        if (folders.length > 0) {
          for (const repo of scmService.repositories) {
            if (repo.provider.rootUri && workspaceContextService.getWorkspaceFolder(repo.provider.rootUri)) {
              hasGitRepo = true;
              break;
            }
          }
        }
        const backgroundContrib = contributions.find((contrib) => contrib.type === AgentSessionProviders.Background);
        if (backgroundContrib && backgroundContrib.canDelegate) {
          actions.push(this.toAction(AgentSessionProviders.Background, backgroundContrib, instantiationService, location));
        }
        const cloudContrib = contributions.find((contrib) => contrib.type === AgentSessionProviders.Cloud);
        if (cloudContrib && cloudContrib.canDelegate) {
          actions.push(this.toAction(AgentSessionProviders.Cloud, cloudContrib, instantiationService, location, hasGitRepo));
        }
        for (const contrib of contributions) {
          if (contrib.canDelegate && isAgentHostTarget(contrib.type)) {
            actions.push(this.toAction(contrib.type, contrib, instantiationService, location));
          }
        }
        if (actions.length === 0) {
          actions.push(this.toSetupAction(AgentSessionProviders.Background, instantiationService));
          actions.push(this.toSetupAction(AgentSessionProviders.Cloud, instantiationService));
        }
        return actions;
      }
    };
  }
  static toAction(provider, contrib, instantiationService, location, enabled = true) {
    const providerName = getAgentSessionProviderName(provider);
    const label = providerName === provider ? contrib.displayName ?? providerName : providerName;
    return {
      id: contrib.type,
      enabled,
      icon: getAgentSessionProviderIcon(provider),
      class: void 0,
      description: `@${contrib.name}`,
      label,
      tooltip: localize("continueSessionIn", "Continue in {0}", label),
      category: { label: localize("continueIn", "Continue In"), order: 0, showHeader: true },
      run: () => instantiationService.invokeFunction((accessor) => {
        if (location === "editor" /* Editor */) {
          return new CreateRemoteAgentJobFromEditorAction().run(accessor, contrib);
        }
        return new CreateRemoteAgentJobAction().run(accessor, contrib);
      })
    };
  }
  static toSetupAction(provider, instantiationService) {
    return {
      id: provider,
      enabled: true,
      icon: getAgentSessionProviderIcon(provider),
      class: void 0,
      label: getAgentSessionProviderName(provider),
      tooltip: localize("continueSessionIn", "Continue in {0}", getAgentSessionProviderName(provider)),
      category: { label: localize("continueIn", "Continue In"), order: 0, showHeader: true },
      run: () => instantiationService.invokeFunction((accessor) => {
        const commandService = accessor.get(ICommandService);
        return commandService.executeCommand(CHAT_SETUP_ACTION_ID);
      })
    };
  }
  renderLabel(element) {
    if (this.location === "editor" /* Editor */) {
      const view = h("span.action-widget-delegate-label", [
        h("span", { className: ThemeIcon.asClassName(Codicon.forward) }),
        h("span", [localize("continueInEllipsis", "Continue in...")])
      ]);
      element.appendChild(view.root);
      return null;
    } else {
      const icon = this.contextKeyService.contextMatchesRules(ChatContextKeys.remoteJobCreating) ? Codicon.sync : Codicon.forward;
      element.classList.add(...ThemeIcon.asClassNameArray(icon));
      return super.renderLabel(element);
    }
  }
};
ChatContinueInSessionActionItem = __decorateClass([
  __decorateParam(2, IActionWidgetService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IChatSessionsService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, ISCMService),
  __decorateParam(10, IWorkspaceContextService)
], ChatContinueInSessionActionItem);
const NEW_CHAT_SESSION_ACTION_ID = "workbench.action.chat.openNewSessionEditor";
const MAX_DELEGATION_TRANSCRIPT_LENGTH = 2e4;
function buildDelegationTranscript(requests, maxLength = MAX_DELEGATION_TRANSCRIPT_LENGTH) {
  let transcript = requests.map((req) => {
    const userMsg = `User: ${req.message.text}`;
    const respMsg = req.response?.response ? `Assistant: ${req.response.response.getMarkdown()}` : "";
    return respMsg ? `${userMsg}
${respMsg}` : userMsg;
  }).join("\n\n");
  if (transcript.length > maxLength) {
    transcript = transcript.substring(transcript.length - maxLength);
  }
  return transcript;
}
function createDelegationTranscriptAttachment(transcript, sourceName) {
  if (!transcript) {
    return void 0;
  }
  const transcriptName = localize("chat.delegation.transcriptName", "Previous conversation");
  const transcriptContent = localize("chat.delegation.transcriptContent", "The following is the conversation history from a previous {0} session. Continue working on it.\n\n{1}", sourceName, transcript);
  return toPasteVariableEntry(transcriptName, transcriptContent, {
    id: `chat-delegation-transcript-${generateUuid()}`,
    icon: Codicon.history,
    language: "markdown",
    pastedLines: transcriptName,
    fileName: transcriptName
  });
}
class CreateRemoteAgentJobAction {
  constructor() {
  }
  openUntitledEditor(commandService, continuationTarget) {
    commandService.executeCommand(`${NEW_CHAT_SESSION_ACTION_ID}.${continuationTarget.type}`);
  }
  /**
   * Extracts the GitHub "owner/repo" NWO from the source session by checking
   * multiple data sources: chat model repoData, session metadata, and session options.
   */
  async extractRepoNwoFromSession(agentSessionsService, chatSessionsService, fileService, sessionResource, chatModel) {
    const repoData = chatModel.repoData;
    if (repoData?.remoteUrl) {
      const nwo = extractNwoFromRemoteUrl(repoData.remoteUrl);
      if (nwo) {
        return nwo;
      }
    }
    const agentSession = agentSessionsService.getSession(sessionResource);
    if (agentSession?.metadata) {
      const metadata = agentSession.metadata;
      const owner = metadata.owner;
      const name = metadata.name;
      if (owner && name) {
        return `${owner}/${name}`;
      }
      const repositoryNwo = metadata.repositoryNwo;
      if (repositoryNwo?.includes("/")) {
        return repositoryNwo;
      }
      const repositoryUrl = metadata.repositoryUrl;
      if (repositoryUrl) {
        const nwo = extractNwoFromRemoteUrl(repositoryUrl);
        if (nwo) {
          return nwo;
        }
      }
      const workingDir = metadata.workingDirectoryPath ?? metadata.repositoryPath ?? metadata.worktreePath;
      if (workingDir) {
        const nwo = await resolveGitRemoteNwo(workingDir, fileService);
        if (nwo) {
          return nwo;
        }
      }
    }
    for (const optionId of ["repositories", "repository"]) {
      const repoOption = chatSessionsService.getSessionOption(sessionResource, optionId);
      if (repoOption) {
        const optionValue = typeof repoOption === "string" ? repoOption : repoOption.id;
        if (optionValue) {
          const segments = optionValue.split("/").filter(Boolean);
          if (segments.length === 2) {
            return optionValue;
          }
          const nwo = extractNwoFromRemoteUrl(optionValue);
          if (nwo) {
            return nwo;
          }
          try {
            const uri = URI.parse(optionValue);
            if (uri.authority === "github") {
              const parts = uri.path.split("/").filter(Boolean);
              if (parts.length >= 2) {
                return `${parts[0]}/${parts[1]}`;
              }
            }
          } catch {
          }
          if (isAbsolute(optionValue)) {
            const nwoFromGit = await resolveGitRemoteNwo(optionValue, fileService);
            if (nwoFromGit) {
              return nwoFromGit;
            }
          }
        }
      }
    }
    return void 0;
  }
  async run(accessor, continuationTarget, _widget) {
    const contextKeyService = accessor.get(IContextKeyService);
    const commandService = accessor.get(ICommandService);
    const widgetService = accessor.get(IChatWidgetService);
    const chatAgentService = accessor.get(IChatAgentService);
    const chatService = accessor.get(IChatService);
    const editorService = accessor.get(IEditorService);
    const agentSessionsService = accessor.get(IAgentSessionsService);
    const chatSessionsService = accessor.get(IChatSessionsService);
    const fileService = accessor.get(IFileService);
    const instantiationService = accessor.get(IInstantiationService);
    const remoteJobCreatingKey = ChatContextKeys.remoteJobCreating.bindTo(contextKeyService);
    try {
      remoteJobCreatingKey.set(true);
      const widget = _widget ?? widgetService.lastFocusedWidget;
      if (!widget || !widget.viewModel) {
        return this.openUntitledEditor(commandService, continuationTarget);
      }
      const chatModel = widget.viewModel.model;
      if (!chatModel) {
        return;
      }
      const sessionResource = widget.viewModel.sessionResource;
      const chatRequests = chatModel.getRequests();
      let userPrompt = widget.getInput();
      if (!userPrompt) {
        if (!chatRequests.length) {
          return this.openUntitledEditor(commandService, continuationTarget);
        }
        userPrompt = "implement this.";
      }
      const attachedContext = widget.input.getAttachedAndImplicitContext();
      widget.input.acceptInput(true);
      if (widget.location === ChatAgentLocation.EditorInline) {
        const activeEditor = editorService.activeTextEditorControl;
        if (activeEditor) {
          const model = activeEditor.getModel();
          let activeEditorUri = void 0;
          if (model && isITextModel(model)) {
            activeEditorUri = model.uri;
          }
          const selection = activeEditor.getSelection();
          if (activeEditorUri && selection) {
            attachedContext.add({
              kind: "file",
              id: "vscode.implicit.selection",
              name: basename(activeEditorUri),
              value: {
                uri: activeEditorUri,
                range: selection
              }
            });
          }
        }
      }
      const continuationTargetType = continuationTarget.type;
      const isSessionsWindow = IsSessionsWindowContext.getValue(contextKeyService);
      const sourceSessionType = getAgentSessionProvider(sessionResource) ?? getChatSessionType(sessionResource);
      const handoffToNewSession = isSessionsWindow || isAgentHostTarget(continuationTargetType) || !!sourceSessionType && isAgentHostTarget(sourceSessionType);
      if (handoffToNewSession && sourceSessionType && sourceSessionType !== continuationTargetType) {
        const isSidebar = isIChatViewViewContext(widget.viewContext);
        const transcript = buildDelegationTranscript(chatRequests);
        const sourceContribution = chatSessionsService.getAllChatSessionContributions().find((c) => c.type === sourceSessionType || getAgentSessionProvider(c.type) === sourceSessionType);
        const sourceName = sourceContribution?.displayName ?? getAgentSessionProviderName(sourceSessionType);
        const continuationContext = attachedContext.asArray();
        let handoffPrompt = userPrompt;
        const importConversationTurns = continuationTargetType === SessionType.AgentHostCopilot && !isSessionsWindow ? importedTurnsFromChatModel(chatModel) : void 0;
        const importConversationModelId = importConversationTurns ? widget.input.selectedLanguageModel.get()?.metadata.id : void 0;
        const importConversationModel = importConversationModelId ? { id: importConversationModelId } : void 0;
        if (transcript && !importConversationTurns) {
          if (isAgentHostTarget(continuationTargetType)) {
            const transcriptAttachment = createDelegationTranscriptAttachment(transcript, sourceName);
            if (transcriptAttachment) {
              continuationContext.unshift(transcriptAttachment);
            }
          } else {
            handoffPrompt = localize("chat.delegation.inlinePrompt", "The following is the conversation history from a previous {0} session. Continue working on it.\n\n{1}\n\nUser: {2}", sourceName, transcript, userPrompt);
          }
        }
        const initialSessionOptions = /* @__PURE__ */ new Map();
        const repoNwo = await this.extractRepoNwoFromSession(agentSessionsService, chatSessionsService, fileService, sessionResource, chatModel);
        if (repoNwo) {
          initialSessionOptions.set("repositories", repoNwo);
        }
        if (isAgentHostTarget(continuationTargetType)) {
          if (isSessionsWindow) {
            const delegationRequest = {
              type: continuationTargetType,
              displayName: continuationTarget.displayName,
              prompt: handoffPrompt,
              attachedContext: continuationContext
            };
            await commandService.executeCommand(CHAT_DELEGATE_TO_AGENT_HOST_SESSION_COMMAND_ID, delegationRequest);
          } else {
            await instantiationService.invokeFunction((innerAccessor) => openChatSession(
              innerAccessor,
              {
                type: continuationTargetType,
                displayName: continuationTarget.displayName,
                position: isSidebar ? ChatSessionPosition.Sidebar : ChatSessionPosition.Editor,
                // Replace the source chat editor in place so switching harness
                // feels like the same chat continues rather than opening a new
                // tab. The source (local) session stays in chat history and is
                // recoverable. The sidebar path already swaps in place via
                // `loadSession`, so it needs no replacement. Pass the source
                // resource (not a bare flag) so the correct editor is resolved
                // at replace time even if the active editor changed meanwhile.
                replaceEditorForResource: isSidebar ? void 0 : sessionResource
              },
              {
                prompt: handoffPrompt,
                attachedContext: continuationContext,
                initialSessionOptions: initialSessionOptions.size > 0 ? initialSessionOptions : void 0,
                importConversation: importConversationTurns ? { turns: importConversationTurns, model: importConversationModel } : void 0
              }
            ));
          }
          return;
        }
        const actionId = isSidebar ? `workbench.action.chat.openNewSessionSidebar.${continuationTargetType}` : `${NEW_CHAT_SESSION_ACTION_ID}.${continuationTargetType}`;
        await commandService.executeCommand(actionId, {
          prompt: handoffPrompt,
          attachedContext: continuationContext,
          initialSessionOptions: initialSessionOptions.size > 0 ? initialSessionOptions : void 0
        });
        return;
      }
      const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
      const requestParser = instantiationService.createInstance(ChatRequestParser);
      const context = { sessionType: getChatSessionType(sessionResource) };
      const parsedRequest = requestParser.parseChatRequestWithReferences(getDynamicVariablesForWidget(widget), getSelectedToolAndToolSetsForWidget(widget), userPrompt, ChatAgentLocation.Chat, context);
      const addedRequest = chatModel.addRequest(
        parsedRequest,
        { variables: attachedContext.asArray() },
        0,
        void 0,
        defaultAgent
      );
      await chatService.removeRequest(sessionResource, addedRequest.id);
      const sendResult = await chatService.sendRequest(sessionResource, userPrompt, {
        agentIdSilent: continuationTargetType,
        attachedContext: attachedContext.asArray(),
        ...widget.getSelectedModelRequestOptions(),
        ...widget.getModeRequestOptions()
      });
      if (ChatSendResult.isSent(sendResult)) {
        await widget.handleDelegationExitIfNeeded(defaultAgent, sendResult.data.agent);
      }
    } catch (e) {
      console.error("[Delegation] Error creating remote coding agent job", e);
      throw e;
    } finally {
      remoteJobCreatingKey.set(false);
    }
  }
}
class CreateRemoteAgentJobFromEditorAction {
  constructor() {
  }
  async run(accessor, continuationTarget) {
    try {
      const editorService = accessor.get(IEditorService);
      const activeEditor = editorService.activeTextEditorControl;
      const commandService = accessor.get(ICommandService);
      if (!activeEditor) {
        return;
      }
      const model = activeEditor.getModel();
      if (!model || !isITextModel(model)) {
        return;
      }
      const uri = model.uri;
      const attachedContext = [toPromptFileVariableEntry(uri, PromptFileVariableKind.PromptFile, void 0, false, [])];
      const prompt = `Follow instructions in [${basename(uri)}](${uri.toString()}).`;
      await commandService.executeCommand(`${NEW_CHAT_SESSION_ACTION_ID}.${continuationTarget.type}`, { prompt, attachedContext });
    } catch (e) {
      console.error("Error creating remote agent job from editor", e);
      throw e;
    }
  }
}
let ContinueChatInSessionActionRendering = class extends Disposable {
  static {
    this.ID = "chat.continueChatInSessionActionRendering";
  }
  constructor(actionViewItemService, instantiationService) {
    super();
    const disposable = actionViewItemService.register(MenuId.EditorContent, ContinueChatInSessionAction.ID, (action, options, instantiationService2) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(ChatContinueInSessionActionItem, action, "editor" /* Editor */);
    });
    markAsSingleton(disposable);
  }
};
ContinueChatInSessionActionRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService)
], ContinueChatInSessionActionRendering);
export {
  ActionLocation,
  ChatContinueInSessionActionItem,
  ContinueChatInSessionAction,
  ContinueChatInSessionActionRendering,
  CreateRemoteAgentJobAction,
  buildDelegationTranscript,
  createDelegationTranscriptAttachment
};
