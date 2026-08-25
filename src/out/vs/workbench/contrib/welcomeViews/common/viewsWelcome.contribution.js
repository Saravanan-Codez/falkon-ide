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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { ViewsWelcomeContribution } from "./viewsWelcomeContribution.js";
import { viewsWelcomeExtensionPointDescriptor } from "./viewsWelcomeExtensionPoint.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
const extensionPoint = ExtensionsRegistry.registerExtensionPoint(viewsWelcomeExtensionPointDescriptor);
let WorkbenchConfigurationContribution = class {
  constructor(instantiationService) {
    instantiationService.createInstance(ViewsWelcomeContribution, extensionPoint);
  }
};
WorkbenchConfigurationContribution = __decorateClass([
  __decorateParam(0, IInstantiationService)
], WorkbenchConfigurationContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkbenchConfigurationContribution, LifecyclePhase.Restored);
