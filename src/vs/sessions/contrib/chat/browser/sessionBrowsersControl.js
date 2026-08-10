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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { BrowserEditorInput } from "../../../../workbench/contrib/browserView/common/browserEditorInput.js";
import { browserViewUrlMatches, BrowserViewSharingState, IBrowserViewWorkbenchService } from "../../../../workbench/contrib/browserView/common/browserView.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { ChatOriginKind } from "../../../services/sessions/common/session.js";
import { SessionActivityPill } from "./sessionActivityPill.js";
let SessionBrowsersControl = class extends Disposable {
  constructor(_session, _chat, _enabled, _browserViewService, actionWidgetService, _editorService) {
    super();
    this._session = _session;
    this._chat = _chat;
    this._enabled = _enabled;
    this._browserViewService = _browserViewService;
    this._editorService = _editorService;
    this._browserListeners = this._register(new MutableDisposable());
    /** Chats whose browsers belong to this pill: the viewed chat and its subagents. */
    this._ownerIds = /* @__PURE__ */ new Set();
    this._enabledValue = false;
    this._pill = this._register(new SessionActivityPill({
      className: "session-browsers",
      widgetId: "sessionBrowsers",
      getWidgetAriaLabel: () => localize("browsers.ariaLabel", "Browsers"),
      getSummary: (activities) => this._summary(activities),
      openActivity: (activity) => this._openActivity(activity)
    }, actionWidgetService));
    this.element = this._pill.element;
    this.isVisible = this._pill.isVisible;
    this._register(autorun((reader) => {
      const session = this._session.read(reader);
      const chat = this._chat.read(reader);
      this._currentChat = chat;
      this._enabledValue = this._enabled.read(reader);
      this._ownerIds = session && chat ? this._collectOwnerIds(session, chat, reader) : /* @__PURE__ */ new Set();
      this._refresh();
    }));
    this._register(this._browserViewService.onDidChangeBrowserViews(() => this._refreshBrowserListeners()));
    this._refreshBrowserListeners();
  }
  setDebugData(data) {
    this._debugData = data;
    this._refresh();
  }
  _refreshBrowserListeners() {
    const store = new DisposableStore();
    this._browserListeners.value = store;
    for (const input of this._browserViewService.getKnownBrowserViews().values()) {
      store.add(input.onDidChangeLabel(() => this._refresh()));
    }
    this._refresh();
  }
  _refresh() {
    const activities = this._debugData ? this._debugData.browsers.map((label) => ({ label, icon: Codicon.globe, input: void 0 })) : this._enabledValue ? this._collectBrowserActivities() : [];
    this._pill.setCategories([{ title: localize("browsers.browsers", "Browsers"), activities }]);
  }
  _summary(activities) {
    return {
      icon: Codicon.globe,
      label: localize("browsers.activeBrowsers", "{0} Active Browsers", activities.length),
      ariaLabel: localize("browsers.show", "Show {0} browsers", activities.length)
    };
  }
  _collectOwnerIds(session, chat, reader) {
    const ownerIds = /* @__PURE__ */ new Set([chat.resource.toString()]);
    for (const candidate of session.chats.read(reader)) {
      if (candidate.origin?.kind === ChatOriginKind.Tool && candidate.origin.parentChat && isEqual(candidate.origin.parentChat, chat.resource)) {
        ownerIds.add(candidate.resource.toString());
      }
    }
    return ownerIds;
  }
  _collectBrowserActivities() {
    const activities = [];
    for (const input of this._browserViewService.getKnownBrowserViews().values()) {
      const ownerId = input.model?.owner.sessionId;
      if (ownerId && this._ownerIds.has(ownerId)) {
        activities.push({
          input,
          icon: Codicon.globe,
          label: input.title?.trim() || localize("browsers.browser", "Browser")
        });
      }
    }
    return activities;
  }
  async _openActivity(activity) {
    if (!activity.input) {
      return;
    }
    const input = this._getBrowserInputToOpen(activity.input);
    const existing = this._editorService.findEditors(input.resource).find((identifier) => identifier.editor instanceof BrowserEditorInput && identifier.editor.id === input.id);
    const targetGroup = existing?.groupId ?? await this._browserViewService.getPreferredGroup();
    await this._editorService.openEditor(input, void 0, targetGroup);
  }
  _getBrowserInputToOpen(input) {
    const url = input.url;
    if (input.model?.sharingState === BrowserViewSharingState.Shared || !url) {
      return input;
    }
    const activeSessionId = this._currentChat?.resource.toString();
    const shared = [...this._browserViewService.getContextualBrowserViews({ activeSessionId }).values()].filter((candidate) => candidate.model?.sharingState === BrowserViewSharingState.Shared && browserViewUrlMatches(candidate.url, url));
    return shared.find((candidate) => candidate.url === url) ?? shared.at(0) ?? input;
  }
};
SessionBrowsersControl = __decorateClass([
  __decorateParam(3, IBrowserViewWorkbenchService),
  __decorateParam(4, IActionWidgetService),
  __decorateParam(5, IEditorService)
], SessionBrowsersControl);
export {
  SessionBrowsersControl
};
