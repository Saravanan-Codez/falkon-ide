import { URI } from "../../../base/common/uri.js";
class AgentHostLocalTurns {
  constructor(_sessionDataService, _logService) {
    this._sessionDataService = _sessionDataService;
    this._logService = _logService;
    /** chat URI → (localTurnId → { anchorTurnId, seq }). */
    this._byChat = /* @__PURE__ */ new Map();
    /** session URI → highest `seq` assigned so far (seq is session-global for stable ordering). */
    this._seqBySession = /* @__PURE__ */ new Map();
  }
  /** Whether `turnId` is a known host-injected local turn in `chat`. */
  isLocal(chat, turnId) {
    return this._byChat.get(chat)?.has(turnId) ?? false;
  }
  /** All known local turn ids for `chat`. */
  getLocalTurnIds(chat) {
    const map = this._byChat.get(chat);
    return map ? [...map.keys()] : [];
  }
  /**
   * Resolves `turnId` to the concrete (SDK-backed) turn a fork/truncate should
   * operate on within `chat`. For a local turn this is its anchor (the
   * preceding real turn, or `undefined` when it precedes any real turn); for a
   * concrete turn it is the turn itself.
   */
  resolveConcreteTurnId(chat, turnId) {
    const entry = this._byChat.get(chat)?.get(turnId);
    return entry ? entry.anchorTurnId : turnId;
  }
  /**
   * Persist a local turn and remember it in memory. `anchorTurnId` is the id
   * of the preceding concrete turn in `chat` (or `undefined` when there is
   * none). `session` identifies the database to persist into.
   */
  record(session, chat, turn, anchorTurnId) {
    const seq = (this._seqBySession.get(session) ?? 0) + 1;
    this._noteInMemory(session, chat, turn.id, anchorTurnId, seq);
    const record = { turnId: turn.id, chatUri: chat, anchorTurnId, seq, payload: JSON.stringify(turn) };
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(URI.parse(session));
    } catch (err) {
      this._logService.warn(`[AgentHostLocalTurns] Failed to open database to persist local turn ${turn.id}`, err);
      return;
    }
    ref.object.insertLocalTurn(record).catch((err) => {
      this._logService.warn(`[AgentHostLocalTurns] Failed to persist local turn ${turn.id}`, err);
    }).finally(() => ref.dispose());
  }
  /**
   * Loads persisted local turns for `session`, populating the in-memory index
   * (keyed by each record's chat), and returns the records for `chat` in
   * `seq` order so the caller can interleave them into that chat's SDK-derived
   * turns during restore.
   */
  async loadForChat(session, chat) {
    const records = await this._load(session);
    return records.filter((r) => r.chatUri === chat);
  }
  /** Note a local turn in memory only (used by fork seeding). */
  noteInMemory(session, chat, turnId, anchorTurnId, seq) {
    this._noteInMemory(session, chat, turnId, anchorTurnId, seq);
  }
  /** Delete the given local turns from memory and the session database. */
  deleteLocals(session, turnIds) {
    if (turnIds.length === 0) {
      return;
    }
    const idSet = new Set(turnIds);
    for (const map of this._byChat.values()) {
      for (const id of idSet) {
        map.delete(id);
      }
    }
    let ref;
    try {
      ref = this._sessionDataService.openDatabase(URI.parse(session));
    } catch (err) {
      this._logService.warn(`[AgentHostLocalTurns] Failed to open database to delete local turns for ${session}`, err);
      return;
    }
    ref.object.deleteLocalTurns(turnIds).catch((err) => {
      this._logService.warn(`[AgentHostLocalTurns] Failed to delete local turns for ${session}`, err);
    }).finally(() => ref.dispose());
  }
  /** Drop all in-memory state for a chat. */
  forgetChat(chat) {
    this._byChat.delete(chat);
  }
  async _load(session) {
    const ref = this._sessionDataService.tryOpenDatabase?.(URI.parse(session));
    if (!ref) {
      return [];
    }
    try {
      const db = await ref;
      if (!db) {
        return [];
      }
      try {
        const records = await db.object.getLocalTurns();
        for (const r of records) {
          this._noteInMemory(session, r.chatUri, r.turnId, r.anchorTurnId, r.seq);
        }
        return records;
      } finally {
        db.dispose();
      }
    } catch (err) {
      this._logService.warn(`[AgentHostLocalTurns] Failed to load local turns for ${session}`, err);
      return [];
    }
  }
  _noteInMemory(session, chat, turnId, anchorTurnId, seq) {
    let map = this._byChat.get(chat);
    if (!map) {
      map = /* @__PURE__ */ new Map();
      this._byChat.set(chat, map);
    }
    map.set(turnId, { anchorTurnId, seq });
    this._seqBySession.set(session, Math.max(this._seqBySession.get(session) ?? 0, seq));
  }
}
export {
  AgentHostLocalTurns
};
