import { isDefined } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { SessionStatus as ProtocolSessionStatus } from "../../../../../platform/agentHost/common/state/protocol/state.js";
import { normalizeFileEdit } from "../../../../../platform/agentHost/common/fileEditDiff.js";
import { canonicalizeSessionDbUri } from "../../../../../platform/agentHost/common/sessionDbUri.js";
import { isIChatSessionFileChange2 } from "../../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { SessionStatus } from "../../../../services/sessions/common/session.js";
import { readChangesetFileMeta } from "../../../../../platform/agentHost/common/meta/agentChangesetFileMeta.js";
function mapProtocolStatus(protocol) {
  if ((protocol & ProtocolSessionStatus.InputNeeded) === ProtocolSessionStatus.InputNeeded) {
    return SessionStatus.NeedsInput;
  }
  if (protocol & ProtocolSessionStatus.InProgress) {
    return SessionStatus.InProgress;
  }
  if (protocol & ProtocolSessionStatus.Error) {
    return SessionStatus.Error;
  }
  return SessionStatus.Completed;
}
function diffToChange(file, mapUri) {
  const normalized = normalizeFileEdit(file.edit);
  if (!normalized) {
    return void 0;
  }
  const map = (uri2) => mapUri ? mapUri(uri2) : uri2;
  const uri = map(normalized.resource);
  const modifiedUri = normalized.afterUri ? map(normalized.afterUri) : void 0;
  const originalUri = normalized.beforeContentUri ? map(normalized.beforeContentUri) : void 0;
  const meta = readChangesetFileMeta(file);
  return {
    uri,
    modifiedUri,
    originalUri,
    insertions: file.edit?.diff?.added ?? 0,
    deletions: file.edit?.diff?.removed ?? 0,
    reviewed: file.reviewed ?? meta?.reviewed
  };
}
function changesetFileToChange(file, mapUri) {
  return diffToChange(file, mapUri);
}
function diffsToChanges(files, mapUri) {
  return files.map((d) => diffToChange(d, mapUri)).filter(isDefined);
}
function changesetFilesToChanges(files, mapUri) {
  return diffsToChanges(files, mapUri);
}
function diffsEqual(current, diffs, mapUri) {
  if (current.length !== diffs.length) {
    return false;
  }
  for (let i = 0; i < current.length; i++) {
    const c = current[i];
    const d = diffs[i];
    const rawUri = d.after?.uri ?? d.before?.uri;
    if (!rawUri) {
      continue;
    }
    const parsed = URI.parse(rawUri);
    const diffUri = mapUri ? mapUri(parsed) : parsed;
    const cUri = isIChatSessionFileChange2(c) ? c.uri : c.modifiedUri;
    if (cUri.toString() !== diffUri.toString() || c.insertions !== (d.diff?.added ?? 0) || c.deletions !== (d.diff?.removed ?? 0)) {
      return false;
    }
    const beforeContentUri = d.before?.content?.uri;
    const beforeUri = d.before?.uri;
    const currentOriginal = c.originalUri?.toString();
    if (beforeContentUri && beforeUri) {
      const parsedBefore = canonicalizeSessionDbUri(URI.parse(beforeContentUri), URI.parse(beforeUri));
      const mappedBefore = mapUri ? mapUri(parsedBefore) : parsedBefore;
      if (currentOriginal !== mappedBefore.toString()) {
        return false;
      }
    } else if (currentOriginal) {
      return false;
    }
  }
  return true;
}
function changesetFilesEqual(current, files, mapUri) {
  return diffsEqual(current, files.map((f) => f.edit), mapUri);
}
export {
  changesetFileToChange,
  changesetFilesEqual,
  changesetFilesToChanges,
  diffToChange,
  diffsEqual,
  diffsToChanges,
  mapProtocolStatus
};
