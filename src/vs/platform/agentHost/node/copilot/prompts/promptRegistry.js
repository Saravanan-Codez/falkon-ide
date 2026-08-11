import { appendSystemMessageContent, COPILOT_AGENT_HOST_FILE_LINK_INSTRUCTIONS, COPILOT_AGENT_HOST_WORKSPACELESS_INSTRUCTIONS, COPILOT_AGENT_HOST_SYSTEM_MESSAGE, fullSystemPrompt, sectionOverrides } from "./systemMessage.js";
import { resolveToolInstructionsOverride, toolSearchInstructionLines } from "./toolInstructions.js";
class AgentHostPromptRegistry {
  constructor() {
    this._promptsWithMatcher = [];
    this._familyPrefixList = [];
  }
  registerPrompt(ctor) {
    if (ctor.matchesModel) {
      this._promptsWithMatcher.push(ctor);
    }
    for (const prefix of ctor.familyPrefixes) {
      this._familyPrefixList.push({ prefix, ctor });
    }
  }
  _getContributor(model) {
    for (const ctor of this._promptsWithMatcher) {
      if (ctor.matchesModel(model)) {
        return ctor;
      }
    }
    for (const { prefix, ctor } of this._familyPrefixList) {
      if (model.id.startsWith(prefix)) {
        return ctor;
      }
    }
    return void 0;
  }
  /**
   * Resolves the {@link SystemMessageConfig} for a session's model: the
   * per-model (or default) config from {@link _resolveModelConfig}, with the
   * model-agnostic section overrides from {@link _withUniversalSections}
   * layered on top.
   *
   * Lifetime: the SDK accepts a system message only at session create/resume
   * (there is no mid-session update), so this is resolved once per (re)launch
   * and any tool-gated content reflects the tool set at that moment. A change
   * to the session's tools/plugins is part of the launcher's restart-detection
   * snapshot, so it re-launches the session and recomputes this; an in-flight
   * turn keeps the prompt it launched with.
   */
  resolveSystemMessageConfig(model, context) {
    const config = this._withUniversalSections(this._resolveModelConfig(model, context), context);
    const withWorkspacelessScratch = this._withWorkspacelessScratch(config, context);
    return appendSystemMessageContent(withWorkspacelessScratch, COPILOT_AGENT_HOST_FILE_LINK_INSTRUCTIONS);
  }
  /**
   * Resolves the per-model config, before universal sections are layered on.
   *
   * Falls back to {@link COPILOT_AGENT_HOST_SYSTEM_MESSAGE} when the model is
   * unknown (e.g. server-side "Auto" selection where no model is chosen at
   * create time), when no contributor matches, or when the matching
   * contributor opts out for the current {@link context} (e.g. a setting that
   * gates it is disabled).
   */
  _resolveModelConfig(model, context) {
    if (!model) {
      return COPILOT_AGENT_HOST_SYSTEM_MESSAGE;
    }
    const ctor = this._getContributor(model);
    if (!ctor) {
      return COPILOT_AGENT_HOST_SYSTEM_MESSAGE;
    }
    const contributor = new ctor();
    const fullPrompt = contributor.resolveFullSystemPrompt?.(model, context);
    if (fullPrompt !== void 0) {
      return fullSystemPrompt(fullPrompt);
    }
    const sections = contributor.resolveSectionOverrides?.(model, context);
    if (sections && Object.keys(sections).length > 0) {
      return sectionOverrides(sections);
    }
    return COPILOT_AGENT_HOST_SYSTEM_MESSAGE;
  }
  /**
   * Layers section overrides that apply to EVERY model on top of the per-model
   * (or default) config. Currently this is only the `tool_instructions` section
   * (see {@link resolveToolInstructionsOverride}), which the agent host wants
   * for all models rather than gating per-model like the Opus prompt.
   *
   * Only `customize`-mode configs carry section overrides, so this is a no-op
   * for a contributor's full `replace` prompt (which owns the entire system
   * message and intentionally drops the SDK foundation) and for `append` mode.
   * A `replace` contributor that wants the universal guidance re-includes it
   * itself by rendering `universalToolInstructions` (in `toolInstructions.ts`)
   * from its `resolveFullSystemPrompt`, mirroring how the extension's full-prompt
   * models inline the same lines.
   *
   * A per-model `tool_instructions` override is composed with — not overwritten
   * by — the universal lines (see {@link resolveToolInstructionsOverride}).
   */
  _withUniversalSections(config, context) {
    if (config.mode !== "customize") {
      return config;
    }
    const toolInstructions = resolveToolInstructionsOverride((name) => context.hasClientTool(name), config.sections?.tool_instructions, toolSearchInstructionLines(context.toolSearchActive));
    if (!toolInstructions) {
      return config;
    }
    return { ...config, sections: { ...config.sections, tool_instructions: toolInstructions } };
  }
  /**
   * Appends the scratch/repoless workspace-less guidance (see
   * {@link COPILOT_AGENT_HOST_WORKSPACELESS_INSTRUCTIONS}) as customize-mode
   * `content` when {@link IAgentHostPromptContext.workspaceless} is set, so it
   * composes on top of whatever sections the per-model (or default) config
   * carries while keeping the SDK foundation intact.
   *
   * No-op for workspace-bound sessions and for a full `replace` prompt (which
   * owns the entire system message and intentionally drops the SDK foundation).
   */
  _withWorkspacelessScratch(config, context) {
    if (!context.workspaceless || config.mode !== "customize") {
      return config;
    }
    const content = config.content ? `${config.content}

${COPILOT_AGENT_HOST_WORKSPACELESS_INSTRUCTIONS}` : COPILOT_AGENT_HOST_WORKSPACELESS_INSTRUCTIONS;
    return { ...config, content };
  }
}
const agentHostPromptRegistry = new AgentHostPromptRegistry();
export {
  AgentHostPromptRegistry,
  agentHostPromptRegistry
};
