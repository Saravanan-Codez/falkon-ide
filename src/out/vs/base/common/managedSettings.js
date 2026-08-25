function extraKnownMarketplacesToConfigDict(entries) {
  if (!entries?.length) {
    return void 0;
  }
  const obj = {};
  for (const entry of entries) {
    if (typeof entry === "string") {
      if (isUnsafeMarketplaceKey(entry)) {
        continue;
      }
      obj[entry] = entry;
    } else {
      if (isUnsafeMarketplaceKey(entry.name)) {
        continue;
      }
      const s = entry.source;
      const base = s.source === "github" ? s.repo : s.url;
      const source = s.ref ? `${base}#${s.ref}` : base;
      obj[entry.name] = entry.autoUpdate === void 0 ? source : JSON.stringify({ source, autoUpdate: entry.autoUpdate });
    }
  }
  return obj;
}
function isUnsafeMarketplaceKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}
export {
  extraKnownMarketplacesToConfigDict
};
