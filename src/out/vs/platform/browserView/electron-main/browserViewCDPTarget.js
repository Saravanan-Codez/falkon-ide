import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
class BrowserViewCDPTarget extends Disposable {
  constructor(view, _targetInfo) {
    super();
    this.view = view;
    this._targetInfo = _targetInfo;
    this._sessions = /* @__PURE__ */ new Map();
    this._onSessionCreated = this._register(new Emitter());
    this.onSessionCreated = this._onSessionCreated.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._onTargetInfoChanged = this._register(new Emitter());
    this.onTargetInfoChanged = this._onTargetInfoChanged.event;
    this._isDisposed = false;
    this._register(this.view.debugger.onTargetInfoChanged((info) => {
      if (info.targetId !== this._targetInfo.targetId) {
        return;
      }
      if (info.title !== this._targetInfo.title || info.url !== this._targetInfo.url) {
        this._targetInfo.title = info.title;
        this._targetInfo.url = info.url;
        this._onTargetInfoChanged.fire(this.targetInfo);
      }
    }));
    this._register(this.view.debugger.onTargetDestroyed((targetId) => {
      if (targetId === this._targetInfo.targetId) {
        this.dispose();
      }
    }));
  }
  get sessions() {
    return this._sessions;
  }
  get targetInfo() {
    return {
      ...this._targetInfo,
      attached: this._sessions.size > 0,
      browserContextId: this.view.session.id
    };
  }
  async attach() {
    const session = await this.view.debugger.attachToTarget(this.targetInfo.targetId);
    this.notifySessionCreated(session, false);
    return session;
  }
  notifySessionCreated(session, waitingForDebugger) {
    if (this._sessions.has(session.sessionId)) {
      return;
    }
    if (this.sessions.size === 0) {
      this._onTargetInfoChanged.fire(this.targetInfo);
    }
    this._sessions.set(session.sessionId, session);
    session.onClose(() => {
      this._sessions.delete(session.sessionId);
      if (this.sessions.size === 0) {
        this._onTargetInfoChanged.fire(this.targetInfo);
      }
    });
    this._onSessionCreated.fire({ session, waitingForDebugger });
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    for (const [, session] of this._sessions) {
      session.dispose();
    }
    this._sessions.clear();
    this._onClose.fire();
    super.dispose();
  }
}
export {
  BrowserViewCDPTarget
};
