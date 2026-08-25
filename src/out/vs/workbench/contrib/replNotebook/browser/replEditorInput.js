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
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { IInteractiveHistoryService } from "../../interactive/browser/interactiveHistoryService.js";
import { CellEditType, CellKind, NotebookSetting } from "../../notebook/common/notebookCommon.js";
import { NotebookEditorInput } from "../../notebook/common/notebookEditorInput.js";
import { INotebookEditorModelResolverService } from "../../notebook/common/notebookEditorModelResolverService.js";
import { INotebookService } from "../../notebook/common/notebookService.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { localize } from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IPathService } from "../../../services/path/common/pathService.js";
const replTabIcon = registerIcon("repl-editor-label-icon", Codicon.debugLineByLine, localize("replEditorLabelIcon", "Icon of the REPL editor label."));
let ReplEditorInput = class extends NotebookEditorInput {
  constructor(resource, label, _notebookService, _notebookModelResolverService, _fileDialogService, labelService, fileService, filesConfigurationService, extensionService, editorService, textResourceConfigurationService, customEditorLabelService, historyService, _textModelService, configurationService, environmentService, pathService) {
    super(resource, void 0, "jupyter-notebook", {}, _notebookService, _notebookModelResolverService, _fileDialogService, labelService, fileService, filesConfigurationService, extensionService, editorService, textResourceConfigurationService, customEditorLabelService, environmentService, pathService);
    this.historyService = historyService;
    this._textModelService = _textModelService;
    this.isDisposing = false;
    this.isScratchpad = resource.scheme === "untitled" && configurationService.getValue(NotebookSetting.InteractiveWindowPromptToSave) !== true;
    this.label = label ?? this.createEditorLabel(resource);
  }
  static {
    this.ID = "workbench.editorinputs.replEditorInput";
  }
  getIcon() {
    return replTabIcon;
  }
  createEditorLabel(resource) {
    if (!resource) {
      return "REPL";
    }
    if (resource.scheme === "untitled") {
      const match = new RegExp("Untitled-(\\d+).").exec(resource.path);
      if (match?.length === 2) {
        return `REPL - ${match[1]}`;
      }
    }
    const filename = resource.path.split("/").pop();
    return filename ? `REPL - ${filename}` : "REPL";
  }
  get typeId() {
    return ReplEditorInput.ID;
  }
  get editorId() {
    return "repl";
  }
  getName() {
    return this.label;
  }
  get editorInputs() {
    return [this];
  }
  get capabilities() {
    const capabilities = super.capabilities;
    const scratchPad = this.isScratchpad ? EditorInputCapabilities.Scratchpad : 0;
    return capabilities | EditorInputCapabilities.Readonly | scratchPad;
  }
  async resolve() {
    const model = await super.resolve();
    if (model) {
      this.ensureInputBoxCell(model.notebook);
    }
    return model;
  }
  ensureInputBoxCell(notebook) {
    const lastCell = notebook.cells[notebook.cells.length - 1];
    if (!lastCell || lastCell.cellKind === CellKind.Markup || lastCell.outputs.length > 0 || lastCell.internalMetadata.executionOrder !== void 0) {
      notebook.applyEdits([
        {
          editType: CellEditType.Replace,
          index: notebook.cells.length,
          count: 0,
          cells: [
            {
              cellKind: CellKind.Code,
              language: "python",
              mime: void 0,
              outputs: [],
              source: ""
            }
          ]
        }
      ], true, void 0, () => void 0, void 0, false);
    }
  }
  async resolveInput(notebook) {
    if (this.inputModelRef) {
      return this.inputModelRef.object.textEditorModel;
    }
    const lastCell = notebook.cells[notebook.cells.length - 1];
    if (!lastCell) {
      throw new Error("The REPL editor requires at least one cell for the input box.");
    }
    this.inputModelRef = await this._textModelService.createModelReference(lastCell.uri);
    return this.inputModelRef.object.textEditorModel;
  }
  dispose() {
    if (!this.isDisposing) {
      this.isDisposing = true;
      this.editorModelReference?.object.revert({ soft: true });
      this.inputModelRef?.dispose();
      super.dispose();
    }
  }
};
ReplEditorInput = __decorateClass([
  __decorateParam(2, INotebookService),
  __decorateParam(3, INotebookEditorModelResolverService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IFilesConfigurationService),
  __decorateParam(8, IExtensionService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, ITextResourceConfigurationService),
  __decorateParam(11, ICustomEditorLabelService),
  __decorateParam(12, IInteractiveHistoryService),
  __decorateParam(13, ITextModelService),
  __decorateParam(14, IConfigurationService),
  __decorateParam(15, IWorkbenchEnvironmentService),
  __decorateParam(16, IPathService)
], ReplEditorInput);
export {
  ReplEditorInput
};
