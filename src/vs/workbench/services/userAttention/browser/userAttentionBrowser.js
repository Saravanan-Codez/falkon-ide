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
import * as dom from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { TotalTrueTimeObservable, wasTrueRecently } from "../../../../base/common/observableInternal/experimental/time.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILogService, LogLevel } from "../../../../platform/log/common/log.js";
import { IHostService } from "../../host/browser/host.js";
import { IUserAttentionService } from "../common/userAttentionService.js";
const USER_ATTENTION_TIMEOUT_MS = 6e4;
let UserAttentionService = class extends Disposable {
  constructor(instantiationService, _logService) {
    super();
    this._logService = _logService;
    const hostAdapter = this._register(instantiationService.createInstance(UserAttentionServiceEnv));
    this.isVsCodeFocused = hostAdapter.isVsCodeFocused;
    this.isUserActive = hostAdapter.isUserActive;
    this._isTracingEnabled = observableFromEvent(
      this,
      this._logService.onDidChangeLogLevel,
      () => this._logService.getLevel() === LogLevel.Trace
    );
    const hadRecentActivity = wasTrueRecently(this.isUserActive, USER_ATTENTION_TIMEOUT_MS, this._store);
    this.hasUserAttention = derived(this, (reader) => {
      return hadRecentActivity.read(reader);
    });
    this._timeKeeper = this._register(new TotalTrueTimeObservable(this.hasUserAttention));
    this._register(autorun((reader) => {
      if (!this._isTracingEnabled.read(reader)) {
        return;
      }
      reader.store.add(autorun((innerReader) => {
        const focused = this.isVsCodeFocused.read(innerReader);
        this._logService.trace(`[UserAttentionService] VS Code focus changed: ${focused}`);
      }));
      reader.store.add(autorun((innerReader) => {
        const hasAttention = this.hasUserAttention.read(innerReader);
        this._logService.trace(`[UserAttentionService] User attention changed: ${hasAttention}`);
      }));
    }));
  }
  fireAfterGivenFocusTimePassed(focusTimeMs, callback) {
    return this._timeKeeper.fireWhenTimeIncreasedBy(focusTimeMs, callback);
  }
  get totalFocusTimeMs() {
    return this._timeKeeper.totalTimeMs();
  }
};
UserAttentionService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILogService)
], UserAttentionService);
let UserAttentionServiceEnv = class extends Disposable {
  constructor(_hostService, _logService) {
    super();
    this._hostService = _hostService;
    this._logService = _logService;
    this._isUserActive = observableValue(this, false);
    this.isVsCodeFocused = observableFromEvent(this, this._hostService.onDidChangeFocus, () => this._hostService.hasFocus);
    this.isUserActive = this._isUserActive;
    const onActivity = () => {
      this._markUserActivity();
    };
    this._register(Event.runAndSubscribe(dom.onDidRegisterWindow, ({ window, disposables }) => {
      disposables.add(dom.addDisposableListener(window.document, "keydown", onActivity, eventListenerOptions));
      disposables.add(dom.addDisposableListener(window.document, "mousemove", onActivity, eventListenerOptions));
      disposables.add(dom.addDisposableListener(window.document, "mousedown", onActivity, eventListenerOptions));
      disposables.add(dom.addDisposableListener(window.document, "touchstart", onActivity, eventListenerOptions));
    }, { window: mainWindow, disposables: this._store }));
    if (this._hostService.hasFocus) {
      this._markUserActivity();
    }
  }
  _markUserActivity() {
    if (this._activityDebounceTimeout !== void 0) {
      clearTimeout(this._activityDebounceTimeout);
    } else {
      this._logService.trace("[UserAttentionService] User activity detected");
      this._isUserActive.set(true, void 0);
    }
    this._activityDebounceTimeout = setTimeout(() => {
      this._isUserActive.set(false, void 0);
      this._activityDebounceTimeout = void 0;
    }, 500);
  }
  dispose() {
    clearTimeout(this._activityDebounceTimeout);
    super.dispose();
  }
};
UserAttentionServiceEnv = __decorateClass([
  __decorateParam(0, IHostService),
  __decorateParam(1, ILogService)
], UserAttentionServiceEnv);
const eventListenerOptions = {
  passive: true,
  capture: true
};
registerSingleton(IUserAttentionService, UserAttentionService, InstantiationType.Delayed);
export {
  UserAttentionService,
  UserAttentionServiceEnv
};
