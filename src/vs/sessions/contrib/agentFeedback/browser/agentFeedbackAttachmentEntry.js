import { Codicon } from "../../../../base/common/codicons.js";
import { basename, isEqualOrParent, relativePath } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
import { localize } from "../../../../nls.js";
const ATTACHMENT_ID_PREFIX = "agentFeedback:";
function createAgentFeedbackVariableEntry(sessionResource, feedbackItems, annotationsResource) {
  return {
    kind: "agentFeedback",
    id: ATTACHMENT_ID_PREFIX + sessionResource.toString(),
    name: feedbackItems.length === 1 ? localize("agentFeedback.one", "1 comment") : localize("agentFeedback.many", "{0} comments", feedbackItems.length),
    icon: Codicon.comment,
    sessionResource,
    annotationsResource,
    feedbackItems: feedbackItems.map((f) => ({
      id: f.id,
      text: f.text,
      resourceUri: f.resourceUri,
      range: f.range,
      codeSelection: f.codeSelection,
      diffHunks: f.diffHunks,
      sourcePRReviewCommentId: f.sourcePRReviewCommentId,
      replies: f.replies
    })),
    value: buildAgentFeedbackValue(feedbackItems)
  };
}
function buildAgentFeedbackValue(feedbackItems) {
  const parts = ["The following comments were made on the code changes:"];
  for (const item of feedbackItems) {
    const fileName = basename(item.resourceUri);
    const lineRef = item.range.startLineNumber === item.range.endLineNumber ? `${item.range.startLineNumber}` : `${item.range.startLineNumber}-${item.range.endLineNumber}`;
    let part = `[${fileName}:${lineRef}]`;
    if (item.sourcePRReviewCommentId) {
      part += `
(PR review comment, thread ID: ${item.sourcePRReviewCommentId} \u2014 resolve this thread when addressed)`;
    }
    if (item.codeSelection) {
      part += `
Selection:
\`\`\`
${item.codeSelection}
\`\`\``;
    }
    if (item.diffHunks) {
      part += `
Diff Hunks:
\`\`\`diff
${item.diffHunks}
\`\`\``;
    }
    part += `
Comment: ${item.text}`;
    if (item.replies?.length) {
      for (const reply of item.replies) {
        part += `
Reply: ${reply}`;
      }
    }
    parts.push(part);
  }
  return parts.join("\n\n");
}
function buildNewSessionPrompt(prompt, feedbackItems, workspaceRoots) {
  const parts = [];
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt) {
    parts.push(trimmedPrompt);
  }
  const useCommentBullets = !!trimmedPrompt || feedbackItems.length !== 1;
  for (const item of feedbackItems) {
    const location = formatFeedbackLocation(item, workspaceRoots);
    parts.push(formatPromptLine(`${item.text} (${location})`, useCommentBullets ? "- " : "", useCommentBullets ? "  " : ""));
    for (const reply of item.replies ?? []) {
      parts.push(formatPromptLine(`reply: ${reply}`, "  - ", "    "));
    }
  }
  return parts.join("\n");
}
function formatFeedbackLocation(item, workspaceRoots) {
  const containingRoot = workspaceRoots.find((root) => isEqualOrParent(item.resourceUri, root));
  const workspaceRelativePath = containingRoot && relativePath(containingRoot, item.resourceUri);
  const resourcePath = workspaceRelativePath || (item.resourceUri.scheme === Schemas.file ? item.resourceUri.fsPath.replaceAll("\\", "/") : item.resourceUri.path);
  return `${resourcePath}:${item.range.startLineNumber}:${item.range.startColumn}-${item.range.endLineNumber}:${item.range.endColumn}`;
}
function formatPromptLine(text, prefix, continuationPrefix) {
  return prefix + text.replace(/\r?\n/g, `
${continuationPrefix}`);
}
export {
  ATTACHMENT_ID_PREFIX,
  buildAgentFeedbackValue,
  buildNewSessionPrompt,
  createAgentFeedbackVariableEntry
};
