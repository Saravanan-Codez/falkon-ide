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
import * as fs from "fs";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { dirname } from "../../../base/common/path.js";
import { hasKey } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { AgentHostConfigKey, agentHostCustomizationConfigSchema, defaultAgentHostCustomizationConfigValues } from "../common/agentHostCustomizationConfig.js";
import { getAgentCustomizationSettingsEntries, getProviderBackedRootConfigKeys, withAgentCustomizationSettings } from "../common/agentCustomizationSettings.js";
import { copilotCliConfigSchema } from "../common/copilotCliConfig.js";
import { sandboxConfigSchema } from "../common/sandboxConfigSchema.js";
import { ProtocolError } from "../common/state/sessionProtocol.js";
import { ActionType } from "../common/state/sessionActions.js";
import { parseSubagentSessionUri, ROOT_STATE_URI } from "../common/state/sessionState.js";
import { AgentSession } from "../common/agentService.js";
const IAgentConfigurationService = createDecorator("agentConfigurationService");
let AgentConfigurationService = class extends Disposable {
  constructor(_stateManager, _logService, _rootConfigResource, providerConfigurations = []) {
    super();
    this._stateManager = _stateManager;
    this._logService = _logService;
    this._rootConfigResource = _rootConfigResource;
    this._rootConfigWrite = Promise.resolve();
    this._rootTransientValueKeys = /* @__PURE__ */ new Set();
    this._onDidRootConfigChange = this._register(new Emitter());
    this.onDidRootConfigChange = this._onDidRootConfigChange.event;
    this._onDidSessionConfigChange = this._register(new Emitter());
    this.onDidSessionConfigChange = this._onDidSessionConfigChange.event;
    const existing = this._stateManager.rootState.config;
    const ownSchema = agentHostCustomizationConfigSchema.toProtocol();
    const sandboxSchema = sandboxConfigSchema.toProtocol();
    const copilotCliSchema = copilotCliConfigSchema.toProtocol();
    this._stateManager.rootState.config = {
      schema: {
        type: "object",
        properties: { ...existing?.schema.properties, ...ownSchema.properties, ...sandboxSchema.properties, ...copilotCliSchema.properties }
      },
      values: { ...existing?.values, ...this._loadPersistedRootConfig() }
    };
    for (const registration of providerConfigurations) {
      this.registerProviderConfiguration(registration);
    }
    this._register(this._stateManager.onDidEmitEnvelope((envelope) => {
      if (envelope.action.type === ActionType.RootConfigChanged) {
        this._onDidRootConfigChange.fire();
      } else if (envelope.action.type === ActionType.SessionConfigChanged) {
        this._onDidSessionConfigChange.fire({
          session: envelope.channel,
          config: envelope.action.config
        });
      }
    }));
  }
  setWorktreeIsolation(worktree) {
    this._worktree = worktree;
  }
  getEffectiveValue(session, schema, key) {
    for (const values of this._effectiveChain(session)) {
      const raw = values[key];
      if (raw === void 0) {
        continue;
      }
      try {
        schema.assertValid(key, raw);
        return raw;
      } catch (err) {
        const reason = err instanceof ProtocolError ? err.message : String(err);
        this._logService.warn(`[AgentConfigurationService] Value for '${key}' on ${session} failed schema validation, falling back: ${reason}`);
      }
    }
    return void 0;
  }
  getEffectiveWorkingDirectory(session) {
    const own = this._stateManager.getSessionState(session)?.workingDirectories?.[0];
    if (own !== void 0) {
      return own;
    }
    const parentInfo = parseSubagentSessionUri(session);
    if (parentInfo) {
      return this._stateManager.getSessionState(parentInfo.parentSession.toString())?.workingDirectories?.[0];
    }
    return void 0;
  }
  getEffectiveWorkingDirectories(session) {
    const own = this._stateManager.getSessionState(session)?.workingDirectories;
    if (own !== void 0) {
      return own;
    }
    const parentInfo = parseSubagentSessionUri(session);
    if (parentInfo) {
      return this._stateManager.getSessionState(parentInfo.parentSession.toString())?.workingDirectories;
    }
    return void 0;
  }
  isWorkingDirectoryPending(session) {
    return this._worktree?.isWorkingDirectoryPending(AgentSession.id(session)) ?? false;
  }
  async resolveWorkingDirectoryForResume(session, workingDirectory) {
    return this._worktree?.resolveWorkingDirectoryForResume(URI.parse(session), AgentSession.id(session), workingDirectory) ?? workingDirectory;
  }
  updateSessionConfig(session, patch) {
    this._stateManager.dispatchServerAction(session, {
      type: ActionType.SessionConfigChanged,
      config: patch
    });
  }
  getSessionConfigValues(session) {
    return this._stateManager.getSessionState(session)?.config?.values;
  }
  getRootValue(schema, key) {
    const root = this._stateManager.rootState.config?.values;
    const raw = root?.[key];
    if (raw === void 0) {
      return void 0;
    }
    try {
      schema.assertValid(key, raw);
      return raw;
    } catch (err) {
      const reason = err instanceof ProtocolError ? err.message : String(err);
      this._logService.warn(`[AgentConfigurationService] Host value for '${key}' failed schema validation, ignoring: ${reason}`);
      return void 0;
    }
  }
  updateRootConfig(patch, replace = false) {
    this._stateManager.dispatchServerAction(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config: patch,
      replace
    });
    this.persistRootConfig();
  }
  persistRootConfig() {
    if (!this._rootConfigResource) {
      return;
    }
    const values = { ...this._stateManager.rootState.config?.values ?? { [AgentHostConfigKey.Customizations]: [] } };
    for (const key of this._rootTransientValueKeys) {
      delete values[key];
    }
    for (const key of getProviderBackedRootConfigKeys(this._stateManager.rootState)) {
      delete values[key];
    }
    const content = JSON.stringify(values, void 0, "	");
    const resource = this._rootConfigResource;
    this._rootConfigWrite = this._rootConfigWrite.catch((err) => {
      this._logService.warn("[AgentConfigurationService] Previous host config write failed", err);
    }).then(async () => {
      await fs.promises.mkdir(dirname(resource.fsPath), { recursive: true });
      await fs.promises.writeFile(resource.fsPath, `${content}
`, "utf8");
    }).catch((err) => {
      this._logService.error(`[AgentConfigurationService] Failed to persist host config to ${resource.fsPath}`, err);
    });
  }
  async whenIdle() {
    await this._rootConfigWrite;
  }
  registerProviderConfiguration(registration) {
    const config = this._stateManager.rootState.config;
    if (!config) {
      return;
    }
    Object.assign(config.schema.properties, registration.properties);
    for (const [key, property] of Object.entries(registration.properties)) {
      if (config.values[key] === void 0 && property.default !== void 0) {
        config.values[key] = property.default;
      }
    }
    const registrations = getAgentCustomizationSettingsEntries(this._stateManager.rootState).filter((entry) => entry.provider !== registration.provider);
    this._stateManager.rootState._meta = withAgentCustomizationSettings(this._stateManager.rootState, [...registrations, {
      provider: registration.provider,
      title: registration.title,
      description: registration.description,
      settings: registration.settings,
      configurationFile: registration.configurationFile
    }]);
  }
  getRootConfigValues() {
    return this._stateManager.rootState.config?.values ?? {};
  }
  publishRootTransientValues(patch) {
    for (const key of Object.keys(patch)) {
      this._rootTransientValueKeys.add(key);
    }
    this._stateManager.dispatchServerAction(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config: { ...patch }
    });
  }
  /**
   * Yields the raw value bags that contribute to the effective config
   * for `session`, in precedence order: session, parent subagent
   * session (if any), host.
   */
  *_effectiveChain(session) {
    const own = this._stateManager.getSessionState(session)?.config?.values;
    if (own) {
      yield own;
    }
    const parentInfo = parseSubagentSessionUri(session);
    if (parentInfo) {
      const parent = this._stateManager.getSessionState(parentInfo.parentSession.toString())?.config?.values;
      if (parent) {
        yield parent;
      }
    }
    const host = this._stateManager.rootState.config?.values;
    if (host) {
      yield host;
    }
  }
  _loadPersistedRootConfig() {
    const defaults = defaultAgentHostCustomizationConfigValues;
    if (!this._rootConfigResource) {
      return { ...defaults };
    }
    try {
      const raw = fs.readFileSync(this._rootConfigResource.fsPath, "utf8");
      const parsed = JSON.parse(raw);
      return {
        ...agentHostCustomizationConfigSchema.validateOrDefault(parsed, defaults),
        ...sandboxConfigSchema.validateOrDefault(parsed, {}),
        ...copilotCliConfigSchema.validateOrDefault(parsed, {})
      };
    } catch (err) {
      const code = err && typeof err === "object" && hasKey(err, { code: true }) ? String(err.code) : void 0;
      if (code !== "ENOENT") {
        this._logService.warn(`[AgentConfigurationService] Failed to read host config from ${this._rootConfigResource.fsPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
      return { ...defaults };
    }
  }
};
AgentConfigurationService = __decorateClass([
  __decorateParam(1, ILogService)
], AgentConfigurationService);
export {
  AgentConfigurationService,
  IAgentConfigurationService
};
