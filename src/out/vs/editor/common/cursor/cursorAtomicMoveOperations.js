import { CharCode } from "../../../base/common/charCode.js";
import { CursorColumns } from "../core/cursorColumns.js";
var Direction = /* @__PURE__ */ ((Direction2) => {
  Direction2[Direction2["Left"] = 0] = "Left";
  Direction2[Direction2["Right"] = 1] = "Right";
  Direction2[Direction2["Nearest"] = 2] = "Nearest";
  return Direction2;
})(Direction || {});
class AtomicTabMoveOperations {
  /**
   * Get the visible column at the position. If we get to a non-whitespace character first
   * or past the end of string then return -1.
   *
   * **Note** `position` and the return value are 0-based.
   */
  static whitespaceVisibleColumn(lineContent, position, tabSize) {
    const lineLength = lineContent.length;
    let visibleColumn = 0;
    let prevTabStopPosition = -1;
    let prevTabStopVisibleColumn = -1;
    for (let i = 0; i < lineLength; i++) {
      if (i === position) {
        return [prevTabStopPosition, prevTabStopVisibleColumn, visibleColumn];
      }
      if (visibleColumn % tabSize === 0) {
        prevTabStopPosition = i;
        prevTabStopVisibleColumn = visibleColumn;
      }
      const chCode = lineContent.charCodeAt(i);
      switch (chCode) {
        case CharCode.Space:
          visibleColumn += 1;
          break;
        case CharCode.Tab:
          visibleColumn = CursorColumns.nextRenderTabStop(visibleColumn, tabSize);
          break;
        default:
          return [-1, -1, -1];
      }
    }
    if (position === lineLength) {
      return [prevTabStopPosition, prevTabStopVisibleColumn, visibleColumn];
    }
    return [-1, -1, -1];
  }
  /**
   * Return the position that should result from a move left, right or to the
   * nearest tab, if atomic tabs are enabled. Left and right are used for the
   * arrow key movements, nearest is used for mouse selection. It returns
   * -1 if atomic tabs are not relevant and you should fall back to normal
   * behaviour.
   *
   * **Note**: `position` and the return value are 0-based.
   */
  static atomicPosition(lineContent, position, tabSize, direction) {
    const lineLength = lineContent.length;
    const [prevTabStopPosition, prevTabStopVisibleColumn, visibleColumn] = AtomicTabMoveOperations.whitespaceVisibleColumn(lineContent, position, tabSize);
    if (visibleColumn === -1) {
      return -1;
    }
    let left;
    switch (direction) {
      case 0 /* Left */:
        left = true;
        break;
      case 1 /* Right */:
        left = false;
        break;
      case 2 /* Nearest */:
        if (visibleColumn % tabSize === 0) {
          return position;
        }
        left = visibleColumn % tabSize <= tabSize / 2;
        break;
    }
    if (left) {
      if (prevTabStopPosition === -1) {
        return -1;
      }
      let currentVisibleColumn2 = prevTabStopVisibleColumn;
      for (let i = prevTabStopPosition; i < lineLength; ++i) {
        if (currentVisibleColumn2 === prevTabStopVisibleColumn + tabSize) {
          return prevTabStopPosition;
        }
        const chCode = lineContent.charCodeAt(i);
        switch (chCode) {
          case CharCode.Space:
            currentVisibleColumn2 += 1;
            break;
          case CharCode.Tab:
            currentVisibleColumn2 = CursorColumns.nextRenderTabStop(currentVisibleColumn2, tabSize);
            break;
          default:
            return -1;
        }
      }
      if (currentVisibleColumn2 === prevTabStopVisibleColumn + tabSize) {
        return prevTabStopPosition;
      }
      return -1;
    }
    const targetVisibleColumn = CursorColumns.nextRenderTabStop(visibleColumn, tabSize);
    let currentVisibleColumn = visibleColumn;
    for (let i = position; i < lineLength; i++) {
      if (currentVisibleColumn === targetVisibleColumn) {
        return i;
      }
      const chCode = lineContent.charCodeAt(i);
      switch (chCode) {
        case CharCode.Space:
          currentVisibleColumn += 1;
          break;
        case CharCode.Tab:
          currentVisibleColumn = CursorColumns.nextRenderTabStop(currentVisibleColumn, tabSize);
          break;
        default:
          return -1;
      }
    }
    if (currentVisibleColumn === targetVisibleColumn) {
      return lineLength;
    }
    return -1;
  }
}
export {
  AtomicTabMoveOperations,
  Direction
};
