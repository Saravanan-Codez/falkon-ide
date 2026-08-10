const INVALID = Object.freeze({ valid: false, sessionId: void 0 });
function parseProxyBearer(headers, expectedNonce) {
  const authHeader = headers["authorization"];
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return INVALID;
  }
  const token = authHeader.slice("Bearer ".length);
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) {
    return INVALID;
  }
  const nonce = token.slice(0, dotIndex);
  const sessionId = token.slice(dotIndex + 1);
  if (nonce !== expectedNonce || sessionId.length === 0) {
    return INVALID;
  }
  return { valid: true, sessionId };
}
export {
  parseProxyBearer
};
