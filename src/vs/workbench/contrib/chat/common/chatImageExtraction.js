import { decodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { getExtensionForMimeType, getMediaMime } from "../../../../base/common/mime.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { isLocation } from "../../../../editor/common/languages.js";
import { isRequestVM } from "./model/chatViewModel.js";
import { ChatResponseResource } from "./model/chatModel.js";
import { IChatToolInvocation } from "./chatService/chatService.js";
import { isToolResultInputOutputDetails, isToolResultOutputDetails } from "./tools/languageModelToolsService.js";
import { getExplicitFileOrImageAttachmentSummary, isImageVariableEntry } from "./attachments/chatVariableEntries.js";
async function extractImagesFromChatResponse(response, readFile) {
  const allImages = [];
  for (const item of response.response.value) {
    if (item.kind === "toolInvocation" || item.kind === "toolInvocationSerialized") {
      const images = extractImagesFromToolInvocationOutputDetails(item, response.sessionResource);
      allImages.push(...images);
      const messageImages = await extractImagesFromToolInvocationMessages(item, readFile);
      allImages.push(...messageImages);
    } else if (item.kind === "inlineReference") {
      const image = await extractImageFromInlineReference(item, readFile);
      if (image) {
        allImages.push(image);
      }
    }
  }
  const request = response.session.getItems().find((item) => isRequestVM(item) && item.id === response.requestId);
  const title = request ? request.messageText.trim() || getExplicitFileOrImageAttachmentSummary(request.variables) || localize("chatImageExtraction.defaultTitle", "Images") : localize("chatImageExtraction.defaultTitle", "Images");
  return {
    id: response.sessionResource.toString() + "_" + response.id,
    title,
    images: allImages
  };
}
function extractImagesFromToolInvocationOutputDetails(toolInvocation, sessionResource) {
  const images = [];
  const resultDetails = IChatToolInvocation.resultDetails(toolInvocation);
  const caption = toolInvocation.pastTenseMessage ?? toolInvocation.invocationMessage;
  const pushImage = (mimeType, data, outputIndex) => {
    const ext = getExtensionForMimeType(mimeType);
    const permalinkBasename = ext ? `file${ext}` : "file.bin";
    const uri = ChatResponseResource.createUri(sessionResource, toolInvocation.toolCallId, outputIndex, permalinkBasename);
    images.push({
      id: `${toolInvocation.toolCallId}_${outputIndex}`,
      uri,
      name: localize("chatImageExtraction.imageName", "Image {0}", images.length + 1),
      mimeType,
      data,
      source: localize("chatImageExtraction.toolSource", "Tool: {0}", toolInvocation.toolId),
      caption
    });
  };
  if (isToolResultInputOutputDetails(resultDetails)) {
    for (let i = 0; i < resultDetails.output.length; i++) {
      const outputItem = resultDetails.output[i];
      if (outputItem.type === "embed" && outputItem.mimeType?.startsWith("image/") && !outputItem.isText) {
        pushImage(outputItem.mimeType, decodeBase64(outputItem.value), i);
      }
    }
  } else if (isToolResultOutputDetails(resultDetails)) {
    const output = resultDetails.output;
    if (output.mimeType?.startsWith("image/")) {
      const data = getImageDataFromOutputDetails(resultDetails, toolInvocation);
      if (data) {
        pushImage(output.mimeType, data, 0);
      }
    }
  }
  return images;
}
async function extractImagesFromToolInvocationMessages(toolInvocation, readFile) {
  const message = toolInvocation.pastTenseMessage ?? toolInvocation.invocationMessage;
  if (!message || typeof message === "string" || !message.uris || Object.keys(message.uris).length === 0) {
    return [];
  }
  const images = [];
  for (const uriComponents of Object.values(message.uris)) {
    const uri = URI.revive(uriComponents);
    const mimeType = getMediaMime(uri.path);
    if (mimeType?.startsWith("image/")) {
      let data;
      try {
        data = await readFile(uri);
      } catch {
        continue;
      }
      const name = uri.path.split("/").pop() ?? "image";
      images.push({
        id: uri.toString(),
        uri,
        name,
        mimeType,
        data,
        source: localize("chatImageExtraction.toolSource", "Tool: {0}", toolInvocation.toolId),
        caption: message
      });
    }
  }
  return images;
}
function getImageDataFromOutputDetails(resultDetails, toolInvocation) {
  if (toolInvocation.kind === "toolInvocationSerialized") {
    const serializedDetails = resultDetails;
    if (serializedDetails.output.base64Data) {
      return decodeBase64(serializedDetails.output.base64Data);
    }
    return void 0;
  } else {
    return resultDetails.output.value;
  }
}
async function extractImageFromInlineReference(part, readFile) {
  const ref = part.inlineReference;
  const refUri = URI.isUri(ref) ? ref : isLocation(ref) ? ref.uri : ref.location.uri;
  const mime = getMediaMime(refUri.path);
  if (!mime?.startsWith("image/")) {
    return void 0;
  }
  let data;
  try {
    data = await readFile(refUri);
  } catch {
    return void 0;
  }
  const name = part.name ?? refUri.path.split("/").pop() ?? "image";
  return {
    id: refUri.toString(),
    uri: refUri,
    name,
    mimeType: mime,
    data,
    source: localize("chatImageExtraction.inlineReference", "File"),
    caption: void 0
  };
}
function coerceImageBuffer(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const record = value;
  const keys = Object.keys(record).sort((a, b) => Number(a) - Number(b));
  if (keys.length === 0) {
    return void 0;
  }
  const result = new Uint8Array(keys.length);
  for (let index = 0; index < keys.length; index++) {
    const byte = record[keys[index]];
    if (keys[index] !== String(index) || typeof byte !== "number" || !Number.isInteger(byte) || byte < 0 || byte > 255) {
      return void 0;
    }
    result[index] = byte;
  }
  return result;
}
function extractImagesFromChatRequest(request) {
  return extractImagesFromChatVariables(request.variables);
}
function extractImagesFromChatVariables(variables) {
  const images = [];
  for (const variable of variables) {
    if (!isImageVariableEntry(variable)) {
      continue;
    }
    const buffer = coerceImageBuffer(variable.value);
    if (!buffer) {
      continue;
    }
    const mimeType = variable.mimeType ?? getMediaMime(variable.name) ?? "image/png";
    const uri = variable.references?.[0]?.reference;
    const imageUri = URI.isUri(uri) ? uri : URI.from({ scheme: "data", path: `${variable.id}/${encodeURIComponent(variable.name)}` });
    images.push({
      id: imageUri.toString(),
      uri: imageUri,
      name: variable.name,
      mimeType,
      data: VSBuffer.wrap(buffer),
      source: localize("chatImageExtraction.userAttachment", "Attachment"),
      caption: void 0
    });
  }
  return images;
}
export {
  coerceImageBuffer,
  extractImagesFromChatRequest,
  extractImagesFromChatResponse,
  extractImagesFromChatVariables,
  extractImagesFromToolInvocationMessages,
  extractImagesFromToolInvocationOutputDetails
};
