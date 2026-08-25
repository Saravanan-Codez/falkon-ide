var ScanError = /* @__PURE__ */ ((ScanError2) => {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
  return ScanError2;
})(ScanError || {});
var SyntaxKind = /* @__PURE__ */ ((SyntaxKind2) => {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
  return SyntaxKind2;
})(SyntaxKind || {});
var ParseErrorCode = /* @__PURE__ */ ((ParseErrorCode2) => {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
  return ParseErrorCode2;
})(ParseErrorCode || {});
var ParseOptions;
((ParseOptions2) => {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: true
  };
})(ParseOptions || (ParseOptions = {}));
function createScanner(text, ignoreTrivia = false) {
  let pos = 0;
  const len = text.length;
  let value = "";
  let tokenOffset = 0;
  let token = 16 /* Unknown */;
  let scanError = 0 /* None */;
  function scanHexDigits(count) {
    let digits = 0;
    let hexValue = 0;
    while (digits < count) {
      const ch = text.charCodeAt(pos);
      if (ch >= 48 /* _0 */ && ch <= 57 /* _9 */) {
        hexValue = hexValue * 16 + ch - 48 /* _0 */;
      } else if (ch >= 65 /* A */ && ch <= 70 /* F */) {
        hexValue = hexValue * 16 + ch - 65 /* A */ + 10;
      } else if (ch >= 97 /* a */ && ch <= 102 /* f */) {
        hexValue = hexValue * 16 + ch - 97 /* a */ + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      hexValue = -1;
    }
    return hexValue;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16 /* Unknown */;
    scanError = 0 /* None */;
  }
  function scanNumber() {
    const start = pos;
    if (text.charCodeAt(pos) === 48 /* _0 */) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46 /* dot */) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3 /* UnexpectedEndOfNumber */;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 /* E */ || text.charCodeAt(pos) === 101 /* e */)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 /* plus */ || text.charCodeAt(pos) === 45 /* minus */) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3 /* UnexpectedEndOfNumber */;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2 /* UnexpectedEndOfString */;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34 /* doubleQuote */) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92 /* backslash */) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2 /* UnexpectedEndOfString */;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34 /* doubleQuote */:
            result += '"';
            break;
          case 92 /* backslash */:
            result += "\\";
            break;
          case 47 /* slash */:
            result += "/";
            break;
          case 98 /* b */:
            result += "\b";
            break;
          case 102 /* f */:
            result += "\f";
            break;
          case 110 /* n */:
            result += "\n";
            break;
          case 114 /* r */:
            result += "\r";
            break;
          case 116 /* t */:
            result += "	";
            break;
          case 117 /* u */: {
            const ch3 = scanHexDigits(4);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4 /* InvalidUnicode */;
            }
            break;
          }
          default:
            scanError = 5 /* InvalidEscapeCharacter */;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2 /* UnexpectedEndOfString */;
          break;
        } else {
          scanError = 6 /* InvalidCharacter */;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0 /* None */;
    tokenOffset = pos;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17 /* EOF */;
    }
    let code = text.charCodeAt(pos);
    if (isWhitespace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhitespace(code));
      return token = 15 /* Trivia */;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 /* carriageReturn */ && text.charCodeAt(pos) === 10 /* lineFeed */) {
        pos++;
        value += "\n";
      }
      return token = 14 /* LineBreakTrivia */;
    }
    switch (code) {
      // tokens: []{}:,
      case 123 /* openBrace */:
        pos++;
        return token = 1 /* OpenBraceToken */;
      case 125 /* closeBrace */:
        pos++;
        return token = 2 /* CloseBraceToken */;
      case 91 /* openBracket */:
        pos++;
        return token = 3 /* OpenBracketToken */;
      case 93 /* closeBracket */:
        pos++;
        return token = 4 /* CloseBracketToken */;
      case 58 /* colon */:
        pos++;
        return token = 6 /* ColonToken */;
      case 44 /* comma */:
        pos++;
        return token = 5 /* CommaToken */;
      // strings
      case 34 /* doubleQuote */:
        pos++;
        value = scanString();
        return token = 10 /* StringLiteral */;
      // comments
      case 47 /* slash */: {
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47 /* slash */) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12 /* LineCommentTrivia */;
        }
        if (text.charCodeAt(pos + 1) === 42 /* asterisk */) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 /* asterisk */ && text.charCodeAt(pos + 1) === 47 /* slash */) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
          }
          if (!commentClosed) {
            pos++;
            scanError = 1 /* UnexpectedEndOfComment */;
          }
          value = text.substring(start, pos);
          return token = 13 /* BlockCommentTrivia */;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16 /* Unknown */;
      }
      // numbers
      case 45 /* minus */:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = 16 /* Unknown */;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48 /* _0 */:
      case 49 /* _1 */:
      case 50 /* _2 */:
      case 51 /* _3 */:
      case 52 /* _4 */:
      case 53 /* _5 */:
      case 54 /* _6 */:
      case 55 /* _7 */:
      case 56 /* _8 */:
      case 57 /* _9 */:
        value += scanNumber();
        return token = 11 /* NumericLiteral */;
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8 /* TrueKeyword */;
            case "false":
              return token = 9 /* FalseKeyword */;
            case "null":
              return token = 7 /* NullKeyword */;
          }
          return token = 16 /* Unknown */;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16 /* Unknown */;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhitespace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125 /* closeBrace */:
      case 93 /* closeBracket */:
      case 123 /* openBrace */:
      case 91 /* openBracket */:
      case 34 /* doubleQuote */:
      case 58 /* colon */:
      case 44 /* comma */:
      case 47 /* slash */:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 /* LineCommentTrivia */ && result <= 15 /* Trivia */);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenError: () => scanError
  };
}
function isWhitespace(ch) {
  return ch === 32 /* space */ || ch === 9 /* tab */ || ch === 11 /* verticalTab */ || ch === 12 /* formFeed */ || ch === 160 /* nonBreakingSpace */ || ch === 5760 /* ogham */ || ch >= 8192 /* enQuad */ && ch <= 8203 /* zeroWidthSpace */ || ch === 8239 /* narrowNoBreakSpace */ || ch === 8287 /* mathematicalSpace */ || ch === 12288 /* ideographicSpace */ || ch === 65279 /* byteOrderMark */;
}
function isLineBreak(ch) {
  return ch === 10 /* lineFeed */ || ch === 13 /* carriageReturn */ || ch === 8232 /* lineSeparator */ || ch === 8233 /* paragraphSeparator */;
}
function isDigit(ch) {
  return ch >= 48 /* _0 */ && ch <= 57 /* _9 */;
}
var CharacterCodes = /* @__PURE__ */ ((CharacterCodes2) => {
  CharacterCodes2[CharacterCodes2["nullCharacter"] = 0] = "nullCharacter";
  CharacterCodes2[CharacterCodes2["maxAsciiCharacter"] = 127] = "maxAsciiCharacter";
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["lineSeparator"] = 8232] = "lineSeparator";
  CharacterCodes2[CharacterCodes2["paragraphSeparator"] = 8233] = "paragraphSeparator";
  CharacterCodes2[CharacterCodes2["nextLine"] = 133] = "nextLine";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["nonBreakingSpace"] = 160] = "nonBreakingSpace";
  CharacterCodes2[CharacterCodes2["enQuad"] = 8192] = "enQuad";
  CharacterCodes2[CharacterCodes2["emQuad"] = 8193] = "emQuad";
  CharacterCodes2[CharacterCodes2["enSpace"] = 8194] = "enSpace";
  CharacterCodes2[CharacterCodes2["emSpace"] = 8195] = "emSpace";
  CharacterCodes2[CharacterCodes2["threePerEmSpace"] = 8196] = "threePerEmSpace";
  CharacterCodes2[CharacterCodes2["fourPerEmSpace"] = 8197] = "fourPerEmSpace";
  CharacterCodes2[CharacterCodes2["sixPerEmSpace"] = 8198] = "sixPerEmSpace";
  CharacterCodes2[CharacterCodes2["figureSpace"] = 8199] = "figureSpace";
  CharacterCodes2[CharacterCodes2["punctuationSpace"] = 8200] = "punctuationSpace";
  CharacterCodes2[CharacterCodes2["thinSpace"] = 8201] = "thinSpace";
  CharacterCodes2[CharacterCodes2["hairSpace"] = 8202] = "hairSpace";
  CharacterCodes2[CharacterCodes2["zeroWidthSpace"] = 8203] = "zeroWidthSpace";
  CharacterCodes2[CharacterCodes2["narrowNoBreakSpace"] = 8239] = "narrowNoBreakSpace";
  CharacterCodes2[CharacterCodes2["ideographicSpace"] = 12288] = "ideographicSpace";
  CharacterCodes2[CharacterCodes2["mathematicalSpace"] = 8287] = "mathematicalSpace";
  CharacterCodes2[CharacterCodes2["ogham"] = 5760] = "ogham";
  CharacterCodes2[CharacterCodes2["_"] = 95] = "_";
  CharacterCodes2[CharacterCodes2["$"] = 36] = "$";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["ampersand"] = 38] = "ampersand";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["at"] = 64] = "at";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["bar"] = 124] = "bar";
  CharacterCodes2[CharacterCodes2["caret"] = 94] = "caret";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["closeParen"] = 41] = "closeParen";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["equals"] = 61] = "equals";
  CharacterCodes2[CharacterCodes2["exclamation"] = 33] = "exclamation";
  CharacterCodes2[CharacterCodes2["greaterThan"] = 62] = "greaterThan";
  CharacterCodes2[CharacterCodes2["lessThan"] = 60] = "lessThan";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["openParen"] = 40] = "openParen";
  CharacterCodes2[CharacterCodes2["percent"] = 37] = "percent";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["question"] = 63] = "question";
  CharacterCodes2[CharacterCodes2["semicolon"] = 59] = "semicolon";
  CharacterCodes2[CharacterCodes2["singleQuote"] = 39] = "singleQuote";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["tilde"] = 126] = "tilde";
  CharacterCodes2[CharacterCodes2["backspace"] = 8] = "backspace";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["byteOrderMark"] = 65279] = "byteOrderMark";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
  CharacterCodes2[CharacterCodes2["verticalTab"] = 11] = "verticalTab";
  return CharacterCodes2;
})(CharacterCodes || {});
function getLocation(text, position) {
  const segments = [];
  const earlyReturnException = new Object();
  let previousNode = void 0;
  const previousNodeInst = {
    value: {},
    offset: 0,
    length: 0,
    type: "object",
    parent: void 0
  };
  let isAtPropertyKey = false;
  function setPreviousNode(value, offset, length, type) {
    previousNodeInst.value = value;
    previousNodeInst.offset = offset;
    previousNodeInst.length = length;
    previousNodeInst.type = type;
    previousNodeInst.colonOffset = void 0;
    previousNode = previousNodeInst;
  }
  try {
    visit(text, {
      onObjectBegin: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        isAtPropertyKey = position > offset;
        segments.push("");
      },
      onObjectProperty: (name, offset, length) => {
        if (position < offset) {
          throw earlyReturnException;
        }
        setPreviousNode(name, offset, length, "property");
        segments[segments.length - 1] = name;
        if (position <= offset + length) {
          throw earlyReturnException;
        }
      },
      onObjectEnd: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.pop();
      },
      onArrayBegin: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.push(0);
      },
      onArrayEnd: (offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        previousNode = void 0;
        segments.pop();
      },
      onLiteralValue: (value, offset, length) => {
        if (position < offset) {
          throw earlyReturnException;
        }
        setPreviousNode(value, offset, length, getNodeType(value));
        if (position <= offset + length) {
          throw earlyReturnException;
        }
      },
      onSeparator: (sep, offset, length) => {
        if (position <= offset) {
          throw earlyReturnException;
        }
        if (sep === ":" && previousNode && previousNode.type === "property") {
          previousNode.colonOffset = offset;
          isAtPropertyKey = false;
          previousNode = void 0;
        } else if (sep === ",") {
          const last = segments[segments.length - 1];
          if (typeof last === "number") {
            segments[segments.length - 1] = last + 1;
          } else {
            isAtPropertyKey = true;
            segments[segments.length - 1] = "";
          }
          previousNode = void 0;
        }
      }
    });
  } catch (e) {
    if (e !== earlyReturnException) {
      throw e;
    }
  }
  return {
    path: segments,
    previousNode,
    isAtPropertyKey,
    matches: (pattern) => {
      let k = 0;
      for (let i = 0; k < pattern.length && i < segments.length; i++) {
        if (pattern[k] === segments[i] || pattern[k] === "*") {
          k++;
        } else if (pattern[k] !== "**") {
          return false;
        }
      }
      return k === pattern.length;
    }
  };
}
function parse(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: () => {
      const object = {};
      onValue(object);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: (name) => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  return currentParent[0];
}
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === "property") {
        if (sep === ":") {
          currentParent.colonOffset = offset;
        } else if (sep === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (const segment of path) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function getNodePath(node) {
  if (!node.parent || !node.parent.children) {
    return [];
  }
  const path = getNodePath(node.parent);
  if (node.parent.type === "property") {
    const key = node.parent.children[0].value;
    path.push(key);
  } else if (node.parent.type === "array") {
    const index = node.parent.children.indexOf(node);
    if (index !== -1) {
      path.push(index);
    }
  }
  return path;
}
function getNodeValue(node) {
  switch (node.type) {
    case "array":
      return node.children.map(getNodeValue);
    case "object": {
      const obj = /* @__PURE__ */ Object.create(null);
      for (const prop of node.children) {
        const valueNode = prop.children[1];
        if (valueNode) {
          obj[prop.children[0].value] = getNodeValue(valueNode);
        }
      }
      return obj;
    }
    case "null":
    case "string":
    case "number":
    case "boolean":
      return node.value;
    default:
      return void 0;
  }
}
function contains(node, offset, includeRightBound = false) {
  return offset >= node.offset && offset < node.offset + node.length || includeRightBound && offset === node.offset + node.length;
}
function findNodeAtOffset(node, offset, includeRightBound = false) {
  if (contains(node, offset, includeRightBound)) {
    const children = node.children;
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length && children[i].offset <= offset; i++) {
        const item = findNodeAtOffset(children[i], offset, includeRightBound);
        if (item) {
          return item;
        }
      }
    }
    return node;
  }
  return void 0;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength()) : () => true;
  }
  const onObjectBegin = toNoArgVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisit(visitor.onObjectProperty), onObjectEnd = toNoArgVisit(visitor.onObjectEnd), onArrayBegin = toNoArgVisit(visitor.onArrayBegin), onArrayEnd = toNoArgVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisit(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4 /* InvalidUnicode */:
          handleError(14 /* InvalidUnicode */);
          break;
        case 5 /* InvalidEscapeCharacter */:
          handleError(15 /* InvalidEscapeCharacter */);
          break;
        case 3 /* UnexpectedEndOfNumber */:
          handleError(13 /* UnexpectedEndOfNumber */);
          break;
        case 1 /* UnexpectedEndOfComment */:
          if (!disallowComments) {
            handleError(11 /* UnexpectedEndOfComment */);
          }
          break;
        case 2 /* UnexpectedEndOfString */:
          handleError(12 /* UnexpectedEndOfString */);
          break;
        case 6 /* InvalidCharacter */:
          handleError(16 /* InvalidCharacter */);
          break;
      }
      switch (token) {
        case 12 /* LineCommentTrivia */:
        case 13 /* BlockCommentTrivia */:
          if (disallowComments) {
            handleError(10 /* InvalidCommentToken */);
          } else {
            onComment();
          }
          break;
        case 16 /* Unknown */:
          handleError(1 /* InvalidSymbol */);
          break;
        case 15 /* Trivia */:
        case 14 /* LineBreakTrivia */:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17 /* EOF */) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11 /* NumericLiteral */: {
        let value = 0;
        try {
          value = JSON.parse(_scanner.getTokenValue());
          if (typeof value !== "number") {
            handleError(2 /* InvalidNumberFormat */);
            value = 0;
          }
        } catch (e) {
          handleError(2 /* InvalidNumberFormat */);
        }
        onLiteralValue(value);
        break;
      }
      case 7 /* NullKeyword */:
        onLiteralValue(null);
        break;
      case 8 /* TrueKeyword */:
        onLiteralValue(true);
        break;
      case 9 /* FalseKeyword */:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10 /* StringLiteral */) {
      handleError(3 /* PropertyNameExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6 /* ColonToken */) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4 /* ValueExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
      }
    } else {
      handleError(5 /* ColonExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
    }
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 /* CloseBraceToken */ && _scanner.getToken() !== 17 /* EOF */) {
      if (_scanner.getToken() === 5 /* CommaToken */) {
        if (!needsComma) {
          handleError(4 /* ValueExpected */, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 /* CloseBraceToken */ && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6 /* CommaExpected */, [], []);
      }
      if (!parseProperty()) {
        handleError(4 /* ValueExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2 /* CloseBraceToken */) {
      handleError(7 /* CloseBraceExpected */, [2 /* CloseBraceToken */], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 4 /* CloseBracketToken */ && _scanner.getToken() !== 17 /* EOF */) {
      if (_scanner.getToken() === 5 /* CommaToken */) {
        if (!needsComma) {
          handleError(4 /* ValueExpected */, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 /* CloseBracketToken */ && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6 /* CommaExpected */, [], []);
      }
      if (!parseValue()) {
        handleError(4 /* ValueExpected */, [], [4 /* CloseBracketToken */, 5 /* CommaToken */]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (_scanner.getToken() !== 4 /* CloseBracketToken */) {
      handleError(8 /* CloseBracketExpected */, [4 /* CloseBracketToken */], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3 /* OpenBracketToken */:
        return parseArray();
      case 1 /* OpenBraceToken */:
        return parseObject();
      case 10 /* StringLiteral */:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17 /* EOF */) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4 /* ValueExpected */, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4 /* ValueExpected */, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17 /* EOF */) {
    handleError(9 /* EndOfFileExpected */, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}
export {
  ParseErrorCode,
  ParseOptions,
  ScanError,
  SyntaxKind,
  contains,
  createScanner,
  findNodeAtLocation,
  findNodeAtOffset,
  getLocation,
  getNodePath,
  getNodeType,
  getNodeValue,
  parse,
  parseTree,
  visit
};
