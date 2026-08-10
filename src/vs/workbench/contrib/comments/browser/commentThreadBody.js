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
import * as nls from "../../../../nls.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as languages from "../../../../editor/common/languages.js";
import { Emitter } from "../../../../base/common/event.js";
import { ICommentService } from "./commentService.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { CommentNode } from "./commentNode.js";
let CommentThreadBody = class extends Disposable {
  constructor(_parentEditor, owner, parentResourceUri, container, _markdownRendererOptions, _commentThread, _pendingEdits, _scopedInstatiationService, _parentCommentThreadWidget, commentService) {
    super();
    this._parentEditor = _parentEditor;
    this.owner = owner;
    this.parentResourceUri = parentResourceUri;
    this.container = container;
    this._markdownRendererOptions = _markdownRendererOptions;
    this._commentThread = _commentThread;
    this._pendingEdits = _pendingEdits;
    this._scopedInstatiationService = _scopedInstatiationService;
    this._parentCommentThreadWidget = _parentCommentThreadWidget;
    this.commentService = commentService;
    this._commentElements = [];
    this._resizeObserver = null;
    this._focusedComment = void 0;
    this._onDidResize = this._register(new Emitter());
    this.onDidResize = this._onDidResize.event;
    this._commentDisposable = new DisposableMap();
    this._containerClientArea = void 0;
    this._register(dom.addDisposableListener(container, dom.EventType.FOCUS_IN, (e) => {
      this.commentService.setActiveEditingCommentThread(this._commentThread);
    }));
  }
  get length() {
    return this._commentThread.comments ? this._commentThread.comments.length : 0;
  }
  get activeComment() {
    return this._commentElements.filter((node) => node.isEditing)[0];
  }
  focus(commentUniqueId) {
    if (commentUniqueId !== void 0) {
      const comment = this._commentElements.find((commentNode) => commentNode.comment.uniqueIdInThread === commentUniqueId);
      if (comment) {
        comment.focus();
        return;
      }
    }
    this._commentsElement.focus();
  }
  hasCommentsInEditMode() {
    return this._commentElements.some((commentNode) => commentNode.isEditing);
  }
  ensureFocusIntoNewEditingComment() {
    if (this._commentElements.length === 1 && this._commentElements[0].isEditing) {
      this._commentElements[0].setFocus(true);
    }
  }
  async display() {
    this._commentsElement = dom.append(this.container, dom.$("div.comments-container"));
    this._commentsElement.setAttribute("role", "presentation");
    this._commentsElement.tabIndex = 0;
    this._updateAriaLabel();
    this._register(dom.addDisposableListener(this._commentsElement, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if ((event.equals(KeyCode.UpArrow) || event.equals(KeyCode.DownArrow)) && (!this._focusedComment || !this._commentElements[this._focusedComment].isEditing)) {
        const moveFocusWithinBounds = (change) => {
          if (this._focusedComment === void 0 && change >= 0) {
            return 0;
          }
          if (this._focusedComment === void 0 && change < 0) {
            return this._commentElements.length - 1;
          }
          const newIndex = this._focusedComment + change;
          return Math.min(Math.max(0, newIndex), this._commentElements.length - 1);
        };
        this._setFocusedComment(event.equals(KeyCode.UpArrow) ? moveFocusWithinBounds(-1) : moveFocusWithinBounds(1));
      }
    }));
    this._commentDisposable.clearAndDisposeAll();
    this._commentElements = [];
    if (this._commentThread.comments) {
      for (const comment of this._commentThread.comments) {
        const newCommentNode = this.createNewCommentNode(comment);
        this._commentElements.push(newCommentNode);
        this._commentsElement.appendChild(newCommentNode.domNode);
        if (comment.mode === languages.CommentMode.Editing) {
          await newCommentNode.switchToEditMode();
        }
      }
    }
    this._resizeObserver = new MutationObserver(this._refresh.bind(this));
    this._resizeObserver.observe(this.container, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  }
  _refresh() {
    const dimensions = dom.getClientArea(this.container);
    if (dimensions.height === 0 && dimensions.width === 0 || dom.Dimension.equals(this._containerClientArea, dimensions)) {
      return;
    }
    this._containerClientArea = dimensions;
    this._onDidResize.fire(dimensions);
  }
  getDimensions() {
    return dom.getClientArea(this.container);
  }
  layout(widthInPixel) {
    this._commentElements.forEach((element) => {
      element.layout(widthInPixel);
    });
  }
  getPendingEdits() {
    const pendingEdits = {};
    this._commentElements.forEach((element) => {
      if (element.isEditing) {
        const pendingEdit = element.getPendingEdit();
        if (pendingEdit) {
          pendingEdits[element.comment.uniqueIdInThread] = pendingEdit;
        }
      }
    });
    return pendingEdits;
  }
  getCommentCoords(commentUniqueId) {
    const matchedNode = this._commentElements.filter((commentNode) => commentNode.comment.uniqueIdInThread === commentUniqueId);
    if (matchedNode && matchedNode.length) {
      const commentThreadCoords = dom.getDomNodePagePosition(this._commentElements[0].domNode);
      const commentCoords = dom.getDomNodePagePosition(matchedNode[0].domNode);
      return {
        thread: commentThreadCoords,
        comment: commentCoords
      };
    }
    return;
  }
  async updateCommentThread(commentThread, preserveFocus) {
    const oldCommentsLen = this._commentElements.length;
    const newCommentsLen = commentThread.comments ? commentThread.comments.length : 0;
    const commentElementsToDel = [];
    const commentElementsToDelIndex = [];
    for (let i = 0; i < oldCommentsLen; i++) {
      const comment = this._commentElements[i].comment;
      const newComment = commentThread.comments ? commentThread.comments.filter((c) => c.uniqueIdInThread === comment.uniqueIdInThread) : [];
      if (newComment.length) {
        this._commentElements[i].update(newComment[0]);
      } else {
        commentElementsToDelIndex.push(i);
        commentElementsToDel.push(this._commentElements[i]);
      }
    }
    for (let i = commentElementsToDel.length - 1; i >= 0; i--) {
      const commentToDelete = commentElementsToDel[i];
      this._commentDisposable.deleteAndDispose(commentToDelete);
      this._commentElements.splice(commentElementsToDelIndex[i], 1);
      commentToDelete.domNode.remove();
    }
    let lastCommentElement = null;
    const newCommentNodeList = [];
    const newCommentsInEditMode = [];
    const startEditing = [];
    for (let i = newCommentsLen - 1; i >= 0; i--) {
      const currentComment = commentThread.comments[i];
      const oldCommentNode = this._commentElements.filter((commentNode) => commentNode.comment.uniqueIdInThread === currentComment.uniqueIdInThread);
      if (oldCommentNode.length) {
        lastCommentElement = oldCommentNode[0].domNode;
        newCommentNodeList.unshift(oldCommentNode[0]);
      } else {
        const newElement = this.createNewCommentNode(currentComment);
        newCommentNodeList.unshift(newElement);
        if (lastCommentElement) {
          this._commentsElement.insertBefore(newElement.domNode, lastCommentElement);
          lastCommentElement = newElement.domNode;
        } else {
          this._commentsElement.appendChild(newElement.domNode);
          lastCommentElement = newElement.domNode;
        }
        if (currentComment.mode === languages.CommentMode.Editing) {
          startEditing.push(newElement.switchToEditMode());
          newCommentsInEditMode.push(newElement);
        }
      }
    }
    this._commentThread = commentThread;
    this._commentElements = newCommentNodeList;
    await Promise.all(startEditing);
    if (newCommentsInEditMode.length) {
      const lastIndex = this._commentElements.indexOf(newCommentsInEditMode[newCommentsInEditMode.length - 1]);
      this._focusedComment = lastIndex;
    }
    this._updateAriaLabel();
    if (!preserveFocus) {
      this._setFocusedComment(this._focusedComment);
    }
  }
  _updateAriaLabel() {
    if (this._commentThread.isDocumentCommentThread()) {
      if (this._commentThread.range) {
        this._commentsElement.ariaLabel = nls.localize(
          "commentThreadAria.withRange",
          "Comment thread with {0} comments on lines {1} through {2}. {3}.",
          this._commentThread.comments?.length,
          this._commentThread.range.startLineNumber,
          this._commentThread.range.endLineNumber,
          this._commentThread.label
        );
      } else {
        this._commentsElement.ariaLabel = nls.localize(
          "commentThreadAria.document",
          "Comment thread with {0} comments on the entire document. {1}.",
          this._commentThread.comments?.length,
          this._commentThread.label
        );
      }
    } else {
      this._commentsElement.ariaLabel = nls.localize(
        "commentThreadAria",
        "Comment thread with {0} comments. {1}.",
        this._commentThread.comments?.length,
        this._commentThread.label
      );
    }
  }
  _setFocusedComment(value) {
    if (this._focusedComment !== void 0) {
      this._commentElements[this._focusedComment]?.setFocus(false);
    }
    if (this._commentElements.length === 0 || value === void 0) {
      this._focusedComment = void 0;
    } else {
      this._focusedComment = Math.min(value, this._commentElements.length - 1);
      this._commentElements[this._focusedComment].setFocus(true);
    }
  }
  createNewCommentNode(comment) {
    const newCommentNode = this._scopedInstatiationService.createInstance(
      CommentNode,
      this._parentEditor,
      this._commentThread,
      comment,
      this._pendingEdits ? this._pendingEdits[comment.uniqueIdInThread] : void 0,
      this.owner,
      this.parentResourceUri,
      this._parentCommentThreadWidget,
      this._markdownRendererOptions
    );
    const disposables = new DisposableStore();
    disposables.add(newCommentNode.onDidClick(
      (clickedNode) => this._setFocusedComment(this._commentElements.findIndex((commentNode) => commentNode.comment.uniqueIdInThread === clickedNode.comment.uniqueIdInThread))
    ));
    disposables.add(newCommentNode);
    this._commentDisposable.set(newCommentNode, disposables);
    return newCommentNode;
  }
  dispose() {
    super.dispose();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._commentDisposable.dispose();
  }
};
CommentThreadBody = __decorateClass([
  __decorateParam(9, ICommentService)
], CommentThreadBody);
export {
  CommentThreadBody
};
