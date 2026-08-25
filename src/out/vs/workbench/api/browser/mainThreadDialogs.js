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
import { URI } from "../../../base/common/uri.js";
import { MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IFileDialogService } from "../../../platform/dialogs/common/dialogs.js";
let MainThreadDialogs = class {
  constructor(context, _fileDialogService) {
    this._fileDialogService = _fileDialogService;
  }
  dispose() {
  }
  async $showOpenDialog(options) {
    const convertedOptions = MainThreadDialogs._convertOpenOptions(options);
    if (!convertedOptions.defaultUri) {
      convertedOptions.defaultUri = await this._fileDialogService.defaultFilePath();
    }
    return Promise.resolve(this._fileDialogService.showOpenDialog(convertedOptions));
  }
  async $showSaveDialog(options) {
    const convertedOptions = MainThreadDialogs._convertSaveOptions(options);
    if (!convertedOptions.defaultUri) {
      convertedOptions.defaultUri = await this._fileDialogService.defaultFilePath();
    }
    return Promise.resolve(this._fileDialogService.showSaveDialog(convertedOptions));
  }
  static _convertOpenOptions(options) {
    const result = {
      openLabel: options?.openLabel || void 0,
      canSelectFiles: options?.canSelectFiles || !options?.canSelectFiles && !options?.canSelectFolders,
      canSelectFolders: options?.canSelectFolders,
      canSelectMany: options?.canSelectMany,
      defaultUri: options?.defaultUri ? URI.revive(options.defaultUri) : void 0,
      title: options?.title || void 0,
      availableFileSystems: []
    };
    if (options?.filters) {
      result.filters = [];
      for (const [key, value] of Object.entries(options.filters)) {
        result.filters.push({ name: key, extensions: value });
      }
    }
    return result;
  }
  static _convertSaveOptions(options) {
    const result = {
      defaultUri: options?.defaultUri ? URI.revive(options.defaultUri) : void 0,
      saveLabel: options?.saveLabel || void 0,
      title: options?.title || void 0
    };
    if (options?.filters) {
      result.filters = [];
      for (const [key, value] of Object.entries(options.filters)) {
        result.filters.push({ name: key, extensions: value });
      }
    }
    return result;
  }
};
MainThreadDialogs = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadDialogs),
  __decorateParam(1, IFileDialogService)
], MainThreadDialogs);
export {
  MainThreadDialogs
};
