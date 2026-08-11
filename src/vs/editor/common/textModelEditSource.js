import { sumBy } from "../../base/common/arrays.js";
import { prefixedUuid } from "../../base/common/uuid.js";
import { LineEdit } from "./core/edits/lineEdit.js";
import { TextLength } from "./core/text/textLength.js";
const privateSymbol = /* @__PURE__ */ Symbol("TextModelEditSource");
class TextModelEditSource {
  constructor(metadata, _privateCtorGuard) {
    this.metadata = metadata;
  }
  toString() {
    return `${this.metadata.source}`;
  }
  getType() {
    const metadata = this.metadata;
    switch (metadata.source) {
      case "cursor":
        return metadata.kind;
      case "inlineCompletionAccept":
        return metadata.source + (metadata.$nes ? ":nes" : "");
      case "unknown":
        return metadata.name || "unknown";
      default:
        return metadata.source;
    }
  }
  /**
   * Converts the metadata to a key string.
   * Only includes properties/values that have `level` many `$` prefixes or less.
  */
  toKey(level, filter = {}) {
    const metadata = this.metadata;
    const keys = Object.entries(metadata).filter(([key, value]) => {
      const filterVal = filter[key];
      if (filterVal !== void 0) {
        return filterVal;
      }
      const prefixCount = (key.match(/\$/g) || []).length;
      return prefixCount <= level && value !== void 0 && value !== null && value !== "";
    }).map(([key, value]) => `${key}:${value}`);
    return keys.join("-");
  }
  get props() {
    return this.metadata;
  }
}
function createEditSource(metadata) {
  return new TextModelEditSource(metadata, privateSymbol);
}
function isAiEdit(source) {
  switch (source.metadata.source) {
    case "inlineCompletionAccept":
    case "inlineCompletionPartialAccept":
    case "inlineChat.applyEdits":
    case "Chat.applyEdits":
      return true;
  }
  return false;
}
function isUserEdit(source) {
  switch (source.metadata.source) {
    case "cursor":
      return source.metadata.kind === "type";
  }
  return false;
}
const EditSources = {
  unknown(data) {
    return createEditSource({
      source: "unknown",
      name: data.name
    });
  },
  rename: (oldName, newName) => createEditSource({ source: "rename", $$$oldName: oldName, $$$newName: newName }),
  chatApplyEdits(data) {
    return createEditSource({
      source: "Chat.applyEdits",
      $modelId: avoidPathRedaction(data.modelId),
      $extensionId: data.extensionId?.extensionId,
      $extensionVersion: data.extensionId?.version,
      $harness: data.harness,
      $origin: data.origin,
      $$languageId: data.languageId,
      $$sessionId: data.sessionId,
      $$requestId: data.requestId,
      $$mode: data.mode,
      $$codeBlockSuggestionId: data.codeBlockSuggestionId
    });
  },
  agentHostChatApplyEdits(data) {
    return EditSources.chatApplyEdits({
      modelId: data.modelId,
      sessionId: data.sessionId,
      requestId: data.requestId,
      languageId: "",
      mode: void 0,
      extensionId: void 0,
      codeBlockSuggestionId: void 0,
      origin: "agentHost",
      harness: data.harness
    });
  },
  chatUndoEdits: () => createEditSource({ source: "Chat.undoEdits" }),
  chatReset: () => createEditSource({ source: "Chat.reset" }),
  inlineCompletionAccept(data) {
    return createEditSource({
      source: "inlineCompletionAccept",
      $nes: data.nes,
      ...toProperties(data.providerId),
      $$correlationId: data.correlationId,
      $$requestUuid: data.requestUuid,
      $$languageId: data.languageId
    });
  },
  inlineCompletionPartialAccept(data) {
    return createEditSource({
      source: "inlineCompletionPartialAccept",
      type: data.type,
      $nes: data.nes,
      ...toProperties(data.providerId),
      $$correlationId: data.correlationId,
      $$requestUuid: data.requestUuid,
      $$languageId: data.languageId
    });
  },
  inlineChatApplyEdit(data) {
    return createEditSource({
      source: "inlineChat.applyEdits",
      $modelId: avoidPathRedaction(data.modelId),
      $extensionId: data.extensionId?.extensionId,
      $extensionVersion: data.extensionId?.version,
      $$sessionId: data.sessionId,
      $$requestId: data.requestId,
      $$languageId: data.languageId
    });
  },
  reloadFromDisk: () => createEditSource({ source: "reloadFromDisk" }),
  cursor(data) {
    return createEditSource({
      source: "cursor",
      kind: data.kind,
      detailedSource: data.detailedSource
    });
  },
  setValue: () => createEditSource({ source: "setValue" }),
  eolChange: () => createEditSource({ source: "eolChange" }),
  applyEdits: () => createEditSource({ source: "applyEdits" }),
  snippet: () => createEditSource({ source: "snippet" }),
  suggest: (data) => createEditSource({ source: "suggest", ...toProperties(data.providerId) }),
  codeAction: (data) => createEditSource({ source: "codeAction", $kind: data.kind, ...toProperties(data.providerId) })
};
function toProperties(version) {
  if (!version) {
    return {};
  }
  return {
    $extensionId: version.extensionId,
    $extensionVersion: version.extensionVersion,
    $providerId: version.providerId
  };
}
function avoidPathRedaction(str) {
  if (str === void 0) {
    return void 0;
  }
  return str.replaceAll("/", "|");
}
class EditDeltaInfo {
  constructor(linesAdded, linesRemoved, charsAdded, charsRemoved) {
    this.linesAdded = linesAdded;
    this.linesRemoved = linesRemoved;
    this.charsAdded = charsAdded;
    this.charsRemoved = charsRemoved;
  }
  static fromText(text) {
    const linesAdded = TextLength.ofText(text).lineCount;
    const charsAdded = text.length;
    return new EditDeltaInfo(linesAdded, 0, charsAdded, 0);
  }
  /** @internal */
  static fromEdit(edit, originalString) {
    const lineEdit = LineEdit.fromStringEdit(edit, originalString);
    const linesAdded = sumBy(lineEdit.replacements, (r) => r.newLines.length);
    const linesRemoved = sumBy(lineEdit.replacements, (r) => r.lineRange.length);
    const charsAdded = sumBy(edit.replacements, (r) => r.getNewLength());
    const charsRemoved = sumBy(edit.replacements, (r) => r.replaceRange.length);
    return new EditDeltaInfo(linesAdded, linesRemoved, charsAdded, charsRemoved);
  }
  static tryCreate(linesAdded, linesRemoved, charsAdded, charsRemoved) {
    if (linesAdded === void 0 || linesRemoved === void 0 || charsAdded === void 0 || charsRemoved === void 0) {
      return void 0;
    }
    return new EditDeltaInfo(linesAdded, linesRemoved, charsAdded, charsRemoved);
  }
}
var EditSuggestionId;
((EditSuggestionId2) => {
  function newId(genPrefixedUuid) {
    const id = genPrefixedUuid ? genPrefixedUuid("sgt") : prefixedUuid("sgt");
    return toEditIdentity(id);
  }
  EditSuggestionId2.newId = newId;
})(EditSuggestionId || (EditSuggestionId = {}));
function toEditIdentity(id) {
  return id;
}
export {
  EditDeltaInfo,
  EditSources,
  EditSuggestionId,
  TextModelEditSource,
  isAiEdit,
  isUserEdit
};
