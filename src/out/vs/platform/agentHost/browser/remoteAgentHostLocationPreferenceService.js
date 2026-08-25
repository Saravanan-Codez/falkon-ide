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
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { isRemoteAgentHostLocationPreference } from "../common/remoteAgentHostLocationPreference.js";
const REMOTE_AGENT_HOST_LOCATION_PREFERENCE_STORAGE_KEY = "remoteAgentHost.locationPreferences";
function parseRemoteAgentHostLocationPreferences(raw) {
  const preferences = /* @__PURE__ */ new Map();
  if (!raw) {
    return preferences;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return preferences;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return preferences;
  }
  for (const [hostKey, value] of Object.entries(parsed)) {
    if (hostKey && isRemoteAgentHostLocationPreference(value)) {
      preferences.set(hostKey, value);
    }
  }
  return preferences;
}
let RemoteAgentHostLocationPreferenceService = class extends Disposable {
  constructor(_storageService) {
    super();
    this._storageService = _storageService;
    this._onDidChangePreference = this._register(new Emitter());
    this.onDidChangePreference = this._onDidChangePreference.event;
  }
  getPreference(hostKey) {
    return this._readPreferences().get(hostKey);
  }
  setPreference(hostKey, preference) {
    const preferences = this._readPreferences();
    preferences.set(hostKey, preference);
    this._writePreferences(preferences);
    this._onDidChangePreference.fire(hostKey);
  }
  _readPreferences() {
    return parseRemoteAgentHostLocationPreferences(this._storageService.get(REMOTE_AGENT_HOST_LOCATION_PREFERENCE_STORAGE_KEY, StorageScope.APPLICATION));
  }
  _writePreferences(preferences) {
    if (preferences.size === 0) {
      this._storageService.remove(REMOTE_AGENT_HOST_LOCATION_PREFERENCE_STORAGE_KEY, StorageScope.APPLICATION);
      return;
    }
    this._storageService.store(
      REMOTE_AGENT_HOST_LOCATION_PREFERENCE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(preferences)),
      StorageScope.APPLICATION,
      StorageTarget.USER
    );
  }
};
RemoteAgentHostLocationPreferenceService = __decorateClass([
  __decorateParam(0, IStorageService)
], RemoteAgentHostLocationPreferenceService);
export {
  REMOTE_AGENT_HOST_LOCATION_PREFERENCE_STORAGE_KEY,
  RemoteAgentHostLocationPreferenceService,
  parseRemoteAgentHostLocationPreferences
};
