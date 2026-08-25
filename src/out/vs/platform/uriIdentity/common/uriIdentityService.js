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
import { IUriIdentityService } from "./uriIdentity.js";
import { URI } from "../../../base/common/uri.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { IFileService, FileSystemProviderCapabilities } from "../../files/common/files.js";
import { ExtUri, normalizePath } from "../../../base/common/resources.js";
import { Event } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { quickSelect } from "../../../base/common/arrays.js";
class Entry {
  constructor(uri) {
    this.uri = uri;
    this.time = Entry._clock++;
  }
  static {
    this._clock = 0;
  }
  touch() {
    this.time = Entry._clock++;
    return this;
  }
}
let UriIdentityService = class {
  constructor(_fileService) {
    this._fileService = _fileService;
    this._dispooables = new DisposableStore();
    this._limit = 2 ** 16;
    const schemeIgnoresPathCasingCache = /* @__PURE__ */ new Map();
    const ignorePathCasing = (uri) => {
      let ignorePathCasing2 = schemeIgnoresPathCasingCache.get(uri.scheme);
      if (ignorePathCasing2 === void 0) {
        ignorePathCasing2 = _fileService.hasProvider(uri) && !this._fileService.hasCapability(uri, FileSystemProviderCapabilities.PathCaseSensitive);
        schemeIgnoresPathCasingCache.set(uri.scheme, ignorePathCasing2);
      }
      return ignorePathCasing2;
    };
    this._dispooables.add(Event.any(
      _fileService.onDidChangeFileSystemProviderRegistrations,
      _fileService.onDidChangeFileSystemProviderCapabilities
    )((e) => {
      const oldIgnorePathCasingValue = schemeIgnoresPathCasingCache.get(e.scheme);
      if (oldIgnorePathCasingValue === void 0) {
        return;
      }
      schemeIgnoresPathCasingCache.delete(e.scheme);
      const newIgnorePathCasingValue = ignorePathCasing(URI.from({ scheme: e.scheme }));
      if (newIgnorePathCasingValue === newIgnorePathCasingValue) {
        return;
      }
      for (const [key, entry] of this._canonicalUris.entries()) {
        if (entry.uri.scheme !== e.scheme) {
          continue;
        }
        this._canonicalUris.delete(key);
      }
    }));
    this.extUri = new ExtUri(ignorePathCasing);
    this._canonicalUris = /* @__PURE__ */ new Map();
  }
  dispose() {
    this._dispooables.dispose();
    this._canonicalUris.clear();
  }
  asCanonicalUri(uri) {
    if (this._fileService.hasProvider(uri)) {
      uri = normalizePath(uri);
    }
    const uriKey = this.extUri.getComparisonKey(uri, true);
    const item = this._canonicalUris.get(uriKey);
    if (item) {
      return item.touch().uri.with({ fragment: uri.fragment });
    }
    this._canonicalUris.set(uriKey, new Entry(uri));
    this._checkTrim();
    return uri;
  }
  _checkTrim() {
    if (this._canonicalUris.size < this._limit) {
      return;
    }
    Entry._clock = 1;
    const times = [...this._canonicalUris.values()].map((e) => e.time);
    const median = quickSelect(
      Math.floor(times.length / 2),
      times,
      (a, b) => a - b
    );
    for (const [key, entry] of this._canonicalUris.entries()) {
      if (entry.time <= median) {
        this._canonicalUris.delete(key);
      } else {
        entry.time = 0;
      }
    }
  }
};
UriIdentityService = __decorateClass([
  __decorateParam(0, IFileService)
], UriIdentityService);
registerSingleton(IUriIdentityService, UriIdentityService, InstantiationType.Delayed);
export {
  UriIdentityService
};
