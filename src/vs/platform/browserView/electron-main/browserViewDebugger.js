import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap, toDisposable } from "../../../base/common/lifecycle.js";
class BrowserViewDebugger extends Disposable {
  constructor(view, logService) {
    super();
    this.view = view;
    this.logService = logService;
    this._sessions = this._register(new DisposableMap());
    this._onSessionCreated = this._register(new Emitter());
    this.onSessionCreated = this._onSessionCreated.event;
    /**
     * Target IDs discovered via `Target.attachedToTarget`. Consumed by
     * {@link BrowserViewCDPTarget} to create sub-target handles.
     */
    this._knownTargets = /* @__PURE__ */ new Map();
    this._onTargetDiscovered = this._register(new Emitter());
    /** Fired when a new targetId is seen in an attachedToTarget event. */
    this.onTargetDiscovered = this._onTargetDiscovered.event;
    this._onTargetDestroyed = this._register(new Emitter());
    /** Fired when a targetId is removed via a targetDestroyed event. */
    this.onTargetDestroyed = this._onTargetDestroyed.event;
    this._onTargetInfoChanged = this._register(new Emitter());
    /** Fired when targetInfo for a known target changes (e.g. title/url update). */
    this.onTargetInfoChanged = this._onTargetInfoChanged.event;
    /** Whether any attached debugger session has paused JavaScript execution. */
    this._isPaused = false;
    this._interceptors = /* @__PURE__ */ new Set();
    this._electronDebugger = view.webContents.debugger;
    this.targetId = view.webContents.getOrCreateDevToolsTargetId();
    this._messageHandler = (_event, method, params, sessionId) => {
      this.routeCDPEvent(method, params, sessionId);
    };
  }
  get knownTargets() {
    return this._knownTargets;
  }
  get isPaused() {
    return this._isPaused;
  }
  /**
   * Attach to this debugger.
   * Attach to a target by its targetId, returning the session.
   * Works for both the root page and sub-targets.
   */
  async attach() {
    return this.attachToTarget(this.targetId);
  }
  async attachToTarget(targetId) {
    this.ensureAttached();
    const result = await this._electronDebugger.sendCommand("Target.attachToTarget", {
      targetId,
      flatten: true
    });
    if (!this._sessions.has(result.sessionId)) {
      throw new Error(`Failed to attach to target ${targetId}`);
    }
    return this._sessions.get(result.sessionId);
  }
  async getTargetInfo() {
    this.ensureAttached();
    const result = await this._electronDebugger.sendCommand("Target.getTargetInfo");
    return result.targetInfo;
  }
  /**
   * Send a CDP command. Handles Electron-specific workarounds in a single place.
   */
  sendCommand(method, params, sessionId) {
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    for (const interceptor of this._interceptors) {
      const result = interceptor(method, params, session);
      if (result !== void 0) {
        return result;
      }
    }
    if (method === "Emulation.setDeviceMetricsOverride") {
      return Promise.resolve({});
    }
    return this.sendCommandRaw(method, params, sessionId);
  }
  /**
   * Send a CDP command bypassing all registered interceptors. Used by trusted
   * internal callers (such as the emulator) that themselves implement
   * interceptors and would otherwise re-enter their own logic.
   */
  sendCommandRaw(method, params, sessionId) {
    this.ensureAttached();
    const resultPromise = this._electronDebugger.sendCommand(method, params, sessionId);
    if (method === "Page.handleJavaScriptDialog") {
      this.view.webContents.emit("-cancel-dialogs");
    }
    return resultPromise;
  }
  /**
   * Register an interceptor that gets first chance at every {@link sendCommand}
   * invocation. Multiple interceptors are evaluated in registration order;
   * the first to return a non-`undefined` value wins.
   */
  registerCommandInterceptor(interceptor) {
    this._interceptors.add(interceptor);
    return toDisposable(() => this._interceptors.delete(interceptor));
  }
  ensureAttached() {
    if (this._electronDebugger.isAttached()) {
      return;
    }
    this._electronDebugger.on("message", this._messageHandler);
    this._electronDebugger.attach("1.3");
    this._electronDebugger.sendCommand("Target.setAutoAttach", {
      autoAttach: true,
      flatten: true,
      waitForDebuggerOnStart: false
    }).catch(() => {
    });
    this._electronDebugger.sendCommand("Target.setDiscoverTargets", {
      discover: true
    }).catch(() => {
    });
  }
  detachElectronDebugger() {
    try {
      if (this.view.webContents.isDestroyed() || !this._electronDebugger.isAttached()) {
        return;
      }
      this._electronDebugger.removeListener("message", this._messageHandler);
      this._electronDebugger.detach();
    } catch {
    }
  }
  /**
   * Route a CDP event from the Electron debugger.
   */
  routeCDPEvent(method, params, sessionId) {
    if (method === "Target.attachedToTarget") {
      const p = params;
      this.registerSession(p.sessionId, p.targetInfo, p.waitingForDebugger, sessionId);
    } else if (method === "Target.detachedFromTarget") {
      const p = params;
      this._sessions.deleteAndDispose(p.sessionId);
    } else if (method === "Target.targetDestroyed") {
      const p = params;
      this.destroyTarget(p.targetId);
    } else if (method === "Target.targetInfoChanged" && !sessionId) {
      const p = params;
      if (this._knownTargets.has(p.targetInfo.targetId)) {
        this._knownTargets.set(p.targetInfo.targetId, p.targetInfo);
        this._onTargetInfoChanged.fire(p.targetInfo);
      }
    } else if (method === "Debugger.paused") {
      this._isPaused = true;
    } else if (method === "Debugger.resumed") {
      this._isPaused = false;
    }
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    if (session) {
      session.emitEvent({ method, params, sessionId });
    }
  }
  /**
   * A target was destroyed by the Electron debugger.
   * Dispose all sessions belonging to that target before firing the
   * lifecycle event so that listeners never observe stale sessions.
   */
  destroyTarget(targetId) {
    const toDispose = [];
    for (const [sessionId, session] of this._sessions) {
      if (session.targetId === targetId) {
        toDispose.push(sessionId);
      }
    }
    for (const sessionId of toDispose) {
      this._sessions.deleteAndDispose(sessionId);
    }
    if (this._knownTargets.delete(targetId)) {
      this._onTargetDestroyed.fire(targetId);
    }
  }
  registerSession(sessionId, targetInfo, waitingForDebugger, parentSessionId) {
    if (!this._knownTargets.has(targetInfo.targetId) && targetInfo.targetId !== this.targetId) {
      this._knownTargets.set(targetInfo.targetId, targetInfo);
      this._onTargetDiscovered.fire(targetInfo);
    }
    if (this._sessions.has(sessionId)) {
      return this._sessions.get(sessionId);
    }
    const session = new DebugSession(parentSessionId, sessionId, targetInfo.targetId, this);
    this._sessions.set(sessionId, session);
    session.onClose(() => this._sessions.deleteAndDispose(sessionId));
    this._onSessionCreated.fire({ session, waitingForDebugger });
    return session;
  }
  dispose() {
    this.detachElectronDebugger();
    super.dispose();
  }
}
class DebugSession extends Disposable {
  constructor(parentSessionId, sessionId, targetId, _debugger) {
    super();
    this.parentSessionId = parentSessionId;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this._debugger = _debugger;
    this._onEvent = this._register(new Emitter());
    this.onEvent = this._onEvent.event;
    this.emitEvent = (event) => this._onEvent.fire(event);
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._isDisposed = false;
  }
  async sendCommand(method, params) {
    return this._debugger.sendCommand(method, params, this.sessionId);
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._onClose.fire();
    super.dispose();
  }
}
export {
  BrowserViewDebugger
};
