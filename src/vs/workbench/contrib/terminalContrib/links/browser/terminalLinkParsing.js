import { Lazy } from "../../../../../base/common/lazy.js";
import { OperatingSystem } from "../../../../../base/common/platform.js";
const linkSuffixRegexEol = new Lazy(() => generateLinkSuffixRegex(true));
const linkSuffixRegex = new Lazy(() => generateLinkSuffixRegex(false));
function generateLinkSuffixRegex(eolOnly) {
  let ri = 0;
  let ci = 0;
  let rei = 0;
  let cei = 0;
  function r() {
    return `(?<row${ri++}>\\d+)`;
  }
  function c() {
    return `(?<col${ci++}>\\d+)`;
  }
  function re() {
    return `(?<rowEnd${rei++}>\\d+)`;
  }
  function ce() {
    return `(?<colEnd${cei++}>\\d+)`;
  }
  const eolSuffix = eolOnly ? "$" : "";
  const lineAndColumnRegexClauses = [
    // foo:339
    // foo:339:12
    // foo:339:12-789
    // foo:339:12-341.789
    // foo:339.12
    // foo 339
    // foo 339:12                              [#140780]
    // foo 339.12
    // foo#339
    // foo#339:12                              [#190288]
    // foo#339.12
    // foo, 339                                [#217927]
    // "foo",339
    // "foo",339:12
    // "foo",339.12
    // "foo",339.12-789
    // "foo",339.12-341.789
    `(?::|#| |['"],|, )${r()}([:.]${c()}(?:-(?:${re()}\\.)?${ce()})?)?` + eolSuffix,
    // The quotes below are optional           [#171652]
    // "foo", line 339                         [#40468]
    // "foo", line 339, col 12
    // "foo", line 339, column 12
    // "foo":line 339
    // "foo":line 339, col 12
    // "foo":line 339, column 12
    // "foo": line 339
    // "foo": line 339, col 12
    // "foo": line 339, column 12
    // "foo" on line 339
    // "foo" on line 339, col 12
    // "foo" on line 339, column 12
    // "foo" line 339 column 12
    // "foo", line 339, character 12           [#171880]
    // "foo", line 339, characters 12-789      [#171880]
    // "foo", lines 339-341                    [#171880]
    // "foo", lines 339-341, characters 12-789 [#178287]
    `['"]?(?:,? |: ?| on )lines? ${r()}(?:-${re()})?(?:,? (?:col(?:umn)?|characters?) ${c()}(?:-${ce()})?)?` + eolSuffix,
    // () and [] are interchangeable
    // foo(339)
    // foo(339,12)
    // foo(339, 12)
    // foo (339)
    // foo (339,12)
    // foo (339, 12)
    // foo: (339)
    // foo: (339,12)
    // foo: (339, 12)
    // foo(339:12)                             [#229842]
    // foo (339:12)                            [#229842]
    `:? ?[\\[\\(]${r()}(?:(?:, ?|:)${c()})?[\\]\\)]` + eolSuffix
  ];
  const suffixClause = lineAndColumnRegexClauses.join("|").replace(/ /g, `[${"\xA0"} ]`);
  return new RegExp(`(${suffixClause})`, eolOnly ? void 0 : "g");
}
function removeLinkSuffix(link) {
  const suffix = getLinkSuffix(link)?.suffix;
  if (!suffix) {
    return link;
  }
  return link.substring(0, suffix.index);
}
function removeLinkQueryString(link) {
  const start = link.startsWith("\\\\?\\") ? 4 : 0;
  const index = link.indexOf("?", start);
  if (index === -1) {
    return link;
  }
  return link.substring(0, index);
}
function detectLinkSuffixes(line) {
  let match;
  const results = [];
  linkSuffixRegex.value.lastIndex = 0;
  while ((match = linkSuffixRegex.value.exec(line)) !== null) {
    const suffix = toLinkSuffix(match);
    if (suffix === null) {
      break;
    }
    results.push(suffix);
  }
  return results;
}
function getLinkSuffix(link) {
  return toLinkSuffix(linkSuffixRegexEol.value.exec(link));
}
function toLinkSuffix(match) {
  const groups = match?.groups;
  if (!groups || match.length < 1) {
    return null;
  }
  return {
    row: parseIntOptional(groups.row0 || groups.row1 || groups.row2),
    col: parseIntOptional(groups.col0 || groups.col1 || groups.col2),
    rowEnd: parseIntOptional(groups.rowEnd0 || groups.rowEnd1 || groups.rowEnd2),
    colEnd: parseIntOptional(groups.colEnd0 || groups.colEnd1 || groups.colEnd2),
    suffix: { index: match.index, text: match[0] }
  };
}
function parseIntOptional(value) {
  if (value === void 0) {
    return value;
  }
  return parseInt(value);
}
const linkWithSuffixPathCharacters = /(?<path>(?:file:\/\/\/)?[^\s\|<>\[\({][^\s\|<>]*)$/;
function detectLinks(line, os) {
  const results = detectLinksViaSuffix(line);
  const noSuffixPaths = detectPathsNoSuffix(line, os);
  binaryInsertList(results, noSuffixPaths);
  return results;
}
function binaryInsertList(list, newItems) {
  if (list.length === 0) {
    list.push(...newItems);
  }
  for (const item of newItems) {
    binaryInsert(list, item, 0, list.length);
  }
}
function binaryInsert(list, newItem, low, high) {
  if (list.length === 0) {
    list.push(newItem);
    return;
  }
  if (low > high) {
    return;
  }
  const mid = Math.floor((low + high) / 2);
  if (mid >= list.length || newItem.path.index < list[mid].path.index && (mid === 0 || newItem.path.index > list[mid - 1].path.index)) {
    if (mid >= list.length || newItem.path.index + newItem.path.text.length < list[mid].path.index && (mid === 0 || newItem.path.index > list[mid - 1].path.index + list[mid - 1].path.text.length)) {
      list.splice(mid, 0, newItem);
    }
    return;
  }
  if (newItem.path.index > list[mid].path.index) {
    binaryInsert(list, newItem, mid + 1, high);
  } else {
    binaryInsert(list, newItem, low, mid - 1);
  }
}
function detectLinksViaSuffix(line) {
  const results = [];
  const suffixes = detectLinkSuffixes(line);
  for (const suffix of suffixes) {
    const suffixEndIndex = suffix.suffix.index + suffix.suffix.text.length;
    if (line[suffixEndIndex] === "/") {
      continue;
    }
    const beforeSuffix = line.substring(0, suffix.suffix.index);
    const possiblePathMatch = beforeSuffix.match(linkWithSuffixPathCharacters);
    if (possiblePathMatch && possiblePathMatch.index !== void 0 && possiblePathMatch.groups?.path) {
      let linkStartIndex = possiblePathMatch.index;
      let path = possiblePathMatch.groups.path;
      let prefix = void 0;
      const prefixMatch = path.match(/^(?<prefix>['"]+)/);
      if (prefixMatch?.groups?.prefix) {
        prefix = {
          index: linkStartIndex,
          text: prefixMatch.groups.prefix
        };
        path = path.substring(prefix.text.length);
        if (path.trim().length === 0) {
          continue;
        }
        if (prefixMatch.groups.prefix.length > 1) {
          if (suffix.suffix.text[0].match(/['"]/) && prefixMatch.groups.prefix[prefixMatch.groups.prefix.length - 1] === suffix.suffix.text[0]) {
            const trimPrefixAmount = prefixMatch.groups.prefix.length - 1;
            prefix.index += trimPrefixAmount;
            prefix.text = prefixMatch.groups.prefix[prefixMatch.groups.prefix.length - 1];
            linkStartIndex += trimPrefixAmount;
          }
        }
      }
      results.push({
        path: {
          index: linkStartIndex + (prefix?.text.length || 0),
          text: path
        },
        prefix,
        suffix
      });
      const openingBracketMatch = path.matchAll(/(?<bracket>[\[\(])(?![\]\)])/g);
      for (const match of openingBracketMatch) {
        const bracket = match.groups?.bracket;
        if (bracket) {
          results.push({
            path: {
              index: linkStartIndex + (prefix?.text.length || 0) + match.index + 1,
              text: path.substring(match.index + bracket.length)
            },
            prefix,
            suffix
          });
        }
      }
    }
  }
  return results;
}
var RegexPathConstants = /* @__PURE__ */ ((RegexPathConstants2) => {
  RegexPathConstants2["PathPrefix"] = "(?:\\.\\.?|\\~|file://)";
  RegexPathConstants2["PathSeparatorClause"] = "\\/";
  RegexPathConstants2["ExcludedPathCharactersClause"] = "[^\\0<>\\?\\s!`&*()'\":;\\\\]";
  RegexPathConstants2["ExcludedStartPathCharactersClause"] = "[^\\0<>\\?\\s!`&*()\\[\\]'\":;\\\\]";
  RegexPathConstants2["WinOtherPathPrefix"] = "\\.\\.?|\\~";
  RegexPathConstants2["WinPathSeparatorClause"] = "(?:\\\\|\\/)";
  RegexPathConstants2["WinExcludedPathCharactersClause"] = "[^\\0<>\\?\\|\\/\\s!`&*()'\":;]";
  RegexPathConstants2["WinExcludedStartPathCharactersClause"] = "[^\\0<>\\?\\|\\/\\s!`&*()\\[\\]'\":;]";
  return RegexPathConstants2;
})(RegexPathConstants || {});
const unixLocalLinkClause = "(?:(?:(?:\\.\\.?|\\~|file://)|(?:[^\\0<>\\?\\s!`&*()\\[\\]'\":;\\\\][^\\0<>\\?\\s!`&*()'\":;\\\\]*))?(?:\\/(?:[^\\0<>\\?\\s!`&*()'\":;\\\\])+)+)";
const winDrivePrefix = "(?:\\\\\\\\\\?\\\\|file:\\/\\/\\/)?[a-zA-Z]:";
const winLocalLinkClause = `(?:(?:(?:${winDrivePrefix}|${"\\.\\.?|\\~" /* WinOtherPathPrefix */})|(?:[^\\0<>\\?\\|\\/\\s!\`&*()\\[\\]'":;][^\\0<>\\?\\|\\/\\s!\`&*()'":;]*))?(?:(?:\\\\|\\/)(?:[^\\0<>\\?\\|\\/\\s!\`&*()'":;])+)+)`;
const diffFilePrefix = "[abciow12]\\/";
const gitDiffLineRegex = new Lazy(() => new RegExp(`^[-+]{3} ${diffFilePrefix}`));
const gitDiffTextRegex = new Lazy(() => new RegExp(`^${diffFilePrefix}`));
function detectPathsNoSuffix(line, os) {
  const results = [];
  const regex = new RegExp(os === OperatingSystem.Windows ? winLocalLinkClause : unixLocalLinkClause, "g");
  let match;
  while ((match = regex.exec(line)) !== null) {
    let text = match[0];
    let index = match.index;
    if (!text) {
      break;
    }
    if (
      // --- a/foo/bar
      // +++ b/foo/bar
      gitDiffLineRegex.value.test(line) && index === 4 || // diff --git a/foo/bar b/foo/bar
      line.startsWith("diff --git") && gitDiffTextRegex.value.test(text)
    ) {
      text = text.substring(2);
      index += 2;
    }
    results.push({
      path: {
        index,
        text
      },
      prefix: void 0,
      suffix: void 0
    });
  }
  return results;
}
export {
  detectLinkSuffixes,
  detectLinks,
  getLinkSuffix,
  removeLinkQueryString,
  removeLinkSuffix,
  toLinkSuffix,
  winDrivePrefix
};
