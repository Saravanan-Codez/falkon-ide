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
import { VSBuffer } from "../../../base/common/buffer.js";
import { Event } from "../../../base/common/event.js";
import { match as globMatch } from "../../../base/common/glob.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { posix, win32 } from "../../../base/common/path.js";
import { OperatingSystem, OS } from "../../../base/common/platform.js";
import { arch } from "../../../base/common/process.js";
import { ExtUri } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { matchesDomainPattern, normalizeDomain } from "../../networkFilter/common/domainMatcher.js";
import { AgentNetworkDomainSettingId } from "../../networkFilter/common/settings.js";
import { AgentSandboxEnabledValue, AgentSandboxSettingId, isAgentSandboxEnabledValue } from "./settings.js";
import { IWindowsMxcTerminalSandboxRuntime } from "./terminalSandboxMxcRuntime.js";
import { getTerminalSandboxReadAllowListForCommands } from "./terminalSandboxReadAllowList.js";
import { getTerminalSandboxRuntimeConfigurationForCommands } from "./terminalSandboxRuntimeConfigurationPerOperation.js";
import { TerminalSandboxPrerequisiteCheck, TerminalSandboxPreCheckRemediation } from "./terminalSandboxService.js";
let TerminalSandboxEngine = class extends Disposable {
  constructor(_host, _fileService, _logService, _windowsMxcRuntime) {
    super();
    this._host = _host;
    this._fileService = _fileService;
    this._logService = _logService;
    this._windowsMxcRuntime = _windowsMxcRuntime;
    this._sandboxSettingsId = generateUuid();
    this._runtimeResolved = false;
    this._runAsNode = false;
    this._enableWeakerNestedSandbox = false;
    this._apparmorRemediationRequested = false;
    this._needsForceUpdateConfigFile = true;
    this._commandAllowListKeywords = [];
    this._commandAllowListCommandDetails = [];
    this._commandAllowNetwork = false;
    this._os = OS;
    this._defaultWritePaths = [];
    this._fileSystemPathExtUri = new ExtUri(() => this._os === OperatingSystem.Windows);
    this._buildSandboxPayload = (commandLine, policy, workingDirectory, containerName, containment) => {
      return this._host.buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment);
    };
    this._pathJoin = (...segments) => {
      const path = this._os === OperatingSystem.Windows ? win32 : posix;
      return path.join(...segments);
    };
    this._register(Event.runAndSubscribe(this._host.onDidChangeSandboxSettings, () => {
      this.setNeedsForceUpdateConfigFile();
    }));
    this._register(this._host.onDidChangeRoots(() => this.setNeedsForceUpdateConfigFile()));
  }
  static {
    this._urlRegex = /(?:https?|wss?):\/\/[^\s'"`|&;<>]+/gi;
  }
  static {
    this._sshRemoteRegex = /(?:^|[\s'"`])(?:[^\s@:'"`]+@)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?::[^\s'"`|&;<>]+)(?=$|[\s'"`|&;<>])/gi;
  }
  static {
    this._hostRegex = /(?:^|[\s'"`(=])([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?::\d+)?(?=(?:\/[^\s'"`|&;<>]*)?(?:$|[\s'"`)\]|,;|&<>]))/gi;
  }
  async isEnabled(precheckInputs) {
    return this._isSandboxConfiguredEnabled(precheckInputs);
  }
  async isSandboxAllowNetworkEnabled(precheckInputs) {
    if (!await this._isSandboxConfiguredEnabled(precheckInputs)) {
      return false;
    }
    return this._isSandboxAllowNetworkConfigured();
  }
  areUnsandboxedCommandsAllowed() {
    return this._areUnsandboxedCommandsAllowed();
  }
  areRetryWithAllowNetworkRequestsAllowed() {
    return this._areRetryWithAllowNetworkRequestsAllowed();
  }
  async getOS() {
    this._os = await this._host.getOS();
    return this._os;
  }
  getTempDir() {
    return this._tempDir;
  }
  setNeedsForceUpdateConfigFile() {
    this._needsForceUpdateConfigFile = true;
  }
  getResolvedNetworkDomains() {
    const allowedDomains = this._host.getSandboxSetting(AgentNetworkDomainSettingId.AllowedNetworkDomains) ?? [];
    const deniedDomains = this._host.getSandboxSetting(AgentNetworkDomainSettingId.DeniedNetworkDomains) ?? [];
    return { allowedDomains, deniedDomains };
  }
  async wrapCommand(command, requestUnsandboxedExecution, shell, cwd, commandDetails, requestAllowNetwork) {
    const allowUnsandboxedCommands = this._areUnsandboxedCommandsAllowed();
    const retryWithAllowNetworkRequests = this._areRetryWithAllowNetworkRequestsAllowed();
    const shouldInspectBlockedDomains = requestUnsandboxedExecution !== true && requestAllowNetwork !== true && (retryWithAllowNetworkRequests || allowUnsandboxedCommands);
    const blockedDomainResult = shouldInspectBlockedDomains ? this._getBlockedDomains(command) : { blockedDomains: [], deniedDomains: [] };
    const requiresPreflightAllowNetwork = retryWithAllowNetworkRequests && blockedDomainResult.blockedDomains.length > 0;
    const allowNetworkForCommand = requestUnsandboxedExecution !== true && (requestAllowNetwork === true && retryWithAllowNetworkRequests || requiresPreflightAllowNetwork);
    const normalizedCommandDetails = this._normalizeCommandDetails(commandDetails ?? []);
    const normalizedCommandKeywords = this._normalizeCommandKeywords(normalizedCommandDetails.map((c) => c.keyword));
    const currentReadAllowListPaths = getTerminalSandboxReadAllowListForCommands(this._os, this._commandAllowListKeywords, this._commandAllowListCommandDetails);
    const nextReadAllowListPaths = getTerminalSandboxReadAllowListForCommands(this._os, normalizedCommandKeywords, normalizedCommandDetails);
    const currentRuntimeConfiguration = getTerminalSandboxRuntimeConfigurationForCommands(this._os, this._commandAllowListCommandDetails);
    const nextRuntimeConfiguration = getTerminalSandboxRuntimeConfigurationForCommands(this._os, normalizedCommandDetails);
    const shouldRefreshConfig = this._commandAllowListKeywords.length === 0 || this._needsForceUpdateConfigFile || !this._areStringArraysEqual(this._commandAllowListKeywords, normalizedCommandKeywords) || !this._areStringArraysEqual(currentReadAllowListPaths, nextReadAllowListPaths) || !this._areObjectsEqual(currentRuntimeConfiguration, nextRuntimeConfiguration) || this._commandCwd?.toString() !== cwd?.toString() || this._commandAllowNetwork !== allowNetworkForCommand || this._os === OperatingSystem.Windows && (this._commandLine !== command || this._commandShell !== shell);
    if (shouldRefreshConfig) {
      this._commandAllowListKeywords = normalizedCommandKeywords;
      this._commandAllowListCommandDetails = normalizedCommandDetails;
      this._commandCwd = cwd;
      this._commandLine = command;
      this._commandShell = shell;
      this._commandAllowNetwork = allowNetworkForCommand;
      await this.getSandboxConfigPath(true);
    }
    if (!this._sandboxConfigPath || !this._tempDir) {
      throw new Error("Sandbox config path or temp dir not initialized");
    }
    if (!requestUnsandboxedExecution && !retryWithAllowNetworkRequests && allowUnsandboxedCommands && blockedDomainResult.blockedDomains.length > 0) {
      return {
        command: this._wrapUnsandboxedCommand(command, shell, cwd),
        isSandboxWrapped: false,
        blockedDomains: blockedDomainResult.blockedDomains,
        deniedDomains: blockedDomainResult.deniedDomains,
        requiresUnsandboxConfirmation: true
      };
    }
    if (requestUnsandboxedExecution && allowUnsandboxedCommands) {
      return {
        command: this._wrapUnsandboxedCommand(command, shell, cwd),
        isSandboxWrapped: false
      };
    }
    const allowNetworkConfirmationMetadata = requiresPreflightAllowNetwork ? {
      blockedDomains: blockedDomainResult.blockedDomains,
      deniedDomains: blockedDomainResult.deniedDomains
    } : void 0;
    if (this._os === OperatingSystem.Windows) {
      if (!this._mxcPath) {
        throw new Error("MXC executable path not resolved");
      }
      return {
        command: this._windowsMxcRuntime.wrapCommand(this._mxcPath, this._sandboxConfigPath),
        isSandboxWrapped: true,
        requiresAllowNetworkConfirmation: allowNetworkForCommand && !this._isSandboxAllowNetworkConfigured() ? true : void 0,
        ...allowNetworkConfirmationMetadata
      };
    }
    if (!this._execPath) {
      throw new Error("Executable path not set to run sandbox commands");
    }
    if (!this._srtPath) {
      throw new Error("Sandbox runtime path not resolved");
    }
    if (!this._rgPath) {
      throw new Error("Ripgrep path not resolved");
    }
    const commandToRunInSandbox = this._getSandboxCommandWithPreservedCwd(command, cwd);
    const sandboxRuntimeCommand = `PATH="$PATH:${this._pathDirname(this._rgPath)}" TMPDIR="${this._tempDir.path}" CLAUDE_TMPDIR="${this._tempDir.path}" "${this._execPath}" "${this._srtPath}" --settings "${this._sandboxConfigPath}" -c ${this._quoteShellArgument(commandToRunInSandbox)}`;
    if (this._runAsNode) {
      const nodeSandboxRuntimeCommand = `ELECTRON_RUN_AS_NODE=1 ${sandboxRuntimeCommand}`;
      return {
        command: this._wrapSandboxRuntimeCommandForLaunch(nodeSandboxRuntimeCommand, cwd),
        isSandboxWrapped: true,
        requiresAllowNetworkConfirmation: allowNetworkForCommand && !this._isSandboxAllowNetworkConfigured() ? true : void 0,
        ...allowNetworkConfirmationMetadata
      };
    }
    return {
      command: this._wrapSandboxRuntimeCommandForLaunch(sandboxRuntimeCommand, cwd),
      isSandboxWrapped: true,
      requiresAllowNetworkConfirmation: allowNetworkForCommand && !this._isSandboxAllowNetworkConfigured() ? true : void 0,
      ...allowNetworkConfirmationMetadata
    };
  }
  async checkForSandboxingPrereqs(forceRefresh = false, precheckInputs) {
    if (!await this._isSandboxConfiguredEnabled(precheckInputs)) {
      return {
        enabled: false,
        sandboxConfigPath: void 0,
        failedCheck: void 0
      };
    }
    const sandboxConfigPath = await this.getSandboxConfigPath(forceRefresh, precheckInputs);
    if (!sandboxConfigPath) {
      return {
        enabled: true,
        sandboxConfigPath,
        failedCheck: TerminalSandboxPrerequisiteCheck.Config
      };
    }
    if (!await this._checkSandboxDependencies(forceRefresh)) {
      const missingDependencies = await this.getMissingSandboxDependencies();
      if (missingDependencies.length === 0 && this._sandboxDependencyStatus?.bubblewrapUsable === false) {
        if (this._sandboxDependencyStatus.apparmorRestrictsUnprivilegedUserNamespaces !== true || forceRefresh && this._apparmorRemediationRequested) {
          if (!this._enableWeakerNestedSandbox) {
            this._enableWeakerNestedSandbox = true;
            await this.getSandboxConfigPath(true, precheckInputs);
          }
          return {
            enabled: true,
            sandboxConfigPath: this._sandboxConfigPath,
            failedCheck: void 0
          };
        }
        this._apparmorRemediationRequested = true;
        return {
          enabled: true,
          sandboxConfigPath,
          failedCheck: TerminalSandboxPrerequisiteCheck.Bubblewrap,
          remediations: this._getBubblewrapRemediations(),
          detail: this._sandboxDependencyStatus.bubblewrapError
        };
      }
      return {
        enabled: true,
        sandboxConfigPath,
        failedCheck: TerminalSandboxPrerequisiteCheck.Dependencies,
        missingDependencies,
        canInstallMissingDependencies: !!this._sandboxDependencyStatus?.dependencyInstallCommand
      };
    }
    return {
      enabled: true,
      sandboxConfigPath,
      failedCheck: void 0
    };
  }
  async checkFileAccess(permission, paths, precheckInputs) {
    if (!await this._isSandboxConfiguredEnabled(precheckInputs)) {
      return { allowed: true, denied: [] };
    }
    await this._resolveRuntimeInfo();
    if (!this._tempDir) {
      await this._initTempDir();
    }
    const configFilePath = this._tempDir ? this._getUriPath(URI.joinPath(this._tempDir, `vscode-sandbox-settings-${this._sandboxSettingsId}.json`)) : void 0;
    const accessPaths = await this._getFileSystemAccessPaths(configFilePath);
    const denied = [];
    for (const path of paths) {
      if (!path || !await this._hasFileSystemAccess(permission, path, accessPaths)) {
        denied.push(path);
      }
    }
    return { allowed: denied.length === 0, denied };
  }
  async getSandboxConfigPath(forceRefresh = false, precheckInputs) {
    if (!await this._isSandboxConfiguredEnabled(precheckInputs)) {
      return void 0;
    }
    await this._resolveRuntimeInfo();
    if (!this._sandboxConfigPath || forceRefresh || this._needsForceUpdateConfigFile) {
      this._sandboxConfigPath = await this._createSandboxConfig();
      this._needsForceUpdateConfigFile = false;
    }
    return this._sandboxConfigPath;
  }
  async getMissingSandboxDependencies() {
    const os = await this.getOS();
    if (os === OperatingSystem.Windows) {
      return [];
    }
    if (!this._sandboxDependencyStatus) {
      this._sandboxDependencyStatus = await this._host.checkSandboxDependencies();
    }
    const missing = [];
    if (this._sandboxDependencyStatus && !this._sandboxDependencyStatus.bubblewrapInstalled) {
      missing.push("bubblewrap");
    }
    if (this._sandboxDependencyStatus && !this._sandboxDependencyStatus.socatInstalled) {
      missing.push("socat");
    }
    return missing;
  }
  /**
   * Deletes the sandbox temp directory if one was created. Hosts are expected
   * to invoke this from their shutdown / disposal path; the engine itself does
   * not delete the directory on `dispose()` because shutdown joiners need to
   * be coordinated externally.
   */
  async cleanupTempDir() {
    if (!this._tempDir) {
      return;
    }
    try {
      await this._fileService.del(this._tempDir, { recursive: true, useTrash: false });
    } catch (error) {
      this._logService.warn("TerminalSandboxEngine: Failed to delete sandbox temp dir", error);
    }
  }
  // ---- private helpers ----------------------------------------------------
  async _checkSandboxDependencies(forceRefresh = false) {
    const os = await this.getOS();
    if (os === OperatingSystem.Windows) {
      return true;
    }
    if (!forceRefresh && this._sandboxDependencyStatus) {
      return this._sandboxDependencyStatus.bubblewrapInstalled && this._sandboxDependencyStatus.bubblewrapUsable && this._sandboxDependencyStatus.socatInstalled;
    }
    const status = await this._host.checkSandboxDependencies();
    this._sandboxDependencyStatus = status;
    if (status && !status.bubblewrapInstalled) {
      this._logService.warn("TerminalSandboxEngine: bubblewrap (bwrap) is not installed");
    } else if (status && !status.bubblewrapUsable) {
      this._logService.warn("TerminalSandboxEngine: bubblewrap (bwrap) is installed but failed its capability check", status.bubblewrapError);
    }
    if (status && !status.socatInstalled) {
      this._logService.warn("TerminalSandboxEngine: socat is not installed");
    }
    return status ? status.bubblewrapInstalled && status.bubblewrapUsable && status.socatInstalled : true;
  }
  _getBubblewrapRemediations() {
    return [TerminalSandboxPreCheckRemediation.DisableUnprivilagedusernamespaceRestriction];
  }
  _quoteShellArgument(value) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
  _getSandboxCommandWithPreservedCwd(command, cwd) {
    if (this._os !== OperatingSystem.Linux || !cwd?.path || cwd.path === this._tempDir?.path) {
      return command;
    }
    return `cd ${this._quoteShellArgument(cwd.path)} && ${command}`;
  }
  _wrapSandboxRuntimeCommandForLaunch(sandboxRuntimeCommand, cwd) {
    const tempDirPath = this._tempDir?.path;
    return this._os === OperatingSystem.Linux && cwd?.path && tempDirPath && cwd.path !== tempDirPath ? `cd ${this._quoteShellArgument(tempDirPath)}; ${sandboxRuntimeCommand}` : sandboxRuntimeCommand;
  }
  _wrapUnsandboxedCommand(command, shell, cwd) {
    if (this._os === OperatingSystem.Windows) {
      return this._windowsMxcRuntime.wrapUnsandboxedCommand(command);
    }
    if (!this._tempDir?.path) {
      return command;
    }
    const commandWithPreservedCwd = this._getSandboxCommandWithPreservedCwd(command, cwd);
    if (!shell) {
      return `(TMPDIR="${this._tempDir.path}"; export TMPDIR; ${commandWithPreservedCwd})`;
    }
    return `env TMPDIR="${this._tempDir.path}" ${this._quoteShellArgument(shell)} -c ${this._quoteShellArgument(commandWithPreservedCwd)}`;
  }
  _getBlockedDomains(command) {
    if (this._isSandboxAllowNetworkConfigured()) {
      return { blockedDomains: [], deniedDomains: [] };
    }
    const domains = this._extractDomains(command);
    if (domains.length === 0) {
      return { blockedDomains: [], deniedDomains: [] };
    }
    const { allowedDomains, deniedDomains } = this.getResolvedNetworkDomains();
    const blockedDomains = /* @__PURE__ */ new Set();
    const explicitlyDeniedDomains = /* @__PURE__ */ new Set();
    for (const domain of domains) {
      if (deniedDomains.some((pattern) => matchesDomainPattern(domain, pattern))) {
        blockedDomains.add(domain);
        explicitlyDeniedDomains.add(domain);
        continue;
      }
      if (!allowedDomains.some((pattern) => matchesDomainPattern(domain, pattern))) {
        blockedDomains.add(domain);
      }
    }
    return {
      blockedDomains: [...blockedDomains],
      deniedDomains: [...explicitlyDeniedDomains]
    };
  }
  _extractDomains(command) {
    const domains = /* @__PURE__ */ new Set();
    let match;
    TerminalSandboxEngine._urlRegex.lastIndex = 0;
    while ((match = TerminalSandboxEngine._urlRegex.exec(command)) !== null) {
      const domain = this._extractDomainFromUrl(match[0]);
      if (domain) {
        domains.add(domain);
      }
    }
    TerminalSandboxEngine._sshRemoteRegex.lastIndex = 0;
    while ((match = TerminalSandboxEngine._sshRemoteRegex.exec(command)) !== null) {
      const domain = normalizeDomain(match[1], true);
      if (domain) {
        domains.add(domain);
      }
    }
    TerminalSandboxEngine._hostRegex.lastIndex = 0;
    while ((match = TerminalSandboxEngine._hostRegex.exec(command)) !== null) {
      const domain = normalizeDomain(match[1]);
      if (domain) {
        domains.add(domain);
      }
    }
    return [...domains];
  }
  _extractDomainFromUrl(value) {
    try {
      const authority = URI.parse(value).authority;
      return normalizeDomain(authority, true);
    } catch {
      return void 0;
    }
  }
  _normalizeCommandKeywords(commandKeywords) {
    return [...new Set(commandKeywords.map((keyword) => keyword.toLowerCase()))].sort();
  }
  _normalizeCommandDetails(commandDetails) {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const command of commandDetails) {
      const normalizedCommand = { keyword: command.keyword.toLowerCase(), args: [...command.args] };
      const key = JSON.stringify(normalizedCommand);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(normalizedCommand);
      }
    }
    return result.sort((a, b) => a.keyword.localeCompare(b.keyword) || a.args.join("\0").localeCompare(b.args.join("\0")));
  }
  _areStringArraysEqual(a, b) {
    return a.length === b.length && a.every((keyword, index) => keyword === b[index]);
  }
  _areObjectsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  _isSandboxAllowedByPrecheckInputs(precheckInputs) {
    return precheckInputs?.isDefaultApprovalPermissionEnabled !== false;
  }
  async _isSandboxConfiguredEnabled(precheckInputs) {
    if (!this._isSandboxAllowedByPrecheckInputs(precheckInputs)) {
      return false;
    }
    await this.getOS();
    if (this._os === OperatingSystem.Windows) {
      const value2 = this._getSandboxConfiguredWindowsEnabledValue();
      return isAgentSandboxEnabledValue(value2);
    }
    const value = this._getSandboxConfiguredEnabledValue();
    return isAgentSandboxEnabledValue(value);
  }
  async _resolveRuntimeInfo() {
    if (this._runtimeResolved) {
      return;
    }
    this._runtimeResolved = true;
    const runtimeInfo = await this._host.getRuntimeInfo();
    this._appRoot = runtimeInfo.appRoot;
    this._execPath = runtimeInfo.execPath;
    this._runAsNode = runtimeInfo.runAsNode ?? false;
    this._userHome = await this._host.getUserHome();
    this._srtPath = this._pathJoin(this._appRoot, "node_modules", "@vscode", "sandbox-runtime", "dist", "cli.js");
    const nativeModulesDir = runtimeInfo.nativeModulesDir ?? "node_modules";
    const rgPlatform = this._os === OperatingSystem.Windows ? "win32" : this._os === OperatingSystem.Macintosh ? "darwin" : "linux";
    const rgBinary = this._os === OperatingSystem.Windows ? "rg.exe" : "rg";
    this._rgPath = this._pathJoin(this._appRoot, nativeModulesDir, "@vscode", "ripgrep-universal", "bin", `${rgPlatform}-${arch}`, rgBinary);
    this._mxcPath = this._windowsMxcRuntime.getExecutablePath(this._appRoot, nativeModulesDir, runtimeInfo.arch);
  }
  async _createSandboxConfig() {
    if (await this.isEnabled() && !this._tempDir) {
      await this._initTempDir();
    }
    if (!this._tempDir) {
      return void 0;
    }
    const allowNetwork = this._commandAllowNetwork || await this.isSandboxAllowNetworkEnabled();
    const linuxFileSystemSetting = this._os === OperatingSystem.Linux ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxLinuxFileSystem) ?? {} : {};
    const macFileSystemSetting = this._os === OperatingSystem.Macintosh ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxMacFileSystem) ?? {} : {};
    const windowsFileSystemSetting = this._os === OperatingSystem.Windows ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxWindowsFileSystem) ?? {} : {};
    const windowsSchemaVersion = this._os === OperatingSystem.Windows ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxWindowsSchemaVersion) : void 0;
    const runtimeSetting = {
      ...this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxAdvancedRuntime),
      ...this._enableWeakerNestedSandbox ? { enableWeakerNestedSandbox: true } : void 0
    };
    const commandRuntimeSetting = getTerminalSandboxRuntimeConfigurationForCommands(this._os, this._commandAllowListCommandDetails);
    const commandRuntimeAllowReadPaths = this._getCommandRuntimeFileSystemPaths(commandRuntimeSetting, "allowRead");
    const commandRuntimeAllowWritePaths = this._getCommandRuntimeFileSystemPaths(commandRuntimeSetting, "allowWrite");
    const configFileUri = URI.joinPath(this._tempDir, `vscode-sandbox-settings-${this._sandboxSettingsId}.json`);
    const configFilePath = this._getUriPath(configFileUri);
    let allowWritePaths = [];
    let allowReadPaths = [];
    let denyReadPaths = [];
    let denyWritePaths;
    if (this._os === OperatingSystem.Windows) {
      const filesystemPolicy = await this._getWindowsMxcFilesystemPolicy();
      const env = await this._getWindowsMxcEnvironment();
      allowWritePaths = await this._resolveFileSystemPaths([
        ...await this._updateAllowWritePathsWithWorkspaceFolders(windowsFileSystemSetting.allowWrite),
        ...filesystemPolicy.readwritePaths
      ]);
      allowReadPaths = await this._resolveFileSystemPaths([...windowsFileSystemSetting.allowRead ?? [], ...filesystemPolicy.readonlyPaths]);
      denyReadPaths = await this._resolveFileSystemPaths(windowsFileSystemSetting.denyRead ?? []);
      this._windowsMxcEnvironment = env;
    } else if (this._os === OperatingSystem.Macintosh) {
      allowWritePaths = (await this._resolveFileSystemPaths(await this._updateAllowWritePathsWithWorkspaceFolders(macFileSystemSetting.allowWrite, commandRuntimeAllowWritePaths))).filter((path) => path !== configFilePath);
      allowReadPaths = await this._resolveFileSystemPaths(await this._updateAllowReadPathsWithAllowWrite(macFileSystemSetting.allowRead, allowWritePaths, commandRuntimeAllowReadPaths));
      denyReadPaths = await this._resolveFileSystemPaths(this._updateDenyReadPathsWithHome([...macFileSystemSetting.denyRead ?? [], configFilePath]));
      denyWritePaths = macFileSystemSetting.denyWrite ? await this._resolveFileSystemPaths(macFileSystemSetting.denyWrite) : void 0;
    } else if (this._os === OperatingSystem.Linux) {
      allowWritePaths = (await this._resolveFileSystemPaths(await this._updateAllowWritePathsWithWorkspaceFolders(linuxFileSystemSetting.allowWrite, commandRuntimeAllowWritePaths))).filter((path) => path !== configFilePath);
      allowReadPaths = await this._resolveFileSystemPaths(await this._updateAllowReadPathsWithAllowWrite(linuxFileSystemSetting.allowRead, allowWritePaths, commandRuntimeAllowReadPaths));
      denyReadPaths = await this._resolveFileSystemPaths(this._updateDenyReadPathsWithHome([...linuxFileSystemSetting.denyRead ?? [], configFilePath]));
      denyWritePaths = await this._resolveFileSystemPaths(linuxFileSystemSetting.denyWrite);
    }
    const sandboxSettings = this._os === OperatingSystem.Windows ? await this._windowsMxcRuntime.createConfig({
      command: this._commandLine ?? "",
      shell: this._commandShell,
      cwd: this._commandCwd ?? this._getDefaultWindowsMxcCwd(),
      tempDir: this._tempDir,
      schemaVersion: windowsSchemaVersion,
      allowNetwork,
      allowReadPaths,
      allowWritePaths,
      denyReadPaths,
      env: this._windowsMxcEnvironment ?? []
    }, this._buildSandboxPayload) : {
      network: allowNetwork ? { allowedDomains: [], deniedDomains: [], enabled: false } : this.getResolvedNetworkDomains(),
      filesystem: {
        denyRead: denyReadPaths,
        allowRead: allowReadPaths,
        allowWrite: allowWritePaths,
        denyWrite: denyWritePaths
      }
    };
    if (this._os !== OperatingSystem.Windows) {
      const sandboxRuntimeSettings = sandboxSettings;
      this._mergeAdditionalSandboxConfigProperties(sandboxRuntimeSettings, runtimeSetting);
      this._mergeAdditionalSandboxConfigProperties(sandboxRuntimeSettings, commandRuntimeSetting);
      if (this._os === OperatingSystem.Macintosh) {
        sandboxRuntimeSettings.allowPty ??= true;
      }
    }
    this._sandboxConfigPath = configFilePath;
    await this._fileService.createFile(configFileUri, VSBuffer.fromString(JSON.stringify(sandboxSettings, null, "	")), { overwrite: true });
    return this._sandboxConfigPath;
  }
  async _getFileSystemAccessPaths(configFilePath) {
    const linuxFileSystemSetting = this._os === OperatingSystem.Linux ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxLinuxFileSystem) ?? {} : {};
    const macFileSystemSetting = this._os === OperatingSystem.Macintosh ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxMacFileSystem) ?? {} : {};
    const windowsFileSystemSetting = this._os === OperatingSystem.Windows ? this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxWindowsFileSystem) ?? {} : {};
    const commandRuntimeSetting = getTerminalSandboxRuntimeConfigurationForCommands(this._os, this._commandAllowListCommandDetails);
    const commandRuntimeAllowReadPaths = this._getCommandRuntimeFileSystemPaths(commandRuntimeSetting, "allowRead");
    const commandRuntimeAllowWritePaths = this._getCommandRuntimeFileSystemPaths(commandRuntimeSetting, "allowWrite");
    let allowWritePaths = [];
    let allowReadPaths = [];
    let denyReadPaths = [];
    let denyWritePaths;
    if (this._os === OperatingSystem.Windows) {
      const filesystemPolicy = await this._getWindowsMxcFilesystemPolicy();
      allowWritePaths = await this._resolveFileSystemPaths([
        ...await this._updateAllowWritePathsWithWorkspaceFolders(windowsFileSystemSetting.allowWrite),
        ...filesystemPolicy.readwritePaths
      ]);
      allowReadPaths = await this._resolveFileSystemPaths([...windowsFileSystemSetting.allowRead ?? [], ...filesystemPolicy.readonlyPaths]);
      denyReadPaths = await this._resolveFileSystemPaths(windowsFileSystemSetting.denyRead ?? []);
    } else if (this._os === OperatingSystem.Macintosh) {
      allowWritePaths = (await this._resolveFileSystemPaths(await this._updateAllowWritePathsWithWorkspaceFolders(macFileSystemSetting.allowWrite, commandRuntimeAllowWritePaths))).filter((path) => path !== configFilePath);
      allowReadPaths = await this._resolveFileSystemPaths(await this._updateAllowReadPathsWithAllowWrite(macFileSystemSetting.allowRead, allowWritePaths, commandRuntimeAllowReadPaths));
      denyReadPaths = await this._resolveFileSystemPaths(this._updateDenyReadPathsWithHome([...macFileSystemSetting.denyRead ?? [], ...configFilePath ? [configFilePath] : []]));
      denyWritePaths = macFileSystemSetting.denyWrite ? await this._resolveFileSystemPaths(macFileSystemSetting.denyWrite) : void 0;
    } else if (this._os === OperatingSystem.Linux) {
      allowWritePaths = (await this._resolveFileSystemPaths(await this._updateAllowWritePathsWithWorkspaceFolders(linuxFileSystemSetting.allowWrite, commandRuntimeAllowWritePaths))).filter((path) => path !== configFilePath);
      allowReadPaths = await this._resolveFileSystemPaths(await this._updateAllowReadPathsWithAllowWrite(linuxFileSystemSetting.allowRead, allowWritePaths, commandRuntimeAllowReadPaths));
      denyReadPaths = await this._resolveFileSystemPaths(this._updateDenyReadPathsWithHome([...linuxFileSystemSetting.denyRead ?? [], ...configFilePath ? [configFilePath] : []]));
      denyWritePaths = await this._resolveFileSystemPaths(linuxFileSystemSetting.denyWrite);
    }
    return { allowReadPaths, allowWritePaths, denyReadPaths, denyWritePaths };
  }
  async _hasFileSystemAccess(permission, path, accessPaths) {
    const resolvedPaths = await this._resolveFileSystemPath(path);
    if (permission === "write") {
      if (this._os === OperatingSystem.Windows && this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.denyReadPaths)) {
        return false;
      }
      if (this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.denyWritePaths ?? [])) {
        return false;
      }
      return this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.allowWritePaths);
    }
    if (this._matchesAnyFileSystemPath(resolvedPaths, [...accessPaths.allowReadPaths, ...accessPaths.allowWritePaths])) {
      return true;
    }
    return !this._matchesAnyFileSystemPath(resolvedPaths, accessPaths.denyReadPaths);
  }
  _matchesAnyFileSystemPath(paths, matchers) {
    return paths.some((path) => matchers.some((matcher) => this._matchesFileSystemPath(path, matcher)));
  }
  /**
   * Returns whether a candidate filesystem path is covered by a sandbox allow/deny
   * matcher. Both values are normalized with the target sandbox OS semantics before
   * comparison. Non-glob matchers are treated as exact-or-parent matches; glob
   * matchers are evaluated with VS Code's glob matcher.
   *
   * Examples:
   * - Linux/macOS: `/workspace/project/src/file.ts` matches `/workspace/project`.
   * - Linux/macOS: `/workspace/project2/file.ts` does not match `/workspace/project`.
   * - Windows: `C:\Repo\src\file.ts` matches `c:/repo` because matching is
   *   case-insensitive and backslashes are normalized to `/`.
   * - Glob: `/workspace/project/package.json` matches `/workspace/project/*.json`.
   */
  _matchesFileSystemPath(path, matcher) {
    const normalizedPath = this._normalizeFileSystemAccessPath(path);
    const normalizedMatcher = this._normalizeFileSystemAccessPath(matcher, true);
    const ignoreCase = this._os === OperatingSystem.Windows;
    if (this._containsGlobPattern(normalizedMatcher)) {
      return globMatch(normalizedMatcher, normalizedPath, { ignoreCase });
    }
    return this._fileSystemPathExtUri.isEqualOrParent(this._toFileSystemAccessUri(normalizedPath), this._toFileSystemAccessUri(normalizedMatcher));
  }
  /**
   * Converts a normalized sandbox filesystem path into a pseudo URI so the common
   * `ExtUri.isEqualOrParent` comparer can be used instead of deprecated string
   * path helpers. A non-`file` scheme is intentional: it keeps comparison on the
   * URI path component and avoids converting through the host OS' native `fsPath`
   * rules, which may differ from the sandbox target OS.
   *
   * Examples:
   * - `/workspace/project` becomes `terminal-sandbox-path:/workspace/project`.
   * - `C:/Repo` becomes `terminal-sandbox-path:/C:/Repo` so Windows drive paths
   *   are still valid URI paths for comparison.
   */
  _toFileSystemAccessUri(path) {
    return URI.from({ scheme: "terminal-sandbox-path", path: path.startsWith("/") ? path : `/${path}` });
  }
  /**
   * Normalizes a path or matcher into the form used for sandbox access checks.
   * On Windows, backslashes are converted to `/` and URI-shaped drive paths like
   * `/C:/Users/me` are converted to `C:/Users/me`. Unless `preserveGlob` is true
   * for a glob matcher, the path is POSIX-normalized to remove redundant `.`/`..`
   * segments. Trailing slashes are removed except for filesystem roots.
   *
   * Examples:
   * - Linux/macOS: `/workspace/../workspace/app/` becomes `/workspace/app`.
   * - Windows: `C:\Users\me\project\` becomes `C:/Users/me/project`.
   * - Windows: `/C:/Users/me/project` becomes `C:/Users/me/project`.
   * - Glob with `preserveGlob=true`: `/workspace/project/*.json` keeps the glob
   *   pattern intact for `globMatch`.
   */
  _normalizeFileSystemAccessPath(path, preserveGlob = false) {
    let normalizedPath = this._os === OperatingSystem.Windows ? path.replace(/\\/g, "/") : path;
    if (this._os === OperatingSystem.Windows && /^\/[a-zA-Z]:($|\/)/.test(normalizedPath)) {
      normalizedPath = normalizedPath.slice(1);
    }
    if (!preserveGlob || !this._containsGlobPattern(normalizedPath)) {
      normalizedPath = posix.normalize(normalizedPath);
    }
    if (normalizedPath.length > 1 && normalizedPath.endsWith("/") && !/^[a-zA-Z]:\/$/.test(normalizedPath)) {
      normalizedPath = normalizedPath.replace(/\/+$/, "");
    }
    return normalizedPath;
  }
  _containsGlobPattern(path) {
    return /[*?{\[]/.test(path);
  }
  _getCommandRuntimeFileSystemPaths(runtimeSetting, key) {
    const filesystem = runtimeSetting.filesystem;
    if (!this._isObjectForSandboxConfigMerge(filesystem)) {
      return [];
    }
    const paths = filesystem[key];
    if (!Array.isArray(paths)) {
      return [];
    }
    return paths.filter((path) => typeof path === "string");
  }
  _mergeAdditionalSandboxConfigProperties(target, additional) {
    for (const [key, value] of Object.entries(additional)) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = value;
        continue;
      }
      const existingValue = target[key];
      if (this._isObjectForSandboxConfigMerge(existingValue) && this._isObjectForSandboxConfigMerge(value)) {
        this._mergeAdditionalSandboxConfigProperties(existingValue, value);
      }
    }
  }
  _isObjectForSandboxConfigMerge(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  async _getWindowsMxcFilesystemPolicy() {
    if (!this._windowsMxcFilesystemPolicy) {
      this._windowsMxcFilesystemPolicy = await this._host.getWindowsMxcFilesystemPolicy() ?? { readonlyPaths: [], readwritePaths: [] };
    }
    return this._windowsMxcFilesystemPolicy;
  }
  async _getWindowsMxcEnvironment() {
    if (!this._windowsMxcEnvironment) {
      this._windowsMxcEnvironment = await this._host.getWindowsMxcEnvironment() ?? [];
    }
    return this._windowsMxcEnvironment;
  }
  _pathDirname(path) {
    return (this._os === OperatingSystem.Windows ? win32 : posix).dirname(path);
  }
  _getUriPath(uri) {
    return this._os === OperatingSystem.Windows ? this._windowsMxcRuntime.toWindowsPath(uri) : uri.path;
  }
  async _initTempDir() {
    if (!await this.isEnabled()) {
      return;
    }
    this._needsForceUpdateConfigFile = true;
    this._tempDir = await this._host.getSandboxTempDir();
    if (this._tempDir) {
      await this._fileService.createFolder(this._tempDir);
      this._defaultWritePaths.push(this._getUriPath(this._tempDir));
    } else {
      this._logService.warn("TerminalSandboxEngine: Cannot create sandbox settings file because no tmpDir is available in this environment");
    }
  }
  async _updateAllowWritePathsWithWorkspaceFolders(configuredAllowWrite, commandRuntimeAllowWrite = []) {
    const writeRootPaths = this._host.getWriteRoots().map((folder) => this._getUriPath(folder));
    return [.../* @__PURE__ */ new Set([...writeRootPaths, ...this._defaultWritePaths, ...await this._getWorkspaceStorageReadPaths(), ...configuredAllowWrite ?? [], ...commandRuntimeAllowWrite])];
  }
  _updateDenyReadPathsWithHome(configuredDenyRead) {
    if (this._os === OperatingSystem.Windows) {
      return [...new Set(configuredDenyRead ?? [])];
    }
    const userHome = this._userHome ? this._getUriPath(this._userHome) : void 0;
    return [.../* @__PURE__ */ new Set([...configuredDenyRead ?? [], ...userHome ? [userHome] : []])];
  }
  async _updateAllowReadPathsWithAllowWrite(configuredAllowRead, allowWrite, commandRuntimeAllowRead = []) {
    return [.../* @__PURE__ */ new Set([...configuredAllowRead ?? [], ...getTerminalSandboxReadAllowListForCommands(this._os, this._commandAllowListKeywords, this._commandAllowListCommandDetails), ...commandRuntimeAllowRead, ...this._getSandboxRuntimeReadPaths(), ...await this._getWorkspaceStorageReadPaths(), ...allowWrite])];
  }
  async _resolveFileSystemPaths(paths) {
    const resolvedPaths = await Promise.all((paths ?? []).map((path) => this._resolveFileSystemPath(path)));
    const seenPaths = /* @__PURE__ */ new Set();
    return resolvedPaths.flat().filter((path) => {
      const comparisonKey = this._getFileSystemPathComparisonKey(path);
      if (seenPaths.has(comparisonKey)) {
        return false;
      }
      seenPaths.add(comparisonKey);
      return true;
    });
  }
  _getFileSystemPathComparisonKey(path) {
    return this._os === OperatingSystem.Windows ? path.replace(/\//g, "\\").toLowerCase() : path;
  }
  async _resolveFileSystemPath(path) {
    const expandedPath = this._os === OperatingSystem.Linux ? this._expandHomePath(path) : path;
    if (!this._isAbsoluteFileSystemPath(expandedPath)) {
      return [expandedPath];
    }
    try {
      const realpath = await this._fileService.realpath(this._toFileSystemResource(expandedPath));
      const resolvedPath = realpath ? this._getUriPath(realpath) : void 0;
      return resolvedPath && resolvedPath !== expandedPath ? [expandedPath, resolvedPath] : [expandedPath];
    } catch {
      return [expandedPath];
    }
  }
  _isAbsoluteFileSystemPath(path) {
    return (this._os === OperatingSystem.Windows ? win32 : posix).isAbsolute(path);
  }
  _toFileSystemResource(path) {
    if (this._os === OperatingSystem.Windows) {
      return this._toWindowsFileSystemResource(path);
    }
    return this._userHome?.with({ path }) ?? this._tempDir?.with({ path }) ?? this._host.getWriteRoots()[0]?.with({ path }) ?? URI.file(path);
  }
  _toWindowsFileSystemResource(path) {
    const normalizedPath = path.replace(/\\/g, "/");
    if (/^\/\/[^/]/.test(normalizedPath)) {
      const firstPathSeparator = normalizedPath.indexOf("/", 2);
      if (firstPathSeparator === -1) {
        return URI.from({ scheme: "file", authority: normalizedPath.slice(2), path: "/" });
      }
      return URI.from({ scheme: "file", authority: normalizedPath.slice(2, firstPathSeparator), path: normalizedPath.slice(firstPathSeparator) || "/" });
    }
    if (/^[a-zA-Z]:($|\/)/.test(normalizedPath)) {
      return URI.from({ scheme: "file", path: `/${normalizedPath[0].toLowerCase()}${normalizedPath.slice(1)}` });
    }
    if (/^\/[a-zA-Z]:($|\/)/.test(normalizedPath)) {
      return URI.from({ scheme: "file", path: `/${normalizedPath[1].toLowerCase()}${normalizedPath.slice(2)}` });
    }
    return URI.from({ scheme: "file", path: normalizedPath });
  }
  _expandHomePath(path) {
    const userHome = this._userHome?.path;
    if (!userHome) {
      return path;
    }
    if (path === "~") {
      return userHome;
    }
    if (path.startsWith("~/")) {
      return this._pathJoin(userHome, path.slice(2));
    }
    return path;
  }
  _getSandboxRuntimeReadPaths() {
    if (!this._appRoot) {
      return [];
    }
    if (this._os === OperatingSystem.Windows) {
      return this._windowsMxcRuntime.getRuntimeReadPaths(this._appRoot, this._mxcPath);
    }
    const paths = [this._appRoot];
    if (this._execPath) {
      for (const path of [this._execPath, this._pathDirname(this._execPath)]) {
        if (!this._isPathUnderAppRoot(path)) {
          paths.push(path);
        }
      }
    }
    return paths;
  }
  _isPathUnderAppRoot(path) {
    if (!this._appRoot) {
      return false;
    }
    return path === this._appRoot || path.startsWith(`${this._appRoot}${this._os === OperatingSystem.Windows ? win32.sep : posix.sep}`);
  }
  async _getWorkspaceStorageReadPaths() {
    const root = await this._host.getWorkspaceStorageReadRoot();
    return root ? [this._getUriPath(root)] : [];
  }
  _getDefaultWindowsMxcCwd() {
    return this._host.getWriteRoots()[0];
  }
  _getSandboxConfiguredEnabledValue() {
    return this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxEnabled) ?? AgentSandboxEnabledValue.Off;
  }
  _getSandboxConfiguredWindowsEnabledValue() {
    return this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxWindowsEnabled) ?? AgentSandboxEnabledValue.Off;
  }
  _isSandboxAllowNetworkConfigured() {
    if (this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxAllowNetwork) === true) {
      return true;
    }
    if (this._os === OperatingSystem.Windows) {
      return this._getSandboxConfiguredWindowsEnabledValue() === AgentSandboxEnabledValue.AllowNetwork;
    }
    return this._getSandboxConfiguredEnabledValue() === AgentSandboxEnabledValue.AllowNetwork;
  }
  _areUnsandboxedCommandsAllowed() {
    return this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands) === true;
  }
  _areRetryWithAllowNetworkRequestsAllowed() {
    return this._host.getSandboxSetting(AgentSandboxSettingId.AgentSandboxRetryWithAllowNetworkRequests) === true;
  }
};
TerminalSandboxEngine = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IWindowsMxcTerminalSandboxRuntime)
], TerminalSandboxEngine);
export {
  TerminalSandboxEngine
};
