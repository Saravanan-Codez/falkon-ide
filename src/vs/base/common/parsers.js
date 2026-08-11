var ValidationState = /* @__PURE__ */ ((ValidationState2) => {
  ValidationState2[ValidationState2["OK"] = 0] = "OK";
  ValidationState2[ValidationState2["Info"] = 1] = "Info";
  ValidationState2[ValidationState2["Warning"] = 2] = "Warning";
  ValidationState2[ValidationState2["Error"] = 3] = "Error";
  ValidationState2[ValidationState2["Fatal"] = 4] = "Fatal";
  return ValidationState2;
})(ValidationState || {});
class ValidationStatus {
  constructor() {
    this._state = 0 /* OK */;
  }
  get state() {
    return this._state;
  }
  set state(value) {
    if (value > this._state) {
      this._state = value;
    }
  }
  isOK() {
    return this._state === 0 /* OK */;
  }
  isFatal() {
    return this._state === 4 /* Fatal */;
  }
}
class Parser {
  constructor(problemReporter) {
    this._problemReporter = problemReporter;
  }
  reset() {
    this._problemReporter.status.state = 0 /* OK */;
  }
  get problemReporter() {
    return this._problemReporter;
  }
  info(message) {
    this._problemReporter.info(message);
  }
  warn(message) {
    this._problemReporter.warn(message);
  }
  error(message) {
    this._problemReporter.error(message);
  }
  fatal(message) {
    this._problemReporter.fatal(message);
  }
}
export {
  Parser,
  ValidationState,
  ValidationStatus
};
