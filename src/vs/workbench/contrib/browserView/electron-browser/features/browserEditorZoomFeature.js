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
import { $ } from "../../../../../base/browser/dom.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { Action2, registerAction2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { KeyMod, KeyCode } from "../../../../../base/common/keyCodes.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { browserZoomFactors, browserZoomLabel, browserZoomAccessibilityLabel } from "../../../../../platform/browserView/common/browserView.js";
import { BrowserZoomService, IBrowserZoomService, MATCH_WINDOW_ZOOM_LABEL } from "../../../browserView/common/browserZoomService.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { BrowserEditor, BrowserEditorContribution, BrowserWidgetLocation, BROWSER_EDITOR_ACTIVE, BrowserActionCategory, BrowserActionGroup, CONTEXT_BROWSER_FOCUSED, CONTEXT_BROWSER_HAS_ERROR, CONTEXT_BROWSER_HAS_URL } from "../browserEditor.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { getZoomLevel, onDidChangeZoomLevel } from "../../../../../base/browser/browser.js";
import { zoomLevelToZoomFactor } from "../../../../../platform/window/common/window.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { workbenchConfigurationNodeBase } from "../../../../common/configuration.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
const CONTEXT_BROWSER_CAN_ZOOM_IN = new RawContextKey("browserCanZoomIn", true, localize("browser.canZoomIn", "Whether the browser can zoom in further"));
const CONTEXT_BROWSER_CAN_ZOOM_OUT = new RawContextKey("browserCanZoomOut", true, localize("browser.canZoomOut", "Whether the browser can zoom out further"));
class BrowserZoomPill extends Disposable {
  constructor() {
    super();
    this._timeout = this._register(new MutableDisposable());
    this.element = $(".browser-zoom-pill");
    this.element.setAttribute("aria-hidden", "true");
    this._icon = $("span");
    this._label = $("span");
    this.element.appendChild(this._icon);
    this.element.appendChild(this._label);
  }
  /**
   * Briefly show the zoom level, then auto-hide after 750 ms.
   */
  show(zoomLabel, isAtOrAboveDefault) {
    this._icon.className = ThemeIcon.asClassName(isAtOrAboveDefault ? Codicon.zoomIn : Codicon.zoomOut);
    this._label.textContent = zoomLabel;
    this.element.classList.add("visible");
    this._timeout.value = disposableTimeout(() => {
      this.element.classList.remove("visible");
    }, 750);
  }
}
let BrowserEditorZoomSupport = class extends BrowserEditorContribution {
  constructor(editor, contextKeyService, browserZoomService, accessibilityService) {
    super(editor);
    this.browserZoomService = browserZoomService;
    this.accessibilityService = accessibilityService;
    this._canZoomInContext = CONTEXT_BROWSER_CAN_ZOOM_IN.bindTo(contextKeyService);
    this._canZoomOutContext = CONTEXT_BROWSER_CAN_ZOOM_OUT.bindTo(contextKeyService);
    this._zoomPill = this._register(new BrowserZoomPill());
  }
  get widgets() {
    return [{ location: BrowserWidgetLocation.PostUrl, element: this._zoomPill.element, order: 0 }];
  }
  onModelAttached(model, store) {
    this._updateZoomContext(model);
    store.add(model.onDidChangeZoom(() => {
      this._updateZoomContext(model);
    }));
  }
  onModelDetached() {
    this._canZoomInContext.reset();
    this._canZoomOutContext.reset();
  }
  async zoomIn() {
    await this.editor.model?.zoomIn();
    this._showZoomPill();
  }
  async zoomOut() {
    await this.editor.model?.zoomOut();
    this._showZoomPill();
  }
  async resetZoom() {
    await this.editor.model?.resetZoom();
    this._showZoomPill();
  }
  _updateZoomContext(model) {
    this._canZoomInContext.set(model.canZoomIn);
    this._canZoomOutContext.set(model.canZoomOut);
  }
  _showZoomPill() {
    const model = this.editor.model;
    if (!model) {
      return;
    }
    const defaultIndex = this.browserZoomService.getEffectiveZoomIndex(void 0, false);
    const defaultFactor = browserZoomFactors[defaultIndex];
    const currentFactor = model.zoomFactor;
    const label = browserZoomLabel(currentFactor);
    this._zoomPill.show(label, currentFactor >= defaultFactor);
    this.accessibilityService.status(browserZoomAccessibilityLabel(currentFactor));
  }
};
BrowserEditorZoomSupport = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IBrowserZoomService),
  __decorateParam(3, IAccessibilityService)
], BrowserEditorZoomSupport);
BrowserEditor.registerContribution(BrowserEditorZoomSupport);
class ZoomInAction extends Action2 {
  static {
    this.ID = "workbench.action.browser.zoomIn";
  }
  constructor() {
    super({
      id: ZoomInAction.ID,
      title: localize2("browser.zoomInAction", "Zoom In"),
      category: BrowserActionCategory,
      icon: Codicon.zoomIn,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL, CONTEXT_BROWSER_HAS_ERROR.negate()),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Zoom,
        order: 1,
        when: CONTEXT_BROWSER_CAN_ZOOM_IN,
        isHiddenByDefault: true
      },
      keybinding: {
        when: CONTEXT_BROWSER_FOCUSED,
        weight: KeybindingWeight.WorkbenchContrib + 75,
        // Same shortcuts as 'workbench.action.zoomIn'
        primary: KeyMod.CtrlCmd | KeyCode.Equal,
        secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Equal, KeyMod.CtrlCmd | KeyCode.NumpadAdd]
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.getContribution(BrowserEditorZoomSupport)?.zoomIn();
    }
  }
}
class ZoomOutAction extends Action2 {
  static {
    this.ID = "workbench.action.browser.zoomOut";
  }
  constructor() {
    super({
      id: ZoomOutAction.ID,
      title: localize2("browser.zoomOutAction", "Zoom Out"),
      category: BrowserActionCategory,
      icon: Codicon.zoomOut,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL, CONTEXT_BROWSER_HAS_ERROR.negate()),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Zoom,
        order: 2,
        when: CONTEXT_BROWSER_CAN_ZOOM_OUT,
        isHiddenByDefault: true
      },
      keybinding: {
        when: CONTEXT_BROWSER_FOCUSED,
        weight: KeybindingWeight.WorkbenchContrib + 75,
        // Same shortcuts as 'workbench.action.zoomOut'
        primary: KeyMod.CtrlCmd | KeyCode.Minus,
        secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Minus, KeyMod.CtrlCmd | KeyCode.NumpadSubtract],
        linux: {
          primary: KeyMod.CtrlCmd | KeyCode.Minus,
          secondary: [KeyMod.CtrlCmd | KeyCode.NumpadSubtract]
        }
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.getContribution(BrowserEditorZoomSupport)?.zoomOut();
    }
  }
}
class ResetZoomAction extends Action2 {
  static {
    this.ID = "workbench.action.browser.resetZoom";
  }
  constructor() {
    super({
      id: ResetZoomAction.ID,
      title: localize2("browser.resetZoomAction", "Reset Zoom"),
      category: BrowserActionCategory,
      icon: Codicon.screenNormal,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL, CONTEXT_BROWSER_HAS_ERROR.negate()),
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Zoom,
        order: 3,
        isHiddenByDefault: true
      },
      keybinding: {
        when: CONTEXT_BROWSER_FOCUSED,
        weight: KeybindingWeight.WorkbenchContrib + 75,
        // Same shortcuts as 'workbench.action.zoomReset'
        // (note: both workbench and here use Numpad0 instead of Digit0 to avoid conflicts with keybinding to focus sidebar.)
        primary: KeyMod.CtrlCmd | KeyCode.Numpad0
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      await browserEditor.getContribution(BrowserEditorZoomSupport)?.resetZoom();
    }
  }
}
registerAction2(ZoomInAction);
registerAction2(ZoomOutAction);
registerAction2(ResetZoomAction);
let WindowZoomSynchronizer = class extends Disposable {
  static {
    this.ID = "workbench.contrib.browserView.windowZoomSynchronizer";
  }
  constructor(browserZoomService) {
    super();
    browserZoomService.notifyWindowZoomChanged(zoomLevelToZoomFactor(getZoomLevel(mainWindow)));
    this._register(onDidChangeZoomLevel(() => {
      browserZoomService.notifyWindowZoomChanged(zoomLevelToZoomFactor(getZoomLevel(mainWindow)));
    }));
  }
};
WindowZoomSynchronizer = __decorateClass([
  __decorateParam(0, IBrowserZoomService)
], WindowZoomSynchronizer);
registerWorkbenchContribution2(WindowZoomSynchronizer.ID, WindowZoomSynchronizer, WorkbenchPhase.BlockRestore);
registerSingleton(IBrowserZoomService, BrowserZoomService, InstantiationType.Delayed);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    "workbench.browser.pageZoom": {
      type: "string",
      enum: [MATCH_WINDOW_ZOOM_LABEL, ...browserZoomFactors.map((f) => `${Math.round(f * 100)}%`)],
      markdownEnumDescriptions: [
        localize(
          { comment: ["This is the description for a setting enum value."], key: "browser.defaultZoomLevel.matchWindow" },
          "Matches the application's current UI zoom level."
        ),
        ...browserZoomFactors.map(() => "")
      ],
      default: MATCH_WINDOW_ZOOM_LABEL,
      markdownDescription: localize(
        { comment: ["This is the description for a setting."], key: "browser.pageZoom" },
        "Default zoom level for all sites in the Integrated Browser."
      ),
      // Zoom can change from machine to machine, so we don't need the workspace-level nor syncing that WINDOW has.
      scope: ConfigurationScope.MACHINE
    }
  }
});
export {
  BrowserEditorZoomSupport
};
