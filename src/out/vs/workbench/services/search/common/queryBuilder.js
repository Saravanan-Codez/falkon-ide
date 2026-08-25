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
import * as arrays from "../../../../base/common/arrays.js";
import * as collections from "../../../../base/common/collections.js";
import * as glob from "../../../../base/common/glob.js";
import { untildify } from "../../../../base/common/labels.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import * as path from "../../../../base/common/path.js";
import { isEqual, basename, relativePath, isAbsolutePath } from "../../../../base/common/resources.js";
import * as strings from "../../../../base/common/strings.js";
import { assertReturnsDefined, isDefined } from "../../../../base/common/types.js";
import { URI, URI as uri } from "../../../../base/common/uri.js";
import { isMultilineRegexSource } from "../../../../editor/common/model/textModelSearch.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, toWorkspaceFolder, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
import { IPathService } from "../../path/common/pathService.js";
import { getExcludes, pathIncludedInQuery, QueryType } from "./search.js";
function isISearchPatternBuilder(object) {
  return typeof object === "object" && "uri" in object && "pattern" in object;
}
function globPatternToISearchPatternBuilder(globPattern) {
  if (typeof globPattern === "string") {
    return {
      pattern: globPattern
    };
  }
  return {
    pattern: globPattern.pattern,
    uri: globPattern.baseUri
  };
}
let QueryBuilder = class {
  constructor(configurationService, workspaceContextService, editorGroupsService, logService, pathService, uriIdentityService) {
    this.configurationService = configurationService;
    this.workspaceContextService = workspaceContextService;
    this.editorGroupsService = editorGroupsService;
    this.logService = logService;
    this.pathService = pathService;
    this.uriIdentityService = uriIdentityService;
  }
  aiText(contentPattern, folderResources, options = {}) {
    const commonQuery = this.commonQuery(folderResources?.map(toWorkspaceFolder), options);
    return {
      ...commonQuery,
      type: QueryType.aiText,
      contentPattern
    };
  }
  text(contentPattern, folderResources, options = {}) {
    contentPattern = this.getContentPattern(contentPattern, options);
    const commonQuery = this.commonQuery(folderResources?.map(toWorkspaceFolder), options);
    return {
      ...commonQuery,
      type: QueryType.Text,
      contentPattern,
      previewOptions: options.previewOptions,
      maxFileSize: options.maxFileSize,
      surroundingContext: options.surroundingContext,
      userDisabledExcludesAndIgnoreFiles: options.disregardExcludeSettings && options.disregardIgnoreFiles
    };
  }
  /**
   * Adjusts input pattern for config
   */
  getContentPattern(inputPattern, options) {
    const searchConfig = this.configurationService.getValue();
    if (inputPattern.isRegExp) {
      inputPattern.pattern = inputPattern.pattern.replace(/\r?\n/g, "\\n");
    }
    const newPattern = {
      ...inputPattern,
      wordSeparators: searchConfig.editor.wordSeparators
    };
    if (this.isCaseSensitive(inputPattern, options)) {
      newPattern.isCaseSensitive = true;
    }
    if (this.isMultiline(inputPattern)) {
      newPattern.isMultiline = true;
    }
    if (options.notebookSearchConfig?.includeMarkupInput) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookMarkdownInput = options.notebookSearchConfig.includeMarkupInput;
    }
    if (options.notebookSearchConfig?.includeMarkupPreview) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookMarkdownPreview = options.notebookSearchConfig.includeMarkupPreview;
    }
    if (options.notebookSearchConfig?.includeCodeInput) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookCellInput = options.notebookSearchConfig.includeCodeInput;
    }
    if (options.notebookSearchConfig?.includeOutput) {
      if (!newPattern.notebookInfo) {
        newPattern.notebookInfo = {};
      }
      newPattern.notebookInfo.isInNotebookCellOutput = options.notebookSearchConfig.includeOutput;
    }
    return newPattern;
  }
  file(folders, options = {}) {
    const commonQuery = this.commonQuery(folders, options);
    return {
      ...commonQuery,
      type: QueryType.File,
      filePattern: options.filePattern ? options.filePattern.trim() : options.filePattern,
      exists: options.exists,
      sortByScore: options.sortByScore,
      cacheKey: options.cacheKey,
      shouldGlobMatchFilePattern: options.shouldGlobSearch
    };
  }
  handleIncludeExclude(pattern, expandPatterns) {
    if (!pattern) {
      return {};
    }
    if (Array.isArray(pattern)) {
      pattern = pattern.filter((p) => p.length > 0).map(normalizeSlashes);
      if (!pattern.length) {
        return {};
      }
    } else {
      pattern = normalizeSlashes(pattern);
    }
    return expandPatterns ? this.parseSearchPaths(pattern) : { pattern: patternListToIExpression(...Array.isArray(pattern) ? pattern : [pattern]) };
  }
  commonQuery(folderResources = [], options = {}) {
    let excludePatterns = Array.isArray(options.excludePattern) ? options.excludePattern.map((p) => p.pattern).flat() : options.excludePattern;
    excludePatterns = excludePatterns?.length === 1 ? excludePatterns[0] : excludePatterns;
    const includeSearchPathsInfo = this.handleIncludeExclude(options.includePattern, options.expandPatterns);
    const excludeSearchPathsInfo = this.handleIncludeExclude(excludePatterns, options.expandPatterns);
    const includeFolderName = folderResources.length > 1;
    const folderQueries = (includeSearchPathsInfo.searchPaths && includeSearchPathsInfo.searchPaths.length ? includeSearchPathsInfo.searchPaths.map((searchPath) => this.getFolderQueryForSearchPath(searchPath, options, excludeSearchPathsInfo)) : folderResources.map((folder) => this.getFolderQueryForRoot(folder, options, excludeSearchPathsInfo, includeFolderName))).filter((query) => !!query);
    const queryProps = {
      _reason: options._reason,
      folderQueries,
      usingSearchPaths: !!(includeSearchPathsInfo.searchPaths && includeSearchPathsInfo.searchPaths.length),
      extraFileResources: options.extraFileResources,
      excludePattern: excludeSearchPathsInfo.pattern,
      includePattern: includeSearchPathsInfo.pattern,
      ignoreGlobCase: options.ignoreGlobCase,
      onlyOpenEditors: options.onlyOpenEditors,
      maxResults: options.maxResults,
      onlyFileScheme: options.onlyFileScheme
    };
    if (options.onlyOpenEditors) {
      const openEditors = arrays.coalesce(this.editorGroupsService.groups.flatMap((group) => group.editors.map((editor) => editor.resource)));
      this.logService.trace("QueryBuilder#commonQuery - openEditor URIs", JSON.stringify(openEditors));
      const openEditorsInQuery = openEditors.filter((editor) => pathIncludedInQuery(queryProps, editor.fsPath));
      const openEditorsQueryProps = this.commonQueryFromFileList(openEditorsInQuery);
      this.logService.trace("QueryBuilder#commonQuery - openEditor Query", JSON.stringify(openEditorsQueryProps));
      return { ...queryProps, ...openEditorsQueryProps };
    }
    if (options.changedFileUris !== void 0) {
      const changedFilesInQuery = options.changedFileUris.filter((uri2) => pathIncludedInQuery(queryProps, uri2.fsPath));
      const changedFilesQueryProps = this.commonQueryFromFileList(changedFilesInQuery);
      this.logService.trace("QueryBuilder#commonQuery - changedFile Query", JSON.stringify(changedFilesQueryProps));
      return { ...queryProps, ...changedFilesQueryProps };
    }
    const extraFileResources = options.extraFileResources && options.extraFileResources.filter((extraFile) => pathIncludedInQuery(queryProps, extraFile.fsPath));
    queryProps.extraFileResources = extraFileResources && extraFileResources.length ? extraFileResources : void 0;
    return queryProps;
  }
  commonQueryFromFileList(files) {
    const folderQueries = [];
    const foldersToSearch = new ResourceMap();
    const includePattern = {};
    let hasIncludedFile = false;
    files.forEach((file) => {
      if (file.scheme === Schemas.walkThrough) {
        return;
      }
      const providerExists = isAbsolutePath(file);
      if (providerExists) {
        const searchRoot = this.workspaceContextService.getWorkspaceFolder(file)?.uri ?? this.uriIdentityService.extUri.dirname(file);
        let folderQuery = foldersToSearch.get(searchRoot);
        if (!folderQuery) {
          hasIncludedFile = true;
          folderQuery = { folder: searchRoot, includePattern: {} };
          folderQueries.push(folderQuery);
          foldersToSearch.set(searchRoot, folderQuery);
        }
        const relPath = path.relative(searchRoot.fsPath, file.fsPath);
        assertReturnsDefined(folderQuery.includePattern)[escapeGlobPattern(relPath.replace(/\\/g, "/"))] = true;
      } else {
        if (file.fsPath) {
          hasIncludedFile = true;
          includePattern[escapeGlobPattern(file.fsPath)] = true;
        }
      }
    });
    return {
      folderQueries,
      includePattern,
      usingSearchPaths: true,
      excludePattern: hasIncludedFile ? void 0 : { "**/*": true }
    };
  }
  /**
   * Resolve isCaseSensitive flag based on the query and the isSmartCase flag, for search providers that don't support smart case natively.
   */
  isCaseSensitive(contentPattern, options) {
    if (options.isSmartCase) {
      if (contentPattern.isRegExp) {
        if (strings.containsUppercaseCharacter(contentPattern.pattern, true)) {
          return true;
        }
      } else if (strings.containsUppercaseCharacter(contentPattern.pattern)) {
        return true;
      }
    }
    return !!contentPattern.isCaseSensitive;
  }
  isMultiline(contentPattern) {
    if (contentPattern.isMultiline) {
      return true;
    }
    if (contentPattern.isRegExp && isMultilineRegexSource(contentPattern.pattern)) {
      return true;
    }
    if (contentPattern.pattern.indexOf("\n") >= 0) {
      return true;
    }
    return !!contentPattern.isMultiline;
  }
  /**
   * Take the includePattern as seen in the search viewlet, and split into components that look like searchPaths, and
   * glob patterns. Glob patterns are expanded from 'foo/bar' to '{foo/bar/**, **\/foo/bar}.
   *
   * Public for test.
   */
  parseSearchPaths(pattern) {
    const isSearchPath = (segment) => {
      return path.isAbsolute(segment) || /^\.\.?([\/\\]|$)/.test(segment);
    };
    const patterns = Array.isArray(pattern) ? pattern : splitGlobPattern(pattern);
    const segments = patterns.map((segment) => {
      const userHome = this.pathService.resolvedUserHome;
      if (userHome) {
        return untildify(segment, userHome.scheme === Schemas.file ? userHome.fsPath : userHome.path);
      }
      return segment;
    });
    const groups = collections.groupBy(
      segments,
      (segment) => isSearchPath(segment) ? "searchPaths" : "exprSegments"
    );
    const expandedExprSegments = (groups.exprSegments || []).map((s) => strings.rtrim(s, "/")).map((s) => strings.rtrim(s, "\\")).map((p) => {
      if (p[0] === ".") {
        p = "*" + p;
      }
      return expandGlobalGlob(p);
    });
    const result = {};
    const searchPaths = this.expandSearchPathPatterns(groups.searchPaths || []);
    if (searchPaths && searchPaths.length) {
      result.searchPaths = searchPaths;
    }
    const exprSegments = expandedExprSegments.flat();
    const includePattern = patternListToIExpression(...exprSegments);
    if (includePattern) {
      result.pattern = includePattern;
    }
    return result;
  }
  getExcludesForFolder(folderConfig, options) {
    return options.disregardExcludeSettings ? void 0 : getExcludes(folderConfig, !options.disregardSearchExcludeSettings);
  }
  /**
   * Split search paths (./ or ../ or absolute paths in the includePatterns) into absolute paths and globs applied to those paths
   */
  expandSearchPathPatterns(searchPaths) {
    if (!searchPaths || !searchPaths.length) {
      return [];
    }
    const expandedSearchPaths = searchPaths.flatMap((searchPath) => {
      let { pathPortion, globPortion } = splitGlobFromPath(searchPath);
      if (globPortion) {
        globPortion = normalizeGlobPattern(globPortion);
      }
      const oneExpanded = this.expandOneSearchPath(pathPortion);
      return oneExpanded.flatMap((oneExpandedResult) => this.resolveOneSearchPathPattern(oneExpandedResult, globPortion));
    });
    const searchPathPatternMap = /* @__PURE__ */ new Map();
    expandedSearchPaths.forEach((oneSearchPathPattern) => {
      const key = oneSearchPathPattern.searchPath.toString();
      const existing = searchPathPatternMap.get(key);
      if (existing) {
        if (oneSearchPathPattern.pattern) {
          existing.pattern = existing.pattern || {};
          existing.pattern[oneSearchPathPattern.pattern] = true;
        }
      } else {
        searchPathPatternMap.set(key, {
          searchPath: oneSearchPathPattern.searchPath,
          pattern: oneSearchPathPattern.pattern ? patternListToIExpression(oneSearchPathPattern.pattern) : void 0
        });
      }
    });
    return Array.from(searchPathPatternMap.values());
  }
  /**
   * Takes a searchPath like `./a/foo` or `../a/foo` and expands it to absolute paths for all the workspaces it matches.
   */
  expandOneSearchPath(searchPath) {
    if (path.isAbsolute(searchPath)) {
      const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
      if (workspaceFolders[0] && workspaceFolders[0].uri.scheme !== Schemas.file) {
        return [{
          searchPath: workspaceFolders[0].uri.with({ path: searchPath })
        }];
      }
      return [{
        searchPath: uri.file(path.normalize(searchPath))
      }];
    }
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      const workspaceUri = this.workspaceContextService.getWorkspace().folders[0].uri;
      searchPath = normalizeSlashes(searchPath);
      if (searchPath.startsWith("../") || searchPath === "..") {
        const resolvedPath = path.posix.resolve(workspaceUri.path, searchPath);
        return [{
          searchPath: workspaceUri.with({ path: resolvedPath })
        }];
      }
      const cleanedPattern = normalizeGlobPattern(searchPath);
      return [{
        searchPath: workspaceUri,
        pattern: cleanedPattern
      }];
    } else if (searchPath === "./" || searchPath === ".\\") {
      return [];
    } else {
      const searchPathWithoutDotSlash = searchPath.replace(/^\.[\/\\]/, "");
      const folders = this.workspaceContextService.getWorkspace().folders;
      const folderMatches = folders.map((folder) => {
        const match = searchPathWithoutDotSlash.match(new RegExp(`^${strings.escapeRegExpCharacters(folder.name)}(?:/(.*)|$)`));
        return match ? {
          match,
          folder
        } : null;
      }).filter(isDefined);
      if (folderMatches.length) {
        return folderMatches.map((match) => {
          const patternMatch = match.match[1];
          return {
            searchPath: match.folder.uri,
            pattern: patternMatch && normalizeGlobPattern(patternMatch)
          };
        });
      } else {
        const probableWorkspaceFolderNameMatch = searchPath.match(/\.[\/\\](.+)[\/\\]?/);
        const probableWorkspaceFolderName = probableWorkspaceFolderNameMatch ? probableWorkspaceFolderNameMatch[1] : searchPath;
        const searchPathNotFoundError = nls.localize("search.noWorkspaceWithName", "Workspace folder does not exist: {0}", probableWorkspaceFolderName);
        throw new Error(searchPathNotFoundError);
      }
    }
  }
  resolveOneSearchPathPattern(oneExpandedResult, globPortion) {
    const pattern = oneExpandedResult.pattern && globPortion ? `${oneExpandedResult.pattern}/${globPortion}` : oneExpandedResult.pattern || globPortion;
    const results = [
      {
        searchPath: oneExpandedResult.searchPath,
        pattern
      }
    ];
    if (pattern && !pattern.endsWith("**")) {
      results.push({
        searchPath: oneExpandedResult.searchPath,
        pattern: pattern + "/**"
      });
    }
    return results;
  }
  getFolderQueryForSearchPath(searchPath, options, searchPathExcludes) {
    const rootConfig = this.getFolderQueryForRoot(toWorkspaceFolder(searchPath.searchPath), options, searchPathExcludes, false);
    if (!rootConfig) {
      return null;
    }
    return {
      ...rootConfig,
      ...{
        includePattern: searchPath.pattern
      }
    };
  }
  getFolderQueryForRoot(folder, options, searchPathExcludes, includeFolderName) {
    let thisFolderExcludeSearchPathPattern;
    const folderUri = URI.isUri(folder) ? folder : folder.uri;
    let excludeFolderRoots = options.excludePattern?.map((excludePattern2) => {
      const excludeRoot = options.excludePattern && isISearchPatternBuilder(excludePattern2) ? excludePattern2.uri : void 0;
      const shouldUseExcludeRoot = !excludeRoot || !(URI.isUri(folder) && this.uriIdentityService.extUri.isEqual(folder, excludeRoot));
      return shouldUseExcludeRoot ? excludeRoot : void 0;
    });
    if (!excludeFolderRoots?.length) {
      excludeFolderRoots = [void 0];
    }
    if (searchPathExcludes.searchPaths) {
      const thisFolderExcludeSearchPath = searchPathExcludes.searchPaths.filter((sp) => isEqual(sp.searchPath, folderUri))[0];
      if (thisFolderExcludeSearchPath && !thisFolderExcludeSearchPath.pattern) {
        return null;
      } else if (thisFolderExcludeSearchPath) {
        thisFolderExcludeSearchPathPattern = thisFolderExcludeSearchPath.pattern;
      }
    }
    const folderConfig = this.configurationService.getValue({ resource: folderUri });
    const settingExcludes = this.getExcludesForFolder(folderConfig, options);
    const excludePattern = {
      ...settingExcludes || {},
      ...thisFolderExcludeSearchPathPattern || {}
    };
    const folderName = URI.isUri(folder) ? basename(folder) : folder.name;
    const excludePatternRet = excludeFolderRoots.map((excludeFolderRoot) => {
      return Object.keys(excludePattern).length > 0 ? {
        folder: excludeFolderRoot,
        pattern: excludePattern
      } : void 0;
    }).filter((e) => e);
    return {
      folder: folderUri,
      folderName: includeFolderName ? folderName : void 0,
      excludePattern: excludePatternRet,
      fileEncoding: folderConfig.files && folderConfig.files.encoding,
      disregardIgnoreFiles: typeof options.disregardIgnoreFiles === "boolean" ? options.disregardIgnoreFiles : !folderConfig.search?.useIgnoreFiles,
      disregardGlobalIgnoreFiles: typeof options.disregardGlobalIgnoreFiles === "boolean" ? options.disregardGlobalIgnoreFiles : !folderConfig.search?.useGlobalIgnoreFiles,
      disregardParentIgnoreFiles: typeof options.disregardParentIgnoreFiles === "boolean" ? options.disregardParentIgnoreFiles : !folderConfig.search?.useParentIgnoreFiles,
      ignoreSymlinks: typeof options.ignoreSymlinks === "boolean" ? options.ignoreSymlinks : !folderConfig.search?.followSymlinks,
      ignoreGlobCase: options.ignoreGlobCase
    };
  }
};
QueryBuilder = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEditorGroupsService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IPathService),
  __decorateParam(5, IUriIdentityService)
], QueryBuilder);
function splitGlobFromPath(searchPath) {
  const globCharMatch = searchPath.match(/[\*\{\}\(\)\[\]\?]/);
  if (globCharMatch) {
    const globCharIdx = globCharMatch.index;
    const lastSlashMatch = searchPath.substr(0, globCharIdx).match(/[/|\\][^/\\]*$/);
    if (lastSlashMatch) {
      let pathPortion = searchPath.substr(0, lastSlashMatch.index);
      if (!pathPortion.match(/[/\\]/)) {
        pathPortion += "/";
      }
      return {
        pathPortion,
        globPortion: searchPath.substr((lastSlashMatch.index || 0) + 1)
      };
    }
  }
  return {
    pathPortion: searchPath
  };
}
function patternListToIExpression(...patterns) {
  return patterns.length ? patterns.reduce((glob2, cur) => {
    glob2[cur] = true;
    return glob2;
  }, /* @__PURE__ */ Object.create(null)) : void 0;
}
function splitGlobPattern(pattern) {
  return glob.splitGlobAware(pattern, ",").map((s) => s.trim()).filter((s) => !!s.length);
}
function expandGlobalGlob(pattern) {
  const patterns = [
    `**/${pattern}/**`,
    `**/${pattern}`
  ];
  return patterns.map((p) => p.replace(/\*\*\/\*\*/g, "**"));
}
function normalizeSlashes(pattern) {
  return pattern.replace(/\\/g, "/");
}
function normalizeGlobPattern(pattern) {
  return normalizeSlashes(pattern).replace(/^\.\//, "").replace(/\/+$/g, "");
}
function escapeGlobPattern(path2) {
  return path2.replace(/([?*[\]])/g, "[$1]");
}
function resolveResourcesForSearchIncludes(resources, contextService) {
  resources = arrays.distinct(resources, (resource) => resource.toString());
  const folderPaths = [];
  const workspace = contextService.getWorkspace();
  if (resources) {
    resources.forEach((resource) => {
      let folderPath;
      if (contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
        folderPath = relativePath(workspace.folders[0].uri, resource);
        if (folderPath && folderPath !== ".") {
          folderPath = "./" + folderPath;
        }
      } else {
        const owningFolder = contextService.getWorkspaceFolder(resource);
        if (owningFolder) {
          const owningRootName = owningFolder.name;
          const isUniqueFolder = workspace.folders.filter((folder) => folder.name === owningRootName).length === 1;
          if (isUniqueFolder) {
            const relPath = relativePath(owningFolder.uri, resource);
            if (relPath === "") {
              folderPath = `./${owningFolder.name}`;
            } else {
              folderPath = `./${owningFolder.name}/${relPath}`;
            }
          } else {
            folderPath = resource.fsPath;
          }
        }
      }
      if (folderPath) {
        folderPaths.push(escapeGlobPattern(folderPath));
      }
    });
  }
  return folderPaths;
}
export {
  QueryBuilder,
  escapeGlobPattern,
  globPatternToISearchPatternBuilder,
  isISearchPatternBuilder,
  resolveResourcesForSearchIncludes
};
