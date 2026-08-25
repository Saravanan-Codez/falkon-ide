var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { ClaudePromptQueue } from "./claudePromptQueue.js";
import { ClaudeSdkMessageRouter } from "./claudeSdkMessageRouter.js";
let ClaudeSdkPipeline = class extends Disposable {
  constructor(sessionId, sessionUri, chatChannelUri, warm, abortController, dbRef, subagents, clientToolOwner = void 0, instantiationService, _logService) {
    super();
    this.sessionId = sessionId;
    this.sessionUri = sessionUri;
    this.chatChannelUri = chatChannelUri;
    this._logService = _logService;
    /** Flips to `true` on the first `system:init` SDK message. Drives `Options.resume` decisions for downstream phases. */
    this._isResumed = false;
    /**
     * Native plugins reported by the most recent `system:init` message.
     * Captured on *every* init (including resume) so the post-materialize
     * native-plugin filter always reflects the live set. `source` is the
     * plugin id and is the reliable match key (see {@link ISdkResolvedCustomizations}).
     */
    this._initPlugins = [];
    /** Set when the consumer loop ends in error (cancellation OR crash). Read by {@link send} to trigger rebind. */
    this._needsRebind = false;
    /** Tracks whether the consumer loop is currently draining {@link _query}. */
    this._consumerLoopRunning = false;
    this._onDidProduceSignal = this._register(new Emitter());
    /**
     * Single fan-out for every {@link AgentSignal} this session produces:
     *   • Router-mapped per-message signals (response parts, tool calls,
     *     pending confirmations, etc.).
     *   • `ChatTurnComplete` action, fired when the LAST entry in the
     *     queue drains via `result` (intermediate results during steering
     *     preempt do NOT fire — CONTEXT.md M10).
     *   • `steering_consumed` signal, fired the moment the iterable yields
     *     a steering entry to the SDK.
     */
    this.onDidProduceSignal = this._onDidProduceSignal.event;
    this._warm = warm;
    this._abortController = abortController;
    this._wireAbortHandler(abortController);
    this._queue = this._register(instantiationService.createInstance(
      ClaudePromptQueue,
      sessionId,
      () => this._abortController.signal,
      (pendingId) => this._onDidProduceSignal.fire({
        kind: "steering_consumed",
        chat: this.chatChannelUri,
        id: pendingId
      })
    ));
    this._router = this._register(instantiationService.createInstance(
      ClaudeSdkMessageRouter,
      sessionUri,
      chatChannelUri,
      dbRef,
      subagents,
      clientToolOwner
    ));
    this._register(this._router.onDidProduceSignal((s) => this._onDidProduceSignal.fire(s)));
    this._register(toDisposable(() => this._abortController.abort()));
    this._register(toDisposable(() => {
      void Promise.resolve(this._warm[Symbol.asyncDispose]()).catch((err) => this._logService.warn(`[ClaudeSdkPipeline] WarmQuery dispose failed: ${err}`));
    }));
  }
  /**
   * Phase 11 — hot-swap the SDK's plugin set in place via
   * `Query.reloadPlugins()`. Commands / agents / mcpServers added or
   * removed by the new plugin set become visible to the SDK
   * immediately, without a session restart. Throws if the query is
   * not yet bound (session not materialized).
   */
  async reloadPlugins() {
    const query = await this._ensureQueryBound();
    await query.reloadPlugins();
  }
  /**
   * Phase 11 — snapshot the SDK's currently-resolved customization
   * surface (slash commands / skills, subagents, MCP servers). This
   * is the SDK's view of "what does this session actually have
   * access to right now" — covers everything the SDK loaded itself
   * (`~/.claude/**`, `.claude/agents/`, `settings.json` MCP) AND
   * anything we fed in via `Options.plugins`. The host overlays
   * client-side enablement separately.
   */
  async snapshotResolvedCustomizations() {
    const query = await this._ensureQueryBound();
    const [commands, agents, mcpServers] = await Promise.all([
      query.supportedCommands(),
      query.supportedAgents(),
      query.mcpServerStatus()
    ]);
    return { commands, agents, mcpServers, plugins: this._initPlugins };
  }
  async startMcpServer(serverName) {
    const query = await this._ensureQueryBound();
    return this._applyMcpServerEnablement(query, serverName, true);
  }
  async stopMcpServer(serverName) {
    const query = await this._ensureQueryBound();
    return this._applyMcpServerEnablement(query, serverName, false);
  }
  async reconcileMcpServerEnablement(desired) {
    const query = await this._ensureQueryBound();
    const observed = new Map((await query.mcpServerStatus()).map((server) => [server.name, server.status !== "disabled"]));
    for (const [serverName, enabled] of desired) {
      const current = observed.get(serverName);
      if (current === void 0 || current === enabled) {
        continue;
      }
      if (!await this._applyMcpServerEnablement(query, serverName, enabled)) {
        return false;
      }
    }
    return true;
  }
  async _applyMcpServerEnablement(query, serverName, enabled) {
    if (!query.toggleMcpServer || enabled && !query.reconnectMcpServer) {
      return false;
    }
    await query.toggleMcpServer(serverName, enabled);
    if (enabled) {
      await query.reconnectMcpServer(serverName);
    }
    return true;
  }
  /**
   * Bind the SDK Query if needed, recovering a dead one first. Mirrors the
   * gate in {@link send}: if the pipeline is marked for rebind (after an
   * abort/crash the `_query` handle is retained for teardown but its stream
   * is dead), rebuild via the rematerializer so pre-flight helpers never
   * operate on a disposed stream. Then lazily bind if nothing is bound yet.
   */
  async _ensureQueryBound() {
    if (this._needsRebind) {
      await this._rebindQuery("recover");
    }
    if (!this._query) {
      this._bindWarmQuery();
      await this._replayCurrentConfig();
    }
    return this._query;
  }
  /**
   * Bind a fresh SDK stream off the current warm subprocess. The stream is
   * long-lived: it spans every turn until a rebind swaps the subprocess (the
   * prompt iterable parks between turns rather than ending), so {@link _query}
   * tracks the lifetime of {@link _warm} and is only swapped here.
   */
  _bindWarmQuery() {
    const query = this._warm.query(this._queue.iterable);
    this._query = query;
    return query;
  }
  get isResumed() {
    return this._isResumed;
  }
  get isAborted() {
    return this._abortController.signal.aborted;
  }
  /**
   * Whether a turn is currently in flight or queued. False between turns (the
   * warm query parks with a drained queue). Used by non-destructive idle
   * release to avoid tearing the pipeline down mid-turn.
   */
  get hasActiveTurn() {
    return !this._queue.isEmpty;
  }
  /**
   * Abort the live SDK subprocess and **await its actual exit**.
   *
   * `WarmQuery[Symbol.asyncDispose]()` calls the query's `close()`, which
   * *fires* the SDK cleanup but does not await it — so it returns while the
   * subprocess is still shutting down (and still re-flushing its transcript).
   * `Query.return()` awaits the same (memoized) cleanup, which in turn awaits
   * `transport.waitForExit()` — the OS process actually exiting after its
   * final transcript flush. Awaiting that is what lets a caller safely reuse
   * the `--session-id` (the CLI rejects a fresh spawn while `<id>.jsonl`
   * still exists, and the dying process would otherwise recreate it).
   */
  async shutdownAndWait() {
    this._abortController.abort();
    try {
      await this._warm[Symbol.asyncDispose]();
      await this._query?.return(void 0);
    } catch (err) {
      this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] shutdownAndWait: teardown failed`, err);
    }
  }
  /**
   * Phase 10 \u2014 narrow public wrapper around the internal
   * {@link _rebindQuery} so {@link ClaudeAgentSession.rebindForClientTools}
   * can drive a yield-restart without exposing the private rebind
   * machinery to every collaborator.
   */
  rebindForRestart() {
    return this._rebindQuery("restart");
  }
  /**
   * Phase 10 — update the resolver the stream mapper uses to stamp the
   * owning workbench `clientId` onto subsequent `ChatToolCallStart` events.
   */
  setClientToolOwner(clientToolOwner) {
    this._router.setClientToolOwner(clientToolOwner);
  }
  /** Attach the rematerializer hook for abort / crash recovery. Optional — tests that exercise only the dispose path skip this. */
  attachRematerializer(rematerializer) {
    this._rematerializer = rematerializer;
  }
  /**
   * Seed the current + applied config from materialize-time `Options`.
   * The SDK already starts with these values, so we mark them as both
   * "current" (what the consumer wants) and "applied" (what the SDK has)
   * to avoid a redundant `setModel` / `applyFlagSettings` on first use.
   */
  seedCurrentConfig(model, effort, permissionMode) {
    this._currentModel = model;
    this._currentEffort = effort;
    this._currentPermissionMode = permissionMode;
    this._appliedModel = model;
    this._appliedEffort = effort;
    this._appliedPermissionMode = permissionMode;
  }
  /**
   * Eagerly push a model change to the SDK. Safe to call mid-turn:
   * `Query.setModel` only takes effect on the NEXT user request. No-op
   * if the value is unchanged. Buffered as `_currentModel` until the
   * Query is bound (and replayed on rebind).
   */
  async setModel(model) {
    this._currentModel = model;
    if (this._query && !this._needsRebind && model !== this._appliedModel) {
      try {
        await this._query.setModel(model);
        this._appliedModel = model;
      } catch (err) {
        this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] setModel failed: ${err}`);
      }
    }
  }
  /**
   * Eagerly push an effort-level change to the SDK via
   * `applyFlagSettings({ effortLevel })`. Same mid-turn safety as
   * {@link setModel}.
   *
   * `undefined` means "clear the effort the SDK is currently applying" —
   * issued as `applyFlagSettings({ effortLevel: null })` (sdk.d.ts:2263:
   * passing `null` clears a key from the flag layer). This is what makes a
   * switch to a model that does not support reasoning effort (e.g. Haiku)
   * drop a `'high'` left over from a prior effort-capable model instead of
   * replaying it onto a model the API will 400 on.
   */
  async setEffort(effort) {
    this._currentEffort = effort;
    if (this._query && !this._needsRebind && effort !== this._appliedEffort) {
      try {
        await this._query.applyFlagSettings({ effortLevel: effort ?? null });
        this._appliedEffort = effort;
      } catch (err) {
        this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] setEffort failed: ${err}`);
      }
    }
  }
  /**
   * Advance the *desired* model / effort for the NEXT rebind WITHOUT pushing
   * them to the live Query.
   *
   * A cross-transport provider switch is about to discard the running
   * subprocess (it is pinned to the old transport / credential), so
   * hot-swapping it via {@link setModel} / {@link setEffort} is pointless —
   * and would 400 on a model the old transport does not serve. But
   * {@link _currentModel} / {@link _currentEffort} must still move to the new
   * selection: after the rebuild, {@link _rebindQuery} resets the applied
   * cache and {@link _replayCurrentConfig} re-asserts `_currentModel` onto the
   * fresh Query. The rebuild resumes the transcript, which replays the
   * pre-switch `/model`; without advancing the buffer here that stale replay
   * would win and the rebuilt subprocess would silently run the old model on
   * the new transport (→ `model_not_supported`).
   */
  bufferConfigForRebind(model, effort) {
    this._currentModel = model;
    this._currentEffort = effort;
  }
  /**
   * Queue a user prompt for the SDK. Resolves when the matching
   * `result` message arrives.
   *
   * If a previous turn aborted or crashed, this triggers a rebind via
   * the attached rematerializer before queueing.
   */
  async send(prompt, turnId) {
    if (this._needsRebind) {
      await this._rebindQuery("recover");
    }
    if (this._abortController.signal.aborted) {
      throw new CancellationError();
    }
    if (!this._query) {
      this._bindWarmQuery();
      await this._replayCurrentConfig();
    }
    this._ensureConsumerLoop();
    const entry = {
      sdkMessage: prompt,
      sdkUuid: typeof prompt.uuid === "string" ? prompt.uuid : turnId,
      turnId,
      stopWatch: StopWatch.create(false),
      deferred: new DeferredPromise()
    };
    return this._queue.push(entry);
  }
  /**
   * Push a `priority: 'now'` steering message into the iterable. The
   * caller pre-builds the {@link SDKUserMessage} (the pipeline is SDK
   * messaging-shaped, not protocol-shaped). `pendingMessageId` is the
   * protocol `PendingMessage.id` that {@link onSteeringConsumed} will
   * carry when the SDK accepts the message.
   *
   * No-op if the pipeline is aborted or no in-flight / queued request
   * exists to inherit a `turnId` from (CONTEXT.md M10: steering folds
   * into the in-progress protocol Turn).
   */
  injectSteering(prompt, pendingMessageId) {
    if (this._abortController.signal.aborted) {
      this._logService.warn(`[Claude:${this.sessionId}] injectSteering: dropped (controller aborted) id=${pendingMessageId}`);
      return;
    }
    const parent = this._queue.peekParent();
    if (!parent) {
      this._logService.warn(`[Claude:${this.sessionId}] injectSteering: dropped (no in-flight turn) id=${pendingMessageId}`);
      return;
    }
    const sdkUuid = typeof prompt.uuid === "string" ? prompt.uuid : pendingMessageId;
    this._queue.push({
      sdkMessage: prompt,
      sdkUuid,
      turnId: parent.turnId,
      stopWatch: parent.stopWatch,
      deferred: new DeferredPromise(),
      steeringPendingId: pendingMessageId
    }).catch(() => {
    });
    this._logService.info(`[Claude:${this.sessionId}] injectSteering: enqueued id=${pendingMessageId} sdkUuid=${sdkUuid}`);
  }
  /**
   * Cancel the in-flight SDK turn via the abort controller. Drops every
   * pending entry's deferred (rejected with `CancellationError`),
   * marks the pipeline for rebind on next {@link send}. Idempotent.
   *
   * Safe to call during rebind: {@link _rebindQuery} swaps in a fresh
   * placeholder {@link AbortController} before awaiting the
   * rematerializer, so an abort issued during recovery lands on that
   * placeholder and is honored when the freshly-built pair arrives
   * (the rebind discards the new pair and surfaces a cancellation).
   */
  abort() {
    if (this._abortController.signal.aborted) {
      return;
    }
    this._abortController.abort();
    this._queue.failAll(new CancellationError());
    this._needsRebind = true;
  }
  /**
   * Forwards to {@link Query.setPermissionMode} once the query is
   * bound; the value is also remembered so it's re-applied after a
   * rebind. Permission mode is whole-session (not per-entry).
   */
  async setPermissionMode(mode) {
    this._currentPermissionMode = mode;
    if (this._query && !this._needsRebind && mode !== this._appliedPermissionMode) {
      await this._query.setPermissionMode(mode);
      this._appliedPermissionMode = mode;
    }
  }
  _wireAbortHandler(controller) {
    controller.signal.addEventListener("abort", () => {
      this._queue.notifyAborted();
    }, { once: true });
  }
  _ensureConsumerLoop() {
    if (this._consumerLoopRunning) {
      return;
    }
    this._consumerLoopRunning = true;
    this._runConsumerLoop();
  }
  /**
   * Runs one {@link _processMessages} pass over the live {@link _query} and,
   * when it ends, decides whether to hand off to a fresh pass.
   *
   * A rebind ({@link _rebindQuery}) swaps in a new `_query` while the loop is
   * still draining the OLD (now-disposed) one; that old pass then ends with
   * the "stream ended without a result" guard. Because `_consumerLoopRunning`
   * stays `true` for the whole handoff, the {@link send} that queued the
   * post-rebind prompt already saw {@link _ensureConsumerLoop} no-op — so if
   * this pass just stopped, nothing would ever read the new query and `send`
   * would hang. Detect the swap (current `_query` differs from the one this
   * pass bound) and re-arm for it instead. Abort / crash / dispose leave
   * `_query` cleared (or the store disposed), so they fall through to stop.
   */
  _runConsumerLoop() {
    const boundQuery = this._query;
    void this._processMessages().catch((err) => this._logService.error(`[ClaudeSdkPipeline:${this.sessionId}] _processMessages crashed: ${err}`)).finally(() => {
      if (!this._store.isDisposed && this._query && this._query !== boundQuery) {
        this._runConsumerLoop();
      } else {
        this._consumerLoopRunning = false;
      }
    });
  }
  /**
   * Push the current model / effort / permissionMode to the SDK if they
   * diverge from what was last applied. Called after binding a fresh
   * Query (initial first-send and after rebind). Failures are logged.
   */
  async _replayCurrentConfig() {
    try {
      if (this._currentModel !== void 0 && this._currentModel !== this._appliedModel) {
        await this._query?.setModel(this._currentModel);
        this._appliedModel = this._currentModel;
      }
      if (this._currentEffort !== void 0 && this._currentEffort !== this._appliedEffort) {
        await this._query?.applyFlagSettings({ effortLevel: this._currentEffort });
        this._appliedEffort = this._currentEffort;
      }
      if (this._currentPermissionMode !== void 0 && this._currentPermissionMode !== this._appliedPermissionMode) {
        await this._query?.setPermissionMode(this._currentPermissionMode);
        this._appliedPermissionMode = this._currentPermissionMode;
      }
    } catch (err) {
      this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] _replayCurrentConfig failed: ${err}`);
    }
  }
  /**
   * Dispose the dead SDK plumbing and rebuild via the agent-supplied
   * rematerializer in `resume` mode. Re-applies the current model /
   * effort / permission mode to the fresh Query.
   */
  async _rebindQuery(reason) {
    if (!this._rematerializer) {
      throw new Error(`ClaudeSdkPipeline.rebind: no rematerializer attached (reason=${reason})`);
    }
    const oldWarm = this._warm;
    const placeholder = new AbortController();
    this._abortController = placeholder;
    const built = await this._rematerializer(reason);
    if (this._store.isDisposed) {
      built.abortController.abort();
      void Promise.resolve(built.warm[Symbol.asyncDispose]()).catch((err) => this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] rebind-after-dispose: warm dispose failed: ${err}`));
      throw new CancellationError();
    }
    if (placeholder.signal.aborted) {
      built.abortController.abort();
      void Promise.resolve(built.warm[Symbol.asyncDispose]()).catch((err) => this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] rebind-aborted: warm dispose failed: ${err}`));
      void Promise.resolve(oldWarm[Symbol.asyncDispose]()).catch((err) => this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] previous WarmQuery dispose failed during aborted rebind: ${err}`));
      this._queue.failAll(new CancellationError());
      this._needsRebind = true;
      throw new CancellationError();
    }
    void Promise.resolve(oldWarm[Symbol.asyncDispose]()).catch((err) => this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] previous WarmQuery dispose failed during rebind: ${err}`));
    this._warm = built.warm;
    this._abortController = built.abortController;
    this._wireAbortHandler(built.abortController);
    this._queue.resetForRebind();
    this._needsRebind = false;
    this._appliedModel = void 0;
    this._appliedEffort = void 0;
    this._appliedPermissionMode = void 0;
    this._bindWarmQuery();
    await this._replayCurrentConfig();
  }
  /**
   * Consumer loop. Drains the SDK iterator, dispatches each message
   * to the {@link ClaudeSdkMessageRouter} (awaited so async file-edit
   * observation completes before the next message), settles the head
   * entry's deferred on `result`, and fires `ChatTurnComplete` only
   * when the queue fully drains.
   *
   * On any uncaught error (cancellation, transport failure, or the
   * post-loop "stream ended without result" guard) the catch block
   * rejects every pending entry's deferred with the same error and
   * marks `_needsRebind=true`. Cancellation is swallowed (don't
   * rethrow); other errors propagate to the void caller's `.catch` for
   * logging.
   */
  async _processMessages() {
    const query = this._query;
    if (!query) {
      throw new Error("ClaudeSdkPipeline._processMessages called before query was bound");
    }
    try {
      for await (const message of query) {
        if (this._abortController.signal.aborted) {
          throw new CancellationError();
        }
        if (message.type === "system" && message.subtype === "init") {
          this._initPlugins = message.plugins ?? [];
          if (!this._isResumed) {
            this._isResumed = true;
          }
        }
        const turnId = this._queue.peekParent()?.turnId;
        const turnDuration = this._queue.peekParent()?.stopWatch.elapsed();
        try {
          await this._router.handle(message, turnId, {
            turnDuration,
            mode: this._currentPermissionMode
          });
        } catch (handlerErr) {
          this._logService.warn(`[ClaudeSdkPipeline:${this.sessionId}] router threw, skipping: ${handlerErr}`);
        }
        if (message.type === "result") {
          const completed = this._queue.settleHead();
          this._logService.info(`[Claude:${this.sessionId}] result for sdkUuid=${completed?.sdkUuid}`);
          if (completed && this._queue.isEmpty) {
            this._onDidProduceSignal.fire({
              kind: "action",
              resource: this.chatChannelUri,
              action: {
                type: ActionType.ChatTurnComplete,
                turnId: completed.turnId,
                duration: Math.max(0, completed.stopWatch.elapsed())
              }
            });
          }
        }
      }
      if (this._abortController.signal.aborted) {
        throw new CancellationError();
      }
      if (this._query !== query) {
        return;
      }
      throw new Error("Claude SDK stream ended without a result message");
    } catch (err) {
      const fatal = err instanceof Error ? err : new Error(String(err));
      if (this._query === query) {
        this._queue.failAll(fatal);
        this._needsRebind = true;
      }
      if (!isCancellationError(fatal)) {
        throw fatal;
      }
    }
  }
};
ClaudeSdkPipeline = __decorateClass([
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ILogService)
], ClaudeSdkPipeline);
export {
  ClaudeSdkPipeline
};
