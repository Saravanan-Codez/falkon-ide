import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IWorkingCopyHistoryService = createDecorator("workingCopyHistoryService");
const MAX_PARALLEL_HISTORY_IO_OPS = 20;
export {
  IWorkingCopyHistoryService,
  MAX_PARALLEL_HISTORY_IO_OPS
};
