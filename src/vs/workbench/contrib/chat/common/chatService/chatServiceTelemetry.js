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
import { URI } from "../../../../../base/common/uri.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { escapeModelIdForTelemetry, ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ChatAgentVoteDirection, ChatCopyKind } from "./chatService.js";
import { isImageVariableEntry } from "../attachments/chatVariableEntries.js";
import { ChatModeKind } from "../constants.js";
import { ILanguageModelsService } from "../languageModels.js";
import { chatSessionResourceToId, getChatSessionType } from "../model/chatUri.js";
import { isRemoteAgentHostSessionType, parseRemoteAgentHostHarness } from "../../../../../platform/agentHost/common/agentHostSessionType.js";
let ChatServiceTelemetry = class {
  constructor(telemetryService) {
    this.telemetryService = telemetryService;
  }
  notifyUserAction(action) {
    if (action.action.kind === "vote") {
      this.telemetryService.publicLog2("interactiveSessionVote", {
        direction: action.action.direction === ChatAgentVoteDirection.Up ? "up" : "down",
        agentId: action.agentId ?? "",
        command: action.command
      });
    } else if (action.action.kind === "copy") {
      this.telemetryService.publicLog2("interactiveSessionCopy", {
        copyKind: action.action.copyKind === ChatCopyKind.Action ? "action" : "toolbar",
        agentId: action.agentId ?? "",
        command: action.command
      });
    } else if (action.action.kind === "insert") {
      this.telemetryService.publicLog2("interactiveSessionInsert", {
        newFile: !!action.action.newFile,
        agentId: action.agentId ?? "",
        command: action.command
      });
    } else if (action.action.kind === "apply") {
      this.telemetryService.publicLog2("interactiveSessionApply", {
        newFile: !!action.action.newFile,
        codeMapper: action.action.codeMapper,
        agentId: action.agentId ?? "",
        command: action.command,
        editsProposed: !!action.action.editsProposed
      });
    } else if (action.action.kind === "runInTerminal") {
      this.telemetryService.publicLog2("interactiveSessionRunInTerminal", {
        languageId: action.action.languageId ?? "",
        agentId: action.agentId ?? "",
        command: action.command
      });
    } else if (action.action.kind === "followUp") {
      this.telemetryService.publicLog2("chatFollowupClicked", {
        agentId: action.agentId ?? "",
        command: action.command
      });
    } else if (action.action.kind === "chatEditingHunkAction") {
      this.telemetryService.publicLog2("chatEditHunk", {
        agentId: action.agentId ?? "",
        outcome: action.action.outcome,
        lineCount: action.action.lineCount,
        hasRemainingEdits: action.action.hasRemainingEdits,
        requestId: action.requestId,
        modelId: escapeModelIdForTelemetry(action.modelId) ?? "",
        modeId: action.modeId ?? ""
      });
    }
  }
  retrievedFollowups(agentId, command, numFollowups) {
    this.telemetryService.publicLog2("chatFollowupsRetrieved", {
      agentId,
      command,
      numFollowups
    });
  }
};
ChatServiceTelemetry = __decorateClass([
  __decorateParam(0, ITelemetryService)
], ChatServiceTelemetry);
function getCodeBlocks(text) {
  const lines = text.split("\n");
  const codeBlockLanguages = [];
  let codeBlockState;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (codeBlockState) {
      if (new RegExp(`^\\s*${codeBlockState.delimiter}\\s*$`).test(line)) {
        codeBlockLanguages.push(codeBlockState.languageId);
        codeBlockState = void 0;
      }
    } else {
      const match = line.match(/^(\s*)(`{3,}|~{3,})(\w*)/);
      if (match) {
        codeBlockState = { delimiter: match[2], languageId: match[3] };
      }
    }
  }
  return codeBlockLanguages;
}
let ChatRequestTelemetry = class {
  constructor(opts, telemetryService, languageModelsService) {
    this.opts = opts;
    this.telemetryService = telemetryService;
    this.languageModelsService = languageModelsService;
    this.isComplete = false;
  }
  complete({ timeToFirstProgress, totalTime, result, requestType, request, detectedAgent }) {
    if (this.isComplete) {
      return;
    }
    this.isComplete = true;
    this.telemetryService.publicLog2("interactiveSessionProviderInvoked", {
      timeToFirstProgress,
      totalTime,
      result,
      requestType,
      requestId: request.id,
      agent: detectedAgent?.id ?? this.opts.agent.id,
      agentExtensionId: detectedAgent?.extensionId.value ?? this.opts.agent.extensionId.value,
      slashCommand: this.opts.agentSlashCommandPart ? this.opts.agentSlashCommandPart.command.name : this.opts.commandPart?.slashCommand.command,
      chatSessionId: chatSessionResourceToId(this.opts.sessionResource),
      enableCommandDetection: this.opts.enableCommandDetection,
      isParticipantDetected: !!detectedAgent,
      location: this.opts.location,
      citations: request.response?.codeCitations.length ?? 0,
      numCodeBlocks: getCodeBlocks(request.response?.response.toString() ?? "").length,
      attachmentKinds: this.attachmentKindsForTelemetry(request.variableData),
      model: this.resolveModelId(this.opts.options?.userSelectedModelId),
      permissionLevel: this.opts.options?.modeInfo?.kind === ChatModeKind.Ask ? void 0 : this.opts.options?.modeInfo?.permissionLevel,
      chatMode: this.opts.options?.modeInfo?.telemetryModeName ?? this.opts.options?.modeInfo?.telemetryModeId,
      sessionType: getChatSessionTypeForTelemetry(this.opts.sessionResource),
      harness: getHarnessForTelemetry(this.opts.sessionResource)
    });
  }
  attachmentKindsForTelemetry(variableData) {
    return variableData.variables.map((v) => {
      if (v.kind === "implicit") {
        return "implicit";
      } else if (v.range) {
        if (v.kind === "tool") {
          return "toolInPrompt";
        } else if (v.kind === "toolset") {
          return "toolsetInPrompt";
        } else {
          return "fileInPrompt";
        }
      } else if (v.kind === "command") {
        return "command";
      } else if (v.kind === "symbol") {
        return "symbol";
      } else if (isImageVariableEntry(v)) {
        return "image";
      } else if (v.kind === "directory") {
        return "directory";
      } else if (v.kind === "tool") {
        return "tool";
      } else if (v.kind === "toolset") {
        return "toolset";
      } else {
        if (URI.isUri(v.value)) {
          return "file";
        } else if (isLocation(v.value)) {
          return "location";
        } else {
          return "otherAttachment";
        }
      }
    });
  }
  resolveModelId(userSelectedModelId) {
    return userSelectedModelId && this.languageModelsService.lookupLanguageModel(userSelectedModelId)?.id;
  }
};
ChatRequestTelemetry = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILanguageModelsService)
], ChatRequestTelemetry);
function getChatSessionTypeForTelemetry(sessionResource) {
  const sessionType = getChatSessionType(sessionResource);
  return isRemoteAgentHostSessionType(sessionType) ? "remote-agent-host" : sessionType;
}
function getHarnessForTelemetry(sessionResource) {
  return parseRemoteAgentHostHarness(getChatSessionType(sessionResource));
}
export {
  ChatRequestTelemetry,
  ChatServiceTelemetry
};
