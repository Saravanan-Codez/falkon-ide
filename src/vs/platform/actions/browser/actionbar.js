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
import { ActionBar } from "../../../base/browser/ui/actionbar/actionbar.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
let WorkbenchActionBar = class extends ActionBar {
  constructor(container, options, telemetryService) {
    super(container, options);
    const telemetrySource = options.telemetrySource;
    if (telemetrySource) {
      this._store.add(this.onDidRun(
        (e) => telemetryService.publicLog2(
          "workbenchActionExecuted",
          { id: e.action.id, from: telemetrySource }
        )
      ));
    }
  }
};
WorkbenchActionBar = __decorateClass([
  __decorateParam(2, ITelemetryService)
], WorkbenchActionBar);
export {
  WorkbenchActionBar
};
