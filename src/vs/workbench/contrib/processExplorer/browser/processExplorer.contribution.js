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
import { localize, localize2 } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { ProcessExplorerEditorInput } from "./processExplorerEditorInput.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { AUX_WINDOW_GROUP, IEditorService } from "../../../services/editor/common/editorService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IAuxiliaryWindowService } from "../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { RemoteNameContext } from "../../../common/contextkeys.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
let ProcessExplorerEditorContribution = class {
  static {
    this.ID = "workbench.contrib.processExplorerEditor";
  }
  constructor(editorResolverService, instantiationService) {
    editorResolverService.registerEditor(
      `${ProcessExplorerEditorInput.RESOURCE.scheme}:**/**`,
      {
        id: ProcessExplorerEditorInput.ID,
        label: localize("promptOpenWith.processExplorer.displayName", "Process Explorer"),
        priority: RegisteredEditorPriority.exclusive
      },
      {
        singlePerResource: true,
        canSupportResource: (resource) => resource.scheme === ProcessExplorerEditorInput.RESOURCE.scheme
      },
      {
        createEditorInput: () => {
          return {
            editor: instantiationService.createInstance(ProcessExplorerEditorInput),
            options: {
              pinned: true
            }
          };
        }
      }
    );
  }
};
ProcessExplorerEditorContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], ProcessExplorerEditorContribution);
registerWorkbenchContribution2(ProcessExplorerEditorContribution.ID, ProcessExplorerEditorContribution, WorkbenchPhase.BlockStartup);
class ProcessExplorerEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    return "";
  }
  deserialize(instantiationService) {
    return ProcessExplorerEditorInput.instance;
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ProcessExplorerEditorInput.ID, ProcessExplorerEditorInputSerializer);
const supported = ContextKeyExpr.or(IsWebContext.negate(), RemoteNameContext.notEqualsTo(""));
class OpenProcessExplorer extends Action2 {
  static {
    this.ID = "workbench.action.openProcessExplorer";
  }
  static {
    this.STATE_KEY = "workbench.processExplorerWindowState";
  }
  static {
    this.DEFAULT_STATE = { bounds: { width: 800, height: 500 } };
  }
  constructor() {
    super({
      id: OpenProcessExplorer.ID,
      title: localize2("openProcessExplorer", "Open Process Explorer"),
      category: Categories.Developer,
      precondition: supported,
      f1: true
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const auxiliaryWindowService = accessor.get(IAuxiliaryWindowService);
    const storageService = accessor.get(IStorageService);
    const pane = await editorService.openEditor({
      resource: ProcessExplorerEditorInput.RESOURCE,
      options: {
        pinned: true,
        revealIfOpened: true,
        auxiliary: {
          ...this.loadState(storageService),
          compact: true,
          alwaysOnTop: true
        }
      }
    }, AUX_WINDOW_GROUP);
    if (pane) {
      const listener = pane.input?.onWillDispose(() => {
        listener?.dispose();
        this.saveState(pane.group.id, storageService, editorGroupService, auxiliaryWindowService);
      });
    }
  }
  loadState(storageService) {
    const stateRaw = storageService.get(OpenProcessExplorer.STATE_KEY, StorageScope.APPLICATION);
    if (!stateRaw) {
      return OpenProcessExplorer.DEFAULT_STATE;
    }
    try {
      return JSON.parse(stateRaw);
    } catch {
      return OpenProcessExplorer.DEFAULT_STATE;
    }
  }
  saveState(group, storageService, editorGroupService, auxiliaryWindowService) {
    const auxiliaryWindow = auxiliaryWindowService.getWindow(editorGroupService.getPart(group).windowId);
    if (!auxiliaryWindow) {
      return;
    }
    const bounds = auxiliaryWindow.createState().bounds;
    if (!bounds) {
      return;
    }
    storageService.store(OpenProcessExplorer.STATE_KEY, JSON.stringify({ bounds }), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
}
registerAction2(OpenProcessExplorer);
MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
  group: "5_tools",
  command: {
    id: OpenProcessExplorer.ID,
    title: localize({ key: "miOpenProcessExplorerer", comment: ["&& denotes a mnemonic"] }, "Open &&Process Explorer")
  },
  when: supported,
  order: 2
});
