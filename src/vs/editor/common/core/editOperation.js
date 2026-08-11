import { Range } from "./range.js";
class EditOperation {
  static insert(position, text) {
    return {
      range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text,
      forceMoveMarkers: true
    };
  }
  static delete(range) {
    return {
      range,
      text: null
    };
  }
  static replace(range, text) {
    return {
      range,
      text
    };
  }
  static replaceMove(range, text) {
    return {
      range,
      text,
      forceMoveMarkers: true
    };
  }
}
export {
  EditOperation
};
