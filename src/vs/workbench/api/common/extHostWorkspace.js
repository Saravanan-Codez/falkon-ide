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
import { delta as arrayDelta, mapArrayOrNot } from "../../../base/common/arrays.js";
import { AsyncIterableProducer, Barrier } from "../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { AsyncEmitter, Emitter } from "../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { Schemas } from "../../../base/common/network.js";
import { Counter } from "../../../base/common/numbers.js";
import { basename, basenameOrAuthority, dirname, ExtUri, relativePath } from "../../../base/common/resources.js";
import { compare } from "../../../base/common/strings.js";
import { isUriComponents, URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { FileSystemProviderCapabilities } from "../../../platform/files/common/files.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { Severity } from "../../../platform/notification/common/notification.js";
import { Workspace, WorkspaceFolder } from "../../../platform/workspace/common/workspace.js";
import { IExtHostFileSystemInfo } from "./extHostFileSystemInfo.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { GlobPattern } from "./extHostTypeConverters.js";
import { Range } from "./extHostTypes.js";
import { IURITransformerService } from "./extHostUriTransformerService.js";
import { resultIsMatch } from "../../services/search/common/search.js";
import { MainContext } from "./extHost.protocol.js";
import { revive } from "../../../base/common/marshalling.js";
import { ExcludeSettingOptions, TextSearchContext2, TextSearchMatch2 } from "../../services/search/common/searchExtTypes.js";
import { bufferToStream, readableToBuffer, VSBuffer } from "../../../base/common/buffer.js";
import { toDecodeStream, toEncodeReadable, UTF8 } from "../../services/textfile/common/encoding.js";
import { consumeStream } from "../../../base/common/stream.js";
import { stringToSnapshot } from "../../services/textfile/common/textfiles.js";
function isFolderEqual(folderA, folderB, extHostFileSystemInfo) {
  return new ExtUri((uri) => ignorePathCasing(uri, extHostFileSystemInfo)).isEqual(folderA, folderB);
}
function compareWorkspaceFolderByUri(a, b, extHostFileSystemInfo) {
  return isFolderEqual(a.uri, b.uri, extHostFileSystemInfo) ? 0 : compare(a.uri.toString(), b.uri.toString());
}
function compareWorkspaceFolderByUriAndNameAndIndex(a, b, extHostFileSystemInfo) {
  if (a.index !== b.index) {
    return a.index < b.index ? -1 : 1;
  }
  return isFolderEqual(a.uri, b.uri, extHostFileSystemInfo) ? compare(a.name, b.name) : compare(a.uri.toString(), b.uri.toString());
}
function delta(oldFolders, newFolders, compare2, extHostFileSystemInfo) {
  const oldSortedFolders = oldFolders.slice(0).sort((a, b) => compare2(a, b, extHostFileSystemInfo));
  const newSortedFolders = newFolders.slice(0).sort((a, b) => compare2(a, b, extHostFileSystemInfo));
  return arrayDelta(oldSortedFolders, newSortedFolders, (a, b) => compare2(a, b, extHostFileSystemInfo));
}
function ignorePathCasing(uri, extHostFileSystemInfo) {
  const capabilities = extHostFileSystemInfo.getCapabilities(uri.scheme);
  return !(capabilities && capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
}
class ExtHostWorkspaceImpl extends Workspace {
  constructor(id, _name, folders, transient, configuration, _isUntitled, ignorePathCasing2) {
    super(id, folders.map((f) => new WorkspaceFolder(f)), transient, configuration, ignorePathCasing2);
    this._name = _name;
    this._isUntitled = _isUntitled;
    this._workspaceFolders = [];
    this._structure = TernarySearchTree.forUris(ignorePathCasing2, () => true);
    folders.forEach((folder) => {
      this._workspaceFolders.push(folder);
      this._structure.set(folder.uri, folder);
    });
  }
  static toExtHostWorkspace(data, previousConfirmedWorkspace, previousUnconfirmedWorkspace, extHostFileSystemInfo) {
    if (!data) {
      return { workspace: null, added: [], removed: [] };
    }
    const { id, name, folders, configuration, transient, isUntitled } = data;
    const newWorkspaceFolders = [];
    const oldWorkspace = previousConfirmedWorkspace;
    if (previousConfirmedWorkspace) {
      folders.forEach((folderData, index) => {
        const folderUri = URI.revive(folderData.uri);
        const existingFolder = ExtHostWorkspaceImpl._findFolder(previousUnconfirmedWorkspace || previousConfirmedWorkspace, folderUri, extHostFileSystemInfo);
        if (existingFolder) {
          existingFolder.name = folderData.name;
          existingFolder.index = folderData.index;
          newWorkspaceFolders.push(existingFolder);
        } else {
          newWorkspaceFolders.push({ uri: folderUri, name: folderData.name, index });
        }
      });
    } else {
      newWorkspaceFolders.push(...folders.map(({ uri, name: name2, index }) => ({ uri: URI.revive(uri), name: name2, index })));
    }
    newWorkspaceFolders.sort((f1, f2) => f1.index < f2.index ? -1 : 1);
    const workspace = new ExtHostWorkspaceImpl(id, name, newWorkspaceFolders, !!transient, configuration ? URI.revive(configuration) : null, !!isUntitled, (uri) => ignorePathCasing(uri, extHostFileSystemInfo));
    const { added, removed } = delta(oldWorkspace ? oldWorkspace.workspaceFolders : [], workspace.workspaceFolders, compareWorkspaceFolderByUri, extHostFileSystemInfo);
    return { workspace, added, removed };
  }
  static _findFolder(workspace, folderUriToFind, extHostFileSystemInfo) {
    for (let i = 0; i < workspace.folders.length; i++) {
      const folder = workspace.workspaceFolders[i];
      if (isFolderEqual(folder.uri, folderUriToFind, extHostFileSystemInfo)) {
        return folder;
      }
    }
    return void 0;
  }
  get name() {
    return this._name;
  }
  get isUntitled() {
    return this._isUntitled;
  }
  get workspaceFolders() {
    return this._workspaceFolders.slice(0);
  }
  getWorkspaceFolder(uri, resolveParent) {
    if (resolveParent && this._structure.get(uri)) {
      uri = dirname(uri);
    }
    return this._structure.findSubstr(uri);
  }
  resolveWorkspaceFolder(uri) {
    return this._structure.get(uri);
  }
}
let ExtHostWorkspace = class {
  constructor(extHostRpc, initData, extHostFileSystemInfo, logService, uriTransformerService) {
    this._onDidChangeWorkspace = new Emitter();
    this.onDidChangeWorkspace = this._onDidChangeWorkspace.event;
    this._onDidGrantWorkspaceTrust = new Emitter();
    this.onDidGrantWorkspaceTrust = this._onDidGrantWorkspaceTrust.event;
    this._onDidChangeWorkspaceTrustedFolders = new Emitter();
    this.onDidChangeWorkspaceTrustedFolders = this._onDidChangeWorkspaceTrustedFolders.event;
    this._activeSearchCallbacks = [];
    this._trusted = false;
    this._editSessionIdentityProviders = /* @__PURE__ */ new Map();
    // --- edit sessions ---
    this._providerHandlePool = 0;
    this._onWillCreateEditSessionIdentityEvent = new AsyncEmitter();
    // --- canonical uri identity ---
    this._canonicalUriProviders = /* @__PURE__ */ new Map();
    this._logService = logService;
    this._extHostFileSystemInfo = extHostFileSystemInfo;
    this._uriTransformerService = uriTransformerService;
    this._requestIdProvider = new Counter();
    this._barrier = new Barrier();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadWorkspace);
    this._messageService = extHostRpc.getProxy(MainContext.MainThreadMessageService);
    this._telemetryProxy = extHostRpc.getProxy(MainContext.MainThreadTelemetry);
    const data = initData.workspace;
    this._confirmedWorkspace = data ? new ExtHostWorkspaceImpl(data.id, data.name, [], !!data.transient, data.configuration ? URI.revive(data.configuration) : null, !!data.isUntitled, (uri) => ignorePathCasing(uri, extHostFileSystemInfo)) : void 0;
  }
  /**
   * Receives the configuration provider from ExtHostConfiguration after init. We cannot inject
   * IExtHostConfiguration directly because it creates a DI cycle (ExtHostConfiguration already
   * depends on IExtHostWorkspace). Once set, settings reads in findFiles become synchronous.
   */
  $setConfigProvider(provider) {
    this._configProvider = provider;
  }
  _useIgnoreFilesInFindFiles() {
    return this._configProvider?.getConfiguration("search").get("experimental.useIgnoreFilesInFindFiles") ?? false;
  }
  _userIgnoreFilesSetting() {
    return this._configProvider?.getConfiguration("search").get("useIgnoreFiles") ?? true;
  }
  $initializeWorkspace(data, trusted) {
    this._trusted = trusted;
    this.$acceptWorkspaceData(data);
    this._barrier.open();
  }
  waitForInitializeCall() {
    return this._barrier.wait();
  }
  // --- workspace ---
  get workspace() {
    return this._actualWorkspace;
  }
  get name() {
    return this._actualWorkspace ? this._actualWorkspace.name : void 0;
  }
  get workspaceFile() {
    if (this._actualWorkspace) {
      if (this._actualWorkspace.configuration) {
        if (this._actualWorkspace.isUntitled) {
          return URI.from({ scheme: Schemas.untitled, path: basename(dirname(this._actualWorkspace.configuration)) });
        }
        return this._actualWorkspace.configuration;
      }
    }
    return void 0;
  }
  get _actualWorkspace() {
    return this._unconfirmedWorkspace || this._confirmedWorkspace;
  }
  getWorkspaceFolders() {
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.workspaceFolders.slice(0);
  }
  async getWorkspaceFolders2() {
    await this._barrier.wait();
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.workspaceFolders.slice(0);
  }
  updateWorkspaceFolders(extension, index, deleteCount, ...workspaceFoldersToAdd) {
    const validatedDistinctWorkspaceFoldersToAdd = [];
    if (Array.isArray(workspaceFoldersToAdd)) {
      workspaceFoldersToAdd.forEach((folderToAdd) => {
        if (URI.isUri(folderToAdd.uri) && !validatedDistinctWorkspaceFoldersToAdd.some((f) => isFolderEqual(f.uri, folderToAdd.uri, this._extHostFileSystemInfo))) {
          validatedDistinctWorkspaceFoldersToAdd.push({ uri: folderToAdd.uri, name: folderToAdd.name || basenameOrAuthority(folderToAdd.uri) });
        }
      });
    }
    if (!!this._unconfirmedWorkspace) {
      return false;
    }
    if ([index, deleteCount].some((i) => typeof i !== "number" || i < 0)) {
      return false;
    }
    if (deleteCount === 0 && validatedDistinctWorkspaceFoldersToAdd.length === 0) {
      return false;
    }
    const currentWorkspaceFolders = this._actualWorkspace ? this._actualWorkspace.workspaceFolders : [];
    if (index + deleteCount > currentWorkspaceFolders.length) {
      return false;
    }
    const newWorkspaceFolders = currentWorkspaceFolders.slice(0);
    newWorkspaceFolders.splice(index, deleteCount, ...validatedDistinctWorkspaceFoldersToAdd.map((f) => ({
      uri: f.uri,
      name: f.name || basenameOrAuthority(f.uri),
      index: void 0
      /* fixed later */
    })));
    for (let i = 0; i < newWorkspaceFolders.length; i++) {
      const folder = newWorkspaceFolders[i];
      if (newWorkspaceFolders.some((otherFolder, index2) => index2 !== i && isFolderEqual(folder.uri, otherFolder.uri, this._extHostFileSystemInfo))) {
        return false;
      }
    }
    newWorkspaceFolders.forEach((f, index2) => f.index = index2);
    const { added, removed } = delta(currentWorkspaceFolders, newWorkspaceFolders, compareWorkspaceFolderByUriAndNameAndIndex, this._extHostFileSystemInfo);
    if (added.length === 0 && removed.length === 0) {
      return false;
    }
    if (this._proxy) {
      const extName = extension.displayName || extension.name;
      this._proxy.$updateWorkspaceFolders(extName, index, deleteCount, validatedDistinctWorkspaceFoldersToAdd).then(void 0, (error) => {
        this._unconfirmedWorkspace = void 0;
        const options = { source: { identifier: extension.identifier, label: extension.displayName || extension.name } };
        this._messageService.$showMessage(Severity.Error, localize("updateerror", "Extension '{0}' failed to update workspace folders: {1}", extName, error.toString()), options, []);
      });
    }
    this.trySetWorkspaceFolders(newWorkspaceFolders);
    return true;
  }
  getWorkspaceFolder(uri, resolveParent) {
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.getWorkspaceFolder(uri, resolveParent);
  }
  async getWorkspaceFolder2(uri, resolveParent) {
    await this._barrier.wait();
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.getWorkspaceFolder(uri, resolveParent);
  }
  async resolveWorkspaceFolder(uri) {
    await this._barrier.wait();
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.resolveWorkspaceFolder(uri);
  }
  getPath() {
    if (!this._actualWorkspace) {
      return void 0;
    }
    const { folders } = this._actualWorkspace;
    if (folders.length === 0) {
      return void 0;
    }
    return folders[0].uri.fsPath;
  }
  getRelativePath(pathOrUri, includeWorkspace) {
    let resource;
    let path = "";
    if (typeof pathOrUri === "string") {
      resource = URI.file(pathOrUri);
      path = pathOrUri;
    } else if (typeof pathOrUri !== "undefined") {
      resource = pathOrUri;
      path = pathOrUri.fsPath;
    }
    if (!resource) {
      return path;
    }
    const folder = this.getWorkspaceFolder(
      resource,
      true
    );
    if (!folder) {
      return path;
    }
    if (typeof includeWorkspace === "undefined" && this._actualWorkspace) {
      includeWorkspace = this._actualWorkspace.folders.length > 1;
    }
    let result = relativePath(folder.uri, resource);
    if (includeWorkspace && folder.name) {
      result = `${folder.name}/${result}`;
    }
    return result;
  }
  trySetWorkspaceFolders(folders) {
    if (this._actualWorkspace) {
      this._unconfirmedWorkspace = ExtHostWorkspaceImpl.toExtHostWorkspace({
        id: this._actualWorkspace.id,
        name: this._actualWorkspace.name,
        configuration: this._actualWorkspace.configuration,
        folders,
        isUntitled: this._actualWorkspace.isUntitled
      }, this._actualWorkspace, void 0, this._extHostFileSystemInfo).workspace || void 0;
    }
  }
  $acceptWorkspaceData(data) {
    const { workspace, added, removed } = ExtHostWorkspaceImpl.toExtHostWorkspace(data, this._confirmedWorkspace, this._unconfirmedWorkspace, this._extHostFileSystemInfo);
    this._confirmedWorkspace = workspace || void 0;
    this._unconfirmedWorkspace = void 0;
    this._onDidChangeWorkspace.fire(Object.freeze({
      added,
      removed
    }));
  }
  // --- search ---
  /**
   * Note, null/undefined have different and important meanings for "exclude"
   */
  findFiles(include, exclude, maxResults, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findFiles: fileSearch, extension: ${extensionId.value}, entryPoint: findFiles`);
    let excludeString = "";
    let useFileExcludes = true;
    if (exclude === null) {
      useFileExcludes = false;
    } else if (exclude !== void 0) {
      if (typeof exclude === "string") {
        excludeString = exclude;
      } else {
        excludeString = exclude.pattern;
      }
    }
    const useIgnoreFilesOptIn = this._useIgnoreFilesInFindFiles();
    const localIgnoreFiles = useIgnoreFilesOptIn && exclude !== null ? void 0 : false;
    return this._findFilesImpl({ type: "include", value: include }, {
      exclude: [excludeString],
      maxResults,
      useExcludeSettings: useFileExcludes ? ExcludeSettingOptions.FilesExclude : ExcludeSettingOptions.None,
      useIgnoreFiles: {
        local: localIgnoreFiles
      }
    }, extensionId, "findFiles", { useIgnoreFilesLocal: void 0, excludeWasNull: exclude === null }, token);
  }
  findFiles2(filePatterns, options = {}, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findFiles2New: fileSearch, extension: ${extensionId.value}, entryPoint: findFiles2New`);
    return this._findFilesImpl({ type: "filePatterns", value: filePatterns }, options, extensionId, "findFiles2", { useIgnoreFilesLocal: options.useIgnoreFiles?.local, excludeWasNull: false }, token);
  }
  async _findFilesImpl(query, options, extensionId, apiKind, intent, token) {
    const useIgnoreFilesLocalRequested = intent.useIgnoreFilesLocal === true ? "true" : intent.useIgnoreFilesLocal === false ? "false" : "unspecified";
    const sw = new StopWatch(true);
    let queryCount = 0;
    let respectedIgnoreFiles = this._userIgnoreFilesSetting();
    let resultCount = 0;
    let cancelled = false;
    let errored = false;
    try {
      if (token.isCancellationRequested) {
        cancelled = true;
        return [];
      }
      const filePatternsToUse = query.type === "include" ? [query.value] : query.value ?? [];
      if (!Array.isArray(filePatternsToUse)) {
        console.error("Invalid file pattern provided", filePatternsToUse);
        throw new Error(`Invalid file pattern provided ${JSON.stringify(filePatternsToUse)}`);
      }
      const queryOptions = filePatternsToUse.map((filePattern) => {
        const excludePatterns = globsToISearchPatternBuilder(options.exclude);
        const fileQueries = {
          ignoreSymlinks: typeof options.followSymlinks === "boolean" ? !options.followSymlinks : void 0,
          disregardIgnoreFiles: typeof options.useIgnoreFiles?.local === "boolean" ? !options.useIgnoreFiles.local : void 0,
          disregardGlobalIgnoreFiles: typeof options.useIgnoreFiles?.global === "boolean" ? !options.useIgnoreFiles.global : void 0,
          disregardParentIgnoreFiles: typeof options.useIgnoreFiles?.parent === "boolean" ? !options.useIgnoreFiles.parent : void 0,
          disregardExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings === ExcludeSettingOptions.None,
          disregardSearchExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings !== ExcludeSettingOptions.SearchAndFilesExclude,
          maxResults: options.maxResults,
          excludePattern: excludePatterns.length > 0 ? excludePatterns : void 0,
          ignoreGlobCase: options.caseInsensitive,
          _reason: "startFileSearch",
          shouldGlobSearch: query.type === "include" ? void 0 : true
        };
        const parseInclude = parseSearchExcludeInclude(GlobPattern.from(filePattern));
        const folderToUse = parseInclude?.folder;
        if (query.type === "include") {
          fileQueries.includePattern = parseInclude?.pattern;
        } else {
          fileQueries.filePattern = parseInclude?.pattern;
        }
        return {
          folder: folderToUse,
          options: fileQueries
        };
      });
      queryCount = queryOptions.length;
      const userHonorsIgnore = this._userIgnoreFilesSetting();
      respectedIgnoreFiles = queryOptions.every((q) => q.options.disregardIgnoreFiles === true ? false : q.options.disregardIgnoreFiles === false ? true : userHonorsIgnore);
      const result = await this._findFilesBase(queryOptions, token);
      resultCount = result.length;
      cancelled = token.isCancellationRequested;
      return result;
    } catch (err) {
      errored = true;
      cancelled = token.isCancellationRequested;
      throw err;
    } finally {
      this._reportFindFilesTelemetry({
        extensionId: extensionId.value,
        apiKind,
        respectedIgnoreFiles,
        useIgnoreFilesLocalRequested,
        excludeWasNull: intent.excludeWasNull,
        resultCount,
        durationMs: sw.elapsed(),
        queryCount,
        cancelled,
        errored
      });
    }
  }
  async _findFilesBase(queryOptions, token) {
    let tokenToUse = token;
    let linkedSource;
    if (!CancellationToken.isCancellationToken(token)) {
      linkedSource = new CancellationTokenSource();
      const foreignToken = token;
      if (typeof foreignToken.onCancellationRequested === "function") {
        foreignToken.onCancellationRequested(() => linkedSource.cancel());
      }
      tokenToUse = linkedSource.token;
    }
    const result = await Promise.all(queryOptions?.map(
      (option) => this._proxy.$startFileSearch(
        option.folder ?? null,
        option.options,
        tokenToUse
      ).then((data) => Array.isArray(data) ? data.map((d) => URI.revive(d)) : [])
    ) ?? []);
    const flatResult = result.flat();
    linkedSource?.dispose();
    const extUri = new ExtUri((uri) => ignorePathCasing(uri, this._extHostFileSystemInfo));
    const uriMap = /* @__PURE__ */ new Map();
    for (const uri of flatResult) {
      const key = extUri.getComparisonKey(uri);
      if (!uriMap.has(key)) {
        uriMap.set(key, uri);
      }
    }
    return Array.from(uriMap.values());
  }
  _reportFindFilesTelemetry(event) {
    this._telemetryProxy.$publicLog2("extHostFindFiles", event);
  }
  findTextInFiles2(query, options, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findTextInFiles2: textSearch, extension: ${extensionId.value}, entryPoint: findTextInFiles2`);
    const getOptions = (include) => {
      if (!options) {
        return {
          folder: void 0,
          options: {}
        };
      }
      const parsedInclude = include ? parseSearchExcludeInclude(GlobPattern.from(include)) : void 0;
      const excludePatterns = options.exclude ? globsToISearchPatternBuilder(options.exclude) : void 0;
      return {
        options: {
          ignoreSymlinks: typeof options.followSymlinks === "boolean" ? !options.followSymlinks : void 0,
          disregardIgnoreFiles: typeof options.useIgnoreFiles?.local === "boolean" ? !options.useIgnoreFiles?.local : void 0,
          disregardGlobalIgnoreFiles: typeof options.useIgnoreFiles?.global === "boolean" ? !options.useIgnoreFiles?.global : void 0,
          disregardParentIgnoreFiles: typeof options.useIgnoreFiles?.parent === "boolean" ? !options.useIgnoreFiles?.parent : void 0,
          disregardExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings === ExcludeSettingOptions.None,
          disregardSearchExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings !== ExcludeSettingOptions.SearchAndFilesExclude,
          fileEncoding: options.encoding,
          maxResults: options.maxResults,
          ignoreGlobCase: options.caseInsensitive,
          previewOptions: options.previewOptions ? {
            matchLines: options.previewOptions?.numMatchLines ?? 100,
            charsPerLine: options.previewOptions?.charsPerLine ?? 1e4
          } : void 0,
          surroundingContext: options.surroundingContext,
          includePattern: parsedInclude?.pattern,
          excludePattern: excludePatterns
        },
        folder: parsedInclude?.folder
      };
    };
    const queryOptionsRaw = options?.include?.map((include) => getOptions(include)) ?? [getOptions(void 0)];
    const queryOptions = queryOptionsRaw.filter((queryOps) => !!queryOps);
    const disposables = new DisposableStore();
    const progressEmitter = disposables.add(new Emitter());
    const complete = this.findTextInFilesBase(
      query,
      queryOptions,
      (result, uri) => progressEmitter.fire({ result, uri }),
      token
    );
    const asyncIterable = new AsyncIterableProducer(async (emitter) => {
      disposables.add(progressEmitter.event((e) => {
        const result = e.result;
        const uri = e.uri;
        if (resultIsMatch(result)) {
          emitter.emitOne(new TextSearchMatch2(
            uri,
            result.rangeLocations.map((range) => ({
              previewRange: new Range(range.preview.startLineNumber, range.preview.startColumn, range.preview.endLineNumber, range.preview.endColumn),
              sourceRange: new Range(range.source.startLineNumber, range.source.startColumn, range.source.endLineNumber, range.source.endColumn)
            })),
            result.previewText
          ));
        } else {
          emitter.emitOne(new TextSearchContext2(
            uri,
            result.text,
            result.lineNumber
          ));
        }
      }));
      await complete;
    });
    return {
      results: asyncIterable,
      complete: complete.then((e) => {
        disposables.dispose();
        return {
          limitHit: e?.limitHit ?? false
        };
      })
    };
  }
  async findTextInFilesBase(query, queryOptions, callback, token = CancellationToken.None) {
    const requestId = this._requestIdProvider.getNext();
    let isCanceled = false;
    token.onCancellationRequested((_) => {
      isCanceled = true;
    });
    this._activeSearchCallbacks[requestId] = (p) => {
      if (isCanceled) {
        return;
      }
      const uri = URI.revive(p.resource);
      p.results.forEach((rawResult) => {
        const result = revive(rawResult);
        callback(result, uri);
      });
    };
    if (token.isCancellationRequested) {
      return {};
    }
    try {
      const result = await Promise.all(queryOptions?.map(
        (option) => this._proxy.$startTextSearch(
          query,
          option.folder ?? null,
          option.options,
          requestId,
          token
        ) || {}
      ) ?? []);
      delete this._activeSearchCallbacks[requestId];
      return result.reduce((acc, val) => {
        return {
          limitHit: acc?.limitHit || (val?.limitHit ?? false),
          message: [acc?.message ?? [], val?.message ?? []].flat()
        };
      }, {}) ?? { limitHit: false };
    } catch (err) {
      delete this._activeSearchCallbacks[requestId];
      throw err;
    }
  }
  async findTextInFiles(query, options, callback, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findTextInFiles: textSearch, extension: ${extensionId.value}, entryPoint: findTextInFiles`);
    const previewOptions = typeof options.previewOptions === "undefined" ? {
      matchLines: 100,
      charsPerLine: 1e4
    } : options.previewOptions;
    const parsedInclude = parseSearchExcludeInclude(GlobPattern.from(options.include));
    const excludePattern = typeof options.exclude === "string" ? options.exclude : options.exclude ? options.exclude.pattern : void 0;
    const queryOptions = {
      ignoreSymlinks: typeof options.followSymlinks === "boolean" ? !options.followSymlinks : void 0,
      disregardIgnoreFiles: typeof options.useIgnoreFiles === "boolean" ? !options.useIgnoreFiles : void 0,
      disregardGlobalIgnoreFiles: typeof options.useGlobalIgnoreFiles === "boolean" ? !options.useGlobalIgnoreFiles : void 0,
      disregardParentIgnoreFiles: typeof options.useParentIgnoreFiles === "boolean" ? !options.useParentIgnoreFiles : void 0,
      disregardExcludeSettings: typeof options.useDefaultExcludes === "boolean" ? !options.useDefaultExcludes : true,
      disregardSearchExcludeSettings: typeof options.useSearchExclude === "boolean" ? !options.useSearchExclude : true,
      fileEncoding: options.encoding,
      maxResults: options.maxResults,
      previewOptions,
      surroundingContext: options.afterContext,
      // TODO: remove ability to have before/after context separately
      includePattern: parsedInclude?.pattern,
      excludePattern: excludePattern ? [{ pattern: excludePattern }] : void 0
    };
    const progress = (result, uri) => {
      if (resultIsMatch(result)) {
        callback({
          uri,
          preview: {
            text: result.previewText,
            matches: mapArrayOrNot(
              result.rangeLocations,
              (m) => new Range(m.preview.startLineNumber, m.preview.startColumn, m.preview.endLineNumber, m.preview.endColumn)
            )
          },
          ranges: mapArrayOrNot(
            result.rangeLocations,
            (r) => new Range(r.source.startLineNumber, r.source.startColumn, r.source.endLineNumber, r.source.endColumn)
          )
        });
      } else {
        callback({
          uri,
          text: result.text,
          lineNumber: result.lineNumber
        });
      }
    };
    return this.findTextInFilesBase(query, [{ options: queryOptions, folder: parsedInclude?.folder }], progress, token);
  }
  $handleTextSearchResult(result, requestId) {
    this._activeSearchCallbacks[requestId]?.(result);
  }
  async save(uri) {
    const result = await this._proxy.$save(uri, { saveAs: false });
    return URI.revive(result);
  }
  async saveAs(uri) {
    const result = await this._proxy.$save(uri, { saveAs: true });
    return URI.revive(result);
  }
  saveAll(includeUntitled) {
    return this._proxy.$saveAll(includeUntitled);
  }
  resolveProxy(url) {
    return this._proxy.$resolveProxy(url);
  }
  lookupAuthorization(authInfo) {
    return this._proxy.$lookupAuthorization(authInfo);
  }
  lookupKerberosAuthorization(url) {
    return this._proxy.$lookupKerberosAuthorization(url);
  }
  loadCertificates() {
    return this._proxy.$loadCertificates();
  }
  // --- trust ---
  get trusted() {
    return this._trusted;
  }
  requestResourceTrust(options) {
    return this._proxy.$requestResourceTrust(options);
  }
  requestWorkspaceTrust(options) {
    return this._proxy.$requestWorkspaceTrust(options);
  }
  $onDidGrantWorkspaceTrust() {
    if (!this._trusted) {
      this._trusted = true;
      this._onDidGrantWorkspaceTrust.fire();
    }
  }
  $onDidChangeWorkspaceTrustedFolders() {
    this._onDidChangeWorkspaceTrustedFolders.fire();
  }
  isResourceTrusted(resource) {
    return this._proxy.$isResourceTrusted(resource);
  }
  // called by ext host
  registerEditSessionIdentityProvider(scheme, provider) {
    if (this._editSessionIdentityProviders.has(scheme)) {
      throw new Error(`A provider has already been registered for scheme ${scheme}`);
    }
    this._editSessionIdentityProviders.set(scheme, provider);
    const outgoingScheme = this._uriTransformerService.transformOutgoingScheme(scheme);
    const handle = this._providerHandlePool++;
    this._proxy.$registerEditSessionIdentityProvider(handle, outgoingScheme);
    return toDisposable(() => {
      this._editSessionIdentityProviders.delete(scheme);
      this._proxy.$unregisterEditSessionIdentityProvider(handle);
    });
  }
  // called by main thread
  async $getEditSessionIdentifier(workspaceFolder, cancellationToken) {
    this._logService.info("Getting edit session identifier for workspaceFolder", workspaceFolder);
    const folder = await this.resolveWorkspaceFolder(URI.revive(workspaceFolder));
    if (!folder) {
      this._logService.warn("Unable to resolve workspace folder");
      return void 0;
    }
    this._logService.info("Invoking #provideEditSessionIdentity for workspaceFolder", folder);
    const provider = this._editSessionIdentityProviders.get(folder.uri.scheme);
    this._logService.info(`Provider for scheme ${folder.uri.scheme} is defined: `, !!provider);
    if (!provider) {
      return void 0;
    }
    const result = await provider.provideEditSessionIdentity(folder, cancellationToken);
    this._logService.info("Provider returned edit session identifier: ", result);
    if (!result) {
      return void 0;
    }
    return result;
  }
  async $provideEditSessionIdentityMatch(workspaceFolder, identity1, identity2, cancellationToken) {
    this._logService.info("Getting edit session identifier for workspaceFolder", workspaceFolder);
    const folder = await this.resolveWorkspaceFolder(URI.revive(workspaceFolder));
    if (!folder) {
      this._logService.warn("Unable to resolve workspace folder");
      return void 0;
    }
    this._logService.info("Invoking #provideEditSessionIdentity for workspaceFolder", folder);
    const provider = this._editSessionIdentityProviders.get(folder.uri.scheme);
    this._logService.info(`Provider for scheme ${folder.uri.scheme} is defined: `, !!provider);
    if (!provider) {
      return void 0;
    }
    const result = await provider.provideEditSessionIdentityMatch?.(identity1, identity2, cancellationToken);
    this._logService.info("Provider returned edit session identifier match result: ", result);
    if (!result) {
      return void 0;
    }
    return result;
  }
  getOnWillCreateEditSessionIdentityEvent(extension) {
    return (listener, thisArg, disposables) => {
      const wrappedListener = function wrapped(e) {
        listener.call(thisArg, e);
      };
      wrappedListener.extension = extension;
      return this._onWillCreateEditSessionIdentityEvent.event(wrappedListener, void 0, disposables);
    };
  }
  // main thread calls this to trigger participants
  async $onWillCreateEditSessionIdentity(workspaceFolder, token, timeout) {
    const folder = await this.resolveWorkspaceFolder(URI.revive(workspaceFolder));
    if (folder === void 0) {
      throw new Error("Unable to resolve workspace folder");
    }
    await this._onWillCreateEditSessionIdentityEvent.fireAsync({ workspaceFolder: folder }, token, async (thenable, listener) => {
      const now = Date.now();
      await Promise.resolve(thenable);
      if (Date.now() - now > timeout) {
        this._logService.warn("SLOW edit session create-participant", listener.extension.identifier);
      }
    });
    if (token.isCancellationRequested) {
      return void 0;
    }
  }
  // called by ext host
  registerCanonicalUriProvider(scheme, provider) {
    if (this._canonicalUriProviders.has(scheme)) {
      throw new Error(`A provider has already been registered for scheme ${scheme}`);
    }
    this._canonicalUriProviders.set(scheme, provider);
    const outgoingScheme = this._uriTransformerService.transformOutgoingScheme(scheme);
    const handle = this._providerHandlePool++;
    this._proxy.$registerCanonicalUriProvider(handle, outgoingScheme);
    return toDisposable(() => {
      this._canonicalUriProviders.delete(scheme);
      this._proxy.$unregisterCanonicalUriProvider(handle);
    });
  }
  async provideCanonicalUri(uri, options, cancellationToken) {
    const provider = this._canonicalUriProviders.get(uri.scheme);
    if (!provider) {
      return void 0;
    }
    const result = await provider.provideCanonicalUri?.(URI.revive(uri), options, cancellationToken);
    if (!result) {
      return void 0;
    }
    return result;
  }
  // called by main thread
  async $provideCanonicalUri(uri, targetScheme, cancellationToken) {
    return this.provideCanonicalUri(URI.revive(uri), { targetScheme }, cancellationToken);
  }
  // --- encodings ---
  async decode(content, args) {
    const [uri, opts] = this.toEncodeDecodeParameters(args);
    const options = await this._proxy.$resolveDecoding(uri, opts);
    const stream = (await toDecodeStream(bufferToStream(VSBuffer.wrap(content)), {
      ...options,
      acceptTextOnly: true,
      overwriteEncoding: (detectedEncoding) => {
        if (detectedEncoding === null || detectedEncoding === options.preferredEncoding) {
          return Promise.resolve(options.preferredEncoding);
        }
        return this._proxy.$validateDetectedEncoding(uri, detectedEncoding, opts);
      }
    })).stream;
    return consumeStream(stream, (chunks) => chunks.join(""));
  }
  async encode(content, args) {
    const [uri, options] = this.toEncodeDecodeParameters(args);
    const { encoding, addBOM } = await this._proxy.$resolveEncoding(uri, options);
    if (encoding === UTF8 && !addBOM) {
      return VSBuffer.fromString(content).buffer;
    }
    const res = await toEncodeReadable(stringToSnapshot(content), encoding, { addBOM });
    return readableToBuffer(res).buffer;
  }
  toEncodeDecodeParameters(opts) {
    const uri = isUriComponents(opts?.uri) ? opts.uri : void 0;
    const encoding = typeof opts?.encoding === "string" ? opts.encoding : void 0;
    return [uri, encoding ? { encoding } : void 0];
  }
};
ExtHostWorkspace = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, IExtHostFileSystemInfo),
  __decorateParam(3, ILogService),
  __decorateParam(4, IURITransformerService)
], ExtHostWorkspace);
const IExtHostWorkspace = createDecorator("IExtHostWorkspace");
function parseSearchExcludeInclude(include) {
  let pattern;
  let includeFolder;
  if (include) {
    if (typeof include === "string") {
      pattern = include;
    } else {
      pattern = include.pattern;
      includeFolder = URI.revive(include.baseUri);
    }
    return {
      pattern,
      folder: includeFolder
    };
  }
  return void 0;
}
function globsToISearchPatternBuilder(excludes) {
  return (excludes?.map((exclude) => {
    if (typeof exclude === "string") {
      if (exclude === "") {
        return void 0;
      }
      return {
        pattern: exclude,
        uri: void 0
      };
    } else {
      const parsedExclude = parseSearchExcludeInclude(exclude);
      if (!parsedExclude) {
        return void 0;
      }
      return {
        pattern: parsedExclude.pattern,
        uri: parsedExclude.folder
      };
    }
  }) ?? []).filter((e) => !!e);
}
export {
  ExtHostWorkspace,
  IExtHostWorkspace
};
