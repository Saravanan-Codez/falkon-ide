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
import { timeout } from "../../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../../base/common/cancellation.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../../nls.js";
import { ITaskService } from "../../../../../tasks/common/taskService.js";
import { OutputMonitorState, PollingConsts } from "./types.js";
import { ITerminalLogService } from "../../../../../../../platform/terminal/common/terminal.js";
function getLastLine(output) {
  if (!output) {
    return "";
  }
  const trimmedOutput = output.replace(/[\r\n]+$/, "");
  if (!trimmedOutput) {
    return "";
  }
  const lastLineFeed = trimmedOutput.lastIndexOf("\n");
  const lastLine = lastLineFeed === -1 ? trimmedOutput : trimmedOutput.slice(lastLineFeed + 1);
  const lastCarriageReturn = lastLine.lastIndexOf("\r");
  return lastCarriageReturn === -1 ? lastLine : lastLine.slice(lastCarriageReturn + 1);
}
let OutputMonitor = class extends Disposable {
  constructor(_execution, _pollFn, invocationContext, token, command, _taskService, _logService) {
    super();
    this._execution = _execution;
    this._pollFn = _pollFn;
    this._taskService = _taskService;
    this._logService = _logService;
    this._state = OutputMonitorState.PollingForIdle;
    /**
     * Flag to track if user has inputted since idle was detected.
     * This is used to skip showing prompts if the user already provided input.
     */
    this._userInputtedSinceIdleDetected = false;
    this._userInputListener = this._register(new MutableDisposable());
    this._outputMonitorTelemetryCounters = {
      inputToolManualAcceptCount: 0,
      inputToolManualRejectCount: 0,
      inputToolManualChars: 0,
      inputToolAutoAcceptCount: 0,
      inputToolAutoChars: 0,
      inputToolManualShownCount: 0,
      inputToolFreeFormInputShownCount: 0,
      inputToolFreeFormInputCount: 0
    };
    this._onDidFinishCommand = this._register(new Emitter());
    this.onDidFinishCommand = this._onDidFinishCommand.event;
    this._onDidDetectInputNeeded = this._register(new Emitter());
    this.onDidDetectInputNeeded = this._onDidDetectInputNeeded.event;
    this._onDidDetectSensitiveInputNeeded = this._register(new Emitter());
    this.onDidDetectSensitiveInputNeeded = this._onDidDetectSensitiveInputNeeded.event;
    this._asyncMode = false;
    this._command = "";
    /**
     * Tracks whether onDidFinishCommand has fired so the event is delivered at
     * most once. The event must fire synchronously during dispose so consumers
     * awaiting `Event.toPromise(onDidFinishCommand)` are unblocked before the
     * underlying emitter is torn down by super.dispose().
     */
    this._didFinish = false;
    this._command = command;
    this._invocationContext = invocationContext;
    const cts = new CancellationTokenSource(token);
    this._currentMonitoringCts = cts;
    this._register(toDisposable(() => {
      this._currentMonitoringCts?.cancel();
      this._currentMonitoringCts?.dispose();
    }));
    timeout(0).then(() => {
      if (this._currentMonitoringCts !== cts) {
        return;
      }
      this._startMonitoring(command, invocationContext, cts.token);
    });
  }
  get state() {
    return this._state;
  }
  _formatLastLineForLog(output) {
    if (!output) {
      return "<empty>";
    }
    const lastLine = getLastLine(output).trimEnd();
    if (!lastLine) {
      return "<empty>";
    }
    if (this._isSensitivePrompt(lastLine)) {
      return "<redacted>";
    }
    return lastLine.length > 200 ? lastLine.slice(0, 200) + "\u2026" : lastLine;
  }
  get pollingResult() {
    return this._pollingResult;
  }
  get outputMonitorTelemetryCounters() {
    return this._outputMonitorTelemetryCounters;
  }
  _fireFinishedOnce() {
    if (this._didFinish) {
      return;
    }
    this._didFinish = true;
    this._onDidFinishCommand.fire();
  }
  dispose() {
    if (!this._didFinish) {
      this._pollingResult ??= {
        state: OutputMonitorState.Cancelled,
        output: this._execution.getOutput(),
        pollDurationMs: 0,
        resources: void 0
      };
    }
    this._fireFinishedOnce();
    super.dispose();
  }
  async _startMonitoring(command, invocationContext, token) {
    const pollStartTime = Date.now();
    let resources;
    let output;
    let extended = false;
    try {
      while (!token.isCancellationRequested) {
        switch (this._state) {
          case OutputMonitorState.PollingForIdle: {
            this._logService.trace(`OutputMonitor: Entering PollingForIdle (extended=${extended})`);
            this._state = await this._waitForIdle(this._execution, extended, token);
            this._logService.trace(`OutputMonitor: PollingForIdle completed -> state=${OutputMonitorState[this._state]}`);
            continue;
          }
          case OutputMonitorState.Timeout: {
            this._logService.trace(`OutputMonitor: Entering Timeout state (extended=${extended})`);
            const shouldContinuePolling = await this._handleTimeoutState(command, invocationContext, extended, token);
            if (shouldContinuePolling) {
              extended = true;
              this._state = OutputMonitorState.PollingForIdle;
              continue;
            } else if (this._asyncMode) {
              this._logService.trace("OutputMonitor: Async mode - timeout reached, waiting for new terminal data");
              extended = false;
              await this._waitForNewData(token);
              if (token.isCancellationRequested) {
                break;
              }
              this._state = OutputMonitorState.PollingForIdle;
              continue;
            } else {
              break;
            }
          }
          case OutputMonitorState.Cancelled:
            break;
          case OutputMonitorState.Idle: {
            this._logService.trace("OutputMonitor: Entering Idle handler");
            const idleResult = await this._handleIdleState(token);
            if (idleResult.shouldContinuePolling) {
              this._logService.trace("OutputMonitor: Idle handler -> continue polling");
              this._state = OutputMonitorState.PollingForIdle;
              continue;
            } else if (this._asyncMode) {
              this._logService.trace("OutputMonitor: Async mode - waiting for new terminal data before next monitoring cycle");
              await this._waitForNewData(token);
              if (token.isCancellationRequested) {
                break;
              }
              this._state = OutputMonitorState.PollingForIdle;
              continue;
            } else {
              this._logService.trace(`OutputMonitor: Idle handler -> stop polling (hasResources=${!!idleResult.resources}, outputLen=${idleResult.output?.length ?? 0})`);
              resources = idleResult.resources;
              output = idleResult.output;
            }
            break;
          }
        }
        if (this._state === OutputMonitorState.Idle || this._state === OutputMonitorState.Cancelled || this._state === OutputMonitorState.Timeout) {
          break;
        }
      }
      if (token.isCancellationRequested) {
        this._state = OutputMonitorState.Cancelled;
      }
    } finally {
      this._logService.trace(`OutputMonitor: Monitoring finished (state=${OutputMonitorState[this._state]}, duration=${Date.now() - pollStartTime}ms)`);
      this._pollingResult = {
        state: this._state,
        output: output ?? this._execution.getOutput(),
        pollDurationMs: Date.now() - pollStartTime,
        resources
      };
      this._userInputListener.clear();
      this._fireFinishedOnce();
    }
  }
  /**
   * Continues monitoring in background mode with a new cancellation token.
   * In background mode, the monitor re-polls for idle and handles prompts
   * whenever new terminal data arrives, rather than stopping after the first
   * idle detection. Resource cost is bounded because the monitor only wakes
   * on new terminal data (via {@link _waitForNewData}) and each idle cycle
   * is capped by the standard polling timeouts.
   */
  continueMonitoringAsync(token) {
    this._asyncMode = true;
    const currentMonitoringCts = this._currentMonitoringCts;
    currentMonitoringCts?.cancel();
    currentMonitoringCts?.dispose();
    this._currentMonitoringCts = new CancellationTokenSource(token);
    this._state = OutputMonitorState.PollingForIdle;
    this._startMonitoring(this._command, this._invocationContext, this._currentMonitoringCts.token);
  }
  /**
   * Waits for new terminal data or cancellation. Used in background mode
   * to avoid polling and LLM calls while the terminal is quiet.
   */
  _waitForNewData(token) {
    return new Promise((resolve) => {
      if (token.isCancellationRequested) {
        resolve();
        return;
      }
      const cleanup = () => {
        dataListener.dispose();
        tokenListener.dispose();
        disposedListener.dispose();
      };
      const dataListener = this._execution.instance.onData(() => {
        cleanup();
        resolve();
      });
      const tokenListener = token.onCancellationRequested(() => {
        cleanup();
        resolve();
      });
      const disposedListener = this._execution.instance.onDisposed(() => {
        cleanup();
        resolve();
      });
    });
  }
  async _handleIdleState(token) {
    const output = this._execution.getOutput();
    const outputTail = output.slice(-1e3);
    const outputLastLine = getLastLine(outputTail);
    this._logService.trace(`OutputMonitor: Idle output summary: len=${output.length}, lastLine=${this._formatLastLineForLog(outputTail)}`);
    if (detectsNonInteractiveHelpPattern(outputLastLine)) {
      this._logService.trace("OutputMonitor: Idle -> non-interactive help pattern detected, stopping");
      return { shouldContinuePolling: false, output };
    }
    const isTask = this._execution.task !== void 0;
    if (isTask && detectsVSCodeTaskFinishMessage(outputTail)) {
      this._logService.trace("OutputMonitor: Idle -> VS Code task finish message detected, stopping");
      return { shouldContinuePolling: false, output };
    }
    if (!isTask && detectsGenericPressAnyKeyPattern(outputTail)) {
      this._logService.trace('OutputMonitor: Idle -> generic "press any key" detected, signaling agent');
      this._onDidDetectInputNeeded.fire();
      this._cleanupIdleInputListener();
      return { shouldContinuePolling: false, output };
    }
    if (this._userInputtedSinceIdleDetected) {
      this._logService.trace("OutputMonitor: User input detected since idle; skipping prompt and continuing polling");
      this._cleanupIdleInputListener();
      return { shouldContinuePolling: true };
    }
    let shouldFireInputNeeded = detectsInputRequiredPattern(outputLastLine);
    if (!shouldFireInputNeeded && detectsLikelyInputRequiredPattern(outputLastLine)) {
      const isActive = this._execution.isActive ? await this._execution.isActive() : void 0;
      if (isActive === true) {
        shouldFireInputNeeded = true;
      }
    }
    if (shouldFireInputNeeded && this._userInputtedSinceIdleDetected) {
      this._logService.trace("OutputMonitor: User input detected during isActive await; skipping prompt and continuing polling");
      this._cleanupIdleInputListener();
      return { shouldContinuePolling: true };
    }
    if (this._asyncMode) {
      if (shouldFireInputNeeded) {
        if (this._isSensitivePrompt(outputLastLine)) {
          this._logService.trace("OutputMonitor: Async mode - sensitive input prompt detected, signaling sensitive UI");
          this._onDidDetectSensitiveInputNeeded.fire();
        } else {
          this._logService.trace("OutputMonitor: Async mode - input-required pattern detected, signaling agent");
          this._onDidDetectInputNeeded.fire();
        }
      }
      this._cleanupIdleInputListener();
      return { shouldContinuePolling: false, output };
    }
    if (shouldFireInputNeeded) {
      if (this._isSensitivePrompt(outputLastLine)) {
        this._logService.trace("OutputMonitor: Sensitive input prompt detected, signaling sensitive UI");
        this._onDidDetectSensitiveInputNeeded.fire();
      } else {
        this._logService.trace("OutputMonitor: Input-required pattern detected, signaling agent");
        this._onDidDetectInputNeeded.fire();
      }
      this._cleanupIdleInputListener();
      return { shouldContinuePolling: false, output };
    }
    this._cleanupIdleInputListener();
    const custom = await this._pollFn?.(this._execution, token, this._taskService);
    this._logService.trace(`OutputMonitor: Custom poller result: ${custom ? "provided" : "none"}`);
    const resources = custom?.resources;
    return { resources, shouldContinuePolling: false, output: custom?.output ?? output };
  }
  async _handleTimeoutState(_command, _invocationContext, _extended, _token) {
    if (_extended) {
      this._logService.info("OutputMonitor: Extended polling timeout reached after 2 minutes, signaling potential input needed");
      this._onDidDetectInputNeeded.fire();
      this._state = OutputMonitorState.Cancelled;
      return false;
    }
    return true;
  }
  /**
   * Single bounded polling pass that returns when:
   *  - terminal becomes inactive/idle, or
   *  - timeout window elapses.
   */
  async _waitForIdle(execution, extendedPolling, token) {
    const maxWaitMs = extendedPolling ? PollingConsts.ExtendedPollingMaxDuration : PollingConsts.FirstPollingMaxDuration;
    const maxInterval = PollingConsts.MaxPollingIntervalDuration;
    let currentInterval = PollingConsts.MinPollingDuration;
    let waited = 0;
    let consecutiveIdleEvents = 0;
    let hasReceivedData = false;
    const onDataDisposable = execution.instance.onData((_data) => {
      hasReceivedData = true;
    });
    try {
      while (!token.isCancellationRequested && waited < maxWaitMs) {
        const waitTime = Math.min(currentInterval, maxWaitMs - waited);
        try {
          await timeout(waitTime, token);
        } catch (err) {
          if (token.isCancellationRequested) {
            return OutputMonitorState.Cancelled;
          }
          throw err;
        }
        waited += waitTime;
        currentInterval = Math.min(currentInterval * 2, maxInterval);
        const currentOutput = execution.getOutput();
        const currentTail = currentOutput.slice(-1e3);
        const currentLastLine = getLastLine(currentTail);
        if (detectsNonInteractiveHelpPattern(currentLastLine)) {
          this._logService.trace(`OutputMonitor: waitForIdle -> non-interactive help detected (waited=${waited}ms)`);
          this._state = OutputMonitorState.Idle;
          this._setupIdleInputListener();
          return this._state;
        }
        const promptResult = detectsHighConfidenceInputPattern(currentLastLine);
        if (promptResult) {
          this._logService.trace(`OutputMonitor: waitForIdle -> high-confidence input pattern detected (waited=${waited}ms, lastLine=${this._formatLastLineForLog(currentTail)})`);
          this._state = OutputMonitorState.Idle;
          this._setupIdleInputListener();
          return this._state;
        }
        if (hasReceivedData) {
          consecutiveIdleEvents = 0;
          hasReceivedData = false;
        } else {
          consecutiveIdleEvents++;
        }
        const recentlyIdle = consecutiveIdleEvents >= PollingConsts.MinIdleEvents;
        const isActive = execution.isActive ? await execution.isActive() : void 0;
        this._logService.trace(`OutputMonitor: waitForIdle check: waited=${waited}ms, recentlyIdle=${recentlyIdle}, isActive=${isActive}`);
        if (recentlyIdle && isActive !== true) {
          this._logService.trace(`OutputMonitor: waitForIdle -> recentlyIdle && !active (waited=${waited}ms, lastLine=${this._formatLastLineForLog(currentTail)})`);
          this._state = OutputMonitorState.Idle;
          this._setupIdleInputListener();
          return this._state;
        }
        if (recentlyIdle && isActive === true && detectsLikelyInputRequiredPattern(currentLastLine)) {
          this._logService.trace(`OutputMonitor: waitForIdle -> broad input pattern detected while active+idle (waited=${waited}ms, lastLine=${this._formatLastLineForLog(currentTail)})`);
          this._state = OutputMonitorState.Idle;
          this._setupIdleInputListener();
          return this._state;
        }
      }
    } finally {
      onDataDisposable.dispose();
    }
    if (token.isCancellationRequested) {
      return OutputMonitorState.Cancelled;
    }
    return OutputMonitorState.Timeout;
  }
  /**
   * Sets up a listener for user input that triggers immediately when idle is detected.
   * This ensures we catch any input that happens between idle detection and prompt creation.
   */
  _setupIdleInputListener() {
    if (this._store.isDisposed) {
      return;
    }
    this._userInputtedSinceIdleDetected = false;
    this._logService.trace("OutputMonitor: Setting up idle input listener");
    this._userInputListener.value = this._execution.instance.onDidInputData(() => {
      this._userInputtedSinceIdleDetected = true;
      this._logService.trace("OutputMonitor: Detected user terminal input while idle");
    });
  }
  /**
   * Cleans up the idle input listener and resets the flag.
   */
  _cleanupIdleInputListener() {
    this._userInputtedSinceIdleDetected = false;
    this._userInputListener.clear();
  }
  _isSensitivePrompt(prompt) {
    if (isCanonicalSudoSPrompt(this._command, prompt)) {
      return false;
    }
    return detectsSensitiveInputPrompt(prompt);
  }
};
OutputMonitor = __decorateClass([
  __decorateParam(5, ITaskService),
  __decorateParam(6, ITerminalLogService)
], OutputMonitor);
function isCanonicalSudoSPrompt(command, prompt) {
  return /(?:^|\s)sudo\s+-S(?:\s|$)/.test(command) && /^\[sudo\]\s+password for .+:\s*$/i.test(prompt);
}
function detectsSensitiveInputPrompt(cursorLine) {
  return /(password|passphrase|token|api\s*key|secret|verification code|otp\b|one[\s-]?time (?:code|password)|2fa|mfa|pin\s*(?:code|number)?[: ]?\s*$|authentication code)/i.test(cursorLine);
}
function matchTerminalPromptOption(options, suggestedOption) {
  const normalize = (value) => value.replace(/['"`]/g, "").trim().replace(/[.,:;]+$/, "");
  const normalizedSuggestion = normalize(suggestedOption);
  if (!normalizedSuggestion) {
    return { option: void 0, index: -1 };
  }
  const candidates = [normalizedSuggestion];
  const firstWhitespaceToken = normalizedSuggestion.split(/\s+/)[0];
  if (firstWhitespaceToken && firstWhitespaceToken !== normalizedSuggestion) {
    candidates.push(firstWhitespaceToken);
  }
  const firstAlphaNum = normalizedSuggestion.match(/[A-Za-z0-9]+/);
  if (firstAlphaNum?.[0] && firstAlphaNum[0] !== normalizedSuggestion && firstAlphaNum[0] !== firstWhitespaceToken) {
    candidates.push(firstAlphaNum[0]);
  }
  for (const candidate of candidates) {
    const exactIndex = options.findIndex((opt) => normalize(opt) === candidate);
    if (exactIndex !== -1) {
      return { option: options[exactIndex], index: exactIndex };
    }
    const lowerCandidate = candidate.toLowerCase();
    const ciIndex = options.findIndex((opt) => normalize(opt).toLowerCase() === lowerCandidate);
    if (ciIndex !== -1) {
      return { option: options[ciIndex], index: ciIndex };
    }
  }
  return { option: void 0, index: -1 };
}
function detectsHighConfidenceInputPattern(cursorLine) {
  return [
    // PowerShell-style multi-option line (supports [?] Help and optional default suffix) ending
    // in whitespace.  Uses [^\[]* to match each label (everything up to the next bracket),
    // ensuring linear-time matching with no nested quantifiers that could cause ReDoS.
    /\s*(?:\[[^\]]\][^\[]*)+(?:\(default is\s+"[^"]+"\):)?\s+$/,
    // Bracketed/parenthesized yes/no pairs at end of line: (y/n), [Y/n], (yes/no), [no/yes]
    /(?:\(|\[)\s*(?:y(?:es)?\s*\/\s*n(?:o)?|n(?:o)?\s*\/\s*y(?:es)?)\s*(?:\]|\))\s+$/i,
    // Same as above but allows a preceding '?' or ':' and optional wrappers e.g.
    // "Continue? (y/n)" or "Overwrite: [yes/no]"
    /[?:]\s*(?:\(|\[)?\s*y(?:es)?\s*\/\s*n(?:o)?\s*(?:\]|\))?\s+$/i,
    // Confirmation prompts ending with (y) followed by trailing space, e.g. "Ok to proceed? (y) "
    // The trailing space indicates the cursor is positioned after the prompt awaiting input, as
    // opposed to normal command output that happens to contain "(y)" followed by a newline.
    /\(y\) +$/i,
    // Prompt with parenthesized default value e.g. "package name: (test) " or "version: (1.0.0) ".
    // REQUIRES at least one space between the colon and the opening paren (`\s+`, not `\s*`)
    // so this rule does not match git-aware shell prompts like
    // allow-any-unicode-next-line
    //   "➜  myrepo git:(main) "                    (oh-my-zsh / robbyrussell)
    //   "[user@host ~/myrepo (main)]$ "
    // where the colon abuts the paren with no separator. npm-init / yarn-init style
    // prompts always render at least one space after the colon, so this stays specific
    // without dropping the intended matches.
    /:\s+\([^)]*\) +$/,
    // Line contains (END) which is common in pagers
    /\(END\)$/,
    // Password prompt. Requires a trailing colon (e.g. "Password:", "[sudo] password for user:")
    // and tolerates zero or more trailing spaces — xterm's `translateToString(trimRight=true)`
    // strips trailing whitespace from non-wrapped buffer lines, so a real `Password: ` prompt
    // is captured from the buffer as `Password:` with no trailing space.
    /password(?: for [^:]+)?:\s*$/i,
    // "Press a key" or "Press any key"
    /press a(?:ny)? key/i,
    // Interactive prompt libraries (prompts, enquirer, inquirer) prefix the prompt with
    // '? ' at the start of the line and end with a distinctive chevron character
    // followed by optional trailing whitespace where the cursor is awaiting input.
    // Anchoring the '?' to the start of the line (after optional whitespace/ANSI
    // escapes) avoids false positives from normal output that contains both a '?'
    // allow-any-unicode-next-line
    // and a chevron (e.g. "What happened? ›").
    // Examples:
    //   "? Do you want to install jsdom? <chevron>"  (prompts)
    //   "? Pick a color <chevron> "                  (enquirer)
    // allow-any-unicode-next-line
    /^(?:\s|\x1b\[[0-9;]*m)*\?.*[›❯▸▶]\s*$/
  ].some((e) => e.test(cursorLine));
}
function detectsInputRequiredPattern(cursorLine) {
  return detectsHighConfidenceInputPattern(cursorLine);
}
function detectsLikelyInputRequiredPattern(cursorLine) {
  if (detectsHighConfidenceInputPattern(cursorLine)) {
    return true;
  }
  return [
    // Line ends with ':' followed by at least one space. The trailing space indicates a
    // waiting prompt (cursor positioned after the colon). A bare ':\n' at end of buffer is
    // usually non-prompt output (e.g. a header or log line) and must not match.
    // NOTE: This is a broad pattern — only use when the caller has independent evidence
    // (e.g. `isActive === true`) that the command is still consuming stdin. On a finished
    // command, log output like `Last Command: ` is indistinguishable from a real prompt.
    /: +$/,
    // Line ends with '?' followed by at least one space (optionally followed by a
    // parenthesized hint like "Continue? (yes/no) "). Requiring trailing space avoids
    // matching arbitrary command output where a line happens to end with '?'.
    // NOTE: This is a broad pattern — same caller-side guard required as above.
    /\? *(?:\([a-z\s]+\))? +$/i
  ].some((e) => e.test(cursorLine));
}
function detectsNonInteractiveHelpPattern(cursorLine) {
  return [
    /press [h?]\s*(?:\+\s*enter)?\s*to (?:show|open|display|get|see)\s*(?:available )?(?:help|commands|options)/i,
    /press h\s*(?:or\s*\?)?\s*(?:\+\s*enter)?\s*for (?:help|commands|options)/i,
    /press \?\s*(?:\+\s*enter)?\s*(?:to|for)?\s*(?:help|commands|options|list)/i,
    /type\s*[h?]\s*(?:\+\s*enter)?\s*(?:for|to see|to show)\s*(?:help|commands|options)/i,
    /hit\s*[h?]\s*(?:\+\s*enter)?\s*(?:for|to see|to show)\s*(?:help|commands|options)/i,
    /press o\s*(?:\+\s*enter)?\s*(?:to|for)?\s*(?:open|launch)(?:\s*(?:the )?(?:app|application|browser)|\s+in\s+(?:the\s+)?browser)?/i,
    /press r\s*(?:\+\s*enter)?\s*(?:to|for)?\s*(?:restart|reload|refresh)(?:\s*(?:the )?(?:server|dev server|service))?/i,
    /press q\s*(?:\+\s*enter)?\s*(?:to|for)?\s*(?:quit|exit|stop)(?:\s*(?:the )?(?:server|app|process))?/i,
    /press u\s*(?:\+\s*enter)?\s*(?:to|for)?\s*(?:show|print|display)\s*(?:the )?(?:server )?urls?/i
  ].some((e) => e.test(cursorLine));
}
const taskFinishMessages = [
  // "Terminal will be reused by tasks, press any key to close it."
  localize("closeTerminal", "Terminal will be reused by tasks, press any key to close it."),
  localize("reuseTerminal", "Terminal will be reused by tasks, press any key to close it."),
  // "Press any key to close the terminal." (with exit code placeholder removed for matching)
  localize("exitCode.closeTerminal", "Press any key to close the terminal."),
  localize("exitCode.reuseTerminal", "Press any key to close the terminal."),
  // Punctuation variant: "The terminal will be reused by tasks. Press any key to close."
  localize("reuseTerminal.pressClose", "The terminal will be reused by tasks. Press any key to close.")
];
const normalizedTaskFinishMessages = taskFinishMessages.map(
  (msg) => msg.replace(/[\s.,:;!?"'`()[\]{}<>\-_/\\]+/g, "").toLowerCase()
);
function detectsVSCodeTaskFinishMessage(cursorLine) {
  const compact = cursorLine.replace(/[\s.,:;!?"'`()[\]{}<>\-_/\\]+/g, "").toLowerCase();
  return normalizedTaskFinishMessages.some((msg) => compact.includes(msg));
}
function detectsGenericPressAnyKeyPattern(cursorLine) {
  if (detectsVSCodeTaskFinishMessage(cursorLine)) {
    return false;
  }
  return /press a(?:ny)? key/i.test(cursorLine);
}
export {
  OutputMonitor,
  detectsGenericPressAnyKeyPattern,
  detectsHighConfidenceInputPattern,
  detectsInputRequiredPattern,
  detectsLikelyInputRequiredPattern,
  detectsNonInteractiveHelpPattern,
  detectsSensitiveInputPrompt,
  detectsVSCodeTaskFinishMessage,
  getLastLine,
  matchTerminalPromptOption
};
