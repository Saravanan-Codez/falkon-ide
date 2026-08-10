import { LRUCache } from "../../../base/common/map.js";
import { extUriIgnorePathCase } from "../../../base/common/resources.js";
class WebContentCache {
  constructor() {
    // 5 minutes
    this._cache = new LRUCache(WebContentCache.MAX_CACHE_SIZE);
  }
  static {
    this.MAX_CACHE_SIZE = 1e3;
  }
  static {
    this.SUCCESS_CACHE_DURATION = 1e3 * 60 * 60 * 24;
  }
  static {
    // 24 hours
    this.ERROR_CACHE_DURATION = 1e3 * 60 * 5;
  }
  /**
   * Add a web content extraction result to the cache.
   */
  add(uri, options, result) {
    let expiration;
    switch (result.status) {
      case "ok":
      case "redirect":
        expiration = Date.now() + WebContentCache.SUCCESS_CACHE_DURATION;
        break;
      default:
        expiration = Date.now() + WebContentCache.ERROR_CACHE_DURATION;
        break;
    }
    const key = WebContentCache.getKey(uri, options);
    this._cache.set(key, { result, options, expiration });
  }
  /**
   * Try to get a cached web content extraction result for the given URI and options.
   */
  tryGet(uri, options) {
    const key = WebContentCache.getKey(uri, options);
    const entry = this._cache.get(key);
    if (entry === void 0) {
      return void 0;
    }
    if (entry.expiration < Date.now()) {
      this._cache.delete(key);
      return void 0;
    }
    return entry.result;
  }
  /**
   * Clear all cached entries.
   */
  clear() {
    this._cache.clear();
  }
  static getKey(uri, options) {
    return `${!!options?.followRedirects}${extUriIgnorePathCase.getComparisonKey(uri)}`;
  }
}
export {
  WebContentCache
};
