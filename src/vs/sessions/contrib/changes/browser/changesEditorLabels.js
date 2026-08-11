import { isEqual } from "../../../../base/common/resources.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
function getChangesEditorFileStats(resource, changes) {
  const change = changes.find((change2) => {
    const resources = isIChatSessionFileChange2(change2) ? [change2.uri, change2.modifiedUri, change2.originalUri] : [change2.modifiedUri, change2.originalUri];
    return resources.some((candidate) => candidate && isEqual(candidate, resource));
  });
  return change ? { insertions: change.insertions, deletions: change.deletions } : void 0;
}
function getChangesEditorDescription(uri, label, labelService) {
  const fullLabel = labelService.getUriLabel(uri, { relative: true });
  const separator = labelService.getSeparator(uri.scheme, uri.authority);
  const lastSeparatorIndex = fullLabel.lastIndexOf(separator);
  if (lastSeparatorIndex < 0) {
    return fullLabel === label ? "" : fullLabel;
  }
  return fullLabel.slice(0, lastSeparatorIndex);
}
function getChangesEditorLabels(uri, labelService) {
  const label = labelService.getUriBasenameLabel(uri);
  return {
    label,
    description: getChangesEditorDescription(uri, label, labelService)
  };
}
export {
  getChangesEditorFileStats,
  getChangesEditorLabels
};
