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
import { DataTransfers } from "../../../../../base/browser/dnd.js";
import { $, DragAndDropObserver } from "../../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { coalesce } from "../../../../../base/common/arrays.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { UriList } from "../../../../../base/common/dataTransfer.js";
import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { DraggedChatReferenceIdentifier, CodeDataTransfers, containsDragType, extractChatReferenceDropData, extractEditorsDropData, extractMarkerDropData, extractNotebookCellOutputDropData, extractSymbolDropData, LocalSelectionTransfer } from "../../../../../platform/dnd/browser/dnd.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IThemeService, Themable } from "../../../../../platform/theme/common/themeService.js";
import { ISharedWebContentExtractorService } from "../../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { IExtensionService, isProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import { extractSCMHistoryItemDropData } from "../../../scm/browser/scmHistoryChatContext.js";
import { isAgentHostTarget } from "../../common/chatSessionsService.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { IChatAttachmentResolveService } from "../attachments/chatAttachmentResolveService.js";
import { isCrossAgentHostChatReferenceDrop, isSelfChatReferenceDrop, resolveChatReferenceDropEntry } from "./chatReferenceDrop.js";
import { convertStringToUInt8Array } from "../chatImageUtils.js";
var ChatDragAndDropType = /* @__PURE__ */ ((ChatDragAndDropType2) => {
  ChatDragAndDropType2[ChatDragAndDropType2["CHAT_REFERENCE"] = 0] = "CHAT_REFERENCE";
  ChatDragAndDropType2[ChatDragAndDropType2["FILE_INTERNAL"] = 1] = "FILE_INTERNAL";
  ChatDragAndDropType2[ChatDragAndDropType2["FILE_EXTERNAL"] = 2] = "FILE_EXTERNAL";
  ChatDragAndDropType2[ChatDragAndDropType2["FOLDER"] = 3] = "FOLDER";
  ChatDragAndDropType2[ChatDragAndDropType2["IMAGE"] = 4] = "IMAGE";
  ChatDragAndDropType2[ChatDragAndDropType2["SYMBOL"] = 5] = "SYMBOL";
  ChatDragAndDropType2[ChatDragAndDropType2["HTML"] = 6] = "HTML";
  ChatDragAndDropType2[ChatDragAndDropType2["MARKER"] = 7] = "MARKER";
  ChatDragAndDropType2[ChatDragAndDropType2["NOTEBOOK_CELL_OUTPUT"] = 8] = "NOTEBOOK_CELL_OUTPUT";
  ChatDragAndDropType2[ChatDragAndDropType2["SCM_HISTORY_ITEM"] = 9] = "SCM_HISTORY_ITEM";
  return ChatDragAndDropType2;
})(ChatDragAndDropType || {});
const IMAGE_DATA_REGEX = /^data:image\/[a-z]+;base64,/;
const URL_REGEX = /^https?:\/\/.+/;
let ChatDragAndDrop = class extends Themable {
  constructor(widgetRef, attachmentModel, styles, themeService, extensionService, webContentExtractorService, logService, chatAttachmentResolveService) {
    super(themeService);
    this.widgetRef = widgetRef;
    this.attachmentModel = attachmentModel;
    this.styles = styles;
    this.extensionService = extensionService;
    this.webContentExtractorService = webContentExtractorService;
    this.logService = logService;
    this.chatAttachmentResolveService = chatAttachmentResolveService;
    this.overlays = /* @__PURE__ */ new Map();
    this.overlayTextBackground = "";
    this.disableOverlay = false;
    /**
     * In-process transfer for a dragged chat reference. Readable during
     * `dragover` (unlike the `dataTransfer` mime payload), so the self-reference
     * guard can suppress the overlay when a chat is dragged onto its own input.
     */
    this.chatReferenceTransfer = LocalSelectionTransfer.getInstance();
    this.currentActiveTarget = void 0;
    this.updateStyles();
    this._register(toDisposable(() => {
      this.overlays.forEach(({ overlay, disposable }) => {
        disposable.dispose();
        overlay.remove();
      });
      this.overlays.clear();
      this.currentActiveTarget = void 0;
      this.overlayText?.remove();
      this.overlayText = void 0;
    }));
  }
  addOverlay(target, overlayContainer) {
    this.removeOverlay(target);
    const { overlay, disposable } = this.createOverlay(target, overlayContainer);
    this.overlays.set(target, { overlay, disposable });
  }
  removeOverlay(target) {
    if (this.currentActiveTarget === target) {
      this.currentActiveTarget = void 0;
    }
    const existingOverlay = this.overlays.get(target);
    if (existingOverlay) {
      existingOverlay.overlay.remove();
      existingOverlay.disposable.dispose();
      this.overlays.delete(target);
    }
  }
  setDisabledOverlay(disable) {
    this.disableOverlay = disable;
  }
  createOverlay(target, overlayContainer) {
    const overlay = document.createElement("div");
    overlay.classList.add("chat-dnd-overlay");
    this.updateOverlayStyles(overlay);
    overlayContainer.appendChild(overlay);
    const disposable = new DragAndDropObserver(target, {
      onDragOver: (e) => {
        if (this.disableOverlay) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        if (target === this.currentActiveTarget) {
          return;
        }
        if (this.currentActiveTarget) {
          this.setOverlay(this.currentActiveTarget, void 0);
        }
        this.currentActiveTarget = target;
        this.onDragEnter(e, target);
      },
      onDragLeave: (e) => {
        if (this.disableOverlay) {
          return;
        }
        if (target === this.currentActiveTarget) {
          this.currentActiveTarget = void 0;
        }
        this.onDragLeave(e, target);
      },
      onDrop: (e) => {
        if (this.disableOverlay) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        if (target !== this.currentActiveTarget) {
          return;
        }
        this.currentActiveTarget = void 0;
        this.onDrop(e, target);
      }
    });
    return { overlay, disposable };
  }
  onDragEnter(e, target) {
    const estimatedDropType = this.guessDropType(e);
    this.updateDropFeedback(e, target, estimatedDropType);
  }
  onDragLeave(e, target) {
    this.updateDropFeedback(e, target, void 0);
  }
  onDrop(e, target) {
    this.updateDropFeedback(e, target, void 0);
    this.drop(e);
  }
  async drop(e) {
    const contexts = await this.resolveAttachmentsFromDragEvent(e);
    if (contexts.length === 0) {
      return;
    }
    this.attachmentModel.addContext(...contexts);
  }
  updateDropFeedback(e, target, dropType) {
    const showOverlay = dropType !== void 0;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = showOverlay ? "copy" : "none";
    }
    this.setOverlay(target, dropType);
  }
  guessDropType(e) {
    if (containsDragType(e, CodeDataTransfers.CHAT_REFERENCE)) {
      return this.guessChatReferenceDropType(e);
    } else if (containsDragType(e, CodeDataTransfers.NOTEBOOK_CELL_OUTPUT)) {
      return 8 /* NOTEBOOK_CELL_OUTPUT */;
    } else if (containsDragType(e, CodeDataTransfers.SCM_HISTORY_ITEM)) {
      return 9 /* SCM_HISTORY_ITEM */;
    } else if (containsImageDragType(e)) {
      return this.extensionService.extensions.some((ext) => isProposedApiEnabled(ext, "chatReferenceBinaryData")) ? 4 /* IMAGE */ : void 0;
    } else if (containsDragType(e, "text/html")) {
      return 6 /* HTML */;
    } else if (containsDragType(e, CodeDataTransfers.SYMBOLS)) {
      return 5 /* SYMBOL */;
    } else if (containsDragType(e, CodeDataTransfers.MARKERS)) {
      return 7 /* MARKER */;
    } else if (containsDragType(e, DataTransfers.FILES)) {
      return 2 /* FILE_EXTERNAL */;
    } else if (containsDragType(e, CodeDataTransfers.EDITORS)) {
      return 1 /* FILE_INTERNAL */;
    } else if (containsDragType(e, Mimes.uriList, CodeDataTransfers.FILES, DataTransfers.RESOURCES, DataTransfers.INTERNAL_URI_LIST)) {
      return 3 /* FOLDER */;
    }
    return void 0;
  }
  /**
   * Resolves the drop type for a dragged chat reference. Only agent-host-backed
   * chat inputs can reference another chat, and a chat may reference any other
   * chat of the *same agent host* — including one from a different session shown
   * side by side in the Agents window.
   *
   * Two payload-dependent guards suppress the overlay entirely (rather than
   * appearing droppable and then doing nothing):
   * - a self-reference (a chat dropped onto its *own* input), and
   * - a cross-agent-host reference, which the owning host could never resolve.
   *
   * The dragged chat's client resource is read from the in-process
   * {@link LocalSelectionTransfer} (readable during `dragover`) with the
   * `dataTransfer` mime payload as a fallback (readable on `drop`), and compared
   * against this input's own client session resource. Both are opaque client
   * URIs, so the workbench never touches an AHP chat URI.
   */
  guessChatReferenceDropType(e) {
    const sessionResource = this.widgetRef()?.viewModel?.model.sessionResource;
    if (!sessionResource || !isAgentHostTarget(getChatSessionType(sessionResource))) {
      return void 0;
    }
    const droppedClientResource = this.getDraggedClientResource(e);
    if (droppedClientResource !== void 0 && (isSelfChatReferenceDrop(droppedClientResource, sessionResource.toString()) || isCrossAgentHostChatReferenceDrop(droppedClientResource, sessionResource.toString()))) {
      return void 0;
    }
    return 0 /* CHAT_REFERENCE */;
  }
  /**
   * The client resource of the dragged chat reference (used only for
   * self-reference identity comparison). Prefers the in-process local transfer
   * (available during `dragover`), falling back to the `dataTransfer` mime
   * payload (only readable on `drop`). Returns `undefined` when neither source
   * carries a chat reference.
   */
  getDraggedClientResource(e) {
    const local = this.chatReferenceTransfer.getData(DraggedChatReferenceIdentifier.prototype);
    if (local && local.length > 0) {
      return local[0].clientResource;
    }
    return extractChatReferenceDropData(e)?.clientResource;
  }
  isDragEventSupported(e) {
    const dropType = this.guessDropType(e);
    return dropType !== void 0;
  }
  getDropTypeName(type) {
    switch (type) {
      case 1 /* FILE_INTERNAL */:
        return localize("file", "File");
      case 2 /* FILE_EXTERNAL */:
        return localize("file", "File");
      case 3 /* FOLDER */:
        return localize("folder", "Folder");
      case 4 /* IMAGE */:
        return localize("image", "Image");
      case 5 /* SYMBOL */:
        return localize("symbol", "Symbol");
      case 7 /* MARKER */:
        return localize("problem", "Problem");
      case 6 /* HTML */:
        return localize("url", "URL");
      case 8 /* NOTEBOOK_CELL_OUTPUT */:
        return localize("notebookOutput", "Output");
      case 9 /* SCM_HISTORY_ITEM */:
        return localize("scmHistoryItem", "Change");
      case 0 /* CHAT_REFERENCE */:
        return localize("chat", "Chat");
    }
  }
  async resolveAttachmentsFromDragEvent(e) {
    if (!this.isDragEventSupported(e)) {
      return [];
    }
    if (containsDragType(e, CodeDataTransfers.CHAT_REFERENCE)) {
      return this.resolveChatReferenceAttachContext(e);
    }
    if (containsDragType(e, CodeDataTransfers.NOTEBOOK_CELL_OUTPUT)) {
      const notebookOutputData = extractNotebookCellOutputDropData(e);
      if (notebookOutputData) {
        return this.chatAttachmentResolveService.resolveNotebookOutputAttachContext(notebookOutputData);
      }
    }
    if (containsDragType(e, CodeDataTransfers.SCM_HISTORY_ITEM)) {
      const scmHistoryItemData = extractSCMHistoryItemDropData(e);
      if (scmHistoryItemData) {
        return this.chatAttachmentResolveService.resolveSourceControlHistoryItemAttachContext(scmHistoryItemData);
      }
    }
    const markerData = extractMarkerDropData(e);
    if (markerData) {
      return this.chatAttachmentResolveService.resolveMarkerAttachContext(markerData);
    }
    if (containsDragType(e, CodeDataTransfers.SYMBOLS)) {
      const symbolsData = extractSymbolDropData(e);
      return this.chatAttachmentResolveService.resolveSymbolsAttachContext(symbolsData);
    }
    const editorDragData = extractEditorsDropData(e);
    if (editorDragData.length > 0) {
      return coalesce(await Promise.all(editorDragData.map((editorInput) => {
        return this.chatAttachmentResolveService.resolveEditorAttachContext(editorInput);
      })));
    }
    const internal = e.dataTransfer?.getData(DataTransfers.INTERNAL_URI_LIST);
    if (internal) {
      const uriList = UriList.parse(internal);
      if (uriList.length) {
        return coalesce(await Promise.all(
          uriList.map((uri) => this.chatAttachmentResolveService.resolveEditorAttachContext({ resource: URI.parse(uri) }))
        ));
      }
    }
    if (!containsDragType(e, DataTransfers.INTERNAL_URI_LIST) && containsDragType(e, Mimes.uriList) && (containsDragType(e, Mimes.html) || containsDragType(e, Mimes.text))) {
      return this.resolveHTMLAttachContext(e);
    }
    return [];
  }
  /**
   * Resolves a dropped chat reference (a chat tab from the Agents window) to a
   * plain chat-reference attachment (a pill) — the same shape every other drop
   * type produces, with no inline text, range, or editor manipulation.
   *
   * The target must be an agent-host-backed input; the actual resolution and
   * the self / cross-agent-host guards live in {@link resolveChatReferenceDropEntry}.
   * Returns `[]` when any guard rejects.
   */
  resolveChatReferenceAttachContext(e) {
    const data = extractChatReferenceDropData(e);
    if (!data) {
      return [];
    }
    const sessionResource = this.widgetRef()?.viewModel?.model.sessionResource;
    const ownClientResource = sessionResource && isAgentHostTarget(getChatSessionType(sessionResource)) ? sessionResource.toString() : void 0;
    const entry = resolveChatReferenceDropEntry(data, ownClientResource);
    return entry ? [entry] : [];
  }
  async downloadImageAsUint8Array(url) {
    try {
      const extractedImages = await this.webContentExtractorService.readImage(URI.parse(url), CancellationToken.None);
      if (extractedImages) {
        return extractedImages.buffer;
      }
    } catch (error) {
      this.logService.warn("Fetch failed:", error);
    }
    const widget = this.widgetRef();
    const selection = widget?.inputEditor.getSelection();
    if (selection && widget) {
      widget.inputEditor.executeEdits("chatInsertUrl", [{ range: selection, text: url }]);
    }
    this.logService.warn(`Image URLs must end in .jpg, .png, .gif, .webp, or .bmp. Failed to fetch image from this URL: ${url}`);
    return void 0;
  }
  async resolveHTMLAttachContext(e) {
    const existingAttachmentNames = new Set(this.attachmentModel.attachments.map((attachment) => attachment.name));
    const createDisplayName = () => {
      const baseName = localize("dragAndDroppedImageName", "Image from URL");
      let uniqueName = baseName;
      let baseNameInstance = 1;
      while (existingAttachmentNames.has(uniqueName)) {
        uniqueName = `${baseName} ${++baseNameInstance}`;
      }
      existingAttachmentNames.add(uniqueName);
      return uniqueName;
    };
    const getImageTransferDataFromUrl = async (url) => {
      const resource = URI.parse(url);
      if (IMAGE_DATA_REGEX.test(url)) {
        return { data: convertStringToUInt8Array(url), name: createDisplayName(), resource };
      }
      if (URL_REGEX.test(url)) {
        const data = await this.downloadImageAsUint8Array(url);
        if (data) {
          return { data, name: createDisplayName(), resource, id: url };
        }
      }
      return void 0;
    };
    const getImageTransferDataFromFile = async (file) => {
      try {
        const buffer = await file.arrayBuffer();
        return { data: new Uint8Array(buffer), name: createDisplayName() };
      } catch (error) {
        this.logService.error("Error reading file:", error);
      }
      return void 0;
    };
    const imageTransferData = [];
    const imageFiles = extractImageFilesFromDragEvent(e);
    if (imageFiles.length) {
      const imageTransferDataFromFiles = await Promise.all(imageFiles.map((file) => getImageTransferDataFromFile(file)));
      imageTransferData.push(...imageTransferDataFromFiles.filter((data) => !!data));
    }
    const imageUrls = extractUrlsFromDragEvent(e);
    if (imageUrls.length) {
      const imageTransferDataFromUrl = await Promise.all(imageUrls.map(getImageTransferDataFromUrl));
      imageTransferData.push(...imageTransferDataFromUrl.filter((data) => !!data));
    }
    return await this.chatAttachmentResolveService.resolveImageAttachContext(imageTransferData);
  }
  setOverlay(target, type) {
    this.overlayText?.remove();
    this.overlayText = void 0;
    const { overlay } = this.overlays.get(target);
    if (type !== void 0) {
      const iconAndtextElements = renderLabelWithIcons(`$(${Codicon.attach.id}) ${this.getOverlayText(type)}`);
      const htmlElements = iconAndtextElements.map((element) => {
        if (typeof element === "string") {
          return $("span.overlay-text", void 0, element);
        }
        return element;
      });
      this.overlayText = $("span.attach-context-overlay-text", void 0, ...htmlElements);
      this.overlayText.style.backgroundColor = this.overlayTextBackground;
      overlay.appendChild(this.overlayText);
    }
    overlay.classList.toggle("visible", type !== void 0);
  }
  getOverlayText(type) {
    const typeName = this.getDropTypeName(type);
    return localize("attacAsContext", "Attach {0} as Context", typeName);
  }
  updateOverlayStyles(overlay) {
    overlay.style.backgroundColor = this.getColor(this.styles.overlayBackground) || "";
    overlay.style.color = this.getColor(this.styles.listForeground) || "";
  }
  updateStyles() {
    this.overlays.forEach((overlay) => this.updateOverlayStyles(overlay.overlay));
    this.overlayTextBackground = this.getColor(this.styles.listBackground) || "";
  }
};
ChatDragAndDrop = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, ISharedWebContentExtractorService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IChatAttachmentResolveService)
], ChatDragAndDrop);
function containsImageDragType(e) {
  if (containsDragType(e, "image")) {
    return true;
  }
  if (containsDragType(e, DataTransfers.FILES)) {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      return Array.from(files).some((file) => file.type.startsWith("image/"));
    }
    const items = e.dataTransfer?.items;
    if (items && items.length > 0) {
      return Array.from(items).some((item) => item.type.startsWith("image/"));
    }
  }
  return false;
}
function extractUrlsFromDragEvent(e, logService) {
  const textUrl = e.dataTransfer?.getData("text/uri-list");
  if (textUrl) {
    try {
      const urls = UriList.parse(textUrl);
      if (urls.length > 0) {
        return urls;
      }
    } catch (error) {
      logService?.error("Error parsing URI list:", error);
      return [];
    }
  }
  return [];
}
function extractImageFilesFromDragEvent(e) {
  const files = e.dataTransfer?.files;
  if (!files) {
    return [];
  }
  return Array.from(files).filter((file) => file.type.startsWith("image/"));
}
export {
  ChatDragAndDrop
};
