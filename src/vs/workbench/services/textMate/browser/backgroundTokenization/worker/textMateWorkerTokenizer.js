import { importAMDNodeModule } from "../../../../../../amdX.js";
import { RunOnceScheduler } from "../../../../../../base/common/async.js";
import { observableValue } from "../../../../../../base/common/observable.js";
import { setTimeout0 } from "../../../../../../base/common/platform.js";
import { LineRange } from "../../../../../../editor/common/core/ranges/lineRange.js";
import { MirrorTextModel } from "../../../../../../editor/common/model/mirrorTextModel.js";
import { TokenizerWithStateStore } from "../../../../../../editor/common/model/textModelTokens.js";
import { ContiguousMultilineTokensBuilder } from "../../../../../../editor/common/tokens/contiguousMultilineTokensBuilder.js";
import { LineTokens } from "../../../../../../editor/common/tokens/lineTokens.js";
import { TextMateTokenizationSupport } from "../../tokenizationSupport/textMateTokenizationSupport.js";
import { TokenizationSupportWithLineLimit } from "../../tokenizationSupport/tokenizationSupportWithLineLimit.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { serializeFontTokenOptions } from "../../../../../../editor/common/textModelEvents.js";
import { AnnotationsUpdate } from "../../../../../../editor/common/model/tokens/annotations.js";
import { OffsetRange } from "../../../../../../editor/common/core/ranges/offsetRange.js";
class TextMateWorkerTokenizer extends MirrorTextModel {
  constructor(uri, lines, eol, versionId, _host, _languageId, _encodedLanguageId, maxTokenizationLineLength) {
    super(uri, lines, eol, versionId);
    this._host = _host;
    this._languageId = _languageId;
    this._encodedLanguageId = _encodedLanguageId;
    this._tokenizerWithStateStore = null;
    this._isDisposed = false;
    this._maxTokenizationLineLength = observableValue(this, -1);
    this._tokenizeDebouncer = new RunOnceScheduler(() => this._tokenize(), 10);
    this._maxTokenizationLineLength.set(maxTokenizationLineLength, void 0);
    this._resetTokenization();
  }
  dispose() {
    this._isDisposed = true;
    this._tokenizeDebouncer.dispose();
    super.dispose();
  }
  onLanguageId(languageId, encodedLanguageId) {
    this._languageId = languageId;
    this._encodedLanguageId = encodedLanguageId;
    this._resetTokenization();
  }
  onEvents(e) {
    super.onEvents(e);
    this._tokenizerWithStateStore?.store.acceptChanges(e.changes);
    this._tokenizeDebouncer.schedule();
  }
  acceptMaxTokenizationLineLength(maxTokenizationLineLength) {
    this._maxTokenizationLineLength.set(maxTokenizationLineLength, void 0);
  }
  retokenize(startLineNumber, endLineNumberExclusive) {
    if (this._tokenizerWithStateStore) {
      this._tokenizerWithStateStore.store.invalidateEndStateRange(new LineRange(startLineNumber, endLineNumberExclusive));
      this._tokenizeDebouncer.schedule();
    }
  }
  async _resetTokenization() {
    this._tokenizerWithStateStore = null;
    const languageId = this._languageId;
    const encodedLanguageId = this._encodedLanguageId;
    const r = await this._host.getOrCreateGrammar(languageId, encodedLanguageId);
    if (this._isDisposed || languageId !== this._languageId || encodedLanguageId !== this._encodedLanguageId || !r) {
      return;
    }
    if (r.grammar) {
      const tokenizationSupport = new TokenizationSupportWithLineLimit(
        this._encodedLanguageId,
        new TextMateTokenizationSupport(
          r.grammar,
          r.initialState,
          false,
          void 0,
          () => false,
          (timeMs, lineLength, isRandomSample) => {
            this._host.reportTokenizationTime(timeMs, languageId, r.sourceExtensionId, lineLength, isRandomSample);
          },
          false
        ),
        Disposable.None,
        this._maxTokenizationLineLength
      );
      this._tokenizerWithStateStore = new TokenizerWithStateStore(this._lines.length, tokenizationSupport);
    } else {
      this._tokenizerWithStateStore = null;
    }
    this._tokenize();
  }
  async _tokenize() {
    if (this._isDisposed || !this._tokenizerWithStateStore) {
      return;
    }
    if (!this._diffStateStacksRefEqFn) {
      const { diffStateStacksRefEq } = await importAMDNodeModule("vscode-textmate", "release/main.js");
      this._diffStateStacksRefEqFn = diffStateStacksRefEq;
    }
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    while (true) {
      let tokenizedLines = 0;
      const tokenBuilder = new ContiguousMultilineTokensBuilder();
      const stateDeltaBuilder = new StateDeltaBuilder();
      const fontTokensUpdate = [];
      while (true) {
        const lineToTokenize = this._tokenizerWithStateStore.getFirstInvalidLine();
        if (lineToTokenize === null || tokenizedLines > 200) {
          break;
        }
        tokenizedLines++;
        const text = this._lines[lineToTokenize.lineNumber - 1];
        const r = this._tokenizerWithStateStore.tokenizationSupport.tokenizeEncoded(text, true, lineToTokenize.startState);
        if (this._tokenizerWithStateStore.store.setEndState(lineToTokenize.lineNumber, r.endState)) {
          const delta = this._diffStateStacksRefEqFn(lineToTokenize.startState, r.endState);
          stateDeltaBuilder.setState(lineToTokenize.lineNumber, delta);
        } else {
          stateDeltaBuilder.setState(lineToTokenize.lineNumber, null);
        }
        LineTokens.convertToEndOffset(r.tokens, text.length);
        tokenBuilder.add(lineToTokenize.lineNumber, r.tokens);
        fontTokensUpdate.push(...this._getFontTokensUpdate(lineToTokenize.lineNumber, r));
        const deltaMs2 = (/* @__PURE__ */ new Date()).getTime() - startTime;
        if (deltaMs2 > 20) {
          break;
        }
      }
      if (tokenizedLines === 0) {
        break;
      }
      const fontUpdate = AnnotationsUpdate.create(fontTokensUpdate);
      const serializedFontUpdate = fontUpdate.serialize(serializeFontTokenOptions());
      const stateDeltas = stateDeltaBuilder.getStateDeltas();
      this._host.setTokensAndStates(
        this._versionId,
        tokenBuilder.serialize(),
        serializedFontUpdate,
        stateDeltas
      );
      const deltaMs = (/* @__PURE__ */ new Date()).getTime() - startTime;
      if (deltaMs > 20) {
        setTimeout0(() => this._tokenize());
        return;
      }
    }
  }
  _getFontTokensUpdate(lineNumber, r) {
    const fontTokens = [];
    const offsetAtLineStart = this._getOffsetAtLineStart(lineNumber);
    const offsetAtNextLineStart = this._getOffsetAtLineStart(lineNumber + 1);
    const offsetAtLineEnd = offsetAtNextLineStart > 0 ? offsetAtNextLineStart - 1 : 0;
    fontTokens.push({
      range: new OffsetRange(offsetAtLineStart, offsetAtLineEnd),
      annotation: void 0
    });
    if (r.fontInfo.length) {
      for (const fontInfo of r.fontInfo) {
        const offsetAtLineStart2 = this._getOffsetAtLineStart(lineNumber);
        fontTokens.push({
          range: new OffsetRange(offsetAtLineStart2 + fontInfo.startIndex, offsetAtLineStart2 + fontInfo.endIndex),
          annotation: {
            fontFamily: fontInfo.fontFamily ?? void 0,
            fontSizeMultiplier: fontInfo.fontSizeMultiplier ?? void 0,
            lineHeightMultiplier: fontInfo.lineHeightMultiplier ?? void 0
          }
        });
      }
    }
    return fontTokens;
  }
  _getOffsetAtLineStart(lineNumber) {
    this._ensureLineStarts();
    return lineNumber - 1 > 0 ? this._lineStarts.getPrefixSum(lineNumber - 2) : 0;
  }
}
class StateDeltaBuilder {
  constructor() {
    this._lastStartLineNumber = -1;
    this._stateDeltas = [];
  }
  setState(lineNumber, stackDiff) {
    if (lineNumber === this._lastStartLineNumber + 1) {
      this._stateDeltas[this._stateDeltas.length - 1].stateDeltas.push(stackDiff);
    } else {
      this._stateDeltas.push({ startLineNumber: lineNumber, stateDeltas: [stackDiff] });
    }
    this._lastStartLineNumber = lineNumber;
  }
  getStateDeltas() {
    return this._stateDeltas;
  }
}
export {
  TextMateWorkerTokenizer
};
