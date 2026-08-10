import { createDecorator } from "../../instantiation/common/instantiation.js";
const IAgentHostCheckpointService = createDecorator("agentHostCheckpointService");
function buildCheckpointRefName(sanitizedSessionId, turnNumber) {
  return `refs/agents/${sanitizedSessionId}/checkpoints/turn/${turnNumber}`;
}
const NULL_CHECKPOINT_SERVICE = {
  _serviceBrand: void 0,
  captureBaselineCheckpoint: async () => {
  },
  captureTurnCheckpoint: async () => {
  },
  getTurnCheckpointPair: async () => void 0,
  getBaselineCheckpoint: async () => void 0,
  deleteCheckpoints: async () => {
  }
};
export {
  IAgentHostCheckpointService,
  NULL_CHECKPOINT_SERVICE,
  buildCheckpointRefName
};
