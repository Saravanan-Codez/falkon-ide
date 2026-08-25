function extractSchemaDefaults(schema) {
  const defaults = {};
  if (schema?.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.default !== void 0) {
        defaults[key] = propSchema.default;
      }
    }
  }
  return defaults;
}
function filterConfigurationToSchema(values, schema) {
  const properties = schema?.properties;
  if (!properties) {
    return {};
  }
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    const propSchema = properties[key];
    if (!propSchema) {
      continue;
    }
    if (Array.isArray(propSchema.enum) && !propSchema.enum.includes(value)) {
      continue;
    }
    result[key] = value;
  }
  return result;
}
function resolveModelConfiguration(storedEntry, schemaDefaults, globalConfig) {
  if (storedEntry) {
    return { ...schemaDefaults, ...storedEntry };
  }
  return globalConfig ? { ...schemaDefaults, ...globalConfig } : { ...schemaDefaults };
}
function computeStoredConfiguration(current, values, schemaDefaults) {
  const merged = { ...current, ...values };
  const stripped = {};
  for (const [key, value] of Object.entries(merged)) {
    if (schemaDefaults[key] !== value) {
      stripped[key] = value;
    }
  }
  return stripped;
}
export {
  computeStoredConfiguration,
  extractSchemaDefaults,
  filterConfigurationToSchema,
  resolveModelConfiguration
};
