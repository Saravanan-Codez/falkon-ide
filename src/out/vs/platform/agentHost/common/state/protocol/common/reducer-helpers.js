import { IS_CLIENT_DISPATCHABLE } from "../action-origin.generated.js";
function softAssertNever(value, log) {
  const msg = `Unhandled action type: ${JSON.stringify(value)}`;
  (log ?? console.warn)(msg);
}
function isClientDispatchable(action) {
  return IS_CLIENT_DISPATCHABLE[action.type];
}
export {
  isClientDispatchable,
  softAssertNever
};
