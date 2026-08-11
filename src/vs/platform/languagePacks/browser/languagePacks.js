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
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { URI } from "../../../base/common/uri.js";
import { IExtensionGalleryService } from "../../extensionManagement/common/extensionManagement.js";
import { IExtensionResourceLoaderService } from "../../extensionResourceLoader/common/extensionResourceLoader.js";
import { LanguagePackBaseService } from "../common/languagePacks.js";
import { ILogService } from "../../log/common/log.js";
let WebLanguagePacksService = class extends LanguagePackBaseService {
  constructor(extensionResourceLoaderService, extensionGalleryService, logService) {
    super(extensionGalleryService);
    this.extensionResourceLoaderService = extensionResourceLoaderService;
    this.logService = logService;
  }
  async getBuiltInExtensionTranslationsUri(id, language) {
    const queryTimeout = new CancellationTokenSource();
    setTimeout(() => queryTimeout.cancel(), 1e3);
    let result;
    try {
      result = await this.extensionGalleryService.query({
        text: `tag:"lp-${language}"`,
        pageSize: 5
      }, queryTimeout.token);
    } catch (err) {
      this.logService.error(err);
      return void 0;
    }
    const languagePackExtensions = result.firstPage.find((e) => e.properties.localizedLanguages?.length);
    if (!languagePackExtensions) {
      this.logService.trace(`No language pack found for language ${language}`);
      return void 0;
    }
    const manifestTimeout = new CancellationTokenSource();
    setTimeout(() => queryTimeout.cancel(), 1e3);
    const manifest = await this.extensionGalleryService.getManifest(languagePackExtensions, manifestTimeout.token);
    const localization = manifest?.contributes?.localizations?.find((l) => l.languageId === language);
    const translation = localization?.translations.find((t) => t.id === id);
    if (!translation) {
      this.logService.trace(`No translation found for id '${id}, in ${manifest?.name}`);
      return void 0;
    }
    const uri = await this.extensionResourceLoaderService.getExtensionGalleryResourceURL({
      // If translation is defined then manifest should have been defined.
      name: manifest.name,
      publisher: manifest.publisher,
      version: manifest.version
    });
    if (!uri) {
      this.logService.trace("Gallery does not provide extension resources.");
      return void 0;
    }
    return URI.joinPath(uri, translation.path);
  }
  // Web doesn't have a concept of language packs, so we just return an empty array
  getInstalledLanguages() {
    return Promise.resolve([]);
  }
};
WebLanguagePacksService = __decorateClass([
  __decorateParam(0, IExtensionResourceLoaderService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, ILogService)
], WebLanguagePacksService);
export {
  WebLanguagePacksService
};
