import { localize } from "../../../../nls.js";
import { TestResultState } from "./testTypes.js";
const collectTestStateCounts = (isRunning, results) => {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;
  let queued = 0;
  for (const result of results) {
    const count = result.counts;
    failed += count[TestResultState.Errored] + count[TestResultState.Failed];
    passed += count[TestResultState.Passed];
    skipped += count[TestResultState.Skipped];
    running += count[TestResultState.Running];
    queued += count[TestResultState.Queued];
  }
  return {
    isRunning,
    passed,
    failed,
    runSoFar: passed + failed,
    totalWillBeRun: passed + failed + queued + running,
    skipped
  };
};
const getTestProgressText = ({ isRunning, passed, runSoFar, totalWillBeRun, skipped, failed }) => {
  let percent = passed / runSoFar * 100;
  if (failed > 0) {
    percent = Math.min(percent, 99.9);
  } else if (runSoFar === 0) {
    percent = 0;
  }
  if (isRunning) {
    if (runSoFar === 0) {
      return localize("testProgress.runningInitial", "Running tests...");
    } else if (skipped === 0) {
      return localize("testProgress.running", "Running tests, {0}/{1} passed ({2}%)", passed, totalWillBeRun, percent.toPrecision(3));
    } else {
      return localize("testProgressWithSkip.running", "Running tests, {0}/{1} tests passed ({2}%, {3} skipped)", passed, totalWillBeRun, percent.toPrecision(3), skipped);
    }
  } else {
    if (skipped === 0) {
      return localize("testProgress.completed", "{0}/{1} tests passed ({2}%)", passed, runSoFar, percent.toPrecision(3));
    } else {
      return localize("testProgressWithSkip.completed", "{0}/{1} tests passed ({2}%, {3} skipped)", passed, runSoFar, percent.toPrecision(3), skipped);
    }
  }
};
export {
  collectTestStateCounts,
  getTestProgressText
};
