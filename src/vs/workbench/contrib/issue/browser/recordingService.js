import { Event } from "../../../../base/common/event.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var RecordingState = /* @__PURE__ */ ((RecordingState2) => {
  RecordingState2["Idle"] = "idle";
  RecordingState2["Recording"] = "recording";
  RecordingState2["Stopped"] = "stopped";
  return RecordingState2;
})(RecordingState || {});
const IRecordingService = createDecorator("recordingService");
class BrowserRecordingService {
  constructor() {
    this.isSupported = false;
    this.state = "idle" /* Idle */;
    this.onDidChangeState = Event.None;
  }
  getSupportedFormats() {
    return [];
  }
  async startRecording(_mimeType) {
    throw new Error("Recording is not supported in web browsers.");
  }
  async stopRecording() {
    return void 0;
  }
  discardRecording() {
  }
  async getScreenCapturePermissionStatus() {
    return "granted";
  }
  openScreenCapturePermissionSettings() {
  }
}
export {
  BrowserRecordingService,
  IRecordingService,
  RecordingState
};
