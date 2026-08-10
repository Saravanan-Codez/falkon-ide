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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IQuickDiffService } from "../../contrib/scm/common/quickDiff.js";
import { IQuickDiffModelService } from "../../contrib/scm/browser/quickDiffModel.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadQuickDiff = class {
  constructor(extHostContext, quickDiffService, quickDiffModelService) {
    this.quickDiffService = quickDiffService;
    this.quickDiffModelService = quickDiffModelService;
    this.providerDisposables = new DisposableMap();
    this.informationDisposables = new DisposableMap();
    this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostQuickDiff);
  }
  async $registerQuickDiffProvider(handle, selector, id, label, rootUri) {
    const provider = {
      id,
      label,
      rootUri: URI.revive(rootUri),
      selector,
      kind: "contributed",
      getOriginalResource: async (uri) => {
        return URI.revive(await this.proxy.$provideOriginalResource(handle, uri, CancellationToken.None));
      }
    };
    const disposable = this.quickDiffService.addQuickDiffProvider(provider);
    this.providerDisposables.set(handle, disposable);
  }
  async $unregisterQuickDiffProvider(handle) {
    if (this.providerDisposables.has(handle)) {
      this.providerDisposables.deleteAndDispose(handle);
    }
  }
  async $createSourceControlDiffInformation(handle, uri) {
    const reference = this.quickDiffModelService.createQuickDiffModelReference(URI.revive(uri));
    if (!reference) {
      return;
    }
    const store = new DisposableStore();
    store.add(reference);
    store.add(reference.object.onDidChange(() => this.sendSourceControlDiffInformation(handle, reference)));
    this.informationDisposables.set(handle, store);
    this.sendSourceControlDiffInformation(handle, reference);
  }
  async $disposeSourceControlDiffInformation(handle) {
    if (this.informationDisposables.has(handle)) {
      this.informationDisposables.deleteAndDispose(handle);
    }
  }
  sendSourceControlDiffInformation(handle, reference) {
    const model = reference.object;
    const primaryResult = model.getQuickDiffResults().find((result) => result.providerKind === "primary");
    if (!primaryResult) {
      this.proxy.$acceptSourceControlDiffInformation(handle, void 0);
      return;
    }
    const changes = primaryResult.changes2.map((change) => [
      change.original.startLineNumber,
      change.original.endLineNumberExclusive,
      change.modified.startLineNumber,
      change.modified.endLineNumberExclusive
    ]);
    const diffInformation = {
      documentVersion: model.changesVersionId,
      original: primaryResult.original,
      modified: primaryResult.modified,
      changes
    };
    this.proxy.$acceptSourceControlDiffInformation(handle, diffInformation);
  }
  dispose() {
    this.providerDisposables.dispose();
    this.informationDisposables.dispose();
  }
};
MainThreadQuickDiff = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadQuickDiff),
  __decorateParam(1, IQuickDiffService),
  __decorateParam(2, IQuickDiffModelService)
], MainThreadQuickDiff);
export {
  MainThreadQuickDiff
};
