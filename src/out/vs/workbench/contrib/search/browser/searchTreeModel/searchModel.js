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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import * as errors from "../../../../../base/common/errors.js";
import { Emitter, Event, PauseableEmitter } from "../../../../../base/common/event.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { INotebookSearchService } from "../../common/notebookSearch.js";
import { ReplacePattern } from "../../../../services/search/common/replace.js";
import { ISearchService, QueryType, SearchCompletionExitCode } from "../../../../services/search/common/search.js";
import { mergeSearchResultEvents, SearchModelLocation, SEARCH_MODEL_PREFIX } from "./searchTreeCommon.js";
import { SearchResultImpl } from "./searchResult.js";
let SearchModelImpl = class extends Disposable {
  constructor(searchService, telemetryService, configurationService, instantiationService, logService, notebookSearchService) {
    super();
    this.searchService = searchService;
    this.telemetryService = telemetryService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.notebookSearchService = notebookSearchService;
    this._searchQuery = null;
    this._replaceActive = false;
    this._replaceString = null;
    this._replacePattern = null;
    this._preserveCase = false;
    this._startStreamDelay = Promise.resolve();
    this._resultQueue = [];
    this._aiResultQueue = [];
    this._onReplaceTermChanged = this._register(new Emitter());
    this.onReplaceTermChanged = this._onReplaceTermChanged.event;
    this._onSearchResultChanged = this._register(new PauseableEmitter({
      merge: mergeSearchResultEvents
    }));
    this.onSearchResultChanged = this._onSearchResultChanged.event;
    this.currentCancelTokenSource = null;
    this.currentAICancelTokenSource = null;
    this.searchCancelledForNewSearch = false;
    this.aiSearchCancelledForNewSearch = false;
    this.location = SearchModelLocation.PANEL;
    this._searchResult = this.instantiationService.createInstance(SearchResultImpl, this);
    this._register(this._searchResult.onChange((e) => this._onSearchResultChanged.fire(e)));
    this._aiTextResultProviderName = new Lazy(async () => this.searchService.getAIName());
    this._id = SEARCH_MODEL_PREFIX + Date.now().toString();
  }
  id() {
    return this._id;
  }
  async getAITextResultProviderName() {
    const result = await this._aiTextResultProviderName.value;
    if (!result) {
      throw Error("Fetching AI name when no provider present.");
    }
    return result;
  }
  isReplaceActive() {
    return this._replaceActive;
  }
  set replaceActive(replaceActive) {
    this._replaceActive = replaceActive;
  }
  get replacePattern() {
    return this._replacePattern;
  }
  get replaceString() {
    return this._replaceString || "";
  }
  set preserveCase(value) {
    this._preserveCase = value;
  }
  get preserveCase() {
    return this._preserveCase;
  }
  set replaceString(replaceString) {
    this._replaceString = replaceString;
    if (this._searchQuery) {
      this._replacePattern = new ReplacePattern(replaceString, this._searchQuery.contentPattern);
    }
    this._onReplaceTermChanged.fire();
  }
  get searchResult() {
    return this._searchResult;
  }
  aiSearch(onResult) {
    if (this.hasAIResults) {
      throw Error("AI results already exist");
    }
    if (!this._searchQuery) {
      throw Error("No search query");
    }
    const searchInstanceID = Date.now().toString();
    const tokenSource = new CancellationTokenSource();
    this.currentAICancelTokenSource = tokenSource;
    const start = Date.now();
    const asyncAIResults = this.searchService.aiTextSearch(
      { ...this._searchQuery, contentPattern: this._searchQuery.contentPattern.pattern, type: QueryType.aiText },
      tokenSource.token,
      async (p) => {
        onResult(p);
        this.onSearchProgress(p, searchInstanceID, false, true);
      }
    ).finally(() => {
      tokenSource.dispose(true);
    }).then(
      (value) => {
        if (value.results.length === 0) {
          onResult(void 0);
        }
        this.onSearchCompleted(value, Date.now() - start, searchInstanceID, true);
        return value;
      },
      (e) => {
        this.onSearchError(e, Date.now() - start, true);
        throw e;
      }
    );
    return asyncAIResults;
  }
  doSearch(query, progressEmitter, searchQuery, searchInstanceID, onProgress, callerToken) {
    const asyncGenerateOnProgress = async (p) => {
      progressEmitter.fire();
      this.onSearchProgress(p, searchInstanceID, false, false);
      onProgress?.(p);
    };
    const syncGenerateOnProgress = (p) => {
      progressEmitter.fire();
      this.onSearchProgress(p, searchInstanceID, true);
      onProgress?.(p);
    };
    const tokenSource = this.currentCancelTokenSource = new CancellationTokenSource(callerToken);
    const notebookResult = this.notebookSearchService.notebookSearch(query, tokenSource.token, searchInstanceID, asyncGenerateOnProgress);
    const textResult = this.searchService.textSearchSplitSyncAsync(
      searchQuery,
      tokenSource.token,
      asyncGenerateOnProgress,
      notebookResult.openFilesToScan,
      notebookResult.allScannedFiles
    );
    const syncResults = textResult.syncResults.results;
    syncResults.forEach((p) => {
      if (p) {
        syncGenerateOnProgress(p);
      }
    });
    const getAsyncResults = async () => {
      const searchStart = Date.now();
      const allClosedEditorResults = await textResult.asyncResults;
      const resolvedNotebookResults = await notebookResult.completeData;
      const searchLength = Date.now() - searchStart;
      const resolvedResult = {
        results: [...allClosedEditorResults.results, ...resolvedNotebookResults.results],
        messages: [...allClosedEditorResults.messages, ...resolvedNotebookResults.messages],
        limitHit: allClosedEditorResults.limitHit || resolvedNotebookResults.limitHit,
        exit: allClosedEditorResults.exit,
        stats: allClosedEditorResults.stats
      };
      this.logService.trace(`whole search time | ${searchLength}ms`);
      return resolvedResult;
    };
    return {
      asyncResults: getAsyncResults().finally(() => tokenSource.dispose(true)),
      syncResults
    };
  }
  get hasAIResults() {
    return !!this.searchResult.getCachedSearchComplete(true) || !!this.currentAICancelTokenSource && !this.currentAICancelTokenSource.token.isCancellationRequested;
  }
  get hasPlainResults() {
    return !!this.searchResult.getCachedSearchComplete(false) || !!this.currentCancelTokenSource && !this.currentCancelTokenSource.token.isCancellationRequested;
  }
  search(query, onProgress, callerToken) {
    this.cancelSearch(true);
    this._searchQuery = query;
    if (!this.searchConfig.searchOnType) {
      this.searchResult.clear();
    }
    const searchInstanceID = Date.now().toString();
    this._searchResult.query = this._searchQuery;
    const progressEmitter = this._register(new Emitter());
    this._replacePattern = new ReplacePattern(this.replaceString, this._searchQuery.contentPattern);
    this._startStreamDelay = new Promise((resolve) => setTimeout(resolve, this.searchConfig.searchOnType ? 150 : 0));
    const req = this.doSearch(query, progressEmitter, this._searchQuery, searchInstanceID, onProgress, callerToken);
    const asyncResults = req.asyncResults;
    const syncResults = req.syncResults;
    if (onProgress) {
      syncResults.forEach((p) => {
        if (p) {
          onProgress(p);
        }
      });
    }
    const start = Date.now();
    let event;
    const progressEmitterPromise = new Promise((resolve) => {
      event = Event.once(progressEmitter.event)(resolve);
      return event;
    });
    Promise.race([asyncResults, progressEmitterPromise]).finally(() => {
      event?.dispose();
      this.telemetryService.publicLog("searchResultsFirstRender", { duration: Date.now() - start });
    });
    try {
      return {
        asyncResults: asyncResults.then(
          (value) => {
            this.onSearchCompleted(value, Date.now() - start, searchInstanceID, false);
            return value;
          },
          (e) => {
            this.onSearchError(e, Date.now() - start, false);
            throw e;
          }
        ),
        syncResults
      };
    } finally {
      this.telemetryService.publicLog("searchResultsFinished", { duration: Date.now() - start });
    }
  }
  onSearchCompleted(completed, duration, searchInstanceID, ai) {
    if (!this._searchQuery) {
      throw new Error("onSearchCompleted must be called after a search is started");
    }
    if (ai) {
      this._searchResult.add(this._aiResultQueue, searchInstanceID, true);
      this._aiResultQueue.length = 0;
    } else {
      this._searchResult.add(this._resultQueue, searchInstanceID, false);
      this._resultQueue.length = 0;
    }
    this.searchResult.setCachedSearchComplete(completed, ai);
    const options = Object.assign({}, this._searchQuery.contentPattern);
    delete options.pattern;
    const stats = completed && completed.stats;
    const fileSchemeOnly = this._searchQuery.folderQueries.every((fq) => fq.folder.scheme === Schemas.file);
    const otherSchemeOnly = this._searchQuery.folderQueries.every((fq) => fq.folder.scheme !== Schemas.file);
    const scheme = fileSchemeOnly ? Schemas.file : otherSchemeOnly ? "other" : "mixed";
    this.telemetryService.publicLog("searchResultsShown", {
      count: this._searchResult.count(),
      fileCount: this._searchResult.fileCount(),
      options,
      duration,
      type: stats && stats.type,
      scheme,
      searchOnTypeEnabled: this.searchConfig.searchOnType
    });
    return completed;
  }
  onSearchError(e, duration, ai) {
    if (errors.isCancellationError(e)) {
      this.onSearchCompleted(
        (ai ? this.aiSearchCancelledForNewSearch : this.searchCancelledForNewSearch) ? { exit: SearchCompletionExitCode.NewSearchStarted, results: [], messages: [] } : void 0,
        duration,
        "",
        ai
      );
      if (ai) {
        this.aiSearchCancelledForNewSearch = false;
      } else {
        this.searchCancelledForNewSearch = false;
      }
    }
  }
  onSearchProgress(p, searchInstanceID, sync = true, ai = false) {
    const targetQueue = ai ? this._aiResultQueue : this._resultQueue;
    if (p.resource) {
      targetQueue.push(p);
      if (sync) {
        if (targetQueue.length) {
          this._searchResult.add(targetQueue, searchInstanceID, false, true);
          targetQueue.length = 0;
        }
      } else {
        this._startStreamDelay.then(() => {
          if (targetQueue.length) {
            this._searchResult.add(targetQueue, searchInstanceID, ai, !ai);
            targetQueue.length = 0;
          }
        });
      }
    }
  }
  get searchConfig() {
    return this.configurationService.getValue("search");
  }
  cancelSearch(cancelledForNewSearch = false) {
    if (this.currentCancelTokenSource) {
      this.searchCancelledForNewSearch = cancelledForNewSearch;
      this.currentCancelTokenSource.cancel();
      return true;
    }
    return false;
  }
  cancelAISearch(cancelledForNewSearch = false) {
    if (this.currentAICancelTokenSource) {
      this.aiSearchCancelledForNewSearch = cancelledForNewSearch;
      this.currentAICancelTokenSource.cancel();
      return true;
    }
    return false;
  }
  clearAiSearchResults() {
    this._aiResultQueue.length = 0;
    this._searchResult.aiTextSearchResult.clear(false);
  }
  dispose() {
    this.cancelSearch();
    this.cancelAISearch();
    this.searchResult.dispose();
    super.dispose();
  }
};
SearchModelImpl = __decorateClass([
  __decorateParam(0, ISearchService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, INotebookSearchService)
], SearchModelImpl);
let SearchViewModelWorkbenchService = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this._searchModel = null;
  }
  get searchModel() {
    if (!this._searchModel) {
      this._searchModel = this.instantiationService.createInstance(SearchModelImpl);
    }
    return this._searchModel;
  }
  set searchModel(searchModel) {
    this._searchModel?.dispose();
    this._searchModel = searchModel;
  }
};
SearchViewModelWorkbenchService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], SearchViewModelWorkbenchService);
export {
  SearchModelImpl,
  SearchViewModelWorkbenchService
};
