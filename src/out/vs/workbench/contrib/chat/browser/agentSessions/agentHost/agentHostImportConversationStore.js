import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
const IAgentHostImportConversationStore = createDecorator("agentHostImportConversationStore");
class AgentHostImportConversationStore {
  constructor() {
    this._pending = /* @__PURE__ */ new Map();
  }
  set(resource, conversation) {
    if (conversation.turns.length > 0) {
      this._pending.set(resource.toString(), conversation);
    }
  }
  take(resource) {
    const key = resource.toString();
    const conversation = this._pending.get(key);
    this._pending.delete(key);
    return conversation;
  }
  rename(oldResource, newResource) {
    const conversation = this.take(oldResource);
    if (conversation) {
      this._pending.set(newResource.toString(), conversation);
    }
  }
}
export {
  AgentHostImportConversationStore,
  IAgentHostImportConversationStore
};
