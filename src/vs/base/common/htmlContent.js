import { illegalArgument } from "./errors.js";
import { escapeIcons } from "./iconLabels.js";
import { matchesSomeScheme, Schemas } from "./network.js";
import { isEqual } from "./resources.js";
import { escapeRegExpCharacters } from "./strings.js";
import { URI } from "./uri.js";
var MarkdownStringTextNewlineStyle = /* @__PURE__ */ ((MarkdownStringTextNewlineStyle2) => {
  MarkdownStringTextNewlineStyle2[MarkdownStringTextNewlineStyle2["Paragraph"] = 0] = "Paragraph";
  MarkdownStringTextNewlineStyle2[MarkdownStringTextNewlineStyle2["Break"] = 1] = "Break";
  return MarkdownStringTextNewlineStyle2;
})(MarkdownStringTextNewlineStyle || {});
class MarkdownString {
  static lift(dto) {
    const markdownString = new MarkdownString(dto.value, dto);
    markdownString.uris = dto.uris;
    markdownString.baseUri = dto.baseUri ? URI.revive(dto.baseUri) : void 0;
    return markdownString;
  }
  constructor(value = "", isTrustedOrOptions = false) {
    this.value = value;
    if (typeof this.value !== "string") {
      throw illegalArgument("value");
    }
    if (typeof isTrustedOrOptions === "boolean") {
      this.isTrusted = isTrustedOrOptions;
      this.supportThemeIcons = false;
      this.supportHtml = false;
      this.supportAlertSyntax = false;
    } else {
      this.isTrusted = isTrustedOrOptions.isTrusted ?? void 0;
      this.supportThemeIcons = isTrustedOrOptions.supportThemeIcons ?? false;
      this.supportHtml = isTrustedOrOptions.supportHtml ?? false;
      this.supportAlertSyntax = isTrustedOrOptions.supportAlertSyntax ?? false;
    }
  }
  appendText(value, newlineStyle = 0 /* Paragraph */) {
    this.value += escapeMarkdownSyntaxTokens(this.supportThemeIcons ? escapeIcons(value) : value).replace(/([ \t]+)/g, (_match, g1) => "&nbsp;".repeat(g1.length)).replace(/\>/gm, "\\>").replace(/\n/g, newlineStyle === 1 /* Break */ ? "\\\n" : "\n\n");
    return this;
  }
  appendMarkdown(value) {
    this.value += value;
    return this;
  }
  appendCodeblock(langId, code) {
    this.value += `
${appendEscapedMarkdownCodeBlockFence(code, langId)}
`;
    return this;
  }
  appendLink(target, label, title) {
    this.value += "[";
    this.value += this._escape(label, "]");
    this.value += "](";
    this.value += this._escape(String(target), ")");
    if (title) {
      this.value += ` "${this._escape(this._escape(title, '"'), ")")}"`;
    }
    this.value += ")";
    return this;
  }
  _escape(value, ch) {
    const r = new RegExp(escapeRegExpCharacters(ch), "g");
    return value.replace(r, (match, offset) => {
      if (value.charAt(offset - 1) !== "\\") {
        return `\\${match}`;
      } else {
        return match;
      }
    });
  }
}
function isEmptyMarkdownString(oneOrMany) {
  if (isMarkdownString(oneOrMany)) {
    return !oneOrMany.value;
  } else if (Array.isArray(oneOrMany)) {
    return oneOrMany.every(isEmptyMarkdownString);
  } else {
    return true;
  }
}
function isMarkdownString(thing) {
  if (thing instanceof MarkdownString) {
    return true;
  } else if (thing && typeof thing === "object") {
    return typeof thing.value === "string" && (typeof thing.isTrusted === "boolean" || typeof thing.isTrusted === "object" || thing.isTrusted === void 0) && (typeof thing.supportThemeIcons === "boolean" || thing.supportThemeIcons === void 0) && (typeof thing.supportAlertSyntax === "boolean" || thing.supportAlertSyntax === void 0);
  }
  return false;
}
function markdownStringEqual(a, b) {
  if (a === b) {
    return true;
  } else if (!a || !b) {
    return false;
  } else {
    return a.value === b.value && a.isTrusted === b.isTrusted && a.supportThemeIcons === b.supportThemeIcons && a.supportHtml === b.supportHtml && a.supportAlertSyntax === b.supportAlertSyntax && (a.baseUri === b.baseUri || !!a.baseUri && !!b.baseUri && isEqual(URI.from(a.baseUri), URI.from(b.baseUri)));
  }
}
function escapeMarkdownSyntaxTokens(text) {
  return text.replace(/[\\`*_{}[\]()#+!~]/g, "\\$&").replace(/^([ \t]*)-/gm, "$1\\-");
}
function escapeMarkdownLinkLabel(text) {
  return text.replace(/[\\\]]/g, "\\$&");
}
function appendEscapedMarkdownCodeBlockFence(code, langId) {
  const longestFenceLength = code.match(/^`+/gm)?.reduce((a, b) => a.length > b.length ? a : b).length ?? 0;
  const desiredFenceLength = longestFenceLength >= 3 ? longestFenceLength + 1 : 3;
  return [
    `${"`".repeat(desiredFenceLength)}${langId}`,
    code,
    `${"`".repeat(desiredFenceLength)}`
  ].join("\n");
}
function appendEscapedMarkdownInlineCode(text) {
  const longestBacktickRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length));
  const fence = "`".repeat(longestBacktickRun + 1);
  const needsSpace = text.startsWith("`") || text.endsWith("`");
  const content = needsSpace ? ` ${text} ` : text;
  return `${fence}${content}${fence}`;
}
function escapeDoubleQuotes(input) {
  return input.replace(/"/g, "&quot;");
}
function removeMarkdownEscapes(text) {
  if (!text) {
    return text;
  }
  return text.replace(/\\([\\`*_{}[\]()#+\-.!~])/g, "$1");
}
function parseHrefAndDimensions(href) {
  const dimensions = [];
  const splitted = href.split("|").map((s) => s.trim());
  href = splitted[0];
  const parameters = splitted[1];
  if (parameters) {
    const heightFromParams = /height=(\d+)/.exec(parameters);
    const widthFromParams = /width=(\d+)/.exec(parameters);
    const height = heightFromParams ? heightFromParams[1] : "";
    const width = widthFromParams ? widthFromParams[1] : "";
    const widthIsFinite = isFinite(parseInt(width));
    const heightIsFinite = isFinite(parseInt(height));
    if (widthIsFinite) {
      dimensions.push(`width="${width}"`);
    }
    if (heightIsFinite) {
      dimensions.push(`height="${height}"`);
    }
  }
  return { href, dimensions };
}
function createMarkdownLink(text, href, title, escapeTokens = true) {
  return `[${escapeTokens ? escapeMarkdownSyntaxTokens(text) : text}](${href}${title ? ` "${escapeMarkdownSyntaxTokens(title)}"` : ""})`;
}
function createMarkdownCommandLink(command, escapeTokens = true) {
  const uri = createCommandUri(command.id, ...command.arguments || []).toString();
  return createMarkdownLink(command.text, uri, command.tooltip, escapeTokens);
}
function createCommandUri(commandId, ...commandArgs) {
  return URI.from({
    scheme: Schemas.command,
    path: commandId,
    query: commandArgs.length ? encodeURIComponent(JSON.stringify(commandArgs)) : void 0
  });
}
const placeholderAuthority = /^https?:\/\/_[^/?#]*_(?:[/?#]|$)/i;
const absolutePath = /^(?:[/\\]|[a-z]:[/\\])/i;
function isPortableLinkTarget(target) {
  const trimmed = target.trim();
  return matchesSomeScheme(trimmed, Schemas.http, Schemas.https, Schemas.mailto) && !placeholderAuthority.test(trimmed);
}
function isPortableMarkdownTarget(target) {
  const trimmed = target.trim();
  return isPortableLinkTarget(trimmed) || !!trimmed && !/^[a-z][a-z0-9.+-]*:/i.test(trimmed) && !absolutePath.test(trimmed);
}
export {
  MarkdownString,
  MarkdownStringTextNewlineStyle,
  appendEscapedMarkdownCodeBlockFence,
  appendEscapedMarkdownInlineCode,
  createCommandUri,
  createMarkdownCommandLink,
  createMarkdownLink,
  escapeDoubleQuotes,
  escapeMarkdownLinkLabel,
  escapeMarkdownSyntaxTokens,
  isEmptyMarkdownString,
  isMarkdownString,
  isPortableLinkTarget,
  isPortableMarkdownTarget,
  markdownStringEqual,
  parseHrefAndDimensions,
  removeMarkdownEscapes
};
