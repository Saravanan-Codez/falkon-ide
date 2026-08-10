import { Range } from "../../../../editor/common/core/range.js";
import { AgentFeedbackKind, AgentFeedbackState } from "./agentFeedbackModel.js";
import { PRReviewStateKind } from "../../codeReview/browser/codeReviewService.js";
var SessionEditorCommentSource = /* @__PURE__ */ ((SessionEditorCommentSource2) => {
  SessionEditorCommentSource2["AgentFeedback"] = "agentFeedback";
  SessionEditorCommentSource2["PRReview"] = "prReview";
  return SessionEditorCommentSource2;
})(SessionEditorCommentSource || {});
function getPRReviewComments(prReviewState) {
  return prReviewState?.kind === PRReviewStateKind.Loaded ? prReviewState.comments : [];
}
function getSessionEditorComments(sessionResource, agentFeedbackItems, prReviewState) {
  const comments = [];
  const supersededPRCommentIds = /* @__PURE__ */ new Set();
  for (const item of agentFeedbackItems) {
    if (item.kind === AgentFeedbackKind.PRReview && item.sourcePRReviewCommentId && item.state !== AgentFeedbackState.Created) {
      supersededPRCommentIds.add(item.sourcePRReviewCommentId);
    }
  }
  for (const item of agentFeedbackItems) {
    if (item.state === AgentFeedbackState.Resolved) {
      continue;
    }
    if (item.kind === AgentFeedbackKind.PRReview && item.state === AgentFeedbackState.Created && item.sourcePRReviewCommentId) {
      continue;
    }
    comments.push({
      id: toSessionEditorCommentId("agentFeedback" /* AgentFeedback */, item.id),
      sourceId: item.id,
      source: "agentFeedback" /* AgentFeedback */,
      kind: item.kind,
      sessionResource,
      resourceUri: item.resourceUri,
      range: item.range,
      text: item.text,
      suggestion: item.suggestion,
      canConvertToAgentFeedback: false,
      replies: item.replies,
      state: item.state
    });
  }
  for (const item of getPRReviewComments(prReviewState)) {
    if (supersededPRCommentIds.has(item.id)) {
      continue;
    }
    comments.push({
      id: toSessionEditorCommentId("prReview" /* PRReview */, item.id),
      sourceId: item.id,
      source: "prReview" /* PRReview */,
      kind: AgentFeedbackKind.PRReview,
      sessionResource,
      resourceUri: item.uri,
      range: item.range,
      text: item.body,
      canConvertToAgentFeedback: true
    });
  }
  comments.sort(compareSessionEditorComments);
  return comments;
}
function compareSessionEditorComments(a, b) {
  return a.resourceUri.toString().localeCompare(b.resourceUri.toString()) || Range.compareRangesUsingStarts(Range.lift(a.range), Range.lift(b.range)) || a.source.localeCompare(b.source) || a.sourceId.localeCompare(b.sourceId);
}
function estimateExpandedCommentLines(comment) {
  const charsPerLine = 50;
  const textLines = Math.ceil(Math.max(1, comment.text.length) / charsPerLine);
  let suggestionLines = 0;
  if (comment.suggestion?.edits.length) {
    for (const edit of comment.suggestion.edits) {
      suggestionLines += 2 + Math.max(1, edit.newText.split("\n").length);
    }
  }
  let replyLines = 0;
  if (comment.replies?.length) {
    for (const reply of comment.replies) {
      replyLines += Math.ceil(Math.max(1, reply.length) / charsPerLine);
    }
  }
  return textLines + 1 + suggestionLines + replyLines;
}
function groupNearbySessionEditorComments(items, lineThreshold = 5) {
  if (items.length === 0) {
    return [];
  }
  const sorted = [...items].sort(compareSessionEditorComments);
  const groups = [];
  let currentGroup = [sorted[0]];
  let currentGroupExpandedLines = estimateExpandedCommentLines(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    const firstItem = currentGroup[0];
    const currentItem = sorted[i];
    const sameResource = currentItem.resourceUri.toString() === firstItem.resourceUri.toString();
    const verticalSpan = currentItem.range.startLineNumber - firstItem.range.startLineNumber;
    const effectiveThreshold = lineThreshold + currentGroupExpandedLines;
    if (sameResource && verticalSpan <= effectiveThreshold) {
      currentGroup.push(currentItem);
      currentGroupExpandedLines += estimateExpandedCommentLines(currentItem);
    } else {
      groups.push(currentGroup);
      currentGroup = [currentItem];
      currentGroupExpandedLines = estimateExpandedCommentLines(currentItem);
    }
  }
  groups.push(currentGroup);
  return groups;
}
function getResourceEditorComments(resourceUri, comments) {
  const resource = resourceUri.toString();
  return comments.filter((comment) => comment.resourceUri.toString() === resource);
}
function toSessionEditorCommentId(source, sourceId) {
  return `${source}:${sourceId}`;
}
function fromSessionEditorCommentId(id) {
  const separatorIndex = id.indexOf(":");
  if (separatorIndex === -1) {
    return void 0;
  }
  const source = id.slice(0, separatorIndex);
  if (source !== "agentFeedback" /* AgentFeedback */ && source !== "prReview" /* PRReview */) {
    return void 0;
  }
  return { source, sourceId: id.slice(separatorIndex + 1) };
}
function getAcceptedAgentFeedbackCommentCount(comments) {
  let count = 0;
  for (const comment of comments) {
    if (comment.source === "agentFeedback" /* AgentFeedback */ && comment.state === AgentFeedbackState.Accepted) {
      count++;
    }
  }
  return count;
}
function hasAcceptedAgentFeedbackComments(comments) {
  return comments.some((comment) => comment.source === "agentFeedback" /* AgentFeedback */ && comment.state === AgentFeedbackState.Accepted);
}
export {
  SessionEditorCommentSource,
  compareSessionEditorComments,
  fromSessionEditorCommentId,
  getAcceptedAgentFeedbackCommentCount,
  getPRReviewComments,
  getResourceEditorComments,
  getSessionEditorComments,
  groupNearbySessionEditorComments,
  hasAcceptedAgentFeedbackComments,
  toSessionEditorCommentId
};
