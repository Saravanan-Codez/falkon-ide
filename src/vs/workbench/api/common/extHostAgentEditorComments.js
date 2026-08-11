import { Emitter } from "../../../base/common/event.js";
import { MainContext } from "./extHost.protocol.js";
import * as typeConvert from "./extHostTypeConverters.js";
class ExtHostAgentEditorCommentsProvider {
  constructor(handle, proxy, onDispose) {
    this.handle = handle;
    this.proxy = proxy;
    this.onDispose = onDispose;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._onDidRevealComment = new Emitter();
    this.onDidRevealComment = this._onDidRevealComment.event;
    this._comments = [];
    this._acceptsComments = false;
  }
  get comments() {
    return this._comments;
  }
  get acceptsComments() {
    return this._acceptsComments;
  }
  $acceptComments(comments, acceptsComments) {
    this._comments = comments.map((comment) => Object.freeze({
      id: comment.id,
      range: typeConvert.Range.to(comment.range),
      body: comment.body,
      author: comment.author
    }));
    this._acceptsComments = acceptsComments;
    this._onDidChange.fire();
  }
  $revealComment(id) {
    this._onDidRevealComment.fire(id);
  }
  addComment(range, body) {
    this.proxy.$addComment(this.handle, typeConvert.Range.from(range), body);
  }
  deleteComment(id) {
    this.proxy.$deleteComment(this.handle, id);
  }
  dispose() {
    this.proxy.$disposeAgentEditorComments(this.handle);
    this._onDidChange.dispose();
    this._onDidRevealComment.dispose();
    this.onDispose(this.handle);
  }
}
class ExtHostAgentEditorComments {
  constructor(mainContext) {
    this.providers = /* @__PURE__ */ new Map();
    this.proxy = mainContext.getProxy(MainContext.MainThreadAgentEditorComments);
  }
  static {
    this.handlePool = 0;
  }
  createAgentEditorComments(uri) {
    const handle = ExtHostAgentEditorComments.handlePool++;
    const provider = new ExtHostAgentEditorCommentsProvider(handle, this.proxy, (h) => this.providers.delete(h));
    this.providers.set(handle, provider);
    this.proxy.$createAgentEditorComments(handle, uri);
    return provider;
  }
  $acceptAgentEditorComments(handle, comments, acceptsComments) {
    this.providers.get(handle)?.$acceptComments(comments, acceptsComments);
  }
  $revealAgentEditorComment(handle, id) {
    this.providers.get(handle)?.$revealComment(id);
  }
}
export {
  ExtHostAgentEditorComments
};
