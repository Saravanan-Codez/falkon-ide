function parseCopilotTokenFields(token) {
  const result = /* @__PURE__ */ new Map();
  if (!token) {
    return result;
  }
  const colonIdx = token.indexOf(":");
  const header = colonIdx === -1 ? token : token.substring(0, colonIdx);
  for (const field of header.split(";")) {
    const eqIdx = field.indexOf("=");
    if (eqIdx <= 0) {
      continue;
    }
    result.set(field.substring(0, eqIdx), field.substring(eqIdx + 1));
  }
  return result;
}
function isRestrictedTelemetryEnabled(token) {
  return parseCopilotTokenFields(token).get("rt") === "1";
}
export {
  isRestrictedTelemetryEnabled,
  parseCopilotTokenFields
};
