import { localize } from "../../../nls.js";
import { readSessionGitState, readSessionWorkspaceless, SessionLifecycle } from "./state/sessionState.js";
const BRANCH_CHANGESET_ID = "branch";
const UNCOMMITTED_CHANGESET_ID = "uncommitted";
const SESSION_CHANGESET_ID = "session";
const TURN_CHANGESET_PREFIX = "turn/";
const TURN_TEMPLATE_VARIABLE = "{turnId}";
const COMPARE_CHANGESET_PREFIX = "compare/";
const COMPARE_ORIGINAL_TEMPLATE_VARIABLE = "{originalTurnId}";
const COMPARE_MODIFIED_TEMPLATE_VARIABLE = "{modifiedTurnId}";
const branchChangesetLabel = () => localize("branchChangeset.label", "Branch Changes");
const sessionChangesetLabel = () => localize("sessionChangeset.label", "All Changes");
const sessionChangesetDescription = () => localize("sessionChangeset.description", "Show all changes made in this session");
const uncommittedChangesetLabel = () => localize("uncommittedChangeset.label", "Uncommitted Changes");
const uncommittedChangesetDescription = () => localize("uncommittedChangeset.description", "Show uncommitted changes in this session");
const thisTurnChangesetLabel = () => localize("thisTurnChangeset.label", "This Turn");
const thisTurnChangesetDescription = () => localize("thisTurnChangeset.description", "Show changes made in this turn");
const compareTurnsChangesetLabel = () => localize("compareTurnsChangeset.label", "Compare Turns");
const compareTurnsChangesetDescription = () => localize("compareTurnsChangeset.description", "Show changes made between different turns");
function formatBranchChangesetDescription(gitState) {
  const { baseBranchName, branchName, upstreamBranchName } = gitState;
  if (baseBranchName && branchName) {
    return `${branchName} \u2192 ${baseBranchName}`;
  }
  if (upstreamBranchName && branchName) {
    return `${branchName} \u2192 ${upstreamBranchName}`;
  }
  return branchName;
}
const CHANGESET_PATH_SEGMENT = "/changeset/";
var ChangesetKind = /* @__PURE__ */ ((ChangesetKind2) => {
  ChangesetKind2["Branch"] = "branch";
  ChangesetKind2["Uncommitted"] = "uncommitted";
  ChangesetKind2["Session"] = "session";
  ChangesetKind2["Turn"] = "turn";
  ChangesetKind2["Compare"] = "compare-turns";
  ChangesetKind2["Unknown"] = "unknown";
  return ChangesetKind2;
})(ChangesetKind || {});
function buildBranchChangesetUri(sessionUri) {
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${BRANCH_CHANGESET_ID}`;
}
function buildSessionChangesetUri(sessionUri) {
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${SESSION_CHANGESET_ID}`;
}
function buildUncommittedChangesetUri(sessionUri) {
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${UNCOMMITTED_CHANGESET_ID}`;
}
function buildTurnChangesetUriTemplate(sessionUri) {
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${TURN_CHANGESET_PREFIX}${TURN_TEMPLATE_VARIABLE}`;
}
function buildTurnChangesetUri(sessionUri, turnId) {
  if (!turnId || turnId.includes("/")) {
    throw new Error(`buildTurnChangesetUri: turnId must be non-empty and not contain '/' (got ${JSON.stringify(turnId)})`);
  }
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${TURN_CHANGESET_PREFIX}${turnId}`;
}
function buildCompareTurnsChangesetUriTemplate(sessionUri) {
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${COMPARE_CHANGESET_PREFIX}${COMPARE_ORIGINAL_TEMPLATE_VARIABLE}/${COMPARE_MODIFIED_TEMPLATE_VARIABLE}`;
}
function buildCompareTurnsChangesetUri(sessionUri, originalTurnId, modifiedTurnId) {
  if (!originalTurnId || originalTurnId.includes("/")) {
    throw new Error(`buildCompareTurnsChangesetUri: originalTurnId must be non-empty and not contain '/' (got ${JSON.stringify(originalTurnId)})`);
  }
  if (!modifiedTurnId || modifiedTurnId.includes("/")) {
    throw new Error(`buildCompareTurnsChangesetUri: modifiedTurnId must be non-empty and not contain '/' (got ${JSON.stringify(modifiedTurnId)})`);
  }
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${COMPARE_CHANGESET_PREFIX}${originalTurnId}/${modifiedTurnId}`;
}
function buildChangesetUri(sessionUri, changesetId) {
  if (!changesetId) {
    throw new Error("buildChangesetUri: changesetId must be non-empty");
  }
  if (changesetId.includes("/")) {
    throw new Error(`buildChangesetUri: changesetId must not contain '/' (got ${JSON.stringify(changesetId)})`);
  }
  return `${sessionUri}${CHANGESET_PATH_SEGMENT}${changesetId}`;
}
function parseChangesetUri(uri) {
  const idx = uri.lastIndexOf(CHANGESET_PATH_SEGMENT);
  if (idx < 0) {
    return void 0;
  }
  const changesetId = uri.slice(idx + CHANGESET_PATH_SEGMENT.length);
  if (!changesetId) {
    return void 0;
  }
  const sessionUri = uri.slice(0, idx);
  if (changesetId === BRANCH_CHANGESET_ID) {
    return { sessionUri, changesetId, kind: "branch" /* Branch */ };
  }
  if (changesetId === UNCOMMITTED_CHANGESET_ID) {
    return { sessionUri, changesetId, kind: "uncommitted" /* Uncommitted */ };
  }
  if (changesetId === SESSION_CHANGESET_ID) {
    return { sessionUri, changesetId, kind: "session" /* Session */ };
  }
  if (changesetId.startsWith(TURN_CHANGESET_PREFIX)) {
    const turnId = changesetId.slice(TURN_CHANGESET_PREFIX.length);
    if (!turnId || turnId.includes("/") || turnId === TURN_TEMPLATE_VARIABLE) {
      return void 0;
    }
    return { sessionUri, changesetId, kind: "turn" /* Turn */, turnId };
  }
  if (changesetId.startsWith(COMPARE_CHANGESET_PREFIX)) {
    const tail = changesetId.slice(COMPARE_CHANGESET_PREFIX.length);
    const parts = tail.split("/");
    if (parts.length !== 2) {
      return void 0;
    }
    const [originalTurnId, modifiedTurnId] = parts;
    if (!originalTurnId || !modifiedTurnId || originalTurnId === COMPARE_ORIGINAL_TEMPLATE_VARIABLE || modifiedTurnId === COMPARE_MODIFIED_TEMPLATE_VARIABLE) {
      return void 0;
    }
    return { sessionUri, changesetId, kind: "compare-turns" /* Compare */, originalTurnId, modifiedTurnId };
  }
  if (changesetId.includes("/")) {
    return void 0;
  }
  return { sessionUri, changesetId, kind: "unknown" /* Unknown */ };
}
function isChangesetUri(uri) {
  return parseChangesetUri(uri) !== void 0;
}
function isSessionChangesetUri(uri) {
  return parseChangesetUri(uri)?.kind === "session" /* Session */;
}
function isUncommittedChangesetUri(uri) {
  return parseChangesetUri(uri)?.kind === "uncommitted" /* Uncommitted */;
}
function parseTurnChangesetUri(uri) {
  const parsed = parseChangesetUri(uri);
  if (parsed?.kind !== "turn" /* Turn */ || parsed.turnId === void 0) {
    return void 0;
  }
  return { sessionUri: parsed.sessionUri, turnId: parsed.turnId };
}
function parseCompareTurnsChangesetUri(uri) {
  const parsed = parseChangesetUri(uri);
  if (parsed?.kind !== "compare-turns" /* Compare */ || parsed.originalTurnId === void 0 || parsed.modifiedTurnId === void 0) {
    return void 0;
  }
  return { sessionUri: parsed.sessionUri, originalTurnId: parsed.originalTurnId, modifiedTurnId: parsed.modifiedTurnId };
}
function buildDefaultChangesetCatalog(sessionUri, state) {
  if (!state || state.lifecycle === SessionLifecycle.CreationFailed) {
    return [];
  }
  if (state.lifecycle === SessionLifecycle.Creating) {
    if (readSessionWorkspaceless(state._meta)) {
      return [];
    }
    return [{
      label: uncommittedChangesetLabel(),
      description: uncommittedChangesetDescription(),
      uriTemplate: buildUncommittedChangesetUri(sessionUri),
      changeKind: "uncommitted" /* Uncommitted */
    }];
  }
  const gitState = readSessionGitState(state._meta);
  if (!gitState) {
    return [
      {
        label: sessionChangesetLabel(),
        description: sessionChangesetDescription(),
        uriTemplate: buildSessionChangesetUri(sessionUri),
        changeKind: "session" /* Session */
      },
      {
        label: thisTurnChangesetLabel(),
        description: thisTurnChangesetDescription(),
        uriTemplate: buildTurnChangesetUriTemplate(sessionUri),
        changeKind: "turn" /* Turn */
      }
    ];
  }
  return [
    {
      label: branchChangesetLabel(),
      description: gitState ? formatBranchChangesetDescription(gitState) : void 0,
      uriTemplate: buildBranchChangesetUri(sessionUri),
      changeKind: "branch" /* Branch */,
      capabilities: { review: {} }
    },
    {
      label: uncommittedChangesetLabel(),
      description: uncommittedChangesetDescription(),
      uriTemplate: buildUncommittedChangesetUri(sessionUri),
      changeKind: "uncommitted" /* Uncommitted */
    },
    {
      label: sessionChangesetLabel(),
      description: sessionChangesetDescription(),
      uriTemplate: buildSessionChangesetUri(sessionUri),
      changeKind: "session" /* Session */
    },
    {
      label: thisTurnChangesetLabel(),
      description: thisTurnChangesetDescription(),
      uriTemplate: buildTurnChangesetUriTemplate(sessionUri),
      changeKind: "turn" /* Turn */
    },
    {
      label: compareTurnsChangesetLabel(),
      description: compareTurnsChangesetDescription(),
      uriTemplate: buildCompareTurnsChangesetUriTemplate(sessionUri),
      changeKind: "compare-turns" /* Compare */
    }
  ];
}
export {
  ChangesetKind,
  branchChangesetLabel,
  buildBranchChangesetUri,
  buildChangesetUri,
  buildCompareTurnsChangesetUri,
  buildCompareTurnsChangesetUriTemplate,
  buildDefaultChangesetCatalog,
  buildSessionChangesetUri,
  buildTurnChangesetUri,
  buildTurnChangesetUriTemplate,
  buildUncommittedChangesetUri,
  compareTurnsChangesetDescription,
  compareTurnsChangesetLabel,
  formatBranchChangesetDescription,
  isChangesetUri,
  isSessionChangesetUri,
  isUncommittedChangesetUri,
  parseChangesetUri,
  parseCompareTurnsChangesetUri,
  parseTurnChangesetUri,
  sessionChangesetDescription,
  sessionChangesetLabel,
  thisTurnChangesetDescription,
  thisTurnChangesetLabel,
  uncommittedChangesetDescription,
  uncommittedChangesetLabel
};
