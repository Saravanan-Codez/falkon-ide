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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { getExcludes, ISearchService, QueryType, VIEW_ID } from "../../../services/search/common/search.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IChatContextPickService, picksWithPromiseFn } from "../../chat/browser/attachments/chatContextPickService.js";
import { SearchContext } from "../common/constants.js";
import { SearchView } from "./searchView.js";
import { basename, dirname, joinPath, relativePath } from "../../../../base/common/resources.js";
import { compare } from "../../../../base/common/strings.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { FileKind, FileType, IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import * as glob from "../../../../base/common/glob.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { SymbolsQuickAccessProvider } from "./symbolsQuickAccess.js";
import { SymbolKinds } from "../../../../editor/common/languages.js";
import { isSupportedChatFileScheme } from "../../chat/common/constants.js";
let SearchChatContextContribution = class extends Disposable {
  static {
    this.ID = "workbench.contributions.searchChatContextContribution";
  }
  constructor(instantiationService, chatContextPickService) {
    super();
    this._store.add(chatContextPickService.registerChatContextItem(instantiationService.createInstance(SearchViewResultChatContextPick)));
    this._store.add(chatContextPickService.registerChatContextItem(instantiationService.createInstance(FilesAndFoldersPickerPick)));
    this._store.add(chatContextPickService.registerChatContextItem(this._store.add(instantiationService.createInstance(SymbolsContextPickerPick))));
  }
};
SearchChatContextContribution = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IChatContextPickService)
], SearchChatContextContribution);
let SearchViewResultChatContextPick = class {
  constructor(_contextKeyService, _viewsService, _labelService) {
    this._contextKeyService = _contextKeyService;
    this._viewsService = _viewsService;
    this._labelService = _labelService;
    this.type = "valuePick";
    this.label = localize("chatContext.searchResults", "Search Results");
    this.icon = Codicon.search;
    this.ordinal = 500;
  }
  isEnabled(widget) {
    return !!SearchContext.HasSearchResults.getValue(this._contextKeyService) && !!widget.attachmentCapabilities.supportsSearchResultAttachments;
  }
  async asAttachment() {
    const searchView = this._viewsService.getViewWithId(VIEW_ID);
    if (!(searchView instanceof SearchView)) {
      return [];
    }
    return searchView.model.searchResult.matches().map((result) => ({
      kind: "file",
      id: result.resource.toString(),
      value: result.resource,
      name: this._labelService.getUriBasenameLabel(result.resource)
    }));
  }
};
SearchViewResultChatContextPick = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IViewsService),
  __decorateParam(2, ILabelService)
], SearchViewResultChatContextPick);
let SymbolsContextPickerPick = class {
  constructor(_instantiationService) {
    this._instantiationService = _instantiationService;
    this.type = "pickerPick";
    this.label = localize("symbols", "Symbols...");
    this.icon = Codicon.symbolField;
    this.ordinal = -200;
  }
  dispose() {
    this._provider?.dispose();
  }
  isEnabled(widget) {
    return !!widget.attachmentCapabilities.supportsSymbolAttachments;
  }
  asPicker() {
    return {
      placeholder: localize("select.symb", "Select a symbol"),
      picks: picksWithPromiseFn((query, token) => {
        this._provider ??= this._instantiationService.createInstance(SymbolsQuickAccessProvider);
        return this._provider.getSymbolPicks(query, void 0, token).then((symbolItems) => {
          const result = [];
          for (const item of symbolItems) {
            if (!item.symbol) {
              continue;
            }
            const attachment = {
              kind: "symbol",
              id: JSON.stringify(item.symbol.location),
              value: item.symbol.location,
              symbolKind: item.symbol.kind,
              icon: SymbolKinds.toIcon(item.symbol.kind),
              fullName: item.label,
              name: item.symbol.name
            };
            result.push({
              label: item.symbol.name,
              iconClass: ThemeIcon.asClassName(SymbolKinds.toIcon(item.symbol.kind)),
              asAttachment() {
                return attachment;
              }
            });
          }
          return result;
        });
      })
    };
  }
};
SymbolsContextPickerPick = __decorateClass([
  __decorateParam(0, IInstantiationService)
], SymbolsContextPickerPick);
let FilesAndFoldersPickerPick = class {
  constructor(_searchService, _labelService, _modelService, _languageService, _configurationService, _workspaceService, _fileService, _historyService, _instantiationService) {
    this._searchService = _searchService;
    this._labelService = _labelService;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._configurationService = _configurationService;
    this._workspaceService = _workspaceService;
    this._fileService = _fileService;
    this._historyService = _historyService;
    this._instantiationService = _instantiationService;
    this.type = "pickerPick";
    this.label = localize("chatContext.folder", "Files & Folders...");
    this.icon = Codicon.folder;
    this.ordinal = 600;
  }
  asPicker() {
    return {
      placeholder: localize("chatContext.attach.files.placeholder", "Search file or folder by name"),
      picks: picksWithPromiseFn(async (value, token) => {
        const workspaces = this._workspaceService.getWorkspace().folders.map((folder) => folder.uri);
        const defaultItems = [];
        (await getTopLevelFolders(workspaces, this._fileService)).forEach((uri) => defaultItems.push(this._createPickItem(uri, FileKind.FOLDER)));
        this._historyService.getHistory().filter((a) => a.resource && this._instantiationService.invokeFunction((accessor) => isSupportedChatFileScheme(accessor, a.resource.scheme))).slice(0, 30).forEach((uri) => defaultItems.push(this._createPickItem(uri.resource, FileKind.FILE)));
        if (value === "") {
          return defaultItems;
        }
        const result = [];
        await Promise.all(workspaces.map(async (workspace) => {
          const { folders, files } = await searchFilesAndFolders(
            workspace,
            value,
            true,
            token,
            void 0,
            this._configurationService,
            this._searchService
          );
          for (const folder of folders) {
            result.push(this._createPickItem(folder, FileKind.FOLDER));
          }
          for (const file of files) {
            result.push(this._createPickItem(file, FileKind.FILE));
          }
        }));
        result.sort((a, b) => compare(a.label, b.label));
        return result;
      })
    };
  }
  _createPickItem(resource, kind) {
    return {
      label: basename(resource),
      description: this._labelService.getUriLabel(dirname(resource), { relative: true }),
      iconClasses: getIconClasses(this._modelService, this._languageService, resource, kind),
      asAttachment: () => {
        return {
          kind: kind === FileKind.FILE ? "file" : "directory",
          id: resource.toString(),
          value: resource,
          name: basename(resource)
        };
      }
    };
  }
};
FilesAndFoldersPickerPick = __decorateClass([
  __decorateParam(0, ISearchService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IHistoryService),
  __decorateParam(8, IInstantiationService)
], FilesAndFoldersPickerPick);
async function searchFilesAndFolders(workspace, pattern, fuzzyMatch, token, cacheKey, configurationService, searchService) {
  const segmentMatchPattern = fuzzyMatch ? fuzzyMatchingGlobPattern(pattern) : continousMatchingGlobPattern(pattern);
  const searchExcludePattern = getExcludes(configurationService.getValue({ resource: workspace })) || {};
  const searchOptions = {
    folderQueries: [{
      folder: workspace,
      disregardIgnoreFiles: configurationService.getValue("explorer.excludeGitIgnore")
    }],
    type: QueryType.File,
    shouldGlobMatchFilePattern: true,
    cacheKey,
    excludePattern: searchExcludePattern,
    sortByScore: true,
    ignoreGlobCase: true
  };
  let searchResult;
  try {
    searchResult = await searchService.fileSearch({ ...searchOptions, filePattern: `{**/${segmentMatchPattern}/**,**/${segmentMatchPattern}}` }, token);
  } catch (e) {
    if (!isCancellationError(e)) {
      throw e;
    }
  }
  if (!searchResult || token?.isCancellationRequested) {
    return { files: [], folders: [] };
  }
  const fileResources = searchResult.results.map((result) => result.resource);
  const folderResources = getMatchingFoldersFromFiles(fileResources, workspace, segmentMatchPattern);
  return { folders: folderResources, files: fileResources };
}
function fuzzyMatchingGlobPattern(pattern) {
  if (!pattern) {
    return "*";
  }
  return "*" + pattern.split("").join("*") + "*";
}
function continousMatchingGlobPattern(pattern) {
  if (!pattern) {
    return "*";
  }
  return "*" + pattern + "*";
}
function getMatchingFoldersFromFiles(resources, workspace, segmentMatchPattern) {
  const uniqueFolders = new ResourceSet();
  for (const resource of resources) {
    const relativePathToRoot = relativePath(workspace, resource);
    if (!relativePathToRoot) {
      throw new Error("Resource is not a child of the workspace");
    }
    let dirResource = workspace;
    const stats = relativePathToRoot.split("/").slice(0, -1);
    for (const stat of stats) {
      dirResource = dirResource.with({ path: `${dirResource.path}/${stat}` });
      uniqueFolders.add(dirResource);
    }
  }
  const matchingFolders = [];
  for (const folderResource of uniqueFolders) {
    const stats = folderResource.path.split("/");
    const dirStat = stats[stats.length - 1];
    if (!dirStat || !glob.match(segmentMatchPattern, dirStat, { ignoreCase: true })) {
      continue;
    }
    matchingFolders.push(folderResource);
  }
  return matchingFolders;
}
async function getTopLevelFolders(workspaces, fileService) {
  const folders = [];
  for (const workspace of workspaces) {
    const fileSystemProvider = fileService.getProvider(workspace.scheme);
    if (!fileSystemProvider) {
      continue;
    }
    const entries = await fileSystemProvider.readdir(workspace);
    for (const [name, type] of entries) {
      const entryResource = joinPath(workspace, name);
      if (type === FileType.Directory) {
        folders.push(entryResource);
      }
    }
  }
  return folders;
}
export {
  SearchChatContextContribution,
  getTopLevelFolders,
  searchFilesAndFolders
};
