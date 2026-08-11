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
import { DeferredPromise } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { language } from "../../../../base/common/platform.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { localize } from "../../../../nls.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { refreshComputedState } from "./getComputedState.js";
import { TestId } from "./testId.js";
import { makeEmptyCounts, maxPriority, statesInOrder, terminalStatePriorities } from "./testingStates.js";
import { getMarkId, TestItemExpandState, TestMessageType, TestResultItem, TestResultState } from "./testTypes.js";
const emptyRawOutput = {
  buffers: [],
  length: 0,
  onDidWriteData: Event.None,
  endPromise: Promise.resolve(),
  getRange: () => VSBuffer.alloc(0),
  getRangeIter: () => []
};
class TaskRawOutput {
  constructor() {
    this.writeDataEmitter = new Emitter();
    this.endDeferred = new DeferredPromise();
    this.offset = 0;
    /** @inheritdoc */
    this.onDidWriteData = this.writeDataEmitter.event;
    /** @inheritdoc */
    this.endPromise = this.endDeferred.p;
    /** @inheritdoc */
    this.buffers = [];
  }
  /** @inheritdoc */
  get length() {
    return this.offset;
  }
  /** @inheritdoc */
  getRange(start, length) {
    const buf = VSBuffer.alloc(length);
    let bufLastWrite = 0;
    for (const chunk of this.getRangeIter(start, length)) {
      buf.buffer.set(chunk.buffer, bufLastWrite);
      bufLastWrite += chunk.byteLength;
    }
    return bufLastWrite < length ? buf.slice(0, bufLastWrite) : buf;
  }
  /** @inheritdoc */
  *getRangeIter(start, length) {
    let soFar = 0;
    let internalLastRead = 0;
    for (const b of this.buffers) {
      if (internalLastRead + b.byteLength <= start) {
        internalLastRead += b.byteLength;
        continue;
      }
      const bstart = Math.max(0, start - internalLastRead);
      const bend = Math.min(b.byteLength, bstart + length - soFar);
      yield b.slice(bstart, bend);
      soFar += bend - bstart;
      internalLastRead += b.byteLength;
      if (soFar === length) {
        break;
      }
    }
  }
  /**
   * Appends data to the output, returning the byte range where the data can be found.
   */
  append(data, marker) {
    const offset = this.offset;
    let length = data.byteLength;
    if (marker === void 0) {
      this.push(data);
      return { offset, length };
    }
    let TrimBytes;
    ((TrimBytes2) => {
      TrimBytes2[TrimBytes2["CR"] = 13] = "CR";
      TrimBytes2[TrimBytes2["LF"] = 10] = "LF";
    })(TrimBytes || (TrimBytes = {}));
    const start = VSBuffer.fromString(getMarkCode(marker, true));
    const end = VSBuffer.fromString(getMarkCode(marker, false));
    length += start.byteLength + end.byteLength;
    this.push(start);
    let trimLen = data.byteLength;
    for (; trimLen > 0; trimLen--) {
      const last = data.buffer[trimLen - 1];
      if (last !== 13 /* CR */ && last !== 10 /* LF */) {
        break;
      }
    }
    this.push(data.slice(0, trimLen));
    this.push(end);
    this.push(data.slice(trimLen));
    return { offset, length };
  }
  push(data) {
    if (data.byteLength === 0) {
      return;
    }
    this.buffers.push(data);
    this.writeDataEmitter.fire(data);
    this.offset += data.byteLength;
  }
  /** Signals the output has ended. */
  end() {
    this.endDeferred.complete();
  }
}
const resultItemParents = function* (results, item) {
  for (const id of TestId.fromString(item.item.extId).idsToRoot()) {
    yield results.getStateById(id.toString());
  }
};
const maxCountPriority = (counts) => {
  for (const state of statesInOrder) {
    if (counts[state] > 0) {
      return state;
    }
  }
  return TestResultState.Unset;
};
const getMarkCode = (marker, start) => `\x1B]633;SetMark;Id=${getMarkId(marker, start)};Hidden\x07`;
const itemToNode = (controllerId, item, parent) => ({
  controllerId,
  expand: TestItemExpandState.NotExpandable,
  item: { ...item },
  children: [],
  tasks: [],
  ownComputedState: TestResultState.Unset,
  computedState: TestResultState.Unset
});
var TestResultItemChangeReason = /* @__PURE__ */ ((TestResultItemChangeReason2) => {
  TestResultItemChangeReason2[TestResultItemChangeReason2["ComputedStateChange"] = 0] = "ComputedStateChange";
  TestResultItemChangeReason2[TestResultItemChangeReason2["OwnStateChange"] = 1] = "OwnStateChange";
  TestResultItemChangeReason2[TestResultItemChangeReason2["NewMessage"] = 2] = "NewMessage";
  return TestResultItemChangeReason2;
})(TestResultItemChangeReason || {});
let LiveTestResult = class extends Disposable {
  constructor(id, persist, request, insertOrder, telemetry) {
    super();
    this.id = id;
    this.persist = persist;
    this.request = request;
    this.insertOrder = insertOrder;
    this.telemetry = telemetry;
    this.completeEmitter = this._register(new Emitter());
    this.newTaskEmitter = this._register(new Emitter());
    this.endTaskEmitter = this._register(new Emitter());
    this.changeEmitter = this._register(new Emitter());
    /** todo@connor4312: convert to a WellDefinedPrefixTree */
    this.testById = /* @__PURE__ */ new Map();
    this.testMarkerCounter = 0;
    this.startedAt = Date.now();
    this.onChange = this.changeEmitter.event;
    this.onComplete = this.completeEmitter.event;
    this.onNewTask = this.newTaskEmitter.event;
    this.onEndTask = this.endTaskEmitter.event;
    this.tasks = [];
    this.name = localize("runFinished", "Test run at {0}", (/* @__PURE__ */ new Date()).toLocaleString(language));
    /**
     * @inheritdoc
     */
    this.counts = makeEmptyCounts();
    this.computedStateAccessor = {
      getOwnState: (i) => i.ownComputedState,
      getCurrentComputedState: (i) => i.computedState,
      setComputedState: (i, s) => i.computedState = s,
      getChildren: (i) => i.children,
      getParents: (i) => {
        const { testById: testByExtId } = this;
        return (function* () {
          const parentId = TestId.fromString(i.item.extId).parentId;
          if (parentId) {
            for (const id of parentId.idsToRoot()) {
              yield testByExtId.get(id.toString());
            }
          }
        })();
      }
    };
    this.doSerialize = new Lazy(() => ({
      id: this.id,
      completedAt: this.completedAt,
      tasks: this.tasks.map((t) => ({ id: t.id, name: t.name, ctrlId: t.ctrlId, hasCoverage: !!t.coverage.get() })),
      name: this.name,
      request: this.request,
      items: [...this.testById.values()].map(TestResultItem.serializeWithoutMessages)
    }));
    this.doSerializeWithMessages = new Lazy(() => ({
      id: this.id,
      completedAt: this.completedAt,
      tasks: this.tasks.map((t) => ({ id: t.id, name: t.name, ctrlId: t.ctrlId, hasCoverage: !!t.coverage.get() })),
      name: this.name,
      request: this.request,
      items: [...this.testById.values()].map(TestResultItem.serialize)
    }));
  }
  /**
   * @inheritdoc
   */
  get completedAt() {
    return this._completedAt;
  }
  /**
   * @inheritdoc
   */
  get tests() {
    return this.testById.values();
  }
  /** Gets an included test item by ID. */
  getTestById(id) {
    return this.testById.get(id)?.item;
  }
  /**
   * @inheritdoc
   */
  getStateById(extTestId) {
    return this.testById.get(extTestId);
  }
  /**
   * Appends output that occurred during the test run.
   */
  appendOutput(output, taskId, location, testId) {
    const rawPreview = output.byteLength > 100 ? output.slice(0, 100).toString() + "\u2026" : output.toString();
    const preview = removeAnsiEscapeCodes(rawPreview);
    let marker;
    if (testId || location) {
      marker = this.testMarkerCounter++;
    }
    const index = this.mustGetTaskIndex(taskId);
    const task = this.tasks[index];
    const { offset, length } = task.output.append(output, marker);
    const message = {
      location,
      message: preview,
      offset,
      length,
      marker,
      type: TestMessageType.Output
    };
    const test = testId && this.testById.get(testId);
    if (test) {
      test.tasks[index].messages.push(message);
      this.changeEmitter.fire({ item: test, result: this, reason: 2 /* NewMessage */, message });
    } else {
      task.otherMessages.push(message);
    }
  }
  /**
   * Adds a new run task to the results.
   */
  addTask(task) {
    this.tasks.push({ ...task, coverage: observableValue(this, void 0), otherMessages: [], output: new TaskRawOutput() });
    for (const test of this.tests) {
      test.tasks.push({ duration: void 0, messages: [], state: TestResultState.Unset });
    }
    this.newTaskEmitter.fire(this.tasks.length - 1);
  }
  /**
   * Add the chain of tests to the run. The first test in the chain should
   * be either a test root, or a previously-known test.
   */
  addTestChainToRun(controllerId, chain) {
    let parent = this.testById.get(chain[0].extId);
    if (!parent) {
      parent = this.addTestToRun(controllerId, chain[0], null);
    }
    for (let i = 1; i < chain.length; i++) {
      parent = this.addTestToRun(controllerId, chain[i], parent.item.extId);
    }
    return void 0;
  }
  /**
   * Updates the state of the test by its internal ID.
   */
  updateState(testId, taskId, state, duration) {
    const entry = this.testById.get(testId);
    if (!entry) {
      return;
    }
    const index = this.mustGetTaskIndex(taskId);
    const oldTerminalStatePrio = terminalStatePriorities[entry.tasks[index].state];
    const newTerminalStatePrio = terminalStatePriorities[state];
    if (oldTerminalStatePrio !== void 0 && (newTerminalStatePrio === void 0 || newTerminalStatePrio < oldTerminalStatePrio)) {
      return;
    }
    this.fireUpdateAndRefresh(entry, index, state, duration);
  }
  /**
   * Appends a message for the test in the run.
   */
  appendMessage(testId, taskId, message) {
    const entry = this.testById.get(testId);
    if (!entry) {
      return;
    }
    entry.tasks[this.mustGetTaskIndex(taskId)].messages.push(message);
    this.changeEmitter.fire({ item: entry, result: this, reason: 2 /* NewMessage */, message });
  }
  /**
   * Marks the task in the test run complete.
   */
  markTaskComplete(taskId) {
    const index = this.mustGetTaskIndex(taskId);
    const task = this.tasks[index];
    task.running = false;
    task.output.end();
    this.setAllToState(
      TestResultState.Skipped,
      taskId,
      (t) => t.state === TestResultState.Queued || t.state === TestResultState.Running
    );
    this.endTaskEmitter.fire(index);
  }
  /**
   * Notifies the service that all tests are complete.
   */
  markComplete() {
    if (this._completedAt !== void 0) {
      throw new Error("cannot complete a test result multiple times");
    }
    for (const task of this.tasks) {
      if (task.running) {
        this.markTaskComplete(task.id);
      }
    }
    this._completedAt = Date.now();
    this.completeEmitter.fire();
    this.telemetry.publicLog2("test.outcomes", {
      failures: this.counts[TestResultState.Errored] + this.counts[TestResultState.Failed],
      passes: this.counts[TestResultState.Passed],
      controller: this.request.targets.map((t) => t.controllerId).join(",")
    });
  }
  /**
   * Marks the test and all of its children in the run as retired.
   */
  markRetired(testIds) {
    for (const [id, test] of this.testById) {
      if (!test.retired && (!testIds || testIds.hasKeyOrParent(TestId.fromString(id).path))) {
        test.retired = true;
        this.changeEmitter.fire({ reason: 0 /* ComputedStateChange */, item: test, result: this });
      }
    }
  }
  /**
   * @inheritdoc
   */
  toJSON() {
    return this.completedAt && this.persist ? this.doSerialize.value : void 0;
  }
  toJSONWithMessages() {
    return this.completedAt && this.persist ? this.doSerializeWithMessages.value : void 0;
  }
  /**
   * Updates all tests in the collection to the given state.
   */
  setAllToState(state, taskId, when) {
    const index = this.mustGetTaskIndex(taskId);
    for (const test of this.testById.values()) {
      if (when(test.tasks[index], test)) {
        this.fireUpdateAndRefresh(test, index, state);
      }
    }
  }
  fireUpdateAndRefresh(entry, taskIndex, newState, newOwnDuration) {
    const previousOwnComputed = entry.ownComputedState;
    const previousOwnDuration = entry.ownDuration;
    const changeEvent = {
      item: entry,
      result: this,
      reason: 1 /* OwnStateChange */,
      previousState: previousOwnComputed,
      previousOwnDuration
    };
    entry.tasks[taskIndex].state = newState;
    if (newOwnDuration !== void 0) {
      entry.tasks[taskIndex].duration = newOwnDuration;
      entry.ownDuration = Math.max(entry.ownDuration || 0, newOwnDuration);
    }
    const newOwnComputed = maxPriority(...entry.tasks.map((t) => t.state));
    if (newOwnComputed === previousOwnComputed) {
      if (newOwnDuration !== previousOwnDuration) {
        this.changeEmitter.fire(changeEvent);
      }
      return;
    }
    entry.ownComputedState = newOwnComputed;
    this.counts[previousOwnComputed]--;
    this.counts[newOwnComputed]++;
    refreshComputedState(this.computedStateAccessor, entry).forEach(
      (t) => this.changeEmitter.fire(t === entry ? changeEvent : {
        item: t,
        result: this,
        reason: 0 /* ComputedStateChange */
      })
    );
  }
  addTestToRun(controllerId, item, parent) {
    const node = itemToNode(controllerId, item, parent);
    this.testById.set(item.extId, node);
    this.counts[TestResultState.Unset]++;
    if (parent) {
      this.testById.get(parent)?.children.push(node);
    }
    if (this.tasks.length) {
      for (let i = 0; i < this.tasks.length; i++) {
        node.tasks.push({ duration: void 0, messages: [], state: TestResultState.Unset });
      }
    }
    return node;
  }
  mustGetTaskIndex(taskId) {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
      throw new Error(`Unknown task ${taskId} in updateState`);
    }
    return index;
  }
};
LiveTestResult = __decorateClass([
  __decorateParam(4, ITelemetryService)
], LiveTestResult);
class HydratedTestResult {
  constructor(identity, serialized, persist = true) {
    this.serialized = serialized;
    this.persist = persist;
    /**
     * @inheritdoc
     */
    this.counts = makeEmptyCounts();
    this.testById = /* @__PURE__ */ new Map();
    this.id = serialized.id;
    this.completedAt = serialized.completedAt;
    this.tasks = serialized.tasks.map((task, i) => ({
      id: task.id,
      name: task.name || localize("testUnnamedTask", "Unnamed Task"),
      ctrlId: task.ctrlId,
      running: false,
      coverage: observableValue(this, void 0),
      output: emptyRawOutput,
      otherMessages: []
    }));
    this.name = serialized.name;
    this.request = serialized.request;
    for (const item of serialized.items) {
      const de = TestResultItem.deserialize(identity, item);
      this.counts[de.ownComputedState]++;
      this.testById.set(item.item.extId, de);
    }
  }
  /**
   * @inheritdoc
   */
  get tests() {
    return this.testById.values();
  }
  /**
   * @inheritdoc
   */
  getStateById(extTestId) {
    return this.testById.get(extTestId);
  }
  /**
   * @inheritdoc
   */
  toJSON() {
    return this.persist ? this.serialized : void 0;
  }
  /**
   * @inheritdoc
   */
  toJSONWithMessages() {
    return this.toJSON();
  }
}
export {
  HydratedTestResult,
  LiveTestResult,
  TaskRawOutput,
  TestResultItemChangeReason,
  maxCountPriority,
  resultItemParents
};
