import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { getChangesEditorFileStats } from "./changesEditorLabels.js";
import { SessionChangesFileResourceContext } from "./changesMultiDiffSourceResolver.js";
import { ChangesetReviewedFilesContext, ChangesetReviewSupportContext } from "./changesViewService.js";
import { CHANGESET_REVIEW_ACTION_ID, SessionChangesEditor } from "./sessionChangesEditor.js";
class ChangesetReviewAction extends Action2 {
  constructor() {
    super({
      id: CHANGESET_REVIEW_ACTION_ID,
      title: localize("changeset.viewed", "Viewed"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.in(
          SessionChangesFileResourceContext.key,
          ChangesetReviewedFilesContext.key
        )
      },
      menu: {
        id: MenuId.MultiDiffEditorFileToolbar,
        when: ContextKeyExpr.and(
          ChangesetReviewSupportContext.isEqualTo(true),
          ContextKeyExpr.equals("resourceScheme", "changes-multi-diff-source")
        ),
        group: "navigation",
        order: 100
      }
    });
  }
  run(accessor, ...args) {
    const resource = args[0];
    if (!(resource instanceof URI)) {
      return;
    }
    const changesViewService = accessor.get(IChangesViewService);
    if (changesViewService.activeSessionChangesetObs.get()?.capabilities?.review !== true) {
      return;
    }
    const activeSessionChanges = changesViewService.activeSessionChangesObs.get();
    if (!getChangesEditorFileStats(resource, activeSessionChanges)) {
      return;
    }
    const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
    const reviewedFiles = activeSessionChanges.filter((change) => change.reviewed).map((change) => change.modifiedUri?.toString() ?? change.originalUri?.toString()).filter((uri) => uri !== void 0);
    const review = !reviewedFiles.includes(resource.toString());
    if (activeEditorPane instanceof SessionChangesEditor) {
      if (review) {
        activeEditorPane.collapse(resource);
      } else {
        activeEditorPane.expand(resource);
      }
    }
    changesViewService.setChangesetFilesReviewState([resource], review);
  }
}
registerAction2(ChangesetReviewAction);
export {
  ChangesetReviewAction
};
