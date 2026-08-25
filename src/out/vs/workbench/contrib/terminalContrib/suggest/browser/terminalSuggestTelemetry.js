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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { isString } from "../../../../../base/common/types.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { TerminalCompletionItemKind } from "./terminalCompletionItem.js";
let TerminalSuggestTelemetry = class extends Disposable {
  constructor(commandDetection, _promptInputModel, _telemetryService) {
    super();
    this._promptInputModel = _promptInputModel;
    this._telemetryService = _telemetryService;
    this._kindMap = /* @__PURE__ */ new Map([
      [TerminalCompletionItemKind.File, "File"],
      [TerminalCompletionItemKind.Folder, "Folder"],
      [TerminalCompletionItemKind.Method, "Method"],
      [TerminalCompletionItemKind.Alias, "Alias"],
      [TerminalCompletionItemKind.Argument, "Argument"],
      [TerminalCompletionItemKind.Option, "Option"],
      [TerminalCompletionItemKind.OptionValue, "Option Value"],
      [TerminalCompletionItemKind.Flag, "Flag"],
      [TerminalCompletionItemKind.InlineSuggestion, "Inline Suggestion"],
      [TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop, "Inline Suggestion"]
    ]);
    this._register(commandDetection.onCommandFinished((e) => {
      this._sendTelemetryInfo(false, e.exitCode);
      this._acceptedCompletions = void 0;
    }));
    this._register(this._promptInputModel.onDidInterrupt(() => {
      this._sendTelemetryInfo(true);
      this._acceptedCompletions = void 0;
    }));
  }
  acceptCompletion(sessionId, completion, commandLine) {
    if (!completion || !commandLine) {
      this._acceptedCompletions = void 0;
      return;
    }
    this._acceptedCompletions = this._acceptedCompletions || [];
    this._acceptedCompletions.push({ label: isString(completion.label) ? completion.label : completion.label.label, kind: this._kindMap.get(completion.kind), sessionId, provider: completion.provider });
  }
  /**
   * Logs the latency (ms) from completion request to completions shown.
   * @param sessionId The terminal session ID
   * @param latency The measured latency in ms
   * @param firstShownFor Object indicating if completions have been shown for window/shell
   */
  logCompletionLatency(sessionId, latency, firstShownFor) {
    this._telemetryService.publicLog2("terminal.suggest.completionLatency", {
      terminalSessionId: sessionId,
      latency,
      firstWindow: firstShownFor.window,
      firstShell: firstShownFor.shell
    });
  }
  _sendTelemetryInfo(fromInterrupt, exitCode) {
    const commandLine = this._promptInputModel?.value;
    for (const completion of this._acceptedCompletions || []) {
      const label = completion?.label;
      const kind = completion?.kind;
      const provider = completion?.provider;
      if (label === void 0 || commandLine === void 0 || kind === void 0 || provider === void 0) {
        return;
      }
      let outcome;
      if (fromInterrupt) {
        outcome = "Interrupted" /* Interrupted */;
      } else if (commandLine.trim() && commandLine.includes(label)) {
        outcome = "Accepted" /* Accepted */;
      } else if (inputContainsFirstHalfOfLabel(commandLine, label)) {
        outcome = "AcceptedWithEdit" /* AcceptedWithEdit */;
      } else {
        outcome = "Deleted" /* Deleted */;
      }
      this._telemetryService.publicLog2("terminal.suggest.acceptedCompletion", {
        kind,
        outcome,
        exitCode,
        terminalSessionId: completion.sessionId,
        provider
      });
    }
  }
};
TerminalSuggestTelemetry = __decorateClass([
  __decorateParam(2, ITelemetryService)
], TerminalSuggestTelemetry);
var CompletionOutcome = /* @__PURE__ */ ((CompletionOutcome2) => {
  CompletionOutcome2["Accepted"] = "Accepted";
  CompletionOutcome2["Deleted"] = "Deleted";
  CompletionOutcome2["AcceptedWithEdit"] = "AcceptedWithEdit";
  CompletionOutcome2["Interrupted"] = "Interrupted";
  return CompletionOutcome2;
})(CompletionOutcome || {});
function inputContainsFirstHalfOfLabel(commandLine, label) {
  return commandLine.includes(label.substring(0, Math.ceil(label.length / 2)));
}
export {
  TerminalSuggestTelemetry
};
