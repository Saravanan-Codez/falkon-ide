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
import { derivedOpts, observableFromEvent } from "../../../../base/common/observable.js";
import { equals } from "../../../../base/common/arrays.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { IGitHubService } from "../../github/browser/githubService.js";
import { GitHubCIOverallStatus, GitHubPullRequestState } from "../../github/common/types.js";
var BlockedSessionReason = /* @__PURE__ */ ((BlockedSessionReason2) => {
  BlockedSessionReason2["NeedsInput"] = "needsInput";
  BlockedSessionReason2["FailingCI"] = "failingCI";
  return BlockedSessionReason2;
})(BlockedSessionReason || {});
let BlockedSessions = class extends Disposable {
  constructor(_sessionsManagementService, _gitHubService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._gitHubService = _gitHubService;
    this._allSessions = observableFromEvent(
      this,
      this._sessionsManagementService.onDidChangeSessions,
      () => this._sessionsManagementService.getSessions()
    );
    this.blockedSessionsWithReasons = derivedOpts({
      owner: this,
      equalsFn: (a, b) => equals(a, b, (x, y) => x.session.sessionId === y.session.sessionId && x.reason === y.reason && x.occurrenceId === y.occurrenceId)
    }, (reader) => {
      const blocked = [];
      for (const session of this._allSessions.read(reader)) {
        const blockedSession = this._getBlockedSession(reader, session);
        if (blockedSession !== void 0) {
          blocked.push(blockedSession);
        }
      }
      return blocked.sort((a, b) => b.session.updatedAt.read(reader).getTime() - a.session.updatedAt.read(reader).getTime());
    });
    this.blockedSessions = derivedOpts({
      owner: this,
      equalsFn: (a, b) => equals(a, b, (x, y) => x.sessionId === y.sessionId)
    }, (reader) => this.blockedSessionsWithReasons.read(reader).map((blocked) => blocked.session));
  }
  _getBlockedSession(reader, session) {
    if (session.isArchived.read(reader)) {
      return void 0;
    }
    const status = session.status.read(reader);
    if (status === SessionStatus.NeedsInput) {
      return {
        session,
        reason: "needsInput" /* NeedsInput */,
        occurrenceId: "needsInput" /* NeedsInput */
      };
    }
    if (status === SessionStatus.InProgress) {
      return void 0;
    }
    const gitHubInfo = session.workspace.read(reader)?.folders[0]?.gitRepository?.gitHubInfo.read(reader);
    if (!gitHubInfo?.pullRequest) {
      return void 0;
    }
    const prRef = reader.store.add(this._gitHubService.createPullRequestModelReference(gitHubInfo.owner, gitHubInfo.repo, gitHubInfo.pullRequest.number));
    const livePR = prRef.object.pullRequest.read(reader);
    if (!livePR) {
      return void 0;
    }
    if (livePR.isDraft || livePR.state !== GitHubPullRequestState.Open) {
      return void 0;
    }
    const ciRef = reader.store.add(this._gitHubService.createPullRequestCIModelReference(gitHubInfo.owner, gitHubInfo.repo, livePR.number, livePR.headSha));
    if (ciRef.object.overallStatus.read(reader) === GitHubCIOverallStatus.Failure) {
      return {
        session,
        reason: "failingCI" /* FailingCI */,
        occurrenceId: `${"failingCI" /* FailingCI */}:${livePR.headSha}`
      };
    }
    return void 0;
  }
};
BlockedSessions = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, IGitHubService)
], BlockedSessions);
export {
  BlockedSessionReason,
  BlockedSessions
};
