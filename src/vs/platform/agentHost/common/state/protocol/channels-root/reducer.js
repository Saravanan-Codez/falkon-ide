import { ActionType } from "../common/actions.js";
import { softAssertNever } from "../common/reducer-helpers.js";
function rootReducer(state, action, log) {
  switch (action.type) {
    case ActionType.RootAgentsChanged:
      return { ...state, agents: action.agents };
    case ActionType.RootActiveSessionsChanged:
      return { ...state, activeSessions: action.activeSessions };
    case ActionType.RootTerminalsChanged:
      return { ...state, terminals: action.terminals };
    case ActionType.RootConfigChanged:
      if (!state.config) {
        return state;
      }
      return {
        ...state,
        config: {
          ...state.config,
          values: action.replace ? { ...action.config } : { ...state.config.values, ...action.config }
        }
      };
    default:
      softAssertNever(action, log);
      return state;
  }
}
export {
  rootReducer
};
