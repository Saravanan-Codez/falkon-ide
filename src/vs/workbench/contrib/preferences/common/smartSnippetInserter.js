import { createScanner as createJSONScanner, SyntaxKind as JSONSyntaxKind } from "../../../../base/common/json.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
class SmartSnippetInserter {
  static hasOpenBrace(scanner) {
    while (scanner.scan() !== JSONSyntaxKind.EOF) {
      const kind = scanner.getToken();
      if (kind === JSONSyntaxKind.OpenBraceToken) {
        return true;
      }
    }
    return false;
  }
  static offsetToPosition(model, offset) {
    let offsetBeforeLine = 0;
    const eolLength = model.getEOL().length;
    const lineCount = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      const lineTotalLength = model.getLineLength(lineNumber) + eolLength;
      const offsetAfterLine = offsetBeforeLine + lineTotalLength;
      if (offsetAfterLine > offset) {
        return new Position(
          lineNumber,
          offset - offsetBeforeLine + 1
        );
      }
      offsetBeforeLine = offsetAfterLine;
    }
    return new Position(
      lineCount,
      model.getLineMaxColumn(lineCount)
    );
  }
  static insertSnippet(model, _position) {
    const desiredPosition = model.getValueLengthInRange(new Range(1, 1, _position.lineNumber, _position.column));
    let State;
    ((State2) => {
      State2[State2["INVALID"] = 0] = "INVALID";
      State2[State2["AFTER_OBJECT"] = 1] = "AFTER_OBJECT";
      State2[State2["BEFORE_OBJECT"] = 2] = "BEFORE_OBJECT";
    })(State || (State = {}));
    let currentState = 0 /* INVALID */;
    let lastValidPos = -1;
    let lastValidState = 0 /* INVALID */;
    const scanner = createJSONScanner(model.getValue());
    let arrayLevel = 0;
    let objLevel = 0;
    const checkRangeStatus = (pos, state) => {
      if (state !== 0 /* INVALID */ && arrayLevel === 1 && objLevel === 0) {
        currentState = state;
        lastValidPos = pos;
        lastValidState = state;
      } else {
        if (currentState !== 0 /* INVALID */) {
          currentState = 0 /* INVALID */;
          lastValidPos = scanner.getTokenOffset();
        }
      }
    };
    while (scanner.scan() !== JSONSyntaxKind.EOF) {
      const currentPos = scanner.getPosition();
      const kind = scanner.getToken();
      let goodKind = false;
      switch (kind) {
        case JSONSyntaxKind.OpenBracketToken:
          goodKind = true;
          arrayLevel++;
          checkRangeStatus(currentPos, 2 /* BEFORE_OBJECT */);
          break;
        case JSONSyntaxKind.CloseBracketToken:
          goodKind = true;
          arrayLevel--;
          checkRangeStatus(currentPos, 0 /* INVALID */);
          break;
        case JSONSyntaxKind.CommaToken:
          goodKind = true;
          checkRangeStatus(currentPos, 2 /* BEFORE_OBJECT */);
          break;
        case JSONSyntaxKind.OpenBraceToken:
          goodKind = true;
          objLevel++;
          checkRangeStatus(currentPos, 0 /* INVALID */);
          break;
        case JSONSyntaxKind.CloseBraceToken:
          goodKind = true;
          objLevel--;
          checkRangeStatus(currentPos, 1 /* AFTER_OBJECT */);
          break;
        case JSONSyntaxKind.Trivia:
        case JSONSyntaxKind.LineBreakTrivia:
          goodKind = true;
      }
      if (currentPos >= desiredPosition && (currentState !== 0 /* INVALID */ || lastValidPos !== -1)) {
        let acceptPosition;
        let acceptState;
        if (currentState !== 0 /* INVALID */) {
          acceptPosition = goodKind ? currentPos : scanner.getTokenOffset();
          acceptState = currentState;
        } else {
          acceptPosition = lastValidPos;
          acceptState = lastValidState;
        }
        if (acceptState === 1 /* AFTER_OBJECT */) {
          return {
            position: this.offsetToPosition(model, acceptPosition),
            prepend: ",",
            append: ""
          };
        } else {
          scanner.setPosition(acceptPosition);
          return {
            position: this.offsetToPosition(model, acceptPosition),
            prepend: "",
            append: this.hasOpenBrace(scanner) ? "," : ""
          };
        }
      }
    }
    const modelLineCount = model.getLineCount();
    return {
      position: new Position(modelLineCount, model.getLineMaxColumn(modelLineCount)),
      prepend: "\n[",
      append: "]"
    };
  }
}
export {
  SmartSnippetInserter
};
