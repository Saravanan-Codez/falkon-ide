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
import { Sequencer } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { joinPath } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { AgentsVoiceStorageKeys } from "./agentsVoice.js";
const IVoiceTranscriptStore = createDecorator("voiceTranscriptStore");
let VoiceTranscriptStore = class extends Disposable {
  constructor(fileService, storageService, userDataProfilesService, lifecycleService, logService) {
    super();
    this.fileService = fileService;
    this.storageService = storageService;
    this.lifecycleService = lifecycleService;
    this.logService = logService;
    this.writeQueue = new Sequencer();
    this.shuttingDown = false;
    this.storageRoot = joinPath(
      userDataProfilesService.defaultProfile.globalStorageHome,
      "voiceTranscripts"
    );
    this.indexCache = this.readIndexFromStorage();
    this._register(this.lifecycleService.onWillShutdown((e) => {
      this.shuttingDown = true;
      if (!this.pendingWrite) {
        return;
      }
      e.join(this.pendingWrite, {
        id: "join.voiceTranscriptStore",
        label: localize("join.voiceTranscriptStore", "Saving voice transcript")
      });
    }));
  }
  // --- Public API ---
  async appendTurn(userId, turn) {
    if (this.shuttingDown) {
      this.logService.warn(`VoiceTranscriptStore: ignoring appendTurn for ${userId} (shutting down)`);
      return;
    }
    const work = this.writeQueue.queue(() => this.doAppendTurn(userId, turn));
    this.pendingWrite = work;
    try {
      await work;
    } finally {
      if (this.pendingWrite === work) {
        this.pendingWrite = void 0;
      }
    }
  }
  async loadTurns(userId, opts) {
    const file = this.fileFor(userId);
    let raw;
    try {
      const content = await this.fileService.readFile(file);
      raw = content.value.toString();
    } catch (e) {
      if (toFileOperationResult(e) === FileOperationResult.FILE_NOT_FOUND) {
        return [];
      }
      this.logService.error(`VoiceTranscriptStore: failed to read transcript for ${userId}`, e);
      return [];
    }
    const turns = [];
    let sawLegacyEntry = false;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed.kind) {
          sawLegacyEntry = true;
          break;
        }
        if (opts?.since && parsed.timestamp && parsed.timestamp < opts.since) {
          continue;
        }
        turns.push(parsed);
      } catch (e) {
        this.logService.warn(`VoiceTranscriptStore: skipping malformed line in ${userId}.jsonl: ${e.message}`);
      }
    }
    if (sawLegacyEntry) {
      this.logService.info(`VoiceTranscriptStore: detected pre-timeline transcript for ${userId}, wiping for new schema`);
      await this.deleteAll(userId);
      return [];
    }
    if (opts?.limit !== void 0 && turns.length > opts.limit) {
      return turns.slice(turns.length - opts.limit);
    }
    return turns;
  }
  getIndexEntry(userId) {
    return this.indexCache.entries[userId];
  }
  async archiveUpTo(userId, cutoff) {
    const existing = this.indexCache.entries[userId];
    if (!existing) {
      return;
    }
    this.updateIndexEntry(userId, { ...existing, archivedBefore: cutoff });
  }
  async unarchive(userId) {
    const existing = this.indexCache.entries[userId];
    if (!existing) {
      return;
    }
    const { archivedBefore: _unused, ...rest } = existing;
    this.updateIndexEntry(userId, rest);
  }
  async deleteAll(userId) {
    const file = this.fileFor(userId);
    try {
      await this.fileService.del(file);
    } catch (e) {
      if (toFileOperationResult(e) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(`VoiceTranscriptStore: failed to delete transcript for ${userId}`, e);
      }
    }
    const next = { ...this.indexCache.entries };
    delete next[userId];
    this.indexCache = { ...this.indexCache, entries: next };
    this.flushIndex();
  }
  // --- Internals ---
  fileFor(userId) {
    const safe = userId.replace(/[^A-Za-z0-9-]/g, "_");
    if (!safe) {
      throw new Error("Invalid userId for transcript storage");
    }
    return joinPath(this.storageRoot, `${safe}.jsonl`);
  }
  async doAppendTurn(userId, turn) {
    const file = this.fileFor(userId);
    const line = JSON.stringify(turn) + "\n";
    try {
      try {
        await this.fileService.createFolder(this.storageRoot);
      } catch {
      }
      await this.fileService.writeFile(file, VSBuffer.fromString(line), { append: true });
    } catch (e) {
      this.logService.error(`VoiceTranscriptStore: failed to append turn for ${userId}`, e);
      return;
    }
    const existing = this.indexCache.entries[userId];
    const next = existing ? {
      ...existing,
      lastUpdatedAt: turn.timestamp,
      turnCount: existing.turnCount + 1
    } : {
      userId,
      createdAt: turn.timestamp,
      lastUpdatedAt: turn.timestamp,
      turnCount: 1
    };
    this.updateIndexEntry(userId, next);
  }
  updateIndexEntry(userId, entry) {
    this.indexCache = {
      ...this.indexCache,
      entries: { ...this.indexCache.entries, [userId]: entry }
    };
    this.flushIndex();
  }
  flushIndex() {
    try {
      this.storageService.store(
        AgentsVoiceStorageKeys.TranscriptIndex,
        JSON.stringify(this.indexCache),
        StorageScope.PROFILE,
        StorageTarget.MACHINE
      );
    } catch (e) {
      this.logService.error(`VoiceTranscriptStore: failed to flush transcript index`, e);
    }
  }
  readIndexFromStorage() {
    const raw = this.storageService.get(
      AgentsVoiceStorageKeys.TranscriptIndex,
      StorageScope.PROFILE
    );
    if (!raw) {
      return { entries: {}, version: 1 };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.entries && parsed.version === 1) {
        return parsed;
      }
      this.logService.warn("VoiceTranscriptStore: ignoring index with unknown shape, starting fresh");
    } catch (e) {
      this.logService.warn("VoiceTranscriptStore: failed to parse stored index, starting fresh", e);
    }
    return { entries: {}, version: 1 };
  }
};
VoiceTranscriptStore = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IUserDataProfilesService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, ILogService)
], VoiceTranscriptStore);
registerSingleton(IVoiceTranscriptStore, VoiceTranscriptStore, InstantiationType.Delayed);
export {
  IVoiceTranscriptStore,
  VoiceTranscriptStore
};
