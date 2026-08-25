import { ColumnRange } from "./columnRange.js";
import { Range } from "../range.js";
class RangeSingleLine {
  constructor(lineNumber, columnRange) {
    this.lineNumber = lineNumber;
    this.columnRange = columnRange;
  }
  static fromRange(range) {
    if (range.endLineNumber !== range.startLineNumber) {
      return void 0;
    }
    return new RangeSingleLine(range.startLineNumber, new ColumnRange(range.startColumn, range.endColumn));
  }
  toRange() {
    return new Range(this.lineNumber, this.columnRange.startColumn, this.lineNumber, this.columnRange.endColumnExclusive);
  }
}
export {
  RangeSingleLine
};
