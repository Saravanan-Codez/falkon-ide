import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { basename } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { appendMarkdownString, canMergeMarkdownStrings } from "../model/chatModel.js";
const contentRefUrl = "http://_vscodecontentref_";
function annotateSpecialMarkdownContent(response) {
  let refIdPool = 0;
  const result = [];
  for (const item of response) {
    const previousItemIndex = result.findLastIndex((p) => p.kind !== "textEditGroup" && p.kind !== "undoStop");
    const previousItem = result[previousItemIndex];
    if (item.kind === "inlineReference") {
      let label = item.name;
      if (!label) {
        if (URI.isUri(item.inlineReference)) {
          label = basename(item.inlineReference);
        } else if (isLocation(item.inlineReference)) {
          label = basename(item.inlineReference.uri);
        } else {
          label = item.inlineReference.name;
        }
      }
      const previousText = previousItem?.kind === "markdownContent" ? previousItem.content.value : "";
      if (isInsideCodeContext(previousText)) {
        if (previousItem?.kind === "markdownContent") {
          const merged = appendMarkdownString(previousItem.content, new MarkdownString(label));
          result[previousItemIndex] = { ...previousItem, content: merged };
        } else {
          result.push({ content: new MarkdownString(label), kind: "markdownContent" });
        }
      } else {
        const refId = refIdPool++;
        const printUri = URI.parse(contentRefUrl).with({ path: String(refId) });
        const markdownText = `[${label}](${printUri.toString()})`;
        const annotationMetadata = { [refId]: item };
        if (previousItem?.kind === "markdownContent") {
          const merged = appendMarkdownString(previousItem.content, new MarkdownString(markdownText));
          result[previousItemIndex] = { ...previousItem, content: merged, inlineReferences: { ...annotationMetadata, ...previousItem.inlineReferences || {} } };
        } else {
          result.push({ content: new MarkdownString(markdownText), inlineReferences: annotationMetadata, kind: "markdownContent" });
        }
      }
    } else if (item.kind === "markdownContent" && previousItem?.kind === "markdownContent") {
      if (canMergeMarkdownStrings(previousItem.content, item.content)) {
        const merged = appendMarkdownString(previousItem.content, item.content);
        result[previousItemIndex] = { ...previousItem, content: merged };
      } else if (previousItem.inlineReferences && isContentRefOnly(previousItem.content.value)) {
        result[previousItemIndex] = {
          ...previousItem,
          content: {
            ...item.content,
            value: previousItem.content.value + item.content.value
          }
        };
      } else {
        result.push(item);
      }
    } else if (item.kind === "markdownVuln") {
      const vulnText = encodeURIComponent(JSON.stringify(item.vulnerabilities));
      const markdownText = `<vscode_annotation details='${vulnText}'>${item.content.value}</vscode_annotation>`;
      if (previousItem?.kind === "markdownContent") {
        const merged = appendMarkdownString(previousItem.content, new MarkdownString(markdownText));
        result[previousItemIndex] = { ...previousItem, content: merged };
      } else {
        result.push({ content: new MarkdownString(markdownText), kind: "markdownContent" });
      }
    } else if (item.kind === "codeblockUri") {
      if (previousItem?.kind === "markdownContent") {
        const isEditText = item.isEdit ? ` isEdit` : "";
        const subAgentText = item.subAgentInvocationId ? ` subAgentInvocationId="${encodeURIComponent(item.subAgentInvocationId)}"` : "";
        const markdownText = `<vscode_codeblock_uri${isEditText}${subAgentText}>${item.uri.toString()}</vscode_codeblock_uri>`;
        const merged = appendMarkdownString(previousItem.content, new MarkdownString(markdownText));
        result.splice(previousItemIndex, 1);
        result.push({ ...previousItem, content: merged });
      }
    } else if (item.kind === "voiceProgress") {
      continue;
    } else {
      result.push(item);
    }
  }
  return result;
}
const contentRefPattern = new RegExp(`^(\\[.*?\\]\\(${contentRefUrl}/\\d+\\))+$`);
function isContentRefOnly(text) {
  return contentRefPattern.test(text);
}
function isInsideCodeContext(text) {
  const lines = text.split("\n");
  let inFencedBlock = false;
  let fenceChar = "";
  let fenceLength = 0;
  const unfencedLines = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (inFencedBlock) {
      const closeLength = countLeadingChar(trimmed, fenceChar);
      if (closeLength >= fenceLength && trimmed.substring(closeLength).trim() === "") {
        inFencedBlock = false;
        unfencedLines.length = 0;
      }
      continue;
    }
    const firstChar = trimmed[0];
    if (firstChar === "`" || firstChar === "~") {
      const openLength = countLeadingChar(trimmed, firstChar);
      if (openLength >= 3 && (firstChar === "~" || !trimmed.substring(openLength).includes("`"))) {
        inFencedBlock = true;
        fenceChar = firstChar;
        fenceLength = openLength;
        unfencedLines.length = 0;
        continue;
      }
    }
    unfencedLines.push(line);
  }
  return inFencedBlock || hasUnclosedInlineCode(unfencedLines.join("\n"));
}
function countLeadingChar(text, char) {
  let count = 0;
  while (count < text.length && text[count] === char) {
    count++;
  }
  return count;
}
function hasUnclosedInlineCode(text) {
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "`") {
      i++;
      continue;
    }
    const openLen = countLeadingChar(text.substring(i), "`");
    i += openLen;
    let found = false;
    while (i < text.length) {
      if (text[i] !== "`") {
        i++;
        continue;
      }
      const closeLen = countLeadingChar(text.substring(i), "`");
      i += closeLen;
      if (closeLen === openLen) {
        found = true;
        break;
      }
    }
    if (!found) {
      return true;
    }
  }
  return false;
}
function extractCodeblockUrisFromText(text) {
  const match = /<vscode_codeblock_uri( isEdit)?( subAgentInvocationId="([^"]*)")?>([\s\S]*?)<\/vscode_codeblock_uri>/ms.exec(text);
  if (match) {
    const [all, isEdit, , encodedSubAgentId, uriString] = match;
    if (uriString) {
      let result;
      try {
        result = URI.parse(uriString);
      } catch {
        return void 0;
      }
      const textWithoutResult = text.substring(0, match.index) + text.substring(match.index + all.length);
      let subAgentInvocationId;
      if (encodedSubAgentId) {
        try {
          subAgentInvocationId = decodeURIComponent(encodedSubAgentId);
        } catch {
          subAgentInvocationId = encodedSubAgentId;
        }
      }
      return { uri: result, textWithoutResult, isEdit: !!isEdit, subAgentInvocationId };
    }
  }
  return void 0;
}
function extractSubAgentInvocationIdFromText(text) {
  const match = /<vscode_codeblock_uri[^>]* subAgentInvocationId="([^"]*)"/ms.exec(text);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return void 0;
}
function hasCodeblockUriTag(text) {
  return text.includes("<vscode_codeblock_uri");
}
function hasEditCodeblockUriTag(text) {
  return text.includes("<vscode_codeblock_uri isEdit");
}
function extractVulnerabilitiesFromText(text) {
  const vulnerabilities = [];
  let newText = text;
  let match;
  while ((match = /<vscode_annotation details='(.*?)'>(.*?)<\/vscode_annotation>/ms.exec(newText)) !== null) {
    const [full, details, content] = match;
    const start = match.index;
    const textBefore = newText.substring(0, start);
    const linesBefore = textBefore.split("\n").length - 1;
    const linesInside = content.split("\n").length - 1;
    const previousNewlineIdx = textBefore.lastIndexOf("\n");
    const startColumn = start - (previousNewlineIdx + 1) + 1;
    const endPreviousNewlineIdx = (textBefore + content).lastIndexOf("\n");
    const endColumn = start + content.length - (endPreviousNewlineIdx + 1) + 1;
    try {
      const vulnDetails = JSON.parse(decodeURIComponent(details));
      vulnDetails.forEach(({ title, description }) => vulnerabilities.push({
        title,
        description,
        range: { startLineNumber: linesBefore + 1, startColumn, endLineNumber: linesBefore + linesInside + 1, endColumn }
      }));
    } catch (err) {
    }
    newText = newText.substring(0, start) + content + newText.substring(start + full.length);
  }
  return { newText, vulnerabilities };
}
export {
  annotateSpecialMarkdownContent,
  contentRefUrl,
  extractCodeblockUrisFromText,
  extractSubAgentInvocationIdFromText,
  extractVulnerabilitiesFromText,
  hasCodeblockUriTag,
  hasEditCodeblockUriTag,
  isInsideCodeContext
};
