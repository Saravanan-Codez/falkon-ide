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
import * as nls from "../../../../../../nls.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../../common/contributions.js";
import { CENTER_ACTIVE_CELL } from "../navigation/arrow.js";
import { SELECT_KERNEL_ID } from "../../controller/coreActions.js";
import { SELECT_NOTEBOOK_INDENTATION_ID } from "../../controller/editActions.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { NotebookCellsChangeType } from "../../../common/notebookCommon.js";
import { INotebookKernelService } from "../../../common/notebookKernelService.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { IStatusbarService, StatusbarAlignment } from "../../../../../services/statusbar/browser/statusbar.js";
import { IEditorGroupsService } from "../../../../../services/editor/common/editorGroupsService.js";
import { Event } from "../../../../../../base/common/event.js";
let ImplictKernelSelector = class {
  constructor(notebook, suggested, notebookKernelService, languageFeaturesService, logService) {
    const disposables = new DisposableStore();
    this.dispose = disposables.dispose.bind(disposables);
    const selectKernel = () => {
      disposables.clear();
      notebookKernelService.selectKernelForNotebook(suggested, notebook);
    };
    disposables.add(notebook.onDidChangeContent((e) => {
      for (const event of e.rawEvents) {
        switch (event.kind) {
          case NotebookCellsChangeType.ChangeCellContent:
          case NotebookCellsChangeType.ModelChange:
          case NotebookCellsChangeType.Move:
          case NotebookCellsChangeType.ChangeCellLanguage:
            logService.trace("IMPLICIT kernel selection because of change event", event.kind);
            selectKernel();
            break;
        }
      }
    }));
    disposables.add(languageFeaturesService.hoverProvider.register({ scheme: Schemas.vscodeNotebookCell, pattern: notebook.uri.path }, {
      provideHover() {
        logService.trace("IMPLICIT kernel selection because of hover");
        selectKernel();
        return void 0;
      }
    }));
  }
};
ImplictKernelSelector = __decorateClass([
  __decorateParam(2, INotebookKernelService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ILogService)
], ImplictKernelSelector);
let KernelStatus = class extends Disposable {
  constructor(_editorService, _statusbarService, _notebookKernelService, _instantiationService) {
    super();
    this._editorService = _editorService;
    this._statusbarService = _statusbarService;
    this._notebookKernelService = _notebookKernelService;
    this._instantiationService = _instantiationService;
    this._editorDisposables = this._register(new DisposableStore());
    this._kernelInfoElement = this._register(new DisposableStore());
    this._register(this._editorService.onDidActiveEditorChange(() => this._updateStatusbar()));
    this._updateStatusbar();
  }
  _updateStatusbar() {
    this._editorDisposables.clear();
    const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    if (!activeEditor) {
      this._kernelInfoElement.clear();
      return;
    }
    const updateStatus = () => {
      if (activeEditor.notebookOptions.getDisplayOptions().globalToolbar) {
        this._kernelInfoElement.clear();
        return;
      }
      const notebook = activeEditor.textModel;
      if (notebook) {
        this._showKernelStatus(notebook);
      } else {
        this._kernelInfoElement.clear();
      }
    };
    this._editorDisposables.add(this._notebookKernelService.onDidAddKernel(updateStatus));
    this._editorDisposables.add(this._notebookKernelService.onDidChangeSelectedNotebooks(updateStatus));
    this._editorDisposables.add(this._notebookKernelService.onDidChangeNotebookAffinity(updateStatus));
    this._editorDisposables.add(activeEditor.onDidChangeModel(updateStatus));
    this._editorDisposables.add(activeEditor.notebookOptions.onDidChangeOptions(updateStatus));
    updateStatus();
  }
  _showKernelStatus(notebook) {
    this._kernelInfoElement.clear();
    const { selected, suggestions, all } = this._notebookKernelService.getMatchingKernel(notebook);
    const suggested = (suggestions.length === 1 ? suggestions[0] : void 0) ?? all.length === 1 ? all[0] : void 0;
    let isSuggested = false;
    if (all.length === 0) {
      return;
    } else if (selected || suggested) {
      let kernel = selected;
      if (!kernel) {
        kernel = suggested;
        isSuggested = true;
        this._kernelInfoElement.add(this._instantiationService.createInstance(ImplictKernelSelector, notebook, kernel));
      }
      const tooltip = kernel.description ?? kernel.detail ?? kernel.label;
      this._kernelInfoElement.add(this._statusbarService.addEntry(
        {
          name: nls.localize("notebook.info", "Notebook Kernel Info"),
          text: `$(notebook-kernel-select) ${kernel.label}`,
          ariaLabel: kernel.label,
          tooltip: isSuggested ? nls.localize("tooltop", "{0} (suggestion)", tooltip) : tooltip,
          command: SELECT_KERNEL_ID
        },
        SELECT_KERNEL_ID,
        StatusbarAlignment.RIGHT,
        10
      ));
      this._kernelInfoElement.add(kernel.onDidChange(() => this._showKernelStatus(notebook)));
    } else {
      this._kernelInfoElement.add(this._statusbarService.addEntry(
        {
          name: nls.localize("notebook.select", "Notebook Kernel Selection"),
          text: nls.localize("kernel.select.label", "Select Kernel"),
          ariaLabel: nls.localize("kernel.select.label", "Select Kernel"),
          command: SELECT_KERNEL_ID,
          kind: "prominent"
        },
        SELECT_KERNEL_ID,
        StatusbarAlignment.RIGHT,
        10
      ));
    }
  }
};
KernelStatus = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, INotebookKernelService),
  __decorateParam(3, IInstantiationService)
], KernelStatus);
let ActiveCellStatus = class extends Disposable {
  constructor(_editorService, _statusbarService) {
    super();
    this._editorService = _editorService;
    this._statusbarService = _statusbarService;
    this._itemDisposables = this._register(new DisposableStore());
    this._accessor = this._register(new MutableDisposable());
    this._register(this._editorService.onDidActiveEditorChange(() => this._update()));
    this._update();
  }
  _update() {
    this._itemDisposables.clear();
    const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    if (activeEditor) {
      this._itemDisposables.add(activeEditor.onDidChangeSelection(() => this._show(activeEditor)));
      this._itemDisposables.add(activeEditor.onDidChangeActiveCell(() => this._show(activeEditor)));
      this._show(activeEditor);
    } else {
      this._accessor.clear();
    }
  }
  _show(editor) {
    if (!editor.hasModel()) {
      this._accessor.clear();
      return;
    }
    const newText = this._getSelectionsText(editor);
    if (!newText) {
      this._accessor.clear();
      return;
    }
    const entry = {
      name: nls.localize("notebook.activeCellStatusName", "Notebook Editor Selections"),
      text: newText,
      ariaLabel: newText,
      command: CENTER_ACTIVE_CELL
    };
    if (!this._accessor.value) {
      this._accessor.value = this._statusbarService.addEntry(
        entry,
        "notebook.activeCellStatus",
        StatusbarAlignment.RIGHT,
        100
      );
    } else {
      this._accessor.value.update(entry);
    }
  }
  _getSelectionsText(editor) {
    if (!editor.hasModel()) {
      return void 0;
    }
    const activeCell = editor.getActiveCell();
    if (!activeCell) {
      return void 0;
    }
    const idxFocused = editor.getCellIndex(activeCell) + 1;
    const numSelected = editor.getSelections().reduce((prev, range) => prev + (range.end - range.start), 0);
    const totalCells = editor.getLength();
    return numSelected > 1 ? nls.localize("notebook.multiActiveCellIndicator", "Cell {0} ({1} selected)", idxFocused, numSelected) : nls.localize("notebook.singleActiveCellIndicator", "Cell {0} of {1}", idxFocused, totalCells);
  }
};
ActiveCellStatus = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IStatusbarService)
], ActiveCellStatus);
let NotebookIndentationStatus = class extends Disposable {
  constructor(_editorService, _statusbarService, _configurationService) {
    super();
    this._editorService = _editorService;
    this._statusbarService = _statusbarService;
    this._configurationService = _configurationService;
    this._itemDisposables = this._register(new DisposableStore());
    this._accessor = this._register(new MutableDisposable());
    this._register(this._editorService.onDidActiveEditorChange(() => this._update()));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor") || e.affectsConfiguration("notebook")) {
        this._update();
      }
    }));
    this._update();
  }
  static {
    this.ID = "selectNotebookIndentation";
  }
  _update() {
    this._itemDisposables.clear();
    const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
    if (activeEditor) {
      this._show(activeEditor);
      this._itemDisposables.add(activeEditor.onDidChangeSelection(() => {
        this._accessor.clear();
        this._show(activeEditor);
      }));
    } else {
      this._accessor.clear();
    }
  }
  _show(editor) {
    if (!editor.hasModel()) {
      this._accessor.clear();
      return;
    }
    const cellOptions = editor.getActiveCell()?.textModel?.getOptions();
    if (!cellOptions) {
      this._accessor.clear();
      return;
    }
    const cellEditorOverridesRaw = editor.notebookOptions.getDisplayOptions().editorOptionsCustomizations;
    const indentSize = cellEditorOverridesRaw?.["editor.indentSize"] ?? cellOptions?.indentSize;
    const insertSpaces = cellEditorOverridesRaw?.["editor.insertSpaces"] ?? cellOptions?.insertSpaces;
    const tabSize = cellEditorOverridesRaw?.["editor.tabSize"] ?? cellOptions?.tabSize;
    const width = typeof indentSize === "number" ? indentSize : tabSize;
    const message = insertSpaces ? `Spaces: ${width}` : `Tab Size: ${width}`;
    const newText = message;
    if (!newText) {
      this._accessor.clear();
      return;
    }
    const entry = {
      name: nls.localize("notebook.indentation", "Notebook Indentation"),
      text: newText,
      ariaLabel: newText,
      tooltip: nls.localize("selectNotebookIndentation", "Select Indentation"),
      command: SELECT_NOTEBOOK_INDENTATION_ID
    };
    if (!this._accessor.value) {
      this._accessor.value = this._statusbarService.addEntry(
        entry,
        "notebook.status.indentation",
        StatusbarAlignment.RIGHT,
        100.4
      );
    } else {
      this._accessor.value.update(entry);
    }
  }
};
NotebookIndentationStatus = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, IConfigurationService)
], NotebookIndentationStatus);
let NotebookEditorStatusContribution = class extends Disposable {
  constructor(editorGroupService) {
    super();
    this.editorGroupService = editorGroupService;
    for (const part of editorGroupService.parts) {
      this.createNotebookStatus(part);
    }
    this._register(editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.createNotebookStatus(part)));
  }
  static {
    this.ID = "notebook.contrib.editorStatus";
  }
  createNotebookStatus(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
    disposables.add(scopedInstantiationService.createInstance(KernelStatus));
    disposables.add(scopedInstantiationService.createInstance(ActiveCellStatus));
    disposables.add(scopedInstantiationService.createInstance(NotebookIndentationStatus));
  }
};
NotebookEditorStatusContribution = __decorateClass([
  __decorateParam(0, IEditorGroupsService)
], NotebookEditorStatusContribution);
registerWorkbenchContribution2(NotebookEditorStatusContribution.ID, NotebookEditorStatusContribution, WorkbenchPhase.AfterRestored);
