const ISSUE_URL_PATTERN = /\bhttps?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\b/gi;
const ISSUE_SHORTHAND_PATTERN = /(?<![\w./-])([\w.-]+)\/([\w.-]+)#(\d+)\b/g;
const MAX_SESSION_ISSUE_REFERENCES = 10;
function parseGitHubIssueReferences(text) {
  const references = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (owner, repo, rawNumber) => {
    const number = Number(rawNumber);
    if (!Number.isSafeInteger(number) || number <= 0) {
      return;
    }
    const url = toGitHubIssueUrl({ owner, repo, number });
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    references.push({ owner, repo, number });
  };
  for (const match of text.matchAll(ISSUE_URL_PATTERN)) {
    add(match[1], match[2], match[3]);
  }
  for (const match of text.matchAll(ISSUE_SHORTHAND_PATTERN)) {
    add(match[1], match[2], match[3]);
  }
  return references;
}
function toGitHubIssueUrl(reference) {
  return `https://github.com/${reference.owner}/${reference.repo}/issues/${reference.number}`;
}
function parseGitHubIssueUrl(url) {
  return parseGitHubIssueReferences(url)[0];
}
export {
  MAX_SESSION_ISSUE_REFERENCES,
  parseGitHubIssueReferences,
  parseGitHubIssueUrl,
  toGitHubIssueUrl
};
