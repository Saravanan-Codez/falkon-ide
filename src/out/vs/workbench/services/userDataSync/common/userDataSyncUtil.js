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
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IUserDataSyncUtilService, getDefaultIgnoredSettings } from "../../../../platform/userDataSync/common/userDataSync.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ITextResourcePropertiesService, ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
let UserDataSyncUtilService = class {
  constructor(keybindingsService, textModelService, textResourcePropertiesService, textResourceConfigurationService) {
    this.keybindingsService = keybindingsService;
    this.textModelService = textModelService;
    this.textResourcePropertiesService = textResourcePropertiesService;
    this.textResourceConfigurationService = textResourceConfigurationService;
  }
  async resolveDefaultCoreIgnoredSettings() {
    return getDefaultIgnoredSettings(true);
  }
  async resolveUserBindings(userBindings) {
    const keys = {};
    for (const userbinding of userBindings) {
      keys[userbinding] = this.keybindingsService.resolveUserBinding(userbinding).map((part) => part.getUserSettingsLabel()).join(" ");
    }
    return keys;
  }
  async resolveFormattingOptions(resource) {
    try {
      const modelReference = await this.textModelService.createModelReference(resource);
      const { insertSpaces, tabSize } = modelReference.object.textEditorModel.getOptions();
      const eol = modelReference.object.textEditorModel.getEOL();
      modelReference.dispose();
      return { eol, insertSpaces, tabSize };
    } catch (e) {
    }
    return {
      eol: this.textResourcePropertiesService.getEOL(resource),
      insertSpaces: !!this.textResourceConfigurationService.getValue(resource, "editor.insertSpaces"),
      tabSize: this.textResourceConfigurationService.getValue(resource, "editor.tabSize")
    };
  }
};
UserDataSyncUtilService = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, ITextModelService),
  __decorateParam(2, ITextResourcePropertiesService),
  __decorateParam(3, ITextResourceConfigurationService)
], UserDataSyncUtilService);
registerSingleton(IUserDataSyncUtilService, UserDataSyncUtilService, InstantiationType.Delayed);
