import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { FEEDBACK_ANNOTATION_META_KEY, readFeedbackAnnotationMeta, VIEW_UNREVIEWED_COMMENTS_TOOL_NAME, ADD_COMMENT_TOOL_NAME } from "../../common/meta/agentFeedbackAnnotations.js";
import { buildAnnotationsUri } from "../../common/annotationsUri.js";
import { ActionType } from "../../common/state/protocol/common/actions.js";
import { parseChatUri } from "../../common/state/sessionState.js";
const addCommentToolName = ADD_COMMENT_TOOL_NAME;
const listCommentsToolName = "listComments";
const deleteCommentsToolName = "deleteComments";
const resolveCommentsToolName = "resolveComments";
const viewUnreviewedCommentsToolName = VIEW_UNREVIEWED_COMMENTS_TOOL_NAME;
const REVIEWABLE_FEEDBACK_KINDS = /* @__PURE__ */ new Set(["prReview", "codeReview"]);
const feedbackConfirmationToolNames = /* @__PURE__ */ new Set([viewUnreviewedCommentsToolName]);
function feedbackToolRequiresConfirmation(toolName) {
  return feedbackConfirmationToolNames.has(toolName);
}
const addCommentInputSchema = {
  type: "object",
  properties: {
    resourceUri: { type: "string", description: "URI of the file to add a comment to." },
    range: {
      type: "object",
      description: "One-based text range to comment on.",
      properties: {
        startLineNumber: { type: "number", description: "One-based start line number." },
        startColumn: { type: "number", description: "One-based start column." },
        endLineNumber: { type: "number", description: "One-based end line number." },
        endColumn: { type: "number", description: "One-based end column." }
      },
      required: ["startLineNumber", "startColumn", "endLineNumber", "endColumn"]
    },
    text: { type: "string", description: "Comment text to add." }
  },
  required: ["resourceUri", "range", "text"]
};
const listCommentsInputSchema = {
  type: "object",
  properties: {}
};
const viewUnreviewedCommentsInputSchema = {
  type: "object",
  properties: {}
};
const deleteCommentsInputSchema = {
  type: "object",
  properties: {
    commentIds: { type: "array", items: { type: "string" }, description: "Comment IDs to delete." }
  },
  required: ["commentIds"]
};
const resolveCommentsInputSchema = {
  type: "object",
  properties: {
    commentIds: { type: "array", items: { type: "string" }, description: "Comment IDs to update." },
    resolved: { type: "boolean", description: "Whether the comments should be marked as resolved. Defaults to true." }
  },
  required: ["commentIds"]
};
const feedbackServerToolDefinitions = [
  {
    name: addCommentToolName,
    title: "Add Comment (Agent Feedback)",
    description: "Add a comment to a file range.",
    inputSchema: addCommentInputSchema,
    annotations: { readOnlyHint: false }
  },
  {
    name: listCommentsToolName,
    title: "List Comments (Agent Feedback)",
    description: "List comments for this session.",
    inputSchema: listCommentsInputSchema,
    annotations: { readOnlyHint: true }
  },
  {
    name: deleteCommentsToolName,
    title: "Delete Comments (Agent Feedback)",
    description: "Delete comments for this session.",
    inputSchema: deleteCommentsInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  {
    name: resolveCommentsToolName,
    title: "Resolve Comments (Agent Feedback)",
    description: "Mark comments for this session as resolved or unresolved.",
    inputSchema: resolveCommentsInputSchema,
    annotations: { readOnlyHint: false }
  },
  {
    name: viewUnreviewedCommentsToolName,
    title: "View Unreviewed Comments (Agent Feedback)",
    description: "View pull request or code review comments that the user has not reviewed yet. The user may be asked to choose which comments to reveal, in which case only the comments they select are returned; otherwise every unreviewed comment is returned.",
    inputSchema: viewUnreviewedCommentsInputSchema,
    annotations: { readOnlyHint: false }
  }
];
function getRequiredString(value, field, toolName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${toolName} input: ${field} must be a non-empty string.`);
  }
  return value;
}
function getRequiredPositiveInteger(value, field, toolName) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${toolName} input: ${field} must be a positive integer.`);
  }
  return value;
}
function getAddCommentArgs(rawArgs) {
  const args = rawArgs ?? {};
  const resourceUri = getRequiredString(args.resourceUri, "resourceUri", addCommentToolName);
  const text = getRequiredString(args.text, "text", addCommentToolName);
  if (!args.range || typeof args.range !== "object" || Array.isArray(args.range)) {
    throw new Error(`Invalid ${addCommentToolName} input: range must be an object.`);
  }
  const range = args.range;
  return {
    resourceUri,
    text,
    range: {
      startLineNumber: getRequiredPositiveInteger(range.startLineNumber, "range.startLineNumber", addCommentToolName),
      startColumn: getRequiredPositiveInteger(range.startColumn, "range.startColumn", addCommentToolName),
      endLineNumber: getRequiredPositiveInteger(range.endLineNumber, "range.endLineNumber", addCommentToolName),
      endColumn: getRequiredPositiveInteger(range.endColumn, "range.endColumn", addCommentToolName)
    }
  };
}
function getUniqueCommentIds(value, toolName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid ${toolName} input: commentIds must be a non-empty string array.`);
  }
  const ids = [];
  for (const item of value) {
    ids.push(getRequiredString(item, "commentIds[]", toolName));
  }
  return [...new Set(ids)];
}
function getResolvedFlag(value) {
  if (value === void 0) {
    return true;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${resolveCommentsToolName} input: resolved must be a boolean.`);
  }
  return value;
}
function toTextRange(range) {
  return {
    start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
    end: { line: range.endLineNumber - 1, character: range.endColumn - 1 }
  };
}
function fromTextRange(range) {
  if (!range) {
    return { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
  }
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1
  };
}
function entryText(text) {
  return typeof text === "string" ? text : text.markdown;
}
function readMeta(annotation) {
  return readFeedbackAnnotationMeta(annotation);
}
function serializeComment(annotation) {
  const entries = annotation.entries ?? [];
  const meta = readMeta(annotation);
  const replies = entries.slice(1).map((e) => entryText(e.text));
  return {
    id: annotation.id,
    resourceUri: annotation.resource,
    range: fromTextRange(annotation.range),
    text: entries.length ? entryText(entries[0].text) : "",
    kind: meta?.kind ?? "user",
    resolved: annotation.resolved,
    ...replies.length ? { replies } : {}
  };
}
function listableAnnotations(state) {
  return state.annotations.filter((annotation) => {
    const meta = readMeta(annotation);
    if (!meta || !annotation.entries?.length) {
      return false;
    }
    const effectiveState = annotation.resolved ? "resolved" : meta.state ?? "accepted";
    return effectiveState !== "created";
  });
}
function pendingRevealAnnotations(state) {
  return state.annotations.filter((annotation) => {
    const meta = readMeta(annotation);
    if (!meta || !annotation.entries?.length) {
      return false;
    }
    return REVIEWABLE_FEEDBACK_KINDS.has(meta.kind) && meta.pendingAgentReveal === true;
  });
}
function clearPendingReveal(annotation) {
  const meta = readMeta(annotation);
  if (!meta) {
    return annotation;
  }
  const nextMeta = { ...meta, pendingAgentReveal: void 0 };
  return { ...annotation, _meta: { ...annotation._meta, [FEEDBACK_ANNOTATION_META_KEY]: nextMeta } };
}
function markSubmitted(annotation) {
  const meta = readMeta(annotation);
  if (!meta) {
    return annotation;
  }
  const nextMeta = { ...meta, state: "submitted", pendingAgentReveal: void 0 };
  return { ...annotation, _meta: { ...annotation._meta, [FEEDBACK_ANNOTATION_META_KEY]: nextMeta } };
}
function createdReviewableAnnotations(state) {
  return state.annotations.filter((annotation) => {
    const meta = readMeta(annotation);
    if (!meta || !annotation.entries?.length) {
      return false;
    }
    return REVIEWABLE_FEEDBACK_KINDS.has(meta.kind) && !annotation.resolved && (meta.state ?? "accepted") === "created";
  });
}
function hasRevealableComments(state) {
  return pendingRevealAnnotations(state).length > 0 || createdReviewableAnnotations(state).length > 0;
}
function buildUnreviewedCommentsNote(state) {
  const created = createdReviewableAnnotations(state);
  if (!created.length) {
    return void 0;
  }
  let prCount = 0;
  let codeReviewCount = 0;
  for (const annotation of created) {
    const kind = readMeta(annotation)?.kind;
    if (kind === "prReview") {
      prCount++;
    } else if (kind === "codeReview") {
      codeReviewCount++;
    }
  }
  const clauses = [];
  if (prCount > 0) {
    clauses.push(`${prCount} pull request comment${prCount === 1 ? "" : "s"}`);
  }
  if (codeReviewCount > 0) {
    clauses.push(`${codeReviewCount} code review comment${codeReviewCount === 1 ? "" : "s"}`);
  }
  const subject = clauses.join(" and ");
  const verb = created.length === 1 ? "is" : "are";
  return `There ${verb} ${subject} which the user has not reviewed yet. If the user wants you to tackle them, call the \`${viewUnreviewedCommentsToolName}\` tool to view them.`;
}
function applyFeedbackTool(state, sessionResource, toolName, rawArgs) {
  switch (toolName) {
    case addCommentToolName: {
      const { resourceUri, range, text } = getAddCommentArgs(rawArgs);
      const id = generateUuid();
      const meta = { kind: "codeReview", state: "created", sessionResource };
      const annotation = {
        id,
        turnId: "",
        resource: resourceUri,
        range: toTextRange(range),
        resolved: false,
        entries: [{ id: `${id}:0`, text }],
        _meta: { [FEEDBACK_ANNOTATION_META_KEY]: meta }
      };
      return {
        actions: [{ type: ActionType.AnnotationsSet, annotation }],
        result: "Comment added."
      };
    }
    case listCommentsToolName: {
      const payload = {
        comments: listableAnnotations(state).map(serializeComment)
      };
      const note = buildUnreviewedCommentsNote(state);
      if (note) {
        payload.note = note;
      }
      return { actions: [], result: JSON.stringify(payload, void 0, 2) };
    }
    case viewUnreviewedCommentsToolName: {
      const pending = pendingRevealAnnotations(state);
      if (!pending.length) {
        const unreviewed = createdReviewableAnnotations(state);
        return {
          actions: unreviewed.map((annotation) => ({
            type: ActionType.AnnotationsSet,
            annotation: markSubmitted(annotation)
          })),
          result: JSON.stringify({ comments: unreviewed.map(serializeComment) }, void 0, 2)
        };
      }
      const comments = pending.map(serializeComment);
      const actions = pending.map((annotation) => ({
        type: ActionType.AnnotationsSet,
        annotation: clearPendingReveal(annotation)
      }));
      return { actions, result: JSON.stringify({ comments }, void 0, 2) };
    }
    case deleteCommentsToolName: {
      const ids = getUniqueCommentIds(rawArgs?.commentIds, deleteCommentsToolName);
      const listable = listableAnnotations(state);
      const existing = new Map(listable.map((a) => [a.id, a]));
      const actions = [];
      const deleted = [];
      const notFound = [];
      for (const id of ids) {
        if (existing.has(id)) {
          actions.push({ type: ActionType.AnnotationsRemoved, annotationId: id });
          deleted.push(id);
        } else {
          notFound.push(id);
        }
      }
      const remaining = listable.filter((a) => !deleted.includes(a.id)).map(serializeComment);
      return {
        actions,
        result: JSON.stringify({ deletedCommentIds: deleted, notFoundCommentIds: notFound, remainingComments: remaining }, void 0, 2)
      };
    }
    case resolveCommentsToolName: {
      const args = rawArgs ?? {};
      const ids = getUniqueCommentIds(args.commentIds, resolveCommentsToolName);
      const resolved = getResolvedFlag(args.resolved);
      const listable = listableAnnotations(state);
      const existing = new Map(listable.map((a) => [a.id, a]));
      const actions = [];
      const updated = [];
      const notFound = [];
      for (const id of ids) {
        const annotation = existing.get(id);
        if (!annotation) {
          notFound.push(id);
          continue;
        }
        const meta = readMeta(annotation);
        const nextMeta = {
          ...meta,
          kind: meta?.kind ?? "user",
          state: resolved ? "resolved" : "submitted",
          sessionResource: meta?.sessionResource ?? sessionResource
        };
        const nextAnnotation = {
          ...annotation,
          resolved,
          _meta: { ...annotation._meta, [FEEDBACK_ANNOTATION_META_KEY]: nextMeta }
        };
        actions.push({ type: ActionType.AnnotationsSet, annotation: nextAnnotation });
        updated.push(id);
      }
      const comments = listable.map((a) => updated.includes(a.id) ? serializeComment({ ...a, resolved }) : serializeComment(a));
      return {
        actions,
        result: JSON.stringify({ resolved, updatedCommentIds: updated, notFoundCommentIds: notFound, comments }, void 0, 2)
      };
    }
    default:
      throw new Error(`Unknown feedback server tool: ${toolName}`);
  }
}
function parseListedCommentCount(resultText) {
  if (!resultText) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(resultText);
    return Array.isArray(parsed.comments) ? parsed.comments.length : void 0;
  } catch {
    return void 0;
  }
}
function getFeedbackToolDisplay(toolName, _args, result) {
  switch (toolName) {
    case addCommentToolName:
      return {
        displayName: localize("toolName.addComment", "Add Comment"),
        invocationMessage: localize("toolInvoke.addComment", "Adding comment"),
        pastTenseMessage: localize("toolComplete.addComment", "Added comment")
      };
    case listCommentsToolName: {
      let pastTenseMessage;
      const count = result ? parseListedCommentCount(result.text) : void 0;
      if (count === void 0) {
        pastTenseMessage = localize("toolComplete.listComments", "Checked comments");
      } else if (count === 1) {
        pastTenseMessage = localize("toolComplete.listComments.one", "Checked 1 comment");
      } else {
        pastTenseMessage = localize("toolComplete.listComments.many", "Checked {0} comments", count);
      }
      return {
        displayName: localize("toolName.listComments", "List Comments"),
        invocationMessage: localize("toolInvoke.listComments", "Checking comments"),
        pastTenseMessage
      };
    }
    case deleteCommentsToolName:
      return {
        displayName: localize("toolName.deleteComments", "Delete Comments"),
        invocationMessage: localize("toolInvoke.deleteComments", "Deleting comments"),
        pastTenseMessage: localize("toolComplete.deleteComments", "Deleted comments")
      };
    case resolveCommentsToolName:
      return {
        displayName: localize("toolName.resolveComments", "Resolve Comments"),
        invocationMessage: localize("toolInvoke.resolveComments", "Resolving comments"),
        pastTenseMessage: localize("toolComplete.resolveComments", "Resolved comments")
      };
    case viewUnreviewedCommentsToolName:
      return {
        displayName: localize("toolName.viewUnreviewedComments", "View Comments"),
        invocationMessage: localize("toolInvoke.viewUnreviewedComments", "Viewing comments"),
        pastTenseMessage: localize("toolComplete.viewUnreviewedComments", "Viewed comments")
      };
    default:
      return void 0;
  }
}
const feedbackServerToolGroup = {
  definitions: feedbackServerToolDefinitions,
  canRequireConfirmation(toolName) {
    return feedbackToolRequiresConfirmation(toolName);
  },
  requiresConfirmation(stateManager, chatUri, toolName) {
    if (!feedbackToolRequiresConfirmation(toolName)) {
      return false;
    }
    return hasRevealableComments(getFeedbackToolState(stateManager, chatUri).state);
  },
  getDisplay(toolName, args, result) {
    return getFeedbackToolDisplay(toolName, args, result);
  },
  execute(stateManager, chatUri, toolName, rawArgs) {
    const { mainSessionUri, annotationsUri, state } = getFeedbackToolState(stateManager, chatUri);
    const outcome = applyFeedbackTool(state, mainSessionUri, toolName, rawArgs);
    for (const action of outcome.actions) {
      stateManager.dispatchServerAction(annotationsUri, action);
    }
    return outcome.result;
  }
};
function getFeedbackToolState(stateManager, chatUri) {
  const mainSessionUri = parseChatUri(chatUri)?.session ?? chatUri;
  const annotationsUri = buildAnnotationsUri(mainSessionUri);
  const snapshot = stateManager.getSnapshot(annotationsUri);
  const state = snapshot?.state ?? { annotations: [] };
  return { mainSessionUri, annotationsUri, state };
}
export {
  addCommentToolName,
  applyFeedbackTool,
  deleteCommentsToolName,
  feedbackServerToolDefinitions,
  feedbackServerToolGroup,
  feedbackToolRequiresConfirmation,
  listCommentsToolName,
  resolveCommentsToolName,
  viewUnreviewedCommentsToolName
};
