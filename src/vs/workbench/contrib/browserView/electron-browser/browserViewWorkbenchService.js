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
import { BrowserViewCommandId, BrowserViewStorageScope, ipcBrowserViewChannelName } from "../../../../platform/browserView/common/browserView.js";
import { BrowserViewModel } from "../common/browserView.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { Emitter } from "../../../../base/common/event.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { process } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, IEditorService, SIDE_GROUP, USE_MODAL_EDITOR_SETTING } from "../../../services/editor/common/editorService.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { BrowserEditorInput } from "../common/browserEditorInput.js";
import { IEditorGroupsService, preferredSideBySideGroupDirection } from "../../../services/editor/common/editorGroupsService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
import { IsSessionsWindowContext } from "../../../common/contextkeys.js";
import { ChatConfiguration } from "../../chat/common/constants.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { contrastBorder, descriptionForeground, focusBorder } from "../../../../platform/theme/common/colors/baseColors.js";
import { buttonForeground, buttonBackground, inputPlaceholderForeground } from "../../../../platform/theme/common/colors/inputColors.js";
import { editorWidgetBackground, editorWidgetBorder, editorWidgetForeground, toolbarHoverBackground, widgetShadow } from "../../../../platform/theme/common/colors/editorColors.js";
import { DEFAULT_FONT_FAMILY } from "../../../../base/browser/fonts.js";
import { findGroup } from "../../../services/editor/common/editorGroupFinder.js";
import { ChatEditorInput } from "../../chat/browser/widgetHosts/editor/chatEditorInput.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { URI } from "../../../../base/common/uri.js";
import { isEqual } from "../../../../base/common/resources.js";
import { Schemas } from "../../../../base/common/network.js";
import { getCopilotRootPaths } from "../../../../platform/agentHost/common/copilotHome.js";
import { localChatSessionType } from "../../chat/common/chatSessionsService.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
const BrowserMaxHistoryEntriesSettingId = "workbench.browser.maxHistoryEntries";
const BrowserRemoteProxyEnabledSettingId = "workbench.browser.enableRemoteProxy";
const BrowserNewTabPlacementSettingId = "workbench.browser.newTabPlacement";
const browserViewContextMenuCommands = [
  BrowserViewCommandId.GoBack,
  BrowserViewCommandId.GoForward,
  BrowserViewCommandId.Reload
];
let BrowserViewWorkbenchService = class extends Disposable {
  constructor(mainProcessService, instantiationService, workspaceContextService, keybindingService, editorService, editorGroupsService, configurationService, workspaceTrustManagementService, workspaceTrustEnablementService, logService, contextKeyService, environmentService, themeService, chatWidgetService, accessibilityService) {
    super();
    this.instantiationService = instantiationService;
    this.workspaceContextService = workspaceContextService;
    this.keybindingService = keybindingService;
    this.editorService = editorService;
    this.editorGroupsService = editorGroupsService;
    this.configurationService = configurationService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.workspaceTrustEnablementService = workspaceTrustEnablementService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.environmentService = environmentService;
    this.themeService = themeService;
    this.chatWidgetService = chatWidgetService;
    this.accessibilityService = accessibilityService;
    this._known = /* @__PURE__ */ new Map();
    this._contextualFilters = /* @__PURE__ */ new Set();
    this._openHandlers = /* @__PURE__ */ new Set();
    this._onDidChangeBrowserViews = this._register(new Emitter());
    this.onDidChangeBrowserViews = this._onDidChangeBrowserViews.event;
    this._isSharingAvailable = false;
    this._onDidChangeSharingAvailable = this._register(new Emitter());
    this.onDidChangeSharingAvailable = this._onDidChangeSharingAvailable.event;
    const channel = mainProcessService.getChannel(ipcBrowserViewChannelName);
    this._browserViewService = ProxyChannel.toService(channel);
    this._mainWindowId = mainWindow.vscodeWindowId;
    this._updateWindowConfiguration();
    const chatEnabledKeys = new Set(ChatContextKeys.enabled.keys());
    this._register(this.keybindingService.onDidUpdateKeybindings(() => this._updateWindowConfiguration()));
    this._register(this.themeService.onDidColorThemeChange(() => this._updateWindowConfiguration()));
    this._register(this.accessibilityService.onDidChangeReducedMotion(() => this._updateWindowConfiguration()));
    this._register(this.workspaceTrustManagementService.onDidChangeTrustedFolders(() => this._updateWindowConfiguration()));
    this._register(this.workspaceTrustManagementService.onDidChangeTrust(() => this._updateWindowConfiguration()));
    this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this._updateWindowConfiguration()));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(chatEnabledKeys)) {
        this._updateWindowConfiguration();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(BrowserMaxHistoryEntriesSettingId) || e.affectsConfiguration(BrowserRemoteProxyEnabledSettingId)) {
        this._updateWindowConfiguration();
      }
    }));
    this._isSharingAvailable = this.contextKeyService.contextMatchesRules(BrowserViewWorkbenchService._sharingAvailableContext);
    const sharingKeys = new Set(BrowserViewWorkbenchService._sharingAvailableContext.keys());
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(sharingKeys)) {
        const was = this._isSharingAvailable;
        this._isSharingAvailable = this.contextKeyService.contextMatchesRules(BrowserViewWorkbenchService._sharingAvailableContext);
        if (was !== this._isSharingAvailable) {
          this._onDidChangeSharingAvailable.fire(this._isSharingAvailable);
        }
      }
    }));
    void this._initializeExistingViews().catch((e) => {
      this.logService.error("[BrowserViewWorkbenchService] Failed to initialize existing browser views.", e);
    });
    this._register(this._browserViewService.onDidCreateBrowserView((e) => {
      if (e.info.owner.mainWindowId !== this._mainWindowId) {
        return;
      }
      this._createModel(e.info.id, e.info.owner, e.info.state);
      const editor = this._known.get(e.info.id);
      if (editor && e.openOptions) {
        void this._openEditorForCreatedView(editor, e.info.owner, e.openOptions).catch((error) => {
          this.logService.error("[BrowserViewWorkbenchService] Failed to open editor for created browser view.", error);
        });
      }
    }));
  }
  static {
    this._sharingAvailableContext = ContextKeyExpr.and(
      ChatContextKeys.enabled,
      ContextKeyExpr.has(`config.${ChatConfiguration.AgentEnabled}`),
      ContextKeyExpr.has(`config.workbench.browser.enableChatTools`),
      // If we're in Sessions Window, we require some additional conditions.
      ContextKeyExpr.or(
        IsSessionsWindowContext.negate(),
        ContextKeyExpr.or(
          ContextKeyExpr.equals("sessionType", localChatSessionType),
          ContextKeyExpr.equals("sessions.isAgentHostSession", true)
        )
      )
    );
  }
  get isSharingAvailable() {
    return this._isSharingAvailable;
  }
  willUseRemoteProxy() {
    if (!this.environmentService.remoteAuthority) {
      return false;
    }
    if (!this.configurationService.getValue(BrowserRemoteProxyEnabledSettingId)) {
      return false;
    }
    return true;
  }
  setRemoteProxyInfo(info) {
    this._remoteProxyInfo = info;
    this._updateWindowConfiguration();
  }
  getKnownBrowserViews() {
    return this._known;
  }
  registerContextualFilter(filter) {
    this._contextualFilters.add(filter);
    const changeListener = filter.onDidChange?.(() => this._onDidChangeBrowserViews.fire());
    this._onDidChangeBrowserViews.fire();
    return toDisposable(() => {
      this._contextualFilters.delete(filter);
      changeListener?.dispose();
      this._onDidChangeBrowserViews.fire();
    });
  }
  getContextualBrowserViews(context) {
    if (this._contextualFilters.size === 0) {
      return this._known;
    }
    const filters = [...this._contextualFilters];
    const result = /* @__PURE__ */ new Map();
    for (const [id, input] of this._known) {
      if (filters.every((filter) => filter.include(input, { ...context }))) {
        result.set(id, input);
      }
    }
    return result;
  }
  async getPreferredGroup(preferredGroup) {
    if (preferredGroup === SIDE_GROUP) {
      return this._getOrCreateDedicatedGroup("sideGroup");
    }
    if (preferredGroup !== void 0 && preferredGroup !== ACTIVE_GROUP) {
      return preferredGroup;
    }
    const placement = this.configurationService.getValue(BrowserNewTabPlacementSettingId);
    if (placement === "sideGroup" || placement === "window") {
      return this._getOrCreateDedicatedGroup(placement);
    }
    if (this.configurationService.getValue(USE_MODAL_EDITOR_SETTING) === "all") {
      return this.editorGroupsService.mainPart.activeGroup;
    }
    return preferredGroup;
  }
  /**
   * Resolve the dedicated editor group for the given placement, reusing an
   * existing locked browser group if one is found (so it survives window
   * reloads) or creating and locking a new one otherwise. Side-group creation
   * is synchronous; window creation is asynchronous.
   */
  _getOrCreateDedicatedGroup(placement) {
    const existing = this._findDedicatedGroup(placement);
    if (existing) {
      return existing;
    }
    if (placement === "sideGroup") {
      const direction = preferredSideBySideGroupDirection(this.configurationService);
      const group = this.editorGroupsService.addGroup(this.editorGroupsService.activeGroup, direction);
      group.lock(true);
      return group;
    }
    if (!this._dedicatedWindowGroupPromise) {
      this._dedicatedWindowGroupPromise = this.editorGroupsService.createAuxiliaryEditorPart().then((part) => {
        part.activeGroup.lock(true);
        return part.activeGroup;
      }).finally(() => this._dedicatedWindowGroupPromise = void 0);
    }
    return this._dedicatedWindowGroupPromise;
  }
  /**
   * Find an existing dedicated browser group for the given placement. A group
   * qualifies when it is locked and contains a browser editor (or is empty),
   * which lets us rediscover the dedicated group after a window reload
   * without tracking it in memory. Side groups live in the main editor part;
   * window groups live in an auxiliary editor part.
   */
  _findDedicatedGroup(placement) {
    const mainPart = this.editorGroupsService.mainPart;
    for (const group of this.editorGroupsService.groups) {
      if (!group.isLocked) {
        continue;
      }
      if (group.editors.length > 0 && !group.editors.some((editor) => editor instanceof BrowserEditorInput)) {
        continue;
      }
      const inMainPart = this.editorGroupsService.getPart(group) === mainPart;
      const matchesPlacement = placement === "sideGroup" ? inMainPart : !inMainPart;
      if (matchesPlacement) {
        return group;
      }
    }
    return void 0;
  }
  registerOpenHandler(handler) {
    this._openHandlers.add(handler);
    return toDisposable(() => {
      this._openHandlers.delete(handler);
    });
  }
  getOrCreateLazy(id, initialState, model) {
    if (!this._known.has(id)) {
      const input = this.instantiationService.createInstance(BrowserEditorInput, { id, ...initialState }, async () => {
        const state = await this._browserViewService.getOrCreateBrowserView(
          id,
          {
            owner: this._getDefaultOwner(),
            sessionOptions: {
              scope: await this._resolveStorageScope()
            },
            initialState: {
              url: initialState?.url,
              title: initialState?.title,
              lastFavicon: initialState?.favicon
            }
          }
        );
        return this._createModel(id, this._getDefaultOwner(), state);
      });
      input.onWillDispose(() => {
        this._known.delete(id);
        this._onDidChangeBrowserViews.fire();
      });
      if (model) {
        input.model = model;
      }
      this._known.set(id, input);
      this._onDidChangeBrowserViews.fire();
    }
    return this._known.get(id);
  }
  async clearGlobalStorage() {
    return this._browserViewService.clearGlobalStorage();
  }
  async clearWorkspaceStorage() {
    const workspaceId = this.workspaceContextService.getWorkspace().id;
    return this._browserViewService.clearWorkspaceStorage(workspaceId);
  }
  _getDefaultOwner() {
    return { mainWindowId: this._mainWindowId };
  }
  async _resolveStorageScope() {
    let dataStorage = this.configurationService.getValue(
      "workbench.browser.dataStorage"
    ) ?? "default";
    await this.workspaceTrustManagementService.workspaceTrustInitialized;
    const isWorkspaceUntrusted = this.workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY && !this.workspaceTrustManagementService.isWorkspaceTrusted();
    if (isWorkspaceUntrusted) {
      dataStorage = BrowserViewStorageScope.Ephemeral;
    } else if (dataStorage === "default") {
      dataStorage = this.environmentService.remoteAuthority ? BrowserViewStorageScope.Workspace : BrowserViewStorageScope.Global;
    }
    return dataStorage;
  }
  /**
   * Fetch all views owned by this window from the main service and create
   * models for them so they are available synchronously.
   */
  async _initializeExistingViews() {
    const views = await this._browserViewService.getBrowserViews(this._mainWindowId);
    for (const info of views) {
      this._createModel(info.id, info.owner, info.state);
    }
  }
  _createModel(id, owner, state) {
    const existing = this._known.get(id)?.model;
    if (existing) {
      return existing;
    }
    const model = this.instantiationService.createInstance(BrowserViewModel, id, owner, state, this._browserViewService);
    this.getOrCreateLazy(id, {}, model).model = model;
    this._onDidChangeBrowserViews.fire();
    return model;
  }
  /**
   * Open an editor tab for a newly created browser view.
   */
  async _openEditorForCreatedView(view, owner, openOptions) {
    const opts = openOptions;
    for (const handler of this._openHandlers) {
      if (!handler.shouldOpenEditor(view, owner, opts)) {
        return;
      }
    }
    let targetGroup;
    if (opts.auxiliaryWindow) {
      targetGroup = AUX_WINDOW_GROUP;
    } else if (opts.parentViewId) {
      targetGroup = this._findEditorGroupForView(opts.parentViewId);
      if (targetGroup === void 0) {
        return;
      }
    } else {
      targetGroup = await this.getPreferredGroup();
    }
    const editorOptions = {
      inactive: opts.background,
      preserveFocus: opts.preserveFocus,
      pinned: opts.pinned,
      auxiliary: opts.auxiliaryWindow ? { bounds: opts.auxiliaryWindow, compact: true } : void 0
    };
    const [group] = await this.instantiationService.invokeFunction(findGroup, { editor: view, options: editorOptions }, targetGroup);
    if (owner.sessionId) {
      const sessionResource = URI.parse(owner.sessionId);
      const widget = this.chatWidgetService.getWidgetBySessionResource(sessionResource);
      const isWidgetVisible = !!widget && widget.domNode.offsetParent !== null;
      const activeIsSameSession = group.activeEditor instanceof ChatEditorInput && isEqual(group.activeEditor.sessionResource, sessionResource);
      if (!isWidgetVisible || activeIsSameSession) {
        editorOptions.inactive = true;
      }
    }
    void this.editorService.openEditor(view, editorOptions, group);
  }
  /**
   * Find the editor group that currently contains a browser view with the
   * given ID, or undefined if not open in any group.
   */
  _findEditorGroupForView(viewId) {
    for (const group of this.editorGroupsService.groups) {
      for (const editor of group.editors) {
        if (editor instanceof BrowserEditorInput && editor.id === viewId) {
          return group.id;
        }
      }
    }
    return void 0;
  }
  _updateWindowConfiguration() {
    void this._browserViewService.updateWindowConfiguration(this._mainWindowId, {
      theme: this._getTheme(),
      keybindings: this._getKeybindings(),
      aiFeaturesDisabled: !this.contextKeyService.contextMatchesRules(ChatContextKeys.enabled),
      maxHistoryEntries: this.configurationService.getValue(BrowserMaxHistoryEntriesSettingId),
      proxyInfo: this._remoteProxyInfo,
      trustedFileRoots: this._getTrustedFileRoots(),
      trustAllFiles: !this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()
    });
  }
  _getKeybindings() {
    const keybindings = /* @__PURE__ */ Object.create(null);
    for (const commandId of browserViewContextMenuCommands) {
      const binding = this.keybindingService.lookupKeybinding(commandId);
      const accelerator = binding?.getElectronAccelerator();
      if (accelerator) {
        keybindings[commandId] = accelerator;
      }
    }
    return keybindings;
  }
  _getTheme() {
    const theme = this.themeService.getColorTheme();
    return {
      focusBorder: theme.getColor(focusBorder)?.toString(),
      buttonBackground: theme.getColor(buttonBackground)?.toString(),
      buttonForeground: theme.getColor(buttonForeground)?.toString(),
      widgetBackground: theme.getColor(editorWidgetBackground)?.toString(),
      widgetForeground: theme.getColor(editorWidgetForeground)?.toString(),
      widgetBorder: theme.getColor(editorWidgetBorder)?.toString(),
      widgetShadow: theme.getColor(widgetShadow)?.toString(),
      contrastBorder: theme.getColor(contrastBorder)?.toString(),
      descriptionForeground: theme.getColor(descriptionForeground)?.toString(),
      inputPlaceholderForeground: theme.getColor(inputPlaceholderForeground)?.toString(),
      toolbarHoverBackground: theme.getColor(toolbarHoverBackground)?.toString(),
      font: DEFAULT_FONT_FAMILY,
      reducedMotion: this.accessibilityService.isMotionReduced()
    };
  }
  _getTrustedFileRoots() {
    const roots = new Set(getCopilotRootPaths(this.environmentService.userHome.fsPath, process.env));
    if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      for (const folder of this.workspaceContextService.getWorkspace().folders) {
        if (folder.uri.scheme === Schemas.file) {
          roots.add(folder.uri.fsPath);
        }
      }
    }
    for (const uri of this.workspaceTrustManagementService.getTrustedUris()) {
      if (uri.scheme === Schemas.file) {
        roots.add(uri.fsPath);
      }
    }
    return [...roots];
  }
};
BrowserViewWorkbenchService = __decorateClass([
  __decorateParam(0, IMainProcessService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IEditorGroupsService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IWorkspaceTrustManagementService),
  __decorateParam(8, IWorkspaceTrustEnablementService),
  __decorateParam(9, ILogService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, INativeWorkbenchEnvironmentService),
  __decorateParam(12, IThemeService),
  __decorateParam(13, IChatWidgetService),
  __decorateParam(14, IAccessibilityService)
], BrowserViewWorkbenchService);
export {
  BrowserMaxHistoryEntriesSettingId,
  BrowserNewTabPlacementSettingId,
  BrowserRemoteProxyEnabledSettingId,
  BrowserViewWorkbenchService
};
