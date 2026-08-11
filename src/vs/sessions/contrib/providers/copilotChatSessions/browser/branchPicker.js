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
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { markOnboardingTarget } from "../../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
import { reportNewChatPickerClosed } from "../../../chat/browser/newChatPickerTelemetry.js";
import { BranchPicker as SharedBranchPicker } from "../../../chat/browser/branchPicker.js";
import { SessionIsolationPickerVisibleContext } from "../../../../common/contextkeys.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { CopilotChatSessionsProvider } from "./copilotChatSessionsProvider.js";
let BranchPicker = class extends Disposable {
  // Guards context key until DOM exists (#323361)
  constructor(_session, _configurationService, contextKeyService, sessionsProvidersService, telemetryService, instantiationService) {
    super();
    this._session = _session;
    this._configurationService = _configurationService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.telemetryService = telemetryService;
    this._hasGitRepo = false;
    this._rendered = false;
    this._visibleKey = SessionIsolationPickerVisibleContext.bindTo(contextKeyService);
    this._register(toDisposable(() => this._visibleKey.reset()));
    this._isolationOptionEnabled = this._configurationService.getValue("github.copilot.chat.cli.isolationOption.enabled") !== false;
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("github.copilot.chat.cli.isolationOption.enabled")) {
        this._isolationOptionEnabled = this._configurationService.getValue("github.copilot.chat.cli.isolationOption.enabled") !== false;
        if (!this._isolationOptionEnabled) {
          this._setModeOnSession("worktree");
        }
        this._update();
      }
    }));
    this._picker = this._register(instantiationService.createInstance(SharedBranchPicker, {
      user: "branchPicker",
      onSelectBranch: (branch) => {
        const session = this._getSession();
        const selectedBranch = session?.branch.get();
        reportNewChatPickerClosed(this.telemetryService, {
          id: "NewChatBranchPicker",
          name: "NewChatBranchPicker",
          optionIdBefore: selectedBranch,
          optionIdAfter: branch,
          optionLabelBefore: selectedBranch,
          optionLabelAfter: branch,
          isPII: true
        });
        session?.setBranch(branch);
      },
      isolation: {
        label: localize("isolationMode.worktree", "New Worktree"),
        ariaLabel: localize("isolationPicker.checkboxAriaLabel", "Worktree isolation"),
        onToggle: (checked) => this._applyIsolationToggle(checked),
        markTarget: (element) => markOnboardingTarget(element, "sessions.newSession.isolation")
      }
    }));
    this._register(autorun((reader) => {
      const session = this._session.read(reader);
      const provider = session ? this.sessionsProvidersService.getProvider(session.providerId) : void 0;
      const providerSession = provider instanceof CopilotChatSessionsProvider ? provider.getSession(session.sessionId) : void 0;
      if (providerSession) {
        const isLoading = session?.loading.read(reader);
        const gitRepo = providerSession.gitRepository;
        const repoState = gitRepo?.state?.read?.(reader);
        const hasHeadCommit = repoState ? !!repoState.HEAD?.commit : true;
        this._hasGitRepo = !isLoading && !!gitRepo && hasHeadCommit;
        providerSession.branches.read(reader);
        providerSession.branch.read(reader);
        providerSession.isolationMode.read(reader);
      } else {
        this._hasGitRepo = false;
      }
      this._update();
    }));
  }
  _getSession() {
    const session = this._session.get();
    if (!session) {
      return void 0;
    }
    const provider = this.sessionsProvidersService.getProvider(session.providerId);
    return provider instanceof CopilotChatSessionsProvider ? provider.getSession(session.sessionId) : void 0;
  }
  _getIsolationMode() {
    return this._getSession()?.isolationMode.get() ?? "worktree";
  }
  _setModeOnSession(mode) {
    this._getSession()?.setIsolationMode(mode);
  }
  _applyIsolationToggle(checked) {
    const before = this._getIsolationMode();
    const after = checked ? "worktree" : "workspace";
    reportNewChatPickerClosed(this.telemetryService, {
      id: "NewChatIsolationPicker",
      name: "NewChatIsolationPicker",
      optionIdBefore: before,
      optionIdAfter: after,
      optionLabelBefore: void 0,
      optionLabelAfter: void 0,
      isPII: false
    });
    this._setModeOnSession(after);
  }
  render(container) {
    this._rendered = true;
    this._picker.render(container);
    this._update();
  }
  showPicker() {
    this._picker.showPicker();
  }
  _update() {
    const session = this._getSession();
    const branches = session?.branches.get() ?? [];
    const selectedBranch = session?.branch.get();
    const isLoading = session?.loading.get() ?? false;
    const isWorkspace = session?.isolationMode.get() === "workspace";
    const isolationState = !this._isolationOptionEnabled ? "hidden" : this._hasGitRepo ? "enabled" : "disabled";
    this._picker.update({
      label: selectedBranch ?? localize("branchPicker.select", "Branch"),
      branches: branches.map((branch) => ({ name: branch, selected: branch === selectedBranch })),
      status: isLoading ? "loading" : branches.length > 0 ? "ready" : "empty",
      canOpen: !isLoading && !isWorkspace && branches.length > 0,
      isolation: {
        checked: this._getIsolationMode() === "worktree",
        state: isolationState,
        disabledReason: !this._hasGitRepo ? localize("isolationPicker.noGitRepo", "Git repository required for worktree isolation") : void 0
      }
    });
    this._visibleKey.set(this._rendered && this._hasGitRepo && this._isolationOptionEnabled);
  }
};
BranchPicker = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ISessionsProvidersService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IInstantiationService)
], BranchPicker);
export {
  BranchPicker
};
