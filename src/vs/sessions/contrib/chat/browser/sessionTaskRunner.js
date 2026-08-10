import { toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const ISessionTaskRunnerRegistry = createDecorator("sessionTaskRunnerRegistry");
class SessionTaskRunnerRegistry {
  constructor() {
    this._runners = [];
  }
  register(runner) {
    this._runners.push(runner);
    return toDisposable(() => {
      const idx = this._runners.indexOf(runner);
      if (idx >= 0) {
        this._runners.splice(idx, 1);
      }
    });
  }
  getRunner(session) {
    let best;
    for (const runner of this._runners) {
      if (!runner.canRun(session)) {
        continue;
      }
      if (!best || runner.priority >= best.priority) {
        best = runner;
      }
    }
    return best;
  }
}
export {
  ISessionTaskRunnerRegistry,
  SessionTaskRunnerRegistry
};
