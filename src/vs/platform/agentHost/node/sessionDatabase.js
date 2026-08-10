import * as fs from "fs";
import { Sequencer, SequencerByKey } from "../../../base/common/async.js";
import { dirname } from "../../../base/common/path.js";
import { URI } from "../../../base/common/uri.js";
const sessionDatabaseMigrations = [
  {
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS turns (
				id TEXT PRIMARY KEY NOT NULL
			)`,
      `CREATE TABLE IF NOT EXISTS file_edits (
				turn_id        TEXT    NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
				tool_call_id   TEXT    NOT NULL,
				file_path      TEXT    NOT NULL,
				before_content BLOB   NOT NULL,
				after_content  BLOB   NOT NULL,
				added_lines    INTEGER,
				removed_lines  INTEGER,
				PRIMARY KEY (tool_call_id, file_path)
			)`
    ].join(";\n")
  },
  {
    version: 2,
    sql: `CREATE TABLE IF NOT EXISTS session_metadata (
			key   TEXT PRIMARY KEY NOT NULL,
			value TEXT NOT NULL
		)`
  },
  {
    version: 3,
    sql: [
      // Recreate file_edits with new columns: edit_type, original_path,
      // and nullable before_content/after_content.
      `CREATE TABLE file_edits_v3 (
				turn_id        TEXT    NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
				tool_call_id   TEXT    NOT NULL,
				file_path      TEXT    NOT NULL,
				edit_type      TEXT    NOT NULL DEFAULT 'edit',
				original_path  TEXT,
				before_content BLOB,
				after_content  BLOB,
				added_lines    INTEGER,
				removed_lines  INTEGER,
				PRIMARY KEY (tool_call_id, file_path)
			)`,
      `INSERT INTO file_edits_v3 (turn_id, tool_call_id, file_path, edit_type, before_content, after_content, added_lines, removed_lines)
				SELECT turn_id, tool_call_id, file_path, 'edit', before_content, after_content, added_lines, removed_lines FROM file_edits`,
      `DROP TABLE file_edits`,
      `ALTER TABLE file_edits_v3 RENAME TO file_edits`
    ].join(";\n")
  },
  {
    version: 4,
    sql: [
      `ALTER TABLE turns ADD COLUMN event_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_turns_event_id ON turns(event_id)`
    ].join(";\n")
  },
  {
    version: 5,
    sql: `ALTER TABLE turns ADD COLUMN checkpoint_ref TEXT`
  },
  {
    version: 6,
    sql: `CREATE TABLE IF NOT EXISTS chat_drafts (
			chat_uri TEXT PRIMARY KEY NOT NULL,
			draft    TEXT NOT NULL
		)`
  },
  {
    version: 7,
    sql: `CREATE TABLE IF NOT EXISTS reviewed_files (
			uri   TEXT NOT NULL,
			nonce TEXT NOT NULL,
			PRIMARY KEY (uri, nonce)
		)`
  },
  {
    version: 8,
    sql: `CREATE TABLE IF NOT EXISTS local_turns (
			turn_id        TEXT PRIMARY KEY NOT NULL,
			chat_uri       TEXT NOT NULL,
			anchor_turn_id TEXT,
			seq            INTEGER NOT NULL,
			payload        TEXT NOT NULL
		)`
  },
  {
    version: 9,
    // `turn_usage` is a child of `turns` so every prune path (`deleteTurn`,
    // `truncateFromTurn`, `deleteTurnsAfter`, `deleteAllTurns`, and the fork
    // remap) reaches it by cascade and the table cannot grow unbounded.
    //
    // The foreign key forces `setTurnUsage` to `INSERT OR IGNORE` a parent row,
    // and rows created that way carry `event_id IS NULL`. That is safe here:
    // `getFirstTurnEventId` / `getNextTurnEventId` scan by rowid and are read
    // only by the Copilot agent (Claude resolves fork/truncate boundaries from
    // its own persisted mapping), and in a Copilot database `setTurnEventId`
    // runs on `user.message` — before any usage is reported — so the parent row
    // already exists and the insert is a no-op. Were usage ever to land first,
    // `setTurnEventId` fills the existing row in (`UPDATE … WHERE event_id IS
    // NULL`) and the position is still correct, since a turn's usage precedes
    // the next turn. Each peer chat gets its own database (see
    // `SessionDataService`), so a peer turn cannot interleave with another
    // chat's turns either.
    sql: `CREATE TABLE IF NOT EXISTS turn_usage (
			turn_id TEXT PRIMARY KEY NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
			usage   TEXT NOT NULL
		)`
  }
];
function dbExec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => err ? reject(err) : resolve());
  });
}
function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        return reject(err);
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}
function dbGet(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}
function dbAll(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}
function dbClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => err ? reject(err) : resolve());
  });
}
function dbOpen(path) {
  return new Promise((resolve, reject) => {
    import("@vscode/sqlite3").then((sqlite3) => {
      const db = new sqlite3.default.Database(path, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(db);
      });
    }, reject);
  });
}
async function runMigrations(db, migrations) {
  await dbExec(db, "PRAGMA foreign_keys = ON");
  const row = await dbGet(db, "PRAGMA user_version", []);
  const currentVersion = row?.user_version ?? 0;
  const pending = migrations.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);
  if (pending.length === 0) {
    return;
  }
  await dbExec(db, "BEGIN TRANSACTION");
  try {
    for (const migration of pending) {
      await dbExec(db, migration.sql);
      await dbExec(db, `PRAGMA user_version = ${migration.version}`);
    }
    await dbExec(db, "COMMIT");
  } catch (err) {
    await dbExec(db, "ROLLBACK");
    throw err;
  }
}
class SessionDatabase {
  constructor(_path, _migrations = sessionDatabaseMigrations) {
    this._path = _path;
    this._migrations = _migrations;
    this._fileEditSequencer = new SequencerByKey();
    /**
     * Serializes `setMetadata` writes per key. `@vscode/sqlite3` runs in
     * parallelized mode, so two `db.run()` calls on the same connection
     * can be dispatched to the libuv thread pool and complete out of
     * submission order. For "last writer wins" keys (notably `configValues`
     * via {@link setMetadata}), that meant a fast-following second write
     * could be overtaken by the first and silently lose its value — see
     * the "Session Config persistence across restarts" integration test.
     * Sequencing by key preserves intra-key order while still allowing
     * writes for different keys to run concurrently.
     */
    this._metadataSequencer = new SequencerByKey();
    /**
     * Serializes every `turn_usage` access — writes, prunes, the fork remap, and the restore read
     * alike. `@vscode/sqlite3` runs in parallelized mode (see {@link _metadataSequencer}), so a
     * fire-and-forget `setTurnUsage` submitted before a truncation can otherwise complete *after*
     * it and resurrect a row the truncation was meant to remove, and a read can otherwise overtake
     * a write it was submitted after. Mutations must go through {@link _mutateTurnUsage} rather
     * than queueing on this directly, so they are tracked for {@link whenIdle}.
     */
    this._turnUsageSequencer = new Sequencer();
    /**
     * In-flight write operations. Tracked so {@link whenIdle} can await them
     * before the process exits — without this, a `SIGTERM` arriving between
     * a fire-and-forget mutating call (e.g. `setMetadata`) being invoked and
     * its underlying SQLite query completing would silently drop the write.
     * Every public mutating method routes its returned promise through
     * {@link _track}; reads (`getMetadata`, `getFileEdits`, ...) skip
     * tracking since shutdown does not need to wait for them.
     */
    this._pendingWrites = /* @__PURE__ */ new Set();
  }
  /**
   * Runs a mutation that touches `turn_usage`, tracked for {@link whenIdle}
   * and serialized against every other such mutation.
   */
  _mutateTurnUsage(operation) {
    return this._track(() => this._turnUsageSequencer.queue(async () => operation(await this._ensureDb())));
  }
  /**
   * Opens (or creates) a SQLite database at {@link path} and applies
   * any pending migrations. Only used in tests where synchronous
   * construction + immediate readiness is desired.
   */
  static async open(path, migrations = sessionDatabaseMigrations) {
    const inst = new SessionDatabase(path, migrations);
    await inst._ensureDb();
    return inst;
  }
  _ensureDb() {
    if (this._closed) {
      return Promise.reject(new Error("SessionDatabase has been disposed"));
    }
    if (!this._dbPromise) {
      this._dbPromise = (async () => {
        await fs.promises.mkdir(dirname(this._path), { recursive: true });
        const db = await dbOpen(this._path);
        try {
          await runMigrations(db, this._migrations);
        } catch (err) {
          await dbClose(db);
          this._dbPromise = void 0;
          throw err;
        }
        if (this._closed) {
          await dbClose(db);
          throw new Error("SessionDatabase has been disposed");
        }
        return db;
      })().catch((err) => {
        this._dbPromise = void 0;
        throw err;
      });
    }
    return this._dbPromise;
  }
  /**
   * Returns the names of all user-created tables in the database.
   * Useful for testing migration behavior.
   */
  async getAllTables() {
    const db = await this._ensureDb();
    const rows = await dbAll(db, `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`, []);
    return rows.map((r) => r.name);
  }
  // ---- Turns ----------------------------------------------------------
  createTurn(turnId) {
    return this._track(async () => {
      const db = await this._ensureDb();
      await dbRun(db, "INSERT OR IGNORE INTO turns (id) VALUES (?)", [turnId]);
    });
  }
  deleteTurn(turnId) {
    return this._mutateTurnUsage(async (db) => {
      await dbRun(db, "DELETE FROM turns WHERE id = ?", [turnId]);
    });
  }
  setTurnEventId(turnId, eventId) {
    return this._track(async () => {
      const db = await this._ensureDb();
      await dbRun(db, "INSERT OR IGNORE INTO turns (id) VALUES (?)", [turnId]);
      await dbRun(db, "UPDATE turns SET event_id = ? WHERE id = ? AND event_id IS NULL", [eventId, turnId]);
    });
  }
  async getTurnEventId(turnId) {
    const db = await this._ensureDb();
    const row = await dbGet(db, "SELECT event_id FROM turns WHERE id = ?1 OR event_id = ?1 LIMIT 1", [turnId]);
    return row?.event_id ?? void 0;
  }
  async getNextTurnEventId(turnId) {
    const db = await this._ensureDb();
    const row = await dbGet(
      db,
      `SELECT event_id FROM turns
				WHERE rowid > (
					SELECT rowid FROM turns WHERE id = ?1 OR event_id = ?1 LIMIT 1
				)
				ORDER BY rowid LIMIT 1`,
      [turnId]
    );
    return row?.event_id ?? void 0;
  }
  async getFirstTurnEventId() {
    const db = await this._ensureDb();
    const row = await dbGet(db, "SELECT event_id FROM turns ORDER BY rowid LIMIT 1", []);
    return row?.event_id ?? void 0;
  }
  setTurnUsage(turnId, usage) {
    return this._mutateTurnUsage(async (db) => {
      await dbRun(db, "INSERT OR IGNORE INTO turns (id) VALUES (?)", [turnId]);
      await dbRun(db, "INSERT OR REPLACE INTO turn_usage (turn_id, usage) VALUES (?, ?)", [turnId, usage]);
    });
  }
  async getTurnUsages() {
    return this._turnUsageSequencer.queue(async () => {
      const db = await this._ensureDb();
      const rows = await dbAll(
        db,
        `SELECT u.turn_id AS turn_id, t.event_id AS event_id, u.usage AS usage
				FROM turn_usage u LEFT JOIN turns t ON t.id = u.turn_id`,
        []
      );
      const result = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const usage = row.usage;
        result.set(row.turn_id, usage);
        const eventId = row.event_id;
        if (eventId) {
          result.set(eventId, usage);
        }
      }
      return result;
    });
  }
  setTurnCheckpointRef(turnId, ref) {
    return this._track(async () => {
      const db = await this._ensureDb();
      await dbRun(db, "INSERT OR IGNORE INTO turns (id) VALUES (?)", [turnId]);
      await dbRun(db, "UPDATE turns SET checkpoint_ref = ? WHERE id = ?", [ref, turnId]);
    });
  }
  async getTurnCheckpointRef(turnId) {
    const db = await this._ensureDb();
    const row = await dbGet(db, "SELECT checkpoint_ref FROM turns WHERE id = ?1 OR event_id = ?1 LIMIT 1", [turnId]);
    return row?.checkpoint_ref ?? void 0;
  }
  async getPreviousCheckpointRef(turnId) {
    const db = await this._ensureDb();
    const row = await dbGet(
      db,
      `SELECT checkpoint_ref FROM turns
				WHERE rowid < (SELECT rowid FROM turns WHERE id = ?1 OR event_id = ?1 LIMIT 1)
					AND checkpoint_ref IS NOT NULL
				ORDER BY rowid DESC LIMIT 1`,
      [turnId]
    );
    return row?.checkpoint_ref ?? void 0;
  }
  async getAllCheckpointRefs() {
    const db = await this._ensureDb();
    const rows = await dbAll(db, "SELECT checkpoint_ref FROM turns WHERE checkpoint_ref IS NOT NULL ORDER BY rowid", []);
    return rows.map((r) => r.checkpoint_ref);
  }
  truncateFromTurn(turnId) {
    return this._mutateTurnUsage(async (db) => {
      await dbRun(
        db,
        `DELETE FROM turns WHERE rowid >= (SELECT rowid FROM turns WHERE id = ?)`,
        [turnId]
      );
    });
  }
  deleteTurnsAfter(turnId) {
    return this._mutateTurnUsage(async (db) => {
      await dbRun(
        db,
        `DELETE FROM turns WHERE rowid > (SELECT rowid FROM turns WHERE id = ?)`,
        [turnId]
      );
    });
  }
  deleteAllTurns() {
    return this._mutateTurnUsage(async (db) => {
      await dbExec(db, "DELETE FROM turns");
    });
  }
  // ---- Local (host-injected) turns ------------------------------------
  insertLocalTurn(record) {
    return this._track(async () => {
      const db = await this._ensureDb();
      await dbRun(
        db,
        "INSERT OR REPLACE INTO local_turns (turn_id, chat_uri, anchor_turn_id, seq, payload) VALUES (?, ?, ?, ?, ?)",
        [record.turnId, record.chatUri, record.anchorTurnId ?? null, record.seq, record.payload]
      );
    });
  }
  async getLocalTurns() {
    const db = await this._ensureDb();
    const rows = await dbAll(db, "SELECT turn_id, chat_uri, anchor_turn_id, seq, payload FROM local_turns ORDER BY seq", []);
    return rows.map((r) => ({
      turnId: r.turn_id,
      chatUri: r.chat_uri,
      anchorTurnId: r.anchor_turn_id ?? void 0,
      seq: r.seq,
      payload: r.payload
    }));
  }
  deleteLocalTurns(turnIds) {
    return this._track(async () => {
      if (turnIds.length === 0) {
        return;
      }
      const db = await this._ensureDb();
      const placeholders = turnIds.map(() => "?").join(",");
      await dbRun(db, `DELETE FROM local_turns WHERE turn_id IN (${placeholders})`, [...turnIds]);
    });
  }
  // ---- File edits -----------------------------------------------------
  storeFileEdit(edit) {
    return this._track(() => this._fileEditSequencer.queue(edit.filePath, async () => {
      const db = await this._ensureDb();
      await dbRun(db, "INSERT OR IGNORE INTO turns (id) VALUES (?)", [edit.turnId]);
      await dbRun(
        db,
        `INSERT OR REPLACE INTO file_edits
					(turn_id, tool_call_id, file_path, edit_type, original_path, before_content, after_content, added_lines, removed_lines)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          edit.turnId,
          edit.toolCallId,
          edit.filePath,
          edit.kind,
          edit.originalPath ?? null,
          edit.beforeContent ? Buffer.from(edit.beforeContent) : null,
          edit.afterContent ? Buffer.from(edit.afterContent) : null,
          edit.addedLines ?? null,
          edit.removedLines ?? null
        ]
      );
    }));
  }
  async getFileEdits(toolCallIds) {
    if (toolCallIds.length === 0) {
      return [];
    }
    const db = await this._ensureDb();
    const placeholders = toolCallIds.map(() => "?").join(",");
    const rows = await dbAll(
      db,
      `SELECT turn_id, tool_call_id, file_path, edit_type, original_path, added_lines, removed_lines
				FROM file_edits
				WHERE tool_call_id IN (${placeholders})
				ORDER BY rowid`,
      toolCallIds
    );
    return rows.map((row) => ({
      turnId: row.turn_id,
      toolCallId: row.tool_call_id,
      filePath: row.file_path,
      kind: row.edit_type ?? "edit",
      originalPath: row.original_path ?? void 0,
      addedLines: row.added_lines ?? void 0,
      removedLines: row.removed_lines ?? void 0
    }));
  }
  async getAllFileEdits() {
    const db = await this._ensureDb();
    const rows = await dbAll(
      db,
      `SELECT turn_id, tool_call_id, file_path, edit_type, original_path, added_lines, removed_lines
				FROM file_edits
				ORDER BY rowid`,
      []
    );
    return rows.map((row) => ({
      turnId: row.turn_id,
      toolCallId: row.tool_call_id,
      filePath: row.file_path,
      kind: row.edit_type ?? "edit",
      originalPath: row.original_path ?? void 0,
      addedLines: row.added_lines ?? void 0,
      removedLines: row.removed_lines ?? void 0
    }));
  }
  async getFileEditsByTurn(turnId) {
    const db = await this._ensureDb();
    const rows = await dbAll(
      db,
      `SELECT turn_id, tool_call_id, file_path, edit_type, original_path, added_lines, removed_lines
				FROM file_edits
				WHERE turn_id = ?
				ORDER BY rowid`,
      [turnId]
    );
    return rows.map((row) => ({
      turnId: row.turn_id,
      toolCallId: row.tool_call_id,
      filePath: row.file_path,
      kind: row.edit_type ?? "edit",
      originalPath: row.original_path ?? void 0,
      addedLines: row.added_lines ?? void 0,
      removedLines: row.removed_lines ?? void 0
    }));
  }
  async readFileEditContent(toolCallId, filePath) {
    return this._fileEditSequencer.queue(filePath, async () => {
      const db = await this._ensureDb();
      const row = await dbGet(
        db,
        `SELECT before_content, after_content
					FROM file_edits
					WHERE tool_call_id = ? AND file_path = ?`,
        [toolCallId, filePath]
      );
      if (!row) {
        return void 0;
      }
      return {
        beforeContent: row.before_content ? toUint8Array(row.before_content) : void 0,
        afterContent: row.after_content ? toUint8Array(row.after_content) : void 0
      };
    });
  }
  // ---- Session metadata -----------------------------------------------
  async getMetadata(key) {
    const db = await this._ensureDb();
    const row = await dbGet(db, "SELECT value FROM session_metadata WHERE key = ?", [key]);
    return row?.value;
  }
  async getMetadataObject(obj) {
    const keys = Object.keys(obj);
    const result = {};
    if (keys.length === 0) {
      return result;
    }
    const db = await this._ensureDb();
    const placeholders = keys.map(() => "?").join(",");
    const rows = await dbAll(db, `SELECT key, value FROM session_metadata WHERE key IN (${placeholders})`, keys);
    for (const key of keys) {
      result[key] = void 0;
    }
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
  setMetadata(key, value) {
    return this._track(() => this._metadataSequencer.queue(key, async () => {
      const db = await this._ensureDb();
      await dbRun(db, "INSERT OR REPLACE INTO session_metadata (key, value) VALUES (?, ?)", [key, value]);
    }));
  }
  setChatDraft(chat, draft) {
    const chatUri = chat.toString();
    return this._track(async () => {
      const db = await this._ensureDb();
      if (!draft) {
        await dbRun(db, "DELETE FROM chat_drafts WHERE chat_uri = ?", [chatUri]);
        return;
      }
      await dbRun(db, "INSERT OR REPLACE INTO chat_drafts (chat_uri, draft) VALUES (?, ?)", [chatUri, JSON.stringify(draft)]);
    });
  }
  async getChatDraft(chat) {
    const db = await this._ensureDb();
    const row = await dbGet(db, "SELECT draft FROM chat_drafts WHERE chat_uri = ?", [chat.toString()]);
    if (typeof row?.draft !== "string") {
      return void 0;
    }
    try {
      return JSON.parse(row.draft);
    } catch {
      return void 0;
    }
  }
  // ---- Reviewed files -------------------------------------------------
  markFileReviewed(uri, nonce) {
    return this._track(async () => {
      const db = await this._ensureDb();
      await dbRun(db, "INSERT OR IGNORE INTO reviewed_files (uri, nonce) VALUES (?, ?)", [uri.toString(), nonce]);
    });
  }
  unmarkFileReviewed(uri, nonce) {
    return this._track(async () => {
      const db = await this._ensureDb();
      await dbRun(db, "DELETE FROM reviewed_files WHERE uri = ? AND nonce = ?", [uri.toString(), nonce]);
    });
  }
  async getReviewedFiles() {
    const db = await this._ensureDb();
    const rows = await dbAll(db, "SELECT uri, nonce FROM reviewed_files ORDER BY rowid", []);
    return rows.map(toReviewedFileRecord);
  }
  async getReviewedFilesForUri(uri) {
    const db = await this._ensureDb();
    const rows = await dbAll(db, "SELECT uri, nonce FROM reviewed_files WHERE uri = ? ORDER BY rowid", [uri.toString()]);
    return rows.map(toReviewedFileRecord);
  }
  async isFileReviewed(uri, nonce) {
    const db = await this._ensureDb();
    const row = await dbGet(db, "SELECT 1 FROM reviewed_files WHERE uri = ? AND nonce = ? LIMIT 1", [uri.toString(), nonce]);
    return !!row;
  }
  remapTurnIds(mapping, eventIds) {
    return this._mutateTurnUsage(async (db) => {
      await dbExec(db, "PRAGMA defer_foreign_keys = ON");
      await dbExec(db, "BEGIN TRANSACTION");
      try {
        const oldIds = [...mapping.keys()];
        if (oldIds.length > 0) {
          const placeholders = oldIds.map(() => "?").join(",");
          await dbRun(
            db,
            `DELETE FROM turns WHERE id NOT IN (${placeholders})`,
            oldIds
          );
        }
        for (const [oldId, newId] of mapping) {
          await dbRun(db, "UPDATE turns SET id = ? WHERE id = ?", [newId, oldId]);
          await dbRun(db, "UPDATE file_edits SET turn_id = ? WHERE turn_id = ?", [newId, oldId]);
        }
        for (const [turnId, eventId] of eventIds ?? []) {
          await dbRun(db, "UPDATE turns SET event_id = ? WHERE id = ?", [eventId, turnId]);
        }
        if (oldIds.length > 0) {
          const placeholders = oldIds.map(() => "?").join(",");
          await dbRun(
            db,
            `DELETE FROM local_turns WHERE turn_id NOT IN (${placeholders})`,
            oldIds
          );
        }
        for (const [oldId, newId] of mapping) {
          await dbRun(db, "UPDATE local_turns SET turn_id = ? WHERE turn_id = ?", [newId, oldId]);
          await dbRun(db, "UPDATE local_turns SET anchor_turn_id = ? WHERE anchor_turn_id = ?", [newId, oldId]);
        }
        for (const [oldId, newId] of mapping) {
          await dbRun(db, "UPDATE turn_usage SET turn_id = ? WHERE turn_id = ?", [newId, oldId]);
        }
        await dbExec(db, "COMMIT");
      } catch (err) {
        await dbExec(db, "ROLLBACK");
        throw err;
      }
    });
  }
  /**
   * Resolves once all currently in-flight write operations have settled.
   * Used by graceful shutdown to flush pending fire-and-forget writes
   * before the process exits. Should be called from a path where no
   * further writes are expected; loops until idle to also drain any
   * writes that get queued while we're awaiting.
   */
  async whenIdle() {
    while (this._pendingWrites.size > 0) {
      await Promise.allSettled([...this._pendingWrites]);
    }
  }
  async vacuumInto(targetPath) {
    const db = await this._ensureDb();
    await dbRun(db, "VACUUM INTO ?", [targetPath]);
  }
  /**
   * Wrap a mutating operation's promise so {@link whenIdle} can await it.
   * Invoke at the **outermost** layer of every public mutating method so
   * that any internal awaits (notably `_ensureDb()`) are covered too —
   * tracking only the leaf `dbRun`/`dbExec` would miss the window
   * between the method being called and the query actually being queued.
   */
  _track(fn) {
    const p = fn();
    this._pendingWrites.add(p);
    const untrack = () => {
      this._pendingWrites.delete(p);
    };
    p.then(untrack, untrack);
    return p;
  }
  async close() {
    await (this._closed ??= this._dbPromise?.then((db) => dbClose(db)).catch(() => {
    }) || true);
  }
  dispose() {
    this.close();
  }
}
function toReviewedFileRecord(row) {
  return {
    uri: URI.parse(row.uri),
    nonce: row.nonce
  };
}
function toUint8Array(value) {
  if (value instanceof Buffer) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  return new Uint8Array(0);
}
export {
  SessionDatabase,
  runMigrations,
  sessionDatabaseMigrations
};
