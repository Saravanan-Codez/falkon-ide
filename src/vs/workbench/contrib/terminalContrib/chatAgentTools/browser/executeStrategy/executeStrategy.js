import { DeferredPromise, RunOnceScheduler } from "../../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
async function waitForIdle(onData, idleDurationMs) {
  const store = new DisposableStore();
  const deferred = new DeferredPromise();
  const scheduler = store.add(new RunOnceScheduler(() => deferred.complete(), idleDurationMs));
  store.add(onData(() => scheduler.schedule()));
  scheduler.schedule();
  return deferred.p.finally(() => store.dispose());
}
function detectsCommonPromptPattern(cursorLine) {
  if (cursorLine.trim().length === 0) {
    return { detected: false, reason: "Content is empty or contains only whitespace" };
  }
  if (/PS\s+[A-Z]:\\.*>\s*$/.test(cursorLine)) {
    return { detected: true, reason: `PowerShell prompt pattern detected: "${cursorLine}"` };
  }
  if (/^[A-Z]:\\.*>\s*$/.test(cursorLine)) {
    return { detected: true, reason: `Command Prompt pattern detected: "${cursorLine}"` };
  }
  if (/\$\s*$/.test(cursorLine)) {
    return { detected: true, reason: `Bash-style prompt pattern detected: "${cursorLine}"` };
  }
  if (/#\s*$/.test(cursorLine)) {
    return { detected: true, reason: `Root prompt pattern detected: "${cursorLine}"` };
  }
  if (/^>>>\s*$/.test(cursorLine)) {
    return { detected: true, reason: `Python REPL prompt pattern detected: "${cursorLine}"` };
  }
  if (/\u276f\s*$/.test(cursorLine)) {
    return { detected: true, reason: `Starship prompt pattern detected: "${cursorLine}"` };
  }
  if (/[>%]\s*$/.test(cursorLine)) {
    return { detected: true, reason: `Generic prompt pattern detected: "${cursorLine}"` };
  }
  return { detected: false, reason: `No common prompt pattern found in last line: "${cursorLine}"` };
}
async function waitForIdleWithPromptHeuristics(onData, instance, idlePollIntervalMs, extendedTimeoutMs) {
  await waitForIdle(onData, idlePollIntervalMs);
  const xterm = await instance.xtermReadyPromise;
  if (!xterm) {
    return { detected: false, reason: `Xterm not available, using ${idlePollIntervalMs}ms timeout` };
  }
  const startTime = Date.now();
  while (Date.now() - startTime < extendedTimeoutMs) {
    try {
      let content = "";
      const buffer = xterm.raw.buffer.active;
      const line = buffer.getLine(buffer.baseY + buffer.cursorY);
      if (line) {
        content = line.translateToString(true);
      }
      const promptResult = detectsCommonPromptPattern(content);
      if (promptResult.detected) {
        return promptResult;
      }
    } catch (error) {
    }
    await waitForIdle(onData, Math.min(idlePollIntervalMs, extendedTimeoutMs - (Date.now() - startTime)));
  }
  try {
    let content = "";
    const buffer = xterm.raw.buffer.active;
    const line = buffer.getLine(buffer.baseY + buffer.cursorY);
    if (line) {
      content = line.translateToString(true) + "\n";
    }
    return { detected: false, reason: `Extended timeout reached without prompt detection. Last line: "${content.trim()}"` };
  } catch (error) {
    return { detected: false, reason: `Extended timeout reached. Error reading terminal content: ${error}` };
  }
}
async function trackIdleOnPrompt(instance, idleDurationMs, store, promptFallbackMs, logService, options) {
  const idleOnPrompt = new DeferredPromise();
  const onData = instance.onData;
  const log = logService ? (msg) => logService.info(`trackIdleOnPrompt: ${msg}`) : void 0;
  let TerminalState;
  ((TerminalState2) => {
    TerminalState2[TerminalState2["Initial"] = 0] = "Initial";
    TerminalState2[TerminalState2["Prompt"] = 1] = "Prompt";
    TerminalState2[TerminalState2["Executing"] = 2] = "Executing";
    TerminalState2[TerminalState2["PromptAfterExecuting"] = 3] = "PromptAfterExecuting";
  })(TerminalState || (TerminalState = {}));
  const stateNames = {
    [0 /* Initial */]: "Initial",
    [1 /* Prompt */]: "Prompt",
    [2 /* Executing */]: "Executing",
    [3 /* PromptAfterExecuting */]: "PromptAfterExecuting"
  };
  let state = 0 /* Initial */;
  let dataEventCount = 0;
  function setState(newState, reason) {
    if (state !== newState) {
      log?.(`State ${stateNames[state]} \u2192 ${stateNames[newState]} (${reason})`);
      state = newState;
    }
  }
  const scheduler = store.add(new RunOnceScheduler(() => {
    log?.(`Idle scheduler fired, completing (dataEvents=${dataEventCount})`);
    idleOnPrompt.complete();
  }, idleDurationMs));
  const promptFallbackScheduler = store.add(new RunOnceScheduler(() => {
    if (state === 2 /* Executing */ || state === 3 /* PromptAfterExecuting */) {
      promptFallbackScheduler.cancel();
      return;
    }
    log?.(`Prompt fallback fired (dataEvents=${dataEventCount})`);
    setState(3 /* PromptAfterExecuting */, "promptFallback");
    scheduler.schedule();
  }, promptFallbackMs ?? 1e3));
  const disableFallbacks = options?.disableFallbacks ?? false;
  const initialFallbackScheduler = store.add(new RunOnceScheduler(() => {
    if (state === 2 /* Executing */ || state === 3 /* PromptAfterExecuting */) {
      log?.(`Initial fallback fired but state is ${stateNames[state]}, skipping`);
      return;
    }
    log?.(`Initial fallback fired, no data events received`);
    setState(3 /* PromptAfterExecuting */, "initialFallback");
    scheduler.schedule();
  }, 1e4));
  if (!disableFallbacks) {
    initialFallbackScheduler.schedule();
  }
  const executingFallbackScheduler = store.add(new RunOnceScheduler(() => {
    if (state === 2 /* Executing */) {
      log?.(`Executing fallback fired after 30s data-idle (dataEvents=${dataEventCount})`);
      setState(3 /* PromptAfterExecuting */, "executingFallback");
      scheduler.schedule();
    }
  }, 3e4));
  const hardCapScheduler = store.add(new RunOnceScheduler(() => {
    if (state === 0 /* Initial */ || state === 1 /* Prompt */) {
      log?.(`Hard cap fired after 5min in state ${stateNames[state]} (dataEvents=${dataEventCount})`);
      setState(3 /* PromptAfterExecuting */, "hardCap");
      scheduler.schedule();
    }
  }, 6e4));
  if (!disableFallbacks) {
    hardCapScheduler.schedule();
  }
  store.add(onData((e) => {
    dataEventCount++;
    initialFallbackScheduler.cancel();
    const matches = e.matchAll(/(?:\x1b\]|\x9d)[16]33;(?<type>[ACD])(?:;.*)?(?:\x1b\\|\x07|\x9c)/g);
    for (const match of matches) {
      if (match.groups?.type === "A") {
        if (state === 0 /* Initial */) {
          setState(1 /* Prompt */, "sequence A");
        } else if (state === 2 /* Executing */) {
          setState(3 /* PromptAfterExecuting */, "sequence A after executing");
          executingFallbackScheduler.cancel();
        }
      } else if (match.groups?.type === "C" || match.groups?.type === "D") {
        setState(2 /* Executing */, `sequence ${match.groups?.type}`);
        if (!disableFallbacks) {
          executingFallbackScheduler.schedule();
        }
      }
    }
    if (state === 3 /* PromptAfterExecuting */) {
      promptFallbackScheduler.cancel();
      executingFallbackScheduler.cancel();
      scheduler.schedule();
    } else {
      scheduler.cancel();
      if (state === 0 /* Initial */ || state === 1 /* Prompt */) {
        if (!disableFallbacks) {
          promptFallbackScheduler.schedule();
        }
      } else {
        promptFallbackScheduler.cancel();
        if (!disableFallbacks) {
          executingFallbackScheduler.schedule();
        }
      }
    }
  }));
  return idleOnPrompt.p;
}
export {
  detectsCommonPromptPattern,
  trackIdleOnPrompt,
  waitForIdle,
  waitForIdleWithPromptHeuristics
};
