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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { DisposableStore, dispose } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ISearchService, QueryType, SearchProviderType } from "../../services/search/common/search.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { revive } from "../../../base/common/marshalling.js";
import * as Constants from "../../contrib/search/common/constants.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
let MainThreadSearch = class {
  constructor(extHostContext, _searchService, _telemetryService, _configurationService, contextKeyService) {
    this._searchService = _searchService;
    this._telemetryService = _telemetryService;
    this.contextKeyService = contextKeyService;
    this._searchProvider = /* @__PURE__ */ new Map();
    this._aiSearchProviderHandles = /* @__PURE__ */ new Set();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSearch);
    this._proxy.$enableExtensionHostSearch();
  }
  dispose() {
    this._searchProvider.forEach((value) => value.dispose());
    this._searchProvider.clear();
    this._aiSearchProviderHandles.clear();
    Constants.SearchContext.hasAIResultProvider.bindTo(this.contextKeyService).set(false);
  }
  $registerTextSearchProvider(handle, scheme) {
    this._searchProvider.set(handle, new RemoteSearchProvider(this._searchService, SearchProviderType.text, scheme, handle, this._proxy));
  }
  $registerAITextSearchProvider(handle, scheme) {
    Constants.SearchContext.hasAIResultProvider.bindTo(this.contextKeyService).set(true);
    this._aiSearchProviderHandles.add(handle);
    this._searchProvider.set(handle, new RemoteSearchProvider(this._searchService, SearchProviderType.aiText, scheme, handle, this._proxy));
  }
  $registerFileSearchProvider(handle, scheme) {
    this._searchProvider.set(handle, new RemoteSearchProvider(this._searchService, SearchProviderType.file, scheme, handle, this._proxy));
  }
  $unregisterProvider(handle) {
    dispose(this._searchProvider.get(handle));
    this._searchProvider.delete(handle);
    if (this._aiSearchProviderHandles.delete(handle) && this._aiSearchProviderHandles.size === 0) {
      Constants.SearchContext.hasAIResultProvider.bindTo(this.contextKeyService).set(false);
    }
  }
  $handleFileMatch(handle, session, data) {
    const provider = this._searchProvider.get(handle);
    if (!provider) {
      throw new Error("Got result for unknown provider");
    }
    provider.handleFindMatch(session, data);
  }
  $handleTextMatch(handle, session, data) {
    const provider = this._searchProvider.get(handle);
    if (!provider) {
      throw new Error("Got result for unknown provider");
    }
    provider.handleFindMatch(session, data);
  }
  $handleKeywordResult(handle, session, data) {
    const provider = this._searchProvider.get(handle);
    if (!provider) {
      throw new Error("Got result for unknown provider");
    }
    provider.handleKeywordResult(session, data);
  }
  $handleTelemetry(eventName, data) {
    this._telemetryService.publicLog(eventName, data);
  }
};
MainThreadSearch = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadSearch),
  __decorateParam(1, ISearchService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService)
], MainThreadSearch);
class SearchOperation {
  constructor(progress, id = ++SearchOperation._idPool, matches = /* @__PURE__ */ new Map(), keywords = []) {
    this.progress = progress;
    this.id = id;
    this.matches = matches;
    this.keywords = keywords;
  }
  static {
    this._idPool = 0;
  }
  addMatch(match) {
    const existingMatch = this.matches.get(match.resource.toString());
    if (existingMatch) {
      if (existingMatch.results && match.results) {
        existingMatch.results.push(...match.results);
      }
    } else {
      this.matches.set(match.resource.toString(), match);
    }
    this.progress?.(match);
  }
  addKeyword(result) {
    this.keywords.push(result);
    this.progress?.(result);
  }
}
class RemoteSearchProvider {
  constructor(searchService, type, _scheme, _handle, _proxy) {
    this._scheme = _scheme;
    this._handle = _handle;
    this._proxy = _proxy;
    this._registrations = new DisposableStore();
    this._searches = /* @__PURE__ */ new Map();
    this._registrations.add(searchService.registerSearchResultProvider(this._scheme, type, this));
  }
  async getAIName() {
    if (this.cachedAIName === void 0) {
      this.cachedAIName = await this._proxy.$getAIName(this._handle);
    }
    return this.cachedAIName;
  }
  dispose() {
    this._registrations.dispose();
  }
  fileSearch(query, token = CancellationToken.None) {
    return this.doSearch(query, void 0, token);
  }
  textSearch(query, onProgress, token = CancellationToken.None) {
    return this.doSearch(query, onProgress, token);
  }
  doSearch(query, onProgress, token = CancellationToken.None) {
    if (!query.folderQueries.length) {
      throw new Error("Empty folderQueries");
    }
    const search = new SearchOperation(onProgress);
    this._searches.set(search.id, search);
    const searchP = this._provideSearchResults(query, search.id, token);
    return Promise.resolve(searchP).then((result) => {
      this._searches.delete(search.id);
      return { results: Array.from(search.matches.values()), aiKeywords: Array.from(search.keywords), stats: result.stats, limitHit: result.limitHit, messages: result.messages };
    }, (err) => {
      this._searches.delete(search.id);
      return Promise.reject(err);
    });
  }
  clearCache(cacheKey) {
    return Promise.resolve(this._proxy.$clearCache(cacheKey));
  }
  handleFindMatch(session, dataOrUri) {
    const searchOp = this._searches.get(session);
    if (!searchOp) {
      return;
    }
    dataOrUri.forEach((result) => {
      if (result.results) {
        searchOp.addMatch(revive(result));
      } else {
        searchOp.addMatch({
          resource: URI.revive(result)
        });
      }
    });
  }
  handleKeywordResult(session, data) {
    const searchOp = this._searches.get(session);
    if (!searchOp) {
      return;
    }
    searchOp.addKeyword(data);
  }
  _provideSearchResults(query, session, token) {
    switch (query.type) {
      case QueryType.File:
        return this._proxy.$provideFileSearchResults(this._handle, session, query, token);
      case QueryType.Text:
        return this._proxy.$provideTextSearchResults(this._handle, session, query, token);
      default:
        return this._proxy.$provideAITextSearchResults(this._handle, session, query, token);
    }
  }
}
export {
  MainThreadSearch
};
