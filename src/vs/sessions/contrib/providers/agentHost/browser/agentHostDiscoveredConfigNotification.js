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
import { Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IDefaultAccountService } from "../../../../../platform/defaultAccount/common/defaultAccount.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { AgentHostAllowSignedOutWhenUsableSettingId } from "../../../../../platform/agentHost/common/agentService.js";
import { SessionType } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { SessionTypeAuthRequirement } from "../../../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../../../services/sessions/common/sessionsManagement.js";
import { ChatInputNotificationActionKind, ChatInputNotificationSeverity, IChatInputNotificationService } from "../../../../../workbench/contrib/chat/browser/widget/input/chatInputNotificationService.js";
import { ConditionalAuthState, conditionalAuthState, isAllowSignedOutWhenUsableEnabled, shouldShowDiscoveredConfigNudge } from "../../../../browser/sessionsAuthGate.js";
const DISCOVERED_CONFIG_NOTIFICATION_ID = "agentHost.discoveredConfig.claude";
const SIGN_IN_COMMAND_ID = "workbench.action.chat.triggerSetup";
const MUTE_COMMAND_ID = "workbench.action.agentHost.discoveredConfig.mute";
const MUTED_STORAGE_KEY = "agentHost.discoveredConfig.claude.muted";
let AgentHostDiscoveredConfigNotificationContribution = class extends Disposable {
  constructor(_chatInputNotificationService, _sessionsManagementService, _defaultAccountService, _configurationService, _storageService) {
    super();
    this._chatInputNotificationService = _chatInputNotificationService;
    this._sessionsManagementService = _sessionsManagementService;
    this._defaultAccountService = _defaultAccountService;
    this._configurationService = _configurationService;
    this._storageService = _storageService;
    this._shown = false;
    /**
     * Set once the initial default-account resolution has completed. Until then
     * {@link IDefaultAccountService.currentDefaultAccount} reads as `null` even for
     * a signed-in user, so the nudge stays suppressed to avoid flashing at a
     * signed-in user during the startup gap.
     */
    this._accountResolved = false;
    this._register(CommandsRegistry.registerCommand(MUTE_COMMAND_ID, () => {
      this._storageService.store(MUTED_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }));
    this._register(Event.any(
      this._defaultAccountService.onDidChangeDefaultAccount,
      this._sessionsManagementService.onDidChangeSessionTypes,
      Event.filter(this._configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(AgentHostAllowSignedOutWhenUsableSettingId), this._store),
      this._storageService.onDidChangeValue(StorageScope.APPLICATION, MUTED_STORAGE_KEY, this._store)
    )(() => this._update()));
    this._defaultAccountService.getDefaultAccount().then(() => {
      if (this._store.isDisposed) {
        return;
      }
      this._accountResolved = true;
      this._update();
    });
  }
  static {
    this.ID = "sessions.contrib.agentHostDiscoveredConfigNotification";
  }
  _update() {
    const authState = conditionalAuthState(this._accountResolved, this._defaultAccountService.currentDefaultAccount !== null);
    if (authState === ConditionalAuthState.Unresolved) {
      return;
    }
    const claudeTypes = this._sessionsManagementService.getAllProviderSessionTypes().filter((type) => (type.sessionType.chatSessionType ?? type.sessionType.id) === SessionType.AgentHostClaude).map((type) => type.sessionType);
    const claude = claudeTypes.find((type) => type.authRequirement === SessionTypeAuthRequirement.None) ?? claudeTypes[0];
    const show = shouldShowDiscoveredConfigNudge({
      signedIn: authState === ConditionalAuthState.SignedIn,
      allowSignedOutWhenUsable: isAllowSignedOutWhenUsableEnabled(this._configurationService),
      usableWithoutGitHub: claude?.authRequirement === SessionTypeAuthRequirement.None,
      muted: this._storageService.getBoolean(MUTED_STORAGE_KEY, StorageScope.APPLICATION, false)
    });
    if (!show) {
      if (this._shown) {
        this._chatInputNotificationService.deleteNotification(DISCOVERED_CONFIG_NOTIFICATION_ID);
        this._shown = false;
      }
      return;
    }
    if (this._shown || !claude) {
      return;
    }
    this._shown = true;
    this._chatInputNotificationService.setNotification({
      id: DISCOVERED_CONFIG_NOTIFICATION_ID,
      severity: ChatInputNotificationSeverity.Info,
      message: localize("agentHost.discoveredConfig.message", "We've discovered your existing {0} configuration.", claude.label),
      description: localize("agentHost.discoveredConfig.description", "If you intended to use a Copilot subscription, sign in to GitHub."),
      actions: [{
        kind: ChatInputNotificationActionKind.Command,
        label: localize("agentHost.discoveredConfig.signIn", "Sign in to GitHub"),
        commandId: SIGN_IN_COMMAND_ID
      }],
      dismissible: true,
      autoDismissOnMessage: true,
      mute: {
        commandId: MUTE_COMMAND_ID,
        tooltip: localize("agentHost.discoveredConfig.mute", "Don't Show Again")
      },
      sessionTypes: [SessionType.AgentHostClaude]
    });
  }
};
AgentHostDiscoveredConfigNotificationContribution = __decorateClass([
  __decorateParam(0, IChatInputNotificationService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, IDefaultAccountService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IStorageService)
], AgentHostDiscoveredConfigNotificationContribution);
export {
  AgentHostDiscoveredConfigNotificationContribution
};
