import { InstantiationType, registerSingleton } from "../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../platform/instantiation/common/instantiation.js";
const IChatDashboardService = createDecorator("chatDashboardService");
class NullChatDashboardService {
  createDashboardElement() {
    return void 0;
  }
}
registerSingleton(IChatDashboardService, NullChatDashboardService, InstantiationType.Delayed);
export {
  IChatDashboardService
};
