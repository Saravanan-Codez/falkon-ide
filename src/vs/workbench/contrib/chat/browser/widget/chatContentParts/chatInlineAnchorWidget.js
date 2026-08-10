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
import "./media/chatInlineAnchorWidget.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../../base/browser/mouseEvent.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ICodeEditorService } from "../../../../../../editor/browser/services/codeEditorService.js";
import { EditorContextKeys } from "../../../../../../editor/common/editorContextKeys.js";
import { SymbolKinds } from "../../../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { DefinitionAction } from "../../../../../../editor/contrib/gotoSymbol/browser/goToCommands.js";
import * as nls from "../../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { FileKind, IFileService } from "../../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { FolderThemeIcon, IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { fillEditorsDragData } from "../../../../../browser/dnd.js";
import { StaticResourceContextKey } from "../../../../../common/contextkeys.js";
import { IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { INotebookDocumentService } from "../../../../../services/notebook/common/notebookDocumentService.js";
import { ExplorerFolderContext } from "../../../../files/common/files.js";
import { IChatWidgetService } from "../../chat.js";
import { IChatImageCarouselService } from "../../chatImageCarouselService.js";
import { chatAttachmentResourceContextKey, hookUpSymbolAttachmentDragAndContextMenu } from "../../attachments/chatAttachmentWidgets.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { getMediaMime } from "../../../../../../base/common/mime.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { BrowserEditorInput } from "../../../../browserView/common/browserEditorInput.js";
import { getEditorOverrideForChatResource } from "../chatEditorAssociations.js";
function renderFileWidgets(element, instantiationService, chatMarkdownAnchorService, disposables, options) {
  const links = element.querySelectorAll("a");
  links.forEach((a) => {
    const linkText = a.textContent?.trim();
    let shouldRenderWidget = false;
    let metadata;
    const href = a.getAttribute("data-href");
    let uri;
    if (href) {
      try {
        uri = URI.parse(href);
      } catch {
      }
    }
    if (!linkText) {
      shouldRenderWidget = true;
    } else if (uri) {
      const searchParams = new URLSearchParams(uri.query);
      const vscodeLinkType = searchParams.get("vscodeLinkType");
      if (vscodeLinkType) {
        metadata = {
          vscodeLinkType,
          linkText
        };
        shouldRenderWidget = true;
        searchParams.delete("vscodeLinkType");
        const remainingQuery = searchParams.toString();
        uri = uri.with({ query: remainingQuery });
      }
    }
    if (shouldRenderWidget && uri?.scheme) {
      const widget = instantiationService.createInstance(InlineAnchorWidget, a, { kind: "inlineReference", inlineReference: uri }, metadata, options);
      disposables.add(chatMarkdownAnchorService.register(widget));
      disposables.add(widget);
    }
  });
}
let InlineAnchorWidget = class extends Disposable {
  constructor(element, inlineReference, metadata, options, chatImageCarouselService, configurationService, originalContextKeyService, contextMenuService, fileService, hoverService, instantiationService, labelService, languageService, menuService, modelService, telemetryService, themeService, notebookDocumentService, openerService, editorService) {
    super();
    this.element = element;
    this.inlineReference = inlineReference;
    this.metadata = metadata;
    this.options = options;
    this.chatImageCarouselService = chatImageCarouselService;
    this.configurationService = configurationService;
    this.notebookDocumentService = notebookDocumentService;
    this.openerService = openerService;
    this.editorService = editorService;
    this.data = "uri" in inlineReference.inlineReference ? inlineReference.inlineReference : "name" in inlineReference.inlineReference ? { kind: "symbol", symbol: inlineReference.inlineReference } : { uri: inlineReference.inlineReference };
    element.classList.add(InlineAnchorWidget.className, "show-file-icons");
    let iconText;
    let iconClasses;
    let location;
    if (this.data.kind === "symbol") {
      const symbol = this.data.symbol;
      location = this.data.symbol.location;
      iconText = [this.data.symbol.name];
      iconClasses = ["codicon", ...getIconClasses(modelService, languageService, void 0, void 0, SymbolKinds.toIcon(symbol.kind))];
      this._store.add(instantiationService.invokeFunction((accessor) => hookUpSymbolAttachmentDragAndContextMenu(accessor, element, originalContextKeyService, { value: symbol.location, name: symbol.name, kind: symbol.kind }, MenuId.ChatInlineSymbolAnchorContext)));
    } else {
      location = this.data;
      const filePathLabel = this.metadata?.linkText ?? labelService.getUriBasenameLabel(location.uri);
      let defaultIcon;
      if (location.range && this.data.kind !== "symbol") {
        const suffix = location.range.startLineNumber === location.range.endLineNumber ? `:${location.range.startLineNumber}` : `:${location.range.startLineNumber}-${location.range.endLineNumber}`;
        iconText = [filePathLabel, dom.$("span.label-suffix", void 0, suffix)];
      } else if (location.uri.scheme === "vscode-notebook-cell" && this.data.kind !== "symbol") {
        iconText = [`${filePathLabel} \u2022 cell${this.getCellIndex(location.uri)}`];
      } else if (location.uri.scheme === Schemas.vscodeBrowser) {
        defaultIcon = Codicon.globe;
        const editorName = this.editorService.findEditors(location.uri)[0]?.editor?.getName() ?? BrowserEditorInput.DEFAULT_LABEL;
        iconText = [editorName];
      } else {
        iconText = [filePathLabel];
      }
      let fileKind = location.uri.path.endsWith("/") ? FileKind.FOLDER : FileKind.FILE;
      const recomputeIconClasses = () => getIconClasses(modelService, languageService, location.uri, fileKind, fileKind === FileKind.FOLDER && !themeService.getFileIconTheme().hasFolderIcons ? FolderThemeIcon : defaultIcon);
      iconClasses = recomputeIconClasses();
      const refreshIconClasses = () => {
        iconEl.classList.remove(...iconClasses);
        iconClasses = recomputeIconClasses();
        iconEl.classList.add(...iconClasses);
      };
      let isDirectory = false;
      fileService.stat(location.uri).then((stat) => {
        isDirectory = stat.isDirectory;
        if (stat.isDirectory) {
          fileKind = FileKind.FOLDER;
          refreshIconClasses();
        }
      }).catch(() => {
      });
      let contextKeyService;
      let isFolderContext;
      let contextMenuInitialized = false;
      const ensureContextKeyService = () => {
        if (!contextKeyService) {
          contextKeyService = this._register(originalContextKeyService.createScoped(element));
          chatAttachmentResourceContextKey.bindTo(contextKeyService).set(location.uri.toString());
          isFolderContext = ExplorerFolderContext.bindTo(contextKeyService);
        }
        return contextKeyService;
      };
      this._register(dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, async (domEvent) => {
        const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
        dom.EventHelper.stop(domEvent, true);
        const cks = ensureContextKeyService();
        if (!contextMenuInitialized) {
          contextMenuInitialized = true;
          const resourceContextKey = new StaticResourceContextKey(cks, fileService, languageService, modelService);
          resourceContextKey.set(location.uri);
        }
        isFolderContext.set(isDirectory);
        if (this._store.isDisposed) {
          return;
        }
        contextMenuService.showContextMenu({
          contextKeyService: cks,
          getAnchor: () => event,
          getActions: () => {
            const menu = menuService.getMenuActions(MenuId.ChatInlineResourceAnchorContext, cks, { arg: location.uri });
            return getFlatContextMenuActions(menu);
          }
        });
      }));
      if (location.range) {
        if (location.range.startLineNumber === location.range.endLineNumber) {
          element.setAttribute("aria-label", nls.localize("chat.inlineAnchor.ariaLabel.line", "{0} line {1}", filePathLabel, location.range.startLineNumber));
        } else {
          element.setAttribute("aria-label", nls.localize("chat.inlineAnchor.ariaLabel.range", "{0} lines {1} to {2}", filePathLabel, location.range.startLineNumber, location.range.endLineNumber));
        }
      }
    }
    const iconEl = dom.$("span.icon");
    iconEl.classList.add(...iconClasses);
    element.replaceChildren(iconEl, dom.$("span.icon-label", {}, ...iconText));
    const fragment = location.range ? `${location.range.startLineNumber},${location.range.startColumn}` : "";
    element.setAttribute("data-href", (fragment ? location.uri.with({ fragment }) : location.uri).toString());
    const relativeLabel = labelService.getUriLabel(location.uri, { relative: true });
    this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("element"), element, relativeLabel));
    if (this.data.kind !== "symbol") {
      element.draggable = true;
      this._register(dom.addDisposableListener(element, "dragstart", (e) => {
        const stat = {
          resource: location.uri,
          selection: location.range
        };
        instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, [stat], e));
        e.dataTransfer?.setDragImage(element, 0, 0);
      }));
    }
    this._register(dom.addDisposableListener(element, "click", async (e) => {
      dom.EventHelper.stop(e, true);
      const editorOverride = getEditorOverrideForChatResource(location.uri, this.configurationService);
      const editorOptions = {
        override: editorOverride,
        selection: location.range
      };
      const open = async () => {
        if (this.options?.openResource && await this.options.openResource(location.uri, editorOptions)) {
          return;
        }
        const mimeType = getMediaMime(location.uri.path);
        if (mimeType?.startsWith("image/") && this.configurationService.getValue(ChatConfiguration.ImageCarouselEnabled)) {
          await this.chatImageCarouselService.openCarouselAtResource(location.uri);
          return;
        }
        await this.openerService.open(location.uri, {
          fromUserGesture: true,
          editorOptions
        });
      };
      if (this.options?.trackOpen) {
        await this.options.trackOpen(open);
      } else {
        await open();
      }
    }));
  }
  static {
    this.className = "chat-inline-anchor-widget";
  }
  getHTMLElement() {
    return this.element;
  }
  getCellIndex(location) {
    const notebook = this.notebookDocumentService.getNotebook(location);
    const index = notebook?.getCellIndex(location) ?? -1;
    return index >= 0 ? ` ${index + 1}` : "";
  }
};
InlineAnchorWidget = __decorateClass([
  __decorateParam(4, IChatImageCarouselService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, ILabelService),
  __decorateParam(12, ILanguageService),
  __decorateParam(13, IMenuService),
  __decorateParam(14, IModelService),
  __decorateParam(15, ITelemetryService),
  __decorateParam(16, IThemeService),
  __decorateParam(17, INotebookDocumentService),
  __decorateParam(18, IOpenerService),
  __decorateParam(19, IEditorService)
], InlineAnchorWidget);
registerAction2(class AddFileToChatAction extends Action2 {
  static {
    this.id = "chat.inlineResourceAnchor.addFileToChat";
  }
  constructor() {
    super({
      id: AddFileToChatAction.id,
      title: nls.localize2("actions.attach.label", "Add File to Chat"),
      menu: [{
        id: MenuId.ChatInlineResourceAnchorContext,
        group: "chat",
        order: 1,
        when: ExplorerFolderContext.negate()
      }]
    });
  }
  async run(accessor, resource) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const widget = chatWidgetService.lastFocusedWidget;
    if (widget) {
      widget.attachmentModel.addFile(resource);
    }
  }
});
registerAction2(class CopyResourceAction extends Action2 {
  static {
    this.id = "chat.inlineResourceAnchor.copyResource";
  }
  constructor() {
    super({
      id: CopyResourceAction.id,
      title: nls.localize2("actions.copy.label", "Copy"),
      f1: false,
      precondition: chatAttachmentResourceContextKey,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyC
      }
    });
  }
  async run(accessor) {
    const chatWidgetService = accessor.get(IChatMarkdownAnchorService);
    const clipboardService = accessor.get(IClipboardService);
    const anchor = chatWidgetService.lastFocusedAnchor;
    if (!anchor) {
      return;
    }
    const resource = anchor.data.kind === "symbol" ? anchor.data.symbol.location.uri : anchor.data.uri;
    clipboardService.writeResources([resource]);
  }
});
registerAction2(class OpenToSideResourceAction extends Action2 {
  static {
    this.id = "chat.inlineResourceAnchor.openToSide";
  }
  constructor() {
    super({
      id: OpenToSideResourceAction.id,
      title: nls.localize2("actions.openToSide.label", "Open to the Side"),
      f1: false,
      precondition: chatAttachmentResourceContextKey,
      keybinding: {
        weight: KeybindingWeight.ExternalExtension + 2,
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        mac: {
          primary: KeyMod.WinCtrl | KeyCode.Enter
        }
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "navigation",
        order: 1
      }))
    });
  }
  async run(accessor, arg) {
    const editorService = accessor.get(IEditorService);
    const configurationService = accessor.get(IConfigurationService);
    const target = this.getTarget(accessor, arg);
    if (!target) {
      return;
    }
    const targetUri = URI.isUri(target) ? target : target.uri;
    const editorOverride = getEditorOverrideForChatResource(targetUri, configurationService);
    const input = URI.isUri(target) ? { resource: target, options: { override: editorOverride } } : {
      resource: target.uri,
      options: {
        override: editorOverride,
        selection: {
          startColumn: target.range.startColumn,
          startLineNumber: target.range.startLineNumber
        }
      }
    };
    await editorService.openEditors([input], SIDE_GROUP);
  }
  getTarget(accessor, arg) {
    const chatWidgetService = accessor.get(IChatMarkdownAnchorService);
    if (arg) {
      return arg;
    }
    const anchor = chatWidgetService.lastFocusedAnchor;
    if (!anchor) {
      return void 0;
    }
    return anchor.data.kind === "symbol" ? anchor.data.symbol.location : anchor.data.uri;
  }
});
registerAction2(class GoToDefinitionAction extends Action2 {
  static {
    this.id = "chat.inlineSymbolAnchor.goToDefinition";
  }
  constructor() {
    super({
      id: GoToDefinitionAction.id,
      title: {
        ...nls.localize2("actions.goToDecl.label", "Go to Definition"),
        mnemonicTitle: nls.localize({ key: "miGotoDefinition", comment: ["&& denotes a mnemonic"] }, "Go to &&Definition")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.1,
        when: EditorContextKeys.hasDefinitionProvider
      }))
    });
  }
  async run(accessor, location) {
    const editorService = accessor.get(ICodeEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    await openEditorWithSelection(editorService, location);
    const action = new DefinitionAction({ openToSide: false, openInPeek: false, muteMessage: true }, { title: { value: "", original: "" }, id: "", precondition: void 0 });
    return instantiationService.invokeFunction((accessor2) => action.run(accessor2));
  }
});
async function openEditorWithSelection(editorService, location) {
  await editorService.openCodeEditor({
    resource: location.uri,
    options: {
      selection: {
        startColumn: location.range.startColumn,
        startLineNumber: location.range.startLineNumber
      }
    }
  }, null);
}
async function runGoToCommand(accessor, command, location) {
  const editorService = accessor.get(ICodeEditorService);
  const commandService = accessor.get(ICommandService);
  await openEditorWithSelection(editorService, location);
  return commandService.executeCommand(command);
}
registerAction2(class GoToTypeDefinitionsAction extends Action2 {
  static {
    this.id = "chat.inlineSymbolAnchor.goToTypeDefinitions";
  }
  constructor() {
    super({
      id: GoToTypeDefinitionsAction.id,
      title: {
        ...nls.localize2("goToTypeDefinitions.label", "Go to Type Definitions"),
        mnemonicTitle: nls.localize({ key: "miGotoTypeDefinition", comment: ["&& denotes a mnemonic"] }, "Go to &&Type Definitions")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.1,
        when: EditorContextKeys.hasTypeDefinitionProvider
      }))
    });
  }
  async run(accessor, location) {
    await runGoToCommand(accessor, "editor.action.goToTypeDefinition", location);
  }
});
registerAction2(class GoToImplementations extends Action2 {
  static {
    this.id = "chat.inlineSymbolAnchor.goToImplementations";
  }
  constructor() {
    super({
      id: GoToImplementations.id,
      title: {
        ...nls.localize2("goToImplementations.label", "Go to Implementations"),
        mnemonicTitle: nls.localize({ key: "miGotoImplementations", comment: ["&& denotes a mnemonic"] }, "Go to &&Implementations")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.2,
        when: EditorContextKeys.hasImplementationProvider
      }))
    });
  }
  async run(accessor, location) {
    await runGoToCommand(accessor, "editor.action.goToImplementation", location);
  }
});
registerAction2(class GoToReferencesAction extends Action2 {
  static {
    this.id = "chat.inlineSymbolAnchor.goToReferences";
  }
  constructor() {
    super({
      id: GoToReferencesAction.id,
      title: {
        ...nls.localize2("goToReferences.label", "Go to References"),
        mnemonicTitle: nls.localize({ key: "miGotoReference", comment: ["&& denotes a mnemonic"] }, "Go to &&References")
      },
      menu: [MenuId.ChatInlineSymbolAnchorContext, MenuId.ChatInputSymbolAttachmentContext].map((id) => ({
        id,
        group: "4_symbol_nav",
        order: 1.3,
        when: EditorContextKeys.hasReferenceProvider
      }))
    });
  }
  async run(accessor, location) {
    await runGoToCommand(accessor, "editor.action.goToReferences", location);
  }
});
export {
  InlineAnchorWidget,
  renderFileWidgets
};
