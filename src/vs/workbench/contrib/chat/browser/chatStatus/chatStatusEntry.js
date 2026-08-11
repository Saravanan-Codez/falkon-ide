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
import "./media/chatStatus.css";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IStatusbarService, ShowTooltipCommand, StatusbarAlignment } from "../../../../services/statusbar/browser/statusbar.js";
import { ChatEntitlement, ChatEntitlementContextKeys, IChatEntitlementService, isProUser } from "../../../../services/chat/common/chatEntitlementService.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { disposableLongTimeout, disposableTimeout } from "../../../../../base/common/async.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { IInlineCompletionsService } from "../../../../../editor/browser/services/inlineCompletionsService.js";
import { ChatStatusDashboard } from "./chatStatusDashboard.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { $ as h, disposableWindowInterval } from "../../../../../base/browser/dom.js";
import { isNewUser } from "./chatStatus.js";
import product from "../../../../../platform/product/common/product.js";
import { isCompletionsEnabled } from "../../../../../editor/common/services/completionsEnablement.js";
import { CHAT_SETUP_ACTION_ID } from "../actions/chatActions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { InEditorZenModeContext } from "../../../../common/contextkeys.js";
import { ChatConfiguration } from "../../common/constants.js";
function isTrackedEntitlement(entitlement) {
  switch (entitlement) {
    case ChatEntitlement.Free:
    case ChatEntitlement.EDU:
    case ChatEntitlement.Pro:
    case ChatEntitlement.ProPlus:
    case ChatEntitlement.Business:
    case ChatEntitlement.Enterprise:
      return true;
    default:
      return false;
  }
}
function isQuotaBlocked(quotas) {
  const premiumChat = quotas.premiumChat;
  if (premiumChat === void 0) {
    return false;
  }
  return premiumChat.unlimited ? premiumChat.hasQuota === false : premiumChat.percentRemaining === 0;
}
function hasResolvedQuota(quotas) {
  return quotas.premiumChat !== void 0;
}
function computeQuotaResumeState(previous, entitlement, quotas) {
  if (!isTrackedEntitlement(entitlement)) {
    return "none";
  }
  const additionalSpend = quotas.additionalUsageEnabled === true;
  if (!additionalSpend && isQuotaBlocked(quotas)) {
    return "blocked";
  }
  if (previous !== "blocked") {
    return previous;
  }
  if (additionalSpend) {
    return "none";
  }
  return hasResolvedQuota(quotas) ? "resumed" : "blocked";
}
let ChatStatusBarEntry = class extends Disposable {
  constructor(chatEntitlementService, instantiationService, statusbarService, editorService, configurationService, completionsService, contextKeyService, storageService) {
    super();
    this.chatEntitlementService = chatEntitlementService;
    this.instantiationService = instantiationService;
    this.statusbarService = statusbarService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.completionsService = completionsService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    // re-check 5 min after a passed reset time
    this.entry = void 0;
    this.activeCodeEditorListener = this._register(new MutableDisposable());
    this.entryAnchor = h("span");
    this.quotaResetTimer = this._register(new MutableDisposable());
    this.quotaRefresh = this._register(new MutableDisposable());
    this.clearResumedScheduler = this._register(new MutableDisposable());
    this.quotaResumeState = this.readPersistedQuotaResumeState();
    this.dashboardTooltip = {
      element: (token) => {
        this.onDashboardOpened();
        const store = new DisposableStore();
        store.add(token.onCancellationRequested(() => {
          store.dispose();
        }));
        const elem = ChatStatusDashboard.instantiateInContents(this.instantiationService, store, void 0);
        store.add(disposableWindowInterval(mainWindow, () => {
          if (!elem.isConnected) {
            store.dispose();
          }
        }, 2e3));
        return elem;
      }
    };
    this.update();
    this.registerListeners();
    this.initializeQuotaResumeState();
  }
  static {
    this.ID = "workbench.contrib.chatStatusBarEntry";
  }
  static {
    this.TITLE_BAR_CONTEXT_KEYS = /* @__PURE__ */ new Set([InEditorZenModeContext.key, ChatEntitlementContextKeys.hasByokModels.key]);
  }
  static {
    this.QUOTA_RESUME_STATE_KEY = "chat.quotaResumeState";
  }
  static {
    this.QUOTA_RESET_RETRY_DELAY = 5 * 60 * 1e3;
  }
  update() {
    const sentiment = this.chatEntitlementService.sentiment;
    if (!sentiment.hidden) {
      const props = this.getEntryProps();
      if (this.entry) {
        this.entry.update(props);
      } else {
        this.entry = this.statusbarService.addEntry(props, "chat.statusBarEntry", StatusbarAlignment.RIGHT, { location: { id: "status.editor.mode", priority: 100.1 }, alignment: StatusbarAlignment.RIGHT });
      }
    } else {
      this.entry?.dispose();
      this.entry = void 0;
    }
  }
  registerListeners() {
    this._register(this.chatEntitlementService.onDidChangeQuotaExceeded(() => this.onQuotaChanged()));
    this._register(this.chatEntitlementService.onDidChangeQuotaRemaining(() => this.onQuotaChanged()));
    this._register(this.chatEntitlementService.onDidChangeSentiment(() => this.update()));
    this._register(this.chatEntitlementService.onDidChangeEntitlement(() => this.onQuotaChanged()));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(ChatStatusBarEntry.TITLE_BAR_CONTEXT_KEYS)) {
        this.update();
      }
    }));
    this._register(this.completionsService.onDidChangeIsSnoozing(() => this.update()));
    this._register(this.editorService.onDidActiveEditorChange(() => this.onDidActiveEditorChange()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(product.defaultChatAgent?.completionsEnablementSetting) || e.affectsConfiguration(ChatConfiguration.TitleBarSignInEnabled)) {
        this.update();
      }
    }));
  }
  onDidActiveEditorChange() {
    this.update();
    this.activeCodeEditorListener.clear();
    const activeCodeEditor = getCodeEditor(this.editorService.activeTextEditorControl);
    if (activeCodeEditor) {
      this.activeCodeEditorListener.value = activeCodeEditor.onDidChangeModelLanguage(() => {
        this.update();
      });
    }
  }
  //#region --- Quota Resume Tracking
  onQuotaChanged() {
    this.evaluateQuotaResumeState();
    this.update();
  }
  evaluateQuotaResumeState() {
    const next = computeQuotaResumeState(this.quotaResumeState, this.chatEntitlementService.entitlement, this.chatEntitlementService.quotas);
    this.setQuotaResumeState(next);
    if (next === "blocked") {
      this.scheduleQuotaResetRefresh();
    } else {
      this.quotaResetTimer.clear();
    }
  }
  getQuotaResetTime() {
    const quotas = this.chatEntitlementService.quotas;
    const premiumResetAt = quotas.premiumChat?.resetAt;
    if (typeof premiumResetAt === "number") {
      return premiumResetAt * 1e3;
    }
    if (quotas.resetDate) {
      const parsed = Date.parse(quotas.resetDate);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return void 0;
  }
  scheduleQuotaResetRefresh() {
    const resetAt = this.getQuotaResetTime();
    if (resetAt === void 0) {
      this.quotaResetTimer.clear();
      return;
    }
    const delay = resetAt > Date.now() ? resetAt - Date.now() : ChatStatusBarEntry.QUOTA_RESET_RETRY_DELAY;
    this.quotaResetTimer.value = disposableLongTimeout(() => this.refreshQuotaAndEvaluate(), delay);
  }
  refreshQuotaAndEvaluate() {
    const cts = new CancellationTokenSource();
    this.quotaRefresh.value = toDisposable(() => cts.dispose(true));
    (async () => {
      try {
        await this.chatEntitlementService.update(cts.token);
      } catch {
      }
      if (cts.token.isCancellationRequested) {
        return;
      }
      this.evaluateQuotaResumeState();
      this.update();
    })();
  }
  initializeQuotaResumeState() {
    if (this.quotaResumeState === "blocked") {
      this.refreshQuotaAndEvaluate();
    } else {
      this.evaluateQuotaResumeState();
    }
  }
  readPersistedQuotaResumeState() {
    const stored = this.storageService.get(ChatStatusBarEntry.QUOTA_RESUME_STATE_KEY, StorageScope.PROFILE);
    return stored === "blocked" || stored === "resumed" ? stored : "none";
  }
  setQuotaResumeState(state) {
    if (this.quotaResumeState === state) {
      return;
    }
    this.quotaResumeState = state;
    if (state === "none") {
      this.storageService.remove(ChatStatusBarEntry.QUOTA_RESUME_STATE_KEY, StorageScope.PROFILE);
    } else {
      this.storageService.store(ChatStatusBarEntry.QUOTA_RESUME_STATE_KEY, state, StorageScope.PROFILE, StorageTarget.MACHINE);
    }
  }
  onDashboardOpened() {
    if (this.quotaResumeState !== "resumed") {
      return;
    }
    this.clearResumedScheduler.value = disposableTimeout(() => {
      this.setQuotaResumeState("none");
      this.update();
    }, 0);
  }
  //#endregion
  getEntryProps() {
    let text = "$(copilot)";
    let ariaLabel = localize("chatStatusAria", "Copilot status");
    let kind;
    if (isNewUser(this.chatEntitlementService)) {
      const entitlement = this.chatEntitlementService.entitlement;
      if (this.chatEntitlementService.sentiment.later || // user skipped setup
      entitlement === ChatEntitlement.Available || // user is entitled
      isProUser(entitlement) || // user is already pro
      entitlement === ChatEntitlement.Free) {
        return this.getSetupEntryProps();
      }
    } else {
      const quotas = this.chatEntitlementService.quotas;
      if (this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted) {
        text = "$(copilot-unavailable)";
        ariaLabel = localize("copilotDisabledStatus", "Copilot disabled");
      } else if (this.chatEntitlementService.entitlement === ChatEntitlement.Unknown) {
        return this.getSetupEntryProps();
      } else if (isTrackedEntitlement(this.chatEntitlementService.entitlement) && isQuotaBlocked(quotas)) {
        const quotaWarning = localize("chatQuotaExceededStatus", "Quota reached");
        text = `$(copilot-warning) ${quotaWarning}`;
        ariaLabel = quotaWarning;
        kind = "prominent";
      } else if (this.quotaResumeState === "resumed") {
        const resumedLabel = localize("chatResumedStatus", "Copilot Resumed");
        text = `$(copilot) ${resumedLabel}`;
        ariaLabel = resumedLabel;
        kind = "prominent";
      } else if (this.editorService.activeTextEditorLanguageId && !isCompletionsEnabled(this.configurationService, this.editorService.activeTextEditorLanguageId)) {
        text = "$(copilot-unavailable)";
        ariaLabel = localize("completionsDisabledStatus", "Inline suggestions disabled");
      } else if (this.completionsService.isSnoozing()) {
        text = "$(copilot-snooze)";
        ariaLabel = localize("completionsSnoozedStatus", "Inline suggestions snoozed");
      }
    }
    const baseResult = {
      name: localize("chatStatus", "Copilot Status"),
      text,
      ariaLabel,
      command: ShowTooltipCommand,
      showInAllWindows: true,
      kind,
      content: this.entryAnchor,
      tooltip: this.dashboardTooltip
    };
    return baseResult;
  }
  getSetupEntryProps() {
    const showSignInLabel = !this.isSignInTitleBarAffordanceVisible();
    const signInLabel = localize("signIn", "Sign In");
    return {
      name: localize("chatStatus", "Copilot Status"),
      text: showSignInLabel ? `$(copilot) ${signInLabel}` : "$(copilot)",
      ariaLabel: showSignInLabel ? signInLabel : localize("chatStatusAria", "Copilot status"),
      command: CHAT_SETUP_ACTION_ID,
      showInAllWindows: true,
      kind: void 0,
      content: this.entryAnchor
    };
  }
  isSignInTitleBarAffordanceVisible() {
    if (isWeb) {
      return false;
    }
    if (this.chatEntitlementService.entitlement !== ChatEntitlement.Unknown) {
      return false;
    }
    if (this.chatEntitlementService.sentiment.hidden || this.chatEntitlementService.sentiment.disabledInWorkspace) {
      return false;
    }
    const inZenMode = Boolean(this.contextKeyService.getContextKeyValue(InEditorZenModeContext.key));
    if (inZenMode) {
      return false;
    }
    const signInTitleBarEnabled = this.configurationService.getValue(ChatConfiguration.TitleBarSignInEnabled) !== false;
    return signInTitleBarEnabled;
  }
  dispose() {
    super.dispose();
    this.entry?.dispose();
    this.entry = void 0;
  }
};
ChatStatusBarEntry = __decorateClass([
  __decorateParam(0, IChatEntitlementService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IStatusbarService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInlineCompletionsService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IStorageService)
], ChatStatusBarEntry);
export {
  ChatStatusBarEntry,
  computeQuotaResumeState
};
