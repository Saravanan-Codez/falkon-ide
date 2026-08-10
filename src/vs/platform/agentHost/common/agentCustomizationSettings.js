const AGENT_CUSTOMIZATION_SETTINGS_META_KEY = "vscode.agentCustomizationSettings";
function isAgentCustomizationSettingDescriptor(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const setting = value;
  return typeof setting.key === "string" && typeof setting.group === "string" && (setting.kind === void 0 || setting.kind === "multiline") && (setting.saveLabel === void 0 || typeof setting.saveLabel === "string");
}
function isAgentCustomizationSettingsDescriptor(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value;
  if (typeof entry.provider !== "string" || typeof entry.title !== "string" || typeof entry.description !== "string" || !Array.isArray(entry.settings) || !entry.settings.every(isAgentCustomizationSettingDescriptor)) {
    return false;
  }
  const file = entry.configurationFile;
  return file === void 0 || !!file && typeof file.resource === "string" && typeof file.title === "string" && typeof file.description === "string" && typeof file.openLabel === "string" && (file.documentationUrl === void 0 || typeof file.documentationUrl === "string") && (file.documentationLabel === void 0 || typeof file.documentationLabel === "string");
}
function getAgentCustomizationSettingsEntries(state) {
  const meta = state?._meta;
  const value = meta?.[AGENT_CUSTOMIZATION_SETTINGS_META_KEY];
  return Array.isArray(value) ? value.filter(isAgentCustomizationSettingsDescriptor) : [];
}
function withAgentCustomizationSettings(state, entries) {
  return { ...state?._meta, [AGENT_CUSTOMIZATION_SETTINGS_META_KEY]: entries };
}
function readAgentCustomizationSettings(state, provider) {
  return getAgentCustomizationSettingsEntries(state).find((entry) => entry.provider === provider);
}
function getProviderBackedRootConfigKeys(state) {
  return new Set(getAgentCustomizationSettingsEntries(state).flatMap((entry) => entry.settings.map((setting) => setting.key)));
}
function preserveProviderBackedRootConfigValues(state, replacement) {
  const values = { ...replacement };
  const current = state?.config?.values;
  if (!current) {
    return values;
  }
  for (const key of getProviderBackedRootConfigKeys(state)) {
    if (!Object.hasOwn(values, key) && Object.hasOwn(current, key)) {
      values[key] = current[key];
    }
  }
  return values;
}
export {
  AGENT_CUSTOMIZATION_SETTINGS_META_KEY,
  getAgentCustomizationSettingsEntries,
  getProviderBackedRootConfigKeys,
  preserveProviderBackedRootConfigValues,
  readAgentCustomizationSettings,
  withAgentCustomizationSettings
};
