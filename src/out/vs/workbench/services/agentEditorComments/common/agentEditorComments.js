import { Emitter } from "../../../../base/common/event.js";
import { combinedDisposable, Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IAgentEditorCommentsBridge = createDecorator("agentEditorCommentsBridge");
class AgentEditorCommentsBridge extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidChangeComments = this._register(new Emitter());
    this.onDidChangeComments = this._onDidChangeComments.event;
    this._onDidRevealComment = this._register(new Emitter());
    this.onDidRevealComment = this._onDidRevealComment.event;
    this._providers = [];
  }
  registerProvider(provider) {
    const entry = {
      provider,
      listener: combinedDisposable(
        provider.onDidChangeComments(() => this._onDidChangeComments.fire()),
        provider.onDidRevealComment((event) => {
          if (this._getProvider(event.resource) === provider) {
            this._onDidRevealComment.fire(event);
          }
        })
      )
    };
    this._providers.push(entry);
    this._onDidChangeComments.fire();
    return toDisposable(() => {
      const index = this._providers.indexOf(entry);
      if (index !== -1) {
        this._providers.splice(index, 1);
        entry.listener.dispose();
        this._onDidChangeComments.fire();
      }
    });
  }
  acceptsComments(resource) {
    return !!this._getProvider(resource);
  }
  getComments(resource, includeRelated = false) {
    const comments = this._getProvider(resource)?.getComments(resource, includeRelated) ?? [];
    return includeRelated ? comments : comments.filter((comment) => isEqual(comment.resource, resource));
  }
  getCommentIds(resource, includeRelated = false) {
    const provider = this._getProvider(resource);
    return provider?.getCommentIds?.(resource, includeRelated) ?? provider?.getComments(resource, includeRelated).map((comment) => comment.id) ?? [];
  }
  addComment(resource, range, body) {
    this._getProvider(resource)?.addComment(resource, range, body);
  }
  deleteComment(resource, id) {
    this._getProvider(resource)?.deleteComment(resource, id);
  }
  revealComment(resource, id) {
    this._onDidRevealComment.fire({ resource, id });
  }
  _getProvider(resource) {
    return this._providers.filter((entry) => entry.provider.acceptsComments(resource)).sort((first, second) => (second.provider.priority ?? 0) - (first.provider.priority ?? 0))[0]?.provider;
  }
  dispose() {
    for (const entry of this._providers) {
      entry.listener.dispose();
    }
    this._providers.length = 0;
    super.dispose();
  }
}
registerSingleton(IAgentEditorCommentsBridge, AgentEditorCommentsBridge, InstantiationType.Delayed);
export {
  AgentEditorCommentsBridge,
  IAgentEditorCommentsBridge
};
