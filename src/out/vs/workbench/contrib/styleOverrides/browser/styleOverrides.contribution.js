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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkbenchLayoutService, LayoutSettings } from "../../../services/layout/browser/layoutService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { DEFAULT_SCROLLBAR_SIZE, setGlobalDefaultScrollbarSize } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { DEFAULT_NOTIFICATION_ROW_HEIGHT, setNotificationRowHeight } from "../../../browser/parts/notifications/notificationsViewer.js";
import { DEFAULT_PANE_HEADER_SIZE, setGlobalPaneHeaderSize } from "../../../../base/browser/ui/splitview/paneview.js";
const SCROLLBAR_OVERRIDE_SIZE = 8;
const NOTIFICATION_ROW_OVERRIDE_HEIGHT = 34;
const PANE_HEADER_OVERRIDE_SIZE = 28;
import "./media/activityBar.css";
import "./media/commandCenter.css";
import "./media/editorBorder.css";
import "./media/fontRamp.css";
import "./media/keyboardFocusOnly.css";
import "./media/notificationsDialogs.css";
import "./media/padding.css";
import "./media/paneHeaders.css";
import "./media/roundedCorners.css";
import "./media/sashHandles.css";
import "./media/shadows.css";
import "./media/statusBar.css";
import "./media/tabs.css";
import "./media/titlebar.css";
const STYLE_OVERRIDE_CLASS = "style-override";
const MODERN_UI_TABS_CLASS = "modern-ui-tabs";
const STYLE_OVERRIDE_MODULES = [
  { id: "activityBar" },
  { id: "commandCenter" },
  { id: "editorBorder" },
  { id: "fontRamp" },
  { id: "keyboardFocusOnly" },
  { id: "padding" },
  { id: "paneHeaders", layoutAffecting: true },
  { id: "roundedCorners" },
  { id: "sashHandles" },
  { id: "scrollShadows" },
  { id: "shadows" },
  { id: "statusBar" },
  { id: "tabs" },
  { id: "titlebar" },
  { id: "notificationsDialogs" }
];
let StyleOverridesContribution = class extends Disposable {
  constructor(configurationService, layoutService) {
    super();
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.hasLayoutAffectingModule = STYLE_OVERRIDE_MODULES.some((m) => m.layoutAffecting);
    /** Whether a layout-affecting module was active at the last applied selection. */
    this.layoutAffectingActive = false;
    this.layoutAffectingActive = this.hasActiveLayoutAffectingModule();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(LayoutSettings.MODERN_UI)) {
        this.update();
        const layoutAffectingActive = this.hasActiveLayoutAffectingModule();
        if (layoutAffectingActive !== this.layoutAffectingActive) {
          this.layoutAffectingActive = layoutAffectingActive;
          this.layoutService.layout();
        }
      }
    }));
    this._register(this.layoutService.onDidAddContainer(({ container }) => {
      this.applyTo(container, this.isEnabled());
    }));
    this.update();
  }
  static {
    this.ID = "workbench.contrib.styleOverrides";
  }
  isEnabled() {
    return this.configurationService.getValue(LayoutSettings.MODERN_UI) === true;
  }
  hasActiveLayoutAffectingModule() {
    return this.isEnabled() && this.hasLayoutAffectingModule;
  }
  update() {
    const enabled = this.isEnabled();
    this.applyPaneHeaderSize(enabled);
    for (const container of this.layoutService.containers) {
      this.applyTo(container, enabled);
    }
    this.applyScrollbarSize(enabled);
    this.applyNotificationRowHeight(enabled);
  }
  applyTo(container, enabled) {
    container.classList.toggle(STYLE_OVERRIDE_CLASS, enabled);
    container.classList.toggle(MODERN_UI_TABS_CLASS, enabled);
  }
  applyScrollbarSize(enabled) {
    setGlobalDefaultScrollbarSize(enabled ? SCROLLBAR_OVERRIDE_SIZE : DEFAULT_SCROLLBAR_SIZE);
  }
  applyNotificationRowHeight(enabled) {
    setNotificationRowHeight(enabled ? NOTIFICATION_ROW_OVERRIDE_HEIGHT : DEFAULT_NOTIFICATION_ROW_HEIGHT);
  }
  applyPaneHeaderSize(enabled) {
    setGlobalPaneHeaderSize(enabled ? PANE_HEADER_OVERRIDE_SIZE : DEFAULT_PANE_HEADER_SIZE);
  }
  dispose() {
    for (const container of this.layoutService.containers) {
      container.classList.remove(STYLE_OVERRIDE_CLASS);
      container.classList.remove(MODERN_UI_TABS_CLASS);
    }
    setGlobalDefaultScrollbarSize(DEFAULT_SCROLLBAR_SIZE);
    setNotificationRowHeight(DEFAULT_NOTIFICATION_ROW_HEIGHT);
    setGlobalPaneHeaderSize(DEFAULT_PANE_HEADER_SIZE);
    super.dispose();
  }
};
StyleOverridesContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkbenchLayoutService)
], StyleOverridesContribution);
registerWorkbenchContribution2(StyleOverridesContribution.ID, StyleOverridesContribution, WorkbenchPhase.BlockRestore);
export {
  StyleOverridesContribution
};
