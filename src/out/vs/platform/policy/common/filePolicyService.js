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
import { ThrottledDelayer } from "../../../base/common/async.js";
import { Event } from "../../../base/common/event.js";
import { Iterable } from "../../../base/common/iterator.js";
import { isObject } from "../../../base/common/types.js";
import { FileOperationResult, IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { AbstractPolicyService } from "./policy.js";
function keysDiff(a, b) {
  const result = [];
  for (const key of new Set(Iterable.concat(a.keys(), b.keys()))) {
    if (a.get(key) !== b.get(key)) {
      result.push(key);
    }
  }
  return result;
}
let FilePolicyService = class extends AbstractPolicyService {
  constructor(file, fileService, logService) {
    super();
    this.file = file;
    this.fileService = fileService;
    this.logService = logService;
    this.throttledDelayer = this._register(new ThrottledDelayer(500));
    const onDidChangePolicyFile = Event.filter(fileService.onDidFilesChange, (e) => e.affects(file));
    this._register(fileService.watch(file));
    this._register(onDidChangePolicyFile(() => this.throttledDelayer.trigger(() => this.refresh())));
  }
  async _updatePolicyDefinitions() {
    await this.refresh();
  }
  async read() {
    const policies = /* @__PURE__ */ new Map();
    try {
      const content = await this.fileService.readFile(this.file);
      const raw = JSON.parse(content.value.toString());
      if (!isObject(raw)) {
        throw new Error("Policy file isn't a JSON object");
      }
      for (const key of Object.keys(raw)) {
        if (this.policyDefinitions[key]) {
          policies.set(key, raw[key]);
        }
      }
    } catch (error) {
      if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(`[FilePolicyService] Failed to read policies`, error);
      }
    }
    return policies;
  }
  async refresh() {
    const policies = await this.read();
    const diff = keysDiff(this.policies, policies);
    this.policies = policies;
    if (diff.length > 0) {
      this._onDidChange.fire(diff);
    }
  }
};
FilePolicyService = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], FilePolicyService);
export {
  FilePolicyService
};
