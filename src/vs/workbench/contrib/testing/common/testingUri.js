import { assertNever } from "../../../../base/common/assert.js";
import { URI } from "../../../../base/common/uri.js";
const TEST_DATA_SCHEME = "vscode-test-data";
var TestUriType = /* @__PURE__ */ ((TestUriType2) => {
  TestUriType2[TestUriType2["TaskOutput"] = 0] = "TaskOutput";
  TestUriType2[TestUriType2["TestOutput"] = 1] = "TestOutput";
  TestUriType2[TestUriType2["ResultMessage"] = 2] = "ResultMessage";
  TestUriType2[TestUriType2["ResultActualOutput"] = 3] = "ResultActualOutput";
  TestUriType2[TestUriType2["ResultExpectedOutput"] = 4] = "ResultExpectedOutput";
  return TestUriType2;
})(TestUriType || {});
var TestUriParts = /* @__PURE__ */ ((TestUriParts2) => {
  TestUriParts2["Results"] = "results";
  TestUriParts2["AllOutput"] = "output";
  TestUriParts2["Messages"] = "message";
  TestUriParts2["Text"] = "TestFailureMessage";
  TestUriParts2["ActualOutput"] = "ActualOutput";
  TestUriParts2["ExpectedOutput"] = "ExpectedOutput";
  return TestUriParts2;
})(TestUriParts || {});
const parseTestUri = (uri) => {
  const type = uri.authority;
  const [resultId, ...request] = uri.path.slice(1).split("/");
  if (request[0] === "message" /* Messages */) {
    const taskIndex = Number(request[1]);
    const testExtId = uri.query;
    const index = Number(request[2]);
    const part = request[3];
    if (type === "results" /* Results */) {
      switch (part) {
        case "TestFailureMessage" /* Text */:
          return { resultId, taskIndex, testExtId, messageIndex: index, type: 2 /* ResultMessage */ };
        case "ActualOutput" /* ActualOutput */:
          return { resultId, taskIndex, testExtId, messageIndex: index, type: 3 /* ResultActualOutput */ };
        case "ExpectedOutput" /* ExpectedOutput */:
          return { resultId, taskIndex, testExtId, messageIndex: index, type: 4 /* ResultExpectedOutput */ };
        case "message" /* Messages */:
      }
    }
  }
  if (request[0] === "output" /* AllOutput */) {
    const testExtId = uri.query;
    const taskIndex = Number(request[1]);
    return testExtId ? { resultId, taskIndex, testExtId, type: 1 /* TestOutput */ } : { resultId, taskIndex, type: 0 /* TaskOutput */ };
  }
  return void 0;
};
const buildTestUri = (parsed) => {
  const uriParts = {
    scheme: TEST_DATA_SCHEME,
    authority: "results" /* Results */
  };
  if (parsed.type === 0 /* TaskOutput */) {
    return URI.from({
      ...uriParts,
      path: ["", parsed.resultId, "output" /* AllOutput */, parsed.taskIndex].join("/")
    });
  }
  const msgRef = (resultId, ...remaining) => URI.from({
    ...uriParts,
    query: parsed.testExtId,
    path: ["", resultId, "message" /* Messages */, ...remaining].join("/")
  });
  switch (parsed.type) {
    case 3 /* ResultActualOutput */:
      return msgRef(parsed.resultId, parsed.taskIndex, parsed.messageIndex, "ActualOutput" /* ActualOutput */);
    case 4 /* ResultExpectedOutput */:
      return msgRef(parsed.resultId, parsed.taskIndex, parsed.messageIndex, "ExpectedOutput" /* ExpectedOutput */);
    case 2 /* ResultMessage */:
      return msgRef(parsed.resultId, parsed.taskIndex, parsed.messageIndex, "TestFailureMessage" /* Text */);
    case 1 /* TestOutput */:
      return URI.from({
        ...uriParts,
        query: parsed.testExtId,
        path: ["", parsed.resultId, "output" /* AllOutput */, parsed.taskIndex].join("/")
      });
    default:
      assertNever(parsed, "Invalid test uri");
  }
};
export {
  TEST_DATA_SCHEME,
  TestUriType,
  buildTestUri,
  parseTestUri
};
