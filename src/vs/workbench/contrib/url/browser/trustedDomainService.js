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
import { WindowIdleValue } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { TRUSTED_DOMAINS_STORAGE_KEY, readStaticTrustedDomains } from "./trustedDomains.js";
import { isURLDomainTrusted } from "../../../../platform/url/common/trustedDomains.js";
import { Emitter } from "../../../../base/common/event.js";
import { ITrustedDomainService } from "../common/trustedDomainService.js";
let TrustedDomainService = class extends Disposable {
  constructor(_instantiationService, _storageService) {
    super();
    this._instantiationService = _instantiationService;
    this._storageService = _storageService;
    this._onDidChangeTrustedDomains = this._register(new Emitter());
    this.onDidChangeTrustedDomains = this._onDidChangeTrustedDomains.event;
    const initStaticDomainsResult = () => {
      return new WindowIdleValue(mainWindow, () => {
        const { defaultTrustedDomains, trustedDomains } = this._instantiationService.invokeFunction(readStaticTrustedDomains);
        return [
          ...defaultTrustedDomains,
          ...trustedDomains
        ];
      });
    };
    this._staticTrustedDomainsResult = initStaticDomainsResult();
    this._register(this._storageService.onDidChangeValue(StorageScope.APPLICATION, TRUSTED_DOMAINS_STORAGE_KEY, this._store)(() => {
      this._staticTrustedDomainsResult?.dispose();
      this._staticTrustedDomainsResult = initStaticDomainsResult();
      this._onDidChangeTrustedDomains.fire();
    }));
  }
  get trustedDomains() {
    return this._staticTrustedDomainsResult.value;
  }
  isValid(resource) {
    const { defaultTrustedDomains, trustedDomains } = this._instantiationService.invokeFunction(readStaticTrustedDomains);
    const allTrustedDomains = [...defaultTrustedDomains, ...trustedDomains];
    return isURLDomainTrusted(resource, allTrustedDomains);
  }
};
TrustedDomainService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService)
], TrustedDomainService);
export {
  ITrustedDomainService,
  TrustedDomainService
};
