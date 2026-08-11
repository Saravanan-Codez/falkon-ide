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
import "./agentFeedbackEditorInputContribution.js";
import "./agentFeedbackEditorWidgetContribution.js";
import "./agentFeedbackOverviewRulerContribution.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { AgentFeedbackService, AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
import { AgentFeedbackAttachmentContribution } from "./agentFeedbackAttachment.js";
import { AgentEditorCommentsProviderContribution } from "./agentEditorCommentsProvider.js";
import { AgentFeedbackPRThreadResolverContribution } from "./agentFeedbackPRThreadResolver.js";
import { AgentFeedbackPRReviewSeederContribution } from "./agentFeedbackPRReviewSeeder.js";
import { AgentFeedbackAttachmentWidget } from "./agentFeedbackAttachmentWidget.js";
import { AgentFeedbackEditorOverlay } from "./agentFeedbackEditorOverlay.js";
import { hasActiveSessionAgentFeedback, registerAgentFeedbackEditorActions, submitActiveSessionFeedbackActionId } from "./agentFeedbackEditorActions.js";
import { registerAgentFeedbackReviewCommands } from "./agentFeedbackReviewCommands.js";
import { IChatAttachmentWidgetRegistry } from "../../../../workbench/contrib/chat/browser/attachments/chatAttachmentWidgetRegistry.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
let ActiveSessionFeedbackContextContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.activeSessionFeedbackContext";
  }
  constructor(contextKeyService, agentFeedbackService, sessionsService) {
    super();
    const contextKey = hasActiveSessionAgentFeedback.bindTo(contextKeyService);
    const menuRegistration = this._register(new MutableDisposable());
    const feedbackChanged = observableFromEvent(
      this,
      Event.any(agentFeedbackService.onDidChangeFeedback, agentFeedbackService.onDidChangeFeedbackScope),
      (e) => e
    );
    this._register(autorun((reader) => {
      feedbackChanged.read(reader);
      menuRegistration.clear();
      const sessionResource = agentFeedbackService.activeFeedbackSessionResource.read(reader);
      const feedback = agentFeedbackService.getFeedback(sessionResource);
      const count = feedback.filter((item) => item.state === AgentFeedbackState.Accepted).length;
      contextKey.set(count > 0);
      if (count > 0) {
        menuRegistration.value = MenuRegistry.appendMenuItem(MenuId.AgentsChangesPrimaryActionSubMenu, {
          command: {
            id: submitActiveSessionFeedbackActionId,
            icon: Codicon.comment,
            title: localize("agentFeedback.submitFeedbackCount", "Submit Feedback ({0})", count)
          },
          group: "navigation",
          order: 3,
          when: ContextKeyExpr.and(IsSessionsWindowContext, hasActiveSessionAgentFeedback)
        });
      }
    }));
  }
};
ActiveSessionFeedbackContextContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IAgentFeedbackService),
  __decorateParam(2, ISessionsService)
], ActiveSessionFeedbackContextContribution);
registerWorkbenchContribution2(ActiveSessionFeedbackContextContribution.ID, ActiveSessionFeedbackContextContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentFeedbackEditorOverlay.ID, AgentFeedbackEditorOverlay, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentFeedbackAttachmentContribution.ID, AgentFeedbackAttachmentContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentFeedbackPRThreadResolverContribution.ID, AgentFeedbackPRThreadResolverContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentFeedbackPRReviewSeederContribution.ID, AgentFeedbackPRReviewSeederContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentEditorCommentsProviderContribution.ID, AgentEditorCommentsProviderContribution, WorkbenchPhase.BlockRestore);
registerAgentFeedbackEditorActions();
registerAgentFeedbackReviewCommands();
registerSingleton(IAgentFeedbackService, AgentFeedbackService, InstantiationType.Delayed);
let AgentFeedbackAttachmentWidgetContribution = class {
  static {
    this.ID = "workbench.contrib.agentFeedbackAttachmentWidgetFactory";
  }
  constructor(registry, instantiationService) {
    registry.registerFactory("agentFeedback", (attachment, options, container) => {
      return instantiationService.createInstance(AgentFeedbackAttachmentWidget, attachment, options, container);
    });
  }
};
AgentFeedbackAttachmentWidgetContribution = __decorateClass([
  __decorateParam(0, IChatAttachmentWidgetRegistry),
  __decorateParam(1, IInstantiationService)
], AgentFeedbackAttachmentWidgetContribution);
registerWorkbenchContribution2(AgentFeedbackAttachmentWidgetContribution.ID, AgentFeedbackAttachmentWidgetContribution, WorkbenchPhase.AfterRestored);
