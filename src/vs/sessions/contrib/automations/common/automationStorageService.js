import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const AUTOMATION_STORAGE_KEY = "chat.automations.ledger";
const IAutomationStorageService = createDecorator("automationStorageService");
export {
  AUTOMATION_STORAGE_KEY,
  IAutomationStorageService
};
