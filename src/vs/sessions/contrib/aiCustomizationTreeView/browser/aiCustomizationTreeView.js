import { localize2 } from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
const AI_CUSTOMIZATION_VIEWLET_ID = "workbench.view.aiCustomization";
const AI_CUSTOMIZATION_VIEW_ID = "aiCustomization.view";
const AI_CUSTOMIZATION_STORAGE_ID = "workbench.aiCustomization.views.state";
const AI_CUSTOMIZATION_CATEGORY = localize2("aiCustomization", "Chat Customization");
const AICustomizationItemMenuId = new MenuId("aiCustomization.item");
const AICustomizationNewMenuId = new MenuId("aiCustomization.new");
const FOCUS_AI_CUSTOMIZATION_VIEW_ID = "aiCustomization.focusView";
export {
  AICustomizationItemMenuId,
  AICustomizationNewMenuId,
  AI_CUSTOMIZATION_CATEGORY,
  AI_CUSTOMIZATION_STORAGE_ID,
  AI_CUSTOMIZATION_VIEWLET_ID,
  AI_CUSTOMIZATION_VIEW_ID,
  FOCUS_AI_CUSTOMIZATION_VIEW_ID
};
