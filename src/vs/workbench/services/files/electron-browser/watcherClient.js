import { getDelayedChannel, ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { AbstractUniversalWatcherClient } from "../../../../platform/files/common/watcher.js";
class UniversalWatcherClient extends AbstractUniversalWatcherClient {
  constructor(onFileChanges, onLogMessage, verboseLogging, utilityProcessWorkerWorkbenchService) {
    super(onFileChanges, onLogMessage, verboseLogging);
    this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
    this.init();
  }
  createWatcher(disposables) {
    const watcher = ProxyChannel.toService(getDelayedChannel((async () => {
      const { client, onDidTerminate } = disposables.add(await this.utilityProcessWorkerWorkbenchService.createWorker({
        moduleId: "vs/platform/files/node/watcher/watcherMain",
        type: "fileWatcher",
        name: "file-watcher"
      }));
      onDidTerminate.then(({ reason }) => {
        if (reason?.code === 0) {
          this.trace(`terminated by itself with code ${reason.code}, signal: ${reason.signal}`);
        } else {
          this.onError(`terminated by itself unexpectedly with code ${reason?.code}, signal: ${reason?.signal} (ETERM)`);
        }
      });
      return client.getChannel("watcher");
    })()));
    return watcher;
  }
}
export {
  UniversalWatcherClient
};
