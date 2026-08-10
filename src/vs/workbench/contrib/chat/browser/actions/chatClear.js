import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { localChatSessionType } from "../../common/chatSessionsService.js";
import { resolveDefaultNewChatSessionType } from "../../common/constants.js";
import { markPreferredCopilotHarness } from "../../common/chatSessionTypePreference.js";
import { getChatSessionType, LocalChatSessionUri } from "../../common/model/chatUri.js";
import { ChatEditorInput } from "../widgetHosts/editor/chatEditorInput.js";
function getNewChatSessionResource(sessionType) {
  return sessionType === localChatSessionType ? LocalChatSessionUri.getNewSessionUri() : URI.from({ scheme: sessionType, path: `/untitled-${generateUuid()}` });
}
async function clearChatEditor(accessor, chatEditorInput, targetSessionType) {
  const editorService = accessor.get(IEditorService);
  const storageService = accessor.get(IStorageService);
  if (!chatEditorInput) {
    const editorInput = editorService.activeEditor;
    chatEditorInput = editorInput instanceof ChatEditorInput ? editorInput : void 0;
  }
  if (chatEditorInput instanceof ChatEditorInput) {
    const currentResource = chatEditorInput.sessionResource;
    const currentSessionType = currentResource ? getChatSessionType(currentResource) : void 0;
    const resolved = resolveDefaultNewChatSessionType(accessor, {
      explicitOverride: targetSessionType,
      currentSessionType
    });
    if (resolved.isPreferCopilotHarnessSwap) {
      markPreferredCopilotHarness(storageService);
    }
    const resource = getNewChatSessionResource(resolved.sessionType);
    const identifier = editorService.findEditors(chatEditorInput.resource)[0];
    await editorService.replaceEditors([{
      editor: chatEditorInput,
      replacement: { resource, options: { pinned: true } }
    }], identifier.groupId);
  }
}
export {
  clearChatEditor
};
