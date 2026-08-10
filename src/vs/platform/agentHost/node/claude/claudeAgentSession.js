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
import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { INativeEnvironmentService } from "../../../environment/common/environment.js";
import { IFileService } from "../../../files/common/files.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { toRuntimeEffortLevel, resolveClaudeEffort } from "../../common/claudeModelConfig.js";
import { PendingRequestRegistry } from "../../common/pendingRequestRegistry.js";
import { ISessionDataService } from "../../common/sessionDataService.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { areAdditionalWorkingDirectoriesEqual, areSessionWorkingDirectoriesEqual } from "../../common/state/sessionWorkingDirectories.js";
import { ChatInputResponseKind, ToolCallContributorKind } from "../../common/state/protocol/state.js";
import { isDefaultChatUri } from "../../common/state/sessionState.js";
import { IClaudeAgentSdkService } from "./claudeAgentSdkService.js";
import { buildClientMcpServers, buildOptions } from "./claudeSdkOptions.js";
import { claudeTransportForProvider, parseClaudeModelSelection, toClaudeSdkModelId } from "./claudeModelSelection.js";
import { buildServerToolMcpServer, CLAUDE_SERVER_TOOL_MCP_SERVER_NAME, serverToolAllowList } from "./claudeServerToolMcpServer.js";
import { convertToolCallResult } from "./clientTools/claudeClientToolResult.js";
import { readClaudePermissionMode } from "./claudeSessionPermissionMode.js";
import { SessionClientToolsDiff } from "./clientTools/claudeSessionClientToolsModel.js";
import { SessionClientCustomizationsDiff } from "./customizations/claudeSessionClientCustomizationsModel.js";
import { ClaudeCustomizationWatcher, buildDiscoveredCustomizations, resolveClaudeAgentName } from "./customizations/claudeSessionCustomizationDiscovery.js";
import { applyMcpServerEnablement, findMcpChildId, findMcpServerName, getEffectiveMcpServerCustomizations } from "../shared/mcpCustomizationController.js";
import { scanClaudeHooks } from "./customizations/scan/claudeHookScan.js";
import { scanClaudeMcpServers } from "./customizations/scan/claudeMcpScan.js";
import { IAgentHostStateManager } from "../agentHostStateManager.js";
import { IAgentHostOTelService } from "../../common/otel/agentHostOTelService.js";
import { scanClaudeRules } from "./customizations/scan/claudeRuleScan.js";
import { discoverClaudeMultiRootCustomizations } from "./customizations/claudeMultiRootCustomizationDiscovery.js";
import { resolvePromptToContentBlocks } from "./claudePromptResolver.js";
import { ClaudeSdkPipeline } from "./claudeSdkPipeline.js";
import { SubagentRegistry } from "./claudeSubagentRegistry.js";
function resolveCurrentPermissionMode(configurationService, sessionUri, permissionModeFallback) {
  return readClaudePermissionMode(configurationService, sessionUri) ?? permissionModeFallback;
}
let ClaudeAgentSession = class extends Disposable {
  constructor(sessionId, sessionUri, chatChannelUri, workspace, project, model, agent, config, abortController, _pendingClientToolCalls, toolDiff, _permissionModeFallback, _metadataStore, additionalDirectories, _instantiationService, _configurationService, _stateManager, _otelService, _sdkService, _sessionDataService, _logService, _fileService, _environmentService) {
    super();
    this.sessionId = sessionId;
    this.sessionUri = sessionUri;
    this.chatChannelUri = chatChannelUri;
    this.workspace = workspace;
    this._pendingClientToolCalls = _pendingClientToolCalls;
    this._permissionModeFallback = _permissionModeFallback;
    this._metadataStore = _metadataStore;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._stateManager = _stateManager;
    this._otelService = _otelService;
    this._sdkService = _sdkService;
    this._sessionDataService = _sessionDataService;
    this._logService = _logService;
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this._customizationWatcher = this._register(new MutableDisposable());
    /**
     * Phase 12 — per-session registry of Task tool calls that spawn
     * subagents (`SubagentSpawn` records keyed by `tool_use_id`, plus a
     * reverse index from inner `tool_use_id` to its parent Task). Owned
     * here so the registry dies with the session; consumers in the live
     * mapper (`ClaudeSdkMessageRouter` / `claudeMapSessionEvents` /
     * `claudeSubagentSignals`) and the `canUseTool` bridge read from
     * the same instance via the session.
     */
    this.subagents = this._register(new SubagentRegistry());
    /**
     * Phase 7 / S3.2. Tool-permission deferreds parked inside
     * {@link Options.canUseTool}. Keyed by SDK `tool_use_id`.
     */
    this._pendingPermissions = new PendingRequestRegistry();
    /**
     * Phase 7 / S3.2. User-input deferreds parked for interactive tools
     * (`AskUserQuestion`, `ExitPlanMode`). Keyed by `ChatInputRequest.id`.
     */
    this._pendingUserInputs = new PendingRequestRegistry();
    /**
     * Phase 11 — per-session **client-pushed** synced customization
     * snapshot + enablement map. Owns the workbench-supplied
     * {@link ISyncedCustomization} list, the per-URI enablement bits,
     * and the dirty flag drained at the next {@link send} pre-flight.
     * Exists from `createProvisional` onward so client-side reads /
     * toggles work uniformly before and after materialize.
     *
     * Server-side (SDK-discovered) customizations are NOT stored here
     * — they're fetched on demand from the live `Query` in
     * {@link getSessionCustomizations}.
     *
     * See {@link SessionClientCustomizationsDiff}.
     */
    this.clientCustomizationsDiff = this._register(new SessionClientCustomizationsDiff());
    this._onDidSessionProgress = this._register(new Emitter());
    this.onDidSessionProgress = this._onDidSessionProgress.event;
    /**
     * Real Copilot credits (in nano-AIU) billed by CAPI for the current
     * turn, summed across every `/v1/messages` request the SDK made
     * (including subagents). Fed by {@link recordTurnCredits} from the
     * proxy's `onDidReportCredits`, reset at the start of each {@link send},
     * and attached to the turn's `ChatUsage` signal by
     * {@link _enrichSignalWithCredits}. Unlike the SDK's `total_cost_usd`
     * (an Anthropic-list-price estimate), this is what CAPI actually bills.
     */
    this._currentTurnNanoAiu = 0;
    /**
     * Transport the session materialized under (Phase 19). Defaults to `proxy`
     * until {@link materialize} resolves it from {@link IMaterializeContext}.
     * Gates {@link _enrichSignalWithCredits} so native turns never carry a
     * Copilot credits overlay (the proxy is the only credit source).
     */
    this._transportKind = "proxy";
    /**
     * Set by {@link setModel} when a model change crosses transports (Copilot ↔
     * native) on an already-materialized session. Rather than hot-swapping the
     * live subprocess (which stays on the old transport), the switch is deferred:
     * the flag makes the next {@link send} pre-flight rebind. The agent resolves
     * the new transport at send time and hands it in via `switchTransport` (kept
     * in {@link _pendingSwitchTransport}); the rematerializer rebuilds onto it and
     * clears both on success. A failed rebuild leaves them set so the following
     * send retries. Exposed via {@link hasPendingTransportSwitch} so the agent
     * resolves a transport only when one is actually pending.
     */
    this._pendingTransportSwitch = false;
    // #endregion
    // #region Phase 11 — customizations / plugins
    /**
     * Merged fire-and-forget signal that this session's customization
     * surface changed. Fires from three sources:
     *
     * 1. Client-side writes (`adoptClientCustomizations`) — via the
     *    {@link SessionClientCustomizationsDiff} observable wired up in the
     *    constructor.
     * 2. Materialize completes — surfaces the server-side
     *    (SDK-discovered) tier to the workbench for the first time.
     * 3. The send() pre-flight rebind completes — the rebuilt SDK's
     *    resolved set may have changed.
     *
     * Drives a workbench refetch of {@link getSessionCustomizations}.
     * Does NOT itself trigger any SDK action — the dirty bit on
     * {@link SessionClientCustomizationsDiff} drives plugin rebinds,
     * and only flips on client-side writes.
     */
    this._onDidCustomizationsChange = this._register(new Emitter());
    this.onDidCustomizationsChange = this._onDidCustomizationsChange.event;
    /** Snapshot of the last {@link getSessionCustomizations} result, read by {@link _enrichSignalWithMcpContributor}. */
    this._lastCustomizations = [];
    this._chatChannelUri = chatChannelUri;
    this.project = project;
    this._provisionalModel = model;
    this._provisionalAgent = agent;
    this.provisionalConfig = config;
    this.abortController = abortController;
    this._desiredAdditionalDirectories = additionalDirectories;
    this._appliedAdditionalDirectories = additionalDirectories;
    this.toolDiff = this._register(toolDiff);
    this._register(this.clientCustomizationsDiff.onDidChange(() => this._onDidCustomizationsChange.fire()));
    this._watchCustomizations(this.workingDirectories);
  }
  /**
   * URI under which this chat's per-chat resources (its session database,
   * metadata overlay, config scope and server-tool advertisement) are keyed.
   * The default chat uses the real session URI; an additional peer chat uses
   * its own `ahp-chat` channel URI so its chat state stays isolated
   * from the default chat's. `sessionUri` always remains the real session URI
   * and `chatChannelUri` always the chat channel — they are never overloaded.
   */
  get _storageUri() {
    return isDefaultChatUri(this._chatChannelUri) ? this.sessionUri : this._chatChannelUri;
  }
  get _sessionCustomizations() {
    return this._stateManager.getSessionState(this.sessionUri.toString())?.customizations ?? [];
  }
  /**
   * The actual directory work is done in. Defaults to {@link workspace} until
   * the host hands the session a resolved working directory (e.g. an isolated
   * worktree) at {@link materialize} time. `undefined` only when the session is
   * workspace-less and has no resolved directory yet.
   */
  get workingDirectory() {
    return this._workingDirectory ?? this.workspace;
  }
  /**
   * The full ordered working-directory set (index 0 = primary, 1..N =
   * desired additional roots). `undefined` only when the session has no
   * resolved primary yet (workspace-less, pre-materialize).
   */
  get workingDirectories() {
    const primary = this.workingDirectory;
    return primary ? [primary, ...this._desiredAdditionalDirectories] : void 0;
  }
  /** Exposed for the materializer's MCP-server build closure. */
  get pendingClientToolCalls() {
    return this._pendingClientToolCalls;
  }
  /** Snapshot of permission-mode fallback used when live read is undefined. */
  get permissionModeFallback() {
    return this._permissionModeFallback;
  }
  static createProvisional(sessionId, sessionUri, chatChannelUri, workspace, project, model, agent, config, pendingClientToolCalls, permissionModeFallback, metadataStore, instantiationService, additionalDirectories = []) {
    return instantiationService.createInstance(
      ClaudeAgentSession,
      sessionId,
      sessionUri,
      chatChannelUri,
      workspace,
      project,
      model,
      agent,
      config,
      new AbortController(),
      pendingClientToolCalls,
      new SessionClientToolsDiff(),
      permissionModeFallback,
      metadataStore,
      additionalDirectories
    );
  }
  /**
   * Accumulate proxy-reported billed credits for the in-flight turn.
   * Called from {@link ClaudeAgent} for every proxy `onDidReportCredits`
   * routed to this session. Ignores non-positive / non-finite values.
   */
  recordTurnCredits(totalNanoAiu) {
    if (Number.isFinite(totalNanoAiu) && totalNanoAiu > 0) {
      this._currentTurnNanoAiu += totalNanoAiu;
    }
  }
  /**
   * Inject the turn's accumulated Copilot credits into its `ChatUsage`
   * signal as `_meta.copilotUsage.totalNanoAiu` — the well-known key the
   * workbench prefers over `_meta.cost` when rendering per-turn credits.
   * All other signals pass through untouched.
   */
  _enrichSignalWithCredits(signal) {
    if (this._transportKind !== "proxy" || signal.kind !== "action" || signal.action.type !== ActionType.ChatUsage || this._currentTurnNanoAiu <= 0) {
      return signal;
    }
    const usage = signal.action.usage;
    return {
      ...signal,
      action: {
        ...signal.action,
        usage: {
          ...usage,
          _meta: {
            ...usage._meta,
            copilotUsage: { totalNanoAiu: this._currentTurnNanoAiu }
          }
        }
      }
    };
  }
  /**
   * Stamps the MCP {@link ToolCallContributor} onto a `ChatToolCallStart` for
   * an external `mcp__<server>__<tool>` call, resolved from this session's
   * cached customization snapshot. Owned here because the session owns the
   * customization data; the stream mapper stays free of it. (The in-process
   * `mcp__client__` server already carries a Client contributor from the mapper.)
   */
  _enrichSignalWithMcpContributor(signal) {
    if (signal.kind !== "action" || signal.action.type !== ActionType.ChatToolCallStart || signal.action.contributor !== void 0) {
      return signal;
    }
    const toolName = signal.action.toolName;
    if (!toolName.startsWith("mcp__")) {
      return signal;
    }
    const serverName = toolName.split("__")[1];
    const customizationId = serverName ? findMcpChildId(this._lastCustomizations, serverName) : void 0;
    if (customizationId === void 0) {
      return signal;
    }
    return { ...signal, action: { ...signal.action, contributor: { kind: ToolCallContributorKind.MCP, customizationId } } };
  }
  _watchCustomizations(directories) {
    const store = new DisposableStore();
    const watcher = store.add(new ClaudeCustomizationWatcher(
      directories,
      this._environmentService.userHome,
      this._fileService,
      this._logService
    ));
    store.add(watcher.onDidChange(() => this._onDidCustomizationsChange.fire()));
    this._customizationWatcher.value = store;
  }
  /**
   * In-place truncation to `turnId` ("Restore Checkpoint"): prune the
   * per-turn DB rows (file edits, checkpoint refs) past the boundary AND
   * stage the SDK resume anchor that the next rebuild applies via
   * `Options.resumeSessionAt`. These two halves are one invariant — pruning
   * without staging the anchor would drop DB rows while the SDK still
   * replays the truncated turns; staging without pruning would leave stale
   * rows — so they live behind a single call rather than two the caller
   * could half-invoke. The prune runs first because it is the fallible half:
   * a DB failure then rejects without leaving an anchor staged for the next
   * turn. `turnId` is the protocol turn id (DB key); `resumeAnchorUuid` is
   * the SDK assistant-message uuid the agent resolved for it.
   */
  async truncateToTurn(turnId, resumeAnchorUuid) {
    await this._withDatabase((db) => db.deleteTurnsAfter(turnId));
    this._pendingResumeSessionAt = resumeAnchorUuid;
  }
  /** Prunes all per-turn DB rows (remove-all truncation). */
  async pruneAllTurns() {
    await this._withDatabase((db) => db.deleteAllTurns());
  }
  /**
   * Runs `fn` against a short-lived, ref-counted session DB handle so the
   * write is safe regardless of the pipeline's own dbRef lifecycle (the
   * ref-count keeps the shared DB alive; disposing only decrements).
   */
  async _withDatabase(fn) {
    const ref = this._sessionDataService.openDatabase(this._storageUri);
    try {
      await fn(ref.object);
    } finally {
      ref.dispose();
    }
  }
  /**
   * Bring the session up: build SDK `Options`, start the SDK, open the
   * session-scoped DB ref, construct the pipeline, and attach the
   * rematerializer used for yield-restart (e.g. after a client-tool
   * snapshot change). Idempotent on re-call: extra calls throw rather
   * than silently re-materialize.
   *
   * If the supplied {@link IMaterializeContext.proxyHandle}'s underlying
   * `abortController` fires while `sdk.startup()` is in flight, the SDK
   * unwinds via the controller; if `startup` resolves anyway, the
   * `WarmQuery` is asyncDisposed and a {@link CancellationError} is
   * thrown (Q8 belt-and-suspenders).
   */
  async materialize(ctx) {
    if (this._pipeline) {
      throw new Error("ClaudeAgentSession is already materialized");
    }
    const previousWorkingDirectories = this.workingDirectories;
    const resolvedPrimary = ctx.workingDirectories?.[0] ?? ctx.workingDirectory;
    if (resolvedPrimary && !isEqual(resolvedPrimary, this.workingDirectory)) {
      this._workingDirectory = resolvedPrimary;
    }
    if (ctx.workingDirectories && ctx.workingDirectories.length > 0) {
      this._desiredAdditionalDirectories = ctx.workingDirectories.slice(1);
      this._appliedAdditionalDirectories = this._desiredAdditionalDirectories;
    }
    const currentWorkingDirectories = this.workingDirectories;
    if (!areSessionWorkingDirectoriesEqual(previousWorkingDirectories, currentWorkingDirectories, true)) {
      this._watchCustomizations(currentWorkingDirectories);
    }
    if (!this.workingDirectory) {
      throw new Error(`Cannot materialize Claude session ${this.sessionId}: workingDirectory is required`);
    }
    this._transportKind = ctx.transport.kind;
    this._materializedTransport = ctx.transport;
    const permissionMode = readClaudePermissionMode(this._configurationService, this._storageUri) ?? this._permissionModeFallback;
    const { mcpServers, allowedTools } = await this._buildStartupToolWiring(ctx.serverToolHost);
    const agentName = await resolveClaudeAgentName(this._provisionalAgent, this._fileService, this._logService, this.sessionId);
    const telemetry = await this._otelService.getNativeSdkTelemetryConfig();
    const traceContext = this._otelService.getSessionTraceContext(this.sessionId, this.sessionUri.toString());
    const options = await buildOptions(
      {
        sessionId: this.sessionId,
        workingDirectory: this.workingDirectory,
        additionalDirectories: this._appliedAdditionalDirectories,
        model: this._provisionalModel,
        abortController: this.abortController,
        permissionMode,
        canUseTool: ctx.canUseTool,
        onElicitation: ctx.onElicitation,
        isResume: ctx.isResume,
        resumeSessionAt: this._pendingResumeSessionAt,
        mcpServers,
        allowedTools,
        plugins: this.clientCustomizationsDiff.consume(this._desiredClientPluginPaths()),
        agent: agentName,
        telemetry,
        traceContext
      },
      ctx.transport,
      (data) => this._logService.error(`[Claude SDK stderr] ${data}`)
    );
    this._logService.info(`[Claude] session ${this.sessionId}: enableFileCheckpointing=${options.enableFileCheckpointing} isResume=${ctx.isResume}`);
    const warm = await this._sdkService.startup({ options });
    if (this.abortController.signal.aborted) {
      await warm[Symbol.asyncDispose]();
      throw new CancellationError();
    }
    const dbRef = this._sessionDataService.openDatabase(this._storageUri);
    let pipeline;
    try {
      pipeline = this._register(this._instantiationService.createInstance(
        ClaudeSdkPipeline,
        this.sessionId,
        this.sessionUri,
        this._chatChannelUri,
        warm,
        this.abortController,
        dbRef,
        this.subagents,
        (toolName) => this.toolDiff.model.ownerOf(toolName)
      ));
    } catch (err) {
      dbRef.dispose();
      await warm[Symbol.asyncDispose]();
      throw err;
    }
    this._register(pipeline.onDidProduceSignal((s) => this._onDidSessionProgress.fire(this._enrichSignalWithMcpContributor(this._enrichSignalWithCredits(s)))));
    this._pipeline = pipeline;
    this._pendingResumeSessionAt = void 0;
    pipeline.seedCurrentConfig(
      toClaudeSdkModelId(this._provisionalModel),
      toRuntimeEffortLevel(resolveClaudeEffort(this._provisionalModel)),
      permissionMode
    );
    if (!ctx.isResume) {
      try {
        await this._metadataStore.write(this._storageUri, {
          customizationDirectory: this.workingDirectory,
          model: this._provisionalModel,
          permissionMode,
          transport: ctx.transport.kind,
          // Persist the full ordered set so a cold resume / remove-all /
          // fork can recover the tail (the SDK catalog only stores `cwd`).
          // Only meaningful when there is a tail; single-root sessions
          // leave it absent so absence reads as single-root.
          ...this._desiredAdditionalDirectories.length > 0 && this.workingDirectories ? { workingDirectories: this.workingDirectories } : {}
        });
      } catch (err) {
        this._logService.error(`[Claude] Failed to persist customization directory; aborting materialize`, err);
        throw err;
      }
    } else if (ctx.workingDirectories && this.workingDirectories) {
      await this._metadataStore.write(this._storageUri, { workingDirectories: this.workingDirectories });
    }
    if (this.abortController.signal.aborted) {
      throw new CancellationError();
    }
    pipeline.attachRematerializer(async (_reason) => {
      const liveMode = readClaudePermissionMode(this._configurationService, this._storageUri) ?? this._permissionModeFallback;
      const rebuildAbort = new AbortController();
      let rebuildWarm;
      try {
        const rebuildTransport = this._pendingSwitchTransport ?? this._materializedTransport;
        if (!rebuildTransport) {
          throw new Error(`Cannot rebuild Claude session ${this.sessionId}: no transport resolved`);
        }
        const { mcpServers: rebuildMcp, allowedTools: rebuildAllowedTools } = await this._buildStartupToolWiring(ctx.serverToolHost);
        const rebuildAgentName = await resolveClaudeAgentName(this._provisionalAgent, this._fileService, this._logService, this.sessionId);
        const rebuildOptions = await buildOptions(
          {
            sessionId: this.sessionId,
            workingDirectory: this.workingDirectory,
            additionalDirectories: this._desiredAdditionalDirectories,
            model: this._provisionalModel,
            abortController: rebuildAbort,
            permissionMode: liveMode,
            canUseTool: ctx.canUseTool,
            onElicitation: ctx.onElicitation,
            isResume: true,
            resumeSessionAt: this._pendingResumeSessionAt,
            mcpServers: rebuildMcp,
            allowedTools: rebuildAllowedTools,
            plugins: this.clientCustomizationsDiff.consume(this._desiredClientPluginPaths()),
            agent: rebuildAgentName,
            telemetry,
            traceContext
          },
          rebuildTransport,
          (data) => this._logService.error(`[Claude SDK stderr] ${data}`)
        );
        this._logService.info(`[Claude] session ${this.sessionId}: resume rebuild agent=${rebuildOptions.agent ?? "(none)"}`);
        rebuildWarm = await this._sdkService.startup({ options: rebuildOptions });
        const appliedWorkingDirectories = this.workingDirectories;
        if (appliedWorkingDirectories) {
          await this._metadataStore.write(this.sessionUri, { workingDirectories: appliedWorkingDirectories });
        }
        this._pendingResumeSessionAt = void 0;
        this._appliedAdditionalDirectories = this._desiredAdditionalDirectories;
        this._watchCustomizations(this.workingDirectories);
        this._transportKind = rebuildTransport.kind;
        this._materializedTransport = rebuildTransport;
        if (this._pendingSwitchTransport) {
          this._pendingTransportSwitch = false;
          this._pendingSwitchTransport = void 0;
        }
        return { warm: rebuildWarm, abortController: rebuildAbort };
      } catch (err) {
        rebuildAbort.abort();
        await rebuildWarm?.[Symbol.asyncDispose]();
        this.toolDiff.markDirty();
        this.clientCustomizationsDiff.markDirty();
        throw err;
      }
    });
    await this._reconcileMcpServerEnablement();
    ctx.serverToolHost?.advertise(this._storageUri.toString());
    this._onDidCustomizationsChange.fire();
  }
  /**
   * Build the SDK tool wiring shared by the initial materialize and every
   * yield-restart rematerialize: the in-process MCP servers plus the
   * auto-approve allow-list.
   *
   * The MCP servers are the workbench client tools (which round-trip to the
   * workbench) plus, when a server-tool host is wired, the agent host's own
   * server tools (executed in-process). `mcpServers` is `undefined` when
   * neither is present so `Options.mcpServers` is omitted entirely and the
   * SDK keeps its default; `allowedTools` carries the SDK-prefixed server tool
   * names (so they auto-approve without prompting) and is `undefined` when no
   * server-tool host is wired.
   *
   * Keeping both in one place ensures the two startup paths can never drift,
   * and that a newly registered server tool is wired everywhere at once.
   */
  async _buildStartupToolWiring(serverToolHost) {
    const clientServers = await buildClientMcpServers(this.toolDiff, this._pendingClientToolCalls, this._sdkService);
    const serverToolServer = serverToolHost ? await buildServerToolMcpServer(serverToolHost, this._storageUri.toString(), this._sdkService) : void 0;
    const mcpServers = !clientServers && !serverToolServer ? void 0 : {
      ...clientServers ?? {},
      ...serverToolServer ? { [CLAUDE_SERVER_TOOL_MCP_SERVER_NAME]: serverToolServer } : {}
    };
    const autoApproveToolNames = serverToolHost ? serverToolHost.toolNames.filter((name) => !serverToolHost.canRequireConfirmation(name)) : void 0;
    return { mcpServers, allowedTools: autoApproveToolNames ? serverToolAllowList(autoApproveToolNames) : void 0 };
  }
  /** True once {@link materialize} has installed the SDK pipeline. */
  get isPipelineReady() {
    return this._pipeline !== void 0;
  }
  /**
   * Whether this chat currently has a turn in flight or queued. False when
   * provisional (no pipeline) or idle between turns. Used by non-destructive
   * idle release to avoid disconnecting mid-turn.
   */
  get hasActiveTurn() {
    return this._pipeline?.hasActiveTurn ?? false;
  }
  /** Pre-materialize model selection accessor (read by materializer to build Options). */
  get provisionalModel() {
    return this._provisionalModel;
  }
  /**
   * Whether a per-session provider switch is staged and awaiting the next
   * {@link send}. The agent reads this to decide whether to resolve a fresh
   * transport (it owns the live proxy handle) and push it in via `switchTransport`
   * — resolving one only when a switch is actually pending, so ordinary sends
   * never trip the signed-out proxy throw.
   */
  get hasPendingTransportSwitch() {
    return this._pendingTransportSwitch;
  }
  _requirePipeline() {
    if (!this._pipeline) {
      throw new Error("ClaudeAgentSession is not materialized");
    }
    return this._pipeline;
  }
  get isResumed() {
    return this._requirePipeline().isResumed;
  }
  /**
   * Abort the live SDK subprocess and await its full teardown so the
   * session id is released. No-op when the session was never materialized
   * (no subprocess to stop). Used by remove-all truncation before it
   * recreates a fresh session under the same id — the CLI keeps the id
   * locked until the old subprocess exits.
   */
  async shutdownLiveQuery() {
    await this._pipeline?.shutdownAndWait();
  }
  /**
   * Seed the pipeline's current + applied config cache from
   * materialize-time `Options`. The SDK already starts with these
   * values, so the cache prevents a redundant first `setModel` /
   * `applyFlagSettings` call.
   */
  seedBijectiveState(state) {
    this._requirePipeline().seedCurrentConfig(state.model, state.effort, state.permissionMode);
  }
  attachRematerializer(rematerializer) {
    this._requirePipeline().attachRematerializer(rematerializer);
  }
  /**
   * Send a user prompt. Performs the per-turn pre-flight before
   * yielding to the pipeline:
   *
   * - If {@link toolDiff} or {@link clientCustomizationsDiff} reports the
   *   live `Query` is out of sync with the workbench's view, yield-restart
   *   so the SDK picks up the new `Options.mcpServers` / `Options.plugins`.
   *   `Query.reloadPlugins()` cannot help here — the SDK's plugin URI set
   *   is captured at startup, so any add / remove / nonce-bump must go
   *   through a full rebuild. The rebind itself re-applies the live
   *   `permissionMode` via the rematerializer.
   * - Otherwise forward the live `permissionMode` to the bound `Query` so
   *   a `SessionConfigChanged` action that arrived between turns wins.
   *   The pipeline's bijective cache dedupes a no-op `setPermissionMode`,
   *   so this is free when nothing changed.
   *
   * When {@link hasPendingTransportSwitch} is set, the agent resolves the new
   * transport (it owns the live proxy handle) and passes it as `switchTransport`.
   * It is staged for the pre-flight rebuild below, which rebinds the subprocess
   * onto it. The agent resolves one only when a switch is pending, so ordinary
   * sends never carry a transport and the session never calls back to re-resolve.
   *
   * Model / effort are not threaded through here — the pipeline's current
   * model / effort (set eagerly via {@link setModel}) is whatever
   * the SDK has been told.
   */
  async send(prompt, turnId, workingDirectories, switchTransport) {
    const pipeline = this._requirePipeline();
    if (workingDirectories) {
      this._replaceDesiredWorkingDirectories(workingDirectories);
    }
    if (switchTransport) {
      this._pendingSwitchTransport = switchTransport;
    }
    this._currentTurnNanoAiu = 0;
    if (this.toolDiff.hasDifference || this.clientCustomizationsDiff.hasDifferenceFrom(this._desiredClientPluginPaths()) || this._pendingResumeSessionAt !== void 0 || !areAdditionalWorkingDirectoriesEqual(this._appliedAdditionalDirectories, this._desiredAdditionalDirectories) || this._pendingTransportSwitch) {
      await this._rebindForSyncedState();
    } else {
      await pipeline.setPermissionMode(resolveCurrentPermissionMode(this._configurationService, this._storageUri, this._permissionModeFallback));
    }
    await this._reconcileMcpServerEnablement();
    return pipeline.send(prompt, turnId);
  }
  _replaceDesiredWorkingDirectories(workingDirectories) {
    const primary = this.workingDirectory;
    if (!primary || !isEqual(primary, workingDirectories[0])) {
      throw new Error(`Cannot change Claude session primary working directory: ${this.sessionId}`);
    }
    const desiredAdditionalDirectories = workingDirectories.slice(1);
    if (areAdditionalWorkingDirectoriesEqual(this._desiredAdditionalDirectories, desiredAdditionalDirectories)) {
      return;
    }
    this._desiredAdditionalDirectories = desiredAdditionalDirectories;
  }
  /**
   * Single yield-restart that covers both client-tool and
   * customization divergence in one trip. Drains the parked
   * client-tool MCP handlers (same as the original tool-only
   * rebind), then triggers the pipeline rebind — the rematerializer
   * reads `toolDiff` and reducer-backed client plugin paths while
   * building the new `Options`, so the bit on each diff clears in
   * lockstep with the SDK actually receiving the new values. Fires
   * `_onDidCustomizationsChange` afterwards so the workbench
   * refetches `getSessionCustomizations` and picks up any newly
   * resolved server-side entries from the rebuilt `Query`.
   */
  async _rebindForSyncedState() {
    this._pendingClientToolCalls.rejectAll(new CancellationError());
    await this._requirePipeline().rebindForRestart();
    this._onDidCustomizationsChange.fire();
  }
  /**
   * Cancel the in-flight SDK turn. Mirrors the production reference;
   * see {@link ClaudeSdkPipeline.abort}. Also denies any parked
   * permission / user-input requests so the SDK's `canUseTool`
   * callback (and any interactive tool waiting on user input) unwinds
   * with a deny / cancel result instead of leaving stale UI behind.
   */
  abort() {
    this._pendingPermissions.denyAll(false);
    this._pendingUserInputs.denyAll({ response: ChatInputResponseKind.Cancel });
    this._requirePipeline().abort();
  }
  /**
   * Eagerly apply a model change and persist the new selection. Safe to
   * call before or after materialize:
   *
   * - Pre-materialize: stash the model on the session so the first SDK
   *   startup picks it up via `Options.model` / `Options.effort`.
   * - Post-materialize: queue the change on the pipeline; the SDK
   *   applies it on the NEXT user request via
   *   `Query.setModel` / `Query.applyFlagSettings`. `'max'` flows through
   *   unchanged — see {@link toRuntimeEffortLevel}.
   *
   * In both cases the new model is persisted to the per-session
   * metadata overlay so a later resume sees the user's choice.
   *
   * A change that crosses transports (Copilot ↔ native) on a live session
   * defers to a rebuild on the next {@link send} rather than hot-swapping.
   */
  async setModel(model) {
    this._provisionalModel = model;
    const parsed = parseClaudeModelSelection(model);
    const crossesTransport = this.isPipelineReady && parsed.explicitProvider && claudeTransportForProvider(parsed.provider) !== this._transportKind;
    if (crossesTransport) {
      this._pendingTransportSwitch = true;
      this._pipeline?.bufferConfigForRebind(toClaudeSdkModelId(model), toRuntimeEffortLevel(resolveClaudeEffort(model)));
    } else if (this._pipeline) {
      this._pendingTransportSwitch = false;
      this._pendingSwitchTransport = void 0;
      await this._pipeline.setModel(toClaudeSdkModelId(model));
      await this._pipeline.setEffort(toRuntimeEffortLevel(resolveClaudeEffort(model)));
    }
    await this._metadataStore.write(this._storageUri, { model });
  }
  /**
   * Pre-materialize custom-agent selection accessor.
   */
  get provisionalAgent() {
    return this._provisionalAgent;
  }
  /**
   * Change (or clear with `undefined`) the selected custom agent for this
   * session. The SDK captures `Options.agent` at startup with no
   * working runtime control (`applyFlagSettings({ agent })` exists on
   * the SDK surface but doesn't actually swap the live agent), so
   * post-materialize calls flip {@link clientCustomizationsDiff}
   * dirty and the next `send()` pre-flight rebinds with the new agent
   * baked into the rebuilt `Query`. Persisted to the per-session
   * metadata overlay so a resume picks up the choice.
   */
  async setAgent(agent) {
    if (this._provisionalAgent === agent) {
      return;
    }
    this._provisionalAgent = agent;
    if (this._pipeline) {
      this.clientCustomizationsDiff.markDirty();
    }
    await this._metadataStore.write(this._storageUri, { agent: agent ?? null });
  }
  /**
   * Inject a steering message. Builds the `priority: 'now'`
   * {@link SDKUserMessage} and hands it to the pipeline; the pipeline
   * inherits the parent's turnId (CONTEXT.md M10) and fires
   * `steering_consumed` when the SDK accepts it. No-op if the pipeline
   * is aborted.
   */
  injectSteering(steeringMessage) {
    const pipeline = this._requirePipeline();
    if (pipeline.isAborted) {
      return;
    }
    const contentBlocks = resolvePromptToContentBlocks(
      steeringMessage.message.text,
      steeringMessage.message.attachments
    );
    const sdkMessage = {
      type: "user",
      message: { role: "user", content: contentBlocks },
      session_id: this.sessionId,
      parent_tool_use_id: null,
      priority: "now",
      // Reuse the protocol PendingMessage.id as the SDK uuid — same
      // pattern as `ClaudeAgent.sendMessage` reusing turnId. The SDK's
      // `uuid` field is typed as a branded UUID, but the cast at the
      // boundary is the convention for both code paths.
      uuid: steeringMessage.id
    };
    pipeline.injectSteering(sdkMessage, steeringMessage.id);
  }
  /** Live permission-mode change. Forwards to the pipeline; the pipeline remembers it for re-application after a rebind. */
  setPermissionMode(mode) {
    return this._requirePipeline().setPermissionMode(mode);
  }
  // #region Phase 7 / S3.2 — pending state
  /**
   * Atomically register a pending-permission deferred and fire the
   * `pending_confirmation` signal. The SDK is blocked on the returned
   * promise inside its `canUseTool` callback until
   * {@link respondToPermissionRequest} resolves it. Resolves with
   * `false` if the pipeline is aborted.
   */
  requestPermission(args) {
    if (!this._pipeline || this._pipeline.isAborted) {
      return Promise.resolve(false);
    }
    return this._pendingPermissions.registerAndFire(args.toolUseID, () => {
      this._onDidSessionProgress.fire({
        kind: "pending_confirmation",
        chat: this._chatChannelUri,
        state: args.state,
        permissionKind: args.permissionKind,
        ...args.permissionPath !== void 0 ? { permissionPath: args.permissionPath } : {},
        ...args.parentToolCallId !== void 0 ? { parentToolCallId: args.parentToolCallId } : {}
      });
    });
  }
  respondToPermissionRequest(requestId, approved) {
    return this._pendingPermissions.respond(requestId, approved);
  }
  /**
   * Fire a {@link ActionType.ChatInputRequested} action and park on
   * a deferred until {@link respondToUserInputRequest} resolves it.
   * Resolves with `{ response: Cancel }` if the pipeline is aborted.
   */
  requestUserInput(request, parentToolCallId) {
    if (!this._pipeline || this._pipeline.isAborted || !this._pipeline.hasActiveTurn) {
      return Promise.resolve({ response: ChatInputResponseKind.Cancel });
    }
    return this._pendingUserInputs.registerAndFire(request.id, () => {
      this._onDidSessionProgress.fire({
        kind: "action",
        resource: this._chatChannelUri,
        action: {
          type: ActionType.ChatInputRequested,
          request
        },
        ...parentToolCallId !== void 0 ? { parentToolCallId } : {}
      });
    });
  }
  respondToUserInputRequest(requestId, response, answers) {
    return this._pendingUserInputs.respond(requestId, { response, answers });
  }
  // #endregion
  // #region Phase 10 — client tools
  /** Replace a client's registered tools (full replacement). */
  setClientTools(clientId, tools) {
    this.toolDiff.model.setTools(clientId, tools);
  }
  /** This client's registered tools (empty when absent). */
  getClientTools(clientId) {
    return this.toolDiff.model.getTools(clientId);
  }
  /** Remove a client's tool contribution from this session. */
  removeClientTools(clientId) {
    this.toolDiff.model.removeClient(clientId);
  }
  /** Remove a client's customization contribution from this session. */
  removeClientCustomizations(clientId) {
    this.clientCustomizationsDiff.model.removeClient(clientId);
  }
  /**
   * Resolve a parked client-tool MCP handler with the workbench-supplied
   * result. Returns `true` if a matching deferred was found and settled.
   * Unknown ids are a benign no-op — `agentSideEffects.ts` forwards every
   * `ChatToolCallComplete` envelope, so SDK-owned tool completions land
   * here too and must NOT throw.
   */
  completeClientToolCall(toolCallId, result) {
    const converted = convertToolCallResult(result, toolCallId);
    return this._pendingClientToolCalls.respond(toolCallId, converted);
  }
  /**
   * Drive a yield-restart so the SDK picks up the new client-tool set
   * on its next user request. Public entry point for callers that need
   * to force a tool-only rebind; internal pre-flight goes through
   * {@link _rebindForSyncedState}.
   */
  async rebindForClientTools() {
    await this._rebindForSyncedState();
  }
  /**
   * Adopt the result of a global {@link IAgentPluginManager.syncCustomizations}
   * pass (**client-pushed** path). The agent owns the manager (it's
   * a process-wide singleton with a shared on-disk cache) and pushes
   * the resulting snapshot down here. Flips the client-side dirty bit
   * so the next {@link send} pre-flight reloads SDK plugins.
   */
  adoptClientCustomizations(clientId, synced) {
    this.clientCustomizationsDiff.model.setSyncedCustomizations(clientId, synced);
  }
  /**
   * Snapshot of the **client-pushed** customizations on this session.
   * Does NOT include server-side (SDK-discovered) entries — use
   * {@link getSessionCustomizations} for the merged view.
   */
  getClientCustomizations() {
    return this.clientCustomizationsDiff.model.state.get().synced;
  }
  /**
   * Project the union of (a) **client-pushed** customizations and
   * (b) the **server-side** (SDK-discovered) view (commands / agents
   * / MCP servers, including those the SDK discovered on its own
   * from `~/.claude/**`) onto the protocol's
   * {@link Customization} surface, with reducer-backed enablement
   * applied to client-pushed entries.
   *
   * Pre-materialize sessions return only the client-pushed projection
   * — the SDK side has no Query to query yet. A failure to read the
   * SDK snapshot is warn-logged and the client-pushed projection is
   * still returned, so a transient SDK hiccup doesn't blank the UI.
   */
  async getSessionCustomizations() {
    const { synced } = this.clientCustomizationsDiff.model.state.get();
    const userHome = this._environmentService.userHome;
    const [multiRoot, rules, mcpServers, hooks] = await Promise.all([
      discoverClaudeMultiRootCustomizations(this.workingDirectories, userHome, this._fileService, this._logService),
      scanClaudeRules(this.workingDirectory, userHome, this._fileService),
      scanClaudeMcpServers(this.workingDirectory, userHome, this._fileService),
      scanClaudeHooks(this.workingDirectory, userHome, this._fileService)
    ]);
    let sdk;
    if (this._pipeline) {
      try {
        sdk = await this._pipeline.snapshotResolvedCustomizations();
      } catch (err) {
        this._logService.warn(`[Claude:${this.sessionId}] snapshotResolvedCustomizations failed`, err);
      }
    }
    const discoveredCustomizations = buildDiscoveredCustomizations([...multiRoot.discovered, ...rules], mcpServers, hooks, multiRoot.nativePlugins, multiRoot.workingDirectories, userHome, sdk);
    const state = this._sessionCustomizations;
    const desiredById = new Map(state.map((customization) => [customization.id, customization.enabled]));
    const result = synced.map((item) => ({
      ...item.customization,
      enabled: desiredById.get(item.customization.id) ?? item.customization.enabled
    }));
    result.push(...discoveredCustomizations);
    const projected = applyMcpServerEnablement(result, state);
    this._lastCustomizations = projected;
    return projected;
  }
  async _reconcileMcpServerEnablement() {
    const pipeline = this._requirePipeline();
    const state = this._sessionCustomizations;
    const desired = new Map(getEffectiveMcpServerCustomizations(state).map((server) => [server.name, server.enabled]));
    if (desired.size === 0) {
      return;
    }
    if (!await pipeline.reconcileMcpServerEnablement(desired)) {
      throw new Error(`Claude SDK cannot reconcile MCP server enablement`);
    }
  }
  _desiredClientPluginPaths() {
    const state = this._sessionCustomizations;
    const desiredById = new Map(state.map((customization) => [customization.id, customization.enabled]));
    const paths = [];
    for (const synced of this.clientCustomizationsDiff.model.state.get().synced) {
      if (synced.pluginDir && (desiredById.get(synced.customization.id) ?? synced.customization.enabled) !== false) {
        paths.push(synced.pluginDir);
      }
    }
    return paths;
  }
  async startMcpServer(id) {
    const serverName = await this._resolveMcpServerName(id);
    if (!serverName) {
      this._logService.warn(`[Claude:${this.sessionId}] Cannot start unknown MCP server customization ${id}`);
      return;
    }
    const handled = await this._requirePipeline().startMcpServer(serverName);
    if (!handled) {
      await this._rebindForSyncedState();
    }
    this._onDidCustomizationsChange.fire();
  }
  async stopMcpServer(id) {
    const serverName = await this._resolveMcpServerName(id);
    if (!serverName) {
      this._logService.warn(`[Claude:${this.sessionId}] Cannot stop unknown MCP server customization ${id}`);
      return;
    }
    const handled = await this._requirePipeline().stopMcpServer(serverName);
    if (!handled) {
      this._logService.warn(`[Claude:${this.sessionId}] MCP server stop is not supported by the current SDK`);
      return;
    }
    this._onDidCustomizationsChange.fire();
  }
  async _resolveMcpServerName(id) {
    return findMcpServerName(this._lastCustomizations, id) ?? findMcpServerName(await this.getSessionCustomizations(), id);
  }
  // #endregion
  dispose() {
    this._pendingPermissions.denyAll(false);
    this._pendingUserInputs.denyAll({ response: ChatInputResponseKind.Cancel });
    this._pendingClientToolCalls.rejectAll(new CancellationError());
    super.dispose();
  }
};
ClaudeAgentSession = __decorateClass([
  __decorateParam(14, IInstantiationService),
  __decorateParam(15, IAgentConfigurationService),
  __decorateParam(16, IAgentHostStateManager),
  __decorateParam(17, IAgentHostOTelService),
  __decorateParam(18, IClaudeAgentSdkService),
  __decorateParam(19, ISessionDataService),
  __decorateParam(20, ILogService),
  __decorateParam(21, IFileService),
  __decorateParam(22, INativeEnvironmentService)
], ClaudeAgentSession);
export {
  ClaudeAgentSession
};
