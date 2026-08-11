import { createDecorator } from "../../instantiation/common/instantiation.js";
const IAgentHostReviewService = createDecorator("agentHostReviewService");
function buildReviewedRefName(sanitizedSessionId) {
  return `refs/agents/${sanitizedSessionId}/reviewed`;
}
const NULL_REVIEW_SERVICE = {
  _serviceBrand: void 0,
  setReviewState: async () => {
  },
  markFileReviewed: async () => {
  },
  markFileUnreviewed: async () => {
  },
  getReviewedPaths: async () => /* @__PURE__ */ new Set(),
  copyReviewedRef: async () => {
  }
};
export {
  IAgentHostReviewService,
  NULL_REVIEW_SERVICE,
  buildReviewedRefName
};
