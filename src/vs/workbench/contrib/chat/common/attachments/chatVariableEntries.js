import { Codicon } from "../../../../../base/common/codicons.js";
import { basename } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { localize } from "../../../../../nls.js";
import { decodeBase64, encodeBase64, VSBuffer } from "../../../../../base/common/buffer.js";
function isChatContextIconPath(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (ThemeIcon.isThemeIcon(value) || URI.isUri(value)) {
    return true;
  }
  const asDualPath = value;
  return URI.isUri(asDualPath.light) && URI.isUri(asDualPath.dark);
}
function resolveChatContextIcon(iconPath, useDark) {
  if (ThemeIcon.isThemeIcon(iconPath) || URI.isUri(iconPath)) {
    return iconPath;
  }
  return useDark ? iconPath.dark : iconPath.light;
}
const ChatPasteAttachmentMetadata = {
  Kind: "vscode.chat.attachment.kind",
  Language: "vscode.chat.attachment.language",
  FileName: "vscode.chat.attachment.fileName",
  PastedLines: "vscode.chat.attachment.pastedLines"
};
var AgentHostCompletionReferenceKind = /* @__PURE__ */ ((AgentHostCompletionReferenceKind2) => {
  AgentHostCompletionReferenceKind2["Skill"] = "skill";
  AgentHostCompletionReferenceKind2["Command"] = "command";
  return AgentHostCompletionReferenceKind2;
})(AgentHostCompletionReferenceKind || {});
function agentHostCompletionVariableValue(kind) {
  return { $mid: "agentHostCompletion", kind };
}
function agentHostCompletionVariableId(kind, reference) {
  switch (kind) {
    case "skill" /* Skill */:
      return reference.toString();
    case "command" /* Command */:
      return "agent-host-command:" + reference.toString();
  }
}
function toAgentHostCompletionVariableEntry(kind, name, reference, _meta) {
  return {
    kind: "generic",
    id: reference !== void 0 ? agentHostCompletionVariableId(kind, reference) : generateUuid(),
    name,
    value: agentHostCompletionVariableValue(kind),
    _meta
  };
}
function toAgentHostCompletionVariableEntryFromMetadata(kind, name, _meta) {
  switch (kind) {
    case "skill" /* Skill */:
      return toAgentHostCompletionVariableEntry(kind, name, typeof _meta?.uri === "string" ? _meta.uri : void 0, _meta);
    case "command" /* Command */:
      return toAgentHostCompletionVariableEntry(kind, name, typeof _meta?.command === "string" ? _meta.command : void 0, _meta);
  }
}
function getAgentHostCompletionReferenceKind(entry) {
  if (entry.kind !== "generic") {
    return void 0;
  }
  return getAgentHostCompletionReferenceKindFromValue(entry.value);
}
function getAgentHostCompletionReferenceKindFromValue(value) {
  if (typeof value !== "object" || value === null) {
    return void 0;
  }
  const record = value;
  if (record.$mid !== "agentHostCompletion") {
    return void 0;
  }
  switch (record.kind) {
    case "skill" /* Skill */:
    case "command" /* Command */:
      return record.kind;
  }
  return void 0;
}
function isAgentHostCompletionVariableEntry(entry) {
  return getAgentHostCompletionReferenceKind(entry) !== void 0;
}
var OmittedState = /* @__PURE__ */ ((OmittedState2) => {
  OmittedState2[OmittedState2["NotOmitted"] = 0] = "NotOmitted";
  OmittedState2[OmittedState2["Partial"] = 1] = "Partial";
  OmittedState2[OmittedState2["Full"] = 2] = "Full";
  OmittedState2[OmittedState2["ImageLimitExceeded"] = 3] = "ImageLimitExceeded";
  return OmittedState2;
})(OmittedState || {});
const CLAUDE_MESSAGES_MAX_IMAGES_PER_REQUEST = 20;
const GEMINI_MAX_IMAGES_PER_REQUEST = 10;
function getImageAttachmentLimit(model) {
  if (!model) {
    return void 0;
  }
  const family = model.family.toLowerCase();
  if (family.startsWith("gemini")) {
    return GEMINI_MAX_IMAGES_PER_REQUEST;
  }
  if (family.startsWith("claude") || family.startsWith("anthropic")) {
    return CLAUDE_MESSAGES_MAX_IMAGES_PER_REQUEST;
  }
  return void 0;
}
function toPasteVariableEntry(name, code, options) {
  const language = options?.language ?? "markdown";
  const fileName = options?.fileName ?? name;
  const pastedLines = options?.pastedLines ?? name;
  return {
    kind: "paste",
    id: options?.id ?? `chat-paste-${generateUuid()}`,
    name,
    icon: options?.icon,
    value: code,
    code,
    language,
    pastedLines,
    fileName,
    copiedFrom: void 0,
    _meta: {
      ...options?._meta,
      [ChatPasteAttachmentMetadata.Kind]: "paste",
      [ChatPasteAttachmentMetadata.Language]: language,
      [ChatPasteAttachmentMetadata.FileName]: fileName,
      [ChatPasteAttachmentMetadata.PastedLines]: pastedLines
    }
  };
}
function restorePasteVariableEntryFromAttachment(attachment) {
  const modelRepresentation = attachment.modelRepresentation;
  if (typeof modelRepresentation !== "string" || attachment._meta?.[ChatPasteAttachmentMetadata.Kind] !== "paste") {
    return void 0;
  }
  const stringMetadata = (key, fallback) => {
    const value = attachment._meta?.[key];
    return typeof value === "string" ? value : fallback;
  };
  return toPasteVariableEntry(attachment.label, modelRepresentation, {
    language: stringMetadata(ChatPasteAttachmentMetadata.Language, "markdown"),
    fileName: stringMetadata(ChatPasteAttachmentMetadata.FileName, attachment.label),
    pastedLines: stringMetadata(ChatPasteAttachmentMetadata.PastedLines, attachment.label),
    _meta: attachment._meta
  });
}
var IDiagnosticVariableEntryFilterData;
((IDiagnosticVariableEntryFilterData2) => {
  IDiagnosticVariableEntryFilterData2.icon = Codicon.error;
  function fromMarker(marker) {
    return {
      filterUri: marker.resource,
      owner: marker.owner,
      problemMessage: marker.message,
      filterRange: { startLineNumber: marker.startLineNumber, endLineNumber: marker.endLineNumber, startColumn: marker.startColumn, endColumn: marker.endColumn }
    };
  }
  IDiagnosticVariableEntryFilterData2.fromMarker = fromMarker;
  function toEntry(data) {
    return {
      id: id(data),
      name: label(data),
      icon: IDiagnosticVariableEntryFilterData2.icon,
      value: data,
      kind: "diagnostic",
      ...data
    };
  }
  IDiagnosticVariableEntryFilterData2.toEntry = toEntry;
  function id(data) {
    return [data.filterUri, data.owner, data.filterSeverity, data.filterRange?.startLineNumber, data.filterRange?.startColumn].join(":");
  }
  IDiagnosticVariableEntryFilterData2.id = id;
  function label(data) {
    let TrimThreshold;
    ((TrimThreshold2) => {
      TrimThreshold2[TrimThreshold2["MaxChars"] = 30] = "MaxChars";
      TrimThreshold2[TrimThreshold2["MaxSpaceLookback"] = 10] = "MaxSpaceLookback";
    })(TrimThreshold || (TrimThreshold = {}));
    if (data.problemMessage) {
      if (data.problemMessage.length < 30 /* MaxChars */) {
        return data.problemMessage;
      }
      const lastSpace = data.problemMessage.lastIndexOf(" ", 30 /* MaxChars */);
      if (lastSpace === -1 || lastSpace + 10 /* MaxSpaceLookback */ < 30 /* MaxChars */) {
        return data.problemMessage.substring(0, 30 /* MaxChars */) + "\u2026";
      }
      return data.problemMessage.substring(0, lastSpace) + "\u2026";
    }
    let labelStr = localize("chat.attachment.problems.all", "All Problems");
    if (data.filterUri) {
      labelStr = localize("chat.attachment.problems.inFile", "Problems in {0}", basename(data.filterUri));
    }
    return labelStr;
  }
  IDiagnosticVariableEntryFilterData2.label = label;
})(IDiagnosticVariableEntryFilterData || (IDiagnosticVariableEntryFilterData = {}));
function isBrowserViewVariableEntry(entry) {
  return entry.kind === "browserView";
}
function isChatReferenceVariableEntry(entry) {
  return entry.kind === "chatReference";
}
function chatReferenceVariableEntryId(chatResource, endTurn) {
  return endTurn === void 0 ? `agent-host-chat:${chatResource.toString()}` : `agent-host-chat:${chatResource.toString()}\0${endTurn}`;
}
function createChatReferenceVariableEntry(chatResource, endTurn, title, _meta, range) {
  return {
    kind: "chatReference",
    id: chatReferenceVariableEntryId(chatResource, endTurn),
    name: title,
    value: chatResource,
    endTurn,
    range,
    _meta
  };
}
function toChatReferenceDynamicVariableValue(chatResource, endTurn) {
  return endTurn === void 0 ? { $mid: "agentHostChatReference", chatResource: chatResource.toString() } : { $mid: "agentHostChatReference", chatResource: chatResource.toString(), endTurn };
}
function isChatReferenceDynamicVariableValue(value) {
  return typeof value === "object" && value !== null && value.$mid === "agentHostChatReference";
}
function chatReferenceVariableEntryFromDynamicValue(value, id, name, range, _meta) {
  let chatResource;
  try {
    chatResource = URI.parse(value.chatResource);
  } catch {
    return void 0;
  }
  return {
    kind: "chatReference",
    id,
    name,
    value: chatResource,
    endTurn: value.endTurn,
    range,
    _meta
  };
}
var IChatRequestVariableEntry;
((IChatRequestVariableEntry2) => {
  function toUri(entry) {
    return URI.isUri(entry.value) ? entry.value : isLocation(entry.value) ? entry.value.uri : void 0;
  }
  IChatRequestVariableEntry2.toUri = toUri;
  function toExport(v) {
    if (v.value instanceof Uint8Array) {
      const dup = { ...v };
      dup.value = { $base64: encodeBase64(VSBuffer.wrap(v.value)) };
      return dup;
    }
    if (isElementVariableEntry(v) && v.imageData instanceof Uint8Array) {
      return {
        ...v,
        imageData: { $base64: encodeBase64(VSBuffer.wrap(v.imageData)) }
      };
    }
    return v;
  }
  IChatRequestVariableEntry2.toExport = toExport;
  function fromExport(v) {
    if (v && "values" in v && Array.isArray(v.values)) {
      return {
        kind: "generic",
        id: v.id ?? "",
        name: v.name,
        value: v.values[0]?.value,
        range: v.range,
        modelDescription: v.modelDescription,
        references: v.references
      };
    } else {
      if (v.value && typeof v.value === "object" && "$base64" in v.value && typeof v.value.$base64 === "string") {
        const dup = { ...v };
        dup.value = decodeBase64(v.value.$base64).buffer;
        return dup;
      }
      if (isElementVariableEntry(v) && v.imageData && typeof v.imageData === "object" && "$base64" in v.imageData && typeof v.imageData.$base64 === "string") {
        return {
          ...v,
          imageData: decodeBase64(v.imageData.$base64).buffer
        };
      }
      return v;
    }
  }
  IChatRequestVariableEntry2.fromExport = fromExport;
})(IChatRequestVariableEntry || (IChatRequestVariableEntry = {}));
function isImplicitVariableEntry(obj) {
  return obj.kind === "implicit";
}
function isStringVariableEntry(obj) {
  return obj.kind === "string";
}
function isTerminalVariableEntry(obj) {
  return obj.kind === "terminalCommand";
}
function isDebugVariableEntry(obj) {
  return obj.kind === "debugVariable";
}
function isAgentFeedbackVariableEntry(obj) {
  return obj.kind === "agentFeedback";
}
function isPasteVariableEntry(obj) {
  return obj.kind === "paste";
}
function isWorkspaceVariableEntry(obj) {
  return obj.kind === "workspace";
}
function isImageVariableEntry(obj) {
  return obj.kind === "image";
}
function isExplicitFileOrImageVariableEntry(obj) {
  return obj.kind === "file" || obj.kind === "directory" || obj.kind === "image";
}
function getExplicitFileOrImageAttachmentSummary(entries) {
  const fileOrImageEntries = entries.filter(isExplicitFileOrImageVariableEntry);
  if (!fileOrImageEntries.length) {
    return void 0;
  }
  if (fileOrImageEntries.every(isImageVariableEntry)) {
    return fileOrImageEntries.length === 1 ? localize("chat.attachmentSummary.image.one", "Attached 1 image") : localize("chat.attachmentSummary.image.many", "Attached {0} images", fileOrImageEntries.length);
  }
  return fileOrImageEntries.length === 1 ? localize("chat.attachmentSummary.file.one", "Attached 1 file") : localize("chat.attachmentSummary.file.many", "Attached {0} files", fileOrImageEntries.length);
}
function isNotebookOutputVariableEntry(obj) {
  return obj.kind === "notebookOutput";
}
function isElementVariableEntry(obj) {
  return obj.kind === "element";
}
function isDiagnosticsVariableEntry(obj) {
  return obj.kind === "diagnostic";
}
function isChatRequestFileEntry(obj) {
  return obj.kind === "file";
}
function isPromptFileVariableEntry(obj) {
  return obj.kind === "promptFile";
}
function isPromptTextVariableEntry(obj) {
  return obj.kind === "promptText";
}
function isChatRequestVariableEntry(obj) {
  const entry = obj;
  return typeof entry === "object" && entry !== null && typeof entry.id === "string" && typeof entry.name === "string";
}
function isSCMHistoryItemVariableEntry(obj) {
  return obj.kind === "scmHistoryItem";
}
function isSCMHistoryItemChangeVariableEntry(obj) {
  return obj.kind === "scmHistoryItemChange";
}
function isSCMHistoryItemChangeRangeVariableEntry(obj) {
  return obj.kind === "scmHistoryItemChangeRange";
}
function isStringImplicitContextValue(value) {
  const asStringImplicitContextValue = value;
  return typeof asStringImplicitContextValue === "object" && asStringImplicitContextValue !== null && (typeof asStringImplicitContextValue.value === "string" || typeof asStringImplicitContextValue.value === "undefined") && (typeof asStringImplicitContextValue.name === "string" || typeof asStringImplicitContextValue.name === "undefined") && (asStringImplicitContextValue.resourceUri === void 0 || URI.isUri(asStringImplicitContextValue.resourceUri)) && (typeof asStringImplicitContextValue.name === "string" || URI.isUri(asStringImplicitContextValue.resourceUri)) && (asStringImplicitContextValue.iconPath === void 0 || isChatContextIconPath(asStringImplicitContextValue.iconPath)) && URI.isUri(asStringImplicitContextValue.uri) && typeof asStringImplicitContextValue.handle === "number";
}
var PromptFileVariableKind = /* @__PURE__ */ ((PromptFileVariableKind2) => {
  PromptFileVariableKind2["Instruction"] = "vscode.instructions.file.root";
  PromptFileVariableKind2["InstructionReference"] = `vscode.instructions.file.reference`;
  PromptFileVariableKind2["PromptFile"] = "vscode.prompt.file";
  return PromptFileVariableKind2;
})(PromptFileVariableKind || {});
function toPromptFileVariableEntry(uri, kind, originLabel, automaticallyAdded = false, toolReferences) {
  return {
    id: `${kind}__${uri.toString()}`,
    name: `prompt:${basename(uri)}`,
    value: uri,
    kind: "promptFile",
    modelDescription: "Prompt instructions file",
    isRoot: kind !== "vscode.instructions.file.reference" /* InstructionReference */,
    originLabel,
    toolReferences,
    automaticallyAdded
  };
}
var PromptTextVariableKind = /* @__PURE__ */ ((PromptTextVariableKind2) => {
  PromptTextVariableKind2["CustomizationsIndex"] = "vscode.customizations.index";
  return PromptTextVariableKind2;
})(PromptTextVariableKind || {});
function toPromptTextVariableEntry(content, automaticallyAdded = false, toolReferences) {
  return {
    id: "vscode.customizations.index" /* CustomizationsIndex */,
    name: `prompt:customizationsIndex`,
    value: content,
    kind: "promptText",
    modelDescription: "Chat customizations index",
    automaticallyAdded,
    toolReferences
  };
}
function toFileVariableEntry(uri, range) {
  return {
    kind: "file",
    value: range ? { uri, range } : uri,
    id: uri.toString() + (range?.toString() ?? ""),
    name: basename(uri)
  };
}
function toToolVariableEntry(entry, range) {
  return {
    kind: "tool",
    id: entry.id,
    icon: ThemeIcon.isThemeIcon(entry.icon) ? entry.icon : void 0,
    name: entry.displayName,
    value: void 0,
    range
  };
}
function toToolSetVariableEntry(entry, range) {
  return {
    kind: "toolset",
    id: entry.id,
    icon: entry.icon,
    name: entry.referenceName,
    value: Array.from(entry.getTools()).map((t) => toToolVariableEntry(t)),
    range
  };
}
class ChatRequestVariableSet {
  constructor(entries) {
    this._ids = /* @__PURE__ */ new Set();
    this._entries = [];
    if (entries) {
      this.add(...entries);
    }
  }
  add(...entry) {
    for (const e of entry) {
      if (!this._ids.has(e.id)) {
        this._ids.add(e.id);
        this._entries.push(e);
      }
    }
  }
  insertFirst(entry) {
    if (!this._ids.has(entry.id)) {
      this._ids.add(entry.id);
      this._entries.unshift(entry);
    }
  }
  remove(entry) {
    this._ids.delete(entry.id);
    this._entries = this._entries.filter((e) => e.id !== entry.id);
  }
  has(entry) {
    return this._ids.has(entry.id);
  }
  asArray() {
    return this._entries.slice(0);
  }
  get length() {
    return this._entries.length;
  }
}
export {
  AgentHostCompletionReferenceKind,
  ChatPasteAttachmentMetadata,
  ChatRequestVariableSet,
  IChatRequestVariableEntry,
  IDiagnosticVariableEntryFilterData,
  OmittedState,
  PromptFileVariableKind,
  chatReferenceVariableEntryFromDynamicValue,
  chatReferenceVariableEntryId,
  createChatReferenceVariableEntry,
  getAgentHostCompletionReferenceKind,
  getAgentHostCompletionReferenceKindFromValue,
  getExplicitFileOrImageAttachmentSummary,
  getImageAttachmentLimit,
  isAgentFeedbackVariableEntry,
  isAgentHostCompletionVariableEntry,
  isBrowserViewVariableEntry,
  isChatContextIconPath,
  isChatReferenceDynamicVariableValue,
  isChatReferenceVariableEntry,
  isChatRequestFileEntry,
  isChatRequestVariableEntry,
  isDebugVariableEntry,
  isDiagnosticsVariableEntry,
  isElementVariableEntry,
  isExplicitFileOrImageVariableEntry,
  isImageVariableEntry,
  isImplicitVariableEntry,
  isNotebookOutputVariableEntry,
  isPasteVariableEntry,
  isPromptFileVariableEntry,
  isPromptTextVariableEntry,
  isSCMHistoryItemChangeRangeVariableEntry,
  isSCMHistoryItemChangeVariableEntry,
  isSCMHistoryItemVariableEntry,
  isStringImplicitContextValue,
  isStringVariableEntry,
  isTerminalVariableEntry,
  isWorkspaceVariableEntry,
  resolveChatContextIcon,
  restorePasteVariableEntryFromAttachment,
  toAgentHostCompletionVariableEntry,
  toAgentHostCompletionVariableEntryFromMetadata,
  toChatReferenceDynamicVariableValue,
  toFileVariableEntry,
  toPasteVariableEntry,
  toPromptFileVariableEntry,
  toPromptTextVariableEntry,
  toToolSetVariableEntry,
  toToolVariableEntry
};
