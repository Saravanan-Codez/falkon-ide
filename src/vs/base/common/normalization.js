import { LRUCache } from "./map.js";
const nfcCache = new LRUCache(1e4);
function normalizeNFC(str) {
  return normalize(str, "NFC", nfcCache);
}
const nfdCache = new LRUCache(1e4);
function normalizeNFD(str) {
  return normalize(str, "NFD", nfdCache);
}
const nonAsciiCharactersPattern = /[^\u0000-\u0080]/;
function normalize(str, form, normalizedCache) {
  if (!str) {
    return str;
  }
  const cached = normalizedCache.get(str);
  if (cached) {
    return cached;
  }
  let res;
  if (nonAsciiCharactersPattern.test(str)) {
    res = str.normalize(form);
  } else {
    res = str;
  }
  normalizedCache.set(str, res);
  return res;
}
const tryNormalizeToBase = (function() {
  const cache = new LRUCache(1e4);
  const accentsRegex = /[\u0300-\u036f]/g;
  return function(str) {
    const cached = cache.get(str);
    if (cached) {
      return cached;
    }
    const noAccents = normalizeNFD(str).replace(accentsRegex, "");
    const result = (noAccents.length === str.length ? noAccents : str).toLowerCase();
    cache.set(str, result);
    return result;
  };
})();
export {
  normalizeNFC,
  normalizeNFD,
  tryNormalizeToBase
};
