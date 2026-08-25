const CHATGPT_SUBSCRIPTION_MODEL_SOURCE_ID = "chatgptSubscription";
const AGENT_MODEL_SOURCE_ID_META_KEY = "modelSourceId";
function createAgentModelSourceMeta(sourceId) {
  return sourceId !== void 0 ? { [AGENT_MODEL_SOURCE_ID_META_KEY]: sourceId } : void 0;
}
function readAgentModelSourceId(model) {
  const meta = model._meta;
  if (!meta) {
    return void 0;
  }
  const value = meta[AGENT_MODEL_SOURCE_ID_META_KEY];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
const AGENT_MODEL_GROUP_ID_META_KEY = "modelGroupId";
function createAgentModelGroupMeta(groupId) {
  return { [AGENT_MODEL_GROUP_ID_META_KEY]: groupId };
}
function readAgentModelGroupId(model) {
  const meta = model._meta;
  if (!meta) {
    return void 0;
  }
  const value = meta[AGENT_MODEL_GROUP_ID_META_KEY];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
export {
  AGENT_MODEL_GROUP_ID_META_KEY,
  AGENT_MODEL_SOURCE_ID_META_KEY,
  CHATGPT_SUBSCRIPTION_MODEL_SOURCE_ID,
  createAgentModelGroupMeta,
  createAgentModelSourceMeta,
  readAgentModelGroupId,
  readAgentModelSourceId
};
