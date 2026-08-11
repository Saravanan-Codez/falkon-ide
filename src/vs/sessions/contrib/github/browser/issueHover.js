import "./media/issueHover.css";
import { $, append } from "../../../../base/browser/dom.js";
import { safeIntl } from "../../../../base/common/date.js";
import { localize } from "../../../../nls.js";
const issueDateFormatter = safeIntl.DateTimeFormat(void 0, { month: "short", day: "numeric" });
function createIssueHoverElement(data) {
  const hoverElement = $(".sessions-issue-hover");
  const header = append(hoverElement, $(".sessions-issue-hover-header"));
  const repositoryLink = document.createElement("a");
  repositoryLink.className = "sessions-issue-hover-repository";
  append(header, repositoryLink);
  repositoryLink.href = data.repositoryHref;
  repositoryLink.textContent = `${data.owner}/${data.repo}#${data.number}`;
  repositoryLink.title = repositoryLink.textContent;
  if (data.onDidClickRepository) {
    repositoryLink.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      data.onDidClickRepository?.();
    };
  }
  const date = formatIssueDate(data.issue?.createdAt);
  if (date) {
    append(header, $("span.sessions-issue-hover-date", void 0, localize("agentSessions.issueHover.onDate", "on {0}", date)));
  }
  append(hoverElement, $(".sessions-issue-hover-title", void 0, data.issue?.title || localize("agentSessions.issueHover.titleFallback", "Issue #{0}", data.number)));
  const body = data.issue?.body.trim() || localize("agentSessions.issueHover.bodyFallback", "No description provided.");
  const description = append(hoverElement, $(".sessions-issue-hover-description"));
  append(description, $(".sessions-issue-hover-description-content", void 0, body));
  return hoverElement;
}
function formatIssueDate(value) {
  if (!value) {
    return void 0;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return void 0;
  }
  return issueDateFormatter.value.format(date);
}
export {
  createIssueHoverElement
};
