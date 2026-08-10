import * as marked from "./marked/marked.js";
function isOpaque(token) {
  switch (token.type) {
    case "code":
    case "codespan":
    case "html":
    case "link":
    case "image":
    case "def":
      return true;
    default:
      return false;
  }
}
function childrenOf(token) {
  const candidate = token;
  if (candidate.items?.length) {
    return candidate.items;
  }
  if (candidate.header || candidate.rows) {
    const cells = [...candidate.header ?? [], ...(candidate.rows ?? []).flat()];
    return cells.flatMap((cell) => cell.tokens ?? []);
  }
  return candidate.tokens ?? [];
}
function markdownTokensToPlainText(tokens) {
  let text = "";
  for (const token of tokens) {
    const children = token.tokens;
    text += children?.length ? markdownTokensToPlainText(children) : token.text ?? token.raw ?? "";
  }
  return text;
}
function collectEdits(tokens, markdown, cursor, rewriter, edits, codeRanges, unlocatable) {
  for (const token of tokens) {
    if (!isOpaque(token)) {
      const children = childrenOf(token);
      if (children.length) {
        cursor = collectEdits(children, markdown, cursor, rewriter, edits, codeRanges, unlocatable);
        continue;
      }
    }
    const raw = token.raw ?? "";
    if (!raw) {
      continue;
    }
    const start = markdown.indexOf(raw, cursor);
    if (start < 0) {
      if (token.type === "link" || token.type === "image") {
        unlocatable.push(token);
      }
      continue;
    }
    const end = start + raw.length;
    cursor = end;
    if (token.type === "code" || token.type === "codespan") {
      codeRanges.push({ start, end });
    } else if (token.type === "link" || token.type === "image") {
      const replacement = rewriter.rewriteLink(token);
      if (replacement !== void 0) {
        edits.push({ start, end, replacement });
      } else {
        collectEdits(childrenOf(token), markdown, start, rewriter, edits, codeRanges, unlocatable);
      }
    }
  }
  return cursor;
}
function findDefinitionRanges(tokens, markdown) {
  const ranges = [];
  let cursor = 0;
  for (const token of tokens) {
    const raw = token.raw ?? "";
    const start = raw ? markdown.indexOf(raw, cursor) : -1;
    if (start < 0) {
      return [];
    }
    if (start > cursor && markdown.substring(cursor, start).trim()) {
      ranges.push({ start: cursor, end: start });
    }
    cursor = start + raw.length;
  }
  if (markdown.substring(cursor).trim()) {
    ranges.push({ start: cursor, end: markdown.length });
  }
  return ranges;
}
function rewriteMarkdownLinks(markdown, rewriter) {
  let tokens;
  try {
    tokens = marked.lexer(markdown);
  } catch {
    return markdown;
  }
  const edits = [];
  const codeRanges = [];
  const unlocatable = [];
  collectEdits(tokens, markdown, 0, rewriter, edits, codeRanges, unlocatable);
  edits.push(...rewriter.additionalEdits?.(markdown, {
    codeRanges,
    definitionRanges: findDefinitionRanges(tokens, markdown),
    unlocatable
  }) ?? []);
  if (!edits.length) {
    return markdown;
  }
  edits.sort((a, b) => a.start - b.start);
  let result = "";
  let position = 0;
  for (const edit of edits) {
    if (edit.start < position) {
      continue;
    }
    result += markdown.substring(position, edit.start) + edit.replacement;
    position = edit.end;
  }
  return result + markdown.substring(position);
}
export {
  markdownTokensToPlainText,
  rewriteMarkdownLinks
};
