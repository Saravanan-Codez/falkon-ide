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
import { basename } from "../../../../base/common/resources.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isRecentFolder, IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { ISessionsProvidersService } from "./sessionsProvidersService.js";
const STORAGE_KEY_RECENT_WORKSPACES = "sessions.recentlyPickedWorkspaces";
const MAX_RECENT_WORKSPACES = 10;
const MAX_VSCODE_RECENT_WORKSPACES = 10;
function isWorktreeWorkspaceUri(uri) {
  return uri.path.split("/").some((segment) => {
    const normalizedSegment = segment.toLowerCase();
    return normalizedSegment.endsWith(".worktrees") || normalizedSegment === "copilot-worktrees";
  });
}
const ISessionsRecentWorkspacesService = createDecorator("sessionsRecentWorkspacesService");
let SessionsRecentWorkspacesService = class extends Disposable {
  constructor(storageService, uriIdentityService, workspacesService, sessionsProvidersService) {
    super();
    this.storageService = storageService;
    this.uriIdentityService = uriIdentityService;
    this.workspacesService = workspacesService;
    this.sessionsProvidersService = sessionsProvidersService;
    this._onDidChangeRecentWorkspaces = this._register(new Emitter());
    this.onDidChangeRecentWorkspaces = this._onDidChangeRecentWorkspaces.event;
    this._vsCodeRecentFolderUris = [];
    this._refreshVSCodeRecentWorkspaces();
    this._register(this.workspacesService.onDidChangeRecentlyOpened(() => this._refreshVSCodeRecentWorkspaces()));
  }
  getRecentWorkspaces(includeVSCodeRecents = true) {
    const own = this._getStoredRecentWorkspaces();
    if (!includeVSCodeRecents) {
      return this._resolveStored(own);
    }
    const ownUris = new Set(own.map((o) => this.uriIdentityService.extUri.getComparisonKey(URI.revive(o.uri))));
    const vsCode = this._vsCodeRecentFolderUris.filter((uri) => !ownUris.has(this.uriIdentityService.extUri.getComparisonKey(uri))).map((uri) => ({ uri: uri.toJSON(), providerId: void 0, checked: false }));
    return this._resolveStored([...own, ...vsCode]);
  }
  _resolveStored(stored) {
    const recents = [];
    for (const entry of stored) {
      const folderUri = URI.revive(entry.uri);
      const resolved = this._resolveWorkspace(folderUri, entry.providerId);
      if (resolved) {
        recents.push({ workspace: resolved.workspace, providerId: resolved.providerId, checked: entry.checked });
      }
    }
    return recents;
  }
  addRecentWorkspace(folderUri, providerId, checked) {
    const recents = this._getStoredRecentWorkspaces();
    const filtered = recents.map((p) => {
      if (this.uriIdentityService.extUri.isEqual(URI.revive(p.uri), folderUri)) {
        return void 0;
      }
      if (checked && p.checked) {
        return { ...p, checked: false };
      }
      return p;
    }).filter((p) => p !== void 0);
    const entry = { uri: folderUri.toJSON(), providerId, checked };
    const updated = [entry, ...filtered].slice(0, MAX_RECENT_WORKSPACES);
    this._persistRecentWorkspaces(updated);
  }
  removeRecentWorkspace(folderUri) {
    const recents = this._getStoredRecentWorkspaces();
    const updated = recents.filter((p) => !this.uriIdentityService.extUri.isEqual(URI.revive(p.uri), folderUri));
    if (updated.length !== recents.length) {
      this._persistRecentWorkspaces(updated);
    }
    this.workspacesService.removeRecentlyOpened([folderUri]);
  }
  clearCheckedWorkspace() {
    const recents = this._getStoredRecentWorkspaces();
    const updated = recents.map((p) => ({ ...p, checked: false }));
    this._persistRecentWorkspaces(updated);
  }
  /** Resolves `folderUri` to its workspace, trying `preferredProviderId` first if given. */
  _resolveWorkspace(folderUri, preferredProviderId) {
    if (preferredProviderId) {
      const preferred = this.sessionsProvidersService.getProvider(preferredProviderId);
      const workspace = preferred?.resolveWorkspace(folderUri);
      if (workspace) {
        return { providerId: preferredProviderId, workspace };
      }
    }
    for (const provider of this.sessionsProvidersService.getProviders()) {
      const workspace = provider.resolveWorkspace(folderUri);
      if (workspace) {
        return { providerId: provider.id, workspace };
      }
    }
    return void 0;
  }
  async _refreshVSCodeRecentWorkspaces() {
    const recentlyOpened = await this.workspacesService.getRecentlyOpened();
    this._vsCodeRecentFolderUris = recentlyOpened.workspaces.filter(isRecentFolder).map((f) => f.folderUri).filter((uri) => !basename(uri).startsWith("copilot-")).filter((uri) => !isWorktreeWorkspaceUri(uri)).slice(0, MAX_VSCODE_RECENT_WORKSPACES);
    this._onDidChangeRecentWorkspaces.fire();
  }
  _getStoredRecentWorkspaces() {
    const raw = this.storageService.get(STORAGE_KEY_RECENT_WORKSPACES, StorageScope.PROFILE);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  _persistRecentWorkspaces(entries) {
    this.storageService.store(STORAGE_KEY_RECENT_WORKSPACES, JSON.stringify(entries), StorageScope.PROFILE, StorageTarget.MACHINE);
    this._onDidChangeRecentWorkspaces.fire();
  }
};
SessionsRecentWorkspacesService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IWorkspacesService),
  __decorateParam(3, ISessionsProvidersService)
], SessionsRecentWorkspacesService);
registerSingleton(ISessionsRecentWorkspacesService, SessionsRecentWorkspacesService, InstantiationType.Delayed);
export {
  ISessionsRecentWorkspacesService,
  SessionsRecentWorkspacesService,
  isWorktreeWorkspaceUri
};
