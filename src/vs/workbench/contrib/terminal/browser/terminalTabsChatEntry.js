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
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { $ } from "../../../../base/browser/dom.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ITerminalChatService, ITerminalService } from "./terminal.js";
import * as dom from "../../../../base/browser/dom.js";
let TerminalTabsChatEntry = class extends Disposable {
  constructor(container, _tabContainer, _commandService, _terminalChatService, _terminalService, _telemetryService) {
    super();
    this._tabContainer = _tabContainer;
    this._commandService = _commandService;
    this._terminalChatService = _terminalChatService;
    this._terminalService = _terminalService;
    this._telemetryService = _telemetryService;
    this._entry = dom.append(container, $(".terminal-tabs-chat-entry"));
    this._entry.tabIndex = 0;
    this._entry.setAttribute("role", "button");
    const entry = dom.append(this._entry, $(".terminal-tabs-entry"));
    const icon = dom.append(entry, $(".terminal-tabs-chat-entry-icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.commentDiscussionSparkle));
    this._label = dom.append(entry, $(".terminal-tabs-chat-entry-label"));
    this._deleteButton = dom.append(entry, $(".terminal-tabs-chat-entry-delete"));
    this._deleteButton.classList.add(...ThemeIcon.asClassNameArray(Codicon.trashcan));
    this._deleteButton.tabIndex = 0;
    this._deleteButton.setAttribute("role", "button");
    this._deleteButton.setAttribute("aria-label", localize("terminal.tabs.chatEntryDeleteAriaLabel", "Kill all hidden chat terminals"));
    this._deleteButton.setAttribute("title", localize("terminal.tabs.chatEntryDeleteTooltip", "Kill all hidden chat terminals"));
    const runChatTerminalsCommand = () => {
      void this._commandService.executeCommand("workbench.action.terminal.chat.viewHiddenChatTerminals");
    };
    this._register(dom.addDisposableListener(this._entry, dom.EventType.CLICK, (e) => {
      if (e.target === this._deleteButton || this._deleteButton.contains(e.target)) {
        return;
      }
      e.preventDefault();
      runChatTerminalsCommand();
    }));
    this._register(dom.addDisposableListener(this._entry, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        runChatTerminalsCommand();
      }
    }));
    this._register(dom.addDisposableListener(this._deleteButton, dom.EventType.CLICK, async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this._deleteAllHiddenTerminals();
    }));
    this._register(dom.addDisposableListener(this._deleteButton, dom.EventType.KEY_DOWN, async (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        await this._deleteAllHiddenTerminals();
      }
    }));
    this.update();
  }
  dispose() {
    this._entry.remove();
    this._label.remove();
    this._deleteButton.remove();
    super.dispose();
  }
  async _deleteAllHiddenTerminals() {
    const hiddenTerminals = this._terminalChatService.getToolSessionTerminalInstances(true);
    if (hiddenTerminals.length === 0) {
      return;
    }
    this._telemetryService.publicLog2("terminal.chatDeleteHiddenTerminals", {
      count: hiddenTerminals.length
    });
    await Promise.all(hiddenTerminals.map((terminal) => this._terminalService.safeDisposeTerminal(terminal)));
  }
  get element() {
    return this._entry;
  }
  update() {
    const hiddenChatTerminalCount = this._terminalChatService.getToolSessionTerminalInstances(true).length;
    if (hiddenChatTerminalCount <= 0) {
      this._entry.style.display = "none";
      this._label.textContent = "";
      this._entry.removeAttribute("aria-label");
      this._entry.removeAttribute("title");
      return;
    }
    this._entry.style.display = "";
    const tooltip = localize("terminal.tabs.chatEntryTooltip", "Show hidden chat terminals");
    this._entry.setAttribute("title", tooltip);
    const hasText = this._tabContainer.classList.contains("has-text");
    if (hasText) {
      this._label.textContent = hiddenChatTerminalCount === 1 ? localize("terminal.tabs.chatEntryLabelSingle", "{0} Hidden Terminal", hiddenChatTerminalCount) : localize("terminal.tabs.chatEntryLabelPlural", "{0} Hidden Terminals", hiddenChatTerminalCount);
    } else {
      this._label.textContent = `${hiddenChatTerminalCount}`;
    }
    const ariaLabel = hiddenChatTerminalCount === 1 ? localize("terminal.tabs.chatEntryAriaLabelSingle", "Show 1 hidden chat terminal") : localize("terminal.tabs.chatEntryAriaLabelPlural", "Show {0} hidden chat terminals", hiddenChatTerminalCount);
    this._entry.setAttribute("aria-label", ariaLabel);
  }
};
TerminalTabsChatEntry = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, ITerminalChatService),
  __decorateParam(4, ITerminalService),
  __decorateParam(5, ITelemetryService)
], TerminalTabsChatEntry);
export {
  TerminalTabsChatEntry
};
