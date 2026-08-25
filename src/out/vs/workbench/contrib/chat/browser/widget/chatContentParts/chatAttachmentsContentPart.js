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
import * as dom from "../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../../base/common/path.js";
import { URI } from "../../../../../../base/common/uri.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { getImageAttachmentLimit, isAgentHostCompletionVariableEntry, isBrowserViewVariableEntry, isElementVariableEntry, isImageVariableEntry, isNotebookOutputVariableEntry, isPasteVariableEntry, isPromptFileVariableEntry, isPromptTextVariableEntry, isSCMHistoryItemChangeRangeVariableEntry, isSCMHistoryItemChangeVariableEntry, isSCMHistoryItemVariableEntry, isTerminalVariableEntry, isWorkspaceVariableEntry, OmittedState } from "../../../common/attachments/chatVariableEntries.js";
import { ChatResponseReferencePartStatusKind } from "../../../common/chatService/chatService.js";
import { ILanguageModelsService, isAutoLanguageModel } from "../../../common/languageModels.js";
import { DefaultChatAttachmentWidget, ElementChatAttachmentWidget, FileAttachmentWidget, ImageAttachmentWidget, BrowserViewAttachmentWidget, NotebookCellOutputChatAttachmentWidget, PasteAttachmentWidget, PromptFileAttachmentWidget, PromptTextAttachmentWidget, SCMHistoryItemAttachmentWidget, SCMHistoryItemChangeAttachmentWidget, SCMHistoryItemChangeRangeAttachmentWidget, TerminalCommandAttachmentWidget, ToolSetOrToolItemAttachmentWidget } from "../../attachments/chatAttachmentWidgets.js";
import { IChatAttachmentWidgetRegistry } from "../../attachments/chatAttachmentWidgetRegistry.js";
let ChatAttachmentsContentPart = class extends Disposable {
  constructor(options, instantiationService, languageModelsService, chatAttachmentWidgetRegistry) {
    super();
    this.instantiationService = instantiationService;
    this.languageModelsService = languageModelsService;
    this.chatAttachmentWidgetRegistry = chatAttachmentWidgetRegistry;
    this.attachedContextDisposables = this._register(new DisposableStore());
    this._onDidChangeVisibility = this._register(new Emitter());
    this._showingAll = false;
    this._variables = options.variables;
    this.contentReferences = options.contentReferences ?? [];
    this.modelId = options.modelId;
    this.resolvedModelId = options.resolvedModelId;
    this.limit = options.limit;
    this.domNode = options.domNode ?? dom.$(".chat-attached-context");
    this._contextResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility.event }));
    this.initAttachedContext(this.domNode);
    if (!this.domNode.childElementCount) {
      this.domNode = void 0;
    }
  }
  /**
   * Update the variables and re-render the attachments in place.
   */
  updateVariables(variables) {
    this._variables = variables;
    if (this.domNode) {
      this.initAttachedContext(this.domNode);
    }
  }
  initAttachedContext(container) {
    dom.clearNode(container);
    this.attachedContextDisposables.clear();
    const renderableAttachments = this.getRenderableAttachments();
    const visibleAttachments = this.getVisibleAttachments(renderableAttachments);
    const remainingCount = renderableAttachments.length - visibleAttachments.length;
    const hasMoreAttachments = remainingCount > 0 && !this._showingAll;
    this.markImageLimitExceeded(this._variables);
    for (const attachment of visibleAttachments) {
      this.renderAttachment(attachment, container);
    }
    if (hasMoreAttachments) {
      this.renderShowMoreButton(container, remainingCount);
    }
  }
  getRenderableAttachments() {
    return this._variables.filter((attachment) => !isAgentHostCompletionVariableEntry(attachment));
  }
  getVisibleAttachments(visibleAttachments) {
    if (!this.limit || this._showingAll) {
      return visibleAttachments;
    }
    return visibleAttachments.slice(0, this.limit);
  }
  currentModelDoesNotSupportImages() {
    const model = this.getCurrentLanguageModel();
    return !!model && !isAutoLanguageModel(model) && model.metadata.capabilities?.vision === false;
  }
  /**
   * When the total number of image attachments exceeds the model-specific
   * per-request limit, mark the oldest images (those dropped by the backend)
   * with {@link OmittedState.ImageLimitExceeded}.
   */
  markImageLimitExceeded(attachments) {
    const imageAttachments = attachments.filter(isImageVariableEntry);
    const maxImagesPerRequest = this.getImageLimitForCurrentModel();
    if (maxImagesPerRequest === void 0) {
      return;
    }
    if (imageAttachments.length <= maxImagesPerRequest) {
      for (const attachment of imageAttachments) {
        if (attachment.omittedState === OmittedState.ImageLimitExceeded) {
          attachment.omittedState = OmittedState.NotOmitted;
        }
      }
      return;
    }
    const excessCount = imageAttachments.length - maxImagesPerRequest;
    for (let i = 0; i < excessCount; i++) {
      if (imageAttachments[i].omittedState === OmittedState.NotOmitted || imageAttachments[i].omittedState === OmittedState.ImageLimitExceeded) {
        imageAttachments[i].omittedState = OmittedState.ImageLimitExceeded;
      }
    }
    for (let i = excessCount; i < imageAttachments.length; i++) {
      if (imageAttachments[i].omittedState === OmittedState.ImageLimitExceeded) {
        imageAttachments[i].omittedState = OmittedState.NotOmitted;
      }
    }
  }
  getImageLimitForCurrentModel() {
    return getImageAttachmentLimit(this.getCurrentLanguageModel()?.metadata);
  }
  getCurrentLanguageModel() {
    const selectedMetadata = this.modelId ? this.languageModelsService.lookupLanguageModel(this.modelId) : void 0;
    if (!this.resolvedModelId) {
      return this.modelId && selectedMetadata ? { identifier: this.modelId, metadata: selectedMetadata } : void 0;
    }
    const directMetadata = this.languageModelsService.lookupLanguageModel(this.resolvedModelId);
    if (directMetadata) {
      return { identifier: this.resolvedModelId, metadata: directMetadata };
    }
    for (const identifier of this.languageModelsService.getLanguageModelIds()) {
      const metadata = this.languageModelsService.lookupLanguageModel(identifier);
      if (metadata?.id === this.resolvedModelId && (!selectedMetadata || metadata.vendor === selectedMetadata.vendor)) {
        return { identifier, metadata };
      }
    }
    return void 0;
  }
  renderShowMoreButton(container, remainingCount) {
    const showMoreButton = dom.$("div.chat-attached-context-attachment.chat-attachments-show-more-button");
    showMoreButton.setAttribute("role", "button");
    showMoreButton.setAttribute("tabindex", "0");
    showMoreButton.style.cursor = "pointer";
    const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$("span.codicon.codicon-ellipsis"));
    const textLabel = dom.$("span.chat-attached-context-custom-text");
    textLabel.textContent = `${remainingCount} more`;
    showMoreButton.appendChild(pillIcon);
    showMoreButton.appendChild(textLabel);
    const clickHandler = () => {
      this._showingAll = true;
      this.initAttachedContext(container);
    };
    this.attachedContextDisposables.add(dom.addDisposableListener(showMoreButton, "click", clickHandler));
    this.attachedContextDisposables.add(dom.addDisposableListener(showMoreButton, "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        clickHandler();
      }
    }));
    container.appendChild(showMoreButton);
    this.attachedContextDisposables.add({ dispose: () => showMoreButton.remove() });
  }
  renderAttachment(attachment, container) {
    const resource = URI.isUri(attachment.value) ? attachment.value : attachment.value && typeof attachment.value === "object" && "uri" in attachment.value && URI.isUri(attachment.value.uri) ? attachment.value.uri : void 0;
    const range = attachment.value && typeof attachment.value === "object" && "range" in attachment.value && Range.isIRange(attachment.value.range) ? attachment.value.range : void 0;
    const correspondingContentReference = this.contentReferences.find((ref) => typeof ref.reference === "object" && "variableName" in ref.reference && ref.reference.variableName === attachment.name || URI.isUri(ref.reference) && basename(ref.reference.path) === attachment.name);
    const isAttachmentOmitted = correspondingContentReference?.options?.status?.kind === ChatResponseReferencePartStatusKind.Omitted;
    const isAttachmentPartialOrOmitted = isAttachmentOmitted || correspondingContentReference?.options?.status?.kind === ChatResponseReferencePartStatusKind.Partial;
    let widget;
    if (attachment.kind === "tool" || attachment.kind === "toolset") {
      widget = this.instantiationService.createInstance(ToolSetOrToolItemAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isElementVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(ElementChatAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isImageVariableEntry(attachment)) {
      const renderedAttachment = isAttachmentPartialOrOmitted || this.currentModelDoesNotSupportImages() ? { ...attachment, omittedState: OmittedState.Full } : attachment;
      widget = this.instantiationService.createInstance(ImageAttachmentWidget, resource, renderedAttachment, this.getCurrentLanguageModel(), { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isPromptFileVariableEntry(attachment)) {
      if (attachment.automaticallyAdded) {
        return;
      }
      widget = this.instantiationService.createInstance(PromptFileAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isPromptTextVariableEntry(attachment)) {
      if (attachment.automaticallyAdded) {
        return;
      }
      widget = this.instantiationService.createInstance(PromptTextAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (resource && (attachment.kind === "file" || attachment.kind === "directory")) {
      widget = this.instantiationService.createInstance(FileAttachmentWidget, resource, range, attachment, correspondingContentReference, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isTerminalVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(TerminalCommandAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isPasteVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(PasteAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (resource && isNotebookOutputVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(NotebookCellOutputChatAttachmentWidget, resource, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isSCMHistoryItemVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(SCMHistoryItemAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isSCMHistoryItemChangeVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(SCMHistoryItemChangeAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isSCMHistoryItemChangeRangeVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(SCMHistoryItemChangeRangeAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isBrowserViewVariableEntry(attachment)) {
      widget = this.instantiationService.createInstance(BrowserViewAttachmentWidget, attachment, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    } else if (isWorkspaceVariableEntry(attachment)) {
      return;
    } else {
      widget = this.chatAttachmentWidgetRegistry.createWidget(attachment, { shouldFocusClearButton: false, supportsDeletion: false }, container) ?? this.instantiationService.createInstance(DefaultChatAttachmentWidget, resource, range, attachment, correspondingContentReference, void 0, { shouldFocusClearButton: false, supportsDeletion: false }, container, this._contextResourceLabels);
    }
    let ariaLabel = null;
    if (isAttachmentPartialOrOmitted) {
      widget.element.classList.add("warning");
    }
    const description = correspondingContentReference?.options?.status?.description;
    if (isAttachmentPartialOrOmitted) {
      ariaLabel = `${ariaLabel}${description ? ` ${description}` : ""}`;
      for (const selector of [".monaco-icon-suffix-container", ".monaco-icon-name-container"]) {
        const element = widget.label?.element.querySelector(selector);
        if (element) {
          element.classList.add("warning");
        }
      }
    }
    this._register(dom.addDisposableListener(widget.element, "contextmenu", (e) => this.contextMenuHandler?.(attachment, e)));
    if (this.attachedContextDisposables.isDisposed) {
      widget.dispose();
      return;
    }
    if (ariaLabel) {
      widget.element.ariaLabel = ariaLabel;
    }
    this.attachedContextDisposables.add(widget);
  }
};
ChatAttachmentsContentPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILanguageModelsService),
  __decorateParam(3, IChatAttachmentWidgetRegistry)
], ChatAttachmentsContentPart);
export {
  ChatAttachmentsContentPart
};
