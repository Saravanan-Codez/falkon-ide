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
import { MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { URI } from "../../../base/common/uri.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILanguagePackService } from "../../../platform/languagePacks/common/languagePacks.js";
let MainThreadLocalization = class extends Disposable {
  constructor(extHostContext, fileService, languagePackService) {
    super();
    this.fileService = fileService;
    this.languagePackService = languagePackService;
  }
  async $fetchBuiltInBundleUri(id, language) {
    try {
      const uri = await this.languagePackService.getBuiltInExtensionTranslationsUri(id, language);
      return uri;
    } catch (e) {
      return void 0;
    }
  }
  async $fetchBundleContents(uriComponents) {
    const contents = await this.fileService.readFile(URI.revive(uriComponents));
    return contents.value.toString();
  }
};
MainThreadLocalization = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadLocalization),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILanguagePackService)
], MainThreadLocalization);
export {
  MainThreadLocalization
};
