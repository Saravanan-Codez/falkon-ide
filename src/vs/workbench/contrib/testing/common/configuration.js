import { observableFromEvent } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../common/configuration.js";
var TestingConfigKeys = /* @__PURE__ */ ((TestingConfigKeys2) => {
  TestingConfigKeys2["AutoOpenPeekView"] = "testing.automaticallyOpenPeekView";
  TestingConfigKeys2["AutoOpenPeekViewDuringContinuousRun"] = "testing.automaticallyOpenPeekViewDuringAutoRun";
  TestingConfigKeys2["OpenResults"] = "testing.automaticallyOpenTestResults";
  TestingConfigKeys2["FollowRunningTest"] = "testing.followRunningTest";
  TestingConfigKeys2["DefaultGutterClickAction"] = "testing.defaultGutterClickAction";
  TestingConfigKeys2["GutterEnabled"] = "testing.gutterEnabled";
  TestingConfigKeys2["SaveBeforeTest"] = "testing.saveBeforeTest";
  TestingConfigKeys2["AlwaysRevealTestOnStateChange"] = "testing.alwaysRevealTestOnStateChange";
  TestingConfigKeys2["CountBadge"] = "testing.countBadge";
  TestingConfigKeys2["ShowAllMessages"] = "testing.showAllMessages";
  TestingConfigKeys2["CoveragePercent"] = "testing.displayedCoveragePercent";
  TestingConfigKeys2["ShowCoverageInExplorer"] = "testing.showCoverageInExplorer";
  TestingConfigKeys2["CoverageBarThresholds"] = "testing.coverageBarThresholds";
  TestingConfigKeys2["CoverageToolbarEnabled"] = "testing.coverageToolbarEnabled";
  TestingConfigKeys2["CoverageMinimapEnabled"] = "testing.coverageMinimapEnabled";
  TestingConfigKeys2["ResultsViewLayout"] = "testing.resultsView.layout";
  return TestingConfigKeys2;
})(TestingConfigKeys || {});
var AutoOpenTesting = /* @__PURE__ */ ((AutoOpenTesting2) => {
  AutoOpenTesting2["NeverOpen"] = "neverOpen";
  AutoOpenTesting2["OpenOnTestStart"] = "openOnTestStart";
  AutoOpenTesting2["OpenOnTestFailure"] = "openOnTestFailure";
  AutoOpenTesting2["OpenExplorerOnTestStart"] = "openExplorerOnTestStart";
  return AutoOpenTesting2;
})(AutoOpenTesting || {});
var AutoOpenPeekViewWhen = /* @__PURE__ */ ((AutoOpenPeekViewWhen2) => {
  AutoOpenPeekViewWhen2["FailureVisible"] = "failureInVisibleDocument";
  AutoOpenPeekViewWhen2["FailureAnywhere"] = "failureAnywhere";
  AutoOpenPeekViewWhen2["Never"] = "never";
  return AutoOpenPeekViewWhen2;
})(AutoOpenPeekViewWhen || {});
var DefaultGutterClickAction = /* @__PURE__ */ ((DefaultGutterClickAction2) => {
  DefaultGutterClickAction2["Run"] = "run";
  DefaultGutterClickAction2["Debug"] = "debug";
  DefaultGutterClickAction2["Coverage"] = "runWithCoverage";
  DefaultGutterClickAction2["ContextMenu"] = "contextMenu";
  return DefaultGutterClickAction2;
})(DefaultGutterClickAction || {});
var TestingCountBadge = /* @__PURE__ */ ((TestingCountBadge2) => {
  TestingCountBadge2["Failed"] = "failed";
  TestingCountBadge2["Off"] = "off";
  TestingCountBadge2["Passed"] = "passed";
  TestingCountBadge2["Skipped"] = "skipped";
  return TestingCountBadge2;
})(TestingCountBadge || {});
var TestingDisplayedCoveragePercent = /* @__PURE__ */ ((TestingDisplayedCoveragePercent2) => {
  TestingDisplayedCoveragePercent2["TotalCoverage"] = "totalCoverage";
  TestingDisplayedCoveragePercent2["Statement"] = "statement";
  TestingDisplayedCoveragePercent2["Minimum"] = "minimum";
  return TestingDisplayedCoveragePercent2;
})(TestingDisplayedCoveragePercent || {});
var TestingResultsViewLayout = /* @__PURE__ */ ((TestingResultsViewLayout2) => {
  TestingResultsViewLayout2["TreeLeft"] = "treeLeft";
  TestingResultsViewLayout2["TreeRight"] = "treeRight";
  return TestingResultsViewLayout2;
})(TestingResultsViewLayout || {});
const testingConfiguration = {
  id: "testing",
  order: 21,
  title: localize("testConfigurationTitle", "Testing"),
  type: "object",
  properties: {
    ["testing.automaticallyOpenPeekView" /* AutoOpenPeekView */]: {
      description: localize("testing.automaticallyOpenPeekView", "Configures when the error Peek view is automatically opened."),
      enum: [
        "failureAnywhere" /* FailureAnywhere */,
        "failureInVisibleDocument" /* FailureVisible */,
        "never" /* Never */
      ],
      default: "never" /* Never */,
      enumDescriptions: [
        localize("testing.automaticallyOpenPeekView.failureAnywhere", "Open automatically no matter where the failure is."),
        localize("testing.automaticallyOpenPeekView.failureInVisibleDocument", "Open automatically when a test fails in a visible document."),
        localize("testing.automaticallyOpenPeekView.never", "Never automatically open.")
      ]
    },
    ["testing.showAllMessages" /* ShowAllMessages */]: {
      description: localize("testing.showAllMessages", "Controls whether to show messages from all test runs."),
      type: "boolean",
      default: false
    },
    ["testing.automaticallyOpenPeekViewDuringAutoRun" /* AutoOpenPeekViewDuringContinuousRun */]: {
      description: localize("testing.automaticallyOpenPeekViewDuringContinuousRun", "Controls whether to automatically open the Peek view during continuous run mode."),
      type: "boolean",
      default: false
    },
    ["testing.countBadge" /* CountBadge */]: {
      description: localize("testing.countBadge", "Controls the count badge on the Testing icon on the Activity Bar."),
      enum: [
        "failed" /* Failed */,
        "off" /* Off */,
        "passed" /* Passed */,
        "skipped" /* Skipped */
      ],
      enumDescriptions: [
        localize("testing.countBadge.failed", "Show the number of failed tests"),
        localize("testing.countBadge.off", "Disable the testing count badge"),
        localize("testing.countBadge.passed", "Show the number of passed tests"),
        localize("testing.countBadge.skipped", "Show the number of skipped tests")
      ],
      default: "failed" /* Failed */
    },
    ["testing.followRunningTest" /* FollowRunningTest */]: {
      description: localize("testing.followRunningTest", "Controls whether the running test should be followed in the Test Explorer view."),
      type: "boolean",
      default: false
    },
    ["testing.defaultGutterClickAction" /* DefaultGutterClickAction */]: {
      description: localize("testing.defaultGutterClickAction", "Controls the action to take when left-clicking on a test decoration in the gutter."),
      enum: [
        "run" /* Run */,
        "debug" /* Debug */,
        "runWithCoverage" /* Coverage */,
        "contextMenu" /* ContextMenu */
      ],
      enumDescriptions: [
        localize("testing.defaultGutterClickAction.run", "Run the test."),
        localize("testing.defaultGutterClickAction.debug", "Debug the test."),
        localize("testing.defaultGutterClickAction.coverage", "Run the test with coverage."),
        localize("testing.defaultGutterClickAction.contextMenu", "Open the context menu for more options.")
      ],
      default: "run" /* Run */
    },
    ["testing.gutterEnabled" /* GutterEnabled */]: {
      description: localize("testing.gutterEnabled", "Controls whether test decorations are shown in the editor gutter."),
      type: "boolean",
      default: true
    },
    ["testing.saveBeforeTest" /* SaveBeforeTest */]: {
      description: localize("testing.saveBeforeTest", "Control whether save all dirty editors before running a test."),
      type: "boolean",
      default: true
    },
    ["testing.automaticallyOpenTestResults" /* OpenResults */]: {
      enum: [
        "neverOpen" /* NeverOpen */,
        "openOnTestStart" /* OpenOnTestStart */,
        "openOnTestFailure" /* OpenOnTestFailure */,
        "openExplorerOnTestStart" /* OpenExplorerOnTestStart */
      ],
      enumDescriptions: [
        localize("testing.openTesting.neverOpen", "Never automatically open the testing views"),
        localize("testing.openTesting.openOnTestStart", "Open the test results view when tests start"),
        localize("testing.openTesting.openOnTestFailure", "Open the test result view on any test failure"),
        localize("testing.openTesting.openExplorerOnTestStart", "Open the test explorer when tests start")
      ],
      default: "openOnTestStart",
      description: localize("testing.openTesting", "Controls when the testing view should open.")
    },
    ["testing.alwaysRevealTestOnStateChange" /* AlwaysRevealTestOnStateChange */]: {
      markdownDescription: localize("testing.alwaysRevealTestOnStateChange", "Always reveal the executed test when {0} is on. If this setting is turned off, only failed tests will be revealed.", "`#testing.followRunningTest#`"),
      type: "boolean",
      default: false
    },
    ["testing.showCoverageInExplorer" /* ShowCoverageInExplorer */]: {
      description: localize("testing.ShowCoverageInExplorer", "Whether test coverage should be down in the File Explorer view."),
      type: "boolean",
      default: true
    },
    ["testing.displayedCoveragePercent" /* CoveragePercent */]: {
      markdownDescription: localize("testing.displayedCoveragePercent", "Configures what percentage is displayed by default for test coverage."),
      default: "totalCoverage" /* TotalCoverage */,
      enum: [
        "totalCoverage" /* TotalCoverage */,
        "statement" /* Statement */,
        "minimum" /* Minimum */
      ],
      enumDescriptions: [
        localize("testing.displayedCoveragePercent.totalCoverage", "A calculation of the combined statement, function, and branch coverage."),
        localize("testing.displayedCoveragePercent.statement", "The statement coverage."),
        localize("testing.displayedCoveragePercent.minimum", "The minimum of statement, function, and branch coverage.")
      ]
    },
    ["testing.coverageBarThresholds" /* CoverageBarThresholds */]: {
      markdownDescription: localize("testing.coverageBarThresholds", "Configures the colors used for percentages in test coverage bars."),
      default: { red: 0, yellow: 60, green: 90 },
      properties: {
        red: { type: "number", minimum: 0, maximum: 100, default: 0 },
        yellow: { type: "number", minimum: 0, maximum: 100, default: 60 },
        green: { type: "number", minimum: 0, maximum: 100, default: 90 }
      }
    },
    ["testing.coverageToolbarEnabled" /* CoverageToolbarEnabled */]: {
      description: localize("testing.coverageToolbarEnabled", "Controls whether the coverage toolbar is shown in the editor."),
      type: "boolean",
      default: false
      // todo@connor4312: disabled by default until UI sync
    },
    ["testing.coverageMinimapEnabled" /* CoverageMinimapEnabled */]: {
      description: localize("testing.coverageMinimapEnabled", "Controls whether coverage indicators are shown in the minimap."),
      type: "boolean",
      default: true
    },
    ["testing.resultsView.layout" /* ResultsViewLayout */]: {
      description: localize("testing.resultsView.layout", "Controls the layout of the Test Results view."),
      enum: [
        "treeRight" /* TreeRight */,
        "treeLeft" /* TreeLeft */
      ],
      enumDescriptions: [
        localize("testing.resultsView.layout.treeRight", "Show the test run tree on the right side with details on the left."),
        localize("testing.resultsView.layout.treeLeft", "Show the test run tree on the left side with details on the right.")
      ],
      default: "treeRight" /* TreeRight */
    }
  }
};
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "testing.openTesting",
  migrateFn: (value) => {
    return [["testing.automaticallyOpenTestResults" /* OpenResults */, { value }]];
  }
}]);
const getTestingConfiguration = (config, key) => config.getValue(key);
const observeTestingConfiguration = (config, key) => observableFromEvent(config.onDidChangeConfiguration, () => getTestingConfiguration(config, key));
export {
  AutoOpenPeekViewWhen,
  AutoOpenTesting,
  DefaultGutterClickAction,
  TestingConfigKeys,
  TestingCountBadge,
  TestingDisplayedCoveragePercent,
  TestingResultsViewLayout,
  getTestingConfiguration,
  observeTestingConfiguration,
  testingConfiguration
};
