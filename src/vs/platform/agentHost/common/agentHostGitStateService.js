import { createDecorator } from "../../instantiation/common/instantiation.js";
const META_GIT_STATE = "agentHost.git";
const META_GITHUB_STATE = "agentHost.github";
const GIT_DB_METADATA_KEYS = {
  [META_GIT_STATE]: true,
  [META_GITHUB_STATE]: true
};
const IAgentHostGitStateService = createDecorator("agentHostGitStateService");
export {
  GIT_DB_METADATA_KEYS,
  IAgentHostGitStateService,
  META_GITHUB_STATE,
  META_GIT_STATE
};
