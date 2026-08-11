import { OffsetRange } from "../ranges/offsetRange.js";
import { BaseEdit, BaseReplacement } from "./edit.js";
class ArrayEdit extends BaseEdit {
  static {
    this.empty = new ArrayEdit([]);
  }
  static create(replacements) {
    return new ArrayEdit(replacements);
  }
  static single(replacement) {
    return new ArrayEdit([replacement]);
  }
  static replace(range, replacement) {
    return new ArrayEdit([new ArrayReplacement(range, replacement)]);
  }
  static insert(offset, replacement) {
    return new ArrayEdit([new ArrayReplacement(OffsetRange.emptyAt(offset), replacement)]);
  }
  static delete(range) {
    return new ArrayEdit([new ArrayReplacement(range, [])]);
  }
  _createNew(replacements) {
    return new ArrayEdit(replacements);
  }
  apply(data) {
    const resultData = [];
    let pos = 0;
    for (const edit of this.replacements) {
      resultData.push(...data.slice(pos, edit.replaceRange.start));
      resultData.push(...edit.newValue);
      pos = edit.replaceRange.endExclusive;
    }
    resultData.push(...data.slice(pos));
    return resultData;
  }
  /**
   * Creates an edit that reverts this edit.
   */
  inverse(baseVal) {
    const edits = [];
    let offset = 0;
    for (const e of this.replacements) {
      edits.push(new ArrayReplacement(
        OffsetRange.ofStartAndLength(e.replaceRange.start + offset, e.newValue.length),
        baseVal.slice(e.replaceRange.start, e.replaceRange.endExclusive)
      ));
      offset += e.newValue.length - e.replaceRange.length;
    }
    return new ArrayEdit(edits);
  }
}
class ArrayReplacement extends BaseReplacement {
  constructor(range, newValue) {
    super(range);
    this.newValue = newValue;
  }
  equals(other) {
    return this.replaceRange.equals(other.replaceRange) && this.newValue.length === other.newValue.length && this.newValue.every((v, i) => v === other.newValue[i]);
  }
  getNewLength() {
    return this.newValue.length;
  }
  tryJoinTouching(other) {
    return new ArrayReplacement(this.replaceRange.joinRightTouching(other.replaceRange), this.newValue.concat(other.newValue));
  }
  slice(range, rangeInReplacement) {
    return new ArrayReplacement(range, rangeInReplacement.slice(this.newValue));
  }
}
export {
  ArrayEdit,
  ArrayReplacement
};
