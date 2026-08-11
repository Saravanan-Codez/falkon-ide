import { URI } from "../../../../base/common/uri.js";
import { AbstractFileDialogService } from "./abstractFileDialogService.js";
import { Schemas } from "../../../../base/common/network.js";
class TauriFileDialogService extends AbstractFileDialogService {
  get tauriDialogs() {
    return globalThis.__tauri_dialogs__ || window.__tauri_dialogs__;
  }
  async pickFileFolderAndOpen(options) {
    if (this.tauriDialogs) {
      const path = await this.tauriDialogs.openFolder();
      if (path) {
        await this.hostService.openWindow([{ folderUri: URI.file(path) }], { forceReuseWindow: true });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    return super.pickFileFolderAndOpenSimplified(schema, options, false);
  }
  addFileSchemaIfNeeded(schema, isFolder) {
    return schema === Schemas.untitled ? [Schemas.file] : schema !== Schemas.file && (!isFolder || schema !== Schemas.vscodeRemote) ? [schema, Schemas.file] : [schema];
  }
  async pickFileAndOpen(options) {
    if (this.tauriDialogs) {
      const path = await this.tauriDialogs.openFile();
      if (path) {
        const uri = URI.file(path);
        this.addFileToRecentlyOpened(uri);
        await this.openerService.open(uri, { fromUserGesture: true, editorOptions: { pinned: true } });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    return super.pickFileAndOpenSimplified(schema, options, false);
  }
  async pickFolderAndOpen(options) {
    if (this.tauriDialogs) {
      const path = await this.tauriDialogs.openFolder();
      if (path) {
        await this.hostService.openWindow([{ folderUri: URI.file(path) }], { forceReuseWindow: true });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    return super.pickFolderAndOpenSimplified(schema, options);
  }
  async pickWorkspaceAndOpen(options) {
    if (this.tauriDialogs) {
      const path = await this.tauriDialogs.openFolder();
      if (path) {
        await this.hostService.openWindow([{ folderUri: URI.file(path) }], { forceReuseWindow: true });
      }
      return;
    }
    const schema = this.getFileSystemSchema(options);
    return super.pickWorkspaceAndOpenSimplified(schema, options);
  }
  async showSaveDialog(options) {
    if (this.tauriDialogs) {
      const path = await this.tauriDialogs.saveFile();
      if (path) {
        return URI.file(path);
      }
      return void 0;
    }
    const schema = this.getFileSystemSchema(options);
    return super.showSaveDialogSimplified(schema, options);
  }
  async showOpenDialog(options) {
    if (this.tauriDialogs) {
      const isFolder = options.canSelectFolders && !options.canSelectFiles;
      const path = isFolder ? await this.tauriDialogs.openFolder() : await this.tauriDialogs.openFile();
      if (path) {
        return [URI.file(path)];
      }
      return void 0;
    }
    const schema = this.getFileSystemSchema(options);
    return super.showOpenDialogSimplified(schema, options);
  }
}
export {
  TauriFileDialogService
};
