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
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { BrowserDialogHandler } from "../../../browser/parts/dialogs/dialogHandler.js";
import { NativeDialogHandler } from "./dialogHandler.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { createNativeAboutDialogDetails } from "../../../../platform/dialogs/electron-browser/dialog.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
let DialogHandlerContribution = class extends Disposable {
  constructor(configurationService, dialogService, logService, instantiationService, productService, clipboardService, nativeHostService, environmentService) {
    super();
    this.configurationService = configurationService;
    this.dialogService = dialogService;
    this.productService = productService;
    this.nativeHostService = nativeHostService;
    this.environmentService = environmentService;
    this.browserImpl = new Lazy(() => instantiationService.createInstance(BrowserDialogHandler));
    this.nativeImpl = new Lazy(() => new NativeDialogHandler(logService, nativeHostService, clipboardService));
    this.model = this.dialogService.model;
    this._register(this.model.onWillShowDialog(() => {
      if (!this.currentDialog) {
        this.processDialogs();
      }
    }));
    this.processDialogs();
  }
  static {
    this.ID = "workbench.contrib.dialogHandler";
  }
  async processDialogs() {
    while (this.model.dialogs.length) {
      this.currentDialog = this.model.dialogs[0];
      let result = void 0;
      try {
        if (this.currentDialog.args.confirmArgs) {
          const args = this.currentDialog.args.confirmArgs;
          result = this.useCustomDialog || args?.confirmation.custom ? await this.browserImpl.value.confirm(args.confirmation) : await this.nativeImpl.value.confirm(args.confirmation);
        } else if (this.currentDialog.args.inputArgs) {
          const args = this.currentDialog.args.inputArgs;
          result = await this.browserImpl.value.input(args.input);
        } else if (this.currentDialog.args.promptArgs) {
          const args = this.currentDialog.args.promptArgs;
          result = this.useCustomDialog || args?.prompt.custom ? await this.browserImpl.value.prompt(args.prompt) : await this.nativeImpl.value.prompt(args.prompt);
        } else {
          const aboutDialogDetails = createNativeAboutDialogDetails(this.productService, await this.nativeHostService.getOSProperties());
          if (this.useCustomDialog) {
            await this.browserImpl.value.about(aboutDialogDetails.title, aboutDialogDetails.details, aboutDialogDetails.detailsToCopy);
          } else {
            await this.nativeImpl.value.about(aboutDialogDetails.title, aboutDialogDetails.details, aboutDialogDetails.detailsToCopy);
          }
        }
      } catch (error) {
        result = error;
      }
      this.currentDialog.close(result);
      this.currentDialog = void 0;
    }
  }
  get useCustomDialog() {
    return this.configurationService.getValue("window.dialogStyle") === "custom" || // Use the custom dialog while driven so that the driver can interact with it
    !!this.environmentService.enableSmokeTestDriver;
  }
};
DialogHandlerContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IClipboardService),
  __decorateParam(6, INativeHostService),
  __decorateParam(7, IWorkbenchEnvironmentService)
], DialogHandlerContribution);
registerWorkbenchContribution2(
  DialogHandlerContribution.ID,
  DialogHandlerContribution,
  WorkbenchPhase.BlockStartup
  // Block to allow for dialogs to show before restore finished
);
export {
  DialogHandlerContribution
};
