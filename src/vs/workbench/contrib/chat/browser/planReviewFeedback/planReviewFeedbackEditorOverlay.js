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
import { Event } from "../../../../../base/common/event.js";
import { combinedDisposable, Disposable, DisposableMap, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { EditorGroupView } from "../../../../browser/parts/editor/editorGroupView.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { AgentEditorCommentsOverlayWidget } from "../../../../services/agentEditorComments/browser/agentEditorCommentsOverlayWidget.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { IListService } from "../../../../../platform/list/browser/listService.js";
import { resolveCommandsContext } from "../../../../browser/parts/editor/editorCommandsContext.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { CHAT_CATEGORY } from "../actions/chatActions.js";
import { IPlanReviewFeedbackService } from "./planReviewFeedbackService.js";
const PlanReviewFeedbackEditorMenu = MenuId.for("planReviewFeedback.editorContent");
const hasPlanReviewFeedback = new RawContextKey("planReviewFeedback.hasFeedback", false);
const submitPlanReviewFeedbackActionId = "planReviewFeedback.action.submit";
const navigatePreviousPlanReviewFeedbackActionId = "planReviewFeedback.action.navigatePrevious";
const navigateNextPlanReviewFeedbackActionId = "planReviewFeedback.action.navigateNext";
const clearAllPlanReviewFeedbackActionId = "planReviewFeedback.action.clearAll";
const navigationBearingFakeActionId = "planReviewFeedback.navigation.bearings";
function getPlanReviewResource(input, feedbackService) {
  const resources = EditorResourceAccessor.getOriginalUri(input, { supportSideBySide: SideBySideEditor.BOTH });
  if (!resources) {
    return void 0;
  }
  if (URI.isUri(resources)) {
    return feedbackService.isActivePlanReview(resources) ? resources : void 0;
  }
  return [resources.secondary, resources.primary].find((resource) => resource && feedbackService.isActivePlanReview(resource));
}
function getPlanReviewFromContext(accessor, args) {
  const editorService = accessor.get(IEditorService);
  const editorGroupsService = accessor.get(IEditorGroupsService);
  const resolvedContext = resolveCommandsContext(args, editorService, editorGroupsService, accessor.get(IListService));
  const groupedEditor = resolvedContext.groupedEditors[0];
  const group = groupedEditor?.group;
  const input = groupedEditor?.editors[0] ?? group?.activeEditor;
  const resource = getPlanReviewResource(input, accessor.get(IPlanReviewFeedbackService));
  return group && resource ? { resource, group } : void 0;
}
class SubmitPlanReviewFeedbackAction extends Action2 {
  constructor() {
    super({
      id: submitPlanReviewFeedbackActionId,
      title: localize2("planReviewFeedback.submit", "Submit Feedback"),
      shortTitle: localize2("planReviewFeedback.submitShort", "Submit"),
      icon: Codicon.send,
      category: CHAT_CATEGORY,
      precondition: ChatContextKeys.enabled,
      menu: {
        id: PlanReviewFeedbackEditorMenu,
        group: "a_submit",
        order: 0,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasPlanReviewFeedback)
      }
    });
  }
  async run(accessor, ...args) {
    const review = getPlanReviewFromContext(accessor, args);
    if (!review) {
      return false;
    }
    return accessor.get(IPlanReviewFeedbackService).submitAllFeedback(review.resource);
  }
}
class NavigatePlanReviewFeedbackAction extends Action2 {
  constructor(_next) {
    super({
      id: _next ? navigateNextPlanReviewFeedbackActionId : navigatePreviousPlanReviewFeedbackActionId,
      title: _next ? localize2("planReviewFeedback.next", "Go to Next Feedback Comment") : localize2("planReviewFeedback.previous", "Go to Previous Feedback Comment"),
      icon: _next ? Codicon.arrowDown : Codicon.arrowUp,
      category: CHAT_CATEGORY,
      f1: true,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, hasPlanReviewFeedback),
      menu: {
        id: PlanReviewFeedbackEditorMenu,
        group: "navigate",
        order: _next ? 2 : 1,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasPlanReviewFeedback)
      }
    });
    this._next = _next;
  }
  async run(accessor, ...args) {
    const review = getPlanReviewFromContext(accessor, args);
    if (!review) {
      return;
    }
    const item = accessor.get(IPlanReviewFeedbackService).getNextFeedback(review.resource, this._next);
    if (item) {
      await accessor.get(IEditorService).openEditor({
        resource: item.resource,
        options: {
          revealIfOpened: true,
          selection: { startLineNumber: item.line, startColumn: item.column }
        }
      }, review.group);
    }
  }
}
class ClearAllPlanReviewFeedbackAction extends Action2 {
  constructor() {
    super({
      id: clearAllPlanReviewFeedbackActionId,
      title: localize2("planReviewFeedback.clear", "Clear"),
      tooltip: localize2("planReviewFeedback.clearAllTooltip", "Clear All Feedback"),
      icon: Codicon.clearAll,
      category: CHAT_CATEGORY,
      f1: true,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, hasPlanReviewFeedback),
      menu: {
        id: PlanReviewFeedbackEditorMenu,
        group: "a_submit",
        order: 1,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, hasPlanReviewFeedback)
      }
    });
  }
  run(accessor, ...args) {
    const review = getPlanReviewFromContext(accessor, args);
    if (review) {
      accessor.get(IPlanReviewFeedbackService).clearFeedback(review.resource);
    }
  }
}
let PlanReviewFeedbackOverlayController = class extends Disposable {
  constructor(container, group, feedbackService, instantiationService, contextKeyService) {
    super();
    const domNode = document.createElement("div");
    domNode.classList.add("plan-review-feedback-editor-overlay");
    domNode.style.position = "absolute";
    domNode.style.bottom = "24px";
    domNode.style.right = "24px";
    domNode.style.zIndex = "100";
    this._register(toDisposable(() => domNode.remove()));
    const widget = this._register(instantiationService.createInstance(AgentEditorCommentsOverlayWidget, {
      menuId: PlanReviewFeedbackEditorMenu,
      submitActionId: submitPlanReviewFeedbackActionId,
      previousActionId: navigatePreviousPlanReviewFeedbackActionId,
      nextActionId: navigateNextPlanReviewFeedbackActionId,
      navigationBearingActionId: navigationBearingFakeActionId,
      telemetrySource: "planReviewFeedback.overlayToolbar"
    }));
    domNode.appendChild(widget.getDomNode());
    const hasFeedbackContext = hasPlanReviewFeedback.bindTo(contextKeyService);
    const activeSignal = observableSignalFromEvent(
      this,
      Event.any(
        group.onDidActiveEditorChange,
        group.onDidModelChange,
        feedbackService.onDidChangeFeedback,
        feedbackService.onDidChangeNavigation,
        feedbackService.onDidChangeRegistrations
      )
    );
    this._register(autorun((reader) => {
      activeSignal.read(reader);
      const resource = getPlanReviewResource(group.activeEditorPane?.input, feedbackService);
      const count = resource ? feedbackService.getFeedback(resource).length : 0;
      hasFeedbackContext.set(count > 0);
      if (!resource || count === 0) {
        widget.hide();
        domNode.remove();
        return;
      }
      widget.show(feedbackService.getNavigationBearing(resource), count, group);
      if (!container.contains(domNode)) {
        container.appendChild(domNode);
      }
    }));
  }
};
PlanReviewFeedbackOverlayController = __decorateClass([
  __decorateParam(2, IPlanReviewFeedbackService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService)
], PlanReviewFeedbackOverlayController);
let PlanReviewFeedbackEditorOverlay = class extends Disposable {
  static {
    this.ID = "chat.planReviewFeedback.editorOverlay";
  }
  constructor(editorGroupsService, instantiationService, environmentService) {
    super();
    if (environmentService.isSessionsWindow) {
      return;
    }
    const editorGroups = observableFromEvent(
      this,
      Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup),
      () => editorGroupsService.groups
    );
    const overlays = this._register(new DisposableMap());
    this._register(autorun((reader) => {
      const groups = editorGroups.read(reader);
      const toDelete = new Set(overlays.keys());
      for (const group of groups) {
        if (!(group instanceof EditorGroupView)) {
          continue;
        }
        toDelete.delete(group);
        if (!overlays.has(group)) {
          const scopedInstantiationService = instantiationService.createChild(
            new ServiceCollection([IContextKeyService, group.scopedContextKeyService])
          );
          const controller = scopedInstantiationService.createInstance(PlanReviewFeedbackOverlayController, group.element, group);
          overlays.set(group, combinedDisposable(controller, scopedInstantiationService));
        }
      }
      for (const group of toDelete) {
        overlays.deleteAndDispose(group);
      }
    }));
  }
};
PlanReviewFeedbackEditorOverlay = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], PlanReviewFeedbackEditorOverlay);
registerAction2(SubmitPlanReviewFeedbackAction);
registerAction2(class extends NavigatePlanReviewFeedbackAction {
  constructor() {
    super(false);
  }
});
registerAction2(class extends NavigatePlanReviewFeedbackAction {
  constructor() {
    super(true);
  }
});
registerAction2(ClearAllPlanReviewFeedbackAction);
MenuRegistry.appendMenuItem(PlanReviewFeedbackEditorMenu, {
  command: {
    id: navigationBearingFakeActionId,
    title: localize("planReviewFeedback.navigationStatus", "Navigation Status"),
    precondition: ContextKeyExpr.false()
  },
  group: "navigate",
  order: -1,
  when: ContextKeyExpr.and(ChatContextKeys.enabled, hasPlanReviewFeedback)
});
registerWorkbenchContribution2(PlanReviewFeedbackEditorOverlay.ID, PlanReviewFeedbackEditorOverlay, WorkbenchPhase.AfterRestored);
export {
  PlanReviewFeedbackEditorOverlay
};
