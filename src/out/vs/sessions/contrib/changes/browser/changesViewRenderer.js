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
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { basename, dirname, extUriBiasedIgnorePathCase, relativePath } from "../../../../base/common/resources.js";
import { ResourceTree } from "../../../../base/common/resourceTree.js";
import { URI } from "../../../../base/common/uri.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { ModifiedFileEntryState } from "../../../../workbench/contrib/chat/common/editing/chatEditingService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { GITHUB_REMOTE_FILE_SCHEME } from "../../../services/sessions/common/session.js";
import { ActiveSessionContextKeys, ChangesContextKeys, ChangesViewMode } from "../common/changes.js";
import { IChangesViewService } from "../common/changesViewService.js";
const $ = dom.$;
function toIChangesFileItem(changes) {
  return changes.map((change) => {
    const isAddition = change.originalUri === void 0;
    const isDeletion = change.modifiedUri === void 0;
    const uri = isIChatSessionFileChange2(change) ? change.uri : change.modifiedUri;
    return {
      type: "file",
      uri,
      originalUri: change.originalUri,
      isDeletion,
      state: ModifiedFileEntryState.Accepted,
      changeType: isAddition ? "added" : isDeletion ? "deleted" : "modified",
      linesAdded: change.insertions,
      linesRemoved: change.deletions
    };
  });
}
function isChangesFileItem(element) {
  return !ResourceTree.isResourceNode(element) && element.type === "file";
}
function isChangesRootItem(element) {
  return !ResourceTree.isResourceNode(element) && element.type === "root";
}
function buildTreeChildren(items, treeRootInfo) {
  if (items.length === 0) {
    return [];
  }
  let rootUri = treeRootInfo?.resourceTreeRootUri ?? URI.file("/");
  if (!treeRootInfo && items[0].uri.scheme === GITHUB_REMOTE_FILE_SCHEME) {
    const parts = items[0].uri.path.split("/").filter(Boolean);
    if (parts.length >= 3) {
      rootUri = items[0].uri.with({ path: "/" + parts.slice(0, 3).join("/") });
    }
  }
  const resourceTree = new ResourceTree(void 0, rootUri, extUriBiasedIgnorePathCase);
  for (const item of items) {
    resourceTree.add(item.uri, item);
  }
  function convertChildren(parent) {
    const result = [];
    for (const child of parent.children) {
      if (child.element && child.childrenCount === 0) {
        result.push({
          element: child.element,
          collapsible: false,
          incompressible: true
        });
      } else {
        result.push({
          element: child,
          children: convertChildren(child),
          incompressible: parent === resourceTree.root,
          collapsible: true,
          collapsed: false
        });
      }
    }
    return result;
  }
  const children = convertChildren(resourceTree.root);
  if (!treeRootInfo) {
    return children;
  }
  return [{
    element: treeRootInfo.root,
    children,
    collapsible: true,
    collapsed: false,
    incompressible: true
  }];
}
let ChangesTreeRenderer = class {
  constructor(labels, actionRunner, getRootUri, instantiationService, changesViewService, contextKeyService, labelService, sessionsService) {
    this.labels = labels;
    this.actionRunner = actionRunner;
    this.getRootUri = getRootUri;
    this.instantiationService = instantiationService;
    this.changesViewService = changesViewService;
    this.contextKeyService = contextKeyService;
    this.labelService = labelService;
    this.sessionsService = sessionsService;
    this.templateId = ChangesTreeRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "changesTreeRenderer";
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const label = templateDisposables.add(this.labels.create(container, { supportHighlights: true, supportIcons: true }));
    const reviewCommentsBadge = dom.$(".changes-review-comments-badge");
    label.element.appendChild(reviewCommentsBadge);
    const agentFeedbackBadge = dom.$(".changes-agent-feedback-badge");
    label.element.appendChild(agentFeedbackBadge);
    const lineCountsContainer = $(".working-set-line-counts");
    const addedSpan = dom.$(".working-set-lines-added");
    const removedSpan = dom.$(".working-set-lines-removed");
    lineCountsContainer.appendChild(addedSpan);
    lineCountsContainer.appendChild(removedSpan);
    label.element.appendChild(lineCountsContainer);
    const actionBarContainer = $(".chat-collapsible-list-action-bar");
    const contextKeyService = templateDisposables.add(this.contextKeyService.createScoped(actionBarContainer));
    const scopedInstantiationService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const toolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.AgentsChangeInlineToolbar, {
      menuOptions: { shouldForwardArgs: true, arg: void 0 },
      actionRunner: this.actionRunner
    }));
    label.element.appendChild(actionBarContainer);
    templateDisposables.add(bindContextKey(ChatContextKeys.agentSessionType, contextKeyService, (reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      return activeSession?.sessionType ?? "";
    }));
    templateDisposables.add(bindContextKey(ActiveSessionContextKeys.HasGitRepository, contextKeyService, (reader) => {
      return this.changesViewService.activeSessionHasGitRepositoryObs.read(reader);
    }));
    templateDisposables.add(bindContextKey(ChangesContextKeys.VersionMode, contextKeyService, (reader) => {
      return this.changesViewService.activeSessionChangesetObs.read(reader)?.id ?? "";
    }));
    const changeKindContextKey = ChangesContextKeys.ChangeKind.bindTo(contextKeyService);
    const decorationBadge = dom.$(".changes-decoration-badge");
    label.element.appendChild(decorationBadge);
    return { label, toolbar, changeKindContextKey, reviewCommentsBadge, agentFeedbackBadge, decorationBadge, addedSpan, removedSpan, lineCountsContainer, elementDisposables: new DisposableStore(), templateDisposables };
  }
  renderElement(node, _index, templateData) {
    const element = node.element;
    templateData.label.element.style.display = "flex";
    if (isChangesRootItem(element)) {
      this.renderRootElement(element, templateData);
    } else if (ResourceTree.isResourceNode(element)) {
      this.renderFolderElement(element, templateData);
    } else {
      this.renderFileElement(element, templateData);
    }
  }
  renderCompressedElements(node, _index, templateData) {
    const compressed = node.element;
    const folder = compressed.elements[compressed.elements.length - 1];
    templateData.label.element.style.display = "flex";
    const label = compressed.elements.map((e) => e.name);
    templateData.label.setResource({ resource: folder.uri, name: label }, {
      fileKind: FileKind.FOLDER,
      separator: this.labelService.getSeparator(folder.uri.scheme)
    });
    templateData.reviewCommentsBadge.style.display = "none";
    templateData.agentFeedbackBadge.style.display = "none";
    templateData.decorationBadge.style.display = "none";
    templateData.lineCountsContainer.style.display = "none";
    if (templateData.toolbar) {
      templateData.toolbar.context = folder;
    }
    templateData.changeKindContextKey.set("folder");
  }
  renderFileElement(data, templateData) {
    const root = this.getRootUri();
    const viewMode = this.changesViewService.viewModeObs.get();
    templateData.label.setResource({
      resource: data.uri,
      name: basename(data.uri),
      description: viewMode === ChangesViewMode.List ? root ? relativePath(root, dirname(data.uri)) : void 0 : void 0
    }, {
      fileKind: FileKind.FILE,
      fileDecorations: void 0,
      strikethrough: data.changeType === "deleted"
    });
    const showChangeDecorations = data.changeType !== "none";
    templateData.lineCountsContainer.style.display = showChangeDecorations ? "" : "none";
    templateData.decorationBadge.style.display = showChangeDecorations ? "" : "none";
    templateData.elementDisposables.add(autorun((reader) => {
      const reviewCommentByFile = this.changesViewService.activeSessionReviewCommentCountByFileObs.read(reader);
      const reviewCommentCount = reviewCommentByFile?.get(data.uri.fsPath) ?? 0;
      if (reviewCommentCount > 0) {
        templateData.reviewCommentsBadge.style.display = "";
        templateData.reviewCommentsBadge.className = "changes-review-comments-badge";
        templateData.reviewCommentsBadge.replaceChildren(
          dom.$(".codicon.codicon-comment-unresolved"),
          dom.$("span", void 0, `${reviewCommentCount}`)
        );
      } else {
        templateData.reviewCommentsBadge.style.display = "none";
        templateData.reviewCommentsBadge.replaceChildren();
      }
    }));
    templateData.elementDisposables.add(autorun((reader) => {
      const agentFeedbackByFile = this.changesViewService.activeSessionAgentFeedbackCountByFileObs.read(reader);
      const agentFeedbackCount = agentFeedbackByFile?.get(data.uri.fsPath) ?? 0;
      if (agentFeedbackCount > 0) {
        templateData.agentFeedbackBadge.style.display = "";
        templateData.agentFeedbackBadge.className = "changes-agent-feedback-badge";
        templateData.agentFeedbackBadge.replaceChildren(
          dom.$(".codicon.codicon-comment"),
          dom.$("span", void 0, `${agentFeedbackCount}`)
        );
      } else {
        templateData.agentFeedbackBadge.style.display = "none";
        templateData.agentFeedbackBadge.replaceChildren();
      }
    }));
    const badge = templateData.decorationBadge;
    badge.className = "changes-decoration-badge";
    if (showChangeDecorations) {
      switch (data.changeType) {
        case "added":
          badge.textContent = "A";
          badge.classList.add("added");
          break;
        case "deleted":
          badge.textContent = "D";
          badge.classList.add("deleted");
          break;
        case "modified":
        default:
          badge.textContent = "M";
          badge.classList.add("modified");
          break;
      }
      templateData.addedSpan.textContent = `+${data.linesAdded}`;
      templateData.removedSpan.textContent = `-${data.linesRemoved}`;
      templateData.label.element.querySelector(".monaco-icon-name-container")?.classList.add("modified");
    } else {
      badge.textContent = "";
      templateData.label.element.querySelector(".monaco-icon-name-container")?.classList.remove("modified");
    }
    templateData.toolbar.context = data;
    templateData.changeKindContextKey.set("file");
  }
  renderRootElement(data, templateData) {
    templateData.label.setResource({
      resource: data.uri,
      name: data.name
    }, {
      fileKind: FileKind.ROOT_FOLDER,
      separator: this.labelService.getSeparator(data.uri.scheme, data.uri.authority)
    });
    templateData.reviewCommentsBadge.style.display = "none";
    templateData.agentFeedbackBadge.style.display = "none";
    templateData.decorationBadge.style.display = "none";
    templateData.lineCountsContainer.style.display = "none";
    templateData.toolbar.context = data.uri;
    templateData.changeKindContextKey.set("root");
  }
  renderFolderElement(node, templateData) {
    templateData.label.setFile(node.uri, {
      fileKind: FileKind.FOLDER,
      hidePath: true
    });
    templateData.reviewCommentsBadge.style.display = "none";
    templateData.agentFeedbackBadge.style.display = "none";
    templateData.decorationBadge.style.display = "none";
    templateData.lineCountsContainer.style.display = "none";
    templateData.toolbar.context = node;
    templateData.changeKindContextKey.set("folder");
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(_element, _index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.templateDisposables.dispose();
  }
};
ChangesTreeRenderer = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IChangesViewService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, ISessionsService)
], ChangesTreeRenderer);
export {
  ChangesTreeRenderer,
  buildTreeChildren,
  isChangesFileItem,
  isChangesRootItem,
  toIChangesFileItem
};
