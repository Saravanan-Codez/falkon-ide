import { ChatEntitlement } from "../../../../services/chat/common/chatEntitlementService.js";
function isNewUser(chatEntitlementService) {
  return !chatEntitlementService.sentiment.completed || // setup not completed
  chatEntitlementService.entitlement === ChatEntitlement.Available;
}
export {
  isNewUser
};
