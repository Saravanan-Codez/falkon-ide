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
import { Schemas } from "../../../../base/common/network.js";
import { env } from "../../../../base/common/process.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { ITerminalProfileService } from "../common/terminal.js";
import * as path from "../../../../base/common/path.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { debounce } from "../../../../base/common/decorators.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isUriComponents, URI } from "../../../../base/common/uri.js";
import { deepClone } from "../../../../base/common/objects.js";
import { ITerminalInstanceService } from "./terminal.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isString } from "../../../../base/common/types.js";
const generatedProfileName = "Generated";
class BaseTerminalProfileResolverService extends Disposable {
  constructor(_context, _configurationService, _configurationResolverService, _historyService, _logService, _terminalProfileService, _workspaceContextService, _remoteAgentService) {
    super();
    this._context = _context;
    this._configurationService = _configurationService;
    this._configurationResolverService = _configurationResolverService;
    this._historyService = _historyService;
    this._logService = _logService;
    this._terminalProfileService = _terminalProfileService;
    this._workspaceContextService = _workspaceContextService;
    this._remoteAgentService = _remoteAgentService;
    this._iconRegistry = getIconRegistry();
    if (this._remoteAgentService.getConnection()) {
      this._remoteAgentService.getEnvironment().then((env2) => this._primaryBackendOs = env2?.os || OS);
    } else {
      this._primaryBackendOs = OS;
    }
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.DefaultProfileWindows) || e.affectsConfiguration(TerminalSettingId.DefaultProfileMacOs) || e.affectsConfiguration(TerminalSettingId.DefaultProfileLinux)) {
        this._refreshDefaultProfileName();
      }
    }));
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => this._refreshDefaultProfileName()));
  }
  get defaultProfileName() {
    return this._defaultProfileName;
  }
  async _refreshDefaultProfileName() {
    if (this._primaryBackendOs) {
      this._defaultProfileName = (await this.getDefaultProfile({
        remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority,
        os: this._primaryBackendOs
      }))?.profileName;
    }
  }
  resolveIcon(shellLaunchConfig, os) {
    if (shellLaunchConfig.icon) {
      shellLaunchConfig.icon = this._getCustomIcon(shellLaunchConfig.icon) || this.getDefaultIcon();
      return;
    }
    if (shellLaunchConfig.customPtyImplementation) {
      shellLaunchConfig.icon = this.getDefaultIcon();
      return;
    }
    if (shellLaunchConfig.executable) {
      return;
    }
    const defaultProfile = this._getUnresolvedRealDefaultProfile(os);
    if (defaultProfile) {
      shellLaunchConfig.icon = defaultProfile.icon;
    }
    if (!shellLaunchConfig.icon) {
      shellLaunchConfig.icon = this.getDefaultIcon();
    }
  }
  getDefaultIcon(resource) {
    return this._iconRegistry.getIcon(this._configurationService.getValue(TerminalSettingId.TabsDefaultIcon, { resource })) || Codicon.terminal;
  }
  async resolveShellLaunchConfig(shellLaunchConfig, options) {
    let resolvedProfile;
    if (shellLaunchConfig.executable) {
      resolvedProfile = await this._resolveProfile({
        path: shellLaunchConfig.executable,
        args: shellLaunchConfig.args,
        profileName: generatedProfileName,
        isDefault: false
      }, options);
    } else {
      resolvedProfile = await this.getDefaultProfile(options);
    }
    shellLaunchConfig.executable = resolvedProfile.path;
    shellLaunchConfig.args = resolvedProfile.args;
    if (resolvedProfile.env) {
      if (shellLaunchConfig.env) {
        shellLaunchConfig.env = { ...shellLaunchConfig.env, ...resolvedProfile.env };
      } else {
        shellLaunchConfig.env = resolvedProfile.env;
      }
    }
    const resource = shellLaunchConfig === void 0 || isString(shellLaunchConfig.cwd) ? void 0 : shellLaunchConfig.cwd;
    shellLaunchConfig.icon = this._getCustomIcon(shellLaunchConfig.icon) || this._getCustomIcon(resolvedProfile.icon) || this.getDefaultIcon(resource);
    if (resolvedProfile.overrideName) {
      shellLaunchConfig.name = resolvedProfile.profileName;
    }
    shellLaunchConfig.color = shellLaunchConfig.color || resolvedProfile.color || this._configurationService.getValue(TerminalSettingId.TabsDefaultColor, { resource });
    if (shellLaunchConfig.useShellEnvironment === void 0) {
      shellLaunchConfig.useShellEnvironment = this._configurationService.getValue(TerminalSettingId.InheritEnv);
    }
  }
  async getDefaultShell(options) {
    return (await this.getDefaultProfile(options)).path;
  }
  async getDefaultShellArgs(options) {
    return (await this.getDefaultProfile(options)).args || [];
  }
  async getDefaultProfile(options) {
    return this._resolveProfile(await this._getUnresolvedDefaultProfile(options), options);
  }
  getEnvironment(remoteAuthority) {
    return this._context.getEnvironment(remoteAuthority);
  }
  _getCustomIcon(icon) {
    if (!icon) {
      return void 0;
    }
    if (isString(icon)) {
      return ThemeIcon.fromId(icon);
    }
    if (ThemeIcon.isThemeIcon(icon)) {
      return icon;
    }
    if (URI.isUri(icon) || isUriComponents(icon)) {
      return URI.revive(icon);
    }
    if ((URI.isUri(icon.light) || isUriComponents(icon.light)) && (URI.isUri(icon.dark) || isUriComponents(icon.dark))) {
      return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
    }
    return void 0;
  }
  async _getUnresolvedDefaultProfile(options) {
    if (options.allowAgentHostShell) {
      const raw = this._configurationService.getValue(`terminal.integrated.agentHostProfile.${this._getOsKey(options.os)}`);
      if (isString(raw)) {
        await this._terminalProfileService.profilesReady;
      }
      const agentHostShellProfile = this._getUnresolvedAgentHostShellProfile(options);
      if (agentHostShellProfile) {
        return agentHostShellProfile;
      }
    }
    if (options.allowAutomationShell) {
      const automationShellProfile = this._getUnresolvedAutomationShellProfile(options);
      if (automationShellProfile) {
        return automationShellProfile;
      }
    }
    await this._terminalProfileService.profilesReady;
    const defaultProfile = this._getUnresolvedRealDefaultProfile(options.os);
    if (defaultProfile) {
      return this._setIconForAutomation(options, defaultProfile);
    }
    return this._setIconForAutomation(options, await this._getUnresolvedFallbackDefaultProfile(options));
  }
  _setIconForAutomation(options, profile) {
    if (options.allowAutomationShell) {
      const profileClone = deepClone(profile);
      profileClone.icon = Codicon.tools;
      return profileClone;
    }
    return profile;
  }
  _getUnresolvedRealDefaultProfile(os) {
    return this._terminalProfileService.getDefaultProfile(os);
  }
  async _getUnresolvedFallbackDefaultProfile(options) {
    const executable = await this._context.getDefaultSystemShell(options.remoteAuthority, options.os);
    if (options.os === OS) {
      let existingProfile = this._terminalProfileService.availableProfiles.find((e) => path.parse(e.path).name === path.parse(executable).name);
      if (existingProfile) {
        if (options.allowAutomationShell) {
          existingProfile = deepClone(existingProfile);
          existingProfile.icon = Codicon.tools;
        }
        return existingProfile;
      }
    }
    let args;
    if (options.os === OperatingSystem.Macintosh && path.parse(executable).name.match(/(zsh|bash)/)) {
      args = ["--login"];
    } else {
      args = [];
    }
    const icon = this._guessProfileIcon(executable);
    return {
      profileName: generatedProfileName,
      path: executable,
      args,
      icon,
      isDefault: false
    };
  }
  _getUnresolvedAutomationShellProfile(options) {
    const automationProfile = this._configurationService.getValue(`terminal.integrated.automationProfile.${this._getOsKey(options.os)}`);
    if (this._isValidAutomationProfile(automationProfile, options.os)) {
      automationProfile.icon = this._getCustomIcon(automationProfile.icon) || Codicon.tools;
      return automationProfile;
    }
    return void 0;
  }
  _getUnresolvedAgentHostShellProfile(options) {
    const agentHostProfile = this._configurationService.getValue(`terminal.integrated.agentHostProfile.${this._getOsKey(options.os)}`);
    if (isString(agentHostProfile)) {
      const named = this._terminalProfileService.availableProfiles.find((p) => p.profileName === agentHostProfile && !p.isAutoDetected);
      if (named) {
        const cloned = deepClone(named);
        cloned.icon = this._getCustomIcon(cloned.icon) || Codicon.tools;
        return cloned;
      }
      return void 0;
    }
    if (this._isValidAutomationProfile(agentHostProfile, options.os)) {
      agentHostProfile.icon = this._getCustomIcon(agentHostProfile.icon) || Codicon.tools;
      return agentHostProfile;
    }
    return void 0;
  }
  async _resolveProfile(profile, options) {
    const env2 = await this._context.getEnvironment(options.remoteAuthority);
    if (options.os === OperatingSystem.Windows) {
      const isWoW64 = !!env2.hasOwnProperty("PROCESSOR_ARCHITEW6432");
      const windir = env2.windir;
      if (!isWoW64 && windir) {
        const sysnativePath = path.join(windir, "Sysnative").replace(/\//g, "\\").toLowerCase();
        if (profile.path && profile.path.toLowerCase().indexOf(sysnativePath) === 0) {
          profile.path = path.join(windir, "System32", profile.path.substr(sysnativePath.length + 1));
        }
      }
      if (profile.path) {
        profile.path = profile.path.replace(/\//g, "\\");
      }
    }
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(options.remoteAuthority ? Schemas.vscodeRemote : Schemas.file);
    const lastActiveWorkspace = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
    profile.path = await this._resolveVariables(profile.path, env2, lastActiveWorkspace);
    if (profile.args) {
      if (isString(profile.args)) {
        profile.args = await this._resolveVariables(profile.args, env2, lastActiveWorkspace);
      } else {
        profile.args = await Promise.all(profile.args.map((arg) => this._resolveVariables(arg, env2, lastActiveWorkspace)));
      }
    }
    return profile;
  }
  async _resolveVariables(value, env2, lastActiveWorkspace) {
    try {
      value = await this._configurationResolverService.resolveWithEnvironment(env2, lastActiveWorkspace, value);
    } catch (e) {
      this._logService.error(`Could not resolve shell`, e);
    }
    return value;
  }
  _getOsKey(os) {
    switch (os) {
      case OperatingSystem.Linux:
        return "linux";
      case OperatingSystem.Macintosh:
        return "osx";
      case OperatingSystem.Windows:
        return "windows";
    }
  }
  _guessProfileIcon(shell) {
    const file = path.parse(shell).name;
    switch (file) {
      case "bash":
        return Codicon.terminalBash;
      case "pwsh":
      case "powershell":
        return Codicon.terminalPowershell;
      case "tmux":
        return Codicon.terminalTmux;
      case "cmd":
        return Codicon.terminalCmd;
      default:
        return void 0;
    }
  }
  _isValidAutomationProfile(profile, os) {
    if (profile === null || profile === void 0 || typeof profile !== "object") {
      return false;
    }
    if ("path" in profile && isString(profile.path)) {
      return true;
    }
    return false;
  }
}
__decorateClass([
  debounce(200)
], BaseTerminalProfileResolverService.prototype, "_refreshDefaultProfileName", 1);
let BrowserTerminalProfileResolverService = class extends BaseTerminalProfileResolverService {
  constructor(configurationResolverService, configurationService, historyService, logService, terminalInstanceService, terminalProfileService, workspaceContextService, remoteAgentService) {
    super(
      {
        getDefaultSystemShell: async (remoteAuthority, os) => {
          const backend = await terminalInstanceService.getBackend(remoteAuthority);
          if (!remoteAuthority || !backend) {
            return os === OperatingSystem.Windows ? "pwsh" : "bash";
          }
          return backend.getDefaultSystemShell(os);
        },
        getEnvironment: async (remoteAuthority) => {
          const backend = await terminalInstanceService.getBackend(remoteAuthority);
          if (!remoteAuthority || !backend) {
            return env;
          }
          return backend.getEnvironment();
        }
      },
      configurationService,
      configurationResolverService,
      historyService,
      logService,
      terminalProfileService,
      workspaceContextService,
      remoteAgentService
    );
  }
};
BrowserTerminalProfileResolverService = __decorateClass([
  __decorateParam(0, IConfigurationResolverService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IHistoryService),
  __decorateParam(3, ITerminalLogService),
  __decorateParam(4, ITerminalInstanceService),
  __decorateParam(5, ITerminalProfileService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IRemoteAgentService)
], BrowserTerminalProfileResolverService);
export {
  BaseTerminalProfileResolverService,
  BrowserTerminalProfileResolverService
};
