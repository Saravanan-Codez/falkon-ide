import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { CDPError, CDPErrorCode, CDPServerError, CDPMethodNotFoundError, CDPInvalidParamsError } from "./types.js";
class CDPBrowserProxy extends Disposable {
  constructor(browserTarget) {
    super();
    this.browserTarget = browserTarget;
    this.sessionId = `browser-session-${generateUuid()}`;
    // Browser session state
    this._isAttachedToBrowserTarget = false;
    this._autoAttach = false;
    this._discover = false;
    /**
     * All sessions known to this proxy, keyed by sessionId.
     * Includes sessions from explicit attach, proxy auto-attach,
     * and client auto-attach children.
     */
    this._sessions = this._register(new DisposableMap());
    this._targets = this._register(new DisposableMap());
    // Only auto-attach once per target.
    this._autoAttachments = /* @__PURE__ */ new WeakSet();
    // CDP method handlers map
    this._handlers = /* @__PURE__ */ new Map([
      // Browser.* methods (https://chromedevtools.github.io/devtools-protocol/tot/Browser/)
      ["Browser.addPrivacySandboxCoordinatorKeyConfig", () => ({})],
      ["Browser.addPrivacySandboxEnrollmentOverride", () => ({})],
      ["Browser.close", () => ({})],
      ["Browser.getVersion", () => this.browserTarget.getVersion()],
      ["Browser.resetPermissions", () => ({})],
      ["Browser.getWindowForTarget", (p, s) => this.handleBrowserGetWindowForTarget(p, s)],
      ["Browser.setDownloadBehavior", () => ({})],
      ["Browser.setWindowBounds", () => ({})],
      // Target.* methods (https://chromedevtools.github.io/devtools-protocol/tot/Target/)
      ["Target.activateTarget", (p) => this.handleTargetActivateTarget(p)],
      ["Target.attachToTarget", (p) => this.handleTargetAttachToTarget(p)],
      ["Target.closeTarget", (p) => this.handleTargetCloseTarget(p)],
      ["Target.createBrowserContext", () => this.handleTargetCreateBrowserContext()],
      ["Target.createTarget", (p) => this.handleTargetCreateTarget(p)],
      ["Target.detachFromTarget", (p) => this.handleTargetDetachFromTarget(p)],
      ["Target.disposeBrowserContext", (p) => this.handleTargetDisposeBrowserContext(p)],
      ["Target.getBrowserContexts", () => this.handleTargetGetBrowserContexts()],
      ["Target.getTargets", () => this.handleTargetGetTargets()],
      ["Target.setAutoAttach", (p, s) => this.handleTargetSetAutoAttach(p, s)],
      ["Target.setDiscoverTargets", (p) => this.handleTargetSetDiscoverTargets(p)],
      ["Target.attachToBrowserTarget", () => this.handleTargetAttachToBrowserTarget()],
      ["Target.getTargetInfo", (p) => this.handleTargetGetTargetInfo(p)]
    ]);
    // #region Public API
    // Events to external clients
    this._onEvent = this._register(new Emitter());
    this.onEvent = this._onEvent.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
  }
  get targetId() {
    return this.browserTarget.targetInfo.targetId;
  }
  registerTarget(target) {
    const targetInfo = target.targetInfo;
    if (this._targets.has(targetInfo.targetId)) {
      return;
    }
    this._targets.set(targetInfo.targetId, target);
    if (this._discover) {
      this.sendEvent("Target.targetCreated", {
        targetInfo: target.targetInfo
      });
    }
    if (this._autoAttach && !this._autoAttachments.has(target)) {
      this._autoAttachments.add(target);
      void target.attach();
    }
    target.onClose(() => {
      this._targets.deleteAndDispose(targetInfo.targetId);
      if (this._discover) {
        this.sendEvent("Target.targetDestroyed", { targetId: targetInfo.targetId });
      }
    });
    target.onTargetInfoChanged((info) => {
      if (this._discover) {
        this.sendEvent("Target.targetInfoChanged", { targetInfo: info });
      }
    });
    for (const [, session] of target.sessions) {
      this.registerSession(session, false);
    }
    target.onSessionCreated(({ session, waitingForDebugger }) => {
      this.registerSession(session, waitingForDebugger);
    });
  }
  notifySessionCreated(session, waitingForDebugger) {
    if (this._sessions.has(session.sessionId)) {
      return;
    }
    if (!session.parentSessionId) {
      return;
    }
    if (!this._sessions.has(session.parentSessionId)) {
      return;
    }
    const target = this._targets.get(session.targetId);
    if (!target) {
      return;
    }
    target.notifySessionCreated(session, waitingForDebugger);
  }
  registerSession(session, waitingForDebugger) {
    if (this._sessions.has(session.sessionId)) {
      return;
    }
    this._sessions.set(session.sessionId, session);
    const target = this._targets.get(session.targetId);
    if (!target) {
      throw new CDPServerError(`Unable to resolve target for session ${session.sessionId}`);
    }
    this.sendEvent("Target.attachedToTarget", {
      sessionId: session.sessionId,
      targetInfo: target.targetInfo,
      waitingForDebugger
    }, session.parentSessionId);
    session.onEvent((event) => {
      if (event.method.startsWith("Target.")) {
        return;
      }
      this.sendEvent(event.method, event.params, event.sessionId ?? session.sessionId);
    });
    session.onClose(() => {
      this._sessions.deleteAndDispose(session.sessionId);
      this.sendEvent("Target.detachedFromTarget", {
        sessionId: session.sessionId,
        targetId: session.targetId
      }, session.parentSessionId);
    });
  }
  /** Send a browser-level event to the client */
  sendEvent(method, params, sessionId) {
    sessionId ||= this._isAttachedToBrowserTarget ? this.sessionId : void 0;
    this._onMessage.fire({ method, params, sessionId });
    this._onEvent.fire({ method, params, sessionId });
  }
  /**
   * Send a CDP command and await the result.
   * Browser-level handlers (Browser.*, Target.*) are checked first.
   * Other commands are routed to the page session identified by sessionId.
   */
  async sendCommand(method, params = {}, sessionId) {
    try {
      if (!sessionId || sessionId === this.sessionId || method.startsWith("Browser.") || method.startsWith("Target.")) {
        const handler = this._handlers.get(method);
        if (!handler) {
          throw new CDPMethodNotFoundError(method);
        }
        return await handler(params, sessionId);
      }
      const connection = this._sessions.get(sessionId);
      if (!connection) {
        throw new CDPServerError(`Session not found: ${sessionId}`);
      }
      const result = await connection.sendCommand(method, params);
      return result ?? {};
    } catch (error) {
      if (error instanceof CDPError) {
        throw error;
      }
      throw new CDPServerError(error instanceof Error ? error.message : "Unknown error");
    }
  }
  /**
   * Accept a CDP request from a message-based transport (WebSocket, IPC, etc.), route it,
   * and deliver the response or error via {@link onMessage}.
   */
  async sendMessage({ id, method, params, sessionId }) {
    return this.sendCommand(method, params, sessionId).then((result) => {
      this._onMessage.fire({ id, result, sessionId });
    }).catch((error) => {
      this._onMessage.fire({
        id,
        error: {
          code: error instanceof CDPError ? error.code : CDPErrorCode.ServerError,
          message: error.message || "Unknown error"
        },
        sessionId
      });
    });
  }
  // #endregion
  // #region CDP Commands
  handleBrowserGetWindowForTarget({ targetId }, sessionId) {
    const resolvedTargetId = (sessionId && this._sessions.get(sessionId)?.targetId) ?? targetId;
    if (!resolvedTargetId) {
      throw new CDPServerError("Unable to resolve target");
    }
    const target = this._targets.get(resolvedTargetId);
    if (!target) {
      throw new CDPServerError("Unable to resolve target");
    }
    return this.browserTarget.getWindowForTarget(target);
  }
  handleTargetGetBrowserContexts() {
    return { browserContextIds: this.browserTarget.getBrowserContexts() };
  }
  async handleTargetCreateBrowserContext() {
    const browserContextId = await this.browserTarget.createBrowserContext();
    return { browserContextId };
  }
  async handleTargetDisposeBrowserContext({ browserContextId }) {
    await this.browserTarget.disposeBrowserContext(browserContextId);
    return {};
  }
  handleTargetAttachToBrowserTarget() {
    this.sendEvent("Target.attachedToTarget", {
      sessionId: this.sessionId,
      targetInfo: this.browserTarget.targetInfo,
      waitingForDebugger: false
    });
    this._isAttachedToBrowserTarget = true;
    return { sessionId: this.sessionId };
  }
  handleTargetActivateTarget({ targetId }) {
    const target = this._targets.get(targetId);
    if (!target) {
      throw new CDPServerError("Unable to resolve target");
    }
    return this.browserTarget.activateTarget(target);
  }
  async handleTargetSetAutoAttach(params, sessionId) {
    if (sessionId && sessionId !== this.sessionId) {
      const connection = this._sessions.get(sessionId);
      if (!connection) {
        throw new CDPServerError(`Session not found: ${sessionId}`);
      }
      return connection.sendCommand("Target.setAutoAttach", params);
    }
    if (!params.flatten) {
      throw new CDPInvalidParamsError("This implementation only supports auto-attach with flatten=true");
    }
    this._autoAttach = params.autoAttach ?? false;
    return {};
  }
  async handleTargetSetDiscoverTargets({ discover = false }) {
    if (discover !== this._discover) {
      this._discover = discover;
      if (this._discover) {
        for (const target of this._targets.values()) {
          this.sendEvent("Target.targetCreated", { targetInfo: target.targetInfo });
        }
      }
    }
    return {};
  }
  async handleTargetGetTargets() {
    return { targetInfos: Array.from(this._targets.values()).map((target) => target.targetInfo) };
  }
  async handleTargetGetTargetInfo({ targetId } = {}) {
    if (!targetId) {
      return { targetInfo: this.browserTarget.targetInfo };
    }
    const target = this._targets.get(targetId);
    if (!target) {
      throw new CDPServerError("Unable to resolve target");
    }
    return { targetInfo: target.targetInfo };
  }
  async handleTargetAttachToTarget({ targetId, flatten }) {
    if (!flatten) {
      throw new CDPInvalidParamsError("This implementation only supports attachToTarget with flatten=true");
    }
    const target = this._targets.get(targetId);
    if (!target) {
      throw new CDPServerError("Unable to resolve target");
    }
    const connection = await target.attach();
    return { sessionId: connection.sessionId };
  }
  async handleTargetDetachFromTarget({ sessionId }) {
    const connection = this._sessions.get(sessionId);
    if (!connection) {
      throw new CDPServerError(`Session not found: ${sessionId}`);
    }
    connection.dispose();
    return {};
  }
  async handleTargetCreateTarget({ url, browserContextId }) {
    const target = await this.browserTarget.createTarget(url || "about:blank", browserContextId);
    this.registerTarget(target);
    if (this._autoAttach && !this._autoAttachments.has(target)) {
      this._autoAttachments.add(target);
      await target.attach();
    }
    return { targetId: target.targetInfo.targetId };
  }
  async handleTargetCloseTarget({ targetId }) {
    try {
      const target = this._targets.get(targetId);
      if (!target) {
        throw new CDPServerError("Unable to resolve target");
      }
      await this.browserTarget.closeTarget(target);
      return { success: true };
    } catch {
      return { success: false };
    }
  }
  // #endregion
}
export {
  CDPBrowserProxy
};
