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
import { DeferredPromise } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { autorun } from "../../../base/common/observable.js";
import { revive } from "../../../base/common/marshalling.js";
import { Schemas } from "../../../base/common/network.js";
import { escapeRegExpCharacters } from "../../../base/common/strings.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { URI } from "../../../base/common/uri.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Range } from "../../../editor/common/core/range.js";
import { getWordAtText } from "../../../editor/common/core/wordHelper.js";
import { CompletionItemKind } from "../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../editor/common/services/languageFeatures.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { IChatWidgetService } from "../../contrib/chat/browser/chat.js";
import { AgentSessionProviders, getAgentSessionProvider } from "../../contrib/chat/browser/agentSessions/agentSessions.js";
import { AddDynamicVariableAction } from "../../contrib/chat/browser/attachments/chatDynamicVariables.js";
import { IChatAgentService } from "../../contrib/chat/common/participants/chatAgents.js";
import { IPromptsService, PromptsStorage } from "../../contrib/chat/common/promptSyntax/service/promptsService.js";
import { isValidPromptType, PromptsType } from "../../contrib/chat/common/promptSyntax/promptTypes.js";
import { ChatRequestAgentPart } from "../../contrib/chat/common/requestParser/chatParserTypes.js";
import { ChatRequestParser } from "../../contrib/chat/common/requestParser/chatRequestParser.js";
import { getDynamicVariablesForWidget, getSelectedToolAndToolSetsForWidget } from "../../contrib/chat/browser/attachments/chatVariables.js";
import { IChatService } from "../../contrib/chat/common/chatService/chatService.js";
import { ChatSessionOptionsMap, IChatSessionsService } from "../../contrib/chat/common/chatSessionsService.js";
import { ChatAgentLocation, ChatModeKind } from "../../contrib/chat/common/constants.js";
import { ILanguageModelToolsService } from "../../contrib/chat/common/tools/languageModelToolsService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
import { getChatSessionType, isUntitledChatSession } from "../../contrib/chat/common/model/chatUri.js";
import { ICustomizationHarnessService } from "../../contrib/chat/common/customizationHarnessService.js";
import { AICustomizationManagementSection } from "../../contrib/chat/common/aiCustomizationWorkspaceService.js";
import { IAgentPluginService } from "../../contrib/chat/common/plugins/agentPluginService.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
class MainThreadChatTask {
  constructor(content) {
    this.content = content;
    this.kind = "progressTask";
    this.deferred = new DeferredPromise();
    this._onDidAddProgress = new Emitter();
    this.progress = [];
  }
  get onDidAddProgress() {
    return this._onDidAddProgress.event;
  }
  task() {
    return this.deferred.p;
  }
  isSettled() {
    return this.deferred.isSettled;
  }
  complete(v) {
    this.deferred.complete(v);
  }
  add(progress) {
    this.progress.push(progress);
    this._onDidAddProgress.fire(progress);
  }
  toJSON() {
    return {
      kind: "progressTaskSerialized",
      content: this.content,
      progress: this.progress
    };
  }
}
let MainThreadChatAgents2 = class extends Disposable {
  constructor(extHostContext, _chatAgentService, _chatSessionService, _chatService, _languageFeaturesService, _chatWidgetService, _instantiationService, _logService, _extensionService, _uriIdentityService, _promptsService, _languageModelToolsService, _customizationHarnessService, _telemetryService, _agentPluginService, _environmentService) {
    super();
    this._chatAgentService = _chatAgentService;
    this._chatSessionService = _chatSessionService;
    this._chatService = _chatService;
    this._languageFeaturesService = _languageFeaturesService;
    this._chatWidgetService = _chatWidgetService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._extensionService = _extensionService;
    this._uriIdentityService = _uriIdentityService;
    this._promptsService = _promptsService;
    this._languageModelToolsService = _languageModelToolsService;
    this._customizationHarnessService = _customizationHarnessService;
    this._telemetryService = _telemetryService;
    this._agentPluginService = _agentPluginService;
    this._environmentService = _environmentService;
    this._agents = this._register(new DisposableMap());
    this._agentCompletionProviders = this._register(new DisposableMap());
    this._agentIdsToCompletionProviders = this._register(new DisposableMap());
    this._chatParticipantDetectionProviders = this._register(new DisposableMap());
    this._promptFileProviders = this._register(new DisposableMap());
    this._promptFileProviderEmitters = this._register(new DisposableMap());
    this._promptFileContentRegistrations = this._register(new DisposableMap());
    this._customizationProviders = this._register(new DisposableMap());
    this._customizationProviderEmitters = this._register(new DisposableMap());
    this._pendingProgress = /* @__PURE__ */ new Map();
    this._activeTasks = /* @__PURE__ */ new Map();
    this._unresolvedAnchors = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatAgents2);
    this._register(this._chatService.onDidDisposeSession((e) => {
      for (const resource of e.sessionResources) {
        this._proxy.$releaseSession(resource);
      }
    }));
    this._register(this._chatService.onDidPerformUserAction((e) => {
      if (typeof e.agentId === "string") {
        for (const [handle, agent] of this._agents) {
          if (agent.id === e.agentId) {
            if (e.action.kind === "vote") {
              this._proxy.$acceptFeedback(handle, e.result ?? {}, e.action);
            } else {
              this._proxy.$acceptAction(handle, e.result || {}, e);
            }
            break;
          }
        }
      }
    }));
    this._register(this._chatService.onDidReceiveQuestionCarouselAnswer((e) => {
      this._proxy.$handleQuestionCarouselAnswer(e.requestId, e.resolveId, e.answers);
    }));
    this._register(this._chatWidgetService.onDidChangeFocusedSession(() => {
      this._acceptActiveChatSession(this._chatWidgetService.lastFocusedWidget);
    }));
    this._acceptActiveChatSession(this._chatWidgetService.lastFocusedWidget);
    this._register(this._promptsService.onDidChangeCustomAgents(() => {
      this._proxy.$onDidChangeCustomAgents();
    }));
    this._register(this._promptsService.onDidChangeInstructions(() => {
      this._proxy.$onDidChangeInstructions();
    }));
    this._register(this._promptsService.onDidChangeSkills(() => {
      this._proxy.$onDidChangeSkills();
    }));
    this._register(this._promptsService.onDidChangeSlashCommands(() => {
      this._proxy.$onDidChangeSlashCommands();
    }));
    this._register(this._promptsService.onDidChangeHooks(() => {
      this._proxy.$onDidChangeHooks();
    }));
    this._register(autorun((reader) => {
      this._agentPluginService.plugins.read(reader);
      this._proxy.$onDidChangePlugins();
    }));
  }
  _acceptActiveChatSession(widget) {
    const sessionResource = widget?.viewModel?.sessionResource;
    const isLocal = sessionResource && getAgentSessionProvider(sessionResource) === AgentSessionProviders.Local;
    this._proxy.$acceptActiveChatSession(isLocal ? sessionResource : void 0);
  }
  _toChatResourceSource(storage) {
    switch (storage) {
      case PromptsStorage.local:
        return "local";
      case PromptsStorage.user:
        return "user";
      case PromptsStorage.extension:
        return "extension";
      case PromptsStorage.plugin:
        return "plugin";
      case PromptsStorage.builtIn:
        return "builtin";
    }
  }
  _toCustomAgentDto(agent) {
    return {
      uri: agent.uri,
      name: agent.name,
      description: agent.description,
      source: this._toChatResourceSource(agent.source.storage),
      extensionId: agent.source.storage === PromptsStorage.extension ? agent.source.extensionId.value : void 0,
      pluginUri: agent.source.storage === PromptsStorage.plugin ? agent.source.pluginUri : void 0,
      sessionTypes: agent.sessionTypes,
      argumentHint: agent.argumentHint,
      tools: agent.tools,
      model: agent.model,
      userInvocable: agent.visibility.userInvocable,
      disableModelInvocation: !agent.visibility.agentInvocable,
      enabled: agent.enabled
    };
  }
  _toInstructionDto(instruction) {
    return {
      uri: instruction.uri,
      name: instruction.name,
      description: instruction.description,
      source: this._toChatResourceSource(instruction.storage),
      extensionId: instruction.extension?.identifier.value,
      pluginUri: instruction.pluginUri,
      sessionTypes: instruction.sessionTypes,
      pattern: instruction.pattern
    };
  }
  _toSkillDto(skill) {
    return {
      uri: skill.uri,
      name: skill.name,
      description: skill.description,
      source: this._toChatResourceSource(skill.storage),
      extensionId: skill.extension?.identifier.value,
      pluginUri: skill.pluginUri,
      sessionTypes: skill.sessionTypes,
      userInvocable: skill.userInvocable,
      disableModelInvocation: skill.disableModelInvocation
    };
  }
  _toSlashCommandDto(slashCommand) {
    return {
      uri: slashCommand.uri,
      name: slashCommand.name,
      description: slashCommand.description,
      source: this._toChatResourceSource(slashCommand.storage),
      extensionId: slashCommand.extension?.identifier.value,
      pluginUri: slashCommand.pluginUri,
      sessionTypes: slashCommand.sessionTypes,
      argumentHint: slashCommand.argumentHint,
      userInvocable: slashCommand.userInvocable
    };
  }
  _toHookDto(hookFile) {
    return {
      uri: hookFile.uri,
      sessionTypes: hookFile.sessionTypes,
      source: this._toChatResourceSource(hookFile.storage),
      extensionId: hookFile.extension?.identifier.value,
      pluginUri: hookFile.pluginUri
    };
  }
  _toPluginDto(plugin) {
    return {
      uri: plugin.uri
    };
  }
  async $provideCustomAgents(token) {
    const customAgents = await this._promptsService.getCustomAgents(token);
    return customAgents.map((agent) => this._toCustomAgentDto(agent));
  }
  async $provideInstructions(token) {
    const instructions = await this._promptsService.getInstructionFiles(token);
    return instructions.map((instruction) => this._toInstructionDto(instruction));
  }
  async $provideSkills(token) {
    const skills = await this._promptsService.findAgentSkills(token) ?? [];
    return skills.map((skill) => this._toSkillDto(skill));
  }
  async $provideSlashCommands(token) {
    const slashCommands = await this._promptsService.getPromptSlashCommands(token);
    return slashCommands.map((slashCommand) => this._toSlashCommandDto(slashCommand));
  }
  async $provideHooks(token) {
    const hookFiles = await this._promptsService.listPromptFiles(PromptsType.hook, token);
    return hookFiles.map((hookFile) => this._toHookDto(hookFile));
  }
  async $providePlugins(_token) {
    const plugins = this._agentPluginService.plugins.get();
    return plugins.map((plugin) => this._toPluginDto(plugin));
  }
  $unregisterAgent(handle) {
    this._agents.deleteAndDispose(handle);
  }
  async $transferActiveChatSession(toWorkspace) {
    const widget = this._chatWidgetService.lastFocusedWidget;
    const model = widget?.viewModel?.model;
    if (!model) {
      this._logService.error(`MainThreadChat#$transferActiveChatSession: No active chat session found`);
      return;
    }
    await this._chatService.transferChatSession(model.sessionResource, URI.revive(toWorkspace));
  }
  async $registerAgent(handle, extension, id, metadata, dynamicProps) {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const staticAgentRegistration = this._chatAgentService.getAgent(id, true);
    const chatSessionRegistration = this._chatSessionService.getAllChatSessionContributions().find((c) => c.type === id || c.alternativeIds?.includes(id));
    if (!staticAgentRegistration && !chatSessionRegistration && !dynamicProps) {
      if (this._chatAgentService.getAgentsByName(id).length) {
        throw new Error(`chatParticipant must be declared with an ID in package.json. The "id" property may be missing! "${id}"`);
      }
      throw new Error(`chatParticipant must be declared in package.json: ${id}`);
    }
    const impl = {
      invoke: async (request, progress, history, token) => {
        const chatSession = this._chatService.getSession(request.sessionResource);
        this._pendingProgress.set(request.requestId, { progress, chatSession, isSubagent: !!request.subAgentInvocationId });
        try {
          const chatSessionResource = request.sessionResource;
          const chatSessionContext = {
            chatSessionResource,
            isUntitled: isUntitledChatSession(chatSessionResource),
            initialSessionOptions: ChatSessionOptionsMap.toStrValueArray(this._chatSessionService.getSessionOptions(chatSessionResource))
          };
          const rpcResult = await this._proxy.$invokeAgent(handle, request, {
            history,
            chatSessionContext
          }, token);
          if (rpcResult?.errorCallstack && !rpcResult.errorDetails?.isRateLimited && !rpcResult.errorDetails?.isQuotaExceeded && !rpcResult.errorDetails?.isExpectedError) {
            this._telemetryService.publicLogError2("chatAgentError", {
              callstack: rpcResult.errorCallstack,
              msg: rpcResult.errorDetails?.message ?? "",
              errorName: rpcResult.errorName ?? "",
              agent: id,
              agentExtensionId: extension.value
            });
          }
          if (rpcResult) {
            const { errorCallstack: _, errorName: _2, ...result } = rpcResult;
            return result;
          }
          return {};
        } finally {
          this._pendingProgress.delete(request.requestId);
        }
      },
      setRequestTools: (requestId, tools) => {
        this._proxy.$setRequestTools(requestId, tools);
      },
      setYieldRequested: (requestId, value) => {
        this._proxy.$setYieldRequested(requestId, value);
      },
      provideFollowups: async (request, result, history, token) => {
        if (!this._agents.get(handle)?.hasFollowups) {
          return [];
        }
        return this._proxy.$provideFollowups(request, handle, result, { history }, token);
      },
      provideChatTitle: (history, token) => {
        return this._proxy.$provideChatTitle(handle, history, token);
      },
      provideChatSummary: (history, token) => {
        return this._proxy.$provideChatSummary(handle, history, token);
      }
    };
    if (chatSessionRegistration?.alternativeIds?.includes(id)) {
      return;
    }
    let disposable;
    if (!staticAgentRegistration && dynamicProps) {
      const extensionDescription = this._extensionService.extensions.find((e) => ExtensionIdentifier.equals(e.identifier, extension));
      disposable = this._chatAgentService.registerDynamicAgent(
        {
          id,
          name: dynamicProps.name,
          description: dynamicProps.description,
          extensionId: extension,
          extensionVersion: extensionDescription?.version,
          extensionDisplayName: extensionDescription?.displayName ?? extension.value,
          extensionPublisherId: extensionDescription?.publisher ?? "",
          publisherDisplayName: dynamicProps.publisherName,
          fullName: dynamicProps.fullName,
          metadata: revive(metadata),
          slashCommands: [],
          disambiguation: [],
          locations: [ChatAgentLocation.Chat],
          modes: [ChatModeKind.Ask, ChatModeKind.Agent, ChatModeKind.Edit]
        },
        impl
      );
    } else {
      disposable = this._chatAgentService.registerAgentImplementation(id, impl);
    }
    this._agents.set(handle, {
      id,
      extensionId: extension,
      dispose: () => disposable.dispose(),
      hasFollowups: metadata.hasFollowups
    });
  }
  async $updateAgent(handle, metadataUpdate) {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const data = this._agents.get(handle);
    if (!data) {
      this._logService.error(`MainThreadChatAgents2#$updateAgent: No agent with handle ${handle} registered`);
      return;
    }
    data.hasFollowups = metadataUpdate.hasFollowups;
    this._chatAgentService.updateAgent(data.id, revive(metadataUpdate));
  }
  async $handleProgressChunk(requestId, chunks) {
    const pendingProgress = this._pendingProgress.get(requestId);
    if (!pendingProgress) {
      this._logService.warn(`MainThreadChatAgents2#$handleProgressChunk: No pending progress for requestId ${requestId}`);
      return;
    }
    const { progress, chatSession, isSubagent } = pendingProgress;
    const chatProgressParts = [];
    const response = chatSession?.getRequests().find((req) => req.id === requestId)?.response;
    for (const item of chunks) {
      const [progress2, responsePartHandle] = Array.isArray(item) ? item : [item];
      if (progress2.kind === "externalEdits") {
        if (chatSession?.editingSession && responsePartHandle !== void 0 && response) {
          const parts = progress2.start ? await chatSession.editingSession.startExternalEdits(response, responsePartHandle, revive(progress2.resources), progress2.undoStopId) : await chatSession.editingSession.stopExternalEdits(response, responsePartHandle);
          chatProgressParts.push(...parts);
        }
        continue;
      }
      if (progress2.kind === "beginToolInvocation") {
        this._languageModelToolsService.beginToolCall({
          toolCallId: progress2.toolCallId,
          toolId: progress2.toolName,
          chatRequestId: requestId,
          sessionResource: chatSession?.sessionResource,
          subagentInvocationId: progress2.subagentInvocationId
        });
        continue;
      }
      if (progress2.kind === "updateToolInvocation") {
        this._languageModelToolsService.updateToolStream(progress2.toolCallId, progress2.streamData?.partialInput, CancellationToken.None);
        continue;
      }
      if (progress2.kind === "usage") {
        if (isSubagent) {
          chatProgressParts.push({
            kind: "usage",
            promptTokens: progress2.promptTokens,
            completionTokens: progress2.completionTokens,
            outputBuffer: progress2.outputBuffer,
            copilotCredits: progress2.copilotCredits,
            promptTokenDetails: progress2.promptTokenDetails
          });
        } else if (response) {
          response.setUsage({
            kind: "usage",
            promptTokens: progress2.promptTokens,
            completionTokens: progress2.completionTokens,
            outputBuffer: progress2.outputBuffer,
            copilotCredits: progress2.copilotCredits,
            promptTokenDetails: progress2.promptTokenDetails
          });
        } else {
          this._logService.warn(`MainThreadChatAgents2#$handleProgressChunk: No response model for usage of non-subagent request ${requestId}; dropping usage.`);
        }
        continue;
      }
      const revivedProgress = progress2.kind === "notebookEdit" ? ChatNotebookEdit.fromChatEdit(progress2) : revive(progress2);
      if (revivedProgress.kind === "notebookEdit" || revivedProgress.kind === "textEdit" || revivedProgress.kind === "codeblockUri") {
        revivedProgress.uri = this._uriIdentityService.asCanonicalUri(revivedProgress.uri);
      }
      if (responsePartHandle !== void 0) {
        if (revivedProgress.kind === "progressTask") {
          const handle = responsePartHandle;
          const responsePartId = `${requestId}_${handle}`;
          const task = new MainThreadChatTask(revivedProgress.content);
          this._activeTasks.set(responsePartId, task);
          chatProgressParts.push(task);
        } else if (responsePartHandle !== void 0) {
          const responsePartId = `${requestId}_${responsePartHandle}`;
          const task = this._activeTasks.get(responsePartId);
          switch (revivedProgress.kind) {
            case "progressTaskResult":
              if (task && revivedProgress.content) {
                task.complete(revivedProgress.content.value);
                this._activeTasks.delete(responsePartId);
              } else {
                task?.complete(void 0);
              }
              break;
            case "warning":
            case "reference":
              task?.add(revivedProgress);
              break;
          }
        }
        continue;
      }
      if (revivedProgress.kind === "inlineReference" && revivedProgress.resolveId && response) {
        if (!this._unresolvedAnchors.has(requestId)) {
          this._unresolvedAnchors.set(requestId, /* @__PURE__ */ new Map());
        }
        this._unresolvedAnchors.get(requestId)?.set(revivedProgress.resolveId, { response });
      }
      chatProgressParts.push(revivedProgress);
    }
    progress(chatProgressParts);
  }
  $handleAnchorResolve(requestId, handle, resolveAnchor) {
    const unresolvedAnchorsForRequest = this._unresolvedAnchors.get(requestId);
    if (!unresolvedAnchorsForRequest) {
      return;
    }
    const unresolvedAnchor = unresolvedAnchorsForRequest.get(handle);
    if (!unresolvedAnchor) {
      return;
    }
    unresolvedAnchorsForRequest.delete(handle);
    if (unresolvedAnchorsForRequest.size === 0) {
      this._unresolvedAnchors.delete(requestId);
    }
    if (resolveAnchor) {
      const revivedAnchor = revive(resolveAnchor);
      unresolvedAnchor.response.resolveInlineReference(handle, revivedAnchor);
    }
  }
  $registerAgentCompletionsProvider(handle, id, triggerCharacters) {
    const provide = async (query, token) => {
      const completions = await this._proxy.$invokeCompletionProvider(handle, query, token);
      return completions.map((c) => ({ ...c, icon: c.icon ? ThemeIcon.fromId(c.icon) : void 0 }));
    };
    this._agentIdsToCompletionProviders.set(id, this._chatAgentService.registerAgentCompletionProvider(id, provide));
    this._agentCompletionProviders.set(handle, this._languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatAgentCompletions:" + handle,
      triggerCharacters,
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this._chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return;
        }
        const triggerCharsPart = triggerCharacters.map((c) => escapeRegExpCharacters(c)).join("");
        const wordRegex = new RegExp(`[${triggerCharsPart}]\\S*`, "g");
        const query = getWordAtText(position.column, wordRegex, model.getLineContent(position.lineNumber), 0)?.word ?? "";
        if (query && !triggerCharacters.some((c) => query.startsWith(c))) {
          return;
        }
        const context = {
          sessionType: getChatSessionType(widget.viewModel.model.sessionResource)
        };
        const parsedRequest = this._instantiationService.createInstance(ChatRequestParser).parseChatRequestWithReferences(getDynamicVariablesForWidget(widget), getSelectedToolAndToolSetsForWidget(widget), model.getValue(), ChatAgentLocation.Chat, context).parts;
        const agentPart = parsedRequest.find((part) => part instanceof ChatRequestAgentPart);
        const thisAgentId = this._agents.get(handle)?.id;
        if (agentPart?.agent.id !== thisAgentId) {
          return;
        }
        const range = computeCompletionRanges(model, position, wordRegex);
        if (!range) {
          return null;
        }
        const result = await provide(query, token);
        const variableItems = result.map((v) => {
          const insertText = v.insertText ?? (typeof v.label === "string" ? v.label : v.label.label);
          const rangeAfterInsert = new Range(range.insert.startLineNumber, range.insert.startColumn, range.insert.endLineNumber, range.insert.startColumn + insertText.length);
          return {
            label: v.label,
            range,
            insertText: insertText + " ",
            kind: CompletionItemKind.Text,
            detail: v.detail,
            documentation: v.documentation,
            command: { id: AddDynamicVariableAction.ID, title: "", arguments: [{ id: v.id, widget, range: rangeAfterInsert, variableData: revive(v.value), command: v.command }] }
          };
        });
        return {
          suggestions: variableItems
        };
      }
    }));
  }
  $unregisterAgentCompletionsProvider(handle, id) {
    this._agentCompletionProviders.deleteAndDispose(handle);
    this._agentIdsToCompletionProviders.deleteAndDispose(id);
  }
  $registerChatParticipantDetectionProvider(handle) {
    this._chatParticipantDetectionProviders.set(handle, this._chatAgentService.registerChatParticipantDetectionProvider(
      handle,
      {
        provideParticipantDetection: async (request, history, options, token) => {
          return await this._proxy.$detectChatParticipant(handle, request, { history }, options, token);
        }
      }
    ));
  }
  $unregisterChatParticipantDetectionProvider(handle) {
    this._chatParticipantDetectionProviders.deleteAndDispose(handle);
  }
  async $registerPromptFileProvider(handle, type, extensionId) {
    const extension = await this._extensionService.getExtension(extensionId.value);
    if (!extension) {
      this._logService.error(`[MainThreadChatAgents2] Could not find extension for prompt file provider: ${extensionId.value}`);
      return;
    }
    if (!isValidPromptType(type)) {
      this._logService.error(`[MainThreadChatAgents2] Invalid contribution type: ${type}`);
      return;
    }
    const emitter = new Emitter();
    this._promptFileProviderEmitters.set(handle, emitter);
    const contentRegistrations = new DisposableMap();
    this._promptFileContentRegistrations.set(handle, contentRegistrations);
    const disposable = this._promptsService.registerPromptFileProvider(extension, type, {
      onDidChangePromptFiles: emitter.event,
      providePromptFiles: async (context, token) => {
        const contributions = await this._proxy.$providePromptFiles(handle, type, context, token);
        if (!contributions) {
          return void 0;
        }
        return contributions.map((c) => {
          return {
            name: c.name,
            description: c.description,
            sessionTypes: c.sessionTypes,
            when: c.when,
            uri: URI.revive(c.uri)
          };
        });
      }
    });
    this._promptFileProviders.set(handle, disposable);
  }
  $unregisterPromptFileProvider(handle) {
    this._promptFileProviders.deleteAndDispose(handle);
    this._promptFileProviderEmitters.deleteAndDispose(handle);
    this._promptFileContentRegistrations.deleteAndDispose(handle);
  }
  $onDidChangePromptFiles(handle) {
    const emitter = this._promptFileProviderEmitters.get(handle);
    if (emitter) {
      emitter.fire();
    }
  }
  async $registerChatSessionCustomizationProvider(handle, chatSessionType, metadata, extensionId) {
    if (this._environmentService.isSessionsWindow && !this._chatSessionService.getContentProviderSchemes().includes(chatSessionType)) {
      return;
    }
    const extension = await this._extensionService.getExtension(extensionId.value);
    if (!extension) {
      this._logService.error(`[MainThreadChatAgents2] Could not find extension for customization provider: ${extensionId.value}`);
      return;
    }
    const emitter = new Emitter();
    this._customizationProviderEmitters.set(handle, emitter);
    const itemProvider = {
      onDidChange: emitter.event,
      provideChatSessionCustomizations: async (sessionResource, token) => {
        const items = await this._proxy.$provideChatSessionCustomizations(handle, sessionResource, token);
        if (!items) {
          return void 0;
        }
        return items.map((item) => ({
          uri: URI.revive(item.uri),
          type: item.type,
          name: item.name,
          source: item.source,
          description: item.description,
          groupKey: item.groupKey,
          badge: item.badge,
          badgeTooltip: item.badgeTooltip,
          extensionId: item.extensionId,
          pluginUri: item.pluginUri ? URI.revive(item.pluginUri) : void 0,
          pluginLabel: item.pluginLabel,
          userInvocable: item.userInvocable
        }));
      },
      provideSourceFolders: async (sessionResource, type, token) => {
        const folders = await this._proxy.$provideSourceFolders(handle, sessionResource, type, token);
        if (!folders) {
          return void 0;
        }
        return folders.map((folder) => ({
          uri: URI.revive(folder.uri),
          label: folder.label,
          source: folder.source
        }));
      }
    };
    const typeToSection = {
      "agent": AICustomizationManagementSection.Agents,
      "skill": AICustomizationManagementSection.Skills,
      "instructions": AICustomizationManagementSection.Instructions,
      "prompt": AICustomizationManagementSection.Prompts,
      "hook": AICustomizationManagementSection.Hooks,
      "plugins": AICustomizationManagementSection.Plugins
    };
    let hiddenSections;
    if (metadata.supportedTypes) {
      const supportedSections = /* @__PURE__ */ new Set();
      for (const t of metadata.supportedTypes) {
        const section = typeToSection[t];
        if (section) {
          supportedSections.add(section);
        }
      }
      hiddenSections = Object.values(typeToSection).filter((section) => !supportedSections.has(section));
    }
    const descriptor = {
      id: chatSessionType,
      label: metadata.label,
      icon: metadata.iconId ? ThemeIcon.fromId(metadata.iconId) : ThemeIcon.fromId(Codicon.extensions.id),
      hiddenSections,
      itemProvider
    };
    const registration = this._customizationHarnessService.registerExternalHarness(descriptor);
    this._customizationProviders.set(handle, registration);
  }
  $unregisterChatSessionCustomizationProvider(handle) {
    this._customizationProviders.deleteAndDispose(handle);
    this._customizationProviderEmitters.deleteAndDispose(handle);
  }
  $onDidChangeCustomizations(handle) {
    const emitter = this._customizationProviderEmitters.get(handle);
    if (emitter) {
      emitter.fire();
    }
  }
};
MainThreadChatAgents2 = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatAgents2),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IChatSessionsService),
  __decorateParam(3, IChatService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IExtensionService),
  __decorateParam(9, IUriIdentityService),
  __decorateParam(10, IPromptsService),
  __decorateParam(11, ILanguageModelToolsService),
  __decorateParam(12, ICustomizationHarnessService),
  __decorateParam(13, ITelemetryService),
  __decorateParam(14, IAgentPluginService),
  __decorateParam(15, IWorkbenchEnvironmentService)
], MainThreadChatAgents2);
function computeCompletionRanges(model, position, reg) {
  const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
  if (!varWord && model.getWordUntilPosition(position).word) {
    return;
  }
  let insert;
  let replace;
  if (!varWord) {
    insert = replace = Range.fromPositions(position);
  } else {
    insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
    replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
  }
  return { insert, replace };
}
var ChatNotebookEdit;
((ChatNotebookEdit2) => {
  function fromChatEdit(part) {
    return {
      kind: "notebookEdit",
      uri: URI.revive(part.uri),
      done: part.done,
      edits: part.edits.map(NotebookDto.fromCellEditOperationDto)
    };
  }
  ChatNotebookEdit2.fromChatEdit = fromChatEdit;
})(ChatNotebookEdit || (ChatNotebookEdit = {}));
export {
  MainThreadChatAgents2,
  MainThreadChatTask
};
