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
import { Action } from "../../../../base/common/actions.js";
import { SequencerByKey } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { revive } from "../../../../base/common/marshalling.js";
import { dirname, isEqual, isEqualOrParent, joinPath } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { MarketplaceReferenceKind, PluginSourceKind } from "../common/plugins/pluginMarketplaceService.js";
import { IPluginGitService } from "../common/plugins/pluginGitService.js";
import { GitHubPluginSource, GitUrlPluginSource, NpmPluginSource, PipPluginSource, RelativePathPluginSource } from "./pluginSources.js";
const MARKETPLACE_INDEX_STORAGE_KEY = "chat.plugins.marketplaces.index.v1";
const SHA_REF_PATTERN = /^[0-9a-f]{40}$/i;
let AgentPluginRepositoryService = class {
  constructor(_commandService, environmentService, _fileService, instantiationService, _logService, _notificationService, _pluginGit, _progressService, _storageService, userDataProfileService) {
    this._commandService = _commandService;
    this._fileService = _fileService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._pluginGit = _pluginGit;
    this._progressService = _progressService;
    this._storageService = _storageService;
    this._marketplaceIndex = new Lazy(() => this._loadMarketplaceIndex());
    this._cloneSequencer = new SequencerByKey();
    this.agentPluginsHome = userDataProfileService.currentProfile.agentPluginsHome;
    const legacyCacheRoot = joinPath(environmentService.cacheHome, "agentPlugins");
    const oldCacheRoot = environmentService.cacheHome.scheme === "file" ? legacyCacheRoot : this.agentPluginsHome;
    this._cacheRoot = this.agentPluginsHome;
    if (!isEqual(oldCacheRoot, this.agentPluginsHome)) {
      this._migrationDone = this._migrateDirectory(oldCacheRoot);
    } else {
      this._migrationDone = Promise.resolve();
    }
    this._pluginSources = /* @__PURE__ */ new Map([
      [PluginSourceKind.RelativePath, new RelativePathPluginSource()],
      [PluginSourceKind.GitHub, instantiationService.createInstance(GitHubPluginSource)],
      [PluginSourceKind.GitUrl, instantiationService.createInstance(GitUrlPluginSource)],
      [PluginSourceKind.Npm, instantiationService.createInstance(NpmPluginSource)],
      [PluginSourceKind.Pip, instantiationService.createInstance(PipPluginSource)]
    ]);
  }
  getPluginSource(kind) {
    const repo = this._pluginSources.get(kind);
    if (!repo) {
      throw new Error(`No source repository registered for kind '${kind}'`);
    }
    return repo;
  }
  getRepositoryUri(marketplace, marketplaceType) {
    if (marketplace.kind === MarketplaceReferenceKind.LocalFileUri && marketplace.localRepositoryUri) {
      return marketplace.localRepositoryUri;
    }
    const indexed = this._marketplaceIndex.value.get(marketplace.canonicalId);
    if (indexed?.repositoryUri) {
      return indexed.repositoryUri;
    }
    return this._getRepoCacheDirForReference(marketplace);
  }
  getPluginInstallUri(plugin) {
    if (plugin.sourceDescriptor.kind !== PluginSourceKind.RelativePath) {
      return this.getPluginSourceInstallUri(plugin.sourceDescriptor);
    }
    const repoDir = this.getRepositoryUri(plugin.marketplaceReference, plugin.marketplaceType);
    const normalizedSource = plugin.source.trim().replace(/^\.?\/+|\/+$/g, "");
    const pluginDir = normalizedSource ? joinPath(repoDir, normalizedSource) : repoDir;
    if (!isEqualOrParent(pluginDir, repoDir)) {
      throw new Error(`Invalid plugin source path '${plugin.source}'`);
    }
    return pluginDir;
  }
  async ensureRepository(marketplace, options) {
    await this._migrationDone;
    const repoDir = this.getRepositoryUri(marketplace, options?.marketplaceType);
    return this._cloneSequencer.queue(repoDir.fsPath, async () => {
      const repoExists = await this._fileService.exists(repoDir);
      if (repoExists) {
        const refreshedAt = this._isRefreshDue(marketplace, options) ? await this._refreshRepository(repoDir, marketplace, options?.token) : void 0;
        this._updateMarketplaceIndex(marketplace, repoDir, options?.marketplaceType, refreshedAt);
        return repoDir;
      }
      if (marketplace.kind === MarketplaceReferenceKind.LocalFileUri) {
        throw new Error(`Local marketplace repository does not exist: ${repoDir.fsPath}`);
      }
      const progressTitle = options?.progressTitle ?? localize("preparingMarketplace", "Preparing plugin marketplace '{0}'...", marketplace.displayLabel);
      const failureLabel = options?.failureLabel ?? marketplace.displayLabel;
      await this._cloneRepository(repoDir, marketplace.cloneUrl, progressTitle, failureLabel, marketplace.ref, options?.token);
      this._updateMarketplaceIndex(marketplace, repoDir, options?.marketplaceType, Date.now());
      return repoDir;
    });
  }
  /**
   * Whether an existing clone is stale enough to warrant a silent pull.
   * Local (user-owned) directories and SHA-pinned refs are never refreshed.
   */
  _isRefreshDue(marketplace, options) {
    const refreshIfOlderThanMs = options?.refreshIfOlderThanMs;
    if (refreshIfOlderThanMs === void 0 || options?.token?.isCancellationRequested) {
      return false;
    }
    if (marketplace.kind === MarketplaceReferenceKind.LocalFileUri || SHA_REF_PATTERN.test(marketplace.ref ?? "")) {
      return false;
    }
    const lastRefreshedAt = this._marketplaceIndex.value.get(marketplace.canonicalId)?.lastRefreshedAt;
    return lastRefreshedAt === void 0 || Date.now() - lastRefreshedAt >= refreshIfOlderThanMs;
  }
  /**
   * Silently pulls an existing clone, never throwing — a marketplace that
   * cannot be refreshed still serves its cached contents.
   *
   * Returns the timestamp to record as the last refresh attempt, or
   * `undefined` when the pull was cancelled so that cancellation does not
   * suppress the next attempt. Genuine failures are recorded, otherwise an
   * unreachable remote would be retried on every single fetch.
   */
  async _refreshRepository(repoDir, marketplace, token) {
    try {
      await this._pluginGit.pull(repoDir, token);
    } catch (err) {
      if (isCancellationError(err)) {
        return void 0;
      }
      this._logService.debug(`[AgentPluginRepositoryService] Failed to refresh ${marketplace.displayLabel}:`, err);
    }
    return token?.isCancellationRequested ? void 0 : Date.now();
  }
  async pullRepository(marketplace, options) {
    const repoDir = this.getRepositoryUri(marketplace, options?.marketplaceType);
    const repoExists = await this._fileService.exists(repoDir);
    if (!repoExists) {
      this._logService.warn(`[AgentPluginRepositoryService] Cannot update plugin '${options?.pluginName ?? marketplace.displayLabel}': repository not cloned`);
      return false;
    }
    const updateLabel = options?.pluginName ?? marketplace.displayLabel;
    try {
      const changed = options?.silent ? await this._pluginGit.pull(repoDir) : await this._pullWithProgress(repoDir, updateLabel);
      this._updateMarketplaceIndex(marketplace, repoDir, options?.marketplaceType, Date.now());
      return changed;
    } catch (err) {
      this._logService.error(`[AgentPluginRepositoryService] Failed to update ${marketplace.displayLabel}:`, err);
      if (!options?.silent) {
        const primaryActions = [new Action("showGitOutput", localize("showGitOutput", "Show Git Output"), void 0, true, () => this._commandService.executeCommand("git.showOutput"))];
        const failureLabel = options?.failureLabel ?? updateLabel;
        if (marketplace.kind !== MarketplaceReferenceKind.LocalFileUri) {
          primaryActions.push(new Action("purgeAndRecloneMarketplace", localize("purgeAndRecloneMarketplace", "Purge Marketplace Cache and Reclone"), void 0, true, () => this._purgeAndRecloneMarketplace(marketplace, options?.marketplaceType, failureLabel)));
        }
        this._notificationService.notify({
          severity: Severity.Error,
          message: localize("pullFailed", "Failed to update plugin '{0}': {1}", failureLabel, err?.message ?? String(err)),
          actions: {
            primary: primaryActions
          }
        });
      }
      throw err;
    }
  }
  /** Pulls a clone behind a cancellable progress notification. */
  async _pullWithProgress(repoDir, updateLabel) {
    const cts = new CancellationTokenSource();
    try {
      return await this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: localize("updatingPlugin", "Updating plugin '{0}'...", updateLabel),
          cancellable: true
        },
        () => this._pluginGit.pull(repoDir, cts.token),
        () => cts.dispose(true)
      );
    } finally {
      cts.dispose();
    }
  }
  async _purgeAndRecloneMarketplace(marketplace, marketplaceType, label) {
    if (marketplace.kind === MarketplaceReferenceKind.LocalFileUri) {
      return;
    }
    const repoDir = this.getRepositoryUri(marketplace, marketplaceType);
    try {
      await this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: localize("purgingMarketplace", "Purging plugin marketplace '{0}'...", marketplace.displayLabel),
          cancellable: false
        },
        async () => {
          const exists = await this._fileService.exists(repoDir);
          if (exists) {
            await this._fileService.del(repoDir, { recursive: true, useTrash: false });
          }
          await this.ensureRepository(marketplace, {
            marketplaceType,
            progressTitle: localize("recloningMarketplace", "Recloning plugin marketplace '{0}'...", marketplace.displayLabel),
            failureLabel: label
          });
        }
      );
      this._notificationService.info(localize("purgeMarketplaceSuccess", "Recloned plugin marketplace '{0}'. Try updating plugins again.", marketplace.displayLabel));
    } catch (err) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("purgeMarketplaceFailed", "Failed to purge plugin marketplace '{0}': {1}", marketplace.displayLabel, err?.message ?? String(err)),
        actions: {
          primary: [new Action("showGitOutput", localize("showGitOutput", "Show Git Output"), void 0, true, () => {
            return this._commandService.executeCommand("git.showOutput");
          })]
        }
      });
    }
  }
  _getRepoCacheDirForReference(reference) {
    return joinPath(this._cacheRoot, ...reference.cacheSegments);
  }
  _loadMarketplaceIndex() {
    const result = /* @__PURE__ */ new Map();
    const stored = this._storageService.getObject(MARKETPLACE_INDEX_STORAGE_KEY, StorageScope.APPLICATION);
    if (!stored) {
      return result;
    }
    const revived = revive(stored);
    for (const [canonicalId, entry] of Object.entries(revived)) {
      if (!entry || !entry.repositoryUri) {
        continue;
      }
      result.set(canonicalId, {
        repositoryUri: entry.repositoryUri,
        marketplaceType: entry.marketplaceType,
        lastRefreshedAt: entry.lastRefreshedAt
      });
    }
    return result;
  }
  _updateMarketplaceIndex(marketplace, repositoryUri, marketplaceType, lastRefreshedAt) {
    if (marketplace.kind === MarketplaceReferenceKind.LocalFileUri) {
      return;
    }
    const previous = this._marketplaceIndex.value.get(marketplace.canonicalId);
    const updatedLastRefreshedAt = lastRefreshedAt ?? previous?.lastRefreshedAt;
    if (previous && previous.repositoryUri.toString() === repositoryUri.toString() && previous.marketplaceType === marketplaceType && previous.lastRefreshedAt === updatedLastRefreshedAt) {
      return;
    }
    this._marketplaceIndex.value.set(marketplace.canonicalId, { repositoryUri, marketplaceType, lastRefreshedAt: updatedLastRefreshedAt });
    this._saveMarketplaceIndex();
  }
  _saveMarketplaceIndex() {
    const serialized = {};
    for (const [canonicalId, entry] of this._marketplaceIndex.value) {
      serialized[canonicalId] = JSON.parse(JSON.stringify({
        repositoryUri: entry.repositoryUri,
        marketplaceType: entry.marketplaceType,
        lastRefreshedAt: entry.lastRefreshedAt
      }));
    }
    if (Object.keys(serialized).length === 0) {
      this._storageService.remove(MARKETPLACE_INDEX_STORAGE_KEY, StorageScope.APPLICATION);
      return;
    }
    this._storageService.store(MARKETPLACE_INDEX_STORAGE_KEY, JSON.stringify(serialized), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  async _cloneRepository(repoDir, cloneUrl, progressTitle, failureLabel, ref, token) {
    const cts = new CancellationTokenSource();
    const tokenListener = token?.onCancellationRequested(() => cts.cancel());
    try {
      await this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: progressTitle,
          cancellable: true
        },
        async () => {
          await this._fileService.createFolder(dirname(repoDir));
          await this._pluginGit.cloneRepository(cloneUrl, repoDir, ref, cts.token);
        },
        () => cts.dispose(true)
      );
    } catch (err) {
      this._logService.error(`[AgentPluginRepositoryService] Failed to clone ${cloneUrl}:`, err);
      if (!isCancellationError(err)) {
        this._notificationService.notify({
          severity: Severity.Error,
          message: localize("cloneFailed", "Failed to install plugin '{0}': {1}", failureLabel, err?.message ?? String(err)),
          actions: {
            primary: [new Action("showGitOutput", localize("showGitOutput", "Show Git Output"), void 0, true, () => {
              this._commandService.executeCommand("git.showOutput");
            })]
          }
        });
      }
      throw err;
    } finally {
      tokenListener?.dispose();
      cts.dispose();
    }
  }
  getPluginSourceInstallUri(sourceDescriptor) {
    return this.getPluginSource(sourceDescriptor.kind).getInstallUri(this._cacheRoot, sourceDescriptor);
  }
  async ensurePluginSource(plugin, options) {
    await this._migrationDone;
    const repo = this.getPluginSource(plugin.sourceDescriptor.kind);
    if (plugin.sourceDescriptor.kind === PluginSourceKind.RelativePath) {
      return this.ensureRepository(plugin.marketplaceReference, options);
    }
    return repo.ensure(this._cacheRoot, plugin, options);
  }
  async updatePluginSource(plugin, options) {
    const repo = this.getPluginSource(plugin.sourceDescriptor.kind);
    if (plugin.sourceDescriptor.kind === PluginSourceKind.RelativePath) {
      return this.pullRepository(plugin.marketplaceReference, options);
    }
    return repo.update(this._cacheRoot, plugin, options);
  }
  async fetchRepository(marketplace) {
    const repoDir = this.getRepositoryUri(marketplace);
    const repoExists = await this._fileService.exists(repoDir);
    if (!repoExists) {
      return false;
    }
    try {
      await this._pluginGit.fetchRepository(repoDir);
      const behindCount = await this._pluginGit.revListCount(repoDir, "HEAD", "@{u}");
      return behindCount > 0;
    } catch (err) {
      this._logService.debug(`[AgentPluginRepositoryService] Silent fetch failed for ${marketplace.displayLabel}:`, err);
      return false;
    }
  }
  async cleanupPluginSource(plugin, otherInstalledDescriptors) {
    const repo = this.getPluginSource(plugin.sourceDescriptor.kind);
    const cleanupDir = repo.getCleanupTarget(this._cacheRoot, plugin.sourceDescriptor);
    if (!cleanupDir) {
      return;
    }
    if (otherInstalledDescriptors) {
      const shared = otherInstalledDescriptors.some((other) => {
        const otherRepo = this.getPluginSource(other.kind);
        const otherTarget = otherRepo.getCleanupTarget(this._cacheRoot, other);
        return otherTarget && isEqual(otherTarget, cleanupDir);
      });
      if (shared) {
        this._logService.info(`[${plugin.sourceDescriptor.kind}] Skipping cleanup of shared cache: ${cleanupDir.toString()}`);
        return;
      }
    }
    try {
      const exists = await this._fileService.exists(cleanupDir);
      if (exists) {
        await this._fileService.del(cleanupDir, { recursive: true });
        this._logService.info(`[${plugin.sourceDescriptor.kind}] Removed plugin cache: ${cleanupDir.toString()}`);
      }
    } catch (err) {
      this._logService.warn(`[${plugin.sourceDescriptor.kind}] Failed to remove plugin cache '${cleanupDir.toString()}':`, err);
    }
    try {
      await this._pruneEmptyParents(cleanupDir);
    } catch (err) {
      this._logService.warn(`[${plugin.sourceDescriptor.kind}] Failed to cleanup plugin source:`, err);
    }
  }
  /**
   * Walk from {@link child}'s parent toward {@link _cacheRoot}, removing
   * each directory that is empty. Stops as soon as a non-empty directory
   * is found or the cache root is reached. Only operates on descendants
   * of the cache root — returns immediately for paths outside it.
   */
  async _pruneEmptyParents(child) {
    if (!isEqualOrParent(child, this._cacheRoot)) {
      return;
    }
    let current = dirname(child);
    while (isEqualOrParent(current, this._cacheRoot) && !isEqual(current, this._cacheRoot)) {
      try {
        const stat = await this._fileService.resolve(current);
        if (stat.children && stat.children.length > 0) {
          break;
        }
        await this._fileService.del(current);
      } catch {
        break;
      }
      current = dirname(current);
    }
  }
  /**
   * One-time migration of plugin files from the old internal cache
   * directory (`{cacheHome}/agentPlugins/`) to the new well-known
   * location (`~/{dataFolderName}/agent-plugins/`).
   */
  async _migrateDirectory(oldCacheRoot) {
    try {
      const oldExists = await this._fileService.exists(oldCacheRoot);
      if (!oldExists) {
        return;
      }
      const newExists = await this._fileService.exists(this.agentPluginsHome);
      if (newExists) {
        this._logService.info("[AgentPluginRepositoryService] Both old and new agent-plugins directories exist; skipping directory migration");
        return;
      }
      this._logService.info(`[AgentPluginRepositoryService] Migrating agent plugins from ${oldCacheRoot.toString()} to ${this.agentPluginsHome.toString()}`);
      await this._fileService.move(oldCacheRoot, this.agentPluginsHome, false);
      this._storageService.remove(MARKETPLACE_INDEX_STORAGE_KEY, StorageScope.APPLICATION);
      this._marketplaceIndex.value.clear();
    } catch (error) {
      this._logService.error("[AgentPluginRepositoryService] Directory migration failed", error);
    }
  }
};
AgentPluginRepositoryService = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IPluginGitService),
  __decorateParam(7, IProgressService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IUserDataProfileService)
], AgentPluginRepositoryService);
export {
  AgentPluginRepositoryService
};
