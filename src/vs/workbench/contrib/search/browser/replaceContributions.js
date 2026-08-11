import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IReplaceService } from "./replace.js";
import { ReplaceService, ReplacePreviewContentProvider } from "./replaceService.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
function registerContributions() {
  registerSingleton(IReplaceService, ReplaceService, InstantiationType.Delayed);
  registerWorkbenchContribution2(
    ReplacePreviewContentProvider.ID,
    ReplacePreviewContentProvider,
    WorkbenchPhase.BlockStartup
    /* registration only */
  );
}
export {
  registerContributions
};
