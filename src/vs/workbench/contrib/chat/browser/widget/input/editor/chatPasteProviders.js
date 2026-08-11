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
import { alert } from "../../../../../../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { createStringDataTransferItem, VSDataTransfer } from "../../../../../../../base/common/dataTransfer.js";
import { convertHtmlToMarkdown } from "../../../../../../../base/browser/htmlToMarkdown.js";
import { HierarchicalKind } from "../../../../../../../base/common/hierarchicalKind.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { revive } from "../../../../../../../base/common/marshalling.js";
import { Mimes } from "../../../../../../../base/common/mime.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { basename, joinPath } from "../../../../../../../base/common/resources.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { Position } from "../../../../../../../editor/common/core/position.js";
import { DocumentPasteTriggerKind, SymbolKinds } from "../../../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../../../../editor/common/services/model.js";
import { IOutlineModelService } from "../../../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { getDefinitionsAtPosition } from "../../../../../../../editor/contrib/gotoSymbol/browser/goToSymbol.js";
import { localize } from "../../../../../../../nls.js";
import { IEnvironmentService } from "../../../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../../../platform/log/common/log.js";
import { IExtensionService, isProposedApiEnabled } from "../../../../../../services/extensions/common/extensions.js";
import { isImageVariableEntry } from "../../../../common/attachments/chatVariableEntries.js";
import { chatVariableLeader } from "../../../../common/requestParser/chatParserTypes.js";
import { IChatWidgetService } from "../../../chat.js";
import { getDynamicVariablesForWidget } from "../../../attachments/chatVariables.js";
import { ChatDynamicVariableModel } from "../../../attachments/chatDynamicVariables.js";
import { cleanupOldImages, createFileForMedia, resizeImage } from "../../../chatImageUtils.js";
const COPY_MIME_TYPES = "application/vnd.code.additional-editor-data";
let PasteImageProvider = class {
  constructor(chatWidgetService, extensionService, fileService, environmentService, logService) {
    this.chatWidgetService = chatWidgetService;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.logService = logService;
    this.kind = new HierarchicalKind("chat.attach.image");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [];
    this.pasteMimeTypes = ["image/*"];
    this.imagesFolder = joinPath(this.environmentService.workspaceStorageHome, "vscode-chat-images");
    cleanupOldImages(this.fileService, this.logService, this.imagesFolder);
  }
  async provideDocumentPasteEdits(model, ranges, dataTransfer, context, token) {
    if (!this.extensionService.extensions.some((ext) => isProposedApiEnabled(ext, "chatReferenceBinaryData"))) {
      return;
    }
    const supportedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/bmp",
      "image/gif",
      "image/tiff"
    ];
    let mimeType;
    let imageItem;
    for (const type of supportedMimeTypes) {
      imageItem = dataTransfer.get(type);
      if (imageItem) {
        mimeType = type;
        break;
      }
    }
    if (!imageItem || !mimeType) {
      return;
    }
    const currClipboard = await imageItem.asFile()?.data();
    if (token.isCancellationRequested || !currClipboard) {
      return;
    }
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget) {
      return;
    }
    const attachedVariables = widget.attachmentModel.attachments;
    const displayName = localize("pastedImageName", "Pasted Image");
    let tempDisplayName = displayName;
    for (let appendValue = 2; attachedVariables.some((attachment) => attachment.name === tempDisplayName); appendValue++) {
      tempDisplayName = `${displayName} ${appendValue}`;
    }
    const fileReference = await createFileForMedia(this.fileService, this.imagesFolder, currClipboard, mimeType);
    if (token.isCancellationRequested || !fileReference) {
      return;
    }
    const scaledImageData = await resizeImage(currClipboard);
    if (token.isCancellationRequested || !scaledImageData) {
      return;
    }
    const scaledImageContext = await getImageAttachContext(scaledImageData, mimeType, token, tempDisplayName, fileReference);
    if (token.isCancellationRequested || !scaledImageContext) {
      return;
    }
    const currentContextIds = widget.attachmentModel.getAttachmentIDs();
    if (currentContextIds.has(scaledImageContext.id)) {
      return;
    }
    const edit = createCustomPasteEdit(model, [scaledImageContext], mimeType, this.kind, localize("pastedImageAttachment", "Pasted Image Attachment"), this.chatWidgetService);
    return createEditSession(edit);
  }
};
PasteImageProvider = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, ILogService)
], PasteImageProvider);
async function getImageAttachContext(data, mimeType, token, displayName, resource) {
  const imageHash = await imageToHash(data);
  if (token.isCancellationRequested) {
    return void 0;
  }
  return {
    kind: "image",
    value: data,
    id: imageHash,
    name: displayName,
    icon: Codicon.fileMedia,
    mimeType,
    isPasted: true,
    references: [{ reference: resource, kind: "reference" }]
  };
}
async function imageToHash(data) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function isImage(array) {
  if (array.length < 4) {
    return false;
  }
  const identifier = {
    png: [137, 80, 78, 71, 13, 10, 26, 10],
    jpeg: [255, 216, 255],
    bmp: [66, 77],
    gif: [71, 73, 70, 56],
    tiff: [73, 73, 42, 0]
  };
  return Object.values(identifier).some(
    (signature) => signature.every((byte, index) => array[index] === byte)
  );
}
let CopyTextProvider = class {
  constructor(modelService, languageFeaturesService, outlineModelService) {
    this.modelService = modelService;
    this.languageFeaturesService = languageFeaturesService;
    this.outlineModelService = outlineModelService;
    this.providedPasteEditKinds = [];
    this.copyMimeTypes = [COPY_MIME_TYPES];
    this.pasteMimeTypes = [];
  }
  async prepareDocumentPaste(model, ranges, dataTransfer, token) {
    if (model.uri.scheme === Schemas.vscodeChatInput) {
      return;
    }
    const customDataTransfer = new VSDataTransfer();
    const data = { range: ranges[0], uri: model.uri.toJSON() };
    customDataTransfer.append(COPY_MIME_TYPES, createStringDataTransferItem(JSON.stringify(data)));
    const text = dataTransfer.get(Mimes.text);
    if (text && ranges.length) {
      void this.primeSymbolReferenceCache(model, ranges[0], text, token);
    }
    return customDataTransfer;
  }
  async primeSymbolReferenceCache(model, range, textItem, token) {
    const copiedText = model.getValueInRange(range);
    if (range.startLineNumber !== range.endLineNumber) {
      return;
    }
    if (token.isCancellationRequested || !identifierPattern.test(copiedText)) {
      return;
    }
    cacheSymbolReference(model.uri, range, copiedText, resolveSymbolReference(
      this.modelService,
      this.languageFeaturesService,
      this.outlineModelService,
      model.uri,
      range,
      copiedText,
      token
    ));
  }
};
CopyTextProvider = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IOutlineModelService)
], CopyTextProvider);
let CopyAttachmentsProvider = class {
  constructor(chatWidgetService) {
    this.chatWidgetService = chatWidgetService;
    this.kind = new HierarchicalKind("chat.attach.attachments");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [CopyAttachmentsProvider.ATTACHMENT_MIME_TYPE];
    this.pasteMimeTypes = [CopyAttachmentsProvider.ATTACHMENT_MIME_TYPE];
  }
  static {
    this.ATTACHMENT_MIME_TYPE = "application/vnd.chat.attachment+json";
  }
  async prepareDocumentPaste(model, _ranges, _dataTransfer, _token) {
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget || !widget.viewModel) {
      return void 0;
    }
    const attachments = widget.attachmentModel.attachments;
    const dynamicVariables = getDynamicVariablesForWidget(widget);
    if (attachments.length === 0 && dynamicVariables.length === 0) {
      return void 0;
    }
    const result = new VSDataTransfer();
    result.append(CopyAttachmentsProvider.ATTACHMENT_MIME_TYPE, createStringDataTransferItem(JSON.stringify({ attachments, dynamicVariables })));
    return result;
  }
  async provideDocumentPasteEdits(model, _ranges, dataTransfer, _context, token) {
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget || !widget.viewModel) {
      return void 0;
    }
    const chatDynamicVariable = widget.getContrib(ChatDynamicVariableModel.ID);
    if (!chatDynamicVariable) {
      return void 0;
    }
    const text = dataTransfer.get(Mimes.text);
    const data = dataTransfer.get(CopyAttachmentsProvider.ATTACHMENT_MIME_TYPE);
    const rawData = await data?.asString();
    const textdata = await text?.asString();
    if (textdata === void 0 || rawData === void 0) {
      return;
    }
    if (token.isCancellationRequested) {
      return;
    }
    let pastedData;
    try {
      pastedData = revive(JSON.parse(rawData));
    } catch {
    }
    if (!Array.isArray(pastedData?.attachments) && !Array.isArray(pastedData?.dynamicVariables)) {
      return;
    }
    const edit = {
      insertText: textdata,
      title: localize("pastedChatAttachments", "Insert Prompt & Attachments"),
      kind: this.kind,
      handledMimeType: CopyAttachmentsProvider.ATTACHMENT_MIME_TYPE,
      additionalEdit: {
        edits: []
      }
    };
    edit.additionalEdit?.edits.push({
      resource: model.uri,
      redo: () => {
        widget.attachmentModel.addContext(...pastedData.attachments);
        for (const dynamicVariable of pastedData.dynamicVariables) {
          chatDynamicVariable?.addReference(dynamicVariable);
        }
        widget.refreshParsedInput();
      },
      undo: () => {
        widget.attachmentModel.delete(...pastedData.attachments.map((c) => c.id));
        widget.refreshParsedInput();
      }
    });
    return createEditSession(edit);
  }
};
CopyAttachmentsProvider = __decorateClass([
  __decorateParam(0, IChatWidgetService)
], CopyAttachmentsProvider);
class PasteTextProvider {
  constructor(chatWidgetService, modelService) {
    this.chatWidgetService = chatWidgetService;
    this.modelService = modelService;
    this.kind = new HierarchicalKind("chat.attach.text");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [];
    this.pasteMimeTypes = [COPY_MIME_TYPES];
  }
  async provideDocumentPasteEdits(model, ranges, dataTransfer, _context, token) {
    if (model.uri.scheme !== Schemas.vscodeChatInput) {
      return;
    }
    const text = dataTransfer.get(Mimes.text);
    const editorData = dataTransfer.get("vscode-editor-data");
    const additionalEditorData = dataTransfer.get(COPY_MIME_TYPES);
    if (!editorData || !text || !additionalEditorData) {
      return;
    }
    const textdata = await text.asString();
    const metadata = JSON.parse(await editorData.asString());
    const additionalData = JSON.parse(await additionalEditorData.asString());
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget) {
      return;
    }
    const start = additionalData.range.startLineNumber;
    const end = additionalData.range.endLineNumber;
    if (start === end) {
      const textModel = this.modelService.getModel(URI.revive(additionalData.uri));
      if (!textModel) {
        return;
      }
      const lineContent = textModel.getLineContent(start);
      if (lineContent !== textdata) {
        return;
      }
    }
    const copiedContext = getCopiedContext(textdata, URI.revive(additionalData.uri), metadata.mode, additionalData.range);
    if (token.isCancellationRequested || !copiedContext) {
      return;
    }
    const currentContextIds = widget.attachmentModel.getAttachmentIDs();
    if (currentContextIds.has(copiedContext.id)) {
      return;
    }
    const edit = createCustomPasteEdit(model, [copiedContext], Mimes.text, this.kind, localize("pastedCodeAttachment", "Pasted Code Attachment"), this.chatWidgetService);
    edit.yieldTo = [{ kind: HierarchicalKind.Empty.append("text", "plain") }];
    return createEditSession(edit);
  }
}
function getCopiedContext(code, file, language, range) {
  const fileName = basename(file);
  const start = range.startLineNumber;
  const end = range.endLineNumber;
  const resultText = `Copied Selection of Code: 


 From the file: ${fileName} From lines ${start} to ${end} 
 \`\`\`${code}\`\`\``;
  const pastedLines = start === end ? localize("pastedAttachment.oneLine", "1 line") : localize("pastedAttachment.multipleLines", "{0} lines", end + 1 - start);
  return {
    kind: "paste",
    value: resultText,
    id: `${fileName}${start}${end}${range.startColumn}${range.endColumn}`,
    name: `${fileName} ${pastedLines}`,
    icon: Codicon.code,
    pastedLines,
    language,
    fileName: file.toString(),
    copiedFrom: {
      uri: file,
      range
    },
    code,
    references: [{
      reference: file,
      kind: "reference"
    }]
  };
}
function createCustomPasteEdit(model, context, handledMimeType, kind, title, chatWidgetService) {
  const label = context.length === 1 ? context[0].name : localize("pastedAttachment.multiple", "{0} and {1} more", context[0].name, context.length - 1);
  const announceImageAttachment = context.length === 1 && isImageVariableEntry(context[0]);
  const customEdit = {
    resource: model.uri,
    variable: context,
    undo: () => {
      const widget = chatWidgetService.getWidgetByInputUri(model.uri);
      if (!widget) {
        throw new Error("No widget found for undo");
      }
      widget.attachmentModel.delete(...context.map((c) => c.id));
    },
    redo: () => {
      const widget = chatWidgetService.getWidgetByInputUri(model.uri);
      if (!widget) {
        throw new Error("No widget found for redo");
      }
      widget.attachmentModel.addContext(...context);
      if (announceImageAttachment) {
        alert(localize("chat.pastedImageAttached", "Attached image"));
      }
    },
    metadata: {
      needsConfirmation: false,
      label
    }
  };
  return {
    insertText: "",
    title,
    kind,
    handledMimeType,
    additionalEdit: {
      edits: [customEdit]
    }
  };
}
function createEditSession(edit) {
  return {
    edits: [edit],
    dispose: () => {
    }
  };
}
const identifierPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const symbolCacheMaxSize = 3;
const symbolReferenceCache = [];
function getSymbolReferenceCacheKey(uri, range, text) {
  return `${uri.toString()}|${range.startLineNumber}:${range.startColumn}-${range.endLineNumber}:${range.endColumn}|${text}`;
}
async function getCachedSymbolReference(uri, range, text) {
  const key = getSymbolReferenceCacheKey(uri, range, text);
  return symbolReferenceCache.find((e) => e.key === key)?.promise;
}
function cacheSymbolReference(uri, range, text, valuePromise) {
  const entry = {
    key: getSymbolReferenceCacheKey(uri, range, text),
    promise: valuePromise
  };
  symbolReferenceCache.unshift(entry);
  while (symbolReferenceCache.length > symbolCacheMaxSize) {
    symbolReferenceCache.pop();
  }
  valuePromise.catch(() => {
    const i = symbolReferenceCache.indexOf(entry);
    if (i !== -1) {
      symbolReferenceCache.splice(i, 1);
    }
  });
}
async function resolveSymbolReference(modelService, languageFeaturesService, outlineModelService, sourceUri, sourceRange, pastedText, token) {
  const sourceModel = modelService.getModel(sourceUri);
  if (!sourceModel) {
    return;
  }
  const sourcePosition = new Position(sourceRange.startLineNumber, sourceRange.startColumn);
  const definitions = await getDefinitionsAtPosition(languageFeaturesService.definitionProvider, sourceModel, sourcePosition, false, token);
  if (token.isCancellationRequested || !definitions.length) {
    return;
  }
  const def = definitions[0];
  const defRange = def.targetSelectionRange ?? def.range;
  const defLocation = { uri: def.uri, range: defRange };
  let icon = Codicon.symbolProperty;
  const defModel = modelService.getModel(def.uri);
  if (defModel) {
    try {
      const outline = await outlineModelService.getOrCreate(defModel, token);
      if (!token.isCancellationRequested) {
        const element = outline.getItemEnclosingPosition({ lineNumber: defRange.startLineNumber, column: defRange.startColumn });
        if (element) {
          icon = SymbolKinds.toIcon(element.symbol.kind);
        }
      }
    } catch {
    }
  }
  if (token.isCancellationRequested) {
    return;
  }
  return {
    id: `vscode.symbol/${JSON.stringify(defLocation)}`,
    fullName: pastedText,
    data: defLocation,
    icon
  };
}
let PasteSymbolProvider = class {
  constructor(chatWidgetService, modelService, languageFeaturesService, outlineModelService) {
    this.chatWidgetService = chatWidgetService;
    this.modelService = modelService;
    this.languageFeaturesService = languageFeaturesService;
    this.outlineModelService = outlineModelService;
    this.kind = new HierarchicalKind("chat.attach.symbol");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [];
    this.pasteMimeTypes = [COPY_MIME_TYPES];
  }
  async provideDocumentPasteEdits(model, ranges, dataTransfer, _context, token) {
    if (model.uri.scheme !== Schemas.vscodeChatInput) {
      return;
    }
    const text = dataTransfer.get(Mimes.text);
    const additionalEditorData = dataTransfer.get(COPY_MIME_TYPES);
    if (!text || !additionalEditorData) {
      return;
    }
    const pastedText = await text.asString();
    if (!identifierPattern.test(pastedText)) {
      return;
    }
    let additionalData;
    try {
      additionalData = JSON.parse(await additionalEditorData.asString());
    } catch {
      return;
    }
    const sourceUri = URI.revive(additionalData.uri);
    const sourceRange = additionalData.range;
    const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
    if (!widget) {
      return;
    }
    const cached = await getCachedSymbolReference(sourceUri, sourceRange, pastedText);
    let resolved = cached;
    if (!resolved) {
      resolved = await resolveSymbolReference(
        this.modelService,
        this.languageFeaturesService,
        this.outlineModelService,
        sourceUri,
        sourceRange,
        pastedText,
        token
      );
    }
    if (!resolved) {
      return;
    }
    if (token.isCancellationRequested) {
      return;
    }
    const symText = `${chatVariableLeader}sym:${pastedText}`;
    const pasteRange = ranges[0];
    const insertText = `${symText} `;
    const refRange = {
      startLineNumber: pasteRange.startLineNumber,
      startColumn: pasteRange.startColumn,
      endLineNumber: pasteRange.startLineNumber,
      endColumn: pasteRange.startColumn + symText.length
    };
    const dynamicRef = {
      id: resolved.id,
      fullName: resolved.fullName,
      range: refRange,
      data: resolved.data,
      icon: resolved.icon
    };
    const edit = {
      insertText,
      title: localize("pastedSymbolReference", "Pasted Symbol Reference"),
      kind: this.kind,
      handledMimeType: COPY_MIME_TYPES,
      additionalEdit: {
        edits: [{
          resource: model.uri,
          redo: () => {
            const w = this.chatWidgetService.getWidgetByInputUri(model.uri);
            w?.getContrib(ChatDynamicVariableModel.ID)?.addReference(dynamicRef);
          },
          undo: () => {
          }
        }]
      }
    };
    edit.yieldTo = [{ kind: new HierarchicalKind("chat.attach.text") }];
    return createEditSession(edit);
  }
};
PasteSymbolProvider = __decorateClass([
  __decorateParam(0, IChatWidgetService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, IOutlineModelService)
], PasteSymbolProvider);
class PasteHtmlProvider {
  constructor() {
    this.kind = new HierarchicalKind("chat.paste.html");
    this.providedPasteEditKinds = [this.kind];
    this.copyMimeTypes = [];
    this.pasteMimeTypes = [Mimes.html];
  }
  async provideDocumentPasteEdits(model, _ranges, dataTransfer, context, token) {
    if (model.uri.scheme !== Schemas.vscodeChatInput) {
      return;
    }
    if (context.triggerKind !== DocumentPasteTriggerKind.Automatic) {
      return;
    }
    const entry = dataTransfer.get(Mimes.html);
    const htmlText = await entry?.asString();
    if (!htmlText || token.isCancellationRequested) {
      return;
    }
    if (!/<(a|strong|b|em|i|h[1-6]|code|pre|ul|ol|li|blockquote|del|s|strike|img|hr)\b/i.test(htmlText)) {
      return;
    }
    const markdown = convertHtmlToMarkdown(htmlText);
    if (!markdown) {
      return;
    }
    return createEditSession({
      insertText: markdown,
      title: localize("pasteHtmlAsMarkdown", "Paste as Markdown"),
      kind: this.kind,
      handledMimeType: Mimes.html,
      yieldTo: [
        { kind: new HierarchicalKind("chat.attach.text") },
        { kind: new HierarchicalKind("chat.attach.image") }
      ]
    });
  }
}
let ChatPasteProvidersFeature = class extends Disposable {
  constructor(instaService, languageFeaturesService, chatWidgetService, extensionService, fileService, modelService, environmentService, logService) {
    super();
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: "*", hasAccessToAllModels: true }, instaService.createInstance(CopyAttachmentsProvider)));
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: "*", hasAccessToAllModels: true }, new PasteImageProvider(chatWidgetService, extensionService, fileService, environmentService, logService)));
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: "*", hasAccessToAllModels: true }, new PasteTextProvider(chatWidgetService, modelService)));
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: "*", hasAccessToAllModels: true }, new PasteHtmlProvider()));
    this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: "*", hasAccessToAllModels: true }, instaService.createInstance(PasteSymbolProvider)));
    this._register(languageFeaturesService.documentPasteEditProvider.register("*", instaService.createInstance(CopyTextProvider)));
  }
};
ChatPasteProvidersFeature = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IModelService),
  __decorateParam(6, IEnvironmentService),
  __decorateParam(7, ILogService)
], ChatPasteProvidersFeature);
export {
  ChatPasteProvidersFeature,
  CopyTextProvider,
  PasteImageProvider,
  PasteTextProvider,
  imageToHash,
  isImage
};
