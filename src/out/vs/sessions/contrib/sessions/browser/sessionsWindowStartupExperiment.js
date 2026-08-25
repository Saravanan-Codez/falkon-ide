var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { IWorkbenchAssignmentService } from "../../../../workbench/services/assignment/common/assignmentService.js";
const AGENTS_WINDOW_STARTUP_AA_EXPERIMENT = "agentsWindowStartupAA";
let SessionsWindowStartupExperiment = class {
  static {
    this.ID = "sessions.windowStartupExperiment";
  }
  constructor(assignmentService) {
    void assignmentService.getTreatment(AGENTS_WINDOW_STARTUP_AA_EXPERIMENT);
  }
};
SessionsWindowStartupExperiment = __decorateClass([
  __decorateParam(0, IWorkbenchAssignmentService)
], SessionsWindowStartupExperiment);
export {
  AGENTS_WINDOW_STARTUP_AA_EXPERIMENT,
  SessionsWindowStartupExperiment
};
