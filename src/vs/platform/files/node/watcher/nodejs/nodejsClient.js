import { AbstractNonRecursiveWatcherClient } from "../../../common/watcher.js";
import { NodeJSWatcher } from "./nodejsWatcher.js";
class NodeJSWatcherClient extends AbstractNonRecursiveWatcherClient {
  constructor(onFileChanges, onLogMessage, verboseLogging) {
    super(onFileChanges, onLogMessage, verboseLogging);
    this.init();
  }
  createWatcher(disposables) {
    return disposables.add(new NodeJSWatcher(
      void 0
      /* no recursive watching support here */
    ));
  }
}
export {
  NodeJSWatcherClient
};
