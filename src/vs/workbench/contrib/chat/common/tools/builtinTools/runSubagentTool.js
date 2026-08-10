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
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../../platform/product/common/productService.js";
import { ChatRequestVariableSet } from "../../attachments/chatVariableEntries.js";
import { isByokModel } from "../../chatSelectedModel.js";
import { IChatService } from "../../chatService/chatService.js";
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from "../../constants.js";
import { COPILOT_VENDOR_ID, ILanguageModelChatMetadata, ILanguageModelsService } from "../../languageModels.js";
import { getChatSessionType } from "../../model/chatUri.js";
import { IChatAgentService } from "../../participants/chatAgents.js";
import { ComputeAutomaticInstructions } from "../../promptSyntax/computeAutomaticInstructions.js";
import { mergeHooks } from "../../promptSyntax/hookSchema.js";
import { HookType } from "../../promptSyntax/hookTypes.js";
import { IPromptsService } from "../../promptSyntax/service/promptsService.js";
import { isBuiltinAgent } from "../../promptSyntax/utils/promptsServiceUtils.js";
import {
  ILanguageModelToolsService,
  isToolSet,
  ToolDataSource,
  VSCodeToolReference
} from "../languageModelToolsService.js";
import { ManageTodoListToolToolId } from "./manageTodoListTool.js";
import { createToolSimpleTextResult } from "./toolHelpers.js";
const BaseModelDescription = `Launch a new agent to handle complex, multi-step tasks autonomously. This tool is good at researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries, use this agent to perform the search for you.

- Agents do not run async or in the background, you will wait for the agent's result.
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
- Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
- The agent's outputs should generally be trusted
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
- If the user asks for a certain agent, you MUST provide that EXACT agent name (case-sensitive) to invoke that specific agent.`;
const RUN_SUBAGENT_MAX_NESTING_DEPTH = 5;
let RunSubagentTool = class extends Disposable {
  constructor(chatAgentService, chatService, languageModelToolsService, languageModelsService, logService, configurationService, promptsService, instantiationService, productService) {
    super();
    this.chatAgentService = chatAgentService;
    this.chatService = chatService;
    this.languageModelToolsService = languageModelToolsService;
    this.languageModelsService = languageModelsService;
    this.logService = logService;
    this.configurationService = configurationService;
    this.promptsService = promptsService;
    this.instantiationService = instantiationService;
    this.productService = productService;
    this._onDidUpdateToolData = this._register(new Emitter());
    this.onDidUpdateToolData = this._onDidUpdateToolData.event;
    /** Hack to port data between prepare/invoke */
    this._resolvedModels = /* @__PURE__ */ new Map();
    /** Tracks the current subagent nesting depth per session to detect and limit recursion. */
    this._sessionDepth = /* @__PURE__ */ new Map();
  }
  static {
    this.Id = "runSubagent";
  }
  getToolData() {
    const modelDescription = BaseModelDescription;
    const properties = {
      prompt: {
        type: "string",
        description: "A detailed description of the task for the agent to perform"
      },
      description: {
        type: "string",
        description: "A short (3-5 word) description of the task"
      }
    };
    properties.agentName = {
      type: "string",
      description: "Optional name of a specific agent to invoke. If not provided, uses the current agent."
    };
    properties.model = {
      type: "string",
      description: 'Optional model for the subagent. Format: "Model Name (Vendor)", vendor is usually "copilot". Only use to enforce a specific model.'
    };
    const inputSchema = {
      type: "object",
      properties,
      required: ["prompt", "description"]
    };
    const runSubagentToolData = {
      id: RunSubagentTool.Id,
      toolReferenceName: VSCodeToolReference.runSubagent,
      icon: ThemeIcon.fromId(Codicon.organization.id),
      displayName: localize("tool.runSubagent.displayName", "Run Subagent"),
      userDescription: localize("tool.runSubagent.userDescription", "Run a task within an isolated subagent context to enable efficient organization of tasks and context window management."),
      modelDescription,
      source: ToolDataSource.Internal,
      inputSchema
    };
    return runSubagentToolData;
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const args = invocation.parameters;
    this.logService.debug(`RunSubagentTool: Invoking with prompt: ${args.prompt.substring(0, 100)}...`);
    if (!invocation.context) {
      throw new Error("toolInvocationToken is required for this tool");
    }
    const model = this.chatService.getSession(invocation.context.sessionResource);
    if (!model) {
      throw new Error("Chat model not found for session");
    }
    const request = model.getRequests().at(-1);
    let subagentCredits;
    const store = new DisposableStore();
    try {
      const defaultAgent = this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, ChatModeKind.Agent);
      if (!defaultAgent) {
        return createToolSimpleTextResult("Error: No default agent available");
      }
      let modeModelId = invocation.modelId;
      let modeTools = invocation.userSelectedTools;
      let modeInstructions;
      let subagent;
      let resolvedModelName;
      const currentModeInstructions = request.modeInfo?.modeInstructions;
      const subAgentName = this.normalizeRequestedAgentName(args.agentName);
      const effectiveSubAgentName = subAgentName ?? currentModeInstructions?.name;
      if (subAgentName) {
        subagent = await this.getSubAgentByName(subAgentName);
        if (subagent) {
          const cached = this._resolvedModels.get(invocation.callId);
          if (cached) {
            this._resolvedModels.delete(invocation.callId);
            modeModelId = cached.modeModelId;
            resolvedModelName = cached.resolvedModelName;
          } else {
            const resolved = this.resolveSubagentModel(subagent, invocation.modelId, args.model);
            modeModelId = resolved.modeModelId;
            resolvedModelName = resolved.resolvedModelName;
          }
          const modeCustomTools = subagent.tools;
          if (modeCustomTools) {
            const enablementMap = this.languageModelToolsService.toToolAndToolSetEnablementMap(modeCustomTools, void 0);
            modeTools = {};
            for (const [tool, enabled] of enablementMap) {
              if (!isToolSet(tool)) {
                modeTools[tool.id] = enabled;
              }
            }
          }
          const instructions = subagent.agentInstructions;
          modeInstructions = instructions && {
            name: subAgentName,
            content: instructions.content,
            toolReferences: this.languageModelToolsService.toToolReferences(instructions.toolReferences),
            allowedSubagents: void 0,
            metadata: instructions.metadata,
            isBuiltin: isBuiltinAgent(subagent.source, subagent.uri, this.productService)
          };
        } else {
          this._resolvedModels.delete(invocation.callId);
          throw new Error(`Requested agent '${subAgentName}' not found. Try again with the correct agent name, or omit agentName to use the current agent.`);
        }
      } else {
        modeInstructions = currentModeInstructions;
        const cached = this._resolvedModels.get(invocation.callId);
        if (cached) {
          this._resolvedModels.delete(invocation.callId);
          modeModelId = cached.modeModelId;
          resolvedModelName = cached.resolvedModelName;
        } else {
          const resolved = this.resolveSubagentModel(void 0, invocation.modelId, args.model);
          modeModelId = resolved.modeModelId;
          resolvedModelName = resolved.resolvedModelName;
        }
      }
      const markdownParts = [];
      const subAgentInvocationId = invocation.chatStreamToolCallId ?? invocation.callId ?? `subagent-${generateUuid()}`;
      let inEdit = false;
      const progressCallback = (parts) => {
        for (const part of parts) {
          if (part.kind === "usage") {
            if (typeof part.copilotCredits === "number" && Number.isFinite(part.copilotCredits) && part.copilotCredits >= 0) {
              subagentCredits = Math.max(subagentCredits ?? 0, part.copilotCredits);
            }
            continue;
          }
          if (part.kind === "textEdit" || part.kind === "notebookEdit" || part.kind === "codeblockUri") {
            if (part.kind === "codeblockUri" && !inEdit) {
              inEdit = true;
              model.acceptResponseProgress(request, { kind: "markdownContent", content: new MarkdownString("```\n") });
            }
            if (part.kind === "codeblockUri") {
              model.acceptResponseProgress(request, { ...part, subAgentInvocationId });
            } else {
              model.acceptResponseProgress(request, part);
            }
          } else if (part.kind === "hook") {
            model.acceptResponseProgress(request, { ...part, subAgentInvocationId });
          } else if (part.kind === "markdownContent") {
            if (inEdit) {
              model.acceptResponseProgress(request, { kind: "markdownContent", content: new MarkdownString("\n```\n\n") });
              inEdit = false;
            }
            markdownParts.push(part.content.value);
          }
        }
      };
      const allowInvocationsFromSubagents = this.configurationService.getValue(ChatConfiguration.SubagentsAllowInvocationsFromSubagents) ?? false;
      const maxDepth = allowInvocationsFromSubagents ? RUN_SUBAGENT_MAX_NESTING_DEPTH : 0;
      const sessionKey = invocation.context.sessionResource.toString();
      const currentDepth = this._sessionDepth.get(sessionKey) ?? 0;
      const depthAllowed = currentDepth + 1 <= maxDepth;
      if (!modeTools) {
        modeTools = {};
      }
      const existingRunSubagentEnablement = modeTools[RunSubagentTool.Id];
      if (existingRunSubagentEnablement !== false) {
        modeTools[RunSubagentTool.Id] = depthAllowed;
      }
      modeTools[ManageTodoListToolToolId] = false;
      modeTools["copilot_askQuestions"] = false;
      if (maxDepth > 0) {
        this.logService.debug(`RunSubagentTool: Nested subagents enabling ${modeTools[RunSubagentTool.Id]}: session ${sessionKey}, currentDepth: ${currentDepth}, maxDepth: ${maxDepth}, allowInvocationsFromSubagents: ${allowInvocationsFromSubagents}`);
      }
      const variableSet = new ChatRequestVariableSet();
      if (this.configurationService.getValue(ChatConfiguration.CollectInstructionsInExtension) !== true) {
        const computer = this.instantiationService.createInstance(ComputeAutomaticInstructions, ChatModeKind.Agent, modeTools, void 0, getChatSessionType(invocation.context.sessionResource));
        await computer.collect(variableSet, token);
      }
      let collectedHooks;
      try {
        const info = await this.promptsService.getHooks(token);
        collectedHooks = info?.hooks;
      } catch (error) {
        this.logService.warn("[ChatService] Failed to collect hooks:", error);
      }
      if (subagent?.hooks) {
        const remapped = { ...subagent.hooks };
        if (remapped[HookType.Stop]) {
          const stopHooks = remapped[HookType.Stop];
          remapped[HookType.SubagentStop] = remapped[HookType.SubagentStop] ? [...remapped[HookType.SubagentStop], ...stopHooks] : stopHooks;
          remapped[HookType.Stop] = void 0;
        }
        collectedHooks = mergeHooks(collectedHooks, remapped);
      }
      const agentRequest = {
        sessionResource: invocation.context.sessionResource,
        requestId: invocation.callId ?? `subagent-${Date.now()}`,
        agentId: defaultAgent.id,
        message: args.prompt,
        variables: { variables: variableSet.asArray() },
        location: ChatAgentLocation.Chat,
        subAgentInvocationId,
        subAgentName: effectiveSubAgentName,
        userSelectedModelId: modeModelId,
        modelConfiguration: modeModelId ? this.languageModelsService.getModelConfiguration(modeModelId) : void 0,
        userSelectedTools: modeTools,
        modeInstructions,
        parentRequestId: invocation.chatRequestId,
        hooks: collectedHooks,
        hasHooksEnabled: !!collectedHooks && Object.values(collectedHooks).some((arr) => arr && arr.length > 0)
      };
      store.add(this.languageModelToolsService.onDidInvokeTool((e) => {
        if (e.subagentInvocationId === subAgentInvocationId) {
          markdownParts.length = 0;
        }
      }));
      this._sessionDepth.set(sessionKey, currentDepth + 1);
      let result;
      try {
        result = await this.chatAgentService.invokeAgent(
          defaultAgent.id,
          agentRequest,
          progressCallback,
          [],
          token
        );
      } finally {
        const newDepth = (this._sessionDepth.get(sessionKey) ?? 1) - 1;
        if (newDepth <= 0) {
          this._sessionDepth.delete(sessionKey);
        } else {
          this._sessionDepth.set(sessionKey, newDepth);
        }
      }
      if (result?.errorDetails) {
        return createToolSimpleTextResult(`Agent error: ${result.errorDetails.message}`);
      }
      const resultText = markdownParts.join("").replace(/^\n*```\n+```\n*/g, "").trim() || "Agent completed with no output";
      if (invocation.toolSpecificData?.kind === "subagent") {
        invocation.toolSpecificData.result = resultText;
        invocation.toolSpecificData.modelName = resolvedModelName;
      }
      return {
        content: [{
          kind: "text",
          value: resultText
        }],
        toolMetadata: {
          subAgentInvocationId,
          description: args.description,
          agentName: agentRequest.subAgentName,
          modelName: resolvedModelName
        }
      };
    } catch (error) {
      const errorMessage = `Error invoking subagent: ${error instanceof Error ? error.message : "Unknown error"}`;
      this.logService.error(errorMessage, error);
      return createToolSimpleTextResult(errorMessage);
    } finally {
      if (subagentCredits !== void 0) {
        request.response?.setSubagentCopilotCredits(invocation.callId, subagentCredits);
        if (invocation.toolSpecificData?.kind === "subagent") {
          invocation.toolSpecificData.credits = subagentCredits;
        }
      }
      store.dispose();
    }
  }
  async getSubAgentByName(name) {
    const agents = await this.promptsService.getCustomAgents(CancellationToken.None);
    return agents.find((agent) => agent.name === name && agent.enabled);
  }
  /**
   * Checks if a model exceeds the main model's cost tier based on multiplier.
   * @returns An object with `exceeds: true` and a reason string if blocked, or `exceeds: false` if allowed.
   */
  checkMultiplierConstraint(modelId, mainModelId) {
    if (!mainModelId || modelId === mainModelId) {
      return { exceeds: false };
    }
    const mainModelMetadata = this.languageModelsService.lookupLanguageModel(mainModelId);
    const modelMetadata = this.languageModelsService.lookupLanguageModel(modelId);
    const mainMultiplier = mainModelMetadata?.multiplierNumeric;
    const modelMultiplier = modelMetadata?.multiplierNumeric;
    if (mainMultiplier !== void 0 && modelMultiplier !== void 0 && modelMultiplier > mainMultiplier) {
      return {
        exceeds: true,
        reason: `exceeds the current model's cost tier (${modelMultiplier}x vs ${mainMultiplier}x)`
      };
    }
    return { exceeds: false };
  }
  /**
   * Returns information about available models for error messages.
   * Includes which models are unavailable due to multiplier restrictions.
   */
  getAvailableModelsInfo(mainModelId) {
    const models = this.languageModelsService.getLanguageModelIds().map((id) => ({ id, metadata: this.languageModelsService.lookupLanguageModel(id) })).filter(
      (m) => !!m.metadata && ILanguageModelChatMetadata.suitableForAgentMode(m.metadata) && m.metadata.isUserSelectable !== false && !m.metadata.targetChatSessionType
    );
    if (models.length === 0) {
      return "No models available.";
    }
    const available = [];
    const unavailableDueToMultiplier = [];
    for (const { id, metadata } of models) {
      const qualifiedName = ILanguageModelChatMetadata.asQualifiedName(metadata);
      const check = this.checkMultiplierConstraint(id, mainModelId);
      if (check.exceeds) {
        unavailableDueToMultiplier.push(qualifiedName);
      } else {
        available.push(qualifiedName);
      }
    }
    const parts = [];
    if (available.length > 0) {
      parts.push(`Available models: ${available.join(", ")}`);
    }
    if (unavailableDueToMultiplier.length > 0) {
      parts.push(`Unavailable (exceeds current model's cost tier): ${unavailableDueToMultiplier.join(", ")}`);
    }
    return parts.join(". ") || "No models available.";
  }
  /**
   * Resolves the model to be used by a subagent.
   * @param explicitModelQualifiedName Optional explicit model specified by the caller.
   *        If provided and not found or not allowed, throws an error with available models.
   * @throws Error if the requested model is not found or exceeds the main model's cost tier.
   */
  resolveSubagentModel(subagent, mainModelId, explicitModelQualifiedName) {
    let modeModelId = mainModelId;
    let explicitModelResolved = false;
    if (explicitModelQualifiedName) {
      const lm = this.languageModelsService.lookupLanguageModelByQualifiedName(explicitModelQualifiedName);
      if (lm?.identifier) {
        modeModelId = lm.identifier;
        explicitModelResolved = true;
      } else {
        throw new Error(`Requested model '${explicitModelQualifiedName}' not found. ${this.getAvailableModelsInfo(mainModelId)}`);
      }
    }
    if (subagent && !explicitModelResolved) {
      const modeModelQualifiedNames = subagent.model;
      if (modeModelQualifiedNames) {
        const mainModelMetadata = mainModelId ? this.languageModelsService.lookupLanguageModel(mainModelId) : void 0;
        const mainModelIsByok = !!mainModelMetadata && isByokModel(mainModelMetadata);
        const skipCopilotFallbacks = mainModelIsByok && isBuiltinAgent(subagent.source, subagent.uri, this.productService);
        for (const qualifiedName of modeModelQualifiedNames) {
          const lmByQualifiedName = this.languageModelsService.lookupLanguageModelByQualifiedName(qualifiedName);
          if (lmByQualifiedName?.identifier) {
            if (skipCopilotFallbacks && lmByQualifiedName.metadata.vendor === COPILOT_VENDOR_ID) {
              continue;
            }
            modeModelId = lmByQualifiedName.identifier;
            break;
          }
        }
      }
    }
    if (modeModelId) {
      const check = this.checkMultiplierConstraint(modeModelId, mainModelId);
      if (check.exceeds) {
        const modelMetadata = this.languageModelsService.lookupLanguageModel(modeModelId);
        throw new Error(`Requested model '${modelMetadata?.name}' ${check.reason}. ${this.getAvailableModelsInfo(mainModelId)}`);
      }
    }
    const resolvedModelMetadata = modeModelId ? this.languageModelsService.lookupLanguageModel(modeModelId) : void 0;
    return { modeModelId, resolvedModelName: resolvedModelMetadata?.name };
  }
  async prepareToolInvocation(context, _token) {
    const args = context.parameters;
    const requestedAgentName = this.normalizeRequestedAgentName(args.agentName);
    const subagent = requestedAgentName ? await this.getSubAgentByName(requestedAgentName) : void 0;
    const currentModeInstructions = context.chatSessionResource ? this.getCurrentModeInstructions(context.chatSessionResource) : void 0;
    const resolved = this.resolveSubagentModel(subagent, context.modelId, args.model);
    this._resolvedModels.set(context.toolCallId, resolved);
    return {
      invocationMessage: args.description,
      toolSpecificData: {
        kind: "subagent",
        description: args.description,
        agentName: subagent?.name ?? requestedAgentName ?? currentModeInstructions?.name,
        prompt: args.prompt,
        modelName: resolved.resolvedModelName
      }
    };
  }
  normalizeRequestedAgentName(agentName) {
    const normalized = agentName?.trim();
    return normalized ? normalized : void 0;
  }
  getCurrentModeInstructions(sessionResource) {
    if (typeof this.chatService.getSession !== "function") {
      return void 0;
    }
    const model = this.chatService.getSession(sessionResource);
    return model?.getRequests().at(-1)?.modeInfo?.modeInstructions;
  }
};
RunSubagentTool = __decorateClass([
  __decorateParam(0, IChatAgentService),
  __decorateParam(1, IChatService),
  __decorateParam(2, ILanguageModelToolsService),
  __decorateParam(3, ILanguageModelsService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IPromptsService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IProductService)
], RunSubagentTool);
export {
  RUN_SUBAGENT_MAX_NESTING_DEPTH,
  RunSubagentTool
};
