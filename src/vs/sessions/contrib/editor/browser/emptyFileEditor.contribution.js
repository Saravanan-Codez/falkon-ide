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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../../workbench/browser/editor.js";
import { EditorExtensions } from "../../../../workbench/common/editor.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { EmptyFileEditor } from "./emptyFileEditor.js";
import { EmptyFileEditorInput, EmptyFileEditorSerializer } from "./emptyFileEditorInput.js";
let SinglePaneEmptyFileEditorContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.singlePaneEmptyFileEditor";
  }
  constructor(layoutService) {
    super();
    if (!layoutService.isSinglePaneLayoutEnabled) {
      return;
    }
    this._register(Registry.as(EditorExtensions.EditorPane).registerEditorPane(
      EditorPaneDescriptor.create(
        EmptyFileEditor,
        EmptyFileEditor.ID,
        localize("emptyFileEditor.label", "File")
      ),
      [new SyncDescriptor(EmptyFileEditorInput)]
    ));
    this._register(Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
      EmptyFileEditorInput.ID,
      EmptyFileEditorSerializer
    ));
  }
};
SinglePaneEmptyFileEditorContribution = __decorateClass([
  __decorateParam(0, IAgentWorkbenchLayoutService)
], SinglePaneEmptyFileEditorContribution);
registerWorkbenchContribution2(SinglePaneEmptyFileEditorContribution.ID, SinglePaneEmptyFileEditorContribution, WorkbenchPhase.BlockStartup);
