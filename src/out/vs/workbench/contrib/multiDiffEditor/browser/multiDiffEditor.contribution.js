import { localize } from "../../../../nls.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { MultiDiffEditor } from "./multiDiffEditor.js";
import { MultiDiffEditorInput, MultiDiffEditorResolverContribution, MultiDiffEditorSerializer } from "./multiDiffEditorInput.js";
import { CollapseAllAction, ExpandAllAction, GoToFileAction, GoToNextChangeAction, GoToPreviousChangeAction } from "./actions.js";
import { IMultiDiffSourceResolverService, MultiDiffSourceResolverService } from "./multiDiffSourceResolverService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { OpenScmGroupAction, ScmMultiDiffSourceResolverContribution } from "./scmMultiDiffSourceResolver.js";
registerAction2(GoToFileAction);
registerAction2(GoToNextChangeAction);
registerAction2(GoToPreviousChangeAction);
registerAction2(CollapseAllAction);
registerAction2(ExpandAllAction);
registerSingleton(IMultiDiffSourceResolverService, MultiDiffSourceResolverService, InstantiationType.Delayed);
registerWorkbenchContribution2(
  MultiDiffEditorResolverContribution.ID,
  MultiDiffEditorResolverContribution,
  WorkbenchPhase.BlockStartup
  /* only registering an editor resolver */
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(MultiDiffEditor, MultiDiffEditor.ID, localize("name", "Multi Diff Editor")),
  [new SyncDescriptor(MultiDiffEditorInput)]
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(MultiDiffEditorInput.ID, MultiDiffEditorSerializer);
registerAction2(OpenScmGroupAction);
registerWorkbenchContribution2(
  ScmMultiDiffSourceResolverContribution.ID,
  ScmMultiDiffSourceResolverContribution,
  WorkbenchPhase.BlockStartup
  /* only registering an editor resolver  */
);
