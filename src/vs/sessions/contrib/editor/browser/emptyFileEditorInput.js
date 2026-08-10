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
import { localize } from "../../../../nls.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { URI } from "../../../../base/common/uri.js";
import { EditorInputCapabilities } from "../../../../workbench/common/editor.js";
import { IWorkbenchLayoutService, Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { DockedEditorInput } from "../../../common/dockedEditorInput.js";
let EmptyFileEditorInput = class extends DockedEditorInput {
  constructor(_workspace, layoutService) {
    super();
    this._workspace = _workspace;
    this.layoutService = layoutService;
    this._register(layoutService.onDidChangePartVisibility((event) => {
      if (event.partId === Parts.EDITOR_PART) {
        this._onDidChangeLabel.fire();
        this._onDidChangeCapabilities.fire();
      }
    }));
  }
  static {
    this.ID = "workbench.editors.agentSessions.emptyFile";
  }
  static {
    this.EDITOR_ID = "workbench.editor.agentSessions.emptyFile";
  }
  static {
    this.ICON = Codicon.files;
  }
  get resource() {
    const workspaceFolderResource = this._workspace?.folders[0]?.workingDirectory;
    return this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow) ? workspaceFolderResource : void 0;
  }
  get workspace() {
    return this._workspace;
  }
  setWorkspace(workspace) {
    if (this._workspace !== workspace) {
      this._workspace = workspace;
      this._onDidChangeLabel.fire();
    }
  }
  get typeId() {
    return EmptyFileEditorInput.ID;
  }
  get editorId() {
    return EmptyFileEditorInput.EDITOR_ID;
  }
  get capabilities() {
    const capabilities = super.capabilities | EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton | EditorInputCapabilities.ForceReveal;
    return this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow) ? capabilities : capabilities | EditorInputCapabilities.CannotClose;
  }
  getName() {
    return localize("emptyFileEditor.name", "Files");
  }
  getIcon() {
    return EmptyFileEditorInput.ICON;
  }
  getTitle(_verbosity) {
    return this.getName();
  }
  canReopen() {
    return true;
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof EmptyFileEditorInput;
  }
};
EmptyFileEditorInput = __decorateClass([
  __decorateParam(1, IWorkbenchLayoutService)
], EmptyFileEditorInput);
class EmptyFileEditorSerializer {
  canSerialize(editorInput) {
    return editorInput instanceof EmptyFileEditorInput;
  }
  serialize(editorInput) {
    if (!this.canSerialize(editorInput)) {
      return void 0;
    }
    const workspace = editorInput.workspace;
    if (!workspace) {
      return "";
    }
    return JSON.stringify({
      uri: workspace.uri.toString(),
      label: workspace.label,
      description: workspace.description,
      group: workspace.group,
      folders: workspace.folders.map((folder) => ({
        root: folder.root.toString(),
        workingDirectory: folder.workingDirectory.toString(),
        name: folder.name,
        description: folder.description
      })),
      requiresWorkspaceTrust: workspace.requiresWorkspaceTrust,
      isVirtualWorkspace: workspace.isVirtualWorkspace
    });
  }
  deserialize(instantiationService, serializedEditor) {
    if (!serializedEditor) {
      return instantiationService.createInstance(EmptyFileEditorInput, void 0);
    }
    try {
      const data = JSON.parse(serializedEditor);
      const workspace = {
        ...data,
        uri: URI.parse(data.uri),
        icon: Codicon.repo,
        folders: data.folders.map((folder) => ({
          ...folder,
          root: URI.parse(folder.root),
          workingDirectory: URI.parse(folder.workingDirectory)
        }))
      };
      return instantiationService.createInstance(EmptyFileEditorInput, workspace);
    } catch {
      return void 0;
    }
  }
}
export {
  EmptyFileEditorInput,
  EmptyFileEditorSerializer
};
