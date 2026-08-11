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
import { observableFromEvent } from "../../../../base/common/observable.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDataChannelService } from "../../../../platform/dataChannel/common/dataChannel.js";
function formatRecordableLogEntry(entry) {
  return entry.sourceId + " @@ " + JSON.stringify({ ...entry, modelUri: entry.modelUri?.toString(), sourceId: void 0 });
}
let StructuredLogger = class extends Disposable {
  constructor(_key, _contextKeyService, _dataChannelService) {
    super();
    this._key = _key;
    this._contextKeyService = _contextKeyService;
    this._dataChannelService = _dataChannelService;
    this._isEnabledContextKeyValue = observableContextKey("structuredLogger.enabled:" + this._key, this._contextKeyService).recomputeInitiallyAndOnChange(this._store);
    this.isEnabled = this._isEnabledContextKeyValue.map((v) => v !== void 0);
  }
  static cast() {
    return this;
  }
  log(data) {
    const enabled = this._isEnabledContextKeyValue.get();
    if (!enabled) {
      return false;
    }
    this._dataChannelService.getDataChannel("structuredLogger:" + this._key).sendData(data);
    return true;
  }
};
StructuredLogger = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IDataChannelService)
], StructuredLogger);
function observableContextKey(key, contextKeyService) {
  return observableFromEvent(contextKeyService.onDidChangeContext, () => contextKeyService.getContextKeyValue(key));
}
export {
  StructuredLogger,
  formatRecordableLogEntry
};
