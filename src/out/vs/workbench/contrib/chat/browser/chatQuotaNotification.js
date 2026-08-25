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
import { safeIntl } from "../../../../base/common/date.js";
import { createMarkdownCommandLink, MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { ChatEntitlement, IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { getSelectedModelIdentifier, getSelectedModelMetadata, isSelectedModelCopilot, SELECTED_MODEL_STORAGE_KEY_PREFIX, SELECTED_MODEL_STORAGE_SCOPE } from "../common/chatSelectedModel.js";
import { ILanguageModelsService, isAutoLanguageModel } from "../common/languageModels.js";
import { ChatInputNotificationActionKind, ChatInputNotificationSeverity, IChatInputNotificationService } from "./widget/input/chatInputNotificationService.js";
const QUOTA_NOTIFICATION_ID = "copilot.quotaStatus";
const THRESHOLDS = [50, 75, 90, 95];
const SWITCH_TO_AUTO_TREATMENT_NAME = "config.chatQuotaWarningSwitchToAuto";
const TRAJECTORY_NUDGE_SPEC = {
  treatmentName: "config.chatQuotaTrajectoryNudge",
  shownStorageKey: "chat.quotaTrajectory.shownPeriod",
  averageDailyUsageThreshold: 4.5,
  minimumPercentUsed: 10,
  maximumPercentUsed: 35,
  msPerDay: 24 * 60 * 60 * 1e3,
  learnMoreUrl: "https://aka.ms/token-usage-tips",
  learnMoreCommandId: "workbench.action.chat.learnMoreAboutCreditUsage"
};
const QUOTA_EXHAUSTED_DISMISSED_STORAGE_KEY = "chat.quotaNotification.exhaustedDismissed";
let ChatQuotaNotificationContribution = class extends Disposable {
  constructor(_chatEntitlementService, _chatInputNotificationService, _contextKeyService, _languageModelsService, _storageService, _assignmentService, _telemetryService, _logService) {
    super();
    this._chatEntitlementService = _chatEntitlementService;
    this._chatInputNotificationService = _chatInputNotificationService;
    this._contextKeyService = _contextKeyService;
    this._languageModelsService = _languageModelsService;
    this._storageService = _storageService;
    this._assignmentService = _assignmentService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    /** Tracks whether the current notification is the quota-exhausted variant. */
    this._showingExhausted = false;
    this._switchToAutoAssignmentRequested = false;
    this._trajectoryAssignmentRequested = false;
    this._register(this._chatEntitlementService.onDidChangeQuotaRemaining(() => this._update()));
    this._register(this._chatEntitlementService.onDidChangeQuotaExceeded(() => this._update()));
    this._register(this._chatEntitlementService.onDidChangeEntitlement(() => this._update()));
    this._register(this._languageModelsService.onDidChangeLanguageModels(() => this._refreshActiveQuotaApproachingWarning()));
    this._register(CommandsRegistry.registerCommand(TRAJECTORY_NUDGE_SPEC.learnMoreCommandId, (accessor) => this._handleCreditEfficiencyLearnMoreCommand(accessor)));
    const storageListener = this._register(new DisposableStore());
    this._register(this._storageService.onDidChangeValue(SELECTED_MODEL_STORAGE_SCOPE, void 0, storageListener)((e) => {
      if (e.key.startsWith(SELECTED_MODEL_STORAGE_KEY_PREFIX)) {
        this._refreshActiveQuotaApproachingWarning();
        this._update();
      }
    }));
    this._register(this._chatInputNotificationService.onDidDismiss((id) => {
      if (id === QUOTA_NOTIFICATION_ID && this._showingExhausted) {
        this._setExhaustedDismissed();
      }
    }));
    this._update();
  }
  static {
    this.ID = "workbench.contrib.chatQuotaNotification";
  }
  async _resolveSwitchToAutoTreatment() {
    const treatment = await this._assignmentService.getTreatment(SWITCH_TO_AUTO_TREATMENT_NAME);
    this._switchToAutoTreatment = treatment;
    if (treatment === true) {
      this._refreshActiveQuotaApproachingWarning();
    }
  }
  _requestSwitchToAutoTreatment() {
    if (!this._switchToAutoAssignmentRequested) {
      this._switchToAutoAssignmentRequested = true;
      void this._resolveSwitchToAutoTreatment().catch((error) => {
        this._logService.error(`Failed to resolve ${SWITCH_TO_AUTO_TREATMENT_NAME}`, error);
        this._switchToAutoAssignmentRequested = false;
      });
    }
  }
  /**
   * Reads the already-evaluated trajectory experiment cohort. The assignment
   * service resolves the cohort asynchronously, so this is requested only once
   * the user has met every non-experiment condition required for the nudge.
   *
   * Stores the raw treatment value. `undefined` means the user is not
   * assigned to the flight (or assignments are not available); only a `true`
   * treatment renders the nudge. We deliberately do not coerce a missing
   * assignment into a synthetic "control" value, since that would assume an
   * enrollment that may not exist. Enrollment telemetry is emitted only when
   * the user is actually assigned to a flight.
   */
  async _resolveTrajectoryTreatment(warning) {
    const treatment = await this._assignmentService.getTreatment(TRAJECTORY_NUDGE_SPEC.treatmentName);
    this._trajectoryTreatment = treatment;
    if (treatment !== void 0) {
      this._logQuotaTrajectoryNudgeEnrolled(treatment, warning);
    }
    if (treatment === true) {
      this._update();
    }
  }
  _requestTrajectoryTreatment(warning) {
    if (!this._trajectoryAssignmentRequested) {
      this._trajectoryAssignmentRequested = true;
      void this._resolveTrajectoryTreatment(warning).catch((error) => {
        this._logService.error(`Failed to resolve ${TRAJECTORY_NUDGE_SPEC.treatmentName}`, error);
        this._trajectoryAssignmentRequested = false;
      });
    }
  }
  _getRelevantSnapshot() {
    const quotas = this._chatEntitlementService.quotas;
    const entitlement = this._chatEntitlementService.entitlement;
    if (entitlement === ChatEntitlement.Unknown || entitlement === ChatEntitlement.Free) {
      return quotas.chat ?? quotas.premiumChat;
    }
    return quotas.premiumChat;
  }
  _isQuotaUsedUp() {
    const snapshot = this._getRelevantSnapshot();
    if (!snapshot) {
      return false;
    }
    if (snapshot.unlimited) {
      return snapshot.hasQuota === false;
    }
    return snapshot.percentRemaining <= 0;
  }
  _isUBBEligible() {
    return this._chatEntitlementService.quotas.usageBasedBilling === true;
  }
  _update() {
    const entitlement = this._chatEntitlementService.entitlement;
    const isCopilot = this._isCopilotModelSelected();
    if (this._isQuotaKnownAvailable()) {
      this._clearExhaustedDismissed();
    }
    if (!isCopilot) {
      return;
    }
    const isQuotaNotificationEligible = entitlement === ChatEntitlement.Unknown || this._isUBBEligible();
    if (this._isManagedPlan(entitlement) && this._isManagedPlanBlocked()) {
      if (!this._isExhaustedDismissed()) {
        this._showManagedPlanBlockedNotification();
      }
      return;
    }
    if (isQuotaNotificationEligible && this._isQuotaUsedUp()) {
      const quotas = this._chatEntitlementService.quotas;
      const additionalUsageEnabled = quotas.additionalUsageEnabled ?? false;
      const wasAdditionalUsageEnabled = this._prevAdditionalUsageEnabled;
      this._prevAdditionalUsageEnabled = additionalUsageEnabled;
      if (!this._isExhaustedDismissed()) {
        if (additionalUsageEnabled) {
          if (this._prevQuotaPercentUsed !== void 0 || wasAdditionalUsageEnabled === false) {
            this._showOverageActivationNotification();
          }
        } else {
          this._showExhaustedNotification();
        }
      }
      const exhaustedSnapshot = this._getRelevantSnapshot();
      if (exhaustedSnapshot && !exhaustedSnapshot.unlimited) {
        this._prevQuotaPercentUsed = 100 - exhaustedSnapshot.percentRemaining;
      }
      return;
    }
    if (isQuotaNotificationEligible) {
      const trajectoryWarning = this._computeQuotaTrajectoryWarning();
      if (trajectoryWarning) {
        this._showQuotaTrajectoryWarning(trajectoryWarning);
        return;
      }
      const quotaWarning = this._computeQuotaWarning();
      if (quotaWarning) {
        this._showQuotaApproachingWarning(quotaWarning);
        return;
      }
    }
    const rateLimitWarning = this._computeRateLimitWarning();
    if (rateLimitWarning) {
      this._showRateLimitWarning(rateLimitWarning);
      return;
    }
    if (this._showingExhausted && !this._isQuotaUsedUp()) {
      this._hideNotification();
    }
  }
  // --- Threshold crossing detection ----------------------------------------
  _computeQuotaWarning() {
    const snapshot = this._getRelevantSnapshot();
    if (!snapshot || snapshot.unlimited) {
      this._prevQuotaPercentUsed = void 0;
      return void 0;
    }
    const percentUsed = 100 - snapshot.percentRemaining;
    const crossed = this._findCrossedThreshold(percentUsed, this._prevQuotaPercentUsed);
    this._prevQuotaPercentUsed = percentUsed;
    if (crossed !== void 0) {
      return { percentUsed: Math.floor(percentUsed), threshold: crossed };
    }
    return void 0;
  }
  _computeQuotaTrajectoryWarning() {
    if (this._isTrajectoryShownInCurrentPeriod()) {
      return void 0;
    }
    const snapshot = this._getRelevantSnapshot();
    if (!snapshot || snapshot.unlimited || snapshot.percentRemaining <= 0) {
      return void 0;
    }
    const resetDate = this._chatEntitlementService.quotas.resetDate;
    if (!resetDate) {
      return void 0;
    }
    const reset = new Date(resetDate);
    const resetTime = reset.getTime();
    if (!Number.isFinite(resetTime)) {
      return void 0;
    }
    const periodStart = new Date(resetTime);
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
    const periodStartTime = periodStart.getTime();
    const elapsedDays = (Date.now() - periodStartTime) / TRAJECTORY_NUDGE_SPEC.msPerDay;
    if (elapsedDays < 0) {
      return void 0;
    }
    const percentUsed = 100 - snapshot.percentRemaining;
    if (percentUsed < TRAJECTORY_NUDGE_SPEC.minimumPercentUsed || percentUsed > TRAJECTORY_NUDGE_SPEC.maximumPercentUsed) {
      return void 0;
    }
    const averageDailyUsage = percentUsed / Math.max(1, elapsedDays);
    if (averageDailyUsage < TRAJECTORY_NUDGE_SPEC.averageDailyUsageThreshold) {
      return void 0;
    }
    this._requestTrajectoryTreatment({ averageDailyUsage, percentUsed });
    return this._trajectoryTreatment === true ? { averageDailyUsage, percentUsed } : void 0;
  }
  _showQuotaTrajectoryWarning(warning) {
    this._showingExhausted = false;
    this._storeTrajectoryShown();
    const learnMoreLink = createMarkdownCommandLink({
      text: localize("quota.trajectory.learnMoreStandalone", "Learn about optimizing usage"),
      id: TRAJECTORY_NUDGE_SPEC.learnMoreCommandId,
      tooltip: localize("quota.trajectory.learnMoreTooltip", "Learn about optimizing usage")
    });
    const message = localize({ key: "quota.trajectory.message", comment: ['{Locked="["}', '{Locked="]({0})"}'] }, "You're likely to exhaust your AI credits before your billing period. {0}.", learnMoreLink);
    this._setNotification({
      id: QUOTA_NOTIFICATION_ID,
      telemetryId: "quotaTrajectoryNudge",
      severity: ChatInputNotificationSeverity.Info,
      message: new MarkdownString(message, { isTrusted: { enabledCommands: [TRAJECTORY_NUDGE_SPEC.learnMoreCommandId] } }),
      description: void 0,
      actions: [],
      dismissible: true,
      autoDismissOnMessage: false
    });
  }
  async _handleCreditEfficiencyLearnMoreCommand(accessor) {
    this._telemetryService.publicLog2("chatQuotaTrajectoryNudgeLinkClicked");
    queueMicrotask(() => this._hideNotification());
    await accessor.get(IOpenerService).open(URI.parse(TRAJECTORY_NUDGE_SPEC.learnMoreUrl));
  }
  _logQuotaTrajectoryNudgeEnrolled(treatment, warning) {
    this._telemetryService.publicLog2("chatQuotaTrajectoryNudgeEnrolled", {
      treatment,
      entitlement: ChatEntitlement[this._chatEntitlementService.entitlement],
      averageDailyUsage: Math.round(warning.averageDailyUsage * 100) / 100,
      percentUsed: Math.round(warning.percentUsed * 100) / 100
    });
  }
  /**
   * Returns the highest threshold that was newly crossed, or `undefined`.
   */
  _findCrossedThreshold(current, previous) {
    if (previous === void 0) {
      return void 0;
    }
    for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
      const threshold = THRESHOLDS[i];
      if (previous < threshold && current >= threshold) {
        return threshold;
      }
    }
    return void 0;
  }
  // --- Quota exhausted ---------------------------------------------------
  _showExhaustedNotification() {
    this._showingExhausted = true;
    const entitlement = this._chatEntitlementService.entitlement;
    const quotas = this._chatEntitlementService.quotas;
    const hadOverage = (quotas.additionalUsageCount ?? 0) > 0;
    let description;
    let actions;
    if (entitlement === ChatEntitlement.Unknown) {
      description = localize("quota.exhausted.anonymous", "Sign in to keep going.");
      actions = [{ kind: ChatInputNotificationActionKind.Command, label: localize("signIn", "Sign In"), commandId: "workbench.action.chat.triggerSetup" }];
    } else if (entitlement === ChatEntitlement.Free) {
      description = localize("quota.exhausted.free", "Upgrade to keep going.");
      actions = [{ kind: ChatInputNotificationActionKind.Command, label: localize("upgrade", "Upgrade"), commandId: "workbench.action.chat.upgradePlan" }];
    } else if (this._isManagedPlan(entitlement)) {
      description = localize("quota.exhausted.managed", "Contact your admin to increase your limits.");
      actions = [];
    } else if (hadOverage) {
      description = localize("quota.exhausted.hadOverage", "Increase your budget to keep building.");
      actions = [{ kind: ChatInputNotificationActionKind.Command, label: localize("manageBudget", "Manage Budget"), commandId: "workbench.action.chat.manageAdditionalSpend" }];
    } else {
      description = localize("quota.exhausted.default", "Manage your budget to keep building.");
      actions = [{ kind: ChatInputNotificationActionKind.Command, label: localize("manageBudget2", "Manage Budget"), commandId: "workbench.action.chat.manageAdditionalSpend" }];
    }
    this._setNotification({
      id: QUOTA_NOTIFICATION_ID,
      telemetryId: "quotaExhausted",
      severity: ChatInputNotificationSeverity.Info,
      message: localize("quota.exhausted.title", "Credit Limit Reached"),
      description,
      actions,
      dismissible: true,
      autoDismissOnMessage: true
    });
  }
  // --- Overage notification -----------------------------------------------
  _showOverageActivationNotification() {
    this._showingExhausted = true;
    this._setNotification({
      id: QUOTA_NOTIFICATION_ID,
      telemetryId: "overageActivation",
      severity: ChatInputNotificationSeverity.Info,
      message: localize("quota.overage.title", "Credit Limit Reached"),
      description: localize("quota.overage.desc", "Additional budget is now covering extra usage."),
      actions: [],
      dismissible: true,
      autoDismissOnMessage: true
    });
  }
  // --- Quota approaching --------------------------------------------------
  _showQuotaApproachingWarning(warning) {
    this._showingExhausted = false;
    this._activeQuotaWarning = warning;
    const entitlement = this._chatEntitlementService.entitlement;
    const quotas = this._chatEntitlementService.quotas;
    let description;
    let actions;
    if (entitlement === ChatEntitlement.Unknown || entitlement === ChatEntitlement.Free) {
      description = localize("quota.approaching.free", "Upgrade to continue past the limit.");
      actions = [{ kind: ChatInputNotificationActionKind.Command, label: localize("upgrade2", "Upgrade"), commandId: "workbench.action.chat.upgradePlan" }];
    } else if (this._isManagedPlan(entitlement)) {
      description = localize("quota.approaching.managed", "Contact your admin to increase your limits.");
      actions = [];
    } else if (quotas.additionalUsageEnabled) {
      description = localize("quota.approaching.overageEnabled", "Additional budget is enabled to cover extra usage.");
      actions = [];
    } else {
      const autoModelIdentifier = this._getAutoModelIdentifier();
      const canSwitchToAuto = !!autoModelIdentifier && !this._isAutoModelSelected(autoModelIdentifier);
      if (canSwitchToAuto) {
        this._requestSwitchToAutoTreatment();
      }
      if (this._switchToAutoTreatment === true && canSwitchToAuto) {
        description = localize("quota.approaching.switchToAuto", "Switch to Auto to reduce credit usage.");
        actions = [{ kind: ChatInputNotificationActionKind.SwitchToModel, label: localize("switchToAuto", "Switch to Auto"), modelIdentifier: autoModelIdentifier }];
      } else {
        description = localize("quota.approaching.default", "Set additional budget to cover extra usage.");
        actions = [{ kind: ChatInputNotificationActionKind.Command, label: localize("manageBudget3", "Manage Budget"), commandId: "workbench.action.chat.manageAdditionalSpend" }];
      }
    }
    this._setNotification({
      id: QUOTA_NOTIFICATION_ID,
      telemetryId: `quotaApproaching${warning.threshold}`,
      severity: ChatInputNotificationSeverity.Info,
      message: localize("quota.approaching.title", "Credits at {0}%", warning.percentUsed),
      description,
      actions,
      dismissible: true,
      autoDismissOnMessage: true
    });
  }
  // --- Rate-limit warning -------------------------------------------------
  _computeRateLimitWarning() {
    const quotas = this._chatEntitlementService.quotas;
    const sessionResult = this._checkRateLimitCrossing(quotas.sessionRateLimit, this._prevSessionPercentUsed);
    this._prevSessionPercentUsed = sessionResult.newPrev;
    const weeklyResult = this._checkRateLimitCrossing(quotas.weeklyRateLimit, this._prevWeeklyPercentUsed);
    this._prevWeeklyPercentUsed = weeklyResult.newPrev;
    if (sessionResult.warning) {
      return { ...sessionResult.warning, type: "session" };
    }
    if (weeklyResult.warning) {
      return { ...weeklyResult.warning, type: "weekly" };
    }
    return void 0;
  }
  _checkRateLimitCrossing(snapshot, prevPercentUsed) {
    if (!snapshot || snapshot.unlimited) {
      return { newPrev: void 0 };
    }
    const percentUsed = 100 - snapshot.percentRemaining;
    const crossed = this._findCrossedThreshold(percentUsed, prevPercentUsed);
    return {
      newPrev: percentUsed,
      warning: crossed !== void 0 ? { percentUsed: Math.floor(percentUsed), resetDate: snapshot.resetDate } : void 0
    };
  }
  _showRateLimitWarning(warning) {
    this._showingExhausted = false;
    const message = warning.type === "session" ? localize("rateLimit.session", "You've used {0}% of your session rate limit.", warning.percentUsed) : localize("rateLimit.weekly", "You've used {0}% of your weekly rate limit.", warning.percentUsed);
    const description = warning.resetDate ? localize("rateLimit.resets", "Resets on {0}.", this._formatResetDate(warning.resetDate)) : void 0;
    this._setNotification({
      id: QUOTA_NOTIFICATION_ID,
      telemetryId: warning.type === "session" ? "sessionRateLimitWarning" : "weeklyRateLimitWarning",
      severity: ChatInputNotificationSeverity.Info,
      message,
      description,
      actions: [],
      dismissible: true,
      autoDismissOnMessage: true
    });
  }
  // --- Helpers ------------------------------------------------------------
  /**
   * Returns `true` only when a Copilot model is actively selected.
   * Returns `false` if no model is selected yet (widget not initialized)
   * or if the selected model is from a non-Copilot vendor (BYOK).
   */
  _isCopilotModelSelected() {
    return isSelectedModelCopilot(this._contextKeyService, this._storageService, this._languageModelsService);
  }
  _getAutoModelIdentifier() {
    for (const identifier of this._languageModelsService.getLanguageModelIds()) {
      const metadata = this._languageModelsService.lookupLanguageModel(identifier);
      if (metadata && isAutoLanguageModel({ identifier, metadata })) {
        return identifier;
      }
    }
    return void 0;
  }
  _isAutoModelSelected(autoModelIdentifier) {
    const identifier = getSelectedModelIdentifier(this._contextKeyService, this._storageService);
    const autoModel = this._languageModelsService.lookupLanguageModel(autoModelIdentifier);
    if (identifier === autoModelIdentifier || identifier === autoModel?.id) {
      return true;
    }
    const metadata = getSelectedModelMetadata(this._contextKeyService, this._storageService, this._languageModelsService);
    return !!metadata && isAutoLanguageModel({ identifier: identifier ?? "", metadata });
  }
  _refreshActiveQuotaApproachingWarning() {
    const warning = this._activeQuotaWarning;
    if (!warning || !this._isCopilotModelSelected()) {
      return;
    }
    const notification = this._chatInputNotificationService.getActiveNotification((candidate) => candidate.id === QUOTA_NOTIFICATION_ID);
    if (notification?.telemetryId === `quotaApproaching${warning.threshold}`) {
      this._showQuotaApproachingWarning(warning);
    }
  }
  _isManagedPlan(entitlement) {
    return entitlement === ChatEntitlement.Business || entitlement === ChatEntitlement.Enterprise;
  }
  _isManagedPlanBlocked() {
    const snapshot = this._chatEntitlementService.quotas.premiumChat;
    return !!snapshot && snapshot.hasQuota === false;
  }
  _showManagedPlanBlockedNotification() {
    this._showingExhausted = true;
    this._setNotification({
      id: QUOTA_NOTIFICATION_ID,
      telemetryId: "managedPlanBlocked",
      severity: ChatInputNotificationSeverity.Info,
      message: localize("quota.blocked.managed.title", "Usage Blocked"),
      description: localize("quota.blocked.managed", "Your organization or enterprise has exceeded its Copilot budget. Contact your admin to resume usage."),
      actions: [],
      dismissible: true,
      autoDismissOnMessage: true
    });
  }
  _formatResetDate(isoDate) {
    const resetDate = new Date(isoDate);
    const now = /* @__PURE__ */ new Date();
    const includeYear = resetDate.getFullYear() !== now.getFullYear();
    return safeIntl.DateTimeFormat(
      void 0,
      includeYear ? { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" } : { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }
    ).value.format(resetDate);
  }
  _getTrajectoryPeriodKey() {
    const resetDate = this._chatEntitlementService.quotas.resetDate;
    if (!resetDate) {
      return void 0;
    }
    const date = new Date(resetDate);
    if (!Number.isFinite(date.getTime())) {
      return void 0;
    }
    return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
  }
  _isTrajectoryShownInCurrentPeriod() {
    const periodKey = this._getTrajectoryPeriodKey();
    return !!periodKey && this._storageService.get(TRAJECTORY_NUDGE_SPEC.shownStorageKey, StorageScope.APPLICATION) === periodKey;
  }
  _storeTrajectoryShown() {
    const periodKey = this._getTrajectoryPeriodKey();
    if (periodKey) {
      this._storageService.store(TRAJECTORY_NUDGE_SPEC.shownStorageKey, periodKey, StorageScope.APPLICATION, StorageTarget.USER);
    }
  }
  _setNotification(notification) {
    this._chatInputNotificationService.setNotification(notification);
  }
  _hideNotification() {
    this._showingExhausted = false;
    this._chatInputNotificationService.deleteNotification(QUOTA_NOTIFICATION_ID);
  }
  // --- Exhausted dismissal persistence ------------------------------------
  /**
   * Returns `true` only when there is an actual quota snapshot indicating that
   * credit is available (i.e. quota is not used up). Returns `false` when no
   * snapshot has loaded yet, so the transient "no data" state at startup/reload
   * is not mistaken for recovery.
   */
  _isQuotaKnownAvailable() {
    return !!this._getRelevantSnapshot() && !this._isQuotaUsedUp();
  }
  _isExhaustedDismissed() {
    return this._storageService.getBoolean(QUOTA_EXHAUSTED_DISMISSED_STORAGE_KEY, StorageScope.APPLICATION, false);
  }
  _setExhaustedDismissed() {
    this._storageService.store(QUOTA_EXHAUSTED_DISMISSED_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  _clearExhaustedDismissed() {
    this._storageService.remove(QUOTA_EXHAUSTED_DISMISSED_STORAGE_KEY, StorageScope.APPLICATION);
  }
};
ChatQuotaNotificationContribution = __decorateClass([
  __decorateParam(0, IChatEntitlementService),
  __decorateParam(1, IChatInputNotificationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ILanguageModelsService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchAssignmentService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, ILogService)
], ChatQuotaNotificationContribution);
export {
  ChatQuotaNotificationContribution
};
