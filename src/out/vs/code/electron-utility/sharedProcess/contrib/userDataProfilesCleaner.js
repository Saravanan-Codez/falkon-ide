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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
let UserDataProfilesCleaner = class extends Disposable {
  constructor(userDataProfilesService) {
    super();
    const scheduler = this._register(new RunOnceScheduler(
      () => {
        userDataProfilesService.cleanUp();
      },
      10 * 1e3
      /* after 10s */
    ));
    scheduler.schedule();
  }
};
UserDataProfilesCleaner = __decorateClass([
  __decorateParam(0, IUserDataProfilesService)
], UserDataProfilesCleaner);
export {
  UserDataProfilesCleaner
};
