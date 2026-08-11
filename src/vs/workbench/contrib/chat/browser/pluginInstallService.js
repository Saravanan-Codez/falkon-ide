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
import { Codicon } from "../../../../base/common/codicons.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { untildify } from "../../../../base/common/labels.js";
import { posix, win32 } from "../../../../base/common/path.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IAgentPluginRepositoryService } from "../common/plugins/agentPluginRepositoryService.js";
import { ChatConfiguration } from "../common/constants.js";
import { IPluginMarketplaceService, MarketplaceReferenceKind, MarketplaceType, hasSourceChanged, parseMarketplaceReference, parseMarketplaceReferences, PluginSourceKind, readConfiguredMarketplaces } from "../common/plugins/pluginMarketplaceService.js";
let PluginInstallService = class {
  constructor(_pluginRepositoryService, _pluginMarketplaceService, _fileService, _notificationService, _dialogService, _logService, _progressService, _commandService, _quickInputService, _configurationService, _pathService) {
    this._pluginRepositoryService = _pluginRepositoryService;
    this._pluginMarketplaceService = _pluginMarketplaceService;
    this._fileService = _fileService;
    this._notificationService = _notificationService;
    this._dialogService = _dialogService;
    this._logService = _logService;
    this._progressService = _progressService;
    this._commandService = _commandService;
    this._quickInputService = _quickInputService;
    this._configurationService = _configurationService;
    this._pathService = _pathService;
  }
  async installPlugin(plugin) {
    if (!await this._ensureMarketplaceTrusted(plugin)) {
      throw new CancellationError();
    }
    const kind = plugin.sourceDescriptor.kind;
    if (kind === PluginSourceKind.RelativePath) {
      return this._installRelativePathPlugin(plugin);
    }
    if (kind === PluginSourceKind.Npm || kind === PluginSourceKind.Pip) {
      await this._installPackagePlugin(plugin);
      return;
    }
    return this._installGitPlugin(plugin);
  }
  validatePluginSource(source) {
    const reference = parseMarketplaceReference(source);
    if (reference || this._isLocalPathSource(source)) {
      return void 0;
    }
    return localize("invalidSource", "'{0}' is not a valid plugin source. Enter a GitHub repository (owner/repo), a git clone URL, or a local folder path.", source);
  }
  async installPluginFromSource(source, options) {
    const reference = parseMarketplaceReference(source);
    if (reference && reference.kind !== MarketplaceReferenceKind.LocalFileUri) {
      return this._doInstallFromSource(reference, options);
    }
    const local = await this._resolveLocalDirectorySource(source);
    if (local) {
      return this._doInstallFromLocalSource(local.reference, local.configPath, options);
    }
    return {
      success: false,
      message: localize("invalidSource", "'{0}' is not a valid plugin source. Enter a GitHub repository (owner/repo), a git clone URL, or a local folder path.", source)
    };
  }
  async _doInstallFromSource(reference, options) {
    const sourceDescriptor = reference.kind === MarketplaceReferenceKind.GitHubShorthand ? { kind: PluginSourceKind.GitHub, repo: reference.githubRepo } : { kind: PluginSourceKind.GitUrl, url: reference.cloneUrl };
    const tempPlugin = {
      name: reference.displayLabel,
      description: "",
      version: "",
      source: "",
      sourceDescriptor,
      marketplace: reference.displayLabel,
      marketplaceReference: reference,
      marketplaceType: MarketplaceType.OpenPlugin
    };
    if (!await this._ensureMarketplaceTrusted(tempPlugin)) {
      return { success: false };
    }
    let repoDir;
    try {
      repoDir = await this._pluginRepositoryService.ensurePluginSource(tempPlugin, {
        progressTitle: localize("cloningSource", "Cloning plugin source '{0}'...", reference.displayLabel),
        failureLabel: reference.displayLabel,
        marketplaceType: MarketplaceType.OpenPlugin
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        message: localize("cloneFailedDetail", "Failed to clone plugin source '{0}': {1}", reference.displayLabel, detail)
      };
    }
    const repoExists = await this._fileService.exists(repoDir);
    if (!repoExists) {
      return {
        success: false,
        message: localize("cloneFailed", "Failed to clone plugin source '{0}'.", reference.displayLabel)
      };
    }
    const discoveredPlugins = await this._pluginMarketplaceService.readPluginsFromDirectory(repoDir, reference);
    if (discoveredPlugins.length === 0) {
      const singlePlugin = await this._pluginMarketplaceService.readSinglePluginManifest(repoDir, reference);
      if (singlePlugin) {
        if (options?.plugin && options.plugin !== singlePlugin.name) {
          return {
            success: false,
            message: localize("pluginNotFound", "Plugin '{0}' not found in '{1}'.", options.plugin, reference.displayLabel)
          };
        }
        await this.installPlugin(singlePlugin);
        return options?.plugin ? { success: true, matchedPlugin: singlePlugin } : { success: true };
      }
      void this._pluginRepositoryService.cleanupPluginSource(tempPlugin);
      return {
        success: false,
        message: localize("noPluginsFound", "No plugins found in '{0}'. This does not appear to be a valid plugin marketplace.", reference.displayLabel)
      };
    }
    return this._installDiscoveredPlugins(reference, discoveredPlugins, options);
  }
  /**
   * Installs a plugin from a local folder path (`file://` URI, absolute path,
   * or `~`-prefixed path). Inspects the directory to decide whether it is a
   * marketplace or a standalone plugin and writes to the appropriate setting:
   * - a marketplace is registered under `chat.plugins.marketplaces`,
   * - a standalone plugin path is registered under `chat.pluginLocations`.
   */
  async _doInstallFromLocalSource(reference, configPath, options) {
    const repoDir = reference.localRepositoryUri;
    if (!repoDir) {
      return {
        success: false,
        message: localize("invalidSource", "'{0}' is not a valid plugin source. Enter a GitHub repository (owner/repo), a git clone URL, or a local folder path.", reference.rawValue)
      };
    }
    let isDirectory = false;
    try {
      isDirectory = (await this._fileService.resolve(repoDir)).isDirectory;
    } catch {
    }
    if (!isDirectory) {
      return {
        success: false,
        message: localize("localSourceNotFound", "The folder '{0}' does not exist or is not a directory.", repoDir.fsPath)
      };
    }
    const discoveredPlugins = await this._pluginMarketplaceService.readPluginsFromDirectory(repoDir, reference);
    if (discoveredPlugins.length > 0) {
      const tempPlugin = {
        name: reference.displayLabel,
        description: "",
        version: "",
        source: "",
        sourceDescriptor: { kind: PluginSourceKind.RelativePath, path: "" },
        marketplace: reference.displayLabel,
        marketplaceReference: reference,
        marketplaceType: MarketplaceType.OpenPlugin
      };
      if (!await this._ensureMarketplaceTrusted(tempPlugin)) {
        return { success: false };
      }
      return this._installDiscoveredPlugins(reference, discoveredPlugins, options);
    }
    if (await this._pluginMarketplaceService.isPluginDirectory(repoDir)) {
      await this._addPluginLocationToConfig(configPath);
      return { success: true };
    }
    return {
      success: false,
      message: localize("localNoPlugins", "No plugin or marketplace found in '{0}'. This folder does not contain a plugin or marketplace manifest.", repoDir.fsPath)
    };
  }
  /**
   * Registers the marketplace and installs the discovered plugin(s): when a
   * specific plugin is targeted it installs that one, when there is exactly
   * one it installs it directly, and otherwise prompts the user to choose.
   */
  async _installDiscoveredPlugins(reference, discoveredPlugins, options) {
    if (options?.plugin) {
      const matchedPlugin = discoveredPlugins.find((p) => p.name === options.plugin);
      if (!matchedPlugin) {
        return {
          success: false,
          message: localize("pluginNotFound", "Plugin '{0}' not found in '{1}'.", options.plugin, reference.displayLabel)
        };
      }
      await this._addMarketplaceToConfig(reference);
      await this.installPlugin(matchedPlugin);
      return { success: true, matchedPlugin };
    }
    if (discoveredPlugins.length === 1) {
      await this._addMarketplaceToConfig(reference);
      await this.installPlugin(discoveredPlugins[0]);
      return { success: true };
    }
    const picks = discoveredPlugins.map((p) => ({
      label: p.name,
      description: p.description,
      plugin: p
    }));
    const selected = await this._quickInputService.pick(picks, {
      placeHolder: localize("selectPlugin", "Select a plugin to install from '{0}'", reference.displayLabel),
      canPickMany: false
    });
    if (!selected) {
      return { success: false };
    }
    await this._addMarketplaceToConfig(reference);
    await this.installPlugin(selected.plugin);
    return { success: true };
  }
  _addMarketplaceToConfig(reference) {
    const { userValues, effectiveValues } = readConfiguredMarketplaces(this._configurationService);
    const existingRefs = parseMarketplaceReferences(effectiveValues);
    if (existingRefs.some((r) => r.canonicalId === reference.canonicalId)) {
      return;
    }
    return this._configurationService.updateValue(ChatConfiguration.PluginMarketplaces, [...userValues, reference.rawValue]);
  }
  _addPluginLocationToConfig(pathKey) {
    const current = this._configurationService.inspect(ChatConfiguration.PluginLocations).userValue ?? {};
    if (current[pathKey] === true) {
      return;
    }
    return this._configurationService.updateValue(ChatConfiguration.PluginLocations, { ...current, [pathKey]: true });
  }
  /**
   * Returns `true` when the source string looks like a local folder path —
   * a `file://` URI, an absolute filesystem path, or a `~`-prefixed path.
   * This is a synchronous format check only; existence is verified later.
   */
  _isLocalPathSource(source) {
    const trimmed = source.trim();
    if (!trimmed) {
      return false;
    }
    if (/^file:\/\//i.test(trimmed)) {
      return true;
    }
    if (trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
      return true;
    }
    return win32.isAbsolute(trimmed) || posix.isAbsolute(trimmed);
  }
  /**
   * Resolves a local folder source string to a {@link MarketplaceReferenceKind.LocalFileUri}
   * reference plus the path to persist in `chat.pluginLocations`. Tilde paths
   * are expanded against the user home. Returns `undefined` when the string
   * does not resolve to an absolute local folder.
   */
  async _resolveLocalDirectorySource(source) {
    const trimmed = source.trim();
    const parsed = parseMarketplaceReference(trimmed);
    if (parsed?.kind === MarketplaceReferenceKind.LocalFileUri && parsed.localRepositoryUri) {
      return { reference: parsed, configPath: parsed.localRepositoryUri.fsPath };
    }
    if (!this._isLocalPathSource(trimmed)) {
      return void 0;
    }
    let resolvedPath = trimmed;
    if (resolvedPath.startsWith("~")) {
      const userHome = await this._pathService.userHome();
      const home = userHome.scheme === "file" ? userHome.fsPath : userHome.path;
      resolvedPath = untildify(resolvedPath, home);
    }
    if (!win32.isAbsolute(resolvedPath) && !posix.isAbsolute(resolvedPath)) {
      return void 0;
    }
    const reference = parseMarketplaceReference(URI.file(resolvedPath).toString());
    if (reference?.kind !== MarketplaceReferenceKind.LocalFileUri) {
      return void 0;
    }
    return { reference, configPath: trimmed };
  }
  async updatePlugin(plugin, silent) {
    if (this._pluginMarketplaceService.isStrictMarketplacePolicyActive() && !this._pluginMarketplaceService.isMarketplaceTrusted(plugin.marketplaceReference)) {
      this._notificationService.notify({
        severity: Severity.Warning,
        message: localize("strictMarketplaceBlockedUpdate", "Updates from '{0}' are blocked by your organization's policy.", plugin.marketplaceReference.displayLabel)
      });
      return false;
    }
    const kind = plugin.sourceDescriptor.kind;
    if (kind === PluginSourceKind.Npm || kind === PluginSourceKind.Pip) {
      return this._installPackagePlugin(plugin, silent);
    }
    return this._pluginRepositoryService.updatePluginSource(plugin, {
      pluginName: plugin.name,
      failureLabel: plugin.name,
      marketplaceType: plugin.marketplaceType
    });
  }
  async updateAllPlugins(options, token) {
    const allInstalled = this._pluginMarketplaceService.installedPlugins.get();
    const installed = allInstalled.filter(
      (entry) => (!options.marketplaceIds || options.marketplaceIds.has(entry.plugin.marketplaceReference.canonicalId)) && (!options.automatic || this._pluginMarketplaceService.isMarketplaceAutoUpdateEnabled(entry.plugin.marketplaceReference))
    );
    if (installed.length === 0) {
      return { updatedNames: [], failedNames: [] };
    }
    const updatedNames = [];
    const failedNames = [];
    const doUpdate = async () => {
      const gitTasks = [];
      const packagePlugins = [];
      const seenMarketplaces = /* @__PURE__ */ new Set();
      for (const entry of installed) {
        const ref = entry.plugin.marketplaceReference;
        if (seenMarketplaces.has(ref.canonicalId)) {
          continue;
        }
        seenMarketplaces.add(ref.canonicalId);
        if (this._pluginMarketplaceService.isStrictMarketplacePolicyActive() && !this._pluginMarketplaceService.isMarketplaceTrusted(ref)) {
          failedNames.push(ref.displayLabel);
          continue;
        }
        gitTasks.push((async () => {
          if (token.isCancellationRequested) {
            return;
          }
          try {
            const changed = await this._pluginRepositoryService.pullRepository(ref, {
              pluginName: ref.displayLabel,
              failureLabel: ref.displayLabel,
              marketplaceType: entry.plugin.marketplaceType,
              silent: options.silent
            });
            if (changed) {
              updatedNames.push(ref.displayLabel);
            }
          } catch (err) {
            this._logService.error(`[PluginInstallService] Failed to pull marketplace '${ref.displayLabel}':`, err);
            failedNames.push(ref.displayLabel);
          }
        })());
      }
      await Promise.all(gitTasks);
      const marketplaceIds = new Set(installed.map((entry) => entry.plugin.marketplaceReference.canonicalId));
      const marketplacePlugins = await this._pluginMarketplaceService.fetchMarketplacePlugins(token, marketplaceIds);
      const marketplaceByKey = /* @__PURE__ */ new Map();
      for (const mp of marketplacePlugins) {
        marketplaceByKey.set(`${mp.marketplaceReference.canonicalId}::${mp.name}`, mp);
      }
      const independentGitTasks = [];
      for (const entry of installed) {
        if (entry.plugin.sourceDescriptor.kind === PluginSourceKind.RelativePath) {
          continue;
        }
        const livePlugin = marketplaceByKey.get(`${entry.plugin.marketplaceReference.canonicalId}::${entry.plugin.name}`);
        if (!livePlugin || !hasSourceChanged(entry.plugin.sourceDescriptor, livePlugin.sourceDescriptor)) {
          continue;
        }
        const desc = livePlugin.sourceDescriptor;
        if (desc.kind === PluginSourceKind.Npm || desc.kind === PluginSourceKind.Pip) {
          if (!options.force && !desc.version) {
            continue;
          }
          packagePlugins.push({ installed: entry.plugin, marketplace: livePlugin });
          continue;
        }
        independentGitTasks.push((async () => {
          if (token.isCancellationRequested) {
            return;
          }
          try {
            const changed = await this._pluginRepositoryService.updatePluginSource(livePlugin, {
              pluginName: livePlugin.name,
              failureLabel: livePlugin.name,
              marketplaceType: livePlugin.marketplaceType,
              silent: options.silent
            });
            if (changed) {
              updatedNames.push(livePlugin.name);
              this._pluginMarketplaceService.addInstalledPlugin(entry.pluginUri, livePlugin);
            }
          } catch (err) {
            this._logService.error(`[PluginInstallService] Failed to update plugin '${livePlugin.name}':`, err);
            failedNames.push(livePlugin.name);
          }
        })());
      }
      await Promise.all(independentGitTasks);
      for (const { installed: _installed, marketplace } of packagePlugins) {
        if (token.isCancellationRequested) {
          return;
        }
        try {
          const changed = await this.updatePlugin(marketplace, options?.silent);
          if (changed) {
            updatedNames.push(marketplace.name);
            const pluginUri = this._pluginRepositoryService.getPluginSourceInstallUri(marketplace.sourceDescriptor);
            this._pluginMarketplaceService.addInstalledPlugin(pluginUri, marketplace);
          }
        } catch (err) {
          this._logService.error(`[PluginInstallService] Failed to update plugin '${marketplace.name}':`, err);
          failedNames.push(marketplace.name);
        }
      }
    };
    if (options.silent) {
      await doUpdate();
    } else {
      await this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: localize("updatingAllPlugins", "Updating plugins...")
        },
        doUpdate
      );
    }
    if (failedNames.length > 0) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("updateAllFailed", "Failed to update: {0}", failedNames.join(", ")),
        actions: {
          primary: [new Action("showGitOutput", localize("showOutput", "Show Output"), void 0, true, () => {
            this._commandService.executeCommand("git.showOutput");
          })]
        }
      });
    } else if (updatedNames.length > 0) {
      if (!options.automatic) {
        this._pluginMarketplaceService.clearUpdatesAvailable(options.marketplaceIds);
      }
      this._notificationService.notify({
        severity: Severity.Info,
        message: localize("updateAllSuccess", "Updated plugins: {0}", updatedNames.join(", "))
      });
    } else if (!token.isCancellationRequested) {
      if (!options.automatic) {
        this._pluginMarketplaceService.clearUpdatesAvailable(options.marketplaceIds);
      }
    }
    return { updatedNames, failedNames };
  }
  getPluginInstallUri(plugin) {
    return this._pluginRepositoryService.getPluginInstallUri(plugin);
  }
  // --- Trust gate -------------------------------------------------------------
  async _ensureMarketplaceTrusted(plugin) {
    if (this._pluginMarketplaceService.isMarketplaceTrusted(plugin.marketplaceReference)) {
      return true;
    }
    if (this._pluginMarketplaceService.isStrictMarketplacePolicyActive()) {
      this._notificationService.notify({
        severity: Severity.Warning,
        message: localize("strictMarketplaceBlockedInstall", "Plugins from '{0}' are blocked by your organization's policy.", plugin.marketplaceReference.displayLabel),
        actions: {
          primary: [new Action("chat.plugins.viewMarketplacePolicy", localize("viewPolicySettings", "View Policy Settings"), void 0, true, () => {
            return this._commandService.executeCommand("workbench.action.openSettings", ChatConfiguration.StrictMarketplaces);
          })]
        }
      });
      return false;
    }
    const { confirmed } = await this._dialogService.confirm({
      type: "question",
      message: localize("trustMarketplace", "Trust Plugins from '{0}'?", plugin.marketplaceReference.displayLabel),
      detail: localize("trustMarketplaceDetail", "Plugins can run code on your machine. Only install plugins from sources you trust.\n\nSource: {0}", plugin.marketplaceReference.rawValue),
      primaryButton: localize({ key: "trustAndInstall", comment: ["&& denotes a mnemonic"] }, "&&Trust"),
      custom: {
        icon: Codicon.shield
      }
    });
    if (!confirmed) {
      return false;
    }
    this._pluginMarketplaceService.trustMarketplace(plugin.marketplaceReference);
    return true;
  }
  // --- Relative-path source (existing git-based flow) -----------------------
  async _installRelativePathPlugin(plugin) {
    try {
      await this._pluginRepositoryService.ensureRepository(plugin.marketplaceReference, {
        progressTitle: localize("installingPlugin", "Installing plugin '{0}'...", plugin.name),
        failureLabel: plugin.name,
        marketplaceType: plugin.marketplaceType
      });
    } catch {
      return;
    }
    let pluginDir;
    try {
      pluginDir = this._pluginRepositoryService.getPluginInstallUri(plugin);
    } catch {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("pluginDirInvalid", "Plugin source directory '{0}' is invalid for repository '{1}'.", plugin.source, plugin.marketplace)
      });
      return;
    }
    const pluginExists = await this._fileService.exists(pluginDir);
    if (!pluginExists) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("pluginDirNotFound", "Plugin source directory '{0}' not found in repository '{1}'.", plugin.source, plugin.marketplace)
      });
      return;
    }
    this._pluginMarketplaceService.addInstalledPlugin(pluginDir, plugin);
  }
  // --- GitHub / Git URL source (independent clone) --------------------------
  async _installGitPlugin(plugin) {
    const repo = this._pluginRepositoryService.getPluginSource(plugin.sourceDescriptor.kind);
    let pluginDir;
    try {
      pluginDir = await this._pluginRepositoryService.ensurePluginSource(plugin, {
        progressTitle: localize("installingPlugin", "Installing plugin '{0}'...", plugin.name),
        failureLabel: plugin.name,
        marketplaceType: plugin.marketplaceType
      });
    } catch {
      return;
    }
    const pluginExists = await this._fileService.exists(pluginDir);
    if (!pluginExists) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("pluginSourceNotFound", "Plugin source '{0}' not found after cloning.", repo.getLabel(plugin.sourceDescriptor))
      });
      return;
    }
    this._pluginMarketplaceService.addInstalledPlugin(pluginDir, plugin);
  }
  // --- Package-manager sources (npm / pip) ----------------------------------
  async _installPackagePlugin(plugin, silent) {
    const repo = this._pluginRepositoryService.getPluginSource(plugin.sourceDescriptor.kind);
    if (!repo.runInstall) {
      this._logService.error(`[PluginInstallService] Expected package repository for kind '${plugin.sourceDescriptor.kind}'`);
      return false;
    }
    const installDir = await this._pluginRepositoryService.ensurePluginSource(plugin);
    const pluginDir = this._pluginRepositoryService.getPluginSourceInstallUri(plugin.sourceDescriptor);
    const result = await repo.runInstall(installDir, pluginDir, plugin, { silent });
    if (!result) {
      return false;
    }
    this._pluginMarketplaceService.addInstalledPlugin(result.pluginDir, plugin);
    return true;
  }
};
PluginInstallService = __decorateClass([
  __decorateParam(0, IAgentPluginRepositoryService),
  __decorateParam(1, IPluginMarketplaceService),
  __decorateParam(2, IFileService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IQuickInputService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IPathService)
], PluginInstallService);
export {
  PluginInstallService
};
