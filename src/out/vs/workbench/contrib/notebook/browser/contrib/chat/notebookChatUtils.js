import { normalizeDriveLetter } from "../../../../../../base/common/labels.js";
import { basenameOrAuthority } from "../../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { CellUri } from "../../../common/notebookCommon.js";
const NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST = [
  "text/plain",
  "text/html",
  "application/vnd.code.notebook.error",
  "application/vnd.code.notebook.stdout",
  "application/x.notebook.stdout",
  "application/x.notebook.stream",
  "application/vnd.code.notebook.stderr",
  "application/x.notebook.stderr",
  "image/png",
  "image/jpeg",
  "image/svg"
];
function createNotebookOutputVariableEntry(outputViewModel, mimeType, notebookEditor) {
  const cellFromViewModelHandle = outputViewModel.cellViewModel.handle;
  const notebookModel = notebookEditor.textModel;
  const cell = notebookEditor.getCellByHandle(cellFromViewModelHandle);
  if (!cell || cell.outputsViewModels.length === 0 || !notebookModel) {
    return;
  }
  const notebookUri = notebookModel.uri;
  const cellUri = cell.uri;
  const cellIndex = notebookModel.cells.indexOf(cell.model);
  const outputId = outputViewModel?.model.outputId;
  let outputIndex = 0;
  if (outputId !== void 0) {
    outputIndex = cell.outputsViewModels.findIndex((output) => {
      return output.model.outputId === outputId;
    });
  }
  const outputCellUri = CellUri.generateCellOutputUriWithIndex(notebookUri, cellUri, outputIndex);
  const fileName = normalizeDriveLetter(basenameOrAuthority(notebookUri));
  const l = {
    value: outputCellUri,
    id: outputCellUri.toString(),
    name: localize("notebookOutputCellLabel", "{0} \u2022 Cell {1} \u2022 Output {2}", fileName, `${cellIndex + 1}`, `${outputIndex + 1}`),
    icon: mimeType === "application/vnd.code.notebook.error" ? ThemeIcon.fromId("error") : void 0,
    kind: "notebookOutput",
    outputIndex,
    mimeType
  };
  return l;
}
export {
  NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST,
  createNotebookOutputVariableEntry
};
