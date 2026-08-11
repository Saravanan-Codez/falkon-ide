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
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { getServiceMachineId } from "../../externalServices/common/serviceMachineId.js";
import { IStorageService } from "../../storage/common/storage.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncStoreService, SyncResource, UserDataSyncError, UserDataSyncErrorCode, USER_DATA_SYNC_SCHEME, CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM } from "./userDataSync.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { isSyncData } from "./abstractSynchronizer.js";
import { parseSnippets } from "./snippetsSync.js";
import { parseSettingsSyncContent } from "./settingsSync.js";
import { getKeybindingsContentFromSyncContent } from "./keybindingsSync.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { getTasksContentFromSyncContent } from "./tasksSync.js";
import { getMcpContentFromSyncContent } from "./mcpSync.js";
import { LocalExtensionsProvider, parseExtensions, stringify as stringifyExtensions } from "./extensionsSync.js";
import { LocalGlobalStateProvider, stringify as stringifyGlobalState } from "./globalStateSync.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { parseUserDataProfilesManifest, stringifyLocalProfiles } from "./userDataProfilesManifestSync.js";
import { toFormattedString } from "../../../base/common/jsonFormatter.js";
import { trim } from "../../../base/common/strings.js";
import { parsePrompts } from "./promptsSync/promptsSync.js";
let UserDataSyncResourceProviderService = class {
  constructor(userDataSyncStoreService, userDataSyncLocalStoreService, logService, uriIdentityService, environmentService, storageService, fileService, userDataProfilesService, configurationService, instantiationService) {
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.userDataSyncLocalStoreService = userDataSyncLocalStoreService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.fileService = fileService;
    this.userDataProfilesService = userDataProfilesService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.extUri = uriIdentityService.extUri;
  }
  static {
    this.NOT_EXISTING_RESOURCE = "not-existing-resource";
  }
  static {
    this.REMOTE_BACKUP_AUTHORITY = "remote-backup";
  }
  static {
    this.LOCAL_BACKUP_AUTHORITY = "local-backup";
  }
  async getRemoteSyncedProfiles() {
    const userData = await this.userDataSyncStoreService.readResource(SyncResource.Profiles, null, void 0);
    if (userData.content) {
      const syncData = this.parseSyncData(userData.content, SyncResource.Profiles);
      return parseUserDataProfilesManifest(syncData);
    }
    return [];
  }
  async getLocalSyncedProfiles(location) {
    const refs = await this.userDataSyncLocalStoreService.getAllResourceRefs(SyncResource.Profiles, void 0, location);
    if (refs.length) {
      const content = await this.userDataSyncLocalStoreService.resolveResourceContent(SyncResource.Profiles, refs[0].ref, void 0, location);
      if (content) {
        const syncData = this.parseSyncData(content, SyncResource.Profiles);
        return parseUserDataProfilesManifest(syncData);
      }
    }
    return [];
  }
  async getLocalSyncedMachines(location) {
    const refs = await this.userDataSyncLocalStoreService.getAllResourceRefs("machines", void 0, location);
    if (refs.length) {
      const content = await this.userDataSyncLocalStoreService.resolveResourceContent("machines", refs[0].ref, void 0, location);
      if (content) {
        const machinesData = JSON.parse(content);
        return machinesData.machines.map((m) => ({ ...m, isCurrent: false }));
      }
    }
    return [];
  }
  async getRemoteSyncResourceHandles(syncResource, profile) {
    const handles = await this.userDataSyncStoreService.getAllResourceRefs(syncResource, profile?.collection);
    return handles.map(({ created, ref }) => ({
      created,
      uri: this.toUri({
        remote: true,
        syncResource,
        profile: profile?.id ?? this.userDataProfilesService.defaultProfile.id,
        location: void 0,
        collection: profile?.collection,
        ref,
        node: void 0
      })
    }));
  }
  async getLocalSyncResourceHandles(syncResource, profile, location) {
    const handles = await this.userDataSyncLocalStoreService.getAllResourceRefs(syncResource, profile?.collection, location);
    return handles.map(({ created, ref }) => ({
      created,
      uri: this.toUri({
        remote: false,
        syncResource,
        profile: profile?.id ?? this.userDataProfilesService.defaultProfile.id,
        collection: profile?.collection,
        ref,
        node: void 0,
        location
      })
    }));
  }
  resolveUserDataSyncResource({ uri }) {
    const resolved = this.resolveUri(uri);
    const profile = resolved ? this.userDataProfilesService.profiles.find((p) => p.id === resolved.profile) : void 0;
    return resolved && profile ? { profile, syncResource: resolved?.syncResource } : void 0;
  }
  async getAssociatedResources({ uri }) {
    const resolved = this.resolveUri(uri);
    if (!resolved) {
      return [];
    }
    const profile = this.userDataProfilesService.profiles.find((p) => p.id === resolved.profile);
    switch (resolved.syncResource) {
      case SyncResource.Settings:
        return this.getSettingsAssociatedResources(uri, profile);
      case SyncResource.Keybindings:
        return this.getKeybindingsAssociatedResources(uri, profile);
      case SyncResource.Tasks:
        return this.getTasksAssociatedResources(uri, profile);
      case SyncResource.Mcp:
        return this.getMcpAssociatedResources(uri, profile);
      case SyncResource.Snippets:
        return this.getSnippetsAssociatedResources(uri, profile);
      case SyncResource.Prompts:
        return this.getPromptsAssociatedResources(uri, profile);
      case SyncResource.GlobalState:
        return this.getGlobalStateAssociatedResources(uri, profile);
      case SyncResource.Extensions:
        return this.getExtensionsAssociatedResources(uri, profile);
      case SyncResource.Profiles:
        return this.getProfilesAssociatedResources(uri, profile);
      case SyncResource.WorkspaceState:
        return [];
    }
  }
  async getMachineId({ uri }) {
    const resolved = this.resolveUri(uri);
    if (!resolved) {
      return void 0;
    }
    if (resolved.remote) {
      if (resolved.ref) {
        const { content } = await this.getUserData(resolved.syncResource, resolved.ref, resolved.collection);
        if (content) {
          const syncData = this.parseSyncData(content, resolved.syncResource);
          return syncData?.machineId;
        }
      }
      return void 0;
    }
    if (resolved.location) {
      if (resolved.ref) {
        const content = await this.userDataSyncLocalStoreService.resolveResourceContent(resolved.syncResource, resolved.ref, resolved.collection, resolved.location);
        if (content) {
          const syncData = this.parseSyncData(content, resolved.syncResource);
          return syncData?.machineId;
        }
      }
      return void 0;
    }
    return getServiceMachineId(this.environmentService, this.fileService, this.storageService);
  }
  async resolveContent(uri) {
    const resolved = this.resolveUri(uri);
    if (!resolved) {
      return null;
    }
    if (resolved.node === UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE) {
      return null;
    }
    if (resolved.ref) {
      const content = await this.getContentFromStore(resolved.remote, resolved.syncResource, resolved.collection, resolved.ref, resolved.location);
      if (resolved.node && content) {
        return this.resolveNodeContent(resolved.syncResource, content, resolved.node);
      }
      return content;
    }
    if (!resolved.remote && !resolved.node) {
      return this.resolveLatestContent(resolved.syncResource, resolved.profile);
    }
    return null;
  }
  async getContentFromStore(remote, syncResource, collection, ref, location) {
    if (remote) {
      const { content } = await this.getUserData(syncResource, ref, collection);
      return content;
    }
    return this.userDataSyncLocalStoreService.resolveResourceContent(syncResource, ref, collection, location);
  }
  resolveNodeContent(syncResource, content, node) {
    const syncData = this.parseSyncData(content, syncResource);
    switch (syncResource) {
      case SyncResource.Settings:
        return this.resolveSettingsNodeContent(syncData, node);
      case SyncResource.Keybindings:
        return this.resolveKeybindingsNodeContent(syncData, node);
      case SyncResource.Tasks:
        return this.resolveTasksNodeContent(syncData, node);
      case SyncResource.Mcp:
        return this.resolveMcpNodeContent(syncData, node);
      case SyncResource.Snippets:
        return this.resolveSnippetsNodeContent(syncData, node);
      case SyncResource.Prompts:
        return this.resolvePromptsNodeContent(syncData, node);
      case SyncResource.GlobalState:
        return this.resolveGlobalStateNodeContent(syncData, node);
      case SyncResource.Extensions:
        return this.resolveExtensionsNodeContent(syncData, node);
      case SyncResource.Profiles:
        return this.resolveProfileNodeContent(syncData, node);
      case SyncResource.WorkspaceState:
        return null;
    }
  }
  async resolveLatestContent(syncResource, profileId) {
    const profile = this.userDataProfilesService.profiles.find((p) => p.id === profileId);
    if (!profile) {
      return null;
    }
    switch (syncResource) {
      case SyncResource.GlobalState:
        return this.resolveLatestGlobalStateContent(profile);
      case SyncResource.Extensions:
        return this.resolveLatestExtensionsContent(profile);
      case SyncResource.Profiles:
        return this.resolveLatestProfilesContent(profile);
      case SyncResource.Settings:
        return null;
      case SyncResource.Keybindings:
        return null;
      case SyncResource.Tasks:
        return null;
      case SyncResource.Mcp:
        return null;
      case SyncResource.Snippets:
        return null;
      case SyncResource.Prompts:
        return null;
      case SyncResource.WorkspaceState:
        return null;
    }
  }
  getSettingsAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "settings.json");
    const comparableResource = profile ? profile.settingsResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveSettingsNodeContent(syncData, node) {
    switch (node) {
      case "settings.json":
        return parseSettingsSyncContent(syncData.content).settings;
    }
    return null;
  }
  getKeybindingsAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "keybindings.json");
    const comparableResource = profile ? profile.keybindingsResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveKeybindingsNodeContent(syncData, node) {
    switch (node) {
      case "keybindings.json":
        return getKeybindingsContentFromSyncContent(syncData.content, !!this.configurationService.getValue(CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM), this.logService);
    }
    return null;
  }
  getTasksAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "tasks.json");
    const comparableResource = profile ? profile.tasksResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveTasksNodeContent(syncData, node) {
    switch (node) {
      case "tasks.json":
        return getTasksContentFromSyncContent(syncData.content, this.logService);
    }
    return null;
  }
  async getSnippetsAssociatedResources(uri, profile) {
    const content = await this.resolveContent(uri);
    if (content) {
      const syncData = this.parseSyncData(content, SyncResource.Snippets);
      if (syncData) {
        const snippets = parseSnippets(syncData);
        const result = [];
        for (const snippet of Object.keys(snippets)) {
          const resource = this.extUri.joinPath(uri, snippet);
          const comparableResource = profile ? this.extUri.joinPath(profile.snippetsHome, snippet) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
          result.push({ resource, comparableResource });
        }
        return result;
      }
    }
    return [];
  }
  resolveSnippetsNodeContent(syncData, node) {
    return parseSnippets(syncData)[node] || null;
  }
  async getPromptsAssociatedResources(uri, profile) {
    const content = await this.resolveContent(uri);
    if (content) {
      const syncData = this.parseSyncData(content, SyncResource.Prompts);
      if (syncData) {
        const prompts = parsePrompts(syncData);
        const result = [];
        for (const prompt of Object.keys(prompts)) {
          const resource = this.extUri.joinPath(uri, prompt);
          const comparableResource = profile ? this.extUri.joinPath(profile.promptsHome, prompt) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
          result.push({ resource, comparableResource });
        }
        return result;
      }
    }
    return [];
  }
  resolvePromptsNodeContent(syncData, node) {
    return parsePrompts(syncData)[node] || null;
  }
  getExtensionsAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "extensions.json");
    const comparableResource = profile ? this.toUri({
      remote: false,
      syncResource: SyncResource.Extensions,
      profile: profile.id,
      location: void 0,
      collection: void 0,
      ref: void 0,
      node: void 0
    }) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveExtensionsNodeContent(syncData, node) {
    switch (node) {
      case "extensions.json":
        return stringifyExtensions(parseExtensions(syncData), true);
    }
    return null;
  }
  async resolveLatestExtensionsContent(profile) {
    const { localExtensions } = await this.instantiationService.createInstance(LocalExtensionsProvider).getLocalExtensions(profile);
    return stringifyExtensions(localExtensions, true);
  }
  getGlobalStateAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "globalState.json");
    const comparableResource = profile ? this.toUri({
      remote: false,
      syncResource: SyncResource.GlobalState,
      profile: profile.id,
      location: void 0,
      collection: void 0,
      ref: void 0,
      node: void 0
    }) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveGlobalStateNodeContent(syncData, node) {
    switch (node) {
      case "globalState.json":
        return stringifyGlobalState(JSON.parse(syncData.content), true);
    }
    return null;
  }
  async resolveLatestGlobalStateContent(profile) {
    const localGlobalState = await this.instantiationService.createInstance(LocalGlobalStateProvider).getLocalGlobalState(profile);
    return stringifyGlobalState(localGlobalState, true);
  }
  getProfilesAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "profiles.json");
    const comparableResource = this.toUri({
      remote: false,
      syncResource: SyncResource.Profiles,
      profile: this.userDataProfilesService.defaultProfile.id,
      location: void 0,
      collection: void 0,
      ref: void 0,
      node: void 0
    });
    return [{ resource, comparableResource }];
  }
  resolveProfileNodeContent(syncData, node) {
    switch (node) {
      case "profiles.json":
        return toFormattedString(JSON.parse(syncData.content), {});
    }
    return null;
  }
  async resolveLatestProfilesContent(profile) {
    return stringifyLocalProfiles(this.userDataProfilesService.profiles.filter((p) => !p.isDefault && !p.isTransient), true);
  }
  toUri(syncResourceUriInfo) {
    const authority = syncResourceUriInfo.remote ? UserDataSyncResourceProviderService.REMOTE_BACKUP_AUTHORITY : UserDataSyncResourceProviderService.LOCAL_BACKUP_AUTHORITY;
    const paths = [];
    if (syncResourceUriInfo.location) {
      paths.push(`scheme:${syncResourceUriInfo.location.scheme}`);
      paths.push(`authority:${syncResourceUriInfo.location.authority}`);
      paths.push(trim(syncResourceUriInfo.location.path, "/"));
    }
    paths.push(`syncResource:${syncResourceUriInfo.syncResource}`);
    paths.push(`profile:${syncResourceUriInfo.profile}`);
    if (syncResourceUriInfo.collection) {
      paths.push(`collection:${syncResourceUriInfo.collection}`);
    }
    if (syncResourceUriInfo.ref) {
      paths.push(`ref:${syncResourceUriInfo.ref}`);
    }
    if (syncResourceUriInfo.node) {
      paths.push(syncResourceUriInfo.node);
    }
    return this.extUri.joinPath(URI.from({ scheme: USER_DATA_SYNC_SCHEME, authority, path: `/`, query: syncResourceUriInfo.location?.query, fragment: syncResourceUriInfo.location?.fragment }), ...paths);
  }
  resolveUri(uri) {
    if (uri.scheme !== USER_DATA_SYNC_SCHEME) {
      return void 0;
    }
    const paths = [];
    while (uri.path !== "/") {
      paths.unshift(this.extUri.basename(uri));
      uri = this.extUri.dirname(uri);
    }
    if (paths.length < 2) {
      return void 0;
    }
    const remote = uri.authority === UserDataSyncResourceProviderService.REMOTE_BACKUP_AUTHORITY;
    let scheme;
    let authority;
    const locationPaths = [];
    let syncResource;
    let profile;
    let collection;
    let ref;
    let node;
    while (paths.length) {
      const path = paths.shift();
      if (path.startsWith("scheme:")) {
        scheme = path.substring("scheme:".length);
      } else if (path.startsWith("authority:")) {
        authority = path.substring("authority:".length);
      } else if (path.startsWith("syncResource:")) {
        syncResource = path.substring("syncResource:".length);
      } else if (path.startsWith("profile:")) {
        profile = path.substring("profile:".length);
      } else if (path.startsWith("collection:")) {
        collection = path.substring("collection:".length);
      } else if (path.startsWith("ref:")) {
        ref = path.substring("ref:".length);
      } else if (!syncResource) {
        locationPaths.push(path);
      } else {
        node = path;
      }
    }
    return {
      remote,
      syncResource,
      profile,
      collection,
      ref,
      node,
      location: scheme && authority !== void 0 ? this.extUri.joinPath(URI.from({ scheme, authority, query: uri.query, fragment: uri.fragment, path: "/" }), ...locationPaths) : void 0
    };
  }
  parseSyncData(content, syncResource) {
    try {
      const syncData = JSON.parse(content);
      if (isSyncData(syncData)) {
        return syncData;
      }
    } catch (error) {
      this.logService.error(error);
    }
    throw new UserDataSyncError(localize("incompatible sync data", "Cannot parse sync data as it is not compatible with the current version."), UserDataSyncErrorCode.IncompatibleRemoteContent, syncResource);
  }
  async getUserData(syncResource, ref, collection) {
    const content = await this.userDataSyncStoreService.resolveResourceContent(syncResource, ref, collection);
    return { ref, content };
  }
  getMcpAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "mcp.json");
    const comparableResource = profile ? profile.mcpResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveMcpNodeContent(syncData, node) {
    switch (node) {
      case "mcp.json":
        return getMcpContentFromSyncContent(syncData.content, this.logService);
    }
    return null;
  }
};
UserDataSyncResourceProviderService = __decorateClass([
  __decorateParam(0, IUserDataSyncStoreService),
  __decorateParam(1, IUserDataSyncLocalStoreService),
  __decorateParam(2, IUserDataSyncLogService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IUserDataProfilesService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IInstantiationService)
], UserDataSyncResourceProviderService);
export {
  UserDataSyncResourceProviderService
};
