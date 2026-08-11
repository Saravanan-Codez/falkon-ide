import { createDecorator } from "../../instantiation/common/instantiation.js";
const META_CHANGESET_BRANCH = "agentHost.changeset.branch";
const META_CHANGESET_SESSION = "agentHost.changeset.session";
const META_LEGACY_DIFFS = "diffs";
const META_CHANGES_SUMMARY = "agentHost.changes";
const CHANGESET_DB_METADATA_KEYS = {
  [META_CHANGESET_BRANCH]: true,
  [META_CHANGESET_SESSION]: true,
  [META_CHANGES_SUMMARY]: true,
  [META_LEGACY_DIFFS]: true
};
const IAgentHostChangesetService = createDecorator("agentHostChangesetService");
export {
  CHANGESET_DB_METADATA_KEYS,
  IAgentHostChangesetService,
  META_CHANGESET_BRANCH,
  META_CHANGESET_SESSION,
  META_CHANGES_SUMMARY,
  META_LEGACY_DIFFS
};
