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
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { toSessionId } from "../../../../services/sessions/common/session.js";
import {
  AbstractMultiProviderAgentHostConfigSchemaRegistrar,
  AbstractSessionsAgentHostConfigFileSystemProvider,
  buildAgentHostConfigJsonSchema,
  serializeAgentHostConfigDocument
} from "./agentHostSettingsShared.js";
const AGENT_SESSION_SETTINGS_SCHEME = "agent-session-settings";
function agentSessionSettingsUri(session) {
  return URI.from({
    scheme: AGENT_SESSION_SETTINGS_SCHEME,
    authority: session.providerId,
    path: `/${session.resource.scheme}${session.resource.path}.jsonc`
  });
}
function parseSessionSettingsUri(uri) {
  if (uri.scheme !== AGENT_SESSION_SETTINGS_SCHEME) {
    return void 0;
  }
  const providerId = uri.authority;
  if (!providerId) {
    return void 0;
  }
  const path = uri.path.startsWith("/") ? uri.path.substring(1) : uri.path;
  const firstSlash = path.indexOf("/");
  if (firstSlash <= 0) {
    return void 0;
  }
  const resourceScheme = path.substring(0, firstSlash);
  let rest = path.substring(firstSlash);
  const lastDot = rest.lastIndexOf(".");
  if (lastDot > 0) {
    rest = rest.substring(0, lastDot);
  }
  if (!resourceScheme || rest === "/") {
    return void 0;
  }
  const resource = URI.from({ scheme: resourceScheme, path: rest });
  return { providerId, sessionId: toSessionId(providerId, resource) };
}
const sessionSettingsPropertyFilter = (_key, schema) => {
  const s = schema;
  return s.sessionMutable === true && s.readOnly !== true;
};
const sessionSettingsLocale = {
  get header() {
    return localize("agentSessionSettings.header", "Session settings for this agent host session.");
  },
  get saveHint() {
    return localize("agentSessionSettings.saveHint", "Edit values below and save to apply. Unknown or non-mutable properties are ignored.");
  },
  get parseError() {
    return localize("agentSessionSettings.parseError", "Failed to parse agent session settings as JSON.");
  },
  get notObject() {
    return localize("agentSessionSettings.notObject", "Agent session settings must be a JSON object.");
  }
};
function serializeSessionSettings(provider, sessionId) {
  return serializeAgentHostConfigDocument(provider.getSessionConfig(sessionId), sessionSettingsPropertyFilter, sessionSettingsLocale);
}
function buildSessionSettingsJsonSchema(config) {
  return buildAgentHostConfigJsonSchema(config, sessionSettingsPropertyFilter);
}
let AgentSessionSettingsFileSystemProvider = class extends AbstractSessionsAgentHostConfigFileSystemProvider {
  constructor(_schemaRegistrar, sessionsProvidersService, logService) {
    super(sessionsProvidersService, logService);
    this._schemaRegistrar = _schemaRegistrar;
    this._schemeLabel = AGENT_SESSION_SETTINGS_SCHEME;
    this._traceTag = "AgentSessionSettings";
    this._locale = sessionSettingsLocale;
  }
  _parseUri(resource) {
    return parseSessionSettingsUri(resource);
  }
  _serialize(provider, ctx) {
    return serializeSessionSettings(provider, ctx.sessionId);
  }
  _watchChanges(provider, ctx, fire) {
    return provider.onDidChangeSessionConfig((changedSessionId) => {
      if (changedSessionId === ctx.sessionId) {
        fire();
      }
    });
  }
  _ensureSchemaRegistered(provider, ctx) {
    const session = provider.getSessions().find((s) => s.sessionId === ctx.sessionId);
    if (session) {
      this._schemaRegistrar.ensureRegistered(session);
    }
  }
  _hasConfig(provider, ctx) {
    return provider.getSessionConfig(ctx.sessionId) !== void 0;
  }
  // The input is the user's full view of editable values. Dispatch as a
  // replace — `replaceSessionConfig` guarantees non-editable properties
  // (non-mutable or readOnly) are preserved regardless of what we send,
  // and unknown keys are ignored.
  _replaceConfig(provider, ctx, values) {
    return provider.replaceSessionConfig(ctx.sessionId, values);
  }
  _describeForTrace(ctx) {
    return `session ${ctx.sessionId}`;
  }
};
AgentSessionSettingsFileSystemProvider = __decorateClass([
  __decorateParam(1, ISessionsProvidersService),
  __decorateParam(2, ILogService)
], AgentSessionSettingsFileSystemProvider);
class AgentSessionSettingsSchemaRegistrar extends AbstractMultiProviderAgentHostConfigSchemaRegistrar {
  _propertyFilter() {
    return sessionSettingsPropertyFilter;
  }
  _settingsUri(session) {
    return agentSessionSettingsUri(session).toString();
  }
  // Schema content is served via the `vscode://schemas/...` filesystem
  // provider (see `SettingsFileSystemProvider`); the JSON language client
  // only knows how to fetch schema content for that scheme. The
  // settings-file URI is used as the fileMatch glob so the schema is
  // applied to the actual editor document.
  _schemaId(session) {
    return `vscode://schemas/agent-session-settings/${session.providerId}/${session.resource.scheme}/${session.resource.path}.jsonc`;
  }
  _getConfig(session) {
    const provider = this._sessionsProvidersService.getProvider(session.providerId);
    return provider?.getSessionConfig(session.sessionId);
  }
  _targetsForProvider(provider) {
    return provider.getSessions();
  }
  _observeProvider(provider, onChanged, onRemoved) {
    const store = new DisposableStore();
    store.add(provider.onDidChangeSessionConfig((sessionId) => {
      const session = provider.getSessions().find((s) => s.sessionId === sessionId);
      if (session) {
        onChanged(session);
      }
    }));
    store.add(provider.onDidChangeSessions((e) => {
      for (const removed of e.removed) {
        onRemoved(removed);
      }
    }));
    return store;
  }
}
export {
  AGENT_SESSION_SETTINGS_SCHEME,
  AgentSessionSettingsFileSystemProvider,
  AgentSessionSettingsSchemaRegistrar,
  agentSessionSettingsUri,
  buildSessionSettingsJsonSchema,
  serializeSessionSettings
};
