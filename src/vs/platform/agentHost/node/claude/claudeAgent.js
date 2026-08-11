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
import { SequencerByKey } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { INativeEnvironmentService } from "../../../environment/common/environment.js";
import { ILogService } from "../../../log/common/log.js";
import { IProductService } from "../../../product/common/productService.js";
import { IAgentPluginManager } from "../../common/agentPluginManager.js";
import { AgentSessionEntry, buildSideChatSourceContext, decodeProviderData, encodeProviderData, prepareSideChatPrompt, stripSideChatContext } from "../agentPeerChats.js";
import { AgentHostConfigKey, agentHostCustomizationConfigSchema } from "../../common/agentHostCustomizationConfig.js";
import { AgentHostClaudeMultiRootEnabledConfigKey, createSchema, platformRootSchema, platformSessionSchema, schemaProperty } from "../../common/agentHostSchema.js";
import { ClaudeSessionConfigKey, narrowClaudePermissionMode } from "../../common/claudeSessionConfigKeys.js";
import { createClaudeThinkingLevelSchema, isClaudeEffortLevel } from "../../common/claudeModelConfig.js";
import { SessionConfigKey } from "../../common/sessionConfigKeys.js";
import { AgentSession, CLAUDE_AGENT_PROVIDER_ID, SubagentChatSignal } from "../../common/agentService.js";
import { ensureWorkspacelessScratchDir } from "../workspacelessScratchDir.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { AHP_AUTH_REQUIRED, ProtocolError } from "../../common/state/sessionProtocol.js";
import { isSubagentSession, parseSubagentSessionUri, buildDefaultChatUri, parseChatUri, parseRequiredSessionUriFromChatUri, isDefaultChatUri } from "../../common/state/sessionState.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { IAgentHostGitHubEndpointService } from "../agentHostGitHubEndpointService.js";
import { IAgentHostGitService } from "../../common/agentHostGitService.js";
import { IAgentHostCheckpointService } from "../../common/agentHostCheckpointService.js";
import { PendingRequestRegistry } from "../../common/pendingRequestRegistry.js";
import { projectFromCopilotContext } from "../copilot/copilotGitProject.js";
import { ICopilotApiService } from "../shared/copilotApiService.js";
import { IClaudeAgentSdkService } from "./claudeAgentSdkService.js";
import { buildModelEnumerationOptions } from "./claudeSdkOptions.js";
import { detectExistingClaudeSetup, resolveClaudeTransportMode } from "./claudeTransportMode.js";
import { mergeClaudeModelCatalogs, resolveClaudeSessionTransport } from "./claudeModelSelection.js";
import { mapSessionMessagesToTurns, resolveForkAnchorUuid } from "./claudeReplayMapper.js";
import { getSubagentTranscript } from "./claudeSubagentResolver.js";
import { SubagentRegistry } from "./claudeSubagentRegistry.js";
import { ClaudeAgentSession } from "./claudeAgentSession.js";
import { handleCanUseTool } from "./claudeCanUseTool.js";
import { handleElicitation } from "./claudeElicitationBridge.js";
import { createPricingMetaFromBilling, normalizeCAPIBilling } from "../../common/agentModelPricing.js";
import { tryParseClaudeModelId } from "./claudeModelId.js";
import { resolvePromptToContentBlocks } from "./claudePromptResolver.js";
import { IClaudeProxyService } from "./claudeProxyService.js";
import { readClaudePermissionMode } from "./claudeSessionPermissionMode.js";
import { ClaudeSessionMetadataStore } from "./claudeSessionMetadataStore.js";
import { IAgentHostStateManager } from "../agentHostStateManager.js";
import { IAgentHostOTelService } from "../../common/otel/agentHostOTelService.js";
const USER_AGENT_PREFIX = "vscode_claude_code";
function isClaudeModel(m) {
  return m.vendor === "Anthropic" && !!m.supported_endpoints?.includes("/v1/messages") && !!m.model_picker_enabled && !!m.capabilities?.supports?.tool_calls && tryParseClaudeModelId(m.id) !== void 0;
}
function toAgentModelInfo(m, provider) {
  const supports = m.capabilities?.supports;
  const supportedEfforts = (supports?.reasoning_effort ?? []).filter(isClaudeEffortLevel);
  const configSchema = createClaudeThinkingLevelSchema(supportedEfforts);
  const policyState = m.policy?.state;
  const billing = normalizeCAPIBilling(m.billing);
  const priceCategory = typeof m.model_picker_price_category === "string" ? m.model_picker_price_category : void 0;
  return {
    provider,
    // CAPI/endpoint format, dotted version (e.g. `claude-haiku-4.5`) — the
    // canonical id through `ModelSelection.id`. Convert to SDK format at SDK
    // seams via `toSdkModelId`.
    id: m.id,
    name: m.name,
    maxContextWindow: m.capabilities?.limits?.max_context_window_tokens,
    maxOutputTokens: m.capabilities?.limits?.max_output_tokens,
    maxPromptTokens: m.capabilities?.limits?.max_prompt_tokens,
    supportsVision: !!supports?.vision,
    ...configSchema ? { configSchema } : {},
    ...policyState ? { policyState } : {},
    _meta: createPricingMetaFromBilling(billing, priceCategory)
  };
}
function fromSdkModelInfo(m, provider) {
  const supportedEfforts = (m.supportedEffortLevels ?? []).filter(isClaudeEffortLevel);
  const configSchema = createClaudeThinkingLevelSchema(supportedEfforts);
  return {
    provider,
    // SDK-canonical id (`m.value`, e.g. `claude-sonnet-4-5-20250929`). Native
    // ids are SDK format end to end; `toSdkModelId` is identity at this seam.
    id: m.value,
    name: m.displayName,
    supportsVision: false,
    ...configSchema ? { configSchema } : {}
  };
}
class ClaudeActiveClientHandle {
  constructor(clientId, displayName, _getTools, _setTools, _syncCustomizations) {
    this.clientId = clientId;
    this.displayName = displayName;
    this._getTools = _getTools;
    this._setTools = _setTools;
    this._syncCustomizations = _syncCustomizations;
    this._customizations = [];
  }
  get tools() {
    return this._getTools();
  }
  set tools(tools) {
    this._setTools(tools);
  }
  get customizations() {
    return this._customizations;
  }
  set customizations(customizations) {
    this._customizations = customizations;
    this._syncCustomizations(customizations);
  }
}
let ClaudeAgent = class extends Disposable {
  constructor(_logService, _copilotApiService, _claudeProxyService, _sdkService, _stateManager, _otelService, _gitService, _checkpointService, _configurationService, _gitHubEndpointService, _instantiationService, _pluginManager, _productService, _environmentService) {
    super();
    this._logService = _logService;
    this._copilotApiService = _copilotApiService;
    this._claudeProxyService = _claudeProxyService;
    this._sdkService = _sdkService;
    this._stateManager = _stateManager;
    this._otelService = _otelService;
    this._gitService = _gitService;
    this._checkpointService = _checkpointService;
    this._configurationService = _configurationService;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._instantiationService = _instantiationService;
    this._pluginManager = _pluginManager;
    this._productService = _productService;
    this._environmentService = _environmentService;
    this.id = CLAUDE_AGENT_PROVIDER_ID;
    this._onDidSessionProgress = this._register(new Emitter());
    this.onDidSessionProgress = this._onDidSessionProgress.event;
    this._onDidCustomizationsChange = this._register(new Emitter());
    this.onDidCustomizationsChange = this._onDidCustomizationsChange.event;
    this._onDidRequireAuth = this._register(new Emitter());
    this.onDidRequireAuth = this._onDidRequireAuth.event;
    this._models = observableValue(this, []);
    this.models = this._models;
    /**
     * Live in-memory session entries, keyed by raw session id (not URI).
     * Each {@link ClaudeSessionEntry} owns its {@link ClaudeAgentSession} plus
     * any per-session disposables registered against it (e.g. the forward
     * subscription to the session's `onDidSessionProgress` event). Disposing
     * the map disposes every entry, which in turn disposes everything
     * registered to it — no parallel maps, no implicit lockstep invariants.
     * {@link createSession} is the only writer; {@link disposeSession} and
     * {@link shutdown} remove via {@link DisposableMap.deleteAndDispose}, which
     * is idempotent if the key has already been removed.
     */
    this._sessions = this._register(new DisposableMap());
    /**
     * Live, in-memory peer-chat backings keyed by the chat's `ahp-chat` channel
     * URI string. Populated by {@link createChat} on creation and by
     * {@link materializeChat} on session restore (decoding the opaque
     * `providerData` the orchestrator persisted). This is the live source of the
     * `chatUri → sdkSessionId` mapping.
     */
    this._chatBackings = /* @__PURE__ */ new Map();
    /**
     * Fires when a peer chat's opaque `providerData` blob changes after creation
     * (e.g. a per-chat model switch) so the orchestrator can re-persist the
     * refreshed token. See {@link IAgent.onDidChangeChatData}.
     */
    this._onDidChangeChatData = this._register(new Emitter());
    this.onDidChangeChatData = this._onDidChangeChatData.event;
    /**
     * Membership channel for chats the agent spawns itself — today the
     * sub-agent chats delegated by a `Task`/`Agent` tool call (and, when the
     * harness gains them, Claude Teams teammates). Derived from the
     * `subagent_started` / `subagent_completed` signals that already flow on
     * {@link onDidSessionProgress}, so the orchestrator records the spawn edge
     * on the unified chat catalog. See {@link IAgent.onDidSpawnChat}.
     */
    this._onDidSpawnChat = this._register(new Emitter());
    this.onDidSpawnChat = this._onDidSpawnChat.event;
    /** Stable active-client handles, keyed by `${sessionId}\0${clientId}`. */
    this._activeClientHandles = /* @__PURE__ */ new Map();
    /**
     * Phase 6: fired once per session when {@link _materializeProvisional}
     * promotes a provisional record into a real {@link ClaudeAgentSession}.
     * The {@link IAgentService} subscribes via the platform contract
     * (`agentService.ts:412`) to dispatch the deferred `sessionAdded`
     * notification — observers don't see the session in their list until
     * persistence has settled.
     */
    this._onDidMaterializeSession = this._register(new Emitter());
    this.onDidMaterializeSession = this._onDidMaterializeSession.event;
    /**
     * Per-session-id serializer shared by {@link disposeSession} and
     * {@link shutdown}. Phase 5 dispose work is synchronous, so the queued
     * tasks resolve immediately and the sequencer is mostly a no-op. The
     * routing is locked in now (per plan section 3.3.4 / section 3.3.6) so
     * Phase 6's real async teardown (`Query.interrupt()`, in-flight metadata
     * writes) inherits per-session serialization for free — a concurrent
     * `disposeSession(uri)` already in flight is awaited before
     * `shutdown()` reuses the same key.
     */
    this._disposeSequencer = new SequencerByKey();
    /**
     * Phase 6: per-session-id serializer for {@link sendMessage}. Held
     * across both {@link _materializeProvisional} AND `entry.send()` so
     * two concurrent first-message calls on the same session collapse
     * into one materialize plus two ordered sends. Separate from
     * {@link _disposeSequencer} so a `disposeSession` racing a first send
     * still serializes against in-flight teardown without deadlocking
     * inside the send sequencer (different key spaces, single
     * race-resolution lattice via the underlying `AbortController`).
     */
    this._sessionSequencer = new SequencerByKey();
    // ---- Chat surface ------------------------------------------------------
    //
    // `chats` exposes the per-chat operations addressed by a single,
    // concrete chat channel URI (the default chat channel or a peer/subagent
    // URI). The default chat's SDK id is still the owning session id, derived
    // inside the harness from the chat URI.
    /**
     * The chat-addressed operation surface
     * ({@link IAgentChats}). Every method addresses a chat by a single,
     * already-resolved chat URI; this maps to the `(session, chat)` pair
     * the agent's internal SDK storage is keyed by (via
     * {@link _resolveChatTarget}).
     */
    this.chats = {
      createChat: (chat, options) => this._createChat(chat, options),
      fork: (chat, source, options) => this._createChat(chat, { ...options, fork: source }),
      disposeChat: (chatUri) => {
        const { session, chat } = this._resolveChatTarget(chatUri);
        return this._disposeChat(session, chat);
      },
      sendMessage: (chatUri, prompt, workingDirectories, attachments, turnId, senderClientId) => {
        return this._sendMessage(chatUri, prompt, workingDirectories, attachments, turnId, senderClientId);
      },
      abort: (chatUri) => {
        return this._abortSession(chatUri);
      },
      changeModel: (chatUri, model) => {
        return this._changeModel(chatUri, model);
      },
      changeAgent: (chatUri, agent) => {
        return this._changeAgent(chatUri, agent);
      },
      getMessages: (chat) => this.getSessionMessages(chat)
    };
    this._metadataStore = _instantiationService.createInstance(ClaudeSessionMetadataStore, this.id);
    this._register(this._claudeProxyService.onDidReportCredits((e) => {
      this._findSessionBySdkId(e.sessionId)?.recordTurnCredits(e.totalNanoAiu);
    }));
    this._register(this._stateManager.onDidChangeSessionTitle(({ session, title }) => {
      if (AgentSession.provider(session) === this.id) {
        this._otelService.emitSessionTitleChanged(AgentSession.id(session), session, title);
      }
    }));
    queueMicrotask(() => {
      void this._startModelRefresh();
    });
  }
  /**
   * Unified per-session lookup. Returns the session's default chat whether it
   * is still provisional or already materialized; callers branch on
   * {@link ClaudeAgentSession.isPipelineReady} when behavior differs.
   */
  _findAnySession(sessionId) {
    return this._sessions.get(sessionId)?.defaultChat;
  }
  /**
   * Resolve the live {@link ClaudeAgentSession} for a chat — the session's
   * default (main) chat, or an additional peer chat addressed by its
   * `ahp-chat` channel URI — via a single uniform lookup in the owning
   * session's chat map. Returns `undefined` when the session (or the chat) is
   * not in memory.
   */
  _findChat(session, chat) {
    const entry = this._sessions.get(AgentSession.id(session));
    if (!entry) {
      return void 0;
    }
    return entry.getChat((chat ?? URI.parse(buildDefaultChatUri(session))).toString());
  }
  _getChatContext(chatOrSession) {
    const chat = parseChatUri(chatOrSession) ? chatOrSession : URI.parse(buildDefaultChatUri(chatOrSession));
    const session = URI.parse(parseRequiredSessionUriFromChatUri(chat));
    const sessionId = AgentSession.id(session);
    const chatKey = chat.toString();
    const resolved = this._sessions.get(sessionId)?.resolveChat(chatKey);
    return {
      session,
      sessionId,
      chatKey,
      target: resolved?.chatSession,
      isPeerChat: resolved ? !resolved.isDefault : chatKey !== buildDefaultChatUri(session)
    };
  }
  /**
   * Resolve a live {@link ClaudeAgentSession} by its SDK chat id,
   * searching every session entry's default chat and its peer chats. Used by
   * SDK-id-addressed callbacks — proxy credit reports and the `canUseTool`
   * permission bridge — which carry the SDK session id, not the chat URI.
   */
  _findSessionBySdkId(sdkSessionId) {
    for (const entry of this._sessions.values()) {
      for (const chat of entry.allChatSessions()) {
        if (chat.sessionId === sdkSessionId) {
          return chat;
        }
      }
    }
    return void 0;
  }
  /** Wrap a {@link ClaudeAgentSession} in a chat-leaf entry and forward its events. */
  _wireEntry(session) {
    const entry = new ClaudeSessionEntry(session);
    entry.addDisposable(session.onDidSessionProgress((signal) => {
      this._onDidSessionProgress.fire(signal);
      this._emitSpawnedChatEvents(signal);
    }));
    entry.addDisposable(session.onDidCustomizationsChange(() => this._onDidCustomizationsChange.fire()));
    return entry;
  }
  /**
   * Create a session container seeding its default (main) chat as the first
   * entry in the uniform chat map, keyed by the session's default-chat URI.
   */
  _seedSessionEntry(sessionId, session, mainSession) {
    const container = new ClaudeSessionEntry();
    container.setDefaultChat(buildDefaultChatUri(session), this._wireEntry(mainSession));
    this._sessions.set(sessionId, container);
    return container;
  }
  /**
   * Bridges the agent's `subagent_started` signal onto the
   * {@link onDidSpawnChat} membership channel. The signals are still forwarded
   * verbatim on {@link onDidSessionProgress} (the orchestrator's
   * `AgentSideEffects` keeps driving the sub-agent turn + parent tool-call
   * content); this event only mirrors the spawn into the unified chat catalog.
   * A completed subagent chat stays live and subscribable (it is removed only
   * on session teardown), so there is no corresponding end event. The catalog
   * add is idempotent so the overlap with the orchestrator's own membership
   * sequencing is safe.
   */
  _emitSpawnedChatEvents(signal) {
    const spawn = SubagentChatSignal.toSpawnEvent(signal);
    if (spawn) {
      this._onDidSpawnChat.fire(spawn);
    }
  }
  /**
   * The fallback transport for a session whose model names no provider (model-less
   * or a bare/legacy id). Read on demand at materialize — never cached — from live
   * availability: a started {@link _proxyHandle} means Copilot is serveable now, a
   * local Claude setup means native is. The precedence (sign-in state, then local
   * setup) is delegated to the pure {@link resolveClaudeTransportMode}. A
   * provider-qualified model bypasses this and routes on its own provider.
   */
  _defaultTransportMode() {
    const allowSignedOutWhenUsable = this._configurationService.getRootValue(agentHostCustomizationConfigSchema, AgentHostConfigKey.AllowSignedOutWhenUsable) === true;
    return resolveClaudeTransportMode({ allowSignedOutWhenUsable, hasGitHubToken: this._proxyHandle !== void 0, hasExistingSetup: this._hasUsableNativeSetup() });
  }
  /**
   * Whether Claude can run without GitHub right now: the signed-out opt-in is on
   * AND a BYO-Anthropic credential is discoverable (see
   * {@link detectExistingClaudeSetup}). Backs both the advertised requirement and
   * the model-less transport default so the two cannot disagree.
   */
  _hasUsableNativeSetup() {
    return this._configurationService.getRootValue(agentHostCustomizationConfigSchema, AgentHostConfigKey.AllowSignedOutWhenUsable) === true && detectExistingClaudeSetup(this._environmentService.userHome.fsPath);
  }
  // #region Descriptor + auth
  getDescriptor() {
    return {
      provider: this.id,
      displayName: localize("claudeAgent.displayName", "Claude"),
      description: localize("claudeAgent.description", "Claude agent backed by the Anthropic Claude Agent SDK"),
      capabilities: {
        multipleChats: { fork: true, sideChat: true },
        ...this._isMultiRootEnabled() ? { multipleWorkingDirectories: { immutablePrimary: true } } : {}
      }
    };
  }
  _isMultiRootEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostClaudeMultiRootEnabledConfigKey) === true;
  }
  getProtectedResources() {
    const copilotResource = this._gitHubEndpointService.getCopilotResource();
    return [
      this._hasUsableNativeSetup() ? { ...copilotResource, required: false } : copilotResource,
      this._gitHubEndpointService.getRepoResource()
    ];
  }
  /**
   * Resolve the active {@link ClaudeTransport} for a session. The transport is
   * derived from `model` via {@link resolveClaudeSessionTransport}: a
   * native-Anthropic model routes native and a Copilot-routed model routes
   * proxy; a model-less or bare/legacy-id session follows the on-demand
   * {@link _defaultTransportMode}. In native mode the transport is always ready (the
   * SDK owns credentials); in proxied mode a started proxy handle is required,
   * otherwise {@link AHP_AUTH_REQUIRED} is thrown so the client can drive
   * Copilot sign-in.
   */
  _ensureAuthenticated(model) {
    const transport = resolveClaudeSessionTransport({
      model,
      defaultMode: this._defaultTransportMode()
    });
    if (transport !== "proxy") {
      return { kind: "native" };
    }
    const handle = this._proxyHandle;
    if (!handle) {
      throw new ProtocolError(
        AHP_AUTH_REQUIRED,
        "Authentication is required to use Claude",
        this.getProtectedResources()
      );
    }
    return { kind: "proxy", handle };
  }
  async authenticate(resource, token) {
    if (resource === this._gitHubEndpointService.getRepoResource().resource) {
      return true;
    }
    if (resource !== this._gitHubEndpointService.getCopilotResource().resource) {
      return false;
    }
    if (this._githubToken === token && this._proxyHandle) {
      this._logService.info("[Claude] Auth token unchanged");
      return true;
    }
    let newHandle;
    try {
      newHandle = await this._claudeProxyService.start(token);
    } catch (err) {
      if (this._proxyHandle) {
        const staleHandle = this._proxyHandle;
        this._proxyHandle = void 0;
        this._githubToken = void 0;
        staleHandle.dispose();
        this._models.set([], void 0);
      }
      this._logService.warn("[Claude] Copilot proxy start failed; Copilot-routed models unavailable until the next sign-in", err);
      void this._startModelRefresh();
      return true;
    }
    const oldHandle = this._proxyHandle;
    this._proxyHandle = newHandle;
    this._githubToken = token;
    this._logService.info("[Claude] Auth token updated");
    oldHandle?.dispose();
    if (oldHandle) {
      this._models.set([], void 0);
    }
    void this._startModelRefresh();
    return true;
  }
  /**
   * {@link IAgent.refreshModels}. Coalesces onto an in-flight refresh and
   * never rejects — {@link _refreshModels} already logs and handles failure.
   *
   * Only safe for callers with no new input to apply (the host's periodic
   * scheduler). Triggers that invalidate the in-flight request — a rotated
   * token, a transport flip — must call {@link _startModelRefresh} so they
   * are not answered by a refresh bound to the superseded input.
   */
  refreshModels() {
    return this._modelRefreshInFlight ?? this._startModelRefresh();
  }
  /**
   * Unconditionally begins a refresh, superseding any in-flight one as the
   * coalescing target. The superseded request stays harmless: its own
   * stale-write guard drops the result if the token or transport moved on.
   */
  _startModelRefresh() {
    const refresh = this._refreshModels().finally(() => {
      if (this._modelRefreshInFlight === refresh) {
        this._modelRefreshInFlight = void 0;
      }
    });
    this._modelRefreshInFlight = refresh;
    return refresh;
  }
  /**
   * Enumerate both providers' catalogs in parallel and publish them as one
   * provider-qualified list via {@link mergeClaudeModelCatalogs}. Each source is
   * optional — the proxy catalog needs a GitHub token, the native catalog needs a
   * local Claude setup — so a source we can't attempt contributes an empty list
   * rather than failing the whole refresh. {@link Promise.allSettled} tolerates
   * one source erroring; only when *every* source we attempted fails do we keep
   * the last known-good catalog instead of blanking, so a transient double
   * failure never wipes the picker.
   *
   * Gating the native half on {@link detectExistingClaudeSetup} is deliberate and
   * load-bearing, not just an optimization. `supportedModels()` returns a *static*
   * list of models the SDK understands — it is not an entitlement or credential
   * check, and it answers even with no `ANTHROPIC_API_KEY`, no
   * `CLAUDE_CODE_OAUTH_TOKEN` and an empty `HOME`. Publishing it unconditionally
   * would advertise models for an agent that cannot serve a single request, which
   * reads downstream as "usable without GitHub" and would hold the Agents window
   * open on an agent that fails on its first turn. An empty catalog is the honest
   * signal: it surfaces as "no models" (`SessionTypeAuthRequirement.Unusable`)
   * rather than a sign-in prompt that would not help.
   */
  async _refreshModels() {
    const tokenAtStart = this._githubToken;
    const hasNativeSetup = detectExistingClaudeSetup(this._environmentService.userHome.fsPath);
    const [proxyOutcome, nativeOutcome] = await Promise.allSettled([
      tokenAtStart ? this._fetchProxyModels(tokenAtStart) : Promise.resolve([]),
      hasNativeSetup ? this._fetchNativeModels() : Promise.resolve([])
    ]);
    if (this._githubToken !== tokenAtStart) {
      return;
    }
    const attempted = (tokenAtStart ? 1 : 0) + (hasNativeSetup ? 1 : 0);
    const failed = (proxyOutcome.status === "rejected" ? 1 : 0) + (nativeOutcome.status === "rejected" ? 1 : 0);
    if (attempted > 0 && failed === attempted) {
      this._logService.error("[Claude] All attempted model sources failed (merged refresh); keeping last known-good catalog");
      return;
    }
    const settledCatalog = (outcome, label) => {
      if (outcome.status === "fulfilled") {
        return outcome.value;
      }
      this._logService.error(outcome.reason, `[Claude] Failed to fetch ${label} models (merged refresh); keeping the other provider`);
      return [];
    };
    const proxyModels = settledCatalog(proxyOutcome, "proxy");
    const nativeModels = settledCatalog(nativeOutcome, "native");
    const merged = mergeClaudeModelCatalogs(proxyModels, nativeModels);
    this._logService.info(`[Claude] Models refreshed (merged). Count: ${merged.length}, ${merged.map((m) => m.name).join(", ")}`);
    this._models.set(merged, void 0);
  }
  /**
   * Native (BYO-Anthropic) model source: enumerate the SDK's built-in /
   * subscription models by opening a throwaway {@link IClaudeAgentSdkService.query}
   * (workspace-free options that read the user's real `~/.claude` config) and
   * calling `Query.supportedModels()` on it, then `close()`. The prompt never
   * yields, so no turn runs and no session transcript is written (verified
   * Phase 19 E2E). Projected with no commercial metadata.
   */
  async _fetchNativeModels() {
    const neverYieldingPrompt = {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {
      }) })
    };
    const options = buildModelEnumerationOptions();
    const query = await this._sdkService.query({ prompt: neverYieldingPrompt, options });
    try {
      const models = await query.supportedModels();
      return models.map((m) => fromSdkModelInfo(m, this.id));
    } finally {
      query.close();
      options.abortController?.abort();
    }
  }
  /**
   * Proxied (Copilot-CAPI) model source: fetch via {@link ICopilotApiService},
   * keep the Claude family, and surface the CAPI-flagged chat-default first.
   * The picker treats `models[0]` as the de facto default (modelPicker.ts:144
   * — `_selectedModel ?? models[0]`) since `IAgentModelInfo` carries no
   * explicit `isDefault` bit; the stable comparator returns 0 for equal-
   * priority models so CAPI's ordering wins on ties.
   */
  async _fetchProxyModels(token) {
    const userAgent = `${USER_AGENT_PREFIX}/${this._productService.version}`;
    const all = await this._copilotApiService.models(token, { headers: { "User-Agent": userAgent }, suppressIntegrationId: true });
    return all.filter(isClaudeModel).sort((a, b) => Number(b.is_chat_default) - Number(a.is_chat_default)).map((m) => toAgentModelInfo(m, this.id));
  }
  // #endregion
  // #region Stubs — implemented in later phases
  async createSession(config = {}) {
    this._ensureAuthenticated(config.model);
    if (config.fork) {
      return this._forkSession(config, config.fork);
    }
    const sessionId = config.session ? AgentSession.id(config.session) : generateUuid();
    const sessionUri = AgentSession.uri(this.id, sessionId);
    const existing = this._findAnySession(sessionId);
    if (existing) {
      await this._seedEagerActiveClient(sessionUri, config.activeClient);
      if (!existing.isPipelineReady) {
        return {
          session: existing.sessionUri,
          resolvedWorkingDirectory: existing.workingDirectory,
          provisional: true,
          ...existing.project ? { project: existing.project } : {}
        };
      }
      return { session: sessionUri, resolvedWorkingDirectory: config.workingDirectories?.[0] };
    }
    const requestedWorkingDirectory = config.workingDirectories?.[0];
    const workingDirectory = requestedWorkingDirectory ?? await ensureWorkspacelessScratchDir(this._environmentService.userHome, sessionId);
    const project = requestedWorkingDirectory ? await projectFromCopilotContext({ cwd: requestedWorkingDirectory.fsPath }, this._gitService) : void 0;
    const permissionMode = this._resolvePermissionMode(config.config);
    const additionalDirectories = config.workingDirectories?.slice(1) ?? [];
    const session = ClaudeAgentSession.createProvisional(
      sessionId,
      sessionUri,
      URI.parse(buildDefaultChatUri(sessionUri)),
      workingDirectory,
      project,
      config.model,
      config.agent,
      config.config,
      new PendingRequestRegistry(),
      permissionMode,
      this._metadataStore,
      this._instantiationService,
      additionalDirectories
    );
    this._seedSessionEntry(sessionId, sessionUri, session);
    await this._seedEagerActiveClient(sessionUri, config.activeClient);
    return {
      session: sessionUri,
      resolvedWorkingDirectory: workingDirectory,
      provisional: true,
      ...project ? { project } : {}
    };
  }
  /**
   * Seed the eagerly-claimed active client (tools + customizations) into the
   * SDK at session creation, mirroring the Copilot agent. Runs for fresh AND
   * reconnected sessions: when the workbench session state already carries the
   * active client, no follow-up `session/activeClientSet` is dispatched to
   * trigger the customization sync, so the built-in skills bundle would never
   * reach Claude otherwise. Progress is suppressed (`quiet`) because the AH
   * service has not created the session state yet — a
   * `SessionCustomizationUpdated` envelope would be orphaned; the completed
   * snapshot is provided via `getSessionCustomizations` immediately after.
   */
  async _seedEagerActiveClient(sessionUri, activeClient) {
    if (!activeClient) {
      return;
    }
    const handle = this.getOrCreateActiveClient(sessionUri, { clientId: activeClient.clientId, displayName: activeClient.displayName });
    handle.tools = activeClient.tools;
    if (activeClient.customizations !== void 0) {
      await this.syncClientCustomizations(sessionUri, activeClient.clientId, activeClient.customizations, { quiet: true });
    }
  }
  /**
   * In-place "Restore Checkpoint" truncation. Keeps turns
   * `[0..turnId]` INCLUSIVE (or removes all turns when `turnId` is
   * omitted) on the **same** session id / URI — unlike fork, which mints a
   * new id. The `turnId` path resolves the protocol turn to its SDK
   * assistant-envelope uuid ({@link resolveForkAnchorUuid}) and stages it
   * as a one-shot `resumeSessionAt` anchor that the next turn's rebuild
   * applies (the truncation finalizes when the next turn writes the
   * branch). Serialized on {@link _sessionSequencer} (same key as
   * `sendMessage`) so the `ChatTruncated` → `ChatTurnStarted` dispatch pair
   * stays ordered. Provisional sessions short-circuit.
   */
  async truncateSession(session, turnId) {
    const sessionId = AgentSession.id(session);
    await this._sessionSequencer.queue(sessionId, async () => {
      const existing = this._findAnySession(sessionId);
      if (existing && !existing.isPipelineReady) {
        this._logService.info(`[Claude:${sessionId}] truncateSession on a provisional session \u2014 nothing to truncate`);
        return;
      }
      if (turnId === void 0) {
        await this._removeAllTurns(session, sessionId, existing);
        return;
      }
      const messages = await this._sdkService.getSessionMessages(sessionId, { includeSystemMessages: true });
      const anchor = resolveForkAnchorUuid(messages, turnId);
      if (anchor === void 0) {
        throw new Error(`Cannot truncate session ${sessionId}: turn ${turnId} not found in transcript`);
      }
      const live = existing ?? await this._resumeSession(sessionId, session);
      await live.truncateToTurn(turnId, anchor);
      this._logService.info(`[Claude:${sessionId}] truncateSession kept [0..${turnId}] (anchor=${anchor})`);
    });
  }
  /**
   * Remove-all ("start over") branch of {@link truncateSession}: there is no
   * anchor to resume at, so tear down the live Query, delete the on-disk
   * transcript via the SDK, then recreate a fresh provisional under the SAME
   * id/URI so the next `sendMessage` materializes non-resume `{ sessionId }`
   * on a clean transcript (keeps the id stable). `deleteSession` is eagerly
   * durable (unlike the lazy `turnId` path), matching its "clear / start
   * over" semantic. `existing` is the live session, or `undefined` on the
   * cold path (unloaded session). Caller serializes on {@link _sessionSequencer}.
   */
  async _removeAllTurns(session, sessionId, existing) {
    const info = existing ? void 0 : await this._sdkService.getSessionInfo(sessionId);
    const workingDirectory = existing?.workingDirectory ?? (info?.cwd ? URI.file(info.cwd) : void 0);
    if (!workingDirectory) {
      throw new Error(`Cannot clear session ${sessionId}: workingDirectory missing (SDK cwd absent and no live session)`);
    }
    let overlay = {};
    try {
      overlay = await this._metadataStore.read(session);
    } catch (err) {
      this._logService.warn(`[Claude:${sessionId}] overlay read failed during remove-all; continuing with defaults`, err);
    }
    const workingDirectories = existing?.workingDirectories ?? (overlay.workingDirectories && overlay.workingDirectories.length > 1 ? [workingDirectory, ...overlay.workingDirectories.slice(1)] : [workingDirectory]);
    await existing?.shutdownLiveQuery();
    this._sessions.deleteAndDispose(sessionId);
    await this._sdkService.deleteSession(sessionId);
    await this.createSession({
      session,
      workingDirectories,
      ...overlay.model ? { model: overlay.model } : {},
      ...overlay.agent ? { agent: overlay.agent } : {},
      ...overlay.permissionMode ? { config: { [ClaudeSessionConfigKey.PermissionMode]: overlay.permissionMode } } : {}
    });
    await this._findAnySession(sessionId)?.pruneAllTurns();
    this._logService.info(`[Claude:${sessionId}] truncateSession removed all turns (deleteSession + fresh same-id)`);
  }
  /**
   * Map an already-resolved chat URI to the `(session, chat)` pair the agent's
   * internal SDK storage is keyed by. A peer (or subagent) chat is addressed by
   * its own `ahp-chat` channel URI, from which the owning session is recovered.
   * The default chat is addressed by its deterministic chat channel URI.
   */
  _resolveChatTarget(chat) {
    const parsed = parseChatUri(chat);
    if (!parsed) {
      throw new Error(`Claude chat operation requires an AHP chat URI: ${chat.toString()}`);
    }
    return { session: URI.parse(parsed.session), chat };
  }
  /**
   * NOT started here (CONTEXT M9): `forkSession` writes the transcript to
   * disk and we return; the `Query` materializes lazily on the first
   * {@link sendMessage} via {@link _resumeSession}. `turnId` is translated
   * to the SDK envelope `uuid` by {@link resolveForkAnchorUuid};
   * `config.fork.turnIdMapping` is ignored (the SDK already remaps uuids).
   */
  async _forkSession(config, fork) {
    if (isSubagentSession(fork.session)) {
      throw new Error("Cannot fork a subagent session");
    }
    const sourceSessionId = AgentSession.id(fork.session);
    const existingSource = this._findAnySession(sourceSessionId);
    if (existingSource && !existingSource.isPipelineReady) {
      throw new Error("Cannot fork a provisional/never-sent session");
    }
    return this._sessionSequencer.queue(sourceSessionId, async () => {
      const messages = await this._sdkService.getSessionMessages(sourceSessionId, { includeSystemMessages: true });
      const upToMessageId = resolveForkAnchorUuid(messages, fork.turnId);
      if (upToMessageId === void 0) {
        throw new Error(`Cannot fork session ${sourceSessionId}: turn ${fork.turnId} not found in transcript`);
      }
      const { sessionId: newSessionId } = await this._sdkService.forkSession(sourceSessionId, { upToMessageId });
      const newSessionUri = AgentSession.uri(this.id, newSessionId);
      let sourceOverlay = {};
      try {
        sourceOverlay = await this._metadataStore.read(fork.session);
      } catch (err) {
        this._logService.warn(`[Claude] fork: source overlay read failed for ${sourceSessionId}; continuing with defaults`, err);
      }
      const model = config.model ?? sourceOverlay.model;
      const agent = config.agent ?? sourceOverlay.agent;
      const permissionMode = narrowClaudePermissionMode(config.config?.[ClaudeSessionConfigKey.PermissionMode]) ?? sourceOverlay.permissionMode;
      const sdkInfo = await this._sdkService.getSessionInfo(newSessionId);
      const workingDirectory = sdkInfo?.cwd ? URI.file(sdkInfo.cwd) : existingSource?.workingDirectory ?? sourceOverlay.workingDirectories?.[0];
      if (!workingDirectory) {
        throw new Error(`Cannot fork session ${sourceSessionId}: forked session ${newSessionId} has no working directory (SDK cwd and source working directory missing)`);
      }
      const additionalDirectories = existingSource?.workingDirectories?.slice(1) ?? sourceOverlay.workingDirectories?.slice(1) ?? [];
      await this._metadataStore.write(newSessionUri, {
        ...model ? { model } : {},
        ...permissionMode ? { permissionMode } : {},
        ...agent ? { agent } : {},
        ...additionalDirectories.length > 0 ? { workingDirectories: [workingDirectory, ...additionalDirectories] } : {}
      });
      let project;
      try {
        project = await projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
      } catch (err) {
        this._logService.warn(`[Claude] fork: project resolution failed for ${newSessionId}; continuing without project`, err);
      }
      return {
        session: newSessionUri,
        resolvedWorkingDirectory: workingDirectory,
        ...project ? { project } : {}
      };
    });
  }
  /**
   * Builds the SDK `canUseTool` permission bridge for a session/chat. The
   * resolver searches both default chats and peer chats by SDK id so a peer
   * chat's tool-permission requests reach its own pending-permission registry.
   */
  _makeCanUseTool(sdkSessionId) {
    return (toolName, input, options) => handleCanUseTool(
      { getSession: (id) => this._findSessionBySdkId(id), configurationService: this._configurationService, serverToolHost: this._serverToolHost },
      sdkSessionId,
      toolName,
      input,
      options
    );
  }
  /**
   * Builds the SDK `onElicitation` bridge for a session/chat. Mirrors
   * {@link _makeCanUseTool}: resolves the session by SDK id (default and peer
   * chats) and delegates to the elicitation bridge, which parks on the
   * session's user-input channel. Phase 10.6.
   */
  _makeOnElicitation(sdkSessionId) {
    return (request, options) => handleElicitation(
      { getSession: (id) => this._findSessionBySdkId(id) },
      sdkSessionId,
      request,
      options
    );
  }
  /**
   * Promote a provisional {@link ClaudeAgentSession} into a live one.
   * Called from {@link sendMessage} inside the {@link _sessionSequencer.queue}
   * block, so concurrent first sends serialize naturally — exactly
   * one materialize per session.
   *
   * Failure modes:
   * - Missing session entry → programmer error, throws.
   * - Missing proxy handle → caller forgot {@link authenticate}, throws.
   * - Aborted before SDK init returns → {@link ClaudeAgentSession.materialize}
   *   disposes the `WarmQuery` and throws {@link CancellationError}.
   * - Customization-directory persistence failure → fatal: the session's
   *   `materialize` throws, the agent drops the entry, and the error
   *   propagates so the caller learns about it.
   * - Aborted post-metadata-write but pre-commit → second abort gate
   *   inside `materialize` throws so we never expose a live pipeline
   *   for a session the caller has already torn down.
   */
  async _materializeProvisional(sessionId, workingDirectories) {
    const session = this._findAnySession(sessionId);
    if (!session) {
      throw new Error(`Cannot materialize unknown provisional session: ${sessionId}`);
    }
    const transport = this._ensureAuthenticated(session.provisionalModel);
    const canUseTool = this._makeCanUseTool(sessionId);
    const onElicitation = this._makeOnElicitation(sessionId);
    try {
      await session.materialize({ transport, canUseTool, onElicitation, isResume: false, workingDirectory: workingDirectories?.[0], workingDirectories, serverToolHost: this._serverToolHost });
    } catch (err) {
      this._sessions.deleteAndDispose(sessionId);
      throw err;
    }
    const materializedWorkingDirectories = workingDirectories ?? session.workingDirectories;
    this._checkpointService.captureBaselineCheckpoint(session.sessionUri, materializedWorkingDirectories).catch((err) => {
      this._logService.warn(`[Claude:${sessionId}] Baseline checkpoint capture failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    this._onDidMaterializeSession.fire({
      session: session.sessionUri,
      project: session.project,
      workingDirectories: materializedWorkingDirectories
    });
    return session;
  }
  /**
   * Bring up a session whose state exists only on disk — created in
   * another window, or before an agent-host restart. Mirror of
   * `CopilotAgent._resumeSession`. Reads `workingDirectory` from the
   * SDK's session record and `model` / `permissionMode` from the
   * metadata overlay, constructs a provisional {@link ClaudeAgentSession},
   * and calls {@link ClaudeAgentSession.materialize} with `isResume: true`
   * so the SDK reloads the existing transcript instead of minting a
   * fresh one.
   *
   * Caller must hold the session sequencer so two concurrent
   * `sendMessage` calls for a freshly-resumed session collapse into
   * one resume + two ordered sends.
   */
  async _resumeSession(sessionId, sessionUri, workingDirectories) {
    this._logService.info(`[Claude:${sessionId}] _resumeSession \u2014 no in-memory state, rebuilding from disk`);
    const sdkInfo = await this._sdkService.getSessionInfo(sessionId);
    if (!sdkInfo) {
      throw new Error(`Cannot resume unknown session: ${sessionId} (not present in SDK transcript store)`);
    }
    const workingDirectory = sdkInfo.cwd ? URI.file(sdkInfo.cwd) : void 0;
    if (!workingDirectory) {
      throw new Error(`Cannot resume session ${sessionId}: workingDirectory missing from SDK transcript`);
    }
    let overlay = {};
    try {
      overlay = await this._metadataStore.read(sessionUri);
    } catch (err) {
      this._logService.warn(`[Claude:${sessionId}] overlay read failed during resume; continuing with defaults`, err);
    }
    const transport = this._ensureAuthenticated(overlay.model);
    const additionalDirectories = workingDirectories ? workingDirectories.slice(1) : overlay.workingDirectories?.slice(1) ?? [];
    const permissionMode = readClaudePermissionMode(this._configurationService, sessionUri) ?? overlay.permissionMode ?? "default";
    let project;
    try {
      project = await projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
    } catch (err) {
      this._logService.warn(`[Claude:${sessionId}] project resolution failed during resume; continuing without project`, err);
    }
    const session = ClaudeAgentSession.createProvisional(
      sessionId,
      sessionUri,
      URI.parse(buildDefaultChatUri(sessionUri)),
      workingDirectory,
      project,
      overlay.model,
      overlay.agent,
      void 0,
      new PendingRequestRegistry(),
      permissionMode,
      this._metadataStore,
      this._instantiationService,
      additionalDirectories
    );
    this._seedSessionEntry(sessionId, sessionUri, session);
    const canUseTool = this._makeCanUseTool(sessionId);
    const onElicitation = this._makeOnElicitation(sessionId);
    try {
      await session.materialize({ transport, canUseTool, onElicitation, isResume: true, workingDirectories, serverToolHost: this._serverToolHost });
    } catch (err) {
      this._sessions.deleteAndDispose(sessionId);
      throw err;
    }
    this._onDidMaterializeSession.fire({
      session: sessionUri,
      project,
      workingDirectories: session.workingDirectories
    });
    return session;
  }
  /**
   * Pull `permissionMode` out of the post-validation `IAgentCreateSessionConfig.config`
   * bag, narrowing the runtime `unknown` value to the SDK's `PermissionMode`
   * union (5/6 values, excluding `dontAsk`; sdk.d.ts:1560). Falls back to
   * `'default'` when the bag is absent or carries something the schema
   * validator shouldn't have accepted (defense-in-depth).
   */
  _resolvePermissionMode(config) {
    return narrowClaudePermissionMode(config?.[ClaudeSessionConfigKey.PermissionMode]) ?? "default";
  }
  disposeSession(session) {
    const sessionId = AgentSession.id(session);
    return this._disposeSequencer.queue(sessionId, async () => {
      await this._teardownEntry(sessionId);
      this._pruneActiveClientHandles(sessionId);
      this._otelService.releaseSessionTraceContext(session.toString());
    });
  }
  /**
   * Non-destructive counterpart to {@link disposeSession}: releases the
   * session's in-memory resources — its live SDK subprocess (via the disposed
   * pipeline) and cached entry — but preserves the on-disk session so it can
   * be transparently resumed later via {@link _resumeSession}. Used by
   * idle-session eviction to bound memory in long-lived host processes.
   *
   * No-ops for provisional sessions (never materialized, so nothing on disk to
   * resume from) and for sessions with a turn in flight — tearing the pipeline
   * down mid-turn would abort live work. Shares the same in-memory teardown as
   * {@link disposeSession}; the destructive difference (deleting durable data)
   * lives in the orchestrator, which only invokes it on dispose.
   */
  releaseSession(session) {
    const sessionId = AgentSession.id(session);
    return this._disposeSequencer.queue(sessionId, async () => {
      const entry = this._sessions.get(sessionId);
      if (!entry) {
        return;
      }
      if (!entry.defaultChat?.isPipelineReady) {
        return;
      }
      if (entry.allChatSessions().some((chatSession) => chatSession.hasActiveTurn)) {
        return;
      }
      this._logService.info(`[Claude:${sessionId}] Releasing idle session from memory (durable state preserved)`);
      await this._teardownEntry(sessionId);
      this._pruneActiveClientHandles(sessionId);
    });
  }
  /**
   * Abort and dispose a session entry — its default chat and every peer chat.
   * Each peer teardown serializes on the peer's own {@link _sessionSequencer}
   * key so it waits for any in-flight materialize/send rather than disposing
   * the chat under it.
   */
  async _teardownEntry(sessionId) {
    const entry = this._sessions.get(sessionId);
    if (!entry) {
      return;
    }
    const defaultChat = entry.defaultChat;
    if (defaultChat && !defaultChat.isPipelineReady) {
      defaultChat.abortController.abort();
    }
    await Promise.all(entry.peerChatKeys().map(
      (chatKey) => this._sessionSequencer.queue(chatKey, async () => {
        const peer = entry.getPeerChat(chatKey);
        if (peer) {
          if (!peer.isPipelineReady) {
            peer.abortController.abort();
          } else {
            peer.abort();
          }
        }
        entry.disposePeerChat(chatKey);
      })
    ));
    this._sessions.deleteAndDispose(sessionId);
    for (const chatKey of [...this._chatBackings.keys()]) {
      const parsed = parseChatUri(URI.parse(chatKey));
      if (parsed && AgentSession.id(URI.parse(parsed.session)) === sessionId) {
        this._chatBackings.delete(chatKey);
      }
    }
  }
  // #region Multi-chat — additional (non-default) peer chats
  /**
   * Create an additional peer chat within an existing session. The new chat
   * is backed by its own SDK chat (a fresh one, or a fork of the
   * source chat at a turn) that shares the parent session's working directory
   * and inherited model / agent / permission-mode parentSession. The backing is
   * recorded in the live {@link _chatBackings} map and returned as an opaque
   * `providerData` blob for the orchestrator to persist; the chat's metadata
   * overlay is seeded so a later lazy resume inherits the parent parentSession. The
   * live {@link ClaudeAgentSession} is built lazily on the chat's first send
   * (mirroring how default sessions materialize lazily).
   */
  async _createChat(chat, options) {
    if (options?.model) {
      this._ensureAuthenticated(options.model);
    }
    if (isDefaultChatUri(chat)) {
      return;
    }
    const parsed = parseChatUri(chat);
    if (!parsed) {
      throw new Error(`[Claude] createChat: malformed chat URI ${chat.toString()}`);
    }
    const session = URI.parse(parsed.session);
    const chatKey = chat.toString();
    const parentSessionId = AgentSession.id(session);
    let result;
    const queueKey = options?.sideChat ? chatKey : parentSessionId;
    await this._sessionSequencer.queue(queueKey, async () => {
      const existing = this._chatBackings.get(chatKey);
      if (existing) {
        result = { providerData: encodeProviderData(existing), backingSession: AgentSession.uri(this.id, existing.sdkSessionId) };
        return;
      }
      const parentSession = await this._resolveParentSession(session, parentSessionId);
      const model = options?.model ?? parentSession.model;
      let sdkSessionId;
      let sideChat;
      if (options?.fork) {
        sdkSessionId = (await this._forkChat(session, options.fork))?.sessionId;
      } else if (options?.sideChat) {
        const forked = await this._forkChat(session, { source: options.sideChat.source, turnId: options.sideChat.providerAnchorTurnId ?? options.sideChat.turnId });
        sdkSessionId = forked?.sessionId;
        const fallbackContext = options.sideChat.sourceContext ?? (!forked ? this._buildSideChatContext(session, options.sideChat.source, options.sideChat.turnId) : void 0);
        if (!forked && !fallbackContext && !options.sideChat.partialResponse) {
          throw new Error(`[Claude] createChat side chat: source turn ${options.sideChat.turnId} could not be forked`);
        }
        sideChat = {
          source: options.sideChat.source.toString(),
          turnId: options.sideChat.turnId,
          ...options.sideChat.selection ? { selection: options.sideChat.selection } : {},
          ...options.sideChat.providerAnchorTurnId ? { providerAnchorTurnId: options.sideChat.providerAnchorTurnId } : {},
          inheritedTurnCount: forked?.inheritedTurnCount ?? 0,
          ...fallbackContext ? { context: fallbackContext } : {},
          ...options.sideChat.partialResponse ? { partialResponse: options.sideChat.partialResponse } : {}
        };
      }
      sdkSessionId ??= generateUuid();
      const backing = { sdkSessionId, ...model ? { model } : {}, ...sideChat ? { sideChat } : {} };
      this._chatBackings.set(chatKey, backing);
      result = { providerData: encodeProviderData(backing), backingSession: AgentSession.uri(this.id, sdkSessionId) };
      await this._metadataStore.write(chat, {
        ...model ? { model } : {},
        ...parentSession.agent ? { agent: parentSession.agent } : {},
        ...parentSession.permissionMode ? { permissionMode: parentSession.permissionMode } : {}
      });
      this._logService.info(`[Claude] Created additional chat ${chat.toString()} in session ${session.toString()}${options?.fork ? " (forked)" : ""}`);
    });
    return result;
  }
  /**
   * Dispose an additional peer chat, tearing down its live chat (if
   * any) and dropping its live backing. The default chat cannot be disposed in
   * isolation — it lives and dies with the session.
   *
   * Routed through {@link _sessionSequencer} (keyed on the chat URI) so it
   * waits for any in-flight {@link _materializeChatLocked} or
   * {@link sendMessage} to finish before tearing down — prevents
   * use-after-dispose if a send is concurrently in progress. The durable
   * peer-chat catalog is owned by the orchestrator now, so this only drops the
   * live backing and chat.
   */
  async _disposeChat(session, chat) {
    if (isDefaultChatUri(chat)) {
      return;
    }
    const chatKey = chat.toString();
    const parentSessionId = AgentSession.id(session);
    await this._sessionSequencer.queue(chatKey, async () => {
      const entry = this._sessions.get(parentSessionId);
      const peer = entry?.getPeerChat(chatKey);
      if (peer) {
        if (!peer.isPipelineReady) {
          peer.abortController.abort();
        } else {
          peer.abort();
        }
        entry.disposePeerChat(chatKey);
      }
      this._chatBackings.delete(chatKey);
    });
  }
  /**
  /**
   * Resolve the inherited session settings (working directory, project, model, agent,
   * permission mode) a new or resumed peer chat copies from its parent
   * session. Prefers the live in-memory parent; falls back to the SDK's
   * on-disk session record + metadata overlay for an unloaded parent.
   */
  async _resolveParentSession(session, parentSessionId) {
    const parent = this._findAnySession(parentSessionId);
    let workingDirectory = parent?.workingDirectory;
    let project = parent?.project;
    if (!workingDirectory) {
      const sdkInfo = await this._sdkService.getSessionInfo(parentSessionId);
      workingDirectory = sdkInfo?.cwd ? URI.file(sdkInfo.cwd) : void 0;
    }
    if (!workingDirectory) {
      throw new Error(`[Claude] createChat: cannot resolve working directory for parent session ${session.toString()}`);
    }
    if (!project) {
      try {
        project = await projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
      } catch (err) {
        this._logService.warn(`[Claude] createChat: project resolution failed for ${session.toString()}; continuing without project`, err);
      }
    }
    let overlay = {};
    try {
      overlay = await this._metadataStore.read(session);
    } catch (err) {
      this._logService.warn(`[Claude] createChat: parent overlay read failed for ${session.toString()}; continuing with defaults`, err);
    }
    const permissionMode = readClaudePermissionMode(this._configurationService, session) ?? overlay.permissionMode ?? "default";
    const additionalDirectories = parent?.workingDirectories?.slice(1) ?? overlay.workingDirectories?.slice(1) ?? [];
    const model = parent?.provisionalModel ?? overlay.model;
    return { workingDirectory, additionalDirectories, project, model, agent: overlay.agent, permissionMode };
  }
  /**
   * Fork the source chat's SDK chat at the requested turn into a new
   * chat and return its SDK session id. Returns `undefined` (so the
   * caller creates a fresh chat instead) when the source chat or the
   * fork anchor cannot be resolved.
   */
  async _forkChat(session, fork) {
    const sourceSdkId = await this._resolveChatSdkId(session, fork.source);
    if (!sourceSdkId) {
      this._logService.warn(`[Claude] createChat fork: source ${fork.source.toString()} has no SDK chat; creating fresh chat`);
      return void 0;
    }
    const messages = await this._sdkService.getSessionMessages(sourceSdkId, { includeSystemMessages: true });
    const upToMessageId = resolveForkAnchorUuid(messages, fork.turnId);
    if (upToMessageId === void 0) {
      this._logService.warn(`[Claude] createChat fork: turn ${fork.turnId} not found in source ${sourceSdkId}; creating fresh chat`);
      return void 0;
    }
    const { sessionId } = await this._sdkService.forkSession(sourceSdkId, { upToMessageId });
    const anchorIndex = messages.findIndex((message) => message.uuid === upToMessageId);
    const inheritedTurnCount = mapSessionMessagesToTurns(messages.slice(0, anchorIndex + 1), fork.source, this._logService).length;
    return { sessionId, inheritedTurnCount };
  }
  /**
   * Resolve the SDK chat id backing a chat URI — the session's
   * default chat (the parent session's own id) or an additional peer chat
   * (from the in-memory entry, else the live/legacy backing).
   */
  async _resolveChatSdkId(session, chatUri) {
    if (isDefaultChatUri(chatUri) || chatUri.toString() === session.toString()) {
      return AgentSession.id(session);
    }
    const inMemory = this._findChat(session, chatUri)?.sessionId;
    if (inMemory) {
      return inMemory;
    }
    return this._resolveChatBacking(chatUri)?.sdkSessionId;
  }
  _getSourceChatState(session, chatUri) {
    if (isDefaultChatUri(chatUri) || chatUri.toString() === session.toString()) {
      return this._stateManager.getDefaultChatState(session.toString());
    }
    return this._stateManager.getChatState(chatUri.toString());
  }
  _buildSideChatContext(session, chatUri, turnId) {
    const state = this._getSourceChatState(session, chatUri);
    if (!state) {
      return void 0;
    }
    const completedIndex = state.turns.findIndex((turn) => turn.id === turnId);
    const boundedTurns = completedIndex >= 0 ? state.turns.slice(0, completedIndex + 1) : state.activeTurn?.id === turnId ? state.turns : void 0;
    return boundedTurns ? buildSideChatSourceContext(boundedTurns, state.activeTurn?.id === turnId ? state.activeTurn : void 0) : void 0;
  }
  /**
   * Resolves the live backing for a peer chat from the in-memory
   * {@link _chatBackings} map. Returns `undefined` for a chat that has not been
   * materialized via {@link materializeChat}.
   */
  _resolveChatBacking(chat) {
    return this._chatBackings.get(chat.toString());
  }
  /**
   * Return the in-memory entry for a session, creating a provisional (not yet
   * materialized) default chat to host its peer chats if none exists — e.g. a
   * peer chat is sent to after a restart before the default chat is touched.
   * Serialized on the session id so concurrent peer sends share one entry.
   */
  _ensureSessionEntry(session) {
    const sessionId = AgentSession.id(session);
    return this._sessionSequencer.queue(sessionId, async () => {
      const existing = this._sessions.get(sessionId);
      if (existing) {
        return existing;
      }
      const parentSession = await this._resolveParentSession(session, sessionId);
      const mainSession = ClaudeAgentSession.createProvisional(
        sessionId,
        session,
        URI.parse(buildDefaultChatUri(session)),
        parentSession.workingDirectory,
        parentSession.project,
        parentSession.model,
        parentSession.agent,
        void 0,
        new PendingRequestRegistry(),
        parentSession.permissionMode,
        this._metadataStore,
        this._instantiationService,
        parentSession.additionalDirectories
      );
      return this._seedSessionEntry(sessionId, session, mainSession);
    });
  }
  /**
   * Build + materialize the peer chat's live {@link ClaudeAgentSession},
   * resuming its persisted SDK chat when one already exists on disk
   * (forked or restored chats) or starting fresh otherwise. The caller MUST
   * hold the per-chat (`chat.toString()`) {@link _sessionSequencer} lock so
   * concurrent first sends collapse into one materialize and teardown can't
   * race the build.
   */
  async _materializeChatLocked(session, chat, workingDirectories) {
    const chatKey = chat.toString();
    const entry = await this._ensureSessionEntry(session);
    const existing = entry.getPeerChat(chatKey);
    if (existing?.isPipelineReady) {
      return existing;
    }
    const chatSession = existing ?? await this._buildProvisionalChat(session, chat, entry);
    const sdkInfo = await this._sdkService.getSessionInfo(chatSession.sessionId);
    const transport = this._ensureAuthenticated(chatSession.provisionalModel);
    const canUseTool = this._makeCanUseTool(chatSession.sessionId);
    const onElicitation = this._makeOnElicitation(chatSession.sessionId);
    try {
      await chatSession.materialize({ transport, canUseTool, onElicitation, isResume: !!sdkInfo, workingDirectories, serverToolHost: this._serverToolHost });
    } catch (err) {
      entry.disposePeerChat(chatKey);
      throw err;
    }
    return chatSession;
  }
  /**
   * Build a provisional peer-chat {@link ClaudeAgentSession} from its live (or
   * legacy) backing + overlay: its `sessionUri` is the real parent session URI
   * and its `chatChannelUri` is the chat's own channel (never overloaded),
   * backed by the resolved SDK chat id. Registers it on the owning
   * {@link ClaudeSessionEntry}; the caller materializes it.
   */
  async _buildProvisionalChat(session, chat, entry) {
    const info = this._resolveChatBacking(chat);
    if (!info) {
      throw new Error(`[Claude] no backing chat for chat ${chat.toString()}`);
    }
    const parentSession = await this._resolveParentSession(session, AgentSession.id(session));
    let overlay = {};
    try {
      overlay = await this._metadataStore.read(chat);
    } catch (err) {
      this._logService.warn(`[Claude] chat overlay read failed for ${chat.toString()}; continuing with defaults`, err);
    }
    const permissionMode = readClaudePermissionMode(this._configurationService, chat) ?? overlay.permissionMode ?? parentSession.permissionMode;
    const model = overlay.model ?? info.model;
    const chatSession = ClaudeAgentSession.createProvisional(
      info.sdkSessionId,
      session,
      chat,
      parentSession.workingDirectory,
      parentSession.project,
      model,
      overlay.agent ?? parentSession.agent,
      void 0,
      new PendingRequestRegistry(),
      permissionMode,
      this._metadataStore,
      this._instantiationService,
      parentSession.additionalDirectories
    );
    entry.registerPeerChat(chat.toString(), this._wireEntry(chatSession));
    return chatSession;
  }
  /**
   * Update a peer chat's live backing model and push the refreshed opaque
   * `providerData` blob to the orchestrator (via
   * {@link onDidChangeChatData}) so the durable catalog stays in sync.
   */
  async _updateChatBackingModel(chat, model) {
    const backing = this._resolveChatBacking(chat);
    if (!backing) {
      return;
    }
    const updated = { ...backing, model };
    this._chatBackings.set(chat.toString(), updated);
    this._onDidChangeChatData.fire({ chat, providerData: encodeProviderData(updated) });
  }
  /**
   * Re-attach the in-memory backing for a peer chat on session restore,
   * decoding the opaque `providerData` the orchestrator persisted at creation
   * (or the latest {@link onDidChangeChatData}). After this resolves the
   * chat's backing SDK chat can be resumed lazily on its first send.
   * Best-effort — a corrupt/unknown blob is logged and dropped rather than
   * thrown.
   */
  async materializeChat(chat, providerData) {
    if (isDefaultChatUri(chat)) {
      return;
    }
    const chatInfo = parseChatUri(chat);
    if (!chatInfo) {
      return;
    }
    if (providerData === void 0) {
      return;
    }
    const backing = decodeProviderData(providerData);
    if (!backing) {
      this._logService.warn(`[Claude] materializeChat: dropping corrupt providerData for ${chat.toString()}`);
      return;
    }
    this._chatBackings.set(chat.toString(), backing);
  }
  // #endregion
  /**
   * Test-only accessor for the materialized {@link ClaudeAgentSession}.
   * Phase 6 section 5.1 Test 10 needs to inspect `_isResumed` directly because
   * Phase 6 has no teardown+recreate flow yet to observe its effect
   * (the flag drives `Options.resume = sessionId` in Phase 7+). Marked
   * `ForTesting` so the production surface stays unaware of its
   * existence; the protocol surface (`IAgent`) does not include it.
   */
  getSessionForTesting(session) {
    const sess = this._sessions.get(AgentSession.id(session))?.defaultChat;
    return sess?.isPipelineReady ? sess : void 0;
  }
  /**
   * Reconstruct the full turn history from the SDK's on-disk JSONL transcript.
   * Provisional sessions return `[]`; transcript failures are logged and return `[]`.
   */
  async getSessionMessages(session) {
    if (!await this._sdkService.canLoadWithoutDownload()) {
      this._logService.info("[Claude] SDK not downloaded yet; deferring session messages until a session triggers the download");
      return [];
    }
    if (isSubagentSession(session)) {
      const parsed = parseSubagentSessionUri(session);
      if (!parsed) {
        return [];
      }
      const parentSessionId = AgentSession.id(parsed.parentSession);
      const parentSession = this._sessions.get(parentSessionId)?.defaultChat;
      const store = new DisposableStore();
      const subagents = parentSession?.subagents ?? store.add(new SubagentRegistry());
      try {
        if (!parentSession) {
          await this._reconstructTurns(parentSessionId, parsed.parentSession, subagents);
        }
        return await getSubagentTranscript(session, subagents, this._sdkService, this._logService, CancellationToken.None);
      } catch (err) {
        this._logService.warn(`[Claude] getSubagentTranscript threw for ${session.toString()}`, err);
        return [];
      } finally {
        store.dispose();
      }
    }
    const chat = parseChatUri(session) ? session : URI.parse(buildDefaultChatUri(session));
    const chatInfo = parseChatUri(chat);
    if (!chatInfo) {
      return [];
    }
    const parentSessionUri = URI.parse(chatInfo.session);
    const sessionId = AgentSession.id(parentSessionUri);
    const context = this._getChatContext(chat);
    if (context.isPeerChat) {
      const sdkId = await this._resolveChatSdkId(parentSessionUri, chat);
      if (!sdkId) {
        return [];
      }
      const turns = await this._reconstructTurns(sdkId, chat, context.target?.subagents);
      const sideChat = this._resolveChatBacking(chat)?.sideChat;
      return stripSideChatContext(turns.slice(sideChat?.inheritedTurnCount ?? 0), sideChat);
    }
    const sess = context.target;
    if (sess && !sess.isPipelineReady) {
      this._logService.info(`[Claude] getSessionMessages: chat ${chat.toString()} is not materialized yet; returning no turns`);
      return [];
    }
    return this._reconstructTurns(sessionId, parentSessionUri, sess?.subagents);
  }
  /**
   * Fetch a chat's SDK transcript ({@link sdkSessionId}) and map it to
   * protocol {@link Turn}s routed to {@link routingUri} (the session or chat
   * channel URI). When {@link subagents} is supplied, it is primed from the agentId suffixes the
   * SDK encoded in Task tool_result blocks. Resilient: any failure warn-logs
   * and returns `[]` rather than propagating.
   */
  async _reconstructTurns(sdkSessionId, routingUri, subagents) {
    let messages;
    try {
      messages = await this._sdkService.getSessionMessages(sdkSessionId, { includeSystemMessages: true });
    } catch (err) {
      this._logService.warn(`[Claude] getSessionMessages SDK fetch failed for ${sdkSessionId}`, err);
      return [];
    }
    let turns;
    try {
      turns = mapSessionMessagesToTurns(messages, routingUri, this._logService);
    } catch (err) {
      this._logService.warn(`[Claude] replay mapper threw for ${sdkSessionId}`, err);
      return [];
    }
    if (turns.length === 0 && messages.length > 0) {
      this._logService.warn(`[Claude] replay produced no turns from ${messages.length} transcript message(s) for ${sdkSessionId}; chat will render empty`);
    }
    try {
      subagents?.primeFromTranscript(turns);
    } catch (err) {
      this._logService.warn(`[Claude] primeFromTranscript threw for ${sdkSessionId}`, err);
    }
    return turns;
  }
  async listSessions() {
    let sdkEntries;
    try {
      if (!await this._sdkService.canLoadWithoutDownload()) {
        this._logService.info("[Claude] SDK not downloaded yet; deferring session list until a session triggers the download");
        return [];
      }
      sdkEntries = await this._sdkService.listSessions();
    } catch (err) {
      this._logService.warn("[Claude] SDK listSessions failed; surfacing empty list", err);
      return [];
    }
    return Promise.all(sdkEntries.map((entry) => {
      const meta = this._metadataStore.project(entry);
      return this._withPersistedWorkingDirectories(meta.session, meta);
    }));
  }
  /**
   * Phase 6.1 / Cycle D4 — per-session lookup. Mirrors
   * {@link CopilotAgent.getSessionMetadata} but accepts the
   * external-CLI case: a session that exists on disk via the raw
   * Anthropic CLI has no per-session DB, so we MUST NOT gate on the
   * sidecar (the way Copilot's variant does). The SDK is the source
   * of truth for existence.
   *
   * The SDK entry supplies the authoritative primary directory; an optional
   * per-session overlay hydrates the additional-directory tail. External
   * sessions without an overlay remain valid single-root entries. Failures in
   * the SDK lookup propagate (the caller is doing a single targeted fetch and
   * should learn that the SDK module is broken).
   */
  async getSessionMetadata(session) {
    if (!await this._sdkService.canLoadWithoutDownload()) {
      this._logService.info("[Claude] SDK not downloaded yet; deferring session metadata until a session triggers the download");
      return void 0;
    }
    const sessionId = AgentSession.id(session);
    const sdkInfo = await this._sdkService.getSessionInfo(sessionId);
    if (!sdkInfo) {
      return void 0;
    }
    return this._withPersistedWorkingDirectories(session, this._metadataStore.project(sdkInfo));
  }
  /**
   * Merge the persisted additional working directories (index 1..N) onto a
   * projected metadata's `workingDirectories`, keeping the SDK-derived `cwd`
   * as the authoritative primary. The SDK catalog only stores `cwd`, so the
   * tail of a multi-root session lives in the per-session overlay. Sessions
   * without an overlay (external Claude CLI, single-root) are returned as-is.
   */
  async _withPersistedWorkingDirectories(session, meta) {
    const primary = meta.workingDirectories?.[0];
    if (!primary) {
      return meta;
    }
    let overlay = {};
    try {
      overlay = await this._metadataStore.read(session);
    } catch (err) {
      this._logService.warn(`[Claude] overlay read failed while hydrating working directories for ${session.toString()}; using SDK cwd only`, err);
    }
    const tail = overlay.workingDirectories?.slice(1) ?? [];
    if (tail.length === 0) {
      return meta;
    }
    return { ...meta, workingDirectories: [primary, ...tail] };
  }
  resolveSessionConfig(_params) {
    const sessionSchema = createSchema({
      [ClaudeSessionConfigKey.PermissionMode]: schemaProperty({
        type: "string",
        title: localize("claude.sessionConfig.permissionMode", "Approvals"),
        description: localize("claude.sessionConfig.permissionModeDescription", "How Claude handles tool approvals."),
        enum: ["default", "acceptEdits", "plan", "auto", "bypassPermissions"],
        enumLabels: [
          localize("claude.sessionConfig.permissionMode.default", "Ask Before Edits"),
          localize("claude.sessionConfig.permissionMode.acceptEdits", "Edit Automatically"),
          localize("claude.sessionConfig.permissionMode.plan", "Plan Mode"),
          localize("claude.sessionConfig.permissionMode.auto", "Auto Mode"),
          localize("claude.sessionConfig.permissionMode.bypassPermissions", "Bypass Permissions")
        ],
        enumDescriptions: [
          localize("claude.sessionConfig.permissionMode.defaultDescription", "Claude asks before editing files."),
          localize("claude.sessionConfig.permissionMode.acceptEditsDescription", "Claude edits files without asking, and asks before using other tools."),
          localize("claude.sessionConfig.permissionMode.planDescription", "Claude creates a plan before making changes."),
          localize("claude.sessionConfig.permissionMode.autoDescription", "Claude decides whether to ask for each tool operation."),
          localize("claude.sessionConfig.permissionMode.bypassPermissionsDescription", "Claude runs all tools without asking.")
        ],
        default: "default",
        sessionMutable: true
      }),
      [SessionConfigKey.Permissions]: platformSessionSchema.definition[SessionConfigKey.Permissions]
    });
    const values = sessionSchema.validateOrDefault(_params.config, {
      [ClaudeSessionConfigKey.PermissionMode]: "default"
      // Permissions intentionally omitted from defaults — leave
      // unset so auto-approval falls through to the host-level
      // default, materializing on the session only once the user
      // approves a tool "in this Session".
    });
    return Promise.resolve({
      schema: sessionSchema.toProtocol(),
      values
    });
  }
  getInheritedSessionConfig(config) {
    const inherited = {};
    for (const key of [ClaudeSessionConfigKey.PermissionMode, SessionConfigKey.Permissions]) {
      if (config[key] !== void 0) {
        inherited[key] = config[key];
      }
    }
    return Object.keys(inherited).length > 0 ? inherited : void 0;
  }
  sessionConfigCompletions(_params) {
    return Promise.resolve({ items: [] });
  }
  shutdown() {
    return this._shutdownPromise ??= (async () => {
      for (const entry of this._sessions.values()) {
        for (const chat of entry.allChatSessions()) {
          if (!chat.isPipelineReady) {
            chat.abortController.abort();
          }
        }
      }
      const sessionIds = [...this._sessions.keys()];
      await Promise.all(sessionIds.map(
        (sessionId) => this._disposeSequencer.queue(sessionId, async () => {
          await this._teardownEntry(sessionId);
          this._pruneActiveClientHandles(sessionId);
        })
      ));
    })();
  }
  async _sendMessage(chat, prompt, workingDirectories, attachments, turnId, _senderClientId) {
    const effectiveTurnId = turnId ?? generateUuid();
    const context = this._getChatContext(chat);
    if (context.isPeerChat) {
      return this._sessionSequencer.queue(context.chatKey, async () => {
        const chatSession = await this._materializeChatLocked(context.session, chat, workingDirectories);
        const sideChat = this._resolveChatBacking(chat)?.sideChat;
        const turns = sideChat ? await this._reconstructTurns(chatSession.sessionId, chat, chatSession.subagents) : [];
        const sdkPrompt = prepareSideChatPrompt(prompt, turns, sideChat);
        const switchTransport = chatSession.hasPendingTransportSwitch ? this._ensureAuthenticated(chatSession.provisionalModel) : void 0;
        await chatSession.send(this._buildSdkPrompt(chatSession.sessionId, sdkPrompt, attachments, effectiveTurnId), effectiveTurnId, workingDirectories, switchTransport);
      });
    }
    return this._sessionSequencer.queue(context.sessionId, async () => {
      const existing = this._getChatContext(chat).target;
      let session;
      if (existing?.isPipelineReady) {
        session = existing;
      } else if (existing) {
        session = await this._materializeProvisional(context.sessionId, workingDirectories);
      } else {
        session = await this._resumeSession(context.sessionId, context.session, workingDirectories);
      }
      const switchTransport = session.hasPendingTransportSwitch ? this._ensureAuthenticated(session.provisionalModel) : void 0;
      await session.send(this._buildSdkPrompt(context.sessionId, prompt, attachments, effectiveTurnId), effectiveTurnId, workingDirectories, switchTransport);
    });
  }
  /** Builds the SDK user message for a send, addressed to `sdkSessionId`. */
  _buildSdkPrompt(sdkSessionId, prompt, attachments, turnId) {
    const contentBlocks = resolvePromptToContentBlocks(prompt, attachments);
    return {
      type: "user",
      message: { role: "user", content: contentBlocks },
      session_id: sdkSessionId,
      parent_tool_use_id: null,
      // M1 / Glossary: `Turn.id ↔ SDKUserMessage.uuid`. The SDK types this
      // as a branded `${string}-…` template-literal alias of Node's
      // `crypto.UUID`; cast at the boundary rather than threading the brand
      // up to every caller.
      uuid: turnId
    };
  }
  respondToPermissionRequest(requestId, approved) {
    for (const sess of this._allLiveSessions()) {
      if (sess.respondToPermissionRequest(requestId, approved)) {
        return;
      }
    }
  }
  respondToUserInputRequest(requestId, response, answers) {
    for (const sess of this._allLiveSessions()) {
      if (sess.respondToUserInputRequest(requestId, response, answers)) {
        return;
      }
    }
  }
  /** Every live chat — each session's default chat and its peers. */
  _allLiveSessions() {
    const all = [];
    for (const entry of this._sessions.values()) {
      all.push(...entry.allChatSessions());
    }
    return all;
  }
  async _abortSession(chat) {
    const sess = this._getChatContext(chat).target;
    if (!sess) {
      return;
    }
    if (!sess.isPipelineReady) {
      sess.abortController.abort();
      return;
    }
    sess.abort();
  }
  setPendingMessages(chat, steeringMessage, _queuedMessages) {
    const context = this._getChatContext(chat);
    this._logService.info(`[Claude] setPendingMessages for ${chat.toString()}: steering=${steeringMessage?.id ?? "none"} queued=${_queuedMessages.length}`);
    if (!context.target) {
      this._logService.warn(`[Claude] setPendingMessages: chat not found for ${chat.toString()}`);
      return;
    }
    if (steeringMessage) {
      context.target.injectSteering(steeringMessage);
    }
  }
  /**
   * Forward a user/picker `permissionMode` change to the running SDK so it
   * applies to the next tool this turn, not only from the next `send()`
   * (issue #321691). Only fires for client-originated changes (the host routes
   * internal server writes elsewhere), so this can forward without re-entering
   * a `canUseTool` callback.
   *
   * `permissionMode` is a **session-scoped** config value today (AHP has no
   * per-chat config), so — matching Copilot's session-scoped approvals — we
   * apply it to EVERY materialized chat's `Query` in the session, not just the
   * one the change arrived on. A `replace` that deletes the key resolves to the
   * chat's `permissionModeFallback`, the same value the next `send()` would
   * apply, so live state mirrors the reducer. Provisional chats are skipped —
   * their first `send()` seeds the mode into `Options.permissionMode`. Fire-and-
   * forget: the SDK control round-trip isn't awaited here; the pipeline caches
   * the mode so a later rebind / send re-applies it.
   *
   * TODO: adopt per-chat config when the protocol allows for such — see
   * https://github.com/microsoft/agent-host-protocol/issues/335 — so a picker
   * change scopes to its own chat instead of the whole session.
   */
  onSessionConfigChanged(session, values) {
    const entry = this._sessions.get(this._getChatContext(session).sessionId);
    if (!entry) {
      return;
    }
    const narrowed = narrowClaudePermissionMode(values[ClaudeSessionConfigKey.PermissionMode]);
    for (const chat of entry.allChatSessions()) {
      if (!chat.isPipelineReady) {
        continue;
      }
      const mode = narrowed ?? chat.permissionModeFallback;
      chat.setPermissionMode(mode).catch((err) => {
        this._logService.warn(`[Claude:${chat.sessionId}] mid-turn setPermissionMode(${mode}) failed`, err);
      });
    }
  }
  async _changeModel(chat, model) {
    const context = this._getChatContext(chat);
    const queueKey = context.isPeerChat ? context.chatKey : context.sessionId;
    await this._sessionSequencer.queue(queueKey, async () => {
      const current = this._getChatContext(chat);
      const sess = current.target;
      if (sess) {
        await sess.setModel(model);
      } else if (current.isPeerChat) {
        await this._metadataStore.write(chat, { model });
      } else {
        await this._metadataStore.write(current.session, { model });
      }
      if (current.isPeerChat) {
        await this._updateChatBackingModel(chat, model);
      }
    });
  }
  /**
   * Switch (or clear with `undefined`) the selected custom agent for an
   * existing session. Mirrors {@link changeModel}: session owns its
   * provisional/runtime branching and metadata write
   * (see {@link ClaudeAgentSession.setAgent}). For external-only
   * sessions (no in-memory record), the agent is persisted directly to
   * the overlay so a later resume picks it up. When `chat` is an additional
   * peer chat, the change targets that chat's chat.
   */
  async _changeAgent(chat, agent) {
    const context = this._getChatContext(chat);
    const queueKey = context.isPeerChat ? context.chatKey : context.sessionId;
    await this._sessionSequencer.queue(queueKey, async () => {
      const current = this._getChatContext(chat);
      const sess = current.target;
      if (sess) {
        await sess.setAgent(agent);
      } else {
        await this._metadataStore.write(current.isPeerChat ? chat : current.session, { agent: agent ?? null });
      }
    });
  }
  setServerToolHost(host) {
    this._serverToolHost = host;
  }
  getOrCreateActiveClient(session, client) {
    const sessionId = AgentSession.id(session);
    const key = `${sessionId}\0${client.clientId}`;
    let handle = this._activeClientHandles.get(key);
    if (!handle) {
      handle = new ClaudeActiveClientHandle(
        client.clientId,
        client.displayName,
        () => this._findAnySession(sessionId)?.getClientTools(client.clientId) ?? [],
        (tools) => {
          this._logService.info(`[Claude:${sessionId}] active client ${client.clientId} tools=[${tools.map((t) => t.name).join(", ") || "(none)"}]`);
          this._findAnySession(sessionId)?.setClientTools(client.clientId, tools);
        },
        (customizations) => {
          void this.syncClientCustomizations(session, client.clientId, [...customizations]);
        }
      );
      this._activeClientHandles.set(key, handle);
    }
    return handle;
  }
  removeActiveClient(session, clientId) {
    const sessionId = AgentSession.id(session);
    this._activeClientHandles.delete(`${sessionId}\0${clientId}`);
    this._findAnySession(sessionId)?.removeClientTools(clientId);
    void this._sessionSequencer.queue(sessionId, async () => {
      this._findAnySession(sessionId)?.removeClientCustomizations(clientId);
    }).catch(() => {
    });
  }
  /** Drop cached active-client handles belonging to a session being torn down. */
  _pruneActiveClientHandles(sessionId) {
    const prefix = `${sessionId}\0`;
    for (const key of [...this._activeClientHandles.keys()]) {
      if (key.startsWith(prefix)) {
        this._activeClientHandles.delete(key);
      }
    }
  }
  onClientToolCallComplete(session, _chat, toolCallId, result) {
    let target = session;
    let parsed;
    while (parsed = parseSubagentSessionUri(target)) {
      target = parsed.parentSession;
    }
    const sessionId = AgentSession.id(target);
    const entry = this._sessions.get(sessionId);
    entry?.defaultChat?.completeClientToolCall(toolCallId, result);
  }
  async syncClientCustomizations(session, clientId, customizations, options) {
    const sessionId = AgentSession.id(session);
    const sess = this._findAnySession(sessionId);
    if (!sess) {
      this._logService.warn(`[Claude:${sessionId}] syncClientCustomizations: session not found`);
      return [];
    }
    return this._sessionSequencer.queue(sessionId, async () => {
      const synced = await this._pluginManager.syncCustomizations(
        clientId,
        customizations,
        options?.quiet ? void 0 : (status) => this._fireCustomizationUpdated(session, { customization: status })
      );
      sess.adoptClientCustomizations(clientId, synced);
      return synced;
    });
  }
  /**
   * Project a per-item sync result onto a `SessionCustomizationUpdated`
   * action and emit it on {@link onDidSessionProgress}. Lets the workbench
   * flip each row to `Loaded` / `Error` as the underlying
   * {@link IAgentPluginManager.syncCustomizations} resolves it.
   */
  _fireCustomizationUpdated(session, item) {
    this._onDidSessionProgress.fire({
      kind: "action",
      resource: session,
      action: {
        type: ActionType.SessionCustomizationUpdated,
        customization: item.customization
      }
    });
  }
  getCustomizations() {
    return [];
  }
  async getSessionCustomizations(session) {
    const sess = this._findAnySession(AgentSession.id(session));
    return sess ? await sess.getSessionCustomizations() : [];
  }
  async startMcpServer(session, id) {
    const sess = this._findAnySession(AgentSession.id(session));
    await sess?.startMcpServer(id);
  }
  async stopMcpServer(session, id) {
    const sess = this._findAnySession(AgentSession.id(session));
    await sess?.stopMcpServer(id);
  }
  // #endregion
  dispose() {
    for (const entry of this._sessions.values()) {
      for (const chat of entry.allChatSessions()) {
        if (!chat.isPipelineReady) {
          chat.abortController.abort();
        }
      }
    }
    super.dispose();
    this._proxyHandle?.dispose();
    this._proxyHandle = void 0;
    this._githubToken = void 0;
    this._models.set([], void 0);
  }
};
ClaudeAgent = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ICopilotApiService),
  __decorateParam(2, IClaudeProxyService),
  __decorateParam(3, IClaudeAgentSdkService),
  __decorateParam(4, IAgentHostStateManager),
  __decorateParam(5, IAgentHostOTelService),
  __decorateParam(6, IAgentHostGitService),
  __decorateParam(7, IAgentHostCheckpointService),
  __decorateParam(8, IAgentConfigurationService),
  __decorateParam(9, IAgentHostGitHubEndpointService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IAgentPluginManager),
  __decorateParam(12, IProductService),
  __decorateParam(13, INativeEnvironmentService)
], ClaudeAgent);
class ClaudeSessionEntry extends AgentSessionEntry {
  /** Claude sessions always have a materialized default chat once seeded. */
  get defaultChat() {
    return super.defaultChat;
  }
}
export {
  ClaudeAgent,
  fromSdkModelInfo
};
