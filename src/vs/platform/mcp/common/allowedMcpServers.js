import { equals } from "../../../base/common/arrays.js";
import { escapeRegExpCharacters } from "../../../base/common/strings.js";
import { isObject, isString } from "../../../base/common/types.js";
var McpServerAllowResult = /* @__PURE__ */ ((McpServerAllowResult2) => {
  McpServerAllowResult2[McpServerAllowResult2["Allowed"] = 0] = "Allowed";
  McpServerAllowResult2[McpServerAllowResult2["Denied"] = 1] = "Denied";
  McpServerAllowResult2[McpServerAllowResult2["NotAllowed"] = 2] = "NotAllowed";
  return McpServerAllowResult2;
})(McpServerAllowResult || {});
function getMcpServerMatchers(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  return value.filter(isValidMatcher);
}
function isValidMatcher(entry) {
  if (!isObject(entry)) {
    return false;
  }
  const { serverName, serverUrl, serverCommand } = entry;
  const hasName = isString(serverName) && serverName.length > 0;
  const hasUrl = isString(serverUrl) && serverUrl.length > 0;
  const hasCommand = Array.isArray(serverCommand) && serverCommand.length > 0 && serverCommand.every(isString);
  return (hasName ? 1 : 0) + (hasUrl ? 1 : 0) + (hasCommand ? 1 : 0) === 1;
}
function isMcpServerMatched(matchers, identity) {
  return !!matchers && matchers.some((matcher) => matchesMatcher(matcher, identity));
}
function checkMcpServerAllowed(allowlist, denylist, identity) {
  if (isMcpServerMatched(denylist, identity)) {
    return 1 /* Denied */;
  }
  if (allowlist !== void 0 && !isMcpServerMatched(allowlist, identity)) {
    return 2 /* NotAllowed */;
  }
  return 0 /* Allowed */;
}
function matchesMatcher(matcher, identity) {
  if (isString(matcher.serverName)) {
    return matcher.serverName === identity.name;
  }
  if (isString(matcher.serverUrl)) {
    return identity.url !== void 0 && matchesUrlPattern(matcher.serverUrl, identity.url);
  }
  if (Array.isArray(matcher.serverCommand)) {
    return identity.command !== void 0 && equals(matcher.serverCommand, identity.command);
  }
  return false;
}
function matchesUrlPattern(pattern, url) {
  const regexSource = buildUrlPatternRegexSource(pattern);
  try {
    return new RegExp(regexSource, "i").test(url);
  } catch {
    return false;
  }
}
function buildUrlPatternRegexSource(pattern) {
  const schemeSeparator = pattern.indexOf("://");
  const authorityStart = schemeSeparator >= 0 ? schemeSeparator + 3 : 0;
  const pathStart = pattern.indexOf("/", authorityStart);
  const authorityEnd = pathStart >= 0 ? pathStart : pattern.length;
  let source = "^";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*") {
      source += i < authorityEnd ? "[^/]*" : ".*";
    } else {
      source += escapeRegExpCharacters(char);
    }
  }
  return source + "$";
}
export {
  McpServerAllowResult,
  checkMcpServerAllowed,
  getMcpServerMatchers,
  isMcpServerMatched
};
