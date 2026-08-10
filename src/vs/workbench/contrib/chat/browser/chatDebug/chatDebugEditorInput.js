import { Codicon } from "../../../../../base/common/codicons.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { EditorInputCapabilities } from "../../../../common/editor.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
const chatDebugEditorIcon = registerIcon("chat-debug-editor-label-icon", Codicon.bug, localize("chatDebugEditorLabelIcon", "Icon of the chat debug editor label."));
class ChatDebugEditorInput extends EditorInput {
  constructor() {
    super(...arguments);
    this.resource = ChatDebugEditorInput.RESOURCE;
  }
  static {
    this.ID = "workbench.editor.chatDebug";
  }
  static {
    this.RESOURCE = URI.from({
      scheme: "chat-debug",
      path: "default"
    });
  }
  static get instance() {
    if (!ChatDebugEditorInput._instance || ChatDebugEditorInput._instance.isDisposed()) {
      ChatDebugEditorInput._instance = new ChatDebugEditorInput();
    }
    return ChatDebugEditorInput._instance;
  }
  get typeId() {
    return ChatDebugEditorInput.ID;
  }
  get editorId() {
    return ChatDebugEditorInput.ID;
  }
  get capabilities() {
    return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
  }
  getName() {
    return localize("chatDebugInputName", "Agent Debug Logs");
  }
  getIcon() {
    return chatDebugEditorIcon;
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    return other instanceof ChatDebugEditorInput;
  }
}
class ChatDebugEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    return "";
  }
  deserialize(instantiationService) {
    return ChatDebugEditorInput.instance;
  }
}
export {
  ChatDebugEditorInput,
  ChatDebugEditorInputSerializer
};
