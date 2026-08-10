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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { constObservable, derived, derivedObservableWithCache, ValueWithChangeEventFromObservable } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from "../../../../workbench/contrib/multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { isActiveSessionStatus } from "../../../services/sessions/common/session.js";
const LAST_TURN_CHANGES_MULTI_DIFF_SOURCE_SCHEME = "chat-last-turn-changes-multi-diff-source";
function getTurnChangesEditorLabel(isTurnActive) {
  return isTurnActive ? localize("sessions.currentTurnChanges.title", "Current Turn Changes") : localize("sessions.lastTurnChanges.title", "Last Turn Changes");
}
let LastTurnChangesMultiDiffSourceResolver = class extends Disposable {
  constructor(_sessionsManagementService, multiDiffSourceResolverService) {
    super();
    this._sessionsManagementService = _sessionsManagementService;
    this._register(multiDiffSourceResolverService.registerResolver(this));
  }
  /**
   * Build the multi-diff source URI identifying the last-turn changes editor
   * for a chat.
   */
  static getMultiDiffSourceUri(chatResource) {
    return URI.from({
      scheme: LAST_TURN_CHANGES_MULTI_DIFF_SOURCE_SCHEME,
      query: JSON.stringify({ chatResource: chatResource.toString() })
    });
  }
  /**
   * If the given URI identifies a last-turn changes editor (one built by
   * {@link getMultiDiffSourceUri}), return the chat resource it belongs to;
   * otherwise `undefined`.
   */
  static parseUri(uri) {
    if (uri.scheme !== LAST_TURN_CHANGES_MULTI_DIFF_SOURCE_SCHEME) {
      return void 0;
    }
    let fields;
    try {
      fields = JSON.parse(uri.query);
    } catch {
      return void 0;
    }
    if (typeof fields !== "object" || fields === null || typeof fields.chatResource !== "string") {
      return void 0;
    }
    return URI.parse(fields.chatResource);
  }
  canHandleUri(uri) {
    return LastTurnChangesMultiDiffSourceResolver.parseUri(uri) !== void 0;
  }
  async resolveDiffSource(uri) {
    const chatResource = LastTurnChangesMultiDiffSourceResolver.parseUri(uri);
    const chat = this._sessionsManagementService.getSessionForChatResource(chatResource)?.chat;
    const lastTurnChanges = chat?.lastTurnChanges ?? constObservable([]);
    const label = chat ? derived(this, (reader) => getTurnChangesEditorLabel(isActiveSessionStatus(chat.status.read(reader)))) : constObservable(getTurnChangesEditorLabel(false));
    const resourcesObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const changes = lastTurnChanges.read(reader);
      const previousByKey = /* @__PURE__ */ new Map();
      for (const item of lastValue ?? []) {
        previousByKey.set(item.modifiedUri.toString(), item);
      }
      const items = [];
      const seen = /* @__PURE__ */ new Set();
      let addedNewFile = false;
      for (const change of changes) {
        if (change.isOutsideWorkspace) {
          continue;
        }
        const onDiskUri = isIChatSessionFileChange2(change) ? change.uri : change.modifiedUri;
        if (!onDiskUri) {
          continue;
        }
        const key = onDiskUri.toString();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const existing = previousByKey.get(key);
        if (existing) {
          items.push(existing);
        } else {
          items.push(new MultiDiffEditorItem(change.originalUri, onDiskUri, onDiskUri));
          addedNewFile = true;
        }
      }
      if (!addedNewFile && lastValue && items.length === lastValue.length) {
        return lastValue;
      }
      return items;
    });
    return {
      resources: new ValueWithChangeEventFromObservable(resourcesObs),
      label: new ValueWithChangeEventFromObservable(label)
    };
  }
};
LastTurnChangesMultiDiffSourceResolver = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, IMultiDiffSourceResolverService)
], LastTurnChangesMultiDiffSourceResolver);
let LastTurnChangesMultiDiffSourceResolverContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.sessions.lastTurnChangesMultiDiffSourceResolver";
  }
  constructor(instantiationService) {
    super();
    this._register(instantiationService.createInstance(LastTurnChangesMultiDiffSourceResolver));
  }
};
LastTurnChangesMultiDiffSourceResolverContribution = __decorateClass([
  __decorateParam(0, IInstantiationService)
], LastTurnChangesMultiDiffSourceResolverContribution);
export {
  LastTurnChangesMultiDiffSourceResolver,
  LastTurnChangesMultiDiffSourceResolverContribution,
  getTurnChangesEditorLabel
};
