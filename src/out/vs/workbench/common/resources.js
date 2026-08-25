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
import { URI } from "../../base/common/uri.js";
import { equals } from "../../base/common/objects.js";
import { isAbsolute } from "../../base/common/path.js";
import { Emitter } from "../../base/common/event.js";
import { relativePath } from "../../base/common/resources.js";
import { Disposable } from "../../base/common/lifecycle.js";
import { parse } from "../../base/common/glob.js";
import { IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { Schemas } from "../../base/common/network.js";
import { ResourceSet } from "../../base/common/map.js";
import { getDriveLetter } from "../../base/common/extpath.js";
let ResourceGlobMatcher = class extends Disposable {
  constructor(getExpression, shouldUpdate, contextService, configurationService) {
    super();
    this.getExpression = getExpression;
    this.shouldUpdate = shouldUpdate;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this._onExpressionChange = this._register(new Emitter());
    this.onExpressionChange = this._onExpressionChange.event;
    this.mapFolderToParsedExpression = /* @__PURE__ */ new Map();
    this.mapFolderToConfiguredExpression = /* @__PURE__ */ new Map();
    this.updateExpressions(false);
    this.registerListeners();
  }
  static {
    this.NO_FOLDER = null;
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (this.shouldUpdate(e)) {
        this.updateExpressions(true);
      }
    }));
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.updateExpressions(true)));
  }
  updateExpressions(fromEvent) {
    let changed = false;
    for (const folder of this.contextService.getWorkspace().folders) {
      const folderUriStr = folder.uri.toString();
      const newExpression = this.doGetExpression(folder.uri);
      const currentExpression = this.mapFolderToConfiguredExpression.get(folderUriStr);
      if (newExpression) {
        if (!currentExpression || !equals(currentExpression.expression, newExpression.expression)) {
          changed = true;
          this.mapFolderToParsedExpression.set(folderUriStr, parse(newExpression.expression));
          this.mapFolderToConfiguredExpression.set(folderUriStr, newExpression);
        }
      } else {
        if (currentExpression) {
          changed = true;
          this.mapFolderToParsedExpression.delete(folderUriStr);
          this.mapFolderToConfiguredExpression.delete(folderUriStr);
        }
      }
    }
    const foldersMap = new ResourceSet(this.contextService.getWorkspace().folders.map((folder) => folder.uri));
    for (const [folder] of this.mapFolderToConfiguredExpression) {
      if (folder === ResourceGlobMatcher.NO_FOLDER) {
        continue;
      }
      if (!foldersMap.has(URI.parse(folder))) {
        this.mapFolderToParsedExpression.delete(folder);
        this.mapFolderToConfiguredExpression.delete(folder);
        changed = true;
      }
    }
    const globalNewExpression = this.doGetExpression(void 0);
    const globalCurrentExpression = this.mapFolderToConfiguredExpression.get(ResourceGlobMatcher.NO_FOLDER);
    if (globalNewExpression) {
      if (!globalCurrentExpression || !equals(globalCurrentExpression.expression, globalNewExpression.expression)) {
        changed = true;
        this.mapFolderToParsedExpression.set(ResourceGlobMatcher.NO_FOLDER, parse(globalNewExpression.expression));
        this.mapFolderToConfiguredExpression.set(ResourceGlobMatcher.NO_FOLDER, globalNewExpression);
      }
    } else {
      if (globalCurrentExpression) {
        changed = true;
        this.mapFolderToParsedExpression.delete(ResourceGlobMatcher.NO_FOLDER);
        this.mapFolderToConfiguredExpression.delete(ResourceGlobMatcher.NO_FOLDER);
      }
    }
    if (fromEvent && changed) {
      this._onExpressionChange.fire();
    }
  }
  doGetExpression(resource) {
    const expression = this.getExpression(resource);
    if (!expression) {
      return void 0;
    }
    const keys = Object.keys(expression);
    if (keys.length === 0) {
      return void 0;
    }
    let hasAbsolutePath = false;
    const massagedExpression = /* @__PURE__ */ Object.create(null);
    for (const key of keys) {
      if (!hasAbsolutePath) {
        hasAbsolutePath = isAbsolute(key);
      }
      let massagedKey = key;
      const driveLetter = getDriveLetter(
        massagedKey,
        true
        /* probe for windows */
      );
      if (driveLetter) {
        const driveLetterLower = driveLetter.toLowerCase();
        if (driveLetter !== driveLetter.toLowerCase()) {
          massagedKey = `${driveLetterLower}${massagedKey.substring(1)}`;
        }
      }
      massagedExpression[massagedKey] = expression[key];
    }
    return {
      expression: massagedExpression,
      hasAbsolutePath
    };
  }
  matches(resource, hasSibling) {
    if (this.mapFolderToParsedExpression.size === 0) {
      return false;
    }
    const folder = this.contextService.getWorkspaceFolder(resource);
    let expressionForFolder;
    let expressionConfigForFolder;
    if (folder && this.mapFolderToParsedExpression.has(folder.uri.toString())) {
      expressionForFolder = this.mapFolderToParsedExpression.get(folder.uri.toString());
      expressionConfigForFolder = this.mapFolderToConfiguredExpression.get(folder.uri.toString());
    } else {
      expressionForFolder = this.mapFolderToParsedExpression.get(ResourceGlobMatcher.NO_FOLDER);
      expressionConfigForFolder = this.mapFolderToConfiguredExpression.get(ResourceGlobMatcher.NO_FOLDER);
    }
    if (!expressionForFolder) {
      return false;
    }
    let resourcePathToMatch;
    if (folder) {
      resourcePathToMatch = relativePath(folder.uri, resource);
    } else {
      resourcePathToMatch = this.uriToPath(resource);
    }
    if (typeof resourcePathToMatch === "string" && !!expressionForFolder(resourcePathToMatch, void 0, hasSibling)) {
      return true;
    }
    if (resourcePathToMatch !== this.uriToPath(resource) && expressionConfigForFolder?.hasAbsolutePath) {
      return !!expressionForFolder(this.uriToPath(resource), void 0, hasSibling);
    }
    return false;
  }
  uriToPath(uri) {
    if (uri.scheme === Schemas.file) {
      return uri.fsPath;
    }
    return uri.path;
  }
};
ResourceGlobMatcher = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IConfigurationService)
], ResourceGlobMatcher);
export {
  ResourceGlobMatcher
};
