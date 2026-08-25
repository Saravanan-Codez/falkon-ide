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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import * as dom from "../../../../../base/browser/dom.js";
import { asArray } from "../../../../../base/common/arrays.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { DecorationSelector, updateLayout } from "../../../terminal/browser/xterm/decorationStyles.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { getLinesForCommand } from "../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { Schemas } from "../../../../../base/common/network.js";
import { ITerminalQuickFixService, TerminalQuickFixType } from "./quickFix.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { CodeActionKind } from "../../../../../editor/contrib/codeAction/common/types.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { hasKey } from "../../../../../base/common/types.js";
var QuickFixDecorationSelector = /* @__PURE__ */ ((QuickFixDecorationSelector2) => {
  QuickFixDecorationSelector2["QuickFix"] = "quick-fix";
  return QuickFixDecorationSelector2;
})(QuickFixDecorationSelector || {});
const quickFixClasses = [
  "quick-fix" /* QuickFix */,
  DecorationSelector.Codicon,
  DecorationSelector.CommandDecoration,
  DecorationSelector.XtermDecoration
];
let TerminalQuickFixAddon = class extends Disposable {
  constructor(_sessionId, _aliases, _capabilities, _accessibilitySignalService, _actionWidgetService, _commandService, _configurationService, _extensionService, _labelService, _openerService, _telemetryService, _quickFixService) {
    super();
    this._sessionId = _sessionId;
    this._aliases = _aliases;
    this._capabilities = _capabilities;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._actionWidgetService = _actionWidgetService;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._extensionService = _extensionService;
    this._labelService = _labelService;
    this._openerService = _openerService;
    this._telemetryService = _telemetryService;
    this._quickFixService = _quickFixService;
    this._commandListeners = /* @__PURE__ */ new Map();
    this._decoration = this._register(new MutableDisposable());
    this._decorationDisposables = this._register(new MutableDisposable());
    this._registeredSelectors = /* @__PURE__ */ new Set();
    this._didRun = false;
    this._onDidRequestRerunCommand = this._register(new Emitter());
    this.onDidRequestRerunCommand = this._onDidRequestRerunCommand.event;
    this._onDidUpdateQuickFixes = this._register(new Emitter());
    this.onDidUpdateQuickFixes = this._onDidUpdateQuickFixes.event;
    const commandDetectionCapability = this._capabilities.get(TerminalCapability.CommandDetection);
    if (commandDetectionCapability) {
      this._registerCommandHandlers();
    } else {
      this._register(this._capabilities.onDidAddCommandDetectionCapability(() => {
        this._registerCommandHandlers();
      }));
    }
    this._register(this._quickFixService.onDidRegisterProvider((result) => this.registerCommandFinishedListener(convertToQuickFixOptions(result))));
    this._quickFixService.extensionQuickFixes.then((quickFixSelectors) => {
      for (const selector of quickFixSelectors) {
        this.registerCommandSelector(selector);
      }
    });
    this._register(this._quickFixService.onDidRegisterCommandSelector((selector) => this.registerCommandSelector(selector)));
    this._register(this._quickFixService.onDidUnregisterProvider((id) => this._commandListeners.delete(id)));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.ShellIntegrationQuickFixEnabled)) {
        this._decoration.clear();
        this._decorationDisposables.clear();
      }
    }));
  }
  activate(terminal) {
    this._terminal = terminal;
  }
  showMenu() {
    if (!this._currentRenderContext) {
      return;
    }
    const actions = this._currentRenderContext.quickFixes.map((f) => new TerminalQuickFixItem(f, f.type, f.source, f.label, f.kind));
    const actionSet = {
      allActions: actions,
      hasAutoFix: false,
      hasAIFix: false,
      allAIFixes: false,
      validActions: actions,
      dispose: () => {
      }
    };
    const delegate = {
      onSelect: async (fix) => {
        fix.action?.run();
        this._actionWidgetService.hide();
      },
      onHide: () => {
        this._terminal?.focus();
      }
    };
    this._actionWidgetService.show("quickFixWidget", false, toActionWidgetItems(actionSet.validActions, true), delegate, this._currentRenderContext.anchor, this._currentRenderContext.parentElement);
  }
  registerCommandSelector(selector) {
    if (this._registeredSelectors.has(selector.id)) {
      return;
    }
    const matcherKey = selector.commandLineMatcher.toString();
    const currentOptions = this._commandListeners.get(matcherKey) || [];
    currentOptions.push({
      id: selector.id,
      type: "unresolved",
      commandLineMatcher: selector.commandLineMatcher,
      outputMatcher: selector.outputMatcher,
      commandExitResult: selector.commandExitResult,
      kind: selector.kind
    });
    this._registeredSelectors.add(selector.id);
    this._commandListeners.set(matcherKey, currentOptions);
  }
  registerCommandFinishedListener(options) {
    const matcherKey = options.commandLineMatcher.toString();
    let currentOptions = this._commandListeners.get(matcherKey) || [];
    currentOptions = currentOptions.filter((o) => o.id !== options.id);
    currentOptions.push(options);
    this._commandListeners.set(matcherKey, currentOptions);
  }
  _registerCommandHandlers() {
    const terminal = this._terminal;
    const commandDetection = this._capabilities.get(TerminalCapability.CommandDetection);
    if (!terminal || !commandDetection) {
      return;
    }
    this._register(commandDetection.onCommandFinished(async (command) => await this._resolveQuickFixes(command, this._aliases)));
  }
  /**
   * Resolves quick fixes, if any, based on the
   * @param command & its output
   */
  async _resolveQuickFixes(command, aliases) {
    const terminal = this._terminal;
    if (!terminal || command.wasReplayed) {
      return;
    }
    if (command.command !== "" && this._lastQuickFixId) {
      this._disposeQuickFix(command, this._lastQuickFixId);
    }
    const resolver = async (selector, lines) => {
      if (lines === void 0) {
        return void 0;
      }
      const id = selector.id;
      await this._extensionService.activateByEvent(`onTerminalQuickFixRequest:${id}`);
      return this._quickFixService.providers.get(id)?.provideTerminalQuickFixes(command, lines, {
        type: "resolved",
        commandLineMatcher: selector.commandLineMatcher,
        outputMatcher: selector.outputMatcher,
        commandExitResult: selector.commandExitResult,
        kind: selector.kind,
        id: selector.id
      }, new CancellationTokenSource().token);
    };
    const result = await getQuickFixesForCommand(aliases, terminal, command, this._commandListeners, this._commandService, this._openerService, this._labelService, this._onDidRequestRerunCommand, resolver);
    if (!result) {
      return;
    }
    this._quickFixes = result;
    this._lastQuickFixId = this._quickFixes[0].id;
    this._registerQuickFixDecoration();
    this._onDidUpdateQuickFixes.fire({ command, actions: this._quickFixes });
    this._quickFixes = void 0;
  }
  _disposeQuickFix(command, id) {
    this._telemetryService?.publicLog2("terminal/quick-fix", {
      quickFixId: id,
      ranQuickFix: this._didRun,
      terminalSessionId: this._sessionId
    });
    this._decoration.clear();
    this._decorationDisposables.clear();
    this._onDidUpdateQuickFixes.fire({ command, actions: this._quickFixes });
    this._quickFixes = void 0;
    this._lastQuickFixId = void 0;
    this._didRun = false;
  }
  /**
   * Registers a decoration with the quick fixes
   */
  _registerQuickFixDecoration() {
    if (!this._terminal) {
      return;
    }
    const quickFixEnabled = this._configurationService.getValue(TerminalSettingId.ShellIntegrationQuickFixEnabled);
    if (!quickFixEnabled) {
      return;
    }
    this._decoration.clear();
    this._decorationDisposables.clear();
    const quickFixes = this._quickFixes;
    if (!quickFixes || quickFixes.length === 0) {
      return;
    }
    const marker = this._terminal.registerMarker();
    if (!marker) {
      return;
    }
    const decoration = this._decoration.value = this._terminal.registerDecoration({ marker, width: 2, layer: "top" });
    if (!decoration) {
      return;
    }
    const store = this._decorationDisposables.value = new DisposableStore();
    store.add(decoration.onRender((e) => {
      const rect = e.getBoundingClientRect();
      const anchor = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
      if (e.classList.contains("quick-fix" /* QuickFix */)) {
        if (this._currentRenderContext) {
          this._currentRenderContext.anchor = anchor;
        }
        return;
      }
      e.classList.add(...quickFixClasses);
      const isExplainOnly = quickFixes.every((e2) => e2.kind === "explain");
      if (isExplainOnly) {
        e.classList.add("explainOnly");
      }
      e.classList.add(...ThemeIcon.asClassNameArray(isExplainOnly ? Codicon.sparkle : Codicon.lightBulb));
      updateLayout(this._configurationService, e);
      this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalQuickFix);
      const parentElement = e.closest(".xterm")?.parentElement;
      if (!parentElement) {
        return;
      }
      this._currentRenderContext = { quickFixes, anchor, parentElement };
      this._register(dom.addDisposableListener(e, dom.EventType.CLICK, () => this.showMenu()));
    }));
    store.add(decoration.onDispose(() => this._currentRenderContext = void 0));
  }
};
TerminalQuickFixAddon = __decorateClass([
  __decorateParam(3, IAccessibilitySignalService),
  __decorateParam(4, IActionWidgetService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, ITerminalQuickFixService)
], TerminalQuickFixAddon);
async function getQuickFixesForCommand(aliases, terminal, terminalCommand, quickFixOptions, commandService, openerService, labelService, onDidRequestRerunCommand, getResolvedFixes) {
  const commandQuickFixSet = /* @__PURE__ */ new Set();
  const openQuickFixSet = /* @__PURE__ */ new Set();
  const fixes = [];
  const newCommand = terminalCommand.command;
  for (const options of quickFixOptions.values()) {
    for (const option of options) {
      if (option.commandExitResult === "success" && terminalCommand.exitCode !== 0 || option.commandExitResult === "error" && terminalCommand.exitCode === 0) {
        continue;
      }
      let quickFixes;
      if (option.type === "resolved") {
        quickFixes = await option.getQuickFixes(terminalCommand, getLinesForCommand(terminal.buffer.active, terminalCommand, terminal.cols, option.outputMatcher), option, new CancellationTokenSource().token);
      } else if (option.type === "unresolved") {
        if (!getResolvedFixes) {
          throw new Error("No resolved fix provider");
        }
        quickFixes = await getResolvedFixes(option, option.outputMatcher ? getLinesForCommand(terminal.buffer.active, terminalCommand, terminal.cols, option.outputMatcher) : void 0);
      } else if (option.type === "internal") {
        const commandLineMatch = newCommand.match(option.commandLineMatcher);
        if (!commandLineMatch) {
          continue;
        }
        const outputMatcher = option.outputMatcher;
        let outputMatch;
        if (outputMatcher) {
          outputMatch = terminalCommand.getOutputMatch(outputMatcher);
        }
        if (!outputMatch) {
          continue;
        }
        const matchResult = { commandLineMatch, outputMatch, commandLine: terminalCommand.command };
        quickFixes = option.getQuickFixes(matchResult);
      }
      if (quickFixes) {
        for (const quickFix of asArray(quickFixes)) {
          let action;
          if (hasKey(quickFix, { type: true })) {
            switch (quickFix.type) {
              case TerminalQuickFixType.TerminalCommand: {
                const fix = quickFix;
                if (commandQuickFixSet.has(fix.terminalCommand)) {
                  continue;
                }
                commandQuickFixSet.add(fix.terminalCommand);
                const label = localize("quickFix.command", "Run: {0}", fix.terminalCommand);
                action = {
                  type: TerminalQuickFixType.TerminalCommand,
                  kind: option.kind,
                  class: void 0,
                  source: quickFix.source,
                  id: quickFix.id,
                  label,
                  enabled: true,
                  run: () => {
                    onDidRequestRerunCommand?.fire({
                      command: fix.terminalCommand,
                      shouldExecute: fix.shouldExecute ?? true
                    });
                  },
                  tooltip: label,
                  command: fix.terminalCommand,
                  shouldExecute: fix.shouldExecute
                };
                break;
              }
              case TerminalQuickFixType.Opener: {
                const fix = quickFix;
                if (!fix.uri) {
                  return;
                }
                if (openQuickFixSet.has(fix.uri.toString())) {
                  continue;
                }
                openQuickFixSet.add(fix.uri.toString());
                const isUrl = fix.uri.scheme === Schemas.http || fix.uri.scheme === Schemas.https;
                const uriLabel = isUrl ? encodeURI(fix.uri.toString(true)) : labelService.getUriLabel(fix.uri);
                const label = localize("quickFix.opener", "Open: {0}", uriLabel);
                action = {
                  source: quickFix.source,
                  id: quickFix.id,
                  label,
                  type: TerminalQuickFixType.Opener,
                  kind: option.kind,
                  class: void 0,
                  enabled: true,
                  run: () => openerService.open(fix.uri),
                  tooltip: label,
                  uri: fix.uri
                };
                break;
              }
              case TerminalQuickFixType.Port: {
                const fix = quickFix;
                action = {
                  source: "builtin",
                  type: fix.type,
                  kind: option.kind,
                  id: fix.id,
                  label: fix.label,
                  class: fix.class,
                  enabled: fix.enabled,
                  run: () => {
                    fix.run();
                  },
                  tooltip: fix.tooltip
                };
                break;
              }
              case TerminalQuickFixType.VscodeCommand: {
                const fix = quickFix;
                action = {
                  source: quickFix.source,
                  type: fix.type,
                  kind: option.kind,
                  id: fix.id,
                  label: fix.title,
                  class: void 0,
                  enabled: true,
                  run: () => commandService.executeCommand(fix.id),
                  tooltip: fix.title
                };
                break;
              }
            }
            if (action) {
              fixes.push(action);
            }
          }
        }
      }
    }
  }
  return fixes.length > 0 ? fixes : void 0;
}
function convertToQuickFixOptions(selectorProvider) {
  return {
    id: selectorProvider.selector.id,
    type: "resolved",
    commandLineMatcher: selectorProvider.selector.commandLineMatcher,
    outputMatcher: selectorProvider.selector.outputMatcher,
    commandExitResult: selectorProvider.selector.commandExitResult,
    kind: selectorProvider.selector.kind,
    getQuickFixes: selectorProvider.provider.provideTerminalQuickFixes
  };
}
class TerminalQuickFixItem {
  constructor(action, type, source, title, kind = "fix") {
    this.action = action;
    this.type = type;
    this.source = source;
    this.title = title;
    this.kind = kind;
    this.disabled = false;
  }
}
function toActionWidgetItems(inputQuickFixes, showHeaders) {
  const menuItems = [];
  menuItems.push({
    kind: ActionListItemKind.Header,
    group: {
      kind: CodeActionKind.QuickFix,
      title: localize("codeAction.widget.id.quickfix", "Quick Fix")
    }
  });
  for (const quickFix of showHeaders ? inputQuickFixes : inputQuickFixes.filter((i) => !!i.action)) {
    if (!quickFix.disabled && quickFix.action) {
      menuItems.push({
        kind: ActionListItemKind.Action,
        item: quickFix,
        group: {
          kind: CodeActionKind.QuickFix,
          icon: getQuickFixIcon(quickFix),
          title: quickFix.action.label
        },
        disabled: false,
        label: quickFix.title
      });
    }
  }
  return menuItems;
}
function getQuickFixIcon(quickFix) {
  if (quickFix.kind === "explain") {
    return Codicon.sparkle;
  }
  switch (quickFix.type) {
    case TerminalQuickFixType.Opener:
      if (quickFix.action.uri) {
        const isUrl = quickFix.action.uri.scheme === Schemas.http || quickFix.action.uri.scheme === Schemas.https;
        return isUrl ? Codicon.linkExternal : Codicon.goToFile;
      }
    case TerminalQuickFixType.TerminalCommand:
      return Codicon.run;
    case TerminalQuickFixType.Port:
      return Codicon.debugDisconnect;
    case TerminalQuickFixType.VscodeCommand:
      return Codicon.lightbulb;
  }
}
export {
  TerminalQuickFixAddon,
  getQuickFixesForCommand
};
