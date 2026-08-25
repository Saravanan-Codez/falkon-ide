import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { INotebookSearchService } from "../../common/notebookSearch.js";
import { NotebookSearchService } from "./notebookSearchService.js";
function registerContributions() {
  registerSingleton(INotebookSearchService, NotebookSearchService, InstantiationType.Delayed);
}
export {
  registerContributions
};
