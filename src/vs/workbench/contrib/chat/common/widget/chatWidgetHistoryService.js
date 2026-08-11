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
import { equals as arraysEqual } from "../../../../../base/common/arrays.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { Memento } from "../../../../common/memento.js";
import { CHAT_PROVIDER_ID } from "../participants/chatParticipantContribTypes.js";
import { ChatAgentLocation, ChatModeKind } from "../constants.js";
const IChatWidgetHistoryService = createDecorator("IChatWidgetHistoryService");
const ChatInputHistoryMaxEntries = 40;
let ChatWidgetHistoryService = class extends Disposable {
  constructor(storageService) {
    super();
    this._onDidChangeHistory = this._register(new Emitter());
    this.changed = false;
    this.onDidChangeHistory = this._onDidChangeHistory.event;
    this.memento = new Memento("interactive-session", storageService);
    const loadedState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this.viewState = loadedState;
    this._register(storageService.onWillSaveState(() => {
      if (this.changed) {
        this.memento.saveMemento();
        this.changed = false;
      }
    }));
  }
  getHistory(location, historyKey) {
    const key = this.getKey(location, historyKey);
    const history = this.viewState.history?.[key] ?? [];
    return history.map((entry) => this.migrateHistoryEntry(entry));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  migrateHistoryEntry(entry) {
    if (entry.inputText !== void 0) {
      return entry;
    }
    const oldEntry = entry;
    const oldState = oldEntry.state ?? {};
    let modeId;
    let modeKind;
    if (oldState.chatMode) {
      if (typeof oldState.chatMode === "string") {
        modeId = oldState.chatMode;
        modeKind = Object.values(ChatModeKind).includes(oldState.chatMode) ? oldState.chatMode : void 0;
      } else if (typeof oldState.chatMode === "object" && oldState.chatMode !== null) {
        const oldMode = oldState.chatMode;
        modeId = oldMode.id ?? ChatModeKind.Ask;
        modeKind = oldMode.id && Object.values(ChatModeKind).includes(oldMode.id) ? oldMode.id : void 0;
      } else {
        modeId = ChatModeKind.Ask;
        modeKind = ChatModeKind.Ask;
      }
    } else {
      modeId = ChatModeKind.Ask;
      modeKind = ChatModeKind.Ask;
    }
    return {
      inputText: oldEntry.text ?? "",
      attachments: oldState.chatContextAttachments ?? [],
      mode: {
        id: modeId,
        kind: modeKind
      },
      contrib: oldEntry.state || {},
      selectedModel: void 0,
      selections: []
    };
  }
  getKey(location, historyKey) {
    const locationKey = location === ChatAgentLocation.Chat ? CHAT_PROVIDER_ID : location;
    return historyKey === void 0 ? locationKey : `${locationKey}:${historyKey}`;
  }
  append(location, history, historyKey) {
    this.viewState.history ??= {};
    const key = this.getKey(location, historyKey);
    this.viewState.history[key] = this.getHistory(location, historyKey).concat(history).slice(-ChatInputHistoryMaxEntries);
    this.changed = true;
    this._onDidChangeHistory.fire({ kind: "append", location, historyKey, entry: history });
  }
  moveHistory(location, fromHistoryKey, toHistoryKey) {
    if (fromHistoryKey === toHistoryKey) {
      return;
    }
    const fromHistory = this.getHistory(location, fromHistoryKey);
    if (fromHistory.length === 0) {
      return;
    }
    this.viewState.history ??= {};
    const fromKey = this.getKey(location, fromHistoryKey);
    const toKey = this.getKey(location, toHistoryKey);
    this.viewState.history[toKey] = this.getHistory(location, toHistoryKey).concat(fromHistory).slice(-ChatInputHistoryMaxEntries);
    delete this.viewState.history[fromKey];
    this.changed = true;
    this._onDidChangeHistory.fire({ kind: "move", location, fromHistoryKey, toHistoryKey });
  }
  clearHistory() {
    this.viewState.history = {};
    this.changed = true;
    this._onDidChangeHistory.fire({ kind: "clear" });
  }
};
ChatWidgetHistoryService = __decorateClass([
  __decorateParam(0, IStorageService)
], ChatWidgetHistoryService);
let ChatHistoryNavigator = class extends Disposable {
  constructor(location, chatWidgetHistoryService) {
    super();
    this.location = location;
    this.chatWidgetHistoryService = chatWidgetHistoryService;
    this._overlay = [];
    this._history = this.chatWidgetHistoryService.getHistory(this.location, this._historyKey);
    this._currentIndex = this._history.length;
    this._register(this.chatWidgetHistoryService.onDidChangeHistory((e) => {
      if (e.kind === "append") {
        if (e.location !== this.location || e.historyKey !== this._historyKey) {
          return;
        }
        const prevLength = this._history.length;
        this._history = this.chatWidgetHistoryService.getHistory(this.location, this._historyKey);
        const newLength = this._history.length;
        if (prevLength === newLength) {
          this._overlay.shift();
          if (this._currentIndex < this._history.length) {
            this._currentIndex = Math.max(this._currentIndex - 1, 0);
          }
        } else if (this._currentIndex === prevLength) {
          this._currentIndex = newLength;
        }
      } else if (e.kind === "clear") {
        this._history = [];
        this._currentIndex = 0;
        this._overlay = [];
      } else if (e.kind === "move") {
        if (e.location !== this.location || e.fromHistoryKey !== this._historyKey && e.toHistoryKey !== this._historyKey) {
          return;
        }
        this._history = this.chatWidgetHistoryService.getHistory(this.location, this._historyKey);
        this._currentIndex = this._history.length;
        this._overlay = [];
      }
    }));
  }
  get values() {
    return this.chatWidgetHistoryService.getHistory(this.location, this._historyKey);
  }
  setHistoryKey(historyKey) {
    if (this._historyKey === historyKey) {
      return;
    }
    this._historyKey = historyKey;
    this._history = this.chatWidgetHistoryService.getHistory(this.location, this._historyKey);
    this._currentIndex = this._history.length;
    this._overlay = [];
  }
  isAtEnd() {
    return this._currentIndex === Math.max(this._history.length, this._overlay.length);
  }
  isAtStart() {
    return this._currentIndex === 0;
  }
  /**
   * Replaces a history entry at the current index in this view of the history.
   * Allows editing of old history entries while preventing accidental navigation
   * from losing the edits.
   */
  overlay(entry) {
    this._overlay[this._currentIndex] = entry;
  }
  resetCursor() {
    this._currentIndex = this._history.length;
  }
  previous() {
    this._currentIndex = Math.max(this._currentIndex - 1, 0);
    return this.current();
  }
  next() {
    this._currentIndex = Math.min(this._currentIndex + 1, this._history.length);
    return this.current();
  }
  current() {
    return this._overlay[this._currentIndex] ?? this._history[this._currentIndex];
  }
  /**
   * Appends a new entry to the navigator. Resets the state back to the end
   * and clears any overlayed entries.
   */
  append(entry) {
    this._overlay = [];
    this._currentIndex = this._history.length;
    if (!entriesEqual(this._history.at(-1), entry)) {
      this.chatWidgetHistoryService.append(this.location, entry, this._historyKey);
    }
  }
};
ChatHistoryNavigator = __decorateClass([
  __decorateParam(1, IChatWidgetHistoryService)
], ChatHistoryNavigator);
function entriesEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  if (a.inputText !== b.inputText) {
    return false;
  }
  if (!arraysEqual(a.attachments, b.attachments, (x, y) => x.id === y.id)) {
    return false;
  }
  return true;
}
export {
  ChatHistoryNavigator,
  ChatInputHistoryMaxEntries,
  ChatWidgetHistoryService,
  IChatWidgetHistoryService
};
