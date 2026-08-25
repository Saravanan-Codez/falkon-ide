import { LayoutPriority } from "../../../base/browser/ui/splitview/splitview.js";
import { mainWindow } from "../../../base/browser/window.js";
import { MainEditorPart as MainEditorPartBase } from "../../../workbench/browser/parts/editor/editorPart.js";
import { Parts } from "../../../workbench/services/layout/browser/layoutService.js";
import { EDITOR_PART_MINIMUM_WIDTH } from "./editorPartSizing.js";
class MainEditorPart extends MainEditorPartBase {
  constructor() {
    super(...arguments);
    // The editor part keeps a stable, user-set width: the Sessions Part is the
    // flexible view (LayoutPriority.High) that absorbs visibility/resize deltas.
    // Making the editor the flex view caused its width to drift to the minimum
    // when toggling the auxiliary bar across session switches.
    this.priority = LayoutPriority.Normal;
  }
  static {
    this.MARGIN_TOP = 0;
  }
  static {
    this.MARGIN_BOTTOM = 0;
  }
  static {
    this.MARGIN_LEFT = 0;
  }
  static {
    this.MARGIN_RIGHT = 0;
  }
  get minimumWidth() {
    return Math.max(EDITOR_PART_MINIMUM_WIDTH, super.minimumWidth);
  }
  layout(width, height, top, left) {
    const agentLayoutService = this.layoutService;
    const keepForDockedTabBar = agentLayoutService.isSinglePaneLayoutEnabled && this.layoutService.isVisible(Parts.AUXILIARYBAR_PART);
    if (!this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow) && !keepForDockedTabBar) {
      return;
    }
    const adjustedWidth = width - MainEditorPart.MARGIN_RIGHT - MainEditorPart.MARGIN_LEFT - 2;
    const adjustedHeight = height - MainEditorPart.MARGIN_TOP - MainEditorPart.MARGIN_BOTTOM - 2;
    super.layout(adjustedWidth, adjustedHeight, top, left);
    if (agentLayoutService.isSinglePaneLayoutEnabled && !this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
      agentLayoutService.handleDockedEditorPartLayout(width);
    }
  }
}
export {
  MainEditorPart
};
