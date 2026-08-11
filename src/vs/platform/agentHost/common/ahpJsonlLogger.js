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
import { VSBuffer } from "../../../base/common/buffer.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { joinPath } from "../../../base/common/resources.js";
import { isUriComponents, URI } from "../../../base/common/uri.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
const AHP_LOG_DIR = "ahp";
const DEFAULT_MAX_FILE_SIZE_BYTES = 75 * 1024 * 1024;
const DEFAULT_MAX_FILES = 5;
const MAX_BATCH_BYTES = 1024 * 1024;
const MAX_LOG_LINE_LENGTH = 1024 * 1024;
const MAX_LOGGED_STRING_LENGTH = 16 * 1024;
let AhpJsonlLogger = class extends Disposable {
  constructor(_options, _fileService, _logService) {
    super();
    this._options = _options;
    this._fileService = _fileService;
    this._logService = _logService;
    this._currentSize = 0;
    this._segment = 0;
    this._queue = Promise.resolve();
    this._pending = [];
    this._drainScheduled = false;
    this._directory = joinPath(this._options.logsHome, AHP_LOG_DIR);
    const safeConnectionId = sanitizeFilePart(this._options.connectionId).slice(0, 64);
    this._baseName = `ahp-${toFileTimestamp(/* @__PURE__ */ new Date())}-${safeConnectionId}.jsonl`;
    this._maxFileSizeBytes = this._options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
    this._maxFiles = this._options.maxFiles ?? DEFAULT_MAX_FILES;
    this._currentFile = joinPath(this._directory, this._baseName);
  }
  get resource() {
    return this._currentFile;
  }
  log(message, dir, byteLength) {
    const meta = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      dir,
      connectionId: this._options.connectionId,
      transport: this._options.transport,
      ...typeof byteLength === "number" ? { byteLength } : {}
    };
    const entry = { ...message, _ahpLog: meta };
    let body = stringifyAhpLogEntry(entry);
    if (body.length > MAX_LOG_LINE_LENGTH) {
      meta.truncated = true;
      body = stringifyAhpLogEntryTruncated(entry, MAX_LOGGED_STRING_LENGTH);
    }
    const line = `${body}
`;
    this._pending.push(VSBuffer.fromString(line));
    this._scheduleDrain();
  }
  async flush() {
    await this._queue;
  }
  _scheduleDrain() {
    if (this._drainScheduled) {
      return;
    }
    this._drainScheduled = true;
    this._queue = this._queue.then(() => this._drainPending()).catch((error) => {
      this._logService.error("[AHPLog] Failed to write transport log", error);
    });
  }
  async _drainPending() {
    this._drainScheduled = false;
    if (this._pending.length === 0) {
      return;
    }
    const buffers = this._pending;
    this._pending = [];
    if (!this._folderCreated) {
      this._folderCreated = this._fileService.createFolder(this._directory);
    }
    await this._folderCreated;
    if (this._currentSize === 0) {
      this._currentSize = await this._getFileSize(this._currentFile);
    }
    let chunk = [];
    let chunkSize = 0;
    const flushChunk = async () => {
      if (chunk.length === 0) {
        return;
      }
      const combined = chunk.length === 1 ? chunk[0] : VSBuffer.concat(chunk, chunkSize);
      await this._fileService.writeFile(this._currentFile, combined, { append: true });
      this._currentSize += combined.byteLength;
      chunk = [];
      chunkSize = 0;
    };
    for (const buffer of buffers) {
      const totalInFile = this._currentSize + chunkSize;
      if (totalInFile > 0 && totalInFile + buffer.byteLength > this._maxFileSizeBytes) {
        await flushChunk();
        await this._rotate();
      } else if (chunkSize > 0 && chunkSize + buffer.byteLength > MAX_BATCH_BYTES) {
        await flushChunk();
      }
      chunk.push(buffer);
      chunkSize += buffer.byteLength;
    }
    await flushChunk();
  }
  async _rotate() {
    this._segment++;
    const oldSegment = this._segment - this._maxFiles;
    if (oldSegment >= 0) {
      await this._fileService.del(this._resourceForSegment(oldSegment)).catch((error) => {
        this._logService.trace("[AHPLog] Failed to delete old transport log", error);
      });
    }
    this._currentFile = this._resourceForSegment(this._segment);
    this._currentSize = await this._getFileSize(this._currentFile);
  }
  _resourceForSegment(segment) {
    if (segment === 0) {
      return joinPath(this._directory, this._baseName);
    }
    const currentBaseName = this._baseName.slice(0, -".jsonl".length);
    return joinPath(this._directory, `${currentBaseName}.${segment}.jsonl`);
  }
  async _getFileSize(resource) {
    try {
      return (await this._fileService.resolve(resource)).size ?? 0;
    } catch {
      return 0;
    }
  }
};
AhpJsonlLogger = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], AhpJsonlLogger);
function getAhpLogByteLength(text) {
  return VSBuffer.fromString(text).byteLength;
}
function stringifyAhpLogEntry(value) {
  return JSON.stringify(value, _ahpReplacer);
}
function stringifyAhpLogEntryTruncated(value, maxStringLength) {
  return JSON.stringify(value, function(key, val) {
    const revived = _ahpReplacer.call(this, key, val);
    if (typeof revived === "string" && revived.length > maxStringLength) {
      return `${revived.slice(0, maxStringLength)}\u2026[${revived.length - maxStringLength} more chars elided]`;
    }
    return revived;
  });
}
function _ahpReplacer(_key, value) {
  if (value && typeof value === "object" && value.$mid === MarshalledId.Uri && isUriComponents(value)) {
    return URI.revive(value).toString();
  }
  return value;
}
function toFileTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}
function sanitizeFilePart(value) {
  return value.replace(/[\\/:\*\?"<>\|\s]+/g, "-").replace(/^-+|-+$/g, "") || "connection";
}
export {
  AhpJsonlLogger,
  getAhpLogByteLength,
  stringifyAhpLogEntry
};
