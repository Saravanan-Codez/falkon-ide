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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { Language } from "../../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import {
  IVoiceClientService,
  isVoiceCheckpointId,
  normalizeAgentsVoiceId
} from "../../common/voiceClient/voiceClientService.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
const PING_INTERVAL_MS = 25e3;
const PONG_TIMEOUT_MS = 1e4;
const FAST_RETRY_COUNT = 3;
const FAST_RETRY_DELAY_MS = 2e3;
const SLOW_RETRY_DELAY_MS = 3e4;
const MAX_RECONNECT_DURATION_MS = 30 * 60 * 1e3;
const TTS_SUPPORTED_LANGUAGE_BASES = /* @__PURE__ */ new Set([
  "en",
  "de",
  "es",
  "fr",
  "it",
  "pt",
  "ja",
  "ko",
  "zh"
]);
const ASR_SUPPORTED_LANGUAGE_BASES = /* @__PURE__ */ new Set([
  "ar",
  "cs",
  "da",
  "de",
  "en",
  "es",
  "fi",
  "fr",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "nb",
  "nl",
  "pl",
  "pt",
  "ro",
  "ru",
  "sv",
  "th",
  "tr",
  "vi",
  "zh"
]);
const DEFAULT_LANGUAGE = "en-US";
function asOptionalString(value) {
  return typeof value === "string" ? value : void 0;
}
function asOptionalNonEmptyString(value) {
  const result = asOptionalString(value);
  return result && result.length > 0 ? result : void 0;
}
function canonicalizeSupportedLanguage(value, supportedBases) {
  const candidate = value?.trim();
  if (!candidate || typeof Intl.getCanonicalLocales !== "function") {
    return void 0;
  }
  try {
    const canonical = Intl.getCanonicalLocales(candidate)[0];
    return supportedBases.has(canonical.split("-")[0]) ? canonical : void 0;
  } catch {
    return void 0;
  }
}
function resolveAutomaticVoiceLanguage(browserLanguage, displayLanguage) {
  return canonicalizeSupportedLanguage(displayLanguage, ASR_SUPPORTED_LANGUAGE_BASES) ?? canonicalizeSupportedLanguage(browserLanguage, ASR_SUPPORTED_LANGUAGE_BASES) ?? DEFAULT_LANGUAGE;
}
function asTranscriptionStatus(value) {
  return value === "partial" || value === "final" ? value : void 0;
}
function asTranscriptionRevision(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : void 0;
}
let VoiceClientService = class extends Disposable {
  constructor(_configurationService, _logService, _productService) {
    super();
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._productService = _productService;
    this._reconnectAttempts = 0;
    this._isConnected = false;
    this._isResuming = false;
    // Set once start_session/resume_session (which carries session_context) has
    // been sent on the current connection; reset per connection. Gates
    // `_sendSetLanguage` and `requestNarration` so the backend has the session
    // before those follow-up messages are sent.
    this._sessionStartedOnSocket = false;
    this._lastSentById = /* @__PURE__ */ new Map();
    // session id → last-sent field values
    this._invalidatedSessionIds = /* @__PURE__ */ new Set();
    // --- Events ---
    this._onTranscription = this._register(new Emitter());
    this.onTranscription = this._onTranscription.event;
    this._onAudioResponse = this._register(new Emitter());
    this.onAudioResponse = this._onAudioResponse.event;
    this._onBargeIn = this._register(new Emitter());
    this.onBargeIn = this._onBargeIn.event;
    this._onNarrationAck = this._register(new Emitter());
    this.onNarrationAck = this._onNarrationAck.event;
    this._onNarrationUnblocked = this._register(new Emitter());
    this.onNarrationUnblocked = this._onNarrationUnblocked.event;
    this._onNarrationInterrupted = this._register(new Emitter());
    this.onNarrationInterrupted = this._onNarrationInterrupted.event;
    this._onToolCall = this._register(new Emitter());
    this.onToolCall = this._onToolCall.event;
    this._onSpeechStarted = this._register(new Emitter());
    this.onSpeechStarted = this._onSpeechStarted.event;
    this._onSessionInit = this._register(new Emitter());
    this.onSessionInit = this._onSessionInit.event;
    this._onError = this._register(new Emitter());
    this.onError = this._onError.event;
    this._onDidChangeConnectionState = this._register(new Emitter());
    this.onDidChangeConnectionState = this._onDidChangeConnectionState.event;
    this._onFatalDisconnect = this._register(new Emitter());
    this.onFatalDisconnect = this._onFatalDisconnect.event;
    this._onTurnAutoEnded = this._register(new Emitter());
    this.onTurnAutoEnded = this._onTurnAutoEnded.event;
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("agents.voice.turn.silenceMs") || e.affectsConfiguration("agents.voice.turn.stopPhrases") || e.affectsConfiguration("agents.voice.handsFree")) {
        this._sendSetTurnConfig();
      }
      if (e.affectsConfiguration("agents.voice.voice")) {
        this._sendSetVoice();
      }
      if (e.affectsConfiguration("agents.voice.language")) {
        this._sendSetLanguage();
      }
    }));
  }
  get isConnected() {
    return this._isConnected;
  }
  get isResuming() {
    return this._isResuming;
  }
  get willReconnect() {
    return this._reconnectTimer !== void 0;
  }
  get currentSessionId() {
    return this._lastSessionId;
  }
  _getVoice() {
    return normalizeAgentsVoiceId(this._configurationService.getValue("agents.voice.voice"));
  }
  _sendSetVoice() {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "set_voice", voice: this._getVoice() }));
    }
  }
  _getLanguage() {
    const configured = this._configurationService.getValue("agents.voice.language");
    if (typeof configured === "string" && configured.trim().toLowerCase() !== "auto") {
      const language = canonicalizeSupportedLanguage(configured, TTS_SUPPORTED_LANGUAGE_BASES);
      if (language) {
        return language;
      }
      this._logService.warn(`[voice] Unsupported agents.voice.language value '${configured}', falling back to ${DEFAULT_LANGUAGE}`);
      return DEFAULT_LANGUAGE;
    }
    return resolveAutomaticVoiceLanguage(this._window?.navigator.language, Language.value());
  }
  _sendSetLanguage() {
    if (this._ws?.readyState === WebSocket.OPEN && this._sessionStartedOnSocket) {
      this._ws.send(JSON.stringify({ type: "set_language", language: this._getLanguage() }));
    }
  }
  /**
   * Whether a configuration setting has an explicit user/workspace/application
   * value, as opposed to falling back to its registered default.
   */
  _isExplicitlyConfigured(key) {
    const inspected = this._configurationService.inspect(key);
    return inspected.userValue !== void 0 || inspected.userLocalValue !== void 0 || inspected.userRemoteValue !== void 0 || inspected.workspaceValue !== void 0 || inspected.workspaceFolderValue !== void 0 || inspected.applicationValue !== void 0;
  }
  /**
   * Assemble the ``turn_config`` wire object from the ``agents.voice.turn.*``
   * settings, normalizing each into the shape the backend expects. The
   * ``auto_end_mode`` is derived from the other two settings: trailing-silence
   * ending is enabled unless ``silenceMs`` is ``-1`` (or otherwise non-positive),
   * and stop-phrase ending is enabled when at least one phrase is configured.
   *
   * When hands-free mode (``agents.voice.handsFree``) is disabled, the turn is
   * not sent automatically by default: trailing-silence and stop-phrase ending
   * are each suppressed unless the corresponding setting has been explicitly
   * configured, so a user who opts out of the hands-free loop keeps manual
   * control over when a turn is sent.
   */
  _getTurnConfig() {
    const cfg = this._configurationService;
    const handsFree = cfg.getValue("agents.voice.handsFree") === true;
    const silenceRaw = cfg.getValue("agents.voice.turn.silenceMs");
    let silenceEnabled = typeof silenceRaw === "number" && silenceRaw > 0;
    if (!handsFree && !this._isExplicitlyConfigured("agents.voice.turn.silenceMs")) {
      silenceEnabled = false;
    }
    const silence_ms = silenceEnabled ? Math.round(silenceRaw) : 800;
    const phrasesRaw = cfg.getValue("agents.voice.turn.stopPhrases");
    const stop_phrases = Array.isArray(phrasesRaw) ? phrasesRaw.map((p) => String(p).trim()).filter((p) => p.length > 0) : [];
    let phrasesEnabled = stop_phrases.length > 0;
    if (!handsFree && !this._isExplicitlyConfigured("agents.voice.turn.stopPhrases")) {
      phrasesEnabled = false;
    }
    const auto_end_mode = silenceEnabled && phrasesEnabled ? "both" : silenceEnabled ? "vad" : phrasesEnabled ? "phrase" : "off";
    return { auto_end_mode, silence_ms, stop_phrases: phrasesEnabled ? stop_phrases : [], vad_gate_asr: true };
  }
  _sendSetTurnConfig() {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "set_turn_config", turn_config: this._getTurnConfig() }));
    }
  }
  _getWsUrl() {
    const configured = this._configurationService.getValue("agents.voice.backendUrl");
    const url = typeof configured === "string" ? configured.trim() : "";
    return url || this._productService.voiceWsUrl || "";
  }
  async connect(window, authToken) {
    this._window = window;
    this._authToken = authToken;
    this._reconnectAttempts = 0;
    this._connectWebSocket();
  }
  _connectWebSocket() {
    const win = this._window;
    if (!win) {
      return;
    }
    const baseUrl = this._getWsUrl();
    if (!baseUrl) {
      this._logService.error("[voice] No voice WebSocket URL configured (set voiceWsUrl in product.json or agents.voice.backendUrl in settings)");
      return;
    }
    const url = this._authToken ? `${baseUrl}?token=${encodeURIComponent(this._authToken)}` : baseUrl;
    const ws = new win.WebSocket(url);
    this._ws = ws;
    this._sessionStartedOnSocket = false;
    ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._reconnectStartedAt = void 0;
      this._isResuming = !!this._lastSessionId;
      this._sessionStartedOnSocket = false;
      this._setConnected(true);
      this._startPing();
      if (this._lastSessionId) {
      }
    };
    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "pong":
          this._clearPongTimeout();
          break;
        case "session_init":
          this._lastSessionId = msg.session_id;
          this._isResuming = false;
          this._onSessionInit.fire({ sessionId: msg.session_id ?? "" });
          break;
        case "session_resumed":
          this._lastSessionId = msg.session_id;
          this._isResuming = false;
          this._onSessionInit.fire({ sessionId: msg.session_id ?? "" });
          break;
        case "speech_started":
          this._onSpeechStarted.fire({ turnId: asOptionalString(msg.turn_id) });
          break;
        case "barge_in":
          this._onBargeIn.fire({
            turnId: asOptionalString(msg.turn_id) ?? "",
            interruptedTurnId: msg.interrupted_turn_id ?? ""
          });
          break;
        case "narration_ack": {
          const disposition = msg.disposition === "busy" || msg.disposition === "invalid" || msg.disposition === "suppressed" ? msg.disposition : "accepted";
          this._onNarrationAck.fire({
            narrationId: msg.narration_id ?? "",
            codingSessionId: msg.coding_session_id ?? "",
            disposition,
            reason: msg.reason
          });
          break;
        }
        case "narration_unblocked":
          this._onNarrationUnblocked.fire({
            narrationId: msg.narration_id ?? "",
            codingSessionId: msg.coding_session_id ?? ""
          });
          break;
        case "narration_interrupted":
          this._onNarrationInterrupted.fire({
            narrationId: msg.narration_id ?? "",
            codingSessionId: msg.coding_session_id ?? "",
            ...typeof msg.retryable === "boolean" ? { retryable: msg.retryable } : {},
            ...msg.reason ? { reason: msg.reason } : {}
          });
          break;
        case "transcription": {
          const status = msg.status === void 0 ? "final" : asTranscriptionStatus(msg.status);
          const turnId = msg.turn_id === void 0 ? void 0 : asOptionalNonEmptyString(msg.turn_id);
          const revision = msg.revision === void 0 ? void 0 : asTranscriptionRevision(msg.revision);
          if (!status || msg.turn_id !== void 0 && !turnId || msg.revision !== void 0 && (!turnId || revision === void 0)) {
            break;
          }
          this._onTranscription.fire({
            text: asOptionalString(msg.text) ?? "",
            status,
            committed: asOptionalString(msg.committed) ?? "",
            turnId,
            revision
          });
          break;
        }
        case "audio_response": {
          const requestId = asOptionalString(msg.request_id);
          const checkpointId = isVoiceCheckpointId(msg.checkpoint_id) ? msg.checkpoint_id : void 0;
          const sequence = typeof msg.sequence === "number" && Number.isSafeInteger(msg.sequence) && msg.sequence > 0 ? msg.sequence : void 0;
          const narrationKind = msg.narration_kind === "response" || msg.narration_kind === "confirmation" || msg.narration_kind === "checkpoint" ? msg.narration_kind : void 0;
          const playbackId = asOptionalString(msg.playback_id);
          if (narrationKind === "checkpoint") {
            this._logService.info(`[voice] checkpoint audio request=${requestId ?? "none"} stage=${checkpointId ?? "none"} sequence=${sequence ?? "none"} first=${msg.is_first_chunk === void 0 ? true : Boolean(msg.is_first_chunk)} final=${Boolean(msg.is_final)}`);
          }
          this._onAudioResponse.fire({
            audio: msg.audio ?? "",
            isFirstChunk: msg.is_first_chunk === void 0 ? true : Boolean(msg.is_first_chunk),
            isFinal: msg.is_final ?? false,
            codingSessionId: msg.coding_session_id,
            transcript: msg.transcript,
            turnId: asOptionalString(msg.turn_id),
            responseId: msg.narration_id ?? asOptionalString(msg.turn_id),
            ...requestId ? { requestId } : {},
            ...checkpointId ? { checkpointId } : {},
            ...sequence !== void 0 ? { sequence } : {},
            ...narrationKind ? { narrationKind } : {},
            ...playbackId ? { playbackId } : {}
          });
          break;
        }
        case "tool_call":
          this._onToolCall.fire({
            callId: msg.call_id ?? "",
            name: msg.name ?? "",
            args: msg.args ?? {}
          });
          break;
        case "turn_auto_ended": {
          const reason = msg.reason === "stop_phrase" ? "stop_phrase" : "vad_silence";
          this._onTurnAutoEnded.fire({ reason, turnId: asOptionalString(msg.turn_id) ?? "" });
          break;
        }
        case "error":
          this._onError.fire(msg.detail ?? "Unknown error");
          break;
      }
    };
    ws.onerror = () => {
      this._onError.fire("WebSocket error");
    };
    ws.onclose = (evt) => {
      this._logService.trace(`[voice] ws.onclose code=${evt.code} reason=${evt.reason ?? ""} wasClean=${evt.wasClean}`);
      if (this._ws === ws) {
        if (evt.code === 1e3 || evt.code === 1001) {
          this._cleanup();
          return;
        }
        if (evt.code === 4001 || evt.code === 4008 || evt.code === 4029) {
          this._logService.warn(`[voice] fatal close code ${evt.code}: ${evt.reason}, not reconnecting`);
          this._onFatalDisconnect.fire({ code: evt.code, reason: evt.reason ?? "" });
          this._cleanup();
          return;
        }
        if (!this._reconnectStartedAt) {
          this._reconnectStartedAt = Date.now();
        }
        const elapsed = Date.now() - this._reconnectStartedAt;
        if (elapsed >= MAX_RECONNECT_DURATION_MS) {
          this._logService.warn("[voice] reconnect timeout after 30 minutes, giving up");
          this._cleanup();
          return;
        }
        this._reconnectAttempts++;
        this._stopPing();
        this._ws = void 0;
        const delay = this._reconnectAttempts <= FAST_RETRY_COUNT ? FAST_RETRY_DELAY_MS : SLOW_RETRY_DELAY_MS;
        this._logService.warn(`[voice] ws closed abnormally (code=${evt.code} reason=${evt.reason || "none"} wasClean=${evt.wasClean}); reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})`);
        this._reconnectTimer = setTimeout(() => {
          this._reconnectTimer = void 0;
          this._connectWebSocket();
        }, delay);
        this._setConnected(false);
      }
    };
  }
  disconnect() {
    this._logService.trace("[voice] disconnect() called");
    if (this._ws && this._ws.readyState < WebSocket.CLOSING) {
      this._ws.close();
    }
    this._cleanup();
  }
  _cleanup() {
    this._stopPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = void 0;
    }
    if (this._contextSendTimer) {
      clearTimeout(this._contextSendTimer);
      this._contextSendTimer = void 0;
    }
    this._pendingContext = void 0;
    this._ws = void 0;
    this._sessionStartedOnSocket = false;
    this._window = void 0;
    this._lastSessionId = void 0;
    this._isResuming = false;
    this._lastSentById.clear();
    this._invalidatedSessionIds.clear();
    this._setConnected(false);
  }
  _startPing() {
    this._stopPing();
    const win = this._window ?? mainWindow;
    this._pingTimer = win.setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ type: "ping" }));
        this._pongTimer = setTimeout(() => {
          this._logService.warn("[voice] pong timeout \u2014 server unreachable, reconnecting");
          this._ws?.close(4e3, "pong timeout");
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  }
  _stopPing() {
    if (this._pingTimer) {
      (this._window ?? mainWindow).clearInterval(this._pingTimer);
      this._pingTimer = void 0;
    }
    this._clearPongTimeout();
  }
  _clearPongTimeout() {
    if (this._pongTimer) {
      clearTimeout(this._pongTimer);
      this._pongTimer = void 0;
    }
  }
  _setConnected(connected) {
    if (this._isConnected !== connected) {
      this._isConnected = connected;
      this._onDidChangeConnectionState.fire(connected);
    }
  }
  sendPttStart(turnId, passive = false) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "ptt_start", turn_id: turnId, ...passive ? { passive: true } : {} }));
    }
  }
  sendPttAudioChunk(audio) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "ptt_audio_chunk", audio }));
    }
  }
  sendPttEnd() {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "ptt_end" }));
    }
  }
  sendPttDiagnostic(turnId, metrics) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "ptt_diagnostic", turn_id: turnId, metrics }));
    }
  }
  sendSessionContext(context) {
    if (!this._isConnected) {
      return;
    }
    this._pendingContext = context;
    if (this._contextSendTimer) {
      clearTimeout(this._contextSendTimer);
    }
    this._contextSendTimer = setTimeout(() => {
      this._contextSendTimer = void 0;
      const pending = this._pendingContext;
      this._pendingContext = void 0;
      if (pending && this._ws?.readyState === WebSocket.OPEN) {
        this._sendDelta(pending);
      }
    }, 500);
  }
  flushSessionContext() {
    if (!this._contextSendTimer) {
      return;
    }
    clearTimeout(this._contextSendTimer);
    this._contextSendTimer = void 0;
    const pending = this._pendingContext;
    this._pendingContext = void 0;
    if (pending && this._ws?.readyState === WebSocket.OPEN) {
      this._sendDelta(pending);
    }
  }
  invalidateSessionCache(sessionId) {
    this._invalidatedSessionIds.add(sessionId);
  }
  _sendDelta(context) {
    const currentIds = new Set(context.sessions.map((s) => s.id));
    const removes = [...this._lastSentById.keys()].filter((id) => !currentIds.has(id));
    const upserts = [];
    for (const session of context.sessions) {
      const current = session;
      const prev = this._lastSentById.get(session.id);
      if (!prev) {
        upserts.push(current);
      } else {
        const patch = { id: session.id };
        let hasChanges = false;
        if (this._invalidatedSessionIds.has(session.id)) {
          for (const key of Object.keys(current)) {
            if (key !== "id") {
              patch[key] = current[key] ?? null;
              hasChanges = true;
            }
          }
          for (const key of Object.keys(prev)) {
            if (key !== "id" && (!Object.prototype.hasOwnProperty.call(current, key) || current[key] === void 0)) {
              patch[key] = null;
              hasChanges = true;
            }
          }
        } else {
          for (const key of Object.keys(current)) {
            if (key === "id") {
              continue;
            }
            if (stableStringify(current[key]) !== stableStringify(prev[key])) {
              patch[key] = current[key];
              hasChanges = true;
            }
          }
          for (const key of Object.keys(prev)) {
            if (key === "id") {
              continue;
            }
            if (!Object.prototype.hasOwnProperty.call(current, key) || current[key] === void 0) {
              patch[key] = null;
              hasChanges = true;
            }
          }
        }
        if (!Object.prototype.hasOwnProperty.call(patch, "agent_state")) {
          if (Object.prototype.hasOwnProperty.call(patch, "agent_state_detail")) {
            delete patch.agent_state_detail;
          }
          if (Object.prototype.hasOwnProperty.call(patch, "last_response_summary")) {
            delete patch.last_response_summary;
          }
          hasChanges = Object.keys(patch).some((k) => k !== "id");
        }
        if (hasChanges) {
          upserts.push(patch);
        }
      }
    }
    if (upserts.length === 0 && removes.length === 0) {
      return;
    }
    for (const session of context.sessions) {
      const obj = {};
      for (const [k, v] of Object.entries(session)) {
        if (v !== void 0) {
          obj[k] = v;
        }
      }
      this._lastSentById.set(session.id, obj);
      this._invalidatedSessionIds.delete(session.id);
    }
    for (const id of removes) {
      this._lastSentById.delete(id);
      this._invalidatedSessionIds.delete(id);
    }
    this._ws.send(JSON.stringify({
      type: "session_context",
      mode: "delta",
      upserts,
      removes
    }));
    this._logService.trace(`[voice] _sendDelta upserts=[${upserts.map((u) => `${String(u.id).slice(-8)}:${u.agent_state ?? "(no-state)"}${Object.prototype.hasOwnProperty.call(u, "agent_state_detail") ? "+detail" : ""}${Object.prototype.hasOwnProperty.call(u, "last_response_summary") && u.last_response_summary ? "+summary" : ""}`).join(", ")}] removes=${removes.length}`);
  }
  _seedTracking(context) {
    this._lastSentById.clear();
    this._invalidatedSessionIds.clear();
    for (const session of context.sessions) {
      const obj = {};
      for (const [k, v] of Object.entries(session)) {
        if (v !== void 0) {
          obj[k] = v;
        }
      }
      this._lastSentById.set(session.id, obj);
    }
  }
  sendToolResult(callId, result) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "tool_result", call_id: callId, result }));
    }
  }
  sendNarrationPlaybackComplete(codingSessionId, narrationId, playbackId) {
    if (this._ws?.readyState === WebSocket.OPEN && this._sessionStartedOnSocket) {
      this._ws.send(JSON.stringify({
        type: "narration_playback_complete",
        coding_session_id: codingSessionId,
        narration_id: narrationId,
        playback_id: playbackId
      }));
    }
  }
  requestNarration(codingSessionId, kind, text, narrationId, checkpoint, confirmationType, pending) {
    if (this._ws?.readyState === WebSocket.OPEN && this._sessionStartedOnSocket) {
      const id = narrationId ?? generateUuid();
      this._ws.send(JSON.stringify({
        type: "request_narration",
        coding_session_id: codingSessionId,
        kind,
        text,
        narration_id: id,
        ...checkpoint ? {
          request_id: checkpoint.requestId,
          checkpoint_id: checkpoint.checkpointId,
          sequence: checkpoint.sequence
        } : {},
        ...kind === "confirmation" && confirmationType ? { confirmation_type: confirmationType } : {},
        ...pending ? { pending_id: pending.pendingId } : {}
      }));
      this._logService.trace(`[voice] request_narration kind=${kind} id=${codingSessionId.slice(-32)} narration_id=${id.slice(0, 8)}${narrationId ? " (retry)" : ""}`);
      if (checkpoint) {
        this._logService.info(`[voice] checkpoint sent request=${checkpoint.requestId} stage=${checkpoint.checkpointId} sequence=${checkpoint.sequence}`);
      }
      return id;
    }
    return void 0;
  }
  sendSessionStateChange(sessionId, newState, _label, detail, lastResponseSummary) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      const payload = { type: "session_state_change", session_id: sessionId, new_state: newState };
      if (detail) {
        payload.detail = detail;
      }
      if (lastResponseSummary) {
        payload.last_response_summary = lastResponseSummary;
      }
      this._ws.send(JSON.stringify(payload));
    }
  }
  stopSpeaking() {
  }
  /**
   * Send the start_session message with the given context.
   * Called by the consumer after connect() resolves and AudioContext is ready.
   *
   * ``priorTimeline`` carries an ordered slice of cross-session entries
   * (voice turns, voice tool calls, coding-session events, and a synthesized
   * coding-agent-reply summary per active session) from the previous voice
   * session. The BE consumes it once on the first command turn so the model
   * can answer recall questions across reconnects without backend
   * persistence. See ``IVoicePriorTimelineEntry``.
   */
  sendStartSession(context, machineId, priorTimeline, turnConfigOverride, voiceInstructions) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      const sessionContext = { ...context, display_locale: this._getLanguage() };
      this._seedTracking(sessionContext);
      const payload = { type: "start_session", session_context: sessionContext, machine_id: machineId, turn_config: turnConfigOverride ?? this._getTurnConfig(), voice: this._getVoice(), auto_narrate: false };
      if (priorTimeline && priorTimeline.length > 0) {
        payload.prior_timeline = priorTimeline;
      }
      if (voiceInstructions) {
        payload.voice_instructions = voiceInstructions;
      }
      this._ws.send(JSON.stringify(payload));
      this._sessionStartedOnSocket = true;
    }
  }
  sendResumeSession(context, machineId, voiceInstructions) {
    if (this._ws?.readyState === WebSocket.OPEN && this._lastSessionId) {
      const sessionContext = { ...context, display_locale: this._getLanguage() };
      this._seedTracking(sessionContext);
      const payload = { type: "resume_session", session_id: this._lastSessionId, session_context: sessionContext, machine_id: machineId, turn_config: this._getTurnConfig(), voice: this._getVoice(), auto_narrate: false };
      if (voiceInstructions) {
        payload.voice_instructions = voiceInstructions;
      }
      this._ws.send(JSON.stringify(payload));
      this._sessionStartedOnSocket = true;
    }
  }
  async submitFeedback(payload) {
    const httpUrl = this._getWsUrl().replace("wss://", "https://").replace("ws://", "http://").replace(/\/realtime\/voice$/, "/feedback");
    const headers = { "Content-Type": "application/json" };
    if (this._authToken) {
      headers["Authorization"] = `Bearer ${this._authToken}`;
    }
    try {
      const response = await fetch(httpUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          feedback_text: payload.feedbackText,
          machine_id: payload.machineId,
          user_id: payload.userId,
          session_id: payload.sessionId,
          submission_id: payload.submissionId,
          transcript_history: payload.transcriptHistory.map((t) => ({
            role: t.role,
            text: t.text,
            timestamp: t.timestamp
          })),
          client_session_state: payload.clientSessionState,
          client_environment: payload.clientEnvironment,
          timestamp: payload.timestamp
        })
      });
      if (!response.ok) {
        const text = await response.text();
        return { ok: false, error: `HTTP ${response.status}: ${text}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
  dispose() {
    this.disconnect();
    super.dispose();
  }
};
VoiceClientService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IProductService)
], VoiceClientService);
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}
registerSingleton(IVoiceClientService, VoiceClientService, InstantiationType.Delayed);
export {
  VoiceClientService,
  resolveAutomaticVoiceLanguage
};
