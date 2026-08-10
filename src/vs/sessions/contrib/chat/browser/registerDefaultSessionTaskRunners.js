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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ISessionTaskRunnerRegistry } from "./sessionTaskRunner.js";
import { WorkbenchSessionTaskRunner } from "./workbenchSessionTaskRunner.js";
let RegisterDefaultSessionTaskRunnersContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.registerDefaultTaskRunners";
  }
  constructor(instantiationService, registry) {
    super();
    const runner = instantiationService.createInstance(WorkbenchSessionTaskRunner);
    this._register(registry.register(runner));
  }
};
RegisterDefaultSessionTaskRunnersContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ISessionTaskRunnerRegistry)
], RegisterDefaultSessionTaskRunnersContribution);
export {
  RegisterDefaultSessionTaskRunnersContribution
};
