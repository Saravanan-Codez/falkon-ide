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
import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { assertNever } from "../../../../../base/common/assert.js";
import { RunOnceScheduler, timeout } from "../../../../../base/common/async.js";
import { encodeBase64 } from "../../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { arrayEqualsC } from "../../../../../base/common/equals.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { CancellationError, isCancellationError } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { createMarkdownCommandLink, MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { combinedDisposable, Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { getMediaMime } from "../../../../../base/common/mime.js";
import { derived, derivedOpts, observableFromEventOpts, ObservableSet, observableSignal, transaction } from "../../../../../base/common/observable.js";
import Severity from "../../../../../base/common/severity.js";
import { StopWatch } from "../../../../../base/common/stopwatch.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import * as JSONContributionRegistry from "../../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { toToolSetVariableEntry, toToolVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { IChatService, IChatToolInvocation, ToolConfirmKind } from "../../common/chatService/chatService.js";
import { ChatConfiguration, isAutoApproveLevel, isAutopilotLevel } from "../../common/constants.js";
import { localChatSessionType } from "../../common/chatSessionsService.js";
import { ChatToolInvocation } from "../../common/model/chatProgressTypes/chatToolInvocation.js";
import { chatSessionResourceToId, getChatSessionType } from "../../common/model/chatUri.js";
import { HookType } from "../../common/promptSyntax/hookTypes.js";
import { CopilotChatSettingId, CopilotToolId } from "../../common/tools/copilotToolIds.js";
import { ILanguageModelToolsConfirmationService } from "../../common/tools/languageModelToolsConfirmationService.js";
import { TerminalToolId } from "../../common/tools/terminalToolIds.js";
import { createToolSchemaUri, isToolSet, SpecedToolAliases, stringifyPromptTsxPart, ToolAndToolSetEnablementMap, ToolDataSource, ToolInvocationPresentation, toolMatchesModel, ToolSet, ToolSetForModel, VSCodeToolReference } from "../../common/tools/languageModelToolsService.js";
import { IToolResultCompressor } from "../../common/tools/toolResultCompressor.js";
import { getToolConfirmationAlert } from "../accessibility/chatAccessibilityProvider.js";
import { IChatWidgetService } from "../chat.js";
import { IChatToolRiskAssessmentService, ToolRiskLevel } from "./chatToolRiskAssessmentService.js";
const jsonSchemaRegistry = Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
var AutoApproveStorageKeys = /* @__PURE__ */ ((AutoApproveStorageKeys2) => {
  AutoApproveStorageKeys2["GlobalAutoApproveOptIn"] = "chat.tools.global.autoApprove.optIn";
  return AutoApproveStorageKeys2;
})(AutoApproveStorageKeys || {});
const SkipAutoApproveConfirmationKey = "vscode.chat.tools.global.autoApprove.testMode";
const autoApproveAllReason = "auto-approve-all";
const toolIdsThatCannotBeAutoApproved = /* @__PURE__ */ new Set([
  "vscode_get_confirmation_with_options",
  "vscode_get_modified_files_confirmation"
]);
const fetchWebPageToolIds = /* @__PURE__ */ new Set([
  "copilot_fetchWebPage",
  "vscode_fetchWebPage_internal"
]);
const globalAutoApproveDescription = localize2(
  {
    key: "autoApprove3.markdown",
    comment: [
      "{Locked='](https://github.com/features/codespaces)'}",
      "{Locked='](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)'}",
      "{Locked='](https://code.visualstudio.com/docs/agents/run/security)'}",
      "{Locked='**'}",
      "{Locked='[`chat.autoReply`](command:workbench.action.openSettings?%5B%22chat.autoReply%22%5D)'}"
    ]
  },
  'Global auto approve also known as "YOLO mode" disables manual approval completely for _all tools in all workspaces_, allowing the agent to act fully autonomously. This is extremely dangerous and is *never* recommended, even containerized environments like [Codespaces](https://github.com/features/codespaces) and [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) have user keys forwarded into the container that could be compromised.\n\n**This feature disables [critical security protections](https://code.visualstudio.com/docs/agents/run/security) and makes it much easier for an attacker to compromise the machine.**\n\nNote: This setting only controls tool approval and does not prevent the agent from asking questions. To automatically answer agent questions, use the [`chat.autoReply`](command:workbench.action.openSettings?%5B%22chat.autoReply%22%5D) setting.'
);
let LanguageModelToolsService = class extends Disposable {
  constructor(_instantiationService, _extensionService, _contextKeyService, _chatService, _dialogService, _telemetryService, _logService, _configurationService, _accessibilityService, _accessibilitySignalService, _storageService, _confirmationService, _commandService, _chatWidgetService, _toolResultCompressor, _riskAssessmentService) {
    super();
    this._instantiationService = _instantiationService;
    this._extensionService = _extensionService;
    this._contextKeyService = _contextKeyService;
    this._chatService = _chatService;
    this._dialogService = _dialogService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._accessibilityService = _accessibilityService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._storageService = _storageService;
    this._confirmationService = _confirmationService;
    this._commandService = _commandService;
    this._chatWidgetService = _chatWidgetService;
    this._toolResultCompressor = _toolResultCompressor;
    this._riskAssessmentService = _riskAssessmentService;
    this._onDidChangeTools = this._register(new Emitter());
    this.onDidChangeTools = this._onDidChangeTools.event;
    this._onDidPrepareToolCallBecomeUnresponsive = this._register(new Emitter());
    this.onDidPrepareToolCallBecomeUnresponsive = this._onDidPrepareToolCallBecomeUnresponsive.event;
    this._onDidInvokeTool = this._register(new Emitter());
    this.onDidInvokeTool = this._onDidInvokeTool.event;
    /** Throttle tools updates because it sends all tools and runs on context key updates */
    this._onDidChangeToolsScheduler = this._register(new RunOnceScheduler(() => this._onDidChangeTools.fire(), 750));
    this._tools = /* @__PURE__ */ new Map();
    this._toolContextKeys = /* @__PURE__ */ new Set();
    this._callsByRequestId = /* @__PURE__ */ new Map();
    /** Pending tool calls in the streaming phase, keyed by toolCallId */
    this._pendingToolCalls = /* @__PURE__ */ new Map();
    this._toolSets = new ObservableSet();
    this.toolSets = derived(this, (reader) => {
      const allToolSets = Array.from(this._toolSets.observable.read(reader));
      return allToolSets.filter((toolSet) => this.isPermitted(toolSet, reader));
    });
    this.allToolsIncludingDisableObs = observableFromEventOpts(
      { equalsFn: arrayEqualsC() },
      this.onDidChangeTools,
      () => Array.from(this.getAllToolsIncludingDisabled())
    );
    this.toolsWithFullReferenceName = derived((reader) => {
      const result = [];
      const coveredByToolSets = /* @__PURE__ */ new Set();
      for (const toolSet of this.toolSets.read(reader)) {
        if (toolSet.source.type !== "user") {
          result.push([toolSet, getToolSetFullReferenceName(toolSet)]);
          for (const tool of toolSet.getTools()) {
            result.push([tool, getToolFullReferenceName(tool, toolSet)]);
            coveredByToolSets.add(tool);
          }
        }
      }
      for (const tool of this.allToolsIncludingDisableObs.read(reader)) {
        if (tool.when && !this._contextKeyService.contextMatchesRules(tool.when)) {
          continue;
        }
        if (tool.canBeReferencedInPrompt && !coveredByToolSets.has(tool) && this.isPermitted(tool, reader)) {
          result.push([tool, getToolFullReferenceName(tool)]);
        }
      }
      return result;
    });
    this._isAgentModeEnabled = observableConfigValue(ChatConfiguration.AgentEnabled, true, this._configurationService);
    this._register(this._contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this._toolContextKeys)) {
        this._onDidChangeToolsScheduler.schedule();
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.ExtensionToolsEnabled) || e.affectsConfiguration(ChatConfiguration.AgentEnabled) || e.affectsConfiguration(CopilotChatSettingId.Gpt55ReadFileToolEnabled)) {
        this._onDidChangeToolsScheduler.schedule();
      }
    }));
    this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(ChatConfiguration.GlobalAutoApprove)) {
        if (this._configurationService.getValue(ChatConfiguration.GlobalAutoApprove) !== true) {
          this._storageService.remove("chat.tools.global.autoApprove.optIn" /* GlobalAutoApproveOptIn */, StorageScope.APPLICATION);
        }
      }
    }));
    this._ctxToolsCount = ChatContextKeys.Tools.toolsCount.bindTo(_contextKeyService);
    this.vscodeToolSet = this._register(this.createToolSet(
      ToolDataSource.Internal,
      "vscode",
      VSCodeToolReference.vscode,
      {
        icon: ThemeIcon.fromId(Codicon.vscode.id),
        description: localize("copilot.toolSet.vscode.description", "Use VS Code features"),
        deprecated: true
      }
    ));
    this.executeToolSet = this._register(this.createToolSet(
      ToolDataSource.Internal,
      "execute",
      SpecedToolAliases.execute,
      {
        icon: ThemeIcon.fromId(Codicon.terminal.id),
        description: localize("copilot.toolSet.execute.description", "Execute code and applications on your machine"),
        deprecated: true
      }
    ));
    this.readToolSet = this._register(this.createToolSet(
      ToolDataSource.Internal,
      "read",
      SpecedToolAliases.read,
      {
        icon: ThemeIcon.fromId(Codicon.book.id),
        description: localize("copilot.toolSet.read.description", "Read files in your workspace"),
        deprecated: true
      }
    ));
    this.agentToolSet = this._register(this.createToolSet(
      ToolDataSource.Internal,
      "agent",
      SpecedToolAliases.agent,
      {
        icon: ThemeIcon.fromId(Codicon.agent.id),
        description: localize("copilot.toolSet.agent.description", "Delegate tasks to other agents"),
        deprecated: true
      }
    ));
  }
  isToolEnabledForModel(toolData, model) {
    if (!toolMatchesModel(toolData, model)) {
      return false;
    }
    if (toolData.id === CopilotToolId.ReadFile && model?.family.startsWith("gpt-5.5") && this._configurationService.getValue(CopilotChatSettingId.Gpt55ReadFileToolEnabled) === false) {
      return false;
    }
    return true;
  }
  /**
   * Returns if the given tool or toolset is permitted in the current context.
   * When agent mode is enabled, all tools are permitted (no restriction)
   * When agent mode is disabled only a subset of read-only tools are permitted in agentic-loop contexts.
   */
  isPermitted(toolOrToolSet, reader) {
    const agentModeEnabled = this._isAgentModeEnabled.read(reader);
    if (agentModeEnabled !== false) {
      return true;
    }
    if (!isToolSet(toolOrToolSet) && toolOrToolSet.canBeReferencedInPrompt === false && toolOrToolSet.source.type === "internal") {
      return true;
    }
    const permittedInternalToolSetIds = [SpecedToolAliases.read, SpecedToolAliases.search, SpecedToolAliases.web];
    if (isToolSet(toolOrToolSet)) {
      const permitted = toolOrToolSet.source.type === "internal" && permittedInternalToolSetIds.includes(toolOrToolSet.referenceName);
      this._logService.trace(`LanguageModelToolsService#isPermitted: ToolSet ${toolOrToolSet.id} (${toolOrToolSet.referenceName}) permitted=${permitted}`);
      return permitted;
    }
    for (const toolSet of this._toolSets) {
      if (toolSet.source.type === "internal" && permittedInternalToolSetIds.includes(toolSet.referenceName)) {
        for (const memberTool of toolSet.getTools()) {
          if (memberTool.id === toolOrToolSet.id) {
            this._logService.trace(`LanguageModelToolsService#isPermitted: Tool ${toolOrToolSet.id} (${toolOrToolSet.toolReferenceName}) permitted=true (member of ${toolSet.referenceName})`);
            return true;
          }
        }
      }
    }
    if (toolOrToolSet.id === "vscode_fetchWebPage_internal" && permittedInternalToolSetIds.includes(SpecedToolAliases.web)) {
      this._logService.trace(`LanguageModelToolsService#isPermitted: Tool ${toolOrToolSet.id} (${toolOrToolSet.toolReferenceName}) permitted=true (special case)`);
      return true;
    }
    this._logService.trace(`LanguageModelToolsService#isPermitted: Tool ${toolOrToolSet.id} (${toolOrToolSet.toolReferenceName}) permitted=false`);
    return false;
  }
  dispose() {
    super.dispose();
    this._callsByRequestId.forEach((calls) => calls.forEach((call) => call.store.dispose()));
    this._pendingToolCalls.clear();
    this._ctxToolsCount.reset();
  }
  registerToolData(toolData) {
    if (this._tools.has(toolData.id)) {
      throw new Error(`Tool "${toolData.id}" is already registered.`);
    }
    this._tools.set(toolData.id, { data: toolData });
    this._ctxToolsCount.set(this._tools.size);
    if (!this._onDidChangeToolsScheduler.isScheduled()) {
      this._onDidChangeToolsScheduler.schedule();
    }
    toolData.when?.keys().forEach((key) => this._toolContextKeys.add(key));
    let store;
    if (toolData.inputSchema) {
      store = new DisposableStore();
      const schemaUrl = createToolSchemaUri(toolData.id).toString();
      jsonSchemaRegistry.registerSchema(schemaUrl, toolData.inputSchema, store);
      store.add(jsonSchemaRegistry.registerSchemaAssociation(schemaUrl, `/lm/tool/${toolData.id}/tool_input.json`));
    }
    return toDisposable(() => {
      store?.dispose();
      this._tools.delete(toolData.id);
      this._ctxToolsCount.set(this._tools.size);
      this._refreshAllToolContextKeys();
      if (!this._onDidChangeToolsScheduler.isScheduled()) {
        this._onDidChangeToolsScheduler.schedule();
      }
    });
  }
  flushToolUpdates() {
    this._onDidChangeToolsScheduler.flush();
  }
  _refreshAllToolContextKeys() {
    this._toolContextKeys.clear();
    for (const tool of this._tools.values()) {
      tool.data.when?.keys().forEach((key) => this._toolContextKeys.add(key));
    }
  }
  registerToolImplementation(id, tool) {
    const entry = this._tools.get(id);
    if (!entry) {
      throw new Error(`Tool "${id}" was not contributed.`);
    }
    if (entry.impl) {
      throw new Error(`Tool "${id}" already has an implementation.`);
    }
    entry.impl = tool;
    return toDisposable(() => {
      entry.impl = void 0;
    });
  }
  registerTool(toolData, tool) {
    return combinedDisposable(
      this.registerToolData(toolData),
      this.registerToolImplementation(toolData.id, tool)
    );
  }
  getTools(model) {
    const toolDatas = Iterable.map(this._tools.values(), (i) => i.data);
    const extensionToolsEnabled = this._configurationService.getValue(ChatConfiguration.ExtensionToolsEnabled);
    return Iterable.filter(
      toolDatas,
      (toolData) => {
        const satisfiesWhenClause = !toolData.when || this._contextKeyService.contextMatchesRules(toolData.when);
        const satisfiesExternalToolCheck = toolData.source.type !== "extension" || !!extensionToolsEnabled;
        const satisfiesPermittedCheck = this.isPermitted(toolData);
        const satisfiesModelFilter = this.isToolEnabledForModel(toolData, model);
        return satisfiesWhenClause && satisfiesExternalToolCheck && satisfiesPermittedCheck && satisfiesModelFilter;
      }
    );
  }
  observeTools(model) {
    const meta = derived((reader) => {
      const signal = observableSignal("observeToolsContext");
      const trigger = () => transaction((tx) => signal.trigger(tx));
      reader.store.add(this.onDidChangeTools(trigger));
      return signal;
    });
    return derivedOpts({ equalsFn: arrayEqualsC() }, (reader) => {
      meta.read(reader).read(reader);
      return Array.from(this.getTools(model));
    });
  }
  getAllToolsIncludingDisabled() {
    const toolDatas = Iterable.map(this._tools.values(), (i) => i.data);
    const extensionToolsEnabled = this._configurationService.getValue(ChatConfiguration.ExtensionToolsEnabled);
    return Iterable.filter(
      toolDatas,
      (toolData) => {
        const satisfiesExternalToolCheck = toolData.source.type !== "extension" || !!extensionToolsEnabled;
        const satisfiesPermittedCheck = this.isPermitted(toolData);
        return satisfiesExternalToolCheck && satisfiesPermittedCheck;
      }
    );
  }
  getTool(id) {
    return this._tools.get(id)?.data;
  }
  getToolByName(name) {
    for (const tool of this.getAllToolsIncludingDisabled()) {
      if (tool.toolReferenceName === name) {
        return tool;
      }
    }
    return void 0;
  }
  _handlePreToolUseDenial(dto, hookResult, toolData, pendingInvocation, request) {
    const hookReason = hookResult.permissionDecisionReason ?? localize("hookDeniedNoReason", "Hook denied tool execution");
    const reason = localize("deniedByPreToolUseHook", "Denied by {0} hook: {1}", HookType.PreToolUse, hookReason);
    this._logService.debug(`[LanguageModelToolsService#invokeTool] Tool ${dto.toolId} denied by preToolUse hook: ${hookReason}`);
    if (toolData) {
      if (pendingInvocation) {
        pendingInvocation.presentation = ToolInvocationPresentation.Hidden;
        pendingInvocation.cancelFromStreaming(ToolConfirmKind.Denied, reason);
      } else if (request) {
        const cancelledInvocation = ChatToolInvocation.createCancelled(
          { toolCallId: dto.callId, toolId: dto.toolId, toolData, subagentInvocationId: dto.subAgentInvocationId, chatRequestId: dto.chatRequestId },
          dto.parameters,
          ToolConfirmKind.Denied,
          reason
        );
        cancelledInvocation.presentation = ToolInvocationPresentation.Hidden;
        this._chatService.appendProgress(request, cancelledInvocation);
      }
    }
    return {
      content: [{ kind: "text", value: `Tool execution denied: ${hookReason}` }],
      toolResultError: hookReason
    };
  }
  /**
   * Validate updatedInput from a preToolUse hook against the tool's input schema
   * using the json.validate command from the JSON extension.
   * @returns An error message string if validation fails, or undefined if valid.
   */
  async _validateUpdatedInput(toolId, toolData, updatedInput) {
    if (!toolData?.inputSchema) {
      return void 0;
    }
    try {
      const schemaUri = createToolSchemaUri(toolId);
      const inputJson = JSON.stringify(updatedInput);
      const diagnostics = await this._commandService.executeCommand("json.validate", schemaUri, inputJson) || [];
      if (diagnostics.length > 0) {
        return diagnostics.map((d) => d.message).join("; ");
      }
    } catch (e) {
      this._logService.debug(`[LanguageModelToolsService#_validateUpdatedInput] json.validate command failed, skipping validation: ${toErrorMessage(e)}`);
    }
    return void 0;
  }
  async invokeTool(dto, countTokens, token) {
    this._logService.trace(`[LanguageModelToolsService#invokeTool] Invoking tool ${dto.toolId} with parameters ${JSON.stringify(dto.parameters)}`);
    const toolData = this._tools.get(dto.toolId)?.data;
    let model;
    let request;
    if (dto.context?.sessionResource) {
      model = this._chatService.getSession(dto.context.sessionResource);
      request = model?.getRequests().at(-1);
      if (request?.response?.isCanceled || request?.response?.isComplete) {
        this._logService.debug(`[LanguageModelToolsService#invokeTool] Ignoring tool ${dto.toolId} for cancelled/complete request ${request.id}`);
        throw new CancellationError();
      }
      if (model?.workingDirectory && !dto.context.workingDirectory) {
        dto = { ...dto, context: { ...dto.context, workingDirectory: model.workingDirectory } };
      }
    }
    let pendingToolCallKey;
    let toolInvocation;
    if (this._pendingToolCalls.has(dto.callId)) {
      pendingToolCallKey = dto.callId;
      toolInvocation = this._pendingToolCalls.get(dto.callId);
    } else if (dto.chatStreamToolCallId && this._pendingToolCalls.has(dto.chatStreamToolCallId)) {
      pendingToolCallKey = dto.chatStreamToolCallId;
      toolInvocation = this._pendingToolCalls.get(dto.chatStreamToolCallId);
    }
    let requestId;
    let store;
    if (dto.context && request) {
      requestId = request.id;
      store = new DisposableStore();
      if (!this._callsByRequestId.has(requestId)) {
        this._callsByRequestId.set(requestId, []);
      }
      const trackedCall = { store };
      this._callsByRequestId.get(requestId).push(trackedCall);
      const source = new CancellationTokenSource();
      store.add(toDisposable(() => {
        source.dispose(true);
      }));
      store.add(token.onCancellationRequested((() => {
        IChatToolInvocation.confirmWith(toolInvocation, { type: ToolConfirmKind.Denied });
        source.cancel();
      })));
      store.add(source.token.onCancellationRequested(() => {
        IChatToolInvocation.confirmWith(toolInvocation, { type: ToolConfirmKind.Denied });
      }));
      token = source.token;
    }
    const preToolUseHookResult = dto.preToolUseResult;
    if (preToolUseHookResult?.permissionDecision === "deny") {
      const denialResult = this._handlePreToolUseDenial(dto, preToolUseHookResult, toolData, toolInvocation, request);
      if (pendingToolCallKey) {
        this._pendingToolCalls.delete(pendingToolCallKey);
      }
      return denialResult;
    }
    if (preToolUseHookResult?.updatedInput) {
      const validationError = await this._validateUpdatedInput(dto.toolId, toolData, preToolUseHookResult.updatedInput);
      if (validationError) {
        this._logService.warn(`[LanguageModelToolsService#invokeTool] Tool ${dto.toolId} updatedInput from preToolUse hook failed schema validation: ${validationError}`);
      } else {
        this._logService.debug(`[LanguageModelToolsService#invokeTool] Tool ${dto.toolId} input modified by preToolUse hook`);
        dto.parameters = preToolUseHookResult.updatedInput;
      }
    }
    this._onDidInvokeTool.fire({
      toolId: dto.toolId,
      sessionResource: dto.context?.sessionResource,
      requestId: dto.chatRequestId,
      subagentInvocationId: dto.subAgentInvocationId
    });
    let tool = this._tools.get(dto.toolId);
    if (!tool) {
      throw new Error(`Tool ${dto.toolId} was not contributed`);
    }
    if (!tool.impl) {
      await this._extensionService.activateByEvent(`onLanguageModelTool:${dto.toolId}`);
      tool = this._tools.get(dto.toolId);
      if (!tool?.impl) {
        throw new Error(`Tool ${dto.toolId} does not have an implementation registered.`);
      }
    }
    const hadPendingInvocation = !!toolInvocation;
    if (hadPendingInvocation && pendingToolCallKey) {
      this._pendingToolCalls.delete(pendingToolCallKey);
    }
    let toolResult;
    let prepareTimeWatch;
    let invocationTimeWatch;
    let preparedInvocation;
    try {
      if (dto.context) {
        if (!model) {
          throw new Error(`Tool called for unknown chat session`);
        }
        if (!request) {
          throw new Error(`Tool called for unknown chat request`);
        }
        dto.modelId = request.modelId;
        dto.userSelectedTools = request.userSelectedTools && { ...request.userSelectedTools };
        prepareTimeWatch = StopWatch.create(true);
        preparedInvocation = await this.prepareToolInvocationWithHookResult(tool, dto, preToolUseHookResult, token);
        prepareTimeWatch.stop();
        const { autoConfirmed: resolvedAutoConfirmed, preparedInvocation: updatedPreparedInvocation } = await this.resolveAutoConfirmFromHook(preToolUseHookResult, tool, dto, preparedInvocation, dto.context?.sessionResource);
        preparedInvocation = updatedPreparedInvocation;
        const preResolvedAutoConfirmed = resolvedAutoConfirmed ?? (preToolUseHookResult?.permissionDecision === "ask" ? void 0 : dto.preApproved);
        const { autoConfirmed, skipExplanation: riskSkipExplanation } = await this._maybeApplyAutopilotRiskGate(tool, dto, preparedInvocation, preResolvedAutoConfirmed, token);
        if (hadPendingInvocation && toolInvocation) {
          if (toolInvocation.state.get().type === IChatToolInvocation.StateKind.Streaming) {
            toolInvocation.transitionFromStreaming(preparedInvocation, dto.parameters, autoConfirmed);
          } else {
            toolInvocation.updatePreparedInvocation(preparedInvocation, dto.parameters);
          }
        } else {
          toolInvocation = new ChatToolInvocation(preparedInvocation, tool.data, dto.chatStreamToolCallId ?? dto.callId, dto.subAgentInvocationId, dto.parameters);
          if (autoConfirmed) {
            IChatToolInvocation.confirmWith(toolInvocation, autoConfirmed);
          }
          this._chatService.appendProgress(request, toolInvocation);
        }
        dto.toolSpecificData = toolInvocation?.toolSpecificData;
        if (riskSkipExplanation) {
          this._logToolApprovalTelemetry(tool, dto, { type: ToolConfirmKind.Skipped });
          this._chatService.appendProgress(request, {
            kind: "info",
            content: new MarkdownString(localize("autopilotRiskSkipped", 'Autopilot skipped "{0}" because it was assessed as high-risk: {1}', tool.data.displayName, riskSkipExplanation))
          });
          toolResult = {
            content: [{
              kind: "text",
              value: `Autopilot skipped this tool call because it was automatically assessed as high-risk: ${riskSkipExplanation} The action was not performed. Do not retry it as-is \u2014 choose a safer approach or leave it for the user to run manually.`
            }]
          };
          return toolResult;
        }
        if (preparedInvocation?.confirmationMessages?.title) {
          if (!IChatToolInvocation.executionConfirmedOrDenied(toolInvocation) && !autoConfirmed) {
            this.playAccessibilitySignal([toolInvocation], dto.context?.sessionResource);
          }
          const userConfirmed = await IChatToolInvocation.awaitConfirmation(toolInvocation, token);
          this._logToolApprovalTelemetry(tool, dto, userConfirmed);
          if (userConfirmed.type === ToolConfirmKind.Denied) {
            throw new CancellationError();
          }
          if (userConfirmed.type === ToolConfirmKind.Skipped) {
            toolResult = {
              content: [{
                kind: "text",
                value: "The user chose to skip the tool call, they want to proceed without running it"
              }]
            };
            return toolResult;
          }
          if (userConfirmed.type === ToolConfirmKind.UserAction && userConfirmed.selectedButton) {
            dto.selectedCustomButton = userConfirmed.selectedButton;
          }
          if (dto.toolSpecificData?.kind === "input") {
            dto.parameters = dto.toolSpecificData.rawInput;
            dto.toolSpecificData = void 0;
          }
        } else {
          this._logToolApprovalTelemetry(tool, dto, autoConfirmed ?? { type: ToolConfirmKind.ConfirmationNotNeeded });
        }
      } else {
        prepareTimeWatch = StopWatch.create(true);
        preparedInvocation = await this.prepareToolInvocationWithHookResult(tool, dto, preToolUseHookResult, token);
        prepareTimeWatch.stop();
        const { autoConfirmed: fallbackAutoConfirmed, preparedInvocation: updatedPreparedInvocation } = await this.resolveAutoConfirmFromHook(preToolUseHookResult, tool, dto, preparedInvocation, void 0);
        preparedInvocation = updatedPreparedInvocation;
        const autoConfirmed = fallbackAutoConfirmed ?? (preToolUseHookResult?.permissionDecision === "ask" ? void 0 : dto.preApproved);
        if (preparedInvocation?.confirmationMessages?.title && !autoConfirmed) {
          const result = await this._dialogService.confirm({ message: renderAsPlaintext(preparedInvocation.confirmationMessages.title), detail: renderAsPlaintext(preparedInvocation.confirmationMessages.message) });
          if (!result.confirmed) {
            throw new CancellationError();
          }
        }
        dto.toolSpecificData = preparedInvocation?.toolSpecificData;
      }
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      invocationTimeWatch = StopWatch.create(true);
      toolResult = await tool.impl.invoke(dto, countTokens, {
        report: (step) => {
          toolInvocation?.acceptProgress(step);
        }
      }, token);
      invocationTimeWatch.stop();
      const compressed = this._toolResultCompressor.maybeCompress(tool.data.id, dto.parameters, toolResult);
      if (compressed) {
        toolResult = compressed;
      }
      this.ensureToolDetails(dto, toolResult, tool.data, toolInvocation);
      const afterExecuteState = await toolInvocation?.didExecuteTool(toolResult, void 0, () => this.shouldAutoConfirmPostExecution(tool.data.id, tool.data.runsInWorkspace, tool.data.source, dto.parameters, dto.context?.sessionResource, dto.chatRequestId, dto.context?.workingDirectory));
      if (toolInvocation && afterExecuteState?.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
        const postConfirm = await IChatToolInvocation.awaitPostConfirmation(toolInvocation, token);
        if (postConfirm.type === ToolConfirmKind.Denied) {
          throw new CancellationError();
        }
        if (postConfirm.type === ToolConfirmKind.Skipped) {
          toolResult = {
            content: [{
              kind: "text",
              value: "The tool executed but the user chose not to share the results"
            }]
          };
        }
      }
      this._telemetryService.publicLog2(
        "languageModelToolInvoked",
        {
          result: "success",
          chatSessionId: dto.context?.sessionResource ? chatSessionResourceToId(dto.context.sessionResource) : void 0,
          toolId: tool.data.id,
          toolExtensionId: tool.data.source.type === "extension" ? tool.data.source.extensionId.value : void 0,
          toolSourceKind: tool.data.source.type,
          prepareTimeMs: prepareTimeWatch?.elapsed(),
          invocationTimeMs: invocationTimeWatch?.elapsed()
        }
      );
      return toolResult;
    } catch (err) {
      const result = isCancellationError(err) ? "userCancelled" : "error";
      this._telemetryService.publicLog2(
        "languageModelToolInvoked",
        {
          result,
          chatSessionId: dto.context?.sessionResource ? chatSessionResourceToId(dto.context.sessionResource) : void 0,
          toolId: tool.data.id,
          toolExtensionId: tool.data.source.type === "extension" ? tool.data.source.extensionId.value : void 0,
          toolSourceKind: tool.data.source.type,
          prepareTimeMs: prepareTimeWatch?.elapsed(),
          invocationTimeMs: invocationTimeWatch?.elapsed()
        }
      );
      if (!isCancellationError(err)) {
        this._logService.error(`[LanguageModelToolsService#invokeTool] Error from tool ${dto.toolId} with parameters ${JSON.stringify(dto.parameters)}:
${toErrorMessage(err, true)}`);
      }
      toolResult ??= { content: [] };
      toolResult.toolResultError = err instanceof Error ? err.message : String(err);
      if (tool.data.alwaysDisplayInputOutput) {
        toolResult.toolResultDetails = { input: this.formatToolInput(dto), output: [{ type: "embed", isText: true, value: String(err) }], isError: true };
      }
      throw err;
    } finally {
      toolInvocation?.didExecuteTool(toolResult, true);
      if (store) {
        this.cleanupCallDisposables(requestId, store);
      }
    }
  }
  async prepareToolInvocationWithHookResult(tool, dto, hookResult, token) {
    let forceConfirmationReason;
    if (hookResult?.permissionDecision === "ask") {
      const hookMessage = localize("preToolUseHookRequiredConfirmation", "{0} required confirmation", HookType.PreToolUse);
      forceConfirmationReason = hookResult.permissionDecisionReason ? `${hookMessage}: ${hookResult.permissionDecisionReason}` : hookMessage;
    }
    return this.prepareToolInvocation(tool, dto, forceConfirmationReason, token);
  }
  _logToolApprovalTelemetry(tool, dto, reason) {
    const confirmKindNames = {
      [ToolConfirmKind.Denied]: "denied",
      [ToolConfirmKind.ConfirmationNotNeeded]: "confirmationNotNeeded",
      [ToolConfirmKind.Setting]: "setting",
      [ToolConfirmKind.LmServicePerTool]: "lmServicePerTool",
      [ToolConfirmKind.UserAction]: "userAction",
      [ToolConfirmKind.Skipped]: "skipped"
    };
    const allowedConfirmationNotNeededReasons = /* @__PURE__ */ new Set([autoApproveAllReason, "inlineChat"]);
    let confirmationNotNeededReason;
    if (reason.type === ToolConfirmKind.ConfirmationNotNeeded && reason.reason) {
      const raw = typeof reason.reason === "string" ? reason.reason : reason.reason.value;
      confirmationNotNeededReason = allowedConfirmationNotNeededReasons.has(raw) ? raw : "other";
    }
    const terminalData = dto.toolSpecificData?.kind === "terminal" ? dto.toolSpecificData : void 0;
    this._telemetryService.publicLog2(
      "chat.toolApproval",
      {
        confirmKind: confirmKindNames[reason.type],
        requestId: dto.chatRequestId,
        settingId: reason.type === ToolConfirmKind.Setting ? reason.id : void 0,
        lmServiceScope: reason.type === ToolConfirmKind.LmServicePerTool ? reason.scope : void 0,
        customButtonKind: reason.type === ToolConfirmKind.UserAction ? reason.selectedButtonKind : void 0,
        confirmationNotNeededReason,
        sandboxWrapped: terminalData?.commandLine.isSandboxWrapped,
        requestUnsandboxedExecution: terminalData?.requestUnsandboxedExecution,
        chatSessionId: dto.context?.sessionResource ? chatSessionResourceToId(dto.context.sessionResource) : void 0,
        toolId: tool.data.id,
        toolExtensionId: tool.data.source.type === "extension" ? tool.data.source.extensionId.value : void 0,
        toolSourceKind: tool.data.source.type
      }
    );
  }
  /**
   * Determines the auto-confirm decision based on a preToolUse hook result.
   * If the hook returned 'allow', auto-approves. If 'ask', forces confirmation
   * and ensures confirmation messages exist on `preparedInvocation`. Otherwise
   * falls back to normal auto-confirm logic.
   *
   * Returns the possibly-updated preparedInvocation along with the auto-confirm decision,
   * since when the hook returns 'ask' and preparedInvocation was undefined, we create one.
   */
  async resolveAutoConfirmFromHook(hookResult, tool, dto, preparedInvocation, sessionResource) {
    if (hookResult?.permissionDecision === "allow") {
      this._logService.debug(`[LanguageModelToolsService#invokeTool] Tool ${dto.toolId} auto-approved by preToolUse hook`);
      return { autoConfirmed: { type: ToolConfirmKind.ConfirmationNotNeeded, reason: localize("hookAllowed", "Allowed by hook") }, preparedInvocation };
    }
    if (hookResult?.permissionDecision === "ask") {
      this._logService.debug(`[LanguageModelToolsService#invokeTool] Tool ${dto.toolId} requires confirmation (preToolUse hook returned 'ask')`);
      if (!preparedInvocation?.confirmationMessages?.title) {
        if (!preparedInvocation) {
          preparedInvocation = {};
        }
        const fullReferenceName = getToolFullReferenceName(tool.data);
        const hookReason = hookResult.permissionDecisionReason;
        const hookNote = hookReason ? localize("hookRequiresConfirmation.messageWithReason", "{0} hook required confirmation: {1}", HookType.PreToolUse, hookReason) : localize("hookRequiresConfirmation.message", "{0} hook required confirmation", HookType.PreToolUse);
        preparedInvocation.confirmationMessages = {
          ...preparedInvocation.confirmationMessages,
          title: localize("hookRequiresConfirmation.title", "Use the '{0}' tool?", fullReferenceName),
          message: new MarkdownString(`_${hookNote}_`),
          allowAutoConfirm: false
        };
        preparedInvocation.toolSpecificData = {
          kind: "input",
          rawInput: dto.parameters
        };
      } else {
        const hookReason = hookResult.permissionDecisionReason;
        const hookNote = hookReason ? localize("hookRequiresConfirmation.note", "{0} hook required confirmation: {1}", HookType.PreToolUse, hookReason) : localize("hookRequiresConfirmation.noteNoReason", "{0} hook required confirmation", HookType.PreToolUse);
        const existing = preparedInvocation.confirmationMessages;
        if (preparedInvocation.toolSpecificData?.kind === "terminal") {
          const existingDisclaimerText = existing.disclaimer ? typeof existing.disclaimer === "string" ? existing.disclaimer : existing.disclaimer.value : void 0;
          const combinedDisclaimer = existingDisclaimerText ? `${hookNote}

${existingDisclaimerText}` : hookNote;
          preparedInvocation.confirmationMessages = {
            ...existing,
            disclaimer: combinedDisclaimer,
            allowAutoConfirm: false
          };
        } else {
          const msgText = typeof existing.message === "string" ? existing.message : existing.message?.value ?? "";
          preparedInvocation.confirmationMessages = {
            ...existing,
            message: new MarkdownString(`_${hookNote}_

${msgText}`),
            allowAutoConfirm: false
          };
        }
      }
      return { autoConfirmed: void 0, preparedInvocation };
    }
    const approveCombination = preparedInvocation?.confirmationMessages?.approveCombination;
    let combination;
    if (approveCombination) {
      combination = {
        label: typeof approveCombination.label === "string" ? approveCombination.label : approveCombination.label.value,
        key: approveCombination.key
      };
    }
    const autoConfirmed = await this.shouldAutoConfirm(tool.data.id, tool.data.runsInWorkspace, tool.data.source, dto.parameters, sessionResource, dto.chatRequestId, combination, dto.context?.workingDirectory);
    return { autoConfirmed, preparedInvocation };
  }
  /**
   * In Autopilot, runs the risk classifier on an auto-approved call and skips it when the rating
   * is {@link ToolRiskLevel.Red}. Any other result returns the original auto-confirmation
   * unchanged.
   *
   * To keep the classifier off the hot path, it only runs when all of these hold:
   * - the call was auto-approved by the session approving everything, or is a `run_in_terminal` /
   *   fetch call that self-approved (these can run risky commands or prompt-injected URLs without
   *   ever showing a confirmation);
   * - it would otherwise show a confirmation (the self-approving tools above are the exception);
   * - the session is a local panel session at the Autopilot level with Advanced Autopilot on.
   *
   * This is independent of `chat.tools.riskAssessment.enabled`, which only controls the
   * confirmation risk badge. CLI and agent-host sessions handle their own confirmations and are
   * excluded.
   *
   * Fails open: a cancelled, unavailable, or failed assessment keeps the original
   * auto-confirmation so Autopilot keeps moving.
   */
  async _maybeApplyAutopilotRiskGate(tool, dto, preparedInvocation, autoConfirmed, token) {
    const isTerminalTool = tool.data.id === TerminalToolId.RunInTerminal;
    const isFetchTool = fetchWebPageToolIds.has(tool.data.id);
    const isAlwaysClassifyTool = isTerminalTool || isFetchTool;
    const isBlanketSessionApprove = autoConfirmed?.type === ToolConfirmKind.ConfirmationNotNeeded && autoConfirmed.reason === autoApproveAllReason;
    const isSelfApprovedAlwaysClassify = isAlwaysClassifyTool && autoConfirmed === void 0 && !preparedInvocation?.confirmationMessages?.title;
    if (!isBlanketSessionApprove && !isSelfApprovedAlwaysClassify) {
      return { autoConfirmed };
    }
    if (!isAlwaysClassifyTool && !preparedInvocation?.confirmationMessages?.title) {
      return { autoConfirmed };
    }
    if (this._configurationService.getValue(ChatConfiguration.AutopilotAdvancedEnabled) !== true) {
      return { autoConfirmed };
    }
    const sessionResource = dto.context?.sessionResource;
    if (!sessionResource || getChatSessionType(sessionResource) !== localChatSessionType) {
      return { autoConfirmed };
    }
    if (!this._isSessionInAutopilotLevel(sessionResource)) {
      return { autoConfirmed };
    }
    try {
      const assessment = await this._riskAssessmentService.assess(tool.data, dto.parameters, token, void 0, { ignoreEnablement: true });
      if (token.isCancellationRequested) {
        return { autoConfirmed };
      }
      if (assessment?.risk === ToolRiskLevel.Red) {
        const fallbackExplanation = localize("autopilotRiskSkipFallback", "The action was assessed as potentially destructive or irreversible.");
        const explanation = assessment.explanation.trim() || fallbackExplanation;
        this._logService.info(`[LanguageModelToolsService#invokeTool] Autopilot skipping high-risk tool ${tool.data.id}: ${explanation}`);
        return { autoConfirmed: { type: ToolConfirmKind.Skipped }, skipExplanation: explanation };
      }
    } catch (err) {
      this._logService.warn(`[LanguageModelToolsService#invokeTool] Autopilot risk assessment failed for tool ${tool.data.id}, allowing: ${toErrorMessage(err)}`);
    }
    return { autoConfirmed };
  }
  async prepareToolInvocation(tool, dto, forceConfirmationReason, token) {
    let prepared;
    if (tool.impl.prepareToolInvocation) {
      const preparePromise = tool.impl.prepareToolInvocation({
        parameters: dto.parameters,
        toolCallId: dto.callId,
        chatRequestId: dto.chatRequestId,
        chatSessionResource: dto.context?.sessionResource,
        chatInteractionId: dto.chatInteractionId,
        modelId: dto.modelId,
        forceConfirmationReason,
        workingDirectory: dto.context?.workingDirectory
      }, token);
      const raceResult = await Promise.race([
        timeout(3e3, token).then(() => "timeout"),
        preparePromise
      ]);
      if (raceResult === "timeout" && dto.context) {
        this._onDidPrepareToolCallBecomeUnresponsive.fire({
          sessionResource: dto.context.sessionResource,
          toolData: tool.data
        });
      }
      prepared = await preparePromise;
    }
    const isEligibleForAutoApproval = this.isToolEligibleForAutoApproval(tool.data);
    if (!isEligibleForAutoApproval && !prepared?.confirmationMessages?.title) {
      if (!prepared) {
        prepared = {};
      }
      const fullReferenceName = getToolFullReferenceName(tool.data);
      prepared.confirmationMessages = {
        ...prepared.confirmationMessages,
        title: localize("defaultToolConfirmation.title", "Confirm tool execution"),
        message: localize("defaultToolConfirmation.message", "Run the '{0}' tool?", fullReferenceName),
        disclaimer: toolIdsThatCannotBeAutoApproved.has(tool.data.id) ? void 0 : new MarkdownString(localize("defaultToolConfirmation.disclaimer", "Auto approval for '{0}' is restricted via {1}.", getToolFullReferenceName(tool.data), createMarkdownCommandLink({ text: "`" + ChatConfiguration.EligibleForAutoApproval + "`", id: "workbench.action.openSettings", arguments: [ChatConfiguration.EligibleForAutoApproval], tooltip: localize("openSettings.autoApproval.tooltip", "Open settings to configure auto-approval") }, false)), { isTrusted: true }),
        allowAutoConfirm: false
      };
    }
    if (!isEligibleForAutoApproval && prepared?.confirmationMessages?.title) {
      prepared.confirmationMessages.disclaimer = toolIdsThatCannotBeAutoApproved.has(tool.data.id) ? void 0 : new MarkdownString(localize("defaultToolConfirmation.disclaimer", "Auto approval for '{0}' is restricted via {1}.", getToolFullReferenceName(tool.data), createMarkdownCommandLink({ text: "`" + ChatConfiguration.EligibleForAutoApproval + "`", id: "workbench.action.openSettings", arguments: [ChatConfiguration.EligibleForAutoApproval], tooltip: localize("openSettings.autoApproval.tooltip", "Open settings to configure auto-approval") }, false)), { isTrusted: true });
    }
    if (prepared?.confirmationMessages?.title) {
      if (prepared.toolSpecificData?.kind !== "terminal" && prepared.confirmationMessages.allowAutoConfirm !== false) {
        prepared.confirmationMessages.allowAutoConfirm = isEligibleForAutoApproval;
      }
      if (!prepared.toolSpecificData && tool.data.alwaysDisplayInputOutput) {
        prepared.toolSpecificData = {
          kind: "input",
          rawInput: dto.parameters
        };
      }
    }
    return prepared;
  }
  beginToolCall(options) {
    const toolEntry = this._tools.get(options.toolId);
    if (!toolEntry) {
      return void 0;
    }
    if (!options.force && !toolEntry.impl?.handleToolStream) {
      return void 0;
    }
    const invocation = ChatToolInvocation.createStreaming({
      toolCallId: options.toolCallId,
      toolId: options.toolId,
      toolData: toolEntry.data,
      subagentInvocationId: options.subagentInvocationId,
      chatRequestId: options.chatRequestId
    });
    this._pendingToolCalls.set(options.toolCallId, invocation);
    if (options.sessionResource) {
      const model = this._chatService.getSession(options.sessionResource);
      if (model) {
        const request = (options.chatRequestId ? model.getRequests().find((r) => r.id === options.chatRequestId) : void 0) ?? model.getRequests().at(-1);
        if (request) {
          this._chatService.appendProgress(request, invocation);
        }
      }
    }
    this._callHandleToolStream(toolEntry, invocation, options.toolCallId, void 0, CancellationToken.None);
    return invocation;
  }
  async _callHandleToolStream(toolEntry, invocation, toolCallId, rawInput, token) {
    if (!toolEntry.impl?.handleToolStream) {
      return;
    }
    try {
      const result = await toolEntry.impl.handleToolStream({
        toolCallId,
        rawInput,
        chatRequestId: invocation.chatRequestId
      }, token);
      if (result?.invocationMessage) {
        invocation.updateStreamingMessage(result.invocationMessage);
      }
    } catch (error) {
      this._logService.error(`[LanguageModelToolsService#_callHandleToolStream] Error calling handleToolStream for tool ${toolEntry.data.id}:`, error);
    }
  }
  async updateToolStream(toolCallId, partialInput, token) {
    const invocation = this._pendingToolCalls.get(toolCallId);
    if (!invocation) {
      return;
    }
    invocation.updatePartialInput(partialInput);
    const toolEntry = this._tools.get(invocation.toolId);
    if (toolEntry) {
      await this._callHandleToolStream(toolEntry, invocation, toolCallId, partialInput, token);
    }
  }
  playAccessibilitySignal(toolInvocations, chatSessionResource) {
    const autoApproved = this._configurationService.getValue(ChatConfiguration.GlobalAutoApprove);
    if (autoApproved) {
      return;
    }
    if (chatSessionResource) {
      const model = this._chatService.getSession(chatSessionResource);
      const request = model?.getRequests().at(-1);
      if (isAutoApproveLevel(request?.modeInfo?.permissionLevel) || this._isSessionLiveAutoApproveLevel(chatSessionResource)) {
        return;
      }
    }
    const pendingInvocations = toolInvocations.filter((inv) => !IChatToolInvocation.executionConfirmedOrDenied(inv));
    if (pendingInvocations.length === 0) {
      return;
    }
    const setting = this._configurationService.getValue(AccessibilitySignal.chatUserActionRequired.settingsKey);
    if (!setting) {
      return;
    }
    const soundEnabled = setting.sound === "on" || setting.sound === "auto" && this._accessibilityService.isScreenReaderOptimized();
    const announcementEnabled = this._accessibilityService.isScreenReaderOptimized() && setting.announcement === "auto";
    if (soundEnabled || announcementEnabled) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.chatUserActionRequired, { customAlertMessage: this._instantiationService.invokeFunction(getToolConfirmationAlert, pendingInvocations), userGesture: true, modality: !soundEnabled ? "announcement" : void 0 });
    }
  }
  ensureToolDetails(dto, toolResult, toolData, toolInvocation) {
    if (!toolResult.toolResultDetails && (toolData.alwaysDisplayInputOutput || this.toolResultHasImages(toolResult) && !this.toolResultMessageHasImageFileWidgets(toolResult, toolInvocation))) {
      toolResult.toolResultDetails = {
        input: this.formatToolInput(dto),
        output: this.toolResultToIO(toolResult)
      };
    }
  }
  toolResultHasImages(toolResult) {
    return toolResult.content.some((part) => part.kind === "data" && part.value.mimeType?.startsWith("image/"));
  }
  /**
   * Returns true if the tool result message (or falling back to the tool invocation's
   * pastTenseMessage from streaming) contains empty markdown links pointing to image
   * files (the `[](imageUri)` pattern) that will be rendered as file pills by renderFileWidgets.
   */
  toolResultMessageHasImageFileWidgets(toolResult, toolInvocation) {
    const message = toolResult.toolResultMessage ?? toolInvocation?.pastTenseMessage;
    if (!message) {
      return false;
    }
    const value = typeof message === "string" ? message : message.value;
    const linkPattern = /\[\s*\]\((?<uri>[^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(value)) !== null) {
      try {
        const parsed = URI.parse(match.groups.uri);
        const mime = getMediaMime(parsed.path);
        if (mime?.startsWith("image/")) {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  formatToolInput(dto) {
    return JSON.stringify(dto.parameters, void 0, 2);
  }
  toolResultToIO(toolResult) {
    return toolResult.content.map((part) => {
      if (part.kind === "text") {
        return { type: "embed", isText: true, value: part.value };
      } else if (part.kind === "promptTsx") {
        return { type: "embed", isText: true, value: stringifyPromptTsxPart(part) };
      } else if (part.kind === "data") {
        return { type: "embed", value: encodeBase64(part.value.data), mimeType: part.value.mimeType };
      } else {
        assertNever(part);
      }
    });
  }
  /**
   * Returns true if enterprise policy has explicitly disabled the global auto-approve setting.
   * When this is the case, Bypass Approvals and Autopilot permission levels should not auto-approve tools.
   */
  _isAutoApprovePolicyRestricted() {
    const inspected = this._configurationService.inspect(ChatConfiguration.GlobalAutoApprove);
    return inspected.policyValue === false;
  }
  /**
   * Returns true if the session's current (live) permission picker level is auto-approve.
   * This checks the widget's current state, not what was stamped on the request,
   * so switching to Autopilot mid-session takes effect immediately.
   */
  _isSessionLiveAutoApproveLevel(chatSessionResource) {
    const widget = this._chatWidgetService.getWidgetBySessionResource(chatSessionResource) ?? this._chatWidgetService.lastFocusedWidget;
    return !!widget && isAutoApproveLevel(widget.input.currentModeInfo.permissionLevel);
  }
  /**
   * True if the session is in an auto-approve level (Auto-Approve / Autopilot),
   * via either the last request's stamped level or the live picker level.
   */
  _isSessionInAutoApproveLevel(chatSessionResource) {
    if (!chatSessionResource) {
      return false;
    }
    const model = this._chatService.getSession(chatSessionResource);
    const request = model?.getRequests().at(-1);
    return isAutoApproveLevel(request?.modeInfo?.permissionLevel) || this._isSessionLiveAutoApproveLevel(chatSessionResource);
  }
  /**
   * True if the session's live permission picker level is Autopilot. Like
   * {@link _isSessionLiveAutoApproveLevel}, but excludes plain Auto-Approve.
   */
  _isSessionLiveAutopilotLevel(chatSessionResource) {
    const widget = this._chatWidgetService.getWidgetBySessionResource(chatSessionResource) ?? this._chatWidgetService.lastFocusedWidget;
    return !!widget && isAutopilotLevel(widget.input.currentModeInfo.permissionLevel);
  }
  /**
   * True if the session is at the Autopilot level (not plain Auto-Approve), via either the last
   * request's stamped level or the live picker level.
   */
  _isSessionInAutopilotLevel(chatSessionResource) {
    if (!chatSessionResource) {
      return false;
    }
    const model = this._chatService.getSession(chatSessionResource);
    const request = model?.getRequests().at(-1);
    return isAutopilotLevel(request?.modeInfo?.permissionLevel) || this._isSessionLiveAutopilotLevel(chatSessionResource);
  }
  getEligibleForAutoApprovalSpecialCase(toolData) {
    if (toolData.id === "vscode_fetchWebPage_internal") {
      return "fetch";
    }
    return void 0;
  }
  isToolEligibleForAutoApproval(toolData) {
    const fullReferenceName = this.getEligibleForAutoApprovalSpecialCase(toolData) ?? getToolFullReferenceName(toolData);
    if (toolData.id === "copilot_fetchWebPage") {
      return true;
    }
    if (toolIdsThatCannotBeAutoApproved.has(toolData.id)) {
      return false;
    }
    const eligibilityConfig = this._configurationService.getValue(ChatConfiguration.EligibleForAutoApproval);
    if (eligibilityConfig && typeof eligibilityConfig === "object" && fullReferenceName) {
      if (Object.prototype.hasOwnProperty.call(eligibilityConfig, fullReferenceName)) {
        return eligibilityConfig[fullReferenceName];
      }
      if (toolData.legacyToolReferenceFullNames) {
        for (const legacyName of toolData.legacyToolReferenceFullNames) {
          if (Object.prototype.hasOwnProperty.call(eligibilityConfig, legacyName)) {
            return eligibilityConfig[legacyName];
          }
          if (legacyName.includes("/")) {
            const trimmedLegacyName = legacyName.split("/").pop();
            if (trimmedLegacyName && Object.prototype.hasOwnProperty.call(eligibilityConfig, trimmedLegacyName)) {
              return eligibilityConfig[trimmedLegacyName];
            }
          }
        }
      }
    }
    return true;
  }
  async shouldAutoConfirm(toolId, runsInWorkspace, source, parameters, chatSessionResource, chatRequestId, combination, workingDirectory) {
    const tool = this._tools.get(toolId);
    if (!tool) {
      return void 0;
    }
    if (chatSessionResource && !this._isAutoApprovePolicyRestricted() && this._isSessionInAutoApproveLevel(chatSessionResource)) {
      if (!(toolIdsThatCannotBeAutoApproved.has(tool.data.id) && getChatSessionType(chatSessionResource) !== localChatSessionType)) {
        return { type: ToolConfirmKind.ConfirmationNotNeeded, reason: autoApproveAllReason };
      }
    }
    if (!this.isToolEligibleForAutoApproval(tool.data)) {
      return void 0;
    }
    const reason = this._confirmationService.getPreConfirmAction({ toolId, source, parameters, chatSessionResource, workingDirectory, combination });
    if (reason) {
      return reason;
    }
    const config = this._configurationService.inspect(ChatConfiguration.GlobalAutoApprove);
    let value = config.value ?? config.defaultValue;
    if (typeof runsInWorkspace === "boolean") {
      value = config.userLocalValue ?? config.applicationValue;
      if (runsInWorkspace) {
        value = config.workspaceValue ?? config.workspaceFolderValue ?? config.userRemoteValue ?? value;
      }
    }
    const autoConfirm = value === true || typeof value === "object" && value.hasOwnProperty(toolId) && value[toolId] === true;
    if (autoConfirm) {
      if (await this._checkGlobalAutoApprove()) {
        return { type: ToolConfirmKind.Setting, id: ChatConfiguration.GlobalAutoApprove };
      }
    }
    return void 0;
  }
  async shouldAutoConfirmPostExecution(toolId, runsInWorkspace, source, parameters, chatSessionResource, chatRequestId, workingDirectory) {
    const sessionAutoApprove = chatSessionResource && !this._isAutoApprovePolicyRestricted() && this._isSessionInAutoApproveLevel(chatSessionResource);
    if (sessionAutoApprove) {
      if (!(toolIdsThatCannotBeAutoApproved.has(toolId) && getChatSessionType(chatSessionResource) !== localChatSessionType)) {
        return { type: ToolConfirmKind.ConfirmationNotNeeded, reason: autoApproveAllReason };
      }
    }
    if (this._configurationService.getValue(ChatConfiguration.GlobalAutoApprove) && !sessionAutoApprove && await this._checkGlobalAutoApprove()) {
      return { type: ToolConfirmKind.Setting, id: ChatConfiguration.GlobalAutoApprove };
    }
    return this._confirmationService.getPostConfirmAction({ toolId, source, parameters, chatSessionResource, workingDirectory });
  }
  async _checkGlobalAutoApprove() {
    const optedIn = this._storageService.getBoolean("chat.tools.global.autoApprove.optIn" /* GlobalAutoApproveOptIn */, StorageScope.APPLICATION, false);
    if (optedIn) {
      return true;
    }
    if (this._contextKeyService.getContextKeyValue(SkipAutoApproveConfirmationKey) === true) {
      return true;
    }
    if (this._pendingGlobalAutoApproveCheck) {
      return this._pendingGlobalAutoApproveCheck;
    }
    this._pendingGlobalAutoApproveCheck = this._doCheckGlobalAutoApprove();
    try {
      return await this._pendingGlobalAutoApproveCheck;
    } finally {
      this._pendingGlobalAutoApproveCheck = void 0;
    }
  }
  async _doCheckGlobalAutoApprove() {
    const store = new DisposableStore();
    try {
      const cts = new CancellationTokenSource();
      store.add(cts);
      store.add(this._storageService.onDidChangeValue(StorageScope.APPLICATION, "chat.tools.global.autoApprove.optIn" /* GlobalAutoApproveOptIn */, store)(() => {
        if (this._storageService.getBoolean("chat.tools.global.autoApprove.optIn" /* GlobalAutoApproveOptIn */, StorageScope.APPLICATION, false)) {
          cts.cancel();
        }
      }));
      const promptResult = await this._dialogService.prompt({
        type: Severity.Warning,
        message: localize("autoApprove2.title", "Enable global auto approve?"),
        buttons: [
          {
            label: localize("autoApprove2.button.enable", "Enable"),
            run: () => true
          },
          {
            label: localize("autoApprove2.button.disable", "Disable"),
            run: () => false
          }
        ],
        custom: {
          icon: Codicon.warning,
          markdownDetails: [{
            markdown: new MarkdownString(globalAutoApproveDescription.value, { isTrusted: { enabledCommands: ["workbench.action.openSettings"] } })
          }]
        },
        token: cts.token
      });
      if (cts.token.isCancellationRequested) {
        return true;
      }
      if (promptResult.result !== true) {
        await this._configurationService.updateValue(ChatConfiguration.GlobalAutoApprove, false);
        return false;
      }
      this._storageService.store("chat.tools.global.autoApprove.optIn" /* GlobalAutoApproveOptIn */, true, StorageScope.APPLICATION, StorageTarget.USER);
      return true;
    } finally {
      store.dispose();
    }
  }
  cleanupCallDisposables(requestId, store) {
    if (requestId) {
      const disposables = this._callsByRequestId.get(requestId);
      if (disposables) {
        const index = disposables.findIndex((d) => d.store === store);
        if (index > -1) {
          disposables.splice(index, 1);
        }
        if (disposables.length === 0) {
          this._callsByRequestId.delete(requestId);
        }
      }
    }
    store.dispose();
  }
  cancelToolCallsForRequest(requestId) {
    const calls = this._callsByRequestId.get(requestId);
    if (calls) {
      calls.forEach((call) => call.store.dispose());
      this._callsByRequestId.delete(requestId);
    }
    for (const [toolCallId, invocation] of this._pendingToolCalls) {
      if (invocation.chatRequestId === requestId) {
        this._pendingToolCalls.delete(toolCallId);
      }
    }
  }
  static {
    this.githubMCPServerAliases = ["github/github-mcp-server", "io.github.github/github-mcp-server", "github-mcp-server"];
  }
  static {
    this.playwrightMCPServerAliases = ["microsoft/playwright-mcp", "com.microsoft/playwright-mcp"];
  }
  *getToolSetAliases(toolSet, fullReferenceName) {
    if (fullReferenceName !== toolSet.referenceName) {
      yield toolSet.referenceName;
    }
    if (toolSet.legacyFullNames) {
      yield* toolSet.legacyFullNames;
    }
    switch (toolSet.referenceName) {
      case "github":
        for (const alias of LanguageModelToolsService.githubMCPServerAliases) {
          yield alias + "/*";
        }
        break;
      case "playwright":
        for (const alias of LanguageModelToolsService.playwrightMCPServerAliases) {
          yield alias + "/*";
        }
        break;
      case SpecedToolAliases.execute:
        yield "shell";
        break;
      case SpecedToolAliases.agent:
        yield VSCodeToolReference.runSubagent;
        yield "custom-agent";
        break;
    }
  }
  *getToolAliases(toolSet, fullReferenceName) {
    const referenceName = toolSet.toolReferenceName ?? toolSet.displayName;
    if (fullReferenceName !== referenceName && referenceName !== VSCodeToolReference.runSubagent) {
      yield referenceName;
    }
    if (toolSet.legacyToolReferenceFullNames) {
      for (const legacyName of toolSet.legacyToolReferenceFullNames) {
        yield legacyName;
        const lastSlashIndex = legacyName.lastIndexOf("/");
        if (lastSlashIndex !== -1) {
          yield legacyName.substring(lastSlashIndex + 1);
        }
      }
    }
    const slashIndex = fullReferenceName.lastIndexOf("/");
    if (slashIndex !== -1) {
      switch (fullReferenceName.substring(0, slashIndex)) {
        case "github":
          for (const alias of LanguageModelToolsService.githubMCPServerAliases) {
            yield alias + fullReferenceName.substring(slashIndex);
          }
          break;
        case "playwright":
          for (const alias of LanguageModelToolsService.playwrightMCPServerAliases) {
            yield alias + fullReferenceName.substring(slashIndex);
          }
          break;
      }
    }
  }
  /**
   * Create a map that contains all tools and toolsets with their enablement state.
   * @param fullReferenceNames A list of tool or toolset by their full reference names that are enabled.
   * @returns A map of tool or toolset instances to their enablement state.
   */
  toToolAndToolSetEnablementMap(fullReferenceNames, model) {
    const toolOrToolSetNames = new Set(fullReferenceNames);
    const result = /* @__PURE__ */ new Map();
    for (const [tool, fullReferenceName] of this.toolsWithFullReferenceName.get()) {
      if (isToolSet(tool)) {
        const enabled = toolOrToolSetNames.has(fullReferenceName) || Iterable.some(this.getToolSetAliases(tool, fullReferenceName), (name) => toolOrToolSetNames.has(name));
        const scoped = model ? new ToolSetForModel(tool, model) : tool;
        result.set(scoped, enabled);
        if (enabled) {
          for (const memberTool of scoped.getTools()) {
            result.set(memberTool, true);
          }
        }
      } else {
        if (!this.isToolEnabledForModel(tool, model)) {
          continue;
        }
        if (!result.has(tool)) {
          const enabled = toolOrToolSetNames.has(fullReferenceName) || Iterable.some(this.getToolAliases(tool, fullReferenceName), (name) => toolOrToolSetNames.has(name)) || !!tool.legacyToolReferenceFullNames?.some((toolFullName) => {
            const index = toolFullName.lastIndexOf("/");
            return index !== -1 && toolOrToolSetNames.has(toolFullName.substring(0, index));
          });
          result.set(tool, enabled);
        }
      }
    }
    for (const toolSet of this._toolSets) {
      if (toolSet.source.type === "user") {
        const enabled = Iterable.every(toolSet.getTools(), (t) => result.get(t) === true);
        result.set(toolSet, enabled);
      }
    }
    return ToolAndToolSetEnablementMap.fromMap(result);
  }
  toFullReferenceNames(map) {
    const result = [];
    const toolsCoveredByEnabledToolSet = /* @__PURE__ */ new Set();
    const enabledToolSetIds = /* @__PURE__ */ new Set();
    const enabledToolIds = /* @__PURE__ */ new Set();
    for (const [tool, enabled] of map) {
      if (enabled) {
        if (isToolSet(tool)) {
          enabledToolSetIds.add(tool.id);
        } else {
          enabledToolIds.add(tool.id);
        }
      }
    }
    for (const [tool, fullReferenceName] of this.toolsWithFullReferenceName.get()) {
      if (isToolSet(tool)) {
        if (enabledToolSetIds.has(tool.id)) {
          result.push(fullReferenceName);
          for (const memberTool of tool.getTools()) {
            toolsCoveredByEnabledToolSet.add(memberTool);
          }
        }
      } else {
        if (enabledToolIds.has(tool.id) && !toolsCoveredByEnabledToolSet.has(tool)) {
          result.push(fullReferenceName);
        }
      }
    }
    return result;
  }
  toToolReferences(variableReferences) {
    const toolsOrToolSetByName = /* @__PURE__ */ new Map();
    for (const [tool, fullReferenceName] of this.toolsWithFullReferenceName.get()) {
      toolsOrToolSetByName.set(fullReferenceName, tool);
    }
    const result = [];
    for (const ref of variableReferences) {
      const toolOrToolSet = toolsOrToolSetByName.get(ref.name);
      if (toolOrToolSet) {
        if (isToolSet(toolOrToolSet)) {
          result.push(toToolSetVariableEntry(toolOrToolSet, ref.range));
        } else {
          result.push(toToolVariableEntry(toolOrToolSet, ref.range));
        }
      }
    }
    return result;
  }
  getToolSetsForModel(model, reader) {
    if (!model) {
      return this.toolSets.read(reader);
    }
    return Iterable.map(this.toolSets.read(reader), (ts) => new ToolSetForModel(ts, model, (toolData) => this.isToolEnabledForModel(toolData, model)));
  }
  getToolSet(id) {
    for (const toolSet of this._toolSets) {
      if (toolSet.id === id) {
        return toolSet;
      }
    }
    return void 0;
  }
  getToolSetByName(name) {
    for (const toolSet of this._toolSets) {
      if (toolSet.referenceName === name) {
        return toolSet;
      }
    }
    return void 0;
  }
  getSpecedToolSetName(referenceName) {
    if (LanguageModelToolsService.githubMCPServerAliases.includes(referenceName)) {
      return "github";
    }
    if (LanguageModelToolsService.playwrightMCPServerAliases.includes(referenceName)) {
      return "playwright";
    }
    return referenceName;
  }
  createToolSet(source, id, referenceName, options) {
    const that = this;
    referenceName = this.getSpecedToolSetName(referenceName);
    const result = new class extends ToolSet {
      dispose() {
        if (that._toolSets.has(result)) {
          this._tools.clear();
          that._toolSets.delete(result);
        }
      }
    }(id, referenceName, options?.icon ?? Codicon.tools, source, options?.description, options?.detail, options?.legacyFullNames, options?.deprecated, options?.hiddenInToolsPicker, this._contextKeyService);
    this._toolSets.add(result);
    return result;
  }
  *getFullReferenceNames() {
    for (const [, fullReferenceName] of this.toolsWithFullReferenceName.get()) {
      yield fullReferenceName;
    }
  }
  getDeprecatedFullReferenceNames() {
    const result = /* @__PURE__ */ new Map();
    const knownToolSetNames = /* @__PURE__ */ new Set();
    const add = (name, fullReferenceName) => {
      if (name !== fullReferenceName) {
        if (!result.has(name)) {
          result.set(name, /* @__PURE__ */ new Set());
        }
        result.get(name).add(fullReferenceName);
      }
    };
    for (const [tool, _] of this.toolsWithFullReferenceName.get()) {
      if (isToolSet(tool)) {
        knownToolSetNames.add(tool.referenceName);
        if (tool.legacyFullNames) {
          for (const legacyName of tool.legacyFullNames) {
            knownToolSetNames.add(legacyName);
          }
        }
      }
    }
    for (const [tool, fullReferenceName] of this.toolsWithFullReferenceName.get()) {
      if (isToolSet(tool)) {
        for (const alias of this.getToolSetAliases(tool, fullReferenceName)) {
          add(alias, fullReferenceName);
        }
      } else {
        for (const alias of this.getToolAliases(tool, fullReferenceName)) {
          add(alias, fullReferenceName);
        }
        if (tool.legacyToolReferenceFullNames) {
          const slashIndex = fullReferenceName.lastIndexOf("/");
          const toolSetPrefix = slashIndex !== -1 ? fullReferenceName.substring(0, slashIndex + 1) : void 0;
          for (const legacyName of tool.legacyToolReferenceFullNames) {
            if (toolSetPrefix && !legacyName.includes("/")) {
              add(toolSetPrefix + legacyName, fullReferenceName);
            }
            if (legacyName.includes("/")) {
              const toolSetFullName = legacyName.substring(0, legacyName.lastIndexOf("/"));
              if (!knownToolSetNames.has(toolSetFullName)) {
                add(toolSetFullName, fullReferenceName);
              }
            }
          }
        }
      }
    }
    return result;
  }
  getToolByFullReferenceName(fullReferenceName) {
    for (const [tool, toolFullReferenceName] of this.toolsWithFullReferenceName.get()) {
      if (fullReferenceName === toolFullReferenceName) {
        return tool;
      }
      const aliases = isToolSet(tool) ? this.getToolSetAliases(tool, toolFullReferenceName) : this.getToolAliases(tool, toolFullReferenceName);
      if (Iterable.some(aliases, (alias) => fullReferenceName === alias)) {
        return tool;
      }
    }
    return void 0;
  }
  getFullReferenceName(tool, toolSet) {
    for (const [item, toolFullReferenceName] of this.toolsWithFullReferenceName.get()) {
      if (item === tool) {
        return toolFullReferenceName;
      }
    }
    if (isToolSet(tool)) {
      return getToolSetFullReferenceName(tool);
    }
    return getToolFullReferenceName(tool, toolSet);
  }
  getFullReferenceNameMap() {
    const result = /* @__PURE__ */ new Map();
    for (const [item, toolFullReferenceName] of this.toolsWithFullReferenceName.get()) {
      result.set(item, toolFullReferenceName);
    }
    return result;
  }
};
LanguageModelToolsService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAccessibilityService),
  __decorateParam(9, IAccessibilitySignalService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, ILanguageModelToolsConfirmationService),
  __decorateParam(12, ICommandService),
  __decorateParam(13, IChatWidgetService),
  __decorateParam(14, IToolResultCompressor),
  __decorateParam(15, IChatToolRiskAssessmentService)
], LanguageModelToolsService);
function getToolFullReferenceName(tool, toolSet) {
  const toolName = tool.toolReferenceName ?? tool.displayName;
  if (toolSet) {
    return `${toolSet.referenceName}/${toolName}`;
  } else if (tool.source.type === "extension") {
    return `${tool.source.extensionId.value.toLowerCase()}/${toolName}`;
  }
  return toolName;
}
function getToolSetFullReferenceName(toolSet) {
  if (toolSet.source.type === "mcp") {
    return `${toolSet.referenceName}/*`;
  }
  return toolSet.referenceName;
}
export {
  AutoApproveStorageKeys,
  LanguageModelToolsService,
  globalAutoApproveDescription
};
