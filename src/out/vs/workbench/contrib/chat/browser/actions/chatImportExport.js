import { VSBuffer } from "../../../../../base/common/buffer.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { ChatViewPaneTarget, IChatWidgetService } from "../chat.js";
import { ChatEditorInput } from "../widgetHosts/editor/chatEditorInput.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { extractExportableSessionData, isExportableSessionData } from "../../common/model/chatModel.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { revive } from "../../../../../base/common/marshalling.js";
import { ACTIVE_GROUP } from "../../../../services/editor/common/editorService.js";
const defaultFileName = "chat.json";
const filters = [{ name: localize("chat.file.label", "Chat Session"), extensions: ["json"] }];
function registerChatExportActions() {
  registerAction2(class ExportChatAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.export",
        category: CHAT_CATEGORY,
        title: localize2("chat.export.label", "Export Chat..."),
        precondition: ChatContextKeys.enabled,
        f1: true
      });
    }
    async run(accessor, outputPath) {
      const widgetService = accessor.get(IChatWidgetService);
      const fileDialogService = accessor.get(IFileDialogService);
      const fileService = accessor.get(IFileService);
      const chatService = accessor.get(IChatService);
      const widget = widgetService.lastFocusedWidget;
      if (!widget || !widget.viewModel) {
        return;
      }
      if (!outputPath) {
        const defaultUri = joinPath(await fileDialogService.defaultFilePath(), defaultFileName);
        const result = await fileDialogService.showSaveDialog({
          defaultUri,
          filters
        });
        if (!result) {
          return;
        }
        outputPath = result;
      }
      const model = chatService.getSession(widget.viewModel.sessionResource);
      if (!model) {
        return;
      }
      const content = VSBuffer.fromString(JSON.stringify(model.toExport(), void 0, 2));
      await fileService.writeFile(outputPath, content);
    }
  });
  registerAction2(class ImportChatAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.import",
        title: localize2("chat.import.label", "Import Chat..."),
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.enabled,
        f1: true
      });
    }
    async run(accessor, opts) {
      const fileService = accessor.get(IFileService);
      const widgetService = accessor.get(IChatWidgetService);
      const chatService = accessor.get(IChatService);
      const fileDialogService = accessor.get(IFileDialogService);
      let inputPath = opts?.inputPath;
      if (!inputPath) {
        const defaultUri = joinPath(await fileDialogService.defaultFilePath(), defaultFileName);
        const result = await fileDialogService.showOpenDialog({
          defaultUri,
          canSelectFiles: true,
          filters
        });
        if (!result) {
          return;
        }
        inputPath = result[0];
      }
      const content = await fileService.readFile(inputPath);
      try {
        const data = revive(JSON.parse(content.value.toString()));
        if (!isExportableSessionData(data)) {
          throw new Error("Invalid chat session data");
        }
        const importedData = extractExportableSessionData(data);
        let sessionResource;
        let resolvedTarget;
        let options;
        if (opts?.target === "chatViewPane") {
          const modelRef = chatService.loadSessionFromData(importedData, "ChatImportExport#importToChatView");
          try {
            sessionResource = modelRef.object.sessionResource;
            resolvedTarget = ChatViewPaneTarget;
            options = { pinned: true };
            await widgetService.openSession(sessionResource, resolvedTarget, options);
          } finally {
            modelRef.dispose();
          }
        } else {
          sessionResource = ChatEditorInput.getNewEditorUri();
          resolvedTarget = ACTIVE_GROUP;
          options = { target: { data: importedData }, pinned: true };
          await widgetService.openSession(sessionResource, resolvedTarget, options);
        }
      } catch (err) {
        throw err;
      }
    }
  });
}
export {
  registerChatExportActions
};
