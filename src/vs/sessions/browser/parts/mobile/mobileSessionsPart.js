import { Parts } from "../../../../workbench/services/layout/browser/layoutService.js";
import { Part } from "../../../../workbench/browser/part.js";
import { SessionsPart } from "../sessionsPart.js";
import { clearAgentsPartCardStyles } from "../agentsPartCard.js";
import { isPhoneLayout } from "./mobileLayout.js";
class MobileSessionsPart extends SessionsPart {
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
    if (!this.layoutService.isVisible(Parts.SESSIONS_PART)) {
      return;
    }
    this._lastLayout = { width, height, top, left };
    const { contentSize } = this.layoutContents(width, height);
    this._gridWidget?.layout(contentSize.width, contentSize.height, top, left);
    Part.prototype.layout.call(this, width, height, top, left);
  }
}
export {
  MobileSessionsPart
};
