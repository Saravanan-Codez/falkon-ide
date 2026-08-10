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
import { CopilotClient, RuntimeConnection } from "@github/copilot-sdk";
import * as fs from "fs/promises";
import * as os from "os";
import { pathToFileURL } from "url";
import { createCancelablePromise, DeferredPromise, Delayer, disposableTimeout, Limiter, Sequencer, SequencerByKey } from "../../../../base/common/async.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { combinedDisposable, Disposable, DisposableMap, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { FileAccess } from "../../../../base/common/network.js";
import { formatTokenCount } from "../../../../base/common/numbers.js";
import { equals } from "../../../../base/common/objects.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { delimiter, dirname, join } from "../../../../base/common/path.js";
import { basename as resourceBasename, isEqual, isEqualOrParent, joinPath as resourceJoinPath, relativePath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { rgDiskPath } from "../../../../base/node/ripgrep.js";
import { localize } from "../../../../nls.js";
import { parseAgentFile, parsePlugin, parseRuleFile, parseSkillFile, PluginFormat } from "../../../agentPlugins/common/pluginParsers.js";
import { IFileService } from "../../../files/common/files.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { ILogService, LogLevel } from "../../../log/common/log.js";
import { ITelemetryService } from "../../../telemetry/common/telemetry.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { workspacelessScratchDir } from "../workspacelessScratchDir.js";
import { IAgentHostCheckpointService } from "../../common/agentHostCheckpointService.js";
import { IAgentHostReviewService } from "../../common/agentHostReviewService.js";
import { createPricingMetaFromBilling, hasLongContextSurcharge, normalizeCAPIBilling } from "../../common/agentModelPricing.js";
import { createAgentModelByokMeta } from "../../common/agentModelByokMeta.js";
import { AgentHostConfigKey, agentHostCustomizationConfigSchema, DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE, toContainerCustomization } from "../../common/agentHostCustomizationConfig.js";
import { CopilotCliConfigKey, copilotCliConfigSchema } from "../../common/copilotCliConfig.js";
import { AgentHostMcpServersConfigKey, AgentHostCopilotMultiRootEnabledConfigKey, AgentHostPreferLongContextEnabledConfigKey, AgentHostSessionSyncEnabledConfigKey, AgentHostSystemProxyEnabledConfigKey, AgentHostMigrateLegacyCopilotCliEnabledConfigKey, migrateLegacyAutopilotConfig, platformRootSchema, platformSessionSchema } from "../../common/agentHostSchema.js";
import { IAgentPluginManager } from "../../common/agentPluginManager.js";
import { AgentSessionEntry, decodeProviderData, encodeProviderData, prepareSideChatPrompt, stripSideChatContext } from "../agentPeerChats.js";
import { AgentSession, SubagentChatSignal } from "../../common/agentService.js";
import { getReasoningEffortDescription, getReasoningEffortLabel, resolveDefaultReasoningEffort } from "../../common/reasoningEffort.js";
import { IAgentHostOTelService } from "../../common/otel/agentHostOTelService.js";
import { SessionConfigKey } from "../../common/sessionConfigKeys.js";
import { getCopilotHomePath } from "../../common/copilotHome.js";
import { ISessionDataService, SESSION_DB_FILENAME } from "../../common/sessionDataService.js";
import { IAgentHostProxyResolver } from "../agentHostProxyResolver.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { areAdditionalWorkingDirectoriesEqual } from "../../common/state/sessionWorkingDirectories.js";
import { CustomizationLoadStatus, CustomizationType, customizationId, buildChatUri, buildDefaultChatUri, isDefaultChatUri, parseChatUri, parseRequiredSessionUriFromChatUri, parseSubagentSessionUri, AH_META_WORKSPACELESS_DB_KEY, withSessionEhcliAdoptable } from "../../common/state/sessionState.js";
import { getByokLmSelectionModelId } from "../../common/agentHostByokLm.js";
import { ActiveClientToolSet } from "../activeClientState.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { IAgentHostGitHubEndpointService } from "../agentHostGitHubEndpointService.js";
import { IAgentHostCompletions } from "../agentHostCompletions.js";
import { IAgentHostGitService } from "../../common/agentHostGitService.js";
import { applyMcpServerEnablement, findMcpChildId } from "../shared/mcpCustomizationController.js";
import { IAgentHostStateManager } from "../agentHostStateManager.js";
function isCopilotRuntimeManagedSettingsSdk(value) {
  return typeof value === "object" && value !== null && "getManagedSettings" in value && typeof value.getManagedSettings === "function";
}
import { IByokLmBridgeRegistry } from "../byokLmBridgeRegistry.js";
import { SessionWorkingDirectoryMissingError } from "../shared/worktreeIsolation.js";
import { buildSessionEventLogFromTurns } from "./buildSessionEvents.js";
import { CopilotAgentSession } from "./copilotAgentSession.js";
import { createCopilotCliEnvironment } from "./copilotCliEnvironment.js";
import { projectFromCopilotContext } from "./copilotGitProject.js";
import { parsedPluginsEqual, toChildCustomizations } from "./copilotPluginConverters.js";
import { CopilotGitHubTelemetryForwarder } from "./copilotGitHubTelemetryForwarder.js";
import { CopilotSessionLauncher, ContextSizeConfigKey, ThinkingLevelConfigKey, getCopilotContextTier, isCopilotReasoningEffort, resolveCopilotReasoningEffort } from "./copilotSessionLauncher.js";
import { ShellManager } from "./copilotShellTools.js";
import { isAgentHostTelemetryService } from "../agentHostTelemetryService.js";
import { ICopilotApiService } from "../shared/copilotApiService.js";
import { AgentHostGitHubTelemetryRouter } from "../agentHostGitHubTelemetryRouter.js";
import { AgentHostClientType } from "../../common/agentHostClientInfo.js";
import { CopilotSlashCommandCompletionProvider } from "./copilotSlashCommandCompletionProvider.js";
import { DiscoveredType, SessionCustomizationDiscovery, areDiscoveredDirectoriesEqual } from "./sessionCustomizationDiscovery.js";
import { COPILOT_INTEGRATION_ID } from "../../../endpoint/common/licenseAgreement.js";
import { getAppNodeModulesPath } from "../appNodeModules.js";
import { CopilotSlashCommandProvider } from "./copilotSlashCommandProvider.js";
import { classifyCopilotClientFailure, createCopilotFailureCorrelation, reportCopilotClientFailure, reportCopilotClientRecovery, reportCopilotClientRecoveryTurn } from "./copilotFailureTelemetry.js";
const RUNTIME_SLASH_COMMAND_COMPLETION_WAIT_MS = 300;
const COPILOT_CAPI_URL = "https://api.githubcopilot.com";
function isCopilotConnectionClosedError(error) {
  return classifyCopilotClientFailure(error) === "connectionClosed";
}
const COPILOT_PROXY_ENV_KEYS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"];
const COPILOT_PROXY_SET_ENV_KEYS = ["HTTP_PROXY", "HTTPS_PROXY"];
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
function isLinuxMuslRuntime() {
  if (process.platform !== "linux") {
    return false;
  }
  const report = process.report?.getReport();
  return !report?.header?.glibcVersionRuntime;
}
function getCopilotPlatformPackageCandidates() {
  const platformArch = `${process.platform}-${process.arch}`;
  if (process.platform !== "linux") {
    return [platformArch];
  }
  const linuxCandidates = [`linux-${process.arch}`, `linuxmusl-${process.arch}`];
  return isLinuxMuslRuntime() ? linuxCandidates.reverse() : linuxCandidates;
}
async function resolveCopilotCliPath(nodeModulesUri) {
  const tried = [];
  for (const platformPackage of getCopilotPlatformPackageCandidates()) {
    const cliPath = URI.joinPath(nodeModulesUri, "@github", `copilot-${platformPackage}`, "index.js").fsPath;
    tried.push(cliPath);
    if (await fileExists(cliPath)) {
      return cliPath;
    }
  }
  const oldTopLevelPath = URI.joinPath(nodeModulesUri, "@github", "copilot", "index.js").fsPath;
  tried.push(oldTopLevelPath);
  if (await fileExists(oldTopLevelPath)) {
    return oldTopLevelPath;
  }
  throw new Error(`Unable to resolve @github/copilot CLI path. Tried: ${tried.join(", ")}`);
}
class CopilotSessionLifetime {
  constructor() {
    this._activeLeases = 0;
    this._pendingReleases = 0;
    this._exclusiveTail = Promise.resolve();
    this._isDisposing = false;
    this._isPermanentlyClosed = false;
    this._peerResumes = /* @__PURE__ */ new Map();
    this._sessionSequencer = new Sequencer();
    this._chatSequencer = new SequencerByKey();
    this._queuedWork = /* @__PURE__ */ new Set();
  }
  get isPermanentlyClosed() {
    return this._isPermanentlyClosed;
  }
  queueSession(task) {
    return this._track(this._sessionSequencer.queue(task));
  }
  queueChat(chatKey, task) {
    return this._track(this._chatSequencer.queue(chatKey, task));
  }
  resumeDefault(factory) {
    const existing = this._defaultResume;
    if (existing) {
      return existing;
    }
    const resume = factory();
    this._defaultResume = resume;
    const cleanup = () => {
      if (this._defaultResume === resume) {
        this._defaultResume = void 0;
      }
    };
    resume.then(cleanup, cleanup);
    return resume;
  }
  resumePeer(chatKey, factory) {
    const existing = this._peerResumes.get(chatKey);
    if (existing) {
      return existing;
    }
    const resume = factory();
    this._peerResumes.set(chatKey, resume);
    const cleanup = () => {
      if (this._peerResumes.get(chatKey) === resume) {
        this._peerResumes.delete(chatKey);
      }
    };
    resume.then(cleanup, cleanup);
    return resume;
  }
  async acquire() {
    while (!this._isDisposing && !this._isPermanentlyClosed) {
      const reopened = this._reopened;
      if (reopened) {
        await reopened.p;
        continue;
      }
      this._activeLeases++;
      let disposed = false;
      return toDisposable(() => {
        if (disposed) {
          return;
        }
        disposed = true;
        this._activeLeases--;
        if (this._activeLeases === 0) {
          this._drained?.complete();
        }
      });
    }
    return void 0;
  }
  release(task) {
    if (this._isDisposing || this._isPermanentlyClosed) {
      return Promise.resolve();
    }
    this._pendingReleases++;
    this._reopened ??= new DeferredPromise();
    const previous = this._exclusiveTail;
    const release = (async () => {
      await previous;
      await this._waitForLeases();
      await task();
    })();
    const completed = release.finally(() => {
      this._pendingReleases--;
      if (this._pendingReleases === 0 && !this._isDisposing && !this._isPermanentlyClosed) {
        this._reopened?.complete();
        this._reopened = void 0;
      }
    });
    this._exclusiveTail = completed.catch(() => void 0);
    return completed;
  }
  async dispose(task) {
    if (this._disposePromise) {
      return this._disposePromise;
    }
    if (this._isPermanentlyClosed) {
      return;
    }
    this._isDisposing = true;
    this._reopened?.complete();
    this._reopened = void 0;
    const previous = this._exclusiveTail;
    const dispose = (async () => {
      try {
        await previous;
        await this._waitForLeases();
        await task();
        this._isPermanentlyClosed = true;
      } catch (error) {
        if (!this._isPermanentlyClosed) {
          this._isDisposing = false;
          this._reopened?.complete();
          this._reopened = void 0;
        }
        throw error;
      }
    })();
    this._disposePromise = dispose;
    this._exclusiveTail = dispose.catch(() => void 0);
    try {
      await dispose;
    } finally {
      if (!this._isPermanentlyClosed && this._disposePromise === dispose) {
        this._disposePromise = void 0;
      }
    }
  }
  async close() {
    this._isPermanentlyClosed = true;
    this._reopened?.complete();
    this._reopened = void 0;
    await this._waitForQueuedWork();
    await this._exclusiveTail;
    await this._waitForLeases();
  }
  _track(work) {
    const completion = work.then(() => void 0, () => void 0);
    this._queuedWork.add(completion);
    completion.then(() => this._queuedWork.delete(completion));
    return work;
  }
  async _waitForQueuedWork() {
    while (this._queuedWork.size > 0) {
      await Promise.all(this._queuedWork);
    }
  }
  async _waitForLeases() {
    if (this._activeLeases === 0) {
      return;
    }
    const drained = this._drained ??= new DeferredPromise();
    await drained.p;
    if (this._drained === drained) {
      this._drained = void 0;
    }
  }
}
function toRestrictedTelemetryEndpoint(endpoint) {
  return endpoint ? `${endpoint.replace(/\/+$/, "")}/telemetry` : void 0;
}
import { COPILOT_AGENT_HOST_SYSTEM_MESSAGE } from "./prompts/systemMessage.js";
function rebaseUnder(uri, fromDir, toDir) {
  if (!isEqualOrParent(uri, fromDir)) {
    return void 0;
  }
  const rel = relativePath(fromDir, uri);
  if (rel === void 0) {
    return void 0;
  }
  return rel.length === 0 ? toDir : resourceJoinPath(toDir, rel);
}
class CopilotSessionEntry extends AgentSessionEntry {
}
function resolveCopilotOtlpMetricsEndpoint(endpoint, protocol) {
  if (protocol === "grpc") {
    return endpoint;
  }
  try {
    const url = new URL(endpoint);
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/v1/metrics";
    } else if (url.pathname.endsWith("/v1/traces")) {
      url.pathname = `${url.pathname.slice(0, -"/v1/traces".length)}/v1/metrics`;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return endpoint;
  }
}
let CopilotAgent = class extends Disposable {
  constructor(_logService, _instantiationService, _sessionDataService, _gitService, _configurationService, _stateManager, _gitHubEndpointService, _otelService, completions, _checkpointService, _reviewService, _environmentService, _byokBridgeRegistry, _telemetryService, _copilotApiService, _proxyResolver) {
    super();
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._sessionDataService = _sessionDataService;
    this._gitService = _gitService;
    this._configurationService = _configurationService;
    this._stateManager = _stateManager;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._otelService = _otelService;
    this._checkpointService = _checkpointService;
    this._reviewService = _reviewService;
    this._environmentService = _environmentService;
    this._byokBridgeRegistry = _byokBridgeRegistry;
    this._telemetryService = _telemetryService;
    this._copilotApiService = _copilotApiService;
    this._proxyResolver = _proxyResolver;
    this.id = "copilotcli";
    this._onDidSessionProgress = this._register(new Emitter());
    this.onDidSessionProgress = this._onDidSessionProgress.event;
    /**
     * Membership channel for chats the agent spawns itself — sub-agents
     * delegated by a tool call (the same fan-out the `subagent_started` /
     * `subagent_completed` signals drive). The orchestrator routes these into
     * the chat catalog so harness-spawned and user-driven chats share one path.
     */
    this._onDidSpawnChat = this._register(new Emitter());
    this.onDidSpawnChat = this._onDidSpawnChat.event;
    this._onDidMaterializeSession = this._register(new Emitter());
    this.onDidMaterializeSession = this._onDidMaterializeSession.event;
    /**
     * Fires when the set of adoptable-legacy sessions the host should surface may
     * have changed — today only when the renderer's migrate-legacy flag flips on
     * (which can arrive after the first `listSessions`). The {@link AgentService}
     * responds by re-listing and announcing any newly adoptable sessions.
     */
    this._onDidChangeSessionList = this._register(new Emitter());
    this.onDidChangeSessionList = this._onDidChangeSessionList.event;
    /**
     * Per-session MCP notifications, fanned in from every active
     * {@link CopilotAgentSession}. Each session contributes a single
     * subscription, disposed alongside the session.
     */
    this._onMcpNotification = this._register(new Emitter());
    this.onMcpNotification = this._onMcpNotification.event;
    this._models = observableValue(this, []);
    this.models = this._models;
    /**
     * The two sources merged into {@link _models}: CAPI models from the CLI's
     * `models.list` and BYOK models from the renderer bridge registry's serving
     * window. Tracked separately so each can refresh independently without
     * clobbering the other; {@link _publishModels} concatenates them for the
     * picker.
     */
    this._capiModels = [];
    this._byokModels = [];
    /** Model IDs whose long-context tier costs the same as the default tier. */
    this._freeLongContextModels = /* @__PURE__ */ new Set();
    /**
     * Bounded exponential-backoff retry for {@link _refreshModels}. The SDK's
     * `models.list` RPC can fail transiently (e.g. a `429 "too many requests"`
     * right after startup). Without a retry the model picker would stay empty
     * until the next external refresh trigger (a GitHub token change, a CLI
     * client restart, or the host's periodic scheduler), so we retry a few
     * times before giving up. Overridable in tests to avoid real delays.
     */
    this._modelRefreshMaxAttempts = 5;
    this._modelRefreshBaseDelayMs = 1e3;
    this._modelRefreshMaxDelayMs = 3e4;
    /** Pending model-refresh retry timer; cleared on a fresh refresh, shutdown, or dispose. */
    this._modelRefreshRetry = this._register(new MutableDisposable());
    /**
     * Invalidates model requests bound to a superseded token/client/catalog
     * source. Token identity alone is insufficient: restarting the client for
     * a `COPILOT_GH_HOST` change keeps the same token while changing the CAPI
     * endpoint whose catalog is authoritative.
     */
    this._modelCatalogGeneration = 0;
    this._modelRefreshSchedule = this._register(new MutableDisposable());
    /**
     * Reasons for a client restart that is parked until every chat is idle. See
     * {@link _requestClientRestart}; drained by {@link _applyPendingClientRestart}.
     */
    this._pendingClientRestartReasons = /* @__PURE__ */ new Set();
    this._reportedClientFailures = /* @__PURE__ */ new WeakSet();
    /** Reflects the `rt=1` field on the GitHub Copilot bearer token; gates enhanced GH telemetry. */
    this._restrictedTelemetryEnabled = false;
    this._onDidChangeRestrictedTelemetry = this._register(new Emitter());
    this.onDidChangeRestrictedTelemetry = this._onDidChangeRestrictedTelemetry.event;
    /** Root AHP session id -> container that owns the default chat and all peer chats. */
    this._sessions = this._register(new DisposableMap());
    /** SDK session id -> individual chat session, used to route connection-global SDK telemetry in O(1). */
    this._sdkSessionsById = /* @__PURE__ */ new Map();
    /**
     * Live `chatUri → backing` map for additional (non-default) peer chats,
     * keyed by chat channel URI string. Records the SDK chat id (and
     * optional model override) that backs each peer chat so the agent can
     * resume it without consulting on-disk persistence. Populated by
     * {@link createChat} on creation and by {@link materializeChat} on
     * restore; the orchestrator now owns the durable peer-chat catalog (the
     * agent no longer writes `copilot.chats`).
     */
    this._chatBackings = /* @__PURE__ */ new Map();
    /**
     * Fires when a peer chat's opaque `providerData` blob changes after
     * creation (e.g. a per-chat model switch), so the orchestrator re-persists
     * the refreshed token. See {@link IAgent.onDidChangeChatData}.
     */
    this._onDidChangeChatData = this._register(new Emitter());
    this.onDidChangeChatData = this._onDidChangeChatData.event;
    /**
     * Per-session MCP-notification subscriptions, keyed by `sessionId`.
     * Disposed in lockstep with the matching {@link _sessions} entry so
     * the fan-in does not leak listeners as sessions come and go.
     */
    this._mcpNotificationSubs = this._register(new DisposableMap());
    this._sessionLifetimes = /* @__PURE__ */ new Map();
    /**
     * Sessions created by a client but not yet materialized into a Copilot
     * SDK session + worktree + on-disk metadata. Materialization is deferred
     * until the first {@link sendMessage}, at which point the entry moves
     * out of this map and into {@link _sessions}. See {@link IProvisionalSession}.
     */
    this._provisionalSessions = /* @__PURE__ */ new Map();
    this._isShuttingDown = false;
    /** Per-session active client state for tools + plugin snapshot tracking. */
    this._activeClients = new ResourceMap();
    this._lastSessionSyncEnabled = this._isSessionSyncEnabled();
    this._lastRubberDuckEnabled = this._isRubberDuckEnabled();
    this._lastCopilotSdkLogLevelSetting = this._getCopilotSdkLogLevelSetting();
    this._lastEnterpriseHost = this._getEnterpriseHost();
    this._lastSystemProxyEnabled = this._isSystemProxyEnabled();
    this._lastMigrateLegacyEnabled = this._isMigrateLegacyCopilotCliEnabled();
    /**
     * Chat-addressed surface for the chats within a session.
     */
    this.chats = {
      createChat: (chat, options) => {
        return this._createChat(chat, options);
      },
      fork: (chat, source, options) => {
        return this._createChat(chat, { ...options, fork: source });
      },
      disposeChat: (chatUri) => {
        const { session, chat } = this._resolveChatTarget(chatUri);
        return this._disposeChat(session, chat);
      },
      sendMessage: (chatUri, prompt, workingDirectories, attachments, turnId, senderClientId, clientType) => {
        return this._sendMessage(chatUri, prompt, attachments, turnId, senderClientId, clientType, workingDirectories);
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
      getMessages: (chat) => {
        return this.getSessionMessages(chat);
      }
    };
    /** Memoizes the (stable) marker check so repeated `listSessions` calls don't re-stat the disk. */
    this._isExtensionHostCliSessionCache = /* @__PURE__ */ new Map();
    this._plugins = this._register(this._instantiationService.createInstance(PluginController, () => this._ensureClient()));
    this._sessionLauncher = this._instantiationService.createInstance(CopilotSessionLauncher);
    this._gitHubTelemetryForwarder = this._instantiationService.createInstance(CopilotGitHubTelemetryForwarder, () => this._restrictedTelemetryEnabled);
    this._slashCommandProvider = new CopilotSlashCommandProvider(() => this._ensureClient().then((c) => c.rpc.commands.list().then((c2) => c2.commands)), this._logService);
    this._githubTelemetryRouter = isAgentHostTelemetryService(this._telemetryService) ? new AgentHostGitHubTelemetryRouter(this._telemetryService) : void 0;
    this.onDidCustomizationsChange = this._plugins.onDidChange;
    this._register(this._stateManager.onDidChangeSessionTitle(({ session, title }) => {
      if (AgentSession.provider(session) === this.id) {
        this._otelService.emitSessionTitleChanged(AgentSession.id(session), session, title);
      }
    }));
    this._register(this._onDidSessionProgress.event((signal) => this._emitSpawnedChatForSubagentSignal(signal)));
    this._register(completions.registerProvider(new CopilotSlashCommandCompletionProvider(
      this.id,
      {
        isRubberDuckEnabled: () => this._isRubberDuckEnabled(),
        getRuntimeSlashCommands: (sessionId, options) => this._getRuntimeSlashCommands(sessionId, options),
        getSessionCustomizations: (sessionId) => this.getSessionCustomizations(AgentSession.uri(this.id, sessionId)),
        getSessionConfigState: (sessionId) => this._getSessionConfigState(sessionId)
      },
      RUNTIME_SLASH_COMMAND_COMPLETION_WAIT_MS
    )));
    this._register(this._configurationService.onDidRootConfigChange(() => {
      this._restartClientIfStartupConfigChanged().catch(
        (err) => this._logService.error("[Copilot] Failed to apply root config change", err)
      );
    }));
    this._register(this._configurationService.onDidRootConfigChange(() => {
      const enabled = this._isMigrateLegacyCopilotCliEnabled();
      if (enabled !== this._lastMigrateLegacyEnabled) {
        this._lastMigrateLegacyEnabled = enabled;
        if (enabled) {
          this._onDidChangeSessionList.fire();
        }
      }
    }));
    this._register(this._byokBridgeRegistry.onDidChangeModels(() => {
      this._logService.info("[Copilot] BYOK bridge changed; refreshing models");
      this._refreshByokModels();
    }));
    this._register(this._gitHubEndpointService.onDidChange(() => {
      this._restartClientIfStartupConfigChanged().catch(
        (err) => this._logService.error("[Copilot] Failed to restart client after endpoint change", err)
      );
    }));
  }
  setServerToolHost(host) {
    this._serverToolHost = host;
  }
  get restrictedTelemetryEnabled() {
    return this._restrictedTelemetryEnabled;
  }
  /**
   * Translates the sub-agent fan-out signals into the first-class spawned-
   * chat channel: `subagent_started` -> {@link onDidSpawnChat}
   * (carrying the spawning tool call as the chat's parent edge). A completed
   * subagent chat stays live and subscribable (it is removed only on session
   * teardown), so there is no corresponding end event. The signals themselves
   * are left untouched so the existing sub-agent behavior is preserved.
   */
  _emitSpawnedChatForSubagentSignal(signal) {
    const spawn = SubagentChatSignal.toSpawnEvent(signal);
    if (spawn) {
      this._onDidSpawnChat.fire(spawn);
    }
  }
  _isSessionSyncEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostSessionSyncEnabledConfigKey) === true;
  }
  _isRubberDuckEnabled() {
    return this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.RubberDuck) === true;
  }
  _getCopilotSdkLogLevelSetting() {
    return this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.CopilotSdkLogLevel) ?? "info";
  }
  _resolveCopilotSdkLogLevel(configured) {
    return configured === "trace" || this._logService.getLevel() === LogLevel.Trace ? "all" : "info";
  }
  _getEnterpriseHost() {
    return this._gitHubEndpointService.getEnterpriseHost();
  }
  _isPreferLongContextEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostPreferLongContextEnabledConfigKey) === true;
  }
  _isSystemProxyEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostSystemProxyEnabledConfigKey) !== false;
  }
  _isMigrateLegacyCopilotCliEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostMigrateLegacyCopilotCliEnabledConfigKey) === true;
  }
  /**
   * Restart the CLI client when a startup-baked value changes, but defer past any
   * in-flight turn — see {@link _requestClientRestart} — so the new values are
   * picked up at the next quiet point rather than by killing live work.
   * An in-flight start aborts if any startup value changes.
   */
  async _restartClientIfStartupConfigChanged() {
    const sessionSync = this._isSessionSyncEnabled();
    const rubberDuck = this._isRubberDuckEnabled();
    const copilotSdkLogLevelSetting = this._getCopilotSdkLogLevelSetting();
    const enterpriseHost = this._getEnterpriseHost();
    const systemProxyEnabled = this._isSystemProxyEnabled();
    if (this._lastSessionSyncEnabled === sessionSync && this._lastRubberDuckEnabled === rubberDuck && this._lastCopilotSdkLogLevelSetting === copilotSdkLogLevelSetting && this._lastEnterpriseHost === enterpriseHost && this._lastSystemProxyEnabled === systemProxyEnabled) {
      return;
    }
    const changed = [
      this._lastSessionSyncEnabled !== sessionSync ? `sessionSync=${sessionSync}` : void 0,
      this._lastRubberDuckEnabled !== rubberDuck ? `rubberDuck=${rubberDuck}` : void 0,
      this._lastCopilotSdkLogLevelSetting !== copilotSdkLogLevelSetting ? `copilotSdkLogLevel=${copilotSdkLogLevelSetting}` : void 0,
      this._lastEnterpriseHost !== enterpriseHost ? `enterpriseHost=${enterpriseHost}` : void 0,
      this._lastSystemProxyEnabled !== systemProxyEnabled ? `systemProxy=${systemProxyEnabled}` : void 0
    ].filter((v) => v !== void 0).join(", ");
    this._lastSessionSyncEnabled = sessionSync;
    this._lastRubberDuckEnabled = rubberDuck;
    this._lastCopilotSdkLogLevelSetting = copilotSdkLogLevelSetting;
    this._lastEnterpriseHost = enterpriseHost;
    this._lastSystemProxyEnabled = systemProxyEnabled;
    await this._requestClientRestart(`startup config changed: ${changed}`);
  }
  /**
   * Requests a CLI client restart, running it immediately when every chat is
   * idle and otherwise parking it until the last in-flight turn ends.
   *
   * Restarting tears the SDK sessions down, and a torn-down session stops
   * producing the events that finalize its protocol turn — the client would
   * be left with a turn that never completes, cancels, or errors, i.e. a
   * session that spins forever. Startup-only values (session sync, the SDK
   * log level, the enterprise host, the system proxy) can also change without
   * any user action, from an experiment or policy refresh, so this must never
   * be paid for with a running turn. The values are read fresh by
   * {@link _ensureClient} on the next start, so applying the restart late is
   * always correct.
   */
  async _requestClientRestart(reason) {
    if (this._shutdownPromise || !this._client) {
      return;
    }
    this._pendingClientRestartReasons.add(reason);
    const busyChats = this._chatsWithActiveTurn();
    if (busyChats > 0) {
      this._logService.info(`[Copilot] Deferring CopilotClient restart (${reason}) until ${busyChats} in-flight turn(s) finish`);
      return;
    }
    await this._applyPendingClientRestart();
  }
  /**
   * Runs a restart parked by {@link _requestClientRestart} once no chat has
   * an in-flight turn. No-op while any turn is still running; the next chat
   * to go idle drives this again.
   */
  async _applyPendingClientRestart() {
    if (this._pendingClientRestartReasons.size === 0 || this._shutdownPromise || !this._client || this._chatsWithActiveTurn() > 0) {
      return;
    }
    const reason = [...this._pendingClientRestartReasons].join("; ");
    this._logService.info(`[Copilot] Restarting CopilotClient (${reason})`);
    this._sessions.clearAndDisposeAll();
    this._sdkSessionsById.clear();
    this._mcpNotificationSubs.clearAndDisposeAll();
    await this._stopClient();
    this._capiModels = [];
    this._publishModels();
    void this._scheduleModelRefresh();
  }
  /**
   * Called by a {@link CopilotAgentSession} when its turn ends. Scheduled off
   * the current stack because the callback fires from inside that session's
   * SDK event handling and the restart disposes the session making the call.
   */
  _onChatTurnEnded() {
    if (this._pendingClientRestartReasons.size === 0) {
      return;
    }
    queueMicrotask(() => {
      this._applyPendingClientRestart().catch(
        (err) => this._logService.error("[Copilot] Failed to apply deferred client restart", err)
      );
    });
  }
  async _recoverFromClosedConnection(error, operation, correlation) {
    const failureKind = classifyCopilotClientFailure(error);
    if (!failureKind) {
      return void 0;
    }
    if (error instanceof Error && this._reportedClientFailures.has(error)) {
      return void 0;
    }
    const clientFailureId = this._closedConnectionRecovery?.clientFailureId ?? generateUuid();
    const recoveryStarted = failureKind === "connectionClosed" && !this._shutdownPromise && this._closedConnectionRecovery === void 0;
    reportCopilotClientFailure(this._telemetryService, clientFailureId, failureKind, operation, this._chatsWithActiveTurn(), recoveryStarted, error, correlation);
    if (failureKind !== "connectionClosed" || this._shutdownPromise) {
      return void 0;
    }
    if (!this._closedConnectionRecovery) {
      const recovery = this._runClosedConnectionRecovery(clientFailureId, failureKind);
      this._closedConnectionRecovery = { clientFailureId, promise: recovery };
      const cleanup = () => {
        if (this._closedConnectionRecovery?.promise === recovery) {
          this._closedConnectionRecovery = void 0;
        }
      };
      recovery.then(cleanup, cleanup);
    }
    return this._closedConnectionRecovery.promise;
  }
  async _runClosedConnectionRecovery(clientFailureId, failureKind) {
    const stopWatch = StopWatch.create();
    const result = await this._doRecoverFromClosedConnection(clientFailureId);
    reportCopilotClientRecovery(this._telemetryService, {
      clientFailureId,
      failureKind,
      durationMs: stopWatch.elapsed(),
      failedTurnCount: result.failedTurnIds.size,
      stopSucceeded: result.stopSucceeded
    });
    return result;
  }
  async _doRecoverFromClosedConnection(clientFailureId) {
    this._logService.error("[Copilot] Recovering from closed SDK connection");
    const failedTurnIds = /* @__PURE__ */ new Set();
    const error = {
      errorType: "providerConnectionClosed",
      message: localize("copilotAgent.connectionClosed", "The Copilot CLI stopped unexpectedly. Retry your request.")
    };
    for (const entry of this._sessions.values()) {
      for (const chat of entry.allChatSessions()) {
        const failedTurnId = chat.failActiveTurn(error);
        if (failedTurnId) {
          failedTurnIds.add(failedTurnId);
          reportCopilotClientRecoveryTurn(
            this._telemetryService,
            clientFailureId,
            createCopilotFailureCorrelation(chat.sessionUri, chat.chatUri, failedTurnId, chat.sessionId)
          );
        }
      }
    }
    this._sessions.clearAndDisposeAll();
    this._sdkSessionsById.clear();
    this._mcpNotificationSubs.clearAndDisposeAll();
    let stopSucceeded = true;
    try {
      await this._stopClient();
    } catch (error2) {
      stopSucceeded = false;
      this._logService.error(error2, "[Copilot] Failed to stop closed SDK client");
    }
    this._capiModels = [];
    this._publishModels();
    return { failedTurnIds, stopSucceeded };
  }
  async _retryAfterClosedConnection(operation, task, correlation) {
    try {
      return await task();
    } catch (error) {
      if (!await this._recoverFromClosedConnection(error, operation, correlation)) {
        throw error;
      }
      return task();
    }
  }
  _clientFailureCorrelation(chat, turnId) {
    const context = this._getChatContext(chat);
    const chatUri = URI.parse(context.chatKey);
    return createCopilotFailureCorrelation(context.session, chatUri, turnId, context.target?.sessionId ?? context.sessionId);
  }
  /** Number of live chats (default or peer, across all sessions) with an in-flight turn. */
  _chatsWithActiveTurn() {
    let count = 0;
    for (const [, entry] of this._sessions) {
      for (const chatSession of entry.allChatSessions()) {
        if (chatSession.hasActiveTurn) {
          count++;
        }
      }
    }
    return count;
  }
  _createCopilotClient(options) {
    return new CopilotClient(options);
  }
  // ---- auth ---------------------------------------------------------------
  getDescriptor() {
    return {
      provider: "copilotcli",
      displayName: "Copilot",
      description: localize("copilotAgent.description", "Copilot SDK agent running in the local agent host process"),
      capabilities: {
        multipleChats: { fork: true, sideChat: true },
        ...this._isMultiRootEnabled() ? { multipleWorkingDirectories: { immutablePrimary: true } } : {}
      }
    };
  }
  _isMultiRootEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostCopilotMultiRootEnabledConfigKey) === true;
  }
  getProtectedResources() {
    return [
      this._gitHubEndpointService.getCopilotResource(),
      this._gitHubEndpointService.getRepoResource()
    ];
  }
  async getNetworkDiagnosticsEndpoints() {
    let capiUrl = process.env["VSCODE_AGENT_HOST_CAPI_URL_OVERRIDE"] || COPILOT_CAPI_URL;
    if (this._githubToken) {
      try {
        capiUrl = await this._copilotApiService.resolveApiEndpoint(this._githubToken) || capiUrl;
      } catch (error) {
        this._logService.debug(`[Copilot] CAPI endpoint discovery for network diagnostics failed; using ${capiUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const capiPingUrl = new URL(capiUrl);
    capiPingUrl.pathname = `${capiPingUrl.pathname.replace(/\/$/, "")}/_ping`;
    return [
      { name: "GitHub API", url: this._gitHubEndpointService.getApiBaseUri() },
      { name: "Copilot API (CAPI)", url: capiPingUrl.toString() }
    ];
  }
  async getNetworkDiagnosticsAccount() {
    return this._githubToken ? this._copilotApiService.resolveUserLogin?.(this._githubToken) : void 0;
  }
  async getManagedSettingsDiagnostics() {
    const nodeModulesUri = FileAccess.asFileUri(getAppNodeModulesPath());
    const cliPath = await resolveCopilotCliPath(nodeModulesUri);
    const runtimeSdkPath = join(dirname(cliPath), "sdk", "index.js");
    if (!await fileExists(runtimeSdkPath)) {
      throw new Error(`Copilot runtime SDK not found at ${runtimeSdkPath}`);
    }
    const runtimeSdk = await import(pathToFileURL(runtimeSdkPath).href);
    if (!isCopilotRuntimeManagedSettingsSdk(runtimeSdk)) {
      throw new Error("Copilot runtime SDK does not expose getManagedSettings()");
    }
    const enterpriseHost = this._getEnterpriseHost();
    const result = await runtimeSdk.getManagedSettings({
      ...this._githubToken ? { token: this._githubToken } : {},
      ...enterpriseHost ? { host: enterpriseHost } : {}
    });
    return {
      ...result.resolved,
      ...result.account ? { account: result.account } : {}
    };
  }
  getCustomizations() {
    return this._plugins.getConfiguredHostCustomizations();
  }
  async getSessionCustomizations(session) {
    const anchors = await this._getSessionCustomizationAnchors(session);
    const activeClient = this._getOrCreateActiveClient(session, anchors.directory);
    if (anchors.applyAdditional) {
      activeClient.pluginController.setAdditionalDirectories(anchors.additionalDirectories);
    }
    const fromPlugins = await activeClient.pluginController.getCustomizationsSettled();
    const sessionId = AgentSession.id(session);
    const entry = this._findAnySession(sessionId);
    const topLevelMcp = entry?.topLevelMcpCustomizations() ?? [];
    const customizations = [...fromPlugins, ...topLevelMcp];
    const desired = this._stateManager.getSessionState(session.toString())?.customizations ?? [];
    return applyMcpServerEnablement(customizations, desired);
  }
  async handleMcpRequest(session, serverName, method, params) {
    const sessionId = AgentSession.id(session);
    const entry = this._findAnySession(sessionId);
    if (!entry) {
      throw new Error(`Method not found: no active session ${sessionId}`);
    }
    return entry.handleMcpRequest(serverName, method, params);
  }
  async startMcpServer(session, id) {
    const sessionId = AgentSession.id(session);
    await this._findAnySession(sessionId)?.startMcpServer(id);
  }
  async stopMcpServer(session, id) {
    const sessionId = AgentSession.id(session);
    await this._findAnySession(sessionId)?.stopMcpServer(id);
  }
  /**
   * The gated additional (non-primary) roots for a session: the tail of the
   * ordered working-directory set when multi-root is enabled, else empty (so
   * single-root / flag-off is byte-identical). Used both to anchor
   * customization discovery and to populate the launch plan's
   * `additionalDirectories`, keeping the SDK's granted roots and discovery in
   * lockstep — so a session created while multi-root was enabled falls back to
   * a single root when resumed after the flag is turned off.
   */
  _additionalCustomizationDirectories(workingDirectories) {
    if (!this._isMultiRootEnabled() || !workingDirectories || workingDirectories.length <= 1) {
      return [];
    }
    return workingDirectories.slice(1);
  }
  /**
   * Resolves the customization anchor(s) for a session. `directory` is the
   * primary (index 0) anchor — the worktree for worktree-isolated sessions.
   * `additionalDirectories` are the non-primary roots to attach to discovery,
   * and are applied only when `applyAdditional` is true:
   * - **provisional** (pre-send) sessions carry the client-supplied set, whose
   *   non-primary folders are stable workspace folders that can be discovered
   *   immediately (the worktree, if any, only affects index 0 at send);
   * - **not-yet-live** sessions carry the persisted set from metadata;
   * - **live** (active) sessions manage their own tail via materialize/resume,
   *   so `applyAdditional` is false to avoid clobbering it.
   */
  async _getSessionCustomizationAnchors(session) {
    const sessionId = AgentSession.id(session);
    const provisional = this._provisionalSessions.get(sessionId);
    if (provisional) {
      return {
        directory: provisional.workingDirectory,
        additionalDirectories: this._additionalCustomizationDirectories(provisional.workingDirectories),
        applyAdditional: true
      };
    }
    const entry = this._findAnySession(sessionId);
    if (entry) {
      return { directory: entry.customizationDirectory, additionalDirectories: [], applyAdditional: false };
    }
    const metadata = await this._readSessionMetadata(session);
    return {
      directory: metadata.workingDirectory ?? metadata.customizationDirectory,
      additionalDirectories: this._additionalCustomizationDirectories(metadata.workingDirectories),
      applyAdditional: true
    };
  }
  async authenticate(resource, token) {
    if (resource === this._gitHubEndpointService.getRepoResource().resource) {
      return true;
    }
    if (resource !== this._gitHubEndpointService.getCopilotResource().resource) {
      return false;
    }
    const tokenChanged = this._githubToken !== token;
    this._githubToken = token;
    this._updateRestrictedTelemetry(token);
    this._logService.info(`[Copilot] Auth token ${tokenChanged ? "updated" : "unchanged"}`);
    if (tokenChanged) {
      await this._restartClientIfProxyChanged();
      void this._scheduleModelRefresh();
    }
    return true;
  }
  async handleAuthenticationToken(params) {
    let handled = false;
    for (const [, entry] of this._sessions) {
      for (const session of entry.allChatSessions()) {
        const didHandle = await session.resolveMcpAuthentication(params);
        handled ||= didHandle;
      }
    }
    return handled;
  }
  _updateRestrictedTelemetry(githubToken) {
    this._applyRestrictedTelemetry(void 0);
    if (githubToken) {
      void this._resolveRestrictedTelemetry(githubToken);
    }
  }
  async _resolveRestrictedTelemetry(githubToken) {
    try {
      const ctx = await this._copilotApiService.resolveRestrictedTelemetryContext(githubToken);
      if (this._githubToken !== githubToken) {
        return;
      }
      this._applyRestrictedTelemetry({
        ...ctx,
        telemetryEndpoint: toRestrictedTelemetryEndpoint(ctx.telemetryEndpoint)
      });
    } catch (err) {
      this._logService.debug(`[Copilot] Restricted telemetry resolution failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  _applyRestrictedTelemetry(context) {
    const rtEnabled = context?.restrictedTelemetryEnabled === true;
    if (rtEnabled !== this._restrictedTelemetryEnabled) {
      this._restrictedTelemetryEnabled = rtEnabled;
      this._logService.info(`[Copilot] Enhanced (restricted) telemetry ${rtEnabled ? "enabled for this account" : "disabled"}`);
      this._onDidChangeRestrictedTelemetry.fire();
    }
    if (isAgentHostTelemetryService(this._telemetryService)) {
      this._telemetryService.setRestrictedTelemetryEnabled(rtEnabled);
      this._telemetryService.setCopilotTrackingId(context?.trackingId);
      this._telemetryService.setRestrictedTelemetryEndpoint(context?.telemetryEndpoint);
    }
  }
  async _routeGitHubTelemetry(notification) {
    const additionalProperties = { initiatorClientType: this._clientTypeForTelemetry(notification.sessionId) };
    const router = this._githubTelemetryRouter;
    if (!router?.isTarget(notification)) {
      this._gitHubTelemetryForwarder.forward(notification);
      return;
    }
    if (!notification.restricted) {
      await router.route(notification, void 0, additionalProperties);
      return;
    }
    const sessionId = notification.sessionId;
    const githubToken = this._githubToken;
    if (!githubToken) {
      await router.route(notification, void 0, additionalProperties);
      return;
    }
    try {
      const context = await this._copilotApiService.resolveRestrictedTelemetryContext(githubToken);
      if (this._githubToken !== githubToken) {
        return;
      }
      await router.route(notification, {
        restrictedTelemetryEnabled: context.restrictedTelemetryEnabled,
        trackingId: context.trackingId,
        telemetryEndpoint: toRestrictedTelemetryEndpoint(context.telemetryEndpoint),
        isInternal: context.isInternal === true,
        userName: context.userName,
        isVscodeTeamMember: context.isVscodeTeamMember === true
      }, additionalProperties);
    } catch (error) {
      this._logService.debug(`[Copilot:${sessionId}] Restricted telemetry context resolution failed; dropping ${notification.event.kind}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  _clientTypeForTelemetry(sdkSessionId) {
    return sdkSessionId ? this._sdkSessionsById.get(sdkSessionId)?.currentTurnClientType ?? AgentHostClientType.Unknown : AgentHostClientType.Unknown;
  }
  /**
   * {@link IAgent.refreshModels}. Coalesces onto an in-flight refresh and
   * never rejects — {@link _refreshModels} already logs and retains the last
   * known-good list on failure.
   *
   * Only safe for callers with no new input to apply (the host's periodic
   * scheduler). Triggers that invalidate the in-flight request — a rotated
   * token, a restarted client — must call {@link _scheduleModelRefresh} so they
   * are not answered by a refresh bound to the superseded input.
   */
  refreshModels() {
    return this._scheduledModelRefresh?.deferred.p ?? this._modelRefreshInFlight ?? this._startModelRefresh(++this._modelCatalogGeneration);
  }
  /**
   * Invalidates an in-flight refresh immediately, then starts one refresh on
   * the next task. Repeated lifecycle triggers before that task
   * share the same deferred and enumerate only the final token/client source.
   */
  _scheduleModelRefresh() {
    const generation = ++this._modelCatalogGeneration;
    if (this._scheduledModelRefresh) {
      this._scheduledModelRefresh.generation = generation;
      return this._scheduledModelRefresh.deferred.p;
    }
    const scheduled = { deferred: new DeferredPromise(), generation };
    this._scheduledModelRefresh = scheduled;
    this._modelRefreshSchedule.value = disposableTimeout(() => {
      void (async () => {
        try {
          await this._clientStopping;
          if (this._scheduledModelRefresh !== scheduled) {
            return;
          }
          this._scheduledModelRefresh = void 0;
          this._modelRefreshSchedule.clear();
          await this._startModelRefresh(scheduled.generation);
        } catch (err) {
          this._logService.error(err, "[Copilot] Failed to schedule model refresh");
        } finally {
          if (this._scheduledModelRefresh === scheduled) {
            this._scheduledModelRefresh = void 0;
            this._modelRefreshSchedule.clear();
          }
          scheduled.deferred.complete();
        }
      })();
    }, 0);
    return scheduled.deferred.p;
  }
  _startModelRefresh(generation) {
    const refresh = this._refreshModels(0, generation).finally(() => {
      if (this._modelRefreshInFlight === refresh) {
        this._modelRefreshInFlight = void 0;
      }
    });
    this._modelRefreshInFlight = refresh;
    return refresh;
  }
  async _refreshModels(attempt = 0, generation = this._modelCatalogGeneration) {
    this._modelRefreshRetry.clear();
    if (this._shutdownPromise) {
      return;
    }
    const tokenAtRefreshStart = this._githubToken;
    if (!tokenAtRefreshStart) {
      this._capiModels = [];
      this._publishModels();
      return;
    }
    try {
      const models = await this._listModels(tokenAtRefreshStart);
      if (this._githubToken === tokenAtRefreshStart && this._modelCatalogGeneration === generation) {
        this._capiModels = models;
        this._publishModels();
      }
    } catch (err) {
      if (this._githubToken !== tokenAtRefreshStart || this._modelCatalogGeneration !== generation || this._shutdownPromise) {
        return;
      }
      await this._recoverFromClosedConnection(err, "modelRefresh");
      if (attempt + 1 < this._modelRefreshMaxAttempts) {
        const delay = this._modelRefreshBackoff(attempt);
        this._logService.warn(`[Copilot] Failed to refresh models (attempt ${attempt + 1}), retrying in ${delay}ms`, err);
        this._modelRefreshRetry.value = disposableTimeout(() => {
          void this._refreshModels(attempt + 1, generation);
        }, delay);
        return;
      }
      this._logService.error(err, "[Copilot] Failed to refresh models");
      this._publishModels();
    }
  }
  /**
   * Re-emit the merged CAPI + BYOK model list to the picker. A fresh array is
   * allocated each call so the observable always notifies its consumers.
   */
  _publishModels() {
    this._models.set([...this._capiModels, ...this._byokModels], void 0);
  }
  /**
   * (Re)publish the renderer BYOK models from the bridge registry's serving
   * window. Triggered when any renderer bridge connects, disconnects, or
   * reports a model change — the registry owns enumeration (with its own
   * connect-time retry) and caches the serving window's models, so this is a
   * cheap synchronous read of that cache.
   *
   * Each model is surfaced under the provider-qualified id `vendor/[group/]id` so a
   * selection round-trips to the per-session provider config synthesized by
   * `resolveByokSessionConfig`.
   */
  _refreshByokModels() {
    if (this._shutdownPromise) {
      return;
    }
    this._byokModels = this._byokBridgeRegistry.getModels().map((m) => {
      const byokMeta = createAgentModelByokMeta(m.modelIdentifier);
      const thinkingLevel = this._createThinkingLevelConfigSchemaProperty(m.supportedReasoningEfforts, m.defaultReasoningEffort, m.id);
      return {
        provider: this.id,
        id: `${m.vendor}/${getByokLmSelectionModelId(m)}`,
        name: m.name ?? m.id,
        maxContextWindow: m.maxContextWindowTokens,
        supportsVision: m.supportsVision ?? false,
        ...thinkingLevel ? { configSchema: { type: "object", properties: { [ThinkingLevelConfigKey]: thinkingLevel } } } : {},
        ...byokMeta && { _meta: byokMeta }
      };
    });
    this._logService.trace(`[Copilot] Found ${this._byokModels.length} BYOK models${this._byokModels.length ? ": " + this._byokModels.map((m) => m.name).join(", ") : ""}`);
    this._publishModels();
  }
  /**
   * Equal-jitter exponential backoff for model-refresh retries. Doubles the
   * base delay per attempt (capped at {@link _modelRefreshMaxDelayMs}) and
   * picks a random point in the upper half of that window, so the returned
   * delay lands in `[exp/2, exp]`. The jitter avoids synchronized retries
   * across windows/agents hitting a shared rate limit, while the `exp/2`
   * floor keeps a minimum spacing between attempts.
   */
  _modelRefreshBackoff(attempt) {
    const exp = Math.min(this._modelRefreshMaxDelayMs, this._modelRefreshBaseDelayMs * 2 ** attempt);
    return Math.round(exp / 2 + Math.random() * (exp / 2));
  }
  _stopClient() {
    this._pendingClientRestartReasons.clear();
    if (this._clientStopping) {
      return this._clientStopping;
    }
    const stopping = (async () => {
      const clientStarting = this._clientStarting;
      if (clientStarting) {
        try {
          await clientStarting;
        } catch {
        }
      }
      const client = this._client;
      this._client = void 0;
      this._clientStarting = void 0;
      await client?.stop();
      await this._sessionLauncher.disposeByokProxyHandle();
    })().finally(() => {
      if (this._clientStopping === stopping) {
        this._clientStopping = void 0;
      }
    });
    this._clientStopping = stopping;
    return stopping;
  }
  // ---- client lifecycle ---------------------------------------------------
  async _ensureClient() {
    if (this._shutdownPromise) {
      throw new CancellationError();
    }
    while (this._clientStopping) {
      await this._clientStopping;
      if (this._shutdownPromise) {
        throw new CancellationError();
      }
    }
    if (this._client) {
      return this._client;
    }
    if (this._clientStarting) {
      return this._clientStarting;
    }
    const sessionSyncAtStartup = this._isSessionSyncEnabled();
    const rubberDuckAtStartup = this._isRubberDuckEnabled();
    const copilotSdkLogLevelSettingAtStartup = this._getCopilotSdkLogLevelSetting();
    const enterpriseHostAtStartup = this._getEnterpriseHost();
    const systemProxyEnabledAtStartup = this._isSystemProxyEnabled();
    const clientStarting = (async () => {
      this._logService.info("[Copilot] Starting CopilotClient...");
      const env = createCopilotCliEnvironment();
      await this._configureProxyEnv(env);
      if (process.platform === "linux") {
        const enabledFlags = env["COPILOT_CLI_ENABLED_FEATURE_FLAGS"];
        const flags = new Set((enabledFlags ?? "").split(",").map((f) => f.trim()).filter(Boolean));
        flags.add("SHELL_SPAWN_BACKEND");
        env["COPILOT_CLI_ENABLED_FEATURE_FLAGS"] = [...flags].join(",");
      }
      env["GITHUB_COPILOT_INTEGRATION_ID"] = COPILOT_INTEGRATION_ID;
      this._logService.info(`[Copilot] Set CLI env: GITHUB_COPILOT_INTEGRATION_ID=${COPILOT_INTEGRATION_ID}`);
      const enterpriseHost = this._getEnterpriseHost();
      if (enterpriseHost) {
        env["COPILOT_GH_HOST"] = enterpriseHost;
        this._logService.info(`[Copilot] Set CLI env: COPILOT_GH_HOST=${enterpriseHost}`);
      }
      if (this._isRubberDuckEnabled()) {
        env["RUBBER_DUCK_AGENT"] = "true";
      } else {
        delete env["RUBBER_DUCK_AGENT"];
      }
      const nodeModulesUri = FileAccess.asFileUri(getAppNodeModulesPath());
      const cliPath = await resolveCopilotCliPath(nodeModulesUri);
      env["MXC_BIN_DIR"] = URI.joinPath(nodeModulesUri, "@microsoft", "mxc-sdk", "bin").fsPath;
      const resolvedRgDiskPath = await rgDiskPath();
      const rgDir = dirname(resolvedRgDiskPath);
      const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
      const currentPath = env[pathKey];
      env[pathKey] = currentPath ? `${currentPath}${delimiter}${rgDir}` : rgDir;
      this._logService.info(`[Copilot] Resolved CLI path: ${cliPath}`);
      const telemetry = await this._otelService.getSdkTelemetryConfig();
      const nativeTelemetry = await this._otelService.getNativeSdkTelemetryConfig();
      if (nativeTelemetry) {
        env["OTEL_SERVICE_NAME"] = "github-copilot";
        env["OTEL_RESOURCE_ATTRIBUTES"] = Object.entries(nativeTelemetry.resourceAttributes).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join(",");
      }
      if (nativeTelemetry?.traces) {
        env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"] = nativeTelemetry.traces.endpoint;
        env["OTEL_EXPORTER_OTLP_TRACES_PROTOCOL"] = nativeTelemetry.traces.protocol;
      }
      if (nativeTelemetry?.external) {
        env["OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"] = resolveCopilotOtlpMetricsEndpoint(nativeTelemetry.external.endpoint, nativeTelemetry.external.protocol);
        env["OTEL_EXPORTER_OTLP_METRICS_PROTOCOL"] = nativeTelemetry.external.protocol;
      } else if (nativeTelemetry) {
        env["OTEL_METRICS_EXPORTER"] = "none";
      }
      const copilotSdkLogLevelAtStartup = this._resolveCopilotSdkLogLevel(copilotSdkLogLevelSettingAtStartup);
      const clientOptions = {
        useLoggedInUser: false,
        connection: RuntimeConnection.forStdio({ path: cliPath }),
        env,
        telemetry,
        logLevel: copilotSdkLogLevelAtStartup,
        enableRemoteSessions: sessionSyncAtStartup,
        onGetTraceContext: () => this._otelService.getCurrentTraceContext() ?? {},
        onGitHubTelemetry: (notification) => {
          void this._routeGitHubTelemetry(notification).catch((err) => this._logService.trace(`[Copilot] GitHub telemetry routing failed: ${err instanceof Error ? err.message : String(err)}`));
        }
      };
      const client = this._createCopilotClient(clientOptions);
      try {
        await client.start();
      } catch (error) {
        const failureKind = classifyCopilotClientFailure(error);
        if (failureKind && error instanceof Error) {
          reportCopilotClientFailure(this._telemetryService, generateUuid(), failureKind, "startClient", this._chatsWithActiveTurn(), false, error);
          this._reportedClientFailures.add(error);
        }
        throw error;
      }
      if (this._shutdownPromise) {
        await client.stop();
        throw new CancellationError();
      }
      if (this._isSessionSyncEnabled() !== sessionSyncAtStartup || this._isRubberDuckEnabled() !== rubberDuckAtStartup || this._getCopilotSdkLogLevelSetting() !== copilotSdkLogLevelSettingAtStartup || this._getEnterpriseHost() !== enterpriseHostAtStartup || this._isSystemProxyEnabled() !== systemProxyEnabledAtStartup) {
        await client.stop();
        throw new Error("Copilot startup config changed while the client was starting");
      }
      this._logService.info("[Copilot] CopilotClient started successfully");
      this._client = client;
      this._clientStarting = void 0;
      return client;
    })();
    this._clientStarting = clientStarting;
    void clientStarting.catch(() => {
      this._clientStarting = void 0;
    });
    return clientStarting;
  }
  // ---- session management -------------------------------------------------
  _createThinkingLevelConfigSchemaProperty(reasoningEfforts, defaultReasoningEffort, modelId) {
    const supportedReasoningEfforts = reasoningEfforts?.filter(isCopilotReasoningEffort);
    if (!supportedReasoningEfforts?.length) {
      return void 0;
    }
    return {
      type: "string",
      title: localize("copilot.modelThinkingLevel.title", "Thinking Level"),
      description: localize("copilot.modelThinkingLevel.description", "Controls how much reasoning effort the model uses."),
      default: resolveDefaultReasoningEffort(supportedReasoningEfforts, defaultReasoningEffort, modelId),
      enum: [...supportedReasoningEfforts],
      enumLabels: supportedReasoningEfforts.map(getReasoningEffortLabel),
      enumDescriptions: supportedReasoningEfforts.map((value) => getReasoningEffortDescription(value) ?? "")
    };
  }
  /**
   * Synthesize a `contextSize` config property when the model exposes a `long_context` pricing tier with a distinct
   * context-max. Picker surfaces this as the "Context Size" button. Mirrors `getContextSizeOptions` in
   * `extensions/copilot/src/extension/chat/vscode-node/languageModelAccess.ts`.
   *
   * The `enum` values are the two context-window sizes (in tokens), smallest first, so the numeric token counts
   * flow to the client. The chosen value comes back in the model's `config` bag and is mapped to the SDK's
   * two-valued `contextTier` at the SDK boundary by {@link getCopilotContextTier}, using the model's long-context
   * window from {@link _longContextWindowFor}.
   */
  _createContextSizeConfigSchemaProperty(billing) {
    const tokenPrices = billing?.tokenPrices;
    const defaultMax = tokenPrices?.contextMax;
    const longContextMax = tokenPrices?.longContext?.contextMax;
    if (!defaultMax || !longContextMax || defaultMax >= longContextMax) {
      return void 0;
    }
    if (this._isPreferLongContextEnabled() && !hasLongContextSurcharge(billing)) {
      return {
        type: "number",
        title: localize("copilot.modelContextSize.title", "Context Size"),
        description: localize("copilot.modelContextSize.description", "Selects the context window size for this model."),
        default: longContextMax,
        enum: [longContextMax],
        enumLabels: [formatTokenCount(longContextMax)],
        enumDescriptions: [
          localize("copilot.modelContextSize.longerSessions", "Longer sessions")
        ]
      };
    }
    return {
      type: "number",
      title: localize("copilot.modelContextSize.title", "Context Size"),
      description: localize("copilot.modelContextSize.description", "Selects the context window size for this model."),
      default: defaultMax,
      enum: [defaultMax, longContextMax],
      enumLabels: [formatTokenCount(defaultMax), formatTokenCount(longContextMax)],
      enumDescriptions: [
        localize("copilot.modelContextSize.default", "Default"),
        localize("copilot.modelContextSize.longerSessions", "Longer sessions")
      ]
    };
  }
  /**
   * The model's long-context window (in tokens): the largest size offered by its "Context Size" picker
   * (the max numeric value in the synthesized `contextSize` {@link ConfigPropertySchema.enum}). Used by
   * {@link getCopilotContextTier} to decide whether a numeric selection opts into `long_context`.
   * Returns `undefined` when the model exposes no such picker (or the model list isn't loaded yet),
   * leaving the SDK on its default tier.
   */
  _longContextWindowFor(modelId) {
    if (!modelId) {
      return void 0;
    }
    const windows = this._models.get().find((m) => m.id === modelId)?.configSchema?.properties?.[ContextSizeConfigKey]?.enum;
    const numericWindows = windows?.filter((w) => typeof w === "number");
    return numericWindows && numericWindows.length > 0 ? Math.max(...numericWindows) : void 0;
  }
  /**
   * Whether the model has a long-context window available at no additional cost.
   * When true the model should always run in `long_context` tier without showing
   * a context-size picker.
   */
  _isFreeLongContext(modelId) {
    return !!modelId && this._freeLongContextModels.has(modelId);
  }
  /**
   * Builds the open `_meta` model picker bag from the SDK's billing and picker metadata.
   */
  _createModelPickerMeta(modelInfo, billing) {
    return createPricingMetaFromBilling(billing, modelInfo.modelPickerPriceCategory, modelInfo.modelPickerCategory);
  }
  _createModelConfigSchema(m, billing) {
    const properties = {};
    const thinkingLevel = this._createThinkingLevelConfigSchemaProperty(m.supportedReasoningEfforts, void 0, m.id);
    if (thinkingLevel) {
      properties[ThinkingLevelConfigKey] = thinkingLevel;
    }
    const contextSize = this._createContextSizeConfigSchemaProperty(billing);
    if (contextSize) {
      properties[ContextSizeConfigKey] = contextSize;
    }
    if (Object.keys(properties).length === 0) {
      return void 0;
    }
    return { type: "object", properties };
  }
  _serializeModelSelection(model) {
    return JSON.stringify(model);
  }
  _parseModelSelection(raw) {
    if (!raw) {
      return void 0;
    }
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === "object" && typeof value.id === "string") {
        const modelSelection = { id: value.id };
        if (value.config && typeof value.config === "object") {
          const config = {};
          for (const [key, configValue] of Object.entries(value.config)) {
            if (typeof configValue === "string") {
              config[key] = configValue;
            }
          }
          if (Object.keys(config).length > 0) {
            modelSelection.config = config;
          }
        }
        return modelSelection;
      }
    } catch {
    }
    return { id: raw };
  }
  _serializeAgentSelection(agent) {
    return JSON.stringify({ uri: agent.uri });
  }
  _parseAgentSelection(raw) {
    if (!raw) {
      return void 0;
    }
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === "object" && typeof value.uri === "string") {
        return { uri: value.uri };
      }
    } catch {
    }
    return void 0;
  }
  /**
   * Resolves an {@link AgentSelection}'s SDK-facing name from the plugin
   * snapshot that is, or will be, applied to the SDK session.
   */
  _resolveAgentName(snapshot, agent) {
    for (const plugin of snapshot.plugins) {
      const found = plugin.agents.find((a) => a.uri.toString() === agent.uri);
      if (found) {
        return found.name;
      }
    }
    return void 0;
  }
  async listSessions() {
    this._logService.info("[Copilot] Listing sessions...");
    const sessions = await this._retryAfterClosedConnection("listSessions", async () => {
      const client = await this._ensureClient();
      return client.listSessions();
    });
    const migrateLegacy = this._isMigrateLegacyCopilotCliEnabled();
    const projectLimiter = new Limiter(4);
    const projectByContext = /* @__PURE__ */ new Map();
    const mapped = await Promise.all(sessions.map(async (s) => {
      const session = AgentSession.uri(this.id, s.sessionId);
      const metadata = await this._readStoredSessionMetadata(session);
      if (!metadata?.workingDirectory) {
        if (migrateLegacy && metadata === void 0 && typeof s.context?.workingDirectory === "string" && await this._isExtensionHostCliSession(s.sessionId)) {
          return {
            session,
            startTime: s.startTime.getTime(),
            modifiedTime: s.modifiedTime.getTime(),
            project: await this._resolveSessionProject(s.context, projectLimiter, projectByContext),
            summary: s.summary,
            workingDirectories: [URI.file(s.context.workingDirectory)],
            _meta: withSessionEhcliAdoptable(void 0)
          };
        }
        return void 0;
      }
      let { project, resolved } = metadata;
      if (!resolved) {
        project = await this._resolveSessionProject(s.context, projectLimiter, projectByContext);
        void this._storeSessionProjectResolution(session, project);
      }
      const workingDirectories = metadata.workingDirectories ?? (typeof s.context?.workingDirectory === "string" ? [URI.file(s.context.workingDirectory)] : void 0);
      const result2 = {
        session,
        startTime: s.startTime.getTime(),
        modifiedTime: s.modifiedTime.getTime(),
        project,
        summary: s.summary,
        workingDirectories
      };
      return result2;
    }));
    const result = mapped.filter((s) => s !== void 0);
    this._logService.info(`[Copilot] Found ${result.length} sessions`);
    return result;
  }
  async getSessionMetadata(session) {
    const sessionId = AgentSession.id(session);
    const storedMetadata = await this._readStoredSessionMetadata(session);
    if (!storedMetadata) {
      return void 0;
    }
    const sessionMetadata = await this._retryAfterClosedConnection("getSessionMetadata", async () => {
      const client = await this._ensureClient();
      return client.getSessionMetadata(sessionId);
    }, createCopilotFailureCorrelation(session, URI.parse(buildDefaultChatUri(session)), void 0, sessionId));
    if (!sessionMetadata) {
      return void 0;
    }
    let project = storedMetadata?.project;
    if (storedMetadata && !storedMetadata.resolved) {
      const projectLimiter = new Limiter(1);
      project = await this._resolveSessionProject(sessionMetadata?.context, projectLimiter, /* @__PURE__ */ new Map());
      void this._storeSessionProjectResolution(session, project);
    }
    const workingDirectories = storedMetadata?.workingDirectories ?? (typeof sessionMetadata?.context?.workingDirectory === "string" ? [URI.file(sessionMetadata.context.workingDirectory)] : void 0);
    return {
      session,
      startTime: sessionMetadata?.startTime.getTime() ?? Date.now(),
      modifiedTime: sessionMetadata?.modifiedTime.getTime() ?? Date.now(),
      project,
      summary: sessionMetadata?.summary,
      workingDirectories
    };
  }
  async _listModels(gitHubToken) {
    this._logService.info("[Copilot] Listing models...");
    const client = await this._ensureClient();
    const { models } = await client.rpc.models.list({ gitHubToken });
    this._freeLongContextModels.clear();
    const preferLongContext = this._isPreferLongContextEnabled();
    const result = models.map((m) => {
      const billing = normalizeCAPIBilling(m.billing);
      const configSchema = this._createModelConfigSchema(m, billing);
      const tokenPrices = billing?.tokenPrices;
      const hasLargerLongContext = !!tokenPrices?.contextMax && !!tokenPrices.longContext?.contextMax && tokenPrices.longContext.contextMax > tokenPrices.contextMax;
      if (preferLongContext && hasLargerLongContext && !hasLongContextSurcharge(billing)) {
        this._freeLongContextModels.add(m.id);
      }
      return {
        provider: this.id,
        id: m.id,
        name: m.name,
        // Synthetic SDK entries like `auto` ship with `capabilities: {}` and
        // no fixed context window — surface them with maxContextWindow undefined.
        maxContextWindow: m.capabilities?.limits?.max_context_window_tokens,
        maxOutputTokens: m.capabilities?.limits?.max_output_tokens,
        maxPromptTokens: m.capabilities?.limits?.max_prompt_tokens,
        supportsVision: !!m.capabilities?.supports?.vision,
        configSchema,
        policyState: m.policy?.state,
        _meta: this._createModelPickerMeta(m, billing)
      };
    });
    this._logService.info(`[Copilot] Found ${result.length} models: ${result.map((m) => m.name).join(", ")}`);
    return result;
  }
  /**
   * Resolves the working directory for a {@link createSession} call: the caller-supplied folder, else a
   * still-provisional session's folder for an idempotent re-create, else — when the session is workspace-less
   * (no `workingDirectory` supplied) — a stable per-session scratch directory.
   */
  async _resolveCreateWorkingDirectory(sessionConfig, sessionId, isWorkspaceless) {
    if (sessionConfig.fork) {
      const sourceSessionId = AgentSession.id(sessionConfig.fork.session);
      const liveWorkingDirectory = this._findAnySession(sourceSessionId)?.workingDirectory;
      if (liveWorkingDirectory) {
        return liveWorkingDirectory;
      }
      const storedWorkingDirectory = (await this._readSessionMetadata(sessionConfig.fork.session)).workingDirectory;
      if (storedWorkingDirectory) {
        return storedWorkingDirectory;
      }
    }
    const existing = sessionConfig.workingDirectories?.[0] ?? this._provisionalSessions.get(sessionId)?.workingDirectory;
    if (existing) {
      return existing;
    }
    if (isWorkspaceless) {
      const scratchDir = this._workspacelessScratchDir(sessionId);
      await fs.mkdir(scratchDir.fsPath, { recursive: true });
      return scratchDir;
    }
    const tmpPath = await fs.mkdtemp(join(os.tmpdir(), "agent-host-session-"));
    const workingDirectory = URI.file(tmpPath);
    this._logService.trace(`[Copilot] No workingDirectory provided, defaulting to temp directory: ${workingDirectory.fsPath}`);
    return workingDirectory;
  }
  /**
   * Stable per-session scratch directory for a workspace-less chat:
   * `<userHome>/.copilot/chats/<sessionId>`. Deterministic, persistent, and
   * cleaned up on session delete (see {@link _cleanupWorkspacelessScratchDir}).
   */
  _workspacelessScratchDir(sessionId) {
    return workspacelessScratchDir(this._environmentService.userHome, sessionId);
  }
  /** Ensures a workspace-less chat's scratch dir exists (mkdir -p), recreating it if it was reaped. */
  async _ensureWorkspacelessScratchDir(scratchDir, sessionId) {
    try {
      await fs.mkdir(scratchDir.fsPath, { recursive: true });
      this._logService.trace(`[Copilot:${sessionId}] Workspace-less scratch directory ready: ${scratchDir.fsPath}`);
    } catch (error) {
      this._logService.warn(`[Copilot:${sessionId}] Failed to ensure workspace-less scratch directory '${scratchDir.fsPath}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  /** Removes a workspace-less chat's stable scratch dir on session delete/dispose. */
  async _cleanupWorkspacelessScratchDir(scratchDir, sessionId) {
    try {
      await fs.rm(scratchDir.fsPath, { recursive: true, force: true });
      this._logService.trace(`[Copilot:${sessionId}] Removed workspace-less scratch directory: ${scratchDir.fsPath}`);
    } catch (error) {
      this._logService.warn(`[Copilot:${sessionId}] Failed to remove workspace-less scratch directory '${scratchDir.fsPath}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // ---- Chat surface ------------------------------------------------------
  //
  // The chat-addressed operation surface (see
  // {@link IAgent.chats}). The orchestrator owns the feature-level
  // `(session, chat)` mapping and hands these methods a single,
  // concrete chat channel URI: the default chat channel or an additional
  // peer chat channel. Each method re-derives the `(session, chat)` pair
  // the agent's internal SDK storage is keyed by via
  // {@link _resolveChatTarget}.
  /**
   * Maps a resolved chat URI to the `(session, chat)` pair the agent's
   * internal storage is keyed by. A peer (`ahp-chat`) chat carries its
   * owning session in its URI. The default chat is addressed by its
   * deterministic chat channel URI.
   */
  _resolveChatTarget(chat) {
    const parsed = parseChatUri(chat);
    if (!parsed) {
      throw new Error(`Copilot chat operation requires an AHP chat URI: ${chat.toString()}`);
    }
    return { session: URI.parse(parsed.session), chat };
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
   * Resolve the session's materialized default (main) chat by raw session id,
   * or `undefined` when the session is provisional or not in memory. The
   * default chat is the primary {@link CopilotAgentSession} of the owning
   * {@link CopilotSessionEntry}.
   */
  _findAnySession(sessionId) {
    return this._sessions.get(sessionId)?.defaultChat;
  }
  _getRuntimeSlashCommands(sessionId, options) {
    const session = this._findAnySession(sessionId);
    if (session) {
      return session.getRuntimeSlashCommands(options) ?? [];
    }
    return this._slashCommandProvider.getSlashCommands(options);
  }
  /**
   * Resolve a live peer (non-default) chat — its own SDK chat — by
   * looking it up within the owning session's entry. Returns `undefined` when
   * the session (or the peer chat) is not in memory.
   */
  _findPeerChat(session, chat) {
    return this._sessions.get(AgentSession.id(session))?.getPeerChat(chat.toString());
  }
  /**
   * Return the owning session's entry, creating an empty one (no default chat
   * yet) if needed so a peer chat can be hosted on a still-provisional parent.
   */
  _ensureEntry(sessionId) {
    let entry = this._sessions.get(sessionId);
    if (!entry) {
      entry = new CopilotSessionEntry();
      this._sessions.set(sessionId, entry);
    }
    return entry;
  }
  async createSession(config) {
    const sessionConfig = config ?? {};
    this._logService.info(`[Copilot] Creating session... ${sessionConfig.model ? `model=${sessionConfig.model.id}` : ""}`);
    const sessionId = sessionConfig.session ? AgentSession.id(sessionConfig.session) : generateUuid();
    if (sessionConfig.fork && AgentSession.id(sessionConfig.fork.session) === sessionId) {
      throw new Error(`Cannot fork Copilot session ${sessionId} onto itself`);
    }
    const isWorkspaceless = !sessionConfig.fork && sessionConfig.workingDirectories === void 0;
    const workingDirectory = await this._resolveCreateWorkingDirectory(sessionConfig, sessionId, isWorkspaceless);
    await this._ensureClient();
    if (sessionConfig.fork) {
      const fork = sessionConfig.fork;
      const sourceSessionId = AgentSession.id(fork.session);
      return this._queueSession(sourceSessionId, async () => {
        this._logService.info(`[Copilot] Forking session ${sourceSessionId} at turnId=${fork.turnId}`);
        const sourceEntry = this._findAnySession(sourceSessionId) ?? await this._resumeSession(sourceSessionId);
        const sourceTurns = await sourceEntry.getMessages();
        const sourceTurnEventId = await sourceEntry.getTurnEventId(fork.turnId);
        const sourceTurnIndex = sourceTurns.findIndex((turn) => turn.id === sourceTurnEventId);
        if (sourceTurnIndex < 0) {
          throw new Error(`Cannot fork Copilot session ${sourceSessionId}: turn ${fork.turnId} is not in the provider history`);
        }
        const inheritedTurns = sourceTurns.slice(0, sourceTurnIndex + 1);
        const turnIdMapping = fork.turnIdMapping;
        const targetTurnIdByEventId = /* @__PURE__ */ new Map();
        if (turnIdMapping) {
          await Promise.all([...turnIdMapping].map(async ([sourceTurnId, targetTurnId]) => {
            const eventId = await sourceEntry.getTurnEventId(sourceTurnId);
            if (eventId) {
              targetTurnIdByEventId.set(eventId, targetTurnId);
            }
          }));
        }
        const importedTurns = inheritedTurns.map((turn) => ({ ...turn, id: targetTurnIdByEventId.get(turn.id) ?? turn.id }));
        const session = AgentSession.uri(this.id, sessionId);
        const sourceMetadata = await this._readSessionMetadata(fork.session);
        const inheritedWorkingDirectories = sourceMetadata.workingDirectories ?? (sourceEntry.workingDirectory ? [sourceEntry.workingDirectory] : [workingDirectory]);
        const model = sessionConfig.model ?? sourceMetadata.model;
        const agent = sessionConfig.agent ?? sourceMetadata.agent;
        const targetDbDir = this._sessionDataService.getSessionDataDir(session);
        const targetDbPath = URI.joinPath(targetDbDir, SESSION_DB_FILENAME);
        try {
          const sourceDbRef = await this._sessionDataService.tryOpenDatabase(fork.session);
          if (sourceDbRef) {
            try {
              await fs.mkdir(targetDbDir.fsPath, { recursive: true });
              await fs.rm(targetDbPath.fsPath, { force: true });
              await sourceDbRef.object.vacuumInto(targetDbPath.fsPath);
              if (turnIdMapping) {
                const targetDbRef = this._sessionDataService.openDatabase(session);
                try {
                  const importedEventIds = new Map(importedTurns.map((turn) => [turn.id, turn.id]));
                  await targetDbRef.object.remapTurnIds(turnIdMapping, importedEventIds);
                } finally {
                  targetDbRef.dispose();
                }
              }
            } finally {
              sourceDbRef.dispose();
            }
          }
        } catch (err) {
          this._logService.warn(`[Copilot] Failed to copy session database for fork: ${err instanceof Error ? err.message : String(err)}`);
          await fs.rm(targetDbPath.fsPath, { force: true });
        }
        const created = await this._importConversation({
          ...sessionConfig,
          model,
          agent,
          workingDirectories: inheritedWorkingDirectories,
          fork: void 0,
          importConversation: { turns: importedTurns, model }
        }, sessionId, workingDirectory);
        this._logService.info(`[Copilot] Forked session created: ${session.toString()}`);
        try {
          await this._reviewService.copyReviewedRef(fork.session.toString(), session.toString(), workingDirectory);
        } catch (err) {
          this._logService.warn(`[Copilot] Failed to copy reviewed ref for fork: ${err instanceof Error ? err.message : String(err)}`);
        }
        return created;
      });
    }
    if (sessionConfig.importConversation) {
      if (sessionConfig.session && !this._findAnySession(sessionId) && !this._provisionalSessions.has(sessionId)) {
        this._resetSessionLifetime(sessionId);
      }
      return this._importConversation(sessionConfig, sessionId, workingDirectory);
    }
    const sessionUri = AgentSession.uri(this.id, sessionId);
    if (this._findAnySession(sessionId)) {
      this._logService.info(`[Copilot] createSession is a no-op: session already materialized: ${sessionUri.toString()}`);
      const project2 = await projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
      return { session: sessionUri, resolvedWorkingDirectory: workingDirectory, ...project2 ? { project: project2 } : {} };
    }
    const alreadyProvisional = this._provisionalSessions.has(sessionId);
    if (sessionConfig.activeClient) {
      const ac = this._getOrCreateActiveClient(sessionUri, workingDirectory);
      ac.pluginController.setAdditionalDirectories(this._additionalCustomizationDirectories(sessionConfig.workingDirectories));
      const seeded = sessionConfig.activeClient;
      ac.toolSet.set(seeded.clientId, seeded.tools);
      ac.getOrCreateHandle(seeded.clientId, seeded.displayName);
      if (seeded.customizations !== void 0) {
        await ac.pluginController.sync(seeded.clientId, seeded.customizations, { quiet: true });
      }
    }
    const project = await projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
    if (!alreadyProvisional) {
      this._resetSessionLifetime(sessionId);
      this._provisionalSessions.set(sessionId, {
        sessionId,
        sessionUri,
        workingDirectory,
        workingDirectories: sessionConfig.workingDirectories,
        model: sessionConfig.model,
        agent: sessionConfig.agent,
        project,
        workspaceless: isWorkspaceless
      });
    }
    this._logService.info(`[Copilot] Session created (provisional): ${sessionUri.toString()}`);
    return { session: sessionUri, resolvedWorkingDirectory: workingDirectory, provisional: true, ...project ? { project } : {} };
  }
  /**
   * Materializes an imported conversation into a real, editable Copilot
   * session. Translates the supplied turns into a Copilot event log, seeds it
   * at the CLI's native per-session store, then resumes the session so the
   * SDK reconstitutes the turns as genuine backend events (editable / forkable
   * / truncatable). The turns arrive with fresh UUID ids assigned by the
   * service layer, so the seeded event ids and the seeded protocol turns stay
   * aligned. Mirrors the immediate-materialization shape of the fork path.
   */
  async _importConversation(sessionConfig, sessionId, workingDirectory) {
    const importConfig = sessionConfig.importConversation;
    const sessionUri = AgentSession.uri(this.id, sessionId);
    return this._queueSession(sessionId, async () => {
      this._logService.info(`[Copilot] Importing conversation into session ${sessionId} (${importConfig.turns.length} turns)`);
      const model = importConfig.model ?? sessionConfig.model;
      const projectPromise = projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
      const eventsPath = join(getCopilotHomePath(this._environmentService.userHome.fsPath, process.env), "session-state", sessionId, "events.jsonl");
      const jsonl = buildSessionEventLogFromTurns(importConfig.turns, {
        sessionId,
        workingDirectory: workingDirectory.fsPath,
        model: model?.id
      });
      await fs.mkdir(dirname(eventsPath), { recursive: true });
      await fs.writeFile(eventsPath, jsonl, "utf8");
      const project = await projectPromise;
      await this._storeSessionMetadata(sessionUri, model, workingDirectory, sessionConfig.workingDirectories ?? [workingDirectory], workingDirectory, project);
      if (sessionConfig.agent !== void 0) {
        await this._storeSessionAgentMetadata(sessionUri, sessionConfig.agent);
      }
      await this._resumeSession(sessionId);
      this._logService.info(`[Copilot] Imported session created: ${sessionUri.toString()}`);
      return { session: sessionUri, resolvedWorkingDirectory: workingDirectory, ...project ? { project } : {} };
    });
  }
  /**
   * Whether an on-disk Copilot session was created by the VS Code extension-host
   * Copilot CLI feature — identified by its `vscode.metadata.json` marker under
   * `~/.copilot/session-state/<id>/`. Distinguishes EH CLI sessions (the only
   * ones we migrate) from other Copilot SDK sessions that share the same store
   * (standalone `copilot` CLI runs, Local agent sessions, …).
   */
  /** Absolute path of the extension-host Copilot CLI `vscode.metadata.json` marker for `sessionId`. */
  _extensionHostCliMarkerPath(sessionId) {
    return join(getCopilotHomePath(this._environmentService.userHome.fsPath, process.env), "session-state", sessionId, "vscode.metadata.json");
  }
  _isExtensionHostCliSession(sessionId) {
    let cached = this._isExtensionHostCliSessionCache.get(sessionId);
    if (!cached) {
      cached = fs.access(this._extensionHostCliMarkerPath(sessionId)).then(() => true, () => false);
      this._isExtensionHostCliSessionCache.set(sessionId, cached);
    }
    return cached;
  }
  /**
   * Reads the VS Code-layer custom title the extension-host Copilot CLI feature
   * persisted for `sessionId` in its `vscode.metadata.json` marker, so adoption
   * can carry the user-chosen session name over to the agent host. Returns
   * `undefined` when the marker is absent/unreadable or has no custom title.
   */
  async _readExtensionHostCliCustomTitle(sessionId) {
    try {
      const raw = await fs.readFile(this._extensionHostCliMarkerPath(sessionId), "utf8");
      const title = JSON.parse(raw).customTitle;
      return typeof title === "string" && title.trim() ? title : void 0;
    } catch {
      return void 0;
    }
  }
  /**
   * Adopt-on-open for legacy extension-host Copilot CLI sessions. If `session`
   * has an on-disk SDK event log (`~/.copilot/session-state/<id>/`) but no
   * agent-host VS Code-layer metadata yet, seed that metadata in place — reusing
   * the event log verbatim — so the normal restore flow can resume it as editable
   * turns. Reports `adopted: true` iff it newly adopted the session (so the caller
   * can run the one-time checkpoint bridge), and `eligible` whether the session
   * was a genuine legacy candidate at all (vs already migrated / native / not an
   * adoptable on-disk session).
   */
  async ensureSessionAdopted(session) {
    const sessionId = AgentSession.id(session);
    return this._queueSession(sessionId, async () => {
      const existing = await this._readStoredSessionMetadata(session);
      if (existing?.workingDirectory) {
        return { adopted: false, eligible: false };
      }
      if (!await this._isExtensionHostCliSession(sessionId)) {
        return { adopted: false, eligible: false };
      }
      const client = await this._ensureClient();
      const sdkMetadata = await client.getSessionMetadata(sessionId).catch(() => void 0);
      const workingDirectory = typeof sdkMetadata?.context?.workingDirectory === "string" ? URI.file(sdkMetadata.context.workingDirectory) : void 0;
      if (!workingDirectory) {
        return { adopted: false, eligible: true };
      }
      this._logService.info(`[Copilot] Adopting legacy session ${sessionId} in place (reusing on-disk events.jsonl)`);
      const project = await projectFromCopilotContext({ cwd: workingDirectory.fsPath }, this._gitService);
      const customTitle = await this._readExtensionHostCliCustomTitle(sessionId);
      await this._storeSessionMetadata(session, void 0, workingDirectory, [workingDirectory], workingDirectory, project, project !== void 0, { [SessionConfigKey.Isolation]: "folder" }, customTitle);
      return { adopted: true, eligible: true };
    });
  }
  /**
   * Promotes a {@link IProvisionalSession} into a real Copilot SDK session
   * by performing the work that {@link createSession} previously did
   * eagerly: resolves the working directory (creating a worktree if
   * `isolation === 'worktree'`), instantiates the {@link CopilotAgentSession},
   * persists session metadata, and notifies the {@link IAgentService} via
   * {@link onDidMaterializeSession} so it can fire the deferred
   * `sessionAdded` protocol notification.
   *
   * Called from {@link sendMessage} immediately before a turn is dispatched.
   * Already runs inside the session sequencer, so concurrent sends serialize
   * naturally.
   *
   * The latest model lives on the provisional record (kept in sync via
   * {@link changeModel}). The latest provider-owned session config is read
   * straight from the state manager via
   * {@link IAgentConfigurationService.getSessionConfigValues} so any
   * `SessionConfigChanged` actions that arrived after `createSession` are
   * honoured without bespoke forwarding.
   */
  async _materializeProvisional(sessionId, resolvedWorkingDirectories) {
    const provisional = this._provisionalSessions.get(sessionId);
    if (!provisional) {
      throw new Error(`Cannot materialize unknown provisional session: ${sessionId}`);
    }
    const client = await this._ensureClient();
    const sessionUri = provisional.sessionUri;
    const workingDirectory = resolvedWorkingDirectories?.[0] ?? provisional.workingDirectory;
    const customizationDirectory = workingDirectory ?? provisional.workingDirectory;
    const activeClient = this._getOrCreateActiveClient(sessionUri, customizationDirectory);
    activeClient.pluginController.reanchor(customizationDirectory);
    activeClient.pluginController.setAdditionalDirectories(this._additionalCustomizationDirectories(resolvedWorkingDirectories));
    const snapshot = await activeClient.snapshot();
    const shellManager = this._instantiationService.createInstance(ShellManager, sessionUri, workingDirectory);
    let agentSession;
    let agent;
    try {
      const resolvedAgent = await this._resolveAgentWhenMaterializing(provisional, snapshot, workingDirectory);
      agent = resolvedAgent?.agent;
      const launchPlan = {
        kind: "create",
        client,
        sessionId,
        workingDirectory,
        additionalDirectories: this._additionalCustomizationDirectories(resolvedWorkingDirectories),
        resolvedAgentName: resolvedAgent?.name,
        snapshot,
        activeClientToolSet: activeClient.toolSet,
        shellManager,
        githubToken: this._githubToken,
        model: provisional.model,
        longContextWindow: this._longContextWindowFor(provisional.model?.id),
        freeLongContext: this._isFreeLongContext(provisional.model?.id),
        workspaceless: provisional.workspaceless
      };
      agentSession = this._createAgentSession(launchPlan, customizationDirectory, activeClient);
      await agentSession.initializeSession();
      this._registerInitializedSession(sessionId, agentSession, launchPlan.client);
    } catch (error) {
      agentSession?.dispose();
      throw error;
    }
    const project = await projectFromCopilotContext({ cwd: workingDirectory?.fsPath }, this._gitService);
    const materializedWorkingDirectories = resolvedWorkingDirectories ?? [workingDirectory];
    this._provisionalSessions.delete(sessionId);
    await this._storeSessionMetadata(sessionUri, provisional.model, workingDirectory, materializedWorkingDirectories, customizationDirectory, project, true);
    if (agent !== void 0) {
      await this._storeSessionAgentMetadata(sessionUri, agent);
    }
    this._checkpointService.captureBaselineCheckpoint(sessionUri, materializedWorkingDirectories).catch((err) => {
      this._logService.warn(`[Copilot:${sessionId}] Baseline checkpoint capture failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    this._logService.info(`[Copilot] Session materialized: ${sessionUri.toString()}`);
    this._onDidMaterializeSession.fire({ session: sessionUri, project, workingDirectories: materializedWorkingDirectories });
    return agentSession;
  }
  async _resolveAgentWhenMaterializing(provisional, snapshot, workingDirectory) {
    const agent = provisional.agent;
    if (!agent) {
      return void 0;
    }
    const alternativeAgent = this._getAlternativeAgentForWorktree(provisional, workingDirectory);
    const originalAgentName = this._resolveAgentName(snapshot, agent);
    const alternativeAgentName = alternativeAgent ? this._resolveAgentName(snapshot, alternativeAgent) : void 0;
    if (originalAgentName) {
      return { agent, name: originalAgentName };
    }
    if (alternativeAgentName && alternativeAgent) {
      this._logService.info(`[Copilot] Agent file ${agent.uri} is in the original repo; using worktree agent ${alternativeAgent?.uri}`);
      return { agent: alternativeAgent, name: alternativeAgentName };
    }
    return void 0;
  }
  _getAlternativeAgentForWorktree(provisional, workingDirectory) {
    const agent = provisional.agent;
    if (!agent) {
      return void 0;
    }
    if (!provisional.workingDirectory || !workingDirectory) {
      return void 0;
    }
    if (isEqual(provisional.workingDirectory, workingDirectory)) {
      return void 0;
    }
    const agentUri = URI.parse(agent.uri);
    const alternativeAgentUri = rebaseUnder(agentUri, provisional.workingDirectory, workingDirectory);
    return alternativeAgentUri ? { uri: alternativeAgentUri.toString() } : void 0;
  }
  async resolveSessionConfig(params) {
    const values = platformSessionSchema.validateOrDefault(migrateLegacyAutopilotConfig(params.config), {
      [SessionConfigKey.AutoApprove]: "default",
      [SessionConfigKey.Mode]: "interactive"
      // Permissions intentionally omitted — leave unset so auto-approval
      // falls through to the host-level `permissions` default, and only
      // materializes on the session once the user hits "Allow in this
      // Session".
    });
    return {
      schema: platformSessionSchema.toProtocol(),
      values
    };
  }
  getInheritedSessionConfig(config) {
    const inherited = {};
    for (const key of [SessionConfigKey.AutoApprove, SessionConfigKey.Permissions]) {
      if (config[key] !== void 0) {
        inherited[key] = config[key];
      }
    }
    return Object.keys(inherited).length > 0 ? inherited : void 0;
  }
  async sessionConfigCompletions(_params) {
    return { items: [] };
  }
  getOrCreateActiveClient(session, client) {
    const activeClient = this._getOrCreateActiveClient(session, void 0);
    if (!activeClient.pluginController.directory) {
      this._getSessionCustomizationAnchors(session).then(
        (anchors) => {
          activeClient.pluginController.setDirectory(anchors.directory);
          if (anchors.applyAdditional) {
            activeClient.pluginController.setAdditionalDirectories(anchors.additionalDirectories);
          }
        },
        () => {
        }
      );
    }
    return activeClient.getOrCreateHandle(client.clientId, client.displayName);
  }
  removeActiveClient(session, clientId) {
    const sessionId = AgentSession.id(session);
    this._logService.info(`[Copilot:${sessionId}] removeActiveClient: clientId=${clientId}`);
    this._activeClients.get(session)?.removeClient(clientId);
  }
  onClientToolCallComplete(session, chat, toolCallId, result) {
    const sessionId = AgentSession.id(session);
    if (!isDefaultChatUri(chat)) {
      const peerChat = this._findPeerChat(session, chat);
      if (!peerChat) {
        this._logService.warn(`[Copilot:${sessionId}] Dropping client tool completion for missing peer chat: chat=${chat.toString()}, toolCallId=${toolCallId}, success=${result.success}`);
        return;
      }
      this._logService.info(`[Copilot:${sessionId}] Routing client tool completion to peer chat: chat=${chat.toString()}, toolCallId=${toolCallId}, success=${result.success}`);
      peerChat.handleClientToolCallComplete(toolCallId, result);
    } else {
      const entry = this._findAnySession(sessionId);
      if (!entry) {
        this._logService.warn(`[Copilot:${sessionId}] Dropping client tool completion for missing default chat: chat=${chat.toString()}, toolCallId=${toolCallId}, success=${result.success}`);
        return;
      }
      this._logService.info(`[Copilot:${sessionId}] Routing client tool completion to default chat: chat=${chat.toString()}, toolCallId=${toolCallId}, success=${result.success}`);
      entry.handleClientToolCallComplete(toolCallId, result);
    }
  }
  async _sendMessage(chat, prompt, attachments, turnId, senderClientId, clientType = AgentHostClientType.Unknown, workingDirectories) {
    try {
      await this._sendMessageOnce(chat, prompt, attachments, turnId, senderClientId, clientType, workingDirectories);
    } catch (error) {
      const recovery = await this._recoverFromClosedConnection(error, "sendMessage", this._clientFailureCorrelation(chat, turnId));
      if (turnId && recovery?.failedTurnIds.has(turnId)) {
        return;
      }
      throw error;
    }
  }
  async _sendMessageOnce(chat, prompt, attachments, turnId, senderClientId, clientType = AgentHostClientType.Unknown, workingDirectories) {
    const context = this._getChatContext(chat);
    if (context.isPeerChat) {
      const entry = await this._ensureChatSession(context.session, chat);
      if (!entry) {
        throw new Error(`[Copilot] sendMessage for unknown chat: ${chat.toString()}`);
      }
      if (turnId) {
        entry.resetTurnState(turnId, senderClientId, clientType);
      }
      const sideChat = this._chatBackings.get(chat.toString())?.sideChat;
      const existingTurns = sideChat ? await entry.getMessages() : [];
      const sdkPrompt = prepareSideChatPrompt(prompt, existingTurns, sideChat);
      await entry.send(sdkPrompt, attachments, turnId, this._resolveSdkMode(context.session), senderClientId, clientType);
      return;
    }
    await this._queueSession(context.sessionId, async () => {
      await this._activeClients.get(context.session)?.pluginController.retryFailedClientSyncIfNeeded();
      let entry;
      if (this._provisionalSessions.has(context.sessionId)) {
        entry = await this._materializeProvisional(context.sessionId, workingDirectories);
      } else {
        entry = this._getChatContext(chat).target;
      }
      const activeClient = this._activeClients.get(context.session);
      const hadCachedEntry = !!entry;
      this._logService.info(`[Copilot:${context.sessionId}] sendMessage: cachedEntry=${hadCachedEntry}, hasActiveClient=${!!activeClient}, activeClientId=${activeClient ? "(set)" : "(none)"}`);
      const rootsChanged = !!entry && workingDirectories !== void 0 && !areAdditionalWorkingDirectoriesEqual(entry.appliedAdditionalDirectories, this._additionalCustomizationDirectories(workingDirectories));
      const structuralConfigChanged = !!entry && !!activeClient && await activeClient.requiresRestart(entry.appliedSnapshot);
      if (entry && (rootsChanged || structuralConfigChanged)) {
        this._logService.info(`[Copilot:${context.sessionId}] Session configuration changed, refreshing session. clients=[${activeClient ? [...activeClient.toolSet.clientIds()].join(", ") || "(none)" : "(none)"}]`);
        this._sdkSessionsById.delete(entry.sessionId);
        await entry.destroySession();
        this._sessions.get(context.sessionId)?.clearDefaultChat();
        entry = void 0;
      }
      if (!entry) {
        this._logService.info(`[Copilot:${context.sessionId}] No cached entry${hadCachedEntry ? " (was evicted by requiresRestart)" : ""}, calling _resumeSession`);
      }
      entry ??= await this._resumeSession(context.sessionId, workingDirectories);
      if (turnId) {
        entry.resetTurnState(turnId, senderClientId, clientType);
      }
      try {
        const sdkMode = this._resolveSdkMode(context.session);
        await entry.send(prompt, attachments, turnId, sdkMode, senderClientId, clientType);
      } catch (err) {
        const errCode = err?.code;
        const errMsg = err instanceof Error ? err.message : String(err);
        this._logService.error(`[Copilot:${context.sessionId}] entry.send() failed: code=${errCode}, message=${errMsg}, hadCachedEntry=${hadCachedEntry}, errorType=${err?.constructor?.name}`);
        throw err;
      }
    });
  }
  /**
   * Translates the AHP-side `mode` to the Copilot SDK's three-mode space
   * (`interactive` / `plan` / `autopilot`). With Autopilot living on the
   * `mode` axis the mapping is now direct:
   *
   *  - `mode='plan'` → SDK `plan`.
   *  - `mode='autopilot'` → SDK `autopilot` (autonomous, continue-until-done).
   *  - `mode='interactive'` → SDK `interactive`.
   *
   * Tool auto-approval is governed independently by the orthogonal
   * `autoApprove` axis (Default / Bypass), enforced by the agent
   * host's own permission handler — which the SDK still invokes even under
   * autopilot mode.
   *
   * Returns `undefined` when no mode is configured for the session, so
   * the SDK's current mode is left untouched.
   */
  _resolveSdkMode(session) {
    const sessionKey = session.toString();
    const mode = this._configurationService.getEffectiveValue(sessionKey, platformSessionSchema, SessionConfigKey.Mode);
    switch (mode) {
      case "plan":
        return "plan";
      case "autopilot":
        return "autopilot";
      case "interactive":
        return "interactive";
      default:
        return void 0;
    }
  }
  /**
   * Reads the session's current `mode` and `autoApprove` axis values so the
   * slash-command completion provider can hide config-action toggles that would
   * be a no-op (e.g. `/autopilot on` while already in autopilot).
   */
  _getSessionConfigState(sessionId) {
    const sessionKey = AgentSession.uri(this.id, sessionId).toString();
    return {
      mode: this._configurationService.getEffectiveValue(sessionKey, platformSessionSchema, SessionConfigKey.Mode),
      autoApprove: this._configurationService.getEffectiveValue(sessionKey, platformSessionSchema, SessionConfigKey.AutoApprove)
    };
  }
  setPendingMessages(chat, steeringMessage, _queuedMessages) {
    const context = this._getChatContext(chat);
    if (!context.target) {
      this._logService.warn(`[Copilot:${context.sessionId}] setPendingMessages: chat not found for ${chat.toString()}`);
      return;
    }
    if (steeringMessage) {
      context.target.sendSteering(steeringMessage);
    }
  }
  async getSessionMessages(session) {
    const subagentInfo = parseSubagentSessionUri(session);
    if (subagentInfo) {
      let rootSession = subagentInfo.parentSession;
      let parentParsed;
      while (parentParsed = parseSubagentSessionUri(rootSession)) {
        rootSession = parentParsed.parentSession;
      }
      const rootSessionId = AgentSession.id(rootSession);
      const parentEntry = this._findAnySession(rootSessionId) ?? await this._resumeSession(rootSessionId).catch((err) => {
        this._logService.warn(`[Copilot:${rootSessionId}] Failed to resume root for subagent restore`, err);
        return void 0;
      });
      if (!parentEntry) {
        return [];
      }
      return parentEntry.getSubagentMessages(subagentInfo.toolCallId);
    }
    const chat = parseChatUri(session) ? session : URI.parse(buildDefaultChatUri(session));
    const context = this._getChatContext(chat);
    if (context.isPeerChat) {
      const entry2 = await this._ensureChatSession(context.session, chat);
      const turns = entry2 ? await entry2.getMessages() : [];
      const sideChat = this._chatBackings.get(chat.toString())?.sideChat;
      return stripSideChatContext(turns.slice(sideChat?.inheritedTurnCount ?? 0), sideChat);
    }
    const sessionId = context.sessionId;
    if (this._provisionalSessions.has(sessionId)) {
      return [];
    }
    const entry = context.target ?? await this._resumeSession(sessionId).catch((err) => {
      if (err instanceof SessionWorkingDirectoryMissingError) {
        throw err;
      }
      this._logService.warn(`[Copilot:${sessionId}] Failed to resume session for message lookup`, err);
      return void 0;
    });
    if (!entry) {
      return [];
    }
    return entry.getMessages();
  }
  async getSubagentSessions(session) {
    const chatInfo = parseChatUri(session);
    if (chatInfo && !isDefaultChatUri(session)) {
      return [];
    }
    if (parseSubagentSessionUri(session)) {
      return [];
    }
    const sessionId = AgentSession.id(session);
    if (this._provisionalSessions.has(sessionId)) {
      return [];
    }
    const entry = this._findAnySession(sessionId) ?? await this._resumeSession(sessionId).catch((err) => {
      this._logService.warn(`[Copilot:${sessionId}] Failed to resume session for subagent lookup`, err);
      return void 0;
    });
    return entry ? entry.getSubagentSessions() : [];
  }
  async disposeSession(session) {
    const sessionId = AgentSession.id(session);
    const lifetime = this._getOrCreateSessionLifetime(sessionId);
    if (!lifetime) {
      return;
    }
    await lifetime.queueSession(() => lifetime.dispose(async () => {
      const provisional = this._provisionalSessions.get(sessionId);
      const isWorkspaceless = provisional ? provisional.workspaceless === true : (await this._readSessionMetadata(session).catch(() => void 0))?.workspaceless === true;
      if (!this._provisionalSessions.has(sessionId)) {
        const client = await this._ensureClient();
        await client.deleteSession(sessionId);
      }
      await this._destroyAndDisposeSession(sessionId);
      if (isWorkspaceless) {
        await this._cleanupWorkspacelessScratchDir(this._workspacelessScratchDir(sessionId), sessionId);
      }
    }));
    this._otelService.releaseSessionTraceContext(session.toString());
  }
  /**
   * Non-destructive counterpart to {@link disposeSession}: releases the
   * session's in-memory resources (SDK session/connection, cached entry,
   * active clients, MCP subscriptions) but preserves all durable data — the
   * SDK session log, session database, and worktree stay on disk. The session
   * transparently resumes on the next access via {@link _resumeSession}.
   *
   * No-ops for sessions that have nothing durable to resume from (provisional
   * sessions) or that aren't currently held in memory, and for sessions with a
   * running turn — disconnecting mid-turn would strand the SDK session.
   */
  async releaseSession(session) {
    const sessionId = AgentSession.id(session);
    const lifetime = this._getOrCreateSessionLifetime(sessionId);
    if (!lifetime) {
      return;
    }
    await lifetime.queueSession(() => lifetime.release(async () => {
      if (this._provisionalSessions.has(sessionId)) {
        return;
      }
      const entry = this._sessions.get(sessionId);
      if (!entry) {
        return;
      }
      if (entry.allChatSessions().some((chatSession) => chatSession.hasActiveTurn)) {
        return;
      }
      this._logService.info(`[Copilot:${sessionId}] Releasing idle session from memory (durable state preserved)`);
      await this._releaseSessionResources(sessionId);
    }));
  }
  async _abortSession(chat) {
    try {
      const context = this._getChatContext(chat);
      if (context.isPeerChat) {
        await context.target?.abort();
        return;
      }
      await this._queueSession(context.sessionId, async () => {
        await this._getChatContext(chat).target?.abort();
      });
    } catch (error) {
      if (!isCopilotConnectionClosedError(error)) {
        await this._recoverFromClosedConnection(error, "abort", this._clientFailureCorrelation(chat));
        throw error;
      }
      const correlation = this._clientFailureCorrelation(chat);
      this._getChatContext(chat).target?.discardActiveTurn();
      if (!await this._recoverFromClosedConnection(error, "abort", correlation)) {
        throw error;
      }
    }
  }
  async _createChat(chat, options) {
    if (isDefaultChatUri(chat)) {
      return;
    }
    const parsed = parseChatUri(chat);
    if (!parsed) {
      throw new Error(`[Copilot] createChat: malformed chat URI ${chat.toString()}`);
    }
    const session = URI.parse(parsed.session);
    const chatKey = chat.toString();
    if (this._sessions.get(AgentSession.id(session))?.hasPeerChat(chatKey)) {
      const existing = this._chatBackings.get(chatKey);
      return existing ? { providerData: encodeProviderData(existing), backingSession: AgentSession.uri(this.id, existing.sdkSessionId) } : void 0;
    }
    const sessionId = AgentSession.id(session);
    let result;
    const queue = (task) => options?.sideChat ? this._queueChat(sessionId, chatKey, task) : this._queueSession(sessionId, task);
    await queue(async () => {
      if (this._sessions.get(sessionId)?.hasPeerChat(chatKey)) {
        const existing = this._chatBackings.get(chatKey);
        result = existing ? { providerData: encodeProviderData(existing), backingSession: AgentSession.uri(this.id, existing.sdkSessionId) } : void 0;
        return;
      }
      const model = options?.model;
      const parentEntry = this._findAnySession(sessionId);
      const workingDirectory = parentEntry?.workingDirectory ?? this._provisionalSessions.get(sessionId)?.workingDirectory;
      const client = await this._ensureClient();
      const chatSdkId = generateUuid();
      const activeClient = this._getOrCreateActiveClient(session, workingDirectory);
      const snapshot = await activeClient.snapshot();
      const shellManager = this._instantiationService.createInstance(ShellManager, chat, workingDirectory);
      let launchPlan;
      let sdkSessionId;
      let sideChat;
      if (options?.fork) {
        if (!workingDirectory) {
          throw new Error(`[Copilot] createChat fork: missing working directory for session ${session.toString()}`);
        }
        const sourceEntry = await this._resolveChatEntry(session, options.fork.source);
        if (!sourceEntry) {
          throw new Error(`[Copilot] createChat fork: source chat ${options.fork.source.toString()} not found`);
        }
        const forked = await this._forkSdkChat(client, sourceEntry, options.fork.turnId, this._sessionDataService.getSessionDataDir(chat));
        sdkSessionId = forked.sessionId;
        launchPlan = {
          kind: "resume",
          client,
          sessionId: sdkSessionId,
          workingDirectory,
          resolvedAgentName: void 0,
          snapshot,
          activeClientToolSet: activeClient.toolSet,
          shellManager,
          githubToken: this._githubToken,
          fallback: { model, longContextWindow: this._longContextWindowFor(model?.id), freeLongContext: this._isFreeLongContext(model?.id) }
        };
      } else if (options?.sideChat) {
        if (!workingDirectory) {
          throw new Error(`[Copilot] createChat side chat: missing working directory for session ${session.toString()}`);
        }
        const sourceEntry = await this._resolveChatEntry(session, options.sideChat.source);
        if (!sourceEntry) {
          throw new Error(`[Copilot] createChat side chat: source chat ${options.sideChat.source.toString()} not found`);
        }
        const forked = await this._forkSdkChat(client, sourceEntry, options.sideChat.providerAnchorTurnId ?? options.sideChat.turnId, this._sessionDataService.getSessionDataDir(chat));
        sdkSessionId = forked.sessionId;
        sideChat = {
          source: options.sideChat.source.toString(),
          turnId: options.sideChat.turnId,
          ...options.sideChat.selection ? { selection: options.sideChat.selection } : {},
          ...options.sideChat.providerAnchorTurnId ? { providerAnchorTurnId: options.sideChat.providerAnchorTurnId } : {},
          inheritedTurnCount: forked.inheritedTurnCount,
          ...options.sideChat.sourceContext ? { context: options.sideChat.sourceContext } : {},
          ...options.sideChat.partialResponse ? { partialResponse: options.sideChat.partialResponse } : {}
        };
        launchPlan = {
          kind: "resume",
          client,
          sessionId: sdkSessionId,
          workingDirectory,
          resolvedAgentName: void 0,
          snapshot,
          activeClientToolSet: activeClient.toolSet,
          shellManager,
          githubToken: this._githubToken,
          fallback: { model, longContextWindow: this._longContextWindowFor(model?.id), freeLongContext: this._isFreeLongContext(model?.id) }
        };
      } else {
        sdkSessionId = chatSdkId;
        launchPlan = {
          kind: "create",
          client,
          sessionId: chatSdkId,
          workingDirectory,
          resolvedAgentName: void 0,
          snapshot,
          activeClientToolSet: activeClient.toolSet,
          shellManager,
          githubToken: this._githubToken,
          model,
          longContextWindow: this._longContextWindowFor(model?.id),
          freeLongContext: this._isFreeLongContext(model?.id)
        };
      }
      let agentSession;
      try {
        agentSession = this._createAgentSession(launchPlan, workingDirectory, activeClient, { sessionUri: session, chatChannelUri: chat });
        await agentSession.initializeSession();
        if (sideChat) {
          sideChat = { ...sideChat, inheritedTurnCount: (await agentSession.getMessages()).length };
        }
        if (options?.fork?.turnIdMapping) {
          await agentSession.remapTurnIds(options.fork.turnIdMapping);
        }
        this._throwIfClientReplaced(client, agentSession);
        this._ensureEntry(sessionId).registerPeerChat(chatKey, new CopilotSessionEntry(agentSession));
        this._sdkSessionsById.set(agentSession.sessionId, agentSession);
        const backing = { sdkSessionId, ...model ? { model } : {}, ...sideChat ? { sideChat } : {} };
        this._chatBackings.set(chatKey, backing);
        result = { providerData: encodeProviderData(backing), backingSession: AgentSession.uri(this.id, sdkSessionId) };
        this._logService.info(`[Copilot] Created additional chat ${chatKey} in session ${session.toString()}${options?.fork ? " (forked)" : ""}`);
      } catch (error) {
        agentSession?.dispose();
        throw error;
      }
    });
    return result;
  }
  /**
   * Resolves the {@link CopilotAgentSession} backing a chat URI — the
   * session's default chat (keyed by session id) or an additional peer chat
   * (keyed by the chat URI) — resuming it from disk if necessary.
   */
  async _resolveChatEntry(session, chatUri) {
    const sessionId = AgentSession.id(session);
    if (isDefaultChatUri(chatUri) || isEqual(chatUri, session)) {
      return this._findAnySession(sessionId) ?? await this._resumeSession(sessionId).catch(() => void 0);
    }
    return this._ensureChatSession(session, chatUri);
  }
  /**
   * Forks {@link sourceEntry}'s SDK chat at {@link turnId} via the
   * SDK `sessions.fork` RPC and copies its database into {@link targetDbDir}
   * so the forked chat inherits turn event IDs and file-edit
   * snapshots. Returns the new SDK session id.
   */
  async _forkSdkChat(client, sourceEntry, turnId, targetDbDir) {
    const sourceTurns = await sourceEntry.getMessages();
    const sourceTurnIndex = sourceTurns.findIndex((turn) => turn.id === turnId);
    const inheritedTurnCount = sourceTurnIndex === -1 ? sourceTurns.length : sourceTurnIndex + 1;
    const toEventId = await sourceEntry.getNextTurnEventId(turnId);
    const forkResult = await client.rpc.sessions.fork({
      sessionId: sourceEntry.sessionId,
      ...toEventId ? { toEventId } : {}
    });
    const newSessionId = forkResult.sessionId;
    const targetDbPath = URI.joinPath(targetDbDir, SESSION_DB_FILENAME);
    try {
      const sourceDbRef = await this._sessionDataService.tryOpenDatabase(sourceEntry.sessionUri);
      if (sourceDbRef) {
        try {
          await fs.mkdir(targetDbDir.fsPath, { recursive: true });
          await fs.rm(targetDbPath.fsPath, { force: true });
          await sourceDbRef.object.vacuumInto(targetDbPath.fsPath);
        } finally {
          sourceDbRef.dispose();
        }
      }
    } catch (err) {
      this._logService.warn(`[Copilot] Failed to copy session database for chat fork: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { sessionId: newSessionId, inheritedTurnCount };
  }
  async _disposeChat(session, chat) {
    if (isDefaultChatUri(chat)) {
      return;
    }
    const chatKey = chat.toString();
    let sdkSessionId = this._findPeerChat(session, chat)?.sessionId ?? this._chatBackings.get(chatKey)?.sdkSessionId;
    if (!sdkSessionId) {
      const parsed = parseChatUri(chat);
      if (parsed) {
        const persisted = await this._readPersistedChats(session);
        sdkSessionId = persisted.get(parsed.chatId)?.sdkSessionId;
      }
    }
    this._chatBackings.delete(chatKey);
    if (sdkSessionId) {
      this._sdkSessionsById.delete(sdkSessionId);
    }
    this._sessions.get(AgentSession.id(session))?.disposePeerChat(chatKey);
    if (sdkSessionId) {
      try {
        const client = await this._ensureClient();
        await client.deleteSession(sdkSessionId);
      } catch (err) {
        this._logService.warn(`[Copilot] Failed to delete SDK session for chat ${chatKey}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  /**
   * Re-attaches the in-memory backing for a peer chat on session restore,
   * decoding the opaque `providerData` the orchestrator persisted at creation
   * (or the latest {@link onDidChangeChatData}). After this resolves
   * the chat's backing SDK chat can be resumed lazily via
   * {@link _ensureChatSession}. When `providerData` is `undefined` (a legacy
   * session persisted before the orchestrator owned the catalog) the agent
   * falls back to a one-time read of its own `copilot.chats` blob. Best-effort
   * — a corrupt/unknown blob is logged and dropped rather than thrown.
   */
  async materializeChat(chat, providerData) {
    if (isDefaultChatUri(chat)) {
      return;
    }
    const chatInfo = parseChatUri(chat);
    if (!chatInfo) {
      return;
    }
    const chatKey = chat.toString();
    let backing;
    if (providerData !== void 0) {
      backing = decodeProviderData(providerData);
      if (!backing) {
        this._logService.warn(`[Copilot] materializeChat: dropping corrupt providerData for ${chatKey}`);
        return;
      }
    } else {
      const persisted = await this._readPersistedChats(URI.parse(chatInfo.session));
      backing = persisted.get(chatInfo.chatId);
      if (!backing) {
        return;
      }
    }
    this._chatBackings.set(chatKey, backing);
  }
  /**
   * Migration-only enumeration of the session's peer chats from the agent's
   * legacy `copilot.chats` catalog, mapping each entry to its channel URI and
   * the same opaque `providerData` blob {@link materializeChat}
   * decodes. The orchestrator calls this once to drain legacy chats into its
   * own catalog.
   */
  async listLegacyChats(session) {
    const persisted = await this._readPersistedChats(session);
    const result = [];
    for (const [chatId, info] of persisted) {
      result.push({ uri: URI.parse(buildChatUri(session, chatId)), providerData: encodeProviderData(info) });
    }
    return result;
  }
  /**
   * Resolves the live backing for a peer chat from the in-memory
   * {@link _chatBackings} map, falling back once to the agent's legacy
   * `copilot.chats` catalog (seeding the live map) for sessions that have not
   * been materialized via {@link materializeChat}.
   */
  async _resolveChatBacking(session, chat) {
    const chatKey = chat.toString();
    const live = this._chatBackings.get(chatKey);
    if (live) {
      return live;
    }
    const parsed = parseChatUri(chat);
    if (!parsed) {
      return void 0;
    }
    const persisted = await this._readPersistedChats(session);
    const info = persisted.get(parsed.chatId);
    if (info) {
      this._chatBackings.set(chatKey, info);
    }
    return info;
  }
  _getOrCreateSessionLifetime(sessionId) {
    if (this._isShuttingDown) {
      return void 0;
    }
    let lifetime = this._sessionLifetimes.get(sessionId);
    if (!lifetime) {
      lifetime = new CopilotSessionLifetime();
      this._sessionLifetimes.set(sessionId, lifetime);
    }
    return lifetime;
  }
  _resetSessionLifetime(sessionId) {
    if (!this._isShuttingDown && this._sessionLifetimes.get(sessionId)?.isPermanentlyClosed) {
      this._sessionLifetimes.set(sessionId, new CopilotSessionLifetime());
    }
  }
  _queueSession(sessionId, task) {
    const lifetime = this._getOrCreateSessionLifetime(sessionId);
    return lifetime ? lifetime.queueSession(task) : Promise.reject(new CancellationError());
  }
  _queueChat(sessionId, chatKey, task) {
    const lifetime = this._getOrCreateSessionLifetime(sessionId);
    return lifetime ? lifetime.queueChat(chatKey, task) : Promise.reject(new CancellationError());
  }
  /**
   * Returns the SDK-backed {@link CopilotAgentSession} for an additional peer
   * chat, resuming its backing SDK chat if it is not already in
   * memory (e.g. after a process restart). Returns `undefined` when the chat
   * has no known backing chat.
   */
  async _ensureChatSession(session, chat) {
    const chatKey = chat.toString();
    const existing = this._findPeerChat(session, chat);
    if (existing) {
      return existing;
    }
    const parsed = parseChatUri(chat);
    if (!parsed) {
      return void 0;
    }
    const lifetime = this._getOrCreateSessionLifetime(AgentSession.id(session));
    if (!lifetime) {
      return void 0;
    }
    return lifetime.resumePeer(chatKey, () => this._doEnsureChatSession(session, chat, lifetime));
  }
  async _doEnsureChatSession(session, chat, lifetime) {
    const chatKey = chat.toString();
    const sessionId = AgentSession.id(session);
    const lease = await lifetime.acquire();
    if (!lease) {
      return void 0;
    }
    let agentSession;
    try {
      const again = this._findPeerChat(session, chat);
      if (again) {
        return again;
      }
      const info = await this._resolveChatBacking(session, chat);
      if (!info) {
        return void 0;
      }
      const parentEntry = this._findAnySession(sessionId) ?? await this._resumeSession(sessionId).catch(() => void 0);
      const workingDirectory = parentEntry?.workingDirectory ?? this._provisionalSessions.get(sessionId)?.workingDirectory;
      if (!workingDirectory) {
        this._logService.warn(`[Copilot] Cannot resume chat ${chatKey}: missing working directory`);
        return void 0;
      }
      const client = await this._ensureClient();
      const activeClient = this._getOrCreateActiveClient(session, workingDirectory);
      const snapshot = await activeClient.snapshot();
      const shellManager = this._instantiationService.createInstance(ShellManager, chat, workingDirectory);
      const launchPlan = {
        kind: "resume",
        client,
        sessionId: info.sdkSessionId,
        workingDirectory,
        resolvedAgentName: void 0,
        snapshot,
        activeClientToolSet: activeClient.toolSet,
        shellManager,
        githubToken: this._githubToken,
        fallback: { model: info.model, longContextWindow: this._longContextWindowFor(info.model?.id), freeLongContext: this._isFreeLongContext(info.model?.id) }
      };
      agentSession = this._createAgentSession(launchPlan, workingDirectory, activeClient, { sessionUri: session, chatChannelUri: chat });
      await agentSession.initializeSession();
      this._throwIfClientReplaced(client, agentSession);
      this._ensureEntry(sessionId).registerPeerChat(chatKey, new CopilotSessionEntry(agentSession));
      this._sdkSessionsById.set(agentSession.sessionId, agentSession);
      this._logService.info(`[Copilot] Resumed additional chat ${chatKey} in session ${session.toString()}`);
      return agentSession;
    } catch (error) {
      agentSession?.dispose();
      this._logService.warn(`[Copilot] Failed to resume additional chat ${chatKey}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      lease.dispose();
    }
  }
  async truncateSession(session, turnId, chat) {
    const sessionId = AgentSession.id(session);
    if (this._provisionalSessions.has(sessionId)) {
      return;
    }
    const isPeerChat = !isDefaultChatUri(chat);
    await this._queueSession(sessionId, async () => {
      this._logService.info(`[Copilot:${sessionId}] Truncating ${isPeerChat ? `peer chat ${chat.toString()}` : "session"}${turnId !== void 0 ? ` at turnId=${turnId}` : " (all turns)"}`);
      const entry = isPeerChat ? await this._resolveChatEntry(session, chat) : this._findAnySession(sessionId) ?? await this._resumeSession(sessionId);
      if (!entry) {
        this._logService.info(`[Copilot:${sessionId}] No chat entry resolved for truncation; nothing to truncate`);
        return;
      }
      let eventId;
      if (turnId) {
        eventId = await entry.getNextTurnEventId(turnId);
      } else {
        eventId = await entry.getFirstTurnEventId();
      }
      if (eventId) {
        await entry.truncateAtEventId(eventId, turnId);
      } else {
        this._logService.info(`[Copilot:${sessionId}] No event ID found for truncation, nothing to truncate`);
      }
      this._logService.info(`[Copilot:${sessionId}] Session truncated`);
    });
  }
  async _changeModel(chat, model) {
    try {
      await this._changeModelOnce(chat, model);
    } catch (error) {
      if (!await this._recoverFromClosedConnection(error, "changeModel", this._clientFailureCorrelation(chat))) {
        throw error;
      }
      await this._changeModelOnce(chat, model);
    }
  }
  async _changeModelOnce(chat, model) {
    const longContextWindow = this._longContextWindowFor(model.id);
    const freeLongContext = this._isFreeLongContext(model.id);
    const context = this._getChatContext(chat);
    if (context.isPeerChat) {
      await context.target?.setModel(model.id, resolveCopilotReasoningEffort(model, this._configurationService, this._logService, context.sessionId), getCopilotContextTier(model, longContextWindow, freeLongContext));
      const backing = this._chatBackings.get(context.chatKey);
      if (backing) {
        const updated = { ...backing, model };
        this._chatBackings.set(context.chatKey, updated);
        this._onDidChangeChatData.fire({ chat, providerData: encodeProviderData(updated) });
      }
      return;
    }
    const provisional = this._provisionalSessions.get(context.sessionId);
    if (provisional) {
      provisional.model = model;
      return;
    }
    const entry = context.target;
    if (entry) {
      await entry.setModel(model.id, resolveCopilotReasoningEffort(model, this._configurationService, this._logService, context.sessionId), getCopilotContextTier(model, longContextWindow, freeLongContext));
    }
    await this._storeSessionMetadata(context.session, model, void 0, void 0, void 0, void 0);
  }
  async _changeAgent(chat, agent) {
    try {
      await this._changeAgentOnce(chat, agent);
    } catch (error) {
      if (!await this._recoverFromClosedConnection(error, "changeAgent", this._clientFailureCorrelation(chat))) {
        throw error;
      }
      await this._changeAgentOnce(chat, agent);
    }
  }
  async _changeAgentOnce(chat, agent) {
    const context = this._getChatContext(chat);
    if (context.isPeerChat) {
      if (context.target) {
        const resolvedAgentName = agent ? this._resolveAgentName(context.target.appliedSnapshot, agent) : void 0;
        await context.target.setAgent(resolvedAgentName);
      }
      return;
    }
    const provisional = this._provisionalSessions.get(context.sessionId);
    if (provisional) {
      provisional.agent = agent;
      return;
    }
    const entry = context.target;
    if (entry) {
      const resolvedAgentName = agent ? this._resolveAgentName(entry.appliedSnapshot, agent) : void 0;
      await entry.setAgent(resolvedAgentName);
    }
    await this._storeSessionAgentMetadata(context.session, agent);
  }
  async shutdown() {
    if (!this._shutdownPromise) {
      this._isShuttingDown = true;
      for (const lifetime of this._sessionLifetimes.values()) {
        void lifetime.close();
      }
      this._shutdownPromise = (async () => {
        this._modelCatalogGeneration++;
        this._modelRefreshSchedule.clear();
        this._scheduledModelRefresh?.deferred.complete();
        this._scheduledModelRefresh = void 0;
        this._modelRefreshRetry.clear();
        this._logService.info("[Copilot] Shutting down...");
        await Promise.all([...this._sessionLifetimes.values()].map((lifetime) => lifetime.close()));
        const sessionIds = /* @__PURE__ */ new Set([...this._sessions.keys()]);
        for (const sessionId of sessionIds) {
          const lifetime = this._sessionLifetimes.get(sessionId);
          if (lifetime) {
            await lifetime.queueSession(() => this._destroyAndDisposeSession(sessionId));
          } else {
            await this._destroyAndDisposeSession(sessionId);
          }
        }
        await this._stopClient();
        this._sessionLifetimes.clear();
      })();
    }
    return this._shutdownPromise;
  }
  respondToPermissionRequest(requestId, approved) {
    for (const entry of this._sessions.values()) {
      for (const chat of entry.allChatSessions()) {
        if (chat.respondToPermissionRequest(requestId, approved)) {
          return;
        }
      }
    }
  }
  respondToUserInputRequest(requestId, response, answers) {
    for (const entry of this._sessions.values()) {
      for (const chat of entry.allChatSessions()) {
        if (chat.respondToUserInputRequest(requestId, response, answers)) {
          return;
        }
      }
    }
  }
  /**
   * Returns true if this provider owns the given session ID. Includes
   * provisional sessions that have not yet been materialized.
   */
  hasSession(session) {
    const sessionId = AgentSession.id(session);
    return this._sessions.has(sessionId) || this._provisionalSessions.has(sessionId);
  }
  // ---- helpers ------------------------------------------------------------
  async _configureProxyEnv(env) {
    const proxy = await this._resolveProxyForSdk(env);
    this._appliedProxy = proxy;
    if (proxy) {
      for (const key of COPILOT_PROXY_SET_ENV_KEYS) {
        env[key] = proxy;
      }
      this._logService.info("[Copilot] Resolved CAPI proxy and forwarded HTTP_PROXY/HTTPS_PROXY to Copilot SDK");
    }
  }
  async _resolveProxyForSdk(env = process.env) {
    if (!this._isSystemProxyEnabled()) {
      return void 0;
    }
    if (COPILOT_PROXY_ENV_KEYS.some((key) => env[key])) {
      this._logService.debug("[Copilot] Proxy env var already set; leaving Copilot SDK proxy configuration to the environment");
      return void 0;
    }
    let capiUrl = env["VSCODE_AGENT_HOST_CAPI_URL_OVERRIDE"] || COPILOT_CAPI_URL;
    if (this._githubToken) {
      try {
        const discovered = await this._copilotApiService.resolveApiEndpoint(this._githubToken);
        if (discovered) {
          capiUrl = discovered;
        }
      } catch (error) {
        this._logService.debug(`[Copilot] CAPI endpoint discovery for proxy resolution failed; using ${capiUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    try {
      return await this._proxyResolver.resolveProxy(capiUrl);
    } catch (error) {
      this._logService.warn(`[Copilot] Failed to resolve CAPI proxy for ${capiUrl}: ${error instanceof Error ? error.message : String(error)}`);
      return void 0;
    }
  }
  /**
   * When the GitHub token changes, the token-discovered CAPI endpoint (and so
   * the resolved proxy) can change. The proxy is baked into the SDK subprocess
   * env at client start, so if it would now differ we restart the running
   * client here (deferred while a turn is in flight, see
   * {@link _requestClientRestart}); the next `_ensureClient` re-resolves it
   * against the new token. No-op when no client is running/starting or the
   * proxy is unchanged.
   */
  async _restartClientIfProxyChanged() {
    if (!this._client && !this._clientStarting) {
      return;
    }
    const oldProxy = this._appliedProxy;
    const newProxy = await this._resolveProxyForSdk();
    if (newProxy === oldProxy) {
      return;
    }
    if (this._clientStarting) {
      try {
        await this._clientStarting;
      } catch {
      }
    }
    await this._requestClientRestart(`CAPI proxy changed after token update (${oldProxy ?? "(none)"} -> ${newProxy ?? "(none)"})`);
  }
  /**
   * Disposes every peer chat hosted on the owning session's entry and drops
   * their live backings from {@link _chatBackings}. The chat URI encodes its
   * parent session, so we recover it via {@link parseChatUri}.
   */
  _disposeChildChats(sessionId) {
    const entry = this._sessions.get(sessionId);
    if (entry) {
      for (const chatKey of entry.peerChatKeys()) {
        entry.disposePeerChat(chatKey);
      }
    }
    for (const chatKey of [...this._chatBackings.keys()]) {
      const parsed = parseChatUri(URI.parse(chatKey));
      if (parsed && AgentSession.id(parsed.session) === sessionId) {
        this._chatBackings.delete(chatKey);
      }
    }
  }
  _getOrCreateActiveClient(session, directory) {
    let client = this._activeClients.get(session);
    if (!client) {
      const pluginController = this._plugins.createSessionController(session, directory);
      client = this._instantiationService.createInstance(ActiveClient, session, pluginController, this._onDidSessionProgress);
      this._activeClients.set(session, client);
    } else if (directory) {
      client.pluginController.setDirectory(directory);
    }
    return client;
  }
  /**
   * Instantiates a {@link CopilotAgentSession} for the given session id.
   * The caller is responsible for awaiting {@link CopilotAgentSession.initializeSession}
   * and, on success, registering the entry in {@link _sessions}. The
   * session is intentionally **not** registered here so a concurrent
   * {@link _resumeSession} for the same id cannot dispose this entry mid-init
   * via {@link DisposableMap.set}.
   */
  _createAgentSession(launchPlan, customizationDirectory, activeClient, identity) {
    const sessionUri = identity?.sessionUri ?? AgentSession.uri(this.id, launchPlan.sessionId);
    const chatChannelUri = identity?.chatChannelUri ?? URI.parse(buildDefaultChatUri(sessionUri));
    const agentSession = this._instantiationService.createInstance(
      CopilotAgentSession,
      {
        sessionUri,
        chatChannelUri,
        rawSessionId: launchPlan.sessionId,
        onDidSessionProgress: this._onDidSessionProgress,
        sessionLauncher: this._sessionLauncher,
        launchPlan,
        shellManager: launchPlan.shellManager,
        workingDirectory: launchPlan.workingDirectory,
        customizationDirectory,
        clientSnapshot: launchPlan.snapshot,
        activeClientToolSet: launchPlan.activeClientToolSet,
        resolveMcpChildId: (name) => findMcpChildId(activeClient.pluginController.getCustomizations(), name),
        serverToolHost: this._serverToolHost,
        isLaunchTokenCurrent: () => this._githubToken === launchPlan.githubToken,
        onTurnEnded: () => this._onChatTurnEnded()
      }
    );
    this._mcpNotificationSubs.set(launchPlan.sessionId, combinedDisposable(
      agentSession.onMcpNotification((n) => this._onMcpNotification.fire(n)),
      autorun((r) => activeClient.pluginController.mcpServerStates.set(agentSession.mcpServerStates.read(r), void 0))
    ));
    return agentSession;
  }
  /** Rejects a session initialized by a client that was stopped or replaced during launch. */
  _throwIfClientReplaced(client, agentSession) {
    if (this._shutdownPromise || this._client !== client) {
      this._mcpNotificationSubs.deleteAndDispose(agentSession.sessionId);
      agentSession.dispose();
      throw new CancellationError();
    }
  }
  _registerInitializedSession(sessionId, agentSession, client) {
    this._throwIfClientReplaced(client, agentSession);
    const defaultChatKey = buildDefaultChatUri(agentSession.sessionUri.toString());
    let entry = this._sessions.get(sessionId);
    if (!entry) {
      entry = new CopilotSessionEntry();
      this._sessions.set(sessionId, entry);
    }
    entry.setDefaultChat(defaultChatKey, new CopilotSessionEntry(agentSession));
    this._sdkSessionsById.set(agentSession.sessionId, agentSession);
  }
  async _destroyAndDisposeSession(sessionId) {
    await this._releaseSessionResources(sessionId);
  }
  /**
   * Tears down a session's in-memory resources without deleting any durable
   * data: the SDK session is disconnected, peer chats and MCP subscriptions
   * are disposed, the `_sessions` entry is dropped, and active clients are
   * released. The on-disk SDK session log, session database, and worktree are
   * left untouched, so the session can be resumed later via
   * {@link _resumeSession}. Shared by the non-destructive {@link releaseSession}
   * path and the destructive {@link _destroyAndDisposeSession} path (the
   * latter reaps the worktree afterwards).
   */
  async _releaseSessionResources(sessionId) {
    for (const chat of this._sessions.get(sessionId)?.allChatSessions() ?? []) {
      this._sdkSessionsById.delete(chat.sessionId);
    }
    this._disposeChildChats(sessionId);
    const provisional = this._provisionalSessions.get(sessionId);
    if (provisional) {
      this._provisionalSessions.delete(sessionId);
      this._sessions.deleteAndDispose(sessionId);
      this._activeClients.get(provisional.sessionUri)?.dispose();
      this._activeClients.delete(provisional.sessionUri);
      return;
    }
    const entry = this._findAnySession(sessionId);
    const sessionUri = AgentSession.uri(this.id, sessionId);
    if (entry) {
      try {
        await entry.destroySession();
      } catch (error) {
        this._logService.warn(`[Copilot:${sessionId}] Failed to destroy session before cleanup: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this._sessions.deleteAndDispose(sessionId);
    this._mcpNotificationSubs.deleteAndDispose(sessionId);
    this._activeClients.get(sessionUri)?.dispose();
    this._activeClients.delete(sessionUri);
    await this._applyPendingClientRestart();
  }
  _resumeSession(sessionId, workingDirectories) {
    const lifetime = this._getOrCreateSessionLifetime(sessionId);
    if (!lifetime) {
      return Promise.reject(new CancellationError());
    }
    return lifetime.resumeDefault(async () => {
      const lease = await lifetime.acquire();
      if (!lease) {
        throw new CancellationError();
      }
      try {
        return await this._doResumeSession(sessionId, workingDirectories);
      } finally {
        lease.dispose();
      }
    });
  }
  async _doResumeSession(sessionId, workingDirectories) {
    this._logService.info(`[Copilot:${sessionId}] _resumeSession called \u2014 session not in memory, resuming...`);
    const client = await this._ensureClient();
    const sessionUri = AgentSession.uri(this.id, sessionId);
    const storedMetadata = await this._readSessionMetadata(sessionUri);
    const sessionMetadata = await client.getSessionMetadata(sessionId).catch((err) => {
      this._logService.warn(`[Copilot:${sessionId}] getSessionMetadata failed`, err);
      return void 0;
    });
    const workingDirectory = storedMetadata.workingDirectory ?? (typeof sessionMetadata?.context?.workingDirectory === "string" ? URI.file(sessionMetadata.context.workingDirectory) : void 0);
    if (!workingDirectory) {
      throw new Error(`workingDirectory is required to resume Copilot session '${sessionId}'`);
    }
    let resolvedWorkingDirectory = workingDirectory;
    if (storedMetadata.workspaceless) {
      await this._ensureWorkspacelessScratchDir(workingDirectory, sessionId);
    } else {
      resolvedWorkingDirectory = await this._configurationService.resolveWorkingDirectoryForResume(sessionUri.toString(), workingDirectory);
    }
    const customizationDirectory = resolvedWorkingDirectory;
    const activeClient = this._getOrCreateActiveClient(sessionUri, customizationDirectory);
    activeClient.pluginController.reanchor(customizationDirectory);
    const launchWorkingDirectories = workingDirectories ?? storedMetadata.workingDirectories;
    activeClient.pluginController.setAdditionalDirectories(this._additionalCustomizationDirectories(launchWorkingDirectories));
    const snapshot = await activeClient.snapshot();
    const shellManager = this._instantiationService.createInstance(ShellManager, sessionUri, resolvedWorkingDirectory);
    const resolvedAgentName = storedMetadata.agent ? this._resolveAgentName(snapshot, storedMetadata.agent) : void 0;
    if (storedMetadata.agent && !resolvedAgentName) {
      this._logService.info(`[Copilot:${sessionId}] Stored custom agent is not available in the current plugin snapshot; resuming without a custom agent`);
    }
    const launchPlan = {
      kind: "resume",
      client,
      sessionId,
      workingDirectory: resolvedWorkingDirectory,
      additionalDirectories: this._additionalCustomizationDirectories(launchWorkingDirectories),
      resolvedAgentName,
      snapshot,
      activeClientToolSet: activeClient.toolSet,
      shellManager,
      githubToken: this._githubToken,
      workspaceless: storedMetadata.workspaceless,
      fallback: {
        model: storedMetadata.model,
        longContextWindow: this._longContextWindowFor(storedMetadata.model?.id),
        freeLongContext: this._isFreeLongContext(storedMetadata.model?.id)
      }
    };
    const agentSession = this._createAgentSession(launchPlan, customizationDirectory, activeClient);
    try {
      await agentSession.initializeSession();
      await this._storeSessionMetadata(sessionUri, void 0, void 0, launchWorkingDirectories, void 0, void 0);
      this._registerInitializedSession(sessionId, agentSession, launchPlan.client);
    } catch (err) {
      agentSession.dispose();
      throw err;
    }
    return agentSession;
  }
  static {
    // ---- session metadata persistence --------------------------------------
    this._META_MODEL = "copilot.model";
  }
  static {
    this._META_AGENT = "copilot.agent";
  }
  static {
    this._META_CWD = "copilot.workingDirectory";
  }
  static {
    /** Persisted ordered working-directory set (JSON array of URI strings; index 0 = primary). */
    this._META_CWDS = "copilot.workingDirectories";
  }
  static {
    this._META_CUSTOMIZATION_DIRECTORY = "copilot.customizationDirectory";
  }
  static {
    this._META_PROJECT_RESOLVED = "copilot.project.resolved";
  }
  static {
    this._META_PROJECT_URI = "copilot.project.uri";
  }
  static {
    this._META_PROJECT_DISPLAY_NAME = "copilot.project.displayName";
  }
  static {
    /** Persisted catalog of additional (non-default) peer chats, keyed by chatId. */
    this._META_CHATS = "copilot.chats";
  }
  /**
   * Reads the agent's legacy peer-chat catalog (`copilot.chats`) for a
   * session. Each entry maps a chatId (the `ahp-chat` authority) to the SDK
   * chat that backs it (and its optional model override). The agent
   * no longer *writes* this catalog — the orchestrator owns the durable
   * peer-chat catalog via `providerData` — but the read is retained for one
   * release to drain sessions persisted before that migration (see
   * {@link getChats} and {@link materializeChat}).
   */
  async _readPersistedChats(session) {
    const ref = await this._sessionDataService.tryOpenDatabase(session);
    if (!ref) {
      return /* @__PURE__ */ new Map();
    }
    try {
      const raw = await ref.object.getMetadata(CopilotAgent._META_CHATS);
      if (!raw) {
        return /* @__PURE__ */ new Map();
      }
      const parsed = JSON.parse(raw);
      const result = /* @__PURE__ */ new Map();
      for (const [chatId, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object") {
          continue;
        }
        const { sdkSessionId, model } = value;
        if (typeof sdkSessionId !== "string" || !sdkSessionId) {
          continue;
        }
        result.set(chatId, { sdkSessionId, ...model ? { model } : {} });
      }
      return result;
    } catch (err) {
      this._logService.warn(`[Copilot] Failed to read persisted chats for ${session.toString()}: ${err instanceof Error ? err.message : String(err)}`);
      return /* @__PURE__ */ new Map();
    } finally {
      ref.dispose();
    }
  }
  async _storeSessionMetadata(session, model, workingDirectory, workingDirectories, customizationDirectory, project, projectResolved = project !== void 0, configValues, customTitle) {
    const dbRef = this._sessionDataService.openDatabase(session);
    const db = dbRef.object;
    try {
      const work = [];
      if (model) {
        work.push(db.setMetadata(CopilotAgent._META_MODEL, this._serializeModelSelection(model)));
      }
      if (workingDirectory) {
        work.push(db.setMetadata(CopilotAgent._META_CWD, workingDirectory.toString()));
      }
      if (workingDirectories) {
        work.push(db.setMetadata(CopilotAgent._META_CWDS, JSON.stringify(workingDirectories.map((d) => d.toString()))));
      }
      if (customizationDirectory) {
        work.push(db.setMetadata(CopilotAgent._META_CUSTOMIZATION_DIRECTORY, customizationDirectory.toString()));
      }
      if (projectResolved) {
        work.push(db.setMetadata(CopilotAgent._META_PROJECT_RESOLVED, "true"));
      }
      if (project) {
        work.push(db.setMetadata(CopilotAgent._META_PROJECT_URI, project.uri.toString()));
        work.push(db.setMetadata(CopilotAgent._META_PROJECT_DISPLAY_NAME, project.displayName));
      }
      if (configValues) {
        work.push(db.setMetadata("configValues", JSON.stringify(configValues)));
      }
      if (customTitle) {
        work.push(db.setMetadata("customTitle", customTitle));
      }
      await Promise.all(work);
    } finally {
      dbRef.dispose();
    }
  }
  /**
   * Parses the persisted ordered working-directory set. Prefers the JSON
   * `_META_CWDS` array when present and valid, otherwise falls back to the
   * single legacy `_META_CWD` value. A malformed blob (the metadata store is
   * client-influenced and may be corrupt) is ignored in favour of the legacy
   * fallback so it can never reject the caller.
   */
  _parseWorkingDirectories(rawSet, fallback) {
    if (rawSet) {
      try {
        const parsed = JSON.parse(rawSet);
        if (Array.isArray(parsed)) {
          const dirs = parsed.filter((d) => typeof d === "string" && d.length > 0).map((d) => URI.parse(d));
          if (dirs.length > 0) {
            return dirs;
          }
        }
      } catch {
      }
    }
    return fallback ? [fallback] : void 0;
  }
  async _readSessionMetadata(session) {
    const ref = await this._sessionDataService.tryOpenDatabase(session);
    if (!ref) {
      return {};
    }
    try {
      const [model, agent, cwd, cwds, customizationDirectory, workspaceless] = await Promise.all([
        ref.object.getMetadata(CopilotAgent._META_MODEL),
        ref.object.getMetadata(CopilotAgent._META_AGENT),
        ref.object.getMetadata(CopilotAgent._META_CWD),
        ref.object.getMetadata(CopilotAgent._META_CWDS),
        ref.object.getMetadata(CopilotAgent._META_CUSTOMIZATION_DIRECTORY),
        ref.object.getMetadata(AH_META_WORKSPACELESS_DB_KEY)
      ]);
      const workingDirectory = cwd ? URI.parse(cwd) : void 0;
      return {
        model: this._parseModelSelection(model),
        agent: this._parseAgentSelection(agent),
        workingDirectory,
        workingDirectories: this._parseWorkingDirectories(cwds, workingDirectory),
        customizationDirectory: customizationDirectory ? URI.parse(customizationDirectory) : void 0,
        workspaceless: workspaceless === "true"
      };
    } finally {
      ref.dispose();
    }
  }
  async _readStoredSessionMetadata(session) {
    const ref = await this._sessionDataService.tryOpenDatabase(session);
    if (!ref) {
      return void 0;
    }
    try {
      const [model, agent, cwd, cwds, customizationDirectory, resolved, uri, displayName, workspaceless] = await Promise.all([
        ref.object.getMetadata(CopilotAgent._META_MODEL),
        ref.object.getMetadata(CopilotAgent._META_AGENT),
        ref.object.getMetadata(CopilotAgent._META_CWD),
        ref.object.getMetadata(CopilotAgent._META_CWDS),
        ref.object.getMetadata(CopilotAgent._META_CUSTOMIZATION_DIRECTORY),
        ref.object.getMetadata(CopilotAgent._META_PROJECT_RESOLVED),
        ref.object.getMetadata(CopilotAgent._META_PROJECT_URI),
        ref.object.getMetadata(CopilotAgent._META_PROJECT_DISPLAY_NAME),
        ref.object.getMetadata(AH_META_WORKSPACELESS_DB_KEY)
      ]);
      const workingDirectory = cwd ? URI.parse(cwd) : void 0;
      const project = uri && displayName ? { uri: URI.parse(uri), displayName } : void 0;
      return {
        model: this._parseModelSelection(model),
        agent: this._parseAgentSelection(agent),
        workingDirectory,
        workingDirectories: this._parseWorkingDirectories(cwds, workingDirectory),
        customizationDirectory: customizationDirectory ? URI.parse(customizationDirectory) : void 0,
        project,
        resolved: resolved === "true" || project !== void 0,
        workspaceless: workspaceless === "true"
      };
    } finally {
      ref.dispose();
    }
  }
  /**
   * Persists (or clears) the selected custom agent for a session. Writing
   * `undefined` clears the stored selection by writing an empty string,
   * which later cold reads treat as "no custom agent" because
   * `_parseAgentSelection` short-circuits on falsy metadata values.
   */
  async _storeSessionAgentMetadata(session, agent) {
    const dbRef = this._sessionDataService.openDatabase(session);
    try {
      await dbRef.object.setMetadata(CopilotAgent._META_AGENT, agent ? this._serializeAgentSelection(agent) : "");
    } finally {
      dbRef.dispose();
    }
  }
  async _storeSessionProjectResolution(session, project) {
    await this._storeSessionMetadata(session, void 0, void 0, void 0, void 0, project, true);
  }
  _resolveSessionProject(context, limiter, projectByContext) {
    const key = this._projectContextKey(context);
    if (!key) {
      return Promise.resolve(void 0);
    }
    let project = projectByContext.get(key);
    if (!project) {
      project = limiter.queue(() => projectFromCopilotContext(context, this._gitService));
      projectByContext.set(key, project);
    }
    return project;
  }
  _projectContextKey(context) {
    if (context?.cwd) {
      return `cwd:${context.cwd}`;
    }
    if (context?.gitRoot) {
      return `gitRoot:${context.gitRoot}`;
    }
    if (context?.repository) {
      return `repository:${context.repository}`;
    }
    return void 0;
  }
  dispose() {
    for (const ac of this._activeClients.values()) {
      ac.dispose();
    }
    this._activeClients.clear();
    this.shutdown().catch((err) => {
      this._logService.warn("[Copilot] Shutdown failed during dispose", err);
    }).finally(() => super.dispose());
  }
};
CopilotAgent = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ISessionDataService),
  __decorateParam(3, IAgentHostGitService),
  __decorateParam(4, IAgentConfigurationService),
  __decorateParam(5, IAgentHostStateManager),
  __decorateParam(6, IAgentHostGitHubEndpointService),
  __decorateParam(7, IAgentHostOTelService),
  __decorateParam(8, IAgentHostCompletions),
  __decorateParam(9, IAgentHostCheckpointService),
  __decorateParam(10, IAgentHostReviewService),
  __decorateParam(11, INativeEnvironmentService),
  __decorateParam(12, IByokLmBridgeRegistry),
  __decorateParam(13, ITelemetryService),
  __decorateParam(14, ICopilotApiService),
  __decorateParam(15, IAgentHostProxyResolver)
], CopilotAgent);
const REFRESH_DEBOUNCE_MS = 100;
let SessionDiscoveredEntry = class extends Disposable {
  constructor(workingDirectories, userHome, _getClient, _onDidRefresh, _fileService, _configurationService, _logService, instantiationService) {
    super();
    this._getClient = _getClient;
    this._onDidRefresh = _onDidRefresh;
    this._fileService = _fileService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._refreshDelayer = this._register(new Delayer(REFRESH_DEBOUNCE_MS));
    this._refreshPromise = null;
    this._pendingRefreshNotify = false;
    this._customizations = [];
    this._discovery = this._register(instantiationService.createInstance(SessionCustomizationDiscovery, workingDirectories, userHome, URI.file));
    this._settled = this._queueRefresh(false, 0);
    this._register(this._discovery.onDidChange(() => {
      this._settled = this._queueRefresh(true);
    }));
    this._register(this._configurationService.onDidRootConfigChange(() => {
      this._settled = this._queueRefresh(true);
    }));
  }
  dispose() {
    this._refreshPromise?.cancel();
    this._refreshPromise = null;
    super.dispose();
  }
  whenSettled() {
    return this._settled;
  }
  currentCustomizations() {
    return this._customizations;
  }
  _queueRefresh(notify, delay = REFRESH_DEBOUNCE_MS) {
    this._refreshPromise?.cancel();
    this._refreshPromise = null;
    this._pendingRefreshNotify = this._pendingRefreshNotify || notify;
    return this._refreshDelayer.trigger(() => {
      const shouldNotify = this._pendingRefreshNotify;
      this._pendingRefreshNotify = false;
      const refreshPromise = this._refreshPromise = createCancelablePromise(async (token) => {
        const didRefresh = await this._refresh(token);
        if (didRefresh && shouldNotify) {
          this._onDidRefresh();
        }
      });
      return refreshPromise.then(() => {
        if (this._refreshPromise === refreshPromise) {
          this._refreshPromise = null;
        }
      }, (err) => {
        if (this._refreshPromise === refreshPromise) {
          this._refreshPromise = null;
        }
        if (err instanceof CancellationError) {
          return;
        }
        throw err;
      });
    }, delay).catch((err) => {
      if (err instanceof CancellationError) {
        return;
      }
      throw err;
    });
  }
  async _refresh(token) {
    try {
      const mode = this._configurationService.getRootValue(agentHostCustomizationConfigSchema, AgentHostConfigKey.SessionCustomizationDiscoveryMode) ?? DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE;
      if (mode === "discover") {
        const customizations2 = await this._discovery.discover(await this._getClient(), token);
        if (token.isCancellationRequested) {
          return false;
        }
        if (equals(this._customizations, customizations2)) {
          return false;
        }
        this._customizations = customizations2;
        this._directories = void 0;
        return true;
      }
      const directories = await this._discovery.scan(token);
      if (token.isCancellationRequested) {
        return false;
      }
      if (this._directories && areDiscoveredDirectoriesEqual(this._directories, directories)) {
        return false;
      }
      const customizations = await toDiscoveredDirectoryCustomizations(directories, this._fileService);
      if (token.isCancellationRequested) {
        return false;
      }
      this._customizations = customizations;
      this._directories = directories;
      return true;
    } catch (err) {
      if (token.isCancellationRequested) {
        return false;
      }
      this._logService.warn(`[Copilot:SessionDiscoveredEntry] Discovery/bundle failed: ${err instanceof Error ? err.message : String(err)}`);
      const hadState = this._customizations.length > 0 || this._directories !== void 0;
      this._customizations = [];
      this._directories = void 0;
      return hadState;
    }
  }
};
SessionDiscoveredEntry = __decorateClass([
  __decorateParam(4, IFileService),
  __decorateParam(5, IAgentConfigurationService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IInstantiationService)
], SessionDiscoveredEntry);
function toDiscoveredDirectoryCustomizations(directories, fileService) {
  return Promise.all(directories.map(async (directory) => {
    const protocolUri = directory.uri.toString();
    return {
      type: CustomizationType.Directory,
      id: customizationId(protocolUri),
      uri: protocolUri,
      name: directory.name,
      enabled: true,
      contents: toDirectoryContentsType(directory.type),
      writable: directory.writable,
      // whether the new customization can be created in this directory
      load: { kind: CustomizationLoadStatus.Loaded },
      children: await Promise.all(directory.files.map((file) => toDiscoveredChildCustomization(file.uri, directory.type, fileService)))
    };
  }));
}
function toDirectoryContentsType(type) {
  switch (type) {
    case DiscoveredType.Agent:
      return CustomizationType.Agent;
    case DiscoveredType.Skill:
      return CustomizationType.Skill;
    case DiscoveredType.Instruction:
    case DiscoveredType.AgentInstruction:
      return CustomizationType.Rule;
    case DiscoveredType.Hook:
      return CustomizationType.Hook;
  }
}
async function toDiscoveredChildCustomization(file, type, fileService) {
  const uri = file.toString();
  const id = customizationId(uri);
  if (type === DiscoveredType.Agent) {
    const agentInfo = await parseAgentFile(file, fileService);
    const agentCustomization = {
      type: CustomizationType.Agent,
      id,
      uri,
      name: agentInfo.name,
      description: agentInfo.description
    };
    if (agentInfo.userInvocable !== void 0) {
      agentCustomization._meta = { userInvocable: agentInfo.userInvocable };
    }
    return agentCustomization;
  }
  if (type === DiscoveredType.Skill) {
    const skillInfo = await parseSkillFile(file, fileService);
    const skillCustomization = {
      type: CustomizationType.Skill,
      id,
      uri,
      name: skillInfo.name,
      description: skillInfo.description
    };
    return skillCustomization;
  }
  if (type === DiscoveredType.Instruction) {
    const ruleInfo = await parseRuleFile(file, fileService);
    const ruleCustomization = {
      type: CustomizationType.Rule,
      id,
      uri,
      name: ruleInfo.name,
      description: ruleInfo.description,
      globs: ruleInfo.globs,
      alwaysApply: ruleInfo.alwaysApply
    };
    return ruleCustomization;
  }
  if (type === DiscoveredType.Hook) {
    const hookCustomization = {
      type: CustomizationType.Hook,
      id,
      uri,
      name: resourceBasename(file)
    };
    return hookCustomization;
  }
  return {
    type: CustomizationType.Rule,
    alwaysApply: true,
    id,
    uri,
    name: resourceBasename(file)
  };
}
function mapToParsedPlugin(customizations) {
  if (customizations.length === 0) {
    return void 0;
  }
  const agents = [];
  const skills = [];
  const instructions = [];
  for (const directory of customizations) {
    for (const child of directory.children ?? []) {
      if (child.type === CustomizationType.Agent) {
        agents.push({
          uri: URI.parse(child.uri),
          name: child.name,
          description: child.description,
          customization: child
        });
        continue;
      }
      if (child.type === CustomizationType.Skill) {
        skills.push({
          uri: URI.parse(child.uri),
          name: child.name,
          description: child.description,
          customization: child
        });
        continue;
      }
      if (child.type === CustomizationType.Rule) {
        if (child.alwaysApply && child.name.match(/\.md$/i)) {
          continue;
        }
        instructions.push({
          uri: URI.parse(child.uri),
          name: child.name,
          description: child.description,
          customization: child
        });
      }
    }
  }
  if (agents.length === 0 && skills.length === 0 && instructions.length === 0) {
    return void 0;
  }
  return {
    format: PluginFormat.Copilot,
    hooks: [],
    mcpServers: [],
    skills,
    agents,
    instructions
  };
}
let PluginController = class extends Disposable {
  constructor(_getClient, pluginManager, _logService, _fileService, _configurationService, _instantiationService, _environmentService) {
    super();
    this._getClient = _getClient;
    this.pluginManager = pluginManager;
    this._logService = _logService;
    this._fileService = _fileService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._environmentService = _environmentService;
    this._onDidChange = this._register(new Emitter());
    /** Fires when host customizations change. Session controllers forward this. */
    this.onDidChange = this._onDidChange.event;
    this._hostCustomizations = [];
    this._hostSync = Promise.resolve([]);
    this._hostRevision = 0;
    this._lastAppliedRefs = [];
    this._applyHostCustomizations();
    this._register(this._configurationService.onDidRootConfigChange(() => {
      this._applyHostCustomizations();
    }));
  }
  getConfiguredHostCustomizations() {
    return this._hostCustomizations.map((item) => item.customization);
  }
  get configurationService() {
    return this._configurationService;
  }
  /**
   * Snapshot the resolved host customizations (loading or loaded). Used by
   * {@link SessionPluginController} to compose its per-session view.
   */
  hostCustomizations() {
    return this._hostCustomizations;
  }
  /** In-flight host sync; awaited by `getCustomizationsSettled` consumers. */
  hostSync() {
    return this._hostSync;
  }
  getUserHome() {
    return this._environmentService.userHome;
  }
  async getClient() {
    return this._getClient();
  }
  /**
   * Construct a per-session controller bound to the given customization
   * directory. The returned controller is a {@link Disposable} owned by
   * the caller; disposing it releases the session's disk-discovery
   * watchers and detaches from this controller's change event.
   */
  createSessionController(session, directory) {
    return this._instantiationService.createInstance(SessionPluginController, this, session, directory);
  }
  /**
   * Reads the current host customizations from the root config and
   * resolves them. Skips the update when the configured refs have not
   * changed since the last application.
   */
  _applyHostCustomizations() {
    const entries = this._configurationService.getRootValue(agentHostCustomizationConfigSchema, AgentHostConfigKey.Customizations) ?? [];
    const customizations = entries.map(toContainerCustomization);
    if (equals(customizations, this._lastAppliedRefs)) {
      return;
    }
    this._lastAppliedRefs = customizations;
    const revision = ++this._hostRevision;
    this._hostCustomizations = customizations.map((customization) => ({
      customization: {
        ...customization,
        load: { kind: CustomizationLoadStatus.Loading }
      }
    }));
    this._onDidChange.fire();
    this._hostSync = Promise.all(customizations.map((customization) => this.resolveConfiguredCustomization(customization))).then((resolved) => {
      if (revision === this._hostRevision) {
        this._hostCustomizations = resolved;
      }
      return resolved;
    }).finally(() => {
      if (revision === this._hostRevision) {
        this._onDidChange.fire();
      }
    });
  }
  async resolveConfiguredCustomization(customization) {
    const pluginDir = URI.parse(customization.uri);
    const parsed = await this.tryParsePlugin(pluginDir);
    if (!parsed) {
      return {
        customization: {
          ...customization,
          load: { kind: CustomizationLoadStatus.Error, message: localize("copilotAgent.pluginParseError", "Error parsing plugin.") }
        }
      };
    }
    return {
      customization: {
        ...customization,
        load: { kind: CustomizationLoadStatus.Loaded },
        children: toChildCustomizations([parsed])
      },
      pluginDir,
      plugin: parsed
    };
  }
  async resolveSyncedCustomization(item, clientId, input) {
    const baseCustomization = { ...item.customization, clientId };
    if (!item.pluginDir) {
      return { customization: baseCustomization, input };
    }
    const parsed = await this.tryParsePlugin(item.pluginDir);
    if (!parsed) {
      return {
        customization: {
          ...baseCustomization,
          load: { kind: CustomizationLoadStatus.Error, message: localize("copilotAgent.pluginParseError", "Error parsing plugin.") }
        },
        input
      };
    }
    return {
      customization: {
        ...baseCustomization,
        children: toChildCustomizations([parsed])
      },
      pluginDir: item.pluginDir,
      plugin: parsed,
      input
    };
  }
  async tryParsePlugin(pluginDir) {
    try {
      return await parsePlugin(pluginDir, this._fileService, void 0, this.getUserHome(), pluginDir);
    } catch (error) {
      this._logService.warn(`[Copilot:PluginController] Error parsing plugin '${pluginDir.toString()}': ${error instanceof Error ? error.message : String(error)}`);
      return void 0;
    }
  }
};
PluginController = __decorateClass([
  __decorateParam(1, IAgentPluginManager),
  __decorateParam(2, ILogService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IAgentConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, INativeEnvironmentService)
], PluginController);
let SessionPluginController = class extends Disposable {
  constructor(_parent, _session, _directory, _stateManager, _logService, _instantiationService) {
    super();
    this._parent = _parent;
    this._session = _session;
    this._directory = _directory;
    this._stateManager = _stateManager;
    this._logService = _logService;
    this._instantiationService = _instantiationService;
    this._onDidPublish = this._register(new Emitter());
    /** Per-session action stream (reset + per-item updates). */
    this.onDidPublish = this._onDidPublish.event;
    this._previousDirectories = [];
    this._desiredCustomizationById = /* @__PURE__ */ new Map();
    /**
     * Live runtime state (`state`/`channel`) per MCP server customization id,
     * kept up to date by the owning session from its MCP controller. Overlaid
     * onto published customizations by {@link _overlayMcpState} so a re-sync
     * preserves the live state of otherwise-unchanged MCP servers instead of
     * resetting them to the `Stopped` default baked into
     * `makeMcpServerCustomization`. Exposed (not injected) so the session can
     * write to it once it holds this controller.
     */
    this.mcpServerStates = observableValue(this, /* @__PURE__ */ new Map());
    /**
     * Per-client customization state, keyed by `clientId`. Each active client
     * contributing customizations to this session has one entry; the published
     * customization list is the union across all entries (deduplicated by URI,
     * first-inserted client wins). Insertion order is preserved so the merged
     * order stays stable across updates.
     */
    this._clients = /* @__PURE__ */ new Map();
    this._sessionDiscovered = this._register(new MutableDisposable());
    /**
     * The additional (non-primary) workspace roots for a multi-root session.
     * Index 0 (the process root / worktree) is tracked separately by
     * {@link _directory}; this holds roots 1..N, which are stable workspace
     * folders that are never worktree-remapped. Empty for single-root sessions.
     */
    this._additionalDirectories = [];
  }
  get directory() {
    return this._directory;
  }
  /** The additional (non-primary) roots attached to customization discovery. */
  get additionalDirectories() {
    return this._additionalDirectories;
  }
  /**
   * Anchor (or re-anchor) the session's customization directory.
   * Only ever transitions from `undefined` → set; once a directory has
   * been bound the discovered entry is pinned to it for the remainder
   * of the session.
   */
  setDirectory(directory) {
    if (this._directory || !directory) {
      return;
    }
    this._directory = directory;
  }
  /**
   * Set the additional (non-primary) workspace roots. Recreates the discovered
   * entry when the set actually changes so discovery re-scans every root —
   * important when this is set after a primary-only entry was already created
   * (e.g. on resume). A no-op for the single-root case (empty tail).
   */
  setAdditionalDirectories(directories) {
    if (this._additionalDirectories.length === directories.length && this._additionalDirectories.every((d, i) => isEqual(d, directories[i]))) {
      return;
    }
    this._additionalDirectories = directories;
    this._sessionDiscovered.clear();
  }
  /**
   * Move the session's customization anchor to a new directory (e.g. from the
   * user-picked folder to the worktree at materialization). Recreates the
   * discovered entry so discovery/watchers re-scan the new directory.
   */
  reanchor(directory) {
    if (this._directory && isEqual(this._directory, directory)) {
      return;
    }
    const previous = this._directory;
    this._directory = directory;
    this._sessionDiscovered.clear();
    if (previous && !this._previousDirectories.some((candidate) => isEqual(candidate, previous))) {
      this._previousDirectories.push(previous);
    }
  }
  getCustomizations() {
    const result = [
      ...this._parent.hostCustomizations().map((item) => this._projectForPublish(item.customization)),
      ...this._flattenClientCustomizations().map((item) => this._projectForPublish(item.customization))
    ];
    const entry = this._discoveredEntry();
    const discovered = entry?.currentCustomizations() ?? [];
    for (const customization of discovered) {
      result.push(this._projectForPublish(customization));
    }
    return result;
  }
  /**
   * The union of every active client's resolved customizations,
   * deduplicated by URI with the first-inserted client winning. Order
   * follows client insertion order, then per-client order.
   */
  _flattenClientCustomizations() {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const client of this._clients.values()) {
      for (const item of client.customizations) {
        if (seen.has(item.customization.uri)) {
          continue;
        }
        seen.add(item.customization.uri);
        result.push(item);
      }
    }
    return result;
  }
  /**
   * Settled variant of {@link getCustomizations}: awaits the in-flight
   * host sync, every in-flight client sync, and the discovered entry's
   * initial scan + parse before snapshotting the list. Callers that
   * publish customizations into session state at session creation time
   * MUST use this — the synchronous variant can return an empty list
   * for a brand-new working directory because {@link SessionDiscoveredEntry}
   * kicks off its `_refresh()` without anyone awaiting it.
   */
  async getCustomizationsSettled() {
    const entry = this._discoveredEntry();
    await Promise.all([
      this._parent.hostSync().catch((err) => this._logService.warn("[Copilot:SessionPluginController] Host customization update failed", err)),
      ...[...this._clients.values()].map((client) => client.sync.catch((err) => this._logService.warn("[Copilot:SessionPluginController] Client customization sync failed", err))),
      entry?.whenSettled()
    ]);
    return this.getCustomizations();
  }
  /** Returns the parsed plugins currently enabled for this session, awaiting any pending sync. */
  async getAppliedPlugins() {
    const entry = this._discoveredEntry();
    const [host] = await Promise.all([
      this._parent.hostSync().catch((err) => {
        this._logService.warn("[Copilot:SessionPluginController] Host customization update failed", err);
        return this._parent.hostCustomizations();
      }),
      ...[...this._clients.values()].map((client) => client.sync.catch((err) => {
        this._logService.warn("[Copilot:SessionPluginController] Client customization sync failed", err);
        return client.customizations;
      })),
      entry?.whenSettled()
    ]);
    const discovered = entry?.currentCustomizations() ?? [];
    const sessionPlugin = discovered.some((customization) => this._isEnabled(customization)) ? mapToParsedPlugin(discovered) : void 0;
    const sessionPlugins = sessionPlugin ? [sessionPlugin] : [];
    return [
      ...host.filter((item) => !!item.plugin && this._isEnabled(item.customization)).map((item) => ({ ...item.plugin, pluginDir: item.pluginDir })),
      ...this._flattenClientCustomizations().filter((item) => !!item.plugin && this._isEnabled(item.customization)).map((item) => ({ ...item.plugin, pluginDir: item.pluginDir })),
      ...sessionPlugins
    ];
  }
  /**
   * Sync the published customizations for a single client of this session,
   * keyed by `clientId`. Replaces only that client's slice; other clients'
   * customizations are untouched. The published session-state list is the
   * union across all clients.
   *
   * @param quiet when `true`, suppress {@link onDidPublish} events for
   *   this sync. Used during eager-create paths where there is no
   *   session listener yet; the session-state snapshot picks up the
   *   final view directly when the session materializes.
   */
  sync(clientId, customizations, options) {
    const quiet = options?.quiet === true;
    let client = this._clients.get(clientId);
    if (!client) {
      client = { revision: 0, customizations: [], sync: Promise.resolve([]), inputs: [] };
      this._clients.set(clientId, client);
    } else if (equals(client.inputs, customizations)) {
      return client.sync.then((results) => results.map((item) => ({
        customization: this._projectForPublish(item.customization),
        ...item.pluginDir ? { pluginDir: item.pluginDir } : {}
      })));
    }
    const revision = ++client.revision;
    client.inputs = customizations;
    client.customizations = customizations.map((customization) => ({
      customization: {
        ...customization,
        clientId,
        load: { kind: CustomizationLoadStatus.Loading }
      },
      input: customization
    }));
    if (!quiet) {
      this._onDidPublish.fire({
        type: ActionType.SessionCustomizationsChanged,
        customizations: [...this.getCustomizations()]
      });
    }
    const published = /* @__PURE__ */ new Map();
    for (const customization of client.customizations) {
      const enabled = this._projectForPublish(customization.customization);
      published.set(enabled.uri, enabled);
    }
    const publishUpdate = (item) => {
      const customization = this._projectForPublish(item.customization);
      if (equals(published.get(customization.uri), customization)) {
        return;
      }
      published.set(customization.uri, customization);
      if (!quiet) {
        this._onDidPublish.fire({
          type: ActionType.SessionCustomizationUpdated,
          customization
        });
      }
    };
    const prev = client.sync;
    const promise = client.sync = prev.catch((err) => {
      this._logService.warn("[Copilot:SessionPluginController] Previous customization sync failed", err);
    }).then(async () => {
      const inputByUri = new Map(customizations.map((c) => [c.uri, c]));
      const result = await this._parent.pluginManager.syncCustomizations(clientId, customizations, (status) => {
        if (revision !== client.revision) {
          return;
        }
        publishUpdate({
          customization: { ...status, clientId },
          input: inputByUri.get(status.uri)
        });
      });
      const resolved = await Promise.all(result.map((item) => this._parent.resolveSyncedCustomization(item, clientId, inputByUri.get(item.customization.uri))));
      if (revision === client.revision) {
        client.customizations = resolved;
        for (const item of resolved) {
          publishUpdate(item);
        }
      }
      return resolved;
    });
    return promise.then((results) => results.map((item) => ({
      customization: this._overlayMcpState(this._applyEnablement(item.customization)),
      ...item.pluginDir ? { pluginDir: item.pluginDir } : {}
    })));
  }
  /**
   * Remove a client's customization contribution from this session,
   * publishing the updated (union) customization list so the removed
   * client's plugins disappear from session state.
   */
  removeClient(clientId) {
    const client = this._clients.get(clientId);
    if (!client) {
      return;
    }
    client.revision++;
    this._clients.delete(clientId);
    this._onDidPublish.fire({
      type: ActionType.SessionCustomizationsChanged,
      customizations: [...this.getCustomizations()]
    });
  }
  /** The raw input customizations last synced for `clientId` (empty when absent). */
  clientInputs(clientId) {
    return this._clients.get(clientId)?.inputs ?? [];
  }
  /**
   * Re-issue each client's last sync if any of its previously-synced
   * customizations is currently in an error state. Used to recover from
   * transient sync failures (e.g. a `vscode-agent-host://` connection drop
   * during reconnection) at message boundaries. Re-syncs **only** the
   * errored items and always non-quiet so listeners observe recovery.
   */
  async retryFailedClientSyncIfNeeded() {
    await Promise.all([...this._clients.values()].map((client) => client.sync.catch(() => {
    })));
    for (const [clientId, client] of [...this._clients]) {
      const errored = client.customizations.filter(
        (item) => item.customization.load?.kind === CustomizationLoadStatus.Error && item.input !== void 0
      );
      if (errored.length === 0) {
        continue;
      }
      const inputs = errored.map((item) => item.input);
      this._logService.info(`[Copilot:SessionPluginController] Retrying ${inputs.length} previously-failed client customization(s) for ${clientId}`);
      await this.sync(clientId, inputs).catch((err) => {
        this._logService.warn("[Copilot:SessionPluginController] Retried client customization sync failed", err);
      });
    }
  }
  _discoveredEntry() {
    if (!this._directory) {
      return void 0;
    }
    if (!this._sessionDiscovered.value) {
      this._sessionDiscovered.value = this._instantiationService.createInstance(
        SessionDiscoveredEntry,
        [this._directory, ...this._additionalDirectories],
        this._parent.getUserHome(),
        () => this._parent.getClient(),
        () => this._onDidPublish.fire({
          type: ActionType.SessionCustomizationsChanged,
          customizations: [...this.getCustomizations()]
        })
      );
    }
    return this._sessionDiscovered.value;
  }
  _isEnabled(customization) {
    return this._desiredEnabled(customization) ?? customization.enabled !== false;
  }
  _applyEnablement(customization) {
    const enabled = this._isEnabled(customization);
    if (customization.type === CustomizationType.McpServer) {
      return customization.enabled === enabled ? customization : { ...customization, enabled };
    }
    let changed = customization.enabled !== enabled;
    const children = customization.children?.map((child) => {
      const desiredEnabled = this._desiredEnabled(child);
      if (desiredEnabled === void 0 || desiredEnabled === child.enabled) {
        return child;
      }
      changed = true;
      return { ...child, enabled: desiredEnabled };
    });
    return changed ? { ...customization, enabled, children } : customization;
  }
  _desiredEnabled(customization) {
    const exact = this._getDesiredCustomization(customization.id);
    if (exact) {
      return exact.enabled;
    }
    if (!this._directory) {
      return void 0;
    }
    for (const previousDirectory of this._previousDirectories) {
      const previousUri = rebaseUnder(URI.parse(customization.uri), this._directory, previousDirectory);
      if (!previousUri) {
        continue;
      }
      const previousId = customizationId(previousUri.toString(), customization.range);
      const previous = this._getDesiredCustomization(previousId);
      if (previous) {
        return previous.enabled;
      }
    }
    return void 0;
  }
  _getDesiredCustomization(id) {
    const customizations = this._stateManager.getSessionState(this._session.toString())?.customizations;
    if (customizations !== this._indexedDesiredCustomizations) {
      this._indexedDesiredCustomizations = customizations;
      this._desiredCustomizationById.clear();
      for (const customization of customizations ?? []) {
        this._desiredCustomizationById.set(customization.id, customization);
        if (customization.type !== CustomizationType.McpServer) {
          for (const child of customization.children ?? []) {
            this._desiredCustomizationById.set(child.id, child);
          }
        }
      }
    }
    return this._desiredCustomizationById.get(id);
  }
  /**
   * Projects a raw customization into its published form: applies reducer-backed
   * per-session enablement, then overlays the latest
   * known MCP runtime `state`/`channel` (see {@link mcpServerStates}).
   * Every publish path runs customizations through this so enablement and
   * live MCP state stay consistent. Object identity is preserved when
   * neither step changes anything, keeping downstream equality checks
   * stable.
   */
  _projectForPublish(customization) {
    return this._overlayMcpState(this._applyEnablement(customization));
  }
  /**
   * Overlays the latest known MCP runtime `state`/`channel` (see
   * {@link mcpServerStates}) onto a customization and its children,
   * preserving object identity when nothing is overlaid so downstream
   * equality checks stay stable.
   */
  _overlayMcpState(customization) {
    const overlays = this.mcpServerStates.get();
    if (overlays.size === 0) {
      return customization;
    }
    if (customization.type === CustomizationType.McpServer) {
      const overlay = overlays.get(customization.id);
      return overlay ? { ...customization, state: overlay.state, channel: overlay.channel } : customization;
    }
    const children = customization.children;
    if (!children || children.length === 0) {
      return customization;
    }
    let changed = false;
    const overlaidChildren = children.map((child) => {
      if (child.type !== CustomizationType.McpServer) {
        return child;
      }
      const overlay = overlays.get(child.id);
      if (!overlay) {
        return child;
      }
      changed = true;
      return { ...child, state: overlay.state, channel: overlay.channel };
    });
    return changed ? { ...customization, children: overlaidChildren } : customization;
  }
};
SessionPluginController = __decorateClass([
  __decorateParam(3, IAgentHostStateManager),
  __decorateParam(4, ILogService),
  __decorateParam(5, IInstantiationService)
], SessionPluginController);
class CopilotActiveClientHandle {
  constructor(_owner, clientId, displayName) {
    this._owner = _owner;
    this.clientId = clientId;
    this.displayName = displayName;
  }
  get tools() {
    return this._owner.toolSet.get(this.clientId);
  }
  set tools(tools) {
    this._owner.toolSet.set(this.clientId, tools);
  }
  get customizations() {
    return this._owner.pluginController.clientInputs(this.clientId);
  }
  set customizations(customizations) {
    this._owner.pluginController.sync(this.clientId, [...customizations]).catch(() => {
    });
  }
}
let ActiveClient = class extends Disposable {
  constructor(_sessionUri, pluginController, onDidSessionProgress, _configurationService) {
    super();
    this._sessionUri = _sessionUri;
    this._configurationService = _configurationService;
    /**
     * Live, multi-client registry of contributed tools. Shared by reference
     * with the session's {@link CopilotAgentSession} so a window reload (new
     * `clientId`, identical tools) is reflected at tool-call stamp time without
     * restarting the SDK session, and so tool calls are attributed to the
     * contributing client.
     */
    this.toolSet = new ActiveClientToolSet();
    this._handles = /* @__PURE__ */ new Map();
    this.pluginController = this._register(pluginController);
    this._register(this.pluginController.onDidPublish((action) => {
      onDidSessionProgress.fire({ kind: "action", resource: this._sessionUri, action });
    }));
  }
  /** Get (or lazily create) the stable handle for `clientId`. */
  getOrCreateHandle(clientId, displayName) {
    let handle = this._handles.get(clientId);
    if (!handle) {
      handle = new CopilotActiveClientHandle(this, clientId, displayName);
      this._handles.set(clientId, handle);
    }
    return handle;
  }
  /** Drop a client's tool and customization contributions from this session. */
  removeClient(clientId) {
    this._handles.delete(clientId);
    this.toolSet.delete(clientId);
    this.pluginController.removeClient(clientId);
  }
  async snapshot() {
    return {
      tools: this.toolSet.merged(),
      plugins: await this.pluginController.getAppliedPlugins(),
      mcpServers: this._getMcpServers()
    };
  }
  _getMcpServers() {
    const servers = this._configurationService.getRootValue(platformRootSchema, AgentHostMcpServersConfigKey) ?? {};
    return structuredClone(servers);
  }
  /**
   * Returns `true` when the SDK session must be disposed and resumed to
   * pick up a changed config. Compares ONLY plugins and the structural
   * (merged) tool set (name + description + inputSchema). The owning
   * `clientId`s are deliberately excluded — a clientId-only change is
   * reflected live via {@link toolSet} and never requires a restart.
   */
  async requiresRestart(snap) {
    const plugins = await this.pluginController.getAppliedPlugins();
    if (!parsedPluginsEqual(snap.plugins, plugins)) {
      return true;
    }
    if (!equals(snap.mcpServers, this._getMcpServers())) {
      return true;
    }
    return !this.toolSet.structuralEquals(snap.tools);
  }
};
ActiveClient = __decorateClass([
  __decorateParam(3, IAgentConfigurationService)
], ActiveClient);
export {
  COPILOT_AGENT_HOST_SYSTEM_MESSAGE,
  CopilotAgent,
  CopilotSessionEntry,
  REFRESH_DEBOUNCE_MS,
  mapToParsedPlugin,
  rebaseUnder,
  resolveCopilotOtlpMetricsEndpoint,
  toDiscoveredDirectoryCustomizations
};
