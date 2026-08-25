import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
var ChatViewsWelcomeExtensions = /* @__PURE__ */ ((ChatViewsWelcomeExtensions2) => {
  ChatViewsWelcomeExtensions2["ChatViewsWelcomeRegistry"] = "workbench.registry.chat.viewsWelcome";
  return ChatViewsWelcomeExtensions2;
})(ChatViewsWelcomeExtensions || {});
class ChatViewsWelcomeContributionRegistry extends Disposable {
  constructor() {
    super(...arguments);
    this.descriptors = [];
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
  }
  register(descriptor) {
    this.descriptors.push(descriptor);
    this._onDidChange.fire();
  }
  get() {
    return this.descriptors;
  }
}
const chatViewsWelcomeRegistry = new ChatViewsWelcomeContributionRegistry();
Registry.add("workbench.registry.chat.viewsWelcome" /* ChatViewsWelcomeRegistry */, chatViewsWelcomeRegistry);
export {
  ChatViewsWelcomeExtensions,
  chatViewsWelcomeRegistry
};
