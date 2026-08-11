function readAgentCustomizationMeta(agent) {
  const meta = agent._meta;
  const result = {};
  if (agent.disableUserInvocation === true) {
    result.userInvocable = false;
  } else if (typeof meta?.["userInvocable"] === "boolean") {
    result.userInvocable = meta["userInvocable"];
  }
  return result;
}
function toAgentCustomizationMeta(meta) {
  const result = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
export {
  readAgentCustomizationMeta,
  toAgentCustomizationMeta
};
