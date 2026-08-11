import { ActionType } from "../common/actions.js";
function resourceWatchReducer(state, action, log) {
  if (action.type === ActionType.ResourceWatchChanged) {
    return state;
  }
  (log ?? console.warn)(`Unhandled action type: ${JSON.stringify(action)}`);
  return state;
}
export {
  resourceWatchReducer
};
