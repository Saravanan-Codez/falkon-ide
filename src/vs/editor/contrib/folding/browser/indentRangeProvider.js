import { computeIndentLevel } from "../../../common/model/utils.js";
import { FoldingRegions, MAX_LINE_NUMBER } from "./foldingRanges.js";
const MAX_FOLDING_REGIONS_FOR_INDENT_DEFAULT = 5e3;
const ID_INDENT_PROVIDER = "indent";
class IndentRangeProvider {
  constructor(editorModel, languageConfigurationService, foldingRangesLimit) {
    this.editorModel = editorModel;
    this.languageConfigurationService = languageConfigurationService;
    this.foldingRangesLimit = foldingRangesLimit;
    this.id = ID_INDENT_PROVIDER;
  }
  dispose() {
  }
  compute(cancelationToken) {
    const foldingRules = this.languageConfigurationService.getLanguageConfiguration(this.editorModel.getLanguageId()).foldingRules;
    const offSide = foldingRules && !!foldingRules.offSide;
    const markers = foldingRules && foldingRules.markers;
    return Promise.resolve(computeRanges(this.editorModel, offSide, markers, this.foldingRangesLimit));
  }
}
class RangesCollector {
  constructor(foldingRangesLimit) {
    this._startIndexes = [];
    this._endIndexes = [];
    this._indentOccurrences = [];
    this._length = 0;
    this._foldingRangesLimit = foldingRangesLimit;
  }
  insertFirst(startLineNumber, endLineNumber, indent) {
    if (startLineNumber > MAX_LINE_NUMBER || endLineNumber > MAX_LINE_NUMBER) {
      return;
    }
    const index = this._length;
    this._startIndexes[index] = startLineNumber;
    this._endIndexes[index] = endLineNumber;
    this._length++;
    if (indent < 1e3) {
      this._indentOccurrences[indent] = (this._indentOccurrences[indent] || 0) + 1;
    }
  }
  toIndentRanges(model) {
    const limit = this._foldingRangesLimit.limit;
    if (this._length <= limit) {
      this._foldingRangesLimit.update(this._length, false);
      const startIndexes = new Uint32Array(this._length);
      const endIndexes = new Uint32Array(this._length);
      for (let i = this._length - 1, k = 0; i >= 0; i--, k++) {
        startIndexes[k] = this._startIndexes[i];
        endIndexes[k] = this._endIndexes[i];
      }
      return new FoldingRegions(startIndexes, endIndexes);
    } else {
      this._foldingRangesLimit.update(this._length, limit);
      let entries = 0;
      let maxIndent = this._indentOccurrences.length;
      for (let i = 0; i < this._indentOccurrences.length; i++) {
        const n = this._indentOccurrences[i];
        if (n) {
          if (n + entries > limit) {
            maxIndent = i;
            break;
          }
          entries += n;
        }
      }
      const tabSize = model.getOptions().tabSize;
      const startIndexes = new Uint32Array(limit);
      const endIndexes = new Uint32Array(limit);
      for (let i = this._length - 1, k = 0; i >= 0; i--) {
        const startIndex = this._startIndexes[i];
        const lineContent = model.getLineContent(startIndex);
        const indent = computeIndentLevel(lineContent, tabSize);
        if (indent < maxIndent || indent === maxIndent && entries++ < limit) {
          startIndexes[k] = startIndex;
          endIndexes[k] = this._endIndexes[i];
          k++;
        }
      }
      return new FoldingRegions(startIndexes, endIndexes);
    }
  }
}
const foldingRangesLimitDefault = {
  limit: MAX_FOLDING_REGIONS_FOR_INDENT_DEFAULT,
  update: () => {
  }
};
function computeRanges(model, offSide, markers, foldingRangesLimit = foldingRangesLimitDefault) {
  const tabSize = model.getOptions().tabSize;
  const result = new RangesCollector(foldingRangesLimit);
  let pattern = void 0;
  let startPattern = void 0;
  let endPattern = void 0;
  if (markers) {
    if (markers.start.flags === markers.end.flags) {
      pattern = new RegExp(`(${markers.start.source})|(?:${markers.end.source})`, markers.start.flags);
    } else {
      startPattern = markers.start;
      endPattern = markers.end;
    }
  }
  const previousRegions = [];
  const line = model.getLineCount() + 1;
  previousRegions.push({ indent: -1, endAbove: line, line });
  for (let line2 = model.getLineCount(); line2 > 0; line2--) {
    const lineContent = model.getLineContent(line2);
    const indent = computeIndentLevel(lineContent, tabSize);
    let previous = previousRegions[previousRegions.length - 1];
    if (indent === -1) {
      if (offSide) {
        previous.endAbove = line2;
      }
      continue;
    }
    let isStartMatch = false;
    let isEndMatch = false;
    let m;
    if (pattern) {
      pattern.lastIndex = 0;
      if (m = pattern.exec(lineContent)) {
        isStartMatch = !!m[1];
        isEndMatch = !isStartMatch;
      }
    } else {
      if (startPattern) {
        startPattern.lastIndex = 0;
        isStartMatch = startPattern.test(lineContent);
      }
      if (!isStartMatch && endPattern) {
        endPattern.lastIndex = 0;
        isEndMatch = endPattern.test(lineContent);
      }
    }
    if (isStartMatch || isEndMatch) {
      if (isStartMatch) {
        let i = previousRegions.length - 1;
        while (i > 0 && previousRegions[i].indent !== -2) {
          i--;
        }
        if (i > 0) {
          previousRegions.length = i + 1;
          previous = previousRegions[i];
          result.insertFirst(line2, previous.line, indent);
          previous.line = line2;
          previous.indent = indent;
          previous.endAbove = line2;
          continue;
        } else {
        }
      } else {
        previousRegions.push({ indent: -2, endAbove: line2, line: line2 });
        continue;
      }
    }
    if (previous.indent > indent) {
      do {
        previousRegions.pop();
        previous = previousRegions[previousRegions.length - 1];
      } while (previous.indent > indent);
      const endLineNumber = previous.endAbove - 1;
      if (endLineNumber - line2 >= 1) {
        result.insertFirst(line2, endLineNumber, indent);
      }
    }
    if (previous.indent === indent) {
      previous.endAbove = line2;
    } else {
      previousRegions.push({ indent, endAbove: line2, line: line2 });
    }
  }
  return result.toIndentRanges(model);
}
export {
  IndentRangeProvider,
  RangesCollector,
  computeRanges
};
