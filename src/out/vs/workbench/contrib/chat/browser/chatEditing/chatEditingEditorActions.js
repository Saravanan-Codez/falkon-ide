import { Codicon } from "../../../../../base/common/codicons.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { localize, localize2 } from "../../../../../nls.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../../platform/accessibility/common/accessibility.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IListService } from "../../../../../platform/list/browser/listService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { resolveCommandsContext } from "../../../../browser/parts/editor/editorCommandsContext.js";
import { ActiveEditorContext } from "../../../../common/contextkeys.js";
import { EditorResourceAccessor, SideBySideEditor, TEXT_DIFF_EDITOR_ID } from "../../../../common/editor.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, IEditorService } from "../../../../services/editor/common/editorService.js";
import { MultiDiffEditor } from "../../../multiDiffEditor/browser/multiDiffEditor.js";
import { MultiDiffEditorInput } from "../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_EDITOR_FOCUSED } from "../../../notebook/common/notebookContextKeys.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatEditingService, ModifiedFileEntryState, parseChatMultiDiffUri, CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME } from "../../common/editing/chatEditingService.js";
import { CHAT_CATEGORY } from "../actions/chatActions.js";
import { ctxCursorInChangeRange, ctxHasEditorModification, ctxHasRequestInProgress, ctxIsCurrentlyBeingModified, ctxIsGlobalEditingSession, ctxReviewModeEnabled } from "./chatEditingEditorContextKeys.js";
import { ChatEditingExplanationWidgetManager } from "./chatEditingExplanationWidget.js";
import { IChatEditingExplanationModelManager } from "./chatEditingExplanationModelManager.js";
import { IChatWidgetService } from "../chat.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { Event } from "../../../../../base/common/event.js";
import { ChatConfiguration } from "../../common/constants.js";
class ChatEditingEditorAction extends Action2 {
  constructor(desc) {
    super({
      category: CHAT_CATEGORY,
      ...desc
    });
  }
  async run(accessor, ...args) {
    const instaService = accessor.get(IInstantiationService);
    const chatEditingService = accessor.get(IChatEditingService);
    const editorService = accessor.get(IEditorService);
    const uri = EditorResourceAccessor.getOriginalUri(editorService.activeEditorPane?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (!uri || !editorService.activeEditorPane) {
      return;
    }
    const session = chatEditingService.editingSessionsObs.get().find((candidate) => candidate.getEntry(uri));
    if (!session) {
      return;
    }
    const entry = session.getEntry(uri);
    const ctrl = entry.getEditorIntegration(editorService.activeEditorPane);
    return instaService.invokeFunction(this.runChatEditingCommand.bind(this), session, entry, ctrl, ...args);
  }
}
class NavigateAction extends ChatEditingEditorAction {
  constructor(next) {
    super({
      id: next ? "chatEditor.action.navigateNext" : "chatEditor.action.navigatePrevious",
      title: next ? localize2("next", "Go to Next Chat Edit") : localize2("prev", "Go to Previous Chat Edit"),
      icon: next ? Codicon.arrowDown : Codicon.arrowUp,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ctxHasEditorModification),
      keybinding: {
        primary: next ? KeyMod.Alt | KeyCode.F5 : KeyMod.Alt | KeyMod.Shift | KeyCode.F5,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          ctxHasEditorModification,
          ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_CELL_LIST_FOCUSED)
        )
      },
      f1: true,
      menu: {
        id: MenuId.ChatEditingEditorContent,
        group: "navigate",
        order: !next ? 2 : 3,
        when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasEditorModification)
      }
    });
    this.next = next;
  }
  async runChatEditingCommand(accessor, session, entry, ctrl) {
    const instaService = accessor.get(IInstantiationService);
    const done = this.next ? ctrl.next(false) : ctrl.previous(false);
    if (done) {
      return;
    }
    const didOpenNext = await instaService.invokeFunction(openNextOrPreviousChange, session, entry, this.next);
    if (didOpenNext) {
      return;
    }
    this.next ? ctrl.next(true) : ctrl.previous(true);
  }
}
async function openNextOrPreviousChange(accessor, session, entry, next) {
  const editorService = accessor.get(IEditorService);
  const entries = session.entries.get();
  let idx = entries.indexOf(entry);
  let newEntry;
  while (true) {
    idx = (idx + (next ? 1 : -1) + entries.length) % entries.length;
    newEntry = entries[idx];
    if (newEntry.state.get() === ModifiedFileEntryState.Modified) {
      break;
    } else if (newEntry === entry) {
      return false;
    }
  }
  const pane = await editorService.openEditor({
    resource: newEntry.modifiedURI,
    options: {
      revealIfOpened: false,
      revealIfVisible: false
    }
  }, ACTIVE_GROUP);
  if (!pane) {
    return false;
  }
  if (session.entries.get().includes(newEntry)) {
    newEntry.getEditorIntegration(pane).reveal(next);
  }
  return true;
}
class KeepOrUndoAction extends ChatEditingEditorAction {
  constructor(id, _keep) {
    super({
      id,
      title: _keep ? localize2("accept", "Keep Chat Edits") : localize2("discard", "Undo Chat Edits"),
      shortTitle: _keep ? localize2("accept2", "Keep") : localize2("discard2", "Undo"),
      tooltip: _keep ? localize2("accept3", "Keep Chat Edits in this File") : localize2("discard3", "Undo Chat Edits in this File"),
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
      icon: _keep ? Codicon.check : Codicon.discard,
      f1: true,
      keybinding: {
        when: ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_EDITOR_FOCUSED),
        weight: KeybindingWeight.WorkbenchContrib + 10,
        // win over new-window-action
        primary: _keep ? KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyY : KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN
      },
      menu: {
        id: MenuId.ChatEditingEditorContent,
        group: "a_resolve",
        order: _keep ? 0 : 1,
        when: ContextKeyExpr.and(!_keep ? ctxReviewModeEnabled : void 0, ContextKeyExpr.or(ctxIsGlobalEditingSession, ctxHasRequestInProgress.negate()))
      }
    });
    this._keep = _keep;
  }
  async runChatEditingCommand(accessor, session, entry, _integration) {
    const instaService = accessor.get(IInstantiationService);
    const configService = accessor.get(IConfigurationService);
    if (this._keep) {
      session.accept(entry.modifiedURI);
    } else {
      session.reject(entry.modifiedURI);
    }
    if (configService.getValue(ChatConfiguration.RevealNextChangeOnResolve)) {
      await instaService.invokeFunction(openNextOrPreviousChange, session, entry, true);
    }
  }
}
class AcceptAction extends KeepOrUndoAction {
  static {
    this.ID = "chatEditor.action.accept";
  }
  constructor() {
    super(AcceptAction.ID, true);
  }
}
class RejectAction extends KeepOrUndoAction {
  static {
    this.ID = "chatEditor.action.reject";
  }
  constructor() {
    super(RejectAction.ID, false);
  }
}
const acceptHunkId = "chatEditor.action.acceptHunk";
const undoHunkId = "chatEditor.action.undoHunk";
class AcceptRejectHunkAction extends ChatEditingEditorAction {
  constructor(_accept) {
    super(
      {
        id: _accept ? acceptHunkId : undoHunkId,
        title: _accept ? localize2("acceptHunk", "Keep this Change") : localize2("undo", "Undo this Change"),
        shortTitle: _accept ? localize2("acceptHunkShort", "Keep") : localize2("undoShort", "Undo"),
        precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
        f1: true,
        keybinding: {
          when: ContextKeyExpr.and(ctxCursorInChangeRange, ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_CELL_LIST_FOCUSED)),
          weight: KeybindingWeight.WorkbenchContrib + 1,
          primary: _accept ? KeyMod.CtrlCmd | KeyCode.KeyY : KeyMod.CtrlCmd | KeyCode.KeyN
        },
        menu: {
          id: MenuId.ChatEditingEditorHunk,
          order: 1
        }
      }
    );
    this._accept = _accept;
  }
  async runChatEditingCommand(accessor, session, entry, ctrl, ...args) {
    const instaService = accessor.get(IInstantiationService);
    const configService = accessor.get(IConfigurationService);
    if (this._accept) {
      await ctrl.acceptNearestChange(args[0]);
    } else {
      await ctrl.rejectNearestChange(args[0]);
    }
    if (configService.getValue(ChatConfiguration.RevealNextChangeOnResolve) && entry.changesCount.get() === 0) {
      await instaService.invokeFunction(openNextOrPreviousChange, session, entry, true);
    }
  }
}
class AcceptHunkAction extends AcceptRejectHunkAction {
  static {
    this.ID = acceptHunkId;
  }
  constructor() {
    super(true);
  }
}
class RejectHunkAction extends AcceptRejectHunkAction {
  static {
    this.ID = undoHunkId;
  }
  constructor() {
    super(false);
  }
}
class ToggleDiffAction extends ChatEditingEditorAction {
  constructor() {
    super({
      id: "chatEditor.action.toggleDiff",
      title: localize2("diff", "Toggle Diff Editor for Chat Edits"),
      category: CHAT_CATEGORY,
      toggled: {
        condition: ContextKeyExpr.or(EditorContextKeys.inDiffEditor, ActiveEditorContext.isEqualTo(TEXT_DIFF_EDITOR_ID)),
        icon: Codicon.goToFile
      },
      precondition: ContextKeyExpr.and(ctxHasEditorModification),
      icon: Codicon.diffSingle,
      keybinding: {
        when: EditorContextKeys.focus,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.F7
      },
      menu: [{
        id: MenuId.ChatEditingEditorHunk,
        order: 10
      }, {
        id: MenuId.ChatEditingEditorContent,
        group: "a_resolve",
        order: 2,
        when: ContextKeyExpr.and(ctxReviewModeEnabled)
      }]
    });
  }
  runChatEditingCommand(_accessor, _session, _entry, integration, ...args) {
    integration.toggleDiff(args[0]);
  }
}
class ToggleAccessibleDiffViewAction extends ChatEditingEditorAction {
  constructor() {
    super({
      id: "chatEditor.action.showAccessibleDiffView",
      title: localize2("accessibleDiff", "Show Accessible Diff View for Chat Edits"),
      f1: true,
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
      keybinding: {
        when: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_ACCESSIBILITY_MODE_ENABLED),
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.F7
      }
    });
  }
  runChatEditingCommand(_accessor, _session, _entry, integration) {
    integration.enableAccessibleDiffView();
  }
}
class ReviewChangesAction extends ChatEditingEditorAction {
  constructor() {
    super({
      id: "chatEditor.action.reviewChanges",
      title: localize2("review", "Review"),
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
      menu: [{
        id: MenuId.ChatEditingEditorContent,
        group: "a_resolve",
        order: 3,
        when: ContextKeyExpr.and(ctxReviewModeEnabled.negate(), ctxIsCurrentlyBeingModified.negate(), ContextKeyExpr.or(ctxIsGlobalEditingSession, ctxHasRequestInProgress.negate()))
      }]
    });
  }
  runChatEditingCommand(_accessor, _session, entry, _integration, ..._args) {
    entry.enableReviewModeUntilSettled();
  }
}
class AcceptAllEditsAction extends ChatEditingEditorAction {
  static {
    this.ID = "chatEditor.action.acceptAllEdits";
  }
  constructor() {
    super({
      id: AcceptAllEditsAction.ID,
      title: localize2("acceptAllEdits", "Keep All Chat Edits"),
      tooltip: localize2("acceptAllEditsTooltip", "Keep All Chat Edits in this Session"),
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
      icon: Codicon.checkAll,
      f1: true,
      keybinding: {
        when: ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_EDITOR_FOCUSED),
        weight: KeybindingWeight.WorkbenchContrib + 10,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyY
      }
    });
  }
  async runChatEditingCommand(_accessor, session, _entry, _integration, ..._args) {
    await session.accept();
  }
}
class MultiDiffAcceptDiscardAction extends Action2 {
  constructor(accept) {
    super({
      id: accept ? "chatEditing.multidiff.acceptAllFiles" : "chatEditing.multidiff.discardAllFiles",
      title: accept ? localize("accept4", "Keep All Edits") : localize("discard4", "Undo All Edits"),
      icon: accept ? Codicon.check : Codicon.discard,
      menu: {
        when: ContextKeyExpr.equals("resourceScheme", CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME),
        id: MenuId.EditorTitle,
        order: accept ? 0 : 1,
        group: "navigation"
      }
    });
    this.accept = accept;
  }
  async run(accessor, ...args) {
    const chatEditingService = accessor.get(IChatEditingService);
    const editorService = accessor.get(IEditorService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const listService = accessor.get(IListService);
    const resolvedContext = resolveCommandsContext(args, editorService, editorGroupsService, listService);
    const groupContext = resolvedContext.groupedEditors[0];
    if (!groupContext) {
      return;
    }
    const editor = groupContext.editors[0];
    if (!(editor instanceof MultiDiffEditorInput) || !editor.resource) {
      return;
    }
    const { chatSessionResource } = parseChatMultiDiffUri(editor.resource);
    const session = chatEditingService.getEditingSession(chatSessionResource);
    if (session) {
      if (this.accept) {
        await session.accept();
      } else {
        await session.reject();
      }
      editorService.closeEditor({ editor, groupId: groupContext.group.id });
    }
  }
}
const explainMultiDiffSchemes = [CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, "copilotcli-worktree-changes", "copilotcloud-pr-changes"];
class ExplainMultiDiffAction extends Action2 {
  constructor() {
    super({
      id: "chatEditing.multidiff.explain",
      title: localize("explain", "Explain"),
      menu: {
        when: ContextKeyExpr.and(ContextKeyExpr.or(...explainMultiDiffSchemes.map((scheme) => ContextKeyExpr.equals("resourceScheme", scheme))), ContextKeyExpr.has(`config.${ChatConfiguration.ExplainChangesEnabled}`)),
        id: MenuId.MultiDiffEditorContent,
        order: 10
      }
    });
    this._widgetsByInput = /* @__PURE__ */ new WeakMap();
  }
  async run(accessor, ...args) {
    const editorService = accessor.get(IEditorService);
    const explanationModelManager = accessor.get(IChatEditingExplanationModelManager);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const viewsService = accessor.get(IViewsService);
    const chatEditingService = accessor.get(IChatEditingService);
    const activePane = editorService.activeEditorPane;
    if (!activePane) {
      return;
    }
    if (!(activePane instanceof MultiDiffEditor) || !activePane.viewModel) {
      return;
    }
    const input = activePane.input;
    if (!input) {
      return;
    }
    this._widgetsByInput.get(input)?.dispose();
    const widgetsStore = new DisposableStore();
    this._widgetsByInput.set(input, widgetsStore);
    Event.once(input.onWillDispose)(() => {
      widgetsStore.dispose();
      this._widgetsByInput.delete(input);
    });
    const viewModel = activePane.viewModel;
    const items = viewModel.items.get();
    let chatSessionResource;
    if (input instanceof MultiDiffEditorInput && input.resource?.scheme === CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME) {
      chatSessionResource = parseChatMultiDiffUri(input.resource).chatSessionResource;
    }
    if (!chatSessionResource) {
      const fileUris = items.map((item) => {
        const docDiffItem = item.documentDiffItem;
        const goToFileUri = docDiffItem?.multiDiffEditorItem?.goToFileUri;
        if (goToFileUri) {
          return goToFileUri;
        }
        const modifiedUri = docDiffItem?.multiDiffEditorItem?.modifiedUri ?? item.modifiedUri;
        if (modifiedUri?.path) {
          return URI.file(modifiedUri.path);
        }
        return void 0;
      }).filter((uri) => !!uri);
      for (const session of chatEditingService.editingSessionsObs.get()) {
        if (fileUris.some((uri) => session.getEntry(uri))) {
          chatSessionResource = session.chatSessionResource;
          break;
        }
      }
    }
    const diffsByFile = /* @__PURE__ */ new Map();
    for (const item of items) {
      const modifiedUri = item.modifiedUri;
      if (!modifiedUri) {
        continue;
      }
      const editorInfo = activePane.tryGetCodeEditor(modifiedUri);
      if (!editorInfo) {
        continue;
      }
      const diffEditorVM = item.diffEditorViewModel;
      await diffEditorVM.waitForDiff();
      const diff = diffEditorVM.diff.get();
      if (!diff || diff.identical) {
        continue;
      }
      const fileKey = modifiedUri.toString();
      const existing = diffsByFile.get(fileKey);
      if (existing) {
        existing.changes.push(...diff.mappings.map((m) => m.lineRangeMapping));
      } else {
        diffsByFile.set(fileKey, {
          editor: editorInfo.editor,
          changes: diff.mappings.map((m) => m.lineRangeMapping),
          originalModel: diffEditorVM.model.original,
          modifiedModel: diffEditorVM.model.modified
        });
      }
    }
    const allDiffInfos = [];
    for (const fileData of diffsByFile.values()) {
      const diffInfo = {
        changes: fileData.changes,
        identical: false,
        originalModel: fileData.originalModel,
        modifiedModel: fileData.modifiedModel
      };
      allDiffInfos.push(diffInfo);
      const manager = new ChatEditingExplanationWidgetManager(
        fileData.editor,
        chatWidgetService,
        viewsService,
        explanationModelManager,
        diffInfo.modifiedModel.uri
      );
      widgetsStore.add(manager);
    }
    if (allDiffInfos.length > 0) {
      widgetsStore.add(explanationModelManager.generateExplanations(allDiffInfos, chatSessionResource, CancellationToken.None));
    }
  }
}
function registerChatEditorActions() {
  registerAction2(class NextAction extends NavigateAction {
    constructor() {
      super(true);
    }
  });
  registerAction2(class PrevAction extends NavigateAction {
    constructor() {
      super(false);
    }
  });
  registerAction2(ReviewChangesAction);
  registerAction2(AcceptAction);
  registerAction2(RejectAction);
  registerAction2(AcceptAllEditsAction);
  registerAction2(AcceptHunkAction);
  registerAction2(RejectHunkAction);
  registerAction2(ToggleDiffAction);
  registerAction2(ToggleAccessibleDiffViewAction);
  registerAction2(class extends MultiDiffAcceptDiscardAction {
    constructor() {
      super(true);
    }
  });
  registerAction2(class extends MultiDiffAcceptDiscardAction {
    constructor() {
      super(false);
    }
  });
  registerAction2(ExplainMultiDiffAction);
  MenuRegistry.appendMenuItem(MenuId.ChatEditingEditorContent, {
    command: {
      id: navigationBearingFakeActionId,
      title: localize("label", "Navigation Status"),
      precondition: ContextKeyExpr.false()
    },
    group: "navigate",
    order: -1,
    when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasEditorModification)
  });
}
const navigationBearingFakeActionId = "chatEditor.navigation.bearings";
export {
  AcceptAction,
  AcceptAllEditsAction,
  AcceptHunkAction,
  RejectAction,
  RejectHunkAction,
  ReviewChangesAction,
  navigationBearingFakeActionId,
  registerChatEditorActions
};
