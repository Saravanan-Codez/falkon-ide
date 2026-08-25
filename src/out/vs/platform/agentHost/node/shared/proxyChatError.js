import { COPILOT_API_ERROR_STATUS_STREAMING } from "./copilotApiService.js";
const PROXY_ERROR_PREFIX = "VSCODE_PROXY_ERROR:";
const MAX_FORWARDED_MARKER_B64_LENGTH = 8 * 1024;
const FORWARDED_MARKER_B64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
function httpStatusToChatFetchType(status) {
  switch (status) {
    case 402:
      return "quotaExceeded";
    case 429:
      return "rateLimited";
    case 499:
      return "canceled";
    case 400:
      return "badRequest";
    case 401:
    case 403:
      return "agent_unauthorized";
    case 404:
      return "notFound";
    default:
      return "failed";
  }
}
function buildForwardedChatError(err) {
  const status = err.status === COPILOT_API_ERROR_STATUS_STREAMING ? 502 : err.status;
  const requestId = typeof err.envelope.request_id === "string" ? err.envelope.request_id : "";
  const capiError = extractCapiError(err.envelope.error.message) ?? { code: err.envelope.error.type, message: err.envelope.error.message };
  return {
    fetchError: {
      type: httpStatusToChatFetchType(status),
      reason: capiError.message ?? err.envelope.error.message,
      requestId,
      capiError
    }
  };
}
function extractCapiError(message) {
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    return void 0;
  }
  if (!parsed || typeof parsed !== "object") {
    return void 0;
  }
  const error = parsed.error;
  if (!error || typeof error !== "object") {
    return void 0;
  }
  const code = error.code;
  const msg = error.message;
  if (typeof code !== "string" && typeof msg !== "string") {
    return void 0;
  }
  return {
    code: typeof code === "string" ? code : void 0,
    message: typeof msg === "string" ? msg : void 0
  };
}
function encodeForwardedChatError(forwarded) {
  return `${PROXY_ERROR_PREFIX}${Buffer.from(JSON.stringify(forwarded)).toString("base64")}`;
}
function tryParseForwardedChatError(errorText) {
  if (!errorText) {
    return void 0;
  }
  const idx = errorText.indexOf(PROXY_ERROR_PREFIX);
  if (idx === -1) {
    return void 0;
  }
  const start = idx + PROXY_ERROR_PREFIX.length;
  const end = errorText.slice(start).search(/[\s"']/);
  const b64 = end === -1 ? errorText.slice(start) : errorText.slice(start, start + end);
  if (b64.length === 0 || b64.length > MAX_FORWARDED_MARKER_B64_LENGTH || !FORWARDED_MARKER_B64_PATTERN.test(b64)) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(b64, "base64").toString());
    if (parsed && typeof parsed === "object" && parsed.fetchError && typeof parsed.fetchError.type === "string") {
      return parsed;
    }
    return void 0;
  } catch {
    return void 0;
  }
}
function stripProxyErrorMarker(text) {
  const idx = text.indexOf(PROXY_ERROR_PREFIX);
  if (idx === -1) {
    return text;
  }
  return text.slice(0, idx).trim() || text.slice(0, idx);
}
function toChatErrorMeta(forwarded) {
  return { chatError: forwarded };
}
function tryBuildChatErrorMeta(errorText) {
  const forwarded = tryParseForwardedChatError(errorText);
  return forwarded ? toChatErrorMeta(forwarded) : void 0;
}
function extractForwardedErrorInfo(message) {
  const forwarded = tryParseForwardedChatError(message);
  if (!forwarded) {
    return { message };
  }
  return { message: stripProxyErrorMarker(message), _meta: toChatErrorMeta(forwarded) };
}
export {
  PROXY_ERROR_PREFIX,
  buildForwardedChatError,
  encodeForwardedChatError,
  extractForwardedErrorInfo,
  httpStatusToChatFetchType,
  stripProxyErrorMarker,
  toChatErrorMeta,
  tryBuildChatErrorMeta,
  tryParseForwardedChatError
};
