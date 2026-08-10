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
import { Emitter } from "../../../base/common/event.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ITimelineService } from "../../contrib/timeline/common/timeline.js";
import { revive } from "../../../base/common/marshalling.js";
let MainThreadTimeline = class {
  constructor(context, logService, _timelineService) {
    this.logService = logService;
    this._timelineService = _timelineService;
    this._providerEmitters = /* @__PURE__ */ new Map();
    this._proxy = context.getProxy(ExtHostContext.ExtHostTimeline);
  }
  $registerTimelineProvider(provider) {
    this.logService.trace(`MainThreadTimeline#registerTimelineProvider: id=${provider.id}`);
    const proxy = this._proxy;
    const emitters = this._providerEmitters;
    let onDidChange = emitters.get(provider.id);
    if (onDidChange === void 0) {
      onDidChange = new Emitter();
      emitters.set(provider.id, onDidChange);
    }
    this._timelineService.registerTimelineProvider({
      ...provider,
      onDidChange: onDidChange.event,
      async provideTimeline(uri, options, token) {
        return revive(await proxy.$getTimeline(provider.id, uri, options, token));
      },
      dispose() {
        emitters.delete(provider.id);
        onDidChange?.dispose();
      }
    });
  }
  $unregisterTimelineProvider(id) {
    this.logService.trace(`MainThreadTimeline#unregisterTimelineProvider: id=${id}`);
    this._timelineService.unregisterTimelineProvider(id);
  }
  $emitTimelineChangeEvent(e) {
    this.logService.trace(`MainThreadTimeline#emitChangeEvent: id=${e.id}, uri=${e.uri?.toString(true)}`);
    const emitter = this._providerEmitters.get(e.id);
    emitter?.fire(e);
  }
  dispose() {
  }
};
MainThreadTimeline = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTimeline),
  __decorateParam(1, ILogService),
  __decorateParam(2, ITimelineService)
], MainThreadTimeline);
export {
  MainThreadTimeline
};
