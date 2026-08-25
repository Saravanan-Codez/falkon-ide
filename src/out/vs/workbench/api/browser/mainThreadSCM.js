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
import { Barrier } from "../../../base/common/async.js";
import { isUriComponents, URI } from "../../../base/common/uri.js";
import { Event, Emitter } from "../../../base/common/event.js";
import { observableValue, observableValueOpts, transaction } from "../../../base/common/observable.js";
import { DisposableStore, combinedDisposable, dispose, Disposable } from "../../../base/common/lifecycle.js";
import { ISCMService, ISCMViewService } from "../../contrib/scm/common/scm.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IQuickDiffService } from "../../contrib/scm/common/quickDiff.js";
import { ResourceTree } from "../../../base/common/resourceTree.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../platform/workspace/common/workspace.js";
import { basename } from "../../../base/common/resources.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { Schemas } from "../../../base/common/network.js";
import { structuralEquals } from "../../../base/common/equals.js";
import { historyItemBaseRefColor, historyItemRefColor, historyItemRemoteRefColor } from "../../contrib/scm/browser/scmHistory.js";
function getIconFromIconDto(iconDto) {
  if (iconDto === void 0) {
    return void 0;
  } else if (ThemeIcon.isThemeIcon(iconDto)) {
    return iconDto;
  } else if (isUriComponents(iconDto)) {
    return URI.revive(iconDto);
  } else {
    const icon = iconDto;
    return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
  }
}
function toISCMHistoryItem(historyItemDto) {
  const authorIcon = getIconFromIconDto(historyItemDto.authorIcon);
  const references = historyItemDto.references?.map((r) => ({
    ...r,
    icon: getIconFromIconDto(r.icon)
  }));
  return { ...historyItemDto, authorIcon, references };
}
function toISCMHistoryItemRef(historyItemRefDto, color) {
  return historyItemRefDto ? { ...historyItemRefDto, icon: getIconFromIconDto(historyItemRefDto.icon), color } : void 0;
}
class SCMInputBoxContentProvider extends Disposable {
  constructor(textModelService, modelService, languageService) {
    super();
    this.modelService = modelService;
    this.languageService = languageService;
    this._register(textModelService.registerTextModelContentProvider(Schemas.vscodeSourceControl, this));
  }
  async provideTextContent(resource) {
    const existing = this.modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    return this.modelService.createModel("", this.languageService.createById("scminput"), resource);
  }
}
class MainThreadSCMResourceGroup {
  constructor(sourceControlHandle, handle, provider, features, label, id, multiDiffEditorEnableViewChanges, _uriIdentService) {
    this.sourceControlHandle = sourceControlHandle;
    this.handle = handle;
    this.provider = provider;
    this.features = features;
    this.label = label;
    this.id = id;
    this.multiDiffEditorEnableViewChanges = multiDiffEditorEnableViewChanges;
    this._uriIdentService = _uriIdentService;
    this.resources = [];
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeResources = new Emitter();
    this.onDidChangeResources = this._onDidChangeResources.event;
  }
  get resourceTree() {
    if (!this._resourceTree) {
      const rootUri = this.provider.rootUri ?? URI.file("/");
      this._resourceTree = new ResourceTree(this, rootUri, this._uriIdentService.extUri);
      for (const resource of this.resources) {
        this._resourceTree.add(resource.sourceUri, resource);
      }
    }
    return this._resourceTree;
  }
  get hideWhenEmpty() {
    return !!this.features.hideWhenEmpty;
  }
  get contextValue() {
    return this.features.contextValue;
  }
  toJSON() {
    return {
      $mid: MarshalledId.ScmResourceGroup,
      sourceControlHandle: this.sourceControlHandle,
      groupHandle: this.handle
    };
  }
  splice(start, deleteCount, toInsert) {
    this.resources.splice(start, deleteCount, ...toInsert);
    this._resourceTree = void 0;
    this._onDidChangeResources.fire();
  }
  $updateGroup(features) {
    this.features = { ...this.features, ...features };
    this._onDidChange.fire();
  }
  $updateGroupLabel(label) {
    this.label = label;
    this._onDidChange.fire();
  }
}
class MainThreadSCMResource {
  constructor(proxy, sourceControlHandle, groupHandle, handle, sourceUri, resourceGroup, decorations, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri) {
    this.proxy = proxy;
    this.sourceControlHandle = sourceControlHandle;
    this.groupHandle = groupHandle;
    this.handle = handle;
    this.sourceUri = sourceUri;
    this.resourceGroup = resourceGroup;
    this.decorations = decorations;
    this.contextValue = contextValue;
    this.command = command;
    this.multiDiffEditorOriginalUri = multiDiffEditorOriginalUri;
    this.multiDiffEditorModifiedUri = multiDiffEditorModifiedUri;
  }
  open(preserveFocus) {
    return this.proxy.$executeResourceCommand(this.sourceControlHandle, this.groupHandle, this.handle, preserveFocus);
  }
  toJSON() {
    return {
      $mid: MarshalledId.ScmResource,
      sourceControlHandle: this.sourceControlHandle,
      groupHandle: this.groupHandle,
      handle: this.handle
    };
  }
}
class MainThreadSCMArtifactProvider {
  constructor(proxy, handle) {
    this.proxy = proxy;
    this.handle = handle;
    this._onDidChangeArtifacts = new Emitter();
    this.onDidChangeArtifacts = this._onDidChangeArtifacts.event;
    this._disposables = new DisposableStore();
    this._disposables.add(this._onDidChangeArtifacts);
  }
  async provideArtifactGroups(token) {
    const artifactGroups = await this.proxy.$provideArtifactGroups(this.handle, token ?? CancellationToken.None);
    return artifactGroups?.map((group) => ({ ...group, icon: getIconFromIconDto(group.icon) }));
  }
  async provideArtifacts(group, token) {
    const artifacts = await this.proxy.$provideArtifacts(this.handle, group, token ?? CancellationToken.None);
    return artifacts?.map((artifact) => ({ ...artifact, icon: getIconFromIconDto(artifact.icon) }));
  }
  $onDidChangeArtifacts(groups) {
    this._onDidChangeArtifacts.fire(groups);
  }
  dispose() {
    this._disposables.dispose();
  }
}
class MainThreadSCMHistoryProvider {
  constructor(proxy, handle) {
    this.proxy = proxy;
    this.handle = handle;
    this._historyItemRef = observableValueOpts({
      owner: this,
      equalsFn: structuralEquals
    }, void 0);
    this._historyItemRemoteRef = observableValueOpts({
      owner: this,
      equalsFn: structuralEquals
    }, void 0);
    this._historyItemBaseRef = observableValueOpts({
      owner: this,
      equalsFn: structuralEquals
    }, void 0);
    this._historyItemRefChanges = observableValue(this, { added: [], modified: [], removed: [], silent: false });
  }
  get historyItemRef() {
    return this._historyItemRef;
  }
  get historyItemRemoteRef() {
    return this._historyItemRemoteRef;
  }
  get historyItemBaseRef() {
    return this._historyItemBaseRef;
  }
  get historyItemRefChanges() {
    return this._historyItemRefChanges;
  }
  async resolveHistoryItem(historyItemId, token) {
    const historyItem = await this.proxy.$resolveHistoryItem(this.handle, historyItemId, token ?? CancellationToken.None);
    return historyItem ? toISCMHistoryItem(historyItem) : void 0;
  }
  async resolveHistoryItemChatContext(historyItemId, token) {
    return this.proxy.$resolveHistoryItemChatContext(this.handle, historyItemId, token ?? CancellationToken.None);
  }
  async resolveHistoryItemChangeRangeChatContext(historyItemId, historyItemParentId, path, token) {
    return this.proxy.$resolveHistoryItemChangeRangeChatContext(this.handle, historyItemId, historyItemParentId, path, token ?? CancellationToken.None);
  }
  async resolveHistoryItemRefsCommonAncestor(historyItemRefs, token) {
    return this.proxy.$resolveHistoryItemRefsCommonAncestor(this.handle, historyItemRefs, token ?? CancellationToken.None);
  }
  async provideHistoryItemRefs(historyItemsRefs, token) {
    const historyItemRefs = await this.proxy.$provideHistoryItemRefs(this.handle, historyItemsRefs, token ?? CancellationToken.None);
    return historyItemRefs?.map((ref) => ({ ...ref, icon: getIconFromIconDto(ref.icon) }));
  }
  async provideHistoryItems(options, token) {
    const historyItems = await this.proxy.$provideHistoryItems(this.handle, options, token ?? CancellationToken.None);
    return historyItems?.map((historyItem) => toISCMHistoryItem(historyItem));
  }
  async provideHistoryItemChanges(historyItemId, historyItemParentId, token) {
    const changes = await this.proxy.$provideHistoryItemChanges(this.handle, historyItemId, historyItemParentId, token ?? CancellationToken.None);
    return changes?.map((change) => ({
      uri: URI.revive(change.uri),
      originalUri: change.originalUri && URI.revive(change.originalUri),
      modifiedUri: change.modifiedUri && URI.revive(change.modifiedUri)
    }));
  }
  $onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
    transaction((tx) => {
      this._historyItemRef.set(toISCMHistoryItemRef(historyItemRef, historyItemRefColor), tx);
      this._historyItemRemoteRef.set(toISCMHistoryItemRef(historyItemRemoteRef, historyItemRemoteRefColor), tx);
      this._historyItemBaseRef.set(toISCMHistoryItemRef(historyItemBaseRef, historyItemBaseRefColor), tx);
    });
  }
  $onDidChangeHistoryItemRefs(historyItemRefs) {
    const added = historyItemRefs.added.map((ref) => toISCMHistoryItemRef(ref));
    const modified = historyItemRefs.modified.map((ref) => toISCMHistoryItemRef(ref));
    const removed = historyItemRefs.removed.map((ref) => toISCMHistoryItemRef(ref));
    this._historyItemRefChanges.set({ added, modified, removed, silent: historyItemRefs.silent }, void 0);
  }
}
class MainThreadSCMProvider {
  constructor(proxy, _handle, _parentHandle, _providerId, _label, _rootUri, _iconPath, _isHidden, _inputBoxTextModel, _quickDiffService, _uriIdentService, _workspaceContextService) {
    this.proxy = proxy;
    this._handle = _handle;
    this._parentHandle = _parentHandle;
    this._providerId = _providerId;
    this._label = _label;
    this._rootUri = _rootUri;
    this._iconPath = _iconPath;
    this._isHidden = _isHidden;
    this._inputBoxTextModel = _inputBoxTextModel;
    this._quickDiffService = _quickDiffService;
    this._uriIdentService = _uriIdentService;
    this._workspaceContextService = _workspaceContextService;
    this.groups = [];
    this._onDidChangeResourceGroups = new Emitter();
    this.onDidChangeResourceGroups = this._onDidChangeResourceGroups.event;
    this._onDidChangeResources = new Emitter();
    this.onDidChangeResources = this._onDidChangeResources.event;
    this._groupsByHandle = /* @__PURE__ */ Object.create(null);
    // get groups(): ISequence<ISCMResourceGroup> {
    // 	return {
    // 		elements: this._groups,
    // 		onDidSplice: this._onDidSplice.event
    // 	};
    // 	// return this._groups
    // 	// 	.filter(g => g.resources.elements.length > 0 || !g.features.hideWhenEmpty);
    // }
    this.features = {};
    this._contextValue = observableValue(this, void 0);
    this._count = observableValue(this, void 0);
    this._statusBarCommands = observableValue(this, void 0);
    this._commitTemplate = observableValue(this, "");
    this._actionButton = observableValue(this, void 0);
    this._artifactProvider = observableValue(this, void 0);
    this._historyProvider = observableValue(this, void 0);
    if (_rootUri) {
      const folder = this._workspaceContextService.getWorkspaceFolder(_rootUri);
      if (folder?.uri.toString() === _rootUri.toString()) {
        this._name = folder.name;
      } else if (_rootUri.path !== "/") {
        this._name = basename(_rootUri);
      }
    }
  }
  get id() {
    return `scm${this._handle}`;
  }
  get parentId() {
    return this._parentHandle !== void 0 ? `scm${this._parentHandle}` : void 0;
  }
  get providerId() {
    return this._providerId;
  }
  get handle() {
    return this._handle;
  }
  get label() {
    return this._label;
  }
  get rootUri() {
    return this._rootUri;
  }
  get iconPath() {
    return this._iconPath;
  }
  get isHidden() {
    return this._isHidden;
  }
  get inputBoxTextModel() {
    return this._inputBoxTextModel;
  }
  get contextValue() {
    return this._contextValue;
  }
  get acceptInputCommand() {
    return this.features.acceptInputCommand;
  }
  get count() {
    return this._count;
  }
  get statusBarCommands() {
    return this._statusBarCommands;
  }
  get name() {
    return this._name ?? this._label;
  }
  get commitTemplate() {
    return this._commitTemplate;
  }
  get actionButton() {
    return this._actionButton;
  }
  get artifactProvider() {
    return this._artifactProvider;
  }
  get historyProvider() {
    return this._historyProvider;
  }
  $updateSourceControl(features) {
    this.features = { ...this.features, ...features };
    if (typeof features.commitTemplate !== "undefined") {
      this._commitTemplate.set(features.commitTemplate, void 0);
    }
    if (typeof features.actionButton !== "undefined") {
      this._actionButton.set(features.actionButton ?? void 0, void 0);
    }
    if (typeof features.contextValue !== "undefined") {
      this._contextValue.set(features.contextValue, void 0);
    }
    if (typeof features.count !== "undefined") {
      this._count.set(features.count, void 0);
    }
    if (typeof features.statusBarCommands !== "undefined") {
      this._statusBarCommands.set(features.statusBarCommands, void 0);
    }
    if (features.hasQuickDiffProvider && !this._quickDiff) {
      this._quickDiff = this._quickDiffService.addQuickDiffProvider({
        id: `${this._providerId}.quickDiffProvider`,
        label: features.quickDiffLabel ?? this.label,
        rootUri: this.rootUri,
        kind: "primary",
        getOriginalResource: async (uri) => {
          if (!this.features.hasQuickDiffProvider) {
            return null;
          }
          const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
          return result && URI.revive(result);
        }
      });
    } else if (features.hasQuickDiffProvider === false && this._quickDiff) {
      this._quickDiff.dispose();
      this._quickDiff = void 0;
    }
    if (features.hasSecondaryQuickDiffProvider && !this._stagedQuickDiff) {
      this._stagedQuickDiff = this._quickDiffService.addQuickDiffProvider({
        id: `${this._providerId}.secondaryQuickDiffProvider`,
        label: features.secondaryQuickDiffLabel ?? this.label,
        rootUri: this.rootUri,
        kind: "secondary",
        getOriginalResource: async (uri) => {
          if (!this.features.hasSecondaryQuickDiffProvider) {
            return null;
          }
          const result = await this.proxy.$provideSecondaryOriginalResource(this.handle, uri, CancellationToken.None);
          return result && URI.revive(result);
        }
      });
    } else if (features.hasSecondaryQuickDiffProvider === false && this._stagedQuickDiff) {
      this._stagedQuickDiff.dispose();
      this._stagedQuickDiff = void 0;
    }
    if (features.hasArtifactProvider && !this.artifactProvider.get()) {
      const artifactProvider = new MainThreadSCMArtifactProvider(this.proxy, this.handle);
      this._artifactProvider.set(artifactProvider, void 0);
    } else if (features.hasArtifactProvider === false && this.artifactProvider.get()) {
      this._artifactProvider.get()?.dispose();
      this._artifactProvider.set(void 0, void 0);
    }
    if (features.hasHistoryProvider && !this.historyProvider.get()) {
      const historyProvider = new MainThreadSCMHistoryProvider(this.proxy, this.handle);
      this._historyProvider.set(historyProvider, void 0);
    } else if (features.hasHistoryProvider === false && this.historyProvider.get()) {
      this._historyProvider.set(void 0, void 0);
    }
  }
  $registerGroups(_groups) {
    const groups = _groups.map(([handle, id, label, features, multiDiffEditorEnableViewChanges]) => {
      const group = new MainThreadSCMResourceGroup(
        this.handle,
        handle,
        this,
        features,
        label,
        id,
        multiDiffEditorEnableViewChanges,
        this._uriIdentService
      );
      this._groupsByHandle[handle] = group;
      return group;
    });
    this.groups.splice(this.groups.length, 0, ...groups);
    this._onDidChangeResourceGroups.fire();
  }
  $updateGroup(handle, features) {
    const group = this._groupsByHandle[handle];
    if (!group) {
      return;
    }
    group.$updateGroup(features);
  }
  $updateGroupLabel(handle, label) {
    const group = this._groupsByHandle[handle];
    if (!group) {
      return;
    }
    group.$updateGroupLabel(label);
  }
  $spliceGroupResourceStates(splices) {
    for (const [groupHandle, groupSlices] of splices) {
      const group = this._groupsByHandle[groupHandle];
      if (!group) {
        console.warn(`SCM group ${groupHandle} not found in provider ${this.label}`);
        continue;
      }
      groupSlices.reverse();
      for (const [start, deleteCount, rawResources] of groupSlices) {
        const resources = rawResources.map((rawResource) => {
          const [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri] = rawResource;
          const [light, dark] = icons;
          const icon = ThemeIcon.isThemeIcon(light) ? light : URI.revive(light);
          const iconDark = (ThemeIcon.isThemeIcon(dark) ? dark : URI.revive(dark)) || icon;
          const decorations = {
            icon,
            iconDark,
            tooltip,
            strikeThrough,
            faded
          };
          return new MainThreadSCMResource(
            this.proxy,
            this.handle,
            groupHandle,
            handle,
            URI.revive(sourceUri),
            group,
            decorations,
            contextValue || void 0,
            command,
            URI.revive(multiDiffEditorOriginalUri),
            URI.revive(multiDiffEditorModifiedUri)
          );
        });
        group.splice(start, deleteCount, resources);
      }
    }
    this._onDidChangeResources.fire();
  }
  $unregisterGroup(handle) {
    const group = this._groupsByHandle[handle];
    if (!group) {
      return;
    }
    delete this._groupsByHandle[handle];
    this.groups.splice(this.groups.indexOf(group), 1);
    this._onDidChangeResourceGroups.fire();
  }
  async getOriginalResource(uri) {
    if (!this.features.hasQuickDiffProvider) {
      return null;
    }
    const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
    return result && URI.revive(result);
  }
  $onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
    const provider = this.historyProvider.get();
    if (!provider) {
      return;
    }
    provider.$onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
  }
  $onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs) {
    const provider = this.historyProvider.get();
    if (!provider) {
      return;
    }
    provider.$onDidChangeHistoryItemRefs(historyItemRefs);
  }
  $onDidChangeArtifacts(groups) {
    const provider = this.artifactProvider.get();
    if (!provider) {
      return;
    }
    provider.$onDidChangeArtifacts(groups);
  }
  toJSON() {
    return {
      $mid: MarshalledId.ScmProvider,
      handle: this.handle
    };
  }
  dispose() {
    this._onDidChangeResourceGroups.dispose();
    this._onDidChangeResources.dispose();
    this._artifactProvider.get()?.dispose();
    this._stagedQuickDiff?.dispose();
    this._quickDiff?.dispose();
  }
}
let MainThreadSCM = class {
  constructor(extHostContext, scmService, scmViewService, languageService, modelService, textModelService, quickDiffService, _uriIdentService, workspaceContextService) {
    this.scmService = scmService;
    this.scmViewService = scmViewService;
    this.languageService = languageService;
    this.modelService = modelService;
    this.textModelService = textModelService;
    this.quickDiffService = quickDiffService;
    this._uriIdentService = _uriIdentService;
    this.workspaceContextService = workspaceContextService;
    this._repositories = /* @__PURE__ */ new Map();
    this._repositoryBarriers = /* @__PURE__ */ new Map();
    this._repositoryDisposables = /* @__PURE__ */ new Map();
    this._disposables = new DisposableStore();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSCM);
    this._disposables.add(new SCMInputBoxContentProvider(this.textModelService, this.modelService, this.languageService));
  }
  dispose() {
    dispose(this._repositories.values());
    this._repositories.clear();
    dispose(this._repositoryDisposables.values());
    this._repositoryDisposables.clear();
    this._disposables.dispose();
  }
  async $registerSourceControl(handle, parentHandle, id, label, rootUri, iconPath, isHidden, inputBoxDocumentUri) {
    this._repositoryBarriers.set(handle, new Barrier());
    const inputBoxTextModelRef = await this.textModelService.createModelReference(URI.revive(inputBoxDocumentUri));
    const provider = new MainThreadSCMProvider(this._proxy, handle, parentHandle, id, label, rootUri ? URI.revive(rootUri) : void 0, getIconFromIconDto(iconPath), isHidden, inputBoxTextModelRef.object.textEditorModel, this.quickDiffService, this._uriIdentService, this.workspaceContextService);
    const repository = this.scmService.registerSCMProvider(provider);
    this._repositories.set(handle, repository);
    const disposable = combinedDisposable(
      inputBoxTextModelRef,
      Event.filter(this.scmViewService.onDidFocusRepository, (r) => r === repository)((_) => this._proxy.$setSelectedSourceControl(handle)),
      repository.input.onDidChange(({ value }) => this._proxy.$onInputBoxValueChange(handle, value))
    );
    this._repositoryDisposables.set(handle, disposable);
    if (this.scmViewService.focusedRepository === repository) {
      setTimeout(() => this._proxy.$setSelectedSourceControl(handle), 0);
    }
    if (repository.input.value) {
      setTimeout(() => this._proxy.$onInputBoxValueChange(handle, repository.input.value), 0);
    }
    this._repositoryBarriers.get(handle)?.open();
  }
  async $updateSourceControl(handle, features) {
    await this._repositoryBarriers.get(handle)?.wait();
    const repository = this._repositories.get(handle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$updateSourceControl(features);
  }
  async $unregisterSourceControl(handle) {
    await this._repositoryBarriers.get(handle)?.wait();
    const repository = this._repositories.get(handle);
    if (!repository) {
      return;
    }
    this._repositoryDisposables.get(handle).dispose();
    this._repositoryDisposables.delete(handle);
    repository.dispose();
    this._repositories.delete(handle);
  }
  async $registerGroups(sourceControlHandle, groups, splices) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$registerGroups(groups);
    provider.$spliceGroupResourceStates(splices);
  }
  async $updateGroup(sourceControlHandle, groupHandle, features) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$updateGroup(groupHandle, features);
  }
  async $updateGroupLabel(sourceControlHandle, groupHandle, label) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$updateGroupLabel(groupHandle, label);
  }
  async $spliceResourceStates(sourceControlHandle, splices) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$spliceGroupResourceStates(splices);
  }
  async $unregisterGroup(sourceControlHandle, handle) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$unregisterGroup(handle);
  }
  async $setInputBoxValue(sourceControlHandle, value) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.setValue(value, false);
  }
  async $setInputBoxPlaceholder(sourceControlHandle, placeholder) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.placeholder = placeholder;
  }
  async $setInputBoxEnablement(sourceControlHandle, enabled) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.enabled = enabled;
  }
  async $setInputBoxVisibility(sourceControlHandle, visible) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.visible = visible;
  }
  async $showValidationMessage(sourceControlHandle, message, type) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    repository.input.showValidationMessage(message, type);
  }
  async $setValidationProviderIsEnabled(sourceControlHandle, enabled) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    if (enabled) {
      repository.input.validateInput = async (value, pos) => {
        const result = await this._proxy.$validateInput(sourceControlHandle, value, pos);
        return result && { message: result[0], type: result[1] };
      };
    } else {
      repository.input.validateInput = async () => void 0;
    }
  }
  async $onDidChangeHistoryProviderCurrentHistoryItemRefs(sourceControlHandle, historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
  }
  async $onDidChangeHistoryProviderHistoryItemRefs(sourceControlHandle, historyItemRefs) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs);
  }
  async $onDidChangeArtifacts(sourceControlHandle, groups) {
    await this._repositoryBarriers.get(sourceControlHandle)?.wait();
    const repository = this._repositories.get(sourceControlHandle);
    if (!repository) {
      return;
    }
    const provider = repository.provider;
    provider.$onDidChangeArtifacts(groups);
  }
};
MainThreadSCM = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadSCM),
  __decorateParam(1, ISCMService),
  __decorateParam(2, ISCMViewService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ITextModelService),
  __decorateParam(6, IQuickDiffService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IWorkspaceContextService)
], MainThreadSCM);
export {
  MainThreadSCM
};
