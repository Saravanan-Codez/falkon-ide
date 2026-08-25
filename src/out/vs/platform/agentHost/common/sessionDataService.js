import { createDecorator } from "../../instantiation/common/instantiation.js";
const ISessionDataService = createDecorator("sessionDataService");
const SESSION_DB_FILENAME = "session.db";
const SESSION_ATTACHMENTS_DIRNAME = "attachments";
export {
  ISessionDataService,
  SESSION_ATTACHMENTS_DIRNAME,
  SESSION_DB_FILENAME
};
