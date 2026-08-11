import { Range } from "./core/range.js";
function serializeFontTokenOptions() {
  return (annotation) => {
    return {
      fontFamily: annotation.fontFamily ?? "",
      fontSizeMultiplier: annotation.fontSizeMultiplier ?? 0,
      lineHeightMultiplier: annotation.lineHeightMultiplier ?? 0
    };
  };
}
function deserializeFontTokenOptions() {
  return (annotation) => {
    return {
      fontFamily: annotation.fontFamily ? String(annotation.fontFamily) : void 0,
      fontSizeMultiplier: annotation.fontSizeMultiplier ? Number(annotation.fontSizeMultiplier) : void 0,
      lineHeightMultiplier: annotation.lineHeightMultiplier ? Number(annotation.lineHeightMultiplier) : void 0
    };
  };
}
var RawContentChangedType = /* @__PURE__ */ ((RawContentChangedType2) => {
  RawContentChangedType2[RawContentChangedType2["Flush"] = 1] = "Flush";
  RawContentChangedType2[RawContentChangedType2["LineChanged"] = 2] = "LineChanged";
  RawContentChangedType2[RawContentChangedType2["LinesDeleted"] = 3] = "LinesDeleted";
  RawContentChangedType2[RawContentChangedType2["LinesInserted"] = 4] = "LinesInserted";
  RawContentChangedType2[RawContentChangedType2["EOLChanged"] = 5] = "EOLChanged";
  return RawContentChangedType2;
})(RawContentChangedType || {});
class ModelRawFlush {
  constructor() {
    this.changeType = 1 /* Flush */;
  }
}
class LineInjectedText {
  constructor(ownerId, lineNumber, column, options, order) {
    this.ownerId = ownerId;
    this.lineNumber = lineNumber;
    this.column = column;
    this.options = options;
    this.order = order;
  }
  static applyInjectedText(lineText, injectedTexts) {
    if (!injectedTexts || injectedTexts.length === 0) {
      return lineText;
    }
    let result = "";
    let lastOriginalOffset = 0;
    for (const injectedText of injectedTexts) {
      result += lineText.substring(lastOriginalOffset, injectedText.column - 1);
      lastOriginalOffset = injectedText.column - 1;
      result += injectedText.options.content;
    }
    result += lineText.substring(lastOriginalOffset);
    return result;
  }
  static fromDecorations(decorations) {
    const result = [];
    for (const decoration of decorations) {
      if (decoration.options.before && decoration.options.before.content.length > 0) {
        result.push(new LineInjectedText(
          decoration.ownerId,
          decoration.range.startLineNumber,
          decoration.range.startColumn,
          decoration.options.before,
          0
        ));
      }
      if (decoration.options.after && decoration.options.after.content.length > 0) {
        result.push(new LineInjectedText(
          decoration.ownerId,
          decoration.range.endLineNumber,
          decoration.range.endColumn,
          decoration.options.after,
          1
        ));
      }
    }
    result.sort((a, b) => {
      if (a.lineNumber === b.lineNumber) {
        if (a.column === b.column) {
          return a.order - b.order;
        }
        return a.column - b.column;
      }
      return a.lineNumber - b.lineNumber;
    });
    return result;
  }
  withText(text) {
    return new LineInjectedText(this.ownerId, this.lineNumber, this.column, { ...this.options, content: text }, this.order);
  }
}
class ModelRawLineChanged {
  constructor(lineNumber, lineNumberPostEdit) {
    this.changeType = 2 /* LineChanged */;
    this.lineNumber = lineNumber;
    this.lineNumberPostEdit = lineNumberPostEdit;
  }
}
class ModelLineHeightChanged {
  constructor(ownerId, decorationId, lineNumber, lineHeightMultiplier) {
    this.ownerId = ownerId;
    this.decorationId = decorationId;
    this.lineNumber = lineNumber;
    this.lineHeightMultiplier = lineHeightMultiplier;
  }
}
class ModelFontChanged {
  constructor(ownerId, lineNumber) {
    this.ownerId = ownerId;
    this.lineNumber = lineNumber;
  }
}
class ModelRawLinesDeleted {
  constructor(fromLineNumber, toLineNumber, lastUntouchedLinePostEdit) {
    this.changeType = 3 /* LinesDeleted */;
    this.fromLineNumber = fromLineNumber;
    this.toLineNumber = toLineNumber;
    this.lastUntouchedLinePostEdit = lastUntouchedLinePostEdit;
  }
}
class ModelRawLinesInserted {
  constructor(fromLineNumber, fromLineNumberPostEdit, count) {
    this.changeType = 4 /* LinesInserted */;
    this.fromLineNumber = fromLineNumber;
    this.fromLineNumberPostEdit = fromLineNumberPostEdit;
    this.count = count;
  }
  /**
   * `toLineNumber` - `fromLineNumber` + 1 denotes the number of lines that were inserted
   */
  get toLineNumber() {
    return this.fromLineNumber + this.count - 1;
  }
  /**
   * The actual end line number of the insertion in the updated buffer.
   */
  get toLineNumberPostEdit() {
    return this.fromLineNumberPostEdit + this.count - 1;
  }
}
class ModelRawEOLChanged {
  constructor() {
    this.changeType = 5 /* EOLChanged */;
  }
}
class ModelRawContentChangedEvent {
  constructor(changes, versionId, isUndoing, isRedoing) {
    this.changes = changes;
    this.versionId = versionId;
    this.isUndoing = isUndoing;
    this.isRedoing = isRedoing;
    this.resultingSelection = null;
  }
  containsEvent(type) {
    for (let i = 0, len = this.changes.length; i < len; i++) {
      const change = this.changes[i];
      if (change.changeType === type) {
        return true;
      }
    }
    return false;
  }
  static merge(a, b) {
    const changes = [].concat(a.changes).concat(b.changes);
    const versionId = b.versionId;
    const isUndoing = a.isUndoing || b.isUndoing;
    const isRedoing = a.isRedoing || b.isRedoing;
    return new ModelRawContentChangedEvent(changes, versionId, isUndoing, isRedoing);
  }
}
class ModelInjectedTextChangedEvent {
  constructor(changes) {
    this.changes = changes;
  }
}
class ModelLineHeightChangedEvent {
  constructor(changes) {
    this.changes = changes;
  }
  affects(rangeOrPosition) {
    if (Range.isIRange(rangeOrPosition)) {
      for (const change of this.changes) {
        if (change.lineNumber >= rangeOrPosition.startLineNumber && change.lineNumber <= rangeOrPosition.endLineNumber) {
          return true;
        }
      }
      return false;
    } else {
      for (const change of this.changes) {
        if (change.lineNumber === rangeOrPosition.lineNumber) {
          return true;
        }
      }
      return false;
    }
  }
}
class ModelFontChangedEvent {
  constructor(changes) {
    this.changes = changes;
  }
}
class InternalModelContentChangeEvent {
  constructor(rawContentChangedEvent, contentChangedEvent) {
    this.rawContentChangedEvent = rawContentChangedEvent;
    this.contentChangedEvent = contentChangedEvent;
  }
  merge(other) {
    const rawContentChangedEvent = ModelRawContentChangedEvent.merge(this.rawContentChangedEvent, other.rawContentChangedEvent);
    const contentChangedEvent = InternalModelContentChangeEvent._mergeChangeEvents(this.contentChangedEvent, other.contentChangedEvent);
    return new InternalModelContentChangeEvent(rawContentChangedEvent, contentChangedEvent);
  }
  static _mergeChangeEvents(a, b) {
    const changes = [].concat(a.changes).concat(b.changes);
    const eol = b.eol;
    const versionId = b.versionId;
    const isUndoing = a.isUndoing || b.isUndoing;
    const isRedoing = a.isRedoing || b.isRedoing;
    const isFlush = a.isFlush || b.isFlush;
    const isEolChange = a.isEolChange && b.isEolChange;
    return {
      changes,
      eol,
      isEolChange,
      versionId,
      isUndoing,
      isRedoing,
      isFlush,
      detailedReasons: a.detailedReasons.concat(b.detailedReasons),
      detailedReasonsChangeLengths: a.detailedReasonsChangeLengths.concat(b.detailedReasonsChangeLengths)
    };
  }
}
export {
  InternalModelContentChangeEvent,
  LineInjectedText,
  ModelFontChanged,
  ModelFontChangedEvent,
  ModelInjectedTextChangedEvent,
  ModelLineHeightChanged,
  ModelLineHeightChangedEvent,
  ModelRawContentChangedEvent,
  ModelRawEOLChanged,
  ModelRawFlush,
  ModelRawLineChanged,
  ModelRawLinesDeleted,
  ModelRawLinesInserted,
  RawContentChangedType,
  deserializeFontTokenOptions,
  serializeFontTokenOptions
};
