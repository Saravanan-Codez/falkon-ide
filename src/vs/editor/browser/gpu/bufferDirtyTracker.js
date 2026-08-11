class BufferDirtyTracker {
  get dataOffset() {
    return this._startIndex;
  }
  get dirtySize() {
    if (this._startIndex === void 0 || this._endIndex === void 0) {
      return void 0;
    }
    return this._endIndex - this._startIndex + 1;
  }
  get isDirty() {
    return this._startIndex !== void 0;
  }
  /**
   * Flag the index(es) as modified. Returns the index flagged.
   * @param index An index to flag.
   * @param length An optional length to flag. Defaults to 1.
   */
  flag(index, length = 1) {
    this._flag(index);
    if (length > 1) {
      this._flag(index + length - 1);
    }
    return index;
  }
  _flag(index) {
    if (this._startIndex === void 0 || index < this._startIndex) {
      this._startIndex = index;
    }
    if (this._endIndex === void 0 || index > this._endIndex) {
      this._endIndex = index;
    }
  }
  clear() {
    this._startIndex = void 0;
    this._endIndex = void 0;
  }
}
export {
  BufferDirtyTracker
};
