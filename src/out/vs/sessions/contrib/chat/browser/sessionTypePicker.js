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
import * as dom from "../../../../base/browser/dom.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsProvidersService } from "../../../services/sessions/browser/sessionsProvidersService.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { SessionStatus } from "../../../services/sessions/common/session.js";
import { Emitter } from "../../../../base/common/event.js";
import { isWeb } from "../../../../base/common/platform.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IChatSessionsService } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ILanguageModelsService } from "../../../../workbench/contrib/chat/common/languageModels.js";
import { getSessionTypeAvailability, getSessionTypeUnavailableDescription, getSessionTypeUnavailableHover, SessionTypeAvailability } from "../../../../workbench/contrib/chat/browser/agentSessions/sessionTypeAvailability.js";
import { IChatEntitlementService } from "../../../../workbench/services/chat/common/chatEntitlementService.js";
import { markOnboardingTarget } from "../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js";
import { reportNewChatPickerClosed } from "./newChatPickerTelemetry.js";
import { SessionHarnessPickerVisibleContext } from "../../../common/contextkeys.js";
const STORAGE_KEY_LAST_SESSION_TYPE = "sessions.userSelectedSessionType";
function pickEquals(a, b) {
  return a?.providerId === b?.providerId && a?.sessionTypeId === b?.sessionTypeId;
}
const DEFAULT_TELEMETRY_SOURCE = "NewChatSessionTypePicker";
let SessionTypePicker = class extends Disposable {
  constructor(_session, _options, actionWidgetService, sessionsManagementService, sessionsProvidersService, storageService, telemetryService, chatSessionsService, chatEntitlementService, languageModelsService, contextKeyService) {
    super();
    this._session = _session;
    this._options = _options;
    this.actionWidgetService = actionWidgetService;
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsProvidersService = sessionsProvidersService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this.chatSessionsService = chatSessionsService;
    this.chatEntitlementService = chatEntitlementService;
    this.languageModelsService = languageModelsService;
    this._onDidSelectSessionType = this._register(new Emitter());
    this.onDidSelectSessionType = this._onDidSelectSessionType.event;
    /**
     * Fires whenever the effective {@link selectedPick} changes for any reason:
     * an explicit user pick OR a recompute (e.g. a provider advertising its
     * session types late). Unlike {@link onDidSelectSessionType}, which only
     * covers explicit picks, this lets consumers that cache the pick stay in
     * sync when the displayed default shifts on its own.
     */
    this._onDidChangeSelectedPick = this._register(new Emitter());
    this.onDidChangeSelectedPick = this._onDidChangeSelectedPick.event;
    this._modelTargetChatSessionType = observableValue(this, void 0);
    this.modelTargetChatSessionType = this._modelTargetChatSessionType;
    /** Session types the active session's folder can be served by, across all providers. */
    this._folderSessionTypes = [];
    this._folderSourceWatch = this._register(new MutableDisposable());
    this._quickChatSourceWatch = this._register(new MutableDisposable());
    this._renderDisposables = this._register(new DisposableStore());
    this._visibleKey = SessionHarnessPickerVisibleContext.bindTo(contextKeyService);
    this._register(toDisposable(() => this._visibleKey.reset()));
    this._picked = this._readStoredPick();
    this._register(autorun((reader) => {
      this._session.read(reader);
      this._recompute();
    }));
    this._register(this.sessionsManagementService.onDidChangeSessionTypes(() => this._recompute()));
  }
  /**
   * Recompute the available session types and the displayed pick from the
   * current source (session or folder), then refresh the trigger label.
   * Invoked reactively when the session, folder, or advertised types change.
   */
  _recompute() {
    this._folderSessionTypes = this._resolveFolderSessionTypes();
    const previous = this._picked;
    this._picked = this._computeCurrentPick();
    const pick = this._picked;
    if (this._quickChatSource?.get() && pick && !pick.providerId) {
      const concrete = this._folderSessionTypes.find((type) => type.sessionType.id === pick.sessionTypeId);
      if (concrete) {
        this._picked = { providerId: concrete.providerId, sessionTypeId: concrete.sessionType.id };
      }
    }
    this._updateModelTargetChatSessionType();
    this._updateTriggerLabel();
    if (!pickEquals(previous, this._picked)) {
      this._onDidChangeSelectedPick.fire(this._picked);
    }
  }
  /**
   * The session types to offer, sourced from the folder when a folder source
   * is set (see {@link setFolderSource}), otherwise from the active session.
   */
  _resolveFolderSessionTypes() {
    if (this._folderSource) {
      if (this._quickChatSource?.get()) {
        return this.sessionsManagementService.getQuickChatSessionTypes();
      }
      const folderUri = this._folderSource.get();
      return folderUri ? this.sessionsManagementService.getSessionTypesForFolder(folderUri) : [];
    }
    const session = this._session.get();
    return session ? this._sessionTypesForSession(session) : [];
  }
  /** The pick to display for the current source: the active session's type, otherwise the folder or stored default. */
  _computeCurrentPick() {
    const session = this._session.get();
    if (!this._folderSource && session) {
      const pick = { providerId: session.providerId, sessionTypeId: session.sessionType };
      return session.status.get() === SessionStatus.Untitled ? this._offeredPick(pick) : pick;
    }
    if (!this._folderSource) {
      return this._offeredPick(this._readStoredPick());
    }
    if (this._pendingInitialPick) {
      if (this._pickServedByFolder(this._pendingInitialPick)) {
        const pick = this._pendingInitialPick;
        this._pendingInitialPick = void 0;
        return pick;
      }
      return this._pendingInitialPick;
    }
    const candidate = this._picked ?? this._readStoredPick();
    if (this._pickServedByFolder(candidate)) {
      return candidate;
    }
    const stored = this._readStoredPick();
    if (this._pickServedByFolder(stored)) {
      return stored;
    }
    const preferred = this._folderSessionTypes[0];
    return preferred ? { providerId: preferred.providerId, sessionTypeId: preferred.sessionType.id } : void 0;
  }
  _pickServedByFolder(pick) {
    return !!pick && this._folderSessionTypes.some((t) => t.sessionType.id === pick.sessionTypeId && (pick.providerId === void 0 || t.providerId === pick.providerId));
  }
  /**
   * Constrains a pick to the types the picker actually offers, falling back to
   * the preferred (first) type when it doesn't. A remembered pick outlives the
   * harness that produced it: a session type can stop being advertised while
   * the stored preference still names it. Displaying it as selected while the
   * dropdown hides it would let the user start a session on a harness they can
   * no longer pick.
   *
   * An empty offer list means the types aren't known yet (no session or folder
   * to source them from, or a provider still connecting), so the pick is left
   * alone until something is actually offered.
   */
  _offeredPick(pick) {
    if (this._folderSessionTypes.length === 0 || this._pickServedByFolder(pick)) {
      return pick;
    }
    const preferred = this._folderSessionTypes[0];
    return { providerId: preferred.providerId, sessionTypeId: preferred.sessionType.id };
  }
  /** Drive the picker from a folder instead of the active session, optionally seeding the initial pick. */
  setFolderSource(source, options) {
    this._folderSource = source;
    this._picked = options?.initialPick ?? this._readStoredPick();
    this._pendingInitialPick = options?.preserveUnavailableInitialPick ? options.initialPick : void 0;
    const initialFolder = source.get();
    this._folderSourceWatch.value = autorun((reader) => {
      const folder = source.read(reader);
      if (!isEqual(folder, initialFolder)) {
        this._pendingInitialPick = void 0;
      }
      this._recompute();
    });
  }
  /** Switch a folder-driven picker to the quick-chat type catalog while the source is true. */
  setQuickChatSource(source) {
    this._quickChatSource = source;
    const initialQuickChat = source.get();
    this._quickChatSourceWatch.value = autorun((reader) => {
      const isQuickChat = source.read(reader);
      if (isQuickChat !== initialQuickChat) {
        this._pendingInitialPick = void 0;
      }
      this._recompute();
    });
  }
  get selectedPick() {
    return this._picked;
  }
  /**
   * The session types to offer for a session: all quick-chat types when the
   * session is a workspace-less quick chat, otherwise the folder's types.
   */
  _sessionTypesForSession(session) {
    if (session.isQuickChat?.get() ?? false) {
      return this.sessionsManagementService.getQuickChatSessionTypes();
    }
    const folderUri = session.workspace.get()?.folders[0]?.root;
    return folderUri ? this.sessionsManagementService.getSessionTypesForFolder(folderUri) : [];
  }
  /**
   * The session type the user explicitly picked, read from the stored
   * preference. Unlike {@link selectedPick}, this is independent of any
   * active session's type. Returns `undefined` when the user has never
   * picked a type (or changed away from the default), in which case
   * consumers should fall back to {@link getPreferredSessionType}.
   */
  getUserPickedSessionType() {
    return this._readStoredPick();
  }
  /**
   * The preferred session type for {@link folderUri}: the first entry in
   * the folder's session-type list. Recomputed against the live list, so
   * it follows provider changes (e.g. a late-registering agent host that
   * prepends a new type). Used as the default when the user has made no
   * explicit pick.
   */
  getPreferredSessionType(folderUri) {
    const first = this.sessionsManagementService.getSessionTypesForFolder(folderUri)[0];
    return first ? { providerId: first.providerId, sessionTypeId: first.sessionType.id } : void 0;
  }
  render(container, options) {
    this._renderDisposables.clear();
    const slot = dom.append(container, dom.$(".sessions-chat-picker-slot"));
    if (options?.className) {
      const classNames = options.className.split(/\s+/).filter((className) => className.length > 0);
      if (classNames.length > 0) {
        slot.classList.add(...classNames);
      }
    }
    this._renderDisposables.add({ dispose: () => slot.remove() });
    const trigger = dom.append(slot, dom.$("a.action-label"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._renderDisposables.add(markOnboardingTarget(trigger, "sessions.newSession.harnessPicker", {
      open: () => this._showPicker()
    }));
    this._updateTriggerLabel();
    this._renderDisposables.add(Gesture.addTarget(trigger));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._renderDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this._showPicker();
      }));
    }
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this._showPicker();
      }
    }));
  }
  /**
   * Override hook for mobile subclasses. Receives the trigger element so
   * the override can decide where to anchor (or that it doesn't need
   * anchoring at all, e.g. for a bottom sheet).
   */
  _showPicker() {
    if (!this._triggerElement || this.actionWidgetService.isVisible) {
      return;
    }
    const folderTypes = this._resolveFolderSessionTypes();
    this._folderSessionTypes = folderTypes;
    this._updateModelTargetChatSessionType();
    if (folderTypes.length <= 1 && this._pickServedByFolder(this._picked)) {
      return;
    }
    const groups = /* @__PURE__ */ new Map();
    for (const folderType of folderTypes) {
      const provider = this.sessionsProvidersService.getProvider(folderType.providerId);
      const groupTitle = provider?.label ?? folderType.providerId;
      const existing = groups.get(groupTitle);
      if (existing) {
        existing.push(folderType);
      } else {
        groups.set(groupTitle, [folderType]);
      }
    }
    const labelCounts = /* @__PURE__ */ new Map();
    for (const { sessionType } of folderTypes) {
      labelCounts.set(sessionType.label, (labelCounts.get(sessionType.label) ?? 0) + 1);
    }
    const hasDuplicateLabels = Array.from(labelCounts.values()).some((count) => count > 1);
    const showSectionHeaders = groups.size > 1 && hasDuplicateLabels;
    const groupedItems = [];
    for (const [groupTitle, types] of groups) {
      if (showSectionHeaders) {
        if (groupedItems.length > 0) {
          groupedItems.push({ kind: ActionListItemKind.Separator, label: "" });
        }
        groupedItems.push({
          kind: ActionListItemKind.Header,
          group: { title: groupTitle },
          label: groupTitle
        });
      }
      for (const { providerId, sessionType } of types) {
        const isCurrent = this._picked?.providerId === providerId && this._picked?.sessionTypeId === sessionType.id;
        const availability = getSessionTypeAvailability(this.chatSessionsService, this.chatEntitlementService, this.languageModelsService, sessionType.chatSessionType ?? sessionType.id);
        const unavailable = availability !== SessionTypeAvailability.Available;
        const item = {
          providerId,
          sessionTypeId: sessionType.id,
          label: sessionType.label,
          ...isCurrent ? { checked: true } : {},
          ...showSectionHeaders ? { groupLabel: groupTitle } : {}
        };
        groupedItems.push({
          kind: ActionListItemKind.Action,
          label: sessionType.label,
          disabled: unavailable,
          ...unavailable ? {
            description: getSessionTypeUnavailableDescription(availability),
            hover: { content: getSessionTypeUnavailableHover(availability) }
          } : {},
          group: {
            title: "",
            icon: sessionType.icon
          },
          item
        });
      }
    }
    const triggerElement = this._triggerElement;
    const delegate = {
      onSelect: (item) => {
        this.actionWidgetService.hide();
        this._handleSelectedSessionType(item);
      },
      onHide: () => {
        triggerElement.focus();
      }
    };
    this.actionWidgetService.show(
      "sessionTypePicker",
      false,
      groupedItems,
      delegate,
      this._triggerElement,
      void 0,
      [],
      {
        getAriaLabel: (element) => element.item?.groupLabel ? localize("sessionTypePicker.itemAriaLabel", "{0}, {1}", element.label ?? "", element.item.groupLabel) : element.label ?? "",
        getWidgetAriaLabel: () => localize("sessionTypePicker.ariaLabel", "Session Type")
      },
      { minWidth: 200 }
    );
  }
  /**
   * Handles the user picking a session type. Emits `newChatPickerClosed`
   * telemetry (with the previously selected type read from storage, or the
   * in-memory field when nothing is stored). The explicit selection is always
   * persisted — picking the preferred (first) type clears the stored
   * preference, any other pick stores it — while {@link onDidSelectSessionType}
   * fires only when the visible pick actually changed.
   *
   * Shared between desktop (action-widget popup) and mobile (bottom
   * sheet) presentations so both surfaces report identical telemetry.
   */
  _handleSelectedSessionType(pick) {
    this._pendingInitialPick = void 0;
    const stored = this._readStoredPick();
    const beforeId = stored?.sessionTypeId ?? this._picked?.sessionTypeId;
    const beforeLabel = this._folderSessionTypes.find((t) => t.sessionType.id === beforeId)?.sessionType.label;
    const afterLabel = this._folderSessionTypes.find((t) => t.providerId === pick.providerId && t.sessionType.id === pick.sessionTypeId)?.sessionType.label;
    const telemetrySource = this._options?.telemetrySource ?? DEFAULT_TELEMETRY_SOURCE;
    reportNewChatPickerClosed(this.telemetryService, {
      id: telemetrySource,
      name: telemetrySource,
      optionIdBefore: beforeId,
      optionIdAfter: pick.sessionTypeId,
      optionLabelBefore: beforeLabel,
      optionLabelAfter: afterLabel,
      isPII: false
    });
    const preferred = this._folderSessionTypes[0];
    const isDefault = !!preferred && preferred.providerId === pick.providerId && preferred.sessionType.id === pick.sessionTypeId;
    const visiblePickChanged = pick.providerId !== this._picked?.providerId || pick.sessionTypeId !== this._picked?.sessionTypeId;
    this._picked = pick;
    this._updateModelTargetChatSessionType();
    if (this._options?.persistSelection !== false) {
      if (isDefault) {
        this._clearStoredPick();
      } else {
        this._writeStoredPick(pick);
      }
    }
    this._updateTriggerLabel();
    if (visiblePickChanged) {
      this._onDidSelectSessionType.fire(pick);
      this._onDidChangeSelectedPick.fire(this._picked);
    }
  }
  _updateModelTargetChatSessionType() {
    const pick = this._picked;
    const selected = pick ? this._folderSessionTypes.find(
      (type) => type.sessionType.id === pick.sessionTypeId && (pick.providerId === void 0 || type.providerId === pick.providerId)
    ) : void 0;
    this._modelTargetChatSessionType.set(selected ? selected.sessionType.chatSessionType ?? selected.sessionType.id : void 0, void 0);
  }
  _readStoredPick() {
    const raw = this.storageService.get(STORAGE_KEY_LAST_SESSION_TYPE, StorageScope.PROFILE);
    if (!raw) {
      return void 0;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.sessionTypeId === "string") {
        return typeof parsed.providerId === "string" ? { providerId: parsed.providerId, sessionTypeId: parsed.sessionTypeId } : { sessionTypeId: parsed.sessionTypeId };
      }
    } catch {
    }
    return { sessionTypeId: raw };
  }
  _writeStoredPick(pick) {
    const stored = { providerId: pick.providerId, sessionTypeId: pick.sessionTypeId };
    this.storageService.store(STORAGE_KEY_LAST_SESSION_TYPE, JSON.stringify(stored), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  /**
   * Forget any explicit preference (e.g. the user re-selected the default
   * type). The display still reflects the in-memory pick, but consumers
   * reading {@link getUserPickedSessionType} fall back to the preferred type.
   */
  _clearStoredPick() {
    this.storageService.remove(STORAGE_KEY_LAST_SESSION_TYPE, StorageScope.PROFILE);
  }
  _updateTriggerLabel() {
    if (!this._triggerElement) {
      this._visibleKey.set(false);
      return;
    }
    dom.clearNode(this._triggerElement);
    const hideForSingleHarness = isWeb && this._folderSessionTypes.length <= 1 && this._pickServedByFolder(this._picked);
    if (this._folderSessionTypes.length === 0 || hideForSingleHarness) {
      this._triggerElement.classList.add("hidden");
      this._visibleKey.set(false);
      return;
    }
    this._triggerElement.classList.remove("hidden");
    this._visibleKey.set(true);
    const currentType = this._folderSessionTypes.find((t) => t.providerId === this._picked?.providerId && t.sessionType.id === this._picked?.sessionTypeId)?.sessionType ?? this._folderSessionTypes.find((t) => t.sessionType.id === this._picked?.sessionTypeId)?.sessionType;
    const modeIcon = currentType?.icon ?? Codicon.terminal;
    const modeLabel = currentType?.label ?? this._picked?.sessionTypeId ?? "";
    dom.append(this._triggerElement, renderIcon(modeIcon));
    const labelSpan = dom.append(this._triggerElement, dom.$("span.sessions-chat-dropdown-label"));
    labelSpan.textContent = modeLabel;
    if (this._options?.showChevron !== false) {
      const chevron = dom.append(this._triggerElement, renderIcon(Codicon.chevronDownCompact));
      chevron.classList.add("sessions-chat-dropdown-chevron");
    }
    this._triggerElement.ariaLabel = localize("sessionTypePicker.triggerAriaLabel", "Pick Session Type, {0}", modeLabel);
  }
};
SessionTypePicker = __decorateClass([
  __decorateParam(2, IActionWidgetService),
  __decorateParam(3, ISessionsManagementService),
  __decorateParam(4, ISessionsProvidersService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IChatSessionsService),
  __decorateParam(8, IChatEntitlementService),
  __decorateParam(9, ILanguageModelsService),
  __decorateParam(10, IContextKeyService)
], SessionTypePicker);
export {
  SessionTypePicker
};
