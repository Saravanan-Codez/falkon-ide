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
import { isCancellationError } from "../../../base/common/errors.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { isNative } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { IRequestService } from "../../../platform/request/common/request.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from "../../../platform/workspace/common/workspaceTrust.js";
import { IWorkspaceContextService, isUntitledWorkspace } from "../../../platform/workspace/common/workspace.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { checkGlobFileExists } from "../../services/extensions/common/workspaceContains.js";
import { QueryBuilder } from "../../services/search/common/queryBuilder.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { ISearchService } from "../../services/search/common/search.js";
import { IWorkspaceEditingService } from "../../services/workspaces/common/workspaceEditing.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IEditSessionIdentityService } from "../../../platform/workspace/common/editSessions.js";
import { EditorResourceAccessor, SaveReason, SideBySideEditor } from "../../common/editor.js";
import { coalesce } from "../../../base/common/arrays.js";
import { ICanonicalUriService } from "../../../platform/workspace/common/canonicalUri.js";
import { revive } from "../../../base/common/marshalling.js";
import { ITextFileService } from "../../services/textfile/common/textfiles.js";
let MainThreadWorkspace = class extends Disposable {
  constructor(extHostContext, _searchService, _contextService, _editSessionIdentityService, _canonicalUriService, _editorService, _workspaceEditingService, _notificationService, _requestService, _instantiationService, _labelService, _environmentService, fileService, _workspaceTrustManagementService, _workspaceTrustRequestService, _textFileService) {
    super();
    this._searchService = _searchService;
    this._contextService = _contextService;
    this._editSessionIdentityService = _editSessionIdentityService;
    this._canonicalUriService = _canonicalUriService;
    this._editorService = _editorService;
    this._workspaceEditingService = _workspaceEditingService;
    this._notificationService = _notificationService;
    this._requestService = _requestService;
    this._instantiationService = _instantiationService;
    this._labelService = _labelService;
    this._environmentService = _environmentService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._workspaceTrustRequestService = _workspaceTrustRequestService;
    this._textFileService = _textFileService;
    this._activeCancelTokens = /* @__PURE__ */ Object.create(null);
    // --- edit sessions ---
    this.registeredEditSessionProviders = this._register(new DisposableMap());
    // --- canonical uri identities ---
    this.registeredCanonicalUriProviders = this._register(new DisposableMap());
    this._queryBuilder = this._instantiationService.createInstance(QueryBuilder);
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostWorkspace);
    const workspace = this._contextService.getWorkspace();
    if (workspace.configuration && !isNative && !fileService.hasProvider(workspace.configuration)) {
      this._proxy.$initializeWorkspace(this.getWorkspaceData(workspace), this.isWorkspaceTrusted());
    } else {
      this._contextService.getCompleteWorkspace().then((workspace2) => this._proxy.$initializeWorkspace(this.getWorkspaceData(workspace2), this.isWorkspaceTrusted()));
    }
    this._register(this._contextService.onDidChangeWorkspaceFolders(this._onDidChangeWorkspace, this));
    this._register(this._contextService.onDidChangeWorkbenchState(this._onDidChangeWorkspace, this));
    this._register(this._workspaceTrustManagementService.onDidChangeTrust(this._onDidGrantWorkspaceTrust, this));
    this._register(this._workspaceTrustManagementService.onDidChangeTrustedFolders(this._onDidChangeWorkspaceTrustedFolders, this));
  }
  dispose() {
    super.dispose();
    for (const requestId in this._activeCancelTokens) {
      const tokenSource = this._activeCancelTokens[requestId];
      tokenSource.cancel();
    }
  }
  // --- workspace ---
  $updateWorkspaceFolders(extensionName, index, deleteCount, foldersToAdd) {
    const workspaceFoldersToAdd = foldersToAdd.map((f) => ({ uri: URI.revive(f.uri), name: f.name }));
    this._notificationService.status(this.getStatusMessage(extensionName, workspaceFoldersToAdd.length, deleteCount), {
      hideAfter: 10 * 1e3
      /* 10s */
    });
    return this._workspaceEditingService.updateFolders(index, deleteCount, workspaceFoldersToAdd, true);
  }
  getStatusMessage(extensionName, addCount, removeCount) {
    let message;
    const wantsToAdd = addCount > 0;
    const wantsToDelete = removeCount > 0;
    if (wantsToAdd && !wantsToDelete) {
      if (addCount === 1) {
        message = localize("folderStatusMessageAddSingleFolder", "Extension '{0}' added 1 folder to the workspace", extensionName);
      } else {
        message = localize("folderStatusMessageAddMultipleFolders", "Extension '{0}' added {1} folders to the workspace", extensionName, addCount);
      }
    } else if (wantsToDelete && !wantsToAdd) {
      if (removeCount === 1) {
        message = localize("folderStatusMessageRemoveSingleFolder", "Extension '{0}' removed 1 folder from the workspace", extensionName);
      } else {
        message = localize("folderStatusMessageRemoveMultipleFolders", "Extension '{0}' removed {1} folders from the workspace", extensionName, removeCount);
      }
    } else {
      message = localize("folderStatusChangeFolder", "Extension '{0}' changed folders of the workspace", extensionName);
    }
    return message;
  }
  _onDidChangeWorkspace() {
    this._proxy.$acceptWorkspaceData(this.getWorkspaceData(this._contextService.getWorkspace()));
  }
  getWorkspaceData(workspace) {
    if (!this._contextService.hasWorkspaceData()) {
      return null;
    }
    return {
      configuration: workspace.configuration || void 0,
      isUntitled: workspace.configuration ? isUntitledWorkspace(workspace.configuration, this._environmentService) : false,
      folders: workspace.folders,
      id: workspace.id,
      name: this._labelService.getWorkspaceLabel(workspace),
      transient: workspace.transient
    };
  }
  // --- search ---
  $startFileSearch(_includeFolder, options, token) {
    const includeFolder = URI.revive(_includeFolder);
    const workspace = this._contextService.getWorkspace();
    const query = this._queryBuilder.file(
      includeFolder ? [includeFolder] : workspace.folders,
      revive(options)
    );
    return this._searchService.fileSearch(query, token).then((result) => {
      return result.results.map((m) => m.resource);
    }, (err) => {
      if (!isCancellationError(err)) {
        return Promise.reject(err);
      }
      return null;
    });
  }
  $startTextSearch(pattern, _folder, options, requestId, token) {
    const folder = URI.revive(_folder);
    const workspace = this._contextService.getWorkspace();
    const folders = folder ? [folder] : workspace.folders.map((folder2) => folder2.uri);
    const query = this._queryBuilder.text(pattern, folders, revive(options));
    query._reason = "startTextSearch";
    const onProgress = (p) => {
      if (p.results) {
        this._proxy.$handleTextSearchResult(p, requestId);
      }
    };
    const search = this._searchService.textSearch(query, token, onProgress).then(
      (result) => {
        return { limitHit: result.limitHit };
      },
      (err) => {
        if (!isCancellationError(err)) {
          return Promise.reject(err);
        }
        return null;
      }
    );
    return search;
  }
  $checkExists(folders, includes, token) {
    return this._instantiationService.invokeFunction((accessor) => checkGlobFileExists(accessor, folders, includes, token));
  }
  // --- save & edit resources ---
  async $save(uriComponents, options) {
    const uri = URI.revive(uriComponents);
    const editors = [...this._editorService.findEditors(uri, { supportSideBySide: SideBySideEditor.PRIMARY })];
    const result = await this._editorService.save(editors, {
      reason: SaveReason.EXPLICIT,
      saveAs: options.saveAs,
      force: !options.saveAs
    });
    return this._saveResultToUris(result).at(0);
  }
  _saveResultToUris(result) {
    if (!result.success) {
      return [];
    }
    return coalesce(result.editors.map((editor) => EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY })));
  }
  $saveAll(includeUntitled) {
    return this._editorService.saveAll({ includeUntitled }).then((res) => res.success);
  }
  $resolveProxy(url) {
    return this._requestService.resolveProxy(url);
  }
  $lookupAuthorization(authInfo) {
    return this._requestService.lookupAuthorization(authInfo);
  }
  $lookupKerberosAuthorization(url) {
    return this._requestService.lookupKerberosAuthorization(url);
  }
  $loadCertificates() {
    return this._requestService.loadCertificates();
  }
  // --- trust ---
  $requestResourceTrust(optionsDto) {
    const options = { ...optionsDto, uri: URI.revive(optionsDto.uri) };
    return this._workspaceTrustRequestService.requestResourcesTrust(options);
  }
  $requestWorkspaceTrust(options) {
    return this._workspaceTrustRequestService.requestWorkspaceTrust(options);
  }
  async $isResourceTrusted(resource) {
    const uri = URI.revive(resource);
    const trustInfo = await this._workspaceTrustManagementService.getUriTrustInfo(uri);
    return trustInfo.trusted;
  }
  isWorkspaceTrusted() {
    return this._workspaceTrustManagementService.isWorkspaceTrusted();
  }
  _onDidGrantWorkspaceTrust() {
    this._proxy.$onDidGrantWorkspaceTrust();
  }
  _onDidChangeWorkspaceTrustedFolders() {
    this._proxy.$onDidChangeWorkspaceTrustedFolders();
  }
  $registerEditSessionIdentityProvider(handle, scheme) {
    const disposable = this._editSessionIdentityService.registerEditSessionIdentityProvider({
      scheme,
      getEditSessionIdentifier: async (workspaceFolder, token) => {
        return this._proxy.$getEditSessionIdentifier(workspaceFolder.uri, token);
      },
      provideEditSessionIdentityMatch: async (workspaceFolder, identity1, identity2, token) => {
        return this._proxy.$provideEditSessionIdentityMatch(workspaceFolder.uri, identity1, identity2, token);
      }
    });
    this.registeredEditSessionProviders.set(handle, disposable);
  }
  $unregisterEditSessionIdentityProvider(handle) {
    this.registeredEditSessionProviders.deleteAndDispose(handle);
  }
  $registerCanonicalUriProvider(handle, scheme) {
    const disposable = this._canonicalUriService.registerCanonicalUriProvider({
      scheme,
      provideCanonicalUri: async (uri, targetScheme, token) => {
        const result = await this._proxy.$provideCanonicalUri(uri, targetScheme, token);
        if (result) {
          return URI.revive(result);
        }
        return result;
      }
    });
    this.registeredCanonicalUriProviders.set(handle, disposable);
  }
  $unregisterCanonicalUriProvider(handle) {
    this.registeredCanonicalUriProviders.deleteAndDispose(handle);
  }
  // --- encodings
  $resolveDecoding(resource, options) {
    return this._textFileService.resolveDecoding(URI.revive(resource), options);
  }
  $validateDetectedEncoding(resource, detectedEncoding, options) {
    return this._textFileService.validateDetectedEncoding(URI.revive(resource), detectedEncoding, options);
  }
  $resolveEncoding(resource, options) {
    return this._textFileService.resolveEncoding(URI.revive(resource), options);
  }
};
MainThreadWorkspace = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadWorkspace),
  __decorateParam(1, ISearchService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IEditSessionIdentityService),
  __decorateParam(4, ICanonicalUriService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IWorkspaceEditingService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IRequestService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IEnvironmentService),
  __decorateParam(12, IFileService),
  __decorateParam(13, IWorkspaceTrustManagementService),
  __decorateParam(14, IWorkspaceTrustRequestService),
  __decorateParam(15, ITextFileService)
], MainThreadWorkspace);
export {
  MainThreadWorkspace
};
