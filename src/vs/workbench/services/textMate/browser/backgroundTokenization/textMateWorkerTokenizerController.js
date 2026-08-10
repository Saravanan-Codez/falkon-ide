import { importAMDNodeModule } from "../../../../../amdX.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, keepObserved } from "../../../../../base/common/observable.js";
import { LineRange } from "../../../../../editor/common/core/ranges/lineRange.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TokenizationStateStore } from "../../../../../editor/common/model/textModelTokens.js";
import { deserializeFontTokenOptions } from "../../../../../editor/common/textModelEvents.js";
import { ContiguousMultilineTokensBuilder } from "../../../../../editor/common/tokens/contiguousMultilineTokensBuilder.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { MonotonousIndexTransformer } from "../indexTransformer.js";
import { linesLengthEditFromModelContentChange } from "../../../../../editor/common/model/textModelStringEdit.js";
import { StringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { OffsetRange } from "../../../../../editor/common/core/ranges/offsetRange.js";
import { AnnotationsUpdate } from "../../../../../editor/common/model/tokens/annotations.js";
class TextMateWorkerTokenizerController extends Disposable {
  constructor(_model, _worker, _languageIdCodec, _backgroundTokenizationStore, _configurationService, _maxTokenizationLineLength) {
    super();
    this._model = _model;
    this._worker = _worker;
    this._languageIdCodec = _languageIdCodec;
    this._backgroundTokenizationStore = _backgroundTokenizationStore;
    this._configurationService = _configurationService;
    this._maxTokenizationLineLength = _maxTokenizationLineLength;
    this.controllerId = TextMateWorkerTokenizerController._id++;
    this._pendingChanges = [];
    this._states = new TokenizationStateStore();
    this._loggingEnabled = observableConfigValue("editor.experimental.asyncTokenizationLogging", false, this._configurationService);
    this._register(keepObserved(this._loggingEnabled));
    this._register(this._model.onDidChangeContent((e) => {
      if (this._shouldLog) {
        console.log("model change", {
          fileName: this._model.uri.fsPath.split("\\").pop(),
          changes: changesToString(e.changes)
        });
      }
      this._worker.$acceptModelChanged(this.controllerId, e);
      this._pendingChanges.push(e);
    }));
    this._register(this._model.onDidChangeLanguage((e) => {
      const languageId2 = this._model.getLanguageId();
      const encodedLanguageId2 = this._languageIdCodec.encodeLanguageId(languageId2);
      this._worker.$acceptModelLanguageChanged(
        this.controllerId,
        languageId2,
        encodedLanguageId2
      );
    }));
    const languageId = this._model.getLanguageId();
    const encodedLanguageId = this._languageIdCodec.encodeLanguageId(languageId);
    this._worker.$acceptNewModel({
      uri: this._model.uri,
      versionId: this._model.getVersionId(),
      lines: this._model.getLinesContent(),
      EOL: this._model.getEOL(),
      languageId,
      encodedLanguageId,
      maxTokenizationLineLength: this._maxTokenizationLineLength.get(),
      controllerId: this.controllerId
    });
    this._register(autorun((reader) => {
      const maxTokenizationLineLength = this._maxTokenizationLineLength.read(reader);
      this._worker.$acceptMaxTokenizationLineLength(this.controllerId, maxTokenizationLineLength);
    }));
  }
  static {
    this._id = 0;
  }
  dispose() {
    super.dispose();
    this._worker.$acceptRemovedModel(this.controllerId);
  }
  requestTokens(startLineNumber, endLineNumberExclusive) {
    this._worker.$retokenize(this.controllerId, startLineNumber, endLineNumberExclusive);
  }
  /**
   * This method is called from the worker through the worker host.
   */
  async setTokensAndStates(controllerId, versionId, rawTokens, fontTokens, stateDeltas) {
    if (this.controllerId !== controllerId) {
      return;
    }
    let tokens = ContiguousMultilineTokensBuilder.deserialize(
      new Uint8Array(rawTokens)
    );
    const fontTokensUpdate = AnnotationsUpdate.deserialize(fontTokens, deserializeFontTokenOptions());
    if (this._shouldLog) {
      console.log("received background tokenization result", {
        fileName: this._model.uri.fsPath.split("\\").pop(),
        updatedTokenLines: tokens.map((t) => t.getLineRange()).join(" & "),
        updatedStateLines: stateDeltas.map((s) => new LineRange(s.startLineNumber, s.startLineNumber + s.stateDeltas.length).toString()).join(" & ")
      });
    }
    if (this._shouldLog) {
      const changes = this._pendingChanges.filter((c) => c.versionId <= versionId).map((c) => c.changes).map((c) => changesToString(c)).join(" then ");
      console.log("Applying changes to local states", changes);
    }
    while (this._pendingChanges.length > 0 && this._pendingChanges[0].versionId <= versionId) {
      const change = this._pendingChanges.shift();
      this._states.acceptChanges(change.changes);
    }
    if (this._pendingChanges.length > 0) {
      if (this._shouldLog) {
        const changes = this._pendingChanges.map((c) => c.changes).map((c) => changesToString(c)).join(" then ");
        console.log("Considering non-processed changes", changes);
      }
      const curToFutureTransformerTokens = MonotonousIndexTransformer.fromMany(
        this._pendingChanges.map((c) => linesLengthEditFromModelContentChange(c.changes))
      );
      const b = new ContiguousMultilineTokensBuilder();
      for (const t of tokens) {
        for (let i = t.startLineNumber; i <= t.endLineNumber; i++) {
          const result = curToFutureTransformerTokens.transform(i - 1);
          if (result !== void 0) {
            b.add(i, t.getLineTokens(i));
          }
        }
      }
      tokens = b.finalize();
      for (const change of this._pendingChanges) {
        for (const innerChanges of change.changes) {
          for (let j = 0; j < tokens.length; j++) {
            tokens[j].applyEdit(innerChanges.range, innerChanges.text);
          }
        }
      }
      fontTokensUpdate.rebase(this._stringEditFromChanges(this._model, this._pendingChanges));
    }
    const curToFutureTransformerStates = MonotonousIndexTransformer.fromMany(
      this._pendingChanges.map((c) => linesLengthEditFromModelContentChange(c.changes))
    );
    if (!this._applyStateStackDiffFn || !this._initialState) {
      const { applyStateStackDiff, INITIAL } = await importAMDNodeModule("vscode-textmate", "release/main.js");
      this._applyStateStackDiffFn = applyStateStackDiff;
      this._initialState = INITIAL;
    }
    for (const d of stateDeltas) {
      let prevState = d.startLineNumber <= 1 ? this._initialState : this._states.getEndState(d.startLineNumber - 1);
      for (let i = 0; i < d.stateDeltas.length; i++) {
        const delta = d.stateDeltas[i];
        let state;
        if (delta) {
          state = this._applyStateStackDiffFn(prevState, delta);
          this._states.setEndState(d.startLineNumber + i, state);
        } else {
          state = this._states.getEndState(d.startLineNumber + i);
        }
        const offset = curToFutureTransformerStates.transform(d.startLineNumber + i - 1);
        if (offset !== void 0) {
          this._backgroundTokenizationStore.setEndState(offset + 1, state);
        }
        if (d.startLineNumber + i >= this._model.getLineCount() - 1) {
          this._backgroundTokenizationStore.backgroundTokenizationFinished();
        }
        prevState = state;
      }
    }
    this._backgroundTokenizationStore.setTokens(tokens);
    this._backgroundTokenizationStore.setFontInfo(fontTokensUpdate);
  }
  _stringEditFromChanges(model, pendingChanges) {
    const edits = [];
    for (const change of pendingChanges) {
      for (const innerChanges of change.changes) {
        const range = Range.lift(innerChanges.range);
        const text = innerChanges.text;
        const offsetEditStart = model.getOffsetAt(range.getStartPosition());
        const offsetEditEnd = model.getOffsetAt(range.getEndPosition());
        edits.push(StringEdit.replace(new OffsetRange(offsetEditStart, offsetEditEnd), text));
      }
    }
    return StringEdit.compose(edits);
  }
  get _shouldLog() {
    return this._loggingEnabled.get();
  }
}
function changesToString(changes) {
  return changes.map((c) => Range.lift(c.range).toString() + " => " + c.text).join(" & ");
}
export {
  TextMateWorkerTokenizerController
};
