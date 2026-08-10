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
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ISessionsService } from "./sessionsService.js";
const ISessionContext = createDecorator("sessionContext");
class SessionContext {
  constructor(session) {
    this.session = session;
  }
}
let ActiveSessionContext = class {
  constructor(sessionsService) {
    this.session = sessionsService.activeSession;
  }
};
ActiveSessionContext = __decorateClass([
  __decorateParam(0, ISessionsService)
], ActiveSessionContext);
registerSingleton(ISessionContext, ActiveSessionContext, InstantiationType.Delayed);
export {
  ISessionContext,
  SessionContext
};
