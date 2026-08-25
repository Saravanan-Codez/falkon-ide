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
import { DeferredPromise, disposableTimeout, raceTimeout } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { CancellationError } from "../../../../../base/common/errors.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { hasKey, isNumber, isObject, isString } from "../../../../../base/common/types.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { AiAgentEnvValue, AiAgentEnvVar } from "../../../../../platform/chat/common/aiAgentEnv.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { PromptInputState } from "../../../../../platform/terminal/common/capabilities/commandDetection/promptInputModel.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { getShellIntegrationTimeout } from "../../../terminal/common/terminalEnvironment.js";
import { TerminalChatAgentToolsSettingId } from "../common/terminalChatAgentToolsConfiguration.js";
import { isBash, isFish, isPowerShell, isZsh } from "./runInTerminalHelpers.js";
var ShellLaunchType = /* @__PURE__ */ ((ShellLaunchType2) => {
  ShellLaunchType2[ShellLaunchType2["Unknown"] = 0] = "Unknown";
  ShellLaunchType2[ShellLaunchType2["Default"] = 1] = "Default";
  ShellLaunchType2[ShellLaunchType2["Fallback"] = 2] = "Fallback";
  return ShellLaunchType2;
})(ShellLaunchType || {});
var ShellIntegrationQuality = /* @__PURE__ */ ((ShellIntegrationQuality2) => {
  ShellIntegrationQuality2["None"] = "none";
  ShellIntegrationQuality2["Basic"] = "basic";
  ShellIntegrationQuality2["Rich"] = "rich";
  return ShellIntegrationQuality2;
})(ShellIntegrationQuality || {});
let ToolTerminalCreator = class {
  constructor(_accessibilityService, _configurationService, _logService, _terminalService) {
    this._accessibilityService = _accessibilityService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._terminalService = _terminalService;
  }
  static {
    /**
     * The shell preference cached for the lifetime of the window. This allows skipping previous
     * shell approaches that failed in previous runs to save time.
     */
    this._lastSuccessfulShell = 0 /* Unknown */;
  }
  async createTerminal(shellOrProfile, os, token) {
    const instance = await this._createCopilotTerminal(shellOrProfile, os);
    const toolTerminal = {
      instance,
      shellIntegrationQuality: "none" /* None */
    };
    let processReadyTimestamp = 0;
    const initResult = await Promise.any([
      instance.processReady.then(() => processReadyTimestamp = Date.now()),
      Event.toPromise(instance.onExit)
    ]);
    if (!isNumber(initResult) && isObject(initResult) && hasKey(initResult, { message: true })) {
      throw new Error(initResult.message);
    }
    const siInjectionEnabled = this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled) === true;
    const waitTime = getShellIntegrationTimeout(
      this._configurationService,
      siInjectionEnabled,
      instance.hasRemoteAuthority,
      processReadyTimestamp
    );
    if (ToolTerminalCreator._lastSuccessfulShell !== 2 /* Fallback */ || siInjectionEnabled) {
      this._logService.info(`ToolTerminalCreator#createTerminal: Waiting ${waitTime}ms for shell integration`);
      const shellIntegrationQuality = await this._waitForShellIntegration(instance, waitTime);
      if (token.isCancellationRequested) {
        instance.dispose();
        throw new CancellationError();
      }
      if (shellIntegrationQuality === "rich" /* Rich */) {
        const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
        if (commandDetection?.promptInputModel.state === PromptInputState.Unknown) {
          this._logService.info(`ToolTerminalCreator#createTerminal: Waiting up to 2s for PromptInputModel state to change`);
          const didStart = await raceTimeout(Event.toPromise(commandDetection.onCommandStarted), 2e3);
          if (!didStart) {
            this._logService.info(`ToolTerminalCreator#createTerminal: PromptInputModel state did not change within timeout`);
          }
        }
      }
      if (shellIntegrationQuality !== "none" /* None */) {
        ToolTerminalCreator._lastSuccessfulShell = 1 /* Default */;
        toolTerminal.shellIntegrationQuality = shellIntegrationQuality;
        return toolTerminal;
      }
    } else {
      this._logService.info(`ToolTerminalCreator#createTerminal: Skipping wait for shell integration - last successful launch type ${ToolTerminalCreator._lastSuccessfulShell}`);
    }
    ToolTerminalCreator._lastSuccessfulShell = 2 /* Fallback */;
    return toolTerminal;
  }
  /**
   * Synchronously update shell integration quality based on the terminal instance's current
   * capabilities. This is a defensive change to avoid no shell integration being sticky
   * https://github.com/microsoft/vscode/issues/260880
   *
   * Only upgrade quality just in case.
   */
  refreshShellIntegrationQuality(toolTerminal) {
    const commandDetection = toolTerminal.instance.capabilities.get(TerminalCapability.CommandDetection);
    if (commandDetection) {
      if (toolTerminal.shellIntegrationQuality === "none" /* None */ || toolTerminal.shellIntegrationQuality === "basic" /* Basic */) {
        toolTerminal.shellIntegrationQuality = commandDetection.hasRichCommandDetection ? "rich" /* Rich */ : "basic" /* Basic */;
      }
    }
  }
  _createCopilotTerminal(shellOrProfile, os) {
    const shellPath = isString(shellOrProfile) ? shellOrProfile : shellOrProfile.path;
    const env = {
      // Let CLI tools detect that they are running inside an AI agent.
      // This allows programs to adapt their output (e.g. JSON instead of
      // ANSI, disable interactive prompts, skip animations).
      // See https://github.com/microsoft/vscode/issues/311734
      // `AI_AGENT` is the cross-vendor standard; `COPILOT_AGENT` is kept
      // for back-compat with CLIs that already adopted it.
      [AiAgentEnvVar]: AiAgentEnvValue,
      COPILOT_AGENT: "1",
      // Avoid making `git diff` interactive when called from copilot
      GIT_PAGER: "cat",
      // Prevent git from opening an editor for merge commits
      GIT_MERGE_AUTOEDIT: "no",
      // Prevent git from opening an editor (e.g. for commit --amend, rebase -i).
      // `:` is a POSIX shell built-in no-op (returns 0), works cross-platform
      // since git always invokes the editor via `sh -c`.
      GIT_EDITOR: ":",
      // Prevent apt/dpkg from opening interactive prompts (e.g. needrestart
      // "Which services should be restarted?" dialogs). The agent cannot
      // drive TUI prompts, so non-interactive mode picks safe defaults.
      DEBIAN_FRONTEND: "noninteractive"
    };
    const preventShellHistory = this._configurationService.getValue(TerminalChatAgentToolsSettingId.PreventShellHistory) === true;
    if (preventShellHistory) {
      if (isBash(shellPath, os) || isZsh(shellPath, os) || isFish(shellPath, os) || isPowerShell(shellPath, os)) {
        env["VSCODE_PREVENT_SHELL_HISTORY"] = "1";
      }
    }
    if (isZsh(shellPath, os)) {
      env["VSCODE_AGENT_ZSH_FIXUPS"] = "1";
    }
    const config = {
      icon: ThemeIcon.fromId(Codicon.chatSparkle.id),
      hideFromUser: true,
      forcePersist: true,
      env
    };
    if (isString(shellOrProfile)) {
      config.executable = shellOrProfile;
    } else {
      config.executable = shellOrProfile.path;
      config.args = shellOrProfile.args;
      config.icon = shellOrProfile.icon ?? config.icon;
      config.color = shellOrProfile.color;
      config.env = {
        ...config.env,
        ...shellOrProfile.env
      };
    }
    return this._terminalService.createTerminal({ config });
  }
  _waitForShellIntegration(instance, timeoutMs) {
    const store = new DisposableStore();
    const result = new DeferredPromise();
    const isScreenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
    const effectiveTimeoutMs = timeoutMs > 0 && isScreenReaderOptimized ? timeoutMs + 3e3 : timeoutMs;
    this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: base ${timeoutMs}ms, effective ${effectiveTimeoutMs}ms, screenReaderOptimized=${isScreenReaderOptimized}`);
    const siNoneTimer = store.add(new MutableDisposable());
    siNoneTimer.value = disposableTimeout(() => {
      this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: Timed out ${effectiveTimeoutMs}ms, using no SI`);
      result.complete("none" /* None */);
    }, effectiveTimeoutMs);
    if (instance.capabilities.get(TerminalCapability.CommandDetection)?.hasRichCommandDetection) {
      siNoneTimer.clear();
      this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: Rich SI available immediately`);
      result.complete("rich" /* Rich */);
    } else {
      const onSetRichCommandDetection = store.add(this._terminalService.createOnInstanceCapabilityEvent(TerminalCapability.CommandDetection, (e) => e.onSetRichCommandDetection));
      store.add(onSetRichCommandDetection.event((e) => {
        if (e.instance !== instance) {
          return;
        }
        siNoneTimer.clear();
        this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: Rich SI available eventually`);
        result.complete("rich" /* Rich */);
      }));
      const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
      if (commandDetection) {
        siNoneTimer.clear();
        store.add(disposableTimeout(() => {
          this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: Timed out 200ms, using basic SI`);
          result.complete("basic" /* Basic */);
        }, 200));
      } else {
        store.add(instance.capabilities.onDidAddCommandDetectionCapability((e) => {
          siNoneTimer.clear();
          store.add(disposableTimeout(() => {
            this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: Timed out 200ms, using basic SI (via listener)`);
            result.complete("basic" /* Basic */);
          }, 200));
        }));
      }
    }
    result.p.finally(() => {
      this._logService.info(`ToolTerminalCreator#_waitForShellIntegration: Promise complete, disposing store`);
      store.dispose();
    });
    return result.p;
  }
};
ToolTerminalCreator = __decorateClass([
  __decorateParam(0, IAccessibilityService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITerminalLogService),
  __decorateParam(3, ITerminalService)
], ToolTerminalCreator);
export {
  ShellIntegrationQuality,
  ToolTerminalCreator
};
