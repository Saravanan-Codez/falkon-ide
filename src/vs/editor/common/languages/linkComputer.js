import { CharCode } from "../../../base/common/charCode.js";
import { CharacterClassifier } from "../core/characterClassifier.js";
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Invalid"] = 0] = "Invalid";
  State2[State2["Start"] = 1] = "Start";
  State2[State2["H"] = 2] = "H";
  State2[State2["HT"] = 3] = "HT";
  State2[State2["HTT"] = 4] = "HTT";
  State2[State2["HTTP"] = 5] = "HTTP";
  State2[State2["F"] = 6] = "F";
  State2[State2["FI"] = 7] = "FI";
  State2[State2["FIL"] = 8] = "FIL";
  State2[State2["BeforeColon"] = 9] = "BeforeColon";
  State2[State2["AfterColon"] = 10] = "AfterColon";
  State2[State2["AlmostThere"] = 11] = "AlmostThere";
  State2[State2["End"] = 12] = "End";
  State2[State2["Accept"] = 13] = "Accept";
  State2[State2["LastKnownState"] = 14] = "LastKnownState";
  return State2;
})(State || {});
class Uint8Matrix {
  constructor(rows, cols, defaultValue) {
    const data = new Uint8Array(rows * cols);
    for (let i = 0, len = rows * cols; i < len; i++) {
      data[i] = defaultValue;
    }
    this._data = data;
    this.rows = rows;
    this.cols = cols;
  }
  get(row, col) {
    return this._data[row * this.cols + col];
  }
  set(row, col, value) {
    this._data[row * this.cols + col] = value;
  }
}
class StateMachine {
  constructor(edges) {
    let maxCharCode = 0;
    let maxState = 0 /* Invalid */;
    for (let i = 0, len = edges.length; i < len; i++) {
      const [from, chCode, to] = edges[i];
      if (chCode > maxCharCode) {
        maxCharCode = chCode;
      }
      if (from > maxState) {
        maxState = from;
      }
      if (to > maxState) {
        maxState = to;
      }
    }
    maxCharCode++;
    maxState++;
    const states = new Uint8Matrix(maxState, maxCharCode, 0 /* Invalid */);
    for (let i = 0, len = edges.length; i < len; i++) {
      const [from, chCode, to] = edges[i];
      states.set(from, chCode, to);
    }
    this._states = states;
    this._maxCharCode = maxCharCode;
  }
  nextState(currentState, chCode) {
    if (chCode < 0 || chCode >= this._maxCharCode) {
      return 0 /* Invalid */;
    }
    return this._states.get(currentState, chCode);
  }
}
let _stateMachine = null;
function getStateMachine() {
  if (_stateMachine === null) {
    _stateMachine = new StateMachine([
      [1 /* Start */, CharCode.h, 2 /* H */],
      [1 /* Start */, CharCode.H, 2 /* H */],
      [1 /* Start */, CharCode.f, 6 /* F */],
      [1 /* Start */, CharCode.F, 6 /* F */],
      [2 /* H */, CharCode.t, 3 /* HT */],
      [2 /* H */, CharCode.T, 3 /* HT */],
      [3 /* HT */, CharCode.t, 4 /* HTT */],
      [3 /* HT */, CharCode.T, 4 /* HTT */],
      [4 /* HTT */, CharCode.p, 5 /* HTTP */],
      [4 /* HTT */, CharCode.P, 5 /* HTTP */],
      [5 /* HTTP */, CharCode.s, 9 /* BeforeColon */],
      [5 /* HTTP */, CharCode.S, 9 /* BeforeColon */],
      [5 /* HTTP */, CharCode.Colon, 10 /* AfterColon */],
      [6 /* F */, CharCode.i, 7 /* FI */],
      [6 /* F */, CharCode.I, 7 /* FI */],
      [7 /* FI */, CharCode.l, 8 /* FIL */],
      [7 /* FI */, CharCode.L, 8 /* FIL */],
      [8 /* FIL */, CharCode.e, 9 /* BeforeColon */],
      [8 /* FIL */, CharCode.E, 9 /* BeforeColon */],
      [9 /* BeforeColon */, CharCode.Colon, 10 /* AfterColon */],
      [10 /* AfterColon */, CharCode.Slash, 11 /* AlmostThere */],
      [11 /* AlmostThere */, CharCode.Slash, 12 /* End */]
    ]);
  }
  return _stateMachine;
}
var CharacterClass = /* @__PURE__ */ ((CharacterClass2) => {
  CharacterClass2[CharacterClass2["None"] = 0] = "None";
  CharacterClass2[CharacterClass2["ForceTermination"] = 1] = "ForceTermination";
  CharacterClass2[CharacterClass2["CannotEndIn"] = 2] = "CannotEndIn";
  return CharacterClass2;
})(CharacterClass || {});
let _classifier = null;
function getClassifier() {
  if (_classifier === null) {
    _classifier = new CharacterClassifier(0 /* None */);
    const FORCE_TERMINATION_CHARACTERS = ` 	<>'"\u3001\u3002\uFF61\uFF64\uFF0C\uFF0E\uFF1A\uFF1B\u2018\u3008\u300C\u300E\u3014\uFF08\uFF3B\uFF5B\uFF62\uFF63\uFF5D\uFF3D\uFF09\u3015\u300F\u300D\u3009\u2019\uFF40\uFF5E\u2026|`;
    for (let i = 0; i < FORCE_TERMINATION_CHARACTERS.length; i++) {
      _classifier.set(FORCE_TERMINATION_CHARACTERS.charCodeAt(i), 1 /* ForceTermination */);
    }
    const CANNOT_END_WITH_CHARACTERS = ".,;:";
    for (let i = 0; i < CANNOT_END_WITH_CHARACTERS.length; i++) {
      _classifier.set(CANNOT_END_WITH_CHARACTERS.charCodeAt(i), 2 /* CannotEndIn */);
    }
  }
  return _classifier;
}
class LinkComputer {
  static _createLink(classifier, line, lineNumber, linkBeginIndex, linkEndIndex) {
    let lastIncludedCharIndex = linkEndIndex - 1;
    do {
      const chCode = line.charCodeAt(lastIncludedCharIndex);
      const chClass = classifier.get(chCode);
      if (chClass !== 2 /* CannotEndIn */) {
        break;
      }
      lastIncludedCharIndex--;
    } while (lastIncludedCharIndex > linkBeginIndex);
    if (linkBeginIndex > 0) {
      const charCodeBeforeLink = line.charCodeAt(linkBeginIndex - 1);
      const lastCharCodeInLink = line.charCodeAt(lastIncludedCharIndex);
      if (charCodeBeforeLink === CharCode.OpenParen && lastCharCodeInLink === CharCode.CloseParen || charCodeBeforeLink === CharCode.OpenSquareBracket && lastCharCodeInLink === CharCode.CloseSquareBracket || charCodeBeforeLink === CharCode.OpenCurlyBrace && lastCharCodeInLink === CharCode.CloseCurlyBrace) {
        lastIncludedCharIndex--;
      }
    }
    return {
      range: {
        startLineNumber: lineNumber,
        startColumn: linkBeginIndex + 1,
        endLineNumber: lineNumber,
        endColumn: lastIncludedCharIndex + 2
      },
      url: line.substring(linkBeginIndex, lastIncludedCharIndex + 1)
    };
  }
  static computeLinks(model, stateMachine = getStateMachine()) {
    const classifier = getClassifier();
    const result = [];
    for (let i = 1, lineCount = model.getLineCount(); i <= lineCount; i++) {
      const line = model.getLineContent(i);
      const len = line.length;
      let j = 0;
      let linkBeginIndex = 0;
      let linkBeginChCode = 0;
      let state = 1 /* Start */;
      let hasOpenParens = false;
      let hasOpenSquareBracket = false;
      let inSquareBrackets = false;
      let hasOpenCurlyBracket = false;
      while (j < len) {
        let resetStateMachine = false;
        const chCode = line.charCodeAt(j);
        if (state === 13 /* Accept */) {
          let chClass;
          switch (chCode) {
            case CharCode.OpenParen:
              hasOpenParens = true;
              chClass = 0 /* None */;
              break;
            case CharCode.CloseParen:
              chClass = hasOpenParens ? 0 /* None */ : 1 /* ForceTermination */;
              break;
            case CharCode.OpenSquareBracket:
              inSquareBrackets = true;
              hasOpenSquareBracket = true;
              chClass = 0 /* None */;
              break;
            case CharCode.CloseSquareBracket:
              inSquareBrackets = false;
              chClass = hasOpenSquareBracket ? 0 /* None */ : 1 /* ForceTermination */;
              break;
            case CharCode.OpenCurlyBrace:
              hasOpenCurlyBracket = true;
              chClass = 0 /* None */;
              break;
            case CharCode.CloseCurlyBrace:
              chClass = hasOpenCurlyBracket ? 0 /* None */ : 1 /* ForceTermination */;
              break;
            // The following three rules make it that ' or " or ` are allowed inside links
            // only if the link is wrapped by some other quote character
            case CharCode.SingleQuote:
            case CharCode.DoubleQuote:
            case CharCode.BackTick:
              if (linkBeginChCode === chCode) {
                chClass = 1 /* ForceTermination */;
              } else if (linkBeginChCode === CharCode.SingleQuote || linkBeginChCode === CharCode.DoubleQuote || linkBeginChCode === CharCode.BackTick) {
                chClass = 0 /* None */;
              } else {
                chClass = 1 /* ForceTermination */;
              }
              break;
            case CharCode.Asterisk:
              chClass = linkBeginChCode === CharCode.Asterisk ? 1 /* ForceTermination */ : 0 /* None */;
              break;
            case CharCode.Space:
              chClass = inSquareBrackets ? 0 /* None */ : 1 /* ForceTermination */;
              break;
            default:
              chClass = classifier.get(chCode);
          }
          if (chClass === 1 /* ForceTermination */) {
            result.push(LinkComputer._createLink(classifier, line, i, linkBeginIndex, j));
            resetStateMachine = true;
          }
        } else if (state === 12 /* End */) {
          let chClass;
          if (chCode === CharCode.OpenSquareBracket) {
            hasOpenSquareBracket = true;
            chClass = 0 /* None */;
          } else {
            chClass = classifier.get(chCode);
          }
          if (chClass === 1 /* ForceTermination */) {
            resetStateMachine = true;
          } else {
            state = 13 /* Accept */;
          }
        } else {
          state = stateMachine.nextState(state, chCode);
          if (state === 0 /* Invalid */) {
            resetStateMachine = true;
          }
        }
        if (resetStateMachine) {
          state = 1 /* Start */;
          hasOpenParens = false;
          hasOpenSquareBracket = false;
          hasOpenCurlyBracket = false;
          linkBeginIndex = j + 1;
          linkBeginChCode = chCode;
        }
        j++;
      }
      if (state === 13 /* Accept */) {
        result.push(LinkComputer._createLink(classifier, line, i, linkBeginIndex, len));
      }
    }
    return result;
  }
}
function computeLinks(model) {
  if (!model || typeof model.getLineCount !== "function" || typeof model.getLineContent !== "function") {
    return [];
  }
  return LinkComputer.computeLinks(model);
}
export {
  LinkComputer,
  State,
  StateMachine,
  computeLinks
};
