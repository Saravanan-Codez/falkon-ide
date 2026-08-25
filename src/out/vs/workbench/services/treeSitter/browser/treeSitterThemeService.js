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
import { derived, observableFromEvent } from "../../../../base/common/observable.js";
import { findMetadata } from "../../themes/common/colorThemeData.js";
import { IWorkbenchThemeService } from "../../themes/common/workbenchThemeService.js";
let TreeSitterThemeService = class {
  constructor(_themeService) {
    this._themeService = _themeService;
    this._colorTheme = observableFromEvent(this._themeService.onDidColorThemeChange, () => this._themeService.getColorTheme());
    this.onChange = derived(this, (reader) => {
      this._colorTheme.read(reader);
      reader.reportChange(void 0);
    });
  }
  findMetadata(captureNames, languageId, bracket, reader) {
    return findMetadata(this._colorTheme.read(reader), captureNames, languageId, bracket);
  }
};
TreeSitterThemeService = __decorateClass([
  __decorateParam(0, IWorkbenchThemeService)
], TreeSitterThemeService);
export {
  TreeSitterThemeService
};
