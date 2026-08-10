import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { DeferredPromise, disposableTimeout, raceTimeout } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { PlaywrightTab, DialogInterruptedError } from "./playwrightTab.js";
import { generateUuid } from "../../../base/common/uuid.js";
const DEFERRED_RESULT_CLEANUP_MS = 5 * 6e4;
const SESSION_INACTIVITY_MS = 30 * 6e4;
const OPEN_PAGE_NAVIGATION_TIMEOUT_MS = 3e4;
function isCDPRequest(message) {
  const candidate = message;
  return typeof candidate.id === "number" && typeof candidate.method === "string" && (candidate.sessionId === void 0 || typeof candidate.sessionId === "string");
}
class PlaywrightService extends Disposable {
  constructor(windowId, browserViewGroupRemoteService, logService, agentNetworkFilterService, telemetryService) {
    super();
    this.windowId = windowId;
    this.browserViewGroupRemoteService = browserViewGroupRemoteService;
    this.logService = logService;
    this.agentNetworkFilterService = agentNetworkFilterService;
    this.telemetryService = telemetryService;
    this._sessions = this._register(new DisposableMap());
    /** In-flight session initializations keyed by session ID. */
    this._pendingInits = /* @__PURE__ */ new Map();
    /** Inactivity timers keyed by session ID. */
    this._inactivityTimers = this._register(new DisposableMap());
    /** Global set of tracked page IDs (shared across all sessions). */
    this._trackedPages = /* @__PURE__ */ new Set();
    this._onDidChangeTrackedPages = this._register(new Emitter());
    this.onDidChangeTrackedPages = this._onDidChangeTrackedPages.event;
  }
  /**
   * Get or create a fully-initialized {@link PlaywrightSession} for the
   * given session ID. Creates the CDP group and Playwright browser
   * connection if the session does not already exist.
   */
  async _getOrCreateSession(sessionId) {
    const existing = this._sessions.get(sessionId);
    if (existing) {
      this._touchSession(sessionId);
      return existing;
    }
    const pending = this._pendingInits.get(sessionId);
    if (pending) {
      return pending;
    }
    const initPromise = this._initSession(sessionId);
    this._pendingInits.set(sessionId, initPromise);
    try {
      return await initPromise;
    } finally {
      this._pendingInits.delete(sessionId);
    }
  }
  /**
   * Create and fully initialize a new session: browser view group,
   * Playwright CDP connection, and page replay.
   */
  async _initSession(sessionId) {
    this.logService.debug(`[PlaywrightService] Initializing session ${sessionId}`);
    const group = await this.browserViewGroupRemoteService.createGroup({ mainWindowId: this.windowId, sessionId });
    const actionScope = { activeCalls: 0 };
    let browser;
    try {
      const playwright = await import("playwright-core");
      const sub = group.onCDPMessage((msg) => transport.onmessage?.(msg));
      const transport = {
        close() {
          sub.dispose();
          this.onclose?.();
        },
        send: (rawMessage) => {
          if (!isCDPRequest(rawMessage)) {
            throw new Error(`[PlaywrightService] Unexpected CDP transport payload for session ${sessionId} (type: ${typeof rawMessage})`);
          }
          const message = rawMessage;
          if (actionScope.activeCalls === 0 && message.method.startsWith("Emulation.")) {
            setTimeout(() => {
              transport.onmessage?.({ id: message.id, result: {}, sessionId: message.sessionId });
            }, 1);
            return;
          }
          void group.sendCDPMessage(message);
        }
      };
      browser = await playwright.chromium.connectOverCDP(transport);
    } catch (e) {
      group.dispose();
      throw e;
    }
    this.logService.debug(`[PlaywrightService] Connected to browser for session ${sessionId}`);
    if (this._store.isDisposed) {
      browser.close().catch(() => {
      });
      group.dispose();
      throw new Error("PlaywrightService was disposed during initialization");
    }
    const session = new PlaywrightSession(
      sessionId,
      browser,
      group,
      actionScope,
      this.logService,
      this.agentNetworkFilterService,
      this.telemetryService,
      (viewId) => this.startTrackingPage(viewId)
    );
    session.registerDisposable(group.onDidAddView((e) => {
      if (!this._trackedPages.has(e.viewId)) {
        this._trackedPages.add(e.viewId);
        this._fireTrackedPages();
      }
      for (const [id, other] of this._sessions) {
        if (id !== sessionId) {
          void other.group.addView(e.viewId).catch(() => {
          });
        }
      }
    }));
    session.registerDisposable(group.onDidRemoveView((e) => {
      if (this._trackedPages.delete(e.viewId)) {
        this._fireTrackedPages();
      }
    }));
    browser.on("disconnected", () => {
      this.logService.debug(`[PlaywrightService] Browser disconnected for session ${sessionId}`);
      this._sessions.deleteAndDispose(sessionId);
      this._inactivityTimers.deleteAndDispose(sessionId);
    });
    this._sessions.set(sessionId, session);
    for (const viewId of [...this._trackedPages]) {
      try {
        await session.group.addView(viewId);
      } catch {
        this.logService.debug(`[PlaywrightService] Stale tracked page ${viewId} removed during replay`);
        this._trackedPages.delete(viewId);
        this._fireTrackedPages();
      }
    }
    this._touchSession(sessionId);
    return session;
  }
  // --- Page tracking (global) ---
  async startTrackingPage(viewId) {
    if (!this._trackedPages.has(viewId)) {
      this._trackedPages.add(viewId);
      this._fireTrackedPages();
    }
    for (const session of this._sessions.values()) {
      session.group.addView(viewId);
    }
  }
  async stopTrackingPage(viewId) {
    if (this._trackedPages.delete(viewId)) {
      this._fireTrackedPages();
    }
    for (const session of this._sessions.values()) {
      session.group.removeView(viewId);
    }
  }
  async isPageTracked(viewId) {
    return this._trackedPages.has(viewId);
  }
  async getTrackedPages() {
    return [...this._trackedPages];
  }
  // --- Playwright operations (delegated to per-session instances) ---
  async openPage(sessionId, url) {
    const session = await this._getOrCreateSession(sessionId);
    return session.openPage(url);
  }
  async getSummary(sessionId, pageId) {
    const session = await this._getOrCreateSession(sessionId);
    return session.getSummary(pageId);
  }
  async invokeFunctionRaw(sessionId, pageId, fnDef, ...args) {
    const session = await this._getOrCreateSession(sessionId);
    return session.invokeFunctionRaw(pageId, fnDef, ...args);
  }
  async invokeFunction(sessionId, pageId, fnDef, args = [], timeoutMs) {
    const session = await this._getOrCreateSession(sessionId);
    return session.invokeFunction(pageId, fnDef, args, timeoutMs);
  }
  async waitForDeferredResult(sessionId, deferredResultId, timeoutMs) {
    const session = await this._getOrCreateSession(sessionId);
    return session.waitForDeferredResult(deferredResultId, timeoutMs);
  }
  async replyToFileChooser(sessionId, pageId, files) {
    const session = await this._getOrCreateSession(sessionId);
    return session.replyToFileChooser(pageId, files);
  }
  async replyToDialog(sessionId, pageId, accept, promptText) {
    const session = await this._getOrCreateSession(sessionId);
    return session.replyToDialog(pageId, accept, promptText);
  }
  // --- Session lifecycle ---
  async disposeSession(sessionId) {
    if (this._sessions.has(sessionId)) {
      this.logService.debug(`[PlaywrightService] Disposing session ${sessionId}`);
      this._sessions.deleteAndDispose(sessionId);
      this._inactivityTimers.deleteAndDispose(sessionId);
    }
  }
  // --- Private helpers ---
  _fireTrackedPages() {
    this._onDidChangeTrackedPages.fire([...this._trackedPages]);
  }
  /**
   * Reset the inactivity timer for a session. After
   * {@link SESSION_INACTIVITY_MS} of no activity the session is
   * automatically disposed.
   */
  _touchSession(sessionId) {
    this._inactivityTimers.deleteAndDispose(sessionId);
    const timer = disposableTimeout(
      () => {
        this.logService.debug(`[PlaywrightService] Session ${sessionId} inactive for ${SESSION_INACTIVITY_MS / 6e4}m, disposing`);
        this._sessions.deleteAndDispose(sessionId);
        this._inactivityTimers.deleteAndDispose(sessionId);
      },
      SESSION_INACTIVITY_MS
    );
    this._inactivityTimers.set(sessionId, timer);
  }
}
class PlaywrightSession extends Disposable {
  constructor(sessionId, _browser, group, actionScope, logService, agentNetworkFilterService, telemetryService, onDidCreatePage) {
    super();
    this.sessionId = sessionId;
    this._browser = _browser;
    this.group = group;
    this.actionScope = actionScope;
    this.logService = logService;
    this.agentNetworkFilterService = agentNetworkFilterService;
    this.telemetryService = telemetryService;
    this.onDidCreatePage = onDidCreatePage;
    // --- Page matching ---
    this._viewIdToPage = /* @__PURE__ */ new Map();
    this._pageToViewId = /* @__PURE__ */ new WeakMap();
    this._tabs = /* @__PURE__ */ new WeakMap();
    /** View IDs received from the group but not yet matched with a page. */
    this._viewIdQueue = [];
    /** Pages received from Playwright but not yet matched with a view ID. */
    this._pageQueue = [];
    this._watchedContexts = /* @__PURE__ */ new WeakSet();
    this._openContext = void 0;
    /** In-flight deferred results keyed by their generated ID. */
    this._deferredResults = this._register(new DisposableMap());
    this._register(this.group);
    this._register(this.group.onDidAddView((e) => this._onViewAdded(e.viewId)));
    this._register(this.group.onDidRemoveView((e) => this._onViewRemoved(e.viewId)));
    this._scanForNewContexts();
  }
  /** Register a disposable to be cleaned up when this session is disposed. */
  registerDisposable(d) {
    this._register(d);
  }
  // --- Page operations ---
  async openPage(url) {
    if (!this._openContext) {
      this._openContext = await this._browser.newContext();
      this._onContextAdded(this._openContext);
    }
    const page = await this._openContext.newPage();
    const viewId = await this._onPageAdded(page);
    await this.onDidCreatePage(viewId);
    if (url && url !== "about:blank" && page.url() !== url) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: OPEN_PAGE_NAVIGATION_TIMEOUT_MS });
      } catch (error) {
        if (!isNavigationTimeoutError(error)) {
          throw error;
        }
        throw new Error(`Navigation to ${url} timed out after ${OPEN_PAGE_NAVIGATION_TIMEOUT_MS} ms. The page (ID: ${viewId}) is open and can be reused.`);
      }
    }
    const summary = await this._getSummary(viewId);
    return { pageId: viewId, summary };
  }
  async getSummary(pageId) {
    return this._getSummary(pageId, true);
  }
  async invokeFunctionRaw(pageId, fnDef, ...args) {
    const fn = await this._compileFunction(fnDef);
    return this._runAgainstPage(pageId, (page) => fn(page, args));
  }
  async invokeFunction(pageId, fnDef, args = [], timeoutMs) {
    this.logService.info(`[PlaywrightSession] Invoking function on view ${pageId}`);
    const logCtx = {
      startedAt: Date.now(),
      codeLength: fnDef.length,
      codeLineCount: fnDef.split("\n").length,
      pageMethodsCalled: /* @__PURE__ */ new Map(),
      wasDeferred: false,
      resumeCount: 0,
      logged: false
    };
    let fn;
    try {
      fn = await this._compileFunction(fnDef);
    } catch (err) {
      this._logExecution(logCtx, false);
      const summary2 = await this._getSummary(pageId);
      return { error: err instanceof Error ? err.message : String(err), summary: summary2 };
    }
    const wrappedCallback = async (page) => fn(createPageApiProxy(page, logCtx.pageMethodsCalled), args);
    if (timeoutMs !== void 0) {
      return this._runWithDeferral(pageId, wrappedCallback, timeoutMs, void 0, logCtx);
    }
    let result, error;
    try {
      result = await this._runAgainstPage(pageId, wrappedCallback);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    this._logExecution(logCtx, !error);
    const summary = await this._getSummary(pageId);
    return { result, error, summary };
  }
  async waitForDeferredResult(deferredResultId, timeoutMs) {
    const entry = this._deferredResults.get(deferredResultId);
    if (!entry) {
      throw new Error(`No deferred result found with ID "${deferredResultId}". It may have been cleaned up or already consumed.`);
    }
    const { pageId, promise, logCtx } = entry;
    if (logCtx) {
      logCtx.resumeCount++;
    }
    this._deferredResults.deleteAndDispose(deferredResultId);
    return this._runWithDeferral(pageId, () => promise, timeoutMs, deferredResultId, logCtx);
  }
  async replyToFileChooser(pageId, files) {
    const page = await this._getPage(pageId);
    const tab = this._tabs.get(page);
    if (!tab) {
      throw new Error("Failed to reply to file chooser");
    }
    await tab.replyToFileChooser(files);
    const summary = await tab.getSummary();
    return { summary };
  }
  async replyToDialog(pageId, accept, promptText) {
    const page = await this._getPage(pageId);
    const tab = this._tabs.get(page);
    if (!tab) {
      throw new Error("Failed to reply to dialog");
    }
    await tab.replyToDialog(accept, promptText);
    const summary = await tab.getSummary();
    return { summary };
  }
  // --- Private: page operations ---
  async _getSummary(pageId, full = false) {
    const page = await this._getPage(pageId);
    const tab = this._tabs.get(page);
    if (!tab) {
      throw new Error("Failed to get page summary");
    }
    return tab.getSummary(full);
  }
  async _runAgainstPage(pageId, callback) {
    const page = await this._getPage(pageId);
    const tab = this._tabs.get(page);
    if (!tab) {
      throw new Error("Failed to execute function against page");
    }
    return tab.safeRunAgainstPage(async () => callback(page));
  }
  async _runWithDeferral(pageId, callback, timeoutMs, existingDeferredId, logCtx) {
    const deferred = new DeferredPromise();
    if (existingDeferredId === void 0 && logCtx) {
      deferred.p.then(() => this._logExecution(logCtx, true), () => this._logExecution(logCtx, false));
    }
    const wrappedPromise = this._runAgainstPage(pageId, async (page) => {
      const promise = callback(page);
      promise.catch(() => {
      });
      deferred.settleWith(promise);
      return promise;
    });
    let result, error;
    let interrupted = false;
    try {
      result = await raceTimeout(wrappedPromise, timeoutMs, () => {
        interrupted = true;
      });
    } catch (err) {
      if (err instanceof DialogInterruptedError) {
        interrupted = true;
      }
      error = err instanceof Error ? err.message : String(err);
    }
    let deferredResultId;
    if (interrupted) {
      if (logCtx) {
        logCtx.wasDeferred = true;
      }
      deferredResultId = existingDeferredId ?? generateUuid();
      const cleanup = disposableTimeout(() => this._deferredResults.deleteAndDispose(deferredResultId), DEFERRED_RESULT_CLEANUP_MS);
      this._deferredResults.set(deferredResultId, { pageId, promise: deferred.p, logCtx, dispose: () => cleanup.dispose() });
      this.logService.info(`[PlaywrightSession] Execution interrupted, deferred as ${deferredResultId}`);
    } else if (logCtx) {
      this._logExecution(logCtx, !error);
    }
    const summary = await this._getSummary(pageId);
    return { result, error, summary, deferredResultId };
  }
  /**
   * Emit completion telemetry for a single {@link invokeFunction} call, once the
   * page work settles. Idempotent: only the first call for a given context emits,
   * so the synchronous and settlement-promise paths can both call it safely.
   */
  _logExecution(ctx, success) {
    if (ctx.logged) {
      return;
    }
    ctx.logged = true;
    const entries = [...ctx.pageMethodsCalled.entries()];
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    this.telemetryService.publicLog2(
      "integratedBrowser.tools.runPlaywrightCode.completed",
      {
        pageMethodsCalled: JSON.stringify(Object.fromEntries(entries)),
        pageMethodsCalledDcount: entries.length,
        pageMethodsCalledCount: total,
        success: success ? 1 : 0,
        wasDeferred: ctx.wasDeferred ? 1 : 0,
        resumeCount: ctx.resumeCount,
        durationMs: Math.round(Date.now() - ctx.startedAt),
        codeLength: ctx.codeLength,
        codeLineCount: ctx.codeLineCount
      }
    );
  }
  async _compileFunction(fnDef) {
    const vm = await import("vm");
    return vm.compileFunction(`return (${fnDef})(page, ...args)`, ["page", "args"], { parsingContext: vm.createContext() });
  }
  // --- Private: page matching (view ↔ page pairing) ---
  async _getPage(viewId) {
    const resolved = this._viewIdToPage.get(viewId);
    if (resolved) {
      return resolved;
    }
    const queued = this._viewIdQueue.find((item) => item.viewId === viewId);
    if (queued) {
      return queued.page.p;
    }
    throw new Error(`Page "${viewId}" not found`);
  }
  _onViewAdded(viewId, timeoutMs = 1e4) {
    const resolved = this._viewIdToPage.get(viewId);
    if (resolved) {
      return Promise.resolve(resolved);
    }
    const queued = this._viewIdQueue.find((item) => item.viewId === viewId);
    if (queued) {
      return queued.page.p;
    }
    const deferred = new DeferredPromise();
    const timeout = setTimeout(() => deferred.error(new Error(`Timed out waiting for page`)), timeoutMs);
    deferred.p.finally(() => {
      clearTimeout(timeout);
      this._viewIdQueue = this._viewIdQueue.filter((item) => item.viewId !== viewId);
      if (this._viewIdQueue.length === 0) {
        this._stopScanning();
      }
    });
    this._viewIdQueue.push({ viewId, page: deferred });
    this._tryMatch();
    this._ensureScanning();
    return deferred.p;
  }
  _onViewRemoved(viewId) {
    this._viewIdQueue = this._viewIdQueue.filter((item) => item.viewId !== viewId);
    const page = this._viewIdToPage.get(viewId);
    if (page) {
      this._pageToViewId.delete(page);
    }
    this._viewIdToPage.delete(viewId);
  }
  _onPageAdded(page, timeoutMs = 1e4) {
    const resolved = this._pageToViewId.get(page);
    if (resolved) {
      return Promise.resolve(resolved);
    }
    const queued = this._pageQueue.find((item) => item.page === page);
    if (queued) {
      return queued.viewId.p;
    }
    this._onContextAdded(page.context());
    page.once("close", () => this._onPageRemoved(page));
    page.setDefaultTimeout(1e4);
    this._tabs.set(page, new PlaywrightTab(page, this.actionScope, this.agentNetworkFilterService));
    const deferred = new DeferredPromise();
    const timeout = setTimeout(() => deferred.error(new Error(`Timed out waiting for browser view`)), timeoutMs);
    deferred.p.finally(() => {
      clearTimeout(timeout);
      this._pageQueue = this._pageQueue.filter((item) => item.page !== page);
    });
    this._pageQueue.push({ page, viewId: deferred });
    this._tryMatch();
    return deferred.p;
  }
  _onPageRemoved(page) {
    this._pageQueue = this._pageQueue.filter((item) => item.page !== page);
    const viewId = this._pageToViewId.get(page);
    if (viewId) {
      this._viewIdToPage.delete(viewId);
    }
    this._pageToViewId.delete(page);
  }
  _onContextAdded(context) {
    if (this._watchedContexts.has(context)) {
      return;
    }
    this._watchedContexts.add(context);
    context.on("page", (page) => this._onPageAdded(page));
    context.on("close", () => this._watchedContexts.delete(context));
    for (const page of context.pages()) {
      this._onPageAdded(page);
    }
  }
  // --- Private: matching ---
  _tryMatch() {
    while (this._viewIdQueue.length > 0 && this._pageQueue.length > 0) {
      const viewIdItem = this._viewIdQueue.shift();
      const pageItem = this._pageQueue.shift();
      this._viewIdToPage.set(viewIdItem.viewId, pageItem.page);
      this._pageToViewId.set(pageItem.page, viewIdItem.viewId);
      viewIdItem.page.complete(pageItem.page);
      pageItem.viewId.complete(viewIdItem.viewId);
      this.logService.debug(`[PlaywrightSession] Matched view ${viewIdItem.viewId} \u2192 page`);
    }
    if (this._viewIdQueue.length === 0) {
      this._stopScanning();
    }
  }
  // --- Private: context scanning ---
  _scanForNewContexts() {
    for (const context of this._browser.contexts()) {
      this._onContextAdded(context);
    }
  }
  _ensureScanning() {
    if (this._scanTimer === void 0) {
      this._scanTimer = setInterval(() => this._scanForNewContexts(), 100);
    }
  }
  _stopScanning() {
    if (this._scanTimer !== void 0) {
      clearInterval(this._scanTimer);
      this._scanTimer = void 0;
    }
  }
  dispose() {
    this._stopScanning();
    this._browser?.close().catch(() => {
    });
    for (const { page } of this._viewIdQueue) {
      page.error(new Error("PlaywrightSession disposed"));
    }
    for (const { viewId } of this._pageQueue) {
      viewId.error(new Error("PlaywrightSession disposed"));
    }
    this._viewIdQueue = [];
    this._pageQueue = [];
    super.dispose();
  }
}
function isNavigationTimeoutError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "TimeoutError" || /Timeout \d+ms exceeded/.test(error.message) || /navigation timeout/i.test(error.message);
}
const PAGE_PROXY_IGNORED_PROPS = /* @__PURE__ */ new Set([
  "then",
  "catch",
  "finally",
  "toJSON",
  "toString",
  "valueOf",
  "constructor"
]);
const PAGE_PROXY_MAX_DEPTH = 3;
function createPageApiProxy(target, methodCalls, prefix = "", depth = 0) {
  if (depth >= PAGE_PROXY_MAX_DEPTH) {
    return target;
  }
  const cache = /* @__PURE__ */ new Map();
  return new Proxy(target, {
    get(t, prop, receiver) {
      const value = Reflect.get(t, prop, receiver);
      if (typeof prop !== "string" || prop.startsWith("_") || PAGE_PROXY_IGNORED_PROPS.has(prop)) {
        return value;
      }
      const cached = cache.get(prop);
      if (cached !== void 0) {
        return cached;
      }
      if (typeof value === "function") {
        const name = prefix + prop;
        const wrapper = function(...args) {
          methodCalls.set(name, (methodCalls.get(name) ?? 0) + 1);
          return Reflect.apply(value, t, args);
        };
        cache.set(prop, wrapper);
        return wrapper;
      }
      if (value !== null && typeof value === "object") {
        const nested = createPageApiProxy(value, methodCalls, `${prefix}${prop}.`, depth + 1);
        cache.set(prop, nested);
        return nested;
      }
      return value;
    }
  });
}
export {
  PlaywrightService
};
