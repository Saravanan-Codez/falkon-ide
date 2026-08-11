import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var CellExecutionUpdateType = /* @__PURE__ */ ((CellExecutionUpdateType2) => {
  CellExecutionUpdateType2[CellExecutionUpdateType2["Output"] = 1] = "Output";
  CellExecutionUpdateType2[CellExecutionUpdateType2["OutputItems"] = 2] = "OutputItems";
  CellExecutionUpdateType2[CellExecutionUpdateType2["ExecutionState"] = 3] = "ExecutionState";
  return CellExecutionUpdateType2;
})(CellExecutionUpdateType || {});
const INotebookExecutionService = createDecorator("INotebookExecutionService");
export {
  CellExecutionUpdateType,
  INotebookExecutionService
};
