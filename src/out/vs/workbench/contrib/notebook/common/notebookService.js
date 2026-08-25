import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const INotebookService = createDecorator("notebookService");
class SimpleNotebookProviderInfo {
  constructor(viewType, serializer, extensionData) {
    this.viewType = viewType;
    this.serializer = serializer;
    this.extensionData = extensionData;
  }
}
export {
  INotebookService,
  SimpleNotebookProviderInfo
};
