import { match as globMatch } from "../../../../base/common/glob.js";
import { getExtensionForMimeType } from "../../../../base/common/mime.js";
import { basename as pathBasename } from "../../../../base/common/path.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IChatToolInvocation } from "./chatService/chatService.js";
import { ChatResponseResource } from "./model/chatModel.js";
import { isToolResultInputOutputDetails } from "./tools/languageModelToolsService.js";
const CHAT_MEMORY_FILE_SCHEME = "chat-memory-file";
const MEMORY_TOOL_ID = "copilot_memory";
var ChatMemoryFileResource;
((ChatMemoryFileResource2) => {
  function createUri(memoryPath, sessionResource) {
    return URI.from({
      scheme: CHAT_MEMORY_FILE_SCHEME,
      path: memoryPath,
      query: sessionResource.toString()
    });
  }
  ChatMemoryFileResource2.createUri = createUri;
  function isChatMemoryFileUri(uri) {
    return uri.scheme === CHAT_MEMORY_FILE_SCHEME;
  }
  ChatMemoryFileResource2.isChatMemoryFileUri = isChatMemoryFileUri;
  function parse(uri) {
    return {
      memoryPath: uri.path,
      sessionResource: uri.query
    };
  }
  ChatMemoryFileResource2.parse = parse;
})(ChatMemoryFileResource || (ChatMemoryFileResource = {}));
function matchMimeType(pattern, mimeType) {
  if (pattern === mimeType) {
    return true;
  }
  const [patternType, patternSubtype] = pattern.split("/");
  const [type] = mimeType.split("/");
  return patternSubtype === "*" && patternType === type;
}
function findFilePathRule(filePath, byFilePath) {
  const fileBasename = pathBasename(filePath);
  for (const [pattern, config] of Object.entries(byFilePath)) {
    if (globMatch(pattern, filePath) || globMatch(pattern, fileBasename)) {
      return config;
    }
  }
  return void 0;
}
function findMimeTypeRule(mimeType, byMimeType) {
  for (const [pattern, config] of Object.entries(byMimeType)) {
    if (matchMimeType(pattern, mimeType)) {
      return config;
    }
  }
  return void 0;
}
function isToolResultOutputDetailsSerialized(obj) {
  return typeof obj === "object" && obj !== null && "output" in obj && typeof obj.output === "object" && obj.output?.type === "data" && typeof obj.output?.mimeType === "string";
}
function getMemoryPathFromParams(params) {
  if (typeof params !== "object" || params === null) {
    return void 0;
  }
  const path = params["path"];
  return typeof path === "string" ? path : void 0;
}
const memoryWriteCommands = /* @__PURE__ */ new Set(["create", "str_replace", "insert"]);
function isMemoryWriteCommand(params) {
  if (typeof params !== "object" || params === null) {
    return false;
  }
  const command = params["command"];
  return typeof command === "string" && memoryWriteCommands.has(command);
}
function extractArtifactsFromResponse(response, sessionResource, byMimeType, byFilePath, byMemoryFilePath = {}) {
  const artifacts = [];
  const seenUris = /* @__PURE__ */ new Set();
  for (const part of response.value) {
    if (part.kind === "codeblockUri") {
      const uri = part.uri;
      const uriStr = uri.toString();
      if (seenUris.has(uriStr)) {
        continue;
      }
      const rule = findFilePathRule(uri.path, byFilePath);
      if (rule) {
        seenUris.add(uriStr);
        artifacts.push({
          label: basename(uri),
          uri: uriStr,
          type: "plan",
          groupName: rule.groupName,
          onlyShowGroup: rule.onlyShowGroup
        });
      }
    }
    if (part.kind === "textEditGroup") {
      const uri = part.uri;
      const uriStr = uri.toString();
      if (seenUris.has(uriStr)) {
        continue;
      }
      const rule = findFilePathRule(uri.path, byFilePath);
      if (rule) {
        seenUris.add(uriStr);
        artifacts.push({
          label: basename(uri),
          uri: uriStr,
          type: "plan",
          groupName: rule.groupName,
          onlyShowGroup: rule.onlyShowGroup
        });
      }
    }
    if (part.kind === "workspaceEdit") {
      for (const edit of part.edits) {
        const uri = edit.newResource ?? edit.oldResource;
        if (!uri) {
          continue;
        }
        const uriStr = uri.toString();
        if (seenUris.has(uriStr)) {
          continue;
        }
        const rule = findFilePathRule(uri.path, byFilePath);
        if (rule) {
          seenUris.add(uriStr);
          artifacts.push({
            label: basename(uri),
            uri: uriStr,
            type: "plan",
            groupName: rule.groupName,
            onlyShowGroup: rule.onlyShowGroup
          });
        }
      }
    }
    if (part.kind === "externalEdit") {
      const uri = part.uri;
      const uriStr = uri.toString();
      if (seenUris.has(uriStr)) {
        continue;
      }
      const rule = findFilePathRule(uri.path, byFilePath);
      if (rule) {
        seenUris.add(uriStr);
        artifacts.push({
          label: basename(uri),
          uri: uriStr,
          type: "plan",
          groupName: rule.groupName,
          onlyShowGroup: rule.onlyShowGroup
        });
      }
    }
    if ((part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") && part.toolId === MEMORY_TOOL_ID) {
      const params = IChatToolInvocation.getParameters(part);
      const memoryPath = getMemoryPathFromParams(params);
      if (memoryPath && isMemoryWriteCommand(params)) {
        const rule = findFilePathRule(memoryPath, byMemoryFilePath);
        if (rule) {
          const key = `memory:${part.toolCallId}:${memoryPath}`;
          if (!seenUris.has(key)) {
            seenUris.add(key);
            artifacts.push({
              label: pathBasename(memoryPath),
              uri: ChatMemoryFileResource.createUri(memoryPath, sessionResource).toString(),
              type: "plan",
              groupName: rule.groupName,
              onlyShowGroup: rule.onlyShowGroup
            });
          }
        }
      }
    }
    if (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") {
      const details = IChatToolInvocation.resultDetails(part);
      if (!details) {
        continue;
      }
      if (isToolResultInputOutputDetails(details)) {
        for (let i = 0; i < details.output.length; i++) {
          const outputPart = details.output[i];
          if (outputPart.type === "embed" && !outputPart.isText && outputPart.mimeType) {
            const rule = findMimeTypeRule(outputPart.mimeType, byMimeType);
            if (rule) {
              const key = `${part.toolCallId}:${i}`;
              if (!seenUris.has(key)) {
                seenUris.add(key);
                const ext = getExtensionForMimeType(outputPart.mimeType);
                const permalinkBasename = ext ? `file${ext}` : "file.bin";
                const artifactUri = ChatResponseResource.createUri(sessionResource, part.toolCallId, i, permalinkBasename);
                artifacts.push({
                  label: outputPart.uri?.path.split("/").pop() ?? `${rule.groupName} ${i + 1}`,
                  uri: artifactUri.toString(),
                  toolCallId: part.toolCallId,
                  dataPartIndex: i,
                  type: "screenshot",
                  groupName: rule.groupName,
                  onlyShowGroup: rule.onlyShowGroup
                });
              }
            }
          }
        }
      }
      if (isToolResultOutputDetailsSerialized(details)) {
        const rule = findMimeTypeRule(details.output.mimeType, byMimeType);
        if (rule) {
          const key = `${part.toolCallId}:0`;
          if (!seenUris.has(key)) {
            seenUris.add(key);
            const ext = getExtensionForMimeType(details.output.mimeType);
            const permalinkBasename = ext ? `file${ext}` : "file.bin";
            const artifactUri = ChatResponseResource.createUri(sessionResource, part.toolCallId, 0, permalinkBasename);
            artifacts.push({
              label: `${rule.groupName}`,
              uri: artifactUri.toString(),
              toolCallId: part.toolCallId,
              dataPartIndex: 0,
              type: "screenshot",
              groupName: rule.groupName,
              onlyShowGroup: rule.onlyShowGroup
            });
          }
        }
      }
    }
  }
  return artifacts;
}
export {
  ChatMemoryFileResource,
  extractArtifactsFromResponse
};
