import * as DOM from "../../../../../../base/browser/dom.js";
import { CellContentPart } from "../cellPart.js";
class CellDecorations extends CellContentPart {
  constructor(notebookEditor, rootContainer, decorationContainer) {
    super();
    this.notebookEditor = notebookEditor;
    this.rootContainer = rootContainer;
    this.decorationContainer = decorationContainer;
  }
  didRenderCell(element) {
    const removedClassNames = [];
    this.rootContainer.classList.forEach((className) => {
      if (/^nb\-.*$/.test(className)) {
        removedClassNames.push(className);
      }
    });
    removedClassNames.forEach((className) => {
      this.rootContainer.classList.remove(className);
    });
    this.decorationContainer.innerText = "";
    const generateCellTopDecorations = () => {
      this.decorationContainer.innerText = "";
      element.getCellDecorations().filter((options) => options.topClassName !== void 0).forEach((options) => {
        this.decorationContainer.append(DOM.$(`.${options.topClassName}`));
      });
    };
    this.cellDisposables.add(element.onCellDecorationsChanged((e) => {
      const modified = e.added.find((e2) => e2.topClassName) || e.removed.find((e2) => e2.topClassName);
      if (modified) {
        generateCellTopDecorations();
      }
    }));
    generateCellTopDecorations();
    this.registerDecorations();
  }
  registerDecorations() {
    if (!this.currentCell) {
      return;
    }
    this.cellDisposables.add(this.currentCell.onCellDecorationsChanged((e) => {
      e.added.forEach((options) => {
        if (options.className && this.currentCell) {
          this.rootContainer.classList.add(options.className);
        }
      });
      e.removed.forEach((options) => {
        if (options.className && this.currentCell) {
          this.rootContainer.classList.remove(options.className);
        }
      });
    }));
    this.currentCell.getCellDecorations().forEach((options) => {
      if (options.className && this.currentCell) {
        this.rootContainer.classList.add(options.className);
        this.notebookEditor.deltaCellContainerClassNames(this.currentCell.id, [options.className], [], this.currentCell.cellKind);
      }
      if (options.outputClassName && this.currentCell) {
        this.notebookEditor.deltaCellContainerClassNames(this.currentCell.id, [options.outputClassName], [], this.currentCell.cellKind);
      }
    });
  }
}
export {
  CellDecorations
};
