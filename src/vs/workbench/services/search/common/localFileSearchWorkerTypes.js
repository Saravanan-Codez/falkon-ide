class LocalFileSearchWorkerHost {
  static {
    this.CHANNEL_NAME = "localFileSearchWorkerHost";
  }
  static getChannel(workerServer) {
    return workerServer.getChannel(LocalFileSearchWorkerHost.CHANNEL_NAME);
  }
  static setChannel(workerClient, obj) {
    workerClient.setChannel(LocalFileSearchWorkerHost.CHANNEL_NAME, obj);
  }
}
export {
  LocalFileSearchWorkerHost
};
