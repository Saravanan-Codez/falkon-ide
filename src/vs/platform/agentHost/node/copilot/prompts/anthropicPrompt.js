import { CopilotCliConfigKey } from "../../../common/copilotCliConfig.js";
import { agentHostPromptRegistry } from "./promptRegistry.js";
import { COPILOT_AGENT_HOST_IDENTITY } from "./systemMessage.js";
function opus48SectionOverrides() {
  return {
    identity: {
      action: "replace",
      content: COPILOT_AGENT_HOST_IDENTITY
    },
    tone: {
      action: "append",
      // Leading newline so the appended text starts on its own line rather
      // than running on from the SDK foundation tone section's last sentence.
      content: "\nProvide concise, focused responses. Skip non-essential context, and keep examples minimal. Use a direct style and use emojis sparingly."
    },
    guidelines: {
      action: "append",
      content: [
        "Do not spawn a subagent for work you can complete directly in a single response (e.g. refactoring a function you can already see).",
        "Spawn multiple subagents in the same turn when fanning out across items or reading multiple files."
      ].join("\n")
    }
  };
}
function isOpus48(model) {
  return model.id.startsWith("claude-opus-4-8") || model.id.startsWith("claude-opus-4.8");
}
class Claude48OpusPromptResolver {
  static {
    this.familyPrefixes = [];
  }
  static matchesModel(model) {
    return isOpus48(model);
  }
  resolveSectionOverrides(_model, context) {
    return context.getSetting(CopilotCliConfigKey.Opus48Prompt) === true ? opus48SectionOverrides() : void 0;
  }
}
agentHostPromptRegistry.registerPrompt(Claude48OpusPromptResolver);
