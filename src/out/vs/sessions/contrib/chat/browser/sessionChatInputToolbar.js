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
import { $ } from "../../../../base/browser/dom.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, derivedOpts, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ChatTurnPillsWidget, diffStatsEqual, EMPTY_DIFF_STATS, observeTurnStatusPillsEnabled, openChatTurnFile, previewFilesEqual, previewKind } from "../../../../workbench/contrib/chat/browser/widget/chatTurnPills.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { isActiveSessionStatus } from "../../../services/sessions/common/session.js";
import { getTurnChangesEditorLabel, LastTurnChangesMultiDiffSourceResolver } from "./lastTurnChangesMultiDiffSourceResolver.js";
import { SessionBackgroundActivitiesControl } from "./sessionBackgroundActivitiesControl.js";
import { SessionBrowsersControl } from "./sessionBrowsersControl.js";
import "./media/sessionChatInputToolbar.css";
const EMPTY_TURN_DATA = { stats: EMPTY_DIFF_STATS, previewFiles: [] };
function computeTurnData(chat, reader) {
  const changes = chat.lastTurnChanges?.read(reader) ?? [];
  let files = 0, insertions = 0, deletions = 0;
  const created = [];
  const edited = [];
  for (const change of changes) {
    if (!change.isOutsideWorkspace) {
      files++;
      insertions += change.insertions;
      deletions += change.deletions;
      continue;
    }
    if (change.modifiedUri === void 0) {
      continue;
    }
    const uri = isIChatSessionFileChange2(change) ? change.uri : change.modifiedUri;
    const kind = previewKind(uri);
    if (!kind) {
      continue;
    }
    const isCreated = change.originalUri === void 0;
    (isCreated ? created : edited).push({ uri, kind, created: isCreated });
  }
  return {
    stats: { files, insertions, deletions },
    previewFiles: [...created, ...edited]
  };
}
function turnDataEqual(a, b) {
  return diffStatsEqual(a.stats, b.stats) && previewFilesEqual(a.previewFiles, b.previewFiles);
}
let SessionChatInputToolbar = class extends Disposable {
  constructor(_configurationService, _openerService, _sessionsService, _editorService, instantiationService) {
    super();
    this._configurationService = _configurationService;
    this._openerService = _openerService;
    this._sessionsService = _sessionsService;
    this._editorService = _editorService;
    /** Sentinel distinguishing "no override" from an explicit `undefined` session. */
    this._sessionOverride = observableValue("sessionOverride", "unset");
    /** The chat whose last-turn changes are reflected. */
    this._chat = observableValue("chat", void 0);
    this._debugData = observableValue(this, void 0);
    /** The session that owns the reflected chat, from an explicit override or resolved from the chat. */
    this._session = derived((reader) => {
      const override = this._sessionOverride.read(reader);
      if (override !== "unset") {
        return override;
      }
      const chat = this._chat.read(reader);
      if (!chat) {
        return void 0;
      }
      return this._findOwningSession(chat.resource, reader);
    });
    /** Whether pills may show at all: an agent host session with an active turn. */
    this._active = derived((reader) => {
      const session = this._session.read(reader);
      const chat = this._chat.read(reader);
      if (!session || !chat || !isAgentHostProviderId(session.providerId)) {
        return false;
      }
      return isActiveSessionStatus(chat.status.read(reader));
    });
    this.element = $(".session-chat-input-toolbar.hidden");
    this._turnData = derivedOpts({ owner: this, equalsFn: turnDataEqual }, (reader) => {
      const debugData = this._debugData.read(reader);
      if (debugData) {
        return {
          stats: debugData.stats,
          previewFiles: debugData.markdownFiles.map((name) => ({
            uri: URI.from({ scheme: "session-chat-pills-debug", path: `/${name}` }),
            kind: "markdown",
            created: true
          }))
        };
      }
      const chat = this._chat.read(reader);
      return chat ? computeTurnData(chat, reader) : EMPTY_TURN_DATA;
    });
    this._diffStats = derivedOpts({ owner: this, equalsFn: diffStatsEqual }, (reader) => this._turnData.read(reader).stats);
    this._previewFiles = derivedOpts({ owner: this, equalsFn: previewFilesEqual }, (reader) => this._turnData.read(reader).previewFiles);
    const turnStatusPillsEnabled = observeTurnStatusPillsEnabled(this._configurationService);
    const model = {
      stats: this._diffStats,
      previewFiles: this._previewFiles,
      changesEnabled: derived((reader) => this._debugData.read(reader) !== void 0 || this._active.read(reader) && turnStatusPillsEnabled.read(reader)),
      previewEnabled: derived((reader) => this._debugData.read(reader) !== void 0 || this._active.read(reader) && turnStatusPillsEnabled.read(reader)),
      openChanges: () => this._debugData.get() ? void 0 : this._openChanges(),
      openFile: (file) => this._debugData.get() ? void 0 : openChatTurnFile(file, this._openerService, this._configurationService)
    };
    const pills = this._register(instantiationService.createInstance(ChatTurnPillsWidget, model));
    this.element.appendChild(pills.element);
    this._browsers = this._register(instantiationService.createInstance(SessionBrowsersControl, this._session, this._chat, turnStatusPillsEnabled));
    this.element.appendChild(this._browsers.element);
    this._backgroundActivities = this._register(instantiationService.createInstance(SessionBackgroundActivitiesControl, this._session, this._chat, turnStatusPillsEnabled));
    this.element.appendChild(this._backgroundActivities.element);
    this._register(autorun((reader) => {
      const anyVisible = pills.isVisible.read(reader) || this._browsers.isVisible.read(reader) || this._backgroundActivities.isVisible.read(reader);
      this.element.classList.toggle("hidden", !anyVisible);
    }));
  }
  /**
   * Track the currently-viewed chat; the toolbar reflects that chat's last-turn
   * changes and status, resolving the owning session for provider gating and the
   * open-changes action. Clears any explicit {@link setSession} override.
   */
  setChat(chat) {
    this.setDebugData(void 0);
    this._sessionOverride.set("unset", void 0);
    this._chat.set(chat, void 0);
  }
  /**
   * Explicitly set the session and chat to reflect, bypassing chat-to-session
   * resolution. Intended for component fixtures and callers that already hold
   * both.
   */
  setSession(session, chat) {
    this.setDebugData(void 0);
    this._sessionOverride.set(session, void 0);
    this._chat.set(chat, void 0);
  }
  setDebugData(data) {
    this._debugData.set(data, void 0);
    this._browsers.setDebugData(data);
    this._backgroundActivities.setDebugData(data);
  }
  getDebugData() {
    return this._debugData.get();
  }
  _findOwningSession(chatResource, reader) {
    for (const session of this._sessionsService.visibleSessions.read(reader)) {
      if (session?.chats.read(reader).some((c) => isEqual(c.resource, chatResource))) {
        return session;
      }
    }
    const active = this._sessionsService.activeSession.read(reader);
    return active?.chats.read(reader).some((c) => isEqual(c.resource, chatResource)) ? active : void 0;
  }
  async _openChanges() {
    const chat = this._chat.get();
    if (!chat) {
      return;
    }
    const multiDiffSource = LastTurnChangesMultiDiffSourceResolver.getMultiDiffSourceUri(chat.resource);
    await this._editorService.openEditor({
      multiDiffSource,
      label: getTurnChangesEditorLabel(isActiveSessionStatus(chat.status.get()))
    });
  }
};
SessionChatInputToolbar = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IOpenerService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IInstantiationService)
], SessionChatInputToolbar);
export {
  SessionChatInputToolbar
};
