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
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { bindContextKey } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { IsSessionsWindowContext } from "../../../../../workbench/common/contextkeys.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { ChatSendResult, IChatService } from "../../../../../workbench/contrib/chat/common/chatService/chatService.js";
import { ChatAgentLocation } from "../../../../../workbench/contrib/chat/common/constants.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ActiveSessionContextKeys, IsolationMode } from "../../../changes/common/changes.js";
import { BaseAgentHostSessionsProvider } from "./baseAgentHostSessionsProvider.js";
const IsAgentHostSession = new RawContextKey("sessions.isAgentHostSession", false);
let IsAgentHostSessionContextContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.agentHost.isAgentHostSession";
  }
  constructor(contextKeyService, sessionsService, sessionsProvidersService) {
    super();
    this._register(bindContextKey(IsAgentHostSession, contextKeyService, (reader) => {
      const activeSession = sessionsService.activeSession.read(reader);
      if (!activeSession) {
        return false;
      }
      const provider = sessionsProvidersService.getProvider(activeSession.providerId);
      return provider instanceof BaseAgentHostSessionsProvider;
    }));
  }
};
IsAgentHostSessionContextContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, ISessionsProvidersService)
], IsAgentHostSessionContextContribution);
registerWorkbenchContribution2(IsAgentHostSessionContextContribution.ID, IsAgentHostSessionContextContribution, WorkbenchPhase.AfterRestored);
const AGENT_HOST_SKILL_BUTTON_ID_PREFIX = "workbench.action.agentSessions.runSkill.";
const AGENT_HOST_SKILL_BUTTONS = [
  {
    id: `${AGENT_HOST_SKILL_BUTTON_ID_PREFIX}merge`,
    title: localize2("agentSessions.runSkill.merge", "Merge Changes"),
    skill: "merge",
    icon: Codicon.gitMerge,
    group: "merge",
    order: 1,
    extraWhen: ContextKeyExpr.and(
      ContextKeyExpr.false(),
      ActiveSessionContextKeys.IsolationMode.isEqualTo(IsolationMode.Worktree),
      ActiveSessionContextKeys.IsMergeBaseBranchProtected.negate(),
      ActiveSessionContextKeys.HasPullRequest.negate(),
      ContextKeyExpr.or(ActiveSessionContextKeys.HasUncommittedChanges, ActiveSessionContextKeys.HasOutgoingChanges)
    )
  },
  {
    id: `${AGENT_HOST_SKILL_BUTTON_ID_PREFIX}createPR`,
    title: localize2("agentSessions.runSkill.createPR", "Create PR"),
    skill: "create-pr",
    icon: Codicon.gitPullRequestCreate,
    group: "pull_request",
    order: 1,
    extraWhen: ContextKeyExpr.and(
      ContextKeyExpr.false(),
      ActiveSessionContextKeys.IsolationMode.isEqualTo(IsolationMode.Worktree),
      ActiveSessionContextKeys.HasGitHubRemote,
      ActiveSessionContextKeys.HasPullRequest.negate(),
      ContextKeyExpr.or(ActiveSessionContextKeys.HasUncommittedChanges, ActiveSessionContextKeys.HasOutgoingChanges)
    )
  },
  {
    id: `${AGENT_HOST_SKILL_BUTTON_ID_PREFIX}createDraftPR`,
    title: localize2("agentSessions.runSkill.createDraftPR", "Create Draft PR"),
    skill: "create-draft-pr",
    icon: Codicon.gitPullRequestDraft,
    group: "pull_request",
    order: 2,
    extraWhen: ContextKeyExpr.and(
      ContextKeyExpr.false(),
      ActiveSessionContextKeys.IsolationMode.isEqualTo(IsolationMode.Worktree),
      ActiveSessionContextKeys.HasGitHubRemote,
      ActiveSessionContextKeys.HasPullRequest.negate(),
      ContextKeyExpr.or(ActiveSessionContextKeys.HasUncommittedChanges, ActiveSessionContextKeys.HasOutgoingChanges)
    )
  },
  {
    id: `${AGENT_HOST_SKILL_BUTTON_ID_PREFIX}updatePR`,
    title: localize2("agentSessions.runSkill.updatePR", "Sync Pull Request"),
    skill: "update-pr",
    icon: Codicon.repoPush,
    group: "pull_request",
    order: 1,
    extraWhen: ContextKeyExpr.and(
      ContextKeyExpr.false(),
      ActiveSessionContextKeys.IsolationMode.isEqualTo(IsolationMode.Worktree),
      ActiveSessionContextKeys.HasGitHubRemote,
      ActiveSessionContextKeys.HasPullRequest,
      ActiveSessionContextKeys.HasOpenPullRequest,
      ContextKeyExpr.or(
        ActiveSessionContextKeys.HasIncomingChanges,
        ActiveSessionContextKeys.HasOutgoingChanges,
        ActiveSessionContextKeys.HasUncommittedChanges
      )
    )
  }
];
const AGENT_HOST_SKILL_BUTTON_UPDATE_PR_ID = `${AGENT_HOST_SKILL_BUTTON_ID_PREFIX}updatePR`;
function isAgentHostSkillButtonId(actionId) {
  return actionId.startsWith(AGENT_HOST_SKILL_BUTTON_ID_PREFIX);
}
function registerAgentHostSkillButton(spec) {
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: spec.id,
        title: spec.title,
        icon: spec.icon,
        f1: false,
        menu: {
          id: MenuId.AgentsChangesPrimaryActionSubMenu,
          group: spec.group,
          order: spec.order,
          when: ContextKeyExpr.and(
            IsSessionsWindowContext,
            IsAgentHostSession,
            ActiveSessionContextKeys.HasGitRepository,
            spec.extraWhen
          )
        }
      });
    }
    async run(accessor) {
      const sessionsService = accessor.get(ISessionsService);
      const chatService = accessor.get(IChatService);
      const activeSession = sessionsService.activeSession.get();
      if (!activeSession) {
        return;
      }
      const agentId = activeSession.resource.scheme;
      const prompt = `/${spec.skill}`;
      const ref = await chatService.acquireOrLoadSession(activeSession.resource, ChatAgentLocation.Chat, CancellationToken.None, "AgentHostSkillButton");
      try {
        let result = await chatService.sendRequest(activeSession.resource, prompt, { agentIdSilent: agentId });
        if (ChatSendResult.isQueued(result)) {
          result = await result.deferred;
        }
        if (ChatSendResult.isSent(result)) {
          await result.data.responseCompletePromise;
        }
      } finally {
        ref?.dispose();
      }
    }
  });
}
for (const spec of AGENT_HOST_SKILL_BUTTONS) {
  registerAgentHostSkillButton(spec);
}
export {
  AGENT_HOST_SKILL_BUTTON_UPDATE_PR_ID,
  IsAgentHostSession,
  IsAgentHostSessionContextContribution,
  isAgentHostSkillButtonId
};
