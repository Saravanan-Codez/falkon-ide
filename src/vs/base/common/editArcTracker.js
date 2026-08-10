import { BugIndicatingError } from "./errors.js";
import { commonPrefixLength, commonSuffixLength, splitLines } from "./strings.js";
class EditArcTracker {
  constructor(_valueBeforeTrackedEdit, trackedEdit) {
    this._valueBeforeTrackedEdit = _valueBeforeTrackedEdit;
    this._trackedEdit = normalizeReplacements(removeCommonText(trackedEdit.replacements, _valueBeforeTrackedEdit, true));
    this._updatedTrackedEdit = this._trackedEdit;
  }
  getOriginalCharacterCount() {
    let result = 0;
    for (const replacement of this._trackedEdit) {
      result += replacement.text.length;
    }
    return result;
  }
  handleEdits(edit) {
    const untrackedEdit = normalizeReplacements(edit.replacements.map((replacement) => ({
      ...replacement,
      isTracked: false
    })));
    this._updatedTrackedEdit = compose(this._updatedTrackedEdit, untrackedEdit);
  }
  getAcceptedRestrainedCharactersCount() {
    let result = 0;
    for (const replacement of this._updatedTrackedEdit) {
      if (replacement.isTracked) {
        result += replacement.text.length;
      }
    }
    return result;
  }
  getLineCountInfo() {
    return getLineCountInfo(
      this._updatedTrackedEdit.filter((replacement) => replacement.isTracked),
      this._valueBeforeTrackedEdit
    );
  }
  getValues() {
    return {
      arc: this.getAcceptedRestrainedCharactersCount(),
      ...this.getLineCountInfo()
    };
  }
}
function removeCommonText(replacements, originalText, isTracked) {
  return replacements.map((replacement) => {
    const oldText = originalText.substring(replacement.start, replacement.endExclusive);
    const prefixLength = commonPrefixLength(oldText, replacement.text);
    const suffixLength = Math.min(
      oldText.length - prefixLength,
      replacement.text.length - prefixLength,
      commonSuffixLength(oldText, replacement.text)
    );
    return {
      start: replacement.start + prefixLength,
      endExclusive: replacement.endExclusive - suffixLength,
      text: replacement.text.substring(prefixLength, replacement.text.length - suffixLength),
      isTracked
    };
  });
}
function normalizeReplacements(replacements) {
  const result = [];
  let previous;
  for (const replacement of replacements) {
    if (replacement.start > replacement.endExclusive) {
      throw new BugIndicatingError("Edit replacement start must not be after its end");
    }
    if (previous && replacement.start < previous.endExclusive) {
      throw new BugIndicatingError("Edit replacements must be sorted and disjoint");
    }
    if (replacement.start === replacement.endExclusive && replacement.text.length === 0) {
      continue;
    }
    if (previous && previous.endExclusive === replacement.start && previous.isTracked === replacement.isTracked) {
      previous = {
        start: previous.start,
        endExclusive: replacement.endExclusive,
        text: previous.text + replacement.text,
        isTracked: previous.isTracked
      };
      continue;
    }
    if (previous) {
      result.push(previous);
    }
    previous = replacement;
  }
  if (previous) {
    result.push(previous);
  }
  return result;
}
function compose(first, second) {
  if (first.length === 0) {
    return second.slice();
  }
  if (second.length === 0) {
    return first.slice();
  }
  const firstQueue = first.slice();
  const result = [];
  let firstToSecondOffset = 0;
  for (const secondReplacement of second) {
    while (true) {
      const firstReplacement = firstQueue[0];
      if (!firstReplacement || firstReplacement.start + firstToSecondOffset + firstReplacement.text.length >= secondReplacement.start) {
        break;
      }
      firstQueue.shift();
      result.push(firstReplacement);
      firstToSecondOffset += firstReplacement.text.length - (firstReplacement.endExclusive - firstReplacement.start);
    }
    const offsetBeforeIntersections = firstToSecondOffset;
    let firstIntersecting;
    let lastIntersecting;
    while (true) {
      const firstReplacement = firstQueue[0];
      if (!firstReplacement || firstReplacement.start + firstToSecondOffset > secondReplacement.endExclusive) {
        break;
      }
      firstIntersecting ??= firstReplacement;
      lastIntersecting = firstReplacement;
      firstQueue.shift();
      firstToSecondOffset += firstReplacement.text.length - (firstReplacement.endExclusive - firstReplacement.start);
    }
    if (!firstIntersecting) {
      result.push(deltaReplacement(secondReplacement, -firstToSecondOffset));
      continue;
    }
    const replaceStart = Math.min(firstIntersecting.start, secondReplacement.start - offsetBeforeIntersections);
    const prefixLength = secondReplacement.start - (firstIntersecting.start + offsetBeforeIntersections);
    if (prefixLength > 0) {
      result.push(sliceReplacement(firstIntersecting, replaceStart, replaceStart, 0, prefixLength));
    }
    if (!lastIntersecting) {
      throw new BugIndicatingError("Missing intersecting ARC edit");
    }
    const suffixLength = lastIntersecting.endExclusive + firstToSecondOffset - secondReplacement.endExclusive;
    if (suffixLength > 0) {
      const suffix = sliceReplacement(
        lastIntersecting,
        lastIntersecting.endExclusive,
        lastIntersecting.endExclusive,
        lastIntersecting.text.length - suffixLength,
        lastIntersecting.text.length
      );
      firstQueue.unshift(suffix);
      firstToSecondOffset -= suffix.text.length - (suffix.endExclusive - suffix.start);
    }
    result.push(sliceReplacement(
      secondReplacement,
      replaceStart,
      secondReplacement.endExclusive - firstToSecondOffset,
      0,
      secondReplacement.text.length
    ));
  }
  result.push(...firstQueue);
  return normalizeReplacements(result);
}
function deltaReplacement(replacement, offset) {
  return {
    ...replacement,
    start: replacement.start + offset,
    endExclusive: replacement.endExclusive + offset
  };
}
function sliceReplacement(replacement, start, endExclusive, textStart, textEndExclusive) {
  return {
    start,
    endExclusive,
    text: replacement.text.substring(textStart, textEndExclusive),
    isTracked: replacement.isTracked
  };
}
function getLineCountInfo(replacements, initialText) {
  if (replacements.length === 0) {
    return { deletedLineCounts: 0, insertedLineCounts: 0 };
  }
  const lineOffsets = new LineOffsets(initialText);
  const textReplacements = replacements.map((replacement) => ({
    start: lineOffsets.getPosition(replacement.start),
    end: lineOffsets.getPosition(replacement.endExclusive),
    startOffset: replacement.start,
    endOffset: replacement.endExclusive,
    text: replacement.text
  }));
  let deletedLineCounts = 0;
  let insertedLineCounts = 0;
  let current = [];
  for (let i = 0; i < textReplacements.length; i++) {
    const replacement = textReplacements[i];
    const next = textReplacements[i + 1];
    current.push(replacement);
    if (next && next.start.lineNumber === replacement.end.lineNumber) {
      continue;
    }
    const joined = joinTextReplacements(current, initialText);
    current = [];
    const newLines = splitLines(joined.text);
    let startLineNumber = joined.start.lineNumber;
    let endLineNumberExclusive = joined.end.lineNumber + 1;
    const firstLinePrefix = initialText.substring(lineOffsets.getLineStart(joined.start.lineNumber), joined.startOffset);
    newLines[0] = firstLinePrefix + newLines[0];
    const lastLineSuffix = initialText.substring(joined.endOffset, lineOffsets.getLineEnd(joined.end.lineNumber));
    newLines[newLines.length - 1] += lastLineSuffix;
    const startsAtLineEnd = joined.start.column === lineOffsets.getLineLength(joined.start.lineNumber) + 1;
    const endsAtLineStart = joined.end.column === 1;
    if (startsAtLineEnd && newLines[0].length === firstLinePrefix.length) {
      startLineNumber++;
      newLines.shift();
    }
    if (newLines.length > 0 && startLineNumber < endLineNumberExclusive && endsAtLineStart && newLines[newLines.length - 1].length === lastLineSuffix.length) {
      endLineNumberExclusive--;
      newLines.pop();
    }
    deletedLineCounts += endLineNumberExclusive - startLineNumber;
    insertedLineCounts += newLines.length;
  }
  return { deletedLineCounts, insertedLineCounts };
}
function joinTextReplacements(replacements, initialText) {
  const first = replacements[0];
  const last = replacements[replacements.length - 1];
  let text = first.text;
  for (let i = 1; i < replacements.length; i++) {
    text += initialText.substring(replacements[i - 1].endOffset, replacements[i].startOffset);
    text += replacements[i].text;
  }
  return {
    start: first.start,
    end: last.end,
    startOffset: first.startOffset,
    endOffset: last.endOffset,
    text
  };
}
class LineOffsets {
  constructor(text) {
    this._lineStarts = [0];
    this._lineEnds = [];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        this._lineStarts.push(i + 1);
        this._lineEnds.push(i > 0 && text.charCodeAt(i - 1) === 13 ? i - 1 : i);
      }
    }
    this._lineEnds.push(text.length);
  }
  getPosition(offset) {
    let low = 0;
    let high = this._lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this._lineStarts[middle] <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return { lineNumber: low + 1, column: offset - this._lineStarts[low] + 1 };
  }
  getLineStart(lineNumber) {
    return this._lineStarts[lineNumber - 1];
  }
  getLineEnd(lineNumber) {
    return this._lineEnds[lineNumber - 1];
  }
  getLineLength(lineNumber) {
    return this.getLineEnd(lineNumber) - this.getLineStart(lineNumber);
  }
}
export {
  EditArcTracker
};
