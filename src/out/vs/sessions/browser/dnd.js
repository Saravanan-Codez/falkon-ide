import { DraggedChatReferenceIdentifier, fillInChatReferenceDragData, LocalSelectionTransfer } from "../../platform/dnd/browser/dnd.js";
const SessionsDataTransfers = {
  /** Mime type used to identify a session being dragged within the application. */
  SESSION: "application/vnd.code.session"
};
class DraggedSessionIdentifier {
  constructor(sessionId, resource) {
    this.sessionId = sessionId;
    this.resource = resource;
  }
}
const chatReferenceTransfer = LocalSelectionTransfer.getInstance();
function fillChatReferenceDragData(e, chatResource, clientResource, title) {
  const collapsedTitle = title.replace(/\s+/g, " ").trim();
  const chatResourceString = chatResource.toString();
  const clientResourceString = clientResource.toString();
  fillInChatReferenceDragData({ chatResource: chatResourceString, clientResource: clientResourceString, title: collapsedTitle }, e);
  chatReferenceTransfer.setData([new DraggedChatReferenceIdentifier(chatResourceString, clientResourceString, collapsedTitle)], DraggedChatReferenceIdentifier.prototype);
}
function clearChatReferenceDragData() {
  chatReferenceTransfer.clearData(DraggedChatReferenceIdentifier.prototype);
}
export {
  DraggedSessionIdentifier,
  SessionsDataTransfers,
  clearChatReferenceDragData,
  fillChatReferenceDragData
};
