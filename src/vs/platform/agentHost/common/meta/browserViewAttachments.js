import { isString } from "../../../../base/common/types.js";
import { MessageAttachmentKind } from "../state/protocol/state.js";
const BrowserViewAttachmentDisplayKind = "browser";
const BrowserViewAttachmentMetadataKey = "browserView";
function isBrowserViewAttachment(attachment) {
  return attachment.type === MessageAttachmentKind.Simple && attachment.displayKind === BrowserViewAttachmentDisplayKind;
}
function getBrowserViewAttachmentMetadata(attachment) {
  if (!isBrowserViewAttachment(attachment)) {
    return void 0;
  }
  const metadata = attachment._meta?.[BrowserViewAttachmentMetadataKey];
  if (!isRecord(metadata) || !isString(metadata.browserId) || !isString(metadata.browserUri)) {
    return void 0;
  }
  return { browserId: metadata.browserId, browserUri: metadata.browserUri };
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
export {
  BrowserViewAttachmentDisplayKind,
  BrowserViewAttachmentMetadataKey,
  getBrowserViewAttachmentMetadata,
  isBrowserViewAttachment
};
