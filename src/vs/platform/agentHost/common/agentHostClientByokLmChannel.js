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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Throttler } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
import {
  IAgentHostByokLmHandler
} from "./agentHostByokLm.js";
const AGENT_HOST_CLIENT_BYOK_LM_CHANNEL = "agentHostClientByokLm";
function createAgentHostClientByokLmConnection(channel) {
  return {
    chat: (request) => channel.call("chat", request),
    onDidChangeModels: channel.listen("models")
  };
}
let AgentHostClientByokLmChannel = class {
  constructor(_handler, _logService) {
    this._handler = _handler;
    this._logService = _logService;
  }
  listen(_ctx, event) {
    if (event === "models") {
      return this._modelsSnapshotEvent();
    }
    throw new Error(`No event '${event}' on AgentHostClientByokLmChannel`);
  }
  /**
   * A snapshot stream of the renderer's BYOK models: emits the current models
   * when a subscriber attaches, then re-emits whenever the handler reports a
   * change. Enumeration is renderer-local, so the node side only ever receives.
   *
   * A {@link Throttler} serializes overlapping publishes and coalesces bursts,
   * so a slow enumeration can't fire a stale snapshot after a newer one.
   */
  _modelsSnapshotEvent() {
    const store = new DisposableStore();
    const throttler = store.add(new Throttler());
    const emitter = store.add(new Emitter({
      onDidAddFirstListener: () => {
        if (this._handler.onDidChangeModels) {
          store.add(this._handler.onDidChangeModels(() => void publish()));
        }
        void publish();
      },
      onDidRemoveLastListener: () => store.dispose()
    }));
    const publish = () => {
      if (store.isDisposed) {
        return;
      }
      throttler.queue(async () => {
        try {
          const models = await this._handler.listModels(CancellationToken.None);
          if (!store.isDisposed) {
            emitter.fire(models);
          }
        } catch (err) {
          this._logService.warn("AgentHostClientByokLmChannel: failed to enumerate BYOK models from the renderer", err);
        }
      });
    };
    return emitter.event;
  }
  async call(_ctx, command, arg) {
    switch (command) {
      case "chat": {
        const result = await this._handler.chat(arg, CancellationToken.None);
        return result;
      }
    }
    throw new Error(`Unknown command '${command}' on AgentHostClientByokLmChannel`);
  }
};
AgentHostClientByokLmChannel = __decorateClass([
  __decorateParam(0, IAgentHostByokLmHandler),
  __decorateParam(1, ILogService)
], AgentHostClientByokLmChannel);
export {
  AGENT_HOST_CLIENT_BYOK_LM_CHANNEL,
  AgentHostClientByokLmChannel,
  createAgentHostClientByokLmConnection
};
