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
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { URI } from "../../../../base/common/uri.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { AbstractFileDialogService } from "./abstractFileDialogService.js";
import { Schemas } from "../../../../base/common/network.js";
import { memoize } from "../../../../base/common/decorators.js";
import { localize } from "../../../../nls.js";
import { getMediaOrTextMime } from "../../../../base/common/mime.js";
import { basename } from "../../../../base/common/resources.js";
import { getActiveWindow, triggerDownload, triggerUpload } from "../../../../base/browser/dom.js";
import Severity from "../../../../base/common/severity.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { extractFileListData } from "../../../../platform/dnd/browser/dnd.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { WebFileSystemAccess } from "../../../../platform/files/browser/webFileSystemAccess.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
class FileDialogService extends AbstractFileDialogService {
  get fileSystemProvider() {
    return this.fileService.getProvider(Schemas.file);
  }
  async pickFileFolderAndOpen(options) {
    if (typeof window !== "undefined" && window.__tauri_dialogs__) {
      const folderPath = await window.__tauri_dialogs__.openFolder();
      if (folderPath) {
        const uri = URI.file(folderPath);
        return this.hostService.openWindow([{ folderUri: uri }], { forceNewWindow: false });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFilePath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickFileFolderAndOpenSimplified(schema, options, false);
    }
    throw new Error(localize("pickFolderAndOpen", "Can't open folders, try adding a folder to the workspace instead."));
  }
  addFileSchemaIfNeeded(schema, isFolder) {
    return schema === Schemas.untitled ? [Schemas.file] : schema !== Schemas.file && (!isFolder || schema !== Schemas.vscodeRemote) ? [schema, Schemas.file] : [schema];
  }
  async pickFileAndOpen(options) {
    if (typeof window !== "undefined" && window.__tauri_dialogs__) {
      const filePath = await window.__tauri_dialogs__.openFile();
      if (filePath) {
        const uri2 = URI.file(filePath);
        this.addFileToRecentlyOpened(uri2);
        await this.openerService.open(uri2, { fromUserGesture: true, editorOptions: { pinned: true } });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFilePath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickFileAndOpenSimplified(schema, options, false);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("open");
    }
    let fileHandle = void 0;
    try {
      [fileHandle] = await activeWindow.showOpenFilePicker({ multiple: false });
    } catch (error) {
      return;
    }
    if (!WebFileSystemAccess.isFileSystemFileHandle(fileHandle)) {
      return;
    }
    const uri = await this.fileSystemProvider.registerFileHandle(fileHandle);
    this.addFileToRecentlyOpened(uri);
    await this.openerService.open(uri, { fromUserGesture: true, editorOptions: { pinned: true } });
  }
  async pickFolderAndOpen(options) {
    if (typeof window !== "undefined" && window.__tauri_dialogs__) {
      const folderPath = await window.__tauri_dialogs__.openFolder();
      if (folderPath) {
        const uri = URI.file(folderPath);
        return this.hostService.openWindow([{ folderUri: uri }], { forceNewWindow: false });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFolderPath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickFolderAndOpenSimplified(schema, options);
    }
    throw new Error(localize("pickFolderAndOpen", "Can't open folders, try adding a folder to the workspace instead."));
  }
  async pickWorkspaceAndOpen(options) {
    options.availableFileSystems = this.getWorkspaceAvailableFileSystems(options);
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultWorkspacePath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickWorkspaceAndOpenSimplified(schema, options);
    }
    throw new Error(localize("pickWorkspaceAndOpen", "Can't open workspaces, try adding a folder to the workspace instead."));
  }
  async pickFileToSave(defaultUri, availableFileSystems) {
    if (typeof window !== "undefined" && window.__tauri_dialogs__) {
      const savePath = await window.__tauri_dialogs__.saveFile(defaultUri?.fsPath);
      if (savePath) {
        return URI.file(savePath);
      }
      return void 0;
    }
    const schema = this.getFileSystemSchema({ defaultUri, availableFileSystems });
    const options = this.getPickFileToSaveDialogOptions(defaultUri, availableFileSystems);
    if (this.shouldUseSimplified(schema)) {
      return super.pickFileToSaveSimplified(schema, options);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("save");
    }
    let fileHandle = void 0;
    const startIn = Iterable.first(this.fileSystemProvider.directories);
    try {
      fileHandle = await activeWindow.showSaveFilePicker({ types: this.getFilePickerTypes(options.filters), ...{ suggestedName: basename(defaultUri), startIn } });
    } catch (error) {
      return;
    }
    if (!WebFileSystemAccess.isFileSystemFileHandle(fileHandle)) {
      return void 0;
    }
    return this.fileSystemProvider.registerFileHandle(fileHandle);
  }
  getFilePickerTypes(filters) {
    return filters?.filter((filter) => {
      return !(filter.extensions.length === 1 && (filter.extensions[0] === "*" || filter.extensions[0] === ""));
    }).map((filter) => {
      const accept = {};
      const extensions = filter.extensions.filter((ext) => ext.indexOf("-") < 0 && ext.indexOf("*") < 0 && ext.indexOf("_") < 0);
      accept[getMediaOrTextMime(`fileName.${filter.extensions[0]}`) ?? "text/plain"] = extensions.map((ext) => ext.startsWith(".") ? ext : `.${ext}`);
      return {
        description: filter.name,
        accept
      };
    });
  }
  async showSaveDialog(options) {
    const schema = this.getFileSystemSchema(options);
    if (this.shouldUseSimplified(schema)) {
      return super.showSaveDialogSimplified(schema, options);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("save");
    }
    let fileHandle = void 0;
    const startIn = Iterable.first(this.fileSystemProvider.directories);
    try {
      fileHandle = await activeWindow.showSaveFilePicker({ types: this.getFilePickerTypes(options.filters), ...options.defaultUri ? { suggestedName: basename(options.defaultUri) } : void 0, ...{ startIn } });
    } catch (error) {
      return void 0;
    }
    if (!WebFileSystemAccess.isFileSystemFileHandle(fileHandle)) {
      return void 0;
    }
    return this.fileSystemProvider.registerFileHandle(fileHandle);
  }
  async showOpenDialog(options) {
    const schema = this.getFileSystemSchema(options);
    if (this.shouldUseSimplified(schema)) {
      return super.showOpenDialogSimplified(schema, options);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("open");
    }
    let uri;
    const startIn = Iterable.first(this.fileSystemProvider.directories) ?? "documents";
    try {
      if (options.canSelectFiles) {
        const handle = await activeWindow.showOpenFilePicker({ multiple: false, types: this.getFilePickerTypes(options.filters), ...{ startIn } });
        if (handle.length === 1 && WebFileSystemAccess.isFileSystemFileHandle(handle[0])) {
          uri = await this.fileSystemProvider.registerFileHandle(handle[0]);
        }
      } else {
        const handle = await activeWindow.showDirectoryPicker({ ...{ startIn } });
        uri = await this.fileSystemProvider.registerDirectoryHandle(handle);
      }
    } catch (error) {
    }
    return uri ? [uri] : void 0;
  }
  async showUnsupportedBrowserWarning(context) {
    if (context === "save") {
      const activeCodeEditor = this.codeEditorService.getActiveCodeEditor();
      if (!(activeCodeEditor instanceof EmbeddedCodeEditorWidget)) {
        const activeTextModel = activeCodeEditor?.getModel();
        if (activeTextModel) {
          triggerDownload(VSBuffer.fromString(activeTextModel.getValue()).buffer, basename(activeTextModel.uri));
          return;
        }
      }
    }
    const buttons = [
      {
        label: localize({ key: "openRemote", comment: ["&& denotes a mnemonic"] }, "&&Open Remote..."),
        run: async () => {
          await this.commandService.executeCommand("workbench.action.remote.showMenu");
        }
      },
      {
        label: localize({ key: "learnMore", comment: ["&& denotes a mnemonic"] }, "&&Learn More"),
        run: async () => {
          await this.openerService.open("https://aka.ms/VSCodeWebLocalFileSystemAccess");
        }
      }
    ];
    if (context === "open") {
      buttons.push({
        label: localize({ key: "openFiles", comment: ["&& denotes a mnemonic"] }, "Open &&Files..."),
        run: async () => {
          const files = await triggerUpload();
          if (files) {
            const filesData = (await this.instantiationService.invokeFunction((accessor) => extractFileListData(accessor, files))).filter((fileData) => !fileData.isDirectory);
            if (filesData.length > 0) {
              this.editorService.openEditors(filesData.map((fileData) => {
                return {
                  resource: fileData.resource,
                  contents: fileData.contents?.toString(),
                  options: { pinned: true }
                };
              }));
            }
          }
        }
      });
    }
    await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("unsupportedBrowserMessage", "Opening Local Folders is Unsupported"),
      detail: localize("unsupportedBrowserDetail", "Your browser doesn't support opening local folders.\nYou can either open single files or open a remote repository."),
      buttons
    });
    return void 0;
  }
  shouldUseSimplified(scheme) {
    return ![Schemas.file, Schemas.vscodeUserData, Schemas.tmp].includes(scheme);
  }
}
__decorateClass([
  memoize
], FileDialogService.prototype, "fileSystemProvider", 1);
import { TauriFileDialogService } from "./tauriFileDialogService.js";
const SelectedFileDialogService = globalThis.__tauri_dialogs__ || typeof window !== "undefined" && window.__tauri_dialogs__ ? TauriFileDialogService : FileDialogService;
registerSingleton(IFileDialogService, SelectedFileDialogService, InstantiationType.Delayed);
export {
  FileDialogService
};
