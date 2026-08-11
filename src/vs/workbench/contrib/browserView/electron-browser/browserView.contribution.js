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
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { BrowserEditor } from "./browserEditor.js";
import { BrowserEditorInput, BrowserEditorSerializer } from "../common/browserEditorInput.js";
import { BrowserViewUri } from "../../../../platform/browserView/common/browserViewUri.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { Schemas } from "../../../../base/common/network.js";
import { IBrowserViewCDPService, IBrowserViewWorkbenchService } from "../common/browserView.js";
import { BrowserViewWorkbenchService } from "./browserViewWorkbenchService.js";
import { BrowserViewCDPService } from "./browserViewCDPService.js";
import "./features/webContentsViewRendererFeature.js";
import "./features/browserNavigationFeatures.js";
import "./features/browserWelcomeFeature.js";
import "./features/browserFavoritesFeature.js";
import "./features/browserHistoryFeature.js";
import "./features/browserPermissionsFeature.js";
import "./features/browserDataStorageFeatures.js";
import "./features/browserDevToolsFeature.js";
import "./features/browserEditorChatFeatures.js";
import "./features/browserEditorErrorFeatures.js";
import "./features/browserEditorZoomFeature.js";
import "./features/browserEditorEmulationFeatures.js";
import "./features/browserAutoReloadFeatures.js";
import "./features/browserEditorFindFeature.js";
import "./features/browserSearchFeatures.js";
import "./features/browserTabManagementFeatures.js";
import "./features/browserRemoteFeatures.js";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    BrowserEditor,
    BrowserEditorInput.EDITOR_ID,
    localize("browser.editorLabel", "Browser")
  ),
  [
    new SyncDescriptor(BrowserEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  BrowserEditorInput.ID,
  BrowserEditorSerializer
);
let BrowserEditorResolverContribution = class {
  static {
    this.ID = "workbench.contrib.browserEditorResolver";
  }
  constructor(editorResolverService, browserViewWorkbenchService) {
    editorResolverService.registerEditor(
      `${Schemas.vscodeBrowser}:/**`,
      {
        id: BrowserEditorInput.EDITOR_ID,
        label: localize("browser.editorLabel", "Browser"),
        priority: RegisteredEditorPriority.exclusive
      },
      {
        canSupportResource: (resource) => resource.scheme === Schemas.vscodeBrowser,
        singlePerResource: true
      },
      {
        createEditorInput: ({ resource, options }) => {
          const parsed = BrowserViewUri.parse(resource);
          if (!parsed) {
            throw new Error(`Invalid browser view resource: ${resource.toString()}`);
          }
          const browserInput = browserViewWorkbenchService.getOrCreateLazy(parsed.id, options?.viewState);
          void browserInput.resolve();
          return {
            editor: browserInput,
            options: {
              pinned: !!browserInput.url,
              // pin if navigated
              ...options
            }
          };
        }
      }
    );
  }
};
BrowserEditorResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IBrowserViewWorkbenchService)
], BrowserEditorResolverContribution);
registerWorkbenchContribution2(BrowserEditorResolverContribution.ID, BrowserEditorResolverContribution, WorkbenchPhase.BlockStartup);
registerSingleton(IBrowserViewWorkbenchService, BrowserViewWorkbenchService, InstantiationType.Delayed);
registerSingleton(IBrowserViewCDPService, BrowserViewCDPService, InstantiationType.Delayed);
