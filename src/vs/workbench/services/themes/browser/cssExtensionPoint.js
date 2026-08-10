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
import * as nls from "../../../../nls.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { isProposedApiEnabled } from "../../extensions/common/extensions.js";
import * as resources from "../../../../base/common/resources.js";
import { IFileService, FileChangeType } from "../../../../platform/files/common/files.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { FileAccess } from "../../../../base/common/network.js";
import { createLinkElement } from "../../../../base/browser/dom.js";
import { IWorkbenchThemeService } from "../common/workbenchThemeService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
const CSS_CACHE_STORAGE_KEY = "workbench.contrib.css.cache";
const cssExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "css",
  jsonSchema: {
    description: nls.localize("contributes.css", "Contributes CSS files to be loaded in the workbench."),
    type: "array",
    items: {
      type: "object",
      properties: {
        path: {
          description: nls.localize("contributes.css.path", "Path to the CSS file. The path is relative to the extension folder."),
          type: "string"
        }
      },
      required: ["path"]
    },
    defaultSnippets: [{ body: [{ path: "${1:styles.css}" }] }]
  }
});
class CSSFileWatcher {
  constructor(fileService, environmentService, onUpdate) {
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.onUpdate = onUpdate;
    this.watchedLocations = /* @__PURE__ */ new Map();
  }
  watch(uri) {
    const key = uri.toString();
    if (this.watchedLocations.has(key)) {
      return;
    }
    if (!this.environmentService.isExtensionDevelopment) {
      return;
    }
    const disposables = new DisposableStore();
    disposables.add(this.fileService.watch(uri));
    disposables.add(this.fileService.onDidFilesChange((e) => {
      if (e.contains(uri, FileChangeType.UPDATED)) {
        this.onUpdate(uri);
      }
    }));
    this.watchedLocations.set(key, { uri, disposables });
  }
  unwatch(uri) {
    const key = uri.toString();
    const entry = this.watchedLocations.get(key);
    if (entry) {
      entry.disposables.dispose();
      this.watchedLocations.delete(key);
    }
  }
  dispose() {
    for (const entry of this.watchedLocations.values()) {
      entry.disposables.dispose();
    }
    this.watchedLocations.clear();
  }
}
let CSSExtensionPoint = class {
  constructor(fileService, environmentService, themeService, storageService) {
    this.themeService = themeService;
    this.storageService = storageService;
    this.disposables = new DisposableStore();
    this.stylesheetsByExtension = /* @__PURE__ */ new Map();
    this.pendingExtensions = /* @__PURE__ */ new Map();
    this.watcher = this.disposables.add(new CSSFileWatcher(fileService, environmentService, (uri) => this.reloadStylesheet(uri)));
    this.disposables.add(toDisposable(() => {
      for (const entries of this.stylesheetsByExtension.values()) {
        for (const entry of entries) {
          entry.disposables.dispose();
        }
      }
      this.stylesheetsByExtension.clear();
    }));
    this.applyCachedCSS();
    this.disposables.add(this.themeService.onDidColorThemeChange(() => this.onThemeChange()));
    this.disposables.add(this.themeService.onDidFileIconThemeChange(() => this.onThemeChange()));
    this.disposables.add(this.themeService.onDidProductIconThemeChange(() => this.onThemeChange()));
    cssExtensionPoint.setHandler((extensions, delta) => {
      for (const extension of delta.removed) {
        const extensionId = extension.description.identifier.value;
        this.pendingExtensions.delete(extensionId);
        this.removeStylesheets(extensionId);
        this.clearCacheForExtension(extensionId);
      }
      for (const extension of delta.added) {
        if (!isProposedApiEnabled(extension.description, "css")) {
          extension.collector.error(`The '${cssExtensionPoint.name}' contribution point is proposed API.`);
          continue;
        }
        const extensionValue = extension.value;
        const collector = extension.collector;
        if (!extensionValue || !Array.isArray(extensionValue)) {
          collector.error(nls.localize("invalid.css.configuration", "'contributes.css' must be an array."));
          continue;
        }
        const extensionId = extension.description.identifier.value;
        this.pendingExtensions.set(extensionId, extension);
        if (this.isExtensionThemeActive(extensionId)) {
          this.activateExtensionCSS(extension);
        } else if (this.stylesheetsByExtension.has(extensionId)) {
          this.removeStylesheets(extensionId);
          this.clearCacheForExtension(extensionId);
        }
      }
    });
  }
  isExtensionThemeActive(extensionId) {
    const colorTheme = this.themeService.getColorTheme();
    const fileIconTheme = this.themeService.getFileIconTheme();
    const productIconTheme = this.themeService.getProductIconTheme();
    return !!(colorTheme.extensionData && ExtensionIdentifier.equals(colorTheme.extensionData.extensionId, extensionId)) || !!(fileIconTheme.extensionData && ExtensionIdentifier.equals(fileIconTheme.extensionData.extensionId, extensionId)) || !!(productIconTheme.extensionData && ExtensionIdentifier.equals(productIconTheme.extensionData.extensionId, extensionId));
  }
  onThemeChange() {
    for (const [extensionId, extension] of this.pendingExtensions) {
      if (!this.stylesheetsByExtension.has(extensionId) && this.isExtensionThemeActive(extensionId)) {
        this.activateExtensionCSS(extension);
      }
    }
    for (const extensionId of this.stylesheetsByExtension.keys()) {
      if (!this.isExtensionThemeActive(extensionId)) {
        this.removeStylesheets(extensionId);
        this.clearCacheForExtension(extensionId);
      }
    }
  }
  activateExtensionCSS(extension) {
    const extensionId = extension.description.identifier.value;
    if (this.stylesheetsByExtension.has(extensionId)) {
      return;
    }
    const extensionLocation = extension.description.extensionLocation;
    const extensionValue = extension.value;
    const collector = extension.collector;
    const entries = [];
    const cssLocations = [];
    for (const cssContribution of extensionValue) {
      if (!cssContribution.path || typeof cssContribution.path !== "string") {
        collector.error(nls.localize("invalid.css.path", "'contributes.css.path' must be a string."));
        continue;
      }
      const cssLocation = resources.joinPath(extensionLocation, cssContribution.path);
      if (!resources.isEqualOrParent(cssLocation, extensionLocation)) {
        collector.warn(nls.localize("invalid.css.path.location", "Expected 'contributes.css.path' ({0}) to be included inside extension's folder ({1}).", cssLocation.path, extensionLocation.path));
        continue;
      }
      const entryDisposables = new DisposableStore();
      const element = this.createCSSLinkElement(cssLocation, extensionId, entryDisposables);
      entries.push({ uri: cssLocation, element, disposables: entryDisposables });
      cssLocations.push(cssLocation.toString());
      this.watcher.watch(cssLocation);
    }
    if (entries.length > 0) {
      this.stylesheetsByExtension.set(extensionId, entries);
      this.cacheExtensionCSS(extensionId, cssLocations);
    }
  }
  removeStylesheets(extensionId) {
    const entries = this.stylesheetsByExtension.get(extensionId);
    if (entries) {
      for (const entry of entries) {
        this.watcher.unwatch(entry.uri);
        entry.disposables.dispose();
      }
      this.stylesheetsByExtension.delete(extensionId);
    }
  }
  applyCachedCSS() {
    const cached = this.getCachedCSS();
    if (!cached) {
      return;
    }
    if (!this.isExtensionThemeActive(cached.extensionId)) {
      this.clearCacheForExtension(cached.extensionId);
      return;
    }
    const entries = [];
    for (const cssLocationString of cached.cssLocations) {
      const cssLocation = URI.parse(cssLocationString);
      const entryDisposables = new DisposableStore();
      const element = this.createCSSLinkElement(cssLocation, cached.extensionId, entryDisposables);
      entries.push({ uri: cssLocation, element, disposables: entryDisposables });
      this.watcher.watch(cssLocation);
    }
    if (entries.length > 0) {
      this.stylesheetsByExtension.set(cached.extensionId, entries);
    }
  }
  getCachedCSS() {
    const raw = this.storageService.get(CSS_CACHE_STORAGE_KEY, StorageScope.PROFILE);
    if (!raw) {
      return void 0;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return void 0;
    }
  }
  cacheExtensionCSS(extensionId, cssLocations) {
    const entry = { extensionId, cssLocations };
    this.storageService.store(CSS_CACHE_STORAGE_KEY, JSON.stringify(entry), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  clearCacheForExtension(extensionId) {
    const cached = this.getCachedCSS();
    if (cached && ExtensionIdentifier.equals(cached.extensionId, extensionId)) {
      this.storageService.remove(CSS_CACHE_STORAGE_KEY, StorageScope.PROFILE);
    }
  }
  createCSSLinkElement(uri, extensionId, disposables) {
    const element = createLinkElement();
    element.rel = "stylesheet";
    element.type = "text/css";
    element.className = `extension-contributed-css ${extensionId}`;
    element.href = FileAccess.uriToBrowserUri(uri).toString(true);
    disposables.add(toDisposable(() => element.remove()));
    return element;
  }
  reloadStylesheet(uri) {
    const uriString = uri.toString();
    for (const entries of this.stylesheetsByExtension.values()) {
      for (const entry of entries) {
        if (entry.uri.toString() === uriString) {
          const browserUri = FileAccess.uriToBrowserUri(uri);
          entry.element.href = browserUri.with({ query: `v=${Date.now()}` }).toString(true);
        }
      }
    }
  }
  dispose() {
    this.disposables.dispose();
  }
};
CSSExtensionPoint = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService),
  __decorateParam(2, IWorkbenchThemeService),
  __decorateParam(3, IStorageService)
], CSSExtensionPoint);
export {
  CSSExtensionPoint
};
