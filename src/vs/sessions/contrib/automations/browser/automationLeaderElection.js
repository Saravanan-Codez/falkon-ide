import { IntervalTimer } from "../../../../base/common/async.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
const LEADER_KEY = "chat.automations.leader";
const DEFAULT_HEARTBEAT_INTERVAL_MS = 3e4;
const DEFAULT_STALE_AFTER_MS = 9e4;
class AutomationLeaderElection extends Disposable {
  constructor(storageService, logService, options = {}) {
    super();
    this.storageService = storageService;
    this.logService = logService;
    this._timer = this._register(new IntervalTimer());
    this._instanceId = options.instanceId ?? generateUuid();
    this._heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this._staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    this._now = options.now ?? Date.now;
    this._isLeader = observableValue(this, false);
    this.isLeader = this._isLeader;
    this._register(toDisposable(() => this.releaseIfLeader()));
    this.evaluate();
    this._timer.cancelAndSet(() => this.evaluate(), this._heartbeatIntervalMs);
  }
  get instanceId() {
    return this._instanceId;
  }
  /** Test-only: drive the evaluation cycle synchronously. */
  evaluateForTesting() {
    this.evaluate();
  }
  evaluate() {
    const now = this._now();
    const current = this.readLeader();
    const claimable = !current || current.instanceId === this._instanceId || current.instanceId === "" || now - current.heartbeatAt > this._staleAfterMs;
    if (!claimable) {
      if (this._isLeader.get()) {
        this.logService.info(`[AutomationLeaderElection] window ${this._instanceId} stood down for ${current.instanceId}.`);
      }
      this._isLeader.set(false, void 0);
      return;
    }
    const nonce = generateUuid();
    const writeOk = this.writeLeader({ instanceId: this._instanceId, heartbeatAt: now, nonce });
    if (!writeOk) {
      this._isLeader.set(false, void 0);
      return;
    }
    const verify = this.readLeader();
    if (verify?.instanceId === this._instanceId && verify.nonce === nonce) {
      if (!this._isLeader.get()) {
        this.logService.info(`[AutomationLeaderElection] window ${this._instanceId} claimed leader slot.`);
      }
      this._isLeader.set(true, void 0);
    } else {
      if (this._isLeader.get()) {
        this.logService.info(`[AutomationLeaderElection] window ${this._instanceId} lost leader race to ${verify?.instanceId ?? "<none>"}.`);
      }
      this._isLeader.set(false, void 0);
    }
  }
  readLeader() {
    let raw;
    try {
      raw = this.storageService.get(LEADER_KEY, StorageScope.APPLICATION);
    } catch (err) {
      this.logService.warn("[AutomationLeaderElection] storage read failed", err);
      return void 0;
    }
    if (!raw) {
      return void 0;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.instanceId !== "string" || typeof parsed?.heartbeatAt !== "number") {
        return void 0;
      }
      return { instanceId: parsed.instanceId, heartbeatAt: parsed.heartbeatAt, nonce: typeof parsed.nonce === "string" ? parsed.nonce : "" };
    } catch {
      return void 0;
    }
  }
  /** Returns true if the write succeeded, false if storage threw. */
  writeLeader(record) {
    try {
      this.storageService.store(LEADER_KEY, JSON.stringify(record), StorageScope.APPLICATION, StorageTarget.MACHINE);
      return true;
    } catch (err) {
      this.logService.warn("[AutomationLeaderElection] storage write failed", err);
      return false;
    }
  }
  // Write a tombstone on clean shutdown so the next window can claim immediately.
  releaseIfLeader() {
    const current = this.readLeader();
    if (current?.instanceId !== this._instanceId) {
      return;
    }
    this.writeLeader({ instanceId: "", heartbeatAt: 0, nonce: "" });
  }
}
export {
  AutomationLeaderElection,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_STALE_AFTER_MS
};
