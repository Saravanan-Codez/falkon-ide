class StandaloneTreeSitterLibraryService {
  getParserClass() {
    throw new Error("not implemented in StandaloneTreeSitterLibraryService");
  }
  supportsLanguage(languageId, reader) {
    return false;
  }
  getLanguage(languageId, ignoreSupportsCheck, reader) {
    return void 0;
  }
  async getLanguagePromise(languageId) {
    return void 0;
  }
  getInjectionQueries(languageId, reader) {
    return null;
  }
  getHighlightingQueries(languageId, reader) {
    return null;
  }
  async createQuery(language, querySource) {
    throw new Error("not implemented in StandaloneTreeSitterLibraryService");
  }
}
export {
  StandaloneTreeSitterLibraryService
};
