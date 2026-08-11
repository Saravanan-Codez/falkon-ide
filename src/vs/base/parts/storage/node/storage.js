import * as fs from "fs";
import { timeout } from "../../../common/async.js";
import { Event } from "../../../common/event.js";
import { mapToString, setToString } from "../../../common/map.js";
import { basename } from "../../../common/path.js";
import { Promises } from "../../../node/pfs.js";
class SQLiteStorageDatabase {
  constructor(path, options = /* @__PURE__ */ Object.create(null)) {
    this.path = path;
    this.name = basename(this.path);
    this.logger = new SQLiteStorageDatabaseLogger(options.logging);
    this.useWAL = !!options.useWAL;
    this.busyTimeout = options.busyTimeout;
    this.whenConnected = this.connect(this.path);
  }
  static {
    this.IN_MEMORY_PATH = ":memory:";
  }
  get onDidChangeItemsExternal() {
    return Event.None;
  }
  static {
    // since we are the only client, there can be no external changes
    this.BUSY_OPEN_TIMEOUT = 2e3;
  }
  static {
    // timeout in ms to retry when opening DB fails with SQLITE_BUSY
    this.MAX_HOST_PARAMETERS = 256;
  }
  async getItems() {
    const connection = await this.whenConnected;
    const items = /* @__PURE__ */ new Map();
    const rows = await this.all(connection, "SELECT * FROM ItemTable");
    rows.forEach((row) => items.set(row.key, row.value));
    if (this.logger.isTracing) {
      this.logger.trace(`[storage ${this.name}] getItems(): ${items.size} rows`);
    }
    return items;
  }
  async updateItems(request) {
    const connection = await this.whenConnected;
    return this.doUpdateItems(connection, request);
  }
  doUpdateItems(connection, request) {
    if (this.logger.isTracing) {
      this.logger.trace(`[storage ${this.name}] updateItems(): insert(${request.insert ? mapToString(request.insert) : "0"}), delete(${request.delete ? setToString(request.delete) : "0"})`);
    }
    return this.transaction(connection, () => {
      const toInsert = request.insert;
      const toDelete = request.delete;
      if (toInsert && toInsert.size > 0) {
        const keysValuesChunks = [];
        keysValuesChunks.push([]);
        let currentChunkIndex = 0;
        toInsert.forEach((value, key) => {
          let keyValueChunk = keysValuesChunks[currentChunkIndex];
          if (keyValueChunk.length > SQLiteStorageDatabase.MAX_HOST_PARAMETERS) {
            currentChunkIndex++;
            keyValueChunk = [];
            keysValuesChunks.push(keyValueChunk);
          }
          keyValueChunk.push(key, value);
        });
        keysValuesChunks.forEach((keysValuesChunk) => {
          this.prepare(connection, `INSERT INTO ItemTable VALUES ${new Array(keysValuesChunk.length / 2).fill("(?,?)").join(",")} ON CONFLICT (key) DO UPDATE SET value = excluded.value WHERE value != excluded.value`, (stmt) => stmt.run(keysValuesChunk), () => {
            const keys = [];
            let length = 0;
            toInsert.forEach((value, key) => {
              keys.push(key);
              length += value.length;
            });
            return `Keys: ${keys.join(", ")} Length: ${length}`;
          });
        });
      }
      if (toDelete?.size) {
        const keysChunks = [];
        keysChunks.push([]);
        let currentChunkIndex = 0;
        toDelete.forEach((key) => {
          let keyChunk = keysChunks[currentChunkIndex];
          if (keyChunk.length > SQLiteStorageDatabase.MAX_HOST_PARAMETERS) {
            currentChunkIndex++;
            keyChunk = [];
            keysChunks.push(keyChunk);
          }
          keyChunk.push(key);
        });
        keysChunks.forEach((keysChunk) => {
          this.prepare(connection, `DELETE FROM ItemTable WHERE key IN (${new Array(keysChunk.length).fill("?").join(",")})`, (stmt) => stmt.run(keysChunk), () => {
            const keys = [];
            toDelete.forEach((key) => {
              keys.push(key);
            });
            return `Keys: ${keys.join(", ")}`;
          });
        });
      }
    });
  }
  async optimize() {
    this.logger.trace(`[storage ${this.name}] vacuum()`);
    const connection = await this.whenConnected;
    return this.exec(connection, "VACUUM");
  }
  async close(recovery) {
    this.logger.trace(`[storage ${this.name}] close()`);
    const connection = await this.whenConnected;
    return this.doClose(connection, recovery);
  }
  doClose(connection, recovery) {
    return new Promise((resolve, reject) => {
      connection.db.close((closeError) => {
        if (closeError) {
          this.handleSQLiteError(connection, `[storage ${this.name}] close(): ${closeError}`);
        }
        if (this.path === SQLiteStorageDatabase.IN_MEMORY_PATH) {
          return resolve();
        }
        if (!connection.isErroneous && !connection.isInMemory) {
          return this.backup().then(resolve, (error) => {
            this.logger.error(`[storage ${this.name}] backup(): ${error}`);
            return resolve();
          });
        }
        if (typeof recovery === "function") {
          return fs.promises.unlink(this.path).then(() => {
            return this.doConnect(this.path).then((recoveryConnection) => {
              const closeRecoveryConnection = () => {
                return this.doClose(
                  recoveryConnection,
                  void 0
                  /* do not attempt to recover again */
                );
              };
              return this.doUpdateItems(recoveryConnection, { insert: recovery() }).then(() => closeRecoveryConnection(), (error) => {
                closeRecoveryConnection();
                return Promise.reject(error);
              });
            });
          }).then(resolve, reject);
        }
        return reject(closeError || new Error("Database has errors or is in-memory without recovery option"));
      });
    });
  }
  backup() {
    const backupPath = this.toBackupPath(this.path);
    return Promises.copy(this.path, backupPath, { preserveSymlinks: false });
  }
  toBackupPath(path) {
    return `${path}.backup`;
  }
  async checkIntegrity(full) {
    this.logger.trace(`[storage ${this.name}] checkIntegrity(full: ${full})`);
    const connection = await this.whenConnected;
    const row = await this.get(connection, full ? "PRAGMA integrity_check" : "PRAGMA quick_check");
    const integrity = full ? row.integrity_check : row.quick_check;
    if (connection.isErroneous) {
      return `${integrity} (last error: ${connection.lastError})`;
    }
    if (connection.isInMemory) {
      return `${integrity} (in-memory!)`;
    }
    return integrity;
  }
  async connect(path, retryOnBusy = true) {
    this.logger.trace(`[storage ${this.name}] open(${path}, retryOnBusy: ${retryOnBusy})`);
    try {
      return await this.doConnect(path);
    } catch (error) {
      this.logger.error(`[storage ${this.name}] open(): Unable to open DB due to ${error}`);
      if (error.code === "SQLITE_BUSY" && retryOnBusy) {
        await timeout(SQLiteStorageDatabase.BUSY_OPEN_TIMEOUT);
        return this.connect(
          path,
          false
          /* not another retry */
        );
      }
      try {
        await fs.promises.unlink(path);
        try {
          await Promises.rename(
            this.toBackupPath(path),
            path,
            false
            /* no retry */
          );
        } catch {
        }
        return await this.doConnect(path);
      } catch (error2) {
        this.logger.error(`[storage ${this.name}] open(): Unable to use backup due to ${error2}`);
        return this.doConnect(SQLiteStorageDatabase.IN_MEMORY_PATH);
      }
    }
  }
  handleSQLiteError(connection, msg) {
    connection.isErroneous = true;
    connection.lastError = msg;
    this.logger.error(msg);
  }
  doConnect(path) {
    return new Promise((resolve, reject) => {
      import("@vscode/sqlite3").then((sqlite3) => {
        const ctor = this.logger.isTracing ? sqlite3.default.verbose().Database : sqlite3.default.Database;
        const connection = {
          db: new ctor(path, (error) => {
            if (error) {
              return connection.db && error.code !== "SQLITE_CANTOPEN" ? connection.db.close(() => reject(error)) : reject(error);
            }
            const pragmas = [
              "PRAGMA user_version = 1;",
              "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB);"
            ];
            if (this.useWAL) {
              pragmas.push("PRAGMA journal_mode=WAL;");
            }
            if (this.busyTimeout) {
              pragmas.push(`PRAGMA busy_timeout=${this.busyTimeout};`);
            }
            return this.exec(connection, pragmas.join("")).then(() => {
              return resolve(connection);
            }, (error2) => {
              return connection.db.close(() => reject(error2));
            });
          }),
          isInMemory: path === SQLiteStorageDatabase.IN_MEMORY_PATH
        };
        connection.db.on("error", (error) => this.handleSQLiteError(connection, `[storage ${this.name}] Error (event): ${error}`));
        if (this.logger.isTracing) {
          connection.db.on("trace", (sql) => this.logger.trace(`[storage ${this.name}] Trace (event): ${sql}`));
        }
      }, reject);
    });
  }
  exec(connection, sql) {
    return new Promise((resolve, reject) => {
      connection.db.exec(sql, (error) => {
        if (error) {
          this.handleSQLiteError(connection, `[storage ${this.name}] exec(): ${error}`);
          return reject(error);
        }
        return resolve();
      });
    });
  }
  get(connection, sql) {
    return new Promise((resolve, reject) => {
      connection.db.get(sql, (error, row) => {
        if (error) {
          this.handleSQLiteError(connection, `[storage ${this.name}] get(): ${error}`);
          return reject(error);
        }
        return resolve(row);
      });
    });
  }
  all(connection, sql) {
    return new Promise((resolve, reject) => {
      connection.db.all(sql, (error, rows) => {
        if (error) {
          this.handleSQLiteError(connection, `[storage ${this.name}] all(): ${error}`);
          return reject(error);
        }
        return resolve(rows);
      });
    });
  }
  transaction(connection, transactions) {
    return new Promise((resolve, reject) => {
      connection.db.serialize(() => {
        connection.db.run("BEGIN TRANSACTION");
        transactions();
        connection.db.run("END TRANSACTION", (error) => {
          if (error) {
            this.handleSQLiteError(connection, `[storage ${this.name}] transaction(): ${error}`);
            return reject(error);
          }
          return resolve();
        });
      });
    });
  }
  prepare(connection, sql, runCallback, errorDetails) {
    const stmt = connection.db.prepare(sql);
    const statementErrorListener = (error) => {
      this.handleSQLiteError(connection, `[storage ${this.name}] prepare(): ${error} (${sql}). Details: ${errorDetails()}`);
    };
    stmt.on("error", statementErrorListener);
    runCallback(stmt);
    stmt.finalize((error) => {
      if (error) {
        statementErrorListener(error);
      }
      stmt.removeListener("error", statementErrorListener);
    });
  }
}
class SQLiteStorageDatabaseLogger {
  static {
    // to reduce lots of output, require an environment variable to enable tracing
    // this helps when running with --verbose normally where the storage tracing
    // might hide useful output to look at
    this.VSCODE_TRACE_STORAGE = "VSCODE_TRACE_STORAGE";
  }
  constructor(options) {
    if (options && typeof options.logTrace === "function" && process.env[SQLiteStorageDatabaseLogger.VSCODE_TRACE_STORAGE]) {
      this.logTrace = options.logTrace;
    }
    if (options && typeof options.logError === "function") {
      this.logError = options.logError;
    }
  }
  get isTracing() {
    return !!this.logTrace;
  }
  trace(msg) {
    this.logTrace?.(msg);
  }
  error(error) {
    this.logError?.(error);
  }
}
export {
  SQLiteStorageDatabase
};
