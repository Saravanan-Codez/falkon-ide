import { rootReducer, sessionReducer, chatReducer, changesetReducer, annotationsReducer, softAssertNever, isClientDispatchable } from "./protocol/reducers.js";
import { readToolCallMeta } from "../meta/agentToolCallMeta.js";
function getToolKind(tc) {
  return readToolCallMeta(tc).toolKind;
}
export {
  annotationsReducer,
  changesetReducer,
  chatReducer,
  getToolKind,
  isClientDispatchable,
  rootReducer,
  sessionReducer,
  softAssertNever
};
