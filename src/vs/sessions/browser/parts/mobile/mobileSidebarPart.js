import { AbstractPaneCompositePart } from "../../../../workbench/browser/parts/paneCompositePart.js";
import { SidebarPart } from "../sidebarPart.js";
import { isPhoneLayout } from "./mobileLayout.js";
class MobileSidebarPart extends SidebarPart {
  updateStyles() {
    super.updateStyles();
    if (!isPhoneLayout(this.layoutService)) {
      return;
    }
    AbstractPaneCompositePart.prototype.updateStyles.call(this);
    const container = this.getContainer();
    if (container) {
      container.style.backgroundColor = "";
      container.style.color = "";
      container.style.outlineColor = "";
    }
  }
}
export {
  MobileSidebarPart
};
