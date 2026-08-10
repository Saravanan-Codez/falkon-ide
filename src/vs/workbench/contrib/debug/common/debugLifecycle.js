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
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IDebugService } from "./debug.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
let DebugLifecycle = class {
  constructor(lifecycleService, debugService, configurationService, dialogService) {
    this.debugService = debugService;
    this.configurationService = configurationService;
    this.dialogService = dialogService;
    this.disposable = lifecycleService.onBeforeShutdown(async (e) => e.veto(this.shouldVetoShutdown(e.reason), "veto.debug"));
  }
  shouldVetoShutdown(_reason) {
    const rootSessions = this.debugService.getModel().getSessions().filter((s) => s.parentSession === void 0);
    if (rootSessions.length === 0) {
      return false;
    }
    const shouldConfirmOnExit = this.configurationService.getValue("debug").confirmOnExit;
    if (shouldConfirmOnExit === "never") {
      return false;
    }
    return this.showWindowCloseConfirmation(rootSessions.length);
  }
  dispose() {
    return this.disposable.dispose();
  }
  async showWindowCloseConfirmation(numSessions) {
    let message;
    if (numSessions === 1) {
      message = nls.localize("debug.debugSessionCloseConfirmationSingular", "There is an active debug session, are you sure you want to stop it?");
    } else {
      message = nls.localize("debug.debugSessionCloseConfirmationPlural", "There are active debug sessions, are you sure you want to stop them?");
    }
    const res = await this.dialogService.confirm({
      message,
      type: "warning",
      primaryButton: nls.localize({ key: "debug.stop", comment: ["&& denotes a mnemonic"] }, "&&Stop Debugging")
    });
    return !res.confirmed;
  }
};
DebugLifecycle = __decorateClass([
  __decorateParam(0, ILifecycleService),
  __decorateParam(1, IDebugService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IDialogService)
], DebugLifecycle);
export {
  DebugLifecycle
};
