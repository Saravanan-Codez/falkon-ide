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
import { localize } from "../../../../nls.js";
import { dirname, basename } from "../../../../base/common/resources.js";
import { IConfigurationService, isConfigured } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorResourceAccessor, Verbosity, SideBySideEditor } from "../../../common/editor.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { isWindows, isWeb, isMacintosh, isNative } from "../../../../base/common/platform.js";
import { trim } from "../../../../base/common/strings.js";
import { template } from "../../../../base/common/labels.js";
import { ILabelService, Verbosity as LabelVerbosity } from "../../../../platform/label/common/label.js";
import { Emitter } from "../../../../base/common/event.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Schemas } from "../../../../base/common/network.js";
import { getVirtualWorkspaceLocation } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { getWindowById } from "../../../../base/browser/dom.js";
import { IDecorationsService } from "../../../services/decorations/common/decorations.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
var WindowSettingNames = /* @__PURE__ */ ((WindowSettingNames2) => {
  WindowSettingNames2["titleSeparator"] = "window.titleSeparator";
  WindowSettingNames2["title"] = "window.title";
  return WindowSettingNames2;
})(WindowSettingNames || {});
const defaultWindowTitle = (() => {
  if (isMacintosh && isNative) {
    return "${activeEditorShort}${separator}${rootName}${separator}${profileName}";
  }
  const base = "${dirty}${activeEditorShort}${separator}${rootName}${separator}${profileName}${separator}${appName}";
  if (isWeb) {
    return base + "${separator}${remoteName}";
  }
  return base;
})();
const defaultWindowTitleSeparator = isMacintosh ? " \u2014 " : " - ";
let WindowTitle = class extends Disposable {
  constructor(targetWindow, configurationService, contextKeyService, editorService, environmentService, contextService, labelService, userDataProfileService, productService, viewsService, decorationsService, accessibilityService) {
    super();
    this.configurationService = configurationService;
    this.contextKeyService = contextKeyService;
    this.editorService = editorService;
    this.environmentService = environmentService;
    this.contextService = contextService;
    this.labelService = labelService;
    this.userDataProfileService = userDataProfileService;
    this.productService = productService;
    this.viewsService = viewsService;
    this.decorationsService = decorationsService;
    this.accessibilityService = accessibilityService;
    this.properties = { isPure: true, isAdmin: false, prefix: void 0 };
    this.variables = /* @__PURE__ */ new Map();
    this.activeEditorListeners = this._register(new DisposableStore());
    this.titleUpdater = this._register(new RunOnceScheduler(() => this.doUpdateTitle(), 0));
    this.onDidChangeEmitter = this._register(new Emitter());
    this.onDidChange = this.onDidChangeEmitter.event;
    this.titleIncludesFocusedView = false;
    this.titleIncludesEditorState = false;
    this.windowId = targetWindow.vscodeWindowId;
    this.checkTitleVariables();
    this.registerListeners();
  }
  static {
    this.NLS_USER_IS_ADMIN = isWindows ? localize("userIsAdmin", "[Administrator]") : localize("userIsSudo", "[Superuser]");
  }
  static {
    this.NLS_EXTENSION_HOST = localize("devExtensionWindowTitlePrefix", "[Extension Development Host]");
  }
  static {
    this.TITLE_DIRTY = "\u25CF ";
  }
  get value() {
    return this.title ?? "";
  }
  get workspaceName() {
    return this.labelService.getWorkspaceLabel(this.contextService.getWorkspace());
  }
  get fileName() {
    const activeEditor = this.editorService.activeEditor;
    if (!activeEditor) {
      return void 0;
    }
    const fileName = activeEditor.getTitle(Verbosity.SHORT);
    const dirty = activeEditor?.isDirty() && !activeEditor.isSaving() ? WindowTitle.TITLE_DIRTY : "";
    return `${dirty}${fileName}`;
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationChanged(e)));
    this._register(this.editorService.onDidActiveEditorChange(() => this.onActiveEditorChange()));
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.titleUpdater.schedule()));
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.titleUpdater.schedule()));
    this._register(this.contextService.onDidChangeWorkspaceName(() => this.titleUpdater.schedule()));
    this._register(this.labelService.onDidChangeFormatters(() => this.titleUpdater.schedule()));
    this._register(this.userDataProfileService.onDidChangeCurrentProfile(() => this.titleUpdater.schedule()));
    this._register(this.viewsService.onDidChangeFocusedView(() => {
      if (this.titleIncludesFocusedView) {
        this.titleUpdater.schedule();
      }
    }));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this.variables)) {
        this.titleUpdater.schedule();
      }
    }));
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.titleUpdater.schedule()));
  }
  onConfigurationChanged(event) {
    const affectsTitleConfiguration = event.affectsConfiguration("window.title" /* title */);
    if (affectsTitleConfiguration) {
      this.checkTitleVariables();
    }
    if (affectsTitleConfiguration || event.affectsConfiguration("window.titleSeparator" /* titleSeparator */)) {
      this.titleUpdater.schedule();
    }
  }
  checkTitleVariables() {
    const titleTemplate = this.configurationService.getValue("window.title" /* title */);
    if (typeof titleTemplate === "string") {
      this.titleIncludesFocusedView = titleTemplate.includes("${focusedView}");
      this.titleIncludesEditorState = titleTemplate.includes("${activeEditorState}");
    }
  }
  onActiveEditorChange() {
    this.activeEditorListeners.clear();
    this.titleUpdater.schedule();
    const activeEditor = this.editorService.activeEditor;
    if (activeEditor) {
      this.activeEditorListeners.add(activeEditor.onDidChangeDirty(() => this.titleUpdater.schedule()));
      this.activeEditorListeners.add(activeEditor.onDidChangeLabel(() => this.titleUpdater.schedule()));
    }
    if (this.titleIncludesFocusedView) {
      const activeTextEditorControl = this.editorService.activeTextEditorControl;
      const textEditorControls = [];
      if (isCodeEditor(activeTextEditorControl)) {
        textEditorControls.push(activeTextEditorControl);
      } else if (isDiffEditor(activeTextEditorControl)) {
        textEditorControls.push(activeTextEditorControl.getOriginalEditor(), activeTextEditorControl.getModifiedEditor());
      }
      for (const textEditorControl of textEditorControls) {
        this.activeEditorListeners.add(textEditorControl.onDidBlurEditorText(() => this.titleUpdater.schedule()));
        this.activeEditorListeners.add(textEditorControl.onDidFocusEditorText(() => this.titleUpdater.schedule()));
      }
    }
    if (this.titleIncludesEditorState) {
      this.activeEditorListeners.add(this.decorationsService.onDidChangeDecorations(() => this.titleUpdater.schedule()));
    }
  }
  doUpdateTitle() {
    const title = this.getFullWindowTitle();
    if (title !== this.title) {
      let nativeTitle = title;
      if (!trim(nativeTitle)) {
        nativeTitle = this.productService.nameLong;
      }
      const window = getWindowById(this.windowId, true).window;
      if (!window.document.title && isMacintosh && nativeTitle === this.productService.nameLong) {
        window.document.title = `${this.productService.nameLong} ${WindowTitle.TITLE_DIRTY}`;
      }
      window.document.title = nativeTitle;
      this.title = title;
      this.onDidChangeEmitter.fire();
    }
  }
  getFullWindowTitle() {
    const { prefix, suffix } = this.getTitleDecorations();
    let title = this.getWindowTitle() || this.productService.nameLong;
    if (prefix) {
      title = `${prefix} ${title}`;
    }
    if (suffix) {
      title = `${title} ${suffix}`;
    }
    return title.replace(/[^\S ]/g, " ");
  }
  getTitleDecorations() {
    let prefix;
    let suffix;
    if (this.properties.prefix) {
      prefix = this.properties.prefix;
    }
    if (this.environmentService.isExtensionDevelopment) {
      prefix = !prefix ? WindowTitle.NLS_EXTENSION_HOST : `${WindowTitle.NLS_EXTENSION_HOST} - ${prefix}`;
    }
    if (this.properties.isAdmin) {
      suffix = WindowTitle.NLS_USER_IS_ADMIN;
    }
    return { prefix, suffix };
  }
  updateProperties(properties) {
    const isAdmin = typeof properties.isAdmin === "boolean" ? properties.isAdmin : this.properties.isAdmin;
    const isPure = typeof properties.isPure === "boolean" ? properties.isPure : this.properties.isPure;
    const prefix = typeof properties.prefix === "string" ? properties.prefix : this.properties.prefix;
    if (isAdmin !== this.properties.isAdmin || isPure !== this.properties.isPure || prefix !== this.properties.prefix) {
      this.properties.isAdmin = isAdmin;
      this.properties.isPure = isPure;
      this.properties.prefix = prefix;
      this.titleUpdater.schedule();
    }
  }
  registerVariables(variables) {
    let changed = false;
    for (const { name, contextKey } of variables) {
      if (!this.variables.has(contextKey)) {
        this.variables.set(contextKey, name);
        changed = true;
      }
    }
    if (changed) {
      this.titleUpdater.schedule();
    }
  }
  /**
   * Possible template values:
   *
   * {activeEditorLong}: e.g. /Users/Development/myFolder/myFileFolder/myFile.txt
   * {activeEditorMedium}: e.g. myFolder/myFileFolder/myFile.txt
   * {activeEditorShort}: e.g. myFile.txt
   * {activeEditorLanguageId}: e.g. typescript
   * {activeFolderLong}: e.g. /Users/Development/myFolder/myFileFolder
   * {activeFolderMedium}: e.g. myFolder/myFileFolder
   * {activeFolderShort}: e.g. myFileFolder
   * {rootName}: e.g. myFolder1, myFolder2, myFolder3
   * {rootPath}: e.g. /Users/Development
   * {folderName}: e.g. myFolder
   * {folderPath}: e.g. /Users/Development/myFolder
   * {appName}: e.g. VS Code
   * {remoteName}: e.g. SSH
   * {dirty}: indicator
   * {focusedView}: e.g. Terminal
   * {separator}: conditional separator
   * {activeEditorState}: e.g. Modified
   */
  getWindowTitle() {
    const editor = this.editorService.activeEditor;
    const workspace = this.contextService.getWorkspace();
    let root;
    if (workspace.configuration) {
      root = workspace.configuration;
    } else if (workspace.folders.length) {
      root = workspace.folders[0].uri;
    }
    const editorResource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    let editorFolderResource = editorResource ? dirname(editorResource) : void 0;
    if (editorFolderResource?.path === ".") {
      editorFolderResource = void 0;
    }
    let folder = void 0;
    if (this.contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      folder = workspace.folders[0];
    } else if (editorResource) {
      folder = this.contextService.getWorkspaceFolder(editorResource) ?? void 0;
    }
    let remoteName = void 0;
    if (this.environmentService.remoteAuthority && !isWeb) {
      remoteName = this.labelService.getHostLabel(Schemas.vscodeRemote, this.environmentService.remoteAuthority);
    } else {
      const virtualWorkspaceLocation = getVirtualWorkspaceLocation(workspace);
      if (virtualWorkspaceLocation) {
        remoteName = this.labelService.getHostLabel(virtualWorkspaceLocation.scheme, virtualWorkspaceLocation.authority);
      }
    }
    const activeEditorShort = editor ? editor.getTitle(Verbosity.SHORT) : "";
    const activeEditorMedium = editor ? editor.getTitle(Verbosity.MEDIUM) : activeEditorShort;
    const activeEditorLong = editor ? editor.getTitle(Verbosity.LONG) : activeEditorMedium;
    const activeFolderShort = editorFolderResource ? basename(editorFolderResource) : "";
    const activeFolderMedium = editorFolderResource ? this.labelService.getUriLabel(editorFolderResource, { relative: true }) : "";
    const activeFolderLong = editorFolderResource ? this.labelService.getUriLabel(editorFolderResource) : "";
    const rootName = this.labelService.getWorkspaceLabel(workspace);
    const rootNameShort = this.labelService.getWorkspaceLabel(workspace, { verbose: LabelVerbosity.SHORT });
    const rootPath = root ? this.labelService.getUriLabel(root) : "";
    const folderName = folder ? folder.name : "";
    const folderPath = folder ? this.labelService.getUriLabel(folder.uri) : "";
    const dirty = editor?.isDirty() && !editor.isSaving() ? WindowTitle.TITLE_DIRTY : "";
    const appName = this.productService.nameLong;
    const profileName = this.userDataProfileService.currentProfile.isDefault ? "" : this.userDataProfileService.currentProfile.name;
    const focusedView = this.viewsService.getFocusedViewName();
    const activeEditorState = editorResource ? this.decorationsService.getDecoration(editorResource, false)?.tooltip : void 0;
    const activeEditorLanguageId = this.editorService.activeTextEditorLanguageId;
    const variables = {};
    for (const [contextKey, name] of this.variables) {
      variables[name] = this.contextKeyService.getContextKeyValue(contextKey) ?? "";
    }
    let titleTemplate = this.configurationService.getValue("window.title" /* title */);
    if (typeof titleTemplate !== "string") {
      titleTemplate = defaultWindowTitle;
    }
    if (!this.titleIncludesEditorState && this.accessibilityService.isScreenReaderOptimized() && this.configurationService.getValue("accessibility.windowTitleOptimized")) {
      titleTemplate += "${separator}${activeEditorState}";
    }
    let separator = this.configurationService.getValue("window.titleSeparator" /* titleSeparator */);
    if (typeof separator !== "string") {
      separator = defaultWindowTitleSeparator;
    }
    return template(titleTemplate, {
      ...variables,
      activeEditorShort,
      activeEditorLong,
      activeEditorMedium,
      activeEditorLanguageId,
      activeFolderShort,
      activeFolderMedium,
      activeFolderLong,
      rootName,
      rootPath,
      rootNameShort,
      folderName,
      folderPath,
      dirty,
      appName,
      remoteName,
      profileName,
      focusedView,
      activeEditorState,
      separator: { label: separator }
    });
  }
  isCustomTitleFormat() {
    if (this.accessibilityService.isScreenReaderOptimized() || this.titleIncludesEditorState) {
      return true;
    }
    const title = this.configurationService.inspect("window.title" /* title */);
    const titleSeparator = this.configurationService.inspect("window.titleSeparator" /* titleSeparator */);
    if (isConfigured(title) || isConfigured(titleSeparator)) {
      return true;
    }
    const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    const configurationProperties = configurationRegistry.getConfigurationProperties();
    return title.defaultValue !== configurationProperties["window.title" /* title */]?.defaultDefaultValue;
  }
};
WindowTitle = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IBrowserWorkbenchEnvironmentService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IUserDataProfileService),
  __decorateParam(8, IProductService),
  __decorateParam(9, IViewsService),
  __decorateParam(10, IDecorationsService),
  __decorateParam(11, IAccessibilityService)
], WindowTitle);
export {
  WindowTitle,
  defaultWindowTitle,
  defaultWindowTitleSeparator
};
