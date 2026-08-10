const SANDBOX_HELPER_CHANNEL_NAME = "sandboxHelper";
class SandboxHelperChannel {
  constructor(service) {
    this.service = service;
  }
  listen(_context, _event) {
    throw new Error("Invalid listen");
  }
  call(_context, command, _arg, _cancellationToken) {
    switch (command) {
      case "checkSandboxDependencies":
        return this.service.checkSandboxDependencies();
      case "getWindowsMxcFilesystemPolicy":
        return this.service.getWindowsMxcFilesystemPolicy();
      case "getWindowsMxcEnvironment":
        return this.service.getWindowsMxcEnvironment();
      case "buildWindowsMxcSandboxPayload": {
        const { commandLine, policy, workingDirectory, containerName, containment } = _arg;
        return this.service.buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment);
      }
    }
    throw new Error("Invalid call");
  }
}
class SandboxHelperChannelClient {
  constructor(channel) {
    this.channel = channel;
  }
  checkSandboxDependencies() {
    return this.channel.call("checkSandboxDependencies");
  }
  getWindowsMxcFilesystemPolicy() {
    return this.channel.call("getWindowsMxcFilesystemPolicy");
  }
  getWindowsMxcEnvironment() {
    return this.channel.call("getWindowsMxcEnvironment");
  }
  buildWindowsMxcSandboxPayload(commandLine, policy, workingDirectory, containerName, containment) {
    return this.channel.call("buildWindowsMxcSandboxPayload", { commandLine, policy, workingDirectory, containerName, containment });
  }
}
export {
  SANDBOX_HELPER_CHANNEL_NAME,
  SandboxHelperChannel,
  SandboxHelperChannelClient
};
