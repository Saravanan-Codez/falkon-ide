import { BaseLayoutController } from "./baseSessionLayoutController.js";
class MobileLayoutController extends BaseLayoutController {
  static {
    this.ID = "workbench.contrib.sessionsMobileLayoutController";
  }
  // [M2] Intentionally does not override `_registerViewStateManagement`, so the
  // auxiliary bar is never auto-shown / hidden / captured on phone viewports.
}
export {
  MobileLayoutController
};
