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
import { URI } from "../../../../base/common/uri.js";
import { narrowClaudePermissionMode } from "../../common/claudeSessionConfigKeys.js";
import { AgentSession } from "../../common/agentService.js";
import { ISessionDataService } from "../../common/sessionDataService.js";
let ClaudeSessionMetadataStore = class {
  constructor(_provider, _sessionDataService) {
    this._provider = _provider;
    this._sessionDataService = _sessionDataService;
  }
  static {
    this.KEY_CUSTOMIZATION_DIRECTORY = "claude.customizationDirectory";
  }
  static {
    this.KEY_MODEL = "claude.model";
  }
  static {
    this.KEY_PERMISSION_MODE = "claude.permissionMode";
  }
  static {
    this.KEY_AGENT = "claude.agent";
  }
  static {
    this.KEY_TRANSPORT = "claude.transport";
  }
  static {
    this.KEY_WORKING_DIRECTORIES = "claude.workingDirectories";
  }
  /**
   * Persist the supplied overlay fields to the per-session DB. Mirrors
   * CopilotAgent's `_storeSessionMetadata` pattern
   * (`copilotAgent.ts:1532`): single `openDatabase` ref, `Promise.all`
   * batching, only-write-on-defined.
   */
  async write(session, fields) {
    const dbRef = this._sessionDataService.openDatabase(session);
    const db = dbRef.object;
    try {
      const work = [];
      if (fields.customizationDirectory) {
        work.push(db.setMetadata(ClaudeSessionMetadataStore.KEY_CUSTOMIZATION_DIRECTORY, fields.customizationDirectory.toString()));
      }
      if (fields.model) {
        work.push(db.setMetadata(ClaudeSessionMetadataStore.KEY_MODEL, serializeModelSelection(fields.model)));
      }
      if (fields.permissionMode) {
        work.push(db.setMetadata(ClaudeSessionMetadataStore.KEY_PERMISSION_MODE, fields.permissionMode));
      }
      if (fields.agent !== void 0) {
        work.push(db.setMetadata(
          ClaudeSessionMetadataStore.KEY_AGENT,
          fields.agent === null ? "" : JSON.stringify({ uri: fields.agent.uri })
        ));
      }
      if (fields.transport) {
        work.push(db.setMetadata(ClaudeSessionMetadataStore.KEY_TRANSPORT, fields.transport));
      }
      if (fields.workingDirectories) {
        work.push(db.setMetadata(
          ClaudeSessionMetadataStore.KEY_WORKING_DIRECTORIES,
          JSON.stringify(fields.workingDirectories.map((d) => d.toString()))
        ));
      }
      await Promise.all(work);
    } finally {
      dbRef.dispose();
    }
  }
  /**
   * Read all overlay fields from the per-session DB. Returns `{}` when
   * no DB is present (external Claude CLI session, fresh install).
   * Mirrors CopilotAgent's `_readSessionMetadata` (`copilotAgent.ts:1559`)
   * — `tryOpenDatabase` so absence is not an error, single `Promise.all`
   * for the parallel reads.
   */
  async read(session) {
    const ref = await this._sessionDataService.tryOpenDatabase(session);
    if (!ref) {
      return {};
    }
    try {
      const [customizationDirectoryRaw, modelRaw, permissionModeRaw, agentRaw, transportRaw, workingDirectoriesRaw] = await Promise.all([
        ref.object.getMetadata(ClaudeSessionMetadataStore.KEY_CUSTOMIZATION_DIRECTORY),
        ref.object.getMetadata(ClaudeSessionMetadataStore.KEY_MODEL),
        ref.object.getMetadata(ClaudeSessionMetadataStore.KEY_PERMISSION_MODE),
        ref.object.getMetadata(ClaudeSessionMetadataStore.KEY_AGENT),
        ref.object.getMetadata(ClaudeSessionMetadataStore.KEY_TRANSPORT),
        ref.object.getMetadata(ClaudeSessionMetadataStore.KEY_WORKING_DIRECTORIES)
      ]);
      return {
        customizationDirectory: customizationDirectoryRaw ? URI.parse(customizationDirectoryRaw) : void 0,
        model: parseModelSelection(modelRaw),
        permissionMode: narrowClaudePermissionMode(permissionModeRaw),
        agent: parseAgentSelection(agentRaw),
        transport: transportRaw === "proxy" || transportRaw === "native" ? transportRaw : void 0,
        workingDirectories: parseWorkingDirectories(workingDirectoriesRaw)
      };
    } finally {
      ref.dispose();
    }
  }
  /**
   * Project an SDK-supplied {@link SDKSessionInfo} onto the platform's
   * {@link IAgentSessionMetadata} shape. Pure projection — does not touch
   * the DB. The per-session overlay no longer contributes any projected
   * field, so it is not read here; the store is still consulted on the
   * harness's internal restoration paths (see {@link read}).
   */
  project(entry) {
    return {
      session: AgentSession.uri(this._provider, entry.sessionId),
      startTime: entry.createdAt ?? entry.lastModified,
      modifiedTime: entry.lastModified,
      summary: entry.customTitle ?? entry.summary,
      workingDirectories: entry.cwd ? [URI.file(entry.cwd)] : void 0
    };
  }
};
ClaudeSessionMetadataStore = __decorateClass([
  __decorateParam(1, ISessionDataService)
], ClaudeSessionMetadataStore);
function parseAgentSelection(raw) {
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
function parseWorkingDirectories(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) {
      const dirs = value.filter((d) => typeof d === "string").map((d) => URI.parse(d));
      return dirs.length > 0 ? dirs : void 0;
    }
  } catch {
  }
  return void 0;
}
function serializeModelSelection(model) {
  return JSON.stringify(model);
}
function parseModelSelection(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object" && typeof value.id === "string") {
      const result = { id: value.id };
      if (value.config && typeof value.config === "object") {
        const config = {};
        for (const [key, configValue] of Object.entries(value.config)) {
          if (typeof configValue === "string") {
            config[key] = configValue;
          }
        }
        if (Object.keys(config).length > 0) {
          result.config = config;
        }
      }
      return result;
    }
  } catch {
  }
  return { id: raw };
}
export {
  ClaudeSessionMetadataStore
};
