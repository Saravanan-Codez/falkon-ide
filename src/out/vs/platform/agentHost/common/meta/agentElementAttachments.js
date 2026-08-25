const AgentHostElementAttachmentDisplayKind = "element";
const AgentHostElementAttachmentMetadataKey = "vscode.agentHost.elementAttachment";
function toElementAttachmentMeta(correlationId) {
  return {
    [AgentHostElementAttachmentMetadataKey]: { correlationId }
  };
}
function getElementAttachmentCorrelationId(attachment) {
  const metadata = attachment._meta?.[AgentHostElementAttachmentMetadataKey];
  if (!metadata || typeof metadata !== "object" || !("correlationId" in metadata) || typeof metadata.correlationId !== "string") {
    return void 0;
  }
  return metadata.correlationId;
}
export {
  AgentHostElementAttachmentDisplayKind,
  AgentHostElementAttachmentMetadataKey,
  getElementAttachmentCorrelationId,
  toElementAttachmentMeta
};
