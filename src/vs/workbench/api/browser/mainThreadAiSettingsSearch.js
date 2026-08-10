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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IAiSettingsSearchService } from "../../services/aiSettingsSearch/common/aiSettingsSearch.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadAiSettingsSearch = class extends Disposable {
  constructor(context, _settingsSearchService) {
    super();
    this._settingsSearchService = _settingsSearchService;
    this._registrations = this._register(new DisposableMap());
    this._proxy = context.getProxy(ExtHostContext.ExtHostAiSettingsSearch);
  }
  $registerAiSettingsSearchProvider(handle) {
    const provider = {
      searchSettings: (query, option, token) => {
        return this._proxy.$startSearch(handle, query, option, token);
      }
    };
    this._registrations.set(handle, this._settingsSearchService.registerSettingsSearchProvider(provider));
  }
  $unregisterAiSettingsSearchProvider(handle) {
    this._registrations.deleteAndDispose(handle);
  }
  $handleSearchResult(handle, result) {
    if (!this._registrations.has(handle)) {
      throw new Error(`No AI settings search provider found`);
    }
    this._settingsSearchService.handleSearchResult(result);
  }
};
MainThreadAiSettingsSearch = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadAiSettingsSearch),
  __decorateParam(1, IAiSettingsSearchService)
], MainThreadAiSettingsSearch);
export {
  MainThreadAiSettingsSearch
};
