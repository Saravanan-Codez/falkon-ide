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
import { Event } from "../../../../base/common/event.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { SortOrder, LexicographicOptions } from "../common/files.js";
import { ExplorerItem, ExplorerModel } from "../common/explorerModel.js";
import { FileOperation, IFileService, FileChangeType } from "../../../../platform/files/common/files.js";
import { dirname, basename } from "../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IBulkEditService } from "../../../../editor/browser/services/bulkEditService.js";
import { UndoRedoSource } from "../../../../platform/undoRedo/common/undoRedo.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ResourceGlobMatcher } from "../../../common/resources.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IDecorationsService } from "../../../services/decorations/common/decorations.js";
import { ExplorerDecorationsProvider } from "./views/explorerDecorationsProvider.js";
const UNDO_REDO_SOURCE = new UndoRedoSource();
let ExplorerService = class {
  constructor(fileService, configurationService, contextService, clipboardService, editorService, uriIdentityService, bulkEditService, progressService, hostService, filesConfigurationService, decorationsService) {
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.clipboardService = clipboardService;
    this.editorService = editorService;
    this.uriIdentityService = uriIdentityService;
    this.bulkEditService = bulkEditService;
    this.progressService = progressService;
    this.filesConfigurationService = filesConfigurationService;
    this.decorationsService = decorationsService;
    // delay in ms to react to file changes to give our internal events a chance to react first
    this.disposables = new DisposableStore();
    this.decorationsProviderRegistered = false;
    this.fileChangeEvents = [];
    this.config = this.configurationService.getValue("explorer");
    this.model = new ExplorerModel(this.contextService, this.uriIdentityService, this.fileService, this.configurationService, this.filesConfigurationService);
    this.disposables.add(this.model);
    this.disposables.add(this.fileService.onDidRunOperation((e) => this.onDidRunOperation(e)));
    this.onFileChangesScheduler = this.disposables.add(new RunOnceScheduler(async () => {
      const events = this.fileChangeEvents;
      this.fileChangeEvents = [];
      const types = [FileChangeType.DELETED];
      if (this.config.sortOrder === SortOrder.Modified) {
        types.push(FileChangeType.UPDATED);
      }
      let shouldRefresh = false;
      this.roots.forEach((r) => {
        if (this.view && !shouldRefresh) {
          shouldRefresh = doesFileEventAffect(r, this.view, events, types);
        }
      });
      events.forEach((e) => {
        if (!shouldRefresh) {
          for (const resource of e.rawAdded) {
            const parent = this.model.findClosest(dirname(resource));
            if (parent && !parent.getChild(basename(resource))) {
              shouldRefresh = true;
              break;
            }
          }
        }
      });
      if (shouldRefresh) {
        await this.refresh(false);
      }
    }, ExplorerService.EXPLORER_FILE_CHANGES_REACT_DELAY));
    this.disposables.add(this.fileService.onDidFilesChange((e) => {
      this.fileChangeEvents.push(e);
      if (this.editable) {
        return;
      }
      if (!this.onFileChangesScheduler.isScheduled()) {
        this.onFileChangesScheduler.schedule();
      }
    }));
    this.disposables.add(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this.disposables.add(Event.any(this.fileService.onDidChangeFileSystemProviderRegistrations, this.fileService.onDidChangeFileSystemProviderCapabilities)(async (e) => {
      let affected = false;
      this.model.roots.forEach((r) => {
        if (r.resource.scheme === e.scheme) {
          affected = true;
          r.forgetChildren();
        }
      });
      if (affected) {
        if (this.view) {
          await this.view.setTreeInput();
        }
      }
    }));
    this.disposables.add(this.model.onDidChangeRoots(() => {
      this.view?.setTreeInput();
    }));
    this.disposables.add(hostService.onDidChangeFocus((hasFocus) => {
      if (hasFocus) {
        this.refresh(false);
      }
    }));
    this.revealExcludeMatcher = new ResourceGlobMatcher(
      (uri) => getRevealExcludes(configurationService.getValue({ resource: uri })),
      (event) => event.affectsConfiguration("explorer.autoRevealExclude"),
      contextService,
      configurationService
    );
    this.disposables.add(this.revealExcludeMatcher);
  }
  static {
    this.EXPLORER_FILE_CHANGES_REACT_DELAY = 500;
  }
  get roots() {
    return this.model.roots;
  }
  get sortOrderConfiguration() {
    return {
      sortOrder: this.config.sortOrder,
      lexicographicOptions: this.config.sortOrderLexicographicOptions,
      reverse: this.config.sortOrderReverse
    };
  }
  registerView(contextProvider) {
    this.view = contextProvider;
    if (!this.decorationsProviderRegistered) {
      this.decorationsProviderRegistered = true;
      const provider = this.disposables.add(new ExplorerDecorationsProvider(this, this.contextService));
      this.disposables.add(this.decorationsService.registerDecorationsProvider(provider));
    }
  }
  getViewId() {
    return this.view?.id;
  }
  getContext(respectMultiSelection, ignoreNestedChildren = false) {
    if (!this.view) {
      return [];
    }
    const items = new Set(this.view.getContext(respectMultiSelection));
    items.forEach((item) => {
      try {
        if (respectMultiSelection && !ignoreNestedChildren && this.view?.isItemCollapsed(item) && item.nestedChildren) {
          for (const child of item.nestedChildren) {
            items.add(child);
          }
        }
      } catch {
        return;
      }
    });
    return [...items];
  }
  async applyBulkEdit(edit, options) {
    const cancellationTokenSource = new CancellationTokenSource();
    const location = options.progressLocation ?? ProgressLocation.Window;
    let progressOptions;
    if (location === ProgressLocation.Window) {
      progressOptions = {
        location,
        title: options.progressLabel,
        cancellable: edit.length > 1
      };
    } else {
      progressOptions = {
        location,
        title: options.progressLabel,
        cancellable: edit.length > 1,
        delay: 500
      };
    }
    const promise = this.progressService.withProgress(progressOptions, async (progress) => {
      await this.bulkEditService.apply(edit, {
        undoRedoSource: UNDO_REDO_SOURCE,
        label: options.undoLabel,
        code: "undoredo.explorerOperation",
        progress,
        token: cancellationTokenSource.token,
        confirmBeforeUndo: options.confirmBeforeUndo
      });
    }, () => cancellationTokenSource.cancel());
    await this.progressService.withProgress({ location: ProgressLocation.Explorer, delay: 500 }, () => promise);
    cancellationTokenSource.dispose();
  }
  hasViewFocus() {
    return !!this.view && this.view.hasFocus();
  }
  // IExplorerService methods
  findClosest(resource) {
    return this.model.findClosest(resource);
  }
  findClosestRoot(resource) {
    const parentRoots = this.model.roots.filter((r) => this.uriIdentityService.extUri.isEqualOrParent(resource, r.resource)).sort((first, second) => second.resource.path.length - first.resource.path.length);
    return parentRoots.length ? parentRoots[0] : null;
  }
  async setEditable(stat, data) {
    if (!this.view) {
      return;
    }
    if (!data) {
      this.editable = void 0;
    } else {
      this.editable = { stat, data };
    }
    const isEditing = this.isEditable(stat);
    try {
      await this.view.setEditable(stat, isEditing);
    } catch {
      return;
    }
    if (!this.editable && this.fileChangeEvents.length && !this.onFileChangesScheduler.isScheduled()) {
      this.onFileChangesScheduler.schedule();
    }
  }
  async setToCopy(items, cut) {
    const previouslyCutItems = this.cutItems;
    this.cutItems = cut ? items : void 0;
    await this.clipboardService.writeResources(items.map((s) => s.resource));
    this.view?.itemsCopied(items, cut, previouslyCutItems);
  }
  isCut(item) {
    return !!this.cutItems && this.cutItems.some((i) => this.uriIdentityService.extUri.isEqual(i.resource, item.resource));
  }
  getEditable() {
    return this.editable;
  }
  getEditableData(stat) {
    return this.editable && this.editable.stat === stat ? this.editable.data : void 0;
  }
  isEditable(stat) {
    return !!this.editable && (this.editable.stat === stat || !stat);
  }
  async select(resource, reveal) {
    if (!this.view) {
      return;
    }
    const ignoreRevealExcludes = reveal === "force";
    const fileStat = this.findClosest(resource);
    if (fileStat) {
      if (!this.shouldAutoRevealItem(fileStat, ignoreRevealExcludes)) {
        return;
      }
      await this.view.selectResource(fileStat.resource, reveal);
      return Promise.resolve(void 0);
    }
    const options = { resolveTo: [resource], resolveMetadata: this.config.sortOrder === SortOrder.Modified };
    const root = this.findClosestRoot(resource);
    if (!root) {
      return void 0;
    }
    try {
      const stat = await this.fileService.resolve(root.resource, options);
      const modelStat = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, stat, void 0, options.resolveTo);
      ExplorerItem.mergeLocalWithDisk(modelStat, root);
      const item = root.find(resource);
      await this.view.refresh(true, root);
      if (item && !this.shouldAutoRevealItem(item, ignoreRevealExcludes)) {
        return;
      }
      await this.view.selectResource(item ? item.resource : void 0, reveal);
    } catch (error) {
      root.error = error;
      await this.view.refresh(false, root);
    }
  }
  async refresh(reveal = true) {
    if (this.view?.hasPhantomElements()) {
      return;
    }
    this.model.roots.forEach((r) => r.forgetChildren());
    if (this.view) {
      await this.view.refresh(true);
      const resource = this.editorService.activeEditor?.resource;
      const autoReveal = this.configurationService.getValue().explorer.autoReveal;
      if (reveal && resource && autoReveal) {
        this.select(resource, autoReveal);
      }
    }
  }
  // File events
  async onDidRunOperation(e) {
    const shouldDeepRefresh = this.config.fileNesting.enabled;
    if (e.isOperation(FileOperation.CREATE) || e.isOperation(FileOperation.COPY)) {
      const addedElement = e.target;
      const parentResource = dirname(addedElement.resource);
      const parents = this.model.findAll(parentResource);
      if (parents.length) {
        await Promise.all(parents.map(async (p) => {
          const resolveMetadata = this.config.sortOrder === `modified`;
          if (!p.isDirectoryResolved) {
            const stat = await this.fileService.resolve(p.resource, { resolveMetadata });
            if (stat) {
              const modelStat = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, stat, p.parent);
              ExplorerItem.mergeLocalWithDisk(modelStat, p);
            }
          }
          const childElement = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, addedElement, p.parent);
          p.removeChild(childElement);
          p.addChild(childElement);
          await this.view?.refresh(shouldDeepRefresh, p);
        }));
      }
    } else if (e.isOperation(FileOperation.MOVE)) {
      const oldResource = e.resource;
      const newElement = e.target;
      const oldParentResource = dirname(oldResource);
      const newParentResource = dirname(newElement.resource);
      const modelElements = this.model.findAll(oldResource);
      const sameParentMove = modelElements.every((e2) => !e2.nestedParent) && this.uriIdentityService.extUri.isEqual(oldParentResource, newParentResource);
      if (sameParentMove) {
        await Promise.all(modelElements.map(async (modelElement) => {
          modelElement.rename(newElement);
          await this.view?.refresh(shouldDeepRefresh, modelElement.parent);
        }));
      } else {
        const newParents = this.model.findAll(newParentResource);
        if (newParents.length && modelElements.length) {
          await Promise.all(modelElements.map(async (modelElement, index) => {
            const oldParent = modelElement.parent;
            const oldNestedParent = modelElement.nestedParent;
            modelElement.move(newParents[index]);
            if (oldNestedParent) {
              await this.view?.refresh(false, oldNestedParent);
            }
            await this.view?.refresh(false, oldParent);
            await this.view?.refresh(shouldDeepRefresh, newParents[index]);
          }));
        }
      }
    } else if (e.isOperation(FileOperation.DELETE)) {
      const modelElements = this.model.findAll(e.resource);
      await Promise.all(modelElements.map(async (modelElement) => {
        if (modelElement.parent) {
          const parent = modelElement.parent;
          parent.removeChild(modelElement);
          this.view?.focusNext();
          const oldNestedParent = modelElement.nestedParent;
          if (oldNestedParent) {
            oldNestedParent.removeChild(modelElement);
            await this.view?.refresh(false, oldNestedParent);
          }
          await this.view?.refresh(shouldDeepRefresh, parent);
          if (this.view?.getFocus().length === 0) {
            this.view?.focusLast();
          }
        }
      }));
    }
  }
  // Check if an item matches a explorer.autoRevealExclude pattern
  shouldAutoRevealItem(item, ignore) {
    if (item === void 0 || ignore) {
      return true;
    }
    if (this.revealExcludeMatcher.matches(item.resource, (name) => !!item.parent?.getChild(name))) {
      return false;
    }
    const root = item.root;
    let currentItem = item.parent;
    while (currentItem !== root) {
      if (currentItem === void 0) {
        return true;
      }
      if (this.revealExcludeMatcher.matches(currentItem.resource)) {
        return false;
      }
      currentItem = currentItem.parent;
    }
    return true;
  }
  async onConfigurationUpdated(event) {
    if (!event.affectsConfiguration("explorer")) {
      return;
    }
    let shouldRefresh = false;
    if (event.affectsConfiguration("explorer.fileNesting")) {
      shouldRefresh = true;
    }
    const configuration = this.configurationService.getValue();
    const configSortOrder = configuration?.explorer?.sortOrder || SortOrder.Default;
    if (this.config.sortOrder !== configSortOrder) {
      shouldRefresh = this.config.sortOrder !== void 0;
    }
    const configLexicographicOptions = configuration?.explorer?.sortOrderLexicographicOptions || LexicographicOptions.Default;
    if (this.config.sortOrderLexicographicOptions !== configLexicographicOptions) {
      shouldRefresh = shouldRefresh || this.config.sortOrderLexicographicOptions !== void 0;
    }
    const sortOrderReverse = configuration?.explorer?.sortOrderReverse || false;
    if (this.config.sortOrderReverse !== sortOrderReverse) {
      shouldRefresh = shouldRefresh || this.config.sortOrderReverse !== void 0;
    }
    this.config = configuration.explorer;
    if (shouldRefresh) {
      await this.refresh();
    }
  }
  dispose() {
    this.disposables.dispose();
  }
};
ExplorerService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IBulkEditService),
  __decorateParam(7, IProgressService),
  __decorateParam(8, IHostService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, IDecorationsService)
], ExplorerService);
function doesFileEventAffect(item, view, events, types) {
  for (const [_name, child] of item.children) {
    if (view.isItemVisible(child)) {
      if (events.some((e) => e.contains(child.resource, ...types))) {
        return true;
      }
      if (child.isDirectory && child.isDirectoryResolved) {
        if (doesFileEventAffect(child, view, events, types)) {
          return true;
        }
      }
    }
  }
  return false;
}
function getRevealExcludes(configuration) {
  const revealExcludes = configuration?.explorer?.autoRevealExclude;
  if (!revealExcludes) {
    return {};
  }
  return revealExcludes;
}
export {
  ExplorerService,
  UNDO_REDO_SOURCE
};
