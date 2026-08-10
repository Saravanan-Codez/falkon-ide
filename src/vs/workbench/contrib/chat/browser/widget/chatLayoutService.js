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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { derived } from "../../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
const FONT_SIZE = 13;
let ChatLayoutService = class extends Disposable {
  constructor(configurationService) {
    super();
    const chatFontFamily = observableConfigValue("chat.fontFamily", "default", configurationService);
    this.fontFamily = derived((reader) => {
      const fontFamily = chatFontFamily.read(reader);
      return fontFamily === "default" ? null : fontFamily;
    });
    this.fontSize = observableConfigValue("chat.fontSize", FONT_SIZE, configurationService);
  }
};
ChatLayoutService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], ChatLayoutService);
export {
  ChatLayoutService
};
