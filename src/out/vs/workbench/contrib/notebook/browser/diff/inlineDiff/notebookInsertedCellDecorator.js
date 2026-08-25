import { Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { NotebookOverviewRulerLane } from "../../notebookBrowser.js";
import { overviewRulerAddedForeground } from "../../../../scm/common/quickDiff.js";
class NotebookInsertedCellDecorator extends Disposable {
  constructor(notebookEditor) {
    super();
    this.notebookEditor = notebookEditor;
    this.decorators = this._register(new DisposableStore());
  }
  apply(diffInfo) {
    const model = this.notebookEditor.textModel;
    if (!model) {
      return;
    }
    const cells = diffInfo.filter((diff) => diff.type === "insert").map((diff) => model.cells[diff.modifiedCellIndex]);
    const ids = this.notebookEditor.deltaCellDecorations([], cells.map((cell) => ({
      handle: cell.handle,
      options: {
        className: "nb-insertHighlight",
        outputClassName: "nb-insertHighlight",
        overviewRuler: {
          color: overviewRulerAddedForeground,
          modelRanges: [],
          includeOutput: true,
          position: NotebookOverviewRulerLane.Full
        }
      }
    })));
    this.clear();
    this.decorators.add(toDisposable(() => {
      if (!this.notebookEditor.isDisposed) {
        this.notebookEditor.deltaCellDecorations(ids, []);
      }
    }));
  }
  clear() {
    this.decorators.clear();
  }
}
export {
  NotebookInsertedCellDecorator
};
