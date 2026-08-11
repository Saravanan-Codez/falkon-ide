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
import * as DOM from "../../../../base/browser/dom.js";
import { Dialog } from "../../../../base/browser/ui/dialog/dialog.js";
import { InputBox, MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { Checkbox } from "../../../../base/browser/ui/toggle/toggle.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { defaultCheckboxStyles, defaultDialogStyles, defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { createWorkbenchDialogOptions } from "../../../../workbench/browser/parts/dialogs/dialog.js";
import { IHostService } from "../../../../workbench/services/host/browser/host.js";
import "./media/sessionChatInputToolbarDebug.css";
const $ = DOM.$;
const ISessionChatPillsDebugService = createDecorator("sessionChatPillsDebugService");
const SessionChatPillsDebugAvailableContext = new RawContextKey("sessionsChatPillsDebugAvailable", false, localize("sessionsChatPillsDebugAvailable", "Whether a session chat view is active and can show fake status pills"));
const SHOW_SESSION_CHAT_PILLS_DEBUG_COMMAND_ID = "sessions.debug.showFakeChatPills";
function weightedRandomDebugIncrement(first = Math.random(), second = Math.random()) {
  return Math.min(Math.floor(first * 16), Math.floor(second * 16));
}
function isNonNegativeIntegerInput(raw) {
  if (raw.trim().length === 0) {
    return false;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0;
}
let SessionChatPillsDebugService = class extends Disposable {
  constructor(contextKeyService, _contextViewService, _keybindingService, _layoutService, productService, _hostService) {
    super();
    this._contextViewService = _contextViewService;
    this._keybindingService = _keybindingService;
    this._layoutService = _layoutService;
    this._hostService = _hostService;
    this._changesTimer = this._register(new MutableDisposable());
    this._availableContext = SessionChatPillsDebugAvailableContext.bindTo(contextKeyService);
    if (productService.quality !== "stable") {
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: SHOW_SESSION_CHAT_PILLS_DEBUG_COMMAND_ID,
            title: localize2("sessions.debug.showFakeChatPills", "Configure Fake Session Chat UI"),
            category: Categories.Developer,
            precondition: SessionChatPillsDebugAvailableContext,
            menu: [{ id: MenuId.CommandPalette, when: SessionChatPillsDebugAvailableContext }]
          });
        }
        run(accessor) {
          return accessor.get(ISessionChatPillsDebugService).showDialog();
        }
      }));
    }
  }
  register(toolbar, banners, isActive) {
    const disposables = new DisposableStore();
    disposables.add(autorun((reader) => {
      if (isActive.read(reader)) {
        this._setActiveTarget(toolbar, banners);
      } else if (this._activeToolbar === toolbar) {
        this._setActiveTarget(void 0, void 0);
      }
    }));
    disposables.add(toDisposable(() => {
      if (this._activeToolbar === toolbar) {
        this._setActiveTarget(void 0, void 0);
      }
    }));
    return disposables;
  }
  clear(toolbar) {
    if (this._activeToolbar === toolbar) {
      this._setDebugData(void 0);
    }
  }
  async showDialog() {
    const toolbar = this._activeToolbar;
    if (!toolbar) {
      return;
    }
    const initial = toolbar.getDebugData();
    const state = {
      files: String(initial?.stats.files ?? 0),
      insertions: String(initial?.stats.insertions ?? 0),
      deletions: String(initial?.stats.deletions ?? 0),
      markdownFiles: initial?.markdownFiles.join("\n") ?? "",
      subagents: initial?.subagents.join("\n") ?? "",
      browsers: initial?.browsers.join("\n") ?? "",
      ciFailed: String(initial?.ciFailed ?? 0),
      ciPending: String(initial?.ciPending ?? 0),
      prFeedback: String(initial?.prFeedback ?? 0),
      agentFeedback: String(initial?.agentFeedback ?? 0),
      autoIncrementChanges: initial?.autoIncrementChanges ?? false
    };
    const disposables = new DisposableStore();
    let applyButton;
    let numericInputs = [];
    let revalidate = () => {
    };
    const dialog = disposables.add(new Dialog(
      this._layoutService.activeContainer,
      localize("sessions.debug.chatPills.title", "Fake Session Chat UI"),
      [
        localize("sessions.debug.chatPills.apply", "Apply"),
        localize("sessions.debug.chatPills.clear", "Clear"),
        localize("sessions.debug.chatPills.cancel", "Cancel")
      ],
      createWorkbenchDialogOptions({
        type: "none",
        extraClasses: ["session-chat-pills-debug-dialog"],
        cancelId: 2,
        dialogStyles: defaultDialogStyles,
        buttonOptions: [{
          styleButton: (button) => {
            applyButton = button;
            revalidate();
          }
        }],
        renderBody: (container) => {
          const form = DOM.append(container, $(".session-chat-pills-debug-form"));
          DOM.append(form, $("p.session-chat-pills-debug-description", void 0, localize("sessions.debug.chatPills.description", "Configure the values shown by status pills and input banners. Separate multiple names with commas or new lines.")));
          const stats = DOM.append(form, $(".session-chat-pills-debug-stats"));
          const files = this._createInput(stats, disposables, localize("sessions.debug.chatPills.files", "Files"), state.files, (value) => state.files = value, true, () => revalidate());
          const insertions = this._createInput(stats, disposables, localize("sessions.debug.chatPills.insertions", "Insertions"), state.insertions, (value) => state.insertions = value, true, () => revalidate());
          const deletions = this._createInput(stats, disposables, localize("sessions.debug.chatPills.deletions", "Deletions"), state.deletions, (value) => state.deletions = value, true, () => revalidate());
          numericInputs = [files, insertions, deletions];
          const autoIncrementLabel = localize("sessions.debug.chatPills.autoIncrementChanges", "Automatically increase insertions and deletions every 2 seconds");
          const autoIncrementRow = DOM.append(form, $(".session-chat-pills-debug-checkbox-row"));
          const autoIncrementCheckbox = disposables.add(new Checkbox(autoIncrementLabel, state.autoIncrementChanges, defaultCheckboxStyles));
          DOM.append(autoIncrementRow, autoIncrementCheckbox.domNode);
          const autoIncrementLabelElement = DOM.append(autoIncrementRow, $("span.session-chat-pills-debug-checkbox-label", void 0, autoIncrementLabel));
          const setAutoIncrement = (value) => {
            autoIncrementCheckbox.checked = value;
            state.autoIncrementChanges = value;
          };
          disposables.add(autoIncrementCheckbox.onChange(() => state.autoIncrementChanges = autoIncrementCheckbox.checked));
          disposables.add(DOM.addDisposableListener(autoIncrementLabelElement, DOM.EventType.CLICK, () => setAutoIncrement(!autoIncrementCheckbox.checked)));
          this._createInput(form, disposables, localize("sessions.debug.chatPills.markdownFiles", "Markdown File Names"), state.markdownFiles, (value) => state.markdownFiles = value);
          this._createInput(form, disposables, localize("sessions.debug.chatPills.subagents", "Subagent Names"), state.subagents, (value) => state.subagents = value);
          this._createInput(form, disposables, localize("sessions.debug.chatPills.browsers", "Browser Labels"), state.browsers, (value) => state.browsers = value);
          DOM.append(form, $("h3.session-chat-pills-debug-heading", void 0, localize("sessions.debug.chatPills.inputBanners", "Input Banners")));
          const bannerStats = DOM.append(form, $(".session-chat-pills-debug-banner-stats"));
          const ciFailed = this._createInput(bannerStats, disposables, localize("sessions.debug.chatPills.ciFailed", "Failed CI Checks"), state.ciFailed, (value) => state.ciFailed = value, true, () => revalidate());
          const ciPending = this._createInput(bannerStats, disposables, localize("sessions.debug.chatPills.ciPending", "Pending CI Checks"), state.ciPending, (value) => state.ciPending = value, true, () => revalidate());
          const prFeedback = this._createInput(bannerStats, disposables, localize("sessions.debug.chatPills.prFeedback", "PR Feedback to Address"), state.prFeedback, (value) => state.prFeedback = value, true, () => revalidate());
          const agentFeedback = this._createInput(bannerStats, disposables, localize("sessions.debug.chatPills.agentFeedback", "Agent Feedback to Address"), state.agentFeedback, (value) => state.agentFeedback = value, true, () => revalidate());
          numericInputs = [...numericInputs, ciFailed, ciPending, prFeedback, agentFeedback];
          revalidate = () => {
            const valid = numericInputs.every((input) => input.validate() !== MessageType.ERROR);
            if (applyButton) {
              applyButton.enabled = valid;
            }
          };
          revalidate();
        }
      }, this._keybindingService, this._layoutService, this._hostService)
    ));
    try {
      const result = await dialog.show();
      if (this._activeToolbar !== toolbar) {
        return;
      }
      if (result.button === 1) {
        this._setDebugData(void 0);
        return;
      }
      if (result.button !== 0 || numericInputs.some((input) => input.validate() === MessageType.ERROR)) {
        return;
      }
      this._setDebugData({
        stats: {
          files: Number(state.files),
          insertions: Number(state.insertions),
          deletions: Number(state.deletions)
        },
        markdownFiles: this._parseList(state.markdownFiles),
        subagents: this._parseList(state.subagents),
        browsers: this._parseList(state.browsers),
        ciFailed: Number(state.ciFailed),
        ciPending: Number(state.ciPending),
        prFeedback: Number(state.prFeedback),
        agentFeedback: Number(state.agentFeedback),
        autoIncrementChanges: state.autoIncrementChanges
      });
    } finally {
      disposables.dispose();
    }
  }
  _createInput(container, disposables, label, value, onChange, numeric = false, onDidChange) {
    const row = DOM.append(container, $(".session-chat-pills-debug-row"));
    DOM.append(row, $("span.session-chat-pills-debug-label", void 0, label));
    const input = disposables.add(new InputBox(DOM.append(row, $(".session-chat-pills-debug-input")), this._contextViewService, {
      inputBoxStyles: defaultInputBoxStyles,
      ariaLabel: label,
      type: numeric ? "number" : "text",
      flexibleHeight: !numeric,
      flexibleMaxHeight: 100,
      validationOptions: numeric ? {
        validation: (raw) => {
          return isNonNegativeIntegerInput(raw) ? null : { content: localize("sessions.debug.chatPills.nonNegativeInteger", "Enter a whole number greater than or equal to 0."), type: MessageType.ERROR };
        }
      } : void 0
    }));
    input.value = value;
    if (numeric) {
      input.inputElement.min = "0";
      input.inputElement.step = "1";
    }
    disposables.add(input.onDidChange((changed) => {
      onChange(changed);
      onDidChange?.();
    }));
    return input;
  }
  _parseList(value) {
    return value.split(/[\n,]/).map((item) => item.trim()).filter((item) => item.length > 0);
  }
  _setDebugData(data) {
    this._changesTimer.clear();
    this._debugData = data;
    this._applyDebugData(data);
    if (data?.autoIncrementChanges && this._activeToolbar) {
      const timer = new DOM.WindowIntervalTimer(this._activeToolbar.element);
      this._changesTimer.value = timer;
      timer.cancelAndSet(() => this._incrementChanges(), 2e3);
    }
  }
  _applyDebugData(data) {
    this._activeToolbar?.setDebugData(data);
    this._activeBanners?.setDebugData(data);
  }
  _incrementChanges() {
    const data = this._debugData;
    if (!data?.autoIncrementChanges || !this._activeToolbar) {
      this._changesTimer.clear();
      return;
    }
    this._debugData = {
      ...data,
      stats: {
        ...data.stats,
        insertions: data.stats.insertions + weightedRandomDebugIncrement(),
        deletions: data.stats.deletions + weightedRandomDebugIncrement()
      }
    };
    this._applyDebugData(this._debugData);
  }
  _setActiveTarget(toolbar, banners) {
    if (this._activeToolbar === toolbar && this._activeBanners === banners) {
      return;
    }
    this._setDebugData(void 0);
    this._activeToolbar = toolbar;
    this._activeBanners = banners;
    this._availableContext.set(!!toolbar);
  }
};
SessionChatPillsDebugService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, ILayoutService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IHostService)
], SessionChatPillsDebugService);
registerSingleton(ISessionChatPillsDebugService, SessionChatPillsDebugService, InstantiationType.Delayed);
export {
  ISessionChatPillsDebugService,
  isNonNegativeIntegerInput,
  weightedRandomDebugIncrement
};
