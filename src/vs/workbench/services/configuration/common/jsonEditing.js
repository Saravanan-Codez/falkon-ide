import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IJSONEditingService = createDecorator("jsonEditingService");
var JSONEditingErrorCode = /* @__PURE__ */ ((JSONEditingErrorCode2) => {
  JSONEditingErrorCode2[JSONEditingErrorCode2["ERROR_INVALID_FILE"] = 0] = "ERROR_INVALID_FILE";
  return JSONEditingErrorCode2;
})(JSONEditingErrorCode || {});
class JSONEditingError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
export {
  IJSONEditingService,
  JSONEditingError,
  JSONEditingErrorCode
};
