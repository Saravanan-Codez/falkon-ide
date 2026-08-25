import { editorBackground } from "../../../platform/theme/common/colorRegistry.js";
import { AbstractPaneCompositePart } from "../../../workbench/browser/parts/paneCompositePart.js";
import { Parts } from "../../../workbench/services/layout/browser/layoutService.js";
import { AuxiliaryBarPart } from "./auxiliaryBarPart.js";
class SinglePaneAuxiliaryBarPart extends AuxiliaryBarPart {
  create(parent) {
    this.options = { ...this.options, hasTitle: false };
    super.create(parent);
  }
  shouldShowCompositeBar() {
    return false;
  }
  getPartBackgroundColor() {
    return this.getColor(editorBackground) || "";
  }
  layout(width, height, top, left) {
    if (!this.layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
      return;
    }
    AbstractPaneCompositePart.prototype.layout.call(this, width, height, top, left);
  }
}
export {
  SinglePaneAuxiliaryBarPart
};
