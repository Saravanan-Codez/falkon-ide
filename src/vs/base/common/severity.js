import * as strings from "./strings.js";
var Severity = /* @__PURE__ */ ((Severity2) => {
  Severity2[Severity2["Ignore"] = 0] = "Ignore";
  Severity2[Severity2["Info"] = 1] = "Info";
  Severity2[Severity2["Warning"] = 2] = "Warning";
  Severity2[Severity2["Error"] = 3] = "Error";
  return Severity2;
})(Severity || {});
((Severity2) => {
  const _error = "error";
  const _warning = "warning";
  const _warn = "warn";
  const _info = "info";
  const _ignore = "ignore";
  function fromValue(value) {
    if (!value) {
      return 0 /* Ignore */;
    }
    if (strings.equalsIgnoreCase(_error, value)) {
      return 3 /* Error */;
    }
    if (strings.equalsIgnoreCase(_warning, value) || strings.equalsIgnoreCase(_warn, value)) {
      return 2 /* Warning */;
    }
    if (strings.equalsIgnoreCase(_info, value)) {
      return 1 /* Info */;
    }
    return 0 /* Ignore */;
  }
  Severity2.fromValue = fromValue;
  function toString(severity) {
    switch (severity) {
      case 3 /* Error */:
        return _error;
      case 2 /* Warning */:
        return _warning;
      case 1 /* Info */:
        return _info;
      default:
        return _ignore;
    }
  }
  Severity2.toString = toString;
})(Severity || (Severity = {}));
var severity_default = Severity;
export {
  severity_default as default
};
