import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var NotebookExecutionType = /* @__PURE__ */ ((NotebookExecutionType2) => {
  NotebookExecutionType2[NotebookExecutionType2["cell"] = 0] = "cell";
  NotebookExecutionType2[NotebookExecutionType2["notebook"] = 1] = "notebook";
  return NotebookExecutionType2;
})(NotebookExecutionType || {});
const INotebookExecutionStateService = createDecorator("INotebookExecutionStateService");
export {
  INotebookExecutionStateService,
  NotebookExecutionType
};
