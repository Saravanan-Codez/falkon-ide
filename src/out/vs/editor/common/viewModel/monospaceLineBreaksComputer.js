import { CharCode } from "../../../base/common/charCode.js";
import * as strings from "../../../base/common/strings.js";
import { WrappingIndent, EditorOption } from "../config/editorOptions.js";
import { CharacterClassifier } from "../core/characterClassifier.js";
import { LineInjectedText } from "../textModelEvents.js";
import { ModelLineProjectionData } from "../modelLineProjectionData.js";
class MonospaceLineBreaksComputerFactory {
  static create(options) {
    return new MonospaceLineBreaksComputerFactory(
      options.get(EditorOption.wordWrapBreakBeforeCharacters),
      options.get(EditorOption.wordWrapBreakAfterCharacters)
    );
  }
  constructor(breakBeforeChars, breakAfterChars) {
    this.classifier = new WrappingCharacterClassifier(breakBeforeChars, breakAfterChars);
  }
  createLineBreaksComputer(context, fontInfo, tabSize, wrappingColumn, wrappingIndent, wordBreak, wrapOnEscapedLineFeeds) {
    const lineNumbers = [];
    const previousBreakingData = [];
    return {
      addRequest: (lineNumber, previousLineBreakData) => {
        lineNumbers.push(lineNumber);
        previousBreakingData.push(previousLineBreakData);
      },
      finalize: () => {
        const columnsForFullWidthChar = fontInfo.typicalFullwidthCharacterWidth / fontInfo.typicalHalfwidthCharacterWidth;
        const result = [];
        for (let i = 0, len = lineNumbers.length; i < len; i++) {
          const lineNumber = lineNumbers[i];
          const injectedText = context.getLineInjectedText(lineNumber);
          const lineText = context.getLineContent(lineNumber);
          const previousLineBreakData = previousBreakingData[i];
          const isLineFeedWrappingEnabled = wrapOnEscapedLineFeeds && lineText.includes('"') && lineText.includes("\\n");
          if (previousLineBreakData && !previousLineBreakData.injectionOptions && !injectedText && !isLineFeedWrappingEnabled) {
            result[i] = createLineBreaksFromPreviousLineBreaks(this.classifier, previousLineBreakData, lineText, tabSize, wrappingColumn, columnsForFullWidthChar, wrappingIndent, wordBreak);
          } else {
            result[i] = createLineBreaks(this.classifier, lineText, injectedText, tabSize, wrappingColumn, columnsForFullWidthChar, wrappingIndent, wordBreak, isLineFeedWrappingEnabled);
          }
        }
        arrPool1.length = 0;
        arrPool2.length = 0;
        return result;
      }
    };
  }
}
var CharacterClass = /* @__PURE__ */ ((CharacterClass2) => {
  CharacterClass2[CharacterClass2["NONE"] = 0] = "NONE";
  CharacterClass2[CharacterClass2["BREAK_BEFORE"] = 1] = "BREAK_BEFORE";
  CharacterClass2[CharacterClass2["BREAK_AFTER"] = 2] = "BREAK_AFTER";
  CharacterClass2[CharacterClass2["BREAK_IDEOGRAPHIC"] = 3] = "BREAK_IDEOGRAPHIC";
  return CharacterClass2;
})(CharacterClass || {});
class WrappingCharacterClassifier extends CharacterClassifier {
  constructor(BREAK_BEFORE, BREAK_AFTER) {
    super(0 /* NONE */);
    for (let i = 0; i < BREAK_BEFORE.length; i++) {
      this.set(BREAK_BEFORE.charCodeAt(i), 1 /* BREAK_BEFORE */);
    }
    for (let i = 0; i < BREAK_AFTER.length; i++) {
      this.set(BREAK_AFTER.charCodeAt(i), 2 /* BREAK_AFTER */);
    }
  }
  get(charCode) {
    if (charCode >= 0 && charCode < 256) {
      return this._asciiMap[charCode];
    } else {
      if (charCode >= 12352 && charCode <= 12543 || charCode >= 13312 && charCode <= 19903 || charCode >= 19968 && charCode <= 40959) {
        return 3 /* BREAK_IDEOGRAPHIC */;
      }
      return this._map.get(charCode) || this._defaultValue;
    }
  }
}
let arrPool1 = [];
let arrPool2 = [];
function createLineBreaksFromPreviousLineBreaks(classifier, previousBreakingData, lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent, wordBreak) {
  if (firstLineBreakColumn === -1) {
    return null;
  }
  const len = lineText.length;
  if (len <= 1) {
    return null;
  }
  const isKeepAll = wordBreak === "keepAll";
  const prevBreakingOffsets = previousBreakingData.breakOffsets;
  const prevBreakingOffsetsVisibleColumn = previousBreakingData.breakOffsetsVisibleColumn;
  const wrappedTextIndentLength = computeWrappedTextIndentLength(lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent);
  const wrappedLineBreakColumn = firstLineBreakColumn - wrappedTextIndentLength;
  const breakingOffsets = arrPool1;
  const breakingOffsetsVisibleColumn = arrPool2;
  let breakingOffsetsCount = 0;
  let lastBreakingOffset = 0;
  let lastBreakingOffsetVisibleColumn = 0;
  let breakingColumn = firstLineBreakColumn;
  const prevLen = prevBreakingOffsets.length;
  let prevIndex = 0;
  if (prevIndex >= 0) {
    let bestDistance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex] - breakingColumn);
    while (prevIndex + 1 < prevLen) {
      const distance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex + 1] - breakingColumn);
      if (distance >= bestDistance) {
        break;
      }
      bestDistance = distance;
      prevIndex++;
    }
  }
  while (prevIndex < prevLen) {
    let prevBreakOffset = prevIndex < 0 ? 0 : prevBreakingOffsets[prevIndex];
    let prevBreakOffsetVisibleColumn = prevIndex < 0 ? 0 : prevBreakingOffsetsVisibleColumn[prevIndex];
    if (lastBreakingOffset > prevBreakOffset) {
      prevBreakOffset = lastBreakingOffset;
      prevBreakOffsetVisibleColumn = lastBreakingOffsetVisibleColumn;
    }
    let breakOffset = 0;
    let breakOffsetVisibleColumn = 0;
    let forcedBreakOffset = 0;
    let forcedBreakOffsetVisibleColumn = 0;
    if (prevBreakOffsetVisibleColumn <= breakingColumn) {
      let visibleColumn = prevBreakOffsetVisibleColumn;
      let prevCharCode = prevBreakOffset === 0 ? CharCode.Null : lineText.charCodeAt(prevBreakOffset - 1);
      let prevCharCodeClass = prevBreakOffset === 0 ? 0 /* NONE */ : classifier.get(prevCharCode);
      let entireLineFits = true;
      for (let i = prevBreakOffset; i < len; i++) {
        const charStartOffset = i;
        const charCode = lineText.charCodeAt(i);
        let charCodeClass;
        let charWidth;
        if (strings.isHighSurrogate(charCode)) {
          i++;
          charCodeClass = 0 /* NONE */;
          charWidth = 2;
        } else {
          charCodeClass = classifier.get(charCode);
          charWidth = computeCharWidth(charCode, visibleColumn, tabSize, columnsForFullWidthChar);
        }
        if (charStartOffset > lastBreakingOffset && canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll)) {
          breakOffset = charStartOffset;
          breakOffsetVisibleColumn = visibleColumn;
        }
        visibleColumn += charWidth;
        if (visibleColumn > breakingColumn) {
          if (charStartOffset > lastBreakingOffset) {
            forcedBreakOffset = charStartOffset;
            forcedBreakOffsetVisibleColumn = visibleColumn - charWidth;
          } else {
            forcedBreakOffset = i + 1;
            forcedBreakOffsetVisibleColumn = visibleColumn;
          }
          if (visibleColumn - breakOffsetVisibleColumn > wrappedLineBreakColumn) {
            breakOffset = 0;
          }
          entireLineFits = false;
          break;
        }
        prevCharCode = charCode;
        prevCharCodeClass = charCodeClass;
      }
      if (entireLineFits) {
        if (breakingOffsetsCount > 0) {
          breakingOffsets[breakingOffsetsCount] = prevBreakingOffsets[prevBreakingOffsets.length - 1];
          breakingOffsetsVisibleColumn[breakingOffsetsCount] = prevBreakingOffsetsVisibleColumn[prevBreakingOffsets.length - 1];
          breakingOffsetsCount++;
        }
        break;
      }
    }
    if (breakOffset === 0) {
      let visibleColumn = prevBreakOffsetVisibleColumn;
      let charCode = lineText.charCodeAt(prevBreakOffset);
      let charCodeClass = classifier.get(charCode);
      let hitATabCharacter = false;
      for (let i = prevBreakOffset - 1; i >= lastBreakingOffset; i--) {
        const charStartOffset = i + 1;
        const prevCharCode = lineText.charCodeAt(i);
        if (prevCharCode === CharCode.Tab) {
          hitATabCharacter = true;
          break;
        }
        let prevCharCodeClass;
        let prevCharWidth;
        if (strings.isLowSurrogate(prevCharCode)) {
          i--;
          prevCharCodeClass = 0 /* NONE */;
          prevCharWidth = 2;
        } else {
          prevCharCodeClass = classifier.get(prevCharCode);
          prevCharWidth = strings.isFullWidthCharacter(prevCharCode) ? columnsForFullWidthChar : 1;
        }
        if (visibleColumn <= breakingColumn) {
          if (forcedBreakOffset === 0) {
            forcedBreakOffset = charStartOffset;
            forcedBreakOffsetVisibleColumn = visibleColumn;
          }
          if (visibleColumn <= breakingColumn - wrappedLineBreakColumn) {
            break;
          }
          if (canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll)) {
            breakOffset = charStartOffset;
            breakOffsetVisibleColumn = visibleColumn;
            break;
          }
        }
        visibleColumn -= prevCharWidth;
        charCode = prevCharCode;
        charCodeClass = prevCharCodeClass;
      }
      if (breakOffset !== 0) {
        const remainingWidthOfNextLine = wrappedLineBreakColumn - (forcedBreakOffsetVisibleColumn - breakOffsetVisibleColumn);
        if (remainingWidthOfNextLine <= tabSize) {
          const charCodeAtForcedBreakOffset = lineText.charCodeAt(forcedBreakOffset);
          let charWidth;
          if (strings.isHighSurrogate(charCodeAtForcedBreakOffset)) {
            charWidth = 2;
          } else {
            charWidth = computeCharWidth(charCodeAtForcedBreakOffset, forcedBreakOffsetVisibleColumn, tabSize, columnsForFullWidthChar);
          }
          if (remainingWidthOfNextLine - charWidth < 0) {
            breakOffset = 0;
          }
        }
      }
      if (hitATabCharacter) {
        prevIndex--;
        continue;
      }
    }
    if (breakOffset === 0) {
      breakOffset = forcedBreakOffset;
      breakOffsetVisibleColumn = forcedBreakOffsetVisibleColumn;
    }
    if (breakOffset <= lastBreakingOffset) {
      const charCode = lineText.charCodeAt(lastBreakingOffset);
      if (strings.isHighSurrogate(charCode)) {
        breakOffset = lastBreakingOffset + 2;
        breakOffsetVisibleColumn = lastBreakingOffsetVisibleColumn + 2;
      } else {
        breakOffset = lastBreakingOffset + 1;
        breakOffsetVisibleColumn = lastBreakingOffsetVisibleColumn + computeCharWidth(charCode, lastBreakingOffsetVisibleColumn, tabSize, columnsForFullWidthChar);
      }
    }
    lastBreakingOffset = breakOffset;
    breakingOffsets[breakingOffsetsCount] = breakOffset;
    lastBreakingOffsetVisibleColumn = breakOffsetVisibleColumn;
    breakingOffsetsVisibleColumn[breakingOffsetsCount] = breakOffsetVisibleColumn;
    breakingOffsetsCount++;
    breakingColumn = breakOffsetVisibleColumn + wrappedLineBreakColumn;
    while (prevIndex < 0 || prevIndex < prevLen && prevBreakingOffsetsVisibleColumn[prevIndex] < breakOffsetVisibleColumn) {
      prevIndex++;
    }
    let bestDistance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex] - breakingColumn);
    while (prevIndex + 1 < prevLen) {
      const distance = Math.abs(prevBreakingOffsetsVisibleColumn[prevIndex + 1] - breakingColumn);
      if (distance >= bestDistance) {
        break;
      }
      bestDistance = distance;
      prevIndex++;
    }
  }
  if (breakingOffsetsCount === 0) {
    return null;
  }
  breakingOffsets.length = breakingOffsetsCount;
  breakingOffsetsVisibleColumn.length = breakingOffsetsCount;
  arrPool1 = previousBreakingData.breakOffsets;
  arrPool2 = previousBreakingData.breakOffsetsVisibleColumn;
  previousBreakingData.breakOffsets = breakingOffsets;
  previousBreakingData.breakOffsetsVisibleColumn = breakingOffsetsVisibleColumn;
  previousBreakingData.wrappedTextIndentLength = wrappedTextIndentLength;
  return previousBreakingData;
}
function createLineBreaks(classifier, _lineText, injectedTexts, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent, wordBreak, wrapOnEscapedLineFeeds) {
  const lineText = LineInjectedText.applyInjectedText(_lineText, injectedTexts);
  let injectionOptions;
  let injectionOffsets;
  if (injectedTexts && injectedTexts.length > 0) {
    injectionOptions = injectedTexts.map((t) => t.options);
    injectionOffsets = injectedTexts.map((text) => text.column - 1);
  } else {
    injectionOptions = null;
    injectionOffsets = null;
  }
  if (firstLineBreakColumn === -1) {
    if (!injectionOptions) {
      return null;
    }
    return new ModelLineProjectionData(injectionOffsets, injectionOptions, [lineText.length], [], 0);
  }
  const len = lineText.length;
  if (len <= 1) {
    if (!injectionOptions) {
      return null;
    }
    return new ModelLineProjectionData(injectionOffsets, injectionOptions, [lineText.length], [], 0);
  }
  const isKeepAll = wordBreak === "keepAll";
  const wrappedTextIndentLength = computeWrappedTextIndentLength(lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent);
  const wrappedLineBreakColumn = firstLineBreakColumn - wrappedTextIndentLength;
  const breakingOffsets = [];
  const breakingOffsetsVisibleColumn = [];
  let breakingOffsetsCount = 0;
  let breakOffset = 0;
  let breakOffsetVisibleColumn = 0;
  let breakingColumn = firstLineBreakColumn;
  let prevCharCode = lineText.charCodeAt(0);
  let prevCharCodeClass = classifier.get(prevCharCode);
  let visibleColumn = computeCharWidth(prevCharCode, 0, tabSize, columnsForFullWidthChar);
  let startOffset = 1;
  if (strings.isHighSurrogate(prevCharCode)) {
    visibleColumn += 1;
    prevCharCode = lineText.charCodeAt(1);
    prevCharCodeClass = classifier.get(prevCharCode);
    startOffset++;
  }
  for (let i = startOffset; i < len; i++) {
    const charStartOffset = i;
    const charCode = lineText.charCodeAt(i);
    let charCodeClass;
    let charWidth;
    let wrapEscapedLineFeed = false;
    if (strings.isHighSurrogate(charCode)) {
      i++;
      charCodeClass = 0 /* NONE */;
      charWidth = 2;
    } else {
      charCodeClass = classifier.get(charCode);
      charWidth = computeCharWidth(charCode, visibleColumn, tabSize, columnsForFullWidthChar);
    }
    if (wrapOnEscapedLineFeeds && isEscapedLineBreakAtPosition(lineText, i)) {
      breakOffset = charStartOffset;
      breakOffsetVisibleColumn = visibleColumn;
      wrapEscapedLineFeed = true;
    } else if (canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll)) {
      breakOffset = charStartOffset;
      breakOffsetVisibleColumn = visibleColumn;
    }
    visibleColumn += charWidth;
    if (visibleColumn > breakingColumn || wrapEscapedLineFeed) {
      if (breakOffset === 0 || visibleColumn - breakOffsetVisibleColumn > wrappedLineBreakColumn) {
        breakOffset = charStartOffset;
        breakOffsetVisibleColumn = visibleColumn - charWidth;
      }
      breakingOffsets[breakingOffsetsCount] = breakOffset;
      breakingOffsetsVisibleColumn[breakingOffsetsCount] = breakOffsetVisibleColumn;
      breakingOffsetsCount++;
      breakingColumn = breakOffsetVisibleColumn + wrappedLineBreakColumn;
      breakOffset = 0;
    }
    prevCharCode = charCode;
    prevCharCodeClass = charCodeClass;
  }
  if (breakingOffsetsCount === 0 && (!injectedTexts || injectedTexts.length === 0)) {
    return null;
  }
  breakingOffsets[breakingOffsetsCount] = len;
  breakingOffsetsVisibleColumn[breakingOffsetsCount] = visibleColumn;
  return new ModelLineProjectionData(injectionOffsets, injectionOptions, breakingOffsets, breakingOffsetsVisibleColumn, wrappedTextIndentLength);
}
function computeCharWidth(charCode, visibleColumn, tabSize, columnsForFullWidthChar) {
  if (charCode === CharCode.Tab) {
    return tabSize - visibleColumn % tabSize;
  }
  if (strings.isFullWidthCharacter(charCode)) {
    return columnsForFullWidthChar;
  }
  if (charCode < 32) {
    return columnsForFullWidthChar;
  }
  return 1;
}
function tabCharacterWidth(visibleColumn, tabSize) {
  return tabSize - visibleColumn % tabSize;
}
function isEscapedLineBreakAtPosition(lineText, i) {
  if (i >= 2 && lineText.charAt(i - 1) === "n") {
    let escapeCount = 0;
    for (let j = i - 2; j >= 0; j--) {
      if (lineText.charAt(j) === "\\") {
        escapeCount++;
      } else {
        return escapeCount % 2 === 1;
      }
    }
  }
  return false;
}
function canBreak(prevCharCode, prevCharCodeClass, charCode, charCodeClass, isKeepAll) {
  return charCode !== CharCode.Space && (prevCharCodeClass === 2 /* BREAK_AFTER */ && charCodeClass !== 2 /* BREAK_AFTER */ || prevCharCodeClass !== 1 /* BREAK_BEFORE */ && charCodeClass === 1 /* BREAK_BEFORE */ || !isKeepAll && prevCharCodeClass === 3 /* BREAK_IDEOGRAPHIC */ && charCodeClass !== 2 /* BREAK_AFTER */ || !isKeepAll && charCodeClass === 3 /* BREAK_IDEOGRAPHIC */ && prevCharCodeClass !== 1 /* BREAK_BEFORE */);
}
function computeWrappedTextIndentLength(lineText, tabSize, firstLineBreakColumn, columnsForFullWidthChar, wrappingIndent) {
  let wrappedTextIndentLength = 0;
  if (wrappingIndent !== WrappingIndent.None) {
    const firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineText);
    if (firstNonWhitespaceIndex !== -1) {
      for (let i = 0; i < firstNonWhitespaceIndex; i++) {
        const charWidth = lineText.charCodeAt(i) === CharCode.Tab ? tabCharacterWidth(wrappedTextIndentLength, tabSize) : 1;
        wrappedTextIndentLength += charWidth;
      }
      const numberOfAdditionalTabs = wrappingIndent === WrappingIndent.DeepIndent ? 2 : wrappingIndent === WrappingIndent.Indent ? 1 : 0;
      for (let i = 0; i < numberOfAdditionalTabs; i++) {
        const charWidth = tabCharacterWidth(wrappedTextIndentLength, tabSize);
        wrappedTextIndentLength += charWidth;
      }
      if (wrappedTextIndentLength + columnsForFullWidthChar > firstLineBreakColumn) {
        wrappedTextIndentLength = 0;
      }
    }
  }
  return wrappedTextIndentLength;
}
export {
  MonospaceLineBreaksComputerFactory
};
