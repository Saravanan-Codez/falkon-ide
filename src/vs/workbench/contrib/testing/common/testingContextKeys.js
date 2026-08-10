import { localize } from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { TestExplorerViewMode, TestExplorerViewSorting } from "./constants.js";
import { TestRunProfileBitset } from "./testTypes.js";
var TestingContextKeys;
((TestingContextKeys2) => {
  TestingContextKeys2.providerCount = new RawContextKey("testing.providerCount", 0);
  TestingContextKeys2.canRefreshTests = new RawContextKey("testing.canRefresh", false, { type: "boolean", description: localize("testing.canRefresh", "Indicates whether any test controller has an attached refresh handler.") });
  TestingContextKeys2.isRefreshingTests = new RawContextKey("testing.isRefreshing", false, { type: "boolean", description: localize("testing.isRefreshing", "Indicates whether any test controller is currently refreshing tests.") });
  TestingContextKeys2.isContinuousModeOn = new RawContextKey("testing.isContinuousModeOn", false, { type: "boolean", description: localize("testing.isContinuousModeOn", "Indicates whether continuous test mode is on.") });
  TestingContextKeys2.hasDebuggableTests = new RawContextKey("testing.hasDebuggableTests", false, { type: "boolean", description: localize("testing.hasDebuggableTests", "Indicates whether any test controller has registered a debug configuration") });
  TestingContextKeys2.hasRunnableTests = new RawContextKey("testing.hasRunnableTests", false, { type: "boolean", description: localize("testing.hasRunnableTests", "Indicates whether any test controller has registered a run configuration") });
  TestingContextKeys2.hasCoverableTests = new RawContextKey("testing.hasCoverableTests", false, { type: "boolean", description: localize("testing.hasCoverableTests", "Indicates whether any test controller has registered a coverage configuration") });
  TestingContextKeys2.hasNonDefaultProfile = new RawContextKey("testing.hasNonDefaultProfile", false, { type: "boolean", description: localize("testing.hasNonDefaultConfig", "Indicates whether any test controller has registered a non-default configuration") });
  TestingContextKeys2.hasConfigurableProfile = new RawContextKey("testing.hasConfigurableProfile", false, { type: "boolean", description: localize("testing.hasConfigurableConfig", "Indicates whether any test configuration can be configured") });
  TestingContextKeys2.supportsContinuousRun = new RawContextKey("testing.supportsContinuousRun", false, { type: "boolean", description: localize("testing.supportsContinuousRun", "Indicates whether continuous test running is supported") });
  TestingContextKeys2.isParentRunningContinuously = new RawContextKey("testing.isParentRunningContinuously", false, { type: "boolean", description: localize("testing.isParentRunningContinuously", "Indicates whether the parent of a test is continuously running, set in the menu context of test items") });
  TestingContextKeys2.activeEditorHasTests = new RawContextKey("testing.activeEditorHasTests", false, { type: "boolean", description: localize("testing.activeEditorHasTests", "Indicates whether any tests are present in the current editor") });
  TestingContextKeys2.cursorInsideTestRange = new RawContextKey("testing.cursorInsideTestRange", false, { type: "boolean", description: localize("testing.cursorInsideTestRange", "Whether the cursor is currently inside a test range") });
  TestingContextKeys2.isTestCoverageOpen = new RawContextKey("testing.isTestCoverageOpen", false, { type: "boolean", description: localize("testing.isTestCoverageOpen", "Indicates whether a test coverage report is open") });
  TestingContextKeys2.hasCoverageInFile = new RawContextKey("testing.hasCoverageInFile", false, { type: "boolean", description: localize("testing.hasCoverageInFile", "Indicates coverage has been reported in the curent editor.") });
  TestingContextKeys2.hasPerTestCoverage = new RawContextKey("testing.hasPerTestCoverage", false, { type: "boolean", description: localize("testing.hasPerTestCoverage", "Indicates whether per-test coverage is available") });
  TestingContextKeys2.hasInlineCoverageDetails = new RawContextKey("testing.hasInlineCoverageDetails", false, { type: "boolean", description: localize("testing.hasInlineCoverageDetails", "Indicates whether detailed per-line coverage is available for inline display") });
  TestingContextKeys2.isCoverageFilteredToTest = new RawContextKey("testing.isCoverageFilteredToTest", false, { type: "boolean", description: localize("testing.isCoverageFilteredToTest", "Indicates whether coverage has been filterd to a single test") });
  TestingContextKeys2.coverageToolbarEnabled = new RawContextKey("testing.coverageToolbarEnabled", true, { type: "boolean", description: localize("testing.coverageToolbarEnabled", "Indicates whether the coverage toolbar is enabled") });
  TestingContextKeys2.inlineCoverageEnabled = new RawContextKey("testing.inlineCoverageEnabled", false, { type: "boolean", description: localize("testing.inlineCoverageEnabled", "Indicates whether inline coverage is shown") });
  TestingContextKeys2.canGoToRelatedCode = new RawContextKey("testing.canGoToRelatedCode", false, { type: "boolean", description: localize("testing.canGoToRelatedCode", "Whether a controller implements a capability to find code related to a test") });
  TestingContextKeys2.canGoToRelatedTest = new RawContextKey("testing.canGoToRelatedTest", false, { type: "boolean", description: localize("testing.canGoToRelatedTest", "Whether a controller implements a capability to find tests related to code") });
  TestingContextKeys2.peekHasStack = new RawContextKey("testing.peekHasStack", false, { type: "boolean", description: localize("testing.peekHasStack", "Whether the message shown in a peek view has a stack trace") });
  TestingContextKeys2.capabilityToContextKey = {
    [TestRunProfileBitset.Run]: TestingContextKeys2.hasRunnableTests,
    [TestRunProfileBitset.Coverage]: TestingContextKeys2.hasCoverableTests,
    [TestRunProfileBitset.Debug]: TestingContextKeys2.hasDebuggableTests,
    [TestRunProfileBitset.HasNonDefaultProfile]: TestingContextKeys2.hasNonDefaultProfile,
    [TestRunProfileBitset.HasConfigurable]: TestingContextKeys2.hasConfigurableProfile,
    [TestRunProfileBitset.SupportsContinuousRun]: TestingContextKeys2.supportsContinuousRun
  };
  TestingContextKeys2.hasAnyResults = new RawContextKey("testing.hasAnyResults", false);
  TestingContextKeys2.viewMode = new RawContextKey("testing.explorerViewMode", TestExplorerViewMode.List);
  TestingContextKeys2.viewSorting = new RawContextKey("testing.explorerViewSorting", TestExplorerViewSorting.ByLocation);
  TestingContextKeys2.isRunning = new RawContextKey("testing.isRunning", false);
  TestingContextKeys2.isInPeek = new RawContextKey("testing.isInPeek", false);
  TestingContextKeys2.isPeekVisible = new RawContextKey("testing.isPeekVisible", false);
  TestingContextKeys2.peekItemType = new RawContextKey("peekItemType", void 0, {
    type: "string",
    description: localize("testing.peekItemType", 'Type of the item in the output peek view. Either a "test", "message", "task", or "result".')
  });
  TestingContextKeys2.controllerId = new RawContextKey("controllerId", void 0, {
    type: "string",
    description: localize("testing.controllerId", "Controller ID of the current test item")
  });
  TestingContextKeys2.testItemExtId = new RawContextKey("testId", void 0, {
    type: "string",
    description: localize("testing.testId", "ID of the current test item, set when creating or opening menus on test items")
  });
  TestingContextKeys2.testItemHasUri = new RawContextKey("testing.testItemHasUri", false, {
    type: "boolean",
    description: localize("testing.testItemHasUri", "Boolean indicating whether the test item has a URI defined")
  });
  TestingContextKeys2.testItemIsHidden = new RawContextKey("testing.testItemIsHidden", false, {
    type: "boolean",
    description: localize("testing.testItemIsHidden", "Boolean indicating whether the test item is hidden")
  });
  TestingContextKeys2.testMessageContext = new RawContextKey("testMessage", void 0, {
    type: "string",
    description: localize("testing.testMessage", "Value set in `testMessage.contextValue`, available in editor/content and testing/message/context")
  });
  TestingContextKeys2.testResultOutdated = new RawContextKey("testResultOutdated", void 0, {
    type: "boolean",
    description: localize("testing.testResultOutdated", "Value available in editor/content and testing/message/context when the result is outdated")
  });
  TestingContextKeys2.testResultState = new RawContextKey("testResultState", void 0, {
    type: "string",
    description: localize("testing.testResultState", "Value available testing/item/result indicating the state of the item.")
  });
  TestingContextKeys2.testProfileContextGroup = new RawContextKey("testing.profile.context.group", void 0, {
    type: "string",
    description: localize("testing.profile.context.group", 'Type of menu where the configure testing profile submenu exists. Either "run", "debug", or "coverage"')
  });
})(TestingContextKeys || (TestingContextKeys = {}));
export {
  TestingContextKeys
};
