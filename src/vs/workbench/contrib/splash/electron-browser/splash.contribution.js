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
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { ISplashStorageService } from "../browser/splash.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { PartsSplash } from "../browser/partsSplash.js";
let SplashStorageService = class {
  constructor(nativeHostService) {
    this.saveWindowSplash = nativeHostService.saveWindowSplash.bind(nativeHostService);
  }
};
SplashStorageService = __decorateClass([
  __decorateParam(0, INativeHostService)
], SplashStorageService);
registerSingleton(ISplashStorageService, SplashStorageService, InstantiationType.Delayed);
registerWorkbenchContribution2(
  PartsSplash.ID,
  PartsSplash,
  WorkbenchPhase.BlockStartup
);
