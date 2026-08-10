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
import { TimeoutTimer } from "../../../base/common/async.js";
import { BugIndicatingError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../nls.js";
import { Action2 } from "../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
const IInlineCompletionsService = createDecorator("IInlineCompletionsService");
const InlineCompletionsSnoozing = new RawContextKey("inlineCompletions.snoozed", false, localize("inlineCompletions.snoozed", "Whether inline completions are currently snoozed"));
let InlineCompletionsService = class extends Disposable {
  constructor(_contextKeyService, _telemetryService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._telemetryService = _telemetryService;
    this._onDidChangeIsSnoozing = this._register(new Emitter());
    this.onDidChangeIsSnoozing = this._onDidChangeIsSnoozing.event;
    // 5 minutes
    this._snoozeTimeEnd = void 0;
    this._recentCompletionIds = [];
    this._timer = this._register(new TimeoutTimer());
    const inlineCompletionsSnoozing = InlineCompletionsSnoozing.bindTo(this._contextKeyService);
    this._register(this.onDidChangeIsSnoozing(() => inlineCompletionsSnoozing.set(this.isSnoozing())));
  }
  static {
    this.SNOOZE_DURATION = 3e5;
  }
  get snoozeTimeLeft() {
    if (this._snoozeTimeEnd === void 0) {
      return 0;
    }
    return Math.max(0, this._snoozeTimeEnd - Date.now());
  }
  snooze(durationMs = InlineCompletionsService.SNOOZE_DURATION) {
    this.setSnoozeDuration(durationMs + this.snoozeTimeLeft);
  }
  setSnoozeDuration(durationMs) {
    if (durationMs < 0) {
      throw new BugIndicatingError(`Invalid snooze duration: ${durationMs}. Duration must be non-negative.`);
    }
    if (durationMs === 0) {
      this.cancelSnooze();
      return;
    }
    const wasSnoozing = this.isSnoozing();
    const timeLeft = this.snoozeTimeLeft;
    this._snoozeTimeEnd = Date.now() + durationMs;
    if (!wasSnoozing) {
      this._onDidChangeIsSnoozing.fire(true);
    }
    this._timer.cancelAndSet(
      () => {
        if (!this.isSnoozing()) {
          this._onDidChangeIsSnoozing.fire(false);
        } else {
          throw new BugIndicatingError("Snooze timer did not fire as expected");
        }
      },
      this.snoozeTimeLeft + 1
    );
    this._reportSnooze(durationMs - timeLeft, durationMs);
  }
  isSnoozing() {
    return this.snoozeTimeLeft > 0;
  }
  cancelSnooze() {
    if (this.isSnoozing()) {
      this._reportSnooze(-this.snoozeTimeLeft, 0);
      this._snoozeTimeEnd = void 0;
      this._timer.cancel();
      this._onDidChangeIsSnoozing.fire(false);
    }
  }
  reportNewCompletion(requestUuid) {
    this._lastCompletionId = requestUuid;
    this._recentCompletionIds.unshift(requestUuid);
    if (this._recentCompletionIds.length > 5) {
      this._recentCompletionIds.pop();
    }
  }
  _reportSnooze(deltaMs, totalMs) {
    const deltaSeconds = Math.round(deltaMs / 1e3);
    const totalSeconds = Math.round(totalMs / 1e3);
    this._telemetryService.publicLog2("inlineCompletions.snooze", {
      deltaSeconds,
      totalSeconds,
      lastCompletionId: this._lastCompletionId,
      recentCompletionIds: this._recentCompletionIds
    });
  }
};
InlineCompletionsService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ITelemetryService)
], InlineCompletionsService);
registerSingleton(IInlineCompletionsService, InlineCompletionsService, InstantiationType.Delayed);
const snoozeInlineSuggestId = "editor.action.inlineSuggest.snooze";
const cancelSnoozeInlineSuggestId = "editor.action.inlineSuggest.cancelSnooze";
const LAST_SNOOZE_DURATION_KEY = "inlineCompletions.lastSnoozeDuration";
class SnoozeInlineCompletion extends Action2 {
  static {
    this.ID = snoozeInlineSuggestId;
  }
  constructor() {
    super({
      id: SnoozeInlineCompletion.ID,
      title: localize2("action.inlineSuggest.snooze", "Snooze Inline Suggestions"),
      precondition: ContextKeyExpr.true(),
      f1: true
    });
  }
  async run(accessor, ...args) {
    const quickInputService = accessor.get(IQuickInputService);
    const inlineCompletionsService = accessor.get(IInlineCompletionsService);
    const storageService = accessor.get(IStorageService);
    let durationMs;
    if (args.length > 0 && typeof args[0] === "number") {
      durationMs = args[0] * 6e4;
    }
    if (!durationMs) {
      durationMs = await this.getDurationFromUser(quickInputService, storageService);
    }
    if (durationMs) {
      inlineCompletionsService.setSnoozeDuration(durationMs);
    }
  }
  async getDurationFromUser(quickInputService, storageService) {
    const lastSelectedDuration = storageService.getNumber(LAST_SNOOZE_DURATION_KEY, StorageScope.PROFILE, 3e5);
    const predefinedItems = [
      { label: localize("snooze.1minute", "1 minute"), id: "1", value: 6e4 },
      { label: localize("snooze.5minutes", "5 minutes"), id: "5", value: 3e5 },
      { label: localize("snooze.10minutes", "10 minutes"), id: "10", value: 6e5 },
      { label: localize("snooze.15minutes", "15 minutes"), id: "15", value: 9e5 },
      { label: localize("snooze.30minutes", "30 minutes"), id: "30", value: 18e5 },
      { label: localize("snooze.60minutes", "60 minutes"), id: "60", value: 36e5 }
    ];
    let items = predefinedItems;
    if (lastSelectedDuration > 0 && !predefinedItems.some((item) => item.value === lastSelectedDuration)) {
      const minutes = lastSelectedDuration / 6e4;
      const customItem = {
        label: localize("snooze.lastCustom", "{0} minutes (Last used)", minutes),
        id: "last-custom",
        value: lastSelectedDuration,
        description: localize("snooze.lastUsed", "Last used custom duration")
      };
      const index = predefinedItems.findIndex((item) => item.value > lastSelectedDuration);
      if (index === -1) {
        items = [...predefinedItems, customItem];
      } else {
        items = [...predefinedItems.slice(0, index), customItem, ...predefinedItems.slice(index)];
      }
    }
    items.push({ label: localize("snooze.custom", "Custom..."), id: "custom", value: -1 });
    const picked = await quickInputService.pick(items, {
      placeHolder: localize("snooze.placeholder", "Select snooze duration for Inline Suggestions"),
      activeItem: items.find((item) => item.value === lastSelectedDuration)
    });
    if (picked) {
      if (picked.id === "custom") {
        return this.getCustomDurationFromUser(quickInputService, storageService);
      }
      storageService.store(LAST_SNOOZE_DURATION_KEY, picked.value, StorageScope.PROFILE, StorageTarget.USER);
      return picked.value;
    }
    return void 0;
  }
  async getCustomDurationFromUser(quickInputService, storageService) {
    const customMinutes = await quickInputService.input({
      placeHolder: localize("snooze.customPlaceholder", "Duration in minutes (e.g. 90)"),
      prompt: localize("snooze.customPrompt", "Enter snooze duration in minutes"),
      validateInput: async (value) => {
        const n = Number(value);
        if (isNaN(n) || n <= 0 || !Number.isFinite(n)) {
          return localize("snooze.invalidInput", "Please enter a positive number");
        }
        return void 0;
      }
    });
    if (customMinutes) {
      const ms = Number(customMinutes) * 6e4;
      storageService.store(LAST_SNOOZE_DURATION_KEY, ms, StorageScope.PROFILE, StorageTarget.USER);
      return ms;
    }
    return void 0;
  }
}
class CancelSnoozeInlineCompletion extends Action2 {
  static {
    this.ID = cancelSnoozeInlineSuggestId;
  }
  constructor() {
    super({
      id: CancelSnoozeInlineCompletion.ID,
      title: localize2("action.inlineSuggest.cancelSnooze", "Cancel Snooze Inline Suggestions"),
      precondition: InlineCompletionsSnoozing,
      f1: true
    });
  }
  async run(accessor) {
    accessor.get(IInlineCompletionsService).cancelSnooze();
  }
}
export {
  CancelSnoozeInlineCompletion,
  IInlineCompletionsService,
  InlineCompletionsService,
  SnoozeInlineCompletion
};
