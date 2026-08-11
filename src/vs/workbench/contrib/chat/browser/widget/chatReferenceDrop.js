import { isEqual } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { createChatReferenceVariableEntry } from "../../common/attachments/chatVariableEntries.js";
function tryParseUri(value) {
  try {
    return URI.parse(value);
  } catch {
    return void 0;
  }
}
function isSelfChatReferenceDrop(droppedClientResource, ownClientResource) {
  const dropped = tryParseUri(droppedClientResource);
  const own = tryParseUri(ownClientResource);
  if (!dropped || !own) {
    return true;
  }
  return isEqual(dropped, own);
}
function isCrossAgentHostChatReferenceDrop(droppedClientResource, ownClientResource) {
  const dropped = tryParseUri(droppedClientResource);
  const own = tryParseUri(ownClientResource);
  if (!dropped || !own) {
    return true;
  }
  return dropped.scheme !== own.scheme || dropped.authority !== own.authority;
}
function resolveChatReferenceDropEntry(data, ownClientResource) {
  if (ownClientResource === void 0) {
    return void 0;
  }
  if (isSelfChatReferenceDrop(data.clientResource, ownClientResource) || isCrossAgentHostChatReferenceDrop(data.clientResource, ownClientResource)) {
    return void 0;
  }
  const chatResource = tryParseUri(data.chatResource);
  if (!chatResource) {
    return void 0;
  }
  return createChatReferenceVariableEntry(chatResource, void 0, data.title);
}
export {
  isCrossAgentHostChatReferenceDrop,
  isSelfChatReferenceDrop,
  resolveChatReferenceDropEntry
};
