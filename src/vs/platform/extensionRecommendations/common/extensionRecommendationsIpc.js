class ExtensionRecommendationNotificationServiceChannelClient {
  constructor(channel) {
    this.channel = channel;
  }
  get ignoredRecommendations() {
    throw new Error("not supported");
  }
  promptImportantExtensionsInstallNotification(extensionRecommendations) {
    return this.channel.call("promptImportantExtensionsInstallNotification", [extensionRecommendations]);
  }
  promptWorkspaceRecommendations(recommendations) {
    throw new Error("not supported");
  }
  hasToIgnoreRecommendationNotifications() {
    throw new Error("not supported");
  }
}
class ExtensionRecommendationNotificationServiceChannel {
  constructor(service) {
    this.service = service;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listen(_, event) {
    throw new Error(`Event not found: ${event}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(_, command, args) {
    switch (command) {
      case "promptImportantExtensionsInstallNotification":
        return this.service.promptImportantExtensionsInstallNotification(args[0]);
    }
    throw new Error(`Call not found: ${command}`);
  }
}
export {
  ExtensionRecommendationNotificationServiceChannel,
  ExtensionRecommendationNotificationServiceChannelClient
};
