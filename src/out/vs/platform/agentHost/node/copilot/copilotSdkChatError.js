import { httpStatusToChatFetchType, stripProxyErrorMarker, toChatErrorMeta, tryBuildChatErrorMeta } from "../shared/proxyChatError.js";
function copilotSdkErrorTypeToFetchType(errorType, statusCode) {
  switch (errorType) {
    case "quota":
      return "quotaExceeded";
    case "rate_limit":
      return "rateLimited";
    case "context_limit":
      return "length";
    case "authentication":
    case "authorization":
      return "agent_unauthorized";
  }
  return statusCode !== void 0 ? httpStatusToChatFetchType(statusCode) : void 0;
}
function buildForwardedChatErrorFromCopilotSdkFields(data) {
  const type = copilotSdkErrorTypeToFetchType(data.errorType, data.statusCode);
  if (!type) {
    return void 0;
  }
  const code = data.errorCode ?? (type === "quotaExceeded" ? "quota_exceeded" : void 0);
  const capiError = code || data.message ? { code, message: data.message } : void 0;
  return {
    fetchError: {
      type,
      reason: data.message,
      requestId: data.providerCallId ?? "",
      ...data.serviceRequestId !== void 0 ? { serverRequestId: data.serviceRequestId } : {},
      ...capiError && { capiError }
    }
  };
}
function buildChatErrorInfoFromCopilotSdkFields(data) {
  const forwarded = buildForwardedChatErrorFromCopilotSdkFields(data);
  const meta = forwarded ? toChatErrorMeta(forwarded) : tryBuildChatErrorMeta(data.message);
  return {
    errorType: data.errorType,
    message: stripProxyErrorMarker(data.message),
    stack: data.stack,
    ...meta ? { _meta: meta } : {}
  };
}
export {
  buildChatErrorInfoFromCopilotSdkFields,
  buildForwardedChatErrorFromCopilotSdkFields
};
