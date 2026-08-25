class LineHeightChangingDecoration {
  constructor(ownerId, decorationId, lineNumber, lineHeight) {
    this.ownerId = ownerId;
    this.decorationId = decorationId;
    this.lineNumber = lineNumber;
    this.lineHeight = lineHeight;
  }
  static toKey(obj) {
    return `${obj.ownerId};${obj.decorationId};${obj.lineNumber}`;
  }
}
class LineFontChangingDecoration {
  constructor(ownerId, decorationId, lineNumber) {
    this.ownerId = ownerId;
    this.decorationId = decorationId;
    this.lineNumber = lineNumber;
  }
  static toKey(obj) {
    return `${obj.ownerId};${obj.decorationId};${obj.lineNumber}`;
  }
}
export {
  LineFontChangingDecoration,
  LineHeightChangingDecoration
};
