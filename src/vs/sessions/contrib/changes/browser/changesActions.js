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
import { $ } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derivedOpts, observableValue, transaction } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuId, MenuItemAction, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { ActiveEditorContext } from "../../../../workbench/common/contextkeys.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { MultiDiffEditor } from "../../../../workbench/contrib/multiDiffEditor/browser/multiDiffEditor.js";
import { DiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { Menus } from "../../../browser/menus.js";
import { SessionHeaderMetaActionViewItem } from "../../../browser/parts/sessionHeaderMetaActionViewItem.js";
import { SessionHasChangesContext, IsQuickChatSessionContext } from "../../../common/contextkeys.js";
import { ISessionContext } from "../../../services/sessions/browser/sessionContext.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionChangesetOperationScope } from "../../../services/sessions/common/session.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { ChangesMultiDiffSourceResolver, SessionChangesReviewedFilesContext } from "./changesMultiDiffSourceResolver.js";
import { ISessionChangesService } from "./sessionChangesService.js";
import { SessionChangesEditor } from "./sessionChangesEditor.js";
import { VIEW_SESSION_CHANGES_COMMAND_ID } from "../common/changes.js";
class ViewAllChangesAction extends Action2 {
  static {
    this.ID = VIEW_SESSION_CHANGES_COMMAND_ID;
  }
  constructor() {
    super({
      id: ViewAllChangesAction.ID,
      title: localize2("agentSessions.changes", "Changes"),
      icon: Codicon.diffMultiple,
      f1: false,
      // Diff stats shown in the session header meta row
      // (vs/sessions/browser/parts/sessionHeader.ts). Rendered with a
      // custom action view item that shows the live +/- counts.
      menu: {
        id: Menus.SessionHeaderMeta,
        group: "navigation",
        order: 0,
        when: ContextKeyExpr.and(SessionHasChangesContext, IsQuickChatSessionContext.negate())
      }
    });
  }
  async run(accessor, session) {
    const sessionsService = accessor.get(ISessionsService);
    const sessionChangesService = accessor.get(ISessionChangesService);
    const changesViewService = accessor.get(IChangesViewService);
    const layoutService = accessor.get(IAgentWorkbenchLayoutService);
    const sessionResource = (session ?? sessionsService.activeSession.get())?.resource;
    if (!sessionResource) {
      return;
    }
    changesViewService.setChangesetId(void 0);
    layoutService.revealEditorPartExplicitly();
    await sessionChangesService.openChangesEditor(sessionResource);
  }
}
registerAction2(ViewAllChangesAction);
class OpenChangedFileAction extends Action2 {
  static {
    this.ID = "workbench.agentSessions.changes.openFile";
  }
  constructor() {
    super({
      id: OpenChangedFileAction.ID,
      title: localize2("agentSessions.changes.openFile", "Open File"),
      icon: Codicon.goToFile,
      f1: false,
      menu: {
        id: MenuId.MultiDiffEditorFileToolbar,
        when: ActiveEditorContext.isEqualTo(SessionChangesEditor.ID),
        group: "navigation",
        order: 22
      }
    });
  }
  async run(accessor, ...args) {
    const resource = args[0];
    if (!(resource instanceof URI)) {
      return;
    }
    await accessor.get(IEditorService).openEditor({ resource });
  }
}
registerAction2(OpenChangedFileAction);
function getChangesDiffEditor(pane, resource) {
  const codeEditor = pane instanceof SessionChangesEditor || pane instanceof MultiDiffEditor ? pane.tryGetCodeEditor(resource) : void 0;
  return codeEditor?.diffEditor instanceof DiffEditorWidget ? codeEditor.diffEditor : void 0;
}
class ExpandFullFileAction extends Action2 {
  static {
    this.ID = "workbench.agentSessions.changes.expandFullFile";
  }
  constructor() {
    super({
      id: ExpandFullFileAction.ID,
      title: localize2("agentSessions.changes.expandFullFile", "Expand Full File"),
      icon: Codicon.unfold,
      f1: false,
      menu: {
        id: MenuId.MultiDiffEditorFileToolbar,
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("resourceScheme", "changes-multi-diff-source"),
          EditorContextKeys.multiDiffEditorItemAllUnchangedRegionsShown.toNegated()
        ),
        group: "navigation",
        order: 21
      }
    });
  }
  async run(accessor, ...args) {
    const resource = args[0];
    if (!(resource instanceof URI)) {
      return;
    }
    getChangesDiffEditor(accessor.get(IEditorService).activeEditorPane, resource)?.showAllUnchangedRegions();
  }
}
registerAction2(ExpandFullFileAction);
class CollapseUnchangedRegionsAction extends Action2 {
  static {
    this.ID = "workbench.agentSessions.changes.collapseUnchangedRegions";
  }
  constructor() {
    super({
      id: CollapseUnchangedRegionsAction.ID,
      title: localize2("agentSessions.changes.collapseUnchangedRegions", "Collapse Unchanged Regions"),
      icon: Codicon.fold,
      f1: false,
      menu: {
        id: MenuId.MultiDiffEditorFileToolbar,
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("resourceScheme", "changes-multi-diff-source"),
          EditorContextKeys.multiDiffEditorItemAllUnchangedRegionsShown
        ),
        group: "navigation",
        order: 21
      }
    });
  }
  async run(accessor, ...args) {
    const resource = args[0];
    if (!(resource instanceof URI)) {
      return;
    }
    getChangesDiffEditor(accessor.get(IEditorService).activeEditorPane, resource)?.collapseAllUnchangedRegions();
  }
}
registerAction2(CollapseUnchangedRegionsAction);
let ViewAllChangesActionViewItem = class extends SessionHeaderMetaActionViewItem {
  constructor(action, options, sessionContext) {
    super(void 0, action, options);
    this._diffStatsObs = derivedOpts({ owner: this, equalsFn: structuralEquals }, (reader) => {
      const session = sessionContext.session.read(reader);
      const workspace = session?.workspace.read(reader);
      const branch = workspace?.folders[0]?.gitRepository?.branchName?.trim();
      const changesSummary = session?.changesSummary?.read(reader);
      if (changesSummary) {
        return {
          branch,
          files: changesSummary.files,
          insertions: changesSummary.additions,
          deletions: changesSummary.deletions
        };
      }
      const defaultChangeset = session?.changesets.read(reader)?.find((c) => c.isDefault.read(reader));
      const changes = defaultChangeset?.changes.read(reader) ?? session?.changes.read(reader) ?? [];
      let insertions = 0, deletions = 0;
      for (const change of changes) {
        insertions += change.insertions;
        deletions += change.deletions;
      }
      return {
        branch,
        files: changes.length,
        insertions,
        deletions
      };
    });
    this._register(autorun((reader) => {
      this._diffStatsObs.read(reader);
      this.updateLabel();
      this.updateTooltip();
      this.updateAriaLabel();
    }));
  }
  getLabelText() {
    const { files } = this._diffStatsObs.get();
    return files === 1 ? localize("agentSessions.changes.file", "{0} file", files) : localize("agentSessions.changes.files", "{0} files", files);
  }
  getAdditionalLabelContent() {
    const { insertions, deletions } = this._diffStatsObs.get();
    return [
      $("span.chat-composite-bar-meta-added", void 0, `+${insertions}`),
      $("span.chat-composite-bar-meta-removed", void 0, `-${deletions}`)
    ];
  }
  getTooltip() {
    const { branch } = this._diffStatsObs.get();
    return branch ? localize("agentSessions.viewChanges.tooltip.branch", "View All Changes ({0})", branch) : localize("agentSessions.viewChanges.tooltip", "View All Changes");
  }
  getAriaLabel() {
    const { files, insertions, deletions } = this._diffStatsObs.get();
    const filesLabel = files === 1 ? localize("agentSessions.changes.file", "{0} file", files) : localize("agentSessions.changes.files", "{0} files", files);
    return localize("agentSessions.viewChanges.ariaLabel", "{0}: {1}, +{2}, -{3}", this.getTooltip(), filesLabel, insertions, deletions);
  }
};
ViewAllChangesActionViewItem = __decorateClass([
  __decorateParam(2, ISessionContext)
], ViewAllChangesActionViewItem);
let ViewAllChangesActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.viewAllChangesActionViewItem";
  }
  constructor(actionViewItemService) {
    super();
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(Menus.SessionHeaderMeta, ViewAllChangesAction.ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(ViewAllChangesActionViewItem, action, options);
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
ViewAllChangesActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], ViewAllChangesActionViewItemContribution);
let ChangesMultiDiffSourceResolverContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.changesMultiDiffSourceResolver";
  }
  constructor(instantiationService) {
    super();
    this._register(instantiationService.createInstance(ChangesMultiDiffSourceResolver));
  }
};
ChangesMultiDiffSourceResolverContribution = __decorateClass([
  __decorateParam(0, IInstantiationService)
], ChangesMultiDiffSourceResolverContribution);
let ChangesetOperationsActionControllerContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.changesetOperationsActionController";
  }
  constructor(changesViewService, contextKeyService) {
    super();
    const clientReviewedFilesObs = observableValue(this, void 0);
    const agentHostReviewedFilesObs = observableValue(this, []);
    this._register(autorun((reader) => {
      const changes = changesViewService.activeSessionChangesObs.read(reader);
      const reviewedFiles = changes.filter((change) => change.reviewed).map((change) => change.modifiedUri?.toString() ?? change.originalUri?.toString()).filter((uri) => uri !== void 0);
      transaction((tx) => {
        clientReviewedFilesObs.set(void 0, tx);
        agentHostReviewedFilesObs.set(reviewedFiles, tx);
      });
    }));
    this._register(bindContextKey(SessionChangesReviewedFilesContext, contextKeyService, (reader) => {
      return clientReviewedFilesObs.read(reader) ?? agentHostReviewedFilesObs.read(reader);
    }));
    this._register(autorun((reader) => {
      const changeset = changesViewService.activeSessionChangesetObs.read(reader);
      const resourceOperations = (changeset?.operations.read(reader) ?? []).filter((op) => op.scopes.includes(SessionChangesetOperationScope.Resource));
      if (resourceOperations.length === 0) {
        return;
      }
      for (const operation of resourceOperations) {
        reader.store.add(registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.contrib.sessions.changesetOperation.${operation.id}`,
              title: operation.label,
              icon: operation.icon,
              f1: false,
              menu: [
                {
                  id: MenuId.AgentsChangeInlineToolbar,
                  group: "navigation",
                  order: 100
                },
                {
                  id: MenuId.MultiDiffEditorFileToolbar,
                  group: "navigation",
                  order: 100
                }
              ]
            });
          }
          async run(accessor, ...args) {
            const resource = args.length === 3 ? args[2] : args[0];
            if (!resource || !(resource instanceof URI)) {
              return;
            }
            await changeset?.invokeOperation(operation.id, {
              kind: "resource",
              resource
            });
          }
        }));
      }
    }));
  }
};
ChangesetOperationsActionControllerContribution = __decorateClass([
  __decorateParam(0, IChangesViewService),
  __decorateParam(1, IContextKeyService)
], ChangesetOperationsActionControllerContribution);
registerWorkbenchContribution2(ChangesMultiDiffSourceResolverContribution.ID, ChangesMultiDiffSourceResolverContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChangesetOperationsActionControllerContribution.ID, ChangesetOperationsActionControllerContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ViewAllChangesActionViewItemContribution.ID, ViewAllChangesActionViewItemContribution, WorkbenchPhase.AfterRestored);
export {
  ViewAllChangesActionViewItem
};
