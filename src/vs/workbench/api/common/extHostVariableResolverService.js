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
import { Lazy } from "../../../base/common/lazy.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import * as path from "../../../base/common/path.js";
import * as process from "../../../base/common/process.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostDocumentsAndEditors } from "./extHostDocumentsAndEditors.js";
import { IExtHostEditorTabs } from "./extHostEditorTabs.js";
import { IExtHostExtensionService } from "./extHostExtensionService.js";
import { CustomEditorTabInput, NotebookDiffEditorTabInput, NotebookEditorTabInput, TextDiffTabInput, TextTabInput } from "./extHostTypes.js";
import { IExtHostWorkspace } from "./extHostWorkspace.js";
import { AbstractVariableResolverService } from "../../services/configurationResolver/common/variableResolver.js";
import { IExtHostConfiguration } from "./extHostConfiguration.js";
const IExtHostVariableResolverProvider = createDecorator("IExtHostVariableResolverProvider");
class ExtHostVariableResolverService extends AbstractVariableResolverService {
  constructor(extensionService, workspaceService, editorService, editorTabs, configProvider, context, homeDir) {
    function getActiveUri() {
      if (editorService) {
        const activeEditor = editorService.activeEditor();
        if (activeEditor) {
          return activeEditor.document.uri;
        }
        const activeTab = editorTabs.tabGroups.all.find((group) => group.isActive)?.activeTab;
        if (activeTab !== void 0) {
          if (activeTab.input instanceof TextDiffTabInput || activeTab.input instanceof NotebookDiffEditorTabInput) {
            return activeTab.input.modified;
          } else if (activeTab.input instanceof TextTabInput || activeTab.input instanceof NotebookEditorTabInput || activeTab.input instanceof CustomEditorTabInput) {
            return activeTab.input.uri;
          }
        }
      }
      return void 0;
    }
    super({
      getFolderUri: (folderName) => {
        const found = context.folders.filter((f) => f.name === folderName);
        if (found && found.length > 0) {
          return found[0].uri;
        }
        return void 0;
      },
      getWorkspaceFolderCount: () => {
        return context.folders.length;
      },
      getConfigurationValue: (folderUri, section) => {
        return configProvider.getConfiguration(void 0, folderUri).get(section);
      },
      getAppRoot: () => {
        return process.cwd();
      },
      getExecPath: () => {
        return process.env["VSCODE_EXEC_PATH"];
      },
      getFilePath: () => {
        const activeUri = getActiveUri();
        if (activeUri) {
          return path.normalize(activeUri.fsPath);
        }
        return void 0;
      },
      getWorkspaceFolderPathForFile: () => {
        if (workspaceService) {
          const activeUri = getActiveUri();
          if (activeUri) {
            const ws = workspaceService.getWorkspaceFolder(activeUri);
            if (ws) {
              return path.normalize(ws.uri.fsPath);
            }
          }
        }
        return void 0;
      },
      getSelectedText: () => {
        if (editorService) {
          const activeEditor = editorService.activeEditor();
          if (activeEditor && !activeEditor.selection.isEmpty) {
            return activeEditor.document.getText(activeEditor.selection);
          }
        }
        return void 0;
      },
      getLineNumber: () => {
        if (editorService) {
          const activeEditor = editorService.activeEditor();
          if (activeEditor) {
            return String(activeEditor.selection.end.line + 1);
          }
        }
        return void 0;
      },
      getColumnNumber: () => {
        if (editorService) {
          const activeEditor = editorService.activeEditor();
          if (activeEditor) {
            return String(activeEditor.selection.end.character + 1);
          }
        }
        return void 0;
      },
      getExtension: (id) => {
        return extensionService.getExtension(id);
      }
    }, void 0, homeDir ? Promise.resolve(homeDir) : void 0, Promise.resolve(process.env));
  }
}
let ExtHostVariableResolverProviderService = class extends Disposable {
  constructor(extensionService, workspaceService, editorService, configurationService, editorTabs) {
    super();
    this.extensionService = extensionService;
    this.workspaceService = workspaceService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.editorTabs = editorTabs;
    this._resolver = new Lazy(async () => {
      const configProvider = await this.configurationService.getConfigProvider();
      const folders = await this.workspaceService.getWorkspaceFolders2() || [];
      const dynamic = { folders };
      this._register(this.workspaceService.onDidChangeWorkspace(async (e) => {
        dynamic.folders = await this.workspaceService.getWorkspaceFolders2() || [];
      }));
      return new ExtHostVariableResolverService(
        this.extensionService,
        this.workspaceService,
        this.editorService,
        this.editorTabs,
        configProvider,
        dynamic,
        this.homeDir()
      );
    });
  }
  getResolver() {
    return this._resolver.value;
  }
  homeDir() {
    return void 0;
  }
};
ExtHostVariableResolverProviderService = __decorateClass([
  __decorateParam(0, IExtHostExtensionService),
  __decorateParam(1, IExtHostWorkspace),
  __decorateParam(2, IExtHostDocumentsAndEditors),
  __decorateParam(3, IExtHostConfiguration),
  __decorateParam(4, IExtHostEditorTabs)
], ExtHostVariableResolverProviderService);
export {
  ExtHostVariableResolverProviderService,
  IExtHostVariableResolverProvider
};
