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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import * as nls from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { Extensions, IViewDescriptorService } from "../../../../../common/views.js";
import { VIEWLET_ID as debugContainerId } from "../../../../debug/common/debug.js";
import { NOTEBOOK_VARIABLE_VIEW_ENABLED } from "./notebookVariableContextKeys.js";
import { NotebookVariablesView } from "./notebookVariablesView.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import { variablesViewIcon } from "../../notebookIcons.js";
import { NotebookSetting } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../../common/notebookExecutionStateService.js";
import { INotebookKernelService } from "../../../common/notebookKernelService.js";
import { INotebookService } from "../../../common/notebookService.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
let NotebookVariables = class extends Disposable {
  constructor(contextKeyService, configurationService, editorService, notebookExecutionStateService, notebookKernelService, notebookDocumentService, viewDescriptorService) {
    super();
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.notebookExecutionStateService = notebookExecutionStateService;
    this.notebookKernelService = notebookKernelService;
    this.notebookDocumentService = notebookDocumentService;
    this.viewDescriptorService = viewDescriptorService;
    this.listeners = [];
    this.initialized = false;
    this.viewEnabled = NOTEBOOK_VARIABLE_VIEW_ENABLED.bindTo(contextKeyService);
    this.listeners.push(this.editorService.onDidActiveEditorChange(() => this.handleInitEvent()));
    this.listeners.push(this.notebookExecutionStateService.onDidChangeExecution((e) => this.handleInitEvent(e.notebook)));
    this.configListener = configurationService.onDidChangeConfiguration((e) => this.handleConfigChange(e));
  }
  handleConfigChange(e) {
    if (e.affectsConfiguration(NotebookSetting.notebookVariablesView)) {
      this.handleInitEvent();
    }
  }
  handleInitEvent(notebook) {
    const enabled = this.editorService.activeEditorPane?.getId() === "workbench.editor.repl" || this.configurationService.getValue(NotebookSetting.notebookVariablesView) || // old setting key
    this.configurationService.getValue("notebook.experimental.variablesView");
    if (enabled && (!!notebook || this.editorService.activeEditorPane?.getId() === "workbench.editor.notebook")) {
      if (this.hasVariableProvider(notebook) && !this.initialized && this.initializeView()) {
        this.viewEnabled.set(true);
        this.initialized = true;
        this.listeners.forEach((listener) => listener.dispose());
      }
    }
  }
  hasVariableProvider(notebookUri) {
    const notebook = notebookUri ? this.notebookDocumentService.getNotebookTextModel(notebookUri) : getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
    return notebook && this.notebookKernelService.getMatchingKernel(notebook).selected?.hasVariableProvider;
  }
  initializeView() {
    const debugViewContainer = this.viewDescriptorService.getViewContainerById(debugContainerId);
    if (debugViewContainer) {
      const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
      const viewDescriptor = {
        id: "workbench.notebook.variables",
        name: nls.localize2("notebookVariables", "Notebook Variables"),
        containerIcon: variablesViewIcon,
        ctorDescriptor: new SyncDescriptor(NotebookVariablesView),
        order: 50,
        weight: 5,
        canToggleVisibility: true,
        canMoveView: true,
        collapsed: false,
        when: NOTEBOOK_VARIABLE_VIEW_ENABLED
      };
      viewsRegistry.registerViews([viewDescriptor], debugViewContainer);
      return true;
    }
    return false;
  }
  dispose() {
    super.dispose();
    this.listeners.forEach((listener) => listener.dispose());
    this.configListener.dispose();
  }
};
NotebookVariables = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, INotebookExecutionStateService),
  __decorateParam(4, INotebookKernelService),
  __decorateParam(5, INotebookService),
  __decorateParam(6, IViewDescriptorService)
], NotebookVariables);
export {
  NotebookVariables
};
