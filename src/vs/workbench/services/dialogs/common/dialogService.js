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
import Severity from "../../../../base/common/severity.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { DialogsModel } from "../../../common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let DialogService = class extends Disposable {
  constructor(environmentService, logService) {
    super();
    this.environmentService = environmentService;
    this.logService = logService;
    this.model = this._register(new DialogsModel());
    this.onWillShowDialog = this.model.onWillShowDialog;
    this.onDidShowDialog = this.model.onDidShowDialog;
  }
  skipDialogs() {
    if (this.environmentService.enableSmokeTestDriver) {
      this.logService.warn("DialogService: Dialog requested during smoke test.");
    }
    return this.environmentService.isExtensionDevelopment && !!this.environmentService.extensionTestsLocationURI;
  }
  async confirm(confirmation) {
    if (this.skipDialogs()) {
      this.logService.trace("DialogService: refused to show confirmation dialog in tests.");
      return { confirmed: true };
    }
    const handle = this.model.show({ confirmArgs: { confirmation } });
    return await handle.result;
  }
  async prompt(prompt) {
    if (this.skipDialogs()) {
      throw new Error(`DialogService: refused to show dialog in tests. Contents: ${prompt.message}`);
    }
    const handle = this.model.show({ promptArgs: { prompt } });
    const dialogResult = await handle.result;
    return {
      result: await dialogResult.result,
      checkboxChecked: dialogResult.checkboxChecked
    };
  }
  async input(input) {
    if (this.skipDialogs()) {
      throw new Error("DialogService: refused to show input dialog in tests.");
    }
    const handle = this.model.show({ inputArgs: { input } });
    return await handle.result;
  }
  async info(message, detail) {
    await this.prompt({ type: Severity.Info, message, detail });
  }
  async warn(message, detail) {
    await this.prompt({ type: Severity.Warning, message, detail });
  }
  async error(message, detail) {
    await this.prompt({ type: Severity.Error, message, detail });
  }
  async about() {
    if (this.skipDialogs()) {
      throw new Error("DialogService: refused to show about dialog in tests.");
    }
    const handle = this.model.show({});
    await handle.result;
  }
};
DialogService = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, ILogService)
], DialogService);
registerSingleton(IDialogService, DialogService, InstantiationType.Delayed);
export {
  DialogService
};
