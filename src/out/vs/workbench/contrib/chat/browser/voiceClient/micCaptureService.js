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
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { addDisposableListener } from "../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../base/common/event.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope } from "../../../../../platform/storage/common/storage.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { localize } from "../../../../../nls.js";
import { AgentsVoiceStorageKeys } from "../../../../contrib/agentsVoice/common/agentsVoice.js";
import { createPcmCaptureNode } from "../pcmCaptureWorklet.js";
import { mainWindow } from "../../../../../base/browser/window.js";
const IMicCaptureService = createDecorator("micCaptureService");
function getMediaCaptureWindow(targetWindow) {
  return targetWindow === mainWindow ? targetWindow : mainWindow;
}
const MIC_CAPTURE_CHUNK_SIZE = 512;
function isMicrophonePermissionDeniedError(error) {
  return (error instanceof DOMException || error instanceof Error) && error.name === "NotAllowedError";
}
let MicCaptureService = class extends Disposable {
  constructor(storageService, notificationService, logService) {
    super();
    this.storageService = storageService;
    this.notificationService = notificationService;
    this.logService = logService;
    this._micStream = null;
    this._isCapturing = false;
    this._captureGeneration = 0;
    this._pttGeneration = 0;
    this._pttHeld = false;
    this._pttStreaming = false;
    this._isMuted = false;
    this._suppressUntilTs = 0;
    this._pttAcquiring = false;
    this._pttReleasedDuringAcquire = false;
    // --- Hardware mute detection. ---
    // A hardware microphone kill switch (e.g. on Framework laptops) leaves
    // `getUserMedia` succeeding with a track whose `muted` flag is set, so no
    // acquisition error surfaces. Track the mute state to warn the user.
    this._micTrackListeners = this._register(new DisposableStore());
    this._micMutedNotified = false;
    this._pttDrainTargetSamples = 0;
    this._pttDrainSamplesSent = 0;
    this._diagTurnId = "";
    this._diagPttDownTs = 0;
    this._diagPttUpTs = 0;
    this._diagChunksSent = 0;
    this._diagSamplesSent = 0;
    this._diagDrainFired = false;
    this._diagDrainChunks = 0;
    this._diagDrainSamples = 0;
    this._diagDrainSkippedByMute = 0;
    this._diagDrainSkippedBySuppression = 0;
    this._diagPostReleaseCallbacks = 0;
    this._diagPostReleaseSamples = 0;
    this._diagPostReleaseSkippedByMute = 0;
    this._diagPostReleaseSkippedBySuppression = 0;
    this._diagReleasedDuringAcquire = false;
    this._diagPttUpWithoutCapture = false;
    this._onPttStart = this._register(new Emitter());
    this.onPttStart = this._onPttStart.event;
    this._onPttAudioChunk = this._register(new Emitter());
    this.onPttAudioChunk = this._onPttAudioChunk.event;
    this._onPttEnd = this._register(new Emitter());
    this.onPttEnd = this._onPttEnd.event;
    this._onPttDiagnostic = this._register(new Emitter());
    this.onPttDiagnostic = this._onPttDiagnostic.event;
  }
  static {
    // --- Drain state (post-release continued streaming). ---
    // Drain length is enforced primarily by counting samples shipped
    // since `pttUp` (immune to main-thread jitter that would skew a
    // pure wall-clock timer). The fallback timer guards against the
    // `onaudioprocess` callback being throttled or stopping entirely.
    this._PTT_DRAIN_WINDOW_MS = 500;
  }
  static {
    // --- Per-press diagnostic counters (reset on pttDown). ---
    // Diagnostic window MUST be > drain window so any audio still
    // produced after drain end is observable as `postReleaseCallbacks`.
    this._DIAG_POST_RELEASE_WINDOW_MS = 1e3;
  }
  get isCapturing() {
    return this._isCapturing;
  }
  get analyserNode() {
    return this._analyserNode;
  }
  get isMuted() {
    return this._isMuted;
  }
  set isMuted(value) {
    this._isMuted = value;
  }
  suppressUntil(timestamp) {
    this._suppressUntilTs = timestamp;
  }
  getMediaCaptureWindow(targetWindow) {
    return getMediaCaptureWindow(targetWindow);
  }
  prepare(window) {
    this._window = this.getMediaCaptureWindow(window);
  }
  async pttDown(turnId, passive = false) {
    if (this._pttHeld) {
      return;
    }
    const pttGeneration = ++this._pttGeneration;
    this._finishDrain();
    this._flushPendingDiagnostic();
    this._resetDiagnosticCounters(turnId);
    this._pttHeld = true;
    this._pttStreaming = true;
    this._pttReleasedDuringAcquire = false;
    this._isMuted = false;
    if (this._isCapturing) {
      this._onPttStart.fire(passive);
      return;
    }
    if (!this._window) {
      return;
    }
    if (this._pttAcquiring) {
      return;
    }
    this._pttAcquiring = true;
    try {
      await this.startCapture(this._window);
    } catch (err) {
      if (pttGeneration !== this._pttGeneration) {
        return;
      }
      this._pttHeld = false;
      this._pttStreaming = false;
      this._pttReleasedDuringAcquire = false;
      throw err;
    } finally {
      if (pttGeneration === this._pttGeneration) {
        this._pttAcquiring = false;
      }
    }
    if (pttGeneration !== this._pttGeneration || !this._isCapturing || !this._pttHeld) {
      this._pttReleasedDuringAcquire = false;
      return;
    }
    this._onPttStart.fire(passive);
    if (this._pttReleasedDuringAcquire) {
      this._pttReleasedDuringAcquire = false;
      this._pttStreaming = false;
      this._diagReleasedDuringAcquire = true;
      this._onPttEnd.fire();
      this.stopCapture();
      this._scheduleDiagnosticFire();
    }
  }
  pttUp() {
    if (!this._pttHeld) {
      return;
    }
    if (this._pttAcquiring) {
      this._pttReleasedDuringAcquire = true;
      this._diagReleasedDuringAcquire = true;
      this._diagPttUpTs = Date.now();
      this._scheduleDiagnosticFire();
      return;
    }
    if (!this._isCapturing) {
      this._pttHeld = false;
      this._pttStreaming = false;
      this._diagPttUpWithoutCapture = true;
      this._diagPttUpTs = Date.now();
      this._scheduleDiagnosticFire();
      return;
    }
    this._pttHeld = false;
    this._diagPttUpTs = Date.now();
    const sampleRate = this._micCtx?.sampleRate ?? 16e3;
    this._pttDrainTargetSamples = Math.ceil(
      sampleRate * MicCaptureService._PTT_DRAIN_WINDOW_MS / 1e3
    );
    this._pttDrainSamplesSent = 0;
    this._pttDrainFallbackTimer = setTimeout(() => {
      this._pttDrainFallbackTimer = void 0;
      this._finishDrain();
    }, MicCaptureService._PTT_DRAIN_WINDOW_MS + 250);
    this._scheduleDiagnosticFire();
  }
  abortPtt() {
    if (!this._pttHeld && !this._pttStreaming) {
      return;
    }
    if (this._pttDrainFallbackTimer) {
      clearTimeout(this._pttDrainFallbackTimer);
      this._pttDrainFallbackTimer = void 0;
    }
    this._pttDrainTargetSamples = 0;
    this._pttDrainSamplesSent = 0;
    this._pttGeneration++;
    this._pttAcquiring = false;
    this._pttHeld = false;
    this._pttStreaming = false;
    this._pttReleasedDuringAcquire = false;
    this._diagPttUpTs = Date.now();
    this._scheduleDiagnosticFire();
  }
  async startCapture(window) {
    const captureWindow = this.getMediaCaptureWindow(window);
    this._window = captureWindow;
    if (this._isCapturing) {
      return;
    }
    if (this._capturePromise) {
      return this._capturePromise;
    }
    const capturePromise = this._startCapture(captureWindow);
    this._capturePromise = capturePromise;
    try {
      await capturePromise;
    } finally {
      if (this._capturePromise === capturePromise) {
        this._capturePromise = void 0;
      }
    }
  }
  async _startCapture(window) {
    const captureGeneration = this._captureGeneration;
    const deviceId = this.storageService.get(AgentsVoiceStorageKeys.MicrophoneDevice, StorageScope.APPLICATION);
    const audioConstraints = {
      channelCount: 1,
      sampleRate: 16e3,
      echoCancellation: true,
      noiseSuppression: true
    };
    if (deviceId) {
      audioConstraints.deviceId = { exact: deviceId };
    }
    let micStream;
    try {
      micStream = await window.navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
    } catch (err) {
      const isDeviceError = deviceId && err instanceof DOMException && (err.name === "OverconstrainedError" || err.name === "NotFoundError");
      if (isDeviceError) {
        this.logService.warn(`[mic] Preferred device ${deviceId.slice(0, 8)}\u2026 unavailable, falling back to default`);
        delete audioConstraints.deviceId;
        try {
          micStream = await window.navigator.mediaDevices.getUserMedia({
            audio: audioConstraints
          });
        } catch (retryErr) {
          this._notifyMicPermissionDenied(retryErr);
          throw retryErr;
        }
      } else {
        this._notifyMicPermissionDenied(err);
        throw err;
      }
    }
    if (captureGeneration !== this._captureGeneration) {
      micStream.getTracks().forEach((track) => track.stop());
      return;
    }
    this._micStream = micStream;
    const cleanupFailedCapture = () => {
      if (this._micStream === micStream) {
        this._stopCaptureResources();
      } else {
        micStream.getTracks().forEach((track) => track.stop());
      }
    };
    let ctx;
    let source;
    try {
      this._micTrackListeners.clear();
      this._micMutedNotified = false;
      const audioTrack = micStream.getAudioTracks()[0];
      if (audioTrack) {
        if (audioTrack.muted) {
          this._notifyMicrophoneMuted();
        }
        this._micTrackListeners.add(addDisposableListener(audioTrack, "mute", () => this._notifyMicrophoneMuted()));
        this._micTrackListeners.add(addDisposableListener(audioTrack, "unmute", () => {
          this._micMutedNotified = false;
        }));
      }
      if (!this._micCtx) {
        this._micCtx = new window.AudioContext({ sampleRate: 16e3 });
      }
      ctx = this._micCtx;
      source = ctx.createMediaStreamSource(micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this._analyserNode = analyser;
    } catch (err) {
      cleanupFailedCapture();
      throw err;
    }
    const captureNodePromise = createPcmCaptureNode(window, ctx, MIC_CAPTURE_CHUNK_SIZE, (samples) => {
      const nowTs = Date.now();
      const ptUpTs = this._diagPttUpTs;
      const isDrainCallback = this._pttStreaming && !this._pttHeld;
      const inDiagWindow = ptUpTs > 0 && !this._pttHeld && nowTs <= ptUpTs + MicCaptureService._DIAG_POST_RELEASE_WINDOW_MS;
      const isPostReleaseCallback = !this._pttStreaming && inDiagWindow;
      if (this._isMuted) {
        if (isDrainCallback) {
          this._diagDrainSkippedByMute++;
        }
        if (isPostReleaseCallback) {
          this._diagPostReleaseSkippedByMute++;
        }
        return;
      }
      if (nowTs < this._suppressUntilTs) {
        if (isDrainCallback) {
          this._diagDrainSkippedBySuppression++;
        }
        if (isPostReleaseCallback) {
          this._diagPostReleaseSkippedBySuppression++;
        }
        return;
      }
      if (!this._pttStreaming) {
        if (isPostReleaseCallback) {
          this._diagPostReleaseCallbacks++;
          this._diagPostReleaseSamples += samples.length;
        }
        return;
      }
      const b64 = encodeRawPcm16Base64(samples, this._window);
      this._diagChunksSent++;
      this._diagSamplesSent += samples.length;
      if (isDrainCallback) {
        this._diagDrainFired = true;
        this._diagDrainChunks++;
        this._diagDrainSamples += samples.length;
        this._pttDrainSamplesSent += samples.length;
      }
      this._onPttAudioChunk.fire(b64);
      if (isDrainCallback && this._pttDrainSamplesSent >= this._pttDrainTargetSamples) {
        this._finishDrain();
      }
    });
    let node;
    try {
      node = (await captureNodePromise).node;
    } catch (err) {
      cleanupFailedCapture();
      throw err;
    }
    if (this._micCtx !== ctx) {
      try {
        node.disconnect();
      } catch {
      }
      return;
    }
    try {
      this._workletNode = node;
      source.connect(node);
      node.connect(ctx.destination);
      this._isCapturing = true;
    } catch (err) {
      cleanupFailedCapture();
      throw err;
    }
  }
  _notifyMicPermissionDenied(err) {
    if (isMicrophonePermissionDeniedError(err)) {
      this.notificationService.notify({
        severity: Severity.Error,
        message: localize("mic.permissionDenied", "Microphone access was denied. Grant microphone permission in your system settings to use Voice Mode.")
      });
    }
  }
  _notifyMicrophoneMuted() {
    if (this._micMutedNotified) {
      return;
    }
    this._micMutedNotified = true;
    this.logService.warn("[mic] Microphone track is muted \u2014 likely a hardware mute switch is enabled");
    this.notificationService.notify({
      severity: Severity.Warning,
      message: localize("mic.hardwareMuted", "Your microphone appears to be muted or disabled, possibly by a hardware switch. Voice Mode won't hear you until it's re-enabled.")
    });
  }
  _stopCaptureResources() {
    this._captureGeneration++;
    this._capturePromise = void 0;
    if (this._workletNode) {
      this._workletNode.port.onmessage = null;
      try {
        this._workletNode.disconnect();
      } catch {
      }
      this._workletNode = void 0;
    }
    this._analyserNode = void 0;
    this._micCtx?.close();
    this._micCtx = void 0;
    if (this._micStream) {
      this._micStream.getTracks().forEach((t) => t.stop());
      this._micStream = null;
    }
    this._micTrackListeners.clear();
    this._micMutedNotified = false;
    this._isCapturing = false;
  }
  stopCapture() {
    this._stopCaptureResources();
    this._pttGeneration++;
    this._pttAcquiring = false;
    if (this._pttDrainFallbackTimer) {
      clearTimeout(this._pttDrainFallbackTimer);
      this._pttDrainFallbackTimer = void 0;
    }
    this._pttDrainTargetSamples = 0;
    this._pttDrainSamplesSent = 0;
    this._pttHeld = false;
    this._pttStreaming = false;
    this._pttReleasedDuringAcquire = false;
  }
  dispose() {
    if (this._diagFireTimer) {
      clearTimeout(this._diagFireTimer);
      this._diagFireTimer = void 0;
    }
    if (this._pttDrainFallbackTimer) {
      clearTimeout(this._pttDrainFallbackTimer);
      this._pttDrainFallbackTimer = void 0;
    }
    this.stopCapture();
    super.dispose();
  }
  /**
   * End the post-release drain phase: stop accepting more audio for
   * this turn and fire `_onPttEnd`. Idempotent. Safe to call when no
   * drain is in progress.
   */
  _finishDrain() {
    if (this._pttDrainFallbackTimer) {
      clearTimeout(this._pttDrainFallbackTimer);
      this._pttDrainFallbackTimer = void 0;
    }
    this._pttDrainTargetSamples = 0;
    this._pttDrainSamplesSent = 0;
    if (this._pttStreaming && !this._pttHeld) {
      this._pttStreaming = false;
      this._onPttEnd.fire();
    }
  }
  _resetDiagnosticCounters(turnId) {
    this._diagTurnId = turnId;
    this._diagPttDownTs = Date.now();
    this._diagPttUpTs = 0;
    this._diagChunksSent = 0;
    this._diagSamplesSent = 0;
    this._diagDrainFired = false;
    this._diagDrainChunks = 0;
    this._diagDrainSamples = 0;
    this._diagDrainSkippedByMute = 0;
    this._diagDrainSkippedBySuppression = 0;
    this._diagPostReleaseCallbacks = 0;
    this._diagPostReleaseSamples = 0;
    this._diagPostReleaseSkippedByMute = 0;
    this._diagPostReleaseSkippedBySuppression = 0;
    this._diagReleasedDuringAcquire = false;
    this._diagPttUpWithoutCapture = false;
  }
  _scheduleDiagnosticFire() {
    if (this._diagFireTimer) {
      clearTimeout(this._diagFireTimer);
      this._diagFireTimer = void 0;
    }
    this._diagFireTimer = setTimeout(() => {
      this._diagFireTimer = void 0;
      this._emitDiagnostic();
    }, MicCaptureService._DIAG_POST_RELEASE_WINDOW_MS);
  }
  _flushPendingDiagnostic() {
    if (this._diagFireTimer) {
      clearTimeout(this._diagFireTimer);
      this._diagFireTimer = void 0;
      this._emitDiagnostic();
    }
  }
  _emitDiagnostic() {
    if (!this._diagTurnId && this._diagPttDownTs === 0) {
      return;
    }
    const msHeld = this._diagPttUpTs > 0 ? this._diagPttUpTs - this._diagPttDownTs : 0;
    this._onPttDiagnostic.fire({
      turnId: this._diagTurnId,
      msHeld,
      chunksSent: this._diagChunksSent,
      samplesSent: this._diagSamplesSent,
      drainFired: this._diagDrainFired,
      drainChunks: this._diagDrainChunks,
      drainSamples: this._diagDrainSamples,
      drainWindowMs: MicCaptureService._PTT_DRAIN_WINDOW_MS,
      drainSkippedByMute: this._diagDrainSkippedByMute,
      drainSkippedBySuppression: this._diagDrainSkippedBySuppression,
      postReleaseCallbacks: this._diagPostReleaseCallbacks,
      postReleaseSamples: this._diagPostReleaseSamples,
      postReleaseSkippedByMute: this._diagPostReleaseSkippedByMute,
      postReleaseSkippedBySuppression: this._diagPostReleaseSkippedBySuppression,
      postReleaseWindowMs: MicCaptureService._DIAG_POST_RELEASE_WINDOW_MS,
      releasedDuringAcquire: this._diagReleasedDuringAcquire,
      pttUpWithoutCapture: this._diagPttUpWithoutCapture
    });
  }
};
MicCaptureService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, ILogService)
], MicCaptureService);
function encodeRawPcm16Base64(samples, win) {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  const bytes = new Uint8Array(buf);
  let binaryStr = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryStr += String.fromCharCode(bytes[i]);
  }
  return win.btoa(binaryStr);
}
registerSingleton(IMicCaptureService, MicCaptureService, InstantiationType.Delayed);
export {
  IMicCaptureService,
  MIC_CAPTURE_CHUNK_SIZE,
  MicCaptureService,
  getMediaCaptureWindow,
  isMicrophonePermissionDeniedError
};
