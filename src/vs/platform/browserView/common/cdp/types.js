const CDPErrorCode = {
  /** Method not found */
  MethodNotFound: -32601,
  /** Invalid params */
  InvalidParams: -32602,
  /** Internal error */
  InternalError: -32603,
  /** Server error (generic) */
  ServerError: -32e3
};
class CDPError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "CDPError";
  }
}
class CDPMethodNotFoundError extends CDPError {
  constructor(method) {
    super(`Method not found: ${method}`, CDPErrorCode.MethodNotFound);
    this.name = "CDPMethodNotFoundError";
  }
}
class CDPInvalidParamsError extends CDPError {
  constructor(message) {
    super(message, CDPErrorCode.InvalidParams);
    this.name = "CDPInvalidParamsError";
  }
}
class CDPInternalError extends CDPError {
  constructor(message) {
    super(message, CDPErrorCode.InternalError);
    this.name = "CDPInternalError";
  }
}
class CDPServerError extends CDPError {
  constructor(message) {
    super(message, CDPErrorCode.ServerError);
    this.name = "CDPServerError";
  }
}
export {
  CDPError,
  CDPErrorCode,
  CDPInternalError,
  CDPInvalidParamsError,
  CDPMethodNotFoundError,
  CDPServerError
};
