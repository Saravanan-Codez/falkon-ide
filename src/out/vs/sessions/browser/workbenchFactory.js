import { getClientArea } from "../../base/browser/dom.js";
import { mainWindow } from "../../base/browser/window.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { SyncDescriptor } from "../../platform/instantiation/common/descriptors.js";
import { DOCK_DETAIL_PANEL_SETTING } from "../common/sessionConfig.js";
import { SinglePaneWorkbench } from "./singlePaneWorkbench.js";
import { Workbench } from "./workbench.js";
function createSessionsWorkbench(parent, options, serviceCollection, logService) {
  const configurationService = serviceCollection.get(IConfigurationService);
  const isPhoneLayout = getClientArea(mainWindow.document.body).width < 640;
  const singlePane = !(configurationService instanceof SyncDescriptor) && !isPhoneLayout && configurationService.getValue(DOCK_DETAIL_PANEL_SETTING) === true;
  return singlePane ? new SinglePaneWorkbench(parent, options, serviceCollection, logService) : new Workbench(parent, options, serviceCollection, logService);
}
export {
  createSessionsWorkbench
};
