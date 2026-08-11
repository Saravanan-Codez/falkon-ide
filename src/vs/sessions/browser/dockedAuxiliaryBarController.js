import { Disposable } from "../../base/common/lifecycle.js";
import { Sash, SashState, Orientation as SashOrientation } from "../../base/browser/ui/sash/sash.js";
import { SESSIONS_LIST_MINIMUM_WIDTH } from "./parts/sidebarPart.js";
class DockedAuxiliaryBarController extends Disposable {
  constructor(editorPartContainer, auxiliaryBarPart, host) {
    super();
    this.editorPartContainer = editorPartContainer;
    this.auxiliaryBarPart = auxiliaryBarPart;
    this.host = host;
    this._docked = false;
    this._sashStartWidth = 0;
    this._sashCollapsed = false;
  }
  static {
    this.TOP = 34;
  }
  static {
    /** Thickness (px) of the header/tab-bar bottom divider the aux bar starts below. */
    this.DIVIDER = 1;
  }
  static {
    this.MIN_WIDTH = 220;
  }
  static {
    this.EDITOR_MIN_WIDTH = 300;
  }
  static {
    this.DEFAULT_WIDTH = 300;
  }
  static {
    this.COLLAPSE_WIDTH = 4;
  }
  static {
    this.NO_EDITOR_MIN_WIDTH = SESSIONS_LIST_MINIMUM_WIDTH;
  }
  /**
   * Position the auxiliary bar inside the editor part's right region so the editor
   * tab bar spans the full width across the editor content and the detail panel.
   */
  layout() {
    const auxiliaryBarContainer = this.auxiliaryBarPart.getContainer();
    if (!auxiliaryBarContainer) {
      return;
    }
    if (!this._docked) {
      this.editorPartContainer.appendChild(auxiliaryBarContainer);
      auxiliaryBarContainer.classList.add("docked-auxiliarybar");
      this._docked = true;
    }
    if (!this.host.isEditorAreaVisible() || !this.host.isAuxiliaryBarVisible()) {
      auxiliaryBarContainer.style.display = "none";
      this.host.setEditorContentRightInset(0);
      if (this._sash) {
        this._sash.state = SashState.Disabled;
      }
      return;
    }
    const editorRect = this.editorPartContainer.getBoundingClientRect();
    const editorContentHidden = !this.host.isEditorVisible();
    const auxWidth = editorContentHidden ? editorRect.width : this._auxiliaryBarWidth(this.host.getWidth(), editorRect.width);
    const top = DockedAuxiliaryBarController.TOP + DockedAuxiliaryBarController.DIVIDER + this.host.getHeaderHeight();
    const height = Math.max(0, editorRect.height - top);
    auxiliaryBarContainer.style.display = "";
    auxiliaryBarContainer.style.position = "absolute";
    auxiliaryBarContainer.style.right = "0";
    auxiliaryBarContainer.style.top = `${top}px`;
    auxiliaryBarContainer.style.width = `${auxWidth}px`;
    auxiliaryBarContainer.style.height = `${height}px`;
    this.host.setEditorContentRightInset(auxWidth);
    this.auxiliaryBarPart.layout(auxWidth, height, top, editorRect.width - auxWidth);
    this._ensureSash();
    this._sash.state = editorContentHidden ? SashState.Disabled : SashState.Enabled;
    this._sash.layout();
  }
  _auxiliaryBarWidth(hostWidth, editorWidth) {
    const maxWidth = editorWidth - DockedAuxiliaryBarController.EDITOR_MIN_WIDTH;
    if (maxWidth < DockedAuxiliaryBarController.MIN_WIDTH) {
      return Math.max(0, maxWidth);
    }
    return Math.max(DockedAuxiliaryBarController.MIN_WIDTH, Math.min(hostWidth, maxWidth));
  }
  _ensureSash() {
    if (this._sash) {
      return;
    }
    const editorPartContainer = this.editorPartContainer;
    const layoutProvider = {
      getVerticalSashLeft: () => {
        const width = editorPartContainer.clientWidth;
        const auxWidth = this.host.isEditorVisible() ? this._auxiliaryBarWidth(this.host.getWidth(), width) : width;
        return Math.max(0, width - auxWidth);
      },
      getVerticalSashTop: () => DockedAuxiliaryBarController.TOP + DockedAuxiliaryBarController.DIVIDER + this.host.getHeaderHeight(),
      getVerticalSashHeight: () => Math.max(0, editorPartContainer.clientHeight - DockedAuxiliaryBarController.TOP - DockedAuxiliaryBarController.DIVIDER - this.host.getHeaderHeight())
    };
    const sash = this._register(new Sash(editorPartContainer, layoutProvider, { orientation: SashOrientation.VERTICAL }));
    this._sash = sash;
    this._register(sash.onDidStart(() => {
      this._sashStartWidth = this.host.getWidth();
      this._sashCollapsed = false;
    }));
    this._register(sash.onDidChange((e) => {
      if (this._sashCollapsed) {
        return;
      }
      const delta = e.startX - e.currentX;
      const width = editorPartContainer.clientWidth;
      const requestedWidth = this._sashStartWidth + delta;
      if (requestedWidth < DockedAuxiliaryBarController.COLLAPSE_WIDTH) {
        this._sashCollapsed = true;
        this.host.hideAuxiliaryBar();
        return;
      }
      this.host.setWidth(this._auxiliaryBarWidth(requestedWidth, width));
      this.layout();
    }));
    this._register(sash.onDidReset(() => {
      this.host.setWidth(DockedAuxiliaryBarController.DEFAULT_WIDTH);
      this.layout();
    }));
  }
}
export {
  DockedAuxiliaryBarController
};
