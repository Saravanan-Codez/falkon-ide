import { Event } from "../../../../base/common/event.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { ILocalTranscriptionService, LocalTranscriptionModelState } from "../../../../platform/localTranscription/common/localTranscription.js";
class NullLocalTranscriptionService {
  constructor() {
    this.isSupported = false;
    this.onDidChangeModelStatus = Event.None;
    this.onDidTranscribe = Event.None;
  }
  async getModelStatus() {
    return { state: LocalTranscriptionModelState.Error, error: "unsupported" };
  }
  async importModel() {
    throw new Error("On-device transcription is not supported in this environment.");
  }
  async start() {
    throw new Error("On-device transcription is not supported in this environment.");
  }
  async pushAudio(_chunk) {
  }
  async stop() {
    return "";
  }
  async cancel() {
  }
}
registerSingleton(ILocalTranscriptionService, NullLocalTranscriptionService, InstantiationType.Delayed);
export {
  NullLocalTranscriptionService
};
