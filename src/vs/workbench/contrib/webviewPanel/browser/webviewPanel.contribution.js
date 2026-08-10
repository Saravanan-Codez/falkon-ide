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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { HideWebViewEditorFindCommand, ReloadWebviewAction, ShowWebViewEditorFindWidgetAction, WebViewEditorFindNextCommand, WebViewEditorFindPreviousCommand } from "./webviewCommands.js";
import { WebviewEditor } from "./webviewEditor.js";
import { WebviewInput } from "./webviewEditorInput.js";
import { WebviewEditorInputSerializer } from "./webviewEditorInputSerializer.js";
import { IWebviewWorkbenchService, WebviewEditorService } from "./webviewWorkbenchService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    WebviewEditor,
    WebviewEditor.ID,
    localize("webview.editor.label", "webview editor")
  ),
  [new SyncDescriptor(WebviewInput)]
);
let WebviewPanelContribution = class extends Disposable {
  constructor(editorService, editorGroupService) {
    super();
    this.editorGroupService = editorGroupService;
    this._register(editorService.onWillOpenEditor((e) => {
      const group = editorGroupService.getGroup(e.groupId);
      if (group) {
        this.onEditorOpening(e.editor, group);
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.webviewPanel";
  }
  onEditorOpening(editor, group) {
    if (!(editor instanceof WebviewInput) || editor.typeId !== WebviewInput.typeId) {
      return;
    }
    if (group.contains(editor)) {
      return;
    }
    let previousGroup;
    const groups = this.editorGroupService.groups;
    for (const group2 of groups) {
      if (group2.contains(editor)) {
        previousGroup = group2;
        break;
      }
    }
    if (!previousGroup) {
      return;
    }
    previousGroup.closeEditor(editor);
  }
};
WebviewPanelContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService)
], WebviewPanelContribution);
registerWorkbenchContribution2(WebviewPanelContribution.ID, WebviewPanelContribution, WorkbenchPhase.BlockStartup);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  WebviewEditorInputSerializer.ID,
  WebviewEditorInputSerializer
);
registerSingleton(IWebviewWorkbenchService, WebviewEditorService, InstantiationType.Delayed);
registerAction2(ShowWebViewEditorFindWidgetAction);
registerAction2(HideWebViewEditorFindCommand);
registerAction2(WebViewEditorFindNextCommand);
registerAction2(WebViewEditorFindPreviousCommand);
registerAction2(ReloadWebviewAction);
