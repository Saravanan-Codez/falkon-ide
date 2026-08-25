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
import { sumBy } from "../../../../../base/common/arrays.js";
import { TaskQueue, timeout } from "../../../../../base/common/async.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, mapObservableArrayCached, observableValue, runOnChange } from "../../../../../base/common/observable.js";
import { AnnotatedStringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { isAiEdit, isUserEdit } from "../../../../../editor/common/textModelEditSource.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { AiStatsStatusBar } from "./aiStatsStatusBar.js";
let AiStatsFeature = class extends Disposable {
  constructor(annotatedDocuments, _storageService, _instantiationService) {
    super();
    this._storageService = _storageService;
    this._instantiationService = _instantiationService;
    this._dataVersion = observableValue(this, 0);
    this.aiRate = this._dataVersion.map(() => {
      const val = this._data.getValue();
      if (!val) {
        return 0;
      }
      const r = average(val.sessions, (session) => {
        const sum = session.typedCharacters + session.aiCharacters;
        if (sum === 0) {
          return 0;
        }
        return session.aiCharacters / sum;
      });
      return r;
    });
    this.sessionCount = derived(this, (r) => {
      this._dataVersion.read(r);
      const val = this._data.getValue();
      if (!val) {
        return 0;
      }
      return val.sessions.length;
    });
    this.sessions = derived(this, (r) => {
      this._dataVersion.read(r);
      const val = this._data.getValue();
      if (!val) {
        return [];
      }
      return val.sessions;
    });
    this.acceptedInlineSuggestionsToday = derived(this, (r) => {
      this._dataVersion.read(r);
      const val = this._data.getValue();
      if (!val) {
        return 0;
      }
      const startOfToday = /* @__PURE__ */ new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const sessionsToday = val.sessions.filter((s) => s.startTime > startOfToday.getTime());
      return sumBy(sessionsToday, (s) => s.acceptedInlineSuggestions ?? 0);
    });
    const storedValue = getStoredValue(this._storageService, "aiStats", StorageScope.WORKSPACE, StorageTarget.USER);
    this._data = rateLimitWrite(storedValue, 1 / 60, this._store);
    this.aiRate.recomputeInitiallyAndOnChange(this._store);
    this._register(autorun((reader) => {
      reader.store.add(this._instantiationService.createInstance(AiStatsStatusBar.hot.read(reader), this));
    }));
    const lastRequestIds = [];
    const obs = mapObservableArrayCached(this, annotatedDocuments.documents, (doc, store) => {
      store.add(runOnChange(doc.documentWithAnnotations.value, (_val, _prev, edit) => {
        const e = AnnotatedStringEdit.compose(edit.map((e2) => e2.edit));
        const curSession = new Lazy(() => this._getDataAndSession());
        for (const r of e.replacements) {
          if (isAiEdit(r.data.editSource)) {
            curSession.value.currentSession.aiCharacters += r.newText.length;
          } else if (isUserEdit(r.data.editSource)) {
            curSession.value.currentSession.typedCharacters += r.newText.length;
          }
        }
        if (e.replacements.length > 0) {
          const sessionToUpdate = curSession.value.currentSession;
          const s = e.replacements[0].data.editSource;
          if (s.metadata.source === "inlineCompletionAccept") {
            if (sessionToUpdate.acceptedInlineSuggestions === void 0) {
              sessionToUpdate.acceptedInlineSuggestions = 0;
            }
            sessionToUpdate.acceptedInlineSuggestions += 1;
          }
          if (s.metadata.source === "Chat.applyEdits" && s.metadata.$$requestId !== void 0) {
            const didSeeRequestId = lastRequestIds.includes(s.metadata.$$requestId);
            if (!didSeeRequestId) {
              lastRequestIds.push(s.metadata.$$requestId);
              if (lastRequestIds.length > 10) {
                lastRequestIds.shift();
              }
              if (sessionToUpdate.chatEditCount === void 0) {
                sessionToUpdate.chatEditCount = 0;
              }
              sessionToUpdate.chatEditCount += 1;
            }
          }
        }
        if (curSession.hasValue) {
          this._data.writeValue(curSession.value.data);
          this._dataVersion.set(this._dataVersion.get() + 1, void 0);
        }
      }));
    });
    obs.recomputeInitiallyAndOnChange(this._store);
  }
  _getDataAndSession() {
    const state = this._data.getValue() ?? { sessions: [] };
    const sessionLengthMs = 5 * 60 * 1e3;
    let lastSession = state.sessions.at(-1);
    const nowTime = Date.now();
    if (!lastSession || nowTime - lastSession.startTime > sessionLengthMs) {
      state.sessions.push({
        startTime: nowTime,
        typedCharacters: 0,
        aiCharacters: 0,
        acceptedInlineSuggestions: 0,
        chatEditCount: 0
      });
      lastSession = state.sessions.at(-1);
      const dayMs = 24 * 60 * 60 * 1e3;
      while (state.sessions.length > dayMs / sessionLengthMs) {
        state.sessions.shift();
      }
    }
    return { data: state, currentSession: lastSession };
  }
};
AiStatsFeature = __decorateClass([
  __decorateParam(1, IStorageService),
  __decorateParam(2, IInstantiationService)
], AiStatsFeature);
function average(arr, selector) {
  if (arr.length === 0) {
    return 0;
  }
  const s = sumBy(arr, selector);
  return s / arr.length;
}
function rateLimitWrite(targetValue, maxWritesPerSecond, store) {
  const queue = new TaskQueue();
  let _value = void 0;
  let valueVersion = 0;
  let savedVersion = 0;
  store.add(toDisposable(() => {
    if (valueVersion !== savedVersion) {
      targetValue.writeValue(_value);
      savedVersion = valueVersion;
    }
  }));
  return {
    writeValue(value) {
      valueVersion++;
      const v = valueVersion;
      _value = value;
      queue.clearPending();
      queue.schedule(async () => {
        targetValue.writeValue(value);
        savedVersion = v;
        await timeout(5e3);
      });
    },
    getValue() {
      if (valueVersion > 0) {
        return _value;
      }
      return targetValue.getValue();
    }
  };
}
function getStoredValue(service, key, scope, target) {
  let lastValue = void 0;
  let hasLastValue = false;
  return {
    writeValue(value) {
      if (value === void 0) {
        service.remove(key, scope);
      } else {
        service.store(key, JSON.stringify(value), scope, target);
      }
      lastValue = value;
    },
    getValue() {
      if (hasLastValue) {
        return lastValue;
      }
      const strVal = service.get(key, scope);
      lastValue = strVal === void 0 ? void 0 : JSON.parse(strVal);
      hasLastValue = true;
      return lastValue;
    }
  };
}
export {
  AiStatsFeature
};
