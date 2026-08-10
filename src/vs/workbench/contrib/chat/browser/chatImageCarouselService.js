var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { renderAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { getMediaMime } from "../../../../base/common/mime.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { localize } from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { extractImagesFromChatRequest, extractImagesFromChatResponse, extractImagesFromChatVariables } from "../common/chatImageExtraction.js";
import { isRequestVM, isResponseVM } from "../common/model/chatViewModel.js";
import { IChatWidgetService } from "./chat.js";
const IChatImageCarouselService = createDecorator("chatImageCarouselService");
async function collectCarouselSections(items, readFile, currentInput) {
  const sections = [];
  const requestMap = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (isRequestVM(item)) {
      requestMap.set(item.id, item);
    }
  }
  for (const item of items) {
    if (!isResponseVM(item)) {
      continue;
    }
    const { title: extractedTitle, images: responseImages } = await extractImagesFromChatResponse(item, async (uri) => VSBuffer.wrap(await readFile(uri)));
    const request = requestMap.get(item.requestId);
    const requestImages = request ? extractImagesFromChatRequest(request) : [];
    const allImages = [...requestImages, ...responseImages];
    const dedupedImages = deduplicateConsecutiveImages(allImages);
    if (dedupedImages.length > 0) {
      sections.push({
        title: request?.messageText ?? extractedTitle,
        images: dedupedImages.map(({ uri, name, mimeType, data, caption }) => ({ id: uri.toString(), name, mimeType, data: data.buffer, caption: toCaptionText(caption) }))
      });
    }
  }
  const respondedRequestIds = new Set(
    items.filter(isResponseVM).map((r) => r.requestId)
  );
  for (const item of items) {
    if (!isRequestVM(item) || respondedRequestIds.has(item.id)) {
      continue;
    }
    const requestImages = extractImagesFromChatRequest(item);
    const dedupedImages = deduplicateConsecutiveImages(requestImages);
    if (dedupedImages.length > 0) {
      sections.push({
        title: item.messageText,
        images: dedupedImages.map(({ uri, name, mimeType, data, caption }) => ({ id: uri.toString(), name, mimeType, data: data.buffer, caption: toCaptionText(caption) }))
      });
    }
  }
  if (currentInput) {
    const inputImages = deduplicateConsecutiveImages(extractImagesFromChatVariables(currentInput.attachments));
    if (inputImages.length > 0) {
      sections.push({
        title: currentInput.text.trim() || localize("chatImageCarousel.currentInput", "Current Input"),
        images: inputImages.map(({ uri, name, mimeType, data, caption }) => ({ id: uri.toString(), name, mimeType, data: data.buffer, caption: toCaptionText(caption) }))
      });
    }
  }
  return sections;
}
function toCaptionText(caption) {
  if (caption === void 0) {
    return void 0;
  }
  return typeof caption === "string" ? caption : stripIcons(renderAsPlaintext(caption, { useLinkFormatter: true }));
}
function deduplicateConsecutiveImages(images) {
  return images.filter((img, index) => {
    if (index === 0) {
      return true;
    }
    return !isEqual(images[index - 1].uri, img.uri);
  });
}
function findClickedImageIndex(sections, resource, data, preferredSectionIndex) {
  if (preferredSectionIndex !== void 0 && preferredSectionIndex >= 0 && preferredSectionIndex < sections.length) {
    const preferredSection = sections[preferredSectionIndex];
    const uriIndex = findImageInListByUri(preferredSection.images, resource);
    const localIndex = uriIndex >= 0 ? uriIndex : data ? findImageInListByData(preferredSection.images, data) : -1;
    if (localIndex >= 0) {
      return sections.slice(0, preferredSectionIndex).reduce((total, section) => total + section.images.length, 0) + localIndex;
    }
  }
  let globalOffset = 0;
  for (const section of sections) {
    const localIndex = findImageInListByUri(section.images, resource);
    if (localIndex >= 0) {
      return globalOffset + localIndex;
    }
    globalOffset += section.images.length;
  }
  if (!data) {
    return -1;
  }
  globalOffset = 0;
  for (const section of sections) {
    const localIndex = findImageInListByData(section.images, data);
    if (localIndex >= 0) {
      return globalOffset + localIndex;
    }
    globalOffset += section.images.length;
  }
  return -1;
}
function findImageInListByUri(images, resource) {
  const uriStr = resource.toString();
  const byUri = images.findIndex((img) => img.id === uriStr);
  if (byUri >= 0) {
    return byUri;
  }
  const byParsedUri = images.findIndex((img) => {
    try {
      return isEqual(URI.parse(img.id), resource);
    } catch {
      return false;
    }
  });
  if (byParsedUri >= 0) {
    return byParsedUri;
  }
  return -1;
}
function findImageInListByData(images, data) {
  const wrapped = VSBuffer.wrap(data);
  return images.findIndex((img) => VSBuffer.wrap(img.data).equals(wrapped));
}
function buildCollectionArgs(sections, clickedGlobalIndex, sessionResource) {
  const collectionId = sessionResource.toString() + "_carousel";
  const defaultTitle = localize("chatImageCarousel.allImages", "Conversation Images");
  return {
    collection: {
      id: collectionId,
      title: sections.length === 1 ? sections[0].title || defaultTitle : defaultTitle,
      sections
    },
    startIndex: clickedGlobalIndex
  };
}
function buildSingleImageArgs(resource, data) {
  let name = resource.path.split("/").pop() ?? "image";
  try {
    name = decodeURIComponent(name);
  } catch {
  }
  const mimeType = getMediaMime(resource.path) ?? getMediaMime(name) ?? "image/png";
  return { name, mimeType, data, title: name };
}
const CAROUSEL_COMMAND = "workbench.action.chat.openImageInCarousel";
let ChatImageCarouselService = class {
  constructor(chatWidgetService, commandService, fileService) {
    this.chatWidgetService = chatWidgetService;
    this.commandService = commandService;
    this.fileService = fileService;
  }
  async openCarouselAtResource(resource, data, options) {
    const widget = this.chatWidgetService.lastFocusedWidget;
    if (!widget?.viewModel) {
      await this.openSingleImage(resource, data);
      return;
    }
    const items = widget.viewModel.getItems().filter(
      (item) => isRequestVM(item) || isResponseVM(item)
    );
    const readFile = async (uri) => (await this.fileService.readFile(uri)).value.buffer;
    const sections = await collectCarouselSections(items, readFile);
    const currentInputSections = await collectCarouselSections([], readFile, {
      text: widget.getInput(),
      attachments: widget.attachmentModel.attachments
    });
    const preferredSectionIndex = options?.preferCurrentInput && currentInputSections.length > 0 ? sections.length : void 0;
    sections.push(...currentInputSections);
    const clickedGlobalIndex = findClickedImageIndex(sections, resource, data, preferredSectionIndex);
    if (clickedGlobalIndex === -1 || sections.length === 0) {
      await this.openSingleImage(resource, data);
      return;
    }
    const args = buildCollectionArgs(sections, clickedGlobalIndex, widget.viewModel.sessionResource);
    await this.commandService.executeCommand(CAROUSEL_COMMAND, args);
  }
  async openSingleImage(resource, data) {
    if (!data) {
      const content = await this.fileService.readFile(resource);
      data = content.value.buffer;
    }
    const args = buildSingleImageArgs(resource, data);
    await this.commandService.executeCommand(CAROUSEL_COMMAND, args);
  }
};
ChatImageCarouselService = __decorateClass([
  __decorateParam(0, IChatWidgetService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IFileService)
], ChatImageCarouselService);
export {
  ChatImageCarouselService,
  IChatImageCarouselService,
  buildCollectionArgs,
  buildSingleImageArgs,
  collectCarouselSections,
  findClickedImageIndex
};
