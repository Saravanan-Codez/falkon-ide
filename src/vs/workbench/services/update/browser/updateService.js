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
import { Emitter } from "../../../../base/common/event.js";
import { IUpdateService, State, UpdateType } from "../../../../platform/update/common/update.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { IHostService } from "../../host/browser/host.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
let BrowserUpdateService = class extends Disposable {
  constructor(environmentService, hostService) {
    super();
    this.environmentService = environmentService;
    this.hostService = hostService;
    this._onStateChange = this._register(new Emitter());
    this.onStateChange = this._onStateChange.event;
    this._state = State.Uninitialized;
    this.checkForUpdates(false);
  }
  get state() {
    return this._state;
  }
  set state(state) {
    this._state = state;
    this._onStateChange.fire(state);
  }
  async isLatestVersion() {
    const update = await this.doCheckForUpdates(false);
    if (update === void 0) {
      return void 0;
    }
    return !!update;
  }
  async checkForUpdates(explicit) {
    await this.doCheckForUpdates(explicit);
  }
  async doCheckForUpdates(explicit) {
    if (this.environmentService.options && this.environmentService.options.updateProvider) {
      const updateProvider = this.environmentService.options.updateProvider;
      this.state = State.CheckingForUpdates(explicit);
      const update = await updateProvider.checkForUpdate();
      if (update) {
        this.state = State.Ready({ version: update.version, productVersion: update.version }, explicit, false);
      } else {
        this.state = State.Idle(UpdateType.Archive);
      }
      return update;
    }
    return void 0;
  }
  async downloadUpdate(_explicit) {
  }
  async applyUpdate() {
    this.hostService.reload();
  }
  async quitAndInstall() {
    this.hostService.reload();
  }
  async _applySpecificUpdate(packagePath) {
  }
  async setInternalOrg(_internalOrg) {
  }
};
BrowserUpdateService = __decorateClass([
  __decorateParam(0, IBrowserWorkbenchEnvironmentService),
  __decorateParam(1, IHostService)
], BrowserUpdateService);
registerSingleton(IUpdateService, BrowserUpdateService, InstantiationType.Eager);
export {
  BrowserUpdateService
};
