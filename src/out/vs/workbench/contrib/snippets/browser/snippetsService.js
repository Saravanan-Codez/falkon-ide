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
import { combinedDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as resources from "../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { setSnippetSuggestSupport } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { localize } from "../../../../nls.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { SnippetFile, SnippetSource } from "./snippetsFile.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { languagesExtPoint } from "../../../services/language/common/languageService.js";
import { SnippetCompletionProvider } from "./snippetCompletionProvider.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isStringArray } from "../../../../base/common/types.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { ILanguageConfigurationService } from "../../../../editor/common/languages/languageConfigurationRegistry.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { insertInto } from "../../../../base/common/arrays.js";
var snippetExt;
((snippetExt2) => {
  function toValidSnippet(extension, snippet, languageService) {
    if (isFalsyOrWhitespace(snippet.path)) {
      extension.collector.error(localize(
        "invalid.path.0",
        "Expected string in `contributes.{0}.path`. Provided value: {1}",
        extension.description.name,
        String(snippet.path)
      ));
      return null;
    }
    if (isFalsyOrWhitespace(snippet.language) && !snippet.path.endsWith(".code-snippets")) {
      extension.collector.error(localize(
        "invalid.language.0",
        "When omitting the language, the value of `contributes.{0}.path` must be a `.code-snippets`-file. Provided value: {1}",
        extension.description.name,
        String(snippet.path)
      ));
      return null;
    }
    if (!isFalsyOrWhitespace(snippet.language) && !languageService.isRegisteredLanguageId(snippet.language)) {
      extension.collector.error(localize(
        "invalid.language",
        "Unknown language in `contributes.{0}.language`. Provided value: {1}",
        extension.description.name,
        String(snippet.language)
      ));
      return null;
    }
    const extensionLocation = extension.description.extensionLocation;
    const snippetLocation = resources.joinPath(extensionLocation, snippet.path);
    if (!resources.isEqualOrParent(snippetLocation, extensionLocation)) {
      extension.collector.error(localize(
        "invalid.path.1",
        "Expected `contributes.{0}.path` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.",
        extension.description.name,
        snippetLocation.path,
        extensionLocation.path
      ));
      return null;
    }
    return {
      language: snippet.language,
      location: snippetLocation
    };
  }
  snippetExt2.toValidSnippet = toValidSnippet;
  snippetExt2.snippetsContribution = {
    description: localize("vscode.extension.contributes.snippets", "Contributes snippets."),
    type: "array",
    defaultSnippets: [{ body: [{ language: "", path: "" }] }],
    items: {
      type: "object",
      defaultSnippets: [{ body: { language: "${1:id}", path: "./snippets/${2:id}.json." } }],
      properties: {
        language: {
          description: localize("vscode.extension.contributes.snippets-language", "Language identifier for which this snippet is contributed to."),
          type: "string"
        },
        path: {
          description: localize("vscode.extension.contributes.snippets-path", "Path of the snippets file. The path is relative to the extension folder and typically starts with './snippets/'."),
          type: "string"
        }
      }
    }
  };
  snippetExt2.point = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: "snippets",
    deps: [languagesExtPoint],
    jsonSchema: snippetExt2.snippetsContribution
  });
})(snippetExt || (snippetExt = {}));
function watch(service, resource, callback) {
  return combinedDisposable(
    service.watch(resource),
    service.onDidFilesChange((e) => {
      if (e.affects(resource)) {
        callback();
      }
    })
  );
}
let SnippetEnablement = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    const raw = _storageService.get(SnippetEnablement._key, StorageScope.PROFILE, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
    }
    this._ignored = isStringArray(data) ? new Set(data) : /* @__PURE__ */ new Set();
  }
  static {
    this._key = "snippets.ignoredSnippets";
  }
  isIgnored(id) {
    return this._ignored.has(id);
  }
  updateIgnored(id, value) {
    let changed = false;
    if (this._ignored.has(id) && !value) {
      this._ignored.delete(id);
      changed = true;
    } else if (!this._ignored.has(id) && value) {
      this._ignored.add(id);
      changed = true;
    }
    if (changed) {
      this._storageService.store(SnippetEnablement._key, JSON.stringify(Array.from(this._ignored)), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
};
SnippetEnablement = __decorateClass([
  __decorateParam(0, IStorageService)
], SnippetEnablement);
let SnippetUsageTimestamps = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    const raw = _storageService.get(SnippetUsageTimestamps._key, StorageScope.PROFILE, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = [];
    }
    this._usages = Array.isArray(data) ? new Map(data) : /* @__PURE__ */ new Map();
  }
  static {
    this._key = "snippets.usageTimestamps";
  }
  getUsageTimestamp(id) {
    return this._usages.get(id);
  }
  updateUsageTimestamp(id) {
    this._usages.delete(id);
    this._usages.set(id, Date.now());
    const all = [...this._usages].slice(-100);
    this._storageService.store(SnippetUsageTimestamps._key, JSON.stringify(all), StorageScope.PROFILE, StorageTarget.USER);
  }
};
SnippetUsageTimestamps = __decorateClass([
  __decorateParam(0, IStorageService)
], SnippetUsageTimestamps);
let SnippetsService = class {
  constructor(_environmentService, _userDataProfileService, _contextService, _languageService, _logService, _fileService, _textfileService, _extensionResourceLoaderService, lifecycleService, instantiationService, languageConfigurationService) {
    this._environmentService = _environmentService;
    this._userDataProfileService = _userDataProfileService;
    this._contextService = _contextService;
    this._languageService = _languageService;
    this._logService = _logService;
    this._fileService = _fileService;
    this._textfileService = _textfileService;
    this._extensionResourceLoaderService = _extensionResourceLoaderService;
    this._disposables = new DisposableStore();
    this._pendingWork = /* @__PURE__ */ new Set();
    this._files = new ResourceMap();
    this._trackPendingWork(Promise.resolve(lifecycleService.when(LifecyclePhase.Restored).then(() => {
      this._initExtensionSnippets();
      this._initUserSnippets();
      this._initWorkspaceSnippets();
    })));
    setSnippetSuggestSupport(new SnippetCompletionProvider(this._languageService, this, languageConfigurationService));
    this._enablement = instantiationService.createInstance(SnippetEnablement);
    this._usageTimestamps = instantiationService.createInstance(SnippetUsageTimestamps);
  }
  dispose() {
    this._disposables.dispose();
  }
  isEnabled(snippet) {
    return !this._enablement.isIgnored(snippet.snippetIdentifier);
  }
  updateEnablement(snippet, enabled) {
    this._enablement.updateIgnored(snippet.snippetIdentifier, !enabled);
  }
  updateUsageTimestamp(snippet) {
    this._usageTimestamps.updateUsageTimestamp(snippet.snippetIdentifier);
  }
  async _joinSnippets() {
    const promises = [...this._pendingWork];
    await Promise.all(promises);
  }
  _trackPendingWork(work) {
    this._pendingWork.add(work);
    work.then(
      () => this._pendingWork.delete(work),
      (error) => {
        this._pendingWork.delete(work);
        this._logService.error(error);
      }
    );
  }
  async getSnippetFiles() {
    await this._joinSnippets();
    return this._files.values();
  }
  async getSnippets(languageId, resourceUri, opts) {
    await this._joinSnippets();
    const result = [];
    const promises = [];
    if (languageId) {
      if (this._languageService.isRegisteredLanguageId(languageId)) {
        for (const file of this._files.values()) {
          promises.push(
            file.load().then((file2) => file2.select(languageId, result)).catch((err) => this._logService.error(err, file.location.toString()))
          );
        }
      }
    } else {
      for (const file of this._files.values()) {
        promises.push(
          file.load().then((file2) => insertInto(result, result.length, file2.data)).catch((err) => this._logService.error(err, file.location.toString()))
        );
      }
    }
    await Promise.all(promises);
    return this._filterAndSortSnippets(result, resourceUri, opts);
  }
  getSnippetsSync(languageId, resourceUri, opts) {
    const result = [];
    if (this._languageService.isRegisteredLanguageId(languageId)) {
      for (const file of this._files.values()) {
        file.load().catch((_err) => {
        });
        file.select(languageId, result);
      }
    }
    return this._filterAndSortSnippets(result, resourceUri, opts);
  }
  _filterAndSortSnippets(snippets, resourceUri, opts) {
    const result = [];
    for (const snippet of snippets) {
      if (!snippet.prefix && !opts?.includeNoPrefixSnippets) {
        continue;
      }
      if (!this.isEnabled(snippet) && !opts?.includeDisabledSnippets) {
        continue;
      }
      if (typeof opts?.fileTemplateSnippets === "boolean" && opts.fileTemplateSnippets !== snippet.isFileTemplate) {
        continue;
      }
      if (resourceUri && !snippet.isFileIncluded(resourceUri)) {
        continue;
      }
      result.push(snippet);
    }
    return result.sort((a, b) => {
      let result2 = 0;
      if (!opts?.noRecencySort) {
        const val1 = this._usageTimestamps.getUsageTimestamp(a.snippetIdentifier) ?? -1;
        const val2 = this._usageTimestamps.getUsageTimestamp(b.snippetIdentifier) ?? -1;
        result2 = val2 - val1;
      }
      if (result2 === 0) {
        result2 = this._compareSnippet(a, b);
      }
      return result2;
    });
  }
  _compareSnippet(a, b) {
    if (a.snippetSource < b.snippetSource) {
      return -1;
    } else if (a.snippetSource > b.snippetSource) {
      return 1;
    } else if (a.source < b.source) {
      return -1;
    } else if (a.source > b.source) {
      return 1;
    } else if (a.name > b.name) {
      return 1;
    } else if (a.name < b.name) {
      return -1;
    } else {
      return 0;
    }
  }
  // --- loading, watching
  _initExtensionSnippets() {
    snippetExt.point.setHandler((extensions) => {
      for (const [key, value] of this._files) {
        if (value.source === SnippetSource.Extension) {
          this._files.delete(key);
        }
      }
      for (const extension of extensions) {
        for (const contribution of extension.value) {
          const validContribution = snippetExt.toValidSnippet(extension, contribution, this._languageService);
          if (!validContribution) {
            continue;
          }
          const file = this._files.get(validContribution.location);
          if (file) {
            if (file.defaultScopes) {
              file.defaultScopes.push(validContribution.language);
            } else {
              file.defaultScopes = [];
            }
          } else {
            const file2 = new SnippetFile(SnippetSource.Extension, validContribution.location, validContribution.language ? [validContribution.language] : void 0, extension.description, this._fileService, this._extensionResourceLoaderService);
            this._files.set(file2.location, file2);
            if (this._environmentService.isExtensionDevelopment) {
              file2.load().then((file3) => {
                if (file3.data.some((snippet) => snippet.isBogous)) {
                  extension.collector.warn(localize(
                    "badVariableUse",
                    "One or more snippets from the extension '{0}' very likely confuse snippet-variables and snippet-placeholders (see https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax for more details)",
                    extension.description.name
                  ));
                }
              }, (err) => {
                extension.collector.warn(localize(
                  "badFile",
                  'The snippet file "{0}" could not be read.',
                  file2.location.toString()
                ));
              });
            }
          }
        }
      }
    });
  }
  _initWorkspaceSnippets() {
    const disposables = new DisposableStore();
    const updateWorkspaceSnippets = () => {
      disposables.clear();
      this._trackPendingWork(this._initWorkspaceFolderSnippets(this._contextService.getWorkspace(), disposables));
    };
    this._disposables.add(disposables);
    this._disposables.add(this._contextService.onDidChangeWorkspaceFolders(updateWorkspaceSnippets));
    this._disposables.add(this._contextService.onDidChangeWorkbenchState(updateWorkspaceSnippets));
    updateWorkspaceSnippets();
  }
  async _initWorkspaceFolderSnippets(workspace, bucket) {
    const promises = workspace.folders.map(async (folder) => {
      const snippetFolder = folder.toResource(".vscode");
      const value = await this._fileService.exists(snippetFolder);
      if (value) {
        this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket);
      } else {
        bucket.add(this._fileService.onDidFilesChange((e) => {
          if (e.contains(snippetFolder, FileChangeType.ADDED)) {
            this._initFolderSnippets(SnippetSource.Workspace, snippetFolder, bucket);
          }
        }));
      }
    });
    await Promise.all(promises);
  }
  async _initUserSnippets() {
    const disposables = new DisposableStore();
    const updateUserSnippets = async () => {
      disposables.clear();
      const userSnippetsFolder = this._userDataProfileService.currentProfile.snippetsHome;
      await this._fileService.createFolder(userSnippetsFolder);
      await this._initFolderSnippets(SnippetSource.User, userSnippetsFolder, disposables);
    };
    this._disposables.add(disposables);
    this._disposables.add(this._userDataProfileService.onDidChangeCurrentProfile((e) => e.join((async () => {
      this._trackPendingWork(updateUserSnippets());
    })())));
    await updateUserSnippets();
  }
  _initFolderSnippets(source, folder, bucket) {
    const disposables = new DisposableStore();
    const addFolderSnippets = async () => {
      disposables.clear();
      if (!await this._fileService.exists(folder)) {
        return;
      }
      try {
        const stat = await this._fileService.resolve(folder);
        for (const entry of stat.children || []) {
          disposables.add(this._addSnippetFile(entry.resource, source));
        }
      } catch (err) {
        this._logService.error(`Failed snippets from folder '${folder.toString()}'`, err);
      }
    };
    bucket.add(this._textfileService.files.onDidSave((e) => {
      if (resources.isEqualOrParent(e.model.resource, folder)) {
        addFolderSnippets();
      }
    }));
    bucket.add(watch(this._fileService, folder, addFolderSnippets));
    bucket.add(disposables);
    return addFolderSnippets();
  }
  _addSnippetFile(uri, source) {
    const ext = resources.extname(uri);
    if (source === SnippetSource.User && ext === ".json") {
      const langName = resources.basename(uri).replace(/\.json/, "");
      this._files.set(uri, new SnippetFile(source, uri, [langName], void 0, this._fileService, this._extensionResourceLoaderService));
    } else if (ext === ".code-snippets") {
      this._files.set(uri, new SnippetFile(source, uri, void 0, void 0, this._fileService, this._extensionResourceLoaderService));
    }
    return {
      dispose: () => this._files.delete(uri)
    };
  }
};
SnippetsService = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, IUserDataProfileService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IExtensionResourceLoaderService),
  __decorateParam(8, ILifecycleService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, ILanguageConfigurationService)
], SnippetsService);
function getNonWhitespacePrefix(model, position) {
  const MAX_PREFIX_LENGTH = 100;
  const line = model.getLineContent(position.lineNumber).substr(0, position.column - 1);
  const minChIndex = Math.max(0, line.length - MAX_PREFIX_LENGTH);
  for (let chIndex = line.length - 1; chIndex >= minChIndex; chIndex--) {
    const ch = line.charAt(chIndex);
    if (/\s/.test(ch)) {
      return line.substr(chIndex + 1);
    }
  }
  if (minChIndex === 0) {
    return line;
  }
  return "";
}
export {
  SnippetsService,
  getNonWhitespacePrefix
};
