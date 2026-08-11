import { compareBy, numberComparator } from "../../../../../base/common/arrays.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { DetailedLineRangeMapping } from "./mapping.js";
import { LineRangeEdit } from "./editing.js";
import { MergeEditorLineRange } from "./lineRange.js";
import { ReentrancyBarrier } from "../../../../../base/common/controlFlow.js";
import { autorun, observableSignal, observableValue, transaction } from "../../../../../base/common/observable.js";
class TextModelDiffs extends Disposable {
  constructor(baseTextModel, textModel, diffComputer) {
    super();
    this.baseTextModel = baseTextModel;
    this.textModel = textModel;
    this.diffComputer = diffComputer;
    this._recomputeCount = 0;
    this._state = observableValue(this, 1 /* initializing */);
    this._diffs = observableValue(this, []);
    this._barrier = new ReentrancyBarrier();
    this._isDisposed = false;
    this._isInitializing = true;
    const recomputeSignal = observableSignal("recompute");
    this._register(autorun((reader) => {
      recomputeSignal.read(reader);
      this._recompute(reader);
    }));
    this._register(
      baseTextModel.onDidChangeContent(
        this._barrier.makeExclusiveOrSkip(() => {
          recomputeSignal.trigger(void 0);
        })
      )
    );
    this._register(
      textModel.onDidChangeContent(
        this._barrier.makeExclusiveOrSkip(() => {
          recomputeSignal.trigger(void 0);
        })
      )
    );
    this._register(toDisposable(() => {
      this._isDisposed = true;
    }));
  }
  get isApplyingChange() {
    return this._barrier.isOccupied;
  }
  get state() {
    return this._state;
  }
  /**
   * Diffs from base to input.
  */
  get diffs() {
    return this._diffs;
  }
  _recompute(reader) {
    this._recomputeCount++;
    const currentRecomputeIdx = this._recomputeCount;
    if (this._state.get() === 1 /* initializing */) {
      this._isInitializing = true;
    }
    transaction((tx) => {
      this._state.set(
        this._isInitializing ? 1 /* initializing */ : 3 /* updating */,
        tx,
        0 /* other */
      );
    });
    const result = this.diffComputer.computeDiff(this.baseTextModel, this.textModel, reader);
    result.then((result2) => {
      if (this._isDisposed) {
        return;
      }
      if (currentRecomputeIdx !== this._recomputeCount) {
        return;
      }
      transaction((tx) => {
        if (result2.diffs) {
          this._state.set(2 /* upToDate */, tx, 1 /* textChange */);
          this._diffs.set(result2.diffs, tx, 1 /* textChange */);
        } else {
          this._state.set(4 /* error */, tx, 1 /* textChange */);
        }
        this._isInitializing = false;
      });
    });
  }
  ensureUpToDate() {
    if (this.state.get() !== 2 /* upToDate */) {
      throw new BugIndicatingError("Cannot remove diffs when the model is not up to date");
    }
  }
  removeDiffs(diffToRemoves, transaction2, group) {
    this.ensureUpToDate();
    diffToRemoves.sort(compareBy((d) => d.inputRange.startLineNumber, numberComparator));
    diffToRemoves.reverse();
    const diffs = this._diffs.get();
    const toRemoveSet = new Set(diffToRemoves);
    if (toRemoveSet.size !== diffToRemoves.length) {
      throw new BugIndicatingError();
    }
    const diffsSet = new Set(diffs);
    for (const d of diffToRemoves) {
      if (!diffsSet.has(d)) {
        throw new BugIndicatingError();
      }
    }
    for (const diffToRemove of diffToRemoves) {
      this._barrier.runExclusivelyOrThrow(() => {
        const edits = diffToRemove.getReverseLineEdit().toEdits(this.textModel.getLineCount());
        this.textModel.pushEditOperations(null, edits, () => null, group);
      });
    }
    let cumulativeDelta = 0;
    const newDiffs = [];
    for (const d of diffs) {
      if (toRemoveSet.has(d)) {
        cumulativeDelta += d.inputRange.length - d.outputRange.length;
      } else {
        newDiffs.push(cumulativeDelta !== 0 ? d.addOutputLineDelta(cumulativeDelta) : d);
      }
    }
    this._diffs.set(newDiffs, transaction2, 0 /* other */);
  }
  /**
   * Edit must be conflict free.
   */
  applyEditRelativeToOriginal(edit, transaction2, group) {
    this.ensureUpToDate();
    const editMapping = new DetailedLineRangeMapping(
      edit.range,
      this.baseTextModel,
      MergeEditorLineRange.fromLength(edit.range.startLineNumber, edit.newLines.length),
      this.textModel
    );
    let firstAfter = false;
    let delta = 0;
    const newDiffs = new Array();
    for (const diff of this.diffs.get()) {
      if (diff.inputRange.intersectsOrTouches(edit.range)) {
        throw new BugIndicatingError("Edit must be conflict free.");
      } else if (diff.inputRange.isAfter(edit.range)) {
        if (!firstAfter) {
          firstAfter = true;
          newDiffs.push(editMapping.addOutputLineDelta(delta));
        }
        newDiffs.push(diff.addOutputLineDelta(edit.newLines.length - edit.range.length));
      } else {
        newDiffs.push(diff);
      }
      if (!firstAfter) {
        delta += diff.outputRange.length - diff.inputRange.length;
      }
    }
    if (!firstAfter) {
      firstAfter = true;
      newDiffs.push(editMapping.addOutputLineDelta(delta));
    }
    this._barrier.runExclusivelyOrThrow(() => {
      const edits = new LineRangeEdit(edit.range.delta(delta), edit.newLines).toEdits(this.textModel.getLineCount());
      this.textModel.pushEditOperations(null, edits, () => null, group);
    });
    this._diffs.set(newDiffs, transaction2, 0 /* other */);
  }
  findTouchingDiffs(baseRange) {
    return this.diffs.get().filter((d) => d.inputRange.intersectsOrTouches(baseRange));
  }
  getResultLine(lineNumber, reader) {
    let offset = 0;
    const diffs = reader ? this.diffs.read(reader) : this.diffs.get();
    for (const diff of diffs) {
      if (diff.inputRange.contains(lineNumber) || diff.inputRange.endLineNumberExclusive === lineNumber) {
        return diff;
      } else if (diff.inputRange.endLineNumberExclusive < lineNumber) {
        offset = diff.resultingDeltaFromOriginalToModified;
      } else {
        break;
      }
    }
    return lineNumber + offset;
  }
  getResultLineRange(baseRange, reader) {
    let start = this.getResultLine(baseRange.startLineNumber, reader);
    if (typeof start !== "number") {
      start = start.outputRange.startLineNumber;
    }
    let endExclusive = this.getResultLine(baseRange.endLineNumberExclusive, reader);
    if (typeof endExclusive !== "number") {
      endExclusive = endExclusive.outputRange.endLineNumberExclusive;
    }
    return MergeEditorLineRange.fromLineNumbers(start, endExclusive);
  }
}
var TextModelDiffChangeReason = /* @__PURE__ */ ((TextModelDiffChangeReason2) => {
  TextModelDiffChangeReason2[TextModelDiffChangeReason2["other"] = 0] = "other";
  TextModelDiffChangeReason2[TextModelDiffChangeReason2["textChange"] = 1] = "textChange";
  return TextModelDiffChangeReason2;
})(TextModelDiffChangeReason || {});
var TextModelDiffState = /* @__PURE__ */ ((TextModelDiffState2) => {
  TextModelDiffState2[TextModelDiffState2["initializing"] = 1] = "initializing";
  TextModelDiffState2[TextModelDiffState2["upToDate"] = 2] = "upToDate";
  TextModelDiffState2[TextModelDiffState2["updating"] = 3] = "updating";
  TextModelDiffState2[TextModelDiffState2["error"] = 4] = "error";
  return TextModelDiffState2;
})(TextModelDiffState || {});
export {
  TextModelDiffChangeReason,
  TextModelDiffState,
  TextModelDiffs
};
