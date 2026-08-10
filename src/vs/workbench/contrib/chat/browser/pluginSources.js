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
import { timeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../base/common/platform.js";
import { dirname, isEqualOrParent, joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { ITerminalService } from "../../terminal/browser/terminal.js";
import { PluginSourceKind } from "../common/plugins/pluginMarketplaceService.js";
import { IPluginGitService } from "../common/plugins/pluginGitService.js";
function sanitizeCacheSegment(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}
function gitRevisionCacheSuffix(ref, sha) {
  if (sha) {
    return [`sha_${sanitizeCacheSegment(sha)}`];
  }
  if (ref) {
    return [`ref_${sanitizeCacheSegment(ref)}`];
  }
  return [];
}
function shellEscapeArg(value) {
  if (isWindows) {
    return `"${value.replace(/[`$"]/g, "`$&")}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function formatShellCommand(args) {
  const [command, ...rest] = args;
  return [command, ...rest.map((arg) => shellEscapeArg(arg))].join(" ");
}
let AbstractGitPluginSource = class {
  constructor(_commandService, _fileService, _logService, _notificationService, _pluginGit, _progressService) {
    this._commandService = _commandService;
    this._fileService = _fileService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._pluginGit = _pluginGit;
    this._progressService = _progressService;
  }
  getCleanupTarget(cacheRoot, descriptor) {
    return this._getRepoDir(cacheRoot, descriptor);
  }
  /**
   * Returns the on-disk directory of the cloned repository. Subclasses that
   * support a sub-path within a repository should override this to return the
   * repository root, while {@link getInstallUri} returns root + sub-path.
   */
  _getRepoDir(cacheRoot, descriptor) {
    return this.getInstallUri(cacheRoot, descriptor);
  }
  async ensure(cacheRoot, plugin, options) {
    const descriptor = plugin.sourceDescriptor;
    const repoDir = this._getRepoDir(cacheRoot, descriptor);
    const repoExists = await this._fileService.exists(repoDir);
    const label = this._displayLabel(descriptor);
    if (repoExists) {
      await this._checkoutRevision(repoDir, descriptor, options?.failureLabel ?? label);
      return this.getInstallUri(cacheRoot, descriptor);
    }
    const progressTitle = options?.progressTitle ?? localize("cloningPluginSource", "Cloning plugin source '{0}'...", label);
    const failureLabel = options?.failureLabel ?? label;
    const ref = descriptor.ref;
    await this._cloneRepository(repoDir, this._cloneUrl(descriptor), progressTitle, failureLabel, ref);
    await this._checkoutRevision(repoDir, descriptor, failureLabel);
    return this.getInstallUri(cacheRoot, descriptor);
  }
  async update(cacheRoot, plugin, options) {
    const descriptor = plugin.sourceDescriptor;
    const repoDir = this._getRepoDir(cacheRoot, descriptor);
    const repoExists = await this._fileService.exists(repoDir);
    if (!repoExists) {
      this._logService.warn(`[${this.kind}] Cannot update plugin '${options?.pluginName ?? plugin.name}': source repository not cloned`);
      return false;
    }
    const updateLabel = options?.pluginName ?? plugin.name;
    const failureLabel = options?.failureLabel ?? updateLabel;
    try {
      const doUpdate = async (cts2) => {
        const git = descriptor;
        let changed;
        if (git.sha) {
          const headBefore = await this._pluginGit.revParse(repoDir, "HEAD").catch(() => void 0);
          await this._pluginGit.fetch(repoDir, cts2?.token);
          await this._checkoutRevision(repoDir, descriptor, failureLabel, cts2?.token);
          const headAfter = await this._pluginGit.revParse(repoDir, "HEAD").catch(() => void 0);
          changed = headBefore !== headAfter;
        } else {
          changed = await this._pluginGit.pull(repoDir, cts2?.token);
          await this._checkoutRevision(repoDir, descriptor, failureLabel, cts2?.token);
        }
        return changed;
      };
      if (options?.silent) {
        return await doUpdate();
      }
      const cts = new CancellationTokenSource();
      try {
        return await this._progressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: localize("updatingPluginSource", "Updating plugin '{0}'...", updateLabel),
            cancellable: true
          },
          () => doUpdate(cts),
          () => cts.dispose(true)
        );
      } finally {
        cts.dispose();
      }
    } catch (err) {
      this._logService.error(`[${this.kind}] Failed to update plugin source '${updateLabel}':`, err);
      if (!options?.silent) {
        this._notificationService.notify({
          severity: Severity.Error,
          message: localize("pullPluginSourceFailed", "Failed to update plugin '{0}': {1}", failureLabel, err?.message ?? String(err))
        });
      }
      throw err;
    }
  }
  // -- internal helpers ---
  async _cloneRepository(repoDir, cloneUrl, progressTitle, failureLabel, ref) {
    const cts = new CancellationTokenSource();
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
      this._logService.error(`[${this.kind}] Failed to clone ${cloneUrl}:`, err);
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("cloneFailed", "Failed to install plugin '{0}': {1}", failureLabel, err?.message ?? String(err))
      });
      throw err;
    } finally {
      cts.dispose();
    }
  }
  async _checkoutRevision(repoDir, descriptor, failureLabel, token) {
    const git = descriptor;
    if (!git.sha && !git.ref) {
      return;
    }
    try {
      if (git.sha) {
        await this._pluginGit.checkout(repoDir, git.sha, true, token);
        return;
      }
      await this._pluginGit.checkout(repoDir, git.ref, void 0, token);
    } catch (err) {
      this._logService.error(`[${this.kind}] Failed to checkout revision for '${failureLabel}':`, err);
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("checkoutPluginSourceFailed", "Failed to checkout plugin '{0}' to requested revision: {1}", failureLabel, err?.message ?? String(err))
      });
      throw err;
    }
  }
};
AbstractGitPluginSource = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IPluginGitService),
  __decorateParam(5, IProgressService)
], AbstractGitPluginSource);
class RelativePathPluginSource {
  constructor() {
    this.kind = PluginSourceKind.RelativePath;
  }
  getInstallUri(_cacheRoot, _descriptor) {
    throw new Error("Use getPluginInstallUri() for relative-path sources");
  }
  async ensure(_cacheRoot, _plugin, _options) {
    throw new Error("Use ensureRepository() for relative-path sources");
  }
  async update(_cacheRoot, _plugin, _options) {
    throw new Error("Use pullRepository() for relative-path sources");
  }
  getCleanupTarget(_cacheRoot, _descriptor) {
    return void 0;
  }
  getLabel(descriptor) {
    return descriptor.path || ".";
  }
}
class GitHubPluginSource extends AbstractGitPluginSource {
  constructor() {
    super(...arguments);
    this.kind = PluginSourceKind.GitHub;
  }
  /** Returns the URI where the plugin content lives (repo root + optional sub-path). */
  getInstallUri(cacheRoot, descriptor) {
    const repoDir = this._getRepoDir(cacheRoot, descriptor);
    const gh = descriptor;
    if (gh.path) {
      const normalizedPath = gh.path.trim().replace(/^\.?\/+|\/+$/g, "");
      if (normalizedPath) {
        const target = joinPath(repoDir, normalizedPath);
        if (isEqualOrParent(target, repoDir)) {
          return target;
        }
      }
    }
    return repoDir;
  }
  /** Returns the cloned repository root (without sub-path). */
  _getRepoDir(cacheRoot, descriptor) {
    const gh = descriptor;
    const [owner, repo] = gh.repo.split("/");
    return joinPath(cacheRoot, "github.com", owner, repo, ...gitRevisionCacheSuffix(gh.ref, gh.sha));
  }
  getLabel(descriptor) {
    const gh = descriptor;
    return gh.path ? `${gh.repo}/${gh.path}` : gh.repo;
  }
  _cloneUrl(descriptor) {
    return `https://github.com/${descriptor.repo}.git`;
  }
  _displayLabel(descriptor) {
    return descriptor.repo;
  }
}
class GitUrlPluginSource extends AbstractGitPluginSource {
  constructor() {
    super(...arguments);
    this.kind = PluginSourceKind.GitUrl;
  }
  /** Returns the URI where the plugin content lives (repo root + optional sub-path). */
  getInstallUri(cacheRoot, descriptor) {
    const repoDir = this._getRepoDir(cacheRoot, descriptor);
    const git = descriptor;
    if (git.path) {
      const normalizedPath = git.path.trim().replace(/^\.?\/+|\/+$/g, "");
      if (normalizedPath) {
        const target = joinPath(repoDir, normalizedPath);
        if (isEqualOrParent(target, repoDir)) {
          return target;
        }
      }
    }
    return repoDir;
  }
  /** Returns the cloned repository root (without sub-path). */
  _getRepoDir(cacheRoot, descriptor) {
    const git = descriptor;
    const segments = this._gitUrlCacheSegments(git.url, git.ref, git.sha);
    return joinPath(cacheRoot, ...segments);
  }
  getLabel(descriptor) {
    const git = descriptor;
    return git.path ? `${git.url}/${git.path}` : git.url;
  }
  _cloneUrl(descriptor) {
    return descriptor.url;
  }
  _displayLabel(descriptor) {
    return descriptor.url;
  }
  _gitUrlCacheSegments(url, ref, sha) {
    try {
      const parsed = URI.parse(url);
      const authority = (parsed.authority || "unknown").replace(/[\\/:*?"<>|]/g, "_").toLowerCase();
      const pathPart = parsed.path.replace(/^\/+/, "").replace(/\.git$/i, "").replace(/\/+$/g, "");
      const segments = pathPart.split("/").map((s) => s.replace(/[\\/:*?"<>|]/g, "_"));
      return [authority, ...segments, ...gitRevisionCacheSuffix(ref, sha)];
    } catch {
      return ["git", url.replace(/[\\/:*?"<>|]/g, "_"), ...gitRevisionCacheSuffix(ref, sha)];
    }
  }
}
let AbstractPackagePluginSource = class {
  constructor(_dialogService, _fileService, _logService, _notificationService, _progressService, _terminalService) {
    this._dialogService = _dialogService;
    this._fileService = _fileService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._progressService = _progressService;
    this._terminalService = _terminalService;
  }
  getCleanupTarget(cacheRoot, descriptor) {
    return this._getCacheDir(cacheRoot, descriptor);
  }
  async ensure(cacheRoot, plugin, _options) {
    const cacheDir = this._getCacheDir(cacheRoot, plugin.sourceDescriptor);
    await this._fileService.createFolder(cacheDir);
    return cacheDir;
  }
  async update(cacheRoot, plugin, _options) {
    const installDir = this._getCacheDir(cacheRoot, plugin.sourceDescriptor);
    const pluginDir = this.getInstallUri(cacheRoot, plugin.sourceDescriptor);
    await this.runInstall(installDir, pluginDir, plugin, { silent: _options?.silent });
    return true;
  }
  async runInstall(installDir, pluginDir, plugin, options) {
    const args = this._buildInstallArgs(installDir, plugin);
    const command = formatShellCommand(args);
    const confirmed = await this._confirmTerminalCommand(plugin.name, command, options?.silent);
    if (!confirmed) {
      return void 0;
    }
    const progressTitle = localize("installingPackagePlugin", "Installing {0} plugin '{1}'...", this._managerName, plugin.name);
    const { success, terminal } = await this._runTerminalCommand(command, progressTitle);
    if (!success) {
      return void 0;
    }
    const exists = await this._fileService.exists(pluginDir);
    if (!exists) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("packagePluginNotFound", "{0} package '{1}' was not found after installation.", this._managerName, this.getLabel(plugin.sourceDescriptor))
      });
      return void 0;
    }
    terminal?.dispose();
    return { pluginDir };
  }
  // -- terminal helpers (moved from PluginInstallService) ---
  async _confirmTerminalCommand(pluginName, command, silent) {
    if (silent) {
      return new Promise((resolve) => {
        const n = this._notificationService.notify({
          severity: Severity.Info,
          message: localize("confirmPluginInstallNotification", "Plugin '{0}' wants to run: {1}", pluginName, command),
          actions: {
            primary: [
              new Action("installPlugin", localize("install", "Install"), void 0, true, async () => resolve(true))
            ]
          }
        });
        Event.once(n.onDidClose)(() => resolve(false));
      });
    }
    const { confirmed } = await this._dialogService.confirm({
      type: "question",
      message: localize("confirmPluginInstall", "Install Plugin '{0}'?", pluginName),
      detail: localize("confirmPluginInstallDetail", "This will run the following command in a terminal:\n\n{0}", command),
      primaryButton: localize({ key: "confirmInstall", comment: ["&& denotes a mnemonic"] }, "&&Install")
    });
    return confirmed;
  }
  async _runTerminalCommand(command, progressTitle) {
    let terminal;
    try {
      await this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: progressTitle,
          cancellable: false
        },
        async () => {
          terminal = await this._terminalService.createTerminal({
            config: {
              name: localize("pluginInstallTerminal", "Plugin Install"),
              forceShellIntegration: true,
              isTransient: true,
              isFeatureTerminal: true
            }
          });
          await terminal.processReady;
          this._terminalService.setActiveInstance(terminal);
          const commandResultPromise = this._waitForTerminalCommandCompletion(terminal);
          await terminal.runCommand(command, true);
          const exitCode = await commandResultPromise;
          if (exitCode !== 0) {
            throw new Error(localize("terminalCommandExitCode", "Command exited with code {0}", exitCode));
          }
        }
      );
      return { success: true, terminal };
    } catch (err) {
      this._logService.error(`[${this.kind}] Terminal command failed:`, err);
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("terminalCommandFailed", "Plugin installation command failed: {0}", err?.message ?? String(err))
      });
      return { success: false, terminal };
    }
  }
  _waitForTerminalCommandCompletion(terminal) {
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      let isResolved = false;
      const resolveAndDispose = (exitCode) => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        disposables.dispose();
        resolve(exitCode);
      };
      const attachCommandFinishedListener = () => {
        const commandDetection = terminal.capabilities.get(TerminalCapability.CommandDetection);
        if (!commandDetection) {
          return;
        }
        disposables.add(commandDetection.onCommandFinished((command) => {
          resolveAndDispose(command.exitCode ?? 0);
        }));
      };
      attachCommandFinishedListener();
      disposables.add(terminal.capabilities.onDidAddCommandDetectionCapability(() => attachCommandFinishedListener()));
      const timeoutHandle = timeout(12e4);
      disposables.add(toDisposable(() => timeoutHandle.cancel()));
      void timeoutHandle.then(() => {
        if (isResolved) {
          return;
        }
        this._logService.warn(`[${this.kind}] Terminal command completion timed out`);
        resolveAndDispose(void 0);
      });
    });
  }
};
AbstractPackagePluginSource = __decorateClass([
  __decorateParam(0, IDialogService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IProgressService),
  __decorateParam(5, ITerminalService)
], AbstractPackagePluginSource);
class NpmPluginSource extends AbstractPackagePluginSource {
  constructor() {
    super(...arguments);
    this.kind = PluginSourceKind.Npm;
    this._managerName = "npm";
  }
  getInstallUri(cacheRoot, descriptor) {
    const npm = descriptor;
    return joinPath(cacheRoot, "npm", sanitizeCacheSegment(npm.package), "node_modules", npm.package);
  }
  getLabel(descriptor) {
    const npm = descriptor;
    return npm.version ? `${npm.package}@${npm.version}` : npm.package;
  }
  _getCacheDir(cacheRoot, descriptor) {
    const npm = descriptor;
    return joinPath(cacheRoot, "npm", sanitizeCacheSegment(npm.package));
  }
  _buildInstallArgs(installDir, plugin) {
    const npm = plugin.sourceDescriptor;
    const packageSpec = npm.version ? `${npm.package}@${npm.version}` : npm.package;
    const args = ["npm", "install", "--prefix", installDir.fsPath, packageSpec];
    if (npm.registry) {
      args.push("--registry", npm.registry);
    }
    return args;
  }
}
class PipPluginSource extends AbstractPackagePluginSource {
  constructor() {
    super(...arguments);
    this.kind = PluginSourceKind.Pip;
    this._managerName = "pip";
  }
  getInstallUri(cacheRoot, descriptor) {
    const pip = descriptor;
    return joinPath(cacheRoot, "pip", sanitizeCacheSegment(pip.package));
  }
  getLabel(descriptor) {
    const pip = descriptor;
    return pip.version ? `${pip.package}==${pip.version}` : pip.package;
  }
  _getCacheDir(cacheRoot, descriptor) {
    const pip = descriptor;
    return joinPath(cacheRoot, "pip", sanitizeCacheSegment(pip.package));
  }
  _buildInstallArgs(installDir, plugin) {
    const pip = plugin.sourceDescriptor;
    const packageSpec = pip.version ? `${pip.package}==${pip.version}` : pip.package;
    const args = ["pip", "install", "--target", installDir.fsPath, packageSpec];
    if (pip.registry) {
      args.push("--index-url", pip.registry);
    }
    return args;
  }
}
export {
  AbstractPackagePluginSource,
  GitHubPluginSource,
  GitUrlPluginSource,
  NpmPluginSource,
  PipPluginSource,
  RelativePathPluginSource
};
