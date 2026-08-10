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
import "./media/filesView.css";
import * as dom from "../../../../base/browser/dom.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ViewPane } from "../../../../workbench/browser/parts/views/viewPane.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService } from "../../../../workbench/common/views.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { agentsPanelBackground } from "../../../common/theme.js";
import { ExplorerView } from "../../../../workbench/contrib/files/browser/views/explorerView.js";
import { localize } from "../../../../nls.js";
import { SyncChangesActionViewItem } from "./syncChangesActionViewItem.js";
const $ = dom.$;
const SESSIONS_FILES_VIEW_ID = "sessions.files.explorer";
const SESSIONS_FILES_EMPTY_VIEW_ID = "sessions.files.explorer.empty";
class SessionsExplorerView extends ExplorerView {
  get primaryActionGroups() {
    return ["1_files"];
  }
  getLocationBasedColors() {
    const colors = super.getLocationBasedColors();
    return {
      ...colors,
      background: agentsPanelBackground,
      listOverrideStyles: {
        ...colors.listOverrideStyles,
        listBackground: agentsPanelBackground
      }
    };
  }
  createActionViewItem(action, options) {
    if (action.id === "sessions.files.action.syncChanges") {
      return this.instantiationService.createInstance(SyncChangesActionViewItem, action, options);
    }
    return super.createActionViewItem(action, options);
  }
}
let SessionsExplorerEmptyView = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
  }
  renderBody(container) {
    super.renderBody(container);
    const bodyContainer = dom.append(container, $(".files-empty-view-body"));
    const welcomeContainer = dom.append(bodyContainer, $(".files-empty-welcome"));
    const welcomeMessage = dom.append(welcomeContainer, $(".files-empty-welcome-message"));
    welcomeMessage.textContent = localize("filesView.noFiles", "Folders and files will appear here.");
  }
};
SessionsExplorerEmptyView = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService)
], SessionsExplorerEmptyView);
export {
  SESSIONS_FILES_EMPTY_VIEW_ID,
  SESSIONS_FILES_VIEW_ID,
  SessionsExplorerEmptyView,
  SessionsExplorerView
};
