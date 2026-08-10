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
import { derived } from "../../../../base/common/observable.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
const EMPTY_SESSION_FILES = Object.freeze([]);
let SessionFilesViewModel = class extends Disposable {
  constructor(sessionsService) {
    super();
    this.sessionFilesObs = derived(this, (reader) => {
      const activeSession = sessionsService.activeSession.read(reader);
      return activeSession?.externalChanges?.read(reader) ?? EMPTY_SESSION_FILES;
    });
  }
};
SessionFilesViewModel = __decorateClass([
  __decorateParam(0, ISessionsService)
], SessionFilesViewModel);
export {
  SessionFilesViewModel
};
