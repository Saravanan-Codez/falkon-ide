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
import { ILogService } from "../../../log/common/log.js";
import { ISessionDataService } from "../../common/sessionDataService.js";
let CodexSessionMetadataStore = class {
  constructor(_sessionDataService, _logService) {
    this._sessionDataService = _sessionDataService;
    this._logService = _logService;
  }
  static {
    this.KEY_THREAD_ID = "codex.threadId";
  }
  static {
    this.KEY_CWD = "codex.cwd";
  }
  static {
    this.KEY_MODEL = "codex.model";
  }
  static {
    this.KEY_AGENT = "codex.agent";
  }
  /**
   * Persist the supplied overlay fields. Only-write-on-defined.
   * Best-effort: failures are logged and swallowed because the caller
   * has already committed in-memory state and a corrupt DB shouldn't
   * abort the current turn.
   */
  async write(session, fields) {
    try {
      const ref = this._sessionDataService.openDatabase(session);
      const db = ref.object;
      try {
        const work = [];
        if (fields.threadId !== void 0) {
          work.push(db.setMetadata(CodexSessionMetadataStore.KEY_THREAD_ID, fields.threadId));
        }
        if (fields.cwd !== void 0) {
          work.push(db.setMetadata(
            CodexSessionMetadataStore.KEY_CWD,
            serializeCwd(fields.cwd, fields.workingDirectories)
          ));
        }
        if (fields.modelId !== void 0) {
          work.push(db.setMetadata(CodexSessionMetadataStore.KEY_MODEL, fields.modelId));
        }
        if (fields.agent !== void 0) {
          work.push(db.setMetadata(
            CodexSessionMetadataStore.KEY_AGENT,
            fields.agent === null ? "" : JSON.stringify({ uri: fields.agent.uri })
          ));
        }
        await Promise.all(work);
      } finally {
        ref.dispose();
      }
    } catch (err) {
      this._logService.warn(`[Codex] metadata write failed for ${session.toString()}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  /**
   * Read overlay fields for `session`. Returns `{}` when no DB has
   * been created yet (fresh session, or external codex CLI thread the
   * workbench has never touched).
   */
  async read(session) {
    try {
      const ref = await this._sessionDataService.tryOpenDatabase(session);
      if (!ref) {
        return {};
      }
      try {
        const [threadId, cwdRaw, modelId, agentRaw] = await Promise.all([
          ref.object.getMetadata(CodexSessionMetadataStore.KEY_THREAD_ID),
          ref.object.getMetadata(CodexSessionMetadataStore.KEY_CWD),
          ref.object.getMetadata(CodexSessionMetadataStore.KEY_MODEL),
          ref.object.getMetadata(CodexSessionMetadataStore.KEY_AGENT)
        ]);
        const cwd = parseCwd(cwdRaw);
        return {
          threadId: threadId ?? void 0,
          cwd: cwd.cwd,
          modelId: modelId ?? void 0,
          agent: parseAgentSelection(agentRaw),
          workingDirectories: cwd.workingDirectories
        };
      } finally {
        ref.dispose();
      }
    } catch (err) {
      this._logService.warn(`[Codex] metadata read failed for ${session.toString()}: ${err instanceof Error ? err.message : String(err)}`);
      return {};
    }
  }
};
CodexSessionMetadataStore = __decorateClass([
  __decorateParam(0, ISessionDataService),
  __decorateParam(1, ILogService)
], CodexSessionMetadataStore);
function parseAgentSelection(raw) {
  if (!raw) {
    return void 0;
  }
  try {
    const value = JSON.parse(raw);
    return typeof value.uri === "string" ? { uri: value.uri } : void 0;
  } catch {
    return void 0;
  }
}
function serializeCwd(cwd, workingDirectories) {
  if (!workingDirectories || workingDirectories.length <= 1) {
    return cwd.toString();
  }
  return JSON.stringify({
    cwd: cwd.toString(),
    workingDirectories: workingDirectories.map((directory) => directory.toString())
  });
}
function parseCwd(raw) {
  if (!raw) {
    return {};
  }
  if (!raw.startsWith("{")) {
    return { cwd: URI.parse(raw) };
  }
  try {
    const value = JSON.parse(raw);
    if (typeof value.cwd !== "string") {
      return {};
    }
    const workingDirectories = Array.isArray(value.workingDirectories) ? value.workingDirectories.filter((directory) => typeof directory === "string").map((directory) => URI.parse(directory)) : void 0;
    return {
      cwd: URI.parse(value.cwd),
      workingDirectories: workingDirectories && workingDirectories.length > 1 ? workingDirectories : void 0
    };
  } catch {
    return {};
  }
}
export {
  CodexSessionMetadataStore
};
