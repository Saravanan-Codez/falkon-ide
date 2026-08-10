import { encodeBase64, VSBuffer, decodeBase64 } from "../../../../../base/common/buffer.js";
import { Schemas } from "../../../../../base/common/network.js";
import { extUri } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localChatSessionType } from "../chatSessionsService.js";
var LocalChatSessionUri;
((LocalChatSessionUri2) => {
  LocalChatSessionUri2.scheme = Schemas.vscodeLocalChatSession;
  function forSession(sessionId) {
    const encodedId = encodeBase64(VSBuffer.wrap(new TextEncoder().encode(sessionId)), false, true);
    return URI.from({ scheme: LocalChatSessionUri2.scheme, authority: localChatSessionType, path: "/" + encodedId });
  }
  LocalChatSessionUri2.forSession = forSession;
  function getNewSessionUri() {
    const handle = Math.floor(Math.random() * 1e9);
    return forSession(`chat-${handle}`);
  }
  LocalChatSessionUri2.getNewSessionUri = getNewSessionUri;
  function parseLocalSessionId(resource) {
    const parsed = parse(resource);
    return parsed?.chatSessionType === localChatSessionType ? parsed.sessionId : void 0;
  }
  LocalChatSessionUri2.parseLocalSessionId = parseLocalSessionId;
  function isLocalSession(resource) {
    return !!parseLocalSessionId(resource);
  }
  LocalChatSessionUri2.isLocalSession = isLocalSession;
  function parse(resource) {
    if (resource.scheme !== LocalChatSessionUri2.scheme) {
      return void 0;
    }
    if (!resource.authority) {
      return void 0;
    }
    const parts = resource.path.split("/");
    if (parts.length !== 2) {
      return void 0;
    }
    const chatSessionType = resource.authority;
    const decodedSessionId = decodeBase64(parts[1]);
    return { chatSessionType, sessionId: new TextDecoder().decode(decodedSessionId.buffer) };
  }
})(LocalChatSessionUri || (LocalChatSessionUri = {}));
function chatSessionResourceToId(resource) {
  const localId = LocalChatSessionUri.parseLocalSessionId(resource);
  if (localId) {
    return localId;
  }
  return resource.toString();
}
function getChatSessionStorageResource(storageRoot, sessionId, suffix = "") {
  const resource = extUri.joinPath(storageRoot, `${sessionId}${suffix}`);
  if (!extUri.isEqual(extUri.dirname(resource), storageRoot)) {
    throw new Error(`Invalid chat session ID: ${sessionId}`);
  }
  return resource;
}
function getChatSessionType(resource) {
  if (resource.scheme === Schemas.vscodeChatEditor) {
    return localChatSessionType;
  }
  if (resource.scheme === LocalChatSessionUri.scheme) {
    return resource.authority || localChatSessionType;
  }
  return resource.scheme;
}
function isUntitledChatSession(resource) {
  return resource.path.startsWith("/untitled-");
}
export {
  LocalChatSessionUri,
  chatSessionResourceToId,
  getChatSessionStorageResource,
  getChatSessionType,
  isUntitledChatSession
};
