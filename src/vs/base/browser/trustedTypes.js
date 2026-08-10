import { onUnexpectedError } from "../common/errors.js";
import { getMonacoEnvironment } from "./browser.js";
function createTrustedTypesPolicy(policyName, policyOptions) {
  const monacoEnvironment = getMonacoEnvironment();
  if (monacoEnvironment?.createTrustedTypesPolicy) {
    try {
      return monacoEnvironment.createTrustedTypesPolicy(policyName, policyOptions);
    } catch (err) {
      onUnexpectedError(err);
      return void 0;
    }
  }
  try {
    return globalThis.trustedTypes?.createPolicy(policyName, policyOptions);
  } catch (err) {
    onUnexpectedError(err);
    return void 0;
  }
}
export {
  createTrustedTypesPolicy
};
