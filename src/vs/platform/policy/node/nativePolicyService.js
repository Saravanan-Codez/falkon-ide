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
import { AbstractPolicyService } from "../common/policy.js";
import { Throttler } from "../../../base/common/async.js";
import { MutableDisposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
let NativePolicyService = class extends AbstractPolicyService {
  constructor(logService, productName) {
    super();
    this.logService = logService;
    this.productName = productName;
    this.throttler = this._register(new Throttler());
    this.watcher = this._register(new MutableDisposable());
  }
  async _updatePolicyDefinitions(policyDefinitions) {
    this.logService.trace(`NativePolicyService#_updatePolicyDefinitions - Found ${Object.keys(policyDefinitions).length} policy definitions`);
    const { createWatcher } = await import("@vscode/policy-watcher");
    await this.throttler.queue(() => new Promise((c, e) => {
      try {
        this.logService.trace(`Creating watcher for productName ${this.productName}`);
        this.watcher.value = createWatcher(this.productName, policyDefinitions, (update) => {
          this._onDidPolicyChange(update);
          c();
        });
      } catch (err) {
        this.logService.error(`NativePolicyService#_updatePolicyDefinitions - Error creating watcher:`, err);
        e(err);
      }
    }));
  }
  _onDidPolicyChange(update) {
    this.logService.trace(`NativePolicyService#_onDidPolicyChange - Updated policy values: ${JSON.stringify(update)}`);
    for (const key in update) {
      const value = update[key];
      if (value === void 0) {
        this.policies.delete(key);
      } else {
        this.policies.set(key, value);
      }
    }
    this._onDidChange.fire(Object.keys(update));
  }
};
NativePolicyService = __decorateClass([
  __decorateParam(0, ILogService)
], NativePolicyService);
export {
  NativePolicyService
};
