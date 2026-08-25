class DiffChange {
  /**
   * Constructs a new DiffChange with the given sequence information
   * and content.
   */
  constructor(originalStart, originalLength, modifiedStart, modifiedLength) {
    this.originalStart = originalStart;
    this.originalLength = originalLength;
    this.modifiedStart = modifiedStart;
    this.modifiedLength = modifiedLength;
  }
  /**
   * The end point (exclusive) of the change in the original sequence.
   */
  getOriginalEnd() {
    return this.originalStart + this.originalLength;
  }
  /**
   * The end point (exclusive) of the change in the modified sequence.
   */
  getModifiedEnd() {
    return this.modifiedStart + this.modifiedLength;
  }
}
export {
  DiffChange
};
