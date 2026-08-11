import { Codicon } from "../../../../base/common/codicons.js";
import { localize } from "../../../../nls.js";
import { registerIcon, spinningLoading } from "../../../../platform/theme/common/iconRegistry.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { testingColorRunAction, testStatesToIconColors, testStatesToRetiredIconColors } from "./theme.js";
import { TestResultState } from "../common/testTypes.js";
const testingViewIcon = registerIcon("test-view-icon", Codicon.beaker, localize("testViewIcon", "View icon of the test view."));
const testingResultsIcon = registerIcon("test-results-icon", Codicon.checklist, localize("testingResultsIcon", "Icons for test results."));
const testingRunIcon = registerIcon("testing-run-icon", Codicon.run, localize("testingRunIcon", 'Icon of the "run test" action.'));
const testingRerunIcon = registerIcon("testing-rerun-icon", Codicon.debugRerun, localize("testingRerunIcon", 'Icon of the "rerun tests" action.'));
const testingRunAllIcon = registerIcon("testing-run-all-icon", Codicon.runAll, localize("testingRunAllIcon", 'Icon of the "run all tests" action.'));
const testingDebugAllIcon = registerIcon("testing-debug-all-icon", Codicon.debugAltSmall, localize("testingDebugAllIcon", 'Icon of the "debug all tests" action.'));
const testingDebugIcon = registerIcon("testing-debug-icon", Codicon.debugAltSmall, localize("testingDebugIcon", 'Icon of the "debug test" action.'));
const testingCoverageIcon = registerIcon("testing-coverage-icon", Codicon.runCoverage, localize("testingCoverageIcon", 'Icon of the "run test with coverage" action.'));
const testingCoverageAllIcon = registerIcon("testing-coverage-all-icon", Codicon.runAllCoverage, localize("testingRunAllWithCoverageIcon", 'Icon of the "run all tests with coverage" action.'));
const testingCancelIcon = registerIcon("testing-cancel-icon", Codicon.debugStop, localize("testingCancelIcon", "Icon to cancel ongoing test runs."));
const testingFilterIcon = registerIcon("testing-filter", Codicon.filter, localize("filterIcon", "Icon for the 'Filter' action in the testing view."));
const testingHiddenIcon = registerIcon("testing-hidden", Codicon.eyeClosed, localize("hiddenIcon", "Icon shown beside hidden tests, when they've been shown."));
const testingShowAsList = registerIcon("testing-show-as-list-icon", Codicon.listTree, localize("testingShowAsList", "Icon shown when the test explorer is disabled as a tree."));
const testingShowAsTree = registerIcon("testing-show-as-list-icon", Codicon.listFlat, localize("testingShowAsTree", "Icon shown when the test explorer is disabled as a list."));
const testingUpdateProfiles = registerIcon("testing-update-profiles", Codicon.gear, localize("testingUpdateProfiles", "Icon shown to update test profiles."));
const testingRefreshTests = registerIcon("testing-refresh-tests", Codicon.refresh, localize("testingRefreshTests", "Icon on the button to refresh tests."));
const testingTurnContinuousRunOn = registerIcon("testing-turn-continuous-run-on", Codicon.eye, localize("testingTurnContinuousRunOn", "Icon to turn continuous test runs on."));
const testingTurnContinuousRunOff = registerIcon("testing-turn-continuous-run-off", Codicon.eyeClosed, localize("testingTurnContinuousRunOff", "Icon to turn continuous test runs off."));
const testingContinuousIsOn = registerIcon("testing-continuous-is-on", Codicon.eye, localize("testingTurnContinuousRunIsOn", "Icon when continuous run is on for a test ite,."));
const testingCancelRefreshTests = registerIcon("testing-cancel-refresh-tests", Codicon.stop, localize("testingCancelRefreshTests", "Icon on the button to cancel refreshing tests."));
const testingCoverageReport = registerIcon("testing-coverage", Codicon.coverage, localize("testingCoverage", "Icon representing test coverage"));
const testingWasCovered = registerIcon("testing-was-covered", Codicon.check, localize("testingWasCovered", "Icon representing that an element was covered"));
const testingCoverageMissingBranch = registerIcon("testing-missing-branch", Codicon.question, localize("testingMissingBranch", "Icon representing a uncovered block without a range"));
const testingStatesToIcons = /* @__PURE__ */ new Map([
  [TestResultState.Errored, registerIcon("testing-error-icon", Codicon.issues, localize("testingErrorIcon", "Icon shown for tests that have an error."))],
  [TestResultState.Failed, registerIcon("testing-failed-icon", Codicon.error, localize("testingFailedIcon", "Icon shown for tests that failed."))],
  [TestResultState.Passed, registerIcon("testing-passed-icon", Codicon.pass, localize("testingPassedIcon", "Icon shown for tests that passed."))],
  [TestResultState.Queued, registerIcon("testing-queued-icon", Codicon.history, localize("testingQueuedIcon", "Icon shown for tests that are queued."))],
  [TestResultState.Running, spinningLoading],
  [TestResultState.Skipped, registerIcon("testing-skipped-icon", Codicon.debugStepOver, localize("testingSkippedIcon", "Icon shown for tests that are skipped."))],
  [TestResultState.Unset, registerIcon("testing-unset-icon", Codicon.circleOutline, localize("testingUnsetIcon", "Icon shown for tests that are in an unset state."))]
]);
registerThemingParticipant((theme, collector) => {
  for (const [state, icon] of testingStatesToIcons.entries()) {
    const color = testStatesToIconColors[state];
    const retiredColor = testStatesToRetiredIconColors[state];
    if (!color) {
      continue;
    }
    collector.addRule(`.monaco-workbench ${ThemeIcon.asCSSSelector(icon)} {
			color: ${theme.getColor(color)} !important;
		}`);
    if (!retiredColor) {
      continue;
    }
    collector.addRule(`
			.test-explorer .computed-state.retired${ThemeIcon.asCSSSelector(icon)},
			.testing-run-glyph.retired${ThemeIcon.asCSSSelector(icon)}{
				color: ${theme.getColor(retiredColor)} !important;
			}
		`);
  }
  collector.addRule(`
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingRunIcon)},
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingRunAllIcon)},
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingDebugIcon)},
		.monaco-editor .glyph-margin-widgets ${ThemeIcon.asCSSSelector(testingDebugAllIcon)} {
			color: ${theme.getColor(testingColorRunAction)};
		}
	`);
});
export {
  testingCancelIcon,
  testingCancelRefreshTests,
  testingContinuousIsOn,
  testingCoverageAllIcon,
  testingCoverageIcon,
  testingCoverageMissingBranch,
  testingCoverageReport,
  testingDebugAllIcon,
  testingDebugIcon,
  testingFilterIcon,
  testingHiddenIcon,
  testingRefreshTests,
  testingRerunIcon,
  testingResultsIcon,
  testingRunAllIcon,
  testingRunIcon,
  testingShowAsList,
  testingShowAsTree,
  testingStatesToIcons,
  testingTurnContinuousRunOff,
  testingTurnContinuousRunOn,
  testingUpdateProfiles,
  testingViewIcon,
  testingWasCovered
};
