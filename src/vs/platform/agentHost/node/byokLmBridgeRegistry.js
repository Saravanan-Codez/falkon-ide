import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IByokLmBridgeRegistry = createDecorator("byokLmBridgeRegistry");
class ByokLmBridgeRegistry {
  constructor() {
    this._entries = /* @__PURE__ */ new Map();
    this._changeListeners = /* @__PURE__ */ new Set();
  }
  onDidChangeModels(listener) {
    this._changeListeners.add(listener);
    return toDisposable(() => {
      this._changeListeners.delete(listener);
    });
  }
  _notifyChanged() {
    for (const listener of [...this._changeListeners]) {
      listener();
    }
  }
  register(clientId, connection) {
    this._entries.get(clientId)?.store.dispose();
    const store = new DisposableStore();
    const entry = { connection, models: void 0, store };
    this._entries.set(clientId, entry);
    store.add(connection.onDidChangeModels((models) => {
      if (this._entries.get(clientId) !== entry) {
        return;
      }
      if (entry.models === void 0 || !modelsEqual(entry.models, models)) {
        entry.models = models;
        this._notifyChanged();
      }
    }));
    this._notifyChanged();
    return toDisposable(() => {
      if (this._entries.get(clientId) === entry) {
        this._entries.delete(clientId);
        entry.store.dispose();
        this._notifyChanged();
      }
    });
  }
  getModels() {
    return this._servingEntry()?.models ?? [];
  }
  getServingConnection() {
    return this._servingEntry()?.connection;
  }
  /**
   * A serving connection (`models` defined), preferring one whose model set is
   * non-empty. All serving windows expose the same models, so any populated one
   * is equivalent; the preference matters when a still-starting window pushes an
   * empty list first — it must not shadow a peer that already has them. Falls
   * back to a serving-but-empty window; non-serving windows are skipped.
   */
  _servingEntry() {
    let emptyFallback;
    for (const entry of this._entries.values()) {
      if (entry.models === void 0) {
        continue;
      }
      if (entry.models.length > 0) {
        return entry;
      }
      emptyFallback ??= entry;
    }
    return emptyFallback;
  }
}
function modelsEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((m, i) => {
    const n = b[i];
    return m.vendor === n.vendor && m.id === n.id && m.name === n.name && m.modelIdentifier === n.modelIdentifier && m.maxContextWindowTokens === n.maxContextWindowTokens && m.supportsVision === n.supportsVision && m.defaultReasoningEffort === n.defaultReasoningEffort && arraysEqual(m.supportedReasoningEfforts, n.supportedReasoningEfforts);
  });
}
function arraysEqual(a, b) {
  return a === b || a !== void 0 && b !== void 0 && a.length === b.length && a.every((value, index) => value === b[index]);
}
class NullByokLmBridgeRegistry {
  register() {
    return Disposable.None;
  }
  getModels() {
    return [];
  }
  getServingConnection() {
    return void 0;
  }
  onDidChangeModels() {
    return Disposable.None;
  }
}
export {
  ByokLmBridgeRegistry,
  IByokLmBridgeRegistry,
  NullByokLmBridgeRegistry
};
