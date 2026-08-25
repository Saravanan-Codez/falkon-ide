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
import { localize, localize2 } from "../../../../../nls.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { BrowserEditor, BrowserEditorContribution, BrowserActionCategory, BrowserActionGroup } from "../browserEditor.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../../common/configuration.js";
import { IBrowserViewWorkbenchService } from "../../common/browserView.js";
import { BrowserViewCommandId, BrowserViewStorageScope } from "../../../../../platform/browserView/common/browserView.js";
import { IContextKeyService, ContextKeyExpr, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { Action2, registerAction2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { Codicon } from "../../../../../base/common/codicons.js";
const CONTEXT_BROWSER_STORAGE_SCOPE = new RawContextKey("browserStorageScope", "", localize("browser.storageScope", "The storage scope of the current browser view"));
let BrowserEditorStorageScopeContribution = class extends BrowserEditorContribution {
  constructor(editor, contextKeyService) {
    super(editor);
    this._storageScopeContext = CONTEXT_BROWSER_STORAGE_SCOPE.bindTo(contextKeyService);
  }
  onModelAttached(model, _store) {
    this._storageScopeContext.set(model.storageScope);
  }
  onModelDetached() {
    this._storageScopeContext.reset();
  }
};
BrowserEditorStorageScopeContribution = __decorateClass([
  __decorateParam(1, IContextKeyService)
], BrowserEditorStorageScopeContribution);
BrowserEditor.registerContribution(BrowserEditorStorageScopeContribution);
class ClearGlobalBrowserStorageAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ClearGlobalStorage;
  }
  constructor() {
    super({
      id: ClearGlobalBrowserStorageAction.ID,
      title: localize2("browser.clearGlobalStorageAction", "Clear Storage (Global)"),
      category: BrowserActionCategory,
      icon: Codicon.clearAll,
      f1: true,
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Data,
        order: 20,
        when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Global),
        isHiddenByDefault: true
      }
    });
  }
  async run(accessor) {
    const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
    await browserViewWorkbenchService.clearGlobalStorage();
  }
}
class ClearWorkspaceBrowserStorageAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ClearWorkspaceStorage;
  }
  constructor() {
    super({
      id: ClearWorkspaceBrowserStorageAction.ID,
      title: localize2("browser.clearWorkspaceStorageAction", "Clear Storage (Workspace)"),
      category: BrowserActionCategory,
      icon: Codicon.clearAll,
      f1: true,
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Data,
        order: 20,
        when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Workspace),
        isHiddenByDefault: true
      }
    });
  }
  async run(accessor) {
    const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
    await browserViewWorkbenchService.clearWorkspaceStorage();
  }
}
class ClearEphemeralBrowserStorageAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ClearEphemeralStorage;
  }
  constructor() {
    super({
      id: ClearEphemeralBrowserStorageAction.ID,
      title: localize2("browser.clearEphemeralStorageAction", "Clear Storage (Ephemeral)"),
      category: BrowserActionCategory,
      icon: Codicon.clearAll,
      f1: true,
      precondition: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Ephemeral),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Data,
        order: 20,
        when: ContextKeyExpr.equals(CONTEXT_BROWSER_STORAGE_SCOPE.key, BrowserViewStorageScope.Ephemeral),
        isHiddenByDefault: true
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.model?.clearStorage();
    }
  }
}
registerAction2(ClearGlobalBrowserStorageAction);
registerAction2(ClearWorkspaceBrowserStorageAction);
registerAction2(ClearEphemeralBrowserStorageAction);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    "workbench.browser.dataStorage": {
      type: "string",
      enum: [
        "default",
        BrowserViewStorageScope.Global,
        BrowserViewStorageScope.Workspace,
        BrowserViewStorageScope.Ephemeral
      ],
      markdownEnumDescriptions: [
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.dataStorage.default" }, "`global` for local workspaces, `workspace` for remote workspaces."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.dataStorage.global" }, "All browser views share a single persistent session across all workspaces. Incompatible with remote sessions."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.dataStorage.workspace" }, "Browser views within the same workspace share a persistent session. If no workspace is opened, `ephemeral` storage is used."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.dataStorage.ephemeral" }, "Each browser view has its own session that is cleaned up when closed.")
      ],
      restricted: true,
      default: "default",
      markdownDescription: localize(
        { comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "browser.dataStorage" },
        "Controls how browser data (cookies, cache, storage) is shared between browser views.\n\n**Note**: In untrusted workspaces, this setting is ignored and `ephemeral` storage is always used."
      ),
      scope: ConfigurationScope.WINDOW,
      order: 100
    }
  }
});
export {
  CONTEXT_BROWSER_STORAGE_SCOPE
};
