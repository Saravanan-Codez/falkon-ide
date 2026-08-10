import "./media/part.css";
import "./media/floatingPanels.css";
import { Component } from "../common/component.js";
import { Dimension, size, getActiveDocument, prepend } from "../../base/browser/dom.js";
import { Emitter } from "../../base/common/event.js";
import { assertReturnsDefined } from "../../base/common/types.js";
import { toDisposable } from "../../base/common/lifecycle.js";
class Part extends Component {
  constructor(id, options, themeService, storageService, layoutService) {
    super(id, themeService, storageService);
    this.options = options;
    this.layoutService = layoutService;
    this._onDidVisibilityChange = this._register(new Emitter());
    this.onDidVisibilityChange = this._onDidVisibilityChange.event;
    //#region ISerializableView
    this._onDidChange = this._register(new Emitter());
    this._register(layoutService.registerPart(this));
  }
  get dimension() {
    return this._dimension;
  }
  get contentPosition() {
    return this._contentPosition;
  }
  onThemeChange(theme) {
    if (this.parent) {
      super.onThemeChange(theme);
    }
  }
  /**
   * Note: Clients should not call this method, the workbench calls this
   * method. Calling it otherwise may result in unexpected behavior.
   *
   * Called to create title and content area of the part.
   */
  create(parent, options) {
    this.parent = parent;
    this.titleArea = this.createTitleArea(parent, options);
    this.contentArea = this.createContentArea(parent, options);
    this.partLayout = new PartLayout(this.options, this.contentArea);
    this.updateStyles();
  }
  /**
   * Returns the overall part container.
   */
  getContainer() {
    return this.parent;
  }
  /**
   * Subclasses override to provide a title area implementation.
   */
  createTitleArea(parent, options) {
    return void 0;
  }
  /**
   * Subclasses override to provide a content area implementation.
   */
  createContentArea(parent, options) {
    return void 0;
  }
  setHeaderArea(headerContainer) {
    if (this.headerArea) {
      throw new Error("Header already exists");
    }
    if (!this.parent || !this.titleArea) {
      return;
    }
    prepend(this.parent, headerContainer);
    headerContainer.classList.add("header-or-footer");
    headerContainer.classList.add("header");
    this.headerArea = headerContainer;
    this.partLayout?.setHeaderVisibility(true);
    this.relayout();
  }
  setFooterArea(footerContainer) {
    if (this.footerArea) {
      throw new Error("Footer already exists");
    }
    if (!this.parent || !this.titleArea) {
      return;
    }
    this.parent.appendChild(footerContainer);
    footerContainer.classList.add("header-or-footer");
    footerContainer.classList.add("footer");
    this.footerArea = footerContainer;
    this.partLayout?.setFooterVisibility(true);
    this.relayout();
  }
  removeHeaderArea() {
    if (this.headerArea) {
      this.headerArea.remove();
      this.headerArea = void 0;
      this.partLayout?.setHeaderVisibility(false);
      this.relayout();
    }
  }
  removeFooterArea() {
    if (this.footerArea) {
      this.footerArea.remove();
      this.footerArea = void 0;
      this.partLayout?.setFooterVisibility(false);
      this.relayout();
    }
  }
  relayout() {
    const dimension = this.getRelayoutDimension();
    if (dimension && this.contentPosition) {
      this.layout(dimension.width, dimension.height, this.contentPosition.top, this.contentPosition.left);
    }
  }
  /**
   * The dimension to use when the part re-lays out itself in response to internal
   * changes (e.g. title, header or footer visibility). Subclasses that reduce the
   * dimension passed to {@link layout} (for example to reserve space for a floating
   * card margin) must override this to return the original, unreduced dimension so
   * the reduction is not applied repeatedly on every relayout.
   */
  getRelayoutDimension() {
    return this._dimension;
  }
  /**
   * Layout title and content area in the given dimension.
   */
  layoutContents(width, height) {
    const partLayout = assertReturnsDefined(this.partLayout);
    return partLayout.layout(width, height);
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  layout(width, height, top, left) {
    this._dimension = new Dimension(width, height);
    this._contentPosition = { top, left };
  }
  setVisible(visible) {
    this._onDidVisibilityChange.fire(visible);
  }
  //#endregion
}
class PartLayout {
  constructor(options, contentArea) {
    this.options = options;
    this.contentArea = contentArea;
    this.headerVisible = false;
    this.footerVisible = false;
  }
  static {
    this.HEADER_HEIGHT = 35;
  }
  static {
    this.TITLE_HEIGHT = 35;
  }
  static {
    this.FOOTER_HEIGHT = 35;
  }
  static {
    // KEEP IN SYNC WITH: styleOverrides/browser/media/padding.css
    this.AREA_HEIGHT_STYLE_OVERRIDE = 32;
  }
  layout(width, height) {
    const isStyleOverride = !!this.contentArea?.closest(".style-override");
    let titleSize;
    if (this.options.hasTitle) {
      const titleHeight = isStyleOverride ? PartLayout.AREA_HEIGHT_STYLE_OVERRIDE : PartLayout.TITLE_HEIGHT;
      titleSize = new Dimension(width, Math.min(height, titleHeight));
    } else {
      titleSize = Dimension.None;
    }
    let headerSize;
    if (this.headerVisible) {
      const headerHeight = isStyleOverride ? PartLayout.AREA_HEIGHT_STYLE_OVERRIDE : PartLayout.HEADER_HEIGHT;
      headerSize = new Dimension(width, Math.min(height, headerHeight));
    } else {
      headerSize = Dimension.None;
    }
    let footerSize;
    if (this.footerVisible) {
      const footerHeight = isStyleOverride ? PartLayout.AREA_HEIGHT_STYLE_OVERRIDE : PartLayout.FOOTER_HEIGHT;
      footerSize = new Dimension(width, Math.min(height, footerHeight));
    } else {
      footerSize = Dimension.None;
    }
    let contentWidth = width;
    if (this.options && typeof this.options.borderWidth === "function") {
      contentWidth -= this.options.borderWidth();
    }
    const contentSize = new Dimension(contentWidth, height - titleSize.height - headerSize.height - footerSize.height);
    if (this.contentArea) {
      size(this.contentArea, contentSize.width, contentSize.height);
    }
    return { headerSize, titleSize, contentSize, footerSize };
  }
  setFooterVisibility(visible) {
    this.footerVisible = visible;
  }
  setHeaderVisibility(visible) {
    this.headerVisible = visible;
  }
}
class MultiWindowParts extends Component {
  constructor() {
    super(...arguments);
    this._parts = /* @__PURE__ */ new Set();
  }
  get parts() {
    return Array.from(this._parts);
  }
  registerPart(part) {
    this._parts.add(part);
    return toDisposable(() => this.unregisterPart(part));
  }
  unregisterPart(part) {
    this._parts.delete(part);
  }
  getPart(container) {
    return this.getPartByDocument(container.ownerDocument);
  }
  getPartByDocument(document) {
    if (this._parts.size > 1) {
      for (const part of this._parts) {
        if (part.element?.ownerDocument === document) {
          return part;
        }
      }
    }
    return this.mainPart;
  }
  get activePart() {
    return this.getPartByDocument(getActiveDocument());
  }
}
export {
  MultiWindowParts,
  Part
};
