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
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
let MainThreadTheming = class {
  constructor(extHostContext, themeService) {
    this._themeService = themeService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTheming);
    this._themeChangeListener = this._themeService.onDidColorThemeChange((e) => {
      this._proxy.$onColorThemeChange(this._themeService.getColorTheme().type);
    });
    this._proxy.$onColorThemeChange(this._themeService.getColorTheme().type);
  }
  dispose() {
    this._themeChangeListener.dispose();
  }
};
MainThreadTheming = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTheming),
  __decorateParam(1, IThemeService)
], MainThreadTheming);
export {
  MainThreadTheming
};
