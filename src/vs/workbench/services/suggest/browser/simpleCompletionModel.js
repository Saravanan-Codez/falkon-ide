import { quickSelect } from "../../../../base/common/arrays.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { FuzzyScore, fuzzyScore, fuzzyScoreGracefulAggressive, FuzzyScoreOptions } from "../../../../base/common/filters.js";
class LineContext {
  constructor(leadingLineContent, characterCountDelta) {
    this.leadingLineContent = leadingLineContent;
    this.characterCountDelta = characterCountDelta;
  }
}
var Refilter = /* @__PURE__ */ ((Refilter2) => {
  Refilter2[Refilter2["Nothing"] = 0] = "Nothing";
  Refilter2[Refilter2["All"] = 1] = "All";
  Refilter2[Refilter2["Incr"] = 2] = "Incr";
  return Refilter2;
})(Refilter || {});
class SimpleCompletionModel {
  constructor(_items, _lineContext, _rawCompareFn) {
    this._items = _items;
    this._lineContext = _lineContext;
    this._rawCompareFn = _rawCompareFn;
    this._refilterKind = 1 /* All */;
    this._fuzzyScoreOptions = {
      ...FuzzyScoreOptions.default,
      firstMatchCanBeWeak: true
    };
    // TODO: Pass in options
    this._options = {};
  }
  get items() {
    this._ensureCachedState();
    return this._filteredItems;
  }
  get stats() {
    this._ensureCachedState();
    return this._stats;
  }
  get lineContext() {
    return this._lineContext;
  }
  set lineContext(value) {
    if (this._lineContext.leadingLineContent !== value.leadingLineContent || this._lineContext.characterCountDelta !== value.characterCountDelta) {
      this._refilterKind = this._lineContext.characterCountDelta < value.characterCountDelta && this._filteredItems ? 2 /* Incr */ : 1 /* All */;
      this._lineContext = value;
    }
  }
  forceRefilterAll() {
    this._refilterKind = 1 /* All */;
  }
  _ensureCachedState() {
    if (this._refilterKind !== 0 /* Nothing */) {
      this._createCachedState();
    }
  }
  _createCachedState() {
    const labelLengths = [];
    const { leadingLineContent, characterCountDelta } = this._lineContext;
    let word = "";
    let wordLow = "";
    const source = this._refilterKind === 1 /* All */ ? this._items : this._filteredItems;
    const target = [];
    const scoreFn = !this._options.filterGraceful || source.length > 2e3 ? fuzzyScore : fuzzyScoreGracefulAggressive;
    for (let i = 0; i < source.length; i++) {
      const item = source[i];
      if (item.isInvalid) {
        continue;
      }
      const overwriteBefore = item.completion.replacementRange ? item.completion.replacementRange[1] - item.completion.replacementRange[0] : 0;
      const wordLen = overwriteBefore + characterCountDelta;
      if (word.length !== wordLen) {
        word = wordLen === 0 ? "" : leadingLineContent.slice(-wordLen);
        wordLow = word.toLowerCase();
      }
      item.word = word;
      if (wordLen === 0) {
        item.score = FuzzyScore.Default;
      } else {
        let wordPos = 0;
        while (wordPos < overwriteBefore) {
          const ch = word.charCodeAt(wordPos);
          if (ch === CharCode.Space || ch === CharCode.Tab) {
            wordPos += 1;
          } else {
            break;
          }
        }
        if (wordPos >= wordLen) {
          item.score = FuzzyScore.Default;
        } else {
          const match = scoreFn(word, wordLow, wordPos, item.textLabel, item.labelLow, 0, this._fuzzyScoreOptions);
          if (!match && word !== "") {
            continue;
          }
          item.score = match || FuzzyScore.Default;
        }
      }
      item.idx = i;
      target.push(item);
      labelLengths.push(item.textLabel.length);
    }
    this._filteredItems = target.sort(this._rawCompareFn?.bind(void 0, leadingLineContent));
    this._refilterKind = 0 /* Nothing */;
    this._stats = {
      pLabelLen: labelLengths.length ? quickSelect(labelLengths.length - 0.85, labelLengths, (a, b) => a - b) : 0
    };
  }
}
export {
  LineContext,
  SimpleCompletionModel
};
