import { sum } from "../../../../../base/common/arrays.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
class TypingInterval extends Disposable {
  constructor(_textModel) {
    super();
    this._textModel = _textModel;
    this._typingSessions = [];
    this._currentSession = null;
    this._lastChangeTime = 0;
    this._cachedTypingIntervalResult = null;
    this._cacheInvalidated = true;
    this._register(this._textModel.onDidChangeContent((e) => this._updateTypingSpeed(e)));
  }
  static {
    // Configuration constants
    this.MAX_SESSION_GAP_MS = 3e3;
  }
  static {
    // 3 seconds max gap between keystrokes in a session
    this.MIN_SESSION_DURATION_MS = 1e3;
  }
  static {
    // Minimum session duration to consider
    this.SESSION_HISTORY_LIMIT = 50;
  }
  static {
    // Keep last 50 sessions for calculation
    this.TYPING_SPEED_WINDOW_MS = 3e5;
  }
  static {
    // 5 minutes window for speed calculation
    this.MIN_CHARS_FOR_RELIABLE_SPEED = 20;
  }
  // Minimum characters needed for reliable speed calculation
  /**
   * Gets the current typing interval as average milliseconds between keystrokes
   * and the number of characters involved in the computation.
   * Higher interval values indicate slower typing.
   * Returns { interval: 0, characterCount: 0 } if no typing data is available.
   */
  getTypingInterval() {
    if (this._cacheInvalidated || this._cachedTypingIntervalResult === null) {
      this._cachedTypingIntervalResult = this._calculateTypingInterval();
      this._cacheInvalidated = false;
    }
    return this._cachedTypingIntervalResult;
  }
  _updateTypingSpeed(change) {
    const now = Date.now();
    if (!this._isUserTyping(change)) {
      this._finalizeCurrentSession();
      return;
    }
    if (this._currentSession && now - this._lastChangeTime > TypingInterval.MAX_SESSION_GAP_MS) {
      this._finalizeCurrentSession();
    }
    if (!this._currentSession) {
      this._currentSession = {
        startTime: now,
        endTime: now,
        characterCount: 0
      };
    }
    this._currentSession.endTime = now;
    this._currentSession.characterCount += this._getActualCharacterCount(change);
    this._lastChangeTime = now;
    this._cacheInvalidated = true;
  }
  _getActualCharacterCount(change) {
    let totalChars = 0;
    for (const c of change.changes) {
      totalChars += Math.max(c.text.length, c.rangeLength);
    }
    return totalChars;
  }
  _isUserTyping(change) {
    if (!change.detailedReasons || change.detailedReasons.length === 0) {
      return false;
    }
    for (const reason of change.detailedReasons) {
      if (this._isUserTypingReason(reason)) {
        return true;
      }
    }
    return false;
  }
  _isUserTypingReason(reason) {
    if (reason.metadata.isUndoing || reason.metadata.isRedoing) {
      return false;
    }
    switch (reason.metadata.source) {
      case "cursor": {
        const kind = reason.metadata.kind;
        return kind === "type" || kind === "compositionType" || kind === "compositionEnd";
      }
      default:
        return false;
    }
  }
  _finalizeCurrentSession() {
    if (!this._currentSession) {
      return;
    }
    const sessionDuration = this._currentSession.endTime - this._currentSession.startTime;
    if (sessionDuration >= TypingInterval.MIN_SESSION_DURATION_MS && this._currentSession.characterCount > 0) {
      this._typingSessions.push(this._currentSession);
      if (this._typingSessions.length > TypingInterval.SESSION_HISTORY_LIMIT) {
        this._typingSessions.shift();
      }
    }
    this._currentSession = null;
  }
  _calculateTypingInterval() {
    if (this._currentSession) {
      const tempSession = { ...this._currentSession };
      const sessionDuration = tempSession.endTime - tempSession.startTime;
      if (sessionDuration >= TypingInterval.MIN_SESSION_DURATION_MS && tempSession.characterCount > 0) {
        const allSessions = [...this._typingSessions, tempSession];
        return this._calculateSpeedFromSessions(allSessions);
      }
    }
    return this._calculateSpeedFromSessions(this._typingSessions);
  }
  _calculateSpeedFromSessions(sessions) {
    if (sessions.length === 0) {
      return { averageInterval: 0, characterCount: 0 };
    }
    const sortedSessions = [...sessions].sort((a, b) => b.endTime - a.endTime);
    const cutoffTime = Date.now() - TypingInterval.TYPING_SPEED_WINDOW_MS;
    const recentSessions = sortedSessions.filter((session) => session.endTime > cutoffTime);
    const olderSessions = sortedSessions.splice(recentSessions.length);
    let totalChars = sum(recentSessions.map((session) => session.characterCount));
    for (let i = 0; i < olderSessions.length && totalChars < TypingInterval.MIN_CHARS_FOR_RELIABLE_SPEED; i++) {
      recentSessions.push(olderSessions[i]);
      totalChars += olderSessions[i].characterCount;
    }
    const totalTime = sum(recentSessions.map((session) => session.endTime - session.startTime));
    if (totalTime === 0 || totalChars <= 1) {
      return { averageInterval: 0, characterCount: totalChars };
    }
    const keystrokeIntervals = Math.max(1, totalChars - 1);
    const avgMsBetweenKeystrokes = totalTime / keystrokeIntervals;
    return {
      averageInterval: Math.round(avgMsBetweenKeystrokes),
      characterCount: totalChars
    };
  }
  /**
   * Reset all typing speed data
   */
  reset() {
    this._typingSessions.length = 0;
    this._currentSession = null;
    this._lastChangeTime = 0;
    this._cachedTypingIntervalResult = null;
    this._cacheInvalidated = true;
  }
  dispose() {
    this._finalizeCurrentSession();
    super.dispose();
  }
}
export {
  TypingInterval
};
