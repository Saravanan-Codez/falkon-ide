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
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { createCancelablePromise, raceCancellablePromises, timeout } from "../../../../base/common/async.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const IAiEmbeddingVectorService = createDecorator("IAiEmbeddingVectorService");
let AiEmbeddingVectorService = class {
  constructor(logService) {
    this.logService = logService;
    // 10 seconds
    this._providers = [];
  }
  static {
    this.DEFAULT_TIMEOUT = 1e3 * 10;
  }
  isEnabled() {
    return this._providers.length > 0;
  }
  registerAiEmbeddingVectorProvider(model, provider) {
    this._providers.push(provider);
    return {
      dispose: () => {
        const index = this._providers.indexOf(provider);
        if (index >= 0) {
          this._providers.splice(index, 1);
        }
      }
    };
  }
  async getEmbeddingVector(strings, token) {
    if (this._providers.length === 0) {
      throw new Error("No embedding vector providers registered");
    }
    const stopwatch = StopWatch.create();
    const cancellablePromises = [];
    const timer = timeout(AiEmbeddingVectorService.DEFAULT_TIMEOUT);
    const disposable = token.onCancellationRequested(() => {
      disposable.dispose();
      timer.cancel();
    });
    for (const provider of this._providers) {
      cancellablePromises.push(createCancelablePromise(async (t) => {
        try {
          return await provider.provideAiEmbeddingVector(
            Array.isArray(strings) ? strings : [strings],
            t
          );
        } catch (e) {
        }
        await timer;
        throw new Error("Embedding vector provider timed out");
      }));
    }
    cancellablePromises.push(createCancelablePromise(async (t) => {
      const disposable2 = t.onCancellationRequested(() => {
        timer.cancel();
        disposable2.dispose();
      });
      await timer;
      throw new Error("Embedding vector provider timed out");
    }));
    try {
      const result = await raceCancellablePromises(cancellablePromises);
      if (result.length === 1) {
        return result[0];
      }
      return result;
    } finally {
      stopwatch.stop();
      this.logService.trace(`[AiEmbeddingVectorService]: getEmbeddingVector took ${stopwatch.elapsed()}ms`);
    }
  }
};
AiEmbeddingVectorService = __decorateClass([
  __decorateParam(0, ILogService)
], AiEmbeddingVectorService);
registerSingleton(IAiEmbeddingVectorService, AiEmbeddingVectorService, InstantiationType.Delayed);
export {
  AiEmbeddingVectorService,
  IAiEmbeddingVectorService
};
