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
import "./media/anythingQuickAccess.css";
import { quickPickItemScorerAccessor, QuickPickItemScorerAccessor, QuickInputHideReason, IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { prepareQuery, compareItemsByFuzzyScore, scoreItemFuzzy } from "../../../../base/common/fuzzyScorer.js";
import { QueryBuilder } from "../../../services/search/common/queryBuilder.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { getOutOfWorkspaceEditorResources, extractRangeFromFilter } from "../common/search.js";
import { ISearchService } from "../../../services/search/common/search.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { untildify } from "../../../../base/common/labels.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { URI } from "../../../../base/common/uri.js";
import { toLocalResource, dirname, basenameOrAuthority } from "../../../../base/common/resources.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { DisposableStore, toDisposable, MutableDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { localize } from "../../../../nls.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { EditorResourceAccessor, isEditorInput } from "../../../common/editor.js";
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { ThrottledDelayer } from "../../../../base/common/async.js";
import { top } from "../../../../base/common/arrays.js";
import { FileQueryCacheState } from "../common/cacheState.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { Schemas } from "../../../../base/common/network.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { SymbolsQuickAccessProvider } from "./symbolsQuickAccess.js";
import { DefaultQuickAccessFilterValue, Extensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { PickerEditorState } from "../../../browser/quickaccess.js";
import { GotoSymbolQuickAccessProvider } from "../../codeEditor/browser/quickaccess/gotoSymbolQuickAccess.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { Event } from "../../../../base/common/event.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ASK_QUICK_QUESTION_ACTION_ID } from "../../chat/browser/actions/chatQuickInputActions.js";
import { IChatWidgetService, IQuickChatService } from "../../chat/browser/chat.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
function isEditorSymbolQuickPickItem(pick) {
  const candidate = pick;
  return !!candidate?.range && !!candidate.resource;
}
let AnythingQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(instantiationService, searchService, contextService, pathService, environmentService, fileService, labelService, modelService, languageService, workingCopyService, configurationService, editorService, historyService, filesConfigurationService, textModelService, uriIdentityService, quickInputService, keybindingService, contextKeyService, quickChatService, logService, customEditorLabelService, chatWidgetService) {
    super(AnythingQuickAccessProvider.PREFIX, {
      canAcceptInBackground: true,
      noResultsPick: AnythingQuickAccessProvider.NO_RESULTS_PICK
    });
    this.instantiationService = instantiationService;
    this.searchService = searchService;
    this.contextService = contextService;
    this.pathService = pathService;
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.labelService = labelService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.workingCopyService = workingCopyService;
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.historyService = historyService;
    this.filesConfigurationService = filesConfigurationService;
    this.textModelService = textModelService;
    this.uriIdentityService = uriIdentityService;
    this.quickInputService = quickInputService;
    this.keybindingService = keybindingService;
    this.contextKeyService = contextKeyService;
    this.quickChatService = quickChatService;
    this.logService = logService;
    this.customEditorLabelService = customEditorLabelService;
    this.chatWidgetService = chatWidgetService;
    //#region Editor History
    this.labelOnlyEditorHistoryPickAccessor = new QuickPickItemScorerAccessor({ skipDescription: true });
    //#endregion
    //#region File Search
    this.fileQueryDelayer = this._register(new ThrottledDelayer(AnythingQuickAccessProvider.TYPING_SEARCH_DELAY));
    //#endregion
    //#region Command Center (if enabled)
    this.lazyRegistry = new Lazy(() => Registry.as(Extensions.Quickaccess));
    this.pickState = this._register(new class extends Disposable {
      constructor(provider, instantiationService2) {
        super();
        this.provider = provider;
        this.picker = void 0;
        this.scorerCache = /* @__PURE__ */ Object.create(null);
        this.fileQueryCache = void 0;
        this.lastOriginalFilter = void 0;
        this.lastFilter = void 0;
        this.lastRange = void 0;
        this.lastGlobalPicks = void 0;
        this.isQuickNavigating = void 0;
        this.editorViewState = this._register(instantiationService2.createInstance(PickerEditorState));
      }
      set(picker) {
        this.picker = picker;
        Event.once(picker.onDispose)(() => {
          if (picker === this.picker) {
            this.picker = void 0;
          }
        });
        const isQuickNavigating = !!picker.quickNavigate;
        if (!isQuickNavigating) {
          this.fileQueryCache = this.provider.createFileQueryCache();
          this.scorerCache = /* @__PURE__ */ Object.create(null);
        }
        this.isQuickNavigating = isQuickNavigating;
        this.lastOriginalFilter = void 0;
        this.lastFilter = void 0;
        this.lastRange = void 0;
        this.lastGlobalPicks = void 0;
        this.editorViewState.reset();
      }
    }(this, instantiationService));
    this.fileQueryBuilder = this.instantiationService.createInstance(QueryBuilder);
    this.workspaceSymbolsQuickAccess = this._register(instantiationService.createInstance(SymbolsQuickAccessProvider));
    this.editorSymbolsQuickAccess = this.instantiationService.createInstance(GotoSymbolQuickAccessProvider);
  }
  static {
    this.PREFIX = "";
  }
  static {
    this.NO_RESULTS_PICK = {
      label: localize("noAnythingResults", "No matching results")
    };
  }
  static {
    this.MAX_RESULTS = 512;
  }
  static {
    this.TYPING_SEARCH_DELAY = 200;
  }
  static {
    // this delay accommodates for the user typing a word and then stops typing to start searching
    this.SYMBOL_PICKS_MERGE_DELAY = 200;
  }
  get defaultFilterValue() {
    if (this.configuration.preserveInput) {
      return DefaultQuickAccessFilterValue.LAST;
    }
    return void 0;
  }
  get configuration() {
    const editorConfig = this.configurationService.getValue().workbench?.editor;
    const searchConfig = this.configurationService.getValue().search;
    const quickAccessConfig = this.configurationService.getValue().workbench.quickOpen;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
      openSideBySideDirection: editorConfig?.openSideBySideDirection,
      includeSymbols: searchConfig?.quickOpen?.includeSymbols,
      includeHistory: searchConfig?.quickOpen?.includeHistory ?? true,
      historyFilterSortOrder: searchConfig?.quickOpen?.history?.filterSortOrder,
      preserveInput: quickAccessConfig?.preserveInput
    };
  }
  provide(picker, token, runOptions) {
    const disposables = new DisposableStore();
    this.pickState.set(picker);
    const editorDecorationsDisposable = disposables.add(new MutableDisposable());
    disposables.add(picker.onDidChangeActive(() => {
      editorDecorationsDisposable.value = void 0;
      const [item] = picker.activeItems;
      if (isEditorSymbolQuickPickItem(item)) {
        editorDecorationsDisposable.value = this.decorateAndRevealSymbolRange(item);
      }
    }));
    disposables.add(Event.once(picker.onDidHide)(({ reason }) => {
      if (reason === QuickInputHideReason.Gesture) {
        this.pickState.editorViewState.restore();
      }
    }));
    disposables.add(super.provide(picker, token, runOptions));
    return disposables;
  }
  decorateAndRevealSymbolRange(pick) {
    const activeEditor = this.editorService.activeEditor;
    if (!this.uriIdentityService.extUri.isEqual(pick.resource, activeEditor?.resource)) {
      return Disposable.None;
    }
    const activeEditorControl = this.editorService.activeTextEditorControl;
    if (!activeEditorControl) {
      return Disposable.None;
    }
    this.pickState.editorViewState.set();
    activeEditorControl.revealRangeInCenter(pick.range.selection, ScrollType.Smooth);
    this.addDecorations(activeEditorControl, pick.range.decoration);
    return toDisposable(() => this.clearDecorations(activeEditorControl));
  }
  _getPicks(originalFilter, disposables, token, runOptions) {
    const filterWithRange = extractRangeFromFilter(originalFilter, [GotoSymbolQuickAccessProvider.PREFIX]);
    let filter;
    if (filterWithRange) {
      filter = filterWithRange.filter;
    } else {
      filter = originalFilter;
    }
    this.pickState.lastRange = filterWithRange?.range;
    if (originalFilter !== this.pickState.lastOriginalFilter && filter === this.pickState.lastFilter) {
      return null;
    }
    const lastWasFiltering = !!this.pickState.lastOriginalFilter;
    this.pickState.lastOriginalFilter = originalFilter;
    this.pickState.lastFilter = filter;
    const picks = this.pickState.picker?.items;
    const activePick = this.pickState.picker?.activeItems[0];
    if (picks && activePick) {
      const activePickIsEditorSymbol = isEditorSymbolQuickPickItem(activePick);
      const activePickIsNoResultsInEditorSymbols = activePick === AnythingQuickAccessProvider.NO_RESULTS_PICK && filter.indexOf(GotoSymbolQuickAccessProvider.PREFIX) >= 0;
      if (!activePickIsEditorSymbol && !activePickIsNoResultsInEditorSymbols) {
        this.pickState.lastGlobalPicks = {
          items: picks,
          active: activePick
        };
      }
    }
    return this.doGetPicks(
      filter,
      {
        ...runOptions,
        enableEditorSymbolSearch: lastWasFiltering
      },
      disposables,
      token
    );
  }
  doGetPicks(filter, options, disposables, token) {
    const query = prepareQuery(filter);
    if (options.enableEditorSymbolSearch) {
      const editorSymbolPicks = this.getEditorSymbolPicks(query, disposables, token);
      if (editorSymbolPicks) {
        return editorSymbolPicks;
      }
    }
    const activePick = this.pickState.picker?.activeItems[0];
    if (isEditorSymbolQuickPickItem(activePick) && this.pickState.lastGlobalPicks) {
      return this.pickState.lastGlobalPicks;
    }
    const historyEditorPicks = this.getEditorHistoryPicks(query);
    let picks = new Array();
    if (options.additionPicks) {
      for (const pick of options.additionPicks) {
        if (pick.type === "separator") {
          picks.push(pick);
          continue;
        }
        if (!query.original) {
          pick.highlights = void 0;
          picks.push(pick);
          continue;
        }
        const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(pick, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache);
        if (!score) {
          continue;
        }
        pick.highlights = {
          label: labelMatch,
          description: descriptionMatch
        };
        picks.push(pick);
      }
    }
    if (this.pickState.isQuickNavigating) {
      if (picks.length > 0) {
        picks.push({ type: "separator", label: localize("recentlyOpenedSeparator", "recently opened") });
      }
      picks = historyEditorPicks;
    } else {
      if (options.includeHelp) {
        picks.push(...this.getHelpPicks(query, token, options));
      }
      if (historyEditorPicks.length !== 0) {
        picks.push({ type: "separator", label: localize("recentlyOpenedSeparator", "recently opened") });
        picks.push(...historyEditorPicks);
      }
    }
    return {
      // Fast picks: help (if included) & editor history
      picks: options.filter ? picks.filter((p) => options.filter?.(p)) : picks,
      // Slow picks: files and symbols
      additionalPicks: (async () => {
        const additionalPicksExcludes = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
        for (const historyEditorPick of historyEditorPicks) {
          if (historyEditorPick.resource) {
            additionalPicksExcludes.set(historyEditorPick.resource, true);
          }
        }
        let additionalPicks = await this.getAdditionalPicks(query, additionalPicksExcludes, Boolean(this.configuration?.includeSymbols), token);
        if (options.filter) {
          additionalPicks = additionalPicks.filter((p) => options.filter?.(p));
        }
        if (token.isCancellationRequested) {
          return [];
        }
        return additionalPicks.length > 0 ? [
          { type: "separator", label: this.configuration.includeSymbols ? localize("fileAndSymbolResultsSeparator", "file and symbol results") : localize("fileResultsSeparator", "file results") },
          ...additionalPicks
        ] : [];
      })(),
      // allow some time to merge files and symbols to reduce flickering
      mergeDelay: AnythingQuickAccessProvider.SYMBOL_PICKS_MERGE_DELAY
    };
  }
  async getAdditionalPicks(query, excludes, includeSymbols, token) {
    const [filePicks, symbolPicks] = await Promise.all([
      this.getFilePicks(query, excludes, token),
      this.getWorkspaceSymbolPicks(query, includeSymbols, token)
    ]);
    if (token.isCancellationRequested) {
      return [];
    }
    const sortedAnythingPicks = top(
      [...filePicks, ...symbolPicks],
      (anyPickA, anyPickB) => compareItemsByFuzzyScore(anyPickA, anyPickB, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache),
      AnythingQuickAccessProvider.MAX_RESULTS
    );
    const filteredAnythingPicks = [];
    for (const anythingPick of sortedAnythingPicks) {
      if (anythingPick.highlights) {
        filteredAnythingPicks.push(anythingPick);
      } else {
        const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(anythingPick, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache);
        if (!score) {
          continue;
        }
        anythingPick.highlights = {
          label: labelMatch,
          description: descriptionMatch
        };
        filteredAnythingPicks.push(anythingPick);
      }
    }
    return filteredAnythingPicks;
  }
  getEditorHistoryPicks(query) {
    const configuration = this.configuration;
    if (!query.normalized) {
      return this.historyService.getHistory().map((editor) => this.createAnythingPick(editor, configuration));
    }
    if (!this.configuration.includeHistory) {
      return [];
    }
    const editorHistoryScorerAccessor = query.containsPathSeparator ? quickPickItemScorerAccessor : this.labelOnlyEditorHistoryPickAccessor;
    const editorHistoryPicks = [];
    for (const editor of this.historyService.getHistory()) {
      const resource = editor.resource;
      if (!resource) {
        continue;
      }
      const editorHistoryPick = this.createAnythingPick(editor, configuration);
      const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(editorHistoryPick, query, false, editorHistoryScorerAccessor, this.pickState.scorerCache);
      if (!score) {
        continue;
      }
      editorHistoryPick.highlights = {
        label: labelMatch,
        description: descriptionMatch
      };
      editorHistoryPicks.push(editorHistoryPick);
    }
    if (this.configuration.historyFilterSortOrder === "recency") {
      return editorHistoryPicks;
    }
    return editorHistoryPicks.sort((editorA, editorB) => compareItemsByFuzzyScore(editorA, editorB, query, false, editorHistoryScorerAccessor, this.pickState.scorerCache));
  }
  createFileQueryCache() {
    return new FileQueryCacheState(
      (cacheKey) => this.fileQueryBuilder.file(this.contextService.getWorkspace().folders, this.getFileQueryOptions({ cacheKey })),
      (query) => this.searchService.fileSearch(query),
      (cacheKey) => this.searchService.clearCache(cacheKey),
      this.pickState.fileQueryCache
    ).load();
  }
  async getFilePicks(query, excludes, token) {
    if (!query.normalized) {
      return [];
    }
    const absolutePathResult = await this.getAbsolutePathFileResult(query, token);
    if (token.isCancellationRequested) {
      return [];
    }
    let fileMatches;
    if (absolutePathResult) {
      if (excludes.has(absolutePathResult)) {
        return [];
      }
      const absolutePathPick = this.createAnythingPick(absolutePathResult, this.configuration);
      absolutePathPick.highlights = {
        label: [{ start: 0, end: absolutePathPick.label.length }],
        description: absolutePathPick.description ? [{ start: 0, end: absolutePathPick.description.length }] : void 0
      };
      return [absolutePathPick];
    }
    if (this.pickState.fileQueryCache?.isLoaded) {
      fileMatches = await this.doFileSearch(query, token);
    } else {
      fileMatches = await this.fileQueryDelayer.trigger(async () => {
        if (token.isCancellationRequested) {
          return [];
        }
        return this.doFileSearch(query, token);
      });
    }
    if (token.isCancellationRequested) {
      return [];
    }
    const configuration = this.configuration;
    return fileMatches.filter((resource) => !excludes.has(resource)).map((resource) => this.createAnythingPick(resource, configuration));
  }
  async doFileSearch(query, token) {
    const [fileSearchResults, relativePathFileResults] = await Promise.all([
      // File search: this is a search over all files of the workspace using the provided pattern
      this.getFileSearchResults(query, token),
      // Relative path search: we also want to consider results that match files inside the workspace
      // by looking for relative paths that the user typed as query. This allows to return even excluded
      // results into the picker if found (e.g. helps for opening compilation results that are otherwise
      // excluded)
      this.getRelativePathFileResults(query, token)
    ]);
    if (token.isCancellationRequested) {
      return [];
    }
    if (!relativePathFileResults) {
      return fileSearchResults;
    }
    const relativePathFileResultsMap = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
    for (const relativePathFileResult of relativePathFileResults) {
      relativePathFileResultsMap.set(relativePathFileResult, true);
    }
    return [
      ...fileSearchResults.filter((result) => !relativePathFileResultsMap.has(result)),
      ...relativePathFileResults
    ];
  }
  async getFileSearchResults(query, token) {
    let filePattern = "";
    if (query.values && query.values.length > 1) {
      filePattern = query.values[0].original;
    } else {
      filePattern = query.original;
    }
    const fileSearchResults = await this.doGetFileSearchResults(filePattern, token);
    if (token.isCancellationRequested) {
      return [];
    }
    if (fileSearchResults.limitHit && query.values && query.values.length > 1) {
      const additionalFileSearchResults = await this.doGetFileSearchResults(query.original, token);
      if (token.isCancellationRequested) {
        return [];
      }
      const existingFileSearchResultsMap = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
      for (const fileSearchResult of fileSearchResults.results) {
        existingFileSearchResultsMap.set(fileSearchResult.resource, true);
      }
      for (const additionalFileSearchResult of additionalFileSearchResults.results) {
        if (!existingFileSearchResultsMap.has(additionalFileSearchResult.resource)) {
          fileSearchResults.results.push(additionalFileSearchResult);
        }
      }
    }
    return fileSearchResults.results.map((result) => result.resource);
  }
  doGetFileSearchResults(filePattern, token) {
    const start = Date.now();
    return this.searchService.fileSearch(
      this.fileQueryBuilder.file(
        this.contextService.getWorkspace().folders,
        this.getFileQueryOptions({
          filePattern,
          cacheKey: this.pickState.fileQueryCache?.cacheKey,
          maxResults: AnythingQuickAccessProvider.MAX_RESULTS
        })
      ),
      token
    ).finally(() => {
      this.logService.trace(`QuickAccess fileSearch ${Date.now() - start}ms`);
    });
  }
  getFileQueryOptions(input) {
    return {
      _reason: "openFileHandler",
      // used for telemetry - do not change
      extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
      filePattern: input.filePattern || "",
      cacheKey: input.cacheKey,
      maxResults: input.maxResults || 0,
      sortByScore: true
    };
  }
  async getAbsolutePathFileResult(query, token) {
    if (!query.containsPathSeparator) {
      return;
    }
    const userHome = await this.pathService.userHome();
    const detildifiedQuery = untildify(query.original, userHome.scheme === Schemas.file ? userHome.fsPath : userHome.path);
    if (token.isCancellationRequested) {
      return;
    }
    const isAbsolutePathQuery = (await this.pathService.path).isAbsolute(detildifiedQuery);
    if (token.isCancellationRequested) {
      return;
    }
    if (isAbsolutePathQuery) {
      const resource = toLocalResource(
        await this.pathService.fileURI(detildifiedQuery),
        this.environmentService.remoteAuthority,
        this.pathService.defaultUriScheme
      );
      if (token.isCancellationRequested) {
        return;
      }
      try {
        const stat = await this.fileService.stat(resource);
        if (stat.isFile) {
          return await this.matchFilenameCasing(resource);
        }
      } catch (error) {
      }
    }
    return;
  }
  async getRelativePathFileResults(query, token) {
    if (!query.containsPathSeparator) {
      return;
    }
    const isAbsolutePathQuery = (await this.pathService.path).isAbsolute(query.original);
    if (!isAbsolutePathQuery) {
      const resources = [];
      for (const folder of this.contextService.getWorkspace().folders) {
        if (token.isCancellationRequested) {
          break;
        }
        const resource = toLocalResource(
          folder.toResource(query.original),
          this.environmentService.remoteAuthority,
          this.pathService.defaultUriScheme
        );
        try {
          const stat = await this.fileService.stat(resource);
          if (stat.isFile) {
            resources.push(await this.matchFilenameCasing(resource));
          }
        } catch (error) {
        }
      }
      return resources;
    }
    return;
  }
  /**
   * Attempts to match the filename casing to file system by checking the parent folder's children.
   */
  async matchFilenameCasing(resource) {
    const parent = dirname(resource);
    const stat = await this.fileService.resolve(parent, { resolveTo: [resource] });
    if (stat?.children) {
      const match = stat.children.find((child) => this.uriIdentityService.extUri.isEqual(child.resource, resource));
      if (match) {
        return URI.joinPath(parent, match.name);
      }
    }
    return resource;
  }
  getHelpPicks(query, token, runOptions) {
    if (query.normalized) {
      return [];
    }
    const providers = this.lazyRegistry.value.getQuickAccessProviders(this.contextKeyService).filter((p) => p.helpEntries.some((h) => h.commandCenterOrder !== void 0)).flatMap((provider) => provider.helpEntries.filter((h) => h.commandCenterOrder !== void 0).map((helpEntry) => {
      const providerSpecificOptions = {
        ...runOptions,
        includeHelp: provider.prefix === AnythingQuickAccessProvider.PREFIX ? false : runOptions?.includeHelp
      };
      const label = helpEntry.commandCenterLabel ?? helpEntry.description;
      return {
        label,
        description: helpEntry.prefix ?? provider.prefix,
        commandCenterOrder: helpEntry.commandCenterOrder,
        keybinding: helpEntry.commandId ? this.keybindingService.lookupKeybinding(helpEntry.commandId) : void 0,
        ariaLabel: localize("helpPickAriaLabel", "{0}, {1}", label, helpEntry.description),
        accept: () => {
          this.quickInputService.quickAccess.show(provider.prefix, {
            preserveValue: true,
            providerOptions: providerSpecificOptions
          });
        }
      };
    }));
    if (this.quickChatService.enabled) {
      providers.push({
        label: localize("chat", "Open Quick Chat"),
        commandCenterOrder: 30,
        keybinding: this.keybindingService.lookupKeybinding(ASK_QUICK_QUESTION_ACTION_ID),
        accept: () => this.quickChatService.toggle()
      });
    }
    return providers.sort((a, b) => a.commandCenterOrder - b.commandCenterOrder);
  }
  async getWorkspaceSymbolPicks(query, includeSymbols, token) {
    if (!query.normalized || // we need a value for search for
    !includeSymbols || // we need to enable symbols in search
    this.pickState.lastRange) {
      return [];
    }
    return this.workspaceSymbolsQuickAccess.getSymbolPicks(query.original, {
      skipLocal: true,
      skipSorting: true,
      delay: AnythingQuickAccessProvider.TYPING_SEARCH_DELAY
    }, token);
  }
  getEditorSymbolPicks(query, disposables, token) {
    const filterSegments = query.original.split(GotoSymbolQuickAccessProvider.PREFIX);
    const filter = filterSegments.length > 1 ? filterSegments[filterSegments.length - 1].trim() : void 0;
    if (typeof filter !== "string") {
      return null;
    }
    const activeGlobalPick = this.pickState.lastGlobalPicks?.active;
    if (!activeGlobalPick) {
      return null;
    }
    const activeGlobalResource = activeGlobalPick.resource;
    if (!activeGlobalResource || !this.fileService.hasProvider(activeGlobalResource) && activeGlobalResource.scheme !== Schemas.untitled) {
      return null;
    }
    if (activeGlobalPick.label.includes(GotoSymbolQuickAccessProvider.PREFIX) || activeGlobalPick.description?.includes(GotoSymbolQuickAccessProvider.PREFIX)) {
      if (filterSegments.length < 3) {
        return null;
      }
    }
    return this.doGetEditorSymbolPicks(activeGlobalPick, activeGlobalResource, filter, disposables, token);
  }
  async doGetEditorSymbolPicks(activeGlobalPick, activeGlobalResource, filter, disposables, token) {
    try {
      this.pickState.editorViewState.set();
      await this.pickState.editorViewState.openTransientEditor({
        resource: activeGlobalResource,
        options: { preserveFocus: true, revealIfOpened: true, ignoreError: true }
      });
    } catch (error) {
      return [];
    }
    if (token.isCancellationRequested) {
      return [];
    }
    let model = this.modelService.getModel(activeGlobalResource);
    if (!model) {
      try {
        const modelReference = disposables.add(await this.textModelService.createModelReference(activeGlobalResource));
        if (token.isCancellationRequested) {
          return [];
        }
        model = modelReference.object.textEditorModel;
      } catch (error) {
        return [];
      }
    }
    const editorSymbolPicks = await this.editorSymbolsQuickAccess.getSymbolPicks(model, filter, { extraContainerLabel: stripIcons(activeGlobalPick.label) }, disposables, token);
    if (token.isCancellationRequested) {
      return [];
    }
    return editorSymbolPicks.map((editorSymbolPick) => {
      if (editorSymbolPick.type === "separator") {
        return editorSymbolPick;
      }
      return {
        ...editorSymbolPick,
        resource: activeGlobalResource,
        description: editorSymbolPick.description,
        trigger: (buttonIndex, keyMods) => {
          this.openAnything(activeGlobalResource, { keyMods, range: editorSymbolPick.range?.selection, forceOpenSideBySide: true });
          return TriggerAction.CLOSE_PICKER;
        },
        accept: (keyMods, event) => this.openAnything(activeGlobalResource, { keyMods, range: editorSymbolPick.range?.selection, preserveFocus: event.inBackground, forcePinned: event.inBackground })
      };
    });
  }
  addDecorations(editor, range) {
    this.editorSymbolsQuickAccess.addDecorations(editor, range);
  }
  clearDecorations(editor) {
    this.editorSymbolsQuickAccess.clearDecorations(editor);
  }
  //#endregion
  //#region Helpers
  createAnythingPick(resourceOrEditor, configuration) {
    const isEditorHistoryEntry = !URI.isUri(resourceOrEditor);
    let resource;
    let label;
    let description = void 0;
    let isDirty = void 0;
    let extraClasses;
    let icon = void 0;
    if (isEditorInput(resourceOrEditor)) {
      resource = EditorResourceAccessor.getOriginalUri(resourceOrEditor);
      label = resourceOrEditor.getName();
      description = resourceOrEditor.getDescription();
      isDirty = resourceOrEditor.isDirty() && !resourceOrEditor.isSaving();
      extraClasses = resourceOrEditor.getLabelExtraClasses();
      icon = resourceOrEditor.getIcon();
    } else {
      resource = URI.isUri(resourceOrEditor) ? resourceOrEditor : resourceOrEditor.resource;
      const customLabel = this.customEditorLabelService.getName(resource);
      label = customLabel || basenameOrAuthority(resource);
      description = this.labelService.getUriLabel(!!customLabel ? resource : dirname(resource), { relative: true });
      isDirty = this.workingCopyService.isDirty(resource) && !this.filesConfigurationService.hasShortAutoSaveDelay(resource);
      extraClasses = [];
    }
    const labelAndDescription = description ? `${label} ${description}` : label;
    const iconClassesValue = new Lazy(() => getIconClasses(this.modelService, this.languageService, resource, void 0, icon).concat(extraClasses));
    const buttonsValue = new Lazy(() => {
      const openSideBySideDirection = configuration.openSideBySideDirection;
      const buttons = [];
      buttons.push({
        iconClass: openSideBySideDirection === "right" ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
        tooltip: openSideBySideDirection === "right" ? localize({ key: "openToSide", comment: ["Open this file in a split editor on the left/right side"] }, "Open to the Side") : localize({ key: "openToBottom", comment: ["Open this file in a split editor on the bottom"] }, "Open to the Bottom")
      });
      if (isEditorHistoryEntry) {
        buttons.push({
          iconClass: isDirty ? "dirty-anything " + ThemeIcon.asClassName(Codicon.circleFilled) : ThemeIcon.asClassName(Codicon.close),
          tooltip: localize("closeEditor", "Remove from Recently Opened"),
          alwaysVisible: isDirty
        });
      }
      return buttons;
    });
    return {
      resource,
      label,
      ariaLabel: isDirty ? localize("filePickAriaLabelDirty", "{0} unsaved changes", labelAndDescription) : labelAndDescription,
      description,
      iconPath: URI.isUri(icon) ? { dark: icon } : void 0,
      get iconClasses() {
        return iconClassesValue.value;
      },
      get buttons() {
        return buttonsValue.value;
      },
      trigger: (buttonIndex, keyMods) => {
        switch (buttonIndex) {
          // Open to side / below
          case 0:
            this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, forceOpenSideBySide: true });
            return TriggerAction.CLOSE_PICKER;
          // Remove from History
          case 1:
            if (!URI.isUri(resourceOrEditor)) {
              this.historyService.removeFromHistory(resourceOrEditor);
              return TriggerAction.REMOVE_ITEM;
            }
        }
        return TriggerAction.NO_ACTION;
      },
      accept: (keyMods, event) => this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, preserveFocus: event.inBackground, forcePinned: event.inBackground }),
      attach: (keyMods, event) => {
        if (keyMods.shift) {
          const widget = this.chatWidgetService.lastFocusedWidget;
          if (widget && resource) {
            widget.attachmentModel.addContext(widget.attachmentModel.asFileVariableEntry(resource));
          }
          return;
        }
        this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, preserveFocus: event.inBackground, forcePinned: event.inBackground });
      }
    };
  }
  async openAnything(resourceOrEditor, options) {
    const editorOptions = {
      preserveFocus: options.preserveFocus,
      pinned: options.keyMods?.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
      selection: options.range
    };
    const targetGroup = options.keyMods?.alt || this.configuration.openEditorPinned && options.keyMods?.ctrlCmd || options.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP;
    if (targetGroup === SIDE_GROUP) {
      await this.pickState.editorViewState.restore();
    }
    if (isEditorInput(resourceOrEditor)) {
      await this.editorService.openEditor(resourceOrEditor, editorOptions, targetGroup);
    } else {
      let resourceEditorInput;
      if (URI.isUri(resourceOrEditor)) {
        resourceEditorInput = {
          resource: resourceOrEditor,
          options: editorOptions
        };
      } else {
        resourceEditorInput = {
          ...resourceOrEditor,
          options: {
            ...resourceOrEditor.options,
            ...editorOptions
          }
        };
      }
      await this.editorService.openEditor(resourceEditorInput, targetGroup);
    }
  }
  //#endregion
};
AnythingQuickAccessProvider = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ISearchService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IPathService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IModelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IWorkingCopyService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, IHistoryService),
  __decorateParam(13, IFilesConfigurationService),
  __decorateParam(14, ITextModelService),
  __decorateParam(15, IUriIdentityService),
  __decorateParam(16, IQuickInputService),
  __decorateParam(17, IKeybindingService),
  __decorateParam(18, IContextKeyService),
  __decorateParam(19, IQuickChatService),
  __decorateParam(20, ILogService),
  __decorateParam(21, ICustomEditorLabelService),
  __decorateParam(22, IChatWidgetService)
], AnythingQuickAccessProvider);
export {
  AnythingQuickAccessProvider
};
