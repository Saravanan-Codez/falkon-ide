import { createAgentModelGroupMeta } from "../../common/agentModelSource.js";
import { CLAUDE_PROVIDER_ANTHROPIC, CLAUDE_PROVIDER_COPILOT } from "../../common/claudeProviders.js";
import { toSdkModelId } from "./claudeModelId.js";
const CLAUDE_MODEL_SELECTION_PREFIX = "@provider=";
function toClaudeModelSelectionId(provider, modelId) {
  return `${CLAUDE_MODEL_SELECTION_PREFIX}${encodeURIComponent(provider)}:${encodeURIComponent(modelId)}`;
}
function parseClaudeModelSelection(selection) {
  const { id } = selection;
  if (!id.startsWith(CLAUDE_MODEL_SELECTION_PREFIX)) {
    return { provider: CLAUDE_PROVIDER_COPILOT, modelId: id, explicitProvider: false };
  }
  const separator = id.indexOf(":", CLAUDE_MODEL_SELECTION_PREFIX.length);
  if (separator < CLAUDE_MODEL_SELECTION_PREFIX.length) {
    return { provider: CLAUDE_PROVIDER_COPILOT, modelId: id, explicitProvider: false };
  }
  try {
    return {
      provider: decodeURIComponent(id.slice(CLAUDE_MODEL_SELECTION_PREFIX.length, separator)),
      modelId: decodeURIComponent(id.slice(separator + 1)),
      explicitProvider: true
    };
  } catch {
    return { provider: CLAUDE_PROVIDER_COPILOT, modelId: id, explicitProvider: false };
  }
}
function toClaudeSdkModelId(model) {
  if (!model) {
    return void 0;
  }
  return toSdkModelId(parseClaudeModelSelection(model).modelId);
}
function claudeTransportForProvider(provider) {
  return provider === CLAUDE_PROVIDER_ANTHROPIC ? "native" : "proxy";
}
function resolveClaudeSessionTransport(inputs) {
  const { model, defaultMode } = inputs;
  if (!model) {
    return defaultMode;
  }
  const parsed = parseClaudeModelSelection(model);
  if (!parsed.explicitProvider) {
    return defaultMode;
  }
  return claudeTransportForProvider(parsed.provider);
}
function mergeClaudeModelCatalogs(proxy, native) {
  return [
    ...withQualifiedProvider(proxy, CLAUDE_PROVIDER_COPILOT),
    ...withQualifiedProvider(native, CLAUDE_PROVIDER_ANTHROPIC)
  ];
}
function withQualifiedProvider(models, provider) {
  return models.map((model) => ({
    ...model,
    id: toClaudeModelSelectionId(provider, model.id),
    _meta: { ...model._meta, ...createAgentModelGroupMeta(provider) }
  }));
}
export {
  claudeTransportForProvider,
  mergeClaudeModelCatalogs,
  parseClaudeModelSelection,
  resolveClaudeSessionTransport,
  toClaudeModelSelectionId,
  toClaudeSdkModelId
};
