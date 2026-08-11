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
import "./media/panel.css";
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { basename } from "../../../../base/common/resources.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { CommentNode, ResourceWithCommentThreads } from "../common/commentModel.js";
import { ICommentService } from "./commentService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { CommentsList, COMMENTS_VIEW_TITLE, Filter } from "./commentsTreeViewer.js";
import { FilterViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { CommentsViewFilterFocusContextKey } from "./comments.js";
import { CommentsFilters, CommentsSortOrder } from "./commentsViewActions.js";
import { Memento } from "../../../common/memento.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { FilterOptions } from "./commentsFilterOptions.js";
import { CommentThreadApplicability, CommentThreadState } from "../../../../editor/common/languages.js";
import { revealCommentThread } from "./commentsController.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { CommentsModel, threadHasMeaningfulComments } from "./commentsModel.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibleViewAction } from "../../accessibility/browser/accessibleViewActions.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
const CONTEXT_KEY_HAS_COMMENTS = new RawContextKey("commentsView.hasComments", false);
const CONTEXT_KEY_SOME_COMMENTS_EXPANDED = new RawContextKey("commentsView.someCommentsExpanded", false);
const CONTEXT_KEY_COMMENT_FOCUSED = new RawContextKey("commentsView.commentFocused", false);
const VIEW_STORAGE_ID = "commentsViewState";
function createResourceCommentsIterator(model) {
  const result = [];
  for (const m of model.resourceCommentThreads) {
    const children = [];
    for (const r of m.commentThreads) {
      if (threadHasMeaningfulComments(r.thread)) {
        children.push({ element: r });
      }
    }
    if (children.length > 0) {
      result.push({ element: m, children });
    }
  }
  return result;
}
let CommentsPanel = class extends FilterViewPane {
  constructor(options, instantiationService, viewDescriptorService, editorService, configurationService, contextKeyService, contextMenuService, keybindingService, openerService, themeService, commentService, hoverService, uriIdentityService, storageService, pathService) {
    const stateMemento = new Memento(VIEW_STORAGE_ID, storageService);
    const viewState = stateMemento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    super({
      ...options,
      filterOptions: {
        placeholder: nls.localize("comments.filter.placeholder", "Filter (e.g. text, author)"),
        ariaLabel: nls.localize("comments.filter.ariaLabel", "Filter comments"),
        history: viewState.filterHistory || [],
        text: viewState.filter || "",
        focusContextKey: CommentsViewFilterFocusContextKey.key
      }
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.editorService = editorService;
    this.commentService = commentService;
    this.uriIdentityService = uriIdentityService;
    this.pathService = pathService;
    this.totalComments = 0;
    this.currentHeight = 0;
    this.currentWidth = 0;
    this.cachedFilterStats = void 0;
    this.onDidChangeVisibility = this.onDidChangeBodyVisibility;
    this.hasCommentsContextKey = CONTEXT_KEY_HAS_COMMENTS.bindTo(contextKeyService);
    this.someCommentsExpandedContextKey = CONTEXT_KEY_SOME_COMMENTS_EXPANDED.bindTo(contextKeyService);
    this.commentsFocusedContextKey = CONTEXT_KEY_COMMENT_FOCUSED.bindTo(contextKeyService);
    this.stateMemento = stateMemento;
    this.viewState = viewState;
    this.filters = this._register(new CommentsFilters({
      showResolved: this.viewState.showResolved !== false,
      showUnresolved: this.viewState.showUnresolved !== false,
      sortBy: this.viewState.sortBy ?? CommentsSortOrder.ResourceAscending
    }, this.contextKeyService));
    this.filter = new Filter(new FilterOptions(this.filterWidget.getFilterText(), this.filters.showResolved, this.filters.showUnresolved));
    this._register(this.filters.onDidChange((event) => {
      if (event.showResolved || event.showUnresolved) {
        this.updateFilter();
      }
      if (event.sortBy) {
        this.refresh();
      }
    }));
    this._register(this.filterWidget.onDidChangeFilterText(() => this.updateFilter()));
  }
  get focusedCommentNode() {
    const focused = this.tree?.getFocus();
    if (focused?.length === 1 && focused[0] instanceof CommentNode) {
      return focused[0];
    }
    return void 0;
  }
  get focusedCommentInfo() {
    if (!this.focusedCommentNode) {
      return;
    }
    return this.getScreenReaderInfoForNode(this.focusedCommentNode);
  }
  focusNextNode() {
    if (!this.tree) {
      return;
    }
    const focused = this.tree.getFocus()?.[0];
    if (!focused) {
      return;
    }
    let next = this.tree.navigate(focused).next();
    while (next && !(next instanceof CommentNode)) {
      next = this.tree.navigate(next).next();
    }
    if (!next) {
      return;
    }
    this.tree.setFocus([next]);
  }
  focusPreviousNode() {
    if (!this.tree) {
      return;
    }
    const focused = this.tree.getFocus()?.[0];
    if (!focused) {
      return;
    }
    let previous = this.tree.navigate(focused).previous();
    while (previous && !(previous instanceof CommentNode)) {
      previous = this.tree.navigate(previous).previous();
    }
    if (!previous) {
      return;
    }
    this.tree.setFocus([previous]);
  }
  saveState() {
    this.viewState.filter = this.filterWidget.getFilterText();
    this.viewState.filterHistory = this.filterWidget.getHistory();
    this.viewState.showResolved = this.filters.showResolved;
    this.viewState.showUnresolved = this.filters.showUnresolved;
    this.viewState.sortBy = this.filters.sortBy;
    this.stateMemento.saveMemento();
    super.saveState();
  }
  render() {
    super.render();
    this._register(registerNavigableContainer({
      name: "commentsView",
      focusNotifiers: [this, this.filterWidget],
      focusNextWidget: () => {
        if (this.filterWidget.hasFocus()) {
          this.focus();
        }
      },
      focusPreviousWidget: () => {
        if (!this.filterWidget.hasFocus()) {
          this.focusFilter();
        }
      }
    }));
  }
  focusFilter() {
    this.filterWidget.focus();
  }
  clearFilterText() {
    this.filterWidget.setFilterText("");
  }
  getFilterStats() {
    if (!this.cachedFilterStats) {
      this.cachedFilterStats = {
        total: this.totalComments,
        filtered: this.tree?.getVisibleItemCount() ?? 0
      };
    }
    return this.cachedFilterStats;
  }
  updateFilter() {
    this.filter.options = new FilterOptions(this.filterWidget.getFilterText(), this.filters.showResolved, this.filters.showUnresolved);
    this.tree?.filterComments();
    this.cachedFilterStats = void 0;
    const { total, filtered } = this.getFilterStats();
    this.filterWidget.updateBadge(total === filtered || total === 0 ? void 0 : nls.localize("showing filtered results", "Showing {0} of {1}", filtered, total));
    this.filterWidget.checkMoreFilters(!this.filters.showResolved || !this.filters.showUnresolved);
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("comments-panel");
    const domContainer = dom.append(container, dom.$(".comments-panel-container"));
    this.treeContainer = dom.append(domContainer, dom.$(".tree-container"));
    this.treeContainer.classList.add("file-icon-themable-tree", "show-file-icons");
    this.cachedFilterStats = void 0;
    this.createTree();
    this.createMessageBox(domContainer);
    this._register(this.commentService.onDidSetAllCommentThreads(this.onAllCommentsChanged, this));
    this._register(this.commentService.onDidUpdateCommentThreads(this.onCommentsUpdated, this));
    this._register(this.commentService.onDidDeleteDataProvider(this.onDataProviderDeleted, this));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible) {
        this.refresh();
      }
    }));
    this.renderComments();
  }
  focus() {
    super.focus();
    const element = this.tree?.getHTMLElement();
    if (element && dom.isActiveElement(element)) {
      return;
    }
    if (!this.commentService.commentsModel.hasCommentThreads() && this.messageBoxContainer) {
      this.messageBoxContainer.focus();
    } else if (this.tree) {
      this.tree.domFocus();
    }
  }
  renderComments() {
    this.treeContainer.classList.toggle("hidden", !this.commentService.commentsModel.hasCommentThreads());
    this.renderMessage();
    this.tree?.setChildren(null, createResourceCommentsIterator(this.commentService.commentsModel));
  }
  collapseAll() {
    if (this.tree) {
      this.tree.collapseAll();
      this.tree.setSelection([]);
      this.tree.setFocus([]);
      this.tree.domFocus();
      this.tree.focusFirst();
    }
  }
  expandAll() {
    if (this.tree) {
      this.tree.expandAll();
      this.tree.setSelection([]);
      this.tree.setFocus([]);
      this.tree.domFocus();
      this.tree.focusFirst();
    }
  }
  get hasRendered() {
    return !!this.tree;
  }
  layoutBodyContent(height = this.currentHeight, width = this.currentWidth) {
    if (this.messageBoxContainer) {
      this.messageBoxContainer.style.height = `${height}px`;
    }
    this.tree?.layout(height, width);
    this.currentHeight = height;
    this.currentWidth = width;
  }
  createMessageBox(parent) {
    this.messageBoxContainer = dom.append(parent, dom.$(".message-box-container"));
    this.messageBoxContainer.setAttribute("tabIndex", "0");
  }
  renderMessage() {
    this.messageBoxContainer.textContent = this.commentService.commentsModel.getMessage();
    this.messageBoxContainer.classList.toggle("hidden", this.commentService.commentsModel.hasCommentThreads());
  }
  makeCommentLocationLabel(file, range) {
    const fileLabel = basename(file);
    if (!range) {
      return nls.localize("fileCommentLabel", "in {0}", fileLabel);
    }
    if (range.startLineNumber === range.endLineNumber) {
      return nls.localize("oneLineCommentLabel", "at line {0} column {1} in {2}", range.startLineNumber, range.startColumn, fileLabel);
    } else {
      return nls.localize("multiLineCommentLabel", "from line {0} to line {1} in {2}", range.startLineNumber, range.endLineNumber, fileLabel);
    }
  }
  makeScreenReaderLabelInfo(element, forAriaLabel) {
    const userName = element.comment.userName;
    const locationLabel = this.makeCommentLocationLabel(element.resource, element.range);
    const replyCountLabel = this.getReplyCountAsString(element, forAriaLabel);
    const bodyLabel = typeof element.comment.body === "string" ? element.comment.body : element.comment.body.value;
    return { userName, locationLabel, replyCountLabel, bodyLabel };
  }
  getScreenReaderInfoForNode(element, forAriaLabel) {
    let accessibleViewHint = "";
    if (forAriaLabel && this.configurationService.getValue(AccessibilityVerbositySettingId.Comments)) {
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibleViewAction.id)?.getAriaLabel();
      accessibleViewHint = kbLabel ? nls.localize("accessibleViewHint", "\nInspect this in the accessible view ({0}).", kbLabel) : nls.localize("acessibleViewHintNoKbOpen", "\nInspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.");
    }
    const replies = this.getRepliesAsString(element, forAriaLabel);
    const editor = this.editorService.findEditors(element.resource);
    const codeEditor = this.editorService.activeEditorPane?.getControl();
    let relevantLines;
    if (element.range && editor?.length && isCodeEditor(codeEditor)) {
      relevantLines = codeEditor.getModel()?.getValueInRange(element.range);
      if (relevantLines) {
        relevantLines = "\nCorresponding code: \n" + relevantLines;
      }
    }
    if (!relevantLines) {
      relevantLines = "";
    }
    const labelInfo = this.makeScreenReaderLabelInfo(element, forAriaLabel);
    if (element.threadRelevance === CommentThreadApplicability.Outdated) {
      return nls.localize(
        "resourceWithCommentLabelOutdated",
        "Outdated from {0}: {1}\n{2}\n{3}\n{4}",
        labelInfo.userName,
        labelInfo.bodyLabel,
        labelInfo.locationLabel,
        labelInfo.replyCountLabel,
        relevantLines
      ) + replies + accessibleViewHint;
    } else {
      return nls.localize(
        "resourceWithCommentLabel",
        "{0}: {1}\n{2}\n{3}\n{4}",
        labelInfo.userName,
        labelInfo.bodyLabel,
        labelInfo.locationLabel,
        labelInfo.replyCountLabel,
        relevantLines
      ) + replies + accessibleViewHint;
    }
  }
  getRepliesAsString(node, forAriaLabel) {
    if (!node.replies.length || forAriaLabel) {
      return "";
    }
    return "\n" + node.replies.map(
      (reply) => nls.localize(
        "resourceWithRepliesLabel",
        "{0} {1}",
        reply.comment.userName,
        typeof reply.comment.body === "string" ? reply.comment.body : reply.comment.body.value
      )
    ).join("\n");
  }
  getReplyCountAsString(node, forAriaLabel) {
    return node.replies.length && !forAriaLabel ? nls.localize("replyCount", " {0} replies,", node.replies.length) : "";
  }
  createTree() {
    this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
    this.tree = this._register(this.instantiationService.createInstance(CommentsList, this.treeLabels, this.treeContainer, {
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      selectionNavigation: true,
      filter: this.filter,
      sorter: {
        compare: (a, b) => {
          if (a instanceof CommentsModel || b instanceof CommentsModel) {
            return 0;
          }
          if (this.filters.sortBy === CommentsSortOrder.UpdatedAtDescending) {
            return a.lastUpdatedAt > b.lastUpdatedAt ? -1 : 1;
          } else if (this.filters.sortBy === CommentsSortOrder.ResourceAscending) {
            if (a instanceof ResourceWithCommentThreads && b instanceof ResourceWithCommentThreads) {
              const workspaceScheme = this.pathService.defaultUriScheme;
              if (a.resource.scheme !== b.resource.scheme && (a.resource.scheme === workspaceScheme || b.resource.scheme === workspaceScheme)) {
                return b.resource.scheme === workspaceScheme ? 1 : -1;
              }
              return a.resource.toString() > b.resource.toString() ? 1 : -1;
            } else if (a instanceof CommentNode && b instanceof CommentNode && a.thread.range && b.thread.range) {
              return a.thread.range?.startLineNumber > b.thread.range?.startLineNumber ? 1 : -1;
            }
          }
          return 0;
        }
      },
      keyboardNavigationLabelProvider: {
        getKeyboardNavigationLabel: (item) => {
          return void 0;
        }
      },
      accessibilityProvider: {
        getAriaLabel: (element) => {
          if (element instanceof CommentsModel) {
            return nls.localize("rootCommentsLabel", "Comments for current workspace");
          }
          if (element instanceof ResourceWithCommentThreads) {
            return nls.localize("resourceWithCommentThreadsLabel", "Comments in {0}, full path {1}", basename(element.resource), element.resource.fsPath);
          }
          if (element instanceof CommentNode) {
            return this.getScreenReaderInfoForNode(element, true);
          }
          return "";
        },
        getWidgetAriaLabel() {
          return COMMENTS_VIEW_TITLE.value;
        }
      }
    }));
    this._register(this.tree.onDidOpen((e) => {
      this.openFile(e.element, e.editorOptions.pinned, e.editorOptions.preserveFocus, e.sideBySide);
    }));
    this._register(this.tree.onDidChangeModel(() => {
      this.updateSomeCommentsExpanded();
    }));
    this._register(this.tree.onDidChangeCollapseState(() => {
      this.updateSomeCommentsExpanded();
    }));
    this._register(this.tree.onDidFocus(() => this.commentsFocusedContextKey.set(true)));
    this._register(this.tree.onDidBlur(() => this.commentsFocusedContextKey.set(false)));
  }
  openFile(element, pinned, preserveFocus, sideBySide) {
    if (!element) {
      return;
    }
    if (!(element instanceof ResourceWithCommentThreads || element instanceof CommentNode)) {
      return;
    }
    const threadToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].thread : element.thread;
    const commentToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].comment : void 0;
    return revealCommentThread(this.commentService, this.editorService, this.uriIdentityService, threadToReveal, commentToReveal, false, pinned, preserveFocus, sideBySide);
  }
  async refresh() {
    if (!this.tree) {
      return;
    }
    if (this.isVisible()) {
      this.hasCommentsContextKey.set(this.commentService.commentsModel.hasCommentThreads());
      this.cachedFilterStats = void 0;
      this.renderComments();
      if (this.tree.getSelection().length === 0 && this.commentService.commentsModel.hasCommentThreads()) {
        const firstComment = this.commentService.commentsModel.resourceCommentThreads[0].commentThreads[0];
        if (firstComment && this.tree.hasElement(firstComment)) {
          this.tree.setFocus([firstComment]);
          this.tree.setSelection([firstComment]);
        }
      }
    }
  }
  onAllCommentsChanged(e) {
    this.cachedFilterStats = void 0;
    this.totalComments += e.commentThreads.length;
    let unresolved = 0;
    for (const thread of e.commentThreads) {
      if (thread.state === CommentThreadState.Unresolved) {
        unresolved++;
      }
    }
    this.refresh();
  }
  onCommentsUpdated(e) {
    this.cachedFilterStats = void 0;
    this.totalComments += e.added.length;
    this.totalComments -= e.removed.length;
    let unresolved = 0;
    for (const resource of this.commentService.commentsModel.resourceCommentThreads) {
      for (const thread of resource.commentThreads) {
        if (thread.threadState === CommentThreadState.Unresolved) {
          unresolved++;
        }
      }
    }
    this.refresh();
  }
  onDataProviderDeleted(owner) {
    this.cachedFilterStats = void 0;
    this.totalComments = 0;
    this.refresh();
  }
  updateSomeCommentsExpanded() {
    this.someCommentsExpandedContextKey.set(this.isSomeCommentsExpanded());
  }
  areAllCommentsExpanded() {
    if (!this.tree) {
      return false;
    }
    const navigator = this.tree.navigate();
    while (navigator.next()) {
      if (this.tree.isCollapsed(navigator.current())) {
        return false;
      }
    }
    return true;
  }
  isSomeCommentsExpanded() {
    if (!this.tree) {
      return false;
    }
    const navigator = this.tree.navigate();
    while (navigator.next()) {
      if (!this.tree.isCollapsed(navigator.current())) {
        return true;
      }
    }
    return false;
  }
};
CommentsPanel = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, ICommentService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IUriIdentityService),
  __decorateParam(13, IStorageService),
  __decorateParam(14, IPathService)
], CommentsPanel);
export {
  CONTEXT_KEY_COMMENT_FOCUSED,
  CONTEXT_KEY_HAS_COMMENTS,
  CONTEXT_KEY_SOME_COMMENTS_EXPANDED,
  CommentsPanel
};
