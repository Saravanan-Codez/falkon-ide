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
import { generateUuid } from "../../../../base/common/uuid.js";
import { ILocalGitService } from "../../../../platform/git/common/localGitService.js";
let NativePluginGitCommandService = class {
  constructor(_localGitService) {
    this._localGitService = _localGitService;
  }
  _withCancel(token, fn) {
    const operationId = generateUuid();
    const listener = token?.onCancellationRequested(() => {
      this._localGitService.cancel(operationId).catch(() => {
      });
    });
    return fn(operationId).finally(() => listener?.dispose());
  }
  async cloneRepository(cloneUrl, targetDir, ref, token) {
    await this._withCancel(token, (id) => this._localGitService.clone(id, cloneUrl, targetDir.fsPath, ref));
  }
  async pull(repoDir, token) {
    return this._withCancel(token, (id) => this._localGitService.pull(id, repoDir.fsPath, { allowHardResetOnDivergence: true }));
  }
  async checkout(repoDir, treeish, detached, token) {
    await this._withCancel(token, (id) => this._localGitService.checkout(id, repoDir.fsPath, treeish, detached));
  }
  async revParse(repoDir, ref) {
    return this._localGitService.revParse(repoDir.fsPath, ref);
  }
  async fetch(repoDir, token) {
    await this._withCancel(token, (id) => this._localGitService.fetch(id, repoDir.fsPath));
  }
  async fetchRepository(repoDir, token) {
    await this._withCancel(token, (id) => this._localGitService.fetch(id, repoDir.fsPath));
  }
  async revListCount(repoDir, fromRef, toRef) {
    return this._localGitService.revListCount(repoDir.fsPath, fromRef, toRef);
  }
};
NativePluginGitCommandService = __decorateClass([
  __decorateParam(0, ILocalGitService)
], NativePluginGitCommandService);
export {
  NativePluginGitCommandService
};
