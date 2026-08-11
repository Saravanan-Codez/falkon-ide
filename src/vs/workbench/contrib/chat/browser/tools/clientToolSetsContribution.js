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
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { browserChatToolReferenceNames } from "../../../../../platform/browserView/common/browserChatToolReferenceNames.js";
import { IAICustomizationWorkspaceService } from "../../common/aiCustomizationWorkspaceService.js";
import { ILanguageModelToolsService, ToolDataSource } from "../../common/tools/languageModelToolsService.js";
let ClientToolSetsContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.chat.clientToolSets";
  }
  constructor(toolsService, workspaceService) {
    super();
    if (!workspaceService.isSessionsWindow) {
      this._register(this._registerDynamicToolSet(toolsService, {
        id: "vscode-tasks",
        referenceName: "vscodeTasks",
        icon: Codicon.tasklist,
        description: localize("clientToolSet.tasks.description", "Tasks and Problems"),
        detail: localize("clientToolSet.tasks.detail", "Create and run tasks and inspect workspace problems."),
        members: [
          "createAndRunTask",
          "runTask",
          "getTaskOutput",
          "problems"
        ]
      }));
    }
    if (workspaceService.isSessionsWindow) {
      this._register(this._registerDynamicToolSet(toolsService, {
        id: "vscode-automations",
        referenceName: "vscodeAutomations",
        icon: Codicon.watch,
        description: localize("clientToolSet.automations.description", "Automations"),
        detail: localize("clientToolSet.automations.detail", "List, configure, run, and delete scheduled agent automations."),
        members: [
          "listAutomations",
          "configureAutomation",
          "runAutomation",
          "deleteAutomation"
        ]
      }));
    }
    this._register(this._registerDynamicToolSet(toolsService, {
      id: "vscode-browser",
      referenceName: "vscodeBrowser",
      icon: Codicon.browser,
      description: localize("clientToolSet.browser.description", "Integrated Browser"),
      detail: localize("clientToolSet.browser.detail", "Open, navigate, and inspect pages in the built-in browser."),
      members: browserChatToolReferenceNames
    }));
    this._register(this._registerDynamicToolSet(toolsService, {
      id: "vscode-general",
      referenceName: "vscodeGeneral",
      icon: Codicon.vscode,
      description: localize("clientToolSet.vscode.description", "VS Code"),
      detail: localize("clientToolSet.vscode.detail", "Navigate code, manage extensions, and run built-in VS Code commands."),
      members: [
        ...workspaceService.isSessionsWindow ? [] : ["runTests", "testFailure", "rename", "usages"],
        "toolSearch"
      ]
    }));
    if (!workspaceService.isSessionsWindow) {
      this._register(this._registerDynamicToolSet(toolsService, {
        id: "vscode-notebooks",
        referenceName: "vscodeNotebooks",
        icon: Codicon.notebook,
        description: localize("clientToolSet.notebooks.description", "Jupyter Notebooks"),
        detail: localize("clientToolSet.notebooks.detail", "Create and edit Jupyter notebooks and run their cells."),
        members: [
          "createJupyterNotebook",
          "editNotebook",
          "runNotebookCell",
          "getNotebookSummary",
          "readNotebookCellOutput"
        ]
      }));
    }
  }
  /**
   * Creates a tool set and keeps its membership in sync with the tools registered under the
   * reference names in {@link IDynamicToolSetSpec.members}. Returns a disposable that removes the
   * tool set and all of its member registrations.
   */
  _registerDynamicToolSet(toolsService, spec) {
    const store = new DisposableStore();
    const toolSet = store.add(toolsService.createToolSet(
      ToolDataSource.Internal,
      spec.id,
      spec.referenceName,
      {
        icon: spec.icon,
        description: spec.description,
        detail: spec.detail,
        hiddenInToolsPicker: true
      }
    ));
    const members = /* @__PURE__ */ new Map();
    const reconcile = () => {
      for (const name of spec.members) {
        const tool = toolsService.getToolByName(name) ?? toolsService.getTool(name);
        const existing = members.get(name);
        if (tool === existing?.tool) {
          continue;
        }
        existing?.disposable.dispose();
        members.delete(name);
        if (tool) {
          members.set(name, { tool, disposable: toolSet.addTool(tool) });
        }
      }
    };
    store.add(toolsService.onDidChangeTools(() => reconcile()));
    store.add(toDisposable(() => {
      for (const { disposable } of members.values()) {
        disposable.dispose();
      }
      members.clear();
    }));
    reconcile();
    return store;
  }
};
ClientToolSetsContribution = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, IAICustomizationWorkspaceService)
], ClientToolSetsContribution);
export {
  ClientToolSetsContribution
};
