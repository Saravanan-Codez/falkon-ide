import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { Part } from "../../../../workbench/browser/part.js";
import { clearAgentsPartCardStyles } from "../agentsPartCard.js";
import { CustomViewGridPart } from "../customViewGridPart.js";
import { isPhoneLayout } from "./mobileLayout.js";
class MobileCustomViewGridPart extends CustomViewGridPart {
  updateStyles() {
    super.updateStyles();
    if (!isPhoneLayout(this.layoutService)) {
      return;
    }
    const container = this.getContainer();
    if (container) {
      clearAgentsPartCardStyles(container);
    }
  }
  layout(width, height, top, left) {
    if (!isPhoneLayout(this.layoutService)) {
      super.layout(width, height, top, left);
      return;
    }
    if (!this.layoutService.isVisible(Parts.CUSTOM_VIEW_GRID_PART)) {
      return;
    }
    const { contentSize } = this.layoutContents(width, height);
    this._layoutNode(contentSize.width, contentSize.height);
    Part.prototype.layout.call(this, width, height, top, left);
  }
}
export {
  MobileCustomViewGridPart
};
