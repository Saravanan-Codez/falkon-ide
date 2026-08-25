var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { FontStyle, MetadataConsts, TokenMetadata } from "../encodedTokenAttributes.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { ILogService, LogLevel } from "../../../platform/log/common/log.js";
import { SparseMultilineTokens } from "../tokens/sparseMultilineTokens.js";
import { ILanguageService } from "../languages/language.js";
var SemanticTokensProviderStylingConstants = /* @__PURE__ */ ((SemanticTokensProviderStylingConstants2) => {
  SemanticTokensProviderStylingConstants2[SemanticTokensProviderStylingConstants2["NO_STYLING"] = 2147483647] = "NO_STYLING";
  return SemanticTokensProviderStylingConstants2;
})(SemanticTokensProviderStylingConstants || {});
const ENABLE_TRACE = false;
let SemanticTokensProviderStyling = class {
  constructor(_legend, _themeService, _languageService, _logService) {
    this._legend = _legend;
    this._themeService = _themeService;
    this._languageService = _languageService;
    this._logService = _logService;
    this._hasWarnedOverlappingTokens = false;
    this._hasWarnedInvalidLengthTokens = false;
    this._hasWarnedInvalidEditStart = false;
    this._hashTable = new HashTable();
  }
  getMetadata(tokenTypeIndex, tokenModifierSet, languageId) {
    const encodedLanguageId = this._languageService.languageIdCodec.encodeLanguageId(languageId);
    const entry = this._hashTable.get(tokenTypeIndex, tokenModifierSet, encodedLanguageId);
    let metadata;
    if (entry) {
      metadata = entry.metadata;
      if (ENABLE_TRACE && this._logService.getLevel() === LogLevel.Trace) {
        this._logService.trace(`SemanticTokensProviderStyling [CACHED] ${tokenTypeIndex} / ${tokenModifierSet}: foreground ${TokenMetadata.getForeground(metadata)}, fontStyle ${TokenMetadata.getFontStyle(metadata).toString(2)}`);
      }
    } else {
      let tokenType = this._legend.tokenTypes[tokenTypeIndex];
      const tokenModifiers = [];
      if (tokenType) {
        let modifierSet = tokenModifierSet;
        for (let modifierIndex = 0; modifierSet > 0 && modifierIndex < this._legend.tokenModifiers.length; modifierIndex++) {
          if (modifierSet & 1) {
            tokenModifiers.push(this._legend.tokenModifiers[modifierIndex]);
          }
          modifierSet = modifierSet >> 1;
        }
        if (ENABLE_TRACE && modifierSet > 0 && this._logService.getLevel() === LogLevel.Trace) {
          this._logService.trace(`SemanticTokensProviderStyling: unknown token modifier index: ${tokenModifierSet.toString(2)} for legend: ${JSON.stringify(this._legend.tokenModifiers)}`);
          tokenModifiers.push("not-in-legend");
        }
        const tokenStyle = this._themeService.getColorTheme().getTokenStyleMetadata(tokenType, tokenModifiers, languageId);
        if (typeof tokenStyle === "undefined") {
          metadata = 2147483647 /* NO_STYLING */;
        } else {
          metadata = 0;
          if (typeof tokenStyle.italic !== "undefined") {
            const italicBit = (tokenStyle.italic ? FontStyle.Italic : 0) << MetadataConsts.FONT_STYLE_OFFSET;
            metadata |= italicBit | MetadataConsts.SEMANTIC_USE_ITALIC;
          }
          if (typeof tokenStyle.bold !== "undefined") {
            const boldBit = (tokenStyle.bold ? FontStyle.Bold : 0) << MetadataConsts.FONT_STYLE_OFFSET;
            metadata |= boldBit | MetadataConsts.SEMANTIC_USE_BOLD;
          }
          if (typeof tokenStyle.underline !== "undefined") {
            const underlineBit = (tokenStyle.underline ? FontStyle.Underline : 0) << MetadataConsts.FONT_STYLE_OFFSET;
            metadata |= underlineBit | MetadataConsts.SEMANTIC_USE_UNDERLINE;
          }
          if (typeof tokenStyle.strikethrough !== "undefined") {
            const strikethroughBit = (tokenStyle.strikethrough ? FontStyle.Strikethrough : 0) << MetadataConsts.FONT_STYLE_OFFSET;
            metadata |= strikethroughBit | MetadataConsts.SEMANTIC_USE_STRIKETHROUGH;
          }
          if (tokenStyle.foreground) {
            const foregroundBits = tokenStyle.foreground << MetadataConsts.FOREGROUND_OFFSET;
            metadata |= foregroundBits | MetadataConsts.SEMANTIC_USE_FOREGROUND;
          }
          if (metadata === 0) {
            metadata = 2147483647 /* NO_STYLING */;
          }
        }
      } else {
        if (ENABLE_TRACE && this._logService.getLevel() === LogLevel.Trace) {
          this._logService.trace(`SemanticTokensProviderStyling: unknown token type index: ${tokenTypeIndex} for legend: ${JSON.stringify(this._legend.tokenTypes)}`);
        }
        metadata = 2147483647 /* NO_STYLING */;
        tokenType = "not-in-legend";
      }
      this._hashTable.add(tokenTypeIndex, tokenModifierSet, encodedLanguageId, metadata);
      if (ENABLE_TRACE && this._logService.getLevel() === LogLevel.Trace) {
        this._logService.trace(`SemanticTokensProviderStyling ${tokenTypeIndex} (${tokenType}) / ${tokenModifierSet} (${tokenModifiers.join(" ")}): foreground ${TokenMetadata.getForeground(metadata)}, fontStyle ${TokenMetadata.getFontStyle(metadata).toString(2)}`);
      }
    }
    return metadata;
  }
  warnOverlappingSemanticTokens(lineNumber, startColumn) {
    if (!this._hasWarnedOverlappingTokens) {
      this._hasWarnedOverlappingTokens = true;
      this._logService.warn(`Overlapping semantic tokens detected at lineNumber ${lineNumber}, column ${startColumn}`);
    }
  }
  warnInvalidLengthSemanticTokens(lineNumber, startColumn) {
    if (!this._hasWarnedInvalidLengthTokens) {
      this._hasWarnedInvalidLengthTokens = true;
      this._logService.warn(`Semantic token with invalid length detected at lineNumber ${lineNumber}, column ${startColumn}`);
    }
  }
  warnInvalidEditStart(previousResultId, resultId, editIndex, editStart, maxExpectedStart) {
    if (!this._hasWarnedInvalidEditStart) {
      this._hasWarnedInvalidEditStart = true;
      this._logService.warn(`Invalid semantic tokens edit detected (previousResultId: ${previousResultId}, resultId: ${resultId}) at edit #${editIndex}: The provided start offset ${editStart} is outside the previous data (length ${maxExpectedStart}).`);
    }
  }
};
SemanticTokensProviderStyling = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, ILogService)
], SemanticTokensProviderStyling);
var SemanticColoringConstants = /* @__PURE__ */ ((SemanticColoringConstants2) => {
  SemanticColoringConstants2[SemanticColoringConstants2["DesiredTokensPerArea"] = 400] = "DesiredTokensPerArea";
  SemanticColoringConstants2[SemanticColoringConstants2["DesiredMaxAreas"] = 1024] = "DesiredMaxAreas";
  return SemanticColoringConstants2;
})(SemanticColoringConstants || {});
function toMultilineTokens2(tokens, styling, languageId) {
  const srcData = tokens.data;
  const tokenCount = tokens.data.length / 5 | 0;
  const tokensPerArea = Math.max(Math.ceil(tokenCount / 1024 /* DesiredMaxAreas */), 400 /* DesiredTokensPerArea */);
  const result = [];
  let tokenIndex = 0;
  let lastLineNumber = 1;
  let lastStartCharacter = 0;
  while (tokenIndex < tokenCount) {
    const tokenStartIndex = tokenIndex;
    let tokenEndIndex = Math.min(tokenStartIndex + tokensPerArea, tokenCount);
    if (tokenEndIndex < tokenCount) {
      let smallTokenEndIndex = tokenEndIndex;
      while (smallTokenEndIndex - 1 > tokenStartIndex && srcData[5 * smallTokenEndIndex] === 0) {
        smallTokenEndIndex--;
      }
      if (smallTokenEndIndex - 1 === tokenStartIndex) {
        let bigTokenEndIndex = tokenEndIndex;
        while (bigTokenEndIndex + 1 < tokenCount && srcData[5 * bigTokenEndIndex] === 0) {
          bigTokenEndIndex++;
        }
        tokenEndIndex = bigTokenEndIndex;
      } else {
        tokenEndIndex = smallTokenEndIndex;
      }
    }
    let destData = new Uint32Array((tokenEndIndex - tokenStartIndex) * 4);
    let destOffset = 0;
    let areaLine = 0;
    let prevLineNumber = 0;
    let prevEndCharacter = 0;
    while (tokenIndex < tokenEndIndex) {
      const srcOffset = 5 * tokenIndex;
      const deltaLine = srcData[srcOffset];
      const deltaCharacter = srcData[srcOffset + 1];
      const lineNumber = lastLineNumber + deltaLine | 0;
      const startCharacter = deltaLine === 0 ? lastStartCharacter + deltaCharacter | 0 : deltaCharacter;
      const length = srcData[srcOffset + 2];
      const endCharacter = startCharacter + length | 0;
      const tokenTypeIndex = srcData[srcOffset + 3];
      const tokenModifierSet = srcData[srcOffset + 4];
      if (endCharacter <= startCharacter) {
        styling.warnInvalidLengthSemanticTokens(lineNumber, startCharacter + 1);
      } else if (prevLineNumber === lineNumber && prevEndCharacter > startCharacter) {
        styling.warnOverlappingSemanticTokens(lineNumber, startCharacter + 1);
      } else {
        const metadata = styling.getMetadata(tokenTypeIndex, tokenModifierSet, languageId);
        if (metadata !== 2147483647 /* NO_STYLING */) {
          if (areaLine === 0) {
            areaLine = lineNumber;
          }
          destData[destOffset] = lineNumber - areaLine;
          destData[destOffset + 1] = startCharacter;
          destData[destOffset + 2] = endCharacter;
          destData[destOffset + 3] = metadata;
          destOffset += 4;
          prevLineNumber = lineNumber;
          prevEndCharacter = endCharacter;
        }
      }
      lastLineNumber = lineNumber;
      lastStartCharacter = startCharacter;
      tokenIndex++;
    }
    if (destOffset !== destData.length) {
      destData = destData.subarray(0, destOffset);
    }
    const tokens2 = SparseMultilineTokens.create(areaLine, destData);
    result.push(tokens2);
  }
  return result;
}
class HashTableEntry {
  constructor(tokenTypeIndex, tokenModifierSet, languageId, metadata) {
    this.tokenTypeIndex = tokenTypeIndex;
    this.tokenModifierSet = tokenModifierSet;
    this.languageId = languageId;
    this.metadata = metadata;
    this.next = null;
  }
}
class HashTable {
  static {
    this._SIZES = [3, 7, 13, 31, 61, 127, 251, 509, 1021, 2039, 4093, 8191, 16381, 32749, 65521, 131071, 262139, 524287, 1048573, 2097143];
  }
  constructor() {
    this._elementsCount = 0;
    this._currentLengthIndex = 0;
    this._currentLength = HashTable._SIZES[this._currentLengthIndex];
    this._growCount = Math.round(this._currentLengthIndex + 1 < HashTable._SIZES.length ? 2 / 3 * this._currentLength : 0);
    this._elements = [];
    HashTable._nullOutEntries(this._elements, this._currentLength);
  }
  static _nullOutEntries(entries, length) {
    for (let i = 0; i < length; i++) {
      entries[i] = null;
    }
  }
  _hash2(n1, n2) {
    return (n1 << 5) - n1 + n2 | 0;
  }
  _hashFunc(tokenTypeIndex, tokenModifierSet, languageId) {
    return this._hash2(this._hash2(tokenTypeIndex, tokenModifierSet), languageId) % this._currentLength;
  }
  get(tokenTypeIndex, tokenModifierSet, languageId) {
    const hash = this._hashFunc(tokenTypeIndex, tokenModifierSet, languageId);
    let p = this._elements[hash];
    while (p) {
      if (p.tokenTypeIndex === tokenTypeIndex && p.tokenModifierSet === tokenModifierSet && p.languageId === languageId) {
        return p;
      }
      p = p.next;
    }
    return null;
  }
  add(tokenTypeIndex, tokenModifierSet, languageId, metadata) {
    this._elementsCount++;
    if (this._growCount !== 0 && this._elementsCount >= this._growCount) {
      const oldElements = this._elements;
      this._currentLengthIndex++;
      this._currentLength = HashTable._SIZES[this._currentLengthIndex];
      this._growCount = Math.round(this._currentLengthIndex + 1 < HashTable._SIZES.length ? 2 / 3 * this._currentLength : 0);
      this._elements = [];
      HashTable._nullOutEntries(this._elements, this._currentLength);
      for (const first of oldElements) {
        let p = first;
        while (p) {
          const oldNext = p.next;
          p.next = null;
          this._add(p);
          p = oldNext;
        }
      }
    }
    this._add(new HashTableEntry(tokenTypeIndex, tokenModifierSet, languageId, metadata));
  }
  _add(element) {
    const hash = this._hashFunc(element.tokenTypeIndex, element.tokenModifierSet, element.languageId);
    element.next = this._elements[hash];
    this._elements[hash] = element;
  }
}
export {
  SemanticTokensProviderStyling,
  toMultilineTokens2
};
