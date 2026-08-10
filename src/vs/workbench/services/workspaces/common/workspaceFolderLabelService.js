import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IWorkspaceFolderLabelService = createDecorator("workspaceFolderLabelService");
class WorkspaceFolderLabelService {
  getWorkspaceFolderLabel(_folder, _verbose) {
    return void 0;
  }
}
registerSingleton(IWorkspaceFolderLabelService, WorkspaceFolderLabelService, InstantiationType.Delayed);
export {
  IWorkspaceFolderLabelService,
  WorkspaceFolderLabelService
};
