function readCompletionAttachmentMeta(attachment) {
  const meta = attachment._meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return void 0;
  }
  if (typeof meta["command"] === "string") {
    const action = readCompletionActionMeta(meta["action"]);
    return {
      kind: "command",
      command: meta["command"],
      ...typeof meta["description"] === "string" ? { description: meta["description"] } : {},
      ...typeof meta["argumentHint"] === "string" ? { argumentHint: meta["argumentHint"] } : {},
      ...action ? { action } : {}
    };
  }
  if (typeof meta["uri"] === "string") {
    return {
      kind: "skill",
      uri: meta["uri"],
      ...typeof meta["name"] === "string" ? { name: meta["name"] } : {},
      ...typeof meta["displayName"] === "string" ? { displayName: meta["displayName"] } : {},
      ...typeof meta["description"] === "string" ? { description: meta["description"] } : {}
    };
  }
  return void 0;
}
function toCommandCompletionAttachmentMeta(meta) {
  const result = { command: meta.command };
  if (meta.description !== void 0) {
    result["description"] = meta.description;
  }
  if (meta.argumentHint !== void 0) {
    result["argumentHint"] = meta.argumentHint;
  }
  const action = toCompletionActionMeta(meta.action);
  if (action !== void 0) {
    result["action"] = action;
  }
  return result;
}
function getCompletionAction(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return void 0;
  }
  return readCompletionActionMeta(meta["action"]);
}
function readCompletionActionMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return void 0;
  }
  const raw = value;
  let applyConfig;
  const rawApplyConfig = raw["applyConfig"];
  if (rawApplyConfig && typeof rawApplyConfig === "object" && !Array.isArray(rawApplyConfig)) {
    for (const [key, entry] of Object.entries(rawApplyConfig)) {
      if (typeof entry === "string") {
        applyConfig ??= {};
        applyConfig[key] = entry;
      }
    }
  }
  if (applyConfig === void 0) {
    return void 0;
  }
  return { applyConfig };
}
function toCompletionActionMeta(action) {
  if (!action?.applyConfig || Object.keys(action.applyConfig).length === 0) {
    return void 0;
  }
  return { applyConfig: { ...action.applyConfig } };
}
function getCommandArgumentHint(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return void 0;
  }
  return typeof meta["argumentHint"] === "string" ? meta["argumentHint"] : void 0;
}
function toSkillCompletionAttachmentMeta(meta) {
  const result = { uri: meta.uri };
  if (meta.name !== void 0) {
    result["name"] = meta.name;
  }
  if (meta.displayName !== void 0) {
    result["displayName"] = meta.displayName;
  }
  if (meta.description !== void 0) {
    result["description"] = meta.description;
  }
  return result;
}
export {
  getCommandArgumentHint,
  getCompletionAction,
  readCompletionAttachmentMeta,
  toCommandCompletionAttachmentMeta,
  toSkillCompletionAttachmentMeta
};
