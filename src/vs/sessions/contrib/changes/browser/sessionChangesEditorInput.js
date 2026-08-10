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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { MultiDiffEditorInput } from "../../../../workbench/contrib/multiDiffEditor/browser/multiDiffEditorInput.js";
import { IWorkbenchLayoutService, Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { DockedEditorInput } from "../../../common/dockedEditorInput.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
let SessionChangesEditorInput = class extends DockedEditorInput {
  constructor(multiDiffSource, instantiationService, layoutService) {
    super();
    this.multiDiffSource = multiDiffSource;
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
    this._innerInput = this._register(new MutableDisposable());
    this._register(layoutService.onDidChangePartVisibility((event) => {
      if (event.partId === Parts.EDITOR_PART) {
        this._onDidChangeCapabilities.fire();
      }
    }));
  }
  static {
    this.ID = "workbench.input.agentSessions.sessionChanges";
  }
  static {
    this.EDITOR_ID = "workbench.editor.agentSessions.sessionChanges";
  }
  get resource() {
    return this.multiDiffSource;
  }
  get typeId() {
    return SessionChangesEditorInput.ID;
  }
  get editorId() {
    return SessionChangesEditorInput.EDITOR_ID;
  }
  get capabilities() {
    const capabilities = super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.Readonly;
    return this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow) ? capabilities : capabilities | EditorInputCapabilities.CannotClose;
  }
  getName() {
    return localize("sessionChangesEditor.name", "Changes");
  }
  getIcon() {
    return Codicon.diffMultiple;
  }
  getTitle(_verbosity) {
    return this.getName();
  }
  get innerInput() {
    if (!this._innerInput.value) {
      this._innerInput.value = MultiDiffEditorInput.fromResourceMultiDiffEditorInput({
        multiDiffSource: this.multiDiffSource,
        label: this.getName()
      }, this.instantiationService);
    }
    return this._innerInput.value;
  }
  /**
   * The wrapped multi-diff input, whose {@link MultiDiffEditorInput.resources}
   * expose the session's individual file diffs. Used to resolve the session's
   * files (e.g. for the agent feedback affordances) from this editor input.
   */
  get multiDiffInput() {
    return this.innerInput;
  }
  async getViewModel() {
    return this.innerInput.getViewModel();
  }
  clear() {
    this._innerInput.clear();
  }
  matches(otherInput) {
    if (this === otherInput) {
      return true;
    }
    return otherInput instanceof SessionChangesEditorInput && otherInput.multiDiffSource.toString() === this.multiDiffSource.toString();
  }
};
SessionChangesEditorInput = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkbenchLayoutService)
], SessionChangesEditorInput);
class SessionChangesEditorSerializer {
  canSerialize(editorInput) {
    return editorInput instanceof SessionChangesEditorInput;
  }
  serialize(editorInput) {
    if (!this.canSerialize(editorInput)) {
      return void 0;
    }
    const data = { multiDiffSourceUri: editorInput.multiDiffSource.toString() };
    return JSON.stringify(data);
  }
  deserialize(instantiationService, serializedEditor) {
    try {
      const data = JSON.parse(serializedEditor);
      return instantiationService.createInstance(SessionChangesEditorInput, URI.parse(data.multiDiffSourceUri));
    } catch {
      return void 0;
    }
  }
}
export {
  SessionChangesEditorInput,
  SessionChangesEditorSerializer
};
