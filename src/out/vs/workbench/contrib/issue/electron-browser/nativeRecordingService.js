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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { RecordingState } from "../browser/recordingService.js";
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const SIZE_LIMIT_THRESHOLD = 0.9;
let NativeRecordingService = class extends Disposable {
  constructor(logService, nativeHostService) {
    super();
    this.logService = logService;
    this.nativeHostService = nativeHostService;
    // MediaRecorder + getDisplayMedia may be absent if the renderer is run with reduced
    // APIs (e.g. some test/runtime configurations); derive support from feature detection
    // so startRecording can early-reject rather than blowing up with ReferenceError.
    this.isSupported = typeof MediaRecorder !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
    this._state = RecordingState.Idle;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
    this.chunks = [];
    this.bytesRecorded = 0;
    this.stoppedBySize = false;
    this.startTime = 0;
    this._register(toDisposable(() => this.cleanup()));
  }
  getScreenCapturePermissionStatus() {
    return this.nativeHostService.getMediaAccessStatus("screen");
  }
  openScreenCapturePermissionSettings() {
    if (isMacintosh) {
      void this.nativeHostService.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    }
  }
  get state() {
    return this._state;
  }
  setState(state) {
    if (this._state !== state) {
      this._state = state;
      this._onDidChangeState.fire(state);
    }
  }
  getSupportedFormats() {
    const formats = [];
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("video/mp4")) {
        formats.push({ mimeType: "video/mp4", label: "MP4", extension: "mp4" });
      }
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        formats.push({ mimeType: "video/webm;codecs=vp9", label: "WebM", extension: "webm" });
      } else if (MediaRecorder.isTypeSupported("video/webm")) {
        formats.push({ mimeType: "video/webm", label: "WebM", extension: "webm" });
      }
    }
    return formats;
  }
  async startRecording(preferredMimeType) {
    if (!this.isSupported) {
      throw new Error("Recording is not supported in this environment (MediaRecorder / getDisplayMedia unavailable).");
    }
    if (this._state === RecordingState.Recording) {
      throw new Error("Recording already in progress.");
    }
    this.cleanup();
    try {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
    } catch (err) {
      this.logService.error("[RecordingService] Failed to get display media:", err);
      throw new Error("Failed to start recording. The user may have cancelled the source picker.");
    }
    let mimeType;
    if (preferredMimeType && MediaRecorder.isTypeSupported(preferredMimeType)) {
      mimeType = preferredMimeType;
    } else if (MediaRecorder.isTypeSupported("video/mp4")) {
      mimeType = "video/mp4";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
    } else {
      mimeType = "video/webm";
    }
    this.chunks = [];
    this.bytesRecorded = 0;
    this.stoppedBySize = false;
    this.startTime = Date.now();
    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        videoBitsPerSecond: 25e5
        // 2.5 Mbps — good quality, reasonable file size
      });
    } catch (err) {
      this.logService.error("[RecordingService] Failed to create MediaRecorder:", err);
      this.stopTracks();
      throw new Error("Failed to create media recorder.");
    }
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        if (this.stoppedBySize) {
          return;
        }
        this.chunks.push(e.data);
        this.bytesRecorded += e.data.size;
        if (this.bytesRecorded >= MAX_FILE_SIZE_BYTES * SIZE_LIMIT_THRESHOLD && this._state === RecordingState.Recording) {
          this.logService.info("[RecordingService] Max file size reached, stopping recording.");
          this.stoppedBySize = true;
          this.mediaRecorder?.stop();
        }
      }
    };
    this.mediaRecorder.onstop = () => {
      if (this._state === RecordingState.Recording) {
        this.stopTracks();
        this.setState(RecordingState.Stopped);
      }
    };
    for (const track of this.mediaStream.getTracks()) {
      track.onended = () => {
        if (this._state === RecordingState.Recording && this.mediaRecorder?.state === "recording") {
          this.mediaRecorder.stop();
        }
      };
    }
    this.mediaRecorder.start(1e3);
    this.setState(RecordingState.Recording);
  }
  async stopRecording() {
    if (this._state !== RecordingState.Recording && this._state !== RecordingState.Stopped) {
      return void 0;
    }
    if (this._state === RecordingState.Recording && this.mediaRecorder?.state === "recording") {
      const recorder = this.mediaRecorder;
      await new Promise((resolve) => {
        recorder.onstop = () => {
          resolve();
        };
        recorder.requestData();
        recorder.stop();
      });
    }
    this.stopTracks();
    if (this.chunks.length === 0) {
      this.setState(RecordingState.Idle);
      return void 0;
    }
    const mimeType = this.mediaRecorder?.mimeType ?? "video/webm";
    const blob = new Blob(this.chunks, { type: mimeType });
    const durationMs = Date.now() - this.startTime;
    const data = {
      blob,
      mimeType,
      durationMs,
      sizeBytes: blob.size,
      stoppedBySize: this.stoppedBySize
    };
    this.chunks = [];
    this.mediaRecorder = void 0;
    this.setState(RecordingState.Idle);
    return data;
  }
  discardRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      if (this._state === RecordingState.Recording && this.mediaRecorder.state === "recording") {
        this.mediaRecorder.stop();
      }
    }
    this.cleanup();
    this.setState(RecordingState.Idle);
  }
  stopTracks() {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = void 0;
    }
  }
  cleanup() {
    this.stopTracks();
    this.chunks = [];
    this.bytesRecorded = 0;
    this.stoppedBySize = false;
    this.mediaRecorder = void 0;
  }
};
NativeRecordingService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, INativeHostService)
], NativeRecordingService);
export {
  NativeRecordingService
};
