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
import * as dom from "../../../../base/browser/dom.js";
import { DragAndDropObserver } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { renderIcon, renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { localize } from "../../../../nls.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { registerOpenEditorListeners } from "../../../../platform/editor/browser/editor.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ChatConfiguration } from "../../../../workbench/contrib/chat/common/constants.js";
import { IChatImageCarouselService } from "../../../../workbench/contrib/chat/browser/chatImageCarouselService.js";
import { coerceImageBuffer } from "../../../../workbench/contrib/chat/common/chatImageExtraction.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { basename } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../../workbench/browser/labels.js";
import { isAgentHostCompletionVariableEntry, OmittedState } from "../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js";
import { isLocation } from "../../../../editor/common/languages.js";
import { resizeImage } from "../../../../workbench/contrib/chat/browser/chatImageUtils.js";
import { imageToHash, isImage } from "../../../../workbench/contrib/chat/browser/widget/input/editor/chatPasteProviders.js";
import { CodeDataTransfers, containsDragType, extractEditorsDropData, getPathForFile } from "../../../../platform/dnd/browser/dnd.js";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { getExcludes, ISearchService, QueryType } from "../../../../workbench/services/search/common/search.js";
let NewChatContextAttachments = class extends Disposable {
  constructor(quickInputService, textModelService, fileService, clipboardService, fileDialogService, labelService, searchService, configurationService, openerService, instantiationService, modelService, languageService, chatImageCarouselService) {
    super();
    this.quickInputService = quickInputService;
    this.textModelService = textModelService;
    this.fileService = fileService;
    this.clipboardService = clipboardService;
    this.fileDialogService = fileDialogService;
    this.labelService = labelService;
    this.searchService = searchService;
    this.configurationService = configurationService;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.chatImageCarouselService = chatImageCarouselService;
    this._attachedContext = [];
    this._renderDisposables = this._register(new DisposableStore());
    this._onDidChangeContext = this._register(new Emitter());
    this.onDidChangeContext = this._onDidChangeContext.event;
    this._resourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
  }
  get attachments() {
    return this._attachedContext;
  }
  setAttachments(entries) {
    this._attachedContext.length = 0;
    this._attachedContext.push(...entries);
    this._updateRendering();
    this._onDidChangeContext.fire();
  }
  // --- Rendering ---
  renderAttachedContext(container) {
    this._container = container;
    this._updateRendering();
  }
  _updateRendering() {
    if (!this._container) {
      return;
    }
    this._renderDisposables.clear();
    this._resourceLabels.clear();
    dom.clearNode(this._container);
    const visibleAttachments = this._attachedContext.filter((entry) => !isAgentHostCompletionVariableEntry(entry));
    if (visibleAttachments.length === 0) {
      this._container.style.display = "none";
      return;
    }
    this._container.style.display = "";
    this._container.classList.add("show-file-icons");
    for (const entry of visibleAttachments) {
      const pill = dom.append(this._container, dom.$(".sessions-chat-attachment-pill"));
      const resource = URI.isUri(entry.value) ? entry.value : isLocation(entry.value) ? entry.value.uri : void 0;
      if (entry.kind === "image") {
        dom.append(pill, renderIcon(Codicon.fileMedia));
        dom.append(pill, dom.$("span.sessions-chat-attachment-name", void 0, entry.name));
      } else {
        const label = this._resourceLabels.create(pill, { supportIcons: true });
        this._renderDisposables.add(label);
        if (resource) {
          label.setFile(resource, {
            fileKind: entry.kind === "directory" ? FileKind.FOLDER : FileKind.FILE,
            hidePath: true
          });
        } else {
          label.setLabel(entry.name);
        }
      }
      const imageData = entry.kind === "image" ? coerceImageBuffer(entry.value) : void 0;
      if (imageData) {
        pill.style.cursor = "pointer";
        this._renderDisposables.add(registerOpenEditorListeners(pill, async () => {
          if (this.configurationService.getValue(ChatConfiguration.ImageCarouselEnabled)) {
            const imageResource = resource ?? URI.from({ scheme: "data", path: entry.name });
            await this.chatImageCarouselService.openCarouselAtResource(imageResource, imageData);
          } else if (resource) {
            await this.openerService.open(resource, { fromUserGesture: true });
          }
        }));
      } else if (resource) {
        pill.style.cursor = "pointer";
        this._renderDisposables.add(registerOpenEditorListeners(pill, async () => {
          await this.openerService.open(resource, { fromUserGesture: true });
        }));
      }
      if (imageData || resource) {
        pill.tabIndex = 0;
        pill.role = "button";
      }
      const removeButton = dom.append(pill, dom.$(".sessions-chat-attachment-remove"));
      removeButton.title = localize("removeAttachment", "Remove");
      removeButton.tabIndex = -1;
      dom.append(removeButton, renderIcon(Codicon.closeCompact));
      this._renderDisposables.add(dom.addDisposableListener(removeButton, dom.EventType.CLICK, (e) => {
        e.stopPropagation();
        this._removeAttachment(entry.id);
      }));
    }
  }
  // --- Drag and drop ---
  registerDropTarget(dndContainer) {
    const overlay = dom.append(dndContainer, dom.$(".sessions-chat-dnd-overlay"));
    let overlayText;
    const isDropSupported = (e) => {
      return containsDragType(e, DataTransfers.FILES, CodeDataTransfers.EDITORS, CodeDataTransfers.FILES, DataTransfers.RESOURCES, DataTransfers.INTERNAL_URI_LIST);
    };
    const showOverlay = () => {
      overlay.classList.add("visible");
      if (!overlayText) {
        const label = localize("attachAsContext", "Attach as Context");
        const iconAndTextElements = renderLabelWithIcons(`$(${Codicon.attach.id}) ${label}`);
        const htmlElements = iconAndTextElements.map((element) => {
          if (typeof element === "string") {
            return dom.$("span.overlay-text", void 0, element);
          }
          return element;
        });
        overlayText = dom.$("span.attach-context-overlay-text", void 0, ...htmlElements);
        overlay.appendChild(overlayText);
      }
    };
    const hideOverlay = () => {
      overlay.classList.remove("visible");
      overlayText?.remove();
      overlayText = void 0;
    };
    this._register(new DragAndDropObserver(dndContainer, {
      onDragOver: (e) => {
        if (isDropSupported(e)) {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
          }
          showOverlay();
        }
      },
      onDragLeave: () => {
        hideOverlay();
      },
      onDrop: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideOverlay();
        const editorDropData = extractEditorsDropData(e);
        if (editorDropData.length > 0) {
          for (const editor of editorDropData) {
            if (editor.resource) {
              await this._attachFileUri(editor.resource, basename(editor.resource));
            }
          }
          return;
        }
        const items = e.dataTransfer?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.kind === "file") {
              const file = item.getAsFile();
              if (!file) {
                continue;
              }
              const filePath = getPathForFile(file);
              if (!filePath) {
                continue;
              }
              const uri = URI.file(filePath);
              await this._attachFileUri(uri, file.name);
            }
          }
        }
      }
    }));
  }
  // --- Paste ---
  registerPasteHandler(element) {
    const supportedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/bmp",
      "image/gif",
      "image/tiff"
    ];
    this._register(dom.addDisposableListener(element, dom.EventType.PASTE, async (e) => {
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }
      let imageFile;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/") || !supportedMimeTypes.includes(item.type)) {
          continue;
        }
        const file = item.getAsFile();
        if (file) {
          imageFile = file;
          break;
        }
      }
      if (!imageFile) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const arrayBuffer = await imageFile.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      if (!isImage(data)) {
        return;
      }
      const resizedData = await resizeImage(data, imageFile.type);
      const displayName = this._getUniqueImageName();
      this._addAttachments({
        id: await imageToHash(resizedData),
        name: displayName,
        fullName: displayName,
        value: resizedData,
        kind: "image"
      });
    }, true));
  }
  // --- Picker ---
  showPicker(folderUri) {
    const picker = this.quickInputService.createQuickPick({ useSeparators: true });
    const disposables = new DisposableStore();
    picker.placeholder = localize("chatContext.attach.placeholder", "Attach as context...");
    picker.matchOnDescription = true;
    picker.sortByLabel = false;
    const staticPicks = [
      {
        label: localize("files", "Files..."),
        iconClass: ThemeIcon.asClassName(Codicon.file),
        id: "sessions.filesAndFolders"
      },
      {
        label: localize("imageFromClipboard", "Image from Clipboard"),
        iconClass: ThemeIcon.asClassName(Codicon.fileMedia),
        id: "sessions.imageFromClipboard"
      }
    ];
    picker.items = staticPicks;
    picker.show();
    if (folderUri) {
      let searchCts;
      let debounceTimer;
      const runSearch = (filePattern) => {
        searchCts?.dispose(true);
        searchCts = new CancellationTokenSource();
        const token = searchCts.token;
        picker.busy = true;
        this._collectFilePicks(folderUri, filePattern, token).then((filePicks) => {
          if (token.isCancellationRequested) {
            return;
          }
          picker.busy = false;
          if (filePicks.length > 0) {
            picker.items = [
              ...staticPicks,
              { type: "separator", label: basename(folderUri) },
              ...filePicks
            ];
          } else {
            picker.items = staticPicks;
          }
        });
      };
      runSearch();
      disposables.add(picker.onDidChangeValue((value) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => runSearch(value || void 0), 200);
      }));
      disposables.add({ dispose: () => {
        searchCts?.dispose(true);
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
      } });
    }
    disposables.add(picker.onDidAccept(async () => {
      const [selected] = picker.selectedItems;
      if (!selected) {
        picker.hide();
        return;
      }
      picker.hide();
      if (selected.id === "sessions.filesAndFolders") {
        await this._handleFileDialog();
      } else if (selected.id === "sessions.imageFromClipboard") {
        await this._handleClipboardImage();
      } else if (selected.id) {
        await this._attachFileUri(URI.parse(selected.id), selected.label);
      }
    }));
    disposables.add(picker.onDidHide(() => {
      picker.dispose();
      disposables.dispose();
    }));
  }
  async _collectFilePicks(rootUri, filePattern, token) {
    const maxFiles = 200;
    if (rootUri.scheme === Schemas.file || rootUri.scheme === Schemas.vscodeRemote) {
      return this._collectFilePicksViaSearch(rootUri, maxFiles, filePattern, token);
    }
    return this._collectFilePicksViaFileService(rootUri, maxFiles, filePattern);
  }
  async _collectFilePicksViaSearch(rootUri, maxFiles, filePattern, token) {
    const excludePattern = getExcludes(this.configurationService.getValue({ resource: rootUri }));
    try {
      const searchResult = await this.searchService.fileSearch({
        folderQueries: [{
          folder: rootUri,
          disregardIgnoreFiles: false
        }],
        type: QueryType.File,
        filePattern: filePattern || "",
        excludePattern,
        sortByScore: true,
        maxResults: maxFiles
      }, token);
      return searchResult.results.map((result) => ({
        label: basename(result.resource),
        description: this.labelService.getUriLabel(result.resource, { relative: true }),
        iconClasses: getIconClasses(this.modelService, this.languageService, result.resource, FileKind.FILE),
        id: result.resource.toString()
      }));
    } catch {
      return [];
    }
  }
  async _collectFilePicksViaFileService(rootUri, maxFiles, filePattern) {
    const picks = [];
    const patternLower = filePattern?.toLowerCase();
    const maxDepth = 10;
    const collect = async (uri, depth) => {
      if (picks.length >= maxFiles || depth > maxDepth) {
        return;
      }
      try {
        const stat = await this.fileService.resolve(uri);
        if (!stat.children) {
          return;
        }
        const children = stat.children.slice().sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        for (const child of children) {
          if (picks.length >= maxFiles) {
            break;
          }
          if (child.isDirectory) {
            await collect(child.resource, depth + 1);
          } else {
            if (patternLower && !child.name.toLowerCase().includes(patternLower)) {
              continue;
            }
            picks.push({
              label: child.name,
              description: this.labelService.getUriLabel(child.resource, { relative: true }),
              iconClasses: getIconClasses(this.modelService, this.languageService, child.resource, FileKind.FILE),
              id: child.resource.toString()
            });
          }
        }
      } catch {
      }
    };
    await collect(rootUri, 0);
    return picks;
  }
  async _handleFileDialog() {
    const selected = await this.fileDialogService.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: true,
      canSelectMany: true,
      title: localize("selectFilesOrFolders", "Select Files or Folders")
    });
    if (!selected) {
      return;
    }
    for (const uri of selected) {
      await this._attachFileUri(uri, basename(uri));
    }
  }
  async _attachFileUri(uri, name) {
    let stat;
    try {
      stat = await this.fileService.stat(uri);
    } catch {
      return;
    }
    if (stat.isDirectory) {
      this._addAttachments({
        kind: "directory",
        id: uri.toString(),
        value: uri,
        name
      });
      return;
    }
    if (/\.(png|jpg|jpeg|bmp|gif|tiff)$/i.test(uri.path)) {
      const readFile = await this.fileService.readFile(uri);
      const resizedImage = await resizeImage(readFile.value.buffer);
      this._addAttachments({
        id: uri.toString(),
        name,
        fullName: name,
        value: resizedImage,
        kind: "image",
        references: [{ reference: uri, kind: "reference" }]
      });
    } else {
      let omittedState = OmittedState.NotOmitted;
      try {
        const ref = await this.textModelService.createModelReference(uri);
        ref.dispose();
      } catch {
        omittedState = OmittedState.Full;
      }
      this._addAttachments({
        kind: "file",
        id: uri.toString(),
        value: uri,
        name,
        omittedState
      });
    }
  }
  async _handleClipboardImage() {
    const imageData = await this.clipboardService.readImage();
    if (!isImage(imageData)) {
      return;
    }
    const displayName = this._getUniqueImageName();
    this._addAttachments({
      id: await imageToHash(imageData),
      name: displayName,
      fullName: displayName,
      value: imageData,
      kind: "image"
    });
  }
  // --- State management ---
  _getUniqueImageName() {
    const baseName = localize("pastedImage", "Pasted Image");
    let name = baseName;
    for (let i = 2; this._attachedContext.some((a) => a.name === name); i++) {
      name = `${baseName} ${i}`;
    }
    return name;
  }
  addAttachments(...entries) {
    this._addAttachments(...entries);
  }
  _addAttachments(...entries) {
    for (const entry of entries) {
      if (!this._attachedContext.some((e) => e.id === entry.id)) {
        this._attachedContext.push(entry);
      }
    }
    this._updateRendering();
    this._onDidChangeContext.fire();
  }
  _removeAttachment(id) {
    const index = this._attachedContext.findIndex((e) => e.id === id);
    if (index >= 0) {
      this._attachedContext.splice(index, 1);
      this._updateRendering();
      this._onDidChangeContext.fire();
    }
  }
  clear() {
    this._attachedContext.length = 0;
    this._updateRendering();
    this._onDidChangeContext.fire();
  }
};
NewChatContextAttachments = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, ITextModelService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ISearchService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IModelService),
  __decorateParam(11, ILanguageService),
  __decorateParam(12, IChatImageCarouselService)
], NewChatContextAttachments);
export {
  NewChatContextAttachments
};
