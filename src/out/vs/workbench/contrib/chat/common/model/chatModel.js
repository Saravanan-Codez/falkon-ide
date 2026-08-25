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
import { asArray } from "../../../../../base/common/arrays.js";
import { softAssertNever } from "../../../../../base/common/assert.js";
import { VSBuffer, decodeHex, encodeHex } from "../../../../../base/common/buffer.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { appendEscapedMarkdownInlineCode, MarkdownString, isMarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { revive } from "../../../../../base/common/marshalling.js";
import { Schemas } from "../../../../../base/common/network.js";
import { equals } from "../../../../../base/common/objects.js";
import { autorun, constObservable, derived, observableFromEvent, observableSignalFromEvent, observableValue, observableValueOpts, registerAutorunSelfDisposable } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { hasKey } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { OffsetRange } from "../../../../../editor/common/core/ranges/offsetRange.js";
import { localize } from "../../../../../nls.js";
import { canLog, ILogService, LogLevel } from "../../../../../platform/log/common/log.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { IChatRequestVariableEntry, isImplicitVariableEntry, isStringImplicitContextValue, isStringVariableEntry } from "../attachments/chatVariableEntries.js";
import { migrateLegacyTerminalToolSpecificData } from "../chat.js";
import { ChatPerfMark, markChat } from "../chatPerf.js";
import { ChatRequestQueueKind, ChatResponseClearToPreviousToolInvocationReason, ElicitationState, IChatService, IChatToolInvocation, ResponseModelState, ToolConfirmKind, isIUsedContext } from "../chatService/chatService.js";
import { ChatAgentLocation, ChatModeKind } from "../constants.js";
import { ChatToolInvocation } from "./chatProgressTypes/chatToolInvocation.js";
import { ChatPlanReviewData } from "./chatProgressTypes/chatPlanReviewData.js";
import { ChatQuestionCarouselData } from "./chatProgressTypes/chatQuestionCarouselData.js";
import { ToolDataSource } from "../tools/languageModelToolsService.js";
import { IChatEditingService, ModifiedFileEntryState } from "../editing/chatEditingService.js";
import { IChatAgentService, reviveSerializedAgent } from "../participants/chatAgents.js";
import { ChatRequestTextPart, reviveParsedChatRequest } from "../requestParser/chatParserTypes.js";
import { chatSessionResourceToId, LocalChatSessionUri } from "./chatUri.js";
const CHAT_ATTACHABLE_IMAGE_MIME_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp"
};
function getAttachableImageExtension(mimeType) {
  return Object.entries(CHAT_ATTACHABLE_IMAGE_MIME_TYPES).find(([_, value]) => value === mimeType)?.[0];
}
var IChatRequestVariableData;
((IChatRequestVariableData2) => {
  function toExport(data) {
    return { variables: data.variables.map(IChatRequestVariableEntry.toExport) };
  }
  IChatRequestVariableData2.toExport = toExport;
})(IChatRequestVariableData || (IChatRequestVariableData = {}));
function isCellTextEditOperation(value) {
  const candidate = value;
  return !!candidate && !!candidate.edit && !!candidate.uri && URI.isUri(candidate.uri);
}
function isCellTextEditOperationArray(value) {
  return value.some(isCellTextEditOperation);
}
const nonHistoryKinds = /* @__PURE__ */ new Set(["toolInvocation", "toolInvocationSerialized", "undoStop", "voiceProgress"]);
function isChatProgressHistoryResponseContent(content) {
  return !nonHistoryKinds.has(content.kind);
}
function toChatHistoryContent(content) {
  return content.filter(isChatProgressHistoryResponseContent);
}
const defaultChatResponseModelChangeReason = { reason: "other" };
class ChatRequestModel {
  constructor(params) {
    this._shouldBeBlocked = observableValue(this, false);
    this._version = 0;
    this._session = params.session;
    this.message = params.message;
    this._variableData = params.variableData;
    this.requestTimestamp = params.timestamp;
    this.timestamp = params.timestamp ?? params.fallbackTimestamp ?? Date.now();
    this._attempt = params.attempt ?? 0;
    this.modeInfo = params.modeInfo;
    this._confirmation = params.confirmation;
    this._locationData = params.locationData;
    this._attachedContext = params.attachedContext;
    this.isCompleteAddedRequest = params.isCompleteAddedRequest ?? false;
    this.modelId = params.modelId;
    this.id = params.restoredId ?? "request_" + generateUuid();
    this._editedFileEvents = params.editedFileEvents;
    this.userSelectedTools = params.userSelectedTools;
    this.isSystemInitiated = params.isSystemInitiated;
    this.systemInitiatedLabel = params.systemInitiatedLabel;
    this.terminalExecutionId = params.terminalExecutionId;
    this.isTerminalCommand = params.isTerminalCommand ?? false;
  }
  get shouldBeBlocked() {
    return this._shouldBeBlocked;
  }
  setShouldBeBlocked(value) {
    this._shouldBeBlocked.set(value, void 0);
  }
  get session() {
    return this._session;
  }
  get attempt() {
    return this._attempt;
  }
  get variableData() {
    return this._variableData;
  }
  set variableData(v) {
    this._version++;
    this._variableData = v;
  }
  get confirmation() {
    return this._confirmation;
  }
  get locationData() {
    return this._locationData;
  }
  get attachedContext() {
    return this._attachedContext;
  }
  get editedFileEvents() {
    return this._editedFileEvents;
  }
  get version() {
    return this._version;
  }
  adoptTo(session) {
    this._session = session;
  }
}
class AbstractResponse {
  get value() {
    return this._responseParts;
  }
  constructor(value) {
    this._responseParts = value;
  }
  toString() {
    if (this._responseRepr === void 0) {
      this._responseRepr = this.computeRepr();
    }
    return this._responseRepr;
  }
  /**
   * _Just_ the content of markdown parts in the response
   */
  getMarkdown() {
    if (this._markdownContent === void 0) {
      this._markdownContent = this.computeMarkdownContent();
    }
    return this._markdownContent;
  }
  /**
   * The trailing contiguous markdown/inline-reference content of the response,
   * skipping any trailing tool calls or empty markdown parts.
   */
  getFinalResponse() {
    const parts = this._responseParts;
    let i = parts.length - 1;
    while (i >= 0) {
      const part = parts[i];
      if (part.kind === "markdownContent" || part.kind === "markdownVuln") {
        if (part.content.value.length > 0) {
          break;
        }
      } else if (part.kind === "inlineReference") {
        break;
      }
      i--;
    }
    if (i < 0) {
      return "";
    }
    const end = i;
    while (i >= 0) {
      const part = parts[i];
      if (part.kind === "markdownContent" || part.kind === "markdownVuln" || part.kind === "inlineReference") {
        i--;
      } else {
        break;
      }
    }
    const start = i + 1;
    const segments = [];
    for (let j = start; j <= end; j++) {
      const part = parts[j];
      if (part.kind === "inlineReference") {
        segments.push(this.inlineRefToRepr(part));
      } else if (part.kind === "markdownContent" || part.kind === "markdownVuln") {
        if (part.content.value.length > 0) {
          segments.push(part.content.value);
        }
      }
    }
    return segments.join("");
  }
  /**
   * Invalidate cached representations so they are recomputed on next access.
   */
  _invalidateRepr() {
    this._responseRepr = void 0;
    this._markdownContent = void 0;
  }
  computeMarkdownContent() {
    const segments = [];
    for (const part of this._responseParts) {
      if (part.kind === "inlineReference") {
        segments.push(this.inlineRefToRepr(part));
      } else if (part.kind === "markdownContent" || part.kind === "markdownVuln") {
        if (part.content.value.length > 0) {
          segments.push(part.content.value);
        }
      }
    }
    return segments.join("");
  }
  computeRepr() {
    return this.partsToRepr(this._responseParts);
  }
  partsToRepr(parts) {
    const blocks = [];
    let currentBlockSegments = [];
    let hasEditGroupsAfterLastClear = false;
    for (const part of parts) {
      let segment;
      switch (part.kind) {
        case "clearToPreviousToolInvocation":
          currentBlockSegments = [];
          blocks.length = 0;
          hasEditGroupsAfterLastClear = false;
          continue;
        case "treeData":
        case "progressMessage":
        case "codeblockUri":
        case "extensions":
        case "pullRequest":
        case "undoStop":
        case "workspaceEdit":
        case "externalEdit":
        case "elicitation2":
        case "elicitationSerialized":
        case "thinking":
        case "hook":
        case "voiceProgress":
        case "multiDiffData":
        case "mcpServersStarting":
        case "mcpAuthenticationRequired":
        case "mcpServersStartingSlow":
        case "questionCarousel":
        case "planReview":
        case "disabledClaudeHooks":
        case "autoModeResolution":
          continue;
        case "systemNotification":
          segment = { text: part.content.value, isBlock: true };
          break;
        case "toolInvocation":
        case "toolInvocationSerialized":
          segment = this.getToolInvocationText(part);
          break;
        case "inlineReference":
          segment = { text: this.inlineRefToRepr(part) };
          break;
        case "command":
          segment = { text: part.command.title, isBlock: true };
          break;
        case "textEditGroup":
        case "notebookEditGroup":
          hasEditGroupsAfterLastClear = true;
          continue;
        case "confirmation":
          if (part.message instanceof MarkdownString) {
            segment = { text: `${part.title}
${part.message.value}`, isBlock: true };
            break;
          }
          segment = { text: `${part.title}
${part.message}`, isBlock: true };
          break;
        case "markdownContent":
        case "markdownVuln":
        case "progressTask":
        case "progressTaskSerialized":
        case "warning":
        case "info":
          segment = { text: part.content.value };
          break;
        default:
          softAssertNever(part);
          continue;
      }
      if (segment.isBlock) {
        if (currentBlockSegments.length) {
          blocks.push(currentBlockSegments.join(""));
          currentBlockSegments = [];
        }
        blocks.push(segment.text);
      } else {
        currentBlockSegments.push(segment.text);
      }
    }
    if (currentBlockSegments.length) {
      blocks.push(currentBlockSegments.join(""));
    }
    if (hasEditGroupsAfterLastClear) {
      blocks.push(localize("editsSummary", "Made changes."));
    }
    return blocks.join("\n\n");
  }
  inlineRefToRepr(part) {
    if ("uri" in part.inlineReference) {
      return this.uriToRepr(part.inlineReference.uri, part.inlineReference.range);
    }
    return "name" in part.inlineReference ? appendEscapedMarkdownInlineCode(part.inlineReference.name) : this.uriToRepr(part.inlineReference);
  }
  getToolInvocationText(toolInvocation) {
    const getTerminalDisplayInput = (terminalData) => terminalData.presentationOverrides?.commandLine ?? terminalData.commandLine.forDisplay ?? terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
    let message = "";
    let input = "";
    if (toolInvocation.pastTenseMessage) {
      message = typeof toolInvocation.pastTenseMessage === "string" ? toolInvocation.pastTenseMessage : toolInvocation.pastTenseMessage.value;
    } else {
      message = typeof toolInvocation.invocationMessage === "string" ? toolInvocation.invocationMessage : toolInvocation.invocationMessage.value;
    }
    if (toolInvocation.toolSpecificData) {
      if (toolInvocation.toolSpecificData.kind === "terminal") {
        message = "Ran terminal command";
        const terminalData = migrateLegacyTerminalToolSpecificData(toolInvocation.toolSpecificData);
        input = getTerminalDisplayInput(terminalData);
      }
    }
    let text = message;
    if (input) {
      text += `: ${input}`;
    }
    if (toolInvocation.kind === "toolInvocationSerialized" || toolInvocation.kind === "toolInvocation" && IChatToolInvocation.isComplete(toolInvocation)) {
      const resultDetails = IChatToolInvocation.resultDetails(toolInvocation);
      if (resultDetails && "input" in resultDetails) {
        const resultPrefix = toolInvocation.kind === "toolInvocationSerialized" || IChatToolInvocation.isComplete(toolInvocation) ? "Completed" : "Errored";
        const resultInput = toolInvocation.toolSpecificData?.kind === "terminal" ? getTerminalDisplayInput(migrateLegacyTerminalToolSpecificData(toolInvocation.toolSpecificData)) : resultDetails.input;
        text += `
${resultPrefix} with input: ${resultInput}`;
      }
    }
    return { text, isBlock: true };
  }
  /**
   * Renders a reference the way the response showed it — the file name plus any line suffix —
   * as code, so a name containing `*` or `_` survives being pasted into another document.
   */
  uriToRepr(uri, range) {
    if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
      return uri.toString(false);
    }
    const suffix = !range ? "" : range.startLineNumber === range.endLineNumber ? `:${range.startLineNumber}` : `:${range.startLineNumber}-${range.endLineNumber}`;
    return appendEscapedMarkdownInlineCode(basename(uri) + suffix);
  }
}
class ResponseView extends AbstractResponse {
  constructor(_response, undoStop) {
    let idx = _response.value.findIndex((v) => v.kind === "undoStop" && v.id === undoStop);
    if (_response.value[idx + 1]?.kind === "codeblockUri" && _response.value[idx - 1]?.kind === "markdownContent") {
      idx--;
    }
    super(idx === -1 ? _response.value.slice() : _response.value.slice(0, idx));
    this.undoStop = undoStop;
  }
}
class Response extends AbstractResponse {
  constructor(value) {
    super(asArray(value).map((v) => "kind" in v ? v : isMarkdownString(v) ? { content: v, kind: "markdownContent" } : { kind: "treeData", treeData: v }));
    this._store = new DisposableStore();
    this._onDidChangeValue = this._store.add(new Emitter());
    this._citations = [];
  }
  get onDidChangeValue() {
    return this._onDidChangeValue.event;
  }
  dispose() {
    this._store.dispose();
  }
  clear() {
    this.finalizeReasoningDuration();
    this._responseParts = [];
    this._contentChanged(true);
  }
  clearToPreviousToolInvocation(message) {
    this.finalizeReasoningDuration();
    let lastToolInvocationIndex = -1;
    for (let i = this._responseParts.length - 1; i >= 0; i--) {
      const part = this._responseParts[i];
      if (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") {
        lastToolInvocationIndex = i;
        break;
      }
    }
    if (lastToolInvocationIndex !== -1) {
      this._responseParts = this._responseParts.slice(0, lastToolInvocationIndex + 1);
    } else {
      this._responseParts = [];
    }
    if (message) {
      this._responseParts.push({ kind: "warning", content: new MarkdownString(message) });
    }
    this._contentChanged(true);
  }
  updateContent(progress, quiet) {
    if (progress.kind !== "thinking") {
      this.finalizeReasoningDuration();
    }
    if (progress.kind === "clearToPreviousToolInvocation") {
      if (progress.reason === ChatResponseClearToPreviousToolInvocationReason.CopyrightContentRetry) {
        this.clearToPreviousToolInvocation(localize("copyrightContentRetry", "Response cleared due to possible match to public code, retrying with modified prompt."));
      } else if (progress.reason === ChatResponseClearToPreviousToolInvocationReason.FilteredContentRetry) {
        this.clearToPreviousToolInvocation(localize("filteredContentRetry", "Response cleared due to content safety filters, retrying with modified prompt."));
      } else {
        this.clearToPreviousToolInvocation();
      }
      return;
    } else if (progress.kind === "markdownContent") {
      const lastResponsePart = this._responseParts.filter((p) => p.kind !== "textEditGroup" && !isNestedSubagentResponsePart(p)).at(-1);
      if (!lastResponsePart || lastResponsePart.kind !== "markdownContent" || !canMergeMarkdownStrings(lastResponsePart.content, progress.content)) {
        this._responseParts.push(progress);
      } else {
        const idx = this._responseParts.indexOf(lastResponsePart);
        this._responseParts[idx] = { ...lastResponsePart, content: appendMarkdownString(lastResponsePart.content, progress.content) };
      }
      this._contentChanged(quiet);
    } else if (progress.kind === "thinking") {
      const lastResponsePart = this._responseParts.filter((p) => p.kind !== "textEditGroup").at(-1);
      const lastText = lastResponsePart && lastResponsePart.kind === "thinking" ? Array.isArray(lastResponsePart.value) ? lastResponsePart.value.join("") : lastResponsePart.value || "" : "";
      const currText = Array.isArray(progress.value) ? progress.value.join("") : progress.value || "";
      const isEmpty = (s) => s.length === 0;
      if (isEmpty(currText)) {
        this.finalizeReasoningDuration();
      } else if (!this._activeReasoning) {
        this._activeReasoning = { part: progress, startedAt: Date.now() };
      }
      if (!lastResponsePart || lastResponsePart.kind !== "thinking" || isEmpty(currText) || isEmpty(lastText) || !canMergeMarkdownStrings(new MarkdownString(lastText), new MarkdownString(currText))) {
        this._responseParts.push(progress);
      } else {
        const idx = this._responseParts.indexOf(lastResponsePart);
        const mergedPart = {
          ...lastResponsePart,
          value: appendMarkdownString(new MarkdownString(lastText), new MarkdownString(currText)).value
        };
        this._responseParts[idx] = mergedPart;
        if (this._activeReasoning?.part === lastResponsePart) {
          this._activeReasoning.part = mergedPart;
        }
      }
      this._contentChanged(quiet);
    } else if (progress.kind === "textEdit" || progress.kind === "notebookEdit") {
      const notebookUri = CellUri.parse(progress.uri)?.notebook;
      const uri = notebookUri ?? progress.uri;
      const isExternalEdit = progress.isExternalEdit;
      if (progress.kind === "textEdit" && !notebookUri) {
        this._mergeOrPushTextEditGroup(uri, progress.edits, progress.done, isExternalEdit);
      } else if (progress.kind === "textEdit") {
        const cellEdits = progress.edits.map((edit) => ({ uri: progress.uri, edit }));
        this._mergeOrPushNotebookEditGroup(uri, cellEdits, progress.done, isExternalEdit);
      } else {
        this._mergeOrPushNotebookEditGroup(uri, progress.edits, progress.done, isExternalEdit);
      }
      this._contentChanged(quiet);
    } else if (progress.kind === "progressTask") {
      const responsePosition = this._responseParts.push(progress) - 1;
      this._contentChanged(quiet);
      const disp = progress.onDidAddProgress(() => {
        this._contentChanged(false);
      });
      progress.task?.().then((content) => {
        disp.dispose();
        if (typeof content === "string") {
          this._responseParts[responsePosition].content = new MarkdownString(content);
        }
        this._contentChanged(false);
      });
    } else if (progress.kind === "toolInvocation") {
      registerAutorunSelfDisposable(this._store, (reader) => {
        progress.state.read(reader);
        this._contentChanged(false);
        if (IChatToolInvocation.isComplete(progress, reader)) {
          reader.dispose();
        }
      });
      this._responseParts.push(progress);
      this._contentChanged(quiet);
    } else if (progress.kind === "externalToolInvocationUpdate") {
      this._handleExternalToolInvocationUpdate(progress);
      this._contentChanged(quiet);
    } else if (progress.kind === "progressMessage" && progress.id !== void 0) {
      const idx = this._responseParts.findIndex((p) => p.kind === "progressMessage" && p.id === progress.id);
      if (idx === -1) {
        this._responseParts.push(progress);
      } else {
        this._responseParts[idx] = progress;
      }
      this._contentChanged(quiet);
    } else {
      this._responseParts.push(progress);
      this._contentChanged(quiet);
    }
  }
  /**
   * Persists the duration of the active reasoning interval.
   */
  finalizeReasoningDuration() {
    if (!this._activeReasoning) {
      return;
    }
    this._activeReasoning.part.reasoningDurationMs = Math.max(0, Date.now() - this._activeReasoning.startedAt);
    this._activeReasoning = void 0;
  }
  addCitation(citation) {
    this._citations.push(citation);
    this._contentChanged();
  }
  resolveInlineReference(resolveId, resolvedReference) {
    for (let i = 0; i < this._responseParts.length; i++) {
      const current = this._responseParts[i];
      if (current.kind !== "inlineReference" || current.resolveId !== resolveId) {
        continue;
      }
      this._responseParts[i] = {
        ...current,
        inlineReference: resolvedReference.inlineReference,
        name: resolvedReference.name ?? current.name
      };
      this._contentChanged();
      return true;
    }
    return false;
  }
  _mergeOrPushTextEditGroup(uri, edits, done, isExternalEdit) {
    for (const candidate of this._responseParts) {
      if (candidate.kind === "textEditGroup" && !candidate.done && isEqual(candidate.uri, uri)) {
        candidate.edits.push(edits);
        candidate.done = done;
        return;
      }
    }
    this._responseParts.push({ kind: "textEditGroup", uri, edits: [edits], done, isExternalEdit });
  }
  _mergeOrPushNotebookEditGroup(uri, edits, done, isExternalEdit) {
    for (const candidate of this._responseParts) {
      if (candidate.kind === "notebookEditGroup" && !candidate.done && isEqual(candidate.uri, uri)) {
        candidate.edits.push(edits);
        candidate.done = done;
        return;
      }
    }
    this._responseParts.push({ kind: "notebookEditGroup", uri, edits: [edits], done, isExternalEdit });
  }
  _handleExternalToolInvocationUpdate(progress) {
    const existingInvocation = this._responseParts.findLast(
      (part) => part.kind === "toolInvocation" && part.toolCallId === progress.toolCallId
    );
    if (existingInvocation) {
      if (progress.toolSpecificData !== void 0) {
        existingInvocation.toolSpecificData = progress.toolSpecificData;
      }
      if (progress.isComplete) {
        existingInvocation.didExecuteTool({
          content: [],
          toolResultMessage: progress.pastTenseMessage,
          toolResultError: progress.errorMessage,
          toolResultDetails: progress.resultDetails
        });
      }
      return;
    }
    const toolData = {
      id: progress.toolName,
      source: ToolDataSource.External,
      displayName: progress.toolName,
      modelDescription: progress.toolName
    };
    const invocation = new ChatToolInvocation(
      {
        invocationMessage: progress.invocationMessage,
        pastTenseMessage: progress.pastTenseMessage,
        toolSpecificData: progress.toolSpecificData
      },
      toolData,
      progress.toolCallId,
      progress.subagentInvocationId,
      void 0,
      // parameters
      {},
      void 0
      // chatRequestId
    );
    if (progress.isComplete) {
      if (progress.toolSpecificData !== void 0) {
        invocation.toolSpecificData = progress.toolSpecificData;
      }
      invocation.didExecuteTool({
        content: [],
        toolResultMessage: progress.pastTenseMessage,
        toolResultError: progress.errorMessage,
        toolResultDetails: progress.resultDetails
      });
    }
    this._responseParts.push(invocation);
  }
  computeRepr() {
    let repr = super.computeRepr();
    if (this._citations.length) {
      repr += "\n\n" + getCodeCitationsMessage(this._citations);
    }
    return repr;
  }
  _contentChanged(quiet) {
    this._invalidateRepr();
    if (!quiet) {
      this._onDidChangeValue.fire();
    }
  }
}
function sumModelOutputTokens(modelTotals) {
  return modelTotals?.reduce((total, entry) => total + entry.outputTokens, 0);
}
class ChatResponseModel extends Disposable {
  constructor(params) {
    super();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._modelState = observableValue(this, { value: ResponseModelState.Pending });
    this._usageObs = observableValue(this, void 0);
    this._subagentCopilotCredits = /* @__PURE__ */ new Map();
    this._completionTokenCountObs = observableValue(this, void 0);
    this._shouldBeBlocked = observableValue(this, false);
    this._contentReferences = [];
    this._codeCitations = [];
    this._progressMessages = [];
    this._isStale = false;
    this._session = params.session;
    this._agent = params.agent;
    this._slashCommand = params.slashCommand;
    this.requestId = params.requestId;
    this._timestamp = params.timestamp || Date.now();
    if (params.modelState) {
      this._modelState.set(params.modelState, void 0);
    }
    this._completionTimestamp = params.completionTimestamp === null ? void 0 : params.completionTimestamp ?? (params.modelState && "completedAt" in params.modelState ? params.modelState.completedAt : void 0);
    this._timeSpentWaitingAccumulator = params.timeSpentWaiting || 0;
    this._elapsedMs = params.elapsedMs;
    this._vote = params.vote;
    this._result = params.result;
    this._followups = params.followups ? [...params.followups] : void 0;
    this.isCompleteAddedRequest = params.isCompleteAddedRequest ?? false;
    this._shouldBeRemovedOnSend = params.shouldBeRemovedOnSend;
    this._shouldBeBlocked.set(params.shouldBeBlocked ?? false, void 0);
    this._isStale = Array.isArray(params.responseContent) && (params.responseContent.length !== 0 || isMarkdownString(params.responseContent) && params.responseContent.value.length !== 0);
    this._response = this._register(new Response(params.responseContent));
    this._codeBlockInfos = params.codeBlockInfos ? [...params.codeBlockInfos] : void 0;
    const signal = observableSignalFromEvent(this, this.onDidChange);
    const _pendingInfo = signal.map((_value, r) => {
      signal.read(r);
      for (const part of this._response.value) {
        if (part.kind === "toolInvocation") {
          const state = part.state.read(r);
          if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation) {
            const title = state.confirmationMessages?.title;
            return title ? isMarkdownString(title) ? title.value : title : void 0;
          }
          if (state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
            return localize("waitingForPostApproval", "Approve tool result?");
          }
          if (state.type === IChatToolInvocation.StateKind.WaitingForAuthentication) {
            return localize("waitingForToolAuthentication", "Authenticate {0} to continue...", state.server.name);
          }
        }
        if (part.kind === "confirmation" && !part.isUsed) {
          return part.title;
        }
        if (part.kind === "questionCarousel" && !part.isUsed) {
          return localize("waitingAnswer", "Answer questions to continue...");
        }
        if (part.kind === "planReview" && !part.isUsed) {
          return localize("waitingPlanReview", "Review the plan to continue...");
        }
        if (part.kind === "elicitation2" && part.state.read(r) === ElicitationState.Pending) {
          const title = part.title;
          return isMarkdownString(title) ? title.value : title;
        }
      }
      return void 0;
    });
    const _startedWaitingAt = _pendingInfo.map((p) => !!p).map((p) => p ? Date.now() : void 0);
    this.isPendingConfirmation = _startedWaitingAt.map((waiting, r) => waiting ? { startedWaitingAt: waiting, detail: _pendingInfo.read(r) } : void 0);
    this.isInProgress = signal.map((_value, r) => {
      signal.read(r);
      return !_pendingInfo.read(r) && !this.shouldBeRemovedOnSend && (this._modelState.read(r).value === ResponseModelState.Pending || this._modelState.read(r).value === ResponseModelState.NeedsInput);
    });
    this.isIncomplete = this._modelState.map((state) => {
      return state.value === ResponseModelState.Pending || state.value === ResponseModelState.NeedsInput;
    });
    this._register(this._response.onDidChangeValue(() => this._onDidChange.fire(defaultChatResponseModelChangeReason)));
    this.id = params.restoredId ?? "response_" + generateUuid();
    let lastStartedWaitingAt = void 0;
    this.confirmationAdjustedTimestamp = derived((reader) => {
      const pending = this.isPendingConfirmation.read(reader);
      if (pending) {
        this._modelState.set({ value: ResponseModelState.NeedsInput }, void 0);
        if (!lastStartedWaitingAt) {
          lastStartedWaitingAt = pending.startedWaitingAt;
        }
      } else if (lastStartedWaitingAt) {
        if (this._modelState.read(reader).value === ResponseModelState.NeedsInput) {
          this._modelState.set({ value: ResponseModelState.Pending }, void 0);
        }
        this._timeSpentWaitingAccumulator += Date.now() - lastStartedWaitingAt;
        lastStartedWaitingAt = void 0;
      }
      return this._timestamp + this._timeSpentWaitingAccumulator;
    }).recomputeInitiallyAndOnChange(this._store);
  }
  get shouldBeBlocked() {
    return this._shouldBeBlocked;
  }
  get request() {
    return this.session.getRequests().find((r) => r.id === this.requestId);
  }
  get session() {
    return this._session;
  }
  get shouldBeRemovedOnSend() {
    return this._shouldBeRemovedOnSend;
  }
  get isComplete() {
    return this._modelState.get().value !== ResponseModelState.Pending && this._modelState.get().value !== ResponseModelState.NeedsInput;
  }
  get timestamp() {
    return this._timestamp;
  }
  set shouldBeRemovedOnSend(disablement) {
    if (this._shouldBeRemovedOnSend === disablement) {
      return;
    }
    this._shouldBeRemovedOnSend = disablement;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  get isCanceled() {
    return this._modelState.get().value === ResponseModelState.Cancelled;
  }
  get completedAt() {
    const state = this._modelState.get();
    if (state.value === ResponseModelState.Complete || state.value === ResponseModelState.Cancelled || state.value === ResponseModelState.Failed) {
      return state.completedAt;
    }
    return void 0;
  }
  get completionTimestamp() {
    return this._completionTimestamp;
  }
  get state() {
    const state = this._modelState.get().value;
    if (state === ResponseModelState.Complete && !!this._result?.errorDetails && this.result?.errorDetails?.code !== "canceled") {
      return ResponseModelState.Failed;
    }
    return state;
  }
  get stateT() {
    return this._modelState.get();
  }
  get vote() {
    return this._vote;
  }
  get followups() {
    return this._followups;
  }
  get entireResponse() {
    return this._finalizedResponse || this._response;
  }
  get result() {
    return this._result;
  }
  get usage() {
    return this._usageObs.get();
  }
  get usageObs() {
    return this._usageObs;
  }
  get completionTokenCount() {
    return this._completionTokenCountObs.get();
  }
  get completionTokenCountObs() {
    return this._completionTokenCountObs;
  }
  get elapsedMs() {
    return this._elapsedMs;
  }
  get username() {
    return this.session.responderUsername;
  }
  get agent() {
    return this._agent;
  }
  get slashCommand() {
    return this._slashCommand;
  }
  get agentOrSlashCommandDetected() {
    return this._agentOrSlashCommandDetected ?? false;
  }
  get usedContext() {
    return this._usedContext;
  }
  get contentReferences() {
    return Array.from(this._contentReferences);
  }
  get codeCitations() {
    return this._codeCitations;
  }
  get progressMessages() {
    return this._progressMessages;
  }
  get isStale() {
    return this._isStale;
  }
  get response() {
    const undoStop = this._shouldBeRemovedOnSend?.afterUndoStop;
    if (!undoStop) {
      return this._finalizedResponse || this._response;
    }
    if (this._responseView?.undoStop !== undoStop) {
      this._responseView = new ResponseView(this._response, undoStop);
    }
    return this._responseView;
  }
  get codeBlockInfos() {
    return this._codeBlockInfos;
  }
  initializeCodeBlockInfos(codeBlockInfo) {
    if (this._codeBlockInfos) {
      throw new BugIndicatingError("Code block infos have already been initialized");
    }
    this._codeBlockInfos = [...codeBlockInfo];
  }
  setBlockedState(isBlocked) {
    this._shouldBeBlocked.set(isBlocked, void 0);
  }
  /**
   * Apply a progress update to the actual response content.
   */
  updateContent(responsePart, quiet) {
    this._response.updateContent(responsePart, quiet);
  }
  resolveInlineReference(resolveId, resolvedReference) {
    return this._response.resolveInlineReference(resolveId, resolvedReference);
  }
  /**
   * Adds an undo stop at the current position in the stream.
   */
  addUndoStop(undoStop) {
    this._onDidChange.fire({ reason: "undoStop", id: undoStop.id });
    this._response.updateContent(undoStop, true);
  }
  /**
   * Apply one of the progress updates that are not part of the actual response content.
   */
  applyReference(progress) {
    if (progress.kind === "usedContext") {
      this._usedContext = progress;
    } else if (progress.kind === "reference") {
      this._contentReferences.push(progress);
      this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
  }
  applyCodeCitation(progress) {
    this._codeCitations.push(progress);
    this._response.addCitation(progress);
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setAgent(agent, slashCommand) {
    this._agent = agent;
    this._slashCommand = slashCommand;
    this._agentOrSlashCommandDetected = !agent.isDefault || !!slashCommand;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setResult(result) {
    if (this.isCanceled && result.errorDetails) {
      const { errorDetails: _errorDetails, ...rest } = result;
      this._result = rest;
    } else {
      this._result = result;
    }
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setUsage(usage) {
    this._parentUsage = usage;
    this._setUsage(this._withSubagentCopilotCredits(usage), true);
  }
  setSubagentCopilotCredits(subagentCallId, copilotCredits) {
    const currentCredits = this._subagentCopilotCredits.get(subagentCallId);
    if (!Number.isFinite(copilotCredits) || copilotCredits < 0 || currentCredits !== void 0 && copilotCredits <= currentCredits) {
      return;
    }
    this._subagentCopilotCredits.set(subagentCallId, copilotCredits);
    const usage = this._parentUsage ?? { kind: "usage", promptTokens: 0, completionTokens: 0 };
    this._setUsage(this._withSubagentCopilotCredits(usage), false);
  }
  _withSubagentCopilotCredits(usage) {
    let subagentCopilotCredits = 0;
    for (const credits of this._subagentCopilotCredits.values()) {
      subagentCopilotCredits += credits;
    }
    return subagentCopilotCredits === 0 ? usage : { ...usage, copilotCredits: (usage.copilotCredits ?? 0) + subagentCopilotCredits };
  }
  _setUsage(usage, countCompletionTokens) {
    const currentUsage = this._usageObs.get();
    if (currentUsage && this.isSameUsage(currentUsage, usage)) {
      return;
    }
    const isNewCall = !currentUsage || currentUsage.promptTokens !== usage.promptTokens || currentUsage.completionTokens !== usage.completionTokens || currentUsage.outputBuffer !== usage.outputBuffer;
    this._usageObs.set(usage, void 0);
    const reportedOutputTokens = sumModelOutputTokens(usage.modelTotals);
    if (reportedOutputTokens !== void 0) {
      this._completionTokenCountObs.set(reportedOutputTokens, void 0);
    } else if (countCompletionTokens && isNewCall) {
      const previousCompletionTokens = this._completionTokenCountObs.get() ?? 0;
      this._completionTokenCountObs.set(previousCompletionTokens + usage.completionTokens, void 0);
    }
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setElapsedMs(elapsedMs) {
    this._elapsedMs = Math.max(0, elapsedMs);
  }
  isSameUsage(currentUsage, usage) {
    return currentUsage.promptTokens === usage.promptTokens && currentUsage.completionTokens === usage.completionTokens && currentUsage.outputBuffer === usage.outputBuffer && currentUsage.copilotCredits === usage.copilotCredits && currentUsage.sessionCopilotCredits === usage.sessionCopilotCredits && equals(currentUsage.promptTokenDetails, usage.promptTokenDetails) && equals(currentUsage.modelTotals, usage.modelTotals);
  }
  complete(completedAt = Date.now()) {
    this._complete(completedAt, completedAt);
  }
  completeWithoutTimestamp() {
    this._complete(Date.now(), void 0);
  }
  _complete(completedAt, completionTimestamp) {
    if (this.isComplete) {
      return;
    }
    if (this._result?.errorDetails?.responseIsRedacted) {
      this._response.clear();
    }
    this._response.finalizeReasoningDuration();
    this._elapsedMs ??= Math.max(0, completedAt - this.confirmationAdjustedTimestamp.get());
    const state = !!this._result?.errorDetails && this._result.errorDetails.code !== "canceled" ? ResponseModelState.Failed : ResponseModelState.Complete;
    this._completionTimestamp = completionTimestamp;
    this._modelState.set({ value: state, completedAt }, void 0);
    this._onDidChange.fire({ reason: "completedRequest" });
  }
  cancel() {
    this._response.finalizeReasoningDuration();
    for (const part of this._response.value) {
      if (part.kind === "toolInvocation" && part instanceof ChatToolInvocation) {
        part.cancelFromStreaming(ToolConfirmKind.Skipped);
      } else if (part instanceof ChatPlanReviewData) {
        part.dismiss();
      } else if (part instanceof ChatQuestionCarouselData) {
        part.dismiss(void 0);
      }
    }
    const completedAt = Date.now();
    this._elapsedMs ??= Math.max(0, completedAt - this.confirmationAdjustedTimestamp.get());
    this._completionTimestamp = completedAt;
    this._modelState.set({ value: ResponseModelState.Cancelled, completedAt }, void 0);
    this._onDidChange.fire({ reason: "completedRequest" });
  }
  setFollowups(followups) {
    this._followups = followups;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setVote(vote) {
    this._vote = vote;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setEditApplied(edit, editCount) {
    if (!this.response.value.includes(edit)) {
      return false;
    }
    if (!edit.state) {
      return false;
    }
    edit.state.applied = editCount;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
    return true;
  }
  adoptTo(session) {
    this._session = session;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  finalizeUndoState() {
    this._finalizedResponse = this.response;
    this._responseView = void 0;
    this._shouldBeRemovedOnSend = void 0;
  }
  dispose() {
    super.dispose();
    this._response.clear();
    if (this._codeBlockInfos) {
      this._codeBlockInfos.length = 0;
    }
  }
  toJSON() {
    const modelState = this._modelState.get();
    const pendingConfirmation = this.isPendingConfirmation.get();
    return {
      responseId: this.id,
      result: this.result,
      responseMarkdownInfo: this.codeBlockInfos?.map((info) => ({ suggestionId: info.suggestionId })),
      followups: this.followups,
      modelState: modelState.value === ResponseModelState.Pending || modelState.value === ResponseModelState.NeedsInput ? { value: ResponseModelState.Cancelled, completedAt: Date.now() } : modelState,
      vote: this.vote,
      slashCommand: this.slashCommand,
      usedContext: this.usedContext,
      contentReferences: this.contentReferences,
      codeCitations: this.codeCitations,
      responseTimestamp: this._timestamp,
      timeSpentWaiting: (pendingConfirmation ? Date.now() - pendingConfirmation.startedWaitingAt : 0) + this._timeSpentWaitingAccumulator,
      promptTokens: this.usage?.promptTokens,
      completionTokens: this.completionTokenCount,
      outputBuffer: this.usage?.outputBuffer,
      promptTokenDetails: this.usage?.promptTokenDetails,
      copilotCredits: this.usage?.copilotCredits,
      modelTotals: this.usage?.modelTotals,
      sessionCopilotCredits: this.usage?.sessionCopilotCredits,
      elapsedMs: this.elapsedMs ?? (this.completedAt ? Math.max(0, this.completedAt - this.confirmationAdjustedTimestamp.get()) : void 0)
    };
  }
}
var ChatInputStateOrigin = /* @__PURE__ */ ((ChatInputStateOrigin2) => {
  ChatInputStateOrigin2["Remote"] = "remote";
  return ChatInputStateOrigin2;
})(ChatInputStateOrigin || {});
function reviveSerializableInputState(state) {
  return {
    attachments: (state.attachments ?? []).map(IChatRequestVariableEntry.fromExport),
    mode: state.mode,
    selectedModel: state.selectedModel && {
      identifier: state.selectedModel.identifier,
      metadata: state.selectedModel.metadata
    },
    modelConfiguration: state.selectedModel ? state.selectedModel.modelConfiguration ?? state.modelConfiguration : void 0,
    contrib: state.contrib,
    inputText: state.inputText,
    selections: state.selections,
    permissionLevel: state.permissionLevel
  };
}
function normalizeSerializableChatData(raw) {
  normalizeOldFields(raw);
  if (!("version" in raw)) {
    return {
      version: 3,
      ...raw,
      customTitle: void 0
    };
  }
  if (raw.version === 2) {
    return {
      ...raw,
      version: 3,
      customTitle: raw.computedTitle
    };
  }
  return raw;
}
function normalizeOldFields(raw) {
  if (!raw.sessionId) {
    raw.sessionId = generateUuid();
  }
  if (!raw.creationDate) {
    raw.creationDate = getLastYearDate();
  }
  if (raw.initialLocation === "editing-session") {
    raw.initialLocation = ChatAgentLocation.Chat;
  }
}
function getLastYearDate() {
  const lastYearDate = /* @__PURE__ */ new Date();
  lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
  return lastYearDate.getTime();
}
function isExportableSessionData(obj) {
  return !!obj && Array.isArray(obj.requests) && typeof obj.responderUsername === "string";
}
function extractExportableSessionData(data) {
  return {
    initialLocation: data.initialLocation,
    requests: data.requests,
    responderUsername: data.responderUsername
  };
}
function isSerializableSessionData(obj) {
  const data = obj;
  return isExportableSessionData(obj) && typeof data.creationDate === "number" && typeof data.sessionId === "string" && obj.requests.every(
    (request) => !request.usedContext || isIUsedContext(request.usedContext)
  );
}
var ChatRequestRemovalReason = /* @__PURE__ */ ((ChatRequestRemovalReason2) => {
  ChatRequestRemovalReason2[ChatRequestRemovalReason2["Removal"] = 0] = "Removal";
  ChatRequestRemovalReason2[ChatRequestRemovalReason2["Resend"] = 1] = "Resend";
  ChatRequestRemovalReason2[ChatRequestRemovalReason2["Adoption"] = 2] = "Adoption";
  return ChatRequestRemovalReason2;
})(ChatRequestRemovalReason || {});
class InputModel {
  constructor(initialState, logger, sessionId) {
    this.logger = logger;
    this.sessionId = sessionId;
    this._state = observableValueOpts({ debugName: "inputModelState", equalsFn: equals }, initialState);
    this.state = this._state;
  }
  setState(state) {
    const current = this._state.get();
    _logChangesToStateModel(state, current, this.logger, this.sessionId);
    this._state.set({
      // If current is undefined, provide defaults for required fields
      attachments: [],
      mode: { id: "agent", kind: ChatModeKind.Agent },
      selectedModel: void 0,
      inputText: "",
      selections: [],
      contrib: {},
      ...current,
      ...state,
      origin: state.origin
    }, void 0);
  }
  clearState() {
    this._state.set(void 0, void 0);
  }
  toJSON() {
    const value = this.state.get();
    if (!value) {
      return void 0;
    }
    const persistableAttachments = value.attachments.filter((attachment) => {
      if (isStringVariableEntry(attachment)) {
        return false;
      }
      if (isImplicitVariableEntry(attachment) && isStringImplicitContextValue(attachment.value)) {
        return false;
      }
      return true;
    });
    return {
      contrib: value.contrib,
      attachments: persistableAttachments.map(IChatRequestVariableEntry.toExport),
      mode: value.mode,
      selectedModel: value.selectedModel ? {
        identifier: value.selectedModel.identifier,
        metadata: value.selectedModel.metadata,
        modelConfiguration: value.modelConfiguration
      } : void 0,
      inputText: value.inputText,
      selections: value.selections,
      permissionLevel: value.permissionLevel
    };
  }
}
let ChatModel = class extends Disposable {
  constructor(dataRef, initialModelProps, logService, chatAgentService, chatEditingService, chatService) {
    super();
    this.logService = logService;
    this.chatAgentService = chatAgentService;
    this.chatEditingService = chatEditingService;
    this.chatService = chatService;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._pendingRequests = [];
    this._onDidChangePendingRequests = this._register(new Emitter());
    this.onDidChangePendingRequests = this._onDidChangePendingRequests.event;
    this._isImported = false;
    this._isDeleted = false;
    this._canUseTools = true;
    this.currentEditedFileEvents = new ResourceMap();
    this._checkpoint = void 0;
    const initialData = dataRef?.value;
    const isValidExportedData = isExportableSessionData(initialData);
    const isValidFullData = isValidExportedData && isSerializableSessionData(initialData);
    if (initialData && !isValidExportedData) {
      this.logService.warn(`ChatModel#constructor: Loaded malformed session data: ${JSON.stringify(initialData)}`);
    }
    this._isImported = !!initialData && isValidExportedData && !isValidFullData;
    if (initialModelProps.resource) {
      this._sessionId = chatSessionResourceToId(initialModelProps.resource);
      this._sessionResource = initialModelProps.resource;
    } else if (isValidFullData) {
      this._sessionId = initialData.sessionId;
      this._sessionResource = LocalChatSessionUri.forSession(initialData.sessionId);
    } else {
      this._sessionId = generateUuid();
      this._sessionResource = LocalChatSessionUri.forSession(this._sessionId);
    }
    this._disableBackgroundKeepAlive = initialModelProps.disableBackgroundKeepAlive ?? false;
    this._timestamp = isValidFullData && initialData.creationDate || Date.now();
    this._requests = initialData ? this._deserialize(initialData) : [];
    this._customTitle = isValidFullData ? initialData.customTitle : void 0;
    const serializedInputState = initialModelProps.inputState || (isValidFullData && initialData.inputState ? initialData.inputState : void 0);
    this.inputModel = new InputModel(serializedInputState && reviveSerializableInputState(serializedInputState), this.logService, this._sessionId);
    this.dataSerializer = dataRef?.serializer;
    this._initialResponderUsername = initialData?.responderUsername;
    this._repoData = isValidFullData && initialData.repoData ? initialData.repoData : void 0;
    this._workingDirectory = isValidFullData && initialData.workingDirectory ? URI.parse(initialData.workingDirectory) : void 0;
    if (isValidFullData && initialData.pendingRequests) {
      this._pendingRequests = this._deserializePendingRequests(initialData.pendingRequests);
    }
    this._initialLocation = initialData?.initialLocation ?? initialModelProps.initialLocation;
    this._canUseTools = initialModelProps.canUseTools;
    this.isReadOnly = initialModelProps.isReadOnly ?? constObservable(false);
    this.lastRequestObs = observableFromEvent(this, this.onDidChange, () => this._requests.at(-1));
    this._register(autorun((reader) => {
      const request = this.lastRequestObs.read(reader);
      if (!request?.response) {
        return;
      }
      reader.store.add(request.response.onDidChange(async (ev) => {
        if (!this._editingSession || ev.reason !== "completedRequest") {
          return;
        }
        this._onDidChange.fire({ kind: "completedRequest", request });
      }));
    }));
    this.requestInProgress = this.lastRequestObs.map((request, r) => {
      return request?.response?.isInProgress.read(r) ?? false;
    });
    this.hasActiveRequest = this.lastRequestObs.map((request, r) => {
      return request?.response?.isIncomplete.read(r) ?? false;
    });
    this.requestNeedsInput = this.lastRequestObs.map((request, r) => {
      const pendingInfo = request?.response?.isPendingConfirmation.read(r);
      if (!pendingInfo) {
        return void 0;
      }
      return {
        title: this.title,
        detail: pendingInfo.detail
      };
    });
    if (this.initialLocation === ChatAgentLocation.Chat && !initialModelProps.disableBackgroundKeepAlive) {
      const selfRef = this._register(new MutableDisposable());
      this._register(autorun((r) => {
        const inProgress = this.requestInProgress.read(r);
        const needsInput = this.requestNeedsInput.read(r);
        const shouldStayAlive = inProgress || !!needsInput;
        if (shouldStayAlive && !selfRef.value) {
          selfRef.value = chatService.acquireExistingSession(this._sessionResource, "ChatModel#requestInProgressKeepAlive");
        } else if (!shouldStayAlive && selfRef.value) {
          selfRef.clear();
        }
      }));
    }
  }
  static getDefaultTitle(requests) {
    const firstRequestMessage = requests.at(0)?.message ?? "";
    const message = typeof firstRequestMessage === "string" ? firstRequestMessage : firstRequestMessage.text;
    return message.split("\n")[0].substring(0, 200);
  }
  get repoData() {
    return this._repoData;
  }
  setRepoData(data) {
    this._repoData = data;
  }
  get workingDirectory() {
    return this._workingDirectory;
  }
  setWorkingDirectory(uri) {
    this._workingDirectory = uri;
  }
  getPendingRequests() {
    return this._pendingRequests;
  }
  setPendingRequests(requests) {
    const existingMap = new Map(this._pendingRequests.map((p) => [p.request.id, p]));
    const newPending = [];
    for (const { requestId, kind } of requests) {
      const existing = existingMap.get(requestId);
      if (existing) {
        newPending.push(existing.kind === kind ? existing : { request: existing.request, kind, sendOptions: existing.sendOptions });
      }
    }
    this._pendingRequests.length = 0;
    this._pendingRequests.push(...newPending);
    this._onDidChangePendingRequests.fire();
  }
  /**
   * @internal Used by ChatService to atomically replace the pending request queue.
   */
  replacePendingRequests(requests) {
    if (this._pendingRequests.length === requests.length && requests.every((request, index) => this._pendingRequests[index] === request)) {
      return;
    }
    this._pendingRequests.length = 0;
    this._pendingRequests.push(...requests);
    this._onDidChangePendingRequests.fire();
  }
  /**
   * @internal Used by ChatService to add a request to the queue.
   * Steering messages are placed before queued messages.
   */
  addPendingRequest(request, kind, sendOptions) {
    const pendingRequest = {
      request,
      kind,
      sendOptions
    };
    if (kind === ChatRequestQueueKind.Steering) {
      let insertIndex = 0;
      for (let i = 0; i < this._pendingRequests.length; i++) {
        if (this._pendingRequests[i].kind === ChatRequestQueueKind.Steering) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }
      this._pendingRequests.splice(insertIndex, 0, pendingRequest);
    } else {
      this._pendingRequests.push(pendingRequest);
    }
    this._onDidChangePendingRequests.fire();
    return pendingRequest;
  }
  /**
   * @internal Used by ChatService to remove a pending request
   */
  removePendingRequest(id) {
    const index = this._pendingRequests.findIndex((r) => r.request.id === id);
    if (index !== -1) {
      this._pendingRequests.splice(index, 1);
      this._onDidChangePendingRequests.fire();
    }
  }
  /**
   * @internal Used by ChatService to dequeue the next pending request
   */
  dequeuePendingRequest() {
    const request = this._pendingRequests.shift();
    if (request) {
      this._onDidChangePendingRequests.fire();
    }
    return request;
  }
  /**
   * @internal Used by ChatService to dequeue all consecutive steering requests at the front of the queue.
   * Returns an empty array if the first pending request is not a steering request.
   */
  dequeueAllSteeringRequests() {
    const steeringRequests = [];
    while (this._pendingRequests.at(0)?.kind === ChatRequestQueueKind.Steering) {
      steeringRequests.push(this._pendingRequests.shift());
    }
    if (steeringRequests.length > 0) {
      this._onDidChangePendingRequests.fire();
    }
    return steeringRequests;
  }
  /**
   * @internal Used by ChatService to clear all pending requests
   */
  clearPendingRequests() {
    if (this._pendingRequests.length > 0) {
      this._pendingRequests.length = 0;
      this._onDidChangePendingRequests.fire();
    }
  }
  /** @deprecated Use {@link sessionResource} instead */
  get sessionId() {
    return this._sessionId;
  }
  get sessionResource() {
    return this._sessionResource;
  }
  get hasRequests() {
    return this._requests.length > 0;
  }
  get lastRequest() {
    return this._requests.at(-1);
  }
  get sessionCost() {
    let summedCredits = 0;
    let reportedSessionCredits = 0;
    for (const request of this._requests) {
      const usage = request.response?.usage;
      if (typeof usage?.copilotCredits === "number") {
        summedCredits += usage.copilotCredits;
      }
      if (typeof usage?.sessionCopilotCredits === "number") {
        reportedSessionCredits = Math.max(reportedSessionCredits, usage.sessionCopilotCredits);
      }
    }
    return Math.max(summedCredits, reportedSessionCredits);
  }
  get timestamp() {
    return this._timestamp;
  }
  get timing() {
    const lastRequest = this._requests.at(-1);
    const lastResponse = lastRequest?.response;
    const lastRequestStarted = lastRequest?.timestamp;
    const lastRequestEnded = lastResponse?.completedAt ?? lastResponse?.timestamp;
    return {
      created: this._timestamp,
      lastRequestStarted,
      lastRequestEnded
    };
  }
  get lastMessageDate() {
    return this._requests.at(-1)?.timestamp ?? this._timestamp;
  }
  get _defaultAgent() {
    return this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, ChatModeKind.Ask);
  }
  get responderUsername() {
    return this._defaultAgent?.fullName ?? this._initialResponderUsername ?? "";
  }
  get isImported() {
    return this._isImported;
  }
  get isDeleted() {
    return this._isDeleted;
  }
  markDeleted() {
    this._isDeleted = true;
  }
  get customTitle() {
    return this._customTitle;
  }
  get title() {
    return this._customTitle || ChatModel.getDefaultTitle(this._requests);
  }
  get hasCustomTitle() {
    return this._customTitle !== void 0;
  }
  get editingSession() {
    return this._editingSession;
  }
  get initialLocation() {
    return this._initialLocation;
  }
  get canUseTools() {
    return this._canUseTools;
  }
  get willKeepAlive() {
    return !this._disableBackgroundKeepAlive;
  }
  startEditingSession(isGlobalEditingSession, transferFromSession) {
    const session = this._editingSession ??= this._register(
      transferFromSession ? this.chatEditingService.transferEditingSession(this, transferFromSession) : isGlobalEditingSession ? this.chatEditingService.startOrContinueGlobalEditingSession(this) : this.chatEditingService.createEditingSession(this)
    );
    if (!this._disableBackgroundKeepAlive) {
      const selfRef = this._register(new MutableDisposable());
      this._register(autorun((r) => {
        const hasModified = session.entries.read(r).some((e) => e.state.read(r) === ModifiedFileEntryState.Modified);
        if (hasModified && !selfRef.value) {
          selfRef.value = this.chatService.acquireExistingSession(this._sessionResource, "ChatModel#modifiedEditsKeepAlive");
        } else if (!hasModified && selfRef.value) {
          selfRef.clear();
        }
      }));
    }
    this._register(autorun((reader) => {
      this._setDisabledRequests(session.requestDisablement.read(reader));
    }));
  }
  notifyEditingAction(action) {
    const state = action.outcome === "accepted" ? 1 /* Keep */ : action.outcome === "rejected" ? 2 /* Undo */ : action.outcome === "userModified" ? 3 /* UserModification */ : null;
    if (state === null) {
      return;
    }
    if (!this.currentEditedFileEvents.has(action.uri) || this.currentEditedFileEvents.get(action.uri)?.eventKind === 1 /* Keep */) {
      this.currentEditedFileEvents.set(action.uri, { eventKind: state, uri: action.uri });
    }
  }
  _deserialize(obj) {
    const requests = hasKey(obj, { serializer: true }) ? obj.value.requests : obj.requests;
    if (!Array.isArray(requests)) {
      this.logService.error(`Ignoring malformed session data: ${JSON.stringify(obj)}`);
      return [];
    }
    try {
      return requests.map((r) => this._deserializeRequest(r));
    } catch (error) {
      this.logService.error("Failed to parse chat data", error);
      return [];
    }
  }
  _deserializeRequest(raw) {
    const parsedRequest = typeof raw.message === "string" ? this.getParsedRequestFromString(raw.message) : reviveParsedChatRequest(raw.message);
    const variableData = this.reviveVariableData(raw.variableData);
    const requestTimestamp = typeof raw.timestamp === "number" && raw.timestamp > 0 ? raw.timestamp : void 0;
    const request = new ChatRequestModel({
      session: this,
      message: parsedRequest,
      variableData,
      timestamp: requestTimestamp,
      fallbackTimestamp: this._timestamp,
      restoredId: raw.requestId,
      confirmation: raw.confirmation,
      editedFileEvents: raw.editedFileEvents,
      modelId: raw.modelId,
      modeInfo: raw.modeInfo,
      isSystemInitiated: raw.isSystemInitiated,
      systemInitiatedLabel: raw.systemInitiatedLabel,
      terminalExecutionId: raw.terminalExecutionId
    });
    request.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
    if (raw.response || raw.result || raw.responseErrorDetails) {
      const agent = raw.agent && "metadata" in raw.agent ? (
        // Check for the new format, ignore entries in the old format
        reviveSerializedAgent(raw.agent)
      ) : void 0;
      const result = "responseErrorDetails" in raw ? (
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        { errorDetails: raw.responseErrorDetails }
      ) : raw.result;
      let modelState = raw.modelState || { value: raw.isCanceled ? ResponseModelState.Cancelled : ResponseModelState.Complete, completedAt: Date.now() };
      if (modelState.value === ResponseModelState.Pending || modelState.value === ResponseModelState.NeedsInput) {
        modelState = { value: ResponseModelState.Cancelled, completedAt: Date.now() };
      }
      if (raw.response) {
        for (const part of raw.response) {
          if (hasKey(part, { kind: true }) && (part.kind === "questionCarousel" || part.kind === "planReview")) {
            part.isUsed = true;
          }
        }
      }
      request.response = new ChatResponseModel({
        responseContent: raw.response ?? [new MarkdownString(raw.response)],
        session: this,
        agent,
        slashCommand: raw.slashCommand,
        requestId: request.id,
        modelState,
        completionTimestamp: raw.modelState && "completedAt" in raw.modelState && Number.isFinite(raw.modelState.completedAt) && raw.modelState.completedAt > 0 ? raw.modelState.completedAt : null,
        vote: raw.vote,
        timestamp: typeof raw.responseTimestamp === "number" && raw.responseTimestamp > 0 ? raw.responseTimestamp : requestTimestamp,
        result,
        followups: raw.followups,
        restoredId: raw.responseId,
        timeSpentWaiting: raw.timeSpentWaiting,
        elapsedMs: raw.elapsedMs,
        shouldBeBlocked: request.shouldBeBlocked.get(),
        codeBlockInfos: raw.responseMarkdownInfo?.map((info) => ({ suggestionId: info.suggestionId }))
      });
      request.response.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
      if (typeof raw.completionTokens === "number" || typeof raw.promptTokens === "number" || typeof raw.copilotCredits === "number" || typeof raw.sessionCopilotCredits === "number") {
        request.response.setUsage({
          kind: "usage",
          promptTokens: raw.promptTokens ?? 0,
          completionTokens: raw.completionTokens ?? 0,
          outputBuffer: raw.outputBuffer,
          promptTokenDetails: raw.promptTokenDetails,
          copilotCredits: raw.copilotCredits,
          modelTotals: raw.modelTotals,
          sessionCopilotCredits: raw.sessionCopilotCredits
        });
      }
      if (raw.usedContext) {
        request.response.applyReference(revive(raw.usedContext));
      }
      raw.contentReferences?.forEach((r) => request.response.applyReference(revive(r)));
      raw.codeCitations?.forEach((c) => request.response.applyCodeCitation(revive(c)));
    }
    return request;
  }
  reviveVariableData(raw) {
    const variableData = raw && Array.isArray(raw.variables) ? raw : { variables: [] };
    variableData.variables = variableData.variables.map(IChatRequestVariableEntry.fromExport);
    return variableData;
  }
  getParsedRequestFromString(message) {
    const parts = [new ChatRequestTextPart(new OffsetRange(0, message.length), { startColumn: 1, startLineNumber: 1, endColumn: 1, endLineNumber: 1 }, message)];
    return {
      text: message,
      parts
    };
  }
  /**
   * Hydrates pending requests from serialized data.
   * For each serialized pending request, finds the matching request model and adds it to the pending queue.
   */
  _deserializePendingRequests(pendingRequests) {
    try {
      return pendingRequests.map((pending) => ({
        id: pending.id,
        request: this._deserializeRequest(pending.request),
        kind: pending.kind,
        sendOptions: {
          ...pending.sendOptions,
          userSelectedTools: pending.sendOptions.userSelectedTools ? constObservable(pending.sendOptions.userSelectedTools) : void 0
        }
      }));
    } catch (e) {
      this.logService.error("Failed to parse pending chat requests", e);
      return [];
    }
  }
  getRequests() {
    return this._requests;
  }
  resetCheckpoint() {
    for (const request of this._requests) {
      request.setShouldBeBlocked(false);
      if (request.response) {
        request.response.setBlockedState(false);
      }
    }
  }
  setCheckpoint(requestId) {
    let checkpoint;
    let checkpointIndex = -1;
    if (requestId !== void 0) {
      this._requests.forEach((request, index) => {
        if (request.id === requestId) {
          checkpointIndex = index;
          checkpoint = request;
          request.setShouldBeBlocked(true);
        }
      });
      if (!checkpoint) {
        return;
      }
    }
    for (let i = this._requests.length - 1; i >= 0; i -= 1) {
      const request = this._requests[i];
      if (this._checkpoint && !checkpoint) {
        request.setShouldBeBlocked(false);
        if (request.response) {
          request.response.setBlockedState(false);
        }
      } else if (checkpoint && i >= checkpointIndex) {
        request.setShouldBeBlocked(true);
        if (request.response) {
          request.response.setBlockedState(true);
        }
      } else if (checkpoint && i < checkpointIndex) {
        request.setShouldBeBlocked(false);
        if (request.response) {
          request.response.setBlockedState(false);
        }
      }
    }
    this._checkpoint = checkpoint;
  }
  get checkpoint() {
    return this._checkpoint;
  }
  _setDisabledRequests(requestIds) {
    this._requests.forEach((request) => {
      const shouldBeRemovedOnSend = requestIds.find((r) => r.requestId === request.id);
      request.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
      if (request.response) {
        request.response.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
      }
    });
    this._onDidChange.fire({ kind: "setHidden" });
  }
  addRequest(message, variableData, attempt, modeInfo, chatAgent, slashCommand, confirmation, locationData, attachments, isCompleteAddedRequest, modelId, userSelectedTools, id, isSystemInitiated, systemInitiatedLabel, terminalExecutionId, isTerminalCommand, timestamp) {
    const editedFileEvents = [...this.currentEditedFileEvents.values()];
    this.currentEditedFileEvents.clear();
    const requestTimestamp = timestamp === void 0 ? Date.now() : typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0 ? timestamp : void 0;
    const request = new ChatRequestModel({
      restoredId: id,
      session: this,
      message,
      variableData,
      timestamp: requestTimestamp,
      fallbackTimestamp: this._timestamp,
      attempt,
      modeInfo,
      confirmation,
      locationData,
      attachedContext: attachments,
      isCompleteAddedRequest,
      modelId,
      editedFileEvents: editedFileEvents.length ? editedFileEvents : void 0,
      userSelectedTools,
      isSystemInitiated,
      systemInitiatedLabel,
      terminalExecutionId,
      isTerminalCommand
    });
    request.response = new ChatResponseModel({
      responseContent: [],
      session: this,
      agent: chatAgent,
      slashCommand,
      requestId: request.id,
      isCompleteAddedRequest,
      codeBlockInfos: void 0
    });
    this._requests.push(request);
    markChat(this.sessionResource, ChatPerfMark.RequestUiUpdated);
    this._onDidChange.fire({ kind: "addRequest", request });
    return request;
  }
  setCustomTitle(title) {
    this._customTitle = title;
    this._onDidChange.fire({ kind: "setCustomTitle", title });
  }
  updateRequest(request, variableData) {
    request.variableData = variableData;
    this._onDidChange.fire({ kind: "changedRequest", request });
  }
  adoptRequest(request) {
    const oldOwner = request.session;
    const index = oldOwner._requests.findIndex((candidate) => candidate.id === request.id);
    if (index === -1) {
      return;
    }
    oldOwner._requests.splice(index, 1);
    request.adoptTo(this);
    request.response?.adoptTo(this);
    this._requests.push(request);
    oldOwner._onDidChange.fire({ kind: "removeRequest", requestId: request.id, responseId: request.response?.id, reason: 2 /* Adoption */ });
    this._onDidChange.fire({ kind: "addRequest", request });
  }
  acceptResponseProgress(request, progress, quiet) {
    if (!request.response) {
      request.response = new ChatResponseModel({
        responseContent: [],
        session: this,
        requestId: request.id,
        codeBlockInfos: void 0
      });
    }
    if (request.response.isComplete) {
      throw new Error("acceptResponseProgress: Adding progress to a completed response");
    }
    if (progress.kind === "usage") {
      request.response.setUsage(progress);
    } else if (progress.kind === "usedContext" || progress.kind === "reference") {
      request.response.applyReference(progress);
    } else if (progress.kind === "codeCitation") {
      request.response.applyCodeCitation(progress);
    } else if (progress.kind === "move") {
      this._onDidChange.fire({ kind: "move", target: progress.uri, range: progress.range });
    } else if (progress.kind === "codeblockUri" && progress.isEdit) {
      request.response.addUndoStop({ id: progress.undoStopId ?? generateUuid(), kind: "undoStop" });
      request.response.updateContent(progress, quiet);
    } else if (progress.kind === "progressTaskResult") {
      this.logService.error(`Couldn't handle progress: ${JSON.stringify(progress)}`);
    } else {
      request.response.updateContent(progress, quiet);
    }
  }
  removeRequest(id, reason = 0 /* Removal */) {
    const index = this._requests.findIndex((request2) => request2.id === id);
    const request = this._requests[index];
    if (index !== -1) {
      this._onDidChange.fire({ kind: "removeRequest", requestId: request.id, responseId: request.response?.id, reason });
      this._requests.splice(index, 1);
      request.response?.dispose();
    }
  }
  cancelRequest(request) {
    if (request.response) {
      request.response.cancel();
    }
  }
  setResponse(request, result) {
    if (!request.response) {
      request.response = new ChatResponseModel({
        responseContent: [],
        session: this,
        requestId: request.id,
        codeBlockInfos: void 0
      });
    }
    request.response.setResult(result);
  }
  setFollowups(request, followups) {
    if (!request.response) {
      return;
    }
    request.response.setFollowups(followups);
  }
  setResponseModel(request, response) {
    request.response = response;
    this._onDidChange.fire({ kind: "addResponse", response });
  }
  toExport() {
    return {
      responderUsername: this.responderUsername,
      initialLocation: this.initialLocation,
      requests: this._requests.map((r) => {
        const message = {
          ...r.message,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parts: r.message.parts.map((p) => p && "toJSON" in p ? p.toJSON() : p)
        };
        const agent = r.response?.agent;
        const agentJson = agent && "toJSON" in agent ? agent.toJSON() : agent ? { ...agent } : void 0;
        return {
          requestId: r.id,
          message,
          variableData: IChatRequestVariableData.toExport(r.variableData),
          response: r.response ? r.response.entireResponse.value.filter((item) => item.kind !== "voiceProgress").map((item) => {
            if (item.kind === "treeData") {
              return item.treeData;
            } else if (item.kind === "markdownContent") {
              return item.content;
            } else {
              return item;
            }
          }) : void 0,
          shouldBeRemovedOnSend: r.shouldBeRemovedOnSend,
          agent: agentJson,
          timestamp: r.requestTimestamp,
          confirmation: r.confirmation,
          editedFileEvents: r.editedFileEvents,
          modelId: r.modelId,
          modeInfo: r.modeInfo,
          isSystemInitiated: r.isSystemInitiated || void 0,
          systemInitiatedLabel: r.systemInitiatedLabel,
          terminalExecutionId: r.terminalExecutionId,
          ...r.response?.toJSON()
        };
      })
    };
  }
  toJSON() {
    return {
      version: 3,
      ...this.toExport(),
      sessionId: this.sessionId,
      creationDate: this._timestamp,
      customTitle: this._customTitle,
      inputState: this.inputModel.toJSON(),
      workingDirectory: this._workingDirectory?.toString()
    };
  }
  dispose() {
    this._requests.forEach((r) => r.response?.dispose());
    this._onDidDispose.fire();
    super.dispose();
    this._requests.length = 0;
    this.dataSerializer = void 0;
    this._editingSession = void 0;
  }
};
ChatModel = __decorateClass([
  __decorateParam(2, ILogService),
  __decorateParam(3, IChatAgentService),
  __decorateParam(4, IChatEditingService),
  __decorateParam(5, IChatService)
], ChatModel);
function updateRanges(variableData, diff) {
  return {
    variables: variableData.variables.map((v) => ({
      ...v,
      range: v.range && {
        start: v.range.start - diff,
        endExclusive: v.range.endExclusive - diff
      }
    }))
  };
}
function canMergeMarkdownStrings(md1, md2) {
  if (md1.baseUri && md2.baseUri) {
    const baseUriEquals = md1.baseUri.scheme === md2.baseUri.scheme && md1.baseUri.authority === md2.baseUri.authority && md1.baseUri.path === md2.baseUri.path && md1.baseUri.query === md2.baseUri.query && md1.baseUri.fragment === md2.baseUri.fragment;
    if (!baseUriEquals) {
      return false;
    }
  } else if (md1.baseUri || md2.baseUri) {
    return false;
  }
  return equals(md1.isTrusted, md2.isTrusted) && md1.supportHtml === md2.supportHtml && md1.supportThemeIcons === md2.supportThemeIcons;
}
function isNestedSubagentResponsePart(part) {
  return "subAgentInvocationId" in part && !!part.subAgentInvocationId;
}
function appendMarkdownString(md1, md2) {
  const appendedValue = typeof md2 === "string" ? md2 : md2.value;
  return {
    value: md1.value + appendedValue,
    isTrusted: md1.isTrusted,
    supportThemeIcons: md1.supportThemeIcons,
    supportHtml: md1.supportHtml,
    baseUri: md1.baseUri
  };
}
function getCodeCitationsMessage(citations) {
  if (citations.length === 0) {
    return "";
  }
  const licenseTypes = citations.reduce((set, c) => set.add(c.license), /* @__PURE__ */ new Set());
  const label = licenseTypes.size === 1 ? localize("codeCitation", "Similar code found with 1 license type", licenseTypes.size) : localize("codeCitations", "Similar code found with {0} license types", licenseTypes.size);
  return label;
}
function serializeSendOptions(options) {
  return {
    modeInfo: options.modeInfo,
    userSelectedModelId: options.userSelectedModelId,
    userSelectedModelConfiguration: options.userSelectedModelConfiguration,
    userSelectedTools: options.userSelectedTools?.get(),
    location: options.location,
    locationData: options.locationData,
    attempt: options.attempt,
    noCommandDetection: options.noCommandDetection,
    isVoiceModeInput: options.isVoiceModeInput,
    agentId: options.agentId,
    agentIdSilent: options.agentIdSilent,
    slashCommand: options.slashCommand,
    confirmation: options.confirmation,
    isSystemInitiated: options.isSystemInitiated,
    systemInitiatedLabel: options.systemInitiatedLabel,
    terminalExecutionId: options.terminalExecutionId
  };
}
var ChatRequestEditedFileEventKind = /* @__PURE__ */ ((ChatRequestEditedFileEventKind2) => {
  ChatRequestEditedFileEventKind2[ChatRequestEditedFileEventKind2["Keep"] = 1] = "Keep";
  ChatRequestEditedFileEventKind2[ChatRequestEditedFileEventKind2["Undo"] = 2] = "Undo";
  ChatRequestEditedFileEventKind2[ChatRequestEditedFileEventKind2["UserModification"] = 3] = "UserModification";
  return ChatRequestEditedFileEventKind2;
})(ChatRequestEditedFileEventKind || {});
var ChatResponseResource;
((ChatResponseResource2) => {
  ChatResponseResource2.scheme = "vscode-chat-response-resource";
  function createUri(sessionResource, toolCallId, index, basename2) {
    return URI.from({
      scheme: ChatResponseResource2.scheme,
      authority: encodeHex(VSBuffer.fromString(sessionResource.toString())),
      path: `/tool/${toolCallId}/${index}` + (basename2 ? `/${basename2}` : "")
    });
  }
  ChatResponseResource2.createUri = createUri;
  function parseUri(uri) {
    if (uri.scheme !== ChatResponseResource2.scheme) {
      return void 0;
    }
    const parts = uri.path.split("/");
    if (parts.length < 4) {
      return void 0;
    }
    const [, kind, toolCallId, index] = parts;
    if (kind !== "tool") {
      return void 0;
    }
    let sessionResource;
    try {
      sessionResource = URI.parse(decodeHex(uri.authority).toString());
    } catch (e) {
      if (e instanceof SyntaxError) {
        sessionResource = LocalChatSessionUri.forSession(uri.authority);
      } else {
        throw e;
      }
    }
    return {
      sessionResource,
      toolCallId,
      index: Number(index)
    };
  }
  ChatResponseResource2.parseUri = parseUri;
})(ChatResponseResource || (ChatResponseResource = {}));
function _logChangesToStateModel(newState, oldState, logger, sessionId) {
  if (!canLog(logger.getLevel(), LogLevel.Debug) || newState?.selectedModel?.identifier === oldState?.selectedModel?.identifier) {
    return;
  }
  const stack = new Error().stack;
  const message = `[ChatModelChanged] ChatModel Input State model changed: ${newState?.selectedModel?.identifier} (was: ${oldState?.selectedModel?.identifier}) in session ${sessionId} ${stack}`;
  logger.debug(message);
}
function logChangesToStateModel(model, message, newState, oldState, logger) {
  if (!canLog(logger.getLevel(), LogLevel.Debug)) {
    return;
  }
  message = [
    message,
    `model.selectedModel: ${model?.state.get()?.selectedModel?.identifier}`,
    `new state: ${newState?.selectedModel?.identifier}`,
    `old state: ${oldState?.selectedModel?.identifier}`,
    new Error().stack
  ].join(", ");
  logger.debug(`[ChatModelChanged] Chat Model Changed,${message}`);
}
export {
  CHAT_ATTACHABLE_IMAGE_MIME_TYPES,
  ChatInputStateOrigin,
  ChatModel,
  ChatRequestEditedFileEventKind,
  ChatRequestModel,
  ChatRequestRemovalReason,
  ChatResponseModel,
  ChatResponseResource,
  IChatRequestVariableData,
  Response,
  appendMarkdownString,
  canMergeMarkdownStrings,
  defaultChatResponseModelChangeReason,
  extractExportableSessionData,
  getAttachableImageExtension,
  getCodeCitationsMessage,
  isCellTextEditOperation,
  isCellTextEditOperationArray,
  isExportableSessionData,
  isSerializableSessionData,
  logChangesToStateModel,
  normalizeSerializableChatData,
  reviveSerializableInputState,
  serializeSendOptions,
  toChatHistoryContent,
  updateRanges
};
