import { isEqual } from "../../../../base/common/resources.js";
import { isIChatSessionFileChange2 } from "../common/chatSessionsService.js";
function editingEntriesContainResource(entries, resourceUri) {
  for (const entry of entries) {
    if (isEqual(entry.modifiedURI, resourceUri) || isEqual(entry.originalURI, resourceUri)) {
      return true;
    }
  }
  return false;
}
function agentSessionContainsResource(session, resourceUri) {
  if (!(session.changes instanceof Array)) {
    return false;
  }
  for (const change of session.changes) {
    if (isIChatSessionFileChange2(change)) {
      if (isEqual(change.uri, resourceUri) || change.originalUri && isEqual(change.originalUri, resourceUri) || change.modifiedUri && isEqual(change.modifiedUri, resourceUri)) {
        return true;
      }
    } else if (isEqual(change.modifiedUri, resourceUri) || change.originalUri && isEqual(change.originalUri, resourceUri)) {
      return true;
    }
  }
  return false;
}
export {
  agentSessionContainsResource,
  editingEntriesContainResource
};
