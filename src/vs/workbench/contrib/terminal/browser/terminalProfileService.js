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
import * as arrays from "../../../../base/common/arrays.js";
import * as objects from "../../../../base/common/objects.js";
import { AutoOpenBarrier } from "../../../../base/common/async.js";
import { throttle } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh, isWeb, isWindows, OperatingSystem, OS } from "../../../../base/common/platform.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { TerminalSettingPrefix, TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { registerTerminalDefaultProfileConfiguration } from "../../../../platform/terminal/common/terminalPlatformConfiguration.js";
import { terminalIconsEqual, terminalProfileArgsMatch } from "../../../../platform/terminal/common/terminalProfiles.js";
import { ITerminalInstanceService } from "./terminal.js";
import { refreshTerminalActions } from "./terminalActions.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { ITerminalContributionService } from "../common/terminalExtensionPoints.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { hasKey, isString } from "../../../../base/common/types.js";
let TerminalProfileService = class extends Disposable {
  constructor(_contextKeyService, _configurationService, _terminalContributionService, _extensionService, _remoteAgentService, _environmentService, _terminalInstanceService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._terminalContributionService = _terminalContributionService;
    this._extensionService = _extensionService;
    this._remoteAgentService = _remoteAgentService;
    this._environmentService = _environmentService;
    this._terminalInstanceService = _terminalInstanceService;
    this._contributedProfiles = [];
    this._internalContributedProfiles = [];
    this._platformConfigJustRefreshed = false;
    this._refreshTerminalActionsDisposable = this._register(new MutableDisposable());
    this._profileProviders = /* @__PURE__ */ new Map();
    this._onDidChangeAvailableProfiles = this._register(new Emitter());
    this._register(this._extensionService.onDidChangeExtensions(() => this.refreshAvailableProfiles()));
    this._webExtensionContributedProfileContextKey = TerminalContextKeys.webExtensionContributedProfile.bindTo(this._contextKeyService);
    this._updateWebContextKey();
    this._profilesReadyPromise = this._remoteAgentService.getEnvironment().then(() => {
      this._profilesReadyBarrier = new AutoOpenBarrier(2e4);
      return this._profilesReadyBarrier.wait().then(() => {
      });
    });
    this.refreshAvailableProfiles();
    this._setupConfigListener();
  }
  get onDidChangeAvailableProfiles() {
    return this._onDidChangeAvailableProfiles.event;
  }
  get profilesReady() {
    return this._profilesReadyPromise;
  }
  get availableProfiles() {
    if (!this._platformConfigJustRefreshed) {
      this.refreshAvailableProfiles();
    }
    return this._availableProfiles || [];
  }
  get contributedProfiles() {
    const userConfiguredProfileNames = this._availableProfiles?.map((p) => p.profileName) || [];
    return this._contributedProfiles?.filter((p) => !userConfiguredProfileNames.includes(p.title)) || [];
  }
  async _setupConfigListener() {
    const platformKey = await this.getPlatformKey();
    this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(TerminalSettingPrefix.AutomationProfile + platformKey) || e.affectsConfiguration(TerminalSettingPrefix.DefaultProfile + platformKey) || e.affectsConfiguration(TerminalSettingPrefix.Profiles + platformKey) || e.affectsConfiguration(TerminalSettingId.UseWslProfiles)) {
        if (e.source !== ConfigurationTarget.DEFAULT) {
          this.refreshAvailableProfiles();
          this._platformConfigJustRefreshed = false;
        } else {
          this._platformConfigJustRefreshed = true;
        }
      }
    }));
  }
  getDefaultProfileName() {
    return this._defaultProfileName;
  }
  getDefaultProfile(os) {
    let defaultProfileName;
    if (os) {
      defaultProfileName = this._configurationService.getValue(`${TerminalSettingPrefix.DefaultProfile}${this._getOsKey(os)}`);
      if (!defaultProfileName || !isString(defaultProfileName)) {
        return void 0;
      }
    } else {
      defaultProfileName = this._defaultProfileName;
    }
    if (!defaultProfileName) {
      return void 0;
    }
    return this.availableProfiles.find((e) => e.profileName === defaultProfileName && !e.isAutoDetected);
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
  refreshAvailableProfiles() {
    this._refreshAvailableProfilesNow();
  }
  async _refreshAvailableProfilesNow() {
    const profiles = await this._detectProfiles(true);
    const profilesChanged = !arrays.equals(profiles, this._availableProfiles, profilesEqual);
    const contributedProfilesChanged = await this._updateContributedProfiles();
    const platform = await this.getPlatformKey();
    const automationProfile = this._configurationService.getValue(`${TerminalSettingPrefix.AutomationProfile}${platform}`);
    const automationProfileChanged = !objects.equals(automationProfile, this._automationProfile);
    if (profilesChanged || contributedProfilesChanged || automationProfileChanged) {
      this._availableProfiles = profiles;
      this._automationProfile = automationProfile;
      this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
      this._profilesReadyBarrier.open();
      this._updateWebContextKey();
      await this._refreshPlatformConfig(this._availableProfiles);
    }
  }
  async _updateContributedProfiles() {
    const platformKey = await this.getPlatformKey();
    const excludedContributedProfiles = [];
    const configProfiles = this._configurationService.getValue(TerminalSettingPrefix.Profiles + platformKey);
    for (const [profileName, value] of Object.entries(configProfiles)) {
      if (value === null) {
        excludedContributedProfiles.push(profileName);
      }
    }
    const filteredContributedProfiles = [
      ...Array.from(this._terminalContributionService.terminalProfiles.filter((p) => !excludedContributedProfiles.includes(p.title))),
      ...this._internalContributedProfiles.filter((p) => !excludedContributedProfiles.includes(p.title))
    ];
    const contributedProfilesChanged = !arrays.equals(filteredContributedProfiles, this._contributedProfiles, contributedProfilesEqual);
    this._contributedProfiles = filteredContributedProfiles;
    return contributedProfilesChanged;
  }
  getContributedProfileProvider(extensionIdentifier, id) {
    const extMap = this._profileProviders.get(extensionIdentifier);
    return extMap?.get(id);
  }
  async _detectProfiles(includeDetectedProfiles) {
    if (isWeb && !this._environmentService.remoteAuthority) {
      const hasAnyBackend = [...this._terminalInstanceService.getRegisteredBackends()].length > 0;
      if (!hasAnyBackend) {
        return this._availableProfiles || [];
      }
    }
    const primaryBackend = await this._terminalInstanceService.getBackend(this._environmentService.remoteAuthority);
    if (!primaryBackend) {
      return this._availableProfiles || [];
    }
    const platform = await this.getPlatformKey();
    this._defaultProfileName = this._configurationService.getValue(`${TerminalSettingPrefix.DefaultProfile}${platform}`) ?? void 0;
    return primaryBackend.getProfiles(this._configurationService.getValue(`${TerminalSettingPrefix.Profiles}${platform}`), this._defaultProfileName, includeDetectedProfiles);
  }
  _updateWebContextKey() {
    this._webExtensionContributedProfileContextKey.set(isWeb && this._contributedProfiles.length > 0);
  }
  async _refreshPlatformConfig(profiles) {
    const env = await this._remoteAgentService.getEnvironment();
    registerTerminalDefaultProfileConfiguration({ os: env?.os || OS, profiles }, this._contributedProfiles);
    this._refreshTerminalActionsDisposable.value = refreshTerminalActions(profiles);
  }
  async getPlatformKey() {
    const env = await this._remoteAgentService.getEnvironment();
    if (env) {
      return env.os === OperatingSystem.Windows ? "windows" : env.os === OperatingSystem.Macintosh ? "osx" : "linux";
    }
    return isWindows ? "windows" : isMacintosh ? "osx" : "linux";
  }
  registerTerminalProfileProvider(extensionIdentifier, id, profileProvider) {
    let extMap = this._profileProviders.get(extensionIdentifier);
    if (!extMap) {
      extMap = /* @__PURE__ */ new Map();
      this._profileProviders.set(extensionIdentifier, extMap);
    }
    extMap.set(id, profileProvider);
    return toDisposable(() => this._profileProviders.delete(id));
  }
  async registerContributedProfile(args) {
    const platformKey = await this.getPlatformKey();
    const profilesConfig = await this._configurationService.getValue(`${TerminalSettingPrefix.Profiles}${platformKey}`);
    if (typeof profilesConfig === "object") {
      const newProfile = {
        extensionIdentifier: args.extensionIdentifier,
        icon: args.options.icon,
        id: args.id,
        title: args.title,
        color: args.options.color,
        titleTemplate: args.titleTemplate
      };
      profilesConfig[args.title] = newProfile;
    }
    await this._configurationService.updateValue(`${TerminalSettingPrefix.Profiles}${platformKey}`, profilesConfig, ConfigurationTarget.USER);
    return;
  }
  registerInternalContributedProfile(profile) {
    this._internalContributedProfiles.push(profile);
    this.refreshAvailableProfiles();
    return toDisposable(() => {
      const idx = this._internalContributedProfiles.indexOf(profile);
      if (idx >= 0) {
        this._internalContributedProfiles.splice(idx, 1);
        this.refreshAvailableProfiles();
      }
    });
  }
  overrideDefaultProfile(extensionIdentifier, id) {
    this._defaultProfileOverride = { extensionIdentifier, id };
    return toDisposable(() => {
      if (this._defaultProfileOverride?.extensionIdentifier === extensionIdentifier && this._defaultProfileOverride?.id === id) {
        this._defaultProfileOverride = void 0;
      }
    });
  }
  async getContributedDefaultProfile(shellLaunchConfig) {
    if (shellLaunchConfig && !shellLaunchConfig.extHostTerminalId && !hasKey(shellLaunchConfig, { executable: true })) {
      if (this._defaultProfileOverride) {
        const overridden = this.contributedProfiles.find(
          (p) => p.extensionIdentifier === this._defaultProfileOverride.extensionIdentifier && p.id === this._defaultProfileOverride.id
        );
        if (overridden) {
          return overridden;
        }
      }
      const key = await this.getPlatformKey();
      const defaultProfileName = this._configurationService.getValue(`${TerminalSettingPrefix.DefaultProfile}${key}`);
      const contributedDefaultProfile = this.contributedProfiles.find((p) => p.title === defaultProfileName);
      return contributedDefaultProfile;
    }
    return void 0;
  }
};
__decorateClass([
  throttle(2e3)
], TerminalProfileService.prototype, "refreshAvailableProfiles", 1);
TerminalProfileService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITerminalContributionService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IRemoteAgentService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, ITerminalInstanceService)
], TerminalProfileService);
function profilesEqual(one, other) {
  return one.profileName === other.profileName && terminalProfileArgsMatch(one.args, other.args) && one.color === other.color && terminalIconsEqual(one.icon, other.icon) && one.isAutoDetected === other.isAutoDetected && one.isDefault === other.isDefault && one.overrideName === other.overrideName && one.path === other.path;
}
function contributedProfilesEqual(one, other) {
  return one.extensionIdentifier === other.extensionIdentifier && one.color === other.color && one.icon === other.icon && one.id === other.id && one.title === other.title && one.titleTemplate === other.titleTemplate;
}
export {
  TerminalProfileService
};
