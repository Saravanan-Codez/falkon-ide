import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { AbstractPaneCompositePart } from "../../../../workbench/browser/parts/paneCompositePart.js";
import { PanelPart } from "../panelPart.js";
import { isPhoneLayout } from "./mobileLayout.js";
class MobilePanelPart extends PanelPart {
  updateStyles() {
    super.updateStyles();
    if (!isPhoneLayout(this.layoutService)) {
      return;
    }
    const container = this.getContainer();
    if (container) {
      container.style.backgroundColor = "";
      container.style.removeProperty("--part-background");
      container.style.removeProperty("--part-border-color");
    }
  }
  layout(width, height, top, left) {
    if (!isPhoneLayout(this.layoutService)) {
      super.layout(width, height, top, left);
      return;
    }
    if (!this.layoutService.isVisible(Parts.PANEL_PART)) {
      return;
    }
    AbstractPaneCompositePart.prototype.layout.call(this, width, height, top, left);
  }
}
export {
  MobilePanelPart
};
