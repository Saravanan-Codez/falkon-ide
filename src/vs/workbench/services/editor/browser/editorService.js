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
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { SideBySideEditor, isEditorInputWithOptions, SaveReason, EditorsOrder, EditorResourceAccessor, EditorInputCapabilities, isResourceDiffEditorInput, isResourceEditorInput, isEditorInput, isEditorInputWithOptionsAndGroup, isResourceMergeEditorInput } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { IFileService, FileOperation, FileChangesEvent, FileChangeType } from "../../../../platform/files/common/files.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { URI } from "../../../../base/common/uri.js";
import { joinPath } from "../../../../base/common/resources.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { SideBySideEditor as SideBySideEditorPane } from "../../../browser/parts/editor/sideBySideEditor.js";
import { IEditorGroupsService, GroupsOrder, isEditorReplacement } from "../common/editorGroupsService.js";
import { IEditorService, isPreferredGroup } from "../common/editorService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Disposable, dispose, DisposableStore } from "../../../../base/common/lifecycle.js";
import { coalesce, distinct } from "../../../../base/common/arrays.js";
import { isCodeEditor, isDiffEditor, isCompositeEditor } from "../../../../editor/browser/editorBrowser.js";
import { registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { isUndefined } from "../../../../base/common/types.js";
import { EditorsObserver } from "../../../browser/parts/editor/editorsObserver.js";
import { Promises, timeout } from "../../../../base/common/async.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { indexOfPath } from "../../../../base/common/extpath.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IEditorResolverService, ResolvedStatus } from "../common/editorResolverService.js";
import { IWorkspaceTrustRequestService, WorkspaceTrustUriResponse } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IHostService } from "../../host/browser/host.js";
import { findGroup } from "../common/editorGroupFinder.js";
import { ITextEditorService } from "../../textfile/common/textEditorService.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
let EditorService = class extends Disposable {
  constructor(editorGroupsContainer, editorGroupService, instantiationService, fileService, configurationService, contextService, uriIdentityService, editorResolverService, workspaceTrustRequestService, hostService, textEditorService) {
    super();
    this.editorGroupService = editorGroupService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.uriIdentityService = uriIdentityService;
    this.editorResolverService = editorResolverService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.hostService = hostService;
    this.textEditorService = textEditorService;
    //#region events
    this._onDidActiveEditorChange = this._register(new Emitter());
    this.onDidActiveEditorChange = this._onDidActiveEditorChange.event;
    this._onDidVisibleEditorsChange = this._register(new Emitter());
    this.onDidVisibleEditorsChange = this._onDidVisibleEditorsChange.event;
    this._onDidEditorsChange = this._register(new Emitter());
    this.onDidEditorsChange = this._onDidEditorsChange.event;
    this._onWillOpenEditor = this._register(new Emitter());
    this.onWillOpenEditor = this._onWillOpenEditor.event;
    this._onDidCloseEditor = this._register(new Emitter());
    this.onDidCloseEditor = this._onDidCloseEditor.event;
    this._onDidOpenEditorFail = this._register(new Emitter());
    this.onDidOpenEditorFail = this._onDidOpenEditorFail.event;
    this._onDidMostRecentlyActiveEditorsChange = this._register(new Emitter());
    this.onDidMostRecentlyActiveEditorsChange = this._onDidMostRecentlyActiveEditorsChange.event;
    //#region Editor & group event handlers
    this.lastActiveEditor = void 0;
    //#endregion
    //#region Visible Editors Change: Install file watchers for out of workspace resources that became visible
    this.activeOutOfWorkspaceWatchers = new ResourceMap();
    this.closeOnFileDelete = false;
    this.editorGroupsContainer = editorGroupsContainer ?? editorGroupService;
    this.editorsObserver = this._register(this.instantiationService.createInstance(EditorsObserver, this.editorGroupsContainer));
    this.onConfigurationUpdated();
    this.registerListeners();
  }
  createScoped(editorGroupsContainer, disposables) {
    return disposables.add(new EditorService(editorGroupsContainer, this.editorGroupService, this.instantiationService, this.fileService, this.configurationService, this.contextService, this.uriIdentityService, this.editorResolverService, this.workspaceTrustRequestService, this.hostService, this.textEditorService));
  }
  registerListeners() {
    if (this.editorGroupsContainer === this.editorGroupService.mainPart || this.editorGroupsContainer === this.editorGroupService) {
      this.editorGroupService.whenReady.then(() => this.onEditorGroupsReady());
    } else {
      this.onEditorGroupsReady();
    }
    this._register(this.editorGroupsContainer.onDidChangeActiveGroup((group) => this.handleActiveEditorChange(group)));
    this._register(this.editorGroupsContainer.onDidAddGroup((group) => this.registerGroupListeners(group)));
    this._register(this.editorsObserver.onDidMostRecentlyActiveEditorsChange(() => this._onDidMostRecentlyActiveEditorsChange.fire()));
    this._register(this.onDidVisibleEditorsChange(() => this.handleVisibleEditorsChange()));
    this._register(this.fileService.onDidRunOperation((e) => this.onDidRunFileOperation(e)));
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
  }
  onEditorGroupsReady() {
    for (const group of this.editorGroupsContainer.groups) {
      this.registerGroupListeners(group);
    }
    if (this.activeEditor) {
      this.doHandleActiveEditorChangeEvent();
      this._onDidVisibleEditorsChange.fire({ isExplicit: false });
    }
  }
  handleActiveEditorChange(group) {
    if (group !== this.editorGroupsContainer.activeGroup) {
      return;
    }
    if (!this.lastActiveEditor && !group.activeEditor) {
      return;
    }
    this.doHandleActiveEditorChangeEvent();
  }
  doHandleActiveEditorChangeEvent() {
    const activeGroup = this.editorGroupsContainer.activeGroup;
    this.lastActiveEditor = activeGroup.activeEditor ?? void 0;
    this._onDidActiveEditorChange.fire();
  }
  registerGroupListeners(group) {
    const groupDisposables = new DisposableStore();
    groupDisposables.add(group.onDidModelChange((e) => {
      this._onDidEditorsChange.fire({ groupId: group.id, event: e });
    }));
    groupDisposables.add(group.onDidActiveEditorChange((e) => {
      this.handleActiveEditorChange(group);
      this._onDidVisibleEditorsChange.fire({
        isExplicit: e.isExplicit !== false
        /* treat undefined as explicit */
      });
    }));
    groupDisposables.add(group.onWillOpenEditor((e) => {
      this._onWillOpenEditor.fire(e);
    }));
    groupDisposables.add(group.onDidCloseEditor((e) => {
      this._onDidCloseEditor.fire(e);
    }));
    groupDisposables.add(group.onDidOpenEditorFail((editor) => {
      this._onDidOpenEditorFail.fire({ editor, groupId: group.id });
    }));
    Event.once(group.onWillDispose)(() => {
      dispose(groupDisposables);
    });
  }
  handleVisibleEditorsChange() {
    const visibleOutOfWorkspaceResources = new ResourceSet();
    for (const editor of this.visibleEditors) {
      const resources = distinct(coalesce([
        EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }),
        EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY })
      ]), (resource) => resource.toString());
      for (const resource of resources) {
        if (this.fileService.hasProvider(resource) && !this.contextService.isInsideWorkspace(resource)) {
          visibleOutOfWorkspaceResources.add(resource);
        }
      }
    }
    for (const resource of this.activeOutOfWorkspaceWatchers.keys()) {
      if (!visibleOutOfWorkspaceResources.has(resource)) {
        dispose(this.activeOutOfWorkspaceWatchers.get(resource));
        this.activeOutOfWorkspaceWatchers.delete(resource);
      }
    }
    for (const resource of visibleOutOfWorkspaceResources.keys()) {
      if (!this.activeOutOfWorkspaceWatchers.get(resource)) {
        const disposable = this.fileService.watch(resource);
        this.activeOutOfWorkspaceWatchers.set(resource, disposable);
      }
    }
  }
  //#endregion
  //#region File Changes: Move & Deletes to move or close opend editors
  async onDidRunFileOperation(e) {
    if (e.isOperation(FileOperation.MOVE)) {
      this.handleMovedFile(e.resource, e.target.resource);
    }
    if (e.isOperation(FileOperation.DELETE) || e.isOperation(FileOperation.MOVE)) {
      this.handleDeletedFile(e.resource, false, e.target ? e.target.resource : void 0);
    }
  }
  onDidFilesChange(e) {
    if (e.gotDeleted()) {
      this.handleDeletedFile(e, true);
    }
  }
  async handleMovedFile(source, target) {
    for (const group of this.editorGroupsContainer.groups) {
      const replacements = [];
      for (const editor of group.editors) {
        const resource = editor.resource;
        if (!resource || !this.uriIdentityService.extUri.isEqualOrParent(resource, source)) {
          continue;
        }
        let targetResource;
        if (this.uriIdentityService.extUri.isEqual(source, resource)) {
          targetResource = target;
        } else {
          const index = indexOfPath(resource.path, source.path, this.uriIdentityService.extUri.ignorePathCasing(resource));
          targetResource = joinPath(target, resource.path.substr(index + source.path.length + 1));
        }
        const moveResult = await editor.rename(group.id, targetResource);
        if (!moveResult) {
          return;
        }
        const optionOverrides = {
          preserveFocus: true,
          pinned: group.isPinned(editor),
          sticky: group.isSticky(editor),
          index: group.getIndexOfEditor(editor),
          inactive: !group.isActive(editor)
        };
        if (isEditorInput(moveResult.editor)) {
          replacements.push({
            editor,
            replacement: moveResult.editor,
            options: {
              ...moveResult.options,
              ...optionOverrides
            }
          });
        } else {
          replacements.push({
            editor,
            replacement: {
              ...moveResult.editor,
              options: {
                ...moveResult.editor.options,
                ...optionOverrides
              }
            }
          });
        }
      }
      if (replacements.length) {
        this.replaceEditors(replacements, group);
      }
    }
  }
  onConfigurationUpdated(e) {
    if (e && !e.affectsConfiguration("workbench.editor.closeOnFileDelete")) {
      return;
    }
    const configuration = this.configurationService.getValue();
    if (typeof configuration.workbench?.editor?.closeOnFileDelete === "boolean") {
      this.closeOnFileDelete = configuration.workbench.editor.closeOnFileDelete;
    } else {
      this.closeOnFileDelete = false;
    }
  }
  handleDeletedFile(arg1, isExternal, movedTo) {
    for (const editor of this.getAllNonDirtyEditors({ includeUntitled: false, supportSideBySide: true })) {
      (async () => {
        const resource = editor.resource;
        if (!resource) {
          return;
        }
        if (this.closeOnFileDelete || !isExternal) {
          if (movedTo && this.uriIdentityService.extUri.isEqualOrParent(resource, movedTo)) {
            return;
          }
          let matches = false;
          if (arg1 instanceof FileChangesEvent) {
            matches = arg1.contains(resource, FileChangeType.DELETED);
          } else {
            matches = this.uriIdentityService.extUri.isEqualOrParent(resource, arg1);
          }
          if (!matches) {
            return;
          }
          let exists = false;
          if (isExternal && this.fileService.hasProvider(resource)) {
            await timeout(100);
            exists = await this.fileService.exists(resource);
          }
          if (!exists && !editor.isDisposed()) {
            editor.dispose();
          }
        }
      })();
    }
  }
  getAllNonDirtyEditors(options) {
    const editors = [];
    function conditionallyAddEditor(editor) {
      if (editor.hasCapability(EditorInputCapabilities.Untitled) && !options.includeUntitled) {
        return;
      }
      if (editor.isDirty()) {
        return;
      }
      editors.push(editor);
    }
    for (const editor of this.editors) {
      if (options.supportSideBySide && editor instanceof SideBySideEditorInput) {
        conditionallyAddEditor(editor.primary);
        conditionallyAddEditor(editor.secondary);
      } else {
        conditionallyAddEditor(editor);
      }
    }
    return editors;
  }
  get activeEditorPane() {
    return this.editorGroupsContainer.activeGroup?.activeEditorPane;
  }
  get activeTextEditorControl() {
    const activeEditorPane = this.activeEditorPane;
    if (activeEditorPane) {
      const activeControl = activeEditorPane.getControl();
      if (isCodeEditor(activeControl) || isDiffEditor(activeControl)) {
        return activeControl;
      }
      if (isCompositeEditor(activeControl) && isCodeEditor(activeControl.activeCodeEditor)) {
        return activeControl.activeCodeEditor;
      }
    }
    return void 0;
  }
  get activeTextEditorLanguageId() {
    let activeCodeEditor = void 0;
    const activeTextEditorControl = this.activeTextEditorControl;
    if (isDiffEditor(activeTextEditorControl)) {
      activeCodeEditor = activeTextEditorControl.getModifiedEditor();
    } else {
      activeCodeEditor = activeTextEditorControl;
    }
    return activeCodeEditor?.getModel()?.getLanguageId();
  }
  get count() {
    return this.editorsObserver.count;
  }
  get editors() {
    return this.getEditors(EditorsOrder.SEQUENTIAL).map(({ editor }) => editor);
  }
  getEditors(order, options) {
    switch (order) {
      // MRU
      case EditorsOrder.MOST_RECENTLY_ACTIVE:
        if (options?.excludeSticky) {
          return this.editorsObserver.editors.filter(({ groupId, editor }) => !this.editorGroupsContainer.getGroup(groupId)?.isSticky(editor));
        }
        return this.editorsObserver.editors;
      // Sequential
      case EditorsOrder.SEQUENTIAL: {
        const editors = [];
        for (const group of this.editorGroupsContainer.getGroups(GroupsOrder.GRID_APPEARANCE)) {
          editors.push(...group.getEditors(EditorsOrder.SEQUENTIAL, options).map((editor) => ({ editor, groupId: group.id })));
        }
        return editors;
      }
    }
  }
  get activeEditor() {
    const activeGroup = this.editorGroupsContainer.activeGroup;
    return activeGroup ? activeGroup.activeEditor ?? void 0 : void 0;
  }
  get visibleEditorPanes() {
    return coalesce(this.editorGroupsContainer.groups.map((group) => group.activeEditorPane));
  }
  get visibleTextEditorControls() {
    return this.doGetVisibleTextEditorControls(this.visibleEditorPanes);
  }
  doGetVisibleTextEditorControls(editorPanes) {
    const visibleTextEditorControls = [];
    for (const editorPane of editorPanes) {
      const controls = [];
      if (editorPane instanceof SideBySideEditorPane) {
        controls.push(editorPane.getPrimaryEditorPane()?.getControl());
        controls.push(editorPane.getSecondaryEditorPane()?.getControl());
      } else {
        controls.push(editorPane.getControl());
      }
      for (const control of controls) {
        if (isCodeEditor(control) || isDiffEditor(control)) {
          visibleTextEditorControls.push(control);
        }
      }
    }
    return visibleTextEditorControls;
  }
  getVisibleTextEditorControls(order) {
    return this.doGetVisibleTextEditorControls(coalesce(this.editorGroupsContainer.getGroups(order === EditorsOrder.SEQUENTIAL ? GroupsOrder.GRID_APPEARANCE : GroupsOrder.MOST_RECENTLY_ACTIVE).map((group) => group.activeEditorPane)));
  }
  get visibleEditors() {
    return coalesce(this.editorGroupsContainer.groups.map((group) => group.activeEditor));
  }
  async openEditor(editor, optionsOrPreferredGroup, preferredGroup) {
    let typedEditor = void 0;
    let options = isEditorInput(editor) ? optionsOrPreferredGroup : editor.options;
    let group = void 0;
    if (isPreferredGroup(optionsOrPreferredGroup)) {
      preferredGroup = optionsOrPreferredGroup;
    }
    if (!isEditorInput(editor)) {
      const resolvedEditor = await this.editorResolverService.resolveEditor(editor, preferredGroup);
      if (resolvedEditor === ResolvedStatus.ABORT) {
        return;
      }
      if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
        typedEditor = resolvedEditor.editor;
        options = resolvedEditor.options;
        group = resolvedEditor.group;
      }
    }
    if (!typedEditor) {
      typedEditor = isEditorInput(editor) ? editor : await this.textEditorService.resolveTextEditor(editor);
    }
    if (!group) {
      let activation = void 0;
      const findGroupResult = this.instantiationService.invokeFunction(findGroup, { editor: typedEditor, options }, preferredGroup);
      if (findGroupResult instanceof Promise) {
        [group, activation] = await findGroupResult;
      } else {
        [group, activation] = findGroupResult;
      }
      if (activation) {
        options = { ...options, activation };
      }
    }
    if (options?.preserveFocus && this.editorGroupService.activeModalEditorPart?.groups.some((modalGroup) => modalGroup.id === group.id) && this.editorGroupService.activeModalEditorPart.count === 1 && this.editorGroupService.activeModalEditorPart.groups[0].isEmpty) {
      options = { ...options, preserveFocus: false };
    }
    return group.openEditor(typedEditor, options);
  }
  async openEditors(editors, preferredGroup, options) {
    if (options?.validateTrust) {
      const editorsTrusted = await this.handleWorkspaceTrust(editors);
      if (!editorsTrusted) {
        return [];
      }
    }
    const mapGroupToTypedEditors = /* @__PURE__ */ new Map();
    for (const editor of editors) {
      let typedEditor = void 0;
      let group = void 0;
      if (!isEditorInputWithOptions(editor)) {
        const resolvedEditor = await this.editorResolverService.resolveEditor(editor, preferredGroup);
        if (resolvedEditor === ResolvedStatus.ABORT) {
          continue;
        }
        if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
          typedEditor = resolvedEditor;
          group = resolvedEditor.group;
        }
      }
      if (!typedEditor) {
        typedEditor = isEditorInputWithOptions(editor) ? editor : { editor: await this.textEditorService.resolveTextEditor(editor), options: editor.options };
      }
      if (!group) {
        const findGroupResult = this.instantiationService.invokeFunction(findGroup, typedEditor, preferredGroup);
        if (findGroupResult instanceof Promise) {
          [group] = await findGroupResult;
        } else {
          [group] = findGroupResult;
        }
      }
      if (typedEditor.options?.preserveFocus && this.editorGroupService.activeModalEditorPart?.groups.some((modalGroup) => modalGroup.id === group.id) && this.editorGroupService.activeModalEditorPart.count === 1 && this.editorGroupService.activeModalEditorPart.groups[0].isEmpty) {
        typedEditor = { ...typedEditor, options: { ...typedEditor.options, preserveFocus: false } };
      }
      let targetGroupEditors = mapGroupToTypedEditors.get(group);
      if (!targetGroupEditors) {
        targetGroupEditors = [];
        mapGroupToTypedEditors.set(group, targetGroupEditors);
      }
      targetGroupEditors.push(typedEditor);
    }
    const result = [];
    for (const [group, editors2] of mapGroupToTypedEditors) {
      result.push(group.openEditors(editors2));
    }
    return coalesce(await Promises.settled(result));
  }
  async handleWorkspaceTrust(editors) {
    const { resources, diffMode, mergeMode } = this.extractEditorResources(editors);
    const trustResult = await this.workspaceTrustRequestService.requestOpenFilesTrust(resources);
    switch (trustResult) {
      case WorkspaceTrustUriResponse.Open:
        return true;
      case WorkspaceTrustUriResponse.OpenInNewWindow:
        await this.hostService.openWindow(resources.map((resource) => ({ fileUri: resource })), { forceNewWindow: true, diffMode, mergeMode });
        return false;
      case WorkspaceTrustUriResponse.Cancel:
        return false;
    }
  }
  extractEditorResources(editors) {
    const resources = new ResourceSet();
    let diffMode = false;
    let mergeMode = false;
    for (const editor of editors) {
      if (isEditorInputWithOptions(editor)) {
        const resource = EditorResourceAccessor.getOriginalUri(editor.editor, { supportSideBySide: SideBySideEditor.BOTH });
        if (URI.isUri(resource)) {
          resources.add(resource);
        } else if (resource) {
          if (resource.primary) {
            resources.add(resource.primary);
          }
          if (resource.secondary) {
            resources.add(resource.secondary);
          }
          diffMode = editor.editor instanceof DiffEditorInput;
        }
      } else {
        if (isResourceMergeEditorInput(editor)) {
          if (URI.isUri(editor.input1)) {
            resources.add(editor.input1.resource);
          }
          if (URI.isUri(editor.input2)) {
            resources.add(editor.input2.resource);
          }
          if (URI.isUri(editor.base)) {
            resources.add(editor.base.resource);
          }
          if (URI.isUri(editor.result)) {
            resources.add(editor.result.resource);
          }
          mergeMode = true;
        }
        if (isResourceDiffEditorInput(editor)) {
          if (URI.isUri(editor.original.resource)) {
            resources.add(editor.original.resource);
          }
          if (URI.isUri(editor.modified.resource)) {
            resources.add(editor.modified.resource);
          }
          diffMode = true;
        } else if (isResourceEditorInput(editor)) {
          resources.add(editor.resource);
        }
      }
    }
    return {
      resources: Array.from(resources.keys()),
      diffMode,
      mergeMode
    };
  }
  //#endregion
  //#region isOpened() / isVisible()
  isOpened(editor) {
    return this.editorsObserver.hasEditor({
      resource: this.uriIdentityService.asCanonicalUri(editor.resource),
      typeId: editor.typeId,
      editorId: editor.editorId
    });
  }
  isVisible(editor) {
    for (const group of this.editorGroupsContainer.groups) {
      if (group.activeEditor?.matches(editor)) {
        return true;
      }
    }
    return false;
  }
  //#endregion
  //#region closeEditor()
  async closeEditor({ editor, groupId }, options) {
    const group = this.editorGroupsContainer.getGroup(groupId);
    await group?.closeEditor(editor, options);
  }
  //#endregion
  //#region closeEditors()
  async closeEditors(editors, options) {
    const mapGroupToEditors = /* @__PURE__ */ new Map();
    for (const { editor, groupId } of editors) {
      const group = this.editorGroupsContainer.getGroup(groupId);
      if (!group) {
        continue;
      }
      let editors2 = mapGroupToEditors.get(group);
      if (!editors2) {
        editors2 = [];
        mapGroupToEditors.set(group, editors2);
      }
      editors2.push(editor);
    }
    for (const [group, editors2] of mapGroupToEditors) {
      await group.closeEditors(editors2, options);
    }
  }
  findEditors(arg1, options, arg2) {
    const resource = URI.isUri(arg1) ? arg1 : arg1.resource;
    const typeId = URI.isUri(arg1) ? void 0 : arg1.typeId;
    if (options?.supportSideBySide !== SideBySideEditor.ANY && options?.supportSideBySide !== SideBySideEditor.SECONDARY) {
      if (!this.editorsObserver.hasEditors(resource)) {
        if (URI.isUri(arg1) || isUndefined(arg2)) {
          return [];
        }
        return void 0;
      }
    }
    if (!isUndefined(arg2)) {
      const targetGroup = typeof arg2 === "number" ? this.editorGroupsContainer.getGroup(arg2) : arg2;
      if (URI.isUri(arg1)) {
        if (!targetGroup) {
          return [];
        }
        return targetGroup.findEditors(resource, options);
      } else {
        if (!targetGroup) {
          return void 0;
        }
        const editors = targetGroup.findEditors(resource, options);
        for (const editor of editors) {
          if (editor.typeId === typeId) {
            return editor;
          }
        }
        return void 0;
      }
    } else {
      const result = [];
      for (const group of this.editorGroupsContainer.getGroups(options?.order === EditorsOrder.SEQUENTIAL ? GroupsOrder.GRID_APPEARANCE : GroupsOrder.MOST_RECENTLY_ACTIVE)) {
        const editors = [];
        if (URI.isUri(arg1)) {
          editors.push(...this.findEditors(arg1, options, group));
        } else {
          const editor = this.findEditors(arg1, options, group);
          if (editor) {
            editors.push(editor);
          }
        }
        result.push(...editors.map((editor) => ({ editor, groupId: group.id })));
      }
      return result;
    }
  }
  async replaceEditors(replacements, group) {
    const targetGroup = typeof group === "number" ? this.editorGroupsContainer.getGroup(group) : group;
    const typedReplacements = [];
    for (const replacement of replacements) {
      let typedReplacement = void 0;
      if (!isEditorInput(replacement.replacement)) {
        const resolvedEditor = await this.editorResolverService.resolveEditor(
          replacement.replacement,
          targetGroup
        );
        if (resolvedEditor === ResolvedStatus.ABORT) {
          continue;
        }
        if (isEditorInputWithOptionsAndGroup(resolvedEditor)) {
          typedReplacement = {
            editor: replacement.editor,
            replacement: resolvedEditor.editor,
            options: resolvedEditor.options,
            forceReplaceDirty: replacement.forceReplaceDirty
          };
        }
      }
      if (!typedReplacement) {
        typedReplacement = {
          editor: replacement.editor,
          replacement: isEditorReplacement(replacement) ? replacement.replacement : await this.textEditorService.resolveTextEditor(replacement.replacement),
          options: isEditorReplacement(replacement) ? replacement.options : replacement.replacement.options,
          forceReplaceDirty: replacement.forceReplaceDirty
        };
      }
      typedReplacements.push(typedReplacement);
    }
    return targetGroup?.replaceEditors(typedReplacements);
  }
  //#endregion
  //#region save/revert
  async save(editors, options) {
    if (!Array.isArray(editors)) {
      editors = [editors];
    }
    const uniqueEditors = this.getUniqueEditors(editors);
    const editorsToSaveParallel = [];
    const editorsToSaveSequentially = [];
    if (options?.saveAs) {
      editorsToSaveSequentially.push(...uniqueEditors);
    } else {
      for (const { groupId, editor } of uniqueEditors) {
        if (editor.hasCapability(EditorInputCapabilities.Untitled)) {
          editorsToSaveSequentially.push({ groupId, editor });
        } else {
          editorsToSaveParallel.push({ groupId, editor });
        }
      }
    }
    const saveResults = await Promises.settled(editorsToSaveParallel.map(({ groupId, editor }) => {
      if (options?.reason === SaveReason.EXPLICIT) {
        this.editorGroupsContainer.getGroup(groupId)?.pinEditor(editor);
      }
      return editor.save(groupId, options);
    }));
    for (const { groupId, editor } of editorsToSaveSequentially) {
      if (editor.isDisposed()) {
        continue;
      }
      const editorPane = await this.openEditor(editor, groupId);
      const editorOptions = {
        pinned: true,
        viewState: editorPane?.getViewState()
      };
      const result = options?.saveAs ? await editor.saveAs(groupId, options) : await editor.save(groupId, options);
      saveResults.push(result);
      if (!result) {
        break;
      }
      if (!editor.matches(result)) {
        const targetGroups = editor.hasCapability(EditorInputCapabilities.Untitled) ? this.editorGroupsContainer.groups.map((group) => group.id) : [groupId];
        for (const targetGroup of targetGroups) {
          if (result instanceof EditorInput) {
            await this.replaceEditors([{ editor, replacement: result, options: editorOptions }], targetGroup);
          } else {
            await this.replaceEditors([{ editor, replacement: { ...result, options: editorOptions } }], targetGroup);
          }
        }
      }
    }
    return {
      success: saveResults.every((result) => !!result),
      editors: coalesce(saveResults)
    };
  }
  saveAll(options) {
    return this.save(this.getAllModifiedEditors(options), options);
  }
  async revert(editors, options) {
    if (!Array.isArray(editors)) {
      editors = [editors];
    }
    const uniqueEditors = this.getUniqueEditors(editors);
    await Promises.settled(uniqueEditors.map(async ({ groupId, editor }) => {
      this.editorGroupsContainer.getGroup(groupId)?.pinEditor(editor);
      return editor.revert(groupId, options);
    }));
    return !uniqueEditors.some(({ editor }) => editor.isDirty());
  }
  async revertAll(options) {
    return this.revert(this.getAllModifiedEditors(options), options);
  }
  getAllModifiedEditors(options) {
    const editors = [];
    for (const group of this.editorGroupsContainer.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      for (const editor of group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
        if (!editor.isModified()) {
          continue;
        }
        if ((typeof options?.includeUntitled === "boolean" || !options?.includeUntitled?.includeScratchpad) && editor.hasCapability(EditorInputCapabilities.Scratchpad)) {
          continue;
        }
        if (!options?.includeUntitled && editor.hasCapability(EditorInputCapabilities.Untitled)) {
          continue;
        }
        if (options?.excludeSticky && group.isSticky(editor)) {
          continue;
        }
        editors.push({ groupId: group.id, editor });
      }
    }
    return editors;
  }
  getUniqueEditors(editors) {
    const uniqueEditors = [];
    for (const { editor, groupId } of editors) {
      if (uniqueEditors.some((uniqueEditor) => uniqueEditor.editor.matches(editor))) {
        continue;
      }
      uniqueEditors.push({ editor, groupId });
    }
    return uniqueEditors;
  }
  //#endregion
  dispose() {
    super.dispose();
    this.activeOutOfWorkspaceWatchers.forEach((disposable) => dispose(disposable));
    this.activeOutOfWorkspaceWatchers.clear();
  }
};
EditorService = __decorateClass([
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, IEditorResolverService),
  __decorateParam(8, IWorkspaceTrustRequestService),
  __decorateParam(9, IHostService),
  __decorateParam(10, ITextEditorService)
], EditorService);
registerSingleton(IEditorService, new SyncDescriptor(EditorService, [void 0], false));
export {
  EditorService
};
