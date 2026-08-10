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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { IHostService } from "../../host/browser/host.js";
import { IFileDialogService, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IHistoryService } from "../../history/common/history.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { URI } from "../../../../base/common/uri.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { AbstractFileDialogService } from "../browser/abstractFileDialogService.js";
import { Schemas } from "../../../../base/common/network.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IPathService } from "../../path/common/pathService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { getActiveWindow } from "../../../../base/browser/dom.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
let FileDialogService = class extends AbstractFileDialogService {
  constructor(hostService, contextService, historyService, environmentService, instantiationService, configurationService, fileService, openerService, nativeHostService, dialogService, languageService, workspacesService, labelService, pathService, commandService, editorService, codeEditorService, logService, remoteAgentService) {
    super(
      hostService,
      contextService,
      historyService,
      environmentService,
      instantiationService,
      configurationService,
      fileService,
      openerService,
      dialogService,
      languageService,
      workspacesService,
      labelService,
      pathService,
      commandService,
      editorService,
      codeEditorService,
      logService,
      remoteAgentService
    );
    this.nativeHostService = nativeHostService;
  }
  toNativeOpenDialogOptions(options) {
    return {
      forceNewWindow: options.forceNewWindow,
      telemetryExtraData: options.telemetryExtraData,
      defaultPath: options.defaultUri?.fsPath
    };
  }
  shouldUseSimplified(schema) {
    const setting = this.configurationService.getValue("files.simpleDialog.enable") === true;
    const newWindowSetting = this.configurationService.getValue("window.openFilesInNewWindow") === "on";
    return {
      // - Only real files can be shown in the native file picker
      // - If the simple file dialog is enabled
      // - driver automation (like smoke tests) can use the simple file dialog but not native
      useSimplified: schema !== Schemas.file && schema !== Schemas.vscodeUserData || setting || !!this.environmentService.enableSmokeTestDriver,
      isSetting: newWindowSetting
    };
  }
  async pickFileFolderAndOpen(options) {
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFilePath(schema);
    }
    const shouldUseSimplified = this.shouldUseSimplified(schema);
    if (shouldUseSimplified.useSimplified) {
      return this.pickFileFolderAndOpenSimplified(schema, options, shouldUseSimplified.isSetting);
    }
    return this.nativeHostService.pickFileFolderAndOpen(this.toNativeOpenDialogOptions(options));
  }
  async pickFileAndOpen(options) {
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFilePath(schema);
    }
    const shouldUseSimplified = this.shouldUseSimplified(schema);
    if (shouldUseSimplified.useSimplified) {
      return this.pickFileAndOpenSimplified(schema, options, shouldUseSimplified.isSetting);
    }
    return this.nativeHostService.pickFileAndOpen(this.toNativeOpenDialogOptions(options));
  }
  async pickFolderAndOpen(options) {
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFolderPath(schema);
    }
    if (this.shouldUseSimplified(schema).useSimplified) {
      return this.pickFolderAndOpenSimplified(schema, options);
    }
    return this.nativeHostService.pickFolderAndOpen(this.toNativeOpenDialogOptions(options));
  }
  async pickWorkspaceAndOpen(options) {
    options.availableFileSystems = this.getWorkspaceAvailableFileSystems(options);
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultWorkspacePath(schema);
    }
    if (this.shouldUseSimplified(schema).useSimplified) {
      return this.pickWorkspaceAndOpenSimplified(schema, options);
    }
    return this.nativeHostService.pickWorkspaceAndOpen(this.toNativeOpenDialogOptions(options));
  }
  async pickFileToSave(defaultUri, availableFileSystems) {
    const schema = this.getFileSystemSchema({ defaultUri, availableFileSystems });
    const options = this.getPickFileToSaveDialogOptions(defaultUri, availableFileSystems);
    if (this.shouldUseSimplified(schema).useSimplified) {
      return this.pickFileToSaveSimplified(schema, options);
    } else {
      const result = await this.nativeHostService.showSaveDialog(this.toNativeSaveDialogOptions(options));
      if (result && !result.canceled && result.filePath) {
        const uri = URI.file(result.filePath);
        this.addFileToRecentlyOpened(uri);
        return uri;
      }
    }
    return;
  }
  toNativeSaveDialogOptions(options) {
    options.defaultUri = options.defaultUri ? URI.file(options.defaultUri.path) : void 0;
    return {
      defaultPath: options.defaultUri?.fsPath,
      buttonLabel: typeof options.saveLabel === "string" ? options.saveLabel : options.saveLabel?.withMnemonic,
      filters: options.filters,
      title: options.title,
      targetWindowId: getActiveWindow().vscodeWindowId
    };
  }
  async showSaveDialog(options) {
    const schema = this.getFileSystemSchema(options);
    if (this.shouldUseSimplified(schema).useSimplified) {
      return this.showSaveDialogSimplified(schema, options);
    }
    const result = await this.nativeHostService.showSaveDialog(this.toNativeSaveDialogOptions(options));
    if (result && !result.canceled && result.filePath) {
      return URI.file(result.filePath);
    }
    return;
  }
  async showOpenDialog(options) {
    const schema = this.getFileSystemSchema(options);
    if (this.shouldUseSimplified(schema).useSimplified) {
      return this.showOpenDialogSimplified(schema, options);
    }
    const newOptions = {
      title: options.title,
      defaultPath: options.defaultUri?.fsPath,
      buttonLabel: typeof options.openLabel === "string" ? options.openLabel : options.openLabel?.withMnemonic,
      filters: options.filters,
      properties: [],
      targetWindowId: getActiveWindow().vscodeWindowId
    };
    newOptions.properties.push("createDirectory");
    if (options.canSelectFiles) {
      newOptions.properties.push("openFile");
    }
    if (options.canSelectFolders) {
      newOptions.properties.push("openDirectory");
    }
    if (options.canSelectMany) {
      newOptions.properties.push("multiSelections");
    }
    const result = await this.nativeHostService.showOpenDialog(newOptions);
    return result && Array.isArray(result.filePaths) && result.filePaths.length > 0 ? result.filePaths.map(URI.file) : void 0;
  }
};
FileDialogService = __decorateClass([
  __decorateParam(0, IHostService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IHistoryService),
  __decorateParam(3, IWorkbenchEnvironmentService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, INativeHostService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, ILanguageService),
  __decorateParam(11, IWorkspacesService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IPathService),
  __decorateParam(14, ICommandService),
  __decorateParam(15, IEditorService),
  __decorateParam(16, ICodeEditorService),
  __decorateParam(17, ILogService),
  __decorateParam(18, IRemoteAgentService)
], FileDialogService);
registerSingleton(IFileDialogService, FileDialogService, InstantiationType.Delayed);
export {
  FileDialogService
};
