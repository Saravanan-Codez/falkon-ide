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
import { $ } from "../../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../../base/browser/ui/actionbar/actionbar.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Iterable } from "../../../../../../base/common/iterator.js";
import { combinedDisposable, Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { FileKind } from "../../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchList } from "../../../../../../platform/list/browser/listService.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { ResourceLabels } from "../../../../../browser/labels.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { createFileIconThemableTreeContainerScope } from "../../../../files/browser/views/explorerView.js";
import { MultiDiffEditorInput } from "../../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { MultiDiffEditorItem } from "../../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { ChatEditingSnapshotTextModelContentProvider } from "../../chatEditing/chatEditingTextModelContentProviders.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IChatResponseFileChangesService } from "../../chatResponseFileChangesService.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import { ResourcePool } from "./chatCollections.js";
const CHANGES_SUMMARY_ELEMENT_HEIGHT = 22;
const CHANGES_SUMMARY_MAX_ITEMS_SHOWN = 6;
function renderChangesSummaryFileList(container, diffs, instantiationService, editorService, configurationService, options) {
  const store = new DisposableStore();
  const columnWidths = { insertions: 2, deletions: 2 };
  const list = store.add(instantiationService.createInstance(CollapsibleChangesSummaryListPool, options, columnWidths)).get();
  const listNode = list.getHTMLElement();
  container.appendChild(listNode.parentElement);
  store.add(list.onDidOpen((item) => {
    const diff = item.element;
    if (!diff) {
      return;
    }
    const altKey = (dom.isMouseEvent(item.browserEvent) || dom.isKeyboardEvent(item.browserEvent)) && item.browserEvent.altKey;
    const openInDiffEditorByDefault = configurationService.getValue(ChatConfiguration.OpenChangedFileInDiffEditor);
    const openInDiffEditor = altKey ? !openInDiffEditorByDefault : openInDiffEditorByDefault;
    if (!openInDiffEditor) {
      const fileURI = ChatEditingSnapshotTextModelContentProvider.getOriginalFileURI(diff.modifiedURI);
      if (fileURI) {
        editorService.openEditor({ resource: fileURI, options: { preserveFocus: true } });
        return;
      }
    }
    editorService.openEditor({
      original: { resource: diff.originalURI },
      modified: { resource: diff.modifiedURI },
      options: { preserveFocus: true }
    });
  }));
  store.add(list.onContextMenu((e) => {
    dom.EventHelper.stop(e.browserEvent, true);
  }));
  store.add(autorun((r) => {
    const currentDiffs = diffs.read(r);
    let insertionsColumnCharacters = 2;
    let deletionsColumnCharacters = 2;
    for (const diff of currentDiffs) {
      if (!diff.identical && !diff.isBusy) {
        insertionsColumnCharacters = Math.max(insertionsColumnCharacters, String(diff.added).length + 1);
        deletionsColumnCharacters = Math.max(deletionsColumnCharacters, String(diff.removed).length + 1);
      }
    }
    columnWidths.insertions = insertionsColumnCharacters;
    columnWidths.deletions = deletionsColumnCharacters;
    const itemsShown = Math.min(currentDiffs.length, CHANGES_SUMMARY_MAX_ITEMS_SHOWN);
    const height = itemsShown * CHANGES_SUMMARY_ELEMENT_HEIGHT;
    list.layout(height);
    listNode.style.height = height + "px";
    list.splice(0, list.length, currentDiffs);
  }));
  return store;
}
let ChatCheckpointFileChangesSummaryContentPart = class extends Disposable {
  constructor(content, context, hoverService, chatService, editorService, configurationService, instantiationService, chatResponseFileChangesService) {
    super();
    this.content = content;
    this.hoverService = hoverService;
    this.chatService = chatService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.chatResponseFileChangesService = chatResponseFileChangesService;
    this.diffsBetweenRequests = /* @__PURE__ */ new Map();
    this.fileChangesDiffsObservable = this.computeFileChangesDiffs(content);
    this.domNode = $(".checkpoint-file-changes-summary.checkpoint-file-changes-compact");
    this.detailsElement = document.createElement("details");
    this.detailsElement.classList.add("checkpoint-file-changes-disclosure");
    this.domNode.appendChild(this.detailsElement);
    const headerDomNode = this.detailsElement.appendChild(document.createElement("summary"));
    headerDomNode.classList.add("checkpoint-file-changes-summary-header");
    this._register(autorun((r) => {
      const hasChanges = this.fileChangesDiffsObservable.read(r).length > 0;
      this.domNode.style.display = hasChanges ? "" : "none";
    }));
    this._register(this.renderHeader(headerDomNode));
    this._register(this.renderFilesList(this.detailsElement));
    this._register(dom.addDisposableListener(headerDomNode, "click", () => {
      this.domNode.dispatchEvent(new CustomEvent(ChatCollapsibleContentPart.userToggleEvent, { bubbles: true }));
    }));
  }
  computeFileChangesDiffs({ requestId, sessionResource }) {
    const fromProvider = this.chatResponseFileChangesService.getChangesForRequest(sessionResource, requestId);
    if (fromProvider) {
      return fromProvider;
    }
    return this.chatService.chatModels.map((models) => Iterable.find(models, (m) => isEqual(m.sessionResource, sessionResource))).map((model) => model?.editingSession?.getDiffsForFilesInRequest(requestId)).map((diffs, r) => diffs?.read(r) || Iterable.empty());
  }
  getCachedEntryDiffBetweenRequests(editSession, uri, startRequestId, stopRequestId) {
    const key = `${uri}\0${startRequestId}\0${stopRequestId}`;
    let observable = this.diffsBetweenRequests.get(key);
    if (!observable) {
      observable = editSession.getEntryDiffBetweenRequests(uri, startRequestId, stopRequestId);
      this.diffsBetweenRequests.set(key, observable);
    }
    return observable;
  }
  renderHeader(container) {
    const filesLabel = container.appendChild($("span.chat-file-changes-label"));
    const counts = container.appendChild($("span.chat-file-changes-counts", { "aria-hidden": "true" }));
    const addedLabel = counts.appendChild($("span.insertions"));
    const removedLabel = counts.appendChild($("span.deletions"));
    const disposables = new DisposableStore();
    disposables.add(this.renderViewAllFileChangesButton(container));
    const chevron = container.appendChild($("span.chat-file-changes-chevron.chat-collapsible-hover-chevron", { "aria-hidden": "true" }));
    chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
    this._register(autorun((r) => {
      const diffs = this.fileChangesDiffsObservable.read(r);
      const fileCountLabel = diffs.length === 1 ? localize("chat.fileChanges.oneFile", "1 file changed") : localize("chat.fileChanges.manyFiles", "{0} files changed", diffs.length);
      const additions = diffs.reduce((total, diff) => total + diff.added, 0);
      const deletions = diffs.reduce((total, diff) => total + diff.removed, 0);
      filesLabel.textContent = fileCountLabel;
      addedLabel.textContent = `+${additions}`;
      removedLabel.textContent = `-${deletions}`;
      container.setAttribute("aria-label", localize(
        "chat.fileChanges.accessibleSummary",
        "{0}, {1} lines added, {2} lines deleted",
        fileCountLabel,
        additions,
        deletions
      ));
    }));
    const setExpansionState = () => {
      container.setAttribute("aria-expanded", String(this.detailsElement.open));
      chevron.classList.toggle("expanded", this.detailsElement.open);
    };
    setExpansionState();
    disposables.add(dom.addDisposableListener(this.detailsElement, "toggle", setExpansionState));
    return toDisposable(() => disposables.dispose());
  }
  renderViewAllFileChangesButton(container) {
    const button = container.appendChild(document.createElement("button"));
    button.classList.add("chat-view-changes-icon");
    button.type = "button";
    const hoverDisposable = this.hoverService.setupDelayedHover(button, () => ({
      content: localize2("chat.viewFileChangesSummary", "View All File Changes")
    }));
    button.classList.add(...ThemeIcon.asClassNameArray(Codicon.diffMultiple));
    button.setAttribute("aria-label", localize("chat.viewFileChangesSummary", "View All File Changes"));
    return combinedDisposable(hoverDisposable, dom.addDisposableListener(button, "click", (e) => {
      const resources = this.fileChangesDiffsObservable.get().map((diff) => ({
        originalUri: diff.originalURI,
        modifiedUri: diff.modifiedURI
      }));
      const source = URI.parse(`multi-diff-editor:${(/* @__PURE__ */ new Date()).getMilliseconds().toString() + Math.random().toString()}`);
      const input = this.instantiationService.createInstance(
        MultiDiffEditorInput,
        source,
        localize("chat.checkpointFileChanges", "Checkpoint File Changes"),
        resources.map((resource) => {
          return new MultiDiffEditorItem(
            resource.originalUri,
            resource.modifiedUri,
            void 0
          );
        }),
        false
      );
      this.editorService.openEditor(input);
      dom.EventHelper.stop(e, true);
    }));
  }
  renderFilesList(container) {
    return renderChangesSummaryFileList(container, this.fileChangesDiffsObservable, this.instantiationService, this.editorService, this.configurationService);
  }
  hasSameContent(other, followingContent, element) {
    return other.kind === "changesSummary" && other.requestId === this.content.requestId;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatCheckpointFileChangesSummaryContentPart = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IChatResponseFileChangesService)
], ChatCheckpointFileChangesSummaryContentPart);
let CollapsibleChangesSummaryListPool = class extends Disposable {
  constructor(options, columnWidths, instantiationService, themeService) {
    super();
    this.options = options;
    this.columnWidths = columnWidths;
    this.instantiationService = instantiationService;
    this.themeService = themeService;
    this._resourcePool = this._register(new ResourcePool(() => this.listFactory()));
  }
  listFactory() {
    const container = $(".chat-summary-list");
    const store = new DisposableStore();
    store.add(createFileIconThemableTreeContainerScope(container, this.themeService));
    const resourceLabels = store.add(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: () => Disposable.None }));
    const list = store.add(this.instantiationService.createInstance(
      WorkbenchList,
      "ChatListRenderer",
      container,
      new CollapsibleChangesSummaryListDelegate(),
      [new CollapsibleChangesSummaryListRenderer(resourceLabels, this.options, this.columnWidths)],
      {
        alwaysConsumeMouseWheel: false
      }
    ));
    return {
      list,
      dispose: () => {
        store.dispose();
      }
    };
  }
  get() {
    return this._resourcePool.get().list;
  }
};
CollapsibleChangesSummaryListPool = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService)
], CollapsibleChangesSummaryListPool);
class CollapsibleChangesSummaryListDelegate {
  getHeight(element) {
    return CHANGES_SUMMARY_ELEMENT_HEIGHT;
  }
  getTemplateId(element) {
    return CollapsibleChangesSummaryListRenderer.TEMPLATE_ID;
  }
}
class CollapsibleChangesSummaryListRenderer {
  constructor(labels, options, columnWidths) {
    this.labels = labels;
    this.options = options;
    this.columnWidths = columnWidths;
    this.templateId = CollapsibleChangesSummaryListRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "collapsibleChangesSummaryListRenderer";
  }
  static {
    this.CHANGES_SUMMARY_CLASS_NAME = "insertions-and-deletions";
  }
  renderTemplate(container) {
    const label = this.labels.create(container, { supportHighlights: true, supportIcons: true });
    let actionBar;
    if (this.options?.getRowActions) {
      container.classList.add("chat-summary-list-row-with-actions");
      const actionsContainer = container.appendChild($(".chat-summary-list-actions"));
      actionBar = new ActionBar(actionsContainer);
    }
    return {
      label,
      actionBar,
      changesContainer: actionBar ? container : label.element,
      dispose: () => {
        label.dispose();
        actionBar?.dispose();
      }
    };
  }
  renderElement(data, index, templateData) {
    const label = templateData.label;
    label.setFile(data.modifiedURI, {
      fileKind: FileKind.FILE,
      title: data.modifiedURI.path
    });
    templateData.changesElement?.remove();
    if (!data.identical && !data.isBusy) {
      const changesSummary = templateData.changesContainer.appendChild($(`.${CollapsibleChangesSummaryListRenderer.CHANGES_SUMMARY_CLASS_NAME}`));
      const added = changesSummary.appendChild($(`.insertions`));
      added.textContent = `+${data.added}`;
      added.style.width = `${this.columnWidths.insertions}ch`;
      const removed = changesSummary.appendChild($(`.deletions`));
      removed.textContent = `-${data.removed}`;
      removed.style.width = `${this.columnWidths.deletions}ch`;
      templateData.changesElement = changesSummary;
    }
    if (templateData.actionBar && this.options?.getRowActions) {
      templateData.actionBar.clear();
      templateData.actionBar.push(this.options.getRowActions(data), { icon: false, label: true });
    }
  }
  disposeTemplate(templateData) {
    templateData.dispose();
  }
}
export {
  ChatCheckpointFileChangesSummaryContentPart,
  renderChangesSummaryFileList
};
