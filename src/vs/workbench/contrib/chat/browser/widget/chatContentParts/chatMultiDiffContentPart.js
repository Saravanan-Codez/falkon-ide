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
import { ButtonWithIcon } from "../../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Event } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../../../base/common/marshallingIds.js";
import { autorun, constObservable, isObservable } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { FileKind } from "../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { WorkbenchList } from "../../../../../../platform/list/browser/listService.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { createFileIconThemableTreeContainerScope } from "../../../../files/browser/views/explorerView.js";
import { MultiDiffEditorInput } from "../../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { MultiDiffEditorItem } from "../../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { ChatEditingSnapshotTextModelContentProvider } from "../../chatEditing/chatEditingTextModelContentProviders.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { getChatSessionType } from "../../../common/model/chatUri.js";
const $ = dom.$;
const ELEMENT_HEIGHT = 22;
const MAX_ITEMS_SHOWN = 6;
let ChatMultiDiffContentPart = class extends Disposable {
  constructor(content, _element, instantiationService, editorService, themeService, contextKeyService, configurationService) {
    super();
    this.content = content;
    this._element = _element;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.themeService = themeService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.isCollapsed = false;
    this.readOnly = content.readOnly ?? false;
    this.diffData = isObservable(this.content.multiDiffData) ? this.content.multiDiffData.map((d) => d) : constObservable(this.content.multiDiffData);
    const headerDomNode = $(".checkpoint-file-changes-summary-header");
    this.domNode = $(".checkpoint-file-changes-summary", void 0, headerDomNode);
    this.domNode.tabIndex = 0;
    this.isCollapsed = content?.collapsed ?? false;
    this._register(this.renderHeader(headerDomNode));
    this._register(this.renderFilesList(this.domNode));
  }
  renderHeader(container) {
    const viewListButtonContainer = container.appendChild($(".chat-file-changes-label"));
    const viewListButton = new ButtonWithIcon(viewListButtonContainer, {});
    this._register(autorun((reader) => {
      const fileCount = this.diffData.read(reader).resources.length;
      viewListButton.label = fileCount === 1 ? localize("chatMultiDiff.oneFile", "Changed 1 file") : localize("chatMultiDiff.manyFiles", "Changed {0} files", fileCount);
    }));
    const setExpansionState = () => {
      viewListButton.icon = this.isCollapsed ? Codicon.chevronRight : Codicon.chevronDown;
      this.domNode.classList.toggle("chat-file-changes-collapsed", this.isCollapsed);
    };
    setExpansionState();
    const disposables = new DisposableStore();
    disposables.add(viewListButton);
    disposables.add(viewListButton.onDidClick(() => {
      this.isCollapsed = !this.isCollapsed;
      setExpansionState();
    }));
    if (!this.readOnly) {
      disposables.add(this.renderViewAllFileChangesButton(viewListButton.element));
    }
    disposables.add(this.renderContributedButtons(viewListButton.element));
    return toDisposable(() => disposables.dispose());
  }
  renderViewAllFileChangesButton(container) {
    const button = container.appendChild($(".chat-view-changes-icon"));
    button.classList.add(...ThemeIcon.asClassNameArray(Codicon.diffMultiple));
    button.title = localize("chatMultiDiff.openAllChanges", "Open Changes");
    return dom.addDisposableListener(button, "click", (e) => {
      const source = URI.parse(`multi-diff-editor:${(/* @__PURE__ */ new Date()).getMilliseconds().toString() + Math.random().toString()}`);
      const { title, resources } = this.diffData.get();
      const input = this.instantiationService.createInstance(
        MultiDiffEditorInput,
        source,
        title || "Multi-Diff",
        resources.map((resource) => new MultiDiffEditorItem(
          resource.originalUri,
          resource.modifiedUri,
          resource.goToFileUri
        )),
        false
      );
      const sideBySide = e.altKey;
      this.editorService.openEditor(input, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
      dom.EventHelper.stop(e, true);
    });
  }
  renderContributedButtons(container) {
    const buttonsContainer = container.appendChild($(".chat-multidiff-contributed-buttons"));
    const disposables = new DisposableStore();
    const type = getChatSessionType(this._element.sessionResource);
    const overlay = this.contextKeyService.createOverlay([
      [ChatContextKeys.agentSessionType.key, type]
    ]);
    const nestedInsta = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, overlay])));
    const marshalledUri = {
      ...this._element.sessionResource,
      $mid: MarshalledId.Uri
    };
    disposables.add(nestedInsta.createInstance(
      MenuWorkbenchToolBar,
      buttonsContainer,
      MenuId.ChatMultiDiffContext,
      {
        menuOptions: {
          arg: marshalledUri,
          shouldForwardArgs: true
        },
        toolbarOptions: {
          primaryGroup: () => true
        }
      }
    ));
    return disposables;
  }
  renderFilesList(container) {
    const store = new DisposableStore();
    const listContainer = container.appendChild($(".chat-summary-list"));
    store.add(createFileIconThemableTreeContainerScope(listContainer, this.themeService));
    const resourceLabels = store.add(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
    this.list = store.add(this.instantiationService.createInstance(
      WorkbenchList,
      "ChatMultiDiffList",
      listContainer,
      new ChatMultiDiffListDelegate(),
      [this.instantiationService.createInstance(ChatMultiDiffListRenderer, resourceLabels)],
      {
        identityProvider: {
          getId: (element) => element.uri.toString()
        },
        setRowLineHeight: true,
        horizontalScrolling: false,
        supportDynamicHeights: false,
        mouseSupport: !this.readOnly,
        alwaysConsumeMouseWheel: false,
        accessibilityProvider: {
          getAriaLabel: (element) => element.uri.path,
          getWidgetAriaLabel: () => localize("chatMultiDiffList", "File Changes")
        }
      }
    ));
    this._register(autorun((reader) => {
      const { resources } = this.diffData.read(reader);
      const items = [];
      for (const resource of resources) {
        const uri = resource.modifiedUri || resource.originalUri || resource.goToFileUri;
        if (!uri) {
          continue;
        }
        const item = { uri };
        if (resource.originalUri && resource.modifiedUri) {
          item.diff = {
            originalURI: resource.originalUri,
            modifiedURI: resource.modifiedUri,
            isFinal: true,
            quitEarly: false,
            identical: false,
            added: resource.added || 0,
            removed: resource.removed || 0,
            isBusy: false
          };
        }
        items.push(item);
      }
      this.list.splice(0, this.list.length, items);
      const height = Math.min(items.length, MAX_ITEMS_SHOWN) * ELEMENT_HEIGHT;
      this.list.layout(height);
      listContainer.style.height = `${height}px`;
    }));
    if (!this.readOnly) {
      store.add(this.list.onDidOpen((e) => {
        if (!e.element) {
          return;
        }
        const altKey = (dom.isMouseEvent(e.browserEvent) || dom.isKeyboardEvent(e.browserEvent)) && e.browserEvent.altKey;
        const openInDiffEditorByDefault = this.configurationService.getValue(ChatConfiguration.OpenChangedFileInDiffEditor);
        const openInDiffEditor = altKey ? !openInDiffEditorByDefault : openInDiffEditorByDefault;
        if (e.element.diff && !openInDiffEditor) {
          const fileURI = ChatEditingSnapshotTextModelContentProvider.getOriginalFileURI(e.element.diff.modifiedURI);
          if (fileURI) {
            this.editorService.openEditor({ resource: fileURI, options: { preserveFocus: true } });
            return;
          }
        }
        if (e.element.diff) {
          this.editorService.openEditor({
            original: { resource: e.element.diff.originalURI },
            modified: { resource: e.element.diff.modifiedURI },
            options: { preserveFocus: true }
          });
        } else {
          const fileURI = ChatEditingSnapshotTextModelContentProvider.getOriginalFileURI(e.element.uri) ?? e.element.uri;
          this.editorService.openEditor({
            resource: fileURI,
            options: { preserveFocus: true }
          });
        }
      }));
    }
    return store;
  }
  hasSameContent(other) {
    return other.kind === "multiDiffData" && this.diffData.get().resources.length === (isObservable(other.multiDiffData) ? other.multiDiffData.get().resources.length : other.multiDiffData.resources.length);
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatMultiDiffContentPart = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IConfigurationService)
], ChatMultiDiffContentPart);
class ChatMultiDiffListDelegate {
  getHeight() {
    return 22;
  }
  getTemplateId() {
    return "chatMultiDiffItem";
  }
}
class ChatMultiDiffListRenderer {
  constructor(labels) {
    this.labels = labels;
    this.templateId = ChatMultiDiffListRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "chatMultiDiffItem";
  }
  static {
    this.CHANGES_SUMMARY_CLASS_NAME = "insertions-and-deletions";
  }
  renderTemplate(container) {
    const label = this.labels.create(container, { supportHighlights: true, supportIcons: true });
    return {
      label,
      dispose: () => label.dispose()
    };
  }
  renderElement(element, _index, templateData) {
    templateData.label.setFile(element.uri, {
      fileKind: FileKind.FILE,
      title: element.uri.path
    });
    const labelElement = templateData.label.element;
    templateData.changesElement?.remove();
    if (element.diff?.added || element.diff?.removed) {
      const changesSummary = labelElement.appendChild($(`.${ChatMultiDiffListRenderer.CHANGES_SUMMARY_CLASS_NAME}`));
      const addedElement = changesSummary.appendChild($(".insertions"));
      addedElement.textContent = `+${element.diff.added}`;
      const removedElement = changesSummary.appendChild($(".deletions"));
      removedElement.textContent = `-${element.diff.removed}`;
      changesSummary.setAttribute("aria-label", localize("chatEditingSession.fileCounts", "{0} lines added, {1} lines removed", element.diff.added, element.diff.removed));
      templateData.changesElement = changesSummary;
    }
  }
  disposeTemplate(templateData) {
    templateData.dispose();
  }
}
export {
  ChatMultiDiffContentPart
};
