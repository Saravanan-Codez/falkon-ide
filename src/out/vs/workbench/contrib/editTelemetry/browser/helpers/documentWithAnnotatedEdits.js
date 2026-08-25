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
import { AsyncReader, AsyncReaderEndOfStream } from "../../../../../base/common/async.js";
import { CachedFunction } from "../../../../../base/common/cache.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { observableValue, runOnChange } from "../../../../../base/common/observable.js";
import { AnnotatedStringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { iterateObservableChanges, mapObservableDelta } from "./utils.js";
class DocumentWithSourceAnnotatedEdits extends Disposable {
  constructor(_originalDoc) {
    super();
    this._originalDoc = _originalDoc;
    const v = this.value = observableValue(this, _originalDoc.value.get());
    this._register(runOnChange(this._originalDoc.value, (val, _prevVal, edits) => {
      const eComposed = AnnotatedStringEdit.compose(edits.map((e) => {
        const editSourceData = new EditSourceData(e.reason);
        return e.mapData(() => editSourceData);
      }));
      v.set(val, void 0, { edit: eComposed });
    }));
  }
  waitForQueue() {
    return Promise.resolve();
  }
}
class EditSourceData {
  constructor(editSource) {
    this.editSource = editSource;
    this.key = this.editSource.toKey(1);
    this.source = EditSourceBase.create(this.editSource);
  }
  join(data) {
    if (this.editSource !== data.editSource) {
      return void 0;
    }
    return this;
  }
  toEditSourceData() {
    return new EditKeySourceData(this.key, this.source, this.editSource);
  }
}
class EditKeySourceData {
  constructor(key, source, representative) {
    this.key = key;
    this.source = source;
    this.representative = representative;
  }
  join(data) {
    if (this.key !== data.key) {
      return void 0;
    }
    if (this.source !== data.source) {
      return void 0;
    }
    return this;
  }
}
class EditSourceBase {
  static {
    this._cache = new CachedFunction({ getCacheKey: (v) => v.toString() }, (arg) => arg);
  }
  static create(reason) {
    const data = reason.metadata;
    switch (data.source) {
      case "reloadFromDisk":
        return this._cache.get(new ExternalEditSource());
      case "inlineCompletionPartialAccept":
      case "inlineCompletionAccept": {
        const type = "type" in data ? data.type : void 0;
        if ("$nes" in data && data.$nes) {
          return this._cache.get(new InlineSuggestEditSource("nes", data.$extensionId ?? "", data.$providerId ?? "", type));
        }
        return this._cache.get(new InlineSuggestEditSource("completion", data.$extensionId ?? "", data.$providerId ?? "", type));
      }
      case "snippet":
        return this._cache.get(new IdeEditSource("suggest"));
      case "unknown":
        if (!data.name) {
          return this._cache.get(new UnknownEditSource());
        }
        switch (data.name) {
          case "formatEditsCommand":
            return this._cache.get(new IdeEditSource("format"));
        }
        return this._cache.get(new UnknownEditSource());
      case "Chat.applyEdits":
        return "$origin" in data && data.$origin === "agentHost" ? this._cache.get(new AgentHostEditSource()) : this._cache.get(new ChatEditSource("sidebar"));
      case "inlineChat.applyEdits":
        return this._cache.get(new ChatEditSource("inline"));
      case "cursor":
        return this._cache.get(new UserEditSource());
      default:
        return this._cache.get(new UnknownEditSource());
    }
  }
}
class InlineSuggestEditSource extends EditSourceBase {
  constructor(kind, extensionId, providerId, type) {
    super();
    this.kind = kind;
    this.extensionId = extensionId;
    this.providerId = providerId;
    this.type = type;
    this.category = "ai";
    this.feature = "inlineSuggest";
  }
  toString() {
    return `${this.category}/${this.feature}/${this.kind}/${this.extensionId}/${this.providerId}/${this.type}`;
  }
  getColor() {
    return "#00ff0033";
  }
}
class ChatEditSource extends EditSourceBase {
  constructor(kind) {
    super();
    this.kind = kind;
    this.category = "ai";
    this.feature = "chat";
  }
  toString() {
    return `${this.category}/${this.feature}/${this.kind}`;
  }
  getColor() {
    return "#00ff0066";
  }
}
class AgentHostEditSource extends EditSourceBase {
  constructor() {
    super(...arguments);
    this.category = "agentHost";
    this.feature = "chat";
  }
  toString() {
    return `${this.category}/${this.feature}`;
  }
  getColor() {
    return "#00ff0066";
  }
}
class IdeEditSource extends EditSourceBase {
  constructor(feature) {
    super();
    this.feature = feature;
    this.category = "ide";
  }
  toString() {
    return `${this.category}/${this.feature}`;
  }
  getColor() {
    return this.feature === "format" ? "#0000ff33" : "#80808033";
  }
}
class UserEditSource extends EditSourceBase {
  constructor() {
    super();
    this.category = "user";
  }
  toString() {
    return this.category;
  }
  getColor() {
    return "#d3d3d333";
  }
}
class ExternalEditSource extends EditSourceBase {
  constructor() {
    super();
    this.category = "external";
  }
  toString() {
    return this.category;
  }
  getColor() {
    return "#009ab254";
  }
}
class UnknownEditSource extends EditSourceBase {
  constructor() {
    super();
    this.category = "unknown";
  }
  toString() {
    return this.category;
  }
  getColor() {
    return "#ff000033";
  }
}
let CombineStreamedChanges = class extends Disposable {
  constructor(_originalDoc, _instantiationService) {
    super();
    this._originalDoc = _originalDoc;
    this._instantiationService = _instantiationService;
    this._runStore = this._register(new DisposableStore());
    this._runQueue = Promise.resolve();
    this._diffService = this._instantiationService.createInstance(DiffService);
    this.value = this._value = observableValue(this, _originalDoc.value.get());
    this._restart();
  }
  async _restart() {
    this._runStore.clear();
    const iterator = iterateObservableChanges(this._originalDoc.value, this._runStore)[Symbol.asyncIterator]();
    const p = this._runQueue;
    this._runQueue = this._runQueue.then(() => this._run(iterator));
    await p;
  }
  async _run(iterator) {
    const reader = new AsyncReader(iterator);
    while (true) {
      let peeked = await reader.peek();
      if (peeked === AsyncReaderEndOfStream) {
        return;
      } else if (isChatEdit(peeked)) {
        const first = peeked;
        let last = first;
        let chatEdit = AnnotatedStringEdit.empty;
        do {
          reader.readBufferedOrThrow();
          last = peeked;
          chatEdit = chatEdit.compose(AnnotatedStringEdit.compose(peeked.change.map((c) => c.edit)));
          const peekedOrUndefined = await reader.peekTimeout(1e3);
          if (!peekedOrUndefined) {
            break;
          }
          peeked = peekedOrUndefined;
        } while (peeked !== AsyncReaderEndOfStream && isChatEdit(peeked));
        if (!chatEdit.isEmpty()) {
          const data = chatEdit.replacements[0].data;
          const diffEdit = await this._diffService.computeDiff(first.prevValue.value, last.value.value);
          const edit = diffEdit.mapData((_e) => data);
          this._value.set(last.value, void 0, { edit });
        }
      } else {
        reader.readBufferedOrThrow();
        const e = AnnotatedStringEdit.compose(peeked.change.map((c) => c.edit));
        this._value.set(peeked.value, void 0, { edit: e });
      }
    }
  }
  async waitForQueue() {
    await this._originalDoc.waitForQueue();
    await this._restart();
  }
};
CombineStreamedChanges = __decorateClass([
  __decorateParam(1, IInstantiationService)
], CombineStreamedChanges);
let DiffService = class {
  constructor(_editorWorkerService) {
    this._editorWorkerService = _editorWorkerService;
  }
  async computeDiff(original, modified) {
    const diffEdit = await this._editorWorkerService.computeStringEditFromDiff(original, modified, { maxComputationTimeMs: 500 }, "advanced");
    return diffEdit;
  }
};
DiffService = __decorateClass([
  __decorateParam(0, IEditorWorkerService)
], DiffService);
function isChatEdit(next) {
  return next.change.every((c) => c.edit.replacements.every((e) => {
    if (e.data.source.category === "ai" && e.data.source.feature === "chat") {
      return true;
    }
    return false;
  }));
}
class MinimizeEditsProcessor extends Disposable {
  constructor(_originalDoc) {
    super();
    this._originalDoc = _originalDoc;
    const v = this.value = observableValue(this, _originalDoc.value.get());
    let prevValue = this._originalDoc.value.get().value;
    this._register(runOnChange(this._originalDoc.value, (val, _prevVal, edits) => {
      const eComposed = AnnotatedStringEdit.compose(edits.map((e2) => e2.edit));
      const e = eComposed.removeCommonSuffixAndPrefix(prevValue);
      prevValue = val.value;
      v.set(val, void 0, { edit: e });
    }));
  }
  async waitForQueue() {
    await this._originalDoc.waitForQueue();
  }
}
function createDocWithJustReason(docWithAnnotatedEdits, store) {
  const docWithJustReason = {
    value: mapObservableDelta(docWithAnnotatedEdits.value, (edit) => ({ edit: edit.edit.mapData((d) => d.data.toEditSourceData()) }), store),
    waitForQueue: () => docWithAnnotatedEdits.waitForQueue()
  };
  return docWithJustReason;
}
export {
  CombineStreamedChanges,
  DiffService,
  DocumentWithSourceAnnotatedEdits,
  EditKeySourceData,
  EditSourceBase,
  EditSourceData,
  InlineSuggestEditSource,
  MinimizeEditsProcessor,
  createDocWithJustReason
};
