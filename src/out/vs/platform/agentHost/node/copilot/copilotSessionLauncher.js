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
import { coalesce } from "../../../../base/common/arrays.js";
import { Schemas } from "../../../../base/common/network.js";
import { IFileService } from "../../../files/common/files.js";
import { ILogService, LogLevel } from "../../../log/common/log.js";
import { CopilotCliConfigKey, applyModelFamilyAlias, copilotCliConfigSchema, normalizeToolSearchDeferThreshold } from "../../common/copilotCliConfig.js";
import { agentHostModelSupportsToolSearch, CLIENT_TOOL_SEARCH_REFERENCE_NAME } from "./toolSearchDeferral.js";
import { AgentHostSessionSyncEnabledConfigKey, platformRootSchema } from "../../common/agentHostSchema.js";
import { AgentSession } from "../../common/agentService.js";
import { IAgentHostOTelService } from "../../common/otel/agentHostOTelService.js";
import { AgentHostSandboxConfigKey, sandboxConfigSchema } from "../../common/sandboxConfigSchema.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { IAgentHostTerminalManager } from "../agentHostTerminalManager.js";
import { IByokLmBridgeRegistry } from "../byokLmBridgeRegistry.js";
import { IByokLmProxyService } from "./byokLmProxyService.js";
import { getByokLmSelectionModelId } from "../../common/agentHostByokLm.js";
import { CopilotSessionWrapper } from "./copilotSessionWrapper.js";
import { createShellTools } from "./copilotShellTools.js";
import { toSdkHooks, toSdkInstructionDirectories, toSdkMcpServers, toSdkMcpServersFromConfigMap, toSdkSessionCustomAgents, toSdkSkillDirectories } from "./copilotPluginConverters.js";
import { buildSandboxConfigForSdk } from "./sandboxConfigForSdk.js";
import { agentHostPromptRegistry } from "./prompts/promptRegistry.js";
import { describeSystemMessageConfig } from "./prompts/systemMessage.js";
import "./prompts/allPrompts.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { reasoningEffortLevels } from "../../common/reasoningEffort.js";
import { isGpt56Model } from "./modelIdentifiers.js";
const ThinkingLevelConfigKey = "thinkingLevel";
const ContextSizeConfigKey = "contextSize";
const ContextTierConfigKey = "contextTier";
const ReasoningEfforts = reasoningEffortLevels;
function toSdkReasoningEffort(effort) {
  return effort;
}
const ContextTiers = ["default", "long_context"];
const AGENT_HOST_COPILOT_CLIENT_NAME = "vscode-agent-host";
function clientToolNamesFromSnapshot(snapshot) {
  return new Set(snapshot.tools.map((tool) => tool.name));
}
function isCopilotReasoningEffort(value) {
  return ReasoningEfforts.some((reasoningEffort) => reasoningEffort === value);
}
function isContextTier(value) {
  return ContextTiers.some((contextTier) => contextTier === value);
}
function getCopilotSdkErrorCode(err) {
  if (typeof err !== "object" || err === null) {
    return void 0;
  }
  const code = Object.getOwnPropertyDescriptor(err, "code")?.value;
  return typeof code === "number" ? code : void 0;
}
function getErrorMessage(err) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null) {
    const message = Object.getOwnPropertyDescriptor(err, "message")?.value;
    if (typeof message === "string") {
      return message;
    }
  }
  return String(err);
}
const RESUMABLE_HISTORY_ABSENT_PATTERNS = [
  /\bSession not found\b/i,
  /\bno events\b/i,
  /\bempty session\b/i
];
function shouldCreateEmptySessionAfterResumeError(err) {
  if (getCopilotSdkErrorCode(err) !== -32603) {
    return false;
  }
  const message = getErrorMessage(err);
  return RESUMABLE_HISTORY_ABSENT_PATTERNS.some((pattern) => pattern.test(message));
}
function isCustomAgentNotFoundError(err) {
  return getCopilotSdkErrorCode(err) === -32603 && /\bCustom agent '.+' not found\b/i.test(getErrorMessage(err));
}
function getCopilotReasoningEffort(model, effortOverride) {
  if (isCopilotReasoningEffort(effortOverride)) {
    return toSdkReasoningEffort(effortOverride);
  }
  const thinkingLevel = model?.config?.[ThinkingLevelConfigKey];
  return isCopilotReasoningEffort(thinkingLevel) ? toSdkReasoningEffort(thinkingLevel) : void 0;
}
function resolveCopilotReasoningEffort(model, configurationService, logService, sessionId) {
  const rawOverride = configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.ReasoningEffortOverride);
  const override = rawOverride ? rawOverride : void 0;
  if (override !== void 0) {
    if (isCopilotReasoningEffort(override)) {
      logService.info(`[Copilot:${sessionId}] Applying reasoning-effort override '${override}'`);
    } else {
      logService.warn(`[Copilot:${sessionId}] Ignoring invalid reasoning-effort override '${override}'; expected one of [${ReasoningEfforts.join(", ")}]`);
    }
  }
  return getCopilotReasoningEffort(model, override);
}
function getCopilotContextTier(model, longContextWindow, freeLongContext) {
  const legacyTier = model?.config?.[ContextTierConfigKey];
  if (isContextTier(legacyTier)) {
    return legacyTier;
  }
  const contextSize = model?.config?.[ContextSizeConfigKey];
  if (contextSize === void 0) {
    return freeLongContext ? "long_context" : void 0;
  }
  const selectedWindow = Number(contextSize);
  if (!Number.isFinite(selectedWindow) || typeof longContextWindow !== "number") {
    return void 0;
  }
  return selectedWindow >= longContextWindow ? "long_context" : "default";
}
async function resolveByokSessionConfig(sessionId, bridgeRegistry, startProxy, logService) {
  let byokModels;
  try {
    byokModels = [...bridgeRegistry.getModels()];
  } catch (err) {
    logService.warn(`[Copilot:${sessionId}] Failed to enumerate BYOK models from renderer bridges`, err);
    return {};
  }
  if (byokModels.length === 0) {
    return {};
  }
  const seenSelectionIds = /* @__PURE__ */ new Set();
  byokModels = byokModels.filter((m) => {
    const selectionId = `${m.vendor}/${getByokLmSelectionModelId(m)}`;
    if (seenSelectionIds.has(selectionId)) {
      return false;
    }
    seenSelectionIds.add(selectionId);
    return true;
  });
  let handle;
  try {
    handle = await startProxy();
  } catch (err) {
    logService.warn(`[Copilot:${sessionId}] Failed to start BYOK loopback proxy`, err);
    return {};
  }
  const providers = [...new Set(byokModels.map((m) => m.vendor))].map((vendor) => ({
    name: vendor,
    type: "openai",
    wireApi: "responses",
    baseUrl: handle.providerBaseUrl(vendor),
    bearerToken: `${handle.nonce}.${sessionId}`
  }));
  const models = byokModels.map((m) => ({
    id: getByokLmSelectionModelId(m),
    provider: m.vendor,
    ...m.name !== void 0 ? { name: m.name } : {},
    ...m.maxContextWindowTokens !== void 0 ? { maxContextWindowTokens: m.maxContextWindowTokens } : {}
  }));
  logService.info(`[Copilot:${sessionId}] Wired ${models.length} BYOK model(s) across ${providers.length} provider(s) via loopback proxy ${handle.baseUrl}`);
  return { providers, models };
}
let CopilotSessionLauncher = class {
  constructor(_configurationService, _terminalManager, _logService, _fileService, _byokLmProxyService, _byokLmBridgeRegistry, _otelService) {
    this._configurationService = _configurationService;
    this._terminalManager = _terminalManager;
    this._logService = _logService;
    this._fileService = _fileService;
    this._byokLmProxyService = _byokLmProxyService;
    this._byokLmBridgeRegistry = _byokLmBridgeRegistry;
    this._otelService = _otelService;
  }
  async launch(plan, runtime) {
    const config = await this._buildSessionConfig(plan, runtime);
    const sandboxConfig = this._computeSandboxConfig();
    if (plan.kind === "create") {
      return this._createSession(plan, config, sandboxConfig);
    }
    let fallbackPlan = plan;
    let fallbackConfig = config;
    try {
      const stopWatch = new StopWatch();
      this._logService.trace(`[Copilot:${plan.sessionId}] Calling SDK resumeSession...`);
      const raw = await this._withTraceContext(plan.sessionId, () => plan.client.resumeSession(plan.sessionId, config));
      this._logService.trace(`[Copilot:${plan.sessionId}] SDK resumeSession succeeded after ${stopWatch.elapsed()}ms`);
      await this._applySandboxConfig(raw, sandboxConfig, plan.sessionId);
      return new CopilotSessionWrapper(raw);
    } catch (err) {
      let resumeError = err;
      const errCode = getCopilotSdkErrorCode(resumeError);
      const errMsg = getErrorMessage(resumeError);
      this._logService.warn(`[Copilot:${plan.sessionId}] SDK resumeSession failed: code=${errCode}, message=${errMsg}`);
      if (plan.resolvedAgentName && isCustomAgentNotFoundError(resumeError)) {
        fallbackPlan = { ...plan, resolvedAgentName: void 0 };
        fallbackConfig = { ...config, agent: void 0 };
        this._logService.warn(`[Copilot:${plan.sessionId}] Stored custom agent '${plan.resolvedAgentName}' was not found; retrying resume without a custom agent`);
        try {
          const raw = await this._withTraceContext(fallbackPlan.sessionId, () => fallbackPlan.client.resumeSession(fallbackPlan.sessionId, fallbackConfig));
          await this._applySandboxConfig(raw, sandboxConfig, plan.sessionId);
          return new CopilotSessionWrapper(raw);
        } catch (retryErr) {
          resumeError = retryErr;
          this._logService.warn(`[Copilot:${plan.sessionId}] SDK resumeSession without custom agent failed: code=${getCopilotSdkErrorCode(retryErr)}, message=${getErrorMessage(retryErr)}`);
        }
      }
      if (!shouldCreateEmptySessionAfterResumeError(resumeError)) {
        this._logService.warn(`[Copilot:${plan.sessionId}] Resume failure does not indicate an empty session; surfacing it instead of replacing the session with an empty one`);
        throw resumeError;
      }
      this._logService.warn(`[Copilot:${plan.sessionId}] Resume reported no session history; falling back to createSession with same ID`);
      const wrapper = await this._createSession({
        ...fallbackPlan,
        kind: "create",
        model: fallbackPlan.fallback.model,
        longContextWindow: fallbackPlan.fallback.longContextWindow,
        freeLongContext: fallbackPlan.fallback.freeLongContext
      }, fallbackConfig, sandboxConfig);
      this._logService.info(`[Copilot:${plan.sessionId}] Fallback createSession succeeded`);
      return wrapper;
    }
  }
  _withTraceContext(sessionId, fn) {
    const sessionUri = AgentSession.uri("copilotcli", sessionId).toString();
    return this._otelService.withTraceContext(this._otelService.getSessionTraceContext(sessionId, sessionUri), fn);
  }
  async _createSession(plan, config, sandboxConfig) {
    const raw = await this._withTraceContext(plan.sessionId, () => plan.client.createSession({
      ...config,
      sessionId: plan.sessionId,
      streaming: true,
      model: plan.model?.id,
      reasoningEffort: resolveCopilotReasoningEffort(plan.model, this._configurationService, this._logService, plan.sessionId),
      contextTier: getCopilotContextTier(plan.model, plan.longContextWindow, plan.freeLongContext),
      ...plan.resolvedAgentName ? { agent: plan.resolvedAgentName } : {},
      workingDirectory: plan.workingDirectory?.fsPath
    }));
    await this._applySandboxConfig(raw, sandboxConfig, plan.sessionId);
    if (isGpt56Model(plan.model?.id)) {
      await this._applyVerbosity(raw, "medium", plan.sessionId);
    }
    return new CopilotSessionWrapper(raw);
  }
  /** Sets output verbosity after session creation. */
  async _applyVerbosity(session, verbosity, sessionId) {
    try {
      await session.rpc.options.update({ verbosity });
      this._logService.info(`[Copilot:${sessionId}] Applied '${verbosity}' verbosity`);
    } catch (err) {
      this._logService.warn(`[Copilot:${sessionId}] Failed to apply '${verbosity}' verbosity`, err);
    }
  }
  /**
   * Compute the SDK-shaped sandbox policy to push to the runtime for the
   * SDK's built-in shell tool.
   *
   * Returns `undefined` when {@link CopilotCliConfigKey.EnableCustomTerminalTool}
   * is ON — in that case the AgentHost provides its own shell tools, which
   * wrap commands via the host terminal sandbox engine, so no SDK-side
   * sandbox policy is needed. Otherwise the policy is derived from the
   * host's `sandbox` config bag (forwarded from the workbench's
   * `chat.agent.sandbox.*` settings), mirroring what
   * `buildSandboxConfigForCLI` does for the Copilot extension's CLI path.
   */
  _computeSandboxConfig() {
    const enableCustomTerminalTool = this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.EnableCustomTerminalTool) === true;
    if (enableCustomTerminalTool) {
      return void 0;
    }
    return buildSandboxConfigForSdk(process.platform, this._configurationService.getRootValue(sandboxConfigSchema, AgentHostSandboxConfigKey.Sandbox));
  }
  /**
   * Forward the SDK-shaped sandbox policy to the runtime via
   * `session.options.update`, immediately after the session is created or
   * resumed.
   *
   * No-op when {@link _computeSandboxConfig} returned `undefined` (custom
   * terminal tool enabled, or the host sandbox config evaluates to disabled).
   */
  async _applySandboxConfig(session, sandboxConfig, sessionId) {
    if (!sandboxConfig) {
      return;
    }
    try {
      await session.rpc.options.update({ sandboxConfig });
      this._logService.info(`[Copilot:${sessionId}] Applied SDK sandboxConfig via session.options.update`);
    } catch (err) {
      this._logService.warn(`[Copilot:${sessionId}] Failed to apply SDK sandboxConfig`, err);
    }
  }
  /**
   * Launcher-bound wrapper over {@link resolveByokSessionConfig}: supplies the
   * active bridge registry and a `startProxy` thunk that memoizes the single
   * shared proxy handle for this launcher (started lazily on first use).
   */
  _resolveByokSessionConfig(sessionId) {
    return resolveByokSessionConfig(sessionId, this._byokLmBridgeRegistry, () => {
      if (!this._byokProxyHandle) {
        this._byokProxyHandle = this._byokLmProxyService.start();
      }
      return this._byokProxyHandle;
    }, this._logService);
  }
  /**
   * Release the memoized BYOK loopback proxy handle (if any) and clear it so
   * the next session launch mints a fresh nonce. Idempotent.
   *
   * **Ownership invariant.** The caller MUST stop the Copilot client/runtime
   * subprocess before invoking this: disposing the handle drops the proxy's
   * refcount and may rebind it on a different port/nonce, so a still-running
   * subprocess would silently lose its endpoint — see {@link IByokLmProxyHandle}.
   * Invoked from `CopilotAgent._stopClient` / `CopilotAgent.shutdown` after the
   * client has stopped.
   */
  async disposeByokProxyHandle() {
    const handle = this._byokProxyHandle;
    this._byokProxyHandle = void 0;
    if (!handle) {
      return;
    }
    try {
      (await handle).dispose();
    } catch {
    }
  }
  async _buildSessionConfig(plan, runtime) {
    const plugins = plan.snapshot.plugins;
    const byok = await this._resolveByokSessionConfig(plan.sessionId);
    const enableCustomTerminalTool = this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.EnableCustomTerminalTool) === true;
    let shellTools = [];
    if (enableCustomTerminalTool) {
      if (!plan.shellManager) {
        throw new Error(`ShellManager is required to launch Copilot session '${plan.sessionId}'`);
      }
      shellTools = await createShellTools(plan.shellManager, this._terminalManager, this._logService, (request) => runtime.requestUnsandboxedCommandConfirmation(request));
    }
    const pluginsWithoutDirs = plugins.filter((p) => !p.pluginDir || p.pluginDir.scheme !== Schemas.file);
    const customAgents = await toSdkSessionCustomAgents(plugins, plan.resolvedAgentName, this._fileService);
    const skillDirectories = toSdkSkillDirectories(pluginsWithoutDirs.flatMap((p) => p.skills));
    const instructionDirectories = toSdkInstructionDirectories(plugins.flatMap((p) => p.instructions));
    const model = plan.kind === "create" ? plan.model : plan.fallback.model;
    const clientToolNames = clientToolNamesFromSnapshot(plan.snapshot);
    const effectiveModel = applyModelFamilyAlias(model, this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.ModelCapabilityOverrides));
    if (model && effectiveModel !== model) {
      this._logService.info(`[Copilot:${plan.sessionId}] Model capability override: routing prompt for '${model.id}' as family '${effectiveModel?.id}'`);
    }
    const toolSearchActive = this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.ToolSearchEnabled) === true && agentHostModelSupportsToolSearch(effectiveModel?.id) && clientToolNames.has(CLIENT_TOOL_SEARCH_REFERENCE_NAME);
    const toolSearchDeferThreshold = normalizeToolSearchDeferThreshold(this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.ToolSearchDeferThreshold));
    const promptContext = {
      getSetting: (key) => this._configurationService.getRootValue(copilotCliConfigSchema, key),
      hasClientTool: (name) => clientToolNames.has(name),
      workspaceless: plan.workspaceless === true,
      toolSearchActive
    };
    const additionalDirectories = plan.additionalDirectories?.map((d) => d.fsPath);
    const systemMessage = agentHostPromptRegistry.resolveSystemMessageConfig(effectiveModel, promptContext);
    this._logService.info(`[Copilot:${plan.sessionId}] Resolved system message: ${describeSystemMessageConfig(systemMessage)}`);
    if (this._logService.getLevel() <= LogLevel.Trace) {
      this._logService.trace(`[Copilot:${plan.sessionId}] System message config: ${JSON.stringify(systemMessage, (_key, value) => typeof value === "function" ? "[transform fn]" : value)}`);
    }
    return {
      ...byok,
      clientName: AGENT_HOST_COPILOT_CLIENT_NAME,
      enableMcpApps: true,
      githubMcpToolConfig: { disableFormDeferral: true },
      enableFileHooks: true,
      enableConfigDiscovery: true,
      requestExtensions: false,
      // force-disable copilot extension management tools (otherwise enabled in experimental mode)
      onPermissionRequest: (request) => runtime.handlePermissionRequest(request),
      onUserInputRequest: (request, invocation) => runtime.handleUserInputRequest(request, invocation),
      onElicitationRequest: (context) => runtime.handleElicitationRequest(context),
      onMcpAuthRequest: (request, context) => runtime.handleMcpAuthRequest(request, context),
      hooks: toSdkHooks(pluginsWithoutDirs.flatMap((p) => p.hooks), {
        onPreToolUse: (input) => runtime.handlePreToolUse(input),
        onPostToolUse: (input) => runtime.handlePostToolUse(input)
      }),
      mcpServers: { ...toSdkMcpServersFromConfigMap(plan.snapshot.mcpServers), ...toSdkMcpServers(pluginsWithoutDirs.flatMap((p) => p.mcpServers)) },
      onExitPlanModeRequest: (request, invocation) => runtime.handleExitPlanModeRequest(request, invocation),
      workingDirectory: plan.workingDirectory?.fsPath,
      customAgents,
      agent: plan.resolvedAgentName,
      skillDirectories,
      instructionDirectories,
      additionalDirectories,
      systemMessage,
      toolSearch: toolSearchActive ? { enabled: true, deferThreshold: toolSearchDeferThreshold } : { enabled: false },
      largeOutput: {
        maxSizeBytes: 8 * 1024
      },
      pluginDirectories: coalesce(plugins.map((p) => p.pluginDir)).filter((d) => d.scheme === Schemas.file).map((d) => d.fsPath),
      tools: [...shellTools, ...runtime.createClientSdkTools(), ...runtime.createServerSdkTools()],
      // Pass the GitHub token at the session level. The SDK's
      // client-level `gitHubToken` authenticates the CLI process,
      // but each session also needs its own token resolved into a
      // GitHub identity (login, Copilot plan, endpoints) to drive
      // model routing and quota — without this the session
      // errors with "Session was not created with authentication
      // info or custom provider" on first send. See #318693.
      gitHubToken: plan.githubToken,
      // Enable infinite sessions so the SDK provisions a workspace
      // directory (containing `plan.md`, `checkpoints/`, `files/`).
      // The workspace is required for plan mode to work — without
      // it, `rpc.plan.read()` returns `path: null` and the SDK
      // never emits `exit_plan_mode.requested`.
      infiniteSessions: { enabled: true },
      // Per-session remote export: the client-level `--remote` flag
      // (enableRemoteSessions) enables the CLI capability, but each
      // session must opt in via `remoteSession` to actually export
      // events. Without this, sessions default to "off".
      remoteSession: this._configurationService.getRootValue(platformRootSchema, AgentHostSessionSyncEnabledConfigKey) === true ? "export" : void 0,
      enableManagedSettings: true
    };
  }
};
CopilotSessionLauncher = __decorateClass([
  __decorateParam(0, IAgentConfigurationService),
  __decorateParam(1, IAgentHostTerminalManager),
  __decorateParam(2, ILogService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IByokLmProxyService),
  __decorateParam(5, IByokLmBridgeRegistry),
  __decorateParam(6, IAgentHostOTelService)
], CopilotSessionLauncher);
export {
  ContextSizeConfigKey,
  ContextTierConfigKey,
  CopilotSessionLauncher,
  ThinkingLevelConfigKey,
  clientToolNamesFromSnapshot,
  getCopilotContextTier,
  getCopilotReasoningEffort,
  isCopilotReasoningEffort,
  resolveByokSessionConfig,
  resolveCopilotReasoningEffort,
  toSdkReasoningEffort
};
