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
import { coalesce } from "../../../../../../../base/common/arrays.js";
import { decodeBase64 } from "../../../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { StopWatch } from "../../../../../../../base/common/stopwatch.js";
import { isPatternInWord } from "../../../../../../../base/common/filters.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../../../base/common/map.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { basename } from "../../../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { assertType } from "../../../../../../../base/common/types.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../../base/common/uuid.js";
import { getCodeEditor, isCodeEditor } from "../../../../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../../../../editor/common/config/editorOptions.js";
import { CompletionItemKind, SymbolKinds } from "../../../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../../../editor/common/services/languageFeatures.js";
import { IOutlineModelService } from "../../../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { localize } from "../../../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { FileKind, IFileService } from "../../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../../../../platform/registry/common/platform.js";
import { IWorkspaceContextService } from "../../../../../../../platform/workspace/common/workspace.js";
import { Extensions as WorkbenchExtensions } from "../../../../../../common/contributions.js";
import { EditorsOrder, isDiffEditorInput } from "../../../../../../common/editor.js";
import { IEditorService } from "../../../../../../services/editor/common/editorService.js";
import { IHistoryService } from "../../../../../../services/history/common/history.js";
import { LifecyclePhase } from "../../../../../../services/lifecycle/common/lifecycle.js";
import { ISearchService } from "../../../../../../services/search/common/search.js";
import { McpPromptArgumentPick } from "../../../../../mcp/browser/mcpPromptArgumentPick.js";
import { IMcpService, McpResourceURI } from "../../../../../mcp/common/mcpTypes.js";
import { searchFilesAndFolders } from "../../../../../search/browser/searchChatContext.js";
import { IChatAgentNameService, IChatAgentService, getFullyQualifiedId } from "../../../../common/participants/chatAgents.js";
import { getAttachableImageExtension } from "../../../../common/model/chatModel.js";
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, ChatRequestToolSetPart, chatAgentLeader, chatSubcommandLeader, chatVariableLeader } from "../../../../common/requestParser/chatParserTypes.js";
import { IChatSlashCommandService } from "../../../../common/participants/chatSlashCommands.js";
import { toAttachedContextDynamicVariable } from "../../../../common/attachments/chatVariables.js";
import { ChatAgentLocation, ChatModeKind, isSupportedChatFileScheme } from "../../../../common/constants.js";
import { isToolSet } from "../../../../common/tools/languageModelToolsService.js";
import { IChatSessionsService, isAgentHostTarget } from "../../../../common/chatSessionsService.js";
import { ICustomizationHarnessService } from "../../../../common/customizationHarnessService.js";
import { matchesSessionType } from "../../../../common/promptSyntax/service/promptsService.js";
import { ChatSubmitAction } from "../../../actions/chatExecuteActions.js";
import { IChatWidgetService } from "../../../chat.js";
import { resizeImage } from "../../../chatImageUtils.js";
import { ChatDynamicVariableModel } from "../../../attachments/chatDynamicVariables.js";
import { IChatService } from "../../../../common/chatService/chatService.js";
import { getChatSessionType } from "../../../../common/model/chatUri.js";
import { attachedContextCompletionAdditionalTriggerCharacters, computeCompletionRanges, escapeForCharClass, getAttachedContextCompletionMatch, getAttachedContextCompletionSortText, getCompletionRangeWord, isEmptyUpToCompletionWord } from "./chatInputCompletionUtils.js";
import { getAgentSessionProviderIcon, AgentSessionProviders } from "../../../agentSessions/agentSessions.js";
const SlashCommandWord = /\/[\p{L}0-9_.:-]*/gu;
const AgentOrSlashCommandWord = /(@|\/)[\p{L}0-9_.:-]*/gu;
function isAgentHostBackedWidget(widget) {
  const sessionResource = widget.viewModel?.model.sessionResource;
  return !!sessionResource && isAgentHostTarget(getChatSessionType(sessionResource));
}
let SlashCommandCompletions = class extends Disposable {
  constructor(languageFeaturesService, chatWidgetService, chatSlashCommandService, harnessService, chatService, chatSessionsService, mcpService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this.chatSlashCommandService = chatSlashCommandService;
    this.harnessService = harnessService;
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "globalSlashCommands",
      triggerCharacters: [chatSubcommandLeader],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return null;
        }
        const range = computeCompletionRanges(model, position, SlashCommandWord);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const parsedRequest = widget.parsedInput.parts;
        const usedAgent = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
        if (usedAgent) {
          return;
        }
        const slashCommands = this.chatSlashCommandService.getCommands(widget.location, widget.input.currentModeKind);
        if (!slashCommands) {
          return null;
        }
        const sessionType = getChatSessionType(widget.viewModel.model.sessionResource);
        return {
          suggestions: slashCommands.filter((c) => {
            if (!c.silent && !widget.attachmentCapabilities.supportsPromptAttachments) {
              return false;
            }
            if (c.when && !widget.scopedContextKeyService.contextMatchesRules(c.when)) {
              return false;
            }
            if (!matchesSessionType(c.sessionTypes, sessionType)) {
              return false;
            }
            if (!widget.lockedAgentId) {
              return true;
            }
            if (c.modes && c.modes.length && !c.modes.includes(ChatModeKind.Agent)) {
              return false;
            }
            return true;
          }).map((c, i) => {
            const withSlash = `/${c.command}`;
            return {
              label: { label: withSlash, description: c.detail },
              insertText: c.executeImmediately ? "" : `${withSlash} `,
              documentation: c.detail,
              range,
              sortText: c.sortText ?? "a".repeat(i + 1),
              kind: CompletionItemKind.Text,
              // The icons are disabled here anyway,
              command: c.executeImmediately ? { id: ChatSubmitAction.ID, title: withSlash, arguments: [{ widget, inputValue: `${withSlash} ` }] } : void 0
            };
          })
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "globalSlashCommandsAt",
      triggerCharacters: [chatAgentLeader],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return null;
        }
        const range = computeCompletionRanges(model, position, /@\w*/g);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const slashCommands = this.chatSlashCommandService.getCommands(widget.location, widget.input.currentModeKind);
        if (!slashCommands) {
          return null;
        }
        if (widget.lockedAgentId) {
          return null;
        }
        const currentSessionType = getChatSessionType(widget.viewModel.model.sessionResource);
        return {
          suggestions: slashCommands.filter((c) => !c.when || widget.scopedContextKeyService.contextMatchesRules(c.when)).filter((c) => matchesSessionType(c.sessionTypes, currentSessionType)).map((c, i) => {
            const withSlash = `${chatSubcommandLeader}${c.command}`;
            return {
              label: { label: withSlash, description: c.detail },
              insertText: c.executeImmediately ? "" : `${withSlash} `,
              documentation: c.detail,
              range,
              filterText: `${chatAgentLeader}${c.command}`,
              sortText: c.sortText ?? "z".repeat(i + 1),
              kind: CompletionItemKind.Text,
              // The icons are disabled here anyway,
              command: c.executeImmediately ? { id: ChatSubmitAction.ID, title: withSlash, arguments: [{ widget, inputValue: `${withSlash} ` }] } : void 0
            };
          })
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "promptSlashCommands",
      triggerCharacters: [chatSubcommandLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return null;
        }
        if (isAgentHostBackedWidget(widget)) {
          return;
        }
        const range = computeCompletionRanges(model, position, SlashCommandWord);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const parsedRequest = widget.parsedInput.parts;
        const usedAgent = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
        if (usedAgent) {
          return;
        }
        const currentSessionType = getChatSessionType(widget.viewModel.model.sessionResource);
        const promptCommands = await this.harnessService.getSlashCommands(widget.viewModel.model.sessionResource, token);
        if (promptCommands.length === 0) {
          return null;
        }
        if (widget.lockedAgentId && !widget.attachmentCapabilities.supportsPromptAttachments) {
          return null;
        }
        const userInvocableCommands = promptCommands.filter((c) => c.userInvocable).filter((c) => matchesSessionType(c.sessionTypes, currentSessionType));
        if (userInvocableCommands.length === 0) {
          return null;
        }
        return {
          suggestions: userInvocableCommands.map((c, i) => {
            const colonLabel = `/${c.name}`;
            const hasSubcommand = c.name.includes(":");
            const displayLabel = hasSubcommand ? `/${c.name.replace(/:/g, " ")}` : colonLabel;
            const description = c.description;
            return {
              label: { label: displayLabel, description },
              insertText: `${displayLabel} `,
              documentation: c.description,
              range,
              // Allow matching by either the space form (what the user sees) or the
              // colon form (so legacy `/chronicle:tips` typing still filters).
              filterText: hasSubcommand ? `${colonLabel} ${displayLabel}` : void 0,
              sortText: "a".repeat(i + 1),
              kind: CompletionItemKind.Text
              // The icons are disabled here anyway,
            };
          })
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "mcpPromptSlashCommands",
      triggerCharacters: [chatSubcommandLeader],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return null;
        }
        if (isAgentHostBackedWidget(widget)) {
          return;
        }
        const range = computeCompletionRanges(model, position, /\/[\p{L}0-9_.-]*/gu);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        if (widget.lockedAgentId) {
          return null;
        }
        return {
          suggestions: mcpService.servers.get().flatMap((server) => server.prompts.get().map((prompt) => {
            const label = `/mcp.${prompt.id}`;
            return {
              label: { label, description: prompt.description },
              command: {
                id: StartParameterizedPromptAction.ID,
                title: prompt.name,
                arguments: [model, server, prompt, `${label} `]
              },
              insertText: `${label} `,
              range,
              kind: CompletionItemKind.Text
            };
          }))
        };
      }
    }));
  }
};
SlashCommandCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatSlashCommandService),
  __decorateParam(3, ICustomizationHarnessService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IChatSessionsService),
  __decorateParam(6, IMcpService)
], SlashCommandCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SlashCommandCompletions, LifecyclePhase.Eventually);
let AgentCompletions = class extends Disposable {
  constructor(languageFeaturesService, chatWidgetService, chatAgentService, chatAgentNameService, chatSessionsService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this.chatAgentService = chatAgentService;
    this.chatAgentNameService = chatAgentNameService;
    this.chatSessionsService = chatSessionsService;
    const subCommandProvider = {
      _debugDisplayName: "chatAgentSubcommand",
      triggerCharacters: [chatSubcommandLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return;
        }
        if (isAgentHostBackedWidget(widget)) {
          return;
        }
        const range = computeCompletionRanges(model, position, SlashCommandWord);
        if (!range) {
          return;
        }
        const usedAgent = this.getCurrentAgentForWidget(widget);
        if (!usedAgent || usedAgent.command) {
          return;
        }
        return {
          suggestions: usedAgent.agent.slashCommands.map((c, i) => {
            const withSlash = `/${c.name}`;
            return {
              label: withSlash,
              insertText: `${withSlash} `,
              documentation: c.description,
              range,
              kind: CompletionItemKind.Text
              // The icons are disabled here anyway
            };
          })
        };
      }
    };
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, subCommandProvider));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatAgentAndSubcommand",
      triggerCharacters: [chatAgentLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        const viewModel = widget?.viewModel;
        if (!widget || !viewModel) {
          return;
        }
        if (isAgentHostBackedWidget(widget)) {
          return;
        }
        if (widget.lockedAgentId) {
          return null;
        }
        const range = computeCompletionRanges(model, position, AgentOrSlashCommandWord);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const agents = this.chatAgentService.getAgents().filter((a) => a.locations.includes(widget.location));
        const chatSessionContributions = this.chatSessionsService.getAllChatSessionContributions();
        const chatSessionAgentIds = new Set(chatSessionContributions.map((contribution) => contribution.type));
        const agentsForSlashCommands = agents.filter((a) => !chatSessionAgentIds.has(a.id));
        const getFilterText = (agent, command) => {
          const dummyPrefix = agent.id === "github.copilot.terminalPanel" ? `0000` : ``;
          return `${chatAgentLeader}${dummyPrefix}${agent.name}.${command}`;
        };
        const justAgents = agents.filter((a) => !a.isDefault).filter((a) => !chatSessionAgentIds.has(a.id)).map((agent) => {
          const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
          const detail = agent.description;
          return {
            label: isDupe ? { label: agentLabel, description: agent.description, detail: ` (${agent.publisherDisplayName})` } : agentLabel,
            documentation: detail,
            filterText: `${chatAgentLeader}${agent.name}`,
            insertText: `${agentLabel} `,
            range,
            kind: CompletionItemKind.Text,
            sortText: `${chatAgentLeader}${agent.name}`,
            command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] }
          };
        });
        return {
          suggestions: justAgents.concat(
            coalesce(agentsForSlashCommands.flatMap((agent) => agent.slashCommands.map((c, i) => {
              if (agent.isDefault && this.chatAgentService.getDefaultAgent(widget.location, widget.input.currentModeKind)?.id !== agent.id) {
                return;
              }
              const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
              const label = `${agentLabel} ${chatSubcommandLeader}${c.name}`;
              const item = {
                label: isDupe ? { label, description: c.description, detail: isDupe ? ` (${agent.publisherDisplayName})` : void 0 } : label,
                documentation: c.description,
                filterText: getFilterText(agent, c.name),
                commitCharacters: [" "],
                insertText: label + " ",
                range,
                kind: CompletionItemKind.Text,
                // The icons are disabled here anyway
                sortText: `x${chatAgentLeader}${agent.name}${c.name}`,
                command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] }
              };
              if (agent.isDefault) {
                const label2 = `${chatSubcommandLeader}${c.name}`;
                item.label = label2;
                item.insertText = `${label2} `;
                item.documentation = c.description;
              }
              return item;
            })))
          )
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatAgentAndSubcommand",
      triggerCharacters: [chatSubcommandLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        const viewModel = widget?.viewModel;
        if (!widget || !viewModel) {
          return;
        }
        if (isAgentHostBackedWidget(widget)) {
          return;
        }
        if (widget.lockedAgentId) {
          return null;
        }
        const range = computeCompletionRanges(model, position, AgentOrSlashCommandWord);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const agents = this.chatAgentService.getAgents().filter((a) => a.locations.includes(widget.location) && a.modes.includes(widget.input.currentModeKind)).filter((a) => !this.chatSessionsService.getChatSessionContribution(a.id));
        return {
          suggestions: coalesce(agents.flatMap((agent) => agent.slashCommands.map((c, i) => {
            if (agent.isDefault && this.chatAgentService.getDefaultAgent(widget.location, widget.input.currentModeKind)?.id !== agent.id) {
              return;
            }
            const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
            const withSlash = `${chatSubcommandLeader}${c.name}`;
            const extraSortText = agent.id === "github.copilot.terminalPanel" ? `z` : ``;
            const sortText = `${chatSubcommandLeader}${extraSortText}${agent.name}${c.name}`;
            const item = {
              label: { label: withSlash, description: agentLabel, detail: isDupe ? ` (${agent.publisherDisplayName})` : void 0 },
              commitCharacters: [" "],
              insertText: `${agentLabel} ${withSlash} `,
              documentation: `(${agentLabel}) ${c.description ?? ""}`,
              range,
              kind: CompletionItemKind.Text,
              // The icons are disabled here anyway
              sortText,
              command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] }
            };
            if (agent.isDefault) {
              const label = `${chatSubcommandLeader}${c.name}`;
              item.label = label;
              item.insertText = `${label} `;
              item.documentation = c.description;
            }
            return item;
          })))
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "installChatExtensions",
      triggerCharacters: [chatAgentLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        if (!model.getLineContent(1).startsWith(chatAgentLeader)) {
          return;
        }
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (widget?.location !== ChatAgentLocation.Chat || widget.input.currentModeKind !== ChatModeKind.Ask) {
          return;
        }
        if (isAgentHostBackedWidget(widget)) {
          return;
        }
        if (widget.lockedAgentId) {
          return null;
        }
        const range = computeCompletionRanges(model, position, AgentOrSlashCommandWord);
        if (!range) {
          return;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const label = localize("installLabel", "Install Chat Extensions...");
        const item = {
          label,
          insertText: "",
          range,
          kind: CompletionItemKind.Text,
          // The icons are disabled here anyway
          command: { id: "workbench.extensions.search", title: "", arguments: ["@tag:chat-participant"] },
          filterText: chatAgentLeader + label,
          sortText: "zzz"
        };
        return {
          suggestions: [item]
        };
      }
    }));
  }
  getCurrentAgentForWidget(widget) {
    if (widget.lockedAgentId) {
      const usedAgent2 = this.chatAgentService.getAgent(widget.lockedAgentId);
      return usedAgent2 && { agent: usedAgent2 };
    }
    const parsedRequest = widget.parsedInput.parts;
    const usedAgentIdx = parsedRequest.findIndex((p) => p instanceof ChatRequestAgentPart);
    if (usedAgentIdx < 0) {
      return;
    }
    const usedAgent = parsedRequest[usedAgentIdx];
    const usedOtherCommand = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart || p instanceof ChatRequestSlashPromptPart);
    if (usedOtherCommand) {
      return {
        agent: usedAgent.agent,
        command: usedOtherCommand instanceof ChatRequestAgentSubcommandPart ? usedOtherCommand.command.name : void 0
      };
    }
    for (const partAfterAgent of parsedRequest.slice(usedAgentIdx + 1)) {
      if (!(partAfterAgent instanceof ChatRequestTextPart) || !partAfterAgent.text.trim().match(/^(\/[\p{L}0-9_.:-]*)?$/u)) {
        return;
      }
    }
    return { agent: usedAgent.agent };
  }
  getAgentCompletionDetails(agent) {
    const isAllowed = this.chatAgentNameService.getAgentNameRestriction(agent);
    const agentLabel = `${chatAgentLeader}${isAllowed ? agent.name : getFullyQualifiedId(agent)}`;
    const isDupe = isAllowed && this.chatAgentService.agentHasDupeName(agent.id);
    return { label: agentLabel, isDupe };
  }
};
AgentCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatAgentService),
  __decorateParam(3, IChatAgentNameService),
  __decorateParam(4, IChatSessionsService)
], AgentCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(AgentCompletions, LifecyclePhase.Eventually);
class AssignSelectedAgentAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.assignSelectedAgent";
  }
  constructor() {
    super({
      id: AssignSelectedAgentAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const arg = args[0];
    if (!arg || !arg.widget || !arg.agent) {
      return;
    }
    if (!arg.agent.modes.includes(arg.widget.input.currentModeKind)) {
      arg.widget.input.setChatMode(arg.agent.modes[0]);
    }
    arg.widget.lastSelectedAgent = arg.agent;
  }
}
registerAction2(AssignSelectedAgentAction);
class StartParameterizedPromptAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.startParameterizedPrompt";
  }
  constructor() {
    super({
      id: StartParameterizedPromptAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, model, server, prompt, textToReplace) {
    if (!model || !prompt) {
      return;
    }
    const instantiationService = accessor.get(IInstantiationService);
    const notificationService = accessor.get(INotificationService);
    const widgetService = accessor.get(IChatWidgetService);
    const fileService = accessor.get(IFileService);
    const chatWidget = await widgetService.revealWidget(true);
    if (!chatWidget) {
      return;
    }
    const lastPosition = model.getFullModelRange().collapseToEnd();
    const getPromptIndex = () => model.findMatches(textToReplace, true, false, true, null, false)[0];
    const replaceTextWith = (value) => model.applyEdits([{
      range: getPromptIndex()?.range || lastPosition,
      text: value
    }]);
    const store = new DisposableStore();
    const cts = store.add(new CancellationTokenSource());
    store.add(chatWidget.input.startGenerating());
    store.add(model.onDidChangeContent(() => {
      if (getPromptIndex()) {
        cts.cancel();
      }
    }));
    model.changeDecorations((accessor2) => {
      const id = accessor2.addDecoration(lastPosition, {
        description: "mcp-prompt-spinner",
        showIfCollapsed: true,
        after: {
          content: " ",
          inlineClassNameAffectsLetterSpacing: true,
          inlineClassName: ThemeIcon.asClassName(ThemeIcon.modify(Codicon.loading, "spin")) + " chat-prompt-spinner"
        }
      });
      store.add(toDisposable(() => {
        model.changeDecorations((a) => a.removeDecoration(id));
      }));
    });
    const pick = store.add(instantiationService.createInstance(McpPromptArgumentPick, prompt));
    try {
      await server.start();
      const args = await pick.createArgs();
      if (!args) {
        replaceTextWith("");
        return;
      }
      let messages;
      try {
        messages = await prompt.resolve(args, cts.token);
      } catch (e) {
        if (!cts.token.isCancellationRequested) {
          notificationService.error(localize("mcp.prompt.error", "Error resolving prompt: {0}", String(e)));
        }
        replaceTextWith("");
        return;
      }
      const toAttach = [];
      const attachBlob = async (mimeType, contents, uriStr, isText = false) => {
        let validURI;
        if (uriStr) {
          for (const uri of [URI.parse(uriStr), McpResourceURI.fromServer(server.definition, uriStr)]) {
            try {
              validURI ||= await fileService.exists(uri) ? uri : void 0;
            } catch {
            }
          }
        }
        if (isText) {
          if (validURI) {
            toAttach.push({
              id: generateUuid(),
              kind: "file",
              value: validURI,
              name: basename(validURI)
            });
          } else {
            toAttach.push({
              id: generateUuid(),
              kind: "generic",
              value: contents,
              name: localize("mcp.prompt.resource", "Prompt Resource")
            });
          }
        } else if (mimeType && getAttachableImageExtension(mimeType)) {
          const resized = await resizeImage(contents).catch(() => decodeBase64(contents).buffer);
          chatWidget.attachmentModel.addContext({
            id: generateUuid(),
            name: localize("mcp.prompt.image", "Prompt Image"),
            fullName: localize("mcp.prompt.image", "Prompt Image"),
            value: resized,
            kind: "image",
            references: validURI && [{ reference: validURI, kind: "reference" }]
          });
        } else if (validURI) {
          toAttach.push({
            id: generateUuid(),
            kind: "file",
            value: validURI,
            name: basename(validURI)
          });
        } else {
        }
      };
      const hasMultipleRoles = messages.some((m) => m.role !== messages[0].role);
      let input = "";
      for (const message of messages) {
        switch (message.content.type) {
          case "text":
            if (input) {
              input += "\n\n";
            }
            if (hasMultipleRoles) {
              input += `--${message.role.toUpperCase()}
`;
            }
            input += message.content.text;
            break;
          case "resource":
            if ("text" in message.content.resource) {
              await attachBlob(message.content.resource.mimeType, message.content.resource.text, message.content.resource.uri, true);
            } else {
              await attachBlob(message.content.resource.mimeType, message.content.resource.blob, message.content.resource.uri);
            }
            break;
          case "image":
          case "audio":
            await attachBlob(message.content.mimeType, message.content.data);
            break;
        }
      }
      if (toAttach.length) {
        chatWidget.attachmentModel.addContext(...toAttach);
      }
      replaceTextWith(input);
    } finally {
      store.dispose();
    }
  }
}
registerAction2(StartParameterizedPromptAction);
class ReferenceArgument {
  constructor(widget, variable) {
    this.widget = widget;
    this.variable = variable;
  }
}
let BuiltinDynamicCompletions = class extends Disposable {
  // MUST be using `g`-flag
  constructor(historyService, workspaceContextService, searchService, labelService, languageFeaturesService, chatWidgetService, outlineService, editorService, configurationService, codeEditorService, chatAgentService, instantiationService, chatSessionsService) {
    super();
    this.historyService = historyService;
    this.workspaceContextService = workspaceContextService;
    this.searchService = searchService;
    this.labelService = labelService;
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this.outlineService = outlineService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.codeEditorService = codeEditorService;
    this.chatAgentService = chatAgentService;
    this.instantiationService = instantiationService;
    this.chatSessionsService = chatSessionsService;
    this.registerVariableCompletions("attachedContexts", ({ widget, range }) => {
      if (!widget.supportsFileReferences) {
        return;
      }
      const typedLeader = range.varWord?.word?.charAt(0) === chatAgentLeader ? chatAgentLeader : chatVariableLeader;
      const typedWord = getCompletionRangeWord(range) ?? typedLeader;
      const suggestOptions = widget.inputEditor.getOption(EditorOption.suggest);
      const suggestions = coalesce(widget.attachmentModel.attachments.filter((attachment) => !attachment.range).map((attachment) => {
        const match = getAttachedContextCompletionMatch(typedWord, typedLeader, attachment.name, attachment.kind, suggestOptions);
        if (!match) {
          return void 0;
        }
        const text = `${typedLeader}attachment:${attachment.name}`;
        const referenceRange = {
          startLineNumber: range.replace.startLineNumber,
          startColumn: range.replace.startColumn,
          endLineNumber: range.replace.endLineNumber,
          endColumn: range.replace.startColumn + text.length
        };
        return {
          label: { label: attachment.name, description: localize("attachedContext", "Attached context") },
          filterText: match.filterText,
          insertText: range.varWord?.endColumn === range.replace.endColumn ? `${text} ` : text,
          range,
          kind: attachment.kind === "directory" ? CompletionItemKind.Folder : attachment.kind === "file" || attachment.kind === "image" ? CompletionItemKind.File : CompletionItemKind.Reference,
          sortText: getAttachedContextCompletionSortText(match.score),
          command: {
            id: BuiltinDynamicCompletions.addReferenceCommand,
            title: "",
            arguments: [new ReferenceArgument(widget, toAttachedContextDynamicVariable(attachment, referenceRange))]
          }
        };
      }));
      return { suggestions, incomplete: true };
    }, BuiltinDynamicCompletions.VariableNameDef, true, attachedContextCompletionAdditionalTriggerCharacters);
    const fileWordPattern = new RegExp(`[${escapeForCharClass(chatVariableLeader)}${escapeForCharClass(chatAgentLeader)}][^\\s]*`, "g");
    this.registerVariableCompletions("fileAndFolder", async ({ widget, range }, token) => {
      if (!widget.supportsFileReferences) {
        return;
      }
      const result = { suggestions: [] };
      if (widget.lockedAgentId) {
        const agent = this.chatAgentService.getAgent(widget.lockedAgentId);
        if (agent && !agent.capabilities?.supportsFileAttachments) {
          return result;
        }
      }
      await this.addFileAndFolderEntries(widget, result, range, token);
      return result;
    }, fileWordPattern);
    this.registerVariableCompletions("selection", ({ widget, range }, token) => {
      if (!widget.supportsFileReferences) {
        return;
      }
      if (widget.location === ChatAgentLocation.EditorInline) {
        return;
      }
      const active = this.findActiveCodeEditor();
      if (!isCodeEditor(active)) {
        return;
      }
      const currentResource = active.getModel()?.uri;
      const currentSelection = active.getSelection();
      if (!currentSelection || !currentResource || currentSelection.isEmpty()) {
        return;
      }
      const typedLeader = range.varWord?.word?.charAt(0) === chatAgentLeader ? chatAgentLeader : chatVariableLeader;
      const basename2 = this.labelService.getUriBasenameLabel(currentResource);
      const text = `${typedLeader}file:${basename2}:${currentSelection.startLineNumber}-${currentSelection.endLineNumber}`;
      const fullRangeText = `:${currentSelection.startLineNumber}:${currentSelection.startColumn}-${currentSelection.endLineNumber}:${currentSelection.endColumn}`;
      const description = this.labelService.getUriLabel(currentResource, { relative: true }) + fullRangeText;
      const result = { suggestions: [] };
      result.suggestions.push({
        label: { label: `${typedLeader}selection`, description },
        filterText: `${typedLeader}selection`,
        insertText: range.varWord?.endColumn === range.replace.endColumn ? `${text} ` : text,
        range,
        kind: CompletionItemKind.Text,
        sortText: "z",
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: "vscode.selection",
            isFile: true,
            range: { startLineNumber: range.replace.startLineNumber, startColumn: range.replace.startColumn, endLineNumber: range.replace.endLineNumber, endColumn: range.replace.startColumn + text.length },
            data: { range: currentSelection, uri: currentResource }
          })]
        }
      });
      return result;
    });
    this.registerVariableCompletions("symbol", ({ widget, range, position, model }, token) => {
      if (!widget.supportsFileReferences) {
        return null;
      }
      const result = { suggestions: [] };
      const range2 = computeCompletionRanges(model, position, new RegExp(`[${escapeForCharClass(chatVariableLeader)}${escapeForCharClass(chatAgentLeader)}][^\\s]*`, "g"), true);
      if (range2) {
        this.addSymbolEntries(widget, result, range2, token);
      }
      return result;
    });
    const sessionWordPattern = new RegExp(`${chatVariableLeader}[^\\s]*`, "g");
    this.registerVariableCompletions("sessionReference", async ({ widget, range }, token) => {
      if (widget.location !== ChatAgentLocation.Chat) {
        return;
      }
      const typedWord = range.varWord?.word ?? "";
      const sessionPrefix = `${chatVariableLeader}session`;
      const result = { suggestions: [] };
      if (typedWord.toLowerCase().startsWith(`${sessionPrefix}:`)) {
        const allSessions = [];
        const sessionProviderFilter = [AgentSessionProviders.Local, AgentSessionProviders.Background, AgentSessionProviders.AgentHostCopilot];
        for await (const group of this.chatSessionsService.getChatSessionItems(sessionProviderFilter, token)) {
          if (token.isCancellationRequested) {
            return;
          }
          const providerIcon = getAgentSessionProviderIcon(group.chatSessionType);
          for (const item of group.items) {
            allSessions.push({
              title: item.label,
              sessionResource: item.resource,
              lastMessageDate: item.timing.lastRequestEnded ?? item.timing.created,
              icon: item.iconPath ?? providerIcon
            });
          }
        }
        const currentSessionResource = widget.viewModel?.sessionResource;
        const filteredSessions = allSessions.filter((s) => !currentSessionResource || s.sessionResource.toString() !== currentSessionResource.toString()).sort((a, b) => b.lastMessageDate - a.lastMessageDate);
        for (const session of filteredSessions) {
          const text = `${sessionPrefix}:${session.title}`;
          const dateStr = new Date(session.lastMessageDate).toLocaleString();
          result.suggestions.push({
            label: { label: session.title, description: dateStr },
            filterText: `${sessionPrefix}:${session.title}`,
            insertText: range.varWord?.endColumn === range.replace.endColumn ? `${text} ` : text,
            range,
            kind: CompletionItemKind.Text,
            sortText: `z${String(Number.MAX_SAFE_INTEGER - session.lastMessageDate).padStart(20, "0")}`,
            command: {
              id: BuiltinDynamicCompletions.addReferenceCommand,
              title: "",
              arguments: [new ReferenceArgument(widget, {
                id: session.sessionResource.toString(),
                icon: session.icon,
                range: { startLineNumber: range.replace.startLineNumber, startColumn: range.replace.startColumn, endLineNumber: range.replace.endLineNumber, endColumn: range.replace.startColumn + text.length },
                data: session.sessionResource
              })]
            }
          });
        }
      } else {
        result.suggestions.push({
          label: { label: sessionPrefix, description: localize("session.description", "Attach a chat session") },
          filterText: sessionPrefix,
          insertText: `${sessionPrefix}:`,
          range,
          kind: CompletionItemKind.Text,
          sortText: "z",
          command: { id: "editor.action.triggerSuggest", title: "" }
        });
      }
      return result;
    }, sessionWordPattern);
    this._register(CommandsRegistry.registerCommand(BuiltinDynamicCompletions.addReferenceCommand, (_services, arg) => {
      assertType(arg instanceof ReferenceArgument);
      return this.cmdAddReference(arg);
    }));
  }
  static {
    this.addReferenceCommand = "_addReferenceCmd";
  }
  static {
    this.VariableNameDef = new RegExp(`[${escapeForCharClass(chatVariableLeader)}${escapeForCharClass(chatAgentLeader)}][\\w:-]*`, "g");
  }
  findActiveCodeEditor() {
    const codeEditor = this.codeEditorService.getActiveCodeEditor();
    if (codeEditor) {
      const model = codeEditor.getModel();
      if (model?.uri.scheme === Schemas.vscodeNotebookCell) {
        return void 0;
      }
      if (model) {
        return codeEditor;
      }
    }
    for (const codeOrDiffEditor of this.editorService.getVisibleTextEditorControls(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
      const codeEditor2 = getCodeEditor(codeOrDiffEditor);
      if (!codeEditor2) {
        continue;
      }
      const model = codeEditor2.getModel();
      if (model) {
        return codeEditor2;
      }
    }
    return void 0;
  }
  registerVariableCompletions(debugName, provider, wordPattern = BuiltinDynamicCompletions.VariableNameDef, includeAgentHost = false, additionalTriggerCharacters = []) {
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: `chatVarCompletions-${debugName}`,
      triggerCharacters: [chatVariableLeader, chatAgentLeader, ...additionalTriggerCharacters],
      provideCompletionItems: async (model, position, context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget) {
          return;
        }
        if (!includeAgentHost && isAgentHostBackedWidget(widget)) {
          return;
        }
        const range = computeCompletionRanges(model, position, wordPattern, true);
        if (range) {
          return provider({ model, position, widget, range, context }, token);
        }
        return;
      }
    }));
  }
  async addFileAndFolderEntries(widget, result, info, token) {
    const typedLeader = info.varWord?.word?.charAt(0) === chatAgentLeader ? chatAgentLeader : chatVariableLeader;
    const makeCompletionItem = (resource, kind, description, boostPriority) => {
      const basename2 = this.labelService.getUriBasenameLabel(resource);
      const text = `${typedLeader}file:${basename2}`;
      const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
      const labelDescription = description ? localize("fileEntryDescription", "{0} ({1})", uriLabel, description) : uriLabel;
      const sortText = boostPriority ? " " : "!";
      return {
        label: { label: basename2, description: labelDescription },
        filterText: `${basename2} ${typedLeader}${basename2} ${uriLabel}`,
        insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
        range: info,
        kind: kind === FileKind.FILE ? CompletionItemKind.File : CompletionItemKind.Folder,
        sortText,
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: resource.toString(),
            isFile: kind === FileKind.FILE,
            isDirectory: kind === FileKind.FOLDER,
            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
            data: resource
          })]
        }
      };
    };
    let pattern;
    if (info.varWord?.word && (info.varWord.word.startsWith(chatVariableLeader) || info.varWord.word.startsWith(chatAgentLeader))) {
      pattern = info.varWord.word.toLowerCase().slice(1);
    }
    const seen = new ResourceSet();
    const len = result.suggestions.length;
    for (const [i, item] of this.historyService.getHistory().entries()) {
      const resource = isDiffEditorInput(item) ? item.modified.resource : item.resource;
      if (!resource || seen.has(resource) || !this.instantiationService.invokeFunction((accessor) => isSupportedChatFileScheme(accessor, resource.scheme))) {
        continue;
      }
      if (pattern) {
        const uriLabel = this.labelService.getUriLabel(resource, { relative: true }).toLowerCase();
        const basename2 = this.labelService.getUriBasenameLabel(resource).toLowerCase();
        const combined = `${basename2} ${uriLabel}`;
        if (!isPatternInWord(pattern, 0, pattern.length, combined, 0, combined.length)) {
          continue;
        }
      }
      seen.add(resource);
      const newLen = result.suggestions.push(makeCompletionItem(resource, FileKind.FILE, i === 0 ? localize("activeFile", "Active file") : void 0, i === 0));
      if (newLen - len >= 5) {
        break;
      }
    }
    if (pattern) {
      const cacheKey = this.updateCacheKey();
      const workspaces = this.workspaceContextService.getWorkspace().folders.map((folder) => folder.uri);
      for (const workspace of workspaces) {
        const { folders, files } = await searchFilesAndFolders(workspace, pattern, true, token, cacheKey.key, this.configurationService, this.searchService);
        for (const file of files) {
          if (!seen.has(file)) {
            result.suggestions.push(makeCompletionItem(file, FileKind.FILE));
            seen.add(file);
          }
        }
        for (const folder of folders) {
          if (!seen.has(folder)) {
            result.suggestions.push(makeCompletionItem(folder, FileKind.FOLDER));
            seen.add(folder);
          }
        }
      }
    }
    result.incomplete = true;
  }
  addSymbolEntries(widget, result, info, token) {
    const timeoutMs = 100;
    const stopwatch = new StopWatch();
    const typedLeader = info.varWord?.word?.charAt(0) === chatAgentLeader ? chatAgentLeader : chatVariableLeader;
    const makeSymbolCompletionItem = (symbolItem, pattern2) => {
      const text = `${typedLeader}sym:${symbolItem.name}`;
      const resource = symbolItem.location.uri;
      const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
      const sortText = pattern2 ? "{" : "|";
      return {
        label: { label: symbolItem.name, description: uriLabel },
        filterText: `${typedLeader}${symbolItem.name}`,
        insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
        range: info,
        kind: SymbolKinds.toCompletionKind(symbolItem.kind),
        sortText,
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: `vscode.symbol/${JSON.stringify(symbolItem.location)}`,
            fullName: symbolItem.name,
            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
            data: symbolItem.location,
            icon: SymbolKinds.toIcon(symbolItem.kind)
          })]
        }
      };
    };
    let pattern;
    if (info.varWord?.word && (info.varWord.word.startsWith(chatVariableLeader) || info.varWord.word.startsWith(chatAgentLeader))) {
      pattern = info.varWord.word.toLowerCase().slice(1);
    }
    const symbolsToAdd = [];
    for (const outlineModel of this.outlineService.getCachedModels()) {
      const symbols = outlineModel.asListOfDocumentSymbols();
      for (const symbol of symbols) {
        symbolsToAdd.push({ symbol, uri: outlineModel.uri });
      }
    }
    let timedOut = false;
    for (const symbol of symbolsToAdd) {
      if (stopwatch.elapsed() > timeoutMs || token.isCancellationRequested) {
        timedOut = true;
        break;
      }
      result.suggestions.push(makeSymbolCompletionItem({ ...symbol.symbol, location: { uri: symbol.uri, range: symbol.symbol.range } }, pattern ?? ""));
    }
    result.incomplete = !!pattern || timedOut;
  }
  updateCacheKey() {
    if (this.cacheKey && Date.now() - this.cacheKey.time > 6e4) {
      this.searchService.clearCache(this.cacheKey.key);
      this.cacheKey = void 0;
    }
    if (!this.cacheKey) {
      this.cacheKey = {
        key: generateUuid(),
        time: Date.now()
      };
    }
    this.cacheKey.time = Date.now();
    return this.cacheKey;
  }
  cmdAddReference(arg) {
    arg.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference(arg.variable);
  }
};
BuiltinDynamicCompletions = __decorateClass([
  __decorateParam(0, IHistoryService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ISearchService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IOutlineModelService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, ICodeEditorService),
  __decorateParam(10, IChatAgentService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IChatSessionsService)
], BuiltinDynamicCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(BuiltinDynamicCompletions, LifecyclePhase.Eventually);
let ToolCompletions = class extends Disposable {
  // MUST be using `g`-flag
  constructor(languageFeaturesService, chatWidgetService, chatAgentService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this.chatAgentService = chatAgentService;
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatVariables",
      triggerCharacters: [chatVariableLeader, chatAgentLeader],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget) {
          return null;
        }
        if (isAgentHostBackedWidget(widget)) {
          return null;
        }
        if (widget.lockedAgentId) {
          const agent = this.chatAgentService.getAgent(widget.lockedAgentId);
          if (agent && !agent.capabilities?.supportsToolAttachments) {
            return null;
          }
        }
        const range = computeCompletionRanges(model, position, ToolCompletions.VariableNameDef, true);
        if (!range) {
          return null;
        }
        const usedNames = /* @__PURE__ */ new Set();
        for (const part of widget.parsedInput.parts) {
          if (part instanceof ChatRequestToolPart) {
            usedNames.add(part.toolName);
          } else if (part instanceof ChatRequestToolSetPart) {
            usedNames.add(part.name);
          }
        }
        const typedLeader = range.varWord?.word?.charAt(0) === chatAgentLeader ? chatAgentLeader : chatVariableLeader;
        const pattern = range.varWord?.word ? range.varWord.word.toLowerCase().slice(1) : "";
        const suggestions = [];
        const iter = widget.input.selectedToolsModel.entriesMap.get();
        for (const [item, enabled] of iter) {
          if (!enabled) {
            continue;
          }
          let detail;
          let documentation;
          let name;
          if (isToolSet(item)) {
            detail = item.description;
            name = item.referenceName;
          } else {
            const source = item.source;
            detail = localize("tool_source_completion", "{0}: {1}", source.label, item.displayName);
            name = item.toolReferenceName ?? item.displayName;
            documentation = item.userDescription ?? item.modelDescription;
          }
          if (usedNames.has(name)) {
            continue;
          }
          if (pattern) {
            const lowerName = name.toLowerCase();
            if (!isPatternInWord(pattern, 0, pattern.length, lowerName, 0, lowerName.length)) {
              continue;
            }
          }
          const withLeader = `${typedLeader}${name}`;
          suggestions.push({
            label: withLeader,
            range,
            detail,
            documentation,
            filterText: `${typedLeader}${name}`,
            insertText: withLeader + " ",
            kind: CompletionItemKind.Tool
          });
        }
        return { suggestions };
      }
    }));
  }
  static {
    this.VariableNameDef = new RegExp(`(?<=^|\\s)[${escapeForCharClass(chatVariableLeader)}${escapeForCharClass(chatAgentLeader)}]\\w*`, "g");
  }
};
ToolCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatAgentService)
], ToolCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ToolCompletions, LifecyclePhase.Eventually);
