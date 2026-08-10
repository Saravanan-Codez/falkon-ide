import { distinct } from "../../../base/common/arrays.js";
import { isObject, isString } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { allSettings, ConfigurationScope, Extensions as ConfigurationExtensions, getAllConfigurationProperties, parseScope } from "../../configuration/common/configurationRegistry.js";
import { EXTENSION_IDENTIFIER_PATTERN } from "../../extensionManagement/common/extensionManagement.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { Extensions as JSONExtensions } from "../../jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../registry/common/platform.js";
function getDisallowedIgnoredSettings() {
  const allSettings2 = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
  return Object.keys(allSettings2).filter((setting) => !!allSettings2[setting].disallowSyncIgnore);
}
function getDefaultIgnoredSettings(excludeExtensions = false) {
  const allSettings2 = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
  const ignoredSettings = getIgnoredSettings(allSettings2, excludeExtensions);
  const disallowedSettings = getDisallowedIgnoredSettings();
  return distinct([...ignoredSettings, ...disallowedSettings]);
}
function getIgnoredSettingsForExtension(manifest) {
  if (!manifest.contributes?.configuration) {
    return [];
  }
  const configurations = Array.isArray(manifest.contributes.configuration) ? manifest.contributes.configuration : [manifest.contributes.configuration];
  if (!configurations.length) {
    return [];
  }
  const properties = getAllConfigurationProperties(configurations);
  return getIgnoredSettings(properties, false);
}
function getIgnoredSettings(properties, excludeExtensions) {
  const ignoredSettings = /* @__PURE__ */ new Set();
  for (const key in properties) {
    if (excludeExtensions && !!properties[key].source) {
      continue;
    }
    const scope = isString(properties[key].scope) ? parseScope(properties[key].scope) : properties[key].scope;
    if (properties[key].ignoreSync || scope === ConfigurationScope.MACHINE || scope === ConfigurationScope.MACHINE_OVERRIDABLE) {
      ignoredSettings.add(key);
    }
  }
  return [...ignoredSettings.values()];
}
const USER_DATA_SYNC_CONFIGURATION_SCOPE = "settingsSync";
const CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM = "settingsSync.keybindingsPerPlatform";
function registerConfiguration() {
  const ignoredSettingsSchemaId = "vscode://schemas/ignoredSettings";
  const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
  configurationRegistry.registerConfiguration({
    id: "settingsSync",
    order: 30,
    title: localize("settings sync", "Settings Sync"),
    type: "object",
    properties: {
      [CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM]: {
        type: "boolean",
        description: localize("settingsSync.keybindingsPerPlatform", "Synchronize keybindings for each platform."),
        default: true,
        scope: ConfigurationScope.APPLICATION,
        tags: ["sync", "usesOnlineServices"]
      },
      "settingsSync.ignoredExtensions": {
        "type": "array",
        markdownDescription: localize("settingsSync.ignoredExtensions", "List of extensions to be ignored while synchronizing. The identifier of an extension is always `${publisher}.${name}`. For example: `vscode.csharp`."),
        items: [{
          type: "string",
          pattern: EXTENSION_IDENTIFIER_PATTERN,
          errorMessage: localize("app.extension.identifier.errorMessage", "Expected format '${publisher}.${name}'. Example: 'vscode.csharp'.")
        }],
        "default": [],
        "scope": ConfigurationScope.APPLICATION,
        uniqueItems: true,
        disallowSyncIgnore: true,
        tags: ["sync", "usesOnlineServices"]
      },
      "settingsSync.ignoredSettings": {
        "type": "array",
        description: localize("settingsSync.ignoredSettings", "Configure settings to be ignored while synchronizing."),
        "default": [],
        "scope": ConfigurationScope.APPLICATION,
        $ref: ignoredSettingsSchemaId,
        additionalProperties: true,
        uniqueItems: true,
        disallowSyncIgnore: true,
        tags: ["sync", "usesOnlineServices"]
      }
    }
  });
  const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
  const registerIgnoredSettingsSchema = () => {
    const disallowedIgnoredSettings = getDisallowedIgnoredSettings();
    const defaultIgnoredSettings = getDefaultIgnoredSettings();
    const settings = Object.keys(allSettings.properties).filter((setting) => !defaultIgnoredSettings.includes(setting));
    const ignoredSettings = defaultIgnoredSettings.filter((setting) => !disallowedIgnoredSettings.includes(setting));
    const ignoredSettingsSchema = {
      items: {
        type: "string",
        enum: [...settings, ...ignoredSettings.map((setting) => `-${setting}`)]
      }
    };
    jsonRegistry.registerSchema(ignoredSettingsSchemaId, ignoredSettingsSchema);
  };
  return configurationRegistry.onDidUpdateConfiguration(() => registerIgnoredSettingsSchema());
}
const NON_EXISTING_RESOURCE_REF = "0";
function isAuthenticationProvider(thing) {
  return thing && isObject(thing) && isString(thing.id) && Array.isArray(thing.scopes);
}
var SyncResource = /* @__PURE__ */ ((SyncResource2) => {
  SyncResource2["Settings"] = "settings";
  SyncResource2["Keybindings"] = "keybindings";
  SyncResource2["Snippets"] = "snippets";
  SyncResource2["Prompts"] = "prompts";
  SyncResource2["Tasks"] = "tasks";
  SyncResource2["Mcp"] = "mcp";
  SyncResource2["Extensions"] = "extensions";
  SyncResource2["GlobalState"] = "globalState";
  SyncResource2["Profiles"] = "profiles";
  SyncResource2["WorkspaceState"] = "workspaceState";
  return SyncResource2;
})(SyncResource || {});
const ALL_SYNC_RESOURCES = ["settings" /* Settings */, "keybindings" /* Keybindings */, "snippets" /* Snippets */, "prompts" /* Prompts */, "tasks" /* Tasks */, "extensions" /* Extensions */, "globalState" /* GlobalState */, "profiles" /* Profiles */, "mcp" /* Mcp */];
function getPathSegments(collection, ...paths) {
  return collection ? [collection, ...paths] : paths;
}
function getLastSyncResourceUri(collection, syncResource, environmentService, extUri) {
  return extUri.joinPath(environmentService.userDataSyncHome, ...getPathSegments(collection, syncResource, `lastSync${syncResource}.json`));
}
function isUserDataManifest(thing) {
  return thing && isString(thing.session) && isString(thing.ref) && (isObject(thing.latest) || thing.latest === void 0) && (isObject(thing.collections) || thing.collections === void 0);
}
const IUserDataSyncStoreManagementService = createDecorator("IUserDataSyncStoreManagementService");
const IUserDataSyncStoreService = createDecorator("IUserDataSyncStoreService");
const IUserDataSyncLocalStoreService = createDecorator("IUserDataSyncLocalStoreService");
const HEADER_OPERATION_ID = "x-operation-id";
const HEADER_EXECUTION_ID = "X-Execution-Id";
function createSyncHeaders(executionId) {
  const headers = {};
  headers[HEADER_EXECUTION_ID] = executionId;
  return headers;
}
var UserDataSyncErrorCode = /* @__PURE__ */ ((UserDataSyncErrorCode2) => {
  UserDataSyncErrorCode2["Unauthorized"] = "Unauthorized";
  UserDataSyncErrorCode2["Forbidden"] = "Forbidden";
  UserDataSyncErrorCode2["NotFound"] = "NotFound";
  UserDataSyncErrorCode2["MethodNotFound"] = "MethodNotFound";
  UserDataSyncErrorCode2["Conflict"] = "Conflict";
  UserDataSyncErrorCode2["Gone"] = "Gone";
  UserDataSyncErrorCode2["PreconditionFailed"] = "PreconditionFailed";
  UserDataSyncErrorCode2["TooLarge"] = "TooLarge";
  UserDataSyncErrorCode2["UpgradeRequired"] = "UpgradeRequired";
  UserDataSyncErrorCode2["PreconditionRequired"] = "PreconditionRequired";
  UserDataSyncErrorCode2["TooManyRequests"] = "RemoteTooManyRequests";
  UserDataSyncErrorCode2["TooManyRequestsAndRetryAfter"] = "TooManyRequestsAndRetryAfter";
  UserDataSyncErrorCode2["RequestFailed"] = "RequestFailed";
  UserDataSyncErrorCode2["RequestCanceled"] = "RequestCanceled";
  UserDataSyncErrorCode2["RequestTimeout"] = "RequestTimeout";
  UserDataSyncErrorCode2["RequestProtocolNotSupported"] = "RequestProtocolNotSupported";
  UserDataSyncErrorCode2["RequestPathNotEscaped"] = "RequestPathNotEscaped";
  UserDataSyncErrorCode2["RequestHeadersNotObject"] = "RequestHeadersNotObject";
  UserDataSyncErrorCode2["NoCollection"] = "NoCollection";
  UserDataSyncErrorCode2["NoRef"] = "NoRef";
  UserDataSyncErrorCode2["EmptyResponse"] = "EmptyResponse";
  UserDataSyncErrorCode2["TurnedOff"] = "TurnedOff";
  UserDataSyncErrorCode2["SessionExpired"] = "SessionExpired";
  UserDataSyncErrorCode2["ServiceChanged"] = "ServiceChanged";
  UserDataSyncErrorCode2["DefaultServiceChanged"] = "DefaultServiceChanged";
  UserDataSyncErrorCode2["LocalTooManyProfiles"] = "LocalTooManyProfiles";
  UserDataSyncErrorCode2["LocalTooManyRequests"] = "LocalTooManyRequests";
  UserDataSyncErrorCode2["LocalPreconditionFailed"] = "LocalPreconditionFailed";
  UserDataSyncErrorCode2["LocalInvalidContent"] = "LocalInvalidContent";
  UserDataSyncErrorCode2["LocalError"] = "LocalError";
  UserDataSyncErrorCode2["IncompatibleLocalContent"] = "IncompatibleLocalContent";
  UserDataSyncErrorCode2["IncompatibleRemoteContent"] = "IncompatibleRemoteContent";
  UserDataSyncErrorCode2["Unknown"] = "Unknown";
  return UserDataSyncErrorCode2;
})(UserDataSyncErrorCode || {});
class UserDataSyncError extends Error {
  constructor(message, code, resource, operationId) {
    super(message);
    this.code = code;
    this.resource = resource;
    this.operationId = operationId;
    this.name = `${this.code} (UserDataSyncError) syncResource:${this.resource || "unknown"} operationId:${this.operationId || "unknown"}`;
  }
}
class UserDataSyncStoreError extends UserDataSyncError {
  constructor(message, url, code, serverCode, operationId) {
    super(message, code, void 0, operationId);
    this.url = url;
    this.serverCode = serverCode;
  }
}
class UserDataAutoSyncError extends UserDataSyncError {
  constructor(message, code) {
    super(message, code);
  }
}
((UserDataSyncError2) => {
  function toUserDataSyncError(error) {
    if (error instanceof UserDataSyncError2) {
      return error;
    }
    const match = /^(.+) \(UserDataSyncError\) syncResource:(.+) operationId:(.+)$/.exec(error.name);
    if (match && match[1]) {
      const syncResource = match[2] === "unknown" ? void 0 : match[2];
      const operationId = match[3] === "unknown" ? void 0 : match[3];
      return new UserDataSyncError2(error.message, match[1], syncResource, operationId);
    }
    return new UserDataSyncError2(error.message, "Unknown" /* Unknown */);
  }
  UserDataSyncError2.toUserDataSyncError = toUserDataSyncError;
})(UserDataSyncError || (UserDataSyncError = {}));
var SyncStatus = /* @__PURE__ */ ((SyncStatus2) => {
  SyncStatus2["Uninitialized"] = "uninitialized";
  SyncStatus2["Idle"] = "idle";
  SyncStatus2["Syncing"] = "syncing";
  SyncStatus2["HasConflicts"] = "hasConflicts";
  return SyncStatus2;
})(SyncStatus || {});
var Change = /* @__PURE__ */ ((Change2) => {
  Change2[Change2["None"] = 0] = "None";
  Change2[Change2["Added"] = 1] = "Added";
  Change2[Change2["Modified"] = 2] = "Modified";
  Change2[Change2["Deleted"] = 3] = "Deleted";
  return Change2;
})(Change || {});
var MergeState = /* @__PURE__ */ ((MergeState2) => {
  MergeState2["Preview"] = "preview";
  MergeState2["Conflict"] = "conflict";
  MergeState2["Accepted"] = "accepted";
  return MergeState2;
})(MergeState || {});
const SYNC_SERVICE_URL_TYPE = "sync.store.url.type";
function getEnablementKey(resource) {
  return `sync.enable.${resource}`;
}
const IUserDataSyncEnablementService = createDecorator("IUserDataSyncEnablementService");
const IUserDataSyncService = createDecorator("IUserDataSyncService");
const IUserDataSyncResourceProviderService = createDecorator("IUserDataSyncResourceProviderService");
const IUserDataAutoSyncService = createDecorator("IUserDataAutoSyncService");
const IUserDataSyncUtilService = createDecorator("IUserDataSyncUtilService");
const IUserDataSyncLogService = createDecorator("IUserDataSyncLogService");
const USER_DATA_SYNC_LOG_ID = "userDataSync";
const USER_DATA_SYNC_SCHEME = "vscode-userdata-sync";
const PREVIEW_DIR_NAME = "preview";
export {
  ALL_SYNC_RESOURCES,
  CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM,
  Change,
  HEADER_EXECUTION_ID,
  HEADER_OPERATION_ID,
  IUserDataAutoSyncService,
  IUserDataSyncEnablementService,
  IUserDataSyncLocalStoreService,
  IUserDataSyncLogService,
  IUserDataSyncResourceProviderService,
  IUserDataSyncService,
  IUserDataSyncStoreManagementService,
  IUserDataSyncStoreService,
  IUserDataSyncUtilService,
  MergeState,
  NON_EXISTING_RESOURCE_REF,
  PREVIEW_DIR_NAME,
  SYNC_SERVICE_URL_TYPE,
  SyncResource,
  SyncStatus,
  USER_DATA_SYNC_CONFIGURATION_SCOPE,
  USER_DATA_SYNC_LOG_ID,
  USER_DATA_SYNC_SCHEME,
  UserDataAutoSyncError,
  UserDataSyncError,
  UserDataSyncErrorCode,
  UserDataSyncStoreError,
  createSyncHeaders,
  getDefaultIgnoredSettings,
  getDisallowedIgnoredSettings,
  getEnablementKey,
  getIgnoredSettingsForExtension,
  getLastSyncResourceUri,
  getPathSegments,
  isAuthenticationProvider,
  isUserDataManifest,
  registerConfiguration
};
