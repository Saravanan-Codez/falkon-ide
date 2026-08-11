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
import { Disposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
const ISharedProcessLifecycleService = createDecorator("sharedProcessLifecycleService");
let SharedProcessLifecycleService = class extends Disposable {
  constructor(logService) {
    super();
    this.logService = logService;
    this._onWillShutdown = this._register(new Emitter());
    this.onWillShutdown = this._onWillShutdown.event;
  }
  fireOnWillShutdown() {
    this.logService.trace("Lifecycle#onWillShutdown.fire()");
    this._onWillShutdown.fire();
  }
};
SharedProcessLifecycleService = __decorateClass([
  __decorateParam(0, ILogService)
], SharedProcessLifecycleService);
export {
  ISharedProcessLifecycleService,
  SharedProcessLifecycleService
};
