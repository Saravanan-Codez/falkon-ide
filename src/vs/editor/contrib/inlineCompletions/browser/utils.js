import { Permutation, compareBy } from "../../../../base/common/arrays.js";
import { observableValue, autorun, transaction } from "../../../../base/common/observable.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { Position } from "../../../common/core/position.js";
import { PositionOffsetTransformer } from "../../../common/core/text/positionToOffset.js";
import { Range } from "../../../common/core/range.js";
import { TextEdit } from "../../../common/core/edits/textEdit.js";
import { getPositionOffsetTransformerFromTextModel } from "../../../common/core/text/getPositionOffsetTransformerFromTextModel.js";
const array = [];
function getReadonlyEmptyArray() {
  return array;
}
function addPositions(pos1, pos2) {
  return new Position(pos1.lineNumber + pos2.lineNumber - 1, pos2.lineNumber === 1 ? pos1.column + pos2.column - 1 : pos2.column);
}
function subtractPositions(pos1, pos2) {
  return new Position(pos1.lineNumber - pos2.lineNumber + 1, pos1.lineNumber - pos2.lineNumber === 0 ? pos1.column - pos2.column + 1 : pos1.column);
}
function substringPos(text, pos) {
  const transformer = new PositionOffsetTransformer(text);
  const offset = transformer.getOffset(pos);
  return text.substring(offset);
}
function getEndPositionsAfterApplying(edits) {
  const newRanges = getModifiedRangesAfterApplying(edits);
  return newRanges.map((range) => range.getEndPosition());
}
function getModifiedRangesAfterApplying(edits) {
  const sortPerm = Permutation.createSortPermutation(edits, compareBy((e) => e.range, Range.compareRangesUsingStarts));
  const edit = new TextEdit(sortPerm.apply(edits));
  const sortedNewRanges = edit.getNewRanges();
  return sortPerm.inverse().apply(sortedNewRanges);
}
function removeTextReplacementCommonSuffixPrefix(edits, textModel) {
  const transformer = getPositionOffsetTransformerFromTextModel(textModel);
  const text = textModel.getValue();
  const stringReplacements = edits.map((edit) => transformer.getStringReplacement(edit));
  const minimalStringReplacements = stringReplacements.map((replacement) => replacement.removeCommonSuffixPrefix(text));
  return minimalStringReplacements.map((replacement) => transformer.getTextReplacement(replacement));
}
function convertItemsToStableObservables(items, store) {
  const result = observableValue("result", []);
  const innerObservables = [];
  store.add(autorun((reader) => {
    const itemsValue = items.read(reader);
    transaction((tx) => {
      if (itemsValue.length !== innerObservables.length) {
        innerObservables.length = itemsValue.length;
        for (let i = 0; i < innerObservables.length; i++) {
          if (!innerObservables[i]) {
            innerObservables[i] = observableValue("item", itemsValue[i]);
          }
        }
        result.set([...innerObservables], tx);
      }
      innerObservables.forEach((o, i) => o.set(itemsValue[i], tx));
    });
  }));
  return result;
}
class ObservableContextKeyService {
  constructor(_contextKeyService) {
    this._contextKeyService = _contextKeyService;
  }
  bind(key, obs) {
    return bindContextKey(key, this._contextKeyService, obs instanceof Function ? obs : (reader) => obs.read(reader));
  }
}
function wait(ms, cancellationToken) {
  return new Promise((resolve) => {
    let d = void 0;
    const handle = setTimeout(() => {
      if (d) {
        d.dispose();
      }
      resolve();
    }, ms);
    if (cancellationToken) {
      d = cancellationToken.onCancellationRequested(() => {
        clearTimeout(handle);
        if (d) {
          d.dispose();
        }
        resolve();
      });
    }
  });
}
class ErrorResult {
  constructor(error, message = void 0) {
    this.error = error;
    this.message = message;
  }
  static message(message) {
    return new ErrorResult(void 0, message);
  }
  static is(obj) {
    return obj instanceof ErrorResult;
  }
  logError() {
    if (this.message) {
      console.error(`ErrorResult: ${this.message}`, this.error);
    } else {
      console.error(`ErrorResult: An unexpected error-case occurred, usually caused by invalid input.`, this.error);
    }
  }
}
export {
  ErrorResult,
  ObservableContextKeyService,
  addPositions,
  convertItemsToStableObservables,
  getEndPositionsAfterApplying,
  getModifiedRangesAfterApplying,
  getReadonlyEmptyArray,
  removeTextReplacementCommonSuffixPrefix,
  substringPos,
  subtractPositions,
  wait
};
