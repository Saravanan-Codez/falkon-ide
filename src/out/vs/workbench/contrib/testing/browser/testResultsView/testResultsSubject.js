import { MarshalledId } from "../../../../../base/common/marshallingIds.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TestId } from "../../common/testId.js";
import { ITestMessage, InternalTestItem, TestMessageType } from "../../common/testTypes.js";
import { TestUriType, buildTestUri } from "../../common/testingUri.js";
const getMessageArgs = (test, message) => ({
  $mid: MarshalledId.TestMessageMenuArgs,
  test: InternalTestItem.serialize(test),
  message: ITestMessage.serialize(message)
});
const inspectSubjectHasStack = (subject) => subject instanceof MessageSubject && !!subject.stack?.length;
class MessageSubject {
  constructor(result, test, taskIndex, messageIndex) {
    this.result = result;
    this.taskIndex = taskIndex;
    this.messageIndex = messageIndex;
    this.test = test.item;
    const messages = test.tasks[taskIndex].messages;
    this.messageIndex = messageIndex;
    const parts = { messageIndex, resultId: result.id, taskIndex, testExtId: test.item.extId };
    this.expectedUri = buildTestUri({ ...parts, type: TestUriType.ResultExpectedOutput });
    this.actualUri = buildTestUri({ ...parts, type: TestUriType.ResultActualOutput });
    this.messageUri = buildTestUri({ ...parts, type: TestUriType.ResultMessage });
    const message = this.message = messages[this.messageIndex];
    this.context = getMessageArgs(test, message);
    this.revealLocation = message.location ?? (test.item.uri && test.item.range ? { uri: test.item.uri, range: Range.lift(test.item.range) } : void 0);
  }
  get controllerId() {
    return TestId.root(this.test.extId);
  }
  get isDiffable() {
    return this.message.type === TestMessageType.Error && ITestMessage.isDiffable(this.message);
  }
  get contextValue() {
    return this.message.type === TestMessageType.Error ? this.message.contextValue : void 0;
  }
  get stack() {
    return this.message.type === TestMessageType.Error && this.message.stackTrace?.length ? this.message.stackTrace : void 0;
  }
}
class TaskSubject {
  constructor(result, taskIndex) {
    this.result = result;
    this.taskIndex = taskIndex;
    this.outputUri = buildTestUri({ resultId: result.id, taskIndex, type: TestUriType.TaskOutput });
  }
  get controllerId() {
    return this.result.tasks[this.taskIndex].ctrlId;
  }
}
class TestOutputSubject {
  constructor(result, taskIndex, test) {
    this.result = result;
    this.taskIndex = taskIndex;
    this.test = test;
    this.outputUri = buildTestUri({ resultId: this.result.id, taskIndex: this.taskIndex, testExtId: this.test.item.extId, type: TestUriType.TestOutput });
    this.task = result.tasks[this.taskIndex];
  }
  get controllerId() {
    return TestId.root(this.test.item.extId);
  }
}
const equalsSubject = (a, b) => a instanceof MessageSubject && b instanceof MessageSubject && a.message === b.message || a instanceof TaskSubject && b instanceof TaskSubject && a.result === b.result && a.taskIndex === b.taskIndex || a instanceof TestOutputSubject && b instanceof TestOutputSubject && a.test === b.test && a.taskIndex === b.taskIndex;
const mapFindTestMessage = (test, fn) => {
  for (let taskIndex = 0; taskIndex < test.tasks.length; taskIndex++) {
    const task = test.tasks[taskIndex];
    for (let messageIndex = 0; messageIndex < task.messages.length; messageIndex++) {
      const r = fn(task, task.messages[messageIndex], messageIndex, taskIndex);
      if (r !== void 0) {
        return r;
      }
    }
  }
  return void 0;
};
const getSubjectTestItem = (subject) => {
  if (subject instanceof MessageSubject) {
    return subject.test;
  }
  if (subject instanceof TaskSubject) {
    return void 0;
  }
  return subject.test.item;
};
export {
  MessageSubject,
  TaskSubject,
  TestOutputSubject,
  equalsSubject,
  getMessageArgs,
  getSubjectTestItem,
  inspectSubjectHasStack,
  mapFindTestMessage
};
