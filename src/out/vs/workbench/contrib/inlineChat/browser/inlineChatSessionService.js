import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { IChatService } from "../../chat/common/chatService/chatService.js";
import { ChatAgentLocation, ChatModeKind } from "../../chat/common/constants.js";
const IInlineChatSessionService = createDecorator("IInlineChatSessionService");
async function askInPanelChat(accessor, request, state, fileContext) {
  const widgetService = accessor.get(IChatWidgetService);
  const chatService = accessor.get(IChatService);
  if (!request) {
    return;
  }
  const newModelRef = chatService.startNewLocalSession(ChatAgentLocation.Chat);
  const newModel = newModelRef.object;
  newModel.inputModel.setState({
    ...state,
    mode: { id: "agent", kind: ChatModeKind.Agent }
  });
  const widget = await widgetService.openSession(newModelRef.object.sessionResource);
  newModelRef.dispose();
  if (widget && fileContext && !fileContext.selection.isEmpty()) {
    await widget.attachmentModel.addFile(fileContext.uri, fileContext.selection);
  }
  widget?.acceptInput(request.message.text);
}
async function continueInPanelChat(accessor, session) {
  const request = session.chatModel.getRequests().at(-1);
  if (!request) {
    return;
  }
  await askInPanelChat(accessor, request, session.chatModel.inputModel.state.get(), { uri: session.uri, selection: session.initialSelection });
  session.dispose();
}
function rephraseInlineChat(accessor, session) {
  const request = session.chatModel.getRequests().at(-1);
  if (!request) {
    return void 0;
  }
  accessor.get(IChatService).removeRequest(session.chatModel.sessionResource, request.id);
  session.chatModel.inputModel.setState({ inputText: request.message.text });
  session.setTerminationState(void 0);
  return request.message.text;
}
export {
  IInlineChatSessionService,
  continueInPanelChat,
  rephraseInlineChat
};
