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
import { disposableTimeout } from "../../../../../base/common/async.js";
import { Color, RGBA } from "../../../../../base/common/color.js";
import { debounce } from "../../../../../base/common/decorators.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
import { DEFAULT_LOCAL_ECHO_EXCLUDE } from "../common/terminalTypeAheadConfiguration.js";
import { isNumber } from "../../../../../base/common/types.js";
var VT = /* @__PURE__ */ ((VT2) => {
  VT2["Esc"] = "\x1B";
  VT2["Csi"] = `\x1B[`;
  VT2["ShowCursor"] = `\x1B[?25h`;
  VT2["HideCursor"] = `\x1B[?25l`;
  VT2["DeleteChar"] = `\x1B[X`;
  VT2["DeleteRestOfLine"] = `\x1B[K`;
  return VT2;
})(VT || {});
const CSI_STYLE_RE = /^\x1b\[[0-9;]*m/;
const CSI_MOVE_RE = /^\x1b\[?([0-9]*)(;[35])?O?([DC])/;
const NOT_WORD_RE = /[^a-z0-9]/i;
var StatsConstants = /* @__PURE__ */ ((StatsConstants2) => {
  StatsConstants2[StatsConstants2["StatsBufferSize"] = 24] = "StatsBufferSize";
  StatsConstants2[StatsConstants2["StatsSendTelemetryEvery"] = 3e5] = "StatsSendTelemetryEvery";
  StatsConstants2[StatsConstants2["StatsMinSamplesToTurnOn"] = 5] = "StatsMinSamplesToTurnOn";
  StatsConstants2[StatsConstants2["StatsMinAccuracyToTurnOn"] = 0.3] = "StatsMinAccuracyToTurnOn";
  StatsConstants2[StatsConstants2["StatsToggleOffThreshold"] = 0.5] = "StatsToggleOffThreshold";
  return StatsConstants2;
})(StatsConstants || {});
const PREDICTION_OMIT_RE = /^(\x1b\[(\??25[hl]|\??[0-9;]+n))+/;
const core = (terminal) => {
  return terminal._core;
};
const flushOutput = (terminal) => {
};
var CursorMoveDirection = /* @__PURE__ */ ((CursorMoveDirection2) => {
  CursorMoveDirection2["Back"] = "D";
  CursorMoveDirection2["Forwards"] = "C";
  return CursorMoveDirection2;
})(CursorMoveDirection || {});
class Cursor {
  constructor(rows, cols, _buffer) {
    this.rows = rows;
    this.cols = cols;
    this._buffer = _buffer;
    this._x = 0;
    this._y = 1;
    this._baseY = 1;
    this._x = _buffer.cursorX;
    this._y = _buffer.cursorY;
    this._baseY = _buffer.baseY;
  }
  get x() {
    return this._x;
  }
  get y() {
    return this._y;
  }
  get baseY() {
    return this._baseY;
  }
  get coordinate() {
    return { x: this._x, y: this._y, baseY: this._baseY };
  }
  getLine() {
    return this._buffer.getLine(this._y + this._baseY);
  }
  getCell(loadInto) {
    return this.getLine()?.getCell(this._x, loadInto);
  }
  moveTo(coordinate) {
    this._x = coordinate.x;
    this._y = coordinate.y + coordinate.baseY - this._baseY;
    return this.moveInstruction();
  }
  clone() {
    const c = new Cursor(this.rows, this.cols, this._buffer);
    c.moveTo(this);
    return c;
  }
  move(x, y) {
    this._x = x;
    this._y = y;
    return this.moveInstruction();
  }
  shift(x = 0, y = 0) {
    this._x += x;
    this._y += y;
    return this.moveInstruction();
  }
  moveInstruction() {
    if (this._y >= this.rows) {
      this._baseY += this._y - (this.rows - 1);
      this._y = this.rows - 1;
    } else if (this._y < 0) {
      this._baseY -= this._y;
      this._y = 0;
    }
    return `${"\x1B[" /* Csi */}${this._y + 1};${this._x + 1}H`;
  }
}
const moveToWordBoundary = (b, cursor, direction) => {
  let ateLeadingWhitespace = false;
  if (direction < 0) {
    cursor.shift(-1);
  }
  let cell;
  while (cursor.x >= 0) {
    cell = cursor.getCell(cell);
    if (!cell?.getCode()) {
      return;
    }
    const chars = cell.getChars();
    if (NOT_WORD_RE.test(chars)) {
      if (ateLeadingWhitespace) {
        break;
      }
    } else {
      ateLeadingWhitespace = true;
    }
    cursor.shift(direction);
  }
  if (direction < 0) {
    cursor.shift(1);
  }
};
var MatchResult = /* @__PURE__ */ ((MatchResult2) => {
  MatchResult2[MatchResult2["Success"] = 0] = "Success";
  MatchResult2[MatchResult2["Failure"] = 1] = "Failure";
  MatchResult2[MatchResult2["Buffer"] = 2] = "Buffer";
  return MatchResult2;
})(MatchResult || {});
class StringReader {
  constructor(_input) {
    this._input = _input;
    this.index = 0;
  }
  get remaining() {
    return this._input.length - this.index;
  }
  get eof() {
    return this.index === this._input.length;
  }
  get rest() {
    return this._input.slice(this.index);
  }
  /**
   * Advances the reader and returns the character if it matches.
   */
  eatChar(char) {
    if (this._input[this.index] !== char) {
      return;
    }
    this.index++;
    return char;
  }
  /**
   * Advances the reader and returns the string if it matches.
   */
  eatStr(substr) {
    if (this._input.slice(this.index, substr.length) !== substr) {
      return;
    }
    this.index += substr.length;
    return substr;
  }
  /**
   * Matches and eats the substring character-by-character. If EOF is reached
   * before the substring is consumed, it will buffer. Index is not moved
   * if it's not a match.
   */
  eatGradually(substr) {
    const prevIndex = this.index;
    for (let i = 0; i < substr.length; i++) {
      if (i > 0 && this.eof) {
        return 2 /* Buffer */;
      }
      if (!this.eatChar(substr[i])) {
        this.index = prevIndex;
        return 1 /* Failure */;
      }
    }
    return 0 /* Success */;
  }
  /**
   * Advances the reader and returns the regex if it matches.
   */
  eatRe(re) {
    const match = re.exec(this._input.slice(this.index));
    if (!match) {
      return;
    }
    this.index += match[0].length;
    return match;
  }
  /**
   * Advances the reader and returns the character if the code matches.
   */
  eatCharCode(min = 0, max = min + 1) {
    const code = this._input.charCodeAt(this.index);
    if (code < min || code >= max) {
      return void 0;
    }
    this.index++;
    return code;
  }
}
class HardBoundary {
  constructor() {
    this.clearAfterTimeout = false;
  }
  apply() {
    return "";
  }
  rollback() {
    return "";
  }
  rollForwards() {
    return "";
  }
  matches() {
    return 1 /* Failure */;
  }
}
class TentativeBoundary {
  constructor(inner) {
    this.inner = inner;
  }
  apply(buffer, cursor) {
    this._appliedCursor = cursor.clone();
    this.inner.apply(buffer, this._appliedCursor);
    return "";
  }
  rollback(cursor) {
    this.inner.rollback(cursor.clone());
    return "";
  }
  rollForwards(cursor, withInput) {
    if (this._appliedCursor) {
      cursor.moveTo(this._appliedCursor);
    }
    return withInput;
  }
  matches(input) {
    return this.inner.matches(input);
  }
}
const isTenativeCharacterPrediction = (p) => p instanceof TentativeBoundary && p.inner instanceof CharacterPrediction;
class CharacterPrediction {
  constructor(_style, _char) {
    this._style = _style;
    this._char = _char;
    this.affectsStyle = true;
  }
  apply(_, cursor) {
    const cell = cursor.getCell();
    this.appliedAt = cell ? { pos: cursor.coordinate, oldAttributes: attributesToSeq(cell), oldChar: cell.getChars() } : { pos: cursor.coordinate, oldAttributes: "", oldChar: "" };
    cursor.shift(1);
    return this._style.apply + this._char + this._style.undo;
  }
  rollback(cursor) {
    if (!this.appliedAt) {
      return "";
    }
    const { oldAttributes, oldChar, pos } = this.appliedAt;
    const r = cursor.moveTo(pos) + (oldChar ? `${oldAttributes}${oldChar}${cursor.moveTo(pos)}` : "\x1B[X" /* DeleteChar */);
    return r;
  }
  rollForwards(cursor, input) {
    if (!this.appliedAt) {
      return "";
    }
    return cursor.clone().moveTo(this.appliedAt.pos) + input;
  }
  matches(input, lookBehind) {
    const startIndex = input.index;
    while (input.eatRe(CSI_STYLE_RE)) {
    }
    if (input.eof) {
      return 2 /* Buffer */;
    }
    if (input.eatChar(this._char)) {
      return 0 /* Success */;
    }
    if (lookBehind instanceof CharacterPrediction) {
      const sillyZshOutcome = input.eatGradually(`\b${lookBehind._char}${this._char}`);
      if (sillyZshOutcome !== 1 /* Failure */) {
        return sillyZshOutcome;
      }
    }
    input.index = startIndex;
    return 1 /* Failure */;
  }
}
class BackspacePrediction {
  constructor(_terminal) {
    this._terminal = _terminal;
  }
  apply(_, cursor) {
    const isLastChar = !cursor.getLine()?.translateToString(void 0, cursor.x).trim();
    const pos = cursor.coordinate;
    const move = cursor.shift(-1);
    const cell = cursor.getCell();
    this._appliedAt = cell ? { isLastChar, pos, oldAttributes: attributesToSeq(cell), oldChar: cell.getChars() } : { isLastChar, pos, oldAttributes: "", oldChar: "" };
    return move + "\x1B[X" /* DeleteChar */;
  }
  rollback(cursor) {
    if (!this._appliedAt) {
      return "";
    }
    const { oldAttributes, oldChar, pos } = this._appliedAt;
    if (!oldChar) {
      return cursor.moveTo(pos) + "\x1B[X" /* DeleteChar */;
    }
    return oldAttributes + oldChar + cursor.moveTo(pos) + attributesToSeq(core(this._terminal)._inputHandler._curAttrData);
  }
  rollForwards() {
    return "";
  }
  matches(input) {
    if (this._appliedAt?.isLastChar) {
      const r1 = input.eatGradually(`\b${"\x1B[" /* Csi */}K`);
      if (r1 !== 1 /* Failure */) {
        return r1;
      }
      const r2 = input.eatGradually(`\b \b`);
      if (r2 !== 1 /* Failure */) {
        return r2;
      }
    }
    return 1 /* Failure */;
  }
}
class NewlinePrediction {
  apply(_, cursor) {
    this._prevPosition = cursor.coordinate;
    cursor.move(0, cursor.y + 1);
    return "\r\n";
  }
  rollback(cursor) {
    return this._prevPosition ? cursor.moveTo(this._prevPosition) : "";
  }
  rollForwards() {
    return "";
  }
  matches(input) {
    return input.eatGradually("\r\n");
  }
}
class LinewrapPrediction extends NewlinePrediction {
  apply(_, cursor) {
    this._prevPosition = cursor.coordinate;
    cursor.move(0, cursor.y + 1);
    return " \r";
  }
  matches(input) {
    const r = input.eatGradually(" \r");
    if (r !== 1 /* Failure */) {
      const r2 = input.eatGradually("\x1B[K" /* DeleteRestOfLine */);
      return r2 === 2 /* Buffer */ ? 2 /* Buffer */ : r;
    }
    return input.eatGradually("\r\n");
  }
}
class CursorMovePrediction {
  constructor(_direction, _moveByWords, _amount) {
    this._direction = _direction;
    this._moveByWords = _moveByWords;
    this._amount = _amount;
  }
  apply(buffer, cursor) {
    const prevPosition = cursor.x;
    const currentCell = cursor.getCell();
    const prevAttrs = currentCell ? attributesToSeq(currentCell) : "";
    const { _amount: amount, _direction: direction, _moveByWords: moveByWords } = this;
    const delta = direction === "D" /* Back */ ? -1 : 1;
    const target = cursor.clone();
    if (moveByWords) {
      for (let i = 0; i < amount; i++) {
        moveToWordBoundary(buffer, target, delta);
      }
    } else {
      target.shift(delta * amount);
    }
    this._applied = {
      amount: Math.abs(cursor.x - target.x),
      prevPosition,
      prevAttrs,
      rollForward: cursor.moveTo(target)
    };
    return this._applied.rollForward;
  }
  rollback(cursor) {
    if (!this._applied) {
      return "";
    }
    return cursor.move(this._applied.prevPosition, cursor.y) + this._applied.prevAttrs;
  }
  rollForwards() {
    return "";
  }
  matches(input) {
    if (!this._applied) {
      return 1 /* Failure */;
    }
    const direction = this._direction;
    const { amount, rollForward } = this._applied;
    if (input.eatStr(`${"\x1B[" /* Csi */}${direction}`.repeat(amount))) {
      return 0 /* Success */;
    }
    if (direction === "D" /* Back */) {
      if (input.eatStr(`\b`.repeat(amount))) {
        return 0 /* Success */;
      }
    }
    if (rollForward) {
      const r = input.eatGradually(rollForward);
      if (r !== 1 /* Failure */) {
        return r;
      }
    }
    return input.eatGradually(`${"\x1B[" /* Csi */}${amount}${direction}`);
  }
}
class PredictionStats extends Disposable {
  constructor(timeline) {
    super();
    this._stats = [];
    this._index = 0;
    this._addedAtTime = /* @__PURE__ */ new WeakMap();
    this._changeEmitter = this._register(new Emitter());
    this.onChange = this._changeEmitter.event;
    this._register(timeline.onPredictionAdded((p) => this._addedAtTime.set(p, Date.now())));
    this._register(timeline.onPredictionSucceeded(this._pushStat.bind(this, true)));
    this._register(timeline.onPredictionFailed(this._pushStat.bind(this, false)));
  }
  /**
   * Gets the percent (0-1) of predictions that were accurate.
   */
  get accuracy() {
    let correctCount = 0;
    for (const [, correct] of this._stats) {
      if (correct) {
        correctCount++;
      }
    }
    return correctCount / (this._stats.length || 1);
  }
  /**
   * Gets the number of recorded stats.
   */
  get sampleSize() {
    return this._stats.length;
  }
  /**
   * Gets latency stats of successful predictions.
   */
  get latency() {
    const latencies = this._stats.filter(([, correct]) => correct).map(([s]) => s).sort();
    return {
      count: latencies.length,
      min: latencies[0],
      median: latencies[Math.floor(latencies.length / 2)],
      max: latencies[latencies.length - 1]
    };
  }
  /**
   * Gets the maximum observed latency.
   */
  get maxLatency() {
    let max = -Infinity;
    for (const [latency, correct] of this._stats) {
      if (correct) {
        max = Math.max(latency, max);
      }
    }
    return max;
  }
  _pushStat(correct, prediction) {
    const started = this._addedAtTime.get(prediction);
    this._stats[this._index] = [Date.now() - started, correct];
    this._index = (this._index + 1) % 24 /* StatsBufferSize */;
    this._changeEmitter.fire();
  }
}
class PredictionTimeline extends Disposable {
  constructor(terminal, _style) {
    super();
    this.terminal = terminal;
    this._style = _style;
    /**
     * Expected queue of events. Only predictions for the lowest are
     * written into the terminal.
     */
    this._expected = [];
    /**
     * Current prediction generation.
     */
    this._currentGen = 0;
    /**
     * Whether predictions are echoed to the terminal. If false, predictions
     * will still be computed internally for latency metrics, but input will
     * never be adjusted.
     */
    this._showPredictions = false;
    this._addedEmitter = this._register(new Emitter());
    this.onPredictionAdded = this._addedEmitter.event;
    this._failedEmitter = this._register(new Emitter());
    this.onPredictionFailed = this._failedEmitter.event;
    this._succeededEmitter = this._register(new Emitter());
    this.onPredictionSucceeded = this._succeededEmitter.event;
  }
  get _currentGenerationPredictions() {
    return this._expected.filter(({ gen }) => gen === this._expected[0].gen).map(({ p }) => p);
  }
  get isShowingPredictions() {
    return this._showPredictions;
  }
  get length() {
    return this._expected.length;
  }
  setShowPredictions(show) {
    if (show === this._showPredictions) {
      return;
    }
    this._showPredictions = show;
    const buffer = this._getActiveBuffer();
    if (!buffer) {
      return;
    }
    const toApply = this._currentGenerationPredictions;
    if (show) {
      this.clearCursor();
      this._style.expectIncomingStyle(toApply.reduce((count, p) => p.affectsStyle ? count + 1 : count, 0));
      this.terminal.write(toApply.map((p) => p.apply(buffer, this.physicalCursor(buffer))).join(""));
    } else {
      this.terminal.write(toApply.reverse().map((p) => p.rollback(this.physicalCursor(buffer))).join(""));
    }
  }
  /**
   * Undoes any predictions written and resets expectations.
   */
  undoAllPredictions() {
    const buffer = this._getActiveBuffer();
    if (this._showPredictions && buffer) {
      this.terminal.write(this._currentGenerationPredictions.reverse().map((p) => p.rollback(this.physicalCursor(buffer))).join(""));
    }
    this._expected = [];
  }
  /**
   * Should be called when input is incoming to the temrinal.
   */
  beforeServerInput(input) {
    const originalInput = input;
    if (this._inputBuffer) {
      input = this._inputBuffer + input;
      this._inputBuffer = void 0;
    }
    if (!this._expected.length) {
      this._clearPredictionState();
      return input;
    }
    const buffer = this._getActiveBuffer();
    if (!buffer) {
      this._clearPredictionState();
      return input;
    }
    let output = "";
    const reader = new StringReader(input);
    const startingGen = this._expected[0].gen;
    const emitPredictionOmitted = () => {
      const omit = reader.eatRe(PREDICTION_OMIT_RE);
      if (omit) {
        output += omit[0];
      }
    };
    ReadLoop: while (this._expected.length && reader.remaining > 0) {
      emitPredictionOmitted();
      const { p: prediction, gen } = this._expected[0];
      const cursor = this.physicalCursor(buffer);
      const beforeTestReaderIndex = reader.index;
      switch (prediction.matches(reader, this._lookBehind)) {
        case 0 /* Success */: {
          const eaten = input.slice(beforeTestReaderIndex, reader.index);
          if (gen === startingGen) {
            output += prediction.rollForwards?.(cursor, eaten);
          } else {
            prediction.apply(buffer, this.physicalCursor(buffer));
            output += eaten;
          }
          this._succeededEmitter.fire(prediction);
          this._lookBehind = prediction;
          this._expected.shift();
          break;
        }
        case 2 /* Buffer */:
          this._inputBuffer = input.slice(beforeTestReaderIndex);
          reader.index = input.length;
          break ReadLoop;
        case 1 /* Failure */: {
          const rollback = this._expected.filter((p) => p.gen === startingGen).reverse();
          output += rollback.map(({ p }) => p.rollback(this.physicalCursor(buffer))).join("");
          if (rollback.some((r) => r.p.affectsStyle)) {
            output += attributesToSeq(core(this.terminal)._inputHandler._curAttrData);
          }
          this._clearPredictionState();
          this._failedEmitter.fire(prediction);
          break ReadLoop;
        }
      }
    }
    emitPredictionOmitted();
    if (!reader.eof) {
      output += reader.rest;
      this._clearPredictionState();
    }
    if (this._expected.length && startingGen !== this._expected[0].gen) {
      for (const { p, gen } of this._expected) {
        if (gen !== this._expected[0].gen) {
          break;
        }
        if (p.affectsStyle) {
          this._style.expectIncomingStyle();
        }
        output += p.apply(buffer, this.physicalCursor(buffer));
      }
    }
    if (!this._showPredictions) {
      return originalInput;
    }
    if (output.length === 0 || output === input) {
      return output;
    }
    if (this._physicalCursor) {
      output += this._physicalCursor.moveInstruction();
    }
    output = "\x1B[?25l" /* HideCursor */ + output + "\x1B[?25h" /* ShowCursor */;
    return output;
  }
  /**
   * Clears any expected predictions and stored state. Should be called when
   * the pty gives us something we don't recognize.
   */
  _clearPredictionState() {
    this._expected = [];
    this.clearCursor();
    this._lookBehind = void 0;
  }
  /**
   * Appends a typeahead prediction.
   */
  addPrediction(buffer, prediction) {
    this._expected.push({ gen: this._currentGen, p: prediction });
    this._addedEmitter.fire(prediction);
    if (this._currentGen !== this._expected[0].gen) {
      prediction.apply(buffer, this.tentativeCursor(buffer));
      return false;
    }
    const text = prediction.apply(buffer, this.physicalCursor(buffer));
    this._tenativeCursor = void 0;
    if (this._showPredictions && text) {
      if (prediction.affectsStyle) {
        this._style.expectIncomingStyle();
      }
      this.terminal.write(text);
    }
    return true;
  }
  addBoundary(buffer, prediction) {
    let applied = false;
    if (buffer && prediction) {
      applied = this.addPrediction(buffer, new TentativeBoundary(prediction));
      prediction.apply(buffer, this.tentativeCursor(buffer));
    }
    this._currentGen++;
    return applied;
  }
  /**
   * Peeks the last prediction written.
   */
  peekEnd() {
    return this._expected[this._expected.length - 1]?.p;
  }
  /**
   * Peeks the first pending prediction.
   */
  peekStart() {
    return this._expected[0]?.p;
  }
  /**
   * Current position of the cursor in the terminal.
   */
  physicalCursor(buffer) {
    if (!this._physicalCursor) {
      if (this._showPredictions) {
        flushOutput(this.terminal);
      }
      this._physicalCursor = new Cursor(this.terminal.rows, this.terminal.cols, buffer);
    }
    return this._physicalCursor;
  }
  /**
   * Cursor position if all predictions and boundaries that have been inserted
   * so far turn out to be successfully predicted.
   */
  tentativeCursor(buffer) {
    if (!this._tenativeCursor) {
      this._tenativeCursor = this.physicalCursor(buffer).clone();
    }
    return this._tenativeCursor;
  }
  clearCursor() {
    this._physicalCursor = void 0;
    this._tenativeCursor = void 0;
  }
  _getActiveBuffer() {
    const buffer = this.terminal.buffer.active;
    return buffer.type === "normal" ? buffer : void 0;
  }
}
const attributesToArgs = (cell) => {
  if (cell.isAttributeDefault()) {
    return [0];
  }
  const args = [];
  if (cell.isBold()) {
    args.push(1);
  }
  if (cell.isDim()) {
    args.push(2);
  }
  if (cell.isItalic()) {
    args.push(3);
  }
  if (cell.isUnderline()) {
    args.push(4);
  }
  if (cell.isBlink()) {
    args.push(5);
  }
  if (cell.isInverse()) {
    args.push(7);
  }
  if (cell.isInvisible()) {
    args.push(8);
  }
  if (cell.isFgRGB()) {
    args.push(38, 2, cell.getFgColor() >>> 24, cell.getFgColor() >>> 16 & 255, cell.getFgColor() & 255);
  }
  if (cell.isFgPalette()) {
    args.push(38, 5, cell.getFgColor());
  }
  if (cell.isFgDefault()) {
    args.push(39);
  }
  if (cell.isBgRGB()) {
    args.push(48, 2, cell.getBgColor() >>> 24, cell.getBgColor() >>> 16 & 255, cell.getBgColor() & 255);
  }
  if (cell.isBgPalette()) {
    args.push(48, 5, cell.getBgColor());
  }
  if (cell.isBgDefault()) {
    args.push(49);
  }
  return args;
};
const attributesToSeq = (cell) => `${"\x1B[" /* Csi */}${attributesToArgs(cell).join(";")}m`;
const arrayHasPrefixAt = (a, ai, b) => {
  if (a.length - ai > b.length) {
    return false;
  }
  for (let bi = 0; bi < b.length; bi++, ai++) {
    if (b[ai] !== a[ai]) {
      return false;
    }
  }
  return true;
};
const getColorWidth = (params, pos) => {
  const accu = [0, 0, -1, 0, 0, 0];
  let cSpace = 0;
  let advance = 0;
  do {
    const v = params[pos + advance];
    accu[advance + cSpace] = isNumber(v) ? v : v[0];
    if (!isNumber(v)) {
      let i = 0;
      do {
        if (accu[1] === 5) {
          cSpace = 1;
        }
        accu[advance + i + 1 + cSpace] = v[i];
      } while (++i < v.length && i + advance + 1 + cSpace < accu.length);
      break;
    }
    if (accu[1] === 5 && advance + cSpace >= 2 || accu[1] === 2 && advance + cSpace >= 5) {
      break;
    }
    if (accu[1]) {
      cSpace = 1;
    }
  } while (++advance + pos < params.length && advance + cSpace < accu.length);
  return advance;
};
const _TypeAheadStyle = class _TypeAheadStyle {
  constructor(value, _terminal) {
    this._terminal = _terminal;
    /**
     * Number of typeahead style arguments we expect to read. If this is 0 and
     * we see a style coming in, we know that the PTY actually wanted to update.
     */
    this._expectedIncomingStyles = 0;
    this.onUpdate(value);
  }
  static _compileArgs(args) {
    return `${"\x1B[" /* Csi */}${args.join(";")}m`;
  }
  /**
   * Signals that a style was written to the terminal and we should watch
   * for it coming in.
   */
  expectIncomingStyle(n = 1) {
    this._expectedIncomingStyles += n * 2;
  }
  /**
   * Starts tracking for CSI changes in the terminal.
   */
  startTracking() {
    this._expectedIncomingStyles = 0;
    this._onDidWriteSGR(attributesToArgs(core(this._terminal)._inputHandler._curAttrData));
    this._csiHandler = this._terminal.parser.registerCsiHandler({ final: "m" }, (args) => {
      this._onDidWriteSGR(args);
      return false;
    });
  }
  debounceStopTracking() {
    this._stopTracking();
  }
  /**
   * @inheritdoc
   */
  dispose() {
    this._stopTracking();
  }
  _stopTracking() {
    this._csiHandler?.dispose();
    this._csiHandler = void 0;
  }
  _onDidWriteSGR(args) {
    const originalUndo = this._undoArgs;
    for (let i = 0; i < args.length; ) {
      const px = args[i];
      const p = isNumber(px) ? px : px[0];
      if (this._expectedIncomingStyles) {
        if (arrayHasPrefixAt(args, i, this._undoArgs)) {
          this._expectedIncomingStyles--;
          i += this._undoArgs.length;
          continue;
        }
        if (arrayHasPrefixAt(args, i, this._applyArgs)) {
          this._expectedIncomingStyles--;
          i += this._applyArgs.length;
          continue;
        }
      }
      const width = p === 38 || p === 48 || p === 58 ? getColorWidth(args, i) : 1;
      switch (this._applyArgs[0]) {
        case 1:
          if (p === 2) {
            this._undoArgs = [22, 2];
          } else if (p === 22 || p === 0) {
            this._undoArgs = [22];
          }
          break;
        case 2:
          if (p === 1) {
            this._undoArgs = [22, 1];
          } else if (p === 22 || p === 0) {
            this._undoArgs = [22];
          }
          break;
        case 38:
          if (p === 0 || p === 39 || p === 100) {
            this._undoArgs = [39];
          } else if (p >= 30 && p <= 38 || p >= 90 && p <= 97) {
            this._undoArgs = args.slice(i, i + width);
          }
          break;
        default:
          if (p === this._applyArgs[0]) {
            this._undoArgs = this._applyArgs;
          } else if (p === 0) {
            this._undoArgs = this._originalUndoArgs;
          }
      }
      i += width;
    }
    if (originalUndo !== this._undoArgs) {
      this.undo = _TypeAheadStyle._compileArgs(this._undoArgs);
    }
  }
  /**
   * Updates the current typeahead style.
   */
  onUpdate(style) {
    const { applyArgs, undoArgs } = this._getArgs(style);
    this._applyArgs = applyArgs;
    this._undoArgs = this._originalUndoArgs = undoArgs;
    this.apply = _TypeAheadStyle._compileArgs(this._applyArgs);
    this.undo = _TypeAheadStyle._compileArgs(this._undoArgs);
  }
  _getArgs(style) {
    switch (style) {
      case "bold":
        return { applyArgs: [1], undoArgs: [22] };
      case "dim":
        return { applyArgs: [2], undoArgs: [22] };
      case "italic":
        return { applyArgs: [3], undoArgs: [23] };
      case "underlined":
        return { applyArgs: [4], undoArgs: [24] };
      case "inverted":
        return { applyArgs: [7], undoArgs: [27] };
      default: {
        let color;
        try {
          color = Color.fromHex(style);
        } catch {
          color = new Color(new RGBA(255, 0, 0, 1));
        }
        const { r, g, b } = color.rgba;
        return { applyArgs: [38, 2, r, g, b], undoArgs: [39] };
      }
    }
  }
};
__decorateClass([
  debounce(2e3)
], _TypeAheadStyle.prototype, "debounceStopTracking", 1);
let TypeAheadStyle = _TypeAheadStyle;
const compileExcludeRegexp = (programs = DEFAULT_LOCAL_ECHO_EXCLUDE) => new RegExp(`\\b(${programs.map(escapeRegExpCharacters).join("|")})\\b`, "i");
var CharPredictState = /* @__PURE__ */ ((CharPredictState2) => {
  CharPredictState2[CharPredictState2["Unknown"] = 0] = "Unknown";
  CharPredictState2[CharPredictState2["HasPendingChar"] = 1] = "HasPendingChar";
  CharPredictState2[CharPredictState2["Validated"] = 2] = "Validated";
  return CharPredictState2;
})(CharPredictState || {});
let TypeAheadAddon = class extends Disposable {
  constructor(_processManager, _configurationService, _telemetryService) {
    super();
    this._processManager = _processManager;
    this._configurationService = _configurationService;
    this._telemetryService = _telemetryService;
    this._terminalTitle = "";
    this._typeaheadThreshold = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoLatencyThreshold;
    this._excludeProgramRe = compileExcludeRegexp(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoExcludePrograms);
    this._register(toDisposable(() => this._clearPredictionDebounce?.dispose()));
  }
  activate(terminal) {
    const style = this._typeaheadStyle = this._register(new TypeAheadStyle(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoStyle, terminal));
    const timeline = this._timeline = this._register(new PredictionTimeline(terminal, this._typeaheadStyle));
    const stats = this.stats = this._register(new PredictionStats(this._timeline));
    timeline.setShowPredictions(this._typeaheadThreshold === 0);
    this._register(terminal.onData((e) => this._onUserData(e)));
    this._register(terminal.onTitleChange((title) => {
      this._terminalTitle = title;
      this._reevaluatePredictorState(stats, timeline);
    }));
    this._register(terminal.onResize(() => {
      timeline.setShowPredictions(false);
      timeline.clearCursor();
      this._reevaluatePredictorState(stats, timeline);
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TERMINAL_CONFIG_SECTION)) {
        style.onUpdate(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoStyle);
        this._typeaheadThreshold = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoLatencyThreshold;
        this._excludeProgramRe = compileExcludeRegexp(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoExcludePrograms);
        this._reevaluatePredictorState(stats, timeline);
      }
    }));
    this._register(this._timeline.onPredictionSucceeded((p) => {
      if (this._lastRow?.charState === 1 /* HasPendingChar */ && isTenativeCharacterPrediction(p) && p.inner.appliedAt) {
        if (p.inner.appliedAt.pos.y + p.inner.appliedAt.pos.baseY === this._lastRow.y) {
          this._lastRow.charState = 2 /* Validated */;
        }
      }
    }));
    this._register(this._processManager.onBeforeProcessData((e) => this._onBeforeProcessData(e)));
    let nextStatsSend;
    this._register(stats.onChange(() => {
      if (!nextStatsSend) {
        nextStatsSend = setTimeout(() => {
          this._sendLatencyStats(stats);
          nextStatsSend = void 0;
        }, 3e5 /* StatsSendTelemetryEvery */);
      }
      if (timeline.length === 0) {
        style.debounceStopTracking();
      }
      this._reevaluatePredictorState(stats, timeline);
    }));
  }
  reset() {
    this._lastRow = void 0;
  }
  _deferClearingPredictions() {
    if (!this.stats || !this._timeline) {
      return;
    }
    this._clearPredictionDebounce?.dispose();
    if (this._timeline.length === 0 || this._timeline.peekStart()?.clearAfterTimeout === false) {
      this._clearPredictionDebounce = void 0;
      return;
    }
    this._clearPredictionDebounce = disposableTimeout(
      () => {
        this._timeline?.undoAllPredictions();
        if (this._lastRow?.charState === 1 /* HasPendingChar */) {
          this._lastRow.charState = 0 /* Unknown */;
        }
      },
      Math.max(500, this.stats.maxLatency * 3 / 2),
      this._store
    );
  }
  _reevaluatePredictorState(stats, timeline) {
    this._reevaluatePredictorStateNow(stats, timeline);
  }
  _reevaluatePredictorStateNow(stats, timeline) {
    if (this._excludeProgramRe.test(this._terminalTitle)) {
      timeline.setShowPredictions(false);
    } else if (this._typeaheadThreshold < 0) {
      timeline.setShowPredictions(false);
    } else if (this._typeaheadThreshold === 0) {
      timeline.setShowPredictions(true);
    } else if (stats.sampleSize > 5 /* StatsMinSamplesToTurnOn */ && stats.accuracy > 0.3 /* StatsMinAccuracyToTurnOn */) {
      const latency = stats.latency.median;
      if (latency >= this._typeaheadThreshold) {
        timeline.setShowPredictions(true);
      } else if (latency < this._typeaheadThreshold / 0.5 /* StatsToggleOffThreshold */) {
        timeline.setShowPredictions(false);
      }
    }
  }
  _sendLatencyStats(stats) {
    this._telemetryService.publicLog("terminalLatencyStats", {
      ...stats.latency,
      predictionAccuracy: stats.accuracy
    });
  }
  _onUserData(data) {
    if (this._timeline?.terminal.buffer.active.type !== "normal") {
      return;
    }
    const terminal = this._timeline.terminal;
    const buffer = terminal.buffer.active;
    if (buffer.cursorX === 1 && buffer.cursorY === terminal.rows - 1) {
      if (buffer.getLine(buffer.cursorY + buffer.baseY)?.getCell(0)?.getChars() === ":") {
        return;
      }
    }
    const actualY = buffer.baseY + buffer.cursorY;
    if (actualY !== this._lastRow?.y) {
      this._lastRow = { y: actualY, startingX: buffer.cursorX, endingX: buffer.cursorX, charState: 0 /* Unknown */ };
    } else {
      this._lastRow.startingX = Math.min(this._lastRow.startingX, buffer.cursorX);
      this._lastRow.endingX = Math.max(this._lastRow.endingX, this._timeline.physicalCursor(buffer).x);
    }
    const addLeftNavigating = (p) => this._timeline.tentativeCursor(buffer).x <= this._lastRow.startingX ? this._timeline.addBoundary(buffer, p) : this._timeline.addPrediction(buffer, p);
    const addRightNavigating = (p) => this._timeline.tentativeCursor(buffer).x >= this._lastRow.endingX - 1 ? this._timeline.addBoundary(buffer, p) : this._timeline.addPrediction(buffer, p);
    const reader = new StringReader(data);
    while (reader.remaining > 0) {
      if (reader.eatCharCode(127)) {
        const previous = this._timeline.peekEnd();
        if (previous && previous instanceof CharacterPrediction) {
          this._timeline.addBoundary();
        }
        if (this._timeline.isShowingPredictions) {
          flushOutput(this._timeline.terminal);
        }
        if (this._timeline.tentativeCursor(buffer).x <= this._lastRow.startingX) {
          this._timeline.addBoundary(buffer, new BackspacePrediction(this._timeline.terminal));
        } else {
          this._lastRow.endingX--;
          this._timeline.addPrediction(buffer, new BackspacePrediction(this._timeline.terminal));
        }
        continue;
      }
      if (reader.eatCharCode(32, 126)) {
        const char = data[reader.index - 1];
        const prediction = new CharacterPrediction(this._typeaheadStyle, char);
        if (this._lastRow.charState === 0 /* Unknown */) {
          this._timeline.addBoundary(buffer, prediction);
          this._lastRow.charState = 1 /* HasPendingChar */;
        } else {
          this._timeline.addPrediction(buffer, prediction);
        }
        if (this._timeline.tentativeCursor(buffer).x >= terminal.cols) {
          this._timeline.addBoundary(buffer, new LinewrapPrediction());
        }
        continue;
      }
      const cursorMv = reader.eatRe(CSI_MOVE_RE);
      if (cursorMv) {
        const direction = cursorMv[3];
        const p = new CursorMovePrediction(direction, !!cursorMv[2], Number(cursorMv[1]) || 1);
        if (direction === "D" /* Back */) {
          addLeftNavigating(p);
        } else {
          addRightNavigating(p);
        }
        continue;
      }
      if (reader.eatStr(`${"\x1B" /* Esc */}f`)) {
        addRightNavigating(new CursorMovePrediction("C" /* Forwards */, true, 1));
        continue;
      }
      if (reader.eatStr(`${"\x1B" /* Esc */}b`)) {
        addLeftNavigating(new CursorMovePrediction("D" /* Back */, true, 1));
        continue;
      }
      if (reader.eatChar("\r") && buffer.cursorY < terminal.rows - 1) {
        this._timeline.addPrediction(buffer, new NewlinePrediction());
        continue;
      }
      this._timeline.addBoundary(buffer, new HardBoundary());
      break;
    }
    if (this._timeline.length === 1) {
      this._deferClearingPredictions();
      this._typeaheadStyle.startTracking();
    }
  }
  _onBeforeProcessData(event) {
    if (!this._timeline) {
      return;
    }
    event.data = this._timeline.beforeServerInput(event.data);
    this._deferClearingPredictions();
  }
};
__decorateClass([
  debounce(100)
], TypeAheadAddon.prototype, "_reevaluatePredictorState", 1);
TypeAheadAddon = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITelemetryService)
], TypeAheadAddon);
export {
  CharPredictState,
  PredictionStats,
  PredictionTimeline,
  TypeAheadAddon
};
