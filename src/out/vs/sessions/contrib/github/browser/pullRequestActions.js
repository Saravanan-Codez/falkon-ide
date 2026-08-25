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
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { $ } from "../../../../base/browser/dom.js";
import { arrayEquals } from "../../../../base/common/equals.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, derivedOpts } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { Action2, MenuItemAction, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { Menus } from "../../../browser/menus.js";
import { SessionHeaderMetaActionViewItem } from "../../../browser/parts/sessionHeaderMetaActionViewItem.js";
import { SessionHasPullRequestContext } from "../../../common/contextkeys.js";
import { ISessionContext } from "../../../services/sessions/browser/sessionContext.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { computePullRequestIcon, GitHubPullRequestState } from "../common/types.js";
import { IGitHubService } from "./githubService.js";
import { GitHubReferenceList } from "./githubReferenceList.js";
import { createPullRequestHoverElement } from "./pullRequestHover.js";
import { IPullRequestIconCache } from "./pullRequestIconCache.js";
import { computePullRequestIconStatus } from "./pullRequestIconStatus.js";
class OpenPullRequestAction extends Action2 {
  static {
    this.ID = "workbench.agentSessions.action.openPullRequest";
  }
  constructor() {
    super({
      id: OpenPullRequestAction.ID,
      title: localize2("agentSessions.openPullRequest", "Open Pull Request"),
      icon: Codicon.gitPullRequest,
      f1: false,
      // Pull request pill shown in the session header meta row
      // (vs/sessions/browser/parts/sessionHeader.ts). Rendered with a
      // custom action view item that summarizes the session's PRs.
      menu: [{
        id: Menus.SessionHeaderMeta,
        group: "navigation",
        order: 1,
        when: SessionHasPullRequestContext
      }, {
        id: Menus.SessionItemContextMenu,
        group: "2_pullRequest",
        order: 0,
        when: SessionHasPullRequestContext
      }]
    });
  }
  async run(accessor, session) {
    const openerService = accessor.get(IOpenerService);
    const sessionsService = accessor.get(ISessionsService);
    const targetSession = (Array.isArray(session) ? session[0] : session) ?? sessionsService.activeSession.get();
    const pullRequestUri = getSessionPullRequestUri(targetSession);
    if (!pullRequestUri) {
      return;
    }
    await openerService.open(pullRequestUri, { openExternal: true });
  }
}
registerAction2(OpenPullRequestAction);
function getSessionPullRequestUri(session) {
  return session?.workspace.get()?.folders[0]?.gitRepository?.gitHubInfo.get()?.pullRequest?.uri;
}
class CopyPullRequestUrlAction extends Action2 {
  static {
    this.ID = "workbench.agentSessions.action.copyPullRequestUrl";
  }
  constructor() {
    super({
      id: CopyPullRequestUrlAction.ID,
      title: localize2("agentSessions.copyPullRequestUrl", "Copy Pull Request URL"),
      f1: false,
      menu: [{
        id: Menus.SessionItemContextMenu,
        group: "2_pullRequest",
        order: 1,
        when: SessionHasPullRequestContext
      }]
    });
  }
  async run(accessor, session) {
    const clipboardService = accessor.get(IClipboardService);
    const sessionsService = accessor.get(ISessionsService);
    const targetSession = (Array.isArray(session) ? session[0] : session) ?? sessionsService.activeSession.get();
    const pullRequestUri = getSessionPullRequestUri(targetSession);
    if (!pullRequestUri) {
      return;
    }
    await clipboardService.writeText(pullRequestUri.toString(true));
  }
}
registerAction2(CopyPullRequestUrlAction);
let OpenPullRequestActionViewItem = class extends SessionHeaderMetaActionViewItem {
  constructor(action, options, sessionContext, _gitHubService, _pullRequestIconCache, _openerService, _hoverService) {
    super(void 0, action, options);
    this._gitHubService = _gitHubService;
    this._pullRequestIconCache = _pullRequestIconCache;
    this._openerService = _openerService;
    this._hoverService = _hoverService;
    this._pullRequestRefsObs = derivedOpts({
      owner: this,
      equalsFn: (a, b) => arrayEquals(a, b, (x, y) => x.owner === y.owner && x.repo === y.repo && x.number === y.number && isEqual(x.uri, y.uri) && (x.icon === y.icon || !!x.icon && !!y.icon && ThemeIcon.isEqual(x.icon, y.icon)))
    }, (reader) => {
      const session = sessionContext.session.read(reader);
      const workspace = session?.workspace.read(reader);
      const gitHubInfo = workspace?.folders[0]?.gitRepository?.gitHubInfo.read(reader);
      if (!gitHubInfo) {
        return [];
      }
      if (gitHubInfo.pullRequests?.length) {
        return gitHubInfo.pullRequests;
      }
      return gitHubInfo.pullRequest ? [{
        owner: gitHubInfo.owner,
        repo: gitHubInfo.repo,
        number: gitHubInfo.pullRequest.number,
        uri: gitHubInfo.pullRequest.uri,
        icon: gitHubInfo.pullRequest.icon
      }] : [];
    });
    this._pullRequestIdentitiesObs = derivedOpts({
      owner: this,
      equalsFn: (a, b) => arrayEquals(a, b, (x, y) => x.owner === y.owner && x.repo === y.repo && x.number === y.number)
    }, (reader) => this._pullRequestRefsObs.read(reader).map(({ owner, repo, number }) => ({ owner, repo, number })));
    this._pullRequestsObs = derived((reader) => this._pullRequestRefsObs.read(reader).map((ref) => {
      const reference = reader.store.add(this._gitHubService.createPullRequestModelReference(ref.owner, ref.repo, ref.number));
      const pullRequest = reference.object.pullRequest.read(reader);
      const status = pullRequest ? computePullRequestIconStatus(reader, this._gitHubService, ref.owner, ref.repo, pullRequest) : {};
      const icon = pullRequest ? computePullRequestIcon(pullRequest.isDraft ? "draft" : pullRequest.state, status) : this._pullRequestIconCache.get(ref.uri.toString()) ?? ref.icon ?? computePullRequestIcon(GitHubPullRequestState.Open);
      if (pullRequest) {
        this._pullRequestIconCache.set(ref.uri.toString(), icon);
      }
      return {
        ref,
        pullRequest,
        icon,
        status
      };
    }));
    this._register(autorun((reader) => {
      for (const identity of this._pullRequestIdentitiesObs.read(reader)) {
        const reference = reader.store.add(this._gitHubService.createPullRequestModelReference(identity.owner, identity.repo, identity.number));
        const model = reference.object;
        model.refresh();
        const shouldPoll = derived(this, (pollReader) => {
          const state = model.pullRequest.read(pollReader)?.state;
          return state === void 0 || state === GitHubPullRequestState.Open;
        });
        reader.store.add(autorun((pollReader) => {
          if (shouldPoll.read(pollReader)) {
            pollReader.store.add(model.startPolling());
          }
        }));
        reader.store.add(autorun((statusReader) => {
          const pullRequest = model.pullRequest.read(statusReader);
          if (!pullRequest || pullRequest.isDraft || pullRequest.state !== GitHubPullRequestState.Open) {
            return;
          }
          const ciReference = statusReader.store.add(this._gitHubService.createPullRequestCIModelReference(identity.owner, identity.repo, identity.number, pullRequest.headSha));
          ciReference.object.refresh();
          statusReader.store.add(ciReference.object.startPolling());
          const reviewThreadsReference = statusReader.store.add(this._gitHubService.createPullRequestReviewThreadsModelReference(identity.owner, identity.repo, identity.number));
          reviewThreadsReference.object.refresh();
          statusReader.store.add(reviewThreadsReference.object.startPolling());
        }));
      }
    }));
    this._register(autorun((reader) => {
      const pullRequests = this._pullRequestsObs.read(reader);
      this._pullRequestList?.update(this._getPullRequestListEntries(pullRequests));
      this.updateLabel();
      this.updateTooltip();
    }));
  }
  onDidClickButton() {
    const pullRequests = this._pullRequestsObs.get();
    if (pullRequests.length > 1) {
      this._showPullRequestPicker(pullRequests);
      return;
    }
    super.onDidClickButton();
  }
  getIconElement() {
    const icon = this._pullRequestsObs.get()[0]?.icon ?? Codicon.gitPullRequest;
    const iconElement = $(`span.chat-composite-bar-meta-item-icon${ThemeIcon.asCSSSelector(icon)}`);
    if (icon.color) {
      iconElement.style.setProperty("color", asCssVariable(icon.color.id), "important");
    }
    return iconElement;
  }
  getLabelText() {
    const pullRequests = this._pullRequestsObs.get();
    if (pullRequests.length === 0) {
      return "";
    }
    return pullRequests.length === 1 ? `#${pullRequests[0].ref.number}` : localize("agentSessions.openPullRequest.count", "{0} Pull Requests", pullRequests.length);
  }
  getHoverContents() {
    const pullRequests = this._pullRequestsObs.get();
    if (pullRequests.length !== 1) {
      return this.getTooltip();
    }
    const { ref, pullRequest } = pullRequests[0];
    return {
      element: () => createPullRequestHoverElement({
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
        repositoryHref: this._getRepositoryUri(ref).toString(true),
        pullRequest,
        onDidClickRepository: () => this._openerService.open(this._getRepositoryUri(ref), { openExternal: true })
      })
    };
  }
  getTooltip() {
    const pullRequests = this._pullRequestsObs.get();
    if (pullRequests.length > 1) {
      return localize("agentSessions.openPullRequest.tooltipMany", "Show the {0} Pull Requests Associated with This Session", pullRequests.length);
    }
    const number = pullRequests[0]?.ref.number;
    return number !== void 0 ? localize("agentSessions.openPullRequest.tooltipWithNumber", "Open Pull Request #{0}", number) : localize("agentSessions.openPullRequest.tooltip", "Open Pull Request");
  }
  _showPullRequestPicker(pullRequests) {
    const target = this.button?.element;
    if (!target) {
      return;
    }
    const list = new GitHubReferenceList(this._getPullRequestListEntries(pullRequests), (entry) => {
      this._hoverService.hideHover();
      this._openerService.open(entry.uri, { openExternal: true });
    });
    list.element.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this._hoverService.hideHover();
      }
    };
    this._pullRequestList = list;
    const hover = this._hoverService.showInstantHover({
      content: list.element,
      target,
      position: { hoverPosition: HoverPosition.BELOW },
      persistence: { sticky: true, hideOnKeyDown: false },
      appearance: { showPointer: false, skipFadeInAnimation: true },
      trapFocus: true,
      onDidHide: () => {
        if (this._pullRequestList === list) {
          this._pullRequestList = void 0;
        }
      }
    }, true);
    if (!hover) {
      this._pullRequestList = void 0;
    }
  }
  _getRepositoryUri(ref) {
    return URI.parse(`https://github.com/${ref.owner}/${ref.repo}`);
  }
  _getPullRequestListEntries(pullRequests) {
    return pullRequests.map(({ ref, pullRequest, icon, status }) => ({
      number: ref.number,
      title: pullRequest?.title,
      icon,
      uri: ref.uri,
      ariaLabel: getPullRequestAriaLabel(ref, pullRequest, status)
    }));
  }
};
OpenPullRequestActionViewItem = __decorateClass([
  __decorateParam(2, ISessionContext),
  __decorateParam(3, IGitHubService),
  __decorateParam(4, IPullRequestIconCache),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IHoverService)
], OpenPullRequestActionViewItem);
function getPullRequestAriaLabel(ref, pullRequest, status) {
  let kind;
  if (pullRequest?.isDraft) {
    kind = localize("agentSessions.pullRequestList.draft", "Draft Pull Request");
  } else {
    switch (pullRequest?.state) {
      case GitHubPullRequestState.Open:
        kind = localize("agentSessions.pullRequestList.open", "Open Pull Request");
        break;
      case GitHubPullRequestState.Merged:
        kind = localize("agentSessions.pullRequestList.merged", "Merged Pull Request");
        break;
      case GitHubPullRequestState.Closed:
        kind = localize("agentSessions.pullRequestList.closed", "Closed Pull Request");
        break;
      default:
        kind = localize("agentSessions.pullRequestList.pullRequest", "Pull Request");
    }
  }
  const baseLabel = pullRequest?.title ? localize("agentSessions.pullRequestList.labelWithTitle", "{0} #{1}: {2}", kind, ref.number, pullRequest.title) : localize("agentSessions.pullRequestList.label", "{0} #{1}", kind, ref.number);
  let attention;
  if (status.hasFailingChecks && status.hasUnresolvedComments) {
    attention = localize("agentSessions.pullRequestList.failingChecksAndUnresolvedComments", "failing checks and unresolved comments");
  } else if (status.hasFailingChecks) {
    attention = localize("agentSessions.pullRequestList.failingChecks", "failing checks");
  } else if (status.hasUnresolvedComments) {
    attention = localize("agentSessions.pullRequestList.unresolvedComments", "unresolved comments");
  }
  return attention ? localize("agentSessions.pullRequestList.labelWithAttention", "{0}, {1}", baseLabel, attention) : baseLabel;
}
let OpenPullRequestActionViewItemContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.openPullRequestActionViewItem";
  }
  constructor(actionViewItemService) {
    super();
    const onDidRegister = this._register(new Emitter());
    this._register(actionViewItemService.register(Menus.SessionHeaderMeta, OpenPullRequestAction.ID, (action, options, instantiationService) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(OpenPullRequestActionViewItem, action, options);
    }, onDidRegister.event));
    onDidRegister.fire();
  }
};
OpenPullRequestActionViewItemContribution = __decorateClass([
  __decorateParam(0, IActionViewItemService)
], OpenPullRequestActionViewItemContribution);
registerWorkbenchContribution2(OpenPullRequestActionViewItemContribution.ID, OpenPullRequestActionViewItemContribution, WorkbenchPhase.AfterRestored);
export {
  OpenPullRequestActionViewItem
};
