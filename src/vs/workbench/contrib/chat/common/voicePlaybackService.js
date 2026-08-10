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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { observableValue } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IVoicePlaybackService = createDecorator("voicePlaybackService");
let VoicePlaybackService = class extends Disposable {
  constructor(commandService) {
    super();
    this.commandService = commandService;
    this._speakingSession = observableValue(this, void 0);
    this.speakingSession = this._speakingSession;
    this._lastPlayed = new ResourceMap();
    this._lastPlayedVersion = observableValue(this, 0);
    this.lastPlayedVersion = this._lastPlayedVersion;
    this._pendingResponses = new ResourceSet();
    this._pendingResponseVersion = observableValue(this, 0);
    this.pendingResponseVersion = this._pendingResponseVersion;
    this._register(toDisposable(() => {
      this._activeReplay?.dispose(true);
      this._activeReplay = void 0;
    }));
  }
  notifyPlaybackStart(sessionResource, transcript) {
    this._speakingSession.set(sessionResource, void 0);
    if (sessionResource && transcript) {
      this._lastPlayed.set(sessionResource, { transcript, timestamp: Date.now() });
      this._lastPlayedVersion.set(this._lastPlayedVersion.get() + 1, void 0);
    }
  }
  notifyPlaybackEnd(sessionResource) {
    const current = this._speakingSession.get();
    if (!current) {
      return;
    }
    if (!sessionResource || current.toString() === sessionResource.toString()) {
      this._speakingSession.set(void 0, void 0);
    }
  }
  getLastPlayed(sessionResource) {
    return this._lastPlayed.get(sessionResource);
  }
  hasLastPlayed(sessionResource) {
    return this._lastPlayed.has(sessionResource);
  }
  setPendingResponse(sessionResource, pending) {
    let changed;
    if (pending) {
      changed = !this._pendingResponses.has(sessionResource);
      if (changed) {
        this._pendingResponses.add(sessionResource);
      }
    } else {
      changed = this._pendingResponses.delete(sessionResource);
    }
    if (changed) {
      this._pendingResponseVersion.set(this._pendingResponseVersion.get() + 1, void 0);
    }
  }
  hasPendingResponse(sessionResource) {
    return this._pendingResponses.has(sessionResource);
  }
  async replay(sessionResource) {
    const entry = this._lastPlayed.get(sessionResource);
    if (!entry || !entry.transcript) {
      return;
    }
    this._activeReplay?.dispose(true);
    this._activeReplay = new CancellationTokenSource();
    this._speakingSession.set(sessionResource, void 0);
    await this.commandService.executeCommand("_chat.voicePlayback.replay", {
      sessionId: sessionResource.toString(),
      transcript: entry.transcript
    });
  }
  stop(sessionResource) {
    this._activeReplay?.dispose(true);
    this._activeReplay = void 0;
    void this.commandService.executeCommand("_chat.voicePlayback.stop", {
      sessionId: sessionResource?.toString()
    });
    const current = this._speakingSession.get();
    if (!sessionResource || current?.toString() === sessionResource.toString()) {
      this._speakingSession.set(void 0, void 0);
    }
  }
};
VoicePlaybackService = __decorateClass([
  __decorateParam(0, ICommandService)
], VoicePlaybackService);
registerSingleton(IVoicePlaybackService, VoicePlaybackService, InstantiationType.Delayed);
function tryParseSessionResource(sessionId) {
  if (!sessionId) {
    return void 0;
  }
  try {
    return URI.parse(sessionId);
  } catch {
    return void 0;
  }
}
CommandsRegistry.registerCommand("_chat.voicePlayback.notifyStart", (accessor, payload) => {
  const service = accessor.get(IVoicePlaybackService);
  service.notifyPlaybackStart(tryParseSessionResource(payload?.sessionId), payload?.transcript);
});
CommandsRegistry.registerCommand("_chat.voicePlayback.notifyEnd", (accessor, payload) => {
  const service = accessor.get(IVoicePlaybackService);
  service.notifyPlaybackEnd(tryParseSessionResource(payload?.sessionId));
});
export {
  IVoicePlaybackService,
  VoicePlaybackService
};
