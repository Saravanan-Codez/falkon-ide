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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { IsSessionsWindowContext } from "../../../../workbench/common/contextkeys.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { CHAT_CATEGORY } from "../../../../workbench/contrib/chat/browser/actions/chatActions.js";
import { IGitHubService } from "../../github/browser/githubService.js";
import { GitHubCheckConclusion, GitHubCheckStatus } from "../../github/common/types.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
const hasActiveSessionFailedCIChecks = new RawContextKey("sessions.hasActiveSessionFailedCIChecks", false);
const activeSessionCIFixRequested = new RawContextKey("sessions.activeSessionCIFixRequested", false);
const FIX_CI_CHECKS_COMMAND_ID = "sessions.action.fixCIChecks";
const REVEAL_CI_CHECKS_COMMAND_ID = "sessions.action.revealCIChecks";
const FIX_CI_QUERY = "/fix-ci";
var CICheckGroup = /* @__PURE__ */ ((CICheckGroup2) => {
  CICheckGroup2[CICheckGroup2["Running"] = 0] = "Running";
  CICheckGroup2[CICheckGroup2["Pending"] = 1] = "Pending";
  CICheckGroup2[CICheckGroup2["Failed"] = 2] = "Failed";
  CICheckGroup2[CICheckGroup2["Successful"] = 3] = "Successful";
  return CICheckGroup2;
})(CICheckGroup || {});
function isFailedConclusion(conclusion) {
  return conclusion === GitHubCheckConclusion.Failure || conclusion === GitHubCheckConclusion.TimedOut || conclusion === GitHubCheckConclusion.ActionRequired;
}
function getCheckGroup(check) {
  switch (check.status) {
    case GitHubCheckStatus.InProgress:
      return 0 /* Running */;
    case GitHubCheckStatus.Queued:
      return 1 /* Pending */;
    case GitHubCheckStatus.Completed:
      return isFailedConclusion(check.conclusion) ? 2 /* Failed */ : 3 /* Successful */;
  }
}
function getCheckStateLabel(check) {
  switch (getCheckGroup(check)) {
    case 0 /* Running */:
      return localize("ci.runningState", "running");
    case 1 /* Pending */:
      return localize("ci.pendingState", "pending");
    case 2 /* Failed */:
      return localize("ci.failedState", "failed");
    case 3 /* Successful */:
      return localize("ci.successfulState", "successful");
  }
}
function getFailedChecks(checks) {
  return checks.filter((check) => getCheckGroup(check) === 2 /* Failed */);
}
function getPullRequestUrl(coords) {
  return `https://github.com/${coords.owner}/${coords.repo}/pull/${coords.prNumber}`;
}
function buildFixChecksPrompt(failedChecks, prUrl) {
  const sections = failedChecks.map(({ check, annotations }) => {
    const parts = [
      `Check: ${check.name}`,
      `Status: ${getCheckStateLabel(check)}`,
      `Conclusion: ${check.conclusion ?? "unknown"}`
    ];
    if (check.detailsUrl) {
      parts.push(`Details: ${check.detailsUrl}`);
    }
    parts.push("", "Annotations and output:", annotations || "No output available for this check run.");
    return parts.join("\n");
  });
  const lines = [FIX_CI_QUERY];
  if (prUrl) {
    lines.push(`Pull request: ${prUrl}`);
  }
  lines.push(
    "Failed CI checks:",
    "",
    sections.join("\n\n---\n\n")
  );
  return lines.join("\n");
}
async function buildFixCIPrompt(ciModel) {
  const checks = ciModel.checks.get();
  const failedChecks = getFailedChecks(checks);
  if (failedChecks.length === 0) {
    return void 0;
  }
  const failedCheckDetails = await Promise.all(failedChecks.map(async (check) => {
    const annotations = await ciModel.getCheckRunAnnotations(check.id);
    return { check, annotations };
  }));
  return buildFixChecksPrompt(failedCheckDetails, getPullRequestUrl(ciModel));
}
async function submitFixCIChecks(ciModel, chatWidget) {
  const prompt = await buildFixCIPrompt(ciModel);
  if (!prompt) {
    return;
  }
  const response = await chatWidget.acceptInput(prompt);
  if (response) {
    ciModel.markFixRequested();
  }
}
let ActiveSessionFailedCIChecksContextContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.activeSessionFailedCIChecksContext";
  }
  constructor(contextKeyService, gitHubService) {
    super();
    this._register(bindContextKey(hasActiveSessionFailedCIChecks, contextKeyService, (reader) => {
      const ciModel = gitHubService.activeSessionPullRequestCIObs.read(reader);
      if (!ciModel) {
        return false;
      }
      const checks = ciModel.checks.read(reader);
      return getFailedChecks(checks).length > 0;
    }));
    this._register(bindContextKey(activeSessionCIFixRequested, contextKeyService, (reader) => {
      const ciModel = gitHubService.activeSessionPullRequestCIObs.read(reader);
      if (!ciModel) {
        return false;
      }
      return ciModel.fixRequested.read(reader);
    }));
  }
};
ActiveSessionFailedCIChecksContextContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IGitHubService)
], ActiveSessionFailedCIChecksContextContribution);
class FixCIChecksAction extends Action2 {
  static {
    this.ID = FIX_CI_CHECKS_COMMAND_ID;
  }
  constructor() {
    super({
      id: FixCIChecksAction.ID,
      title: localize2("fixChecks", "Fix Checks"),
      icon: Codicon.lightbulbAutofix,
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, hasActiveSessionFailedCIChecks, activeSessionCIFixRequested.negate()),
      menu: [{
        id: MenuId.AgentsChangesPrimaryActionSubMenu,
        group: "5_checks",
        order: 4,
        when: ContextKeyExpr.and(IsSessionsWindowContext, hasActiveSessionFailedCIChecks, activeSessionCIFixRequested.negate())
      }]
    });
  }
  async run(accessor) {
    const sessionsService = accessor.get(ISessionsService);
    const gitHubService = accessor.get(IGitHubService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const logService = accessor.get(ILogService);
    const activeSession = sessionsService.activeSession.get();
    if (!activeSession) {
      return;
    }
    const ciModel = gitHubService.activeSessionPullRequestCIObs.get();
    if (!ciModel) {
      return;
    }
    const sessionResource = activeSession.resource;
    const chatWidget = chatWidgetService.getWidgetBySessionResource(sessionResource);
    if (!chatWidget) {
      logService.error("[FixCIChecks] Cannot fix CI checks: no chat widget found for session", sessionResource.toString());
      return;
    }
    await submitFixCIChecks(ciModel, chatWidget);
  }
}
registerWorkbenchContribution2(ActiveSessionFailedCIChecksContextContribution.ID, ActiveSessionFailedCIChecksContextContribution, WorkbenchPhase.AfterRestored);
registerAction2(FixCIChecksAction);
export {
  CICheckGroup,
  FIX_CI_CHECKS_COMMAND_ID,
  REVEAL_CI_CHECKS_COMMAND_ID,
  activeSessionCIFixRequested,
  buildFixCIPrompt,
  buildFixChecksPrompt,
  getCheckGroup,
  getCheckStateLabel,
  getFailedChecks,
  getPullRequestUrl,
  hasActiveSessionFailedCIChecks,
  isFailedConclusion,
  submitFixCIChecks
};
