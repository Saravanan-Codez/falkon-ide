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
import { ObservablePromise } from "../../../../base/common/observable.js";
import { importAMDNodeModule } from "../../../../amdX.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { CachedFunction } from "../../../../base/common/cache.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { FileAccess, nodeModulesAsarUnpackedPath, nodeModulesPath } from "../../../../base/common/network.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
const EDITOR_EXPERIMENTAL_PREFER_TREESITTER = "editor.experimental.preferTreeSitter";
const TREESITTER_ALLOWED_SUPPORT = ["css", "typescript", "ini", "regex"];
const MODULE_LOCATION_SUBPATH = `@vscode/tree-sitter-wasm/wasm`;
const FILENAME_TREESITTER_WASM = `tree-sitter.wasm`;
function getModuleLocation(environmentService) {
  const useAsarUnpacked = environmentService.isBuilt && !isWeb;
  return `${useAsarUnpacked ? nodeModulesAsarUnpackedPath : nodeModulesPath}/${MODULE_LOCATION_SUBPATH}`;
}
let TreeSitterLibraryService = class extends Disposable {
  constructor(_configurationService, _fileService, _environmentService) {
    super();
    this._configurationService = _configurationService;
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this.isTest = false;
    this._treeSitterImport = new Lazy(async () => {
      const TreeSitter = await importAMDNodeModule("@vscode/tree-sitter-wasm", "wasm/tree-sitter.js");
      const environmentService = this._environmentService;
      const isTest = this.isTest;
      await TreeSitter.Parser.init({
        locateFile(_file, _folder) {
          const location = `${getModuleLocation(environmentService)}/${FILENAME_TREESITTER_WASM}`;
          if (isTest) {
            return FileAccess.asFileUri(location).toString(true);
          } else {
            return FileAccess.asBrowserUri(location).toString(true);
          }
        }
      });
      return TreeSitter;
    });
    this._supportsLanguage = new CachedFunction((languageId) => {
      return observableConfigValue(`${EDITOR_EXPERIMENTAL_PREFER_TREESITTER}.${languageId}`, false, this._configurationService);
    });
    this._languagesCache = new CachedFunction((languageId) => {
      return ObservablePromise.fromFn(async () => {
        const languageLocation = getModuleLocation(this._environmentService);
        const grammarName = `tree-sitter-${languageId}`;
        const wasmPath = `${languageLocation}/${grammarName}.wasm`;
        const [treeSitter, languageFile] = await Promise.all([
          this._treeSitterImport.value,
          this._fileService.readFile(FileAccess.asFileUri(wasmPath))
        ]);
        const Language = treeSitter.Language;
        const language = await Language.load(languageFile.value.buffer);
        return language;
      });
    });
    this._injectionQueries = new CachedFunction({ getCacheKey: JSON.stringify }, (arg) => {
      const loadQuerySource = async () => {
        const injectionsQueriesLocation = `vs/editor/common/languages/${arg.kind}/${arg.languageId}.scm`;
        const uri = FileAccess.asFileUri(injectionsQueriesLocation);
        if (!this._fileService.hasProvider(uri)) {
          return void 0;
        }
        const query = await tryReadFile(this._fileService, uri);
        if (query === void 0) {
          return void 0;
        }
        return query.value.toString();
      };
      return ObservablePromise.fromFn(async () => {
        const [
          querySource,
          language,
          treeSitter
        ] = await Promise.all([
          loadQuerySource(),
          this._languagesCache.get(arg.languageId).promise,
          this._treeSitterImport.value
        ]);
        if (querySource === void 0) {
          return null;
        }
        const Query = treeSitter.Query;
        return new Query(language, querySource);
      }).resolvedValue;
    });
  }
  supportsLanguage(languageId, reader) {
    return this._supportsLanguage.get(languageId).read(reader);
  }
  async getParserClass() {
    const treeSitter = await this._treeSitterImport.value;
    return treeSitter.Parser;
  }
  getLanguage(languageId, ignoreSupportsCheck, reader) {
    if (!ignoreSupportsCheck && !this.supportsLanguage(languageId, reader)) {
      return void 0;
    }
    const lang = this._languagesCache.get(languageId).resolvedValue.read(reader);
    return lang;
  }
  async getLanguagePromise(languageId) {
    return this._languagesCache.get(languageId).promise;
  }
  getInjectionQueries(languageId, reader) {
    if (!this.supportsLanguage(languageId, reader)) {
      return void 0;
    }
    const query = this._injectionQueries.get({ languageId, kind: "injections" }).read(reader);
    return query;
  }
  getHighlightingQueries(languageId, reader) {
    if (!this.supportsLanguage(languageId, reader)) {
      return void 0;
    }
    const query = this._injectionQueries.get({ languageId, kind: "highlights" }).read(reader);
    return query;
  }
  async createQuery(language, querySource) {
    const treeSitter = await this._treeSitterImport.value;
    return new treeSitter.Query(language, querySource);
  }
};
TreeSitterLibraryService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IEnvironmentService)
], TreeSitterLibraryService);
async function tryReadFile(fileService, uri) {
  try {
    const result = await fileService.readFile(uri);
    return result;
  } catch (e) {
    if (toFileOperationResult(e) === FileOperationResult.FILE_NOT_FOUND) {
      return void 0;
    }
    throw e;
  }
}
export {
  EDITOR_EXPERIMENTAL_PREFER_TREESITTER,
  TREESITTER_ALLOWED_SUPPORT,
  TreeSitterLibraryService,
  getModuleLocation
};
