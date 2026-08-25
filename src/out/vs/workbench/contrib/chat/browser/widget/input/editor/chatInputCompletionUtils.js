import { fuzzyScore, FuzzyScoreOptions, fuzzyScoreGracefulAggressive } from "../../../../../../../base/common/filters.js";
import { Range } from "../../../../../../../editor/common/core/range.js";
import { getWordAtText } from "../../../../../../../editor/common/core/wordHelper.js";
const attachedContextCompletionSortText = "\0";
const attachedContextCompletionAdditionalTriggerCharacters = [":", "-"];
function getAttachedContextCompletionSortText(score) {
  return `${attachedContextCompletionSortText}${(2147483647 - score).toString(16).padStart(8, "0")}`;
}
function getAttachedContextCompletionMatch(typedWord, leader, name, kind, suggestOptions) {
  if (!typedWord) {
    return { filterText: typedWord, score: 0 };
  }
  const searchableText = `${leader}${name} ${leader}attachment:${name} ${name} ${kind}`;
  const scoreFn = suggestOptions.filterGraceful ? fuzzyScoreGracefulAggressive : fuzzyScore;
  const score = scoreFn(
    typedWord,
    typedWord.toLowerCase(),
    0,
    searchableText,
    searchableText.toLowerCase(),
    0,
    { ...FuzzyScoreOptions.default, firstMatchCanBeWeak: !suggestOptions.matchOnWordStartOnly }
  );
  return score ? { filterText: typedWord, score: score[0] } : void 0;
}
function escapeForCharClass(text) {
  return text.replace(/[-\\^\]]/g, "\\$&");
}
function getCompletionRangeWord(rangeResult) {
  return rangeResult.varWord?.word.slice(0, rangeResult.insert.endColumn - rangeResult.insert.startColumn);
}
function computeCompletionRanges(model, position, reg, onlyOnWordStart = false) {
  const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
  if (!varWord && model.getWordUntilPosition(position).word) {
    return;
  }
  if (!varWord && position.column > 1) {
    const textBefore = model.getValueInRange(new Range(position.lineNumber, position.column - 1, position.lineNumber, position.column));
    if (textBefore !== " ") {
      return;
    }
  }
  if (varWord && onlyOnWordStart) {
    const wordBefore = model.getWordUntilPosition({ lineNumber: position.lineNumber, column: varWord.startColumn });
    if (wordBefore.word) {
      return;
    }
  }
  let insert;
  let replace;
  if (!varWord) {
    insert = replace = Range.fromPositions(position);
  } else {
    insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
    replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
  }
  return { insert, replace, varWord };
}
function isEmptyUpToCompletionWord(model, rangeResult) {
  const startToCompletionWordStart = new Range(1, 1, rangeResult.replace.startLineNumber, rangeResult.replace.startColumn);
  return !!model.getValueInRange(startToCompletionWordStart).match(/^\s*$/);
}
function isAtTriggerCharacterToken(model, position, triggerCharacters) {
  if (triggerCharacters.length === 0) {
    return false;
  }
  const line = model.getLineContent(position.lineNumber);
  const beforeCursor = line.slice(0, position.column - 1);
  const wsIdx = beforeCursor.search(/\s\S*$/);
  const token = wsIdx >= 0 ? beforeCursor.slice(wsIdx + 1) : beforeCursor;
  if (token.length === 0) {
    return false;
  }
  return triggerCharacters.includes(token[0]);
}
export {
  attachedContextCompletionAdditionalTriggerCharacters,
  attachedContextCompletionSortText,
  computeCompletionRanges,
  escapeForCharClass,
  getAttachedContextCompletionMatch,
  getAttachedContextCompletionSortText,
  getCompletionRangeWord,
  isAtTriggerCharacterToken,
  isEmptyUpToCompletionWord
};
