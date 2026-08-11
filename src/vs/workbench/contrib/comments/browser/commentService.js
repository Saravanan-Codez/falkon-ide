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
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Range } from "../../../../editor/common/core/range.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { CommentMenus } from "./commentMenus.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { COMMENTS_SECTION } from "../common/commentsConfiguration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CommentsModel } from "./commentsModel.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { Schemas } from "../../../../base/common/network.js";
const ICommentService = createDecorator("commentService");
const CONTINUE_ON_COMMENTS = "comments.continueOnComments";
let CommentService = class extends Disposable {
  // schemes
  constructor(instantiationService, layoutService, configurationService, contextKeyService, storageService, logService, modelService) {
    super();
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this.logService = logService;
    this.modelService = modelService;
    this._onDidSetDataProvider = this._register(new Emitter());
    this.onDidSetDataProvider = this._onDidSetDataProvider.event;
    this._onDidDeleteDataProvider = this._register(new Emitter());
    this.onDidDeleteDataProvider = this._onDidDeleteDataProvider.event;
    this._onDidSetResourceCommentInfos = this._register(new Emitter());
    this.onDidSetResourceCommentInfos = this._onDidSetResourceCommentInfos.event;
    this._onDidSetAllCommentThreads = this._register(new Emitter());
    this.onDidSetAllCommentThreads = this._onDidSetAllCommentThreads.event;
    this._onDidUpdateCommentThreads = this._register(new Emitter());
    this.onDidUpdateCommentThreads = this._onDidUpdateCommentThreads.event;
    this._onDidUpdateNotebookCommentThreads = this._register(new Emitter());
    this.onDidUpdateNotebookCommentThreads = this._onDidUpdateNotebookCommentThreads.event;
    this._onDidUpdateCommentingRanges = this._register(new Emitter());
    this.onDidUpdateCommentingRanges = this._onDidUpdateCommentingRanges.event;
    this._onDidChangeActiveEditingCommentThread = this._register(new Emitter());
    this.onDidChangeActiveEditingCommentThread = this._onDidChangeActiveEditingCommentThread.event;
    this._onDidChangeCurrentCommentThread = this._register(new Emitter());
    this.onDidChangeCurrentCommentThread = this._onDidChangeCurrentCommentThread.event;
    this._onDidChangeCommentingEnabled = this._register(new Emitter());
    this.onDidChangeCommentingEnabled = this._onDidChangeCommentingEnabled.event;
    this._onResourceHasCommentingRanges = this._register(new Emitter());
    this.onResourceHasCommentingRanges = this._onResourceHasCommentingRanges.event;
    this._onDidChangeActiveCommentingRange = this._register(new Emitter());
    this.onDidChangeActiveCommentingRange = this._onDidChangeActiveCommentingRange.event;
    this._commentControls = /* @__PURE__ */ new Map();
    this._commentMenus = /* @__PURE__ */ new Map();
    this._isCommentingEnabled = true;
    this._continueOnComments = /* @__PURE__ */ new Map();
    // uniqueOwner -> PendingCommentThread[]
    this._continueOnCommentProviders = /* @__PURE__ */ new Set();
    this._commentsModel = this._register(new CommentsModel());
    this.commentsModel = this._commentsModel;
    this._commentingRangeResources = /* @__PURE__ */ new Set();
    // URIs
    this._commentingRangeResourceHintSchemes = /* @__PURE__ */ new Set();
    this._handleConfiguration();
    this._handleZenMode();
    this._workspaceHasCommenting = CommentContextKeys.WorkspaceHasCommenting.bindTo(contextKeyService);
    this._commentingEnabled = CommentContextKeys.commentingEnabled.bindTo(contextKeyService);
    const storageListener = this._register(new DisposableStore());
    const storageEvent = Event.debounce(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, CONTINUE_ON_COMMENTS, storageListener), (last, event) => last?.external ? last : event, 500);
    storageListener.add(storageEvent((v) => {
      if (!v.external) {
        return;
      }
      const commentsToRestore = this.storageService.getObject(CONTINUE_ON_COMMENTS, StorageScope.WORKSPACE);
      if (!commentsToRestore) {
        return;
      }
      this.logService.debug(`Comments: URIs of continue on comments from storage ${commentsToRestore.map((thread) => thread.uri.toString()).join(", ")}.`);
      const changedOwners = this._addContinueOnComments(commentsToRestore, this._continueOnComments);
      for (const uniqueOwner of changedOwners) {
        const control = this._commentControls.get(uniqueOwner);
        if (!control) {
          continue;
        }
        const evt = {
          uniqueOwner,
          owner: control.owner,
          ownerLabel: control.label,
          pending: this._continueOnComments.get(uniqueOwner) || [],
          added: [],
          removed: [],
          changed: []
        };
        this.updateModelThreads(evt);
      }
    }));
    this._register(storageService.onWillSaveState(() => {
      const map = /* @__PURE__ */ new Map();
      for (const provider of this._continueOnCommentProviders) {
        const pendingComments = provider.provideContinueOnComments();
        this._addContinueOnComments(pendingComments, map);
      }
      this._saveContinueOnComments(map);
    }));
    this._register(this.modelService.onModelAdded((model) => {
      if (model.uri.scheme === Schemas.vscodeSourceControl) {
        return;
      }
      if (!this._commentingRangeResources.has(model.uri.toString())) {
        this.getDocumentComments(model.uri);
      }
    }));
  }
  _updateResourcesWithCommentingRanges(resource, commentInfos) {
    let addedResources = false;
    for (const comments of commentInfos) {
      if (comments && (comments.commentingRanges.ranges.length > 0 || comments.threads.length > 0)) {
        this._commentingRangeResources.add(resource.toString());
        addedResources = true;
      }
    }
    if (addedResources) {
      this._onResourceHasCommentingRanges.fire();
    }
  }
  _handleConfiguration() {
    this._isCommentingEnabled = this._defaultCommentingEnablement;
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("comments.visible")) {
        this.enableCommenting(this._defaultCommentingEnablement);
      }
    }));
  }
  _handleZenMode() {
    let preZenModeValue = this._isCommentingEnabled;
    this._register(this.layoutService.onDidChangeZenMode((e) => {
      if (e) {
        preZenModeValue = this._isCommentingEnabled;
        this.enableCommenting(false);
      } else {
        this.enableCommenting(preZenModeValue);
      }
    }));
  }
  get _defaultCommentingEnablement() {
    return !!this.configurationService.getValue(COMMENTS_SECTION)?.visible;
  }
  get isCommentingEnabled() {
    return this._isCommentingEnabled;
  }
  enableCommenting(enable) {
    if (enable !== this._isCommentingEnabled) {
      this._isCommentingEnabled = enable;
      this._commentingEnabled.set(enable);
      this._onDidChangeCommentingEnabled.fire(enable);
    }
  }
  /**
   * The current comment thread is the thread that has focus or is being hovered.
   * @param commentThread
   */
  setCurrentCommentThread(commentThread) {
    this._onDidChangeCurrentCommentThread.fire(commentThread);
  }
  /**
   * The active comment thread is the thread that is currently being edited.
   * @param commentThread
   */
  setActiveEditingCommentThread(commentThread) {
    this._onDidChangeActiveEditingCommentThread.fire(commentThread);
  }
  get lastActiveCommentcontroller() {
    return this._lastActiveCommentController;
  }
  async setActiveCommentAndThread(uniqueOwner, commentInfo) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (!commentController) {
      return;
    }
    if (commentController !== this._lastActiveCommentController) {
      await this._lastActiveCommentController?.setActiveCommentAndThread(void 0);
    }
    this._lastActiveCommentController = commentController;
    return commentController.setActiveCommentAndThread(commentInfo);
  }
  setDocumentComments(resource, commentInfos) {
    this._onDidSetResourceCommentInfos.fire({ resource, commentInfos });
  }
  setModelThreads(ownerId, owner, ownerLabel, commentThreads) {
    this._commentsModel.setCommentThreads(ownerId, owner, ownerLabel, commentThreads);
    this._onDidSetAllCommentThreads.fire({ ownerId, ownerLabel, commentThreads });
  }
  updateModelThreads(event) {
    this._commentsModel.updateCommentThreads(event);
    this._onDidUpdateCommentThreads.fire(event);
  }
  setWorkspaceComments(uniqueOwner, commentsByResource) {
    if (commentsByResource.length) {
      this._workspaceHasCommenting.set(true);
    }
    const control = this._commentControls.get(uniqueOwner);
    if (control) {
      this.setModelThreads(uniqueOwner, control.owner, control.label, commentsByResource);
    }
  }
  removeWorkspaceComments(uniqueOwner) {
    const control = this._commentControls.get(uniqueOwner);
    if (control) {
      this.setModelThreads(uniqueOwner, control.owner, control.label, []);
    }
  }
  registerCommentController(uniqueOwner, commentControl) {
    this._commentControls.set(uniqueOwner, commentControl);
    this._onDidSetDataProvider.fire();
  }
  unregisterCommentController(uniqueOwner) {
    if (uniqueOwner) {
      this._commentControls.delete(uniqueOwner);
    } else {
      this._commentControls.clear();
    }
    this._commentsModel.deleteCommentsByOwner(uniqueOwner);
    this._onDidDeleteDataProvider.fire(uniqueOwner);
  }
  getCommentController(uniqueOwner) {
    return this._commentControls.get(uniqueOwner);
  }
  async createCommentThreadTemplate(uniqueOwner, resource, range, editorId) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (!commentController) {
      return;
    }
    return commentController.createCommentThreadTemplate(resource, range, editorId);
  }
  async updateCommentThreadTemplate(uniqueOwner, threadHandle, range) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (!commentController) {
      return;
    }
    await commentController.updateCommentThreadTemplate(threadHandle, range);
  }
  disposeCommentThread(uniqueOwner, threadId) {
    const controller = this.getCommentController(uniqueOwner);
    controller?.deleteCommentThreadMain(threadId);
  }
  getCommentMenus(uniqueOwner) {
    if (this._commentMenus.get(uniqueOwner)) {
      return this._commentMenus.get(uniqueOwner);
    }
    const menu = this.instantiationService.createInstance(CommentMenus);
    this._commentMenus.set(uniqueOwner, menu);
    return menu;
  }
  updateComments(ownerId, event) {
    const control = this._commentControls.get(ownerId);
    if (control) {
      const evt = Object.assign({}, event, { uniqueOwner: ownerId, ownerLabel: control.label, owner: control.owner });
      this.updateModelThreads(evt);
    }
  }
  updateNotebookComments(ownerId, event) {
    const evt = Object.assign({}, event, { uniqueOwner: ownerId });
    this._onDidUpdateNotebookCommentThreads.fire(evt);
  }
  updateCommentingRanges(ownerId, resourceHints) {
    if (resourceHints?.schemes && resourceHints.schemes.length > 0) {
      for (const scheme of resourceHints.schemes) {
        this._commentingRangeResourceHintSchemes.add(scheme);
      }
    }
    this._workspaceHasCommenting.set(true);
    this._onDidUpdateCommentingRanges.fire({ uniqueOwner: ownerId });
  }
  async toggleReaction(uniqueOwner, resource, thread, comment, reaction) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (commentController) {
      return commentController.toggleReaction(resource, thread, comment, reaction, CancellationToken.None);
    } else {
      throw new Error("Not supported");
    }
  }
  hasReactionHandler(uniqueOwner) {
    const commentProvider = this._commentControls.get(uniqueOwner);
    if (commentProvider) {
      return !!commentProvider.features.reactionHandler;
    }
    return false;
  }
  async getDocumentComments(resource) {
    const commentControlResult = [];
    for (const control of this._commentControls.values()) {
      commentControlResult.push(control.getDocumentComments(resource, CancellationToken.None).then((documentComments) => {
        for (const documentCommentThread of documentComments.threads) {
          if (documentCommentThread.comments?.length === 0 && documentCommentThread.range) {
            this.removeContinueOnComment({ range: documentCommentThread.range, uri: resource, uniqueOwner: documentComments.uniqueOwner });
          }
        }
        const pendingComments = this._continueOnComments.get(documentComments.uniqueOwner);
        documentComments.pendingCommentThreads = pendingComments?.filter((pendingComment) => pendingComment.uri.toString() === resource.toString());
        return documentComments;
      }).catch((_) => {
        return null;
      }));
    }
    const commentInfos = await Promise.all(commentControlResult);
    this._updateResourcesWithCommentingRanges(resource, commentInfos);
    return commentInfos;
  }
  async getNotebookComments(resource) {
    const commentControlResult = [];
    this._commentControls.forEach((control) => {
      commentControlResult.push(control.getNotebookComments(resource, CancellationToken.None).catch((_) => {
        return null;
      }));
    });
    return Promise.all(commentControlResult);
  }
  registerContinueOnCommentProvider(provider) {
    this._continueOnCommentProviders.add(provider);
    return {
      dispose: () => {
        this._continueOnCommentProviders.delete(provider);
      }
    };
  }
  _saveContinueOnComments(map) {
    const commentsToSave = [];
    for (const pendingComments of map.values()) {
      commentsToSave.push(...pendingComments);
    }
    this.logService.debug(`Comments: URIs of continue on comments to add to storage ${commentsToSave.map((thread) => thread.uri.toString()).join(", ")}.`);
    this.storageService.store(CONTINUE_ON_COMMENTS, commentsToSave, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  removeContinueOnComment(pendingComment) {
    const pendingComments = this._continueOnComments.get(pendingComment.uniqueOwner);
    if (pendingComments) {
      const commentIndex = pendingComments.findIndex((comment) => comment.uri.toString() === pendingComment.uri.toString() && Range.equalsRange(comment.range, pendingComment.range) && (pendingComment.isReply === void 0 || comment.isReply === pendingComment.isReply));
      if (commentIndex > -1) {
        return pendingComments.splice(commentIndex, 1)[0];
      }
    }
    return void 0;
  }
  _addContinueOnComments(pendingComments, map) {
    const changedOwners = /* @__PURE__ */ new Set();
    for (const pendingComment of pendingComments) {
      if (!map.has(pendingComment.uniqueOwner)) {
        map.set(pendingComment.uniqueOwner, [pendingComment]);
        changedOwners.add(pendingComment.uniqueOwner);
      } else {
        const commentsForOwner = map.get(pendingComment.uniqueOwner);
        if (commentsForOwner.every((comment) => comment.uri.toString() !== pendingComment.uri.toString() || !Range.equalsRange(comment.range, pendingComment.range))) {
          commentsForOwner.push(pendingComment);
          changedOwners.add(pendingComment.uniqueOwner);
        }
      }
    }
    return changedOwners;
  }
  resourceHasCommentingRanges(resource) {
    return this._commentingRangeResourceHintSchemes.has(resource.scheme) || this._commentingRangeResources.has(resource.toString());
  }
};
CommentService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IModelService)
], CommentService);
export {
  CommentService,
  ICommentService
};
