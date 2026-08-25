import * as resources from "../../../../base/common/resources.js";
class TMScopeRegistry {
  constructor() {
    this._scopeNameToLanguageRegistration = /* @__PURE__ */ Object.create(null);
  }
  reset() {
    this._scopeNameToLanguageRegistration = /* @__PURE__ */ Object.create(null);
  }
  register(def) {
    if (this._scopeNameToLanguageRegistration[def.scopeName]) {
      const existingRegistration = this._scopeNameToLanguageRegistration[def.scopeName];
      if (!resources.isEqual(existingRegistration.location, def.location)) {
        console.warn(
          `Overwriting grammar scope name to file mapping for scope ${def.scopeName}.
Old grammar file: ${existingRegistration.location.toString()}.
New grammar file: ${def.location.toString()}`
        );
      }
    }
    this._scopeNameToLanguageRegistration[def.scopeName] = def;
  }
  getGrammarDefinition(scopeName) {
    return this._scopeNameToLanguageRegistration[scopeName] || null;
  }
}
export {
  TMScopeRegistry
};
