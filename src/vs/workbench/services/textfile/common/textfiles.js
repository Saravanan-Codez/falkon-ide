import { FileOperationError, FileOperationResult } from "../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { areFunctions, isUndefinedOrNull } from "../../../../base/common/types.js";
const ITextFileService = createDecorator("textFileService");
var TextFileOperationResult = /* @__PURE__ */ ((TextFileOperationResult2) => {
  TextFileOperationResult2[TextFileOperationResult2["FILE_IS_BINARY"] = 0] = "FILE_IS_BINARY";
  return TextFileOperationResult2;
})(TextFileOperationResult || {});
class TextFileOperationError extends FileOperationError {
  constructor(message, textFileOperationResult, options) {
    super(message, FileOperationResult.FILE_OTHER_ERROR);
    this.textFileOperationResult = textFileOperationResult;
    this.options = options;
  }
  static isTextFileOperationError(obj) {
    return obj instanceof Error && !isUndefinedOrNull(obj.textFileOperationResult);
  }
}
var TextFileEditorModelState = /* @__PURE__ */ ((TextFileEditorModelState2) => {
  TextFileEditorModelState2[TextFileEditorModelState2["SAVED"] = 0] = "SAVED";
  TextFileEditorModelState2[TextFileEditorModelState2["DIRTY"] = 1] = "DIRTY";
  TextFileEditorModelState2[TextFileEditorModelState2["PENDING_SAVE"] = 2] = "PENDING_SAVE";
  TextFileEditorModelState2[TextFileEditorModelState2["CONFLICT"] = 3] = "CONFLICT";
  TextFileEditorModelState2[TextFileEditorModelState2["ORPHAN"] = 4] = "ORPHAN";
  TextFileEditorModelState2[TextFileEditorModelState2["ERROR"] = 5] = "ERROR";
  return TextFileEditorModelState2;
})(TextFileEditorModelState || {});
var TextFileResolveReason = /* @__PURE__ */ ((TextFileResolveReason2) => {
  TextFileResolveReason2[TextFileResolveReason2["EDITOR"] = 1] = "EDITOR";
  TextFileResolveReason2[TextFileResolveReason2["REFERENCE"] = 2] = "REFERENCE";
  TextFileResolveReason2[TextFileResolveReason2["OTHER"] = 3] = "OTHER";
  return TextFileResolveReason2;
})(TextFileResolveReason || {});
var EncodingMode = /* @__PURE__ */ ((EncodingMode2) => {
  EncodingMode2[EncodingMode2["Encode"] = 0] = "Encode";
  EncodingMode2[EncodingMode2["Decode"] = 1] = "Decode";
  return EncodingMode2;
})(EncodingMode || {});
function isTextFileEditorModel(model) {
  const candidate = model;
  return areFunctions(candidate.setEncoding, candidate.getEncoding, candidate.save, candidate.revert, candidate.isDirty, candidate.getLanguageId);
}
function snapshotToString(snapshot) {
  const chunks = [];
  let chunk;
  while (typeof (chunk = snapshot.read()) === "string") {
    chunks.push(chunk);
  }
  return chunks.join("");
}
function stringToSnapshot(value) {
  let done = false;
  return {
    read() {
      if (!done) {
        done = true;
        return value;
      }
      return null;
    }
  };
}
function toBufferOrReadable(value) {
  if (typeof value === "undefined") {
    return void 0;
  }
  if (typeof value === "string") {
    return VSBuffer.fromString(value);
  }
  return {
    read: () => {
      const chunk = value.read();
      if (typeof chunk === "string") {
        return VSBuffer.fromString(chunk);
      }
      return null;
    }
  };
}
export {
  EncodingMode,
  ITextFileService,
  TextFileEditorModelState,
  TextFileOperationError,
  TextFileOperationResult,
  TextFileResolveReason,
  isTextFileEditorModel,
  snapshotToString,
  stringToSnapshot,
  toBufferOrReadable
};
