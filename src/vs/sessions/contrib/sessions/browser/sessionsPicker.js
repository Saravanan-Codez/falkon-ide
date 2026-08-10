import { isActiveSessionStatus, SessionStatus } from "../../../services/sessions/common/session.js";
function groupSessionsForPicker(recentSessions, otherSessions) {
  const needsInput = [];
  const unread = [];
  const recent = [];
  const other = [];
  const groupSession = (session, remaining) => {
    const status = session.status.get();
    if (session.isArchived.get()) {
      return;
    } else if (status === SessionStatus.NeedsInput) {
      needsInput.push(session);
    } else if (!isActiveSessionStatus(status) && !session.isRead.get()) {
      unread.push(session);
    } else {
      remaining.push(session);
    }
  };
  for (const session of recentSessions) {
    groupSession(session, recent);
  }
  for (const session of otherSessions) {
    groupSession(session, other);
  }
  return { needsInput, unread, recent, other };
}
export {
  groupSessionsForPicker
};
