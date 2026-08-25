import { LRUCache } from "../../../../base/common/map.js";
import { getComparisonKey } from "../../../../base/common/resources.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { CHAT_WIDGET_VIEW_STATE_CACHE_LIMIT } from "../../../../workbench/contrib/chat/browser/chat.js";
const ISessionsChatViewStateService = createDecorator("sessionsChatViewStateService");
class SessionsChatViewStateService {
  constructor() {
    this._states = new LRUCache(CHAT_WIDGET_VIEW_STATE_CACHE_LIMIT);
  }
  get(resource) {
    return this._states.get(getComparisonKey(resource));
  }
  set(resource, state) {
    this._states.set(getComparisonKey(resource), state);
  }
}
export {
  ISessionsChatViewStateService,
  SessionsChatViewStateService
};
