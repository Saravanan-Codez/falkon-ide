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
import { DisposableMap, DisposableStore, combinedDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent, observableSignalFromEvent } from "../../../../base/common/observable.js";
import { Event } from "../../../../base/common/event.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { EditorGroupView } from "../../../../workbench/browser/parts/editor/editorGroupView.js";
import { IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { AgentEditorCommentsOverlayWidget } from "../../../../workbench/services/agentEditorComments/browser/agentEditorCommentsOverlayWidget.js";
import { IAgentFeedbackService } from "./agentFeedbackService.js";
import { hasUnsubmittedAgentFeedback, hasSessionEditorComments, navigateNextFeedbackActionId, navigatePreviousFeedbackActionId, navigationBearingFakeActionId, submitFeedbackActionId } from "./agentFeedbackEditorActions.js";
import { getActiveResourceCandidates } from "./agentFeedbackEditorUtils.js";
import { Menus } from "../../../browser/menus.js";
import { ICodeReviewService } from "../../codeReview/browser/codeReviewService.js";
import { getAcceptedAgentFeedbackCommentCount, getSessionEditorComments } from "./sessionEditorComments.js";
let AgentFeedbackOverlayController = class {
  constructor(group, agentFeedbackService, instaService, contextKeyService, codeReviewService) {
    this._store = new DisposableStore();
    this._domNode = document.createElement("div");
    const container = group.editorPaneContainer;
    container.classList.add("agent-feedback-editor-overlay-host");
    this._store.add(toDisposable(() => container.classList.remove("agent-feedback-editor-overlay-host")));
    this._domNode.classList.add("agent-feedback-editor-overlay");
    this._domNode.style.position = "absolute";
    this._domNode.style.bottom = "24px";
    this._domNode.style.right = "24px";
    this._domNode.style.zIndex = "100";
    const widget = this._store.add(instaService.createInstance(AgentEditorCommentsOverlayWidget, {
      menuId: Menus.AgentFeedbackEditorContent,
      submitActionId: submitFeedbackActionId,
      previousActionId: navigatePreviousFeedbackActionId,
      nextActionId: navigateNextFeedbackActionId,
      navigationBearingActionId: navigationBearingFakeActionId,
      telemetrySource: "agentFeedback.overlayToolbar"
    }));
    this._domNode.appendChild(widget.getDomNode());
    this._store.add(toDisposable(() => this._domNode.remove()));
    const hasCommentsContext = hasSessionEditorComments.bindTo(contextKeyService);
    const hasAgentFeedbackContext = hasUnsubmittedAgentFeedback.bindTo(contextKeyService);
    const show = () => {
      if (!container.contains(this._domNode)) {
        container.appendChild(this._domNode);
      }
    };
    const hide = () => {
      if (container.contains(this._domNode)) {
        widget.hide();
        this._domNode.remove();
      }
    };
    const activeSignal = observableSignalFromEvent(this, Event.any(
      group.onDidActiveEditorChange,
      group.onDidModelChange,
      agentFeedbackService.onDidChangeFeedback,
      agentFeedbackService.onDidChangeNavigation,
      agentFeedbackService.onDidChangeFeedbackScope
    ));
    this._store.add(autorun((r) => {
      activeSignal.read(r);
      const candidates = getActiveResourceCandidates(group.activeEditorPane?.input);
      let navigationBearings = void 0;
      let acceptedFeedbackCount = 0;
      for (const candidate of candidates) {
        const sessionResource = agentFeedbackService.getFeedbackSessionResource(candidate);
        if (!sessionResource) {
          continue;
        }
        const comments = getSessionEditorComments(
          sessionResource,
          agentFeedbackService.getFeedback(sessionResource),
          codeReviewService.getPRReviewState(sessionResource).read(r)
        );
        if (comments.length > 0) {
          navigationBearings = agentFeedbackService.getNavigationBearing(sessionResource, comments);
          acceptedFeedbackCount = getAcceptedAgentFeedbackCommentCount(comments);
          break;
        }
      }
      if (!navigationBearings) {
        hasCommentsContext.set(false);
        hasAgentFeedbackContext.set(false);
        hide();
        return;
      }
      hasCommentsContext.set(true);
      hasAgentFeedbackContext.set(acceptedFeedbackCount > 0);
      widget.show(navigationBearings, acceptedFeedbackCount, group);
      show();
    }));
  }
  dispose() {
    this._store.dispose();
  }
};
AgentFeedbackOverlayController = __decorateClass([
  __decorateParam(1, IAgentFeedbackService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ICodeReviewService)
], AgentFeedbackOverlayController);
let AgentFeedbackEditorOverlay = class {
  constructor(editorGroupsService, instantiationService) {
    this._store = new DisposableStore();
    const editorGroups = observableFromEvent(
      this,
      Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup),
      () => editorGroupsService.groups
    );
    const overlayWidgets = this._store.add(new DisposableMap());
    this._store.add(autorun((r) => {
      const groups = editorGroups.read(r);
      const toDelete = new Set(overlayWidgets.keys());
      for (const group of groups) {
        if (!(group instanceof EditorGroupView)) {
          continue;
        }
        toDelete.delete(group);
        if (!overlayWidgets.has(group)) {
          const scopedInstaService = instantiationService.createChild(
            new ServiceCollection([IContextKeyService, group.scopedContextKeyService])
          );
          const ctrl = scopedInstaService.createInstance(AgentFeedbackOverlayController, group);
          overlayWidgets.set(group, combinedDisposable(ctrl, scopedInstaService));
        }
      }
      for (const group of toDelete) {
        overlayWidgets.deleteAndDispose(group);
      }
    }));
  }
  static {
    this.ID = "chat.agentFeedback.editorOverlay";
  }
  dispose() {
    this._store.dispose();
  }
};
AgentFeedbackEditorOverlay = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IInstantiationService)
], AgentFeedbackEditorOverlay);
export {
  AgentFeedbackEditorOverlay,
  AgentFeedbackOverlayController
};
