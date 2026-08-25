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
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValueOpts } from "../../../../base/common/observable.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { AutoOpenBarrier } from "../../../../base/common/async.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let GitService = class extends Disposable {
  constructor(logService) {
    super();
    this.logService = logService;
    this._delegateBarrier = new AutoOpenBarrier(1e4);
  }
  get repositories() {
    return this._delegate?.repositories ?? [];
  }
  setDelegate(delegate) {
    if (this._delegate) {
      this.logService.error("[GitService][setDelegate] GitExtension delegate is already set.");
      throw new BugIndicatingError("GitExtension delegate is already set.");
    }
    this._delegate = delegate;
    this._delegateBarrier.open();
    return toDisposable(() => {
      this._delegate = void 0;
    });
  }
  async openRepository(uri) {
    await this._delegateBarrier.wait();
    if (!this._delegate) {
      this.logService.warn("[GitService][openRepository] GitExtension delegate is not set after 10 seconds. Cannot open repository.");
      return void 0;
    }
    return this._delegate.openRepository(uri);
  }
};
GitService = __decorateClass([
  __decorateParam(0, ILogService)
], GitService);
class GitRepository extends Disposable {
  constructor(rootUri, initialState, delegate) {
    super();
    this.delegate = delegate;
    this.rootUri = rootUri;
    this.state = observableValueOpts({ owner: this, equalsFn: structuralEquals }, initialState);
  }
  updateState(state) {
    this.state.set(state, void 0);
  }
  async getRefs(query, token) {
    return this.delegate.getRefs(this.rootUri, query, token);
  }
  async diffBetweenWithStats(ref1, ref2, path) {
    return this.delegate.diffBetweenWithStats(this.rootUri, ref1, ref2, path);
  }
  async diffBetweenWithStats2(ref, path) {
    return this.delegate.diffBetweenWithStats2(this.rootUri, ref, path);
  }
}
export {
  GitRepository,
  GitService
};
