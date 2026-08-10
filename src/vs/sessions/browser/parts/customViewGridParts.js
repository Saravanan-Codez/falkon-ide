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
import { Disposable } from "../../../base/common/lifecycle.js";
import { getClientArea } from "../../../base/browser/dom.js";
import { mainWindow } from "../../../base/browser/window.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ICustomViewGridPartService } from "../../services/customView/browser/customViewGridPartService.js";
import { CustomViewGridPart } from "./customViewGridPart.js";
import { MobileCustomViewGridPart } from "./mobile/mobileCustomViewGridPart.js";
let CustomViewGridParts = class extends Disposable {
  constructor(instantiationService) {
    super();
    const { width } = getClientArea(mainWindow.document.body);
    const isPhoneLayout = width < 640;
    this._mainPart = this._register(instantiationService.createInstance(isPhoneLayout ? MobileCustomViewGridPart : CustomViewGridPart));
  }
  setView(descriptor) {
    this._mainPart.setView(descriptor);
  }
  focusActiveView() {
    this._mainPart.focus();
  }
};
CustomViewGridParts = __decorateClass([
  __decorateParam(0, IInstantiationService)
], CustomViewGridParts);
registerSingleton(ICustomViewGridPartService, CustomViewGridParts, InstantiationType.Eager);
export {
  CustomViewGridParts
};
