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
import * as nls from "../../../../nls.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { FileAccess } from "../../../../base/common/network.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { KeymapInfo } from "../common/keymapInfo.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { DispatchConfig, readKeyboardConfig } from "../../../../platform/keyboardLayout/common/keyboardConfig.js";
import { CachedKeyboardMapper } from "../../../../platform/keyboardLayout/common/keyboardMapper.js";
import { OS, OperatingSystem, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { WindowsKeyboardMapper } from "../common/windowsKeyboardMapper.js";
import { FallbackKeyboardMapper } from "../common/fallbackKeyboardMapper.js";
import { MacLinuxKeyboardMapper } from "../common/macLinuxKeyboardMapper.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { parse, getNodeType } from "../../../../base/common/json.js";
import * as objects from "../../../../base/common/objects.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ConfigExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { getKeyboardLayoutId, IKeyboardLayoutService } from "../../../../platform/keyboardLayout/common/keyboardLayout.js";
class BrowserKeyboardMapperFactoryBase extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
    this._onDidChangeKeyboardMapper = this._register(new Emitter());
    this.onDidChangeKeyboardMapper = this._onDidChangeKeyboardMapper.event;
    this.keyboardLayoutMapAllowed = navigator.keyboard !== void 0;
    this._keyboardMapper = null;
    this._initialized = false;
    this._keymapInfos = [];
    this._mru = [];
    this._activeKeymapInfo = null;
    if (navigator.keyboard && navigator.keyboard.addEventListener) {
      navigator.keyboard.addEventListener("layoutchange", () => {
        this._getBrowserKeyMapping().then((mapping) => {
          if (this.isKeyMappingActive(mapping)) {
            return;
          }
          this.setLayoutFromBrowserAPI();
        });
      });
    }
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("keyboard")) {
        this._keyboardMapper = null;
        this._onDidChangeKeyboardMapper.fire();
      }
    }));
  }
  get activeKeymap() {
    return this._activeKeymapInfo;
  }
  get keymapInfos() {
    return this._keymapInfos;
  }
  get activeKeyboardLayout() {
    if (!this._initialized) {
      return null;
    }
    return this._activeKeymapInfo?.layout ?? null;
  }
  get activeKeyMapping() {
    if (!this._initialized) {
      return null;
    }
    return this._activeKeymapInfo?.mapping ?? null;
  }
  get keyboardLayouts() {
    return this._keymapInfos.map((keymapInfo) => keymapInfo.layout);
  }
  registerKeyboardLayout(layout) {
    this._keymapInfos.push(layout);
    this._mru = this._keymapInfos;
  }
  removeKeyboardLayout(layout) {
    let index = this._mru.indexOf(layout);
    if (index !== -1) {
      this._mru.splice(index, 1);
    }
    index = this._keymapInfos.indexOf(layout);
    if (index !== -1) {
      this._keymapInfos.splice(index, 1);
    }
  }
  getMatchedKeymapInfo(keyMapping) {
    if (!keyMapping) {
      return null;
    }
    const usStandard = this.getUSStandardLayout();
    if (usStandard) {
      let maxScore = usStandard.getScore(keyMapping);
      if (maxScore === 0) {
        return {
          result: usStandard,
          score: 0
        };
      }
      let result = usStandard;
      for (let i = 0; i < this._mru.length; i++) {
        const score = this._mru[i].getScore(keyMapping);
        if (score > maxScore) {
          if (score === 0) {
            return {
              result: this._mru[i],
              score: 0
            };
          }
          maxScore = score;
          result = this._mru[i];
        }
      }
      return {
        result,
        score: maxScore
      };
    }
    for (let i = 0; i < this._mru.length; i++) {
      if (this._mru[i].fuzzyEqual(keyMapping)) {
        return {
          result: this._mru[i],
          score: 0
        };
      }
    }
    return null;
  }
  getUSStandardLayout() {
    const usStandardLayouts = this._mru.filter((layout) => layout.layout.isUSStandard);
    if (usStandardLayouts.length) {
      return usStandardLayouts[0];
    }
    return null;
  }
  isKeyMappingActive(keymap) {
    return this._activeKeymapInfo && keymap && this._activeKeymapInfo.fuzzyEqual(keymap);
  }
  setUSKeyboardLayout() {
    this._activeKeymapInfo = this.getUSStandardLayout();
  }
  setActiveKeyMapping(keymap) {
    let keymapUpdated = false;
    const matchedKeyboardLayout = this.getMatchedKeymapInfo(keymap);
    if (matchedKeyboardLayout) {
      if (!this._activeKeymapInfo) {
        this._activeKeymapInfo = matchedKeyboardLayout.result;
        keymapUpdated = true;
      } else if (keymap) {
        if (matchedKeyboardLayout.result.getScore(keymap) > this._activeKeymapInfo.getScore(keymap)) {
          this._activeKeymapInfo = matchedKeyboardLayout.result;
          keymapUpdated = true;
        }
      }
    }
    if (!this._activeKeymapInfo) {
      this._activeKeymapInfo = this.getUSStandardLayout();
      keymapUpdated = true;
    }
    if (!this._activeKeymapInfo || !keymapUpdated) {
      return;
    }
    const index = this._mru.indexOf(this._activeKeymapInfo);
    this._mru.splice(index, 1);
    this._mru.unshift(this._activeKeymapInfo);
    this._setKeyboardData(this._activeKeymapInfo);
  }
  setActiveKeymapInfo(keymapInfo) {
    this._activeKeymapInfo = keymapInfo;
    const index = this._mru.indexOf(this._activeKeymapInfo);
    if (index === 0) {
      return;
    }
    this._mru.splice(index, 1);
    this._mru.unshift(this._activeKeymapInfo);
    this._setKeyboardData(this._activeKeymapInfo);
  }
  setLayoutFromBrowserAPI() {
    this._updateKeyboardLayoutAsync(this._initialized);
  }
  _updateKeyboardLayoutAsync(initialized, keyboardEvent) {
    if (!initialized) {
      return;
    }
    this._getBrowserKeyMapping(keyboardEvent).then((keyMap) => {
      if (this.isKeyMappingActive(keyMap)) {
        return;
      }
      this.setActiveKeyMapping(keyMap);
    });
  }
  getKeyboardMapper() {
    const config = readKeyboardConfig(this._configurationService);
    if (config.dispatch === DispatchConfig.KeyCode || !this._initialized || !this._activeKeymapInfo) {
      return new FallbackKeyboardMapper(config.mapAltGrToCtrlAlt, OS);
    }
    if (!this._keyboardMapper) {
      this._keyboardMapper = new CachedKeyboardMapper(BrowserKeyboardMapperFactory._createKeyboardMapper(this._activeKeymapInfo, config.mapAltGrToCtrlAlt));
    }
    return this._keyboardMapper;
  }
  validateCurrentKeyboardMapping(keyboardEvent) {
    if (!this._initialized) {
      return;
    }
    const isCurrentKeyboard = this._validateCurrentKeyboardMapping(keyboardEvent);
    if (isCurrentKeyboard) {
      return;
    }
    this._updateKeyboardLayoutAsync(true, keyboardEvent);
  }
  setKeyboardLayout(layoutName) {
    const matchedLayouts = this.keymapInfos.filter((keymapInfo) => getKeyboardLayoutId(keymapInfo.layout) === layoutName);
    if (matchedLayouts.length > 0) {
      this.setActiveKeymapInfo(matchedLayouts[0]);
    }
  }
  _setKeyboardData(keymapInfo) {
    this._initialized = true;
    this._keyboardMapper = null;
    this._onDidChangeKeyboardMapper.fire();
  }
  static _createKeyboardMapper(keymapInfo, mapAltGrToCtrlAlt) {
    const rawMapping = keymapInfo.mapping;
    const isUSStandard = !!keymapInfo.layout.isUSStandard;
    if (OS === OperatingSystem.Windows) {
      return new WindowsKeyboardMapper(isUSStandard, rawMapping, mapAltGrToCtrlAlt);
    }
    if (Object.keys(rawMapping).length === 0) {
      return new FallbackKeyboardMapper(mapAltGrToCtrlAlt, OS);
    }
    return new MacLinuxKeyboardMapper(isUSStandard, rawMapping, mapAltGrToCtrlAlt, OS);
  }
  //#region Browser API
  _validateCurrentKeyboardMapping(keyboardEvent) {
    if (!this._initialized) {
      return true;
    }
    const standardKeyboardEvent = keyboardEvent;
    const currentKeymap = this._activeKeymapInfo;
    if (!currentKeymap) {
      return true;
    }
    if (standardKeyboardEvent.browserEvent.key === "Dead" || standardKeyboardEvent.browserEvent.isComposing) {
      return true;
    }
    const mapping = currentKeymap.mapping[standardKeyboardEvent.code];
    if (!mapping) {
      return false;
    }
    if (mapping.value === "") {
      if (keyboardEvent.ctrlKey || keyboardEvent.metaKey) {
        setTimeout(() => {
          this._getBrowserKeyMapping().then((keymap) => {
            if (this.isKeyMappingActive(keymap)) {
              return;
            }
            this.setLayoutFromBrowserAPI();
          });
        }, 350);
      }
      return true;
    }
    const expectedValue = standardKeyboardEvent.altKey && standardKeyboardEvent.shiftKey ? mapping.withShiftAltGr : standardKeyboardEvent.altKey ? mapping.withAltGr : standardKeyboardEvent.shiftKey ? mapping.withShift : mapping.value;
    const isDead = standardKeyboardEvent.altKey && standardKeyboardEvent.shiftKey && mapping.withShiftAltGrIsDeadKey || standardKeyboardEvent.altKey && mapping.withAltGrIsDeadKey || standardKeyboardEvent.shiftKey && mapping.withShiftIsDeadKey || mapping.valueIsDeadKey;
    if (isDead && standardKeyboardEvent.browserEvent.key !== "Dead") {
      return false;
    }
    if (!isDead && standardKeyboardEvent.browserEvent.key !== expectedValue) {
      return false;
    }
    return true;
  }
  async _getBrowserKeyMapping(keyboardEvent) {
    if (this.keyboardLayoutMapAllowed) {
      try {
        return await navigator.keyboard.getLayoutMap().then((e) => {
          const ret = {};
          for (const key of e) {
            ret[key[0]] = {
              "value": key[1],
              "withShift": "",
              "withAltGr": "",
              "withShiftAltGr": ""
            };
          }
          return ret;
        });
      } catch {
        this.keyboardLayoutMapAllowed = false;
      }
    }
    if (keyboardEvent && !keyboardEvent.shiftKey && !keyboardEvent.altKey && !keyboardEvent.metaKey && !keyboardEvent.metaKey) {
      const ret = {};
      const standardKeyboardEvent = keyboardEvent;
      ret[standardKeyboardEvent.browserEvent.code] = {
        "value": standardKeyboardEvent.browserEvent.key,
        "withShift": "",
        "withAltGr": "",
        "withShiftAltGr": ""
      };
      const matchedKeyboardLayout = this.getMatchedKeymapInfo(ret);
      if (matchedKeyboardLayout) {
        return ret;
      }
      return null;
    }
    return null;
  }
  //#endregion
}
class BrowserKeyboardMapperFactory extends BrowserKeyboardMapperFactoryBase {
  constructor(configurationService, notificationService, storageService, commandService) {
    super(configurationService);
    const platform = isWindows ? "win" : isMacintosh ? "darwin" : "linux";
    import(
      /* webpackIgnore: true */
      FileAccess.asBrowserUri(`vs/workbench/services/keybinding/browser/keyboardLayouts/layout.contribution.${platform}.js`).path
    ).then((m) => {
      const keymapInfos = m.KeyboardLayoutContribution.INSTANCE.layoutInfos;
      this._keymapInfos.push(...keymapInfos.map((info) => new KeymapInfo(info.layout, info.secondaryLayouts, info.mapping, info.isUserKeyboardLayout)));
      this._mru = this._keymapInfos;
      this._initialized = true;
      this.setLayoutFromBrowserAPI();
    });
  }
}
class UserKeyboardLayout extends Disposable {
  constructor(keyboardLayoutResource, fileService) {
    super();
    this.keyboardLayoutResource = keyboardLayoutResource;
    this.fileService = fileService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._keyboardLayout = null;
    this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.reload().then((changed) => {
      if (changed) {
        this._onDidChange.fire();
      }
    }), 50));
    this._register(Event.filter(this.fileService.onDidFilesChange, (e) => e.contains(this.keyboardLayoutResource))(() => this.reloadConfigurationScheduler.schedule()));
  }
  get keyboardLayout() {
    return this._keyboardLayout;
  }
  async initialize() {
    await this.reload();
  }
  async reload() {
    const existing = this._keyboardLayout;
    try {
      const content = await this.fileService.readFile(this.keyboardLayoutResource);
      const value = parse(content.value.toString());
      if (getNodeType(value) === "object") {
        const layoutInfo = value.layout;
        const mappings = value.rawMapping;
        this._keyboardLayout = KeymapInfo.createKeyboardLayoutFromDebugInfo(layoutInfo, mappings, true);
      } else {
        this._keyboardLayout = null;
      }
    } catch (e) {
      this._keyboardLayout = null;
    }
    return existing ? !objects.equals(existing, this._keyboardLayout) : true;
  }
}
let BrowserKeyboardLayoutService = class extends Disposable {
  constructor(environmentService, fileService, notificationService, storageService, commandService, configurationService) {
    super();
    this.configurationService = configurationService;
    this._onDidChangeKeyboardLayout = this._register(new Emitter());
    this.onDidChangeKeyboardLayout = this._onDidChangeKeyboardLayout.event;
    const keyboardConfig = configurationService.getValue("keyboard");
    const layout = keyboardConfig.layout;
    this._keyboardLayoutMode = layout ?? "autodetect";
    this._factory = new BrowserKeyboardMapperFactory(configurationService, notificationService, storageService, commandService);
    this._register(this._factory.onDidChangeKeyboardMapper(() => {
      this._onDidChangeKeyboardLayout.fire();
    }));
    if (layout && layout !== "autodetect") {
      this._factory.setKeyboardLayout(layout);
    }
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("keyboard.layout")) {
        const keyboardConfig2 = configurationService.getValue("keyboard");
        const layout2 = keyboardConfig2.layout;
        this._keyboardLayoutMode = layout2;
        if (layout2 === "autodetect") {
          this._factory.setLayoutFromBrowserAPI();
        } else {
          this._factory.setKeyboardLayout(layout2);
        }
      }
    }));
    this._userKeyboardLayout = new UserKeyboardLayout(environmentService.keyboardLayoutResource, fileService);
    this._userKeyboardLayout.initialize().then(() => {
      if (this._userKeyboardLayout.keyboardLayout) {
        this._factory.registerKeyboardLayout(this._userKeyboardLayout.keyboardLayout);
        this.setUserKeyboardLayoutIfMatched();
      }
    });
    this._register(this._userKeyboardLayout.onDidChange(() => {
      const userKeyboardLayouts = this._factory.keymapInfos.filter((layout2) => layout2.isUserKeyboardLayout);
      if (userKeyboardLayouts.length) {
        if (this._userKeyboardLayout.keyboardLayout) {
          userKeyboardLayouts[0].update(this._userKeyboardLayout.keyboardLayout);
        } else {
          this._factory.removeKeyboardLayout(userKeyboardLayouts[0]);
        }
      } else {
        if (this._userKeyboardLayout.keyboardLayout) {
          this._factory.registerKeyboardLayout(this._userKeyboardLayout.keyboardLayout);
        }
      }
      this.setUserKeyboardLayoutIfMatched();
    }));
  }
  setUserKeyboardLayoutIfMatched() {
    const keyboardConfig = this.configurationService.getValue("keyboard");
    const layout = keyboardConfig.layout;
    if (layout && this._userKeyboardLayout.keyboardLayout) {
      if (getKeyboardLayoutId(this._userKeyboardLayout.keyboardLayout.layout) === layout && this._factory.activeKeymap) {
        if (!this._userKeyboardLayout.keyboardLayout.equal(this._factory.activeKeymap)) {
          this._factory.setActiveKeymapInfo(this._userKeyboardLayout.keyboardLayout);
        }
      }
    }
  }
  getKeyboardMapper() {
    return this._factory.getKeyboardMapper();
  }
  getCurrentKeyboardLayout() {
    return this._factory.activeKeyboardLayout;
  }
  getAllKeyboardLayouts() {
    return this._factory.keyboardLayouts;
  }
  getRawKeyboardMapping() {
    return this._factory.activeKeyMapping;
  }
  validateCurrentKeyboardMapping(keyboardEvent) {
    if (this._keyboardLayoutMode !== "autodetect") {
      return;
    }
    this._factory.validateCurrentKeyboardMapping(keyboardEvent);
  }
};
BrowserKeyboardLayoutService = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IConfigurationService)
], BrowserKeyboardLayoutService);
registerSingleton(IKeyboardLayoutService, BrowserKeyboardLayoutService, InstantiationType.Delayed);
const configurationRegistry = Registry.as(ConfigExtensions.Configuration);
const keyboardConfiguration = {
  "id": "keyboard",
  "order": 15,
  "type": "object",
  "title": nls.localize("keyboardConfigurationTitle", "Keyboard"),
  "properties": {
    "keyboard.layout": {
      "type": "string",
      "default": "autodetect",
      "description": nls.localize("keyboard.layout.config", "Control the keyboard layout used in web.")
    }
  }
};
configurationRegistry.registerConfiguration(keyboardConfiguration);
export {
  BrowserKeyboardLayoutService,
  BrowserKeyboardMapperFactory,
  BrowserKeyboardMapperFactoryBase
};
