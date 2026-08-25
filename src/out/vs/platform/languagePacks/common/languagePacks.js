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
import { Disposable } from "../../../base/common/lifecycle.js";
import { language } from "../../../base/common/platform.js";
import { localize } from "../../../nls.js";
import { IExtensionGalleryService } from "../../extensionManagement/common/extensionManagement.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
function getLocale(extension) {
  return extension.tags.find((t) => t.startsWith("lp-"))?.split("lp-")[1];
}
const ILanguagePackService = createDecorator("languagePackService");
let LanguagePackBaseService = class extends Disposable {
  constructor(extensionGalleryService) {
    super();
    this.extensionGalleryService = extensionGalleryService;
  }
  async getAvailableLanguages() {
    const timeout = new CancellationTokenSource();
    setTimeout(() => timeout.cancel(), 1e3);
    let result;
    try {
      result = await this.extensionGalleryService.query({
        text: 'category:"language packs"',
        pageSize: 20
      }, timeout.token);
    } catch (_) {
      return [];
    }
    const languagePackExtensions = result.firstPage.filter((e) => e.properties.localizedLanguages?.length && e.tags.some((t) => t.startsWith("lp-")));
    const allFromMarketplace = languagePackExtensions.map((lp) => {
      const languageName = lp.properties.localizedLanguages?.[0];
      const locale = getLocale(lp);
      const baseQuickPick = this.createQuickPickItem(locale, languageName, lp);
      return {
        ...baseQuickPick,
        extensionId: lp.identifier.id,
        galleryExtension: lp
      };
    });
    allFromMarketplace.push(this.createQuickPickItem("en", "English"));
    return allFromMarketplace;
  }
  createQuickPickItem(locale, languageName, languagePack) {
    const label = languageName ?? locale;
    let description;
    if (label !== locale) {
      description = `(${locale})`;
    }
    if (locale.toLowerCase() === language.toLowerCase()) {
      description ??= "";
      description += localize("currentDisplayLanguage", " (Current)");
    }
    if (languagePack?.installCount) {
      description ??= "";
      const count = languagePack.installCount;
      let countLabel;
      if (count > 1e6) {
        countLabel = `${Math.floor(count / 1e5) / 10}M`;
      } else if (count > 1e3) {
        countLabel = `${Math.floor(count / 1e3)}K`;
      } else {
        countLabel = String(count);
      }
      description += ` $(cloud-download) ${countLabel}`;
    }
    return {
      id: locale,
      label,
      description
    };
  }
};
LanguagePackBaseService = __decorateClass([
  __decorateParam(0, IExtensionGalleryService)
], LanguagePackBaseService);
export {
  ILanguagePackService,
  LanguagePackBaseService,
  getLocale
};
