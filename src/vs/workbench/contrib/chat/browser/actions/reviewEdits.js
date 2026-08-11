import { raceCancellation } from "../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { derived, waitForState } from "../../../../../base/common/observable.js";
import { assertType } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
async function reviewEdits(accessor, editor, stream, token, applyCodeBlockSuggestionId) {
  if (!editor.hasModel()) {
    return false;
  }
  const chatService = accessor.get(IChatService);
  const uri = editor.getModel().uri;
  const chatModelRef = chatService.startNewLocalSession(ChatAgentLocation.EditorInline);
  const chatModel = chatModelRef.object;
  chatModel.startEditingSession(true);
  const store = new DisposableStore();
  store.add(chatModelRef);
  const chatRequest = chatModel?.addRequest({ text: "", parts: [] }, { variables: [] }, 0, {
    kind: void 0,
    telemetryModeId: "applyCodeBlock",
    modeInstructions: void 0,
    isBuiltin: true,
    applyCodeBlockSuggestionId
  });
  assertType(chatRequest.response);
  chatRequest.response.updateContent({ kind: "textEdit", uri, edits: [], done: false });
  for await (const chunk of stream) {
    if (token.isCancellationRequested) {
      chatRequest.response.cancel();
      break;
    }
    chatRequest.response.updateContent({ kind: "textEdit", uri, edits: chunk, done: false });
  }
  chatRequest.response.updateContent({ kind: "textEdit", uri, edits: [], done: true });
  if (!token.isCancellationRequested) {
    chatRequest.response.complete();
  }
  const isSettled = derived((r) => {
    const entry = chatModel.editingSession?.readEntry(uri, r);
    if (!entry) {
      return false;
    }
    const state = entry.state.read(r);
    return state === ModifiedFileEntryState.Accepted || state === ModifiedFileEntryState.Rejected;
  });
  const whenDecided = waitForState(isSettled, Boolean);
  await raceCancellation(whenDecided, token);
  store.dispose();
  return true;
}
async function reviewNotebookEdits(accessor, uri, stream, token) {
  const chatService = accessor.get(IChatService);
  const notebookService = accessor.get(INotebookService);
  const isNotebook = notebookService.hasSupportedNotebooks(uri);
  const chatModelRef = chatService.startNewLocalSession(ChatAgentLocation.EditorInline);
  const chatModel = chatModelRef.object;
  chatModel.startEditingSession(true);
  const store = new DisposableStore();
  store.add(chatModelRef);
  const chatRequest = chatModel?.addRequest({ text: "", parts: [] }, { variables: [] }, 0);
  assertType(chatRequest.response);
  if (isNotebook) {
    chatRequest.response.updateContent({ kind: "notebookEdit", uri, edits: [], done: false });
  } else {
    chatRequest.response.updateContent({ kind: "textEdit", uri, edits: [], done: false });
  }
  for await (const chunk of stream) {
    if (token.isCancellationRequested) {
      chatRequest.response.cancel();
      break;
    }
    if (chunk.every(isCellEditOperation)) {
      chatRequest.response.updateContent({ kind: "notebookEdit", uri, edits: chunk, done: false });
    } else {
      chatRequest.response.updateContent({ kind: "textEdit", uri: chunk[0], edits: chunk[1], done: false });
    }
  }
  if (isNotebook) {
    chatRequest.response.updateContent({ kind: "notebookEdit", uri, edits: [], done: true });
  } else {
    chatRequest.response.updateContent({ kind: "textEdit", uri, edits: [], done: true });
  }
  if (!token.isCancellationRequested) {
    chatRequest.response.complete();
  }
  const isSettled = derived((r) => {
    const entry = chatModel.editingSession?.readEntry(uri, r);
    if (!entry) {
      return false;
    }
    const state = entry.state.read(r);
    return state === ModifiedFileEntryState.Accepted || state === ModifiedFileEntryState.Rejected;
  });
  const whenDecided = waitForState(isSettled, Boolean);
  await raceCancellation(whenDecided, token);
  store.dispose();
  return true;
}
function isCellEditOperation(edit) {
  if (URI.isUri(edit)) {
    return false;
  }
  if (Array.isArray(edit)) {
    return false;
  }
  return true;
}
export {
  reviewEdits,
  reviewNotebookEdits
};
