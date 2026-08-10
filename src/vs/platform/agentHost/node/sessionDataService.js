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
import { ReferenceCollection } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { Emitter } from "../../../base/common/event.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { AgentSession } from "../common/agentService.js";
import { SESSION_DB_FILENAME } from "../common/sessionDataService.js";
import { SessionDatabase } from "./sessionDatabase.js";
class SessionDatabaseCollection extends ReferenceCollection {
  constructor(_getDbPath, _logService) {
    super();
    this._getDbPath = _getDbPath;
    this._logService = _logService;
    /**
     * The set of currently-open databases. Mirrors what's held by the
     * underlying ref-counted map, but exposed so {@link SessionDataService.whenIdle}
     * can iterate without reaching into private state.
     */
    this.liveDatabases = /* @__PURE__ */ new Set();
  }
  createReferencedObject(key) {
    const dbPath = this._getDbPath(key);
    this._logService.trace(`[SessionDataService] Opening database: ${dbPath}`);
    const db = new SessionDatabase(dbPath);
    this.liveDatabases.add(db);
    return db;
  }
  destroyReferencedObject(_key, object) {
    this.liveDatabases.delete(object);
    object.dispose();
  }
}
let SessionDataService = class {
  constructor(userDataPath, _fileService, _logService, getDbPath) {
    this._fileService = _fileService;
    this._logService = _logService;
    this._onWillDeleteSessionData = new Emitter();
    this._basePath = URI.joinPath(userDataPath, "agentSessionData");
    this._databases = new SessionDatabaseCollection(
      getDbPath ?? ((key) => URI.joinPath(this._basePath, key, SESSION_DB_FILENAME).fsPath),
      this._logService
    );
  }
  get onWillDeleteSessionData() {
    return this._onWillDeleteSessionData.event;
  }
  getSessionDataDir(session) {
    return URI.joinPath(this._basePath, this._sanitizedSessionKey(session));
  }
  getSessionDataDirById(sessionId) {
    const sanitized = sessionId.replace(/[^a-zA-Z0-9_.-]/g, "-");
    return URI.joinPath(this._basePath, sanitized);
  }
  _sanitizedSessionKey(session) {
    return this._dataKey(session).replace(/[^a-zA-Z0-9_.-]/g, "-");
  }
  /**
   * Derives the per-URI storage key. Chat channel URIs
   * (`ahp-chat://<chatId>/<base64(session)>`) carry the chat id in the
   * authority while encoding the SAME owning-session URI in the path, so
   * keying only by the path (via {@link AgentSession.id}) would collapse
   * every peer chat of a session onto one data directory and database.
   * Prefixing with the authority gives each chat its own storage while
   * leaving plain session URIs (no authority) unchanged.
   */
  _dataKey(uri) {
    const id = AgentSession.id(uri);
    return uri.authority ? `${uri.authority}-${id}` : id;
  }
  openDatabase(session) {
    return this._databases.acquire(this._sanitizedSessionKey(session));
  }
  async tryOpenDatabase(session) {
    const key = this._sanitizedSessionKey(session);
    const dbPath = URI.joinPath(this._basePath, key, SESSION_DB_FILENAME);
    if (!await this._fileService.exists(dbPath)) {
      return void 0;
    }
    return this._databases.acquire(key);
  }
  async deleteSessionData(session, workingDirectories) {
    const dir = this.getSessionDataDir(session);
    const pending = [];
    try {
      this._onWillDeleteSessionData.fire({
        session,
        workingDirectories,
        waitUntil: (p) => {
          pending.push(p);
        }
      });
    } catch (err) {
      this._logService.warn(`[SessionDataService] onWillDeleteSessionData listener threw synchronously: ${dir.toString()}`, err);
    }
    if (pending.length > 0) {
      const results = await Promise.allSettled(pending);
      for (const r of results) {
        if (r.status === "rejected") {
          this._logService.warn(`[SessionDataService] onWillDeleteSessionData waitUntil rejected: ${dir.toString()}`, r.reason);
        }
      }
    }
    try {
      if (await this._fileService.exists(dir)) {
        await this._fileService.del(dir, { recursive: true });
        this._logService.trace(`[SessionDataService] Deleted session data: ${dir.toString()}`);
      }
    } catch (err) {
      this._logService.warn(`[SessionDataService] Failed to delete session data: ${dir.toString()}`, err);
    }
  }
  async cleanupOrphanedData(knownSessionIds) {
    try {
      const exists = await this._fileService.exists(this._basePath);
      if (!exists) {
        return;
      }
      const stat = await this._fileService.resolve(this._basePath);
      if (!stat.children) {
        return;
      }
      const deletions = [];
      for (const child of stat.children) {
        if (!child.isDirectory) {
          continue;
        }
        const name = child.name;
        if (!knownSessionIds.has(name)) {
          this._logService.trace(`[SessionDataService] Cleaning up orphaned session data: ${name}`);
          deletions.push(
            this._fileService.del(child.resource, { recursive: true }).catch((err) => {
              this._logService.warn(`[SessionDataService] Failed to clean up orphaned data: ${name}`, err);
            })
          );
        }
      }
      await Promise.all(deletions);
    } catch (err) {
      this._logService.warn("[SessionDataService] Failed to run orphan cleanup", err);
    }
  }
  async whenIdle() {
    while (true) {
      const dbs = [...this._databases.liveDatabases];
      if (dbs.length === 0) {
        return;
      }
      await Promise.all(dbs.map((db) => db.whenIdle()));
      const newOnes = [...this._databases.liveDatabases].filter((db) => !dbs.includes(db));
      if (newOnes.length === 0) {
        return;
      }
    }
  }
};
SessionDataService = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], SessionDataService);
export {
  SessionDataService
};
