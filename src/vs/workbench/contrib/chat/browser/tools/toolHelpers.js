import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { ChatPermissionLevel, isAutoApproveLevel } from "../../common/constants.js";
import { createToolSimpleTextResult } from "../../common/tools/builtinTools/toolHelpers.js";
import { WorkingDirectory } from "../../common/workingDirectory.js";
function resolveSymbolToolFileUri(input, workspaceContextService, workingDirectory) {
  if (input.uri) {
    return URI.parse(input.uri);
  }
  if (input.filePath) {
    const workingDir = new WorkingDirectory(workspaceContextService, workingDirectory);
    return workingDir.resolveRelativePath(input.filePath);
  }
  return void 0;
}
function getChatPermissionLevelForToolInvocation(chatSessionResource, chatRequestId, chatWidgetService, chatService) {
  if (!chatSessionResource) {
    return void 0;
  }
  const model = chatService.getSession(chatSessionResource);
  const request = chatRequestId ? model?.getRequests().find((request2) => request2.id === chatRequestId) : void 0;
  if (request) {
    return request.modeInfo?.permissionLevel ?? ChatPermissionLevel.Default;
  }
  const widget = chatWidgetService.getWidgetBySessionResource(chatSessionResource);
  if (widget) {
    return widget.input.currentModeInfo.permissionLevel ?? ChatPermissionLevel.Default;
  }
  return model?.getRequests().at(-1)?.modeInfo?.permissionLevel ?? ChatPermissionLevel.Default;
}
function getSandboxPrecheckInputsForToolInvocation(chatSessionResource, chatRequestId, chatWidgetService, chatService) {
  const chatPermissionLevel = getChatPermissionLevelForToolInvocation(chatSessionResource, chatRequestId, chatWidgetService, chatService);
  return chatPermissionLevel === void 0 ? void 0 : { isDefaultApprovalPermissionEnabled: !isAutoApproveLevel(chatPermissionLevel) };
}
function findLineNumber(model, lineContent) {
  const parts = lineContent.trim().split(/\s+/);
  const pattern = parts.map(escapeRegExpCharacters).join("\\s+");
  const matches = model.findMatches(pattern, false, true, false, null, false, 1);
  if (matches.length === 0) {
    return void 0;
  }
  return matches[0].range.startLineNumber;
}
function findSymbolColumn(lineText, symbol) {
  const pattern = new RegExp(`\\b${escapeRegExpCharacters(symbol)}\\b`);
  const match = pattern.exec(lineText);
  if (match) {
    return match.index + 1;
  }
  return void 0;
}
function errorResult(message) {
  const result = createToolSimpleTextResult(message);
  result.toolResultMessage = new MarkdownString(message);
  return result;
}
export {
  errorResult,
  findLineNumber,
  findSymbolColumn,
  getChatPermissionLevelForToolInvocation,
  getSandboxPrecheckInputsForToolInvocation,
  resolveSymbolToolFileUri
};
