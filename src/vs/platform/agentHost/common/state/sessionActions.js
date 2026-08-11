import {
  ActionType
} from "./protocol/actions.js";
import {
  AuthRequiredReason
} from "./protocol/notifications.js";
const NotificationType = {
  SessionAdded: "root/sessionAdded",
  SessionRemoved: "root/sessionRemoved",
  SessionSummaryChanged: "root/sessionSummaryChanged",
  Progress: "root/progress",
  AuthRequired: "auth/required"
};
function isRootAction(action) {
  return action.type.startsWith("root/");
}
function isSessionAction(action) {
  return action.type.startsWith("session/");
}
function isChatAction(action) {
  return action.type.startsWith("chat/");
}
function isTerminalAction(action) {
  return action.type.startsWith("terminal/");
}
function isChangesetAction(action) {
  return action.type.startsWith("changeset/");
}
function isAnnotationsAction(action) {
  return action.type.startsWith("annotations/");
}
export {
  ActionType,
  AuthRequiredReason,
  NotificationType,
  isAnnotationsAction,
  isChangesetAction,
  isChatAction,
  isRootAction,
  isSessionAction,
  isTerminalAction
};
