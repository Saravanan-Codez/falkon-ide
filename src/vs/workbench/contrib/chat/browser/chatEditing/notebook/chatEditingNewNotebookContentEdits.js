var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { VSBuffer } from "../../../../../../base/common/buffer.js";
import { CellEditType } from "../../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../../notebook/common/notebookService.js";
let ChatEditingNewNotebookContentEdits = class {
  constructor(notebook, _notebookService) {
    this.notebook = notebook;
    this._notebookService = _notebookService;
    this.textEdits = [];
  }
  acceptTextEdits(edits) {
    if (edits.length) {
      this.textEdits.push(...edits);
    }
  }
  async generateEdits() {
    if (this.notebook.cells.length) {
      console.error(`Notebook edits not generated as notebook already has cells`);
      return [];
    }
    const content = this.generateContent();
    if (!content) {
      return [];
    }
    const notebookEdits = [];
    try {
      const { serializer } = await this._notebookService.withNotebookDataProvider(this.notebook.viewType);
      const data = await serializer.dataToNotebook(VSBuffer.fromString(content));
      for (let i = 0; i < data.cells.length; i++) {
        notebookEdits.push({
          editType: CellEditType.Replace,
          index: i,
          count: 0,
          cells: [data.cells[i]]
        });
      }
    } catch (ex) {
      console.error(`Failed to generate notebook edits from text edits ${content}`, ex);
      return [];
    }
    return notebookEdits;
  }
  generateContent() {
    try {
      return applyTextEdits(this.textEdits);
    } catch (ex) {
      console.error("Failed to generate content from text edits", ex);
      return "";
    }
  }
};
ChatEditingNewNotebookContentEdits = __decorateClass([
  __decorateParam(1, INotebookService)
], ChatEditingNewNotebookContentEdits);
function applyTextEdits(edits) {
  let output = "";
  for (const edit of edits) {
    output = output.slice(0, edit.range.startColumn) + edit.text + output.slice(edit.range.endColumn);
  }
  return output;
}
export {
  ChatEditingNewNotebookContentEdits
};
