import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { NotebookOutlineContext } from "../contrib/outline/notebookOutline.js";
import { FoldingController } from "./foldingController.js";
import { CellEditState, CellFoldingState } from "../notebookBrowser.js";
import * as icons from "../notebookIcons.js";
import { CellKind } from "../../common/notebookCommon.js";
import { OutlineTarget } from "../../../../services/outline/browser/outline.js";
import { CELL_TITLE_CELL_GROUP_ID, CellToolbarOrder } from "./coreActions.js";
import { executeSectionCondition } from "./executeActions.js";
class NotebookRunSingleCellInSection extends Action2 {
  constructor() {
    super({
      id: "notebook.section.runSingleCell",
      title: {
        ...localize2("runCell", "Run Cell"),
        mnemonicTitle: localize({ key: "mirunCell", comment: ["&& denotes a mnemonic"] }, "&&Run Cell")
      },
      shortTitle: localize("runCell", "Run Cell"),
      icon: icons.executeIcon,
      menu: [
        {
          id: MenuId.NotebookOutlineActionMenu,
          group: "inline",
          order: 1,
          when: ContextKeyExpr.and(
            NotebookOutlineContext.CellKind.isEqualTo(CellKind.Code),
            NotebookOutlineContext.OutlineElementTarget.isEqualTo(OutlineTarget.OutlinePane),
            NotebookOutlineContext.CellHasChildren.toNegated(),
            NotebookOutlineContext.CellHasHeader.toNegated()
          )
        }
      ]
    });
  }
  async run(_accessor, context) {
    if (!checkOutlineEntryContext(context)) {
      return;
    }
    context.notebookEditor.executeNotebookCells([context.outlineEntry.cell]);
  }
}
class NotebookRunCellsInSection extends Action2 {
  constructor() {
    super({
      id: "notebook.section.runCells",
      title: {
        ...localize2("runCellsInSection", "Run Cells In Section"),
        mnemonicTitle: localize({ key: "mirunCellsInSection", comment: ["&& denotes a mnemonic"] }, "&&Run Cells In Section")
      },
      shortTitle: localize("runCellsInSection", "Run Cells In Section"),
      icon: icons.executeIcon,
      // TODO @Yoyokrazy replace this with new icon later
      menu: [
        {
          id: MenuId.NotebookStickyScrollContext,
          group: "notebookExecution",
          order: 1
        },
        {
          id: MenuId.NotebookOutlineActionMenu,
          group: "inline",
          order: 1,
          when: ContextKeyExpr.and(
            NotebookOutlineContext.CellKind.isEqualTo(CellKind.Markup),
            NotebookOutlineContext.OutlineElementTarget.isEqualTo(OutlineTarget.OutlinePane),
            NotebookOutlineContext.CellHasChildren,
            NotebookOutlineContext.CellHasHeader
          )
        },
        {
          id: MenuId.NotebookCellTitle,
          order: CellToolbarOrder.RunSection,
          group: CELL_TITLE_CELL_GROUP_ID,
          when: executeSectionCondition
        }
      ]
    });
  }
  async run(_accessor, context) {
    let cell;
    if (checkOutlineEntryContext(context)) {
      cell = context.outlineEntry.cell;
    } else if (checkNotebookCellContext(context)) {
      cell = context.cell;
    } else {
      return;
    }
    if (cell.getEditState() === CellEditState.Editing) {
      const foldingController = context.notebookEditor.getContribution(FoldingController.id);
      foldingController.recompute();
    }
    const cellIdx = context.notebookEditor.getViewModel()?.getCellIndex(cell);
    if (cellIdx === void 0) {
      return;
    }
    const sectionIdx = context.notebookEditor.getViewModel()?.getFoldingStartIndex(cellIdx);
    if (sectionIdx === void 0) {
      return;
    }
    const length = context.notebookEditor.getViewModel()?.getFoldedLength(sectionIdx);
    if (length === void 0) {
      return;
    }
    const cells = context.notebookEditor.getCellsInRange({ start: sectionIdx, end: sectionIdx + length + 1 });
    context.notebookEditor.executeNotebookCells(cells);
  }
}
class NotebookFoldSection extends Action2 {
  constructor() {
    super({
      id: "notebook.section.foldSection",
      title: {
        ...localize2("foldSection", "Fold Section"),
        mnemonicTitle: localize({ key: "mifoldSection", comment: ["&& denotes a mnemonic"] }, "&&Fold Section")
      },
      shortTitle: localize("foldSection", "Fold Section"),
      menu: [
        {
          id: MenuId.NotebookOutlineActionMenu,
          group: "notebookFolding",
          order: 2,
          when: ContextKeyExpr.and(
            NotebookOutlineContext.CellKind.isEqualTo(CellKind.Markup),
            NotebookOutlineContext.OutlineElementTarget.isEqualTo(OutlineTarget.OutlinePane),
            NotebookOutlineContext.CellHasChildren,
            NotebookOutlineContext.CellHasHeader,
            NotebookOutlineContext.CellFoldingState.isEqualTo(CellFoldingState.Expanded)
          )
        }
      ]
    });
  }
  async run(_accessor, context) {
    if (!checkOutlineEntryContext(context)) {
      return;
    }
    this.toggleFoldRange(context.outlineEntry, context.notebookEditor);
  }
  toggleFoldRange(entry, notebookEditor) {
    const foldingController = notebookEditor.getContribution(FoldingController.id);
    const index = entry.index;
    const headerLevel = entry.level;
    const newFoldingState = CellFoldingState.Collapsed;
    foldingController.setFoldingStateDown(index, newFoldingState, headerLevel);
  }
}
class NotebookExpandSection extends Action2 {
  constructor() {
    super({
      id: "notebook.section.expandSection",
      title: {
        ...localize2("expandSection", "Expand Section"),
        mnemonicTitle: localize({ key: "miexpandSection", comment: ["&& denotes a mnemonic"] }, "&&Expand Section")
      },
      shortTitle: localize("expandSection", "Expand Section"),
      menu: [
        {
          id: MenuId.NotebookOutlineActionMenu,
          group: "notebookFolding",
          order: 2,
          when: ContextKeyExpr.and(
            NotebookOutlineContext.CellKind.isEqualTo(CellKind.Markup),
            NotebookOutlineContext.OutlineElementTarget.isEqualTo(OutlineTarget.OutlinePane),
            NotebookOutlineContext.CellHasChildren,
            NotebookOutlineContext.CellHasHeader,
            NotebookOutlineContext.CellFoldingState.isEqualTo(CellFoldingState.Collapsed)
          )
        }
      ]
    });
  }
  async run(_accessor, context) {
    if (!checkOutlineEntryContext(context)) {
      return;
    }
    this.toggleFoldRange(context.outlineEntry, context.notebookEditor);
  }
  toggleFoldRange(entry, notebookEditor) {
    const foldingController = notebookEditor.getContribution(FoldingController.id);
    const index = entry.index;
    const headerLevel = entry.level;
    const newFoldingState = CellFoldingState.Expanded;
    foldingController.setFoldingStateDown(index, newFoldingState, headerLevel);
  }
}
function checkOutlineEntryContext(context) {
  return !!(context && context.notebookEditor && context.outlineEntry);
}
function checkNotebookCellContext(context) {
  return !!(context && context.notebookEditor && context.cell);
}
registerAction2(NotebookRunSingleCellInSection);
registerAction2(NotebookRunCellsInSection);
registerAction2(NotebookFoldSection);
registerAction2(NotebookExpandSection);
export {
  NotebookExpandSection,
  NotebookFoldSection,
  NotebookRunCellsInSection,
  NotebookRunSingleCellInSection
};
