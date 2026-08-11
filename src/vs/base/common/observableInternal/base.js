import { onUnexpectedError } from "./commonFacade/deps.js";
function handleBugIndicatingErrorRecovery(message) {
  const err = new Error("BugIndicatingErrorRecovery: " + message);
  onUnexpectedError(err);
  console.error("recovered from an error that indicates a bug", err);
}
export {
  handleBugIndicatingErrorRecovery
};
