import { Emitter } from "../../../base/common/event.js";
import { URI } from "../../../base/common/uri.js";
import { MainContext } from "./extHost.protocol.js";
import { asPromise } from "../../../base/common/async.js";
import { DocumentSelector } from "./extHostTypeConverters.js";
import { TextEditorChangeKind } from "./extHostTypes.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
class ExtHostSourceControlDiffInformation {
  constructor(handle, proxy, documents, onDispose) {
    this.handle = handle;
    this.proxy = proxy;
    this.documents = documents;
    this.onDispose = onDispose;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  get diffInformation() {
    return this._diffInformation;
  }
  $acceptDiffInformation(diffInformation) {
    if (!diffInformation) {
      this._diffInformation = void 0;
      this._onDidChange.fire();
      return;
    }
    const documents = this.documents;
    const original = URI.revive(diffInformation.original);
    const modified = URI.revive(diffInformation.modified);
    const changes = diffInformation.changes.map((change) => {
      const [originalStartLineNumber, originalEndLineNumberExclusive, modifiedStartLineNumber, modifiedEndLineNumberExclusive] = change;
      let kind;
      if (originalStartLineNumber === originalEndLineNumberExclusive) {
        kind = TextEditorChangeKind.Addition;
      } else if (modifiedStartLineNumber === modifiedEndLineNumberExclusive) {
        kind = TextEditorChangeKind.Deletion;
      } else {
        kind = TextEditorChangeKind.Modification;
      }
      return {
        original: { startLineNumber: originalStartLineNumber, endLineNumberExclusive: originalEndLineNumberExclusive },
        modified: { startLineNumber: modifiedStartLineNumber, endLineNumberExclusive: modifiedEndLineNumberExclusive },
        kind
      };
    });
    this._diffInformation = Object.freeze({
      documentVersion: diffInformation.documentVersion,
      original,
      modified,
      changes,
      get isStale() {
        const document = documents.getDocumentData(modified);
        return document?.document.version !== diffInformation.documentVersion;
      }
    });
    this._onDidChange.fire();
  }
  dispose() {
    this.proxy.$disposeSourceControlDiffInformation(this.handle);
    this._onDidChange.dispose();
    this.onDispose(this.handle);
  }
}
class ExtHostQuickDiff {
  constructor(mainContext, documents, uriTransformer) {
    this.documents = documents;
    this.uriTransformer = uriTransformer;
    this.providers = /* @__PURE__ */ new Map();
    this.informations = /* @__PURE__ */ new Map();
    this.proxy = mainContext.getProxy(MainContext.MainThreadQuickDiff);
  }
  static {
    this.handlePool = 0;
  }
  $provideOriginalResource(handle, uriComponents, token) {
    const uri = URI.revive(uriComponents);
    const provider = this.providers.get(handle);
    if (!provider) {
      return Promise.resolve(null);
    }
    return asPromise(() => provider.provideOriginalResource(uri, token)).then((r) => r || null);
  }
  $acceptSourceControlDiffInformation(handle, diffInformation) {
    this.informations.get(handle)?.$acceptDiffInformation(diffInformation);
  }
  registerQuickDiffProvider(extension, selector, quickDiffProvider, id, label, rootUri) {
    const handle = ExtHostQuickDiff.handlePool++;
    this.providers.set(handle, quickDiffProvider);
    const extensionId = ExtensionIdentifier.toKey(extension.identifier);
    this.proxy.$registerQuickDiffProvider(handle, DocumentSelector.from(selector, this.uriTransformer), `${extensionId}.${id}`, label, rootUri);
    return {
      dispose: () => {
        this.proxy.$unregisterQuickDiffProvider(handle);
        this.providers.delete(handle);
      }
    };
  }
  createSourceControlDiffInformation(uri) {
    const handle = ExtHostQuickDiff.handlePool++;
    const information = new ExtHostSourceControlDiffInformation(handle, this.proxy, this.documents, (h) => this.informations.delete(h));
    this.informations.set(handle, information);
    this.proxy.$createSourceControlDiffInformation(handle, uri);
    return information;
  }
}
export {
  ExtHostQuickDiff
};
