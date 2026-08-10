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
import { ITerminalInstanceService } from "./terminal.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { TerminalExtensions } from "../../../../platform/terminal/common/terminal.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { TerminalInstance } from "./terminalInstance.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Emitter } from "../../../../base/common/event.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { promiseWithResolvers } from "../../../../base/common/async.js";
import { hasKey } from "../../../../base/common/types.js";
let TerminalInstanceService = class extends Disposable {
  constructor(_instantiationService, _contextKeyService, environmentService) {
    super();
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._backendRegistration = /* @__PURE__ */ new Map();
    this._onDidCreateInstance = this._register(new Emitter());
    this._onDidRegisterBackend = this._register(new Emitter());
    this._terminalShellTypeContextKey = TerminalContextKeys.shellType.bindTo(this._contextKeyService);
    for (const remoteAuthority of [void 0, environmentService.remoteAuthority]) {
      const { promise, resolve } = promiseWithResolvers();
      this._backendRegistration.set(remoteAuthority, { promise, resolve });
    }
  }
  get onDidCreateInstance() {
    return this._onDidCreateInstance.event;
  }
  get onDidRegisterBackend() {
    return this._onDidRegisterBackend.event;
  }
  createInstance(config, target) {
    const shellLaunchConfig = this.convertProfileToShellLaunchConfig(config);
    const instance = this._instantiationService.createInstance(TerminalInstance, this._terminalShellTypeContextKey, shellLaunchConfig);
    instance.target = target;
    this._onDidCreateInstance.fire(instance);
    return instance;
  }
  convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile, cwd) {
    if (shellLaunchConfigOrProfile && hasKey(shellLaunchConfigOrProfile, { profileName: true })) {
      const profile = shellLaunchConfigOrProfile;
      if (!profile.path) {
        return shellLaunchConfigOrProfile;
      }
      return {
        executable: profile.path,
        args: profile.args,
        env: profile.env,
        icon: profile.icon,
        color: profile.color,
        name: profile.overrideName ? profile.profileName : void 0,
        cwd
      };
    }
    if (shellLaunchConfigOrProfile) {
      if (cwd) {
        shellLaunchConfigOrProfile.cwd = cwd;
      }
      return shellLaunchConfigOrProfile;
    }
    return {};
  }
  async getBackend(remoteAuthority) {
    let backend = Registry.as(TerminalExtensions.Backend).getTerminalBackend(remoteAuthority);
    if (!backend) {
      await this._backendRegistration.get(remoteAuthority)?.promise;
      backend = Registry.as(TerminalExtensions.Backend).getTerminalBackend(remoteAuthority);
    }
    return backend;
  }
  getRegisteredBackends() {
    return Registry.as(TerminalExtensions.Backend).backends.values();
  }
  didRegisterBackend(backend) {
    this._backendRegistration.get(backend.remoteAuthority)?.resolve();
    this._onDidRegisterBackend.fire(backend);
  }
};
TerminalInstanceService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], TerminalInstanceService);
registerSingleton(ITerminalInstanceService, TerminalInstanceService, InstantiationType.Delayed);
export {
  TerminalInstanceService
};
