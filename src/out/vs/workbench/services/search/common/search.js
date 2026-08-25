import { mapArrayOrNot } from "../../../../base/common/arrays.js";
import * as glob from "../../../../base/common/glob.js";
import * as objects from "../../../../base/common/objects.js";
import * as extpath from "../../../../base/common/extpath.js";
import { fuzzyContains, getNLines } from "../../../../base/common/strings.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import * as paths from "../../../../base/common/path.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { TextSearchCompleteMessageType } from "./searchExtTypes.js";
import { isThenable } from "../../../../base/common/async.js";
const VIEWLET_ID = "workbench.view.search";
const PANEL_ID = "workbench.panel.search";
const VIEW_ID = "workbench.view.search";
const SEARCH_RESULT_LANGUAGE_ID = "search-result";
const SEARCH_EXCLUDE_CONFIG = "search.exclude";
const DEFAULT_MAX_SEARCH_RESULTS = 2e4;
const SEARCH_ELIDED_PREFIX = "\u27EA ";
const SEARCH_ELIDED_SUFFIX = " characters skipped \u27EB";
const SEARCH_ELIDED_MIN_LEN = (SEARCH_ELIDED_PREFIX.length + SEARCH_ELIDED_SUFFIX.length + 5) * 2;
const ISearchService = createDecorator("searchService");
var SearchProviderType = /* @__PURE__ */ ((SearchProviderType2) => {
  SearchProviderType2[SearchProviderType2["file"] = 0] = "file";
  SearchProviderType2[SearchProviderType2["text"] = 1] = "text";
  SearchProviderType2[SearchProviderType2["aiText"] = 2] = "aiText";
  return SearchProviderType2;
})(SearchProviderType || {});
var QueryType = /* @__PURE__ */ ((QueryType2) => {
  QueryType2[QueryType2["File"] = 1] = "File";
  QueryType2[QueryType2["Text"] = 2] = "Text";
  QueryType2[QueryType2["aiText"] = 3] = "aiText";
  return QueryType2;
})(QueryType || {});
function resultIsMatch(result) {
  return !!result.rangeLocations && !!result.previewText;
}
function isFileMatch(p) {
  return !!p.resource;
}
function isAIKeyword(p) {
  return !!p.keyword;
}
function isProgressMessage(p) {
  return !!p.message;
}
var SearchCompletionExitCode = /* @__PURE__ */ ((SearchCompletionExitCode2) => {
  SearchCompletionExitCode2[SearchCompletionExitCode2["Normal"] = 0] = "Normal";
  SearchCompletionExitCode2[SearchCompletionExitCode2["NewSearchStarted"] = 1] = "NewSearchStarted";
  return SearchCompletionExitCode2;
})(SearchCompletionExitCode || {});
class FileMatch {
  constructor(resource) {
    this.resource = resource;
    this.results = [];
  }
}
class TextSearchMatch {
  constructor(text, ranges, previewOptions, webviewIndex) {
    this.rangeLocations = [];
    this.webviewIndex = webviewIndex;
    const rangesArr = Array.isArray(ranges) ? ranges : [ranges];
    if (previewOptions && previewOptions.matchLines === 1 && isSingleLineRangeList(rangesArr)) {
      text = getNLines(text, previewOptions.matchLines);
      let result = "";
      let shift = 0;
      let lastEnd = 0;
      const leadingChars = Math.floor(previewOptions.charsPerLine / 5);
      for (const range of rangesArr) {
        const previewStart = Math.max(range.startColumn - leadingChars, 0);
        const previewEnd = range.startColumn + previewOptions.charsPerLine;
        if (previewStart > lastEnd + leadingChars + SEARCH_ELIDED_MIN_LEN) {
          const elision = SEARCH_ELIDED_PREFIX + (previewStart - lastEnd) + SEARCH_ELIDED_SUFFIX;
          result += elision + text.slice(previewStart, previewEnd);
          shift += previewStart - (lastEnd + elision.length);
        } else {
          result += text.slice(lastEnd, previewEnd);
        }
        lastEnd = previewEnd;
        this.rangeLocations.push({
          source: range,
          preview: new OneLineRange(0, range.startColumn - shift, range.endColumn - shift)
        });
      }
      this.previewText = result;
    } else {
      const firstMatchLine = Array.isArray(ranges) ? ranges[0].startLineNumber : ranges.startLineNumber;
      const rangeLocs = mapArrayOrNot(ranges, (r) => ({
        preview: new SearchRange(r.startLineNumber - firstMatchLine, r.startColumn, r.endLineNumber - firstMatchLine, r.endColumn),
        source: r
      }));
      this.rangeLocations = Array.isArray(rangeLocs) ? rangeLocs : [rangeLocs];
      this.previewText = text;
    }
  }
}
function isSingleLineRangeList(ranges) {
  const line = ranges[0].startLineNumber;
  for (const r of ranges) {
    if (r.startLineNumber !== line || r.endLineNumber !== line) {
      return false;
    }
  }
  return true;
}
class SearchRange {
  constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
    this.startLineNumber = startLineNumber;
    this.startColumn = startColumn;
    this.endLineNumber = endLineNumber;
    this.endColumn = endColumn;
  }
}
class OneLineRange extends SearchRange {
  constructor(lineNumber, startColumn, endColumn) {
    super(lineNumber, startColumn, lineNumber, endColumn);
  }
}
var ViewMode = /* @__PURE__ */ ((ViewMode2) => {
  ViewMode2["List"] = "list";
  ViewMode2["Tree"] = "tree";
  return ViewMode2;
})(ViewMode || {});
var SearchSortOrder = /* @__PURE__ */ ((SearchSortOrder2) => {
  SearchSortOrder2["Default"] = "default";
  SearchSortOrder2["FileNames"] = "fileNames";
  SearchSortOrder2["Type"] = "type";
  SearchSortOrder2["Modified"] = "modified";
  SearchSortOrder2["CountDescending"] = "countDescending";
  SearchSortOrder2["CountAscending"] = "countAscending";
  return SearchSortOrder2;
})(SearchSortOrder || {});
var SemanticSearchBehavior = /* @__PURE__ */ ((SemanticSearchBehavior2) => {
  SemanticSearchBehavior2["Auto"] = "auto";
  SemanticSearchBehavior2["Manual"] = "manual";
  SemanticSearchBehavior2["RunOnEmpty"] = "runOnEmpty";
  return SemanticSearchBehavior2;
})(SemanticSearchBehavior || {});
function getExcludes(configuration, includeSearchExcludes = true) {
  const fileExcludes = configuration && configuration.files && configuration.files.exclude;
  const searchExcludes = includeSearchExcludes && configuration && configuration.search && configuration.search.exclude;
  if (!fileExcludes && !searchExcludes) {
    return void 0;
  }
  if (!fileExcludes || !searchExcludes) {
    return fileExcludes || searchExcludes || void 0;
  }
  let allExcludes = /* @__PURE__ */ Object.create(null);
  allExcludes = objects.mixin(allExcludes, objects.deepClone(fileExcludes));
  allExcludes = objects.mixin(allExcludes, objects.deepClone(searchExcludes), true);
  return allExcludes;
}
function pathIncludedInQuery(queryProps, fsPath) {
  const globOptions = queryProps.ignoreGlobCase ? { ignoreCase: true } : void 0;
  if (queryProps.excludePattern && glob.match(queryProps.excludePattern, fsPath, globOptions)) {
    return false;
  }
  if (queryProps.includePattern || queryProps.usingSearchPaths) {
    if (queryProps.includePattern && glob.match(queryProps.includePattern, fsPath, globOptions)) {
      return true;
    }
    if (queryProps.usingSearchPaths) {
      return !!queryProps.folderQueries && queryProps.folderQueries.some((fq) => {
        const searchPath = fq.folder.fsPath;
        if (extpath.isEqualOrParent(fsPath, searchPath, queryProps.ignoreGlobCase)) {
          const relPath = paths.relative(searchPath, fsPath);
          return !fq.includePattern || !!glob.match(fq.includePattern, relPath, globOptions);
        } else {
          return false;
        }
      });
    }
    return false;
  }
  return true;
}
var SearchErrorCode = /* @__PURE__ */ ((SearchErrorCode2) => {
  SearchErrorCode2[SearchErrorCode2["unknownEncoding"] = 1] = "unknownEncoding";
  SearchErrorCode2[SearchErrorCode2["regexParseError"] = 2] = "regexParseError";
  SearchErrorCode2[SearchErrorCode2["globParseError"] = 3] = "globParseError";
  SearchErrorCode2[SearchErrorCode2["invalidLiteral"] = 4] = "invalidLiteral";
  SearchErrorCode2[SearchErrorCode2["rgProcessError"] = 5] = "rgProcessError";
  SearchErrorCode2[SearchErrorCode2["other"] = 6] = "other";
  SearchErrorCode2[SearchErrorCode2["canceled"] = 7] = "canceled";
  return SearchErrorCode2;
})(SearchErrorCode || {});
class SearchError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
function deserializeSearchError(error) {
  const errorMsg = error.message;
  if (isCancellationError(error)) {
    return new SearchError(errorMsg, 7 /* canceled */);
  }
  try {
    const details = JSON.parse(errorMsg);
    return new SearchError(details.message, details.code);
  } catch (e) {
    return new SearchError(errorMsg, 6 /* other */);
  }
}
function serializeSearchError(searchError) {
  const details = { message: searchError.message, code: searchError.code };
  return new Error(JSON.stringify(details));
}
function isSerializedSearchComplete(arg) {
  if (arg.type === "error") {
    return true;
  } else if (arg.type === "success") {
    return true;
  } else {
    return false;
  }
}
function isSerializedSearchSuccess(arg) {
  return arg.type === "success";
}
function isSerializedFileMatch(arg) {
  return !!arg.path;
}
const filePatternIgnoreCaseOptions = { ignoreCase: true };
function isFilePatternMatch(candidate, filePatternToUse, fuzzy = true, ignoreCase) {
  const pathToMatch = candidate.searchPath ? candidate.searchPath : candidate.relativePath;
  return fuzzy ? fuzzyContains(pathToMatch, filePatternToUse) : glob.match(filePatternToUse, pathToMatch, ignoreCase ? filePatternIgnoreCaseOptions : void 0);
}
class SerializableFileMatch {
  constructor(path) {
    this.path = path;
    this.results = [];
  }
  addMatch(match) {
    this.results.push(match);
  }
  serialize() {
    return {
      path: this.path,
      results: this.results,
      numMatches: this.results.length
    };
  }
}
function resolvePatternsForProvider(globalPattern, folderPattern) {
  const merged = {
    ...globalPattern || {},
    ...folderPattern || {}
  };
  return Object.keys(merged).filter((key) => {
    const value = merged[key];
    return typeof value === "boolean" && value;
  });
}
class QueryGlobTester {
  constructor(config, folderQuery) {
    this._parsedIncludeExpression = null;
    const globOptions = config.ignoreGlobCase || folderQuery.ignoreGlobCase ? { ignoreCase: true } : void 0;
    this._excludeExpression = folderQuery.excludePattern?.map((excludePattern) => {
      return {
        ...config.excludePattern || {},
        ...excludePattern.pattern || {}
      };
    }) ?? [];
    if (this._excludeExpression.length === 0) {
      this._excludeExpression = [config.excludePattern || {}];
    }
    this._parsedExcludeExpression = this._excludeExpression.map((e) => glob.parse(e, globOptions));
    let includeExpression = config.includePattern;
    if (folderQuery.includePattern) {
      if (includeExpression) {
        includeExpression = {
          ...includeExpression,
          ...folderQuery.includePattern
        };
      } else {
        includeExpression = folderQuery.includePattern;
      }
    }
    if (includeExpression) {
      this._parsedIncludeExpression = glob.parse(includeExpression, globOptions);
    }
  }
  _evalParsedExcludeExpression(testPath, basename, hasSibling) {
    let result = null;
    for (const folderExclude of this._parsedExcludeExpression) {
      const evaluation = folderExclude(testPath, basename, hasSibling);
      if (typeof evaluation === "string") {
        result = evaluation;
        break;
      }
    }
    return result;
  }
  matchesExcludesSync(testPath, basename, hasSibling) {
    if (this._parsedExcludeExpression && this._evalParsedExcludeExpression(testPath, basename, hasSibling)) {
      return true;
    }
    return false;
  }
  /**
   * Guaranteed sync - siblingsFn should not return a promise.
   */
  includedInQuerySync(testPath, basename, hasSibling) {
    if (this._parsedExcludeExpression && this._evalParsedExcludeExpression(testPath, basename, hasSibling)) {
      return false;
    }
    if (this._parsedIncludeExpression && !this._parsedIncludeExpression(testPath, basename, hasSibling)) {
      return false;
    }
    return true;
  }
  /**
   * Evaluating the exclude expression is only async if it includes sibling clauses. As an optimization, avoid doing anything with Promises
   * unless the expression is async.
   */
  includedInQuery(testPath, basename, hasSibling) {
    const isIncluded = () => {
      return this._parsedIncludeExpression ? !!this._parsedIncludeExpression(testPath, basename, hasSibling) : true;
    };
    return Promise.all(this._parsedExcludeExpression.map((e) => {
      const excluded = e(testPath, basename, hasSibling);
      if (isThenable(excluded)) {
        return excluded.then((excluded2) => {
          if (excluded2) {
            return false;
          }
          return isIncluded();
        });
      }
      return isIncluded();
    })).then((e) => e.some((e2) => !!e2));
  }
  hasSiblingExcludeClauses() {
    return this._excludeExpression.reduce((prev, curr) => hasSiblingClauses(curr) || prev, false);
  }
}
function hasSiblingClauses(pattern) {
  for (const key in pattern) {
    if (typeof pattern[key] !== "boolean") {
      return true;
    }
  }
  return false;
}
function hasSiblingPromiseFn(siblingsFn) {
  if (!siblingsFn) {
    return void 0;
  }
  let siblings;
  return (name) => {
    if (!siblings) {
      siblings = (siblingsFn() || Promise.resolve([])).then((list) => list ? listToMap(list) : {});
    }
    return siblings.then((map) => !!map[name]);
  };
}
function hasSiblingFn(siblingsFn) {
  if (!siblingsFn) {
    return void 0;
  }
  let siblings;
  return (name) => {
    if (!siblings) {
      const list = siblingsFn();
      siblings = list ? listToMap(list) : {};
    }
    return !!siblings[name];
  };
}
function listToMap(list) {
  const map = {};
  for (const key of list) {
    map[key] = true;
  }
  return map;
}
function excludeToGlobPattern(excludesForFolder) {
  return excludesForFolder.flatMap((exclude) => exclude.patterns.map((pattern) => {
    return exclude.baseUri ? {
      baseUri: exclude.baseUri,
      pattern
    } : pattern;
  }));
}
const DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS = {
  matchLines: 100,
  charsPerLine: 1e4
};
export {
  DEFAULT_MAX_SEARCH_RESULTS,
  DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS,
  FileMatch,
  ISearchService,
  OneLineRange,
  PANEL_ID,
  QueryGlobTester,
  QueryType,
  SEARCH_EXCLUDE_CONFIG,
  SEARCH_RESULT_LANGUAGE_ID,
  SearchCompletionExitCode,
  SearchError,
  SearchErrorCode,
  SearchProviderType,
  SearchRange,
  SearchSortOrder,
  SemanticSearchBehavior,
  SerializableFileMatch,
  TextSearchCompleteMessageType,
  TextSearchMatch,
  VIEWLET_ID,
  VIEW_ID,
  ViewMode,
  deserializeSearchError,
  excludeToGlobPattern,
  getExcludes,
  hasSiblingFn,
  hasSiblingPromiseFn,
  isAIKeyword,
  isFileMatch,
  isFilePatternMatch,
  isProgressMessage,
  isSerializedFileMatch,
  isSerializedSearchComplete,
  isSerializedSearchSuccess,
  pathIncludedInQuery,
  resolvePatternsForProvider,
  resultIsMatch,
  serializeSearchError
};
