import { fromNow, getDurationString } from "../../../../../base/common/date.js";
import { isNumber } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { terminalDecorationError, terminalDecorationIncomplete, terminalDecorationSuccess } from "../terminalIcons.js";
var DecorationStyles = /* @__PURE__ */ ((DecorationStyles2) => {
  DecorationStyles2[DecorationStyles2["DefaultDimension"] = 16] = "DefaultDimension";
  DecorationStyles2[DecorationStyles2["MarginLeft"] = -17] = "MarginLeft";
  return DecorationStyles2;
})(DecorationStyles || {});
var DecorationSelector = /* @__PURE__ */ ((DecorationSelector2) => {
  DecorationSelector2["CommandDecoration"] = "terminal-command-decoration";
  DecorationSelector2["Hide"] = "hide";
  DecorationSelector2["ErrorColor"] = "error";
  DecorationSelector2["DefaultColor"] = "default-color";
  DecorationSelector2["Default"] = "default";
  DecorationSelector2["Codicon"] = "codicon";
  DecorationSelector2["XtermDecoration"] = "xterm-decoration";
  DecorationSelector2["OverviewRuler"] = ".xterm-decoration-overview-ruler";
  return DecorationSelector2;
})(DecorationSelector || {});
function getTerminalDecorationHoverContent(command, hoverMessage, showCommandActions) {
  let hoverContent = showCommandActions ? `${localize("terminalPromptContextMenu", "Show Command Actions")}

---

` : "";
  if (!command) {
    if (hoverMessage) {
      hoverContent = hoverMessage;
    } else {
      return "";
    }
  } else if (command.markProperties || hoverMessage) {
    if (command.markProperties?.hoverMessage || hoverMessage) {
      hoverContent = command.markProperties?.hoverMessage || hoverMessage || "";
    } else {
      return "";
    }
  } else {
    if (isNumber(command.duration)) {
      const durationText = getDurationString(command.duration);
      if (command.exitCode) {
        if (command.exitCode === -1) {
          hoverContent += localize("terminalPromptCommandFailed.duration", "Command executed {0}, took {1} and failed", fromNow(command.timestamp, true), durationText);
        } else {
          hoverContent += localize("terminalPromptCommandFailedWithExitCode.duration", "Command executed {0}, took {1} and failed (Exit Code {2})", fromNow(command.timestamp, true), durationText, command.exitCode);
        }
      } else {
        hoverContent += localize("terminalPromptCommandSuccess.duration", "Command executed {0} and took {1}", fromNow(command.timestamp, true), durationText);
      }
    } else {
      if (command.exitCode) {
        if (command.exitCode === -1) {
          hoverContent += localize("terminalPromptCommandFailed", "Command executed {0} and failed", fromNow(command.timestamp, true));
        } else {
          hoverContent += localize("terminalPromptCommandFailedWithExitCode", "Command executed {0} and failed (Exit Code {1})", fromNow(command.timestamp, true), command.exitCode);
        }
      } else {
        hoverContent += localize("terminalPromptCommandSuccess", "Command executed {0} now");
      }
    }
  }
  return hoverContent;
}
var TerminalCommandDecorationStatus = /* @__PURE__ */ ((TerminalCommandDecorationStatus2) => {
  TerminalCommandDecorationStatus2["Unknown"] = "unknown";
  TerminalCommandDecorationStatus2["Running"] = "running";
  TerminalCommandDecorationStatus2["Success"] = "success";
  TerminalCommandDecorationStatus2["Error"] = "error";
  return TerminalCommandDecorationStatus2;
})(TerminalCommandDecorationStatus || {});
const unknownText = localize("terminalCommandDecoration.unknown", "Unknown");
const runningText = localize("terminalCommandDecoration.running", "Running");
function getTerminalCommandDecorationTooltip(command, storedState) {
  if (command) {
    return getTerminalDecorationHoverContent(command);
  }
  if (!storedState) {
    return "";
  }
  const timestamp = storedState.timestamp;
  const exitCode = storedState.exitCode;
  const duration = storedState.duration;
  if (typeof timestamp !== "number" || timestamp === void 0) {
    return "";
  }
  let hoverContent = "";
  const fromNowText = fromNow(timestamp, true);
  if (typeof duration === "number") {
    const durationText = getDurationString(Math.max(duration, 0));
    if (exitCode) {
      if (exitCode === -1) {
        hoverContent += localize("terminalPromptCommandFailed.duration", "Command executed {0}, took {1} and failed", fromNowText, durationText);
      } else {
        hoverContent += localize("terminalPromptCommandFailedWithExitCode.duration", "Command executed {0}, took {1} and failed (Exit Code {2})", fromNowText, durationText, exitCode);
      }
    } else {
      hoverContent += localize("terminalPromptCommandSuccess.duration", "Command executed {0} and took {1}", fromNowText, durationText);
    }
  } else {
    if (exitCode) {
      if (exitCode === -1) {
        hoverContent += localize("terminalPromptCommandFailed", "Command executed {0} and failed", fromNowText);
      } else {
        hoverContent += localize("terminalPromptCommandFailedWithExitCode", "Command executed {0} and failed (Exit Code {1})", fromNowText, exitCode);
      }
    } else {
      hoverContent += localize("terminalPromptCommandSuccess.", "Command executed {0} ", fromNowText);
    }
  }
  return hoverContent;
}
function getTerminalCommandDecorationState(command, storedState, now = Date.now()) {
  let status = "unknown" /* Unknown */;
  const exitCode = command?.exitCode ?? storedState?.exitCode;
  let exitCodeText = unknownText;
  const startTimestamp = command?.timestamp ?? storedState?.timestamp;
  let startText = unknownText;
  let durationMs;
  let durationText = unknownText;
  if (typeof startTimestamp === "number") {
    startText = new Date(startTimestamp).toLocaleString();
  }
  if (command) {
    if (command.exitCode === void 0) {
      status = "running" /* Running */;
      exitCodeText = runningText;
      durationMs = startTimestamp !== void 0 ? Math.max(0, now - startTimestamp) : void 0;
    } else if (command.exitCode !== 0) {
      status = "error" /* Error */;
      exitCodeText = String(command.exitCode);
      durationMs = command.duration ?? (startTimestamp !== void 0 ? Math.max(0, now - startTimestamp) : void 0);
    } else {
      status = "success" /* Success */;
      exitCodeText = String(command.exitCode);
      durationMs = command.duration ?? (startTimestamp !== void 0 ? Math.max(0, now - startTimestamp) : void 0);
    }
  } else if (storedState) {
    if (storedState.exitCode === void 0) {
      status = "running" /* Running */;
      exitCodeText = runningText;
      durationMs = startTimestamp !== void 0 ? Math.max(0, now - startTimestamp) : void 0;
    } else if (storedState.exitCode !== 0) {
      status = "error" /* Error */;
      exitCodeText = String(storedState.exitCode);
      durationMs = storedState.duration;
    } else {
      status = "success" /* Success */;
      exitCodeText = String(storedState.exitCode);
      durationMs = storedState.duration;
    }
  }
  if (typeof durationMs === "number") {
    durationText = getDurationString(Math.max(durationMs, 0));
  }
  const classNames = [];
  let icon = terminalDecorationIncomplete;
  switch (status) {
    case "running" /* Running */:
    case "unknown" /* Unknown */:
      classNames.push("default-color" /* DefaultColor */, "default" /* Default */);
      icon = terminalDecorationIncomplete;
      break;
    case "error" /* Error */:
      classNames.push("error" /* ErrorColor */);
      icon = terminalDecorationError;
      break;
    case "success" /* Success */:
      classNames.push("success");
      icon = terminalDecorationSuccess;
      break;
  }
  const hoverMessage = getTerminalCommandDecorationTooltip(command, storedState);
  return {
    status,
    icon,
    classNames,
    exitCode,
    exitCodeText,
    startTimestamp,
    startText,
    duration: durationMs,
    durationText,
    hoverMessage
  };
}
function updateLayout(configurationService, element) {
  if (!element) {
    return;
  }
  const fontSize = configurationService.inspect(TerminalSettingId.FontSize).value;
  const defaultFontSize = configurationService.inspect(TerminalSettingId.FontSize).defaultValue;
  const lineHeight = configurationService.inspect(TerminalSettingId.LineHeight).value;
  if (isNumber(fontSize) && isNumber(defaultFontSize) && isNumber(lineHeight)) {
    const scalar = fontSize / defaultFontSize <= 1 ? fontSize / defaultFontSize : 1;
    element.style.width = `${scalar * 16 /* DefaultDimension */}px`;
    element.style.height = `${scalar * 16 /* DefaultDimension */ * lineHeight}px`;
    element.style.fontSize = `${scalar * 16 /* DefaultDimension */}px`;
    element.style.marginLeft = `${scalar * -17 /* MarginLeft */}px`;
  }
}
export {
  DecorationSelector,
  TerminalCommandDecorationStatus,
  getTerminalCommandDecorationState,
  getTerminalCommandDecorationTooltip,
  getTerminalDecorationHoverContent,
  updateLayout
};
