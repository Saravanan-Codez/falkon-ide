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
import { getZoomFactor } from "../../../base/browser/browser.js";
import { $, addDisposableListener, append, EventType, getWindow, getWindowId, hide, show } from "../../../base/browser/dom.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Event } from "../../../base/common/event.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { INativeHostService } from "../../../platform/native/common/native.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { hasNativeTitlebar, useWindowControlsOverlay } from "../../../platform/window/common/window.js";
import { IsWindowAlwaysOnTopContext } from "../../../workbench/common/contextkeys.js";
import { IHostService } from "../../../workbench/services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../workbench/services/layout/browser/layoutService.js";
import { mainWindow } from "../../../base/browser/window.js";
import { TitlebarPart, TitleService } from "../../browser/parts/titlebarPart.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { localize } from "../../../nls.js";
let NativeTitlebarPart = class extends TitlebarPart {
  constructor(id, targetWindow, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, productService, nativeHostService) {
    super(id, targetWindow, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService);
    this.productService = productService;
    this.nativeHostService = nativeHostService;
    this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId, contextKeyService);
  }
  createContentArea(parent) {
    const window = getWindow(this.element);
    const agentsTitle = localize("agentsWindowTitle", "Agents");
    if (isMacintosh) {
      const initialTitle = this.productService.nameLong;
      if (!window.document.title || window.document.title === initialTitle) {
        window.document.title = `${agentsTitle} \u200B`;
      }
    }
    window.document.title = agentsTitle;
    const result = super.createContentArea(parent);
    const targetWindow = getWindow(parent);
    const targetWindowId = getWindowId(targetWindow);
    if (!hasNativeTitlebar(this.configurationService) && // not for native title bars
    !useWindowControlsOverlay(this.configurationService) && // not when controls are natively drawn
    this.windowControlsContainer) {
      const minimizeIcon = append(this.windowControlsContainer, $("div.window-icon.window-minimize" + ThemeIcon.asCSSSelector(Codicon.chromeMinimize)));
      this._register(addDisposableListener(minimizeIcon, EventType.CLICK, () => {
        this.nativeHostService.minimizeWindow({ targetWindowId });
      }));
      this.maxRestoreControl = append(this.windowControlsContainer, $("div.window-icon.window-max-restore"));
      this._register(addDisposableListener(this.maxRestoreControl, EventType.CLICK, async () => {
        const maximized = await this.nativeHostService.isMaximized({ targetWindowId });
        if (maximized) {
          return this.nativeHostService.unmaximizeWindow({ targetWindowId });
        }
        return this.nativeHostService.maximizeWindow({ targetWindowId });
      }));
      const closeIcon = append(this.windowControlsContainer, $("div.window-icon.window-close" + ThemeIcon.asCSSSelector(Codicon.chromeClose)));
      this._register(addDisposableListener(closeIcon, EventType.CLICK, () => {
        this.nativeHostService.closeWindow({ targetWindowId });
      }));
      this.resizer = append(this.rootContainer, $("div.resizer"));
      this._register(Event.runAndSubscribe(this.layoutService.onDidChangeWindowMaximized, ({ windowId, maximized }) => {
        if (windowId === targetWindowId) {
          this.onDidChangeWindowMaximized(maximized);
        }
      }, { windowId: targetWindowId, maximized: this.layoutService.isWindowMaximized(targetWindow) }));
    }
    if (isWindows && !hasNativeTitlebar(this.configurationService)) {
      this._register(this.nativeHostService.onDidTriggerWindowSystemContextMenu(({ windowId, x, y }) => {
        if (targetWindowId !== windowId) {
          return;
        }
        const zoomFactor = getZoomFactor(getWindow(this.element));
        this.onContextMenu(new MouseEvent(EventType.MOUSE_UP, { clientX: x / zoomFactor, clientY: y / zoomFactor }));
      }));
    }
    return result;
  }
  onDidChangeWindowMaximized(maximized) {
    if (this.maxRestoreControl) {
      if (maximized) {
        this.maxRestoreControl.classList.remove(...ThemeIcon.asClassNameArray(Codicon.chromeMaximize));
        this.maxRestoreControl.classList.add(...ThemeIcon.asClassNameArray(Codicon.chromeRestore));
      } else {
        this.maxRestoreControl.classList.remove(...ThemeIcon.asClassNameArray(Codicon.chromeRestore));
        this.maxRestoreControl.classList.add(...ThemeIcon.asClassNameArray(Codicon.chromeMaximize));
      }
    }
    if (this.resizer) {
      if (maximized) {
        hide(this.resizer);
      } else {
        show(this.resizer);
      }
    }
  }
  async handleWindowsAlwaysOnTop(targetWindowId, contextKeyService) {
    const isWindowAlwaysOnTopContext = IsWindowAlwaysOnTopContext.bindTo(contextKeyService);
    this._register(this.nativeHostService.onDidChangeWindowAlwaysOnTop(({ windowId, alwaysOnTop }) => {
      if (windowId === targetWindowId) {
        isWindowAlwaysOnTopContext.set(alwaysOnTop);
      }
    }));
    isWindowAlwaysOnTopContext.set(await this.nativeHostService.isWindowAlwaysOnTop({ targetWindowId }));
  }
  updateStyles() {
    super.updateStyles();
    if (this.element) {
      if (useWindowControlsOverlay(this.configurationService)) {
        if (!this.cachedWindowControlStyles || this.cachedWindowControlStyles.bgColor !== this.element.style.backgroundColor || this.cachedWindowControlStyles.fgColor !== this.element.style.color) {
          this.cachedWindowControlStyles = {
            bgColor: this.element.style.backgroundColor,
            fgColor: this.element.style.color
          };
          this.nativeHostService.updateWindowControls({
            targetWindowId: getWindowId(getWindow(this.element)),
            backgroundColor: this.element.style.backgroundColor,
            foregroundColor: this.element.style.color
          });
        }
      }
    }
  }
  layout(width, height) {
    super.layout(width, height);
    if (useWindowControlsOverlay(this.configurationService)) {
      const newHeight = Math.round(height * getZoomFactor(getWindow(this.element)));
      if (newHeight !== this.cachedWindowControlHeight) {
        this.cachedWindowControlHeight = newHeight;
        this.nativeHostService.updateWindowControls({
          targetWindowId: getWindowId(getWindow(this.element)),
          height: newHeight
        });
      }
    }
  }
};
NativeTitlebarPart = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IProductService),
  __decorateParam(11, INativeHostService)
], NativeTitlebarPart);
let MainNativeTitlebarPart = class extends NativeTitlebarPart {
  constructor(contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, productService, nativeHostService) {
    super(Parts.TITLEBAR_PART, mainWindow, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, productService, nativeHostService);
  }
};
MainNativeTitlebarPart = __decorateClass([
  __decorateParam(0, IContextMenuService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IHostService),
  __decorateParam(8, IProductService),
  __decorateParam(9, INativeHostService)
], MainNativeTitlebarPart);
let AuxiliaryNativeTitlebarPart = class extends NativeTitlebarPart {
  constructor(container, mainTitlebar, contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, productService, nativeHostService) {
    const id = AuxiliaryNativeTitlebarPart.COUNTER++;
    super(`workbench.parts.auxiliaryTitle.${id}`, getWindow(container), contextMenuService, configurationService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, productService, nativeHostService);
    this.container = container;
    this.mainTitlebar = mainTitlebar;
  }
  static {
    this.COUNTER = 1;
  }
  get height() {
    return this.minimumHeight;
  }
  get preventZoom() {
    return getZoomFactor(getWindow(this.element)) < 1 || !this.mainTitlebar.hasZoomableElements;
  }
};
AuxiliaryNativeTitlebarPart = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkbenchLayoutService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IProductService),
  __decorateParam(11, INativeHostService)
], AuxiliaryNativeTitlebarPart);
class NativeTitleService extends TitleService {
  createMainTitlebarPart() {
    return this.instantiationService.createInstance(MainNativeTitlebarPart);
  }
  doCreateAuxiliaryTitlebarPart(container, _editorGroupsContainer, instantiationService) {
    return instantiationService.createInstance(AuxiliaryNativeTitlebarPart, container, this.mainPart);
  }
}
export {
  NativeTitleService,
  NativeTitlebarPart
};
