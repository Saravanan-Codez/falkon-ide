import { createDecorator } from "../../instantiation/common/instantiation.js";
const IDiffComputeService = createDecorator("diffComputeService");
const DEFAULT_DIFF_TIMEOUT_MS = 5e3;
export {
  DEFAULT_DIFF_TIMEOUT_MS,
  IDiffComputeService
};
