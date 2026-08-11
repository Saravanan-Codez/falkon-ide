import { Codicon } from "../../../base/common/codicons.js";
import { localize, localize2 } from "../../../nls.js";
const ChatSessionArchiveActionWordingSettingId = "chat.experimental.sessionArchiveActionWording";
var ChatSessionArchiveActionWording = /* @__PURE__ */ ((ChatSessionArchiveActionWording2) => {
  ChatSessionArchiveActionWording2["Archive"] = "archive";
  ChatSessionArchiveActionWording2["MarkAsDone"] = "done";
  return ChatSessionArchiveActionWording2;
})(ChatSessionArchiveActionWording || {});
const archiveActionPresentation = {
  archive: {
    title: localize2("chatSession.archive", "Archive"),
    icon: Codicon.archive
  },
  archiveAll: {
    title: localize2("chatSession.archiveAll", "Archive All"),
    icon: Codicon.archive
  },
  unarchive: {
    title: localize2("chatSession.unarchive", "Unarchive"),
    icon: Codicon.unarchive
  },
  unarchiveAll: {
    title: localize2("chatSession.unarchiveAll", "Unarchive All"),
    icon: Codicon.unarchive
  }
};
const markAsDoneActionPresentation = {
  archive: {
    title: localize2("chatSession.markAsDone", "Mark as Done"),
    icon: Codicon.check
  },
  archiveAll: {
    title: localize2("chatSession.markAllAsDone", "Mark All as Done"),
    icon: Codicon.checkAll
  },
  unarchive: {
    title: localize2("chatSession.restore", "Restore"),
    icon: Codicon.redo
  },
  unarchiveAll: {
    title: localize2("chatSession.restoreAll", "Restore All"),
    icon: Codicon.redo
  }
};
function getChatSessionArchiveActionWording(configurationService) {
  return configurationService.getValue(ChatSessionArchiveActionWordingSettingId) === "done" /* MarkAsDone */ ? "done" /* MarkAsDone */ : "archive" /* Archive */;
}
function getChatSessionArchiveActionPresentation(wording) {
  return wording === "done" /* MarkAsDone */ ? markAsDoneActionPresentation : archiveActionPresentation;
}
function getChatSessionArchivedSectionLabel(wording) {
  return wording === "done" /* MarkAsDone */ ? localize("chatSession.section.done", "Done") : localize("chatSession.section.archived", "Archived");
}
export {
  ChatSessionArchiveActionWording,
  ChatSessionArchiveActionWordingSettingId,
  getChatSessionArchiveActionPresentation,
  getChatSessionArchiveActionWording,
  getChatSessionArchivedSectionLabel
};
