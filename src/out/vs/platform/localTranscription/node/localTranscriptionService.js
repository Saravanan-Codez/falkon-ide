import { Emitter } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { dirname, join } from "../../../base/common/path.js";
import { ensureFoundryLocalRuntime } from "./foundryLocalRuntime.js";
import {
  DEFAULT_LOCAL_TRANSCRIPTION_MODEL,
  LocalTranscriptionModelState
} from "../common/localTranscription.js";
import { importFoundryLocalModel } from "./foundryLocalModelImport.js";
const SAMPLE_RATE = 16e3;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const FOUNDRY_APP_NAME = "vscode-dictation";
function runtimeCacheDir(modelCacheDir) {
  return join(dirname(modelCacheDir), "chatDictationRuntime");
}
function classifyModelError(message) {
  const text = message.toLowerCase();
  if (/\b(404|not found|no such file|does not exist|could not locate|repository not found|unknown model)\b/.test(text)) {
    return "notFound";
  }
  if (/\b(network|fetch|econn|enotfound|etimedout|socket|dns|offline|proxy|tls|certificate|getaddrinfo|feed)\b/.test(text)) {
    return "network";
  }
  if (/\b(out of memory|oom|enomem|allocation failed|cannot allocate)\b/.test(text)) {
    return "memory";
  }
  if (/\b(enospc|no space left|disk)\b/.test(text)) {
    return "disk";
  }
  if (/\b(eacces|eperm|permission denied|access is denied)\b/.test(text)) {
    return "permission";
  }
  return "unknown";
}
function transcriptSeparator(current, next) {
  if (!current || !next || /[\s([{]$/.test(current) || /^\s|^[,.;:!?)}\]'"]/.test(next)) {
    return "";
  }
  return " ";
}
function appendTranscriptChunk(current, next) {
  if (!next.trim()) {
    return current;
  }
  if (!current) {
    return next.trimStart();
  }
  return `${current}${next}`;
}
class TranscriptAccumulator {
  constructor() {
    this._segments = /* @__PURE__ */ new Map();
    this._nextOrder = 0;
  }
  /** Record a finalized segment, replacing an earlier revision of the same one. */
  addFinal(text, startTime, endTime) {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    const key = startTime !== null || endTime !== null ? `${startTime ?? "na"}:${endTime ?? "na"}` : `untimed:${this._nextOrder}`;
    const existing = this._segments.get(key);
    if (existing) {
      existing.text = normalized;
      return;
    }
    this._segments.set(key, { order: this._nextOrder, startTime, endTime, text: normalized });
    this._nextOrder++;
  }
  /** The cumulative finalized transcript, segments joined in time order. */
  getText() {
    return [...this._segments.values()].sort((a, b) => {
      if (a.startTime !== null && b.startTime !== null) {
        return a.startTime - b.startTime;
      }
      if (a.startTime !== null) {
        return -1;
      }
      if (b.startTime !== null) {
        return 1;
      }
      return a.order - b.order;
    }).reduce((text, seg) => `${text}${transcriptSeparator(text, seg.text)}${seg.text}`, "").trim();
  }
  reset() {
    this._segments.clear();
    this._nextOrder = 0;
  }
}
class LocalTranscriptionService extends Disposable {
  constructor() {
    super();
    this.isSupported = true;
    this._onDidChangeModelStatus = this._register(new Emitter());
    this.onDidChangeModelStatus = this._onDidChangeModelStatus.event;
    this._onDidTranscribe = this._register(new Emitter());
    this.onDidTranscribe = this._onDidTranscribe.event;
    this._status = { state: LocalTranscriptionModelState.Idle };
    this._sessionActive = false;
    /** Cumulative finalized transcript, accumulated per timed segment. */
    this._accumulator = new TranscriptAccumulator();
    /** Latest interim (not-yet-finalized) segment text. */
    this._partialText = "";
    /**
     * PCM chunks captured before the model finished loading and the session
     * opened. Flushed in order once the session starts so no leading audio is
     * dropped while the first-use download/load completes.
     */
    this._pendingChunks = [];
    /**
     * Serializes every `session.append()` through a single FIFO chain. Both the
     * buffered-backlog flush and live `pushAudio()` enqueue here, so audio is
     * always appended to native core in capture order — even across the first-use
     * handoff — and `stop()` can await this to guarantee the final chunk lands
     * before `session.stop()` drains the stream. The stored tail swallows
     * rejections so one failed append doesn't break ordering for the rest; the
     * real (rejectable) promise is returned to callers that need to observe it.
     */
    this._appendChain = Promise.resolve();
    /**
     * Monotonically bumped whenever a session starts or is reset, so a slow
     * session opened for one recording can detect that it is now stale and avoid
     * emitting its transcript into a later session.
     */
    this._generation = 0;
    this._register(toDisposable(() => {
      void this._disposeSession();
      this._modelPrepareCts?.cancel();
      this._modelPrepareCts?.dispose();
      this._modelPrepareCts = void 0;
    }));
  }
  async getModelStatus() {
    return this._status;
  }
  importModel(options) {
    return importFoundryLocalModel(options.sourcePath, options.cacheDir);
  }
  _setStatus(status) {
    this._status = status;
    this._onDidChangeModelStatus.fire(status);
  }
  async start(options) {
    this._applyProxyEnv(options.proxyUrl, options.noProxy, options.proxyStrictSSL, options.proxyAuthorization);
    this._runtimeDownload = options.runtimeUrlTemplate && options.runtimeVersion ? { urlTemplate: options.runtimeUrlTemplate, version: options.runtimeVersion } : void 0;
    await this._disposeSession();
    this._generation++;
    const generation = this._generation;
    this._sessionActive = true;
    this._accumulator.reset();
    this._partialText = "";
    this._pendingChunks = [];
    this._runtimeError = void 0;
    const model = options.model ?? DEFAULT_LOCAL_TRANSCRIPTION_MODEL;
    const language = options.language;
    this._openPromise = this._openSession(options.cacheDir, model, language, generation);
    this._openPromise.catch(() => {
    });
  }
  /**
   * Apply VS Code's proxy settings as environment variables for this process, so
   * every download leg (our fetches and the native model download) honors a proxy
   * configured only in VS Code (not in the OS environment):
   * - `http.proxy`/`http.noProxy` → `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`.
   * - `http.proxyAuthorization` (a `Basic <base64>` value) → folded into the proxy
   *   URL's userinfo so both our `HttpsProxyAgent` and the native HTTP stack send
   *   `Proxy-Authorization`. Non-`Basic` schemes (e.g. Negotiate/NTLM) cannot be
   *   carried this way and are left to OS-level auth.
   * - `http.proxyStrictSSL === false` → disable TLS certificate verification for
   *   the Node download legs. The native model leg still requires the CA in the OS
   *   trust store.
   *
   * A blank/undefined `proxyUrl` leaves any inherited environment proxy untouched.
   */
  _applyProxyEnv(proxyUrl, noProxy, proxyStrictSSL, proxyAuthorization) {
    if (proxyStrictSSL === false) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    if (!proxyUrl) {
      return;
    }
    const effectiveProxyUrl = this._embedProxyCredentials(proxyUrl, proxyAuthorization);
    process.env.HTTPS_PROXY = effectiveProxyUrl;
    process.env.HTTP_PROXY = effectiveProxyUrl;
    if (noProxy) {
      process.env.NO_PROXY = noProxy;
    }
  }
  /**
   * Fold a `Basic <base64>` `http.proxyAuthorization` value into `proxyUrl`'s
   * userinfo so proxy credentials survive the env-var bridge to every leg.
   * Returns `proxyUrl` unchanged when there is nothing to add or the header is
   * not a decodable `Basic` credential or the URL already carries credentials.
   */
  _embedProxyCredentials(proxyUrl, proxyAuthorization) {
    if (!proxyAuthorization) {
      return proxyUrl;
    }
    const basic = /^Basic\s+(?<token>[A-Za-z0-9+/=]+)$/i.exec(proxyAuthorization.trim());
    if (!basic?.groups?.token) {
      return proxyUrl;
    }
    let parsed;
    try {
      parsed = new URL(proxyUrl);
    } catch {
      return proxyUrl;
    }
    if (parsed.username || parsed.password) {
      return proxyUrl;
    }
    const decoded = Buffer.from(basic.groups.token, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return proxyUrl;
    }
    parsed.username = encodeURIComponent(decoded.slice(0, separator));
    parsed.password = encodeURIComponent(decoded.slice(separator + 1));
    return parsed.toString();
  }
  /**
   * Ensure the Foundry Local manager exists, the selected model is downloaded
   * and loaded, and a fresh live transcription session is started. Buffered
   * audio captured while this was in flight is flushed once the session opens.
   */
  async _openSession(cacheDir, modelId, language, generation) {
    try {
      const model = await this._ensureModel(cacheDir, modelId);
      if (generation !== this._generation) {
        return;
      }
      const audioClient = model.createAudioClient();
      if (language) {
        audioClient.settings.language = language;
      }
      const session = audioClient.createLiveTranscriptionSession();
      session.settings.sampleRate = SAMPLE_RATE;
      session.settings.channels = CHANNELS;
      session.settings.bitsPerSample = BITS_PER_SAMPLE;
      if (language) {
        session.settings.language = language;
      }
      await session.start();
      if (generation !== this._generation) {
        await session.dispose();
        return;
      }
      this._session = session;
      this._setStatus({ state: LocalTranscriptionModelState.Ready });
      this._consumePromise = this._consume(session, generation);
      const buffered = this._pendingChunks;
      this._pendingChunks = [];
      for (const chunk of buffered) {
        if (generation !== this._generation) {
          break;
        }
        this._enqueueAppend(session, generation, chunk).catch((err) => {
          if (generation === this._generation) {
            const message = String(err instanceof Error ? err.message : err);
            this._setStatus({ state: LocalTranscriptionModelState.Error, error: message, errorCode: classifyModelError(message) });
          }
        });
      }
    } catch (err) {
      if (generation === this._generation) {
        const message = String(err instanceof Error ? err.message : err);
        this._setStatus({ state: LocalTranscriptionModelState.Error, error: message, errorCode: classifyModelError(message) });
      }
      throw err;
    }
  }
  /**
   * Append `chunk` to `session` after every previously enqueued append has
   * completed, preserving capture order. Returns a promise that rejects if this
   * particular append fails (for callers that must surface it); the internal
   * chain continues regardless so ordering is preserved for later chunks.
   */
  _enqueueAppend(session, generation, chunk) {
    const result = this._appendChain.then(() => {
      if (generation !== this._generation || this._session !== session) {
        return;
      }
      return session.append(chunk);
    });
    this._appendChain = result.catch(() => {
    });
    return result;
  }
  /**
   * Download (if needed) and load the selected model through Foundry Local,
   * reporting download/load progress via the model status. Idempotent: a load
   * already in flight (or the same model already loaded) is reused.
   */
  async _ensureModel(cacheDir, modelId) {
    if (this._model && this._loadedModelId === modelId) {
      return this._model;
    }
    if (this._modelPromise && this._loadedModelId === modelId) {
      return this._modelPromise;
    }
    this._loadedModelId = modelId;
    const cts = new CancellationTokenSource();
    this._modelPrepareCts = cts;
    this._modelPromise = (async () => {
      try {
        this._setStatus({ state: LocalTranscriptionModelState.Loading });
        if (this._runtimeDownload) {
          const nativeDir = await ensureFoundryLocalRuntime(runtimeCacheDir(cacheDir), this._runtimeDownload, cts.token);
          process.env.VSCODE_FOUNDRY_LOCAL_NATIVE_DIR = nativeDir;
        }
        if (!this._sdk) {
          this._sdk = await import("foundry-local-sdk");
        }
        if (!this._manager) {
          this._manager = await this._sdk.FoundryLocalManager.createAsync({
            appName: FOUNDRY_APP_NAME,
            modelCacheDir: cacheDir,
            logLevel: "warn"
          });
        }
        const model = await this._manager.catalog.getModel(modelId);
        let didDownload = false;
        if (!model.isCached) {
          didDownload = true;
          this._setStatus({ state: LocalTranscriptionModelState.Downloading, progress: 0 });
          const ac = new AbortController();
          const sub = cts.token.onCancellationRequested(() => ac.abort());
          try {
            await model.download((percent) => {
              this._setStatus({ state: LocalTranscriptionModelState.Downloading, progress: Math.min(1, Math.max(0, percent / 100)) });
            }, ac.signal);
          } finally {
            sub.dispose();
          }
        }
        if (cts.token.isCancellationRequested) {
          throw new Error("cancelled");
        }
        this._setStatus({ state: LocalTranscriptionModelState.Loading });
        await model.load();
        this._model = model;
        this._setStatus({ state: LocalTranscriptionModelState.Ready, downloaded: didDownload });
        if (this._modelPrepareCts === cts) {
          this._modelPrepareCts = void 0;
        }
        return model;
      } catch (err) {
        this._model = void 0;
        this._modelPromise = void 0;
        this._loadedModelId = void 0;
        if (this._modelPrepareCts === cts) {
          this._modelPrepareCts = void 0;
        }
        throw err;
      }
    })();
    return this._modelPromise;
  }
  /**
   * Drain the session's result stream, maintaining a cumulative transcript.
   * Foundry emits per-segment results flagged `is_final`; a finalized segment is
   * recorded (and replaced if later refined) in the accumulator, while a
   * non-final result is the interim tail of the segment currently being spoken.
   * Each update fires the full cumulative transcript so the renderer can shimmer
   * the interim tail and solidify finalized text.
   */
  async _consume(session, generation) {
    try {
      for await (const result of session.getStream()) {
        if (generation !== this._generation) {
          break;
        }
        const text = this._resultText(result);
        if (result.is_final) {
          this._accumulator.addFinal(text, result.start_time ?? null, result.end_time ?? null);
          this._partialText = "";
        } else {
          this._partialText = appendTranscriptChunk(this._partialText, text);
        }
        if (this._sessionActive) {
          this._onDidTranscribe.fire({ text: this._cumulativeText(), isFinal: false, finalizedText: this._accumulator.getText() });
        }
      }
    } catch (err) {
      if (generation === this._generation && this._sessionActive) {
        const error = err instanceof Error ? err : new Error(String(err));
        this._runtimeError = error;
        this._setStatus({ state: LocalTranscriptionModelState.Error, error: error.message, errorCode: "runtime" });
      }
    }
  }
  /** Finalized transcript plus the current interim tail, joined naturally. */
  _cumulativeText() {
    const finalized = this._accumulator.getText();
    const partial = this._partialText;
    if (!partial) {
      return finalized;
    }
    if (!finalized) {
      return partial;
    }
    return `${finalized}${transcriptSeparator(finalized, partial)}${partial}`;
  }
  _resultText(result) {
    const part = result.content?.[0];
    return part?.text ?? part?.transcript ?? "";
  }
  async pushAudio(chunk) {
    if (!this._sessionActive) {
      return;
    }
    const bytes = chunk.buffer;
    const pcm = new Uint8Array(bytes.byteLength);
    pcm.set(bytes);
    if (this._session) {
      await this._enqueueAppend(this._session, this._generation, pcm);
    } else {
      this._pendingChunks.push(pcm);
    }
  }
  async stop() {
    const generation = this._generation;
    this._sessionActive = false;
    if (this._openPromise) {
      try {
        await this._openPromise;
      } catch {
      }
    }
    if (generation !== this._generation) {
      return "";
    }
    const session = this._session;
    if (!session) {
      const text2 = this._cumulativeText();
      this._resetSessionState();
      return text2;
    }
    try {
      try {
        await this._appendChain;
      } catch {
      }
      await session.stop();
    } catch {
    }
    if (this._consumePromise) {
      try {
        await this._consumePromise;
      } catch {
      }
    }
    const runtimeError = this._runtimeError;
    if (runtimeError && generation === this._generation) {
      await this._disposeSession();
      this._resetSessionState();
      throw runtimeError;
    }
    const text = this._cumulativeText();
    if (generation === this._generation) {
      this._onDidTranscribe.fire({ text, isFinal: true, finalizedText: text });
    }
    await this._disposeSession();
    this._resetSessionState();
    return text;
  }
  async cancel() {
    this._modelPrepareCts?.cancel();
    this._modelPrepareCts = void 0;
    this._sessionActive = false;
    this._generation++;
    await this._disposeSession();
    this._resetSessionState();
  }
  async _disposeSession() {
    const session = this._session;
    this._session = void 0;
    const consume = this._consumePromise;
    this._consumePromise = void 0;
    if (session) {
      try {
        await session.dispose();
      } catch {
      }
    }
    if (consume) {
      try {
        await consume;
      } catch {
      }
    }
  }
  _resetSessionState() {
    this._sessionActive = false;
    this._accumulator.reset();
    this._partialText = "";
    this._pendingChunks = [];
    this._appendChain = Promise.resolve();
    this._runtimeError = void 0;
  }
}
export {
  LocalTranscriptionService
};
