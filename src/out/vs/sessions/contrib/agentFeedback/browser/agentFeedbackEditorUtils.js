import { URI } from "../../../../base/common/uri.js";
import { isEqual } from "../../../../base/common/resources.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../workbench/common/editor.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { MultiDiffEditorInput } from "../../../../workbench/contrib/multiDiffEditor/browser/multiDiffEditorInput.js";
import { SessionChangesEditorInput } from "../../changes/browser/sessionChangesEditorInput.js";
function changeMatchesResource(change, resourceUri) {
  if (isIChatSessionFileChange2(change)) {
    return isEqual(change.uri, resourceUri) || isEqual(change.modifiedUri, resourceUri) || isEqual(change.originalUri, resourceUri);
  }
  return isEqual(change.modifiedUri, resourceUri) || isEqual(change.originalUri, resourceUri);
}
function getSessionChangeForResource(sessionResource, resourceUri, sessionsManagementService) {
  if (!sessionResource) {
    return void 0;
  }
  const sessionData = sessionsManagementService.getSession(sessionResource);
  if (sessionData) {
    const changes = sessionData.changes.get();
    return changes.find((change) => changeMatchesResource(change, resourceUri));
  }
  return void 0;
}
function createAgentFeedbackContext(editor, codeEditorService, resourceUri, range) {
  const codeSelection = getCodeSelection(editor, codeEditorService, resourceUri, range);
  const diffHunks = getDiffHunks(editor, codeEditorService, resourceUri, range);
  return { codeSelection, diffHunks };
}
function getCodeSelection(editor, codeEditorService, resourceUri, range) {
  const model = getModelForResource(editor, codeEditorService, resourceUri);
  if (!model) {
    return void 0;
  }
  const selection = model.getValueInRange(range);
  return selection.length > 0 ? selection : void 0;
}
function getDiffHunks(editor, codeEditorService, resourceUri, range) {
  const diffEditor = getContainingDiffEditor(editor, codeEditorService);
  if (!diffEditor) {
    return void 0;
  }
  const originalModel = diffEditor.getOriginalEditor().getModel();
  const modifiedModel = diffEditor.getModifiedEditor().getModel();
  if (!originalModel || !modifiedModel) {
    return void 0;
  }
  const selectionIsInOriginal = isEqual(resourceUri, originalModel.uri);
  const selectionIsInModified = isEqual(resourceUri, modifiedModel.uri);
  if (!selectionIsInOriginal && !selectionIsInModified) {
    return void 0;
  }
  const diffResult = diffEditor.getDiffComputationResult();
  if (!diffResult) {
    return void 0;
  }
  const selectionIsEmpty = range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn;
  const relevantGroups = groupChanges(diffResult.changes2).filter((group) => {
    const changeTouchesSelection = (change) => rangeTouchesChange(range, selectionIsInOriginal ? change.original : change.modified);
    return selectionIsEmpty ? group.some(changeTouchesSelection) : group.every(changeTouchesSelection);
  });
  if (relevantGroups.length === 0) {
    return void 0;
  }
  const originalText = originalModel.getValue();
  const modifiedText = modifiedModel.getValue();
  const originalEndsWithNewline = originalText.length > 0 && originalText.endsWith("\n");
  const modifiedEndsWithNewline = modifiedText.length > 0 && modifiedText.endsWith("\n");
  const originalLines = originalText.split("\n");
  const modifiedLines = modifiedText.split("\n");
  if (originalEndsWithNewline && originalLines[originalLines.length - 1] === "") {
    originalLines.pop();
  }
  if (modifiedEndsWithNewline && modifiedLines[modifiedLines.length - 1] === "") {
    modifiedLines.pop();
  }
  return relevantGroups.map((group) => renderHunkGroup(group, originalLines, modifiedLines, originalEndsWithNewline, modifiedEndsWithNewline)).join("\n");
}
function getContainingDiffEditor(editor, codeEditorService) {
  return codeEditorService.listDiffEditors().find(
    (diffEditor) => diffEditor.getModifiedEditor() === editor || diffEditor.getOriginalEditor() === editor
  );
}
function getModelForResource(editor, codeEditorService, resourceUri) {
  const currentModel = editor.getModel();
  if (currentModel && isEqual(currentModel.uri, resourceUri)) {
    return currentModel;
  }
  const diffEditor = getContainingDiffEditor(editor, codeEditorService);
  const originalModel = diffEditor?.getOriginalEditor().getModel();
  if (originalModel && isEqual(originalModel.uri, resourceUri)) {
    return originalModel;
  }
  const modifiedModel = diffEditor?.getModifiedEditor().getModel();
  if (modifiedModel && isEqual(modifiedModel.uri, resourceUri)) {
    return modifiedModel;
  }
  return void 0;
}
function groupChanges(changes) {
  const contextSize = 3;
  const groups = [];
  let currentGroup = [];
  for (const change of changes) {
    if (currentGroup.length === 0) {
      currentGroup.push(change);
      continue;
    }
    const lastChange = currentGroup[currentGroup.length - 1];
    const lastContextEnd = lastChange.original.endLineNumberExclusive - 1 + contextSize;
    const currentContextStart = change.original.startLineNumber - contextSize;
    if (currentContextStart <= lastContextEnd + 1) {
      currentGroup.push(change);
    } else {
      groups.push(currentGroup);
      currentGroup = [change];
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
}
function rangeTouchesChange(range, lineRange) {
  const isEmptySelection = range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn;
  if (isEmptySelection) {
    return !lineRange.isEmpty && lineRange.contains(range.startLineNumber);
  }
  const selectionStart = range.startLineNumber;
  const selectionEndExclusive = range.endLineNumber + 1;
  return selectionStart <= lineRange.startLineNumber && lineRange.endLineNumberExclusive <= selectionEndExclusive;
}
function renderHunkGroup(group, originalLines, modifiedLines, originalEndsWithNewline, modifiedEndsWithNewline) {
  const contextSize = 3;
  const firstChange = group[0];
  const lastChange = group[group.length - 1];
  const hunkOrigStart = Math.max(1, firstChange.original.startLineNumber - contextSize);
  const hunkOrigEnd = Math.min(originalLines.length, lastChange.original.endLineNumberExclusive - 1 + contextSize);
  const hunkModStart = Math.max(1, firstChange.modified.startLineNumber - contextSize);
  const hunkLines = [];
  let lastOriginalLineIndex = -1;
  let lastModifiedLineIndex = -1;
  let origLineNum = hunkOrigStart;
  let origCount = 0;
  let modCount = 0;
  for (const change of group) {
    const origStart = change.original.startLineNumber;
    const origEnd = change.original.endLineNumberExclusive;
    const modStart = change.modified.startLineNumber;
    const modEnd = change.modified.endLineNumberExclusive;
    while (origLineNum < origStart) {
      const idx = hunkLines.length;
      hunkLines.push(` ${originalLines[origLineNum - 1]}`);
      if (origLineNum === originalLines.length) {
        lastOriginalLineIndex = idx;
      }
      const modLineNum = hunkModStart + modCount;
      if (modLineNum === modifiedLines.length) {
        lastModifiedLineIndex = idx;
      }
      origLineNum++;
      origCount++;
      modCount++;
    }
    for (let i = origStart; i < origEnd; i++) {
      const idx = hunkLines.length;
      hunkLines.push(`-${originalLines[i - 1]}`);
      if (i === originalLines.length) {
        lastOriginalLineIndex = idx;
      }
      origLineNum++;
      origCount++;
    }
    for (let i = modStart; i < modEnd; i++) {
      const idx = hunkLines.length;
      hunkLines.push(`+${modifiedLines[i - 1]}`);
      if (i === modifiedLines.length) {
        lastModifiedLineIndex = idx;
      }
      modCount++;
    }
  }
  while (origLineNum <= hunkOrigEnd) {
    const idx = hunkLines.length;
    hunkLines.push(` ${originalLines[origLineNum - 1]}`);
    if (origLineNum === originalLines.length) {
      lastOriginalLineIndex = idx;
    }
    const modLineNum = hunkModStart + modCount;
    if (modLineNum === modifiedLines.length) {
      lastModifiedLineIndex = idx;
    }
    origLineNum++;
    origCount++;
    modCount++;
  }
  const header = `@@ -${hunkOrigStart},${origCount} +${hunkModStart},${modCount} @@`;
  const result = [header, ...hunkLines];
  if (!originalEndsWithNewline && lastOriginalLineIndex >= 0) {
    result.splice(lastOriginalLineIndex + 2, 0, "\\ No newline at end of file");
  } else if (!modifiedEndsWithNewline && lastModifiedLineIndex >= 0) {
    result.splice(lastModifiedLineIndex + 2, 0, "\\ No newline at end of file");
  }
  return result.join("\n");
}
function getActiveResourceCandidates(input) {
  const result = [];
  const multiDiffInput = input instanceof SessionChangesEditorInput ? input.multiDiffInput : input;
  if (multiDiffInput instanceof MultiDiffEditorInput) {
    const items = multiDiffInput.resources.get();
    if (items) {
      for (const item of items) {
        if (item.originalUri) {
          result.push(item.originalUri);
        }
        if (item.modifiedUri) {
          result.push(item.modifiedUri);
        }
      }
    }
    return result;
  }
  const resources = EditorResourceAccessor.getOriginalUri(input, { supportSideBySide: SideBySideEditor.BOTH });
  if (!resources) {
    return result;
  }
  if (URI.isUri(resources)) {
    result.push(resources);
    return result;
  }
  if (resources.secondary) {
    result.push(resources.secondary);
  }
  if (resources.primary) {
    result.push(resources.primary);
  }
  return result;
}
export {
  changeMatchesResource,
  createAgentFeedbackContext,
  getActiveResourceCandidates,
  getSessionChangeForResource
};
