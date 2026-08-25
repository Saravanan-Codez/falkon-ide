import "./media/pullRequestHover.css";
import { $, append } from "../../../../base/browser/dom.js";
import { safeIntl } from "../../../../base/common/date.js";
import { localize } from "../../../../nls.js";
const pullRequestDateFormatter = safeIntl.DateTimeFormat(void 0, { month: "short", day: "numeric" });
function createPullRequestHoverElement(data) {
  const hoverElement = $(".sessions-pr-hover");
  const header = append(hoverElement, $(".sessions-pr-hover-header"));
  const repositoryLink = document.createElement("a");
  repositoryLink.className = "sessions-pr-hover-repository";
  append(header, repositoryLink);
  repositoryLink.href = data.repositoryHref;
  repositoryLink.textContent = `${data.owner}/${data.repo}`;
  repositoryLink.title = repositoryLink.textContent;
  if (data.onDidClickRepository) {
    repositoryLink.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      data.onDidClickRepository?.();
    };
  }
  const date = formatPullRequestDate(data.pullRequest?.createdAt);
  if (date) {
    append(header, $("span.sessions-pr-hover-date", void 0, localize("agentSessions.pullRequestHover.onDate", "on {0}", date)));
  }
  append(hoverElement, $(".sessions-pr-hover-title", void 0, data.pullRequest?.title || localize("agentSessions.pullRequestHover.titleFallback", "Pull Request #{0}", data.number)));
  const body = data.pullRequest?.body.trim() || localize("agentSessions.pullRequestHover.bodyFallback", "No description provided.");
  const description = append(hoverElement, $(".sessions-pr-hover-description"));
  append(description, $(".sessions-pr-hover-description-content", void 0, body));
  const branchRow = append(hoverElement, $(".sessions-pr-hover-branches"));
  appendBranchPill(branchRow, data.pullRequest?.baseRef || localize("agentSessions.pullRequestHover.baseFallback", "target"));
  append(branchRow, $("span.sessions-pr-hover-branch-arrow", void 0, "\u2190"));
  appendBranchPill(branchRow, data.pullRequest?.headRef || localize("agentSessions.pullRequestHover.headFallback", "source"));
  return hoverElement;
}
function appendBranchPill(container, label) {
  const branch = append(container, $("span.sessions-pr-hover-branch", void 0, label));
  branch.title = label;
}
function formatPullRequestDate(value) {
  if (!value) {
    return void 0;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return void 0;
  }
  return pullRequestDateFormatter.value.format(date);
}
export {
  createPullRequestHoverElement
};
