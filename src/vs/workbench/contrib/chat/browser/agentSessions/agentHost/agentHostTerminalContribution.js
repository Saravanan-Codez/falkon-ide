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
import { OS } from "../../../../../../base/common/platform.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { localize } from "../../../../../../nls.js";
import { IAgentHostService } from "../../../../../../platform/agentHost/common/agentService.js";
import { IAgentHostEnablementService } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { AgentHostConfigKey } from "../../../../../../platform/agentHost/common/agentHostCustomizationConfig.js";
import { AgentHostCustomTerminalToolEnabledSettingId, CopilotCliConfigKey } from "../../../../../../platform/agentHost/common/copilotCliConfig.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IDefaultAccountService } from "../../../../../../platform/defaultAccount/common/defaultAccount.js";
import { TerminalSettingId } from "../../../../../../platform/terminal/common/terminal.js";
import { ITerminalProfileResolverService, ITerminalProfileService } from "../../../../../../workbench/contrib/terminal/common/terminal.js";
import { IAgentHostTerminalService } from "../../../../../../workbench/contrib/terminal/browser/agentHostTerminalService.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { AgentHostRootConfigForwarder } from "./agentHostRootConfigForwarder.js";
const AGENT_HOST_SHELL_DEPENDENT_SETTINGS = [
  TerminalSettingId.AgentHostProfileLinux,
  TerminalSettingId.AgentHostProfileMacOs,
  TerminalSettingId.AgentHostProfileWindows,
  TerminalSettingId.DefaultProfileLinux,
  TerminalSettingId.DefaultProfileMacOs,
  TerminalSettingId.DefaultProfileWindows,
  TerminalSettingId.ProfilesLinux,
  TerminalSettingId.ProfilesMacOs,
  TerminalSettingId.ProfilesWindows
];
let AgentHostTerminalContribution = class extends Disposable {
  constructor(_agentHostService, _agentHostTerminalService, _configurationService, _terminalProfileService, _terminalProfileResolverService, _defaultAccountService, _agentHostEnablementService, environmentService) {
    super();
    this._agentHostService = _agentHostService;
    this._agentHostTerminalService = _agentHostTerminalService;
    this._configurationService = _configurationService;
    this._terminalProfileService = _terminalProfileService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._defaultAccountService = _defaultAccountService;
    this._agentHostEnablementService = _agentHostEnablementService;
    this._localEntry = this._register(new MutableDisposable());
    this._conditionalListeners = this._register(new MutableDisposable());
    const defaultShellKey = {
      key: AgentHostConfigKey.DefaultShell,
      computeValue: () => this._resolveDefaultShell(),
      registerTriggers: (store, push) => {
        store.add(this._configurationService.onDidChangeConfiguration((e) => {
          if (AGENT_HOST_SHELL_DEPENDENT_SETTINGS.some((s) => e.affectsConfiguration(s))) {
            push();
          }
        }));
        store.add(this._terminalProfileService.onDidChangeAvailableProfiles(() => push()));
      }
    };
    const keys = [
      ...environmentService.remoteAuthority ? [] : [defaultShellKey],
      {
        key: CopilotCliConfigKey.EnableCustomTerminalTool,
        computeValue: () => this._configurationService.getValue(AgentHostCustomTerminalToolEnabledSettingId) === true,
        registerTriggers: (store, push) => {
          store.add(this._configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(AgentHostCustomTerminalToolEnabledSettingId)) {
              push();
            }
          }));
        }
      },
      {
        // Mirror the connected GitHub Enterprise host to the agent host so its
        // GitHub resources / CAPI calls target the enterprise instance. Sourced
        // from the account service — the authoritative "am I signed in to GHE"
        // state — rather than reading the setting directly. Push `''` (not
        // `undefined`) for github.com: the push pipeline skips `undefined`,
        // which would strand a stale host on the agent host.
        key: AgentHostConfigKey.GithubEnterpriseUri,
        computeValue: () => {
          const provider = this._defaultAccountService.getDefaultAccountAuthenticationProvider();
          return provider.enterprise ? this._defaultAccountService.resolveGitHubUrl("").replace(/\/+$/, "") : "";
        },
        registerTriggers: (store, push) => {
          store.add(this._defaultAccountService.onDidChangeDefaultAccount(() => push()));
        }
      }
    ];
    this._forwarder = this._register(new AgentHostRootConfigForwarder(keys, this._agentHostService));
    this._register(autorun((reader) => this._updateEnabled(this._agentHostEnablementService.enabled.read(reader))));
  }
  static {
    this.ID = "workbench.contrib.agentHostTerminal";
  }
  _updateEnabled(enabled) {
    if (enabled) {
      if (!this._conditionalListeners.value) {
        const store = new DisposableStore();
        store.add(this._agentHostService.onAgentHostStart(() => this._registerLocalEntry()));
        this._conditionalListeners.value = store;
        this._registerLocalEntry();
        this._forwarder.start();
      }
    } else {
      this._conditionalListeners.value = void 0;
      this._localEntry.value = void 0;
      this._forwarder.stop();
    }
  }
  _registerLocalEntry() {
    if (!this._localEntry.value) {
      this._localEntry.value = this._agentHostTerminalService.registerEntry({
        name: localize("agentHostTerminal.local", "Local"),
        address: "__local__",
        getConnection: () => this._agentHostService
      });
    }
  }
  /**
   * Resolve the agent host terminal profile (with `defaultProfile.<os>`
   * fallback) so its host-managed shells inherit the user's preferred terminal
   * binary. Returns `undefined` when no usable path can be resolved.
   */
  async _resolveDefaultShell() {
    let profile;
    try {
      profile = await this._terminalProfileResolverService.getDefaultProfile({
        remoteAuthority: void 0,
        os: OS,
        allowAgentHostShell: true
      });
    } catch {
      return void 0;
    }
    return profile.path || void 0;
  }
};
AgentHostTerminalContribution = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IAgentHostTerminalService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITerminalProfileService),
  __decorateParam(4, ITerminalProfileResolverService),
  __decorateParam(5, IDefaultAccountService),
  __decorateParam(6, IAgentHostEnablementService),
  __decorateParam(7, IWorkbenchEnvironmentService)
], AgentHostTerminalContribution);
export {
  AgentHostTerminalContribution
};
