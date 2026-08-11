import { createDecorator } from "../../instantiation/common/instantiation.js";
const ILocalTranscriptionService = createDecorator("localTranscriptionService");
const localTranscriptionChannelName = "localTranscription";
const DEFAULT_LOCAL_TRANSCRIPTION_MODEL = "nemotron-3.5-asr-streaming-0.6b";
var LocalTranscriptionModelState = /* @__PURE__ */ ((LocalTranscriptionModelState2) => {
  LocalTranscriptionModelState2["Idle"] = "idle";
  LocalTranscriptionModelState2["Downloading"] = "downloading";
  LocalTranscriptionModelState2["Loading"] = "loading";
  LocalTranscriptionModelState2["Ready"] = "ready";
  LocalTranscriptionModelState2["Error"] = "error";
  return LocalTranscriptionModelState2;
})(LocalTranscriptionModelState || {});
export {
  DEFAULT_LOCAL_TRANSCRIPTION_MODEL,
  ILocalTranscriptionService,
  LocalTranscriptionModelState,
  localTranscriptionChannelName
};
