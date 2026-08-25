function readAgentErrorTelemetryMeta(error) {
  const meta = error._meta;
  if (!meta) {
    return {};
  }
  const chatError = meta["chatError"];
  const fetchError = chatError && typeof chatError === "object" ? chatError.fetchError : void 0;
  const providerCallId = fetchError && typeof fetchError === "object" && typeof fetchError.requestId === "string" && fetchError.requestId.length > 0 ? fetchError.requestId : void 0;
  const serviceRequestId = fetchError && typeof fetchError === "object" && typeof fetchError.serverRequestId === "string" && fetchError.serverRequestId.length > 0 ? fetchError.serverRequestId : void 0;
  return { providerCallId, serviceRequestId };
}
export {
  readAgentErrorTelemetryMeta
};
