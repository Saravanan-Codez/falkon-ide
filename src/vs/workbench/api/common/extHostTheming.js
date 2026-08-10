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
import { ColorTheme, ColorThemeKind } from "./extHostTypes.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { Emitter } from "../../../base/common/event.js";
let ExtHostTheming = class {
  constructor(_extHostRpc) {
    this._actual = new ColorTheme(ColorThemeKind.Dark);
    this._onDidChangeActiveColorTheme = new Emitter();
  }
  get activeColorTheme() {
    return this._actual;
  }
  $onColorThemeChange(type) {
    let kind;
    switch (type) {
      case "light":
        kind = ColorThemeKind.Light;
        break;
      case "hcDark":
        kind = ColorThemeKind.HighContrast;
        break;
      case "hcLight":
        kind = ColorThemeKind.HighContrastLight;
        break;
      default:
        kind = ColorThemeKind.Dark;
    }
    this._actual = new ColorTheme(kind);
    this._onDidChangeActiveColorTheme.fire(this._actual);
  }
  get onDidChangeActiveColorTheme() {
    return this._onDidChangeActiveColorTheme.event;
  }
};
ExtHostTheming = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostTheming);
export {
  ExtHostTheming
};
