const EMPTY_SUBSCRIPTIONS = /* @__PURE__ */ new Set();
class AgentHostChangesetSubscriptionService {
  constructor() {
    this._subscriptions = /* @__PURE__ */ new Map();
  }
  getSessionSubscriptions(session) {
    return this._subscriptions.get(session) ?? EMPTY_SUBSCRIPTIONS;
  }
  addSubscription(session, changeset) {
    let subscriptions = this._subscriptions.get(session);
    if (!subscriptions) {
      subscriptions = /* @__PURE__ */ new Set();
      this._subscriptions.set(session, subscriptions);
    }
    subscriptions.add(changeset);
  }
  removeSubscription(session, changeset) {
    const subscriptions = this._subscriptions.get(session);
    if (!subscriptions) {
      return;
    }
    subscriptions.delete(changeset);
    if (subscriptions.size === 0) {
      this._subscriptions.delete(session);
    }
  }
  clearSessionSubscriptions(session) {
    this._subscriptions.delete(session);
  }
}
export {
  AgentHostChangesetSubscriptionService
};
