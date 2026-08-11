import { RecommendationsNotificationResult } from "../../../../platform/extensionRecommendations/common/extensionRecommendations.js";
class NullExtensionRecommendationNotificationService {
  constructor() {
    this.ignoredRecommendations = [];
  }
  hasToIgnoreRecommendationNotifications() {
    return true;
  }
  async promptImportantExtensionsInstallNotification() {
    return RecommendationsNotificationResult.Ignored;
  }
  async promptWorkspaceRecommendations() {
  }
}
export {
  NullExtensionRecommendationNotificationService
};
