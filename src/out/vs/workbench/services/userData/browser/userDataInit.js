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
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Extensions } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { mark } from "../../../../base/common/performance.js";
const IUserDataInitializationService = createDecorator("IUserDataInitializationService");
class UserDataInitializationService {
  constructor(initializers = []) {
    this.initializers = initializers;
  }
  async whenInitializationFinished() {
    if (await this.requiresInitialization()) {
      await Promise.all(this.initializers.map((initializer) => initializer.whenInitializationFinished()));
    }
  }
  async requiresInitialization() {
    return (await Promise.all(this.initializers.map((initializer) => initializer.requiresInitialization()))).some((result) => result);
  }
  async initializeRequiredResources() {
    if (await this.requiresInitialization()) {
      await Promise.all(this.initializers.map((initializer) => initializer.initializeRequiredResources()));
    }
  }
  async initializeOtherResources(instantiationService) {
    if (await this.requiresInitialization()) {
      await Promise.all(this.initializers.map((initializer) => initializer.initializeOtherResources(instantiationService)));
    }
  }
  async initializeInstalledExtensions(instantiationService) {
    if (await this.requiresInitialization()) {
      await Promise.all(this.initializers.map((initializer) => initializer.initializeInstalledExtensions(instantiationService)));
    }
  }
}
let InitializeOtherResourcesContribution = class {
  constructor(userDataInitializeService, instantiationService, extensionService) {
    extensionService.whenInstalledExtensionsRegistered().then(() => this.initializeOtherResource(userDataInitializeService, instantiationService));
  }
  async initializeOtherResource(userDataInitializeService, instantiationService) {
    if (await userDataInitializeService.requiresInitialization()) {
      mark("code/willInitOtherUserData");
      await userDataInitializeService.initializeOtherResources(instantiationService);
      mark("code/didInitOtherUserData");
    }
  }
};
InitializeOtherResourcesContribution = __decorateClass([
  __decorateParam(0, IUserDataInitializationService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IExtensionService)
], InitializeOtherResourcesContribution);
if (isWeb) {
  const workbenchRegistry = Registry.as(Extensions.Workbench);
  workbenchRegistry.registerWorkbenchContribution(InitializeOtherResourcesContribution, LifecyclePhase.Restored);
}
export {
  IUserDataInitializationService,
  UserDataInitializationService
};
