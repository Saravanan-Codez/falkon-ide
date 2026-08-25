import { readFileSync } from "fs";
import { parse as parseJSONC } from "../../../../base/common/json.js";
import { join } from "../../../../base/common/path.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { isString } from "../../../../base/common/types.js";
import { vObj, vOptionalProp, vUnknown } from "../../../../base/common/validation.js";
function resolveClaudeTransportMode(inputs) {
  const { allowSignedOutWhenUsable, hasGitHubToken, hasExistingSetup } = inputs;
  if (!allowSignedOutWhenUsable) {
    return "proxy";
  }
  if (hasGitHubToken) {
    return "proxy";
  }
  if (hasExistingSetup) {
    return "native";
  }
  return "proxy";
}
const claudeApiKeyHelperValidator = vObj({
  apiKeyHelper: vOptionalProp(vUnknown())
});
const claudeSettingsEnvValidator = vObj({
  env: vOptionalProp(vObj({
    ANTHROPIC_API_KEY: vOptionalProp(vUnknown()),
    ANTHROPIC_AUTH_TOKEN: vOptionalProp(vUnknown()),
    ANTHROPIC_BASE_URL: vOptionalProp(vUnknown()),
    CLAUDE_CODE_OAUTH_TOKEN: vOptionalProp(vUnknown())
  }))
});
function detectExistingClaudeSetup(homeDir, env = process.env) {
  if (hasNativeClaudeEnv(env)) {
    return true;
  }
  const settings = readJsonFile(join(homeDir, ".claude", "settings.json"));
  return hasNativeClaudeEnv(claudeSettingsEnvValidator.validate(settings).content?.env) || hasValue(claudeApiKeyHelperValidator.validate(settings).content?.apiKeyHelper);
}
function hasNativeClaudeEnv(env) {
  return hasValue(env?.ANTHROPIC_API_KEY) || hasValue(env?.ANTHROPIC_AUTH_TOKEN) || hasValue(env?.ANTHROPIC_BASE_URL) || hasValue(env?.CLAUDE_CODE_OAUTH_TOKEN);
}
function hasValue(value) {
  return isString(value) && !isFalsyOrWhitespace(value);
}
function readJsonFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return void 0;
  }
  const errors = [];
  const parsed = parseJSONC(text, errors, { allowTrailingComma: true, allowEmptyContent: true });
  return errors.length === 0 ? parsed : void 0;
}
export {
  detectExistingClaudeSetup,
  resolveClaudeTransportMode
};
