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
import * as dom from "../../../../../base/browser/dom.js";
import { $ } from "../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { HoverStyle } from "../../../../../base/browser/ui/hover/hover.js";
import { createInstantHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import * as event from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { basename, dirname } from "../../../../../base/common/path.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { getIconClasses } from "../../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { fillInSymbolsDragData } from "../../../../../platform/dnd/browser/dnd.js";
import { registerOpenEditorListeners } from "../../../../../platform/editor/browser/editor.js";
import { FileKind, IFileService } from "../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { FolderThemeIcon, IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { isDark } from "../../../../../platform/theme/common/theme.js";
import { fillEditorsDragData } from "../../../../browser/dnd.js";
import { StaticResourceContextKey } from "../../../../common/contextkeys.js";
import { IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { revealInSideBarCommand } from "../../../files/browser/fileActions.contribution.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { toHistoryItemHoverContent } from "../../../scm/browser/scmHistory.js";
import { getHistoryItemEditorTitle } from "../../../scm/browser/util.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { BrowserViewSharingState, IBrowserViewWorkbenchService } from "../../../browserView/common/browserView.js";
import { buildOpenSessionLinkForChatResource } from "../../../../../platform/agentHost/common/openSessionLink.js";
import { coerceImageBuffer } from "../../common/chatImageExtraction.js";
import { ChatConfiguration } from "../../common/constants.js";
import { getImageAttachmentLimit, OmittedState, PromptFileVariableKind, isStringVariableEntry, resolveChatContextIcon } from "../../common/attachments/chatVariableEntries.js";
import { ILanguageModelsService, isAutoLanguageModel } from "../../common/languageModels.js";
import { ILanguageModelToolsService, isToolSet } from "../../common/tools/languageModelToolsService.js";
import { getCleanPromptName } from "../../common/promptSyntax/config/promptFileLocations.js";
import { IChatContextService } from "../contextContrib/chatContextService.js";
import { IChatImageCarouselService } from "../chatImageCarouselService.js";
import { CHAT_IMAGE_HOVER_THUMBNAIL_MAX_SIZE, getOrCreateImageThumbnail } from "../chatImageUtils.js";
const commonHoverOptions = {
  style: HoverStyle.Pointer,
  position: {
    hoverPosition: HoverPosition.BELOW
  },
  trapFocus: true
};
const commonHoverLifecycleOptions = {
  groupId: "chat-attachments"
};
const KEY_ELEMENT_HOVER_COMPUTED_STYLE_PROPERTIES = [
  "display",
  "position",
  "margin",
  "padding",
  "font-size",
  "font-family",
  "color",
  "background-color"
];
let AbstractChatAttachmentWidget = class extends Disposable {
  constructor(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService, terminalService) {
    super();
    this.attachment = attachment;
    this.options = options;
    this.currentLanguageModel = currentLanguageModel;
    this.commandService = commandService;
    this.openerService = openerService;
    this.configurationService = configurationService;
    this.terminalService = terminalService;
    this._onDidDelete = this._register(new event.Emitter());
    this._onDidOpen = this._register(new event.Emitter());
    this._hasClearButton = false;
    this.element = dom.append(container, $(".chat-attached-context-attachment.show-file-icons"));
    this.attachClearButton();
    this.label = contextResourceLabels.create(this.element, { supportIcons: true, hoverTargetOverride: this.element });
    this._register(this.label);
    this.element.tabIndex = 0;
    this.element.role = "button";
    this._register(dom.addDisposableListener(this.element, dom.EventType.AUXCLICK, (e) => {
      if (e.button === 1 && this.options.supportsDeletion && !this.attachment.range) {
        e.preventDefault();
        e.stopPropagation();
        this._onDidDelete.fire(e);
      }
    }));
  }
  get onDidDelete() {
    return this._onDidDelete.event;
  }
  get onDidOpen() {
    return this._onDidOpen.event;
  }
  modelSupportsVision() {
    return modelSupportsVision(this.currentLanguageModel);
  }
  appendDeletionHint(ariaLabel) {
    if (!this._hasClearButton) {
      return ariaLabel;
    }
    return localize("chat.attachment.withDeleteHint", "{0} (Delete)", ariaLabel);
  }
  attachClearButton() {
    if (this.attachment.range || !this.options.supportsDeletion) {
      return;
    }
    this._hasClearButton = true;
    const clearButton = new Button(this.element, {
      supportIcons: true,
      hoverDelegate: createInstantHoverDelegate(),
      title: localize("chat.attachment.clearButton", "Remove from context")
    });
    clearButton.element.tabIndex = -1;
    clearButton.icon = Codicon.closeCompact;
    this._register(clearButton);
    this._register(event.Event.once(clearButton.onDidClick)((e) => {
      this._onDidDelete.fire(e);
    }));
    this._register(dom.addStandardDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
      if (e.keyCode === KeyCode.Backspace || e.keyCode === KeyCode.Delete) {
        e.preventDefault();
        e.stopPropagation();
        this._onDidDelete.fire(e.browserEvent);
      }
    }));
  }
  addResourceOpenHandlers(resource, range) {
    this.element.style.cursor = "pointer";
    this._register(registerOpenEditorListeners(this.element, async (options) => {
      if (this.attachment.kind === "directory") {
        await this.openResource(resource, options, true);
      } else {
        await this.openResource(resource, options, false, range);
      }
    }));
  }
  async openResource(resource, openOptions, isDirectory, range) {
    if (isDirectory) {
      this.commandService.executeCommand(revealInSideBarCommand.id, resource);
      return;
    }
    if (resource.scheme === Schemas.vscodeTerminal) {
      this.terminalService?.openResource(resource);
      return;
    }
    const openTextEditorOptions = range ? { selection: range } : void 0;
    const options = {
      fromUserGesture: true,
      openToSide: openOptions.openToSide,
      editorOptions: {
        ...openTextEditorOptions,
        ...openOptions.editorOptions
      }
    };
    await this.openerService.open(resource, options);
    this._onDidOpen.fire();
    this.element.focus();
  }
};
AbstractChatAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITerminalService)
], AbstractChatAttachmentWidget);
function modelSupportsVision(currentLanguageModel) {
  return isAutoLanguageModel(currentLanguageModel) || (currentLanguageModel?.metadata.capabilities?.vision ?? false);
}
function getEffectiveImageOmittedState(omittedState, currentLanguageModel, isCurrentInput) {
  return isAutoLanguageModel(currentLanguageModel) && isCurrentInput && omittedState === OmittedState.Full ? OmittedState.NotOmitted : omittedState;
}
let FileAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, range, attachment, correspondingContentReference, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, themeService, hoverService, languageModelsService, instantiationService, fileDialogService, fileService, notificationService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.themeService = themeService;
    this.hoverService = hoverService;
    this.languageModelsService = languageModelsService;
    this.instantiationService = instantiationService;
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
    this.notificationService = notificationService;
    const fileBasename = basename(resource.path);
    const fileDirname = dirname(resource.path);
    const friendlyName = `${fileBasename} ${fileDirname}`;
    let ariaLabel = range ? localize("chat.fileAttachmentWithRange", "Attached file, {0}, line {1} to line {2}", friendlyName, range.startLineNumber, range.endLineNumber) : localize("chat.fileAttachment", "Attached file, {0}", friendlyName);
    if (attachment.omittedState === OmittedState.Full) {
      ariaLabel = localize("chat.omittedFileAttachment", "Omitted this file: {0}", attachment.name);
      this.renderOmittedWarning(friendlyName, ariaLabel);
    } else {
      const fileOptions = { hidePath: true, title: correspondingContentReference?.options?.status?.description };
      this.label.setFile(resource, attachment.kind === "file" ? {
        ...fileOptions,
        fileKind: FileKind.FILE,
        range
      } : {
        ...fileOptions,
        fileKind: FileKind.FOLDER,
        icon: !this.themeService.getFileIconTheme().hasFolderIcons ? FolderThemeIcon : void 0
      });
      if (attachment.kind === "directory" && typeof attachment.imageCount === "number") {
        const maxImagesPerRequest = getImageAttachmentLimit(currentLanguageModel?.metadata);
        if (maxImagesPerRequest !== void 0 && attachment.imageCount > maxImagesPerRequest) {
          this.renderFolderImageLimitWarning(attachment.imageCount, maxImagesPerRequest);
        }
      }
    }
    this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
    if (attachment.kind === "file") {
      this.attachSaveButton(resource, fileBasename, options.supportsDeletion);
    }
    this.instantiationService.invokeFunction((accessor) => {
      this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
    });
    this.addResourceOpenHandlers(resource, range);
  }
  attachSaveButton(resource, name, supportsDeletion) {
    if (supportsDeletion) {
      return;
    }
    const saveButton = new Button(this.element, {
      supportIcons: true,
      hoverDelegate: createInstantHoverDelegate(),
      title: localize("chat.attachment.saveFileButton", "Save As...")
    });
    saveButton.element.classList.add("chat-attached-context-download-button");
    saveButton.element.tabIndex = -1;
    saveButton.icon = Codicon.cloudDownload;
    this.element.insertBefore(saveButton.element, this.label.element);
    this._register(saveButton);
    this._register(saveButton.onDidClick(async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const defaultUri = joinPath(await this.fileDialogService.defaultFilePath(), name);
      const target = await this.fileDialogService.showSaveDialog({ defaultUri });
      if (!target) {
        return;
      }
      try {
        await this.fileService.copy(resource, target, true);
      } catch (error) {
        this.notificationService.error(localize("chat.attachment.saveFileError", "Failed to save file: {0}", error));
      }
    }));
  }
  renderOmittedWarning(friendlyName, ariaLabel) {
    const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$("span.codicon.codicon-warning"));
    const textLabel = dom.$("span.chat-attached-context-custom-text", {}, friendlyName);
    this.element.appendChild(pillIcon);
    this.element.appendChild(textLabel);
    const hoverElement = dom.$("div.chat-attached-context-hover");
    hoverElement.setAttribute("aria-label", ariaLabel);
    this.element.classList.add("warning");
    hoverElement.textContent = localize("chat.fileAttachmentHover", "{0} does not support this file type.", this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name : this.currentLanguageModel ?? "This model");
    this._register(this.hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content: hoverElement
    }, commonHoverLifecycleOptions));
  }
  renderFolderImageLimitWarning(imageCount, limit) {
    this.element.classList.add("warning");
    const hoverElement = dom.$("div.chat-attached-context-hover");
    hoverElement.textContent = localize(
      "chat.folderImageLimitExceededHover",
      "This folder contains {0} images, which exceeds the maximum of {1} images per request. Older images will not be sent.",
      imageCount,
      limit
    );
    this._register(this.hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content: hoverElement
    }, commonHoverLifecycleOptions));
  }
};
FileAttachmentWidget = __decorateClass([
  __decorateParam(8, ICommandService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IHoverService),
  __decorateParam(13, ILanguageModelsService),
  __decorateParam(14, IInstantiationService),
  __decorateParam(15, IFileDialogService),
  __decorateParam(16, IFileService),
  __decorateParam(17, INotificationService)
], FileAttachmentWidget);
let TerminalCommandAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, hoverService, terminalService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService, terminalService);
    this.hoverService = hoverService;
    this.terminalService = terminalService;
    const ariaLabel = localize("chat.terminalCommand", "Terminal command, {0}", attachment.command);
    const clickHandler = () => this.openResource(attachment.resource, { editorOptions: { preserveFocus: true } }, false, void 0);
    this._register(createTerminalCommandElements(this.element, attachment, ariaLabel, this.hoverService, clickHandler));
    this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, async (e) => {
      const event2 = new StandardKeyboardEvent(e);
      if (event2.equals(KeyCode.Enter) || event2.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        await clickHandler();
      }
    }));
    this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
  }
};
TerminalCommandAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, ITerminalService)
], TerminalCommandAttachmentWidget);
var TerminalConstants = /* @__PURE__ */ ((TerminalConstants2) => {
  TerminalConstants2[TerminalConstants2["MaxAttachmentOutputLineCount"] = 5] = "MaxAttachmentOutputLineCount";
  TerminalConstants2[TerminalConstants2["MaxAttachmentOutputLineLength"] = 80] = "MaxAttachmentOutputLineLength";
  return TerminalConstants2;
})(TerminalConstants || {});
function createTerminalCommandElements(element, attachment, ariaLabel, hoverService, clickHandler) {
  const disposable = new DisposableStore();
  element.ariaLabel = ariaLabel;
  element.style.cursor = "pointer";
  const terminalIconSpan = dom.$("span");
  terminalIconSpan.classList.add(...ThemeIcon.asClassNameArray(Codicon.terminal));
  const pillIcon = dom.$("div.chat-attached-context-pill", {}, terminalIconSpan);
  const textLabel = dom.$("span.chat-attached-context-custom-text", {}, attachment.command);
  element.appendChild(pillIcon);
  element.appendChild(textLabel);
  disposable.add(dom.addDisposableListener(element, dom.EventType.CLICK, (e) => {
    e.preventDefault();
    e.stopPropagation();
    clickHandler();
  }));
  disposable.add(hoverService.setupDelayedHover(element, () => getHoverContent(ariaLabel, attachment), commonHoverLifecycleOptions));
  return disposable;
}
function getHoverContent(ariaLabel, attachment) {
  {
    const hoverElement = dom.$("div.chat-attached-context-hover");
    hoverElement.setAttribute("aria-label", ariaLabel);
    const commandTitle = dom.$("div", {}, typeof attachment.exitCode === "number" ? localize("chat.terminalCommandHoverCommandTitleExit", "Command: {0}, exit code: {1}", attachment.command, attachment.exitCode) : localize("chat.terminalCommandHoverCommandTitle", "Command"));
    commandTitle.classList.add("attachment-additional-info");
    const commandBlock = dom.$("pre.chat-terminal-command-block");
    hoverElement.append(commandTitle, commandBlock);
    if (attachment.output && attachment.output.trim().length > 0) {
      const outputTitle = dom.$("div", {}, localize("chat.terminalCommandHoverOutputTitle", "Output:"));
      outputTitle.classList.add("attachment-additional-info");
      const outputBlock = dom.$("pre.chat-terminal-command-output");
      const fullOutputLines = attachment.output.split("\n");
      const hoverOutputLines = [];
      for (const line of fullOutputLines) {
        if (hoverOutputLines.length >= 5 /* MaxAttachmentOutputLineCount */) {
          hoverOutputLines.push("...");
          break;
        }
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          continue;
        }
        if (trimmed.length > 80 /* MaxAttachmentOutputLineLength */) {
          hoverOutputLines.push(`${trimmed.slice(0, 80 /* MaxAttachmentOutputLineLength */)}...`);
        } else {
          hoverOutputLines.push(trimmed);
        }
      }
      outputBlock.textContent = hoverOutputLines.join("\n");
      hoverElement.append(outputTitle, outputBlock);
    }
    return {
      ...commonHoverOptions,
      content: hoverElement
    };
  }
}
let ImageAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, hoverService, languageModelsService, instantiationService, labelService, chatImageCarouselService, fileDialogService, fileService, notificationService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.hoverService = hoverService;
    this.languageModelsService = languageModelsService;
    this.labelService = labelService;
    this.chatImageCarouselService = chatImageCarouselService;
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
    this.notificationService = notificationService;
    this.element.classList.add("image-attachment");
    const isAutoModel = isAutoLanguageModel(currentLanguageModel);
    const modelName = currentLanguageModel?.metadata.name;
    const omittedState = getEffectiveImageOmittedState(attachment.omittedState, currentLanguageModel, options.isCurrentInput);
    this.element.classList.toggle("auto-image-warning", isAutoModel);
    let ariaLabel;
    if (omittedState === OmittedState.Full && modelName && !modelSupportsVision(currentLanguageModel)) {
      ariaLabel = localize("chat.unsupportedImageAttachment", "Image not sent because {0} does not support images: {1}", modelName, attachment.name);
    } else if (omittedState === OmittedState.Full) {
      ariaLabel = localize("chat.omittedImageAttachment", "Omitted this image: {0}", attachment.name);
    } else if (omittedState === OmittedState.Partial) {
      ariaLabel = localize("chat.partiallyOmittedImageAttachment", "Partially omitted this image: {0}", attachment.name);
    } else if (omittedState === OmittedState.ImageLimitExceeded) {
      ariaLabel = localize("chat.imageLimitExceededAttachment", "Image not sent due to limit: {0}", attachment.name);
    } else if (isAutoModel) {
      ariaLabel = localize("chat.autoImageAttachment", "Attached image, {0}. Image support depends on the model selected by Auto.", attachment.name);
    } else {
      ariaLabel = localize("chat.imageAttachment", "Attached image, {0}", attachment.name);
    }
    const ref = attachment.references?.[0]?.reference;
    resource = ref && URI.isUri(ref) ? ref : void 0;
    const imageData = coerceImageBuffer(attachment.value);
    const clickHandler = async () => {
      if ((resource || imageData) && configurationService.getValue(ChatConfiguration.ImageCarouselEnabled)) {
        await this.openInCarousel(attachment.id, attachment.name, imageData, resource, options.isCurrentInput);
      } else if (resource) {
        await this.openResource(resource, { editorOptions: { preserveFocus: true } }, false, void 0);
      }
    };
    const currentLanguageModelName = this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name ?? this.currentLanguageModel.identifier : "Current model";
    const fullName = resource ? this.labelService.getUriLabel(resource) : attachment.fullName || attachment.name;
    const imageElements = this._register(new MutableDisposable());
    const renderImageElements = (buffer) => {
      imageElements.value = createImageElements(resource, attachment.name, fullName, this.element, buffer, attachment.id, this.hoverService, ariaLabel, currentLanguageModelName, clickHandler, this.currentLanguageModel, omittedState);
      this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
    };
    renderImageElements(imageData ?? new Uint8Array());
    if (!imageData && resource && omittedState !== OmittedState.Full && omittedState !== OmittedState.ImageLimitExceeded) {
      void this.loadImageBytes(resource, renderImageElements);
    }
    this.attachSaveButton(resource, imageData, attachment.name, options.supportsDeletion);
    const canOpenCarousel = !!imageData && configurationService.getValue(ChatConfiguration.ImageCarouselEnabled);
    if (canOpenCarousel || resource) {
      this.element.style.cursor = "pointer";
      this._register(registerOpenEditorListeners(this.element, async () => {
        await clickHandler();
      }));
    }
    if (resource) {
      instantiationService.invokeFunction((accessor) => {
        this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
      });
    }
  }
  async loadImageBytes(resource, render) {
    let content;
    try {
      content = (await this.fileService.readFile(resource)).value;
    } catch {
      return;
    }
    if (this._store.isDisposed) {
      return;
    }
    render(content.buffer);
  }
  async openInCarousel(id, name, data, referenceUri, preferCurrentInput) {
    const resource = referenceUri ?? URI.from({ scheme: "data", path: `${id}/${encodeURIComponent(name)}` });
    await this.chatImageCarouselService.openCarouselAtResource(resource, data, { preferCurrentInput });
  }
  attachSaveButton(resource, imageData, name, supportsDeletion) {
    if (supportsDeletion || !resource && !imageData) {
      return;
    }
    const saveButton = new Button(this.element, {
      supportIcons: true,
      hoverDelegate: createInstantHoverDelegate(),
      title: localize("chat.attachment.saveImageButton", "Save Image As...")
    });
    saveButton.element.classList.add("chat-attached-context-download-button");
    saveButton.element.tabIndex = -1;
    saveButton.icon = Codicon.cloudDownload;
    this._register(saveButton);
    this._register(saveButton.onDidClick(async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const defaultUri = joinPath(await this.fileDialogService.defaultFilePath(), name);
      const target = await this.fileDialogService.showSaveDialog({ defaultUri });
      if (!target) {
        return;
      }
      try {
        if (resource) {
          await this.fileService.copy(resource, target, true);
        } else if (imageData) {
          await this.fileService.writeFile(target, VSBuffer.wrap(imageData));
        }
      } catch (error) {
        this.notificationService.error(localize("chat.attachment.saveImageError", "Failed to save image: {0}", error));
      }
    }));
  }
};
ImageAttachmentWidget = __decorateClass([
  __decorateParam(6, ICommandService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ILanguageModelsService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IChatImageCarouselService),
  __decorateParam(14, IFileDialogService),
  __decorateParam(15, IFileService),
  __decorateParam(16, INotificationService)
], ImageAttachmentWidget);
function createImageHoverContent(resource, fullName, buffer, cacheKey, onContentsChanged, clickHandler, onImageUrl, imageAlt = "") {
  const disposable = new DisposableStore();
  const hoverElement = dom.$("div.chat-attached-context-hover");
  const hoverImage = dom.$("img.chat-attached-context-image", { alt: imageAlt });
  const imageContainer = dom.$("div.chat-attached-context-image-container", {}, hoverImage);
  hoverElement.appendChild(imageContainer);
  if (clickHandler) {
    imageContainer.classList.add("clickable");
    imageContainer.tabIndex = 0;
    imageContainer.role = "button";
    imageContainer.ariaLabel = localize("chat.openImagePreview", "Open in Images Preview");
    disposable.add(registerOpenEditorListeners(imageContainer, async () => {
      await clickHandler();
    }));
  }
  if (resource) {
    const urlContainer = clickHandler ? dom.$("a.chat-attached-context-url", {}, fullName) : dom.$("div.chat-attached-context-url", {}, fullName);
    const separator = dom.$("div.chat-attached-context-url-separator");
    if (clickHandler) {
      disposable.add(dom.addDisposableListener(urlContainer, "click", clickHandler));
    }
    hoverElement.append(separator, urlContainer);
  }
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const previewImageUrl = disposable.add(new MutableDisposable());
  const renderPreviewImage = async () => {
    const thumbnail = await getOrCreateImageThumbnail(cacheKey, data, CHAT_IMAGE_HOVER_THUMBNAIL_MAX_SIZE);
    if (disposable.isDisposed) {
      return;
    }
    const source = thumbnail ?? new Blob([data]);
    const url = URL.createObjectURL(source);
    previewImageUrl.value = toDisposable(() => URL.revokeObjectURL(url));
    hoverImage.onload = () => onContentsChanged?.();
    hoverImage.src = url;
    onImageUrl?.(url, !!thumbnail, hoverImage);
  };
  void renderPreviewImage();
  return { element: hoverElement, disposable };
}
function createImageElements(resource, name, fullName, element, buffer, cacheKey, hoverService, ariaLabel, currentLanguageModelName, clickHandler, currentLanguageModel, omittedState) {
  const disposable = new DisposableStore();
  if (omittedState === OmittedState.Partial) {
    element.classList.add("partial-warning");
  }
  element.ariaLabel = ariaLabel;
  element.style.position = "relative";
  if (resource) {
    element.style.cursor = "pointer";
  }
  const supportsVision = modelSupportsVision(currentLanguageModel);
  const pillIcon = dom.$("div.chat-attached-context-pill", {}, dom.$(supportsVision ? "span.codicon.codicon-file-media" : "span.codicon.codicon-warning"));
  const textLabel = dom.$("span.chat-attached-context-custom-text", {}, name);
  element.appendChild(pillIcon);
  element.appendChild(textLabel);
  let currentPill = pillIcon;
  const replacePill = (pill) => {
    currentPill.replaceWith(pill);
    currentPill = pill;
  };
  const hoverElement = dom.$("div.chat-attached-context-hover");
  hoverElement.setAttribute("aria-label", ariaLabel);
  if (!supportsVision && currentLanguageModel || omittedState === OmittedState.Full) {
    element.classList.add("warning");
    hoverElement.textContent = localize("chat.imageAttachmentHover", "{0} does not support images.", currentLanguageModelName ?? "This model");
    disposable.add(hoverService.setupDelayedHover(element, {
      content: hoverElement,
      style: HoverStyle.Pointer
    }));
  } else if (omittedState === OmittedState.ImageLimitExceeded) {
    element.classList.add("warning");
    const maxImagesPerRequest = getImageAttachmentLimit(currentLanguageModel?.metadata);
    hoverElement.textContent = maxImagesPerRequest !== void 0 ? localize("chat.imageLimitExceededHover", "This image was not sent because the maximum of {0} images per request was exceeded.", maxImagesPerRequest) : localize("chat.imageLimitExceededHoverUnknownLimit", "This image was not sent because this model's image limit was exceeded.");
    disposable.add(hoverService.setupDelayedHover(element, {
      content: hoverElement,
      style: HoverStyle.Pointer
    }));
  } else {
    const onImageFailed = () => {
      const pillIcon2 = dom.$("div.chat-attached-context-pill", {}, dom.$("span.codicon.codicon-file-media"));
      replacePill(pillIcon2);
    };
    const hoverFullName = omittedState === OmittedState.Partial ? localize("chat.imageAttachmentWarning", "This GIF was partially omitted - current frame will be sent.") : fullName;
    const hoverContent = createImageHoverContent(resource, hoverFullName, buffer, cacheKey, void 0, resource ? clickHandler : void 0, (url, isThumbnail, hoverImage) => {
      if (isThumbnail) {
        const pillImg = dom.$("img.chat-attached-context-pill-image", { src: url, alt: "" });
        const pill = dom.$("div.chat-attached-context-pill", {}, pillImg);
        replacePill(pill);
      }
      hoverImage.onerror = onImageFailed;
    });
    disposable.add(hoverContent.disposable);
    const hoverElement2 = hoverContent.element;
    hoverElement2.setAttribute("aria-label", ariaLabel);
    disposable.add(hoverService.setupDelayedHover(element, {
      content: hoverElement2,
      style: HoverStyle.Pointer
    }));
    if (isAutoLanguageModel(currentLanguageModel)) {
      hoverElement2.appendChild(dom.$("div", void 0, localize("chat.autoImageAttachmentHover", "Image support depends on the model selected by Auto.")));
    }
  }
  disposable.add(toDisposable(() => {
    currentPill.remove();
    textLabel.remove();
  }));
  return disposable;
}
let PasteAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, hoverService, instantiationService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    const ariaLabel = localize("chat.attachment", "Attached context, {0}", attachment.name);
    this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
    const classNames = ["file-icon", `${attachment.language}-lang-file-icon`];
    let resource;
    let range;
    if (attachment.copiedFrom) {
      resource = attachment.copiedFrom.uri;
      range = attachment.copiedFrom.range;
      const filename = basename(resource.path);
      this.label.setLabel(filename, void 0, { extraClasses: classNames });
    } else {
      this.label.setLabel(attachment.fileName, void 0, { extraClasses: classNames });
    }
    this.element.appendChild(dom.$("span.attachment-additional-info", {}, `Pasted ${attachment.pastedLines}`));
    this.element.style.position = "relative";
    const sourceUri = attachment.copiedFrom?.uri;
    const hoverContent = new MarkdownString(`${sourceUri ? this.instantiationService.invokeFunction((accessor) => accessor.get(ILabelService).getUriLabel(sourceUri, { relative: true })) : attachment.fileName}

---

\`\`\`${attachment.language}

${attachment.code}
\`\`\``);
    this._register(this.hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content: hoverContent
    }, commonHoverLifecycleOptions));
    const copiedFromResource = attachment.copiedFrom?.uri;
    if (copiedFromResource) {
      this._register(this.instantiationService.invokeFunction(hookUpResourceAttachmentDragAndContextMenu, this.element, copiedFromResource));
      this.addResourceOpenHandlers(copiedFromResource, range);
    }
  }
};
PasteAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, IInstantiationService)
], PasteAttachmentWidget);
let DefaultChatAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, range, attachment, correspondingContentReference, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, contextKeyService, instantiationService, hoverService, modelService, languageService, themeService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.hoverService = hoverService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.themeService = themeService;
    this._tooltipHover = this._register(new MutableDisposable());
    const attachmentLabel = attachment.fullName ?? attachment.name;
    const description = correspondingContentReference?.options?.status?.description;
    const iconPath = isStringVariableEntry(attachment) || attachment.kind === "generic" ? attachment.iconPath : void 0;
    this._applyLabel(attachment, attachmentLabel, description, iconPath);
    if (iconPath && !ThemeIcon.isThemeIcon(iconPath) && !URI.isUri(iconPath)) {
      this._register(this.themeService.onDidColorThemeChange(() => this._applyLabel(attachment, attachmentLabel, description, iconPath)));
    }
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment", "Attached context, {0}", attachment.name));
    if (attachment.kind === "diagnostic") {
      if (attachment.filterUri) {
        resource = attachment.filterUri ? URI.revive(attachment.filterUri) : void 0;
        range = attachment.filterRange;
      } else {
        this.element.style.cursor = "pointer";
        this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, () => {
          this.commandService.executeCommand("workbench.panel.markers.view.focus");
        }));
      }
    }
    if (attachment.kind === "symbol") {
      this._register(this.instantiationService.invokeFunction(hookUpSymbolAttachmentDragAndContextMenu, this.element, this.contextKeyService, { ...attachment, kind: attachment.symbolKind }, MenuId.ChatInputSymbolAttachmentContext));
    }
    if (isStringVariableEntry(attachment) && attachment.commandId) {
      this.element.style.cursor = "pointer";
      const contextItemHandle = attachment.handle;
      this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, async () => {
        const chatContextService = this.instantiationService.invokeFunction((accessor) => accessor.get(IChatContextService));
        await chatContextService.executeChatContextItemCommand(contextItemHandle);
      }));
    }
    if (attachment.kind === "debugEvents") {
      this.element.style.cursor = "pointer";
      this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, () => {
        const d = new Date(attachment.snapshotTime);
        const filter = `before:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
        this.commandService.executeCommand("workbench.action.chat.openAgentDebugPanelForSession", attachment.sessionResource, filter);
      }));
    }
    if ((isStringVariableEntry(attachment) || attachment.kind === "generic") && attachment.tooltip) {
      this._setupTooltipHover(attachment.tooltip);
    }
    if (resource) {
      this.addResourceOpenHandlers(resource, range);
    }
  }
  _applyLabel(attachment, attachmentLabel, description, iconPath) {
    if (isStringVariableEntry(attachment) && iconPath && ThemeIcon.isThemeIcon(iconPath) && (ThemeIcon.isFile(iconPath) || ThemeIcon.isFolder(iconPath)) && attachment.resourceUri) {
      const fileKind = ThemeIcon.isFolder(iconPath) ? FileKind.FOLDER : FileKind.FILE;
      const iconClasses = getIconClasses(this.modelService, this.languageService, attachment.resourceUri, fileKind);
      this.label.setLabel(attachmentLabel, description, { extraClasses: iconClasses });
    } else if (iconPath) {
      const resolvedIcon = resolveChatContextIcon(iconPath, isDark(this.themeService.getColorTheme().type));
      this.label.setLabel(attachmentLabel, description, { iconPath: resolvedIcon });
    } else {
      const withIcon = attachment.icon?.id ? `$(${attachment.icon.id})\xA0${attachmentLabel}` : attachmentLabel;
      this.label.setLabel(withIcon, description);
    }
  }
  _setupTooltipHover(tooltip) {
    this._tooltipHover.value = this.hoverService.setupDelayedHover(this.element, {
      content: tooltip,
      appearance: { showPointer: true }
    });
  }
};
DefaultChatAttachmentWidget = __decorateClass([
  __decorateParam(8, ICommandService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IHoverService),
  __decorateParam(14, IModelService),
  __decorateParam(15, ILanguageService),
  __decorateParam(16, IThemeService)
], DefaultChatAttachmentWidget);
let PromptFileAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, labelService, instantiationService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.labelService = labelService;
    this.instantiationService = instantiationService;
    this.hintElement = dom.append(this.element, dom.$("span.prompt-type"));
    this.updateLabel(attachment);
    this.instantiationService.invokeFunction((accessor) => {
      this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, attachment.value));
    });
    this.addResourceOpenHandlers(attachment.value, void 0);
  }
  updateLabel(attachment) {
    const resource = attachment.value;
    const fileBasename = basename(resource.path);
    const fileDirname = dirname(resource.path);
    const friendlyName = `${fileBasename} ${fileDirname}`;
    const isPrompt = attachment.id.startsWith(PromptFileVariableKind.PromptFile);
    const ariaLabel = isPrompt ? localize("chat.promptAttachment", "Prompt file, {0}", friendlyName) : localize("chat.instructionsAttachment", "Instructions attachment, {0}", friendlyName);
    const typeLabel = isPrompt ? localize("prompt", "Prompt") : localize("instructions", "Instructions");
    const title = this.labelService.getUriLabel(resource) + (attachment.originLabel ? `
${attachment.originLabel}` : "");
    this.element.classList.remove("warning", "error");
    const fileWithoutExtension = getCleanPromptName(resource);
    this.label.setFile(URI.file(fileWithoutExtension), {
      fileKind: FileKind.FILE,
      hidePath: true,
      range: void 0,
      title,
      icon: ThemeIcon.fromId(Codicon.bookmark.id),
      extraClasses: []
    });
    this.hintElement.innerText = typeLabel;
    this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
  }
};
PromptFileAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IInstantiationService)
], PromptFileAttachmentWidget);
let PromptTextAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, preferencesService, hoverService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    if (attachment.settingId) {
      const openSettings = () => preferencesService.openSettings({ jsonEditor: false, query: `@id:${attachment.settingId}` });
      this.element.style.cursor = "pointer";
      this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, async (e) => {
        dom.EventHelper.stop(e, true);
        openSettings();
      }));
      this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, async (e) => {
        const event2 = new StandardKeyboardEvent(e);
        if (event2.equals(KeyCode.Enter) || event2.equals(KeyCode.Space)) {
          dom.EventHelper.stop(e, true);
          openSettings();
        }
      }));
    }
    this.label.setLabel(localize("instructions.label", "Additional Instructions"), void 0, void 0);
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment", "Attached context, {0}", attachment.name));
    this._register(hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content: attachment.value
    }, commonHoverLifecycleOptions));
  }
};
PromptTextAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IPreferencesService),
  __decorateParam(9, IHoverService)
], PromptTextAttachmentWidget);
let ToolSetOrToolItemAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, toolsService, commandService, openerService, configurationService, hoverService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    const toolOrToolSet = Iterable.find(toolsService.getTools(currentLanguageModel?.metadata), (tool) => tool.id === attachment.id) ?? Iterable.find(toolsService.getToolSetsForModel(currentLanguageModel?.metadata), (toolSet) => toolSet.id === attachment.id);
    let name = attachment.name;
    const icon = attachment.icon ?? Codicon.tools;
    if (isToolSet(toolOrToolSet)) {
      name = toolOrToolSet.referenceName;
    } else if (toolOrToolSet) {
      name = toolOrToolSet.toolReferenceName ?? name;
    }
    this.label.setLabel(`$(${icon.id})\xA0${name}`, void 0);
    this.element.style.cursor = "pointer";
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment", "Attached context, {0}", name));
    let hoverContent;
    if (isToolSet(toolOrToolSet)) {
      hoverContent = localize("toolset", "{0} - {1}", toolOrToolSet.description ?? toolOrToolSet.referenceName, toolOrToolSet.source.label);
    } else if (toolOrToolSet) {
      hoverContent = localize("tool", "{0} - {1}", toolOrToolSet.userDescription ?? toolOrToolSet.modelDescription, toolOrToolSet.source.label);
    }
    if (hoverContent) {
      this._register(hoverService.setupDelayedHover(this.element, {
        ...commonHoverOptions,
        content: hoverContent
      }, commonHoverLifecycleOptions));
    }
  }
};
ToolSetOrToolItemAttachmentWidget = __decorateClass([
  __decorateParam(5, ILanguageModelToolsService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IHoverService)
], ToolSetOrToolItemAttachmentWidget);
let ChatReferenceAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, hoverService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    const title = attachment.name;
    const chatResource = attachment.value;
    this.label.setLabel(`$(${Codicon.commentDiscussion.id})\xA0${title}`, void 0);
    this.element.style.cursor = "pointer";
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment.chatReference", "Link to chat {0}", title));
    this._register(hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content: localize("chat.attachment.chatReference.hover", 'Open chat "{0}"', title)
    }, commonHoverLifecycleOptions));
    this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this._openReferencedChat(chatResource);
    }));
    this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
      const event2 = new StandardKeyboardEvent(e);
      if (event2.equals(KeyCode.Enter) || event2.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        this._openReferencedChat(chatResource);
      }
    }));
  }
  async _openReferencedChat(chatResource) {
    const link = buildOpenSessionLinkForChatResource(chatResource);
    if (!link) {
      return;
    }
    await this.openerService.open(link);
  }
};
ChatReferenceAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IHoverService)
], ChatReferenceAttachmentWidget);
let NotebookCellOutputChatAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(resource, attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, hoverService, languageModelsService, notebookService, instantiationService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.hoverService = hoverService;
    this.languageModelsService = languageModelsService;
    this.notebookService = notebookService;
    this.instantiationService = instantiationService;
    switch (attachment.mimeType) {
      case "application/vnd.code.notebook.error": {
        this.renderErrorOutput(resource, attachment);
        break;
      }
      case "image/png":
      case "image/jpeg":
      case "image/svg": {
        this.renderImageOutput(resource, attachment);
        break;
      }
      default: {
        this.renderGenericOutput(resource, attachment);
      }
    }
    this.instantiationService.invokeFunction((accessor) => {
      this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
    });
    this.addResourceOpenHandlers(resource, void 0);
  }
  getAriaLabel(attachment) {
    return localize("chat.NotebookImageAttachment", "Attached Notebook output, {0}", attachment.name);
  }
  renderErrorOutput(resource, attachment) {
    const attachmentLabel = attachment.name;
    const withIcon = attachment.icon?.id ? `$(${attachment.icon.id})\xA0${attachmentLabel}` : attachmentLabel;
    const buffer = this.getOutputItem(resource, attachment)?.data.buffer ?? new Uint8Array();
    let title = void 0;
    try {
      const error = JSON.parse(new TextDecoder().decode(buffer));
      if (error.name && error.message) {
        title = `${error.name}: ${error.message}`;
      }
    } catch {
    }
    this.label.setLabel(withIcon, void 0, { title });
    this.element.ariaLabel = this.appendDeletionHint(this.getAriaLabel(attachment));
  }
  renderGenericOutput(resource, attachment) {
    this.element.ariaLabel = this.appendDeletionHint(this.getAriaLabel(attachment));
    this.label.setFile(resource, { hidePath: true, icon: ThemeIcon.fromId("output") });
  }
  renderImageOutput(resource, attachment) {
    let ariaLabel;
    if (attachment.omittedState === OmittedState.Full) {
      ariaLabel = localize("chat.omittedNotebookImageAttachment", "Omitted this Notebook ouput: {0}", attachment.name);
    } else if (attachment.omittedState === OmittedState.Partial) {
      ariaLabel = localize("chat.partiallyOmittedNotebookImageAttachment", "Partially omitted this Notebook output: {0}", attachment.name);
    } else {
      ariaLabel = this.getAriaLabel(attachment);
    }
    const clickHandler = async () => await this.openResource(resource, { editorOptions: { preserveFocus: true } }, false, void 0);
    const currentLanguageModelName = this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name ?? this.currentLanguageModel.identifier : void 0;
    const buffer = this.getOutputItem(resource, attachment)?.data.buffer ?? new Uint8Array();
    this._register(createImageElements(resource, attachment.name, attachment.name, this.element, buffer, attachment.id, this.hoverService, ariaLabel, currentLanguageModelName, clickHandler, this.currentLanguageModel, attachment.omittedState));
    this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
  }
  getOutputItem(resource, attachment) {
    const parsedInfo = CellUri.parseCellOutputUri(resource);
    if (!parsedInfo || typeof parsedInfo.cellHandle !== "number" || typeof parsedInfo.outputIndex !== "number") {
      return void 0;
    }
    const notebook = this.notebookService.getNotebookTextModel(parsedInfo.notebook);
    if (!notebook) {
      return void 0;
    }
    const cell = notebook.cells.find((c) => c.handle === parsedInfo.cellHandle);
    if (!cell) {
      return void 0;
    }
    const output = cell.outputs.length > parsedInfo.outputIndex ? cell.outputs[parsedInfo.outputIndex] : void 0;
    return output?.outputs.find((o) => o.mime === attachment.mimeType);
  }
};
NotebookCellOutputChatAttachmentWidget = __decorateClass([
  __decorateParam(6, ICommandService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ILanguageModelsService),
  __decorateParam(11, INotebookService),
  __decorateParam(12, IInstantiationService)
], NotebookCellOutputChatAttachmentWidget);
let ElementChatAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, editorService, hoverService, fileService, logService, markdownRendererService, chatImageCarouselService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.editorService = editorService;
    this.hoverService = hoverService;
    this.fileService = fileService;
    this.logService = logService;
    this.markdownRendererService = markdownRendererService;
    this.chatImageCarouselService = chatImageCarouselService;
    const ariaLabel = localize("chat.elementAttachment", "Attached element, {0}", attachment.name);
    this.element.ariaLabel = this.appendDeletionHint(ariaLabel);
    this.element.style.position = "relative";
    this.element.style.cursor = "pointer";
    const attachmentLabel = attachment.name;
    const withIcon = attachment.icon?.id ? `$(${attachment.icon.id})\xA0${attachmentLabel}` : attachmentLabel;
    this.label.setLabel(withIcon);
    this._register(this.hoverService.setupDelayedHover(this.element, this.getHoverContent(attachment), commonHoverLifecycleOptions));
    this._register(registerOpenEditorListeners(this.element, async () => {
      await this.openElementAttachment(attachment);
    }));
  }
  getHoverContent(attachment) {
    if (!this.shouldRenderRichElementHover(attachment)) {
      return this.getSimpleHoverContent(attachment);
    }
    const hoverElement = dom.$("div.chat-attached-context-hover.chat-element-hover");
    const scrollableContent = dom.$("div.chat-element-hover-content");
    const innerScrollables = [];
    if (attachment.imageData) {
      this.appendImagePreview(attachment, scrollableContent, () => scrollableElement.scanDomNode());
    }
    {
      const section = dom.$("div.chat-element-hover-section");
      const header = dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.element", "ELEMENT"));
      section.appendChild(header);
      const elementPre = dom.$("pre.chat-element-hover-code");
      const elementCode = dom.$("code");
      const tagDisplay = this.formatElementTag(attachment);
      elementCode.textContent = tagDisplay;
      elementPre.appendChild(elementCode);
      const elementScrollable = this._register(new DomScrollableElement(elementPre, {
        horizontal: ScrollbarVisibility.Auto,
        vertical: ScrollbarVisibility.Hidden
      }));
      innerScrollables.push(elementScrollable);
      section.appendChild(elementScrollable.getDomNode());
      scrollableContent.appendChild(section);
    }
    const computedStyleEntries = this.getComputedStyleEntriesForHover(attachment.computedStyles);
    if (computedStyleEntries.length > 0) {
      const section = dom.$("div.chat-element-hover-section");
      const header = dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.computedStyles", "KEY COMPUTED STYLES"));
      section.appendChild(header);
      const table = dom.$("div.chat-element-hover-table");
      for (const [name, value] of computedStyleEntries) {
        const row = dom.$("div.chat-element-hover-row");
        row.appendChild(dom.$("span.chat-element-hover-label", {}, `${name}:`));
        const valueContainer = dom.$("span.chat-element-hover-value");
        if ((name === "color" || name === "background-color") && value) {
          const swatch = dom.$("span.chat-element-hover-color-swatch");
          swatch.style.backgroundColor = value;
          valueContainer.appendChild(swatch);
        }
        valueContainer.appendChild(document.createTextNode(value));
        row.appendChild(valueContainer);
        table.appendChild(row);
      }
      section.appendChild(table);
      const showMoreButton = dom.$("button.chat-element-hover-show-more", { type: "button" }, localize("chat.elementHover.showMore", "Show More..."));
      this._register(dom.addDisposableListener(showMoreButton, dom.EventType.CLICK, async (e) => {
        dom.EventHelper.stop(e, true);
        await this.openElementAttachment(attachment);
      }));
      section.appendChild(showMoreButton);
      scrollableContent.appendChild(section);
    }
    if (attachment.ancestors && attachment.ancestors.length > 1) {
      const section = dom.$("div.chat-element-hover-section");
      const header = dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.htmlPath", "HTML PATH"));
      section.appendChild(header);
      const lines = [];
      for (let i = 0; i < attachment.ancestors.length; i++) {
        const ancestor = attachment.ancestors[i];
        const indent = "  ".repeat(i);
        const tag = this.formatAncestorTag(ancestor);
        lines.push(`${indent}${tag}`);
      }
      const pathPre = dom.$("pre.chat-element-hover-code");
      const pathCode = dom.$("code");
      pathCode.textContent = lines.join("\n");
      pathPre.appendChild(pathCode);
      const pathScrollable = this._register(new DomScrollableElement(pathPre, {
        horizontal: ScrollbarVisibility.Auto,
        vertical: ScrollbarVisibility.Hidden
      }));
      innerScrollables.push(pathScrollable);
      section.appendChild(pathScrollable.getDomNode());
      scrollableContent.appendChild(section);
    }
    if (attachment.attributes && Object.keys(attachment.attributes).length > 0) {
      const section = dom.$("div.chat-element-hover-section");
      const header = dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.attributes", "ATTRIBUTES"));
      section.appendChild(header);
      const table = dom.$("div.chat-element-hover-table");
      for (const [name, value] of Object.entries(attachment.attributes)) {
        const row = dom.$("div.chat-element-hover-row");
        row.appendChild(dom.$("span.chat-element-hover-label", {}, `${name}:`));
        row.appendChild(dom.$("span.chat-element-hover-value", {}, value));
        table.appendChild(row);
      }
      section.appendChild(table);
      scrollableContent.appendChild(section);
    }
    if (attachment.dimensions) {
      const section = dom.$("div.chat-element-hover-section");
      const header = dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.positionSize", "POSITION & SIZE"));
      section.appendChild(header);
      const table = dom.$("div.chat-element-hover-table");
      const dims = [
        ["top:", attachment.dimensions.top],
        ["left:", attachment.dimensions.left],
        ["width:", attachment.dimensions.width],
        ["height:", attachment.dimensions.height]
      ];
      for (const [label, val] of dims) {
        const row = dom.$("div.chat-element-hover-row");
        row.appendChild(dom.$("span.chat-element-hover-label", {}, label));
        row.appendChild(dom.$("span.chat-element-hover-value", {}, `${Math.round(val)}px`));
        table.appendChild(row);
      }
      section.appendChild(table);
      scrollableContent.appendChild(section);
    }
    if (attachment.innerText) {
      const section = dom.$("div.chat-element-hover-section");
      const header = dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.innerText", "INNER TEXT"));
      section.appendChild(header);
      section.appendChild(dom.$("div.chat-element-hover-text", {}, attachment.innerText));
      scrollableContent.appendChild(section);
    }
    const scrollableElement = this._register(new DomScrollableElement(scrollableContent, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Hidden,
      consumeMouseWheelIfScrollbarIsNeeded: true
    }));
    const scrollableDomNode = scrollableElement.getDomNode();
    scrollableDomNode.classList.add("chat-element-hover-scrollable");
    hoverElement.appendChild(scrollableDomNode);
    return {
      ...commonHoverOptions,
      content: hoverElement,
      additionalClasses: ["chat-element-data-hover"],
      onDidShow: () => {
        for (const s of innerScrollables) {
          s.scanDomNode();
        }
        scrollableElement.scanDomNode();
      }
    };
  }
  shouldRenderRichElementHover(attachment) {
    if (attachment.dimensions || attachment.innerText) {
      return true;
    }
    if (attachment.ancestors && attachment.ancestors.length > 0) {
      return true;
    }
    if (attachment.attributes && Object.keys(attachment.attributes).length > 0) {
      return true;
    }
    if (attachment.computedStyles && Object.keys(attachment.computedStyles).length > 0) {
      return true;
    }
    return false;
  }
  appendImagePreview(attachment, container, onContentsChanged) {
    const section = dom.$("div.chat-element-hover-section.chat-element-hover-screenshot");
    section.appendChild(dom.$("div.chat-element-hover-header", {}, localize("chat.elementHover.screenshot", "SCREENSHOT")));
    container.appendChild(section);
    const previewDisposables = this._register(new DisposableStore());
    const appendPreview = (data) => {
      if (previewDisposables.isDisposed) {
        return;
      }
      const resource = URI.isUri(attachment.imageData) ? attachment.imageData : URI.from({ scheme: Schemas.data, path: `${attachment.id}/${encodeURIComponent(attachment.name)}` });
      const clickHandler = this.configurationService.getValue(ChatConfiguration.ImageCarouselEnabled) ? async () => this.chatImageCarouselService.openCarouselAtResource(resource, data) : void 0;
      const preview = createImageHoverContent(
        void 0,
        attachment.name,
        data,
        `${attachment.id}:screenshot`,
        onContentsChanged,
        clickHandler,
        void 0,
        localize("chat.elementHover.screenshotAlt", "Screenshot of attached element {0}", attachment.name)
      );
      previewDisposables.add(preview.disposable);
      section.appendChild(preview.element);
    };
    const inlineData = coerceImageBuffer(attachment.imageData);
    if (inlineData) {
      appendPreview(inlineData);
    } else if (URI.isUri(attachment.imageData)) {
      void this.fileService.readFile(attachment.imageData).then(
        (content) => appendPreview(content.value.buffer),
        (error) => {
          this.logService.warn(`[ElementChatAttachmentWidget] Failed to read screenshot '${attachment.imageData}': ${toErrorMessage(error)}`);
          section.remove();
          onContentsChanged();
        }
      );
    }
  }
  getSimpleHoverContent(attachment) {
    const content = attachment.value?.toString() ?? "";
    const hoverContent = new MarkdownString();
    hoverContent.appendText(attachment.fullName ?? attachment.name);
    if (content.trim().length > 0) {
      hoverContent.appendMarkdown("\n\n");
      hoverContent.appendCodeblock("text", content);
    }
    if (attachment.imageData) {
      const hoverElement = dom.$("div.chat-attached-context-hover.chat-element-hover");
      const scrollableContent = dom.$("div.chat-element-hover-content");
      this.appendImagePreview(attachment, scrollableContent, () => scrollableElement.scanDomNode());
      const markdownSection = dom.$("div.chat-element-hover-section");
      const renderedMarkdown = this._register(this.markdownRendererService.render(hoverContent));
      markdownSection.appendChild(renderedMarkdown.element);
      scrollableContent.appendChild(markdownSection);
      const scrollableElement = this._register(new DomScrollableElement(scrollableContent, {
        vertical: ScrollbarVisibility.Auto,
        horizontal: ScrollbarVisibility.Hidden,
        consumeMouseWheelIfScrollbarIsNeeded: true
      }));
      const scrollableDomNode = scrollableElement.getDomNode();
      scrollableDomNode.classList.add("chat-element-hover-scrollable");
      hoverElement.appendChild(scrollableDomNode);
      return {
        ...commonHoverOptions,
        content: hoverElement,
        additionalClasses: ["chat-element-data-hover"],
        onDidShow: () => scrollableElement.scanDomNode()
      };
    }
    return {
      ...commonHoverOptions,
      content: hoverContent
    };
  }
  getComputedStyleEntriesForHover(computedStyles) {
    if (!computedStyles) {
      return [];
    }
    const keyEntries = [];
    for (const property of KEY_ELEMENT_HOVER_COMPUTED_STYLE_PROPERTIES) {
      if (property === "margin" || property === "padding") {
        const shorthand = this.getBoxShorthandValue(computedStyles, property);
        if (typeof shorthand === "string") {
          keyEntries.push([property, shorthand]);
          continue;
        }
      }
      const value = computedStyles[property];
      if (typeof value === "string") {
        keyEntries.push([property, value]);
      }
    }
    if (keyEntries.length > 0) {
      return keyEntries;
    }
    return Object.entries(computedStyles).slice(0, KEY_ELEMENT_HOVER_COMPUTED_STYLE_PROPERTIES.length);
  }
  getBoxShorthandValue(computedStyles, propertyName) {
    const top = computedStyles[`${propertyName}-top`];
    const right = computedStyles[`${propertyName}-right`];
    const bottom = computedStyles[`${propertyName}-bottom`];
    const left = computedStyles[`${propertyName}-left`];
    if (typeof top === "string" && typeof right === "string" && typeof bottom === "string" && typeof left === "string") {
      return `${top} ${right} ${bottom} ${left}`;
    }
    return computedStyles[propertyName];
  }
  async openElementAttachment(attachment) {
    const content = attachment.value?.toString() || "";
    await this.editorService.openEditor({
      resource: void 0,
      contents: content,
      options: {
        pinned: true
      }
    });
  }
  formatElementTag(attachment) {
    const content = attachment.value?.toString() ?? "";
    const htmlMatch = content.match(/\n\n(<[^>]+>)/);
    if (htmlMatch) {
      return htmlMatch[1];
    }
    const fallback = content.match(/<([^>]+)>/);
    if (fallback) {
      return `<${fallback[1]}>`;
    }
    return `<${attachment.name}>`;
  }
  formatAncestorTag(ancestor) {
    const parts = [`<${ancestor.tagName}`];
    if (ancestor.classNames?.length) {
      parts.push(` class="${ancestor.classNames.join(" ")}"`);
    }
    if (ancestor.id) {
      parts.push(` id="${ancestor.id}"`);
    }
    return parts.join("") + ">";
  }
};
ElementChatAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IFileService),
  __decorateParam(11, ILogService),
  __decorateParam(12, IMarkdownRendererService),
  __decorateParam(13, IChatImageCarouselService)
], ElementChatAttachmentWidget);
let SCMHistoryItemAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, markdownRendererService, hoverService, openerService, configurationService, themeService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.label.setLabel(attachment.name, void 0);
    this.element.style.cursor = "pointer";
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment", "Attached context, {0}", attachment.name));
    const { content, disposables } = toHistoryItemHoverContent(markdownRendererService, attachment.historyItem, false);
    this._store.add(hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content
    }, commonHoverLifecycleOptions));
    this._store.add(disposables);
    this._store.add(dom.addDisposableListener(this.element, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this._openAttachment(attachment);
    }));
    this._store.add(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
      const event2 = new StandardKeyboardEvent(e);
      if (event2.equals(KeyCode.Enter) || event2.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        this._openAttachment(attachment);
      }
    }));
  }
  async _openAttachment(attachment) {
    await this.commandService.executeCommand("_workbench.openMultiDiffEditor", {
      title: getHistoryItemEditorTitle(attachment.historyItem),
      multiDiffSourceUri: attachment.value
    });
  }
};
SCMHistoryItemAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IMarkdownRendererService),
  __decorateParam(7, IHoverService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IThemeService)
], SCMHistoryItemAttachmentWidget);
let SCMHistoryItemChangeAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, hoverService, markdownRendererService, openerService, configurationService, themeService, editorService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.editorService = editorService;
    const nameSuffix = `\xA0$(${Codicon.gitCommit.id})${attachment.historyItem.displayId ?? attachment.historyItem.id}`;
    this.label.setFile(attachment.value, { fileKind: FileKind.FILE, hidePath: true, nameSuffix });
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment", "Attached context, {0}", attachment.name));
    const { content, disposables } = toHistoryItemHoverContent(markdownRendererService, attachment.historyItem, false);
    this._store.add(hoverService.setupDelayedHover(this.element, {
      ...commonHoverOptions,
      content
    }, commonHoverLifecycleOptions));
    this._store.add(disposables);
    this.addResourceOpenHandlers(attachment.value, void 0);
  }
  async openResource(resource, options, isDirectory, range) {
    const attachment = this.attachment;
    const historyItem = attachment.historyItem;
    await this.editorService.openEditor({
      resource,
      label: `${basename(resource.path)} (${historyItem.displayId ?? historyItem.id})`,
      options: { ...options.editorOptions }
    }, options.openToSide ? SIDE_GROUP : void 0);
  }
};
SCMHistoryItemChangeAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IMarkdownRendererService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IThemeService),
  __decorateParam(11, IEditorService)
], SCMHistoryItemChangeAttachmentWidget);
let SCMHistoryItemChangeRangeAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, configurationService, editorService) {
    super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this.editorService = editorService;
    const historyItemStartId = attachment.historyItemChangeStart.historyItem.displayId ?? attachment.historyItemChangeStart.historyItem.id;
    const historyItemEndId = attachment.historyItemChangeEnd.historyItem.displayId ?? attachment.historyItemChangeEnd.historyItem.id;
    const nameSuffix = `\xA0$(${Codicon.gitCommit.id})${historyItemStartId}..${historyItemEndId}`;
    this.label.setFile(attachment.value, { fileKind: FileKind.FILE, hidePath: true, nameSuffix });
    this.element.ariaLabel = this.appendDeletionHint(localize("chat.attachment", "Attached context, {0}", attachment.name));
    this.addResourceOpenHandlers(attachment.value, void 0);
  }
  async openResource(resource, options, isDirectory, range) {
    const attachment = this.attachment;
    const historyItemChangeStart = attachment.historyItemChangeStart;
    const historyItemChangeEnd = attachment.historyItemChangeEnd;
    const originalUriTitle = `${basename(historyItemChangeStart.uri.fsPath)} (${historyItemChangeStart.historyItem.displayId ?? historyItemChangeStart.historyItem.id})`;
    const modifiedUriTitle = `${basename(historyItemChangeEnd.uri.fsPath)} (${historyItemChangeEnd.historyItem.displayId ?? historyItemChangeEnd.historyItem.id})`;
    await this.editorService.openEditor({
      original: { resource: historyItemChangeStart.uri },
      modified: { resource: historyItemChangeEnd.uri },
      label: `${originalUriTitle} \u2194 ${modifiedUriTitle}`,
      options: { ...options.editorOptions }
    }, options.openToSide ? SIDE_GROUP : void 0);
  }
};
SCMHistoryItemChangeRangeAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IEditorService)
], SCMHistoryItemChangeRangeAttachmentWidget);
let BrowserViewAttachmentWidget = class extends AbstractChatAttachmentWidget {
  constructor(_attachment, currentLanguageModel, _options, container, contextResourceLabels, commandService, openerService, configurationService, _browserViewService, _hoverService, _editorService, _instantiationService) {
    super(_attachment, _options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, configurationService);
    this._attachment = _attachment;
    this._options = _options;
    this._browserViewService = _browserViewService;
    this._hoverService = _hoverService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._inputListeners = this._register(new DisposableStore());
    this._resolveInput();
    this._register(this._browserViewService.onDidChangeBrowserViews(() => this._resolveInput()));
    this._register(this._browserViewService.onDidChangeSharingAvailable(() => this._updateLabel()));
    this._register(this._hoverService.setupDelayedHover(this.element, () => ({
      ...commonHoverOptions,
      content: this._input ? {
        [BrowserViewSharingState.Shared]: this._input.getTitle() ?? "",
        [BrowserViewSharingState.NotShared]: localize("chat.browserViewNotShared", "This browser page is not shared with the agent."),
        [BrowserViewSharingState.Unavailable]: localize("chat.browserToolsDisabled", "Browser tools are not enabled.")
      }[this._input.model?.sharingState ?? BrowserViewSharingState.Shared] : localize("chat.browserViewClosed", "This browser page is no longer open.")
    }), commonHoverLifecycleOptions));
    this._instantiationService.invokeFunction((accessor) => {
      this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, _attachment.value));
    });
    this.addResourceOpenHandlers(_attachment.value, void 0);
  }
  /**
   * Look up the current BrowserEditorInput for this attachment's browser ID, bind listeners, and refresh the UI.
   */
  _resolveInput() {
    const input = this._browserViewService.getKnownBrowserViews().get(this._attachment.browserId);
    if (this._input === input) {
      return;
    }
    this._inputListeners.clear();
    this._input = input;
    if (input) {
      this._inputListeners.add(input.onWillDispose(() => {
        this._input = void 0;
        this._inputListeners.clear();
        this._updateLabel();
      }));
      if (this._options.supportsDeletion) {
        this._inputListeners.add(input.onDidChangeLabel(() => this._updateLabel()));
      }
      if (input.model) {
        this._inputListeners.add(input.model.onDidChangeSharingState(() => this._updateLabel()));
      } else {
        this._inputListeners.add(input.onDidResolveModel(() => {
          this._inputListeners.add(input.model.onDidChangeSharingState(() => this._updateLabel()));
          this._updateLabel();
        }));
      }
    }
    this._updateLabel();
  }
  _updateLabel() {
    const name = this._input?.getName() ?? this._attachment.name;
    const sharingState = this._input?.model?.sharingState ?? BrowserViewSharingState.Shared;
    const isAvailable = !!this._input && sharingState === BrowserViewSharingState.Shared;
    this.element.classList.toggle("warning", !isAvailable);
    this.label.setLabel(name, void 0, {
      iconPath: Codicon.globe,
      strikethrough: !isAvailable
    });
    this.element.ariaLabel = this.appendDeletionHint(
      this._input ? {
        [BrowserViewSharingState.Shared]: localize("chat.browserViewAttachment.aria", "Attached browser page, {0}", name),
        [BrowserViewSharingState.NotShared]: localize("chat.browserViewNotShared.aria", "Browser page not shared with agent, {0}", name),
        [BrowserViewSharingState.Unavailable]: localize("chat.browserToolsDisabled.aria", "Browser tools are not enabled, {0}", name)
      }[sharingState] : localize("chat.browserViewClosed.aria", "Browser page unavailable, {0}", name)
    );
  }
  async openResource(_resource, options, _isDirectory, _range) {
    if (this._input) {
      await this._editorService.openEditor(this._input, options.editorOptions, options.openToSide ? SIDE_GROUP : void 0);
    }
  }
};
BrowserViewAttachmentWidget = __decorateClass([
  __decorateParam(5, ICommandService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IBrowserViewWorkbenchService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IEditorService),
  __decorateParam(11, IInstantiationService)
], BrowserViewAttachmentWidget);
function hookUpResourceAttachmentDragAndContextMenu(accessor, widget, resource) {
  const contextKeyService = accessor.get(IContextKeyService);
  const instantiationService = accessor.get(IInstantiationService);
  const store = new DisposableStore();
  const scopedContextKeyService = store.add(contextKeyService.createScoped(widget));
  setResourceContext(accessor, scopedContextKeyService, resource);
  widget.draggable = true;
  store.add(dom.addDisposableListener(widget, "dragstart", (e) => {
    instantiationService.invokeFunction((accessor2) => fillEditorsDragData(accessor2, [resource], e));
    e.dataTransfer?.setDragImage(widget, 0, 0);
  }));
  store.add(addBasicContextMenu(accessor, widget, scopedContextKeyService, MenuId.ChatInputResourceAttachmentContext, resource));
  return store;
}
function hookUpSymbolAttachmentDragAndContextMenu(accessor, widget, parentContextKeyService, attachment, contextMenuId) {
  const instantiationService = accessor.get(IInstantiationService);
  const languageFeaturesService = accessor.get(ILanguageFeaturesService);
  const textModelService = accessor.get(ITextModelService);
  const contextMenuService = accessor.get(IContextMenuService);
  const menuService = accessor.get(IMenuService);
  const store = new DisposableStore();
  widget.draggable = true;
  store.add(dom.addDisposableListener(widget, "dragstart", (e) => {
    instantiationService.invokeFunction((accessor2) => fillEditorsDragData(accessor2, [{ resource: attachment.value.uri, selection: attachment.value.range }], e));
    fillInSymbolsDragData([{
      fsPath: attachment.value.uri.fsPath,
      range: attachment.value.range,
      name: attachment.name,
      kind: attachment.kind
    }], e);
    e.dataTransfer?.setDragImage(widget, 0, 0);
  }));
  let scopedContextKeyService;
  let providerContexts;
  const ensureContextKeyService = () => {
    if (!scopedContextKeyService) {
      scopedContextKeyService = store.add(parentContextKeyService.createScoped(widget));
      chatAttachmentResourceContextKey.bindTo(scopedContextKeyService).set(attachment.value.uri.toString());
      setResourceContext(accessor, scopedContextKeyService, attachment.value.uri);
    }
    return scopedContextKeyService;
  };
  const ensureProviderContexts = () => {
    const cks = ensureContextKeyService();
    if (!providerContexts) {
      providerContexts = [
        [EditorContextKeys.hasDefinitionProvider.bindTo(cks), languageFeaturesService.definitionProvider],
        [EditorContextKeys.hasReferenceProvider.bindTo(cks), languageFeaturesService.referenceProvider],
        [EditorContextKeys.hasImplementationProvider.bindTo(cks), languageFeaturesService.implementationProvider],
        [EditorContextKeys.hasTypeDefinitionProvider.bindTo(cks), languageFeaturesService.typeDefinitionProvider]
      ];
    }
  };
  const updateContextKeys = async () => {
    ensureProviderContexts();
    const modelRef = await textModelService.createModelReference(attachment.value.uri);
    try {
      const model = modelRef.object.textEditorModel;
      for (const [contextKey, registry] of providerContexts) {
        contextKey.set(registry.has(model));
      }
    } finally {
      modelRef.dispose();
    }
  };
  store.add(dom.addDisposableListener(widget, dom.EventType.CONTEXT_MENU, async (domEvent) => {
    const event2 = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
    dom.EventHelper.stop(domEvent, true);
    const cks = ensureContextKeyService();
    try {
      await updateContextKeys();
    } catch (e) {
      console.error(e);
    }
    contextMenuService.showContextMenu({
      contextKeyService: cks,
      getAnchor: () => event2,
      getActions: () => {
        const menu = menuService.getMenuActions(contextMenuId, cks, { arg: attachment.value });
        return getFlatContextMenuActions(menu);
      }
    });
  }));
  return store;
}
function setResourceContext(accessor, scopedContextKeyService, resource) {
  const fileService = accessor.get(IFileService);
  const languageService = accessor.get(ILanguageService);
  const modelService = accessor.get(IModelService);
  const resourceContextKey = new StaticResourceContextKey(scopedContextKeyService, fileService, languageService, modelService);
  resourceContextKey.set(resource);
}
function addBasicContextMenu(accessor, widget, scopedContextKeyService, menuId, arg, updateContextKeys) {
  const contextMenuService = accessor.get(IContextMenuService);
  const menuService = accessor.get(IMenuService);
  return dom.addDisposableListener(widget, dom.EventType.CONTEXT_MENU, async (domEvent) => {
    const event2 = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
    dom.EventHelper.stop(domEvent, true);
    try {
      await updateContextKeys?.();
    } catch (e) {
      console.error(e);
    }
    contextMenuService.showContextMenu({
      contextKeyService: scopedContextKeyService,
      getAnchor: () => event2,
      getActions: () => {
        const menu = menuService.getMenuActions(menuId, scopedContextKeyService, { arg });
        return getFlatContextMenuActions(menu);
      }
    });
  });
}
const chatAttachmentResourceContextKey = new RawContextKey("chatAttachmentResource", void 0, { type: "URI", description: localize("resource", "The full value of the chat attachment resource, including scheme and path") });
export {
  BrowserViewAttachmentWidget,
  ChatReferenceAttachmentWidget,
  DefaultChatAttachmentWidget,
  ElementChatAttachmentWidget,
  FileAttachmentWidget,
  ImageAttachmentWidget,
  NotebookCellOutputChatAttachmentWidget,
  PasteAttachmentWidget,
  PromptFileAttachmentWidget,
  PromptTextAttachmentWidget,
  SCMHistoryItemAttachmentWidget,
  SCMHistoryItemChangeAttachmentWidget,
  SCMHistoryItemChangeRangeAttachmentWidget,
  TerminalCommandAttachmentWidget,
  ToolSetOrToolItemAttachmentWidget,
  chatAttachmentResourceContextKey,
  createImageHoverContent,
  getEffectiveImageOmittedState,
  hookUpResourceAttachmentDragAndContextMenu,
  hookUpSymbolAttachmentDragAndContextMenu
};
