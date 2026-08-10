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
import { IKeyboardLayoutService } from "../../../../platform/keyboardLayout/common/keyboardLayout.js";
import { Emitter } from "../../../../base/common/event.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { CachedKeyboardMapper } from "../../../../platform/keyboardLayout/common/keyboardMapper.js";
import { WindowsKeyboardMapper } from "../common/windowsKeyboardMapper.js";
import { FallbackKeyboardMapper } from "../common/fallbackKeyboardMapper.js";
import { MacLinuxKeyboardMapper } from "../common/macLinuxKeyboardMapper.js";
import { DispatchConfig, readKeyboardConfig } from "../../../../platform/keyboardLayout/common/keyboardConfig.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INativeKeyboardLayoutService } from "./nativeKeyboardLayoutService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
let KeyboardLayoutService = class extends Disposable {
  constructor(_nativeKeyboardLayoutService, _configurationService) {
    super();
    this._nativeKeyboardLayoutService = _nativeKeyboardLayoutService;
    this._configurationService = _configurationService;
    this._onDidChangeKeyboardLayout = this._register(new Emitter());
    this.onDidChangeKeyboardLayout = this._onDidChangeKeyboardLayout.event;
    this._keyboardMapper = null;
    this._register(this._nativeKeyboardLayoutService.onDidChangeKeyboardLayout(async () => {
      this._keyboardMapper = null;
      this._onDidChangeKeyboardLayout.fire();
    }));
    this._register(_configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("keyboard")) {
        this._keyboardMapper = null;
        this._onDidChangeKeyboardLayout.fire();
      }
    }));
  }
  getRawKeyboardMapping() {
    return this._nativeKeyboardLayoutService.getRawKeyboardMapping();
  }
  getCurrentKeyboardLayout() {
    return this._nativeKeyboardLayoutService.getCurrentKeyboardLayout();
  }
  getAllKeyboardLayouts() {
    return [];
  }
  getKeyboardMapper() {
    const config = readKeyboardConfig(this._configurationService);
    if (config.dispatch === DispatchConfig.KeyCode) {
      return new FallbackKeyboardMapper(config.mapAltGrToCtrlAlt, OS);
    }
    if (!this._keyboardMapper) {
      this._keyboardMapper = new CachedKeyboardMapper(createKeyboardMapper(this.getCurrentKeyboardLayout(), this.getRawKeyboardMapping(), config.mapAltGrToCtrlAlt));
    }
    return this._keyboardMapper;
  }
  validateCurrentKeyboardMapping(keyboardEvent) {
    return;
  }
};
KeyboardLayoutService = __decorateClass([
  __decorateParam(0, INativeKeyboardLayoutService),
  __decorateParam(1, IConfigurationService)
], KeyboardLayoutService);
function createKeyboardMapper(layoutInfo, rawMapping, mapAltGrToCtrlAlt) {
  const _isUSStandard = isUSStandard(layoutInfo);
  if (OS === OperatingSystem.Windows) {
    return new WindowsKeyboardMapper(_isUSStandard, rawMapping, mapAltGrToCtrlAlt);
  }
  if (!rawMapping || Object.keys(rawMapping).length === 0) {
    return new FallbackKeyboardMapper(mapAltGrToCtrlAlt, OS);
  }
  if (OS === OperatingSystem.Macintosh) {
    const kbInfo = layoutInfo;
    if (kbInfo.id === "com.apple.keylayout.DVORAK-QWERTYCMD") {
      return new FallbackKeyboardMapper(mapAltGrToCtrlAlt, OS);
    }
  }
  return new MacLinuxKeyboardMapper(_isUSStandard, rawMapping, mapAltGrToCtrlAlt, OS);
}
function isUSStandard(_kbInfo) {
  if (!_kbInfo) {
    return false;
  }
  if (OS === OperatingSystem.Linux) {
    const kbInfo = _kbInfo;
    const layouts = kbInfo.layout.split(/,/g);
    return layouts[kbInfo.group] === "us";
  }
  if (OS === OperatingSystem.Macintosh) {
    const kbInfo = _kbInfo;
    return kbInfo.id === "com.apple.keylayout.US";
  }
  if (OS === OperatingSystem.Windows) {
    const kbInfo = _kbInfo;
    return kbInfo.name === "00000409";
  }
  return false;
}
registerSingleton(IKeyboardLayoutService, KeyboardLayoutService, InstantiationType.Delayed);
export {
  KeyboardLayoutService
};
