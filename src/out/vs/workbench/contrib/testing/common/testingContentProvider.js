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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../base/common/strings.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { ITestResultService } from "./testResultService.js";
import { TestMessageType } from "./testTypes.js";
import { TEST_DATA_SCHEME, TestUriType, parseTestUri } from "./testingUri.js";
let TestingContentProvider = class {
  constructor(textModelResolverService, languageService, modelService, resultService) {
    this.languageService = languageService;
    this.modelService = modelService;
    this.resultService = resultService;
    textModelResolverService.registerTextModelContentProvider(TEST_DATA_SCHEME, this);
  }
  static {
    this.ID = "workbench.contrib.testing.contentProvider";
  }
  /**
   * @inheritdoc
   */
  async provideTextContent(resource) {
    const existing = this.modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    const parsed = parseTestUri(resource);
    if (!parsed) {
      return null;
    }
    const result = this.resultService.getResult(parsed.resultId);
    if (!result) {
      return null;
    }
    if (parsed.type === TestUriType.TaskOutput) {
      const task = result.tasks[parsed.taskIndex];
      const model = this.modelService.createModel("", null, resource, false);
      const append = (text2) => model.applyEdits([{
        range: { startColumn: 1, endColumn: 1, startLineNumber: Infinity, endLineNumber: Infinity },
        text: text2
      }]);
      const init = VSBuffer.concat(task.output.buffers, task.output.length).toString();
      append(removeAnsiEscapeCodes(init));
      let hadContent = init.length > 0;
      const dispose = new DisposableStore();
      dispose.add(task.output.onDidWriteData((d) => {
        hadContent ||= d.byteLength > 0;
        append(removeAnsiEscapeCodes(d.toString()));
      }));
      task.output.endPromise.then(() => {
        if (dispose.isDisposed) {
          return;
        }
        if (!hadContent) {
          append(localize("runNoOutout", "The test run did not record any output."));
          dispose.dispose();
        }
      });
      dispose.add(model.onWillDispose(() => dispose.dispose()));
      return model;
    }
    const test = result?.getStateById(parsed.testExtId);
    if (!test) {
      return null;
    }
    let text;
    let language = null;
    switch (parsed.type) {
      case TestUriType.ResultActualOutput: {
        const message = test.tasks[parsed.taskIndex].messages[parsed.messageIndex];
        if (message?.type === TestMessageType.Error) {
          text = message.actual;
        }
        break;
      }
      case TestUriType.TestOutput: {
        text = "";
        const output = result.tasks[parsed.taskIndex].output;
        for (const message of test.tasks[parsed.taskIndex].messages) {
          if (message.type === TestMessageType.Output) {
            text += removeAnsiEscapeCodes(output.getRange(message.offset, message.length).toString());
          }
        }
        break;
      }
      case TestUriType.ResultExpectedOutput: {
        const message = test.tasks[parsed.taskIndex].messages[parsed.messageIndex];
        if (message?.type === TestMessageType.Error) {
          text = message.expected;
        }
        break;
      }
      case TestUriType.ResultMessage: {
        const message = test.tasks[parsed.taskIndex].messages[parsed.messageIndex];
        if (!message) {
          break;
        }
        if (message.type === TestMessageType.Output) {
          const content = result.tasks[parsed.taskIndex].output.getRange(message.offset, message.length);
          text = removeAnsiEscapeCodes(content.toString());
        } else if (typeof message.message === "string") {
          text = removeAnsiEscapeCodes(message.message);
        } else {
          text = message.message.value;
          language = this.languageService.createById("markdown");
        }
      }
    }
    if (text === void 0) {
      return null;
    }
    return this.modelService.createModel(text, language, resource, false);
  }
};
TestingContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ITestResultService)
], TestingContentProvider);
export {
  TestingContentProvider
};
